/**
 * One answered-knowledge base for every page: what the user already answered
 * (on any page, including design review decisions and "not applicable") and a
 * meaning-level match, so a question the AI asks again in other words is
 * answered from it instead of being asked again.
 *
 * The match is deterministic: normalized key words, the equipment tags it is
 * about (M1, VFD2 …) and its topic (supply voltage, full-load current, a
 * device that does not exist …). Two questions about different tags never
 * match; the same topic about the same thing does, even with little wording
 * in common.
 */

/** Where an answer was given, for the "answered in …" link. */
export interface KnownWhere { label: string; route: string }

export interface KnownAnswer {
  /** Id of the question / finding that holds the answer. */
  ref: string;
  question: string;
  answer: string;
  /** "Not applicable — don't ask again": matching questions are dismissed too. */
  dismissed?: boolean;
  where: KnownWhere;
  /** Later questions this answer settles whatever their wording (a needs-checklist item, see src/spec/needs.ts). */
  settles?: RegExp;
}

/** Same meaning in other words (applied to lower-case text). */
const SYNONYMS: [RegExp, string][] = [
  [/\bfull[- ]?load (current|amps?|amperage)\b|\bf\.?l\.?a\.?\b|\bnameplate (current|amps?)\b|\brated (current|amps?)\b|\bmotor (currents?|amps)\b/g, ' fla '],
  [/\bvariable[- ](frequency|speed) drives?\b|\binverters?\b|\bvfds?\b|\bac drives?\b/g, ' vfd '],
  [/\bthree[- ]phase\b|\b3[- ]?(phase|ph)\b/g, ' 3ph '],
  [/\bsingle[- ]phase\b|\b1[- ]?(phase|ph)\b/g, ' 1ph '],
  [/\b(\d{2,3})\s*-?\s*v(ac|dc|olts?)?\b/g, ' $1v '],
  [/\bhorse ?power\b/g, ' hp '],
  [/\bkilowatts?\b/g, ' kw '],
  [/\be[- ]?stops?\b|\bemergency[- ]stops?\b/g, ' estop '],
  [/\bdoesn'?t\b|\bdoes not\b|\bisn'?t\b|\bis not\b|\bno such\b/g, ' not '],
  [/\bphoto[- ]?eyes?\b|\bphoto[- ]?electric\b/g, ' photoeye '],
];

const STOP = new Set(('a an the and or of to in on for is are was were be been being it its this that these those there their what which who how when where why '
  + 'does do did should can could will would has have had must shall may might please confirm confirmed confirms customer customers engineer designer '
  + 'assume assumed assumption assumptions stated state states given say says said so as at by from with without into onto about each any all some '
  + 'than then also only just not but if we you they our your use used using need needs needed required require yes no ok okay correct '
  + 'one two both other another same such very more most less per via etc').split(/\s+/));

/** Words that say what a question is about in general, not which thing (they never make two questions "the same thing"). */
const GENERIC_WORDS = 'motor motors panel machine list design drawing drawings unit system device devices setting settings plc value type rating size data spec specification sheet page item part parts vfd nameplate power wiring circuit'.split(' ');

const TOPICS: [string, RegExp][] = [
  ['voltage', /\b\d{2,3}v\b|\bvolt|\bsupply\b|\b[13]ph\b|\bfed\b|\bfeed|\bmains\b/],
  ['current', /\bfla\b|\bcurrents?\b|\bamps?\b|\boverloads?\b/],
  ['power', /\bhp\b|\bkw\b|\bpower rating\b|\bmotor size\b/],
  ['exists', /\bexist|\bremov|\bdelet|\bno longer\b|\bnot (needed|used|required|present|part|fitted|installed)\b|\bthere is no\b|\bomit|\bleft out\b|\bdrop(ped)?\b/],
  ['enclosure', /\benclosure\b|\bnema\b|\bip\d{2}\b/],
  ['sensor', /\bsensors?\b|\bpnp\b|\bnpn\b|\bprox|\bphotoeye\b|\blimit switch/],
  ['safety', /\bestop\b|\bguard|\blight curtain|\bsafety\b|\bperformance level|\bplr?\b|\bsil\b|\bstop category/],
  ['speed', /\bspeed\b|\brpm\b|\bppm\b|\bper minute\b|\bthroughput\b|\bcycle time\b/],
  ['cable', /\bcables?\b|\bdistance\b|\blength\b/],
  ['sccr', /\bsccr\b|\bshort[- ]circuit|\bfault current|\b\d+\s?ka\b/],
  ['earthing', /\bearth|\bgrounding system|\btn-[cs]|\btt system\b/],
  ['password', /\bpassword|\baccess level|\blog ?in\b|\buser level/],
  ['homing', /\bhom(e|ed|ing)\b/],
  ['air', /\bair\b|\bpneumatic|\bpsi\b|\bdump valve/],
  ['recipe', /\brecipes?\b/],
  ['brake', /\bbrakes?\b/],
];

