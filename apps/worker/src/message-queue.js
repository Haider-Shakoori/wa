import { createHash } from 'node:crypto';
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';

const QUEUE_NAME = 'relaywa-outbound';
export function createMessageQueue({ redisUrl, store, sessions }) {
  const connection = { url: redisUrl };
  const rateClient = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });

  const queue = new Queue(QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      removeOnComplete: 1000,
      removeOnFail: 5000,
    },
  });

  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const message = await store.claimOutboundMessageById(job.data.messageId);
      if (!message) return { skipped: true };

      const safety = await store.getMessagingSafetySettings();

      try {
        if (safety.enabled) {
          const now = Date.now();
          const pausedUntil = message.messaging_paused_until
            ? new Date(message.messaging_paused_until).getTime()
            : 0;

          if (pausedUntil > now) {
            await store.rescheduleMessageForSafety(
              message.id,
              new Date(pausedUntil),
              message.messaging_pause_reason || 'safety_auto_pause',
            );
            return { deferred: true, reason: 'safety_auto_pause' };
          }

          const createdAt = new Date(message.created_at ?? now).getTime();
          const queueAgeSeconds = Math.max(0, (now - createdAt) / 1000);
          if (queueAgeSeconds > safety.maxQueueAgeSeconds) {
            await store.markMessageQueueExpired(message.id, message.session_id, queueAgeSeconds);
            return { rejected: true, reason: 'queue_expired' };
          }

          const fingerprint = messageFingerprint(message);
          const duplicateAllowed = await registerDuplicateGuard(
            rateClient,
            message.session_id,
            fingerprint,
            message.id,
            safety.duplicateWindowSeconds,
          );

          if (!duplicateAllowed) {
            await store.markMessageSafetyRejected(
              message.id,
              'safety_duplicate_suppressed: matching message recently queued for this session',
            );
            await store.event(message.session_id, 'message.duplicate_suppressed', {
              messageId: message.id,
              recipient: message.recipient_phone,
              duplicateWindowSeconds: safety.duplicateWindowSeconds,
            });
            return { rejected: true, reason: 'duplicate_suppressed' };
          }

          const limits = await consumeSafetyWindows(rateClient, message.session_id, safety);
          if (!limits.ok) {
            await store.rescheduleMessageForSafety(
              message.id,
              limits.retryAt,
              `safety_rate_limit:${limits.reason}`,
            );
            return { deferred: true, reason: limits.reason };
          }

          const randomDelayMs = randomBetween(safety.minDelayMs, safety.maxDelayMs);
          const spacingWaitMs = await claimSessionSendSlot(
            rateClient,
            message.session_id,
            randomDelayMs,
          );

          if (spacingWaitMs > 0) {
            await store.rescheduleMessageForSafety(
              message.id,
              new Date(Date.now() + spacingWaitMs),
              'safety_randomized_spacing',
            );
            return { deferred: true, reason: 'randomized_spacing' };
          }
        } else {
          const allowed = await consumeSessionRateLimit(
            rateClient,
            message.session_id,
            Number(process.env.MESSAGE_RATE_LIMIT_MAX ?? 20),
            Number(process.env.MESSAGE_RATE_LIMIT_WINDOW_MS ?? 10000),
          );

          if (!allowed.ok) {
            await store.deferRateLimitedMessage(message.id, allowed.retryAt);
            await sleep(Math.max(0, allowed.retryAt.getTime() - Date.now()));
          }
        }

        if (message.message_type === 'text') {
          await sessions.sendText(message.session_id, message);
        } else if (['image', 'video', 'audio', 'document'].includes(message.message_type)) {
          await sessions.sendMedia(message.session_id, message);
        } else {
          await sessions.sendAction(message.session_id, message);
        }

        if (safety.enabled) {
          await clearFailureWindow(rateClient, message.session_id);
        }
        return { sent: true };
      } catch (error) {
        const configuredAttempts = Number(job.opts.attempts ?? safety.maxAttempts ?? 5);
        const retrying = job.attemptsMade + 1 < configuredAttempts;
        await store.markMessageAttemptFailed(message.id, error, retrying);

        if (safety.enabled && !retrying) {
          const failures = await recordFailureWindow(rateClient, message.session_id, safety);
          if (failures >= safety.failurePauseThreshold) {
            await store.pauseSessionMessaging(
              message.session_id,
              safety.autoPauseSeconds,
              `Safety Governor: ${failures} final send failures within ${safety.failureWindowSeconds} seconds`,
            );
          }
        }

        throw error;
      }
    },
    {
      connection,
      concurrency: Number(process.env.MESSAGE_QUEUE_CONCURRENCY ?? 10),
      limiter: {
        max: Number(process.env.MESSAGE_GLOBAL_RATE_LIMIT_MAX ?? 100),
        duration: Number(process.env.MESSAGE_GLOBAL_RATE_LIMIT_WINDOW_MS ?? 1000),
      },
    },
  );

  worker.on('failed', async (job, error) => {
    if (!job) return;
    if (job.attemptsMade >= Number(job.opts.attempts ?? 1)) {
      await store.markMessageFailed(job.data.messageId, error);
    }
  });

  return {
    queue,
    worker,
    async enqueue(message) {
      const safety = await store.getMessagingSafetySettings();
      const delay = Math.max(
        0,
        new Date(message.next_attempt_at ?? message.scheduled_at ?? Date.now()).getTime() - Date.now(),
      );
      const jobId = `msg-${message.id}`;
      const configuredAttempts = safety.enabled
        ? Math.max(1, Math.min(Number(message.max_attempts ?? safety.maxAttempts), safety.maxAttempts))
        : Math.max(1, Number(message.max_attempts ?? 5));
      const retryBaseMs = safety.enabled
        ? safety.retryBaseMs
        : Number(process.env.MESSAGE_RETRY_BASE_MS ?? 5000);

      await queue.add(
        'send-message',
        { messageId: message.id },
        {
          jobId,
          delay,
          priority: Number(message.priority ?? 5),
          attempts: configuredAttempts,
          backoff: {
            type: 'exponential',
            delay: retryBaseMs,
          },
        },
      );
      await store.markMessageEnqueued(message.id, jobId);
    },
    async close() {
      await worker.close();
      await queue.close();
      await rateClient.quit();
    },
  };
}

