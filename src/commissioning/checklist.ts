import type { ProjectSnapshot } from '../deliverables/collect';
import { alarmRows, programInfo, type ProgramInfo } from '../deliverables/docs/program';
import { safetyFunctions, type SafetyFunction } from '../deliverables/docs/safety';
import { naturalCompare } from '../electrical/derive';

/**
 * On-site commissioning checklist made from the project: every input and output with the result
 * the program expects (from the I/O list, the field wiring and the rungs that read / write it),
 * every safety function test and every alarm test. Item ids are stable (I/O id, safety function
 * id, alarm address) so ticks and notes stay with their item when the design is regenerated.
 */

export type CommSection = 'inputs' | 'outputs' | 'safety' | 'alarms';

export const SECTION_TITLE: Record<CommSection, string> = {
  inputs: 'Inputs', outputs: 'Outputs', safety: 'Safety functions', alarms: 'Alarms',
};

export interface CommItem {
  id: string;
  section: CommSection;
  /** "X001 Start pushbutton" */
  title: string;
  /** Field device and where it is ("PB1 pushbutton-no @ Operator station"), '' when not wired yet. */
  device: string;
  /** What to do on site. */
  procedure: string;
  /** What must happen (pass criterion). */
  expected: string;
}

/** First phrase of a rung comment, cut at a word. */
function short(comment: string): string {
  const t = comment.trim().split('\n')[0].split(/[:.](\s|$)/)[0].trim();
  return t.length <= 70 ? t : `${t.slice(0, 70).replace(/\s+\S*$/, '')}…`;
}

/** Field devices whose PLC input is ON at rest and OFF when operated. */
const NC = new Set(['pushbutton-nc', 'estop-contact']);

/** What one I/O point does in the program, in plain words ("rung 4 (Start cycle) …"). */
function programUse(info: ProgramInfo, p: ProjectSnapshot, a: string, writes: boolean): string {
  const nos = (writes ? info.writes : info.reads).get(a.toUpperCase()) ?? [];
  if (!nos.length) return writes ? 'Not driven by the program.' : 'Not used by the program.';
  const parts = nos.slice(0, 3).map((n) => {
    const r = p.ladder.rungs[n - 1];
    const what = r?.comment?.trim() ? ` (${short(r.comment)})` : '';
    if (!writes || !r) return `rung ${n}${what}`;
    const cond = info.conditionText(r, a);
    return `rung ${n}${what}${cond ? `: ON when ${cond}` : ''}`;
  });
  return `${writes ? 'Program drives it in' : 'Program reads it in'} ${parts.join('; ')}${nos.length > 3 ? ` and ${nos.length - 3} more rung${nos.length - 3 === 1 ? '' : 's'}` : ''}.`;
}

export function commissioningItems(p: ProjectSnapshot, info: ProgramInfo = programInfo(p), sf: SafetyFunction[] = safetyFunctions(p)): CommItem[] {
  const wiring = new Map((p.electrical?.ioWiring ?? []).map((w) => [w.address.toUpperCase(), w] as const));
  const io = p.io
    .map((x) => ({ x, a: p.addresses.get(x.id) ?? '' }))
    .sort((u, v) => naturalCompare(u.a, v.a));
  const items: CommItem[] = [];
  for (const { x, a } of io) {
    const w = a ? wiring.get(a.toUpperCase()) : undefined;
    const device = w ? `${w.deviceTag} ${w.deviceType}${w.location ? ` @ ${w.location}` : ''}` : '';
    const name = `${a || '(no address)'} ${x.description}`.trim();
    const analog = x.signal === 'analog';
    if (x.type === 'input') {
      const relay = w?.deviceType === 'safety-relay-output';
      const nc = Boolean(w && NC.has(w.deviceType));
      items.push({
        id: `io:${x.id}`, section: 'inputs', title: name, device,
        procedure: analog ? `Apply the low and high signal at ${w?.deviceTag || 'the transmitter'} (or a loop calibrator at the terminal).`
          : relay ? `Reset the safety circuit (E-stops released, reset pressed), then press an E-stop.`
          : `Operate ${w?.deviceTag || 'the field device'} at its installed location.`,
        expected: `${analog ? `PLC ${a} reads the matching value at both ends of the range${x.analog ? ` (${x.analog.min}–${x.analog.max} ${x.analog.units})` : ''}`
          : relay ? `PLC input ${a} ON while ${w?.deviceTag} is reset, OFF on the E-stop`
          : nc ? `PLC input ${a} ON at rest, OFF while operated (normally closed)`
          : `PLC input ${a} ON while operated, OFF when released`}; HMI follows. ${programUse(info, p, a, false)}`,
      });
    } else {
      items.push({
        id: `io:${x.id}`, section: 'outputs', title: name, device,
        procedure: `Motion areas clear: force ${a} ON from the programming software (or run it from Manual on the HMI).`,
        expected: `${w?.deviceTag || 'The device'} ${analog ? 'follows the commanded value' : 'operates'}${w?.safetyContact ? ` (only with ${w.safetyContact} reset)` : ''}; output LED ON; OFF when released. ${programUse(info, p, a, true)}`,
      });
    }
  }
  for (const s of sf) items.push({ id: `sf:${s.id}`, section: 'safety', title: `${s.id} ${s.name}`, device: s.initiating, procedure: `${s.test} Measure the stopping time where relevant.`, expected: s.expected });
  for (const r of alarmRows(p, info)) items.push({
    id: `alarm:${r.address || r.id}`, section: 'alarms', title: `${r.id} ${r.message}`, device: r.address,
    procedure: `Create the condition: ${r.cause.split('\n')[0]}`,
    expected: `HMI shows "${r.message}" (${r.severity}); ${r.effect.replace(/\.$/, '')}. To clear: ${r.action}`,
  });
  return items;
}

