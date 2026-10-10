/**
 * English-only framework navigation within the EXISTING public API docs.
 * These are section anchors, never new indexable marketing URLs or SDK claims.
 */
export const integrationGuides = [
  {
    id: 'integration-nodejs',
    name: 'Node.js / JavaScript',
    codeKey: 'JavaScript',
    summary: 'Use built-in fetch on a modern Node.js server to send through a session-bound Bearer key.',
    requirements: 'Node.js with fetch support; store RELAYWA_SESSION_KEY in server-side environment variables. Never expose it in browser JavaScript.',
    webhook: 'Handle signed HTTPS webhook callbacks using the exact raw request body; verify HMAC before parsing JSON.',
  },
  {
    id: 'integration-laravel',
    name: 'Laravel / PHP',
    codeKey: 'Laravel',
    summary: 'Send from a Laravel service with Http::withToken, and use Laravel jobs when your business needs scheduled sending or retry backoff.',
    requirements: 'Set RELAYWA_SESSION_KEY in server-side secrets and services.relaywa.url to the public RelayWA API base (for example https://relaywa.com/api).',
    webhook: 'Verify the HMAC against the raw request content, then dispatch processing to your Laravel application queue.',
  },
  {
    id: 'integration-python',
    name: 'Python',
    codeKey: 'Python',
    summary: 'Call the HTTPS REST endpoint from a Python worker using requests with JSON and a scoped session Bearer key.',
    requirements: 'Install requests, use an absolute https://.../api URL, handle raise_for_status and store the credential outside source control.',
    webhook: 'Verify signed event requests using the raw body in your FastAPI/Flask handler before interpreting event data.',
  },
  {
    id: 'integration-dotnet',
    name: 'C# / .NET',
    codeKey: 'C#',
    summary: 'Send typed JSON requests with HttpClient from a .NET backend and inspect response status before processing results.',
    requirements: 'Configure a reusable HttpClient, a server-side session key and the public HTTPS API base; include System.Net.Http.Json where needed.',
    webhook: 'Validate webhook HMAC using the raw request bytes in ASP.NET Core before processing inbound events.',
  },
  {
    id: 'integration-n8n',
    name: 'n8n HTTP Request',
    codeKey: 'n8n',
    summary: 'Use the general n8n HTTP Request node to call RelayWA; this is a manual setup recipe, not an official packaged n8n connector.',
    requirements: 'Create an HTTP Request step, use a scoped Bearer credential stored in n8n Credentials, and set an absolute https://.../api/send-message URL.',
    webhook: 'Use an n8n Webhook workflow only with appropriate raw-body HMAC verification; otherwise verify via a small trusted middleware service.',
  },
] as const;

export type IntegrationGuideId = typeof integrationGuides[number]['id'];

export function integrationGuideHref(id: IntegrationGuideId): string {
  if (!integrationGuides.some((item) => item.id === id)) throw new Error('Unknown integration guide');
  return `/api-docs#${id}`;
}
