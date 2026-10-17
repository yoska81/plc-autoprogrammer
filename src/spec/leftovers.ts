/**
 * Text that does not belong to this machine: notes or motor names left over from another project
 * (e.g. a project started as a copy of the example). Words of 5+ letters in `text` that never
 * appear in the machine description are listed; most of them missing means "probably left over".
 */
const STOP = new Set(['about', 'after', 'again', 'before', 'being', 'below', 'between', 'every', 'first', 'their', 'there',
  'these', 'thing', 'those', 'through', 'under', 'until', 'using', 'where', 'which', 'while', 'would', 'should', 'could',
  'start', 'stops', 'stop', 'button', 'buttons', 'motor', 'program', 'machine', 'output', 'input', 'inputs', 'outputs',
  'fault', 'reset', 'manual', 'circuit', 'healthy', 'safety', 'register', 'comments', 'short', 'value', 'values', 'other',
  // generic PLC program words (block names of every program)
  'alarm', 'modes', 'outputs', 'status', 'cycle', 'automatic', 'general', 'first-scan', 'seal-in', 'standard', 'sequence', 'setup', 'diagnostic']);

// "pushers" → "pusher", but "status", "process" stay as they are.
const singular = (w: string) => (/(us|ss|is)$/.test(w) ? w : w.replace(/(es|s)$/, ''));

export function unmatchedTerms(text: string, spec: string): string[] {
  const hay = spec.toLowerCase();
  const words = [...new Set((text.toLowerCase().match(/[a-z][a-z-]{4,}/g) ?? []).map(singular))]
    .filter((w) => w.length >= 5 && !STOP.has(w));
  return words.filter((w) => !hay.includes(w));
}

/** True when most of the distinctive words of `text` are not in the description. */
export function looksLeftOver(text: string, spec: string, minWords = 2): { leftOver: boolean; terms: string[] } {
  if (!text.trim() || !spec.trim()) return { leftOver: false, terms: [] };
  const all = [...new Set((text.toLowerCase().match(/[a-z][a-z-]{4,}/g) ?? []).map(singular))].filter((w) => w.length >= 5 && !STOP.has(w));
  const missing = unmatchedTerms(text, spec);
  return { leftOver: all.length >= minWords && missing.length >= minWords && missing.length / all.length >= 0.5, terms: missing.slice(0, 6) };
}