/** One item's record on site. */
export interface CommResult {
  /** 'pass' / 'fail' / 'na' (not applicable); absent = not done. */
  status?: 'pass' | 'fail' | 'na';
  /** The item's title when the result was recorded (kept for the record if the item is later removed). */
  title?: string;
  note: string;
  by: string;
  /** YYYY-MM-DD HH:MM */
  date: string;
}

export interface CommSignoff {
  name: string;
  company: string;
  /** Typed signature (the name as signed). */
  signature: string;
  /** Drawn signature as a PNG data URL, when signed on screen. */
  drawn?: string;
  date: string;
}

/**
 * A sign-off that no longer holds, kept on the record: voided by a failure recorded after it, removed,
 * or replaced by a new sign-off.
 */
export interface VoidedSignoff {
  signoff: CommSignoff;
  reason: 'failed' | 'removed' | 'replaced';
  /** When (YYYY-MM-DD HH:MM) and by whom. */
  voidedAt: string;
  voidedBy: string;
  /** The item that failed (reason 'failed'). */
  itemId?: string;
}

/** A failed result of an item no longer in the checklist (its I/O point deleted, its alarm renamed), dismissed. */
export interface DismissedResult { itemId: string; result: CommResult; at: string; by: string }

export interface CommRecord {
  results: Record<string, CommResult>;
  signoff: CommSignoff | null;
  /** Sign-offs that no longer hold, oldest first (absent on records made before it existed). */
  voided?: VoidedSignoff[];
  /** Failed results of removed items, dismissed (absent when none). */
  dismissed?: DismissedResult[];
}

/** One line for the record, e.g. "J. Tech (ISA) signed 2026-10-17 10:00; voided 2026-10-17 11:20 by A. Lead: Y001 Conveyor motor failed." */
export function voidedText(v: VoidedSignoff, items: CommItem[]): string {
  const who = `${v.signoff.name}${v.signoff.company ? ` (${v.signoff.company})` : ''} signed ${v.signoff.date}`;
  const by = v.voidedBy ? ` by ${v.voidedBy}` : '';
  if (v.reason === 'removed') return `${who}; signature removed ${v.voidedAt}${by}.`;
  if (v.reason === 'replaced') return `${who}; replaced by a new sign-off ${v.voidedAt}${by}.`;
  const item = items.find((it) => it.id === v.itemId)?.title ?? v.itemId ?? 'an item';
  return `${who}; voided ${v.voidedAt}${by}: ${item} failed.`;
}

export const dismissedText = (d: DismissedResult) => {
  const failed = [d.result.by && `by ${d.result.by}`, d.result.date].filter(Boolean).join(' ');
  return `Failed result of ${d.result.title ? `${d.result.title} (${d.itemId})` : d.itemId}${failed ? `, failed ${failed}` : ''}${d.result.note ? `, note: ${d.result.note}` : ''}: no longer in the checklist, dismissed ${d.at} by ${d.by}.`;
};

/**
 * Items that failed, were dismissed while they were not in the checklist, and are back without a new
 * result: their failure still stands until they are tested again.
 */
export const returnedDismissed = (ids: string[], rec: Pick<CommRecord, 'results' | 'dismissed'>): string[] =>
  [...new Set((rec.dismissed ?? []).map((d) => d.itemId))].filter((id) => ids.includes(id) && !rec.results[id]?.status);

/** The store's rule for a sign-off (the page shows the same one as signBlock): no failed result, no returned dismissed failure. */
export const signRefused = (ids: string[], rec: Pick<CommRecord, 'results' | 'dismissed'>): boolean =>
  Object.values(rec.results).some((r) => r?.status === 'fail') || returnedDismissed(ids, rec).length > 0;

/** Done: passed or not applicable. A failed item is not done: it is fixed and tested again. */
export function progress(items: CommItem[], results: Record<string, CommResult>): { done: number; pass: number; fail: number; total: number } {
  let done = 0, pass = 0, fail = 0;
  for (const it of items) {
    const st = results[it.id]?.status;
    if (st === 'pass' || st === 'na') done++;
    if (st === 'pass') pass++;
    if (st === 'fail') fail++;
  }
  return { done, pass, fail, total: items.length };
}