export async function pumpReadyMessages({ store, messageQueue, signal }) {
  while (!signal.aborted) {
    const messages = await store.listDispatchReadyMessages(
      Number(process.env.MESSAGE_QUEUE_PUMP_BATCH ?? 100),
    );
    for (const message of messages) {
      if (signal.aborted) break;
      await messageQueue.enqueue(message);
    }
    await sleep(Number(process.env.MESSAGE_QUEUE_PUMP_MS ?? 1000), signal);
  }
}

function messageFingerprint(message) {
  const canonical = JSON.stringify({
    recipient: message.recipient_jid ?? message.recipient_phone ?? '',
    type: message.message_type ?? '',
    text: message.text_body ?? '',
    mediaUrl: message.media_url ?? '',
    caption: message.media_caption ?? '',
    action: message.action_payload ?? {},
  });
  return createHash('sha256').update(canonical).digest('hex');
}

async function registerDuplicateGuard(client, sessionId, fingerprint, messageId, ttlSeconds) {
  if (Number(ttlSeconds) <= 0) return true;
  const key = `relaywa:safety:duplicate:${sessionId}:${fingerprint}`;
  const inserted = await client.set(key, String(messageId), 'EX', Number(ttlSeconds), 'NX');
  if (inserted === 'OK') return true;
  return (await client.get(key)) === String(messageId);
}

async function consumeSafetyWindows(client, sessionId, settings) {
  const windows = [
    ['burst', settings.burstLimit, settings.burstWindowSeconds * 1000],
    ['minute', settings.messagesPerMinute, 60000],
    ['hour', settings.messagesPerHour, 3600000],
  ];

  let retryMs = 0;
  let reason = '';

  for (const [name, max, windowMs] of windows) {
    const result = await consumeFixedWindow(
      client,
      `relaywa:safety:${name}:${sessionId}`,
      Number(max),
      Number(windowMs),
    );
    if (!result.ok && result.retryMs > retryMs) {
      retryMs = result.retryMs;
      reason = `${name}_limit`;
    }
  }

  return {
    ok: retryMs === 0,
    retryAt: new Date(Date.now() + retryMs),
    reason: reason || 'allowed',
  };
}

async function consumeFixedWindow(client, key, max, windowMs) {
  const result = await client.eval(
    `local current = redis.call('INCR', KEYS[1])
     if current == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
     local ttl = redis.call('PTTL', KEYS[1])
     return {current, ttl}`,
    1,
    key,
    String(windowMs),
  );
  const [countRaw, ttlRaw] = result;
  const count = Number(countRaw);
  const retryMs = Math.max(Number(ttlRaw), 1);
  return { ok: count <= max, retryMs };
}

async function claimSessionSendSlot(client, sessionId, delayMs) {
  const key = `relaywa:safety:send-cooldown:${sessionId}`;
  const claimed = await client.set(key, '1', 'PX', Math.max(1000, Number(delayMs)), 'NX');
  if (claimed === 'OK') return 0;
  const ttl = await client.pttl(key);
  return Math.max(Number(ttl), 250);
}

async function recordFailureWindow(client, sessionId, settings) {
  const key = `relaywa:safety:failures:${sessionId}`;
  const result = await client.eval(
    `local current = redis.call('INCR', KEYS[1])
     if current == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
     return current`,
    1,
    key,
    String(settings.failureWindowSeconds),
  );
  return Number(result);
}

async function clearFailureWindow(client, sessionId) {
  await client.del(`relaywa:safety:failures:${sessionId}`);
}

async function consumeSessionRateLimit(client, sessionId, max, windowMs) {
  const key = `relaywa:rate:session:${sessionId}`;
  const result = await client.eval(
    `local current = redis.call('INCR', KEYS[1])
     if current == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
     local ttl = redis.call('PTTL', KEYS[1])
     return {current, ttl}`,
    1,
    key,
    String(windowMs),
  );

  const [countRaw, ttlRaw] = result;
  const count = Number(countRaw);
  const ttl = Math.max(Number(ttlRaw), 1);
  return {
    ok: count <= max,
    retryAt: new Date(Date.now() + ttl),
  };
}

function randomBetween(min, max) {
  const safeMin = Math.max(1000, Number(min) || 1000);
  const safeMax = Math.max(safeMin, Number(max) || safeMin);
  return safeMin + Math.floor(Math.random() * (safeMax - safeMin + 1));
}

function sleep(ms, signal) {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const timer = setTimeout(resolve, ms);
    timer.unref();
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
  });
}
