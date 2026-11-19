/**
 * Safe, deterministic, single-step conversation flow matching.
 * No network calls, template interpolation or executable user code.
 */
const normalized = text => String(text ?? '').normalize('NFKC').toLocaleLowerCase().trim();
export function validateFlow(flow) {
  if (!flow || !Array.isArray(flow.steps) || flow.steps.length > 50) throw Error('Invalid flow');
  const ids = new Set();
  for (const step of flow.steps) {
    if (typeof step.id !== 'string' || !/^[\w-]{1,64}$/.test(step.id) || ids.has(step.id)
      || typeof step.trigger !== 'string' || !step.trigger.trim() || step.trigger.length > 160
      || typeof step.reply !== 'string' || !step.reply.trim() || step.reply.length > 4000) {
      throw Error('Invalid flow step');
    }
    ids.add(step.id);
  }
  return flow;
}
export function matchFlow(flow, text) {
  validateFlow(flow);
  const step = flow.steps.find(item => normalized(item.trigger) === normalized(text));
  return step ? { action: 'reply', stepId: step.id, text: step.reply } : { action: 'unmatched' };
}
