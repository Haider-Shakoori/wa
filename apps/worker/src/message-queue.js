import { Queue, Worker } from 'bullmq';

const QUEUE_NAME = 'relaywa-outbound';

export function createMessageQueue({ redisUrl, store, sessions }) {
  const connection = { url: redisUrl };
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

      const allowed = await store.consumeSessionRateLimit(
        message.session_id,
        Number(process.env.MESSAGE_RATE_LIMIT_MAX ?? 20),
        Number(process.env.MESSAGE_RATE_LIMIT_WINDOW_MS ?? 10000),
      );

      if (!allowed.ok) {
        await store.deferRateLimitedMessage(message.id, allowed.retryAt);
        await job.moveToDelayed(allowed.retryAt.getTime());
        return { rateLimited: true };
      }

      try {
        if (message.message_type === 'text') {
          await sessions.sendText(message.session_id, message);
        } else if (['image', 'video', 'audio', 'document'].includes(message.message_type)) {
          await sessions.sendMedia(message.session_id, message);
        } else {
          await sessions.sendAction(message.session_id, message);
        }
        return { sent: true };
      } catch (error) {
        const retrying = job.attemptsMade + 1 < Number(message.max_attempts ?? 5);
        await store.markMessageAttemptFailed(message.id, error, retrying);
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
      const delay = Math.max(
        0,
        new Date(message.next_attempt_at ?? message.scheduled_at ?? Date.now()).getTime() - Date.now(),
      );
      const jobId = `msg-${message.id}`;
      await queue.add(
        'send-message',
        { messageId: message.id },
        {
          jobId,
          delay,
          priority: Number(message.priority ?? 5),
          attempts: Number(message.max_attempts ?? 5),
          backoff: {
            type: 'exponential',
            delay: Number(process.env.MESSAGE_RETRY_BASE_MS ?? 5000),
          },
        },
      );
      await store.markMessageEnqueued(message.id, jobId);
    },
    async close() {
      await worker.close();
      await queue.close();
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

function sleep(ms, signal) {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const timer = setTimeout(resolve, ms);
    timer.unref();
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
  });
}
