import nodemailer from 'nodemailer';

function envBool(name, fallback = false) {
  const value = String(process.env[name] ?? '').trim().toLowerCase();
  if (!value) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value);
}

function parseRecipients(value) {
  return String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export class OperationalAlertMailer {
  constructor({ store }) {
    this.store = store;
    this.enabled = envBool('ALERT_EMAIL_ENABLED', true);
    this.host = String(process.env.SMTP_HOST ?? '').trim();
    this.port = Number(process.env.SMTP_PORT ?? 587);
    this.secure = envBool('SMTP_SECURE', this.port === 465);
    this.user = String(process.env.SMTP_USER ?? '').trim();
    this.pass = String(process.env.SMTP_PASS ?? '');
    this.from = String(process.env.SMTP_FROM ?? this.user).trim();
    this.explicitRecipients = parseRecipients(process.env.ALERT_EMAIL_TO);
    this.transport = this.isConfigured()
      ? nodemailer.createTransport({
          host: this.host,
          port: this.port,
          secure: this.secure,
          ...(this.user ? { auth: { user: this.user, pass: this.pass } } : {}),
        })
      : null;
  }

  isConfigured() {
    return Boolean(this.enabled && this.host && this.port && this.from);
  }

  async recipients() {
    if (this.explicitRecipients.length) return this.explicitRecipients;
    const admins = await this.store.listPlatformAdminEmails();
    if (admins.length) return admins;

    const fallback = String(process.env.RELAYWA_ADMIN_EMAIL ?? '').trim();
    return fallback ? [fallback] : [];
  }

  async deliver(alert) {
    if (!this.transport) throw new Error('Operational alert SMTP transport is not configured');

    const recipients = await this.recipients();
    if (!recipients.length) throw new Error('No operational alert recipient is configured');

    const severity = String(alert.severity || 'warning').toUpperCase();
    const subject = `[relayWA][${severity}] ${alert.subject}`;
    const details = alert.details && typeof alert.details === 'object' ? alert.details : {};
    const detailLines = Object.entries(details)
      .filter(([, value]) => value !== null && value !== undefined && value !== '')
      .map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`);

    const text = [
      alert.summary,
      '',
      `Event: ${alert.event_type}`,
      `Severity: ${severity}`,
      `Created: ${new Date(alert.created_at).toISOString()}`,
      alert.organization_id ? `Organization: ${alert.organization_id}` : null,
      alert.session_id ? `Session: ${alert.session_id}` : null,
      alert.resource_type && alert.resource_id ? `${alert.resource_type}: ${alert.resource_id}` : null,
      ...detailLines,
      '',
      'Open the relayWA platform console to investigate and take action.',
    ].filter(Boolean).join('\n');

    const detailsHtml = detailLines.length
      ? `<ul>${detailLines.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>`
      : '';

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;padding:24px;color:#111827">
        <div style="font-size:22px;font-weight:700;margin-bottom:16px">relayWA operational alert</div>
        <div style="font-size:16px;font-weight:700;margin-bottom:8px">${escapeHtml(alert.subject)}</div>
        <p style="line-height:1.6">${escapeHtml(alert.summary)}</p>
        <table style="border-collapse:collapse;width:100%;margin:18px 0">
          <tr><td style="padding:6px 0;font-weight:700">Event</td><td>${escapeHtml(alert.event_type)}</td></tr>
          <tr><td style="padding:6px 0;font-weight:700">Severity</td><td>${escapeHtml(severity)}</td></tr>
          <tr><td style="padding:6px 0;font-weight:700">Created</td><td>${escapeHtml(new Date(alert.created_at).toISOString())}</td></tr>
          ${alert.organization_id ? `<tr><td style="padding:6px 0;font-weight:700">Organization</td><td>${escapeHtml(alert.organization_id)}</td></tr>` : ''}
          ${alert.session_id ? `<tr><td style="padding:6px 0;font-weight:700">Session</td><td>${escapeHtml(alert.session_id)}</td></tr>` : ''}
        </table>
        ${detailsHtml}
        <p style="margin-top:20px">Open the relayWA platform console to investigate and take action.</p>
      </div>`;

    await this.transport.sendMail({
      from: this.from,
      to: recipients.join(', '),
      subject,
      text,
      html,
    });

    return { recipients: recipients.length };
  }
}
