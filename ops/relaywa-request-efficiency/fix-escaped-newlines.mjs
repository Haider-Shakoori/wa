// Replace literal backslash-n SQL escapes with valid newline escapes in the command claim handler.
export function fixEscapedNewlines(source) {
  const start = source.indexOf('f.post("/commands/claim"');
  const end = source.indexOf('let s = await e.env.DB.prepare', start);
  if (start < 0 || end < start || end - start > 1500) throw Error('Unexpected handler');
  const section = source.slice(start, end);
  const before = String.fromCharCode(92, 92, 110);
  const after = String.fromCharCode(92, 110);
  const count = section.split(before).length - 1;
  if (count !== 2) throw Error('Expected two malformed SQL newlines, got ' + count);
  return source.slice(0, start) + section.split(before).join(after) + source.slice(end);
}
