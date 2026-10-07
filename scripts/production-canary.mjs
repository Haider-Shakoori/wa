const base = (process.env.CANARY_BASE_URL || 'https://wasender.businessos.af').replace(/\/$/, '');
const mode = (process.env.CANARY_MODE || 'public').toLowerCase();

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for full production canary mode`);
  return value;
}

async function request(path, options = {}) {
  const response = await fetch(`${base}${path}`, options);
  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  if (!response.ok) {
    throw new Error(`${options.method || 'GET'} ${path} failed: HTTP ${response.status} ${String(text).slice(0, 500)}`);
  }
  return body;
}

function authHeaders(apiKey, extra = {}) {
  return {
    authorization: `Bearer ${apiKey}`,
    ...extra,
  };
}

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

async function poll(label, fn, predicate, timeoutMs = 60000, intervalMs = 2000) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    last = await fn();
    if (predicate(last)) return last;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`${label} timed out after ${timeoutMs}ms. Last value: ${JSON.stringify(last)}`);
}

const health = await request('/api/health');
if (health?.status !== 'ok' || health?.brand !== 'relayWA') {
  throw new Error(`Unexpected production health response: ${JSON.stringify(health)}`);
}

const providers = await request('/api/v1/auth/providers');
if (providers?.email?.enabled !== true) {
  throw new Error(`Email authentication is not enabled: ${JSON.stringify(providers)}`);
}

const result = {
  ok: true,
  mode,
  base,
  health: {
    status: health.status,
    brand: health.brand,
    service: health.service,
  },
  authProviders: {
    email: providers?.email?.enabled === true,
    google: providers?.google?.enabled === true,
  },
};

if (mode === 'public') {
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

if (mode !== 'full') {
  throw new Error(`Unsupported CANARY_MODE "${mode}". Use public or full.`);
}

const apiKey = required('RELAYWA_CANARY_API_KEY');
const sessionId = required('RELAYWA_CANARY_SESSION_ID');
const recipient = required('RELAYWA_CANARY_RECIPIENT');
const webhookId = required('RELAYWA_CANARY_WEBHOOK_ID');
const expectedNumber = process.env.RELAYWA_CANARY_EXPECTED_NUMBER?.trim();

const session = await request(`/api/v1/sessions/${encodeURIComponent(sessionId)}`, {
  headers: authHeaders(apiKey),
});
if (session?.status !== 'connected') {
  throw new Error(`Canary WhatsApp session is not connected: ${JSON.stringify({
    id: session?.id,
    name: session?.name,
    status: session?.status,
    last_connection_error: session?.last_connection_error,
  })}`);
}

if (expectedNumber && normalizePhone(session?.phone_number) !== normalizePhone(expectedNumber)) {
  throw new Error(`Connected number mismatch: expected ${normalizePhone(expectedNumber)}, got ${normalizePhone(session?.phone_number)}`);
}

const webhooksBefore = await request('/api/v1/webhooks', {
  headers: authHeaders(apiKey),
});
const webhookBefore = Array.isArray(webhooksBefore)
  ? webhooksBefore.find((item) => item.id === webhookId)
  : null;
if (!webhookBefore) throw new Error(`Configured webhook ${webhookId} was not found`);
if (!webhookBefore.enabled) throw new Error(`Configured webhook ${webhookId} is disabled`);

const startedAt = Date.now();
const clientMessageId = `relaywa-prod-canary-${startedAt}`;
const queued = await request(`/api/v1/sessions/${encodeURIComponent(sessionId)}/messages/text`, {
  method: 'POST',
  headers: authHeaders(apiKey, { 'content-type': 'application/json' }),
  body: JSON.stringify({
    to: recipient,
    text: `relayWA production canary ${new Date(startedAt).toISOString()}`,
    clientMessageId,
  }),
});
if (!queued?.id) throw new Error(`Message queue response did not include an id: ${JSON.stringify(queued)}`);

const sent = await poll(
  'outbound message delivery',
  () => request(`/api/v1/sessions/${encodeURIComponent(sessionId)}/messages/${encodeURIComponent(queued.id)}`, {
    headers: authHeaders(apiKey),
  }),
  (message) => {
    if (message?.status === 'failed') {
      throw new Error(`Canary message failed: ${message?.last_error || 'unknown worker error'}`);
    }
    return message?.status === 'sent';
  },
);

const webhook = await poll(
  'webhook delivery',
  async () => {
    const webhooks = await request('/api/v1/webhooks', {
      headers: authHeaders(apiKey),
    });
    return Array.isArray(webhooks) ? webhooks.find((item) => item.id === webhookId) : null;
  },
  (item) => Boolean(
    item?.last_success_at &&
    Date.parse(item.last_success_at) >= startedAt &&
    Number(item?.consecutive_failures || 0) === 0
  ),
);

result.session = {
  id: session.id,
  name: session.name,
  status: session.status,
  phoneNumber: session.phone_number,
};
result.message = {
  id: sent.id,
  clientMessageId,
  status: sent.status,
  sentAt: sent.sent_at,
};
result.webhook = {
  id: webhook.id,
  name: webhook.name,
  lastSuccessAt: webhook.last_success_at,
  consecutiveFailures: webhook.consecutive_failures,
};

console.log(JSON.stringify(result, null, 2));