/** Failed results whose item is no longer in the checklist: shown on their own, to be dismissed. */
export const orphanFails = (items: CommItem[], results: Record<string, CommResult>): string[] =>
  Object.keys(results).filter((id) => results[id]?.status === 'fail' && !items.some((it) => it.id === id));

/**
 * Why the checklist can't be signed off yet (null: it can). A failed item blocks the sign-off until it
 * passes; a failed result of an item no longer in the checklist, until it is dismissed (the store
 * refuses the sign-off on the same rule: any failed result).
 */
export function signBlock(items: CommItem[], results: Record<string, CommResult>, dismissed: DismissedResult[] = []): string | null {
  const failed = items.filter((it) => results[it.id]?.status === 'fail');
  const orphans = orphanFails(items, results);
  const back = returnedDismissed(items.map((it) => it.id), { results, dismissed }).map((id) => items.find((it) => it.id === id)!.title);
  const parts: string[] = [];
  if (failed.length) {
    const names = failed.slice(0, 3).map((it) => it.title).join('; ');
    parts.push(`${failed.length} failed item${failed.length === 1 ? '' : 's'} (${names}${failed.length > 3 ? '; …' : ''}): fix ${failed.length === 1 ? 'it' : 'them'} and test again before signing off.`);
  }
  if (back.length) parts.push(`${back.length} item${back.length === 1 ? '' : 's'} failed before and ${back.length === 1 ? 'was' : 'were'} dismissed while removed (${back.slice(0, 3).join('; ')}${back.length > 3 ? '; …' : ''}): test ${back.length === 1 ? 'it' : 'them'} again.`);
  if (orphans.length) parts.push(`${orphans.length} failed result${orphans.length === 1 ? '' : 's'} of item${orphans.length === 1 ? '' : 's'} no longer in the checklist: dismiss ${orphans.length === 1 ? 'it' : 'them'} below.`);
  return parts.length ? parts.join(' ') : null;
}

/* ---- a record as stored (browser storage, project file): anything malformed is dropped, never thrown on ---- */
const obj = (x: unknown): Record<string, unknown> | null => (x && typeof x === 'object' && !Array.isArray(x) ? x as Record<string, unknown> : null);
const str = (x: unknown) => (typeof x === 'string' ? x : '');
function cleanResult(x: unknown): CommResult | null {
  const r = obj(x);
  if (!r) return null;
  const out: CommResult = { note: str(r.note), by: str(r.by), date: str(r.date) };
  if (r.status === 'pass' || r.status === 'fail' || r.status === 'na') out.status = r.status;
  if (str(r.title)) out.title = str(r.title);
  return out;
}
function cleanSignoff(x: unknown): CommSignoff | null {
  const s = obj(x);
  if (!s || !str(s.name)) return null;
  return { name: str(s.name), company: str(s.company), signature: str(s.signature), date: str(s.date), ...(typeof s.drawn === 'string' ? { drawn: s.drawn } : {}) };
}
/** A commissioning record from storage or a project file, cleaned: unknown shapes become empty, legacy voided entries 'failed'. */
export function cleanRecord(raw: unknown): CommRecord {
  const r = obj(raw) ?? {};
  const results: Record<string, CommResult> = {};
  for (const [id, v] of Object.entries(obj(r.results) ?? {})) {
    if (id === '__proto__' || id === 'constructor' || id === 'prototype') continue; // never a prototype from a file
    const c = cleanResult(v);
    if (c) results[id] = c;
  }
  const voided = (Array.isArray(r.voided) ? r.voided : []).flatMap((x): VoidedSignoff[] => {
    const v = obj(x);
    const signoff = cleanSignoff(v?.signoff);
    if (!v || !signoff) return [];
    const reason = v.reason === 'removed' || v.reason === 'replaced' ? v.reason : 'failed';
    return [{ signoff, reason, voidedAt: str(v.voidedAt), voidedBy: str(v.voidedBy), ...(str(v.itemId) ? { itemId: str(v.itemId) } : {}) }];
  });
  const dismissed = (Array.isArray(r.dismissed) ? r.dismissed : []).flatMap((x): DismissedResult[] => {
    const d = obj(x);
    const result = cleanResult(d?.result);
    return d && str(d.itemId) && result ? [{ itemId: str(d.itemId), result, at: str(d.at), by: str(d.by) }] : [];
  });
  return { results, signoff: cleanSignoff(r.signoff), ...(voided.length ? { voided } : {}), ...(dismissed.length ? { dismissed } : {}) };
}

export const STATUS_TEXT: Record<NonNullable<CommResult['status']>, string> = { pass: 'Pass', fail: 'FAIL', na: 'N/A' };

/** Rows for the PDF / Excel export: section, item, device, procedure, expected, result, note, by, date. */
export function exportRows(items: CommItem[], results: Record<string, CommResult>): { section: string; cells: string[] }[] {
  return items.map((it) => {
    const r = results[it.id];
    return { section: SECTION_TITLE[it.section], cells: [it.title, it.device, it.procedure, it.expected, r?.status ? STATUS_TEXT[r.status] : '', r?.note ?? '', r?.status ? r.by : '', r?.status ? r.date : ''] };
  });
}