/** Standards and ratings written like a tag ("IP54", "SIL2", "CAT3") are not equipment. */
const NOT_TAG = /^(ip|pl|cat|sil|rev|awg|nema|ul|iec|en|iso|nec|qty)$/i;

const stem = (w: string) => (w.length > 4 ? w.replace(/(ing|ed|es|s)$/, '') : w);
const GENERIC = new Set(GENERIC_WORDS.map(stem));

export interface Signature { words: Set<string>; tags: Set<string>; topics: Set<string>; subject: Set<string> }

export function signature(text: string): Signature {
  const tags = new Set<string>();
  for (const m of text.matchAll(/\b([A-Za-z]{1,4})-?(\d{1,3}[A-Za-z]?)\b/g)) if (!NOT_TAG.test(m[1])) tags.add(`${m[1]}${m[2]}`.toLowerCase());
  let t = ` ${text.toLowerCase()} `;
  for (const [re, to] of SYNONYMS) t = t.replace(re, to);
  t = t.replace(/\b([a-z]{1,4})-(\d{1,3}[a-z]?)\b/g, '$1$2');
  const words = new Set(t.split(/[^a-z0-9.]+/).map((w) => w.replace(/^\.+|\.+$/g, '')).filter((w) => (/\d/.test(w) ? w.length >= 2 : w.length > 2) && !STOP.has(w)).map(stem));
  const topics = new Set(TOPICS.filter(([, re]) => re.test(t)).map(([k]) => k));
  const subject = new Set([...words].filter((w) => !/\d/.test(w) && !GENERIC.has(w) && !TOPICS.some(([, re]) => re.test(` ${w} `))));
  return { words, tags, topics, subject };
}

const common = <T>(a: Set<T>, b: Set<T>) => [...a].filter((x) => b.has(x)).length;

/** True when question `a` asks what `b` (an answered question with its answer) already settles. */
export function sameQuestion(a: Signature, b: Signature): boolean {
  // About other equipment (M1 vs M2), or about more of it than was answered (M2 and M3 vs M2 only): not answered.
  if (a.tags.size && b.tags.size && common(a.tags, b.tags) < a.tags.size) return false;
  const shared = common(a.words, b.words);
  const union = a.words.size + b.words.size - shared;
  if (union && shared / union >= 0.6) return true;
  const sameTopic = common(a.topics, b.topics) > 0;
  const sameThing = common(a.tags, b.tags) > 0 || common(a.subject, b.subject) > 0;
  const overlap = shared / Math.max(1, Math.min(a.words.size, b.words.size));
  return sameTopic && sameThing && overlap >= 0.4;
}

/** The known answer to a question, if the user already answered it somewhere (best match first). */
export function findKnown(text: string, known: KnownAnswer[]): KnownAnswer | null {
  const sig = signature(text);
  let best: KnownAnswer | null = null, bestScore = -1;
  for (const k of known) {
    const ks = signature(`${k.question} ${k.answer}`);
    const settled = Boolean(k.settles?.test(text));
    if (!settled && !sameQuestion(sig, ks) && !sameQuestion(sig, signature(k.question))) continue;
    const score = common(sig.words, ks.words) + 2 * common(sig.tags, ks.tags) + (settled ? 100 : 0);
    if (score > bestScore) { best = k; bestScore = score; }
  }
  return best;
}
