import type { ProjectSnapshot } from '../deliverables/collect';
import { alarmRows, programInfo, type ProgramInfo } from '../deliverables/docs/program';
import { safetyFunctions, type SafetyFunction } from '../deliverables/docs/safety';
import { naturalCompare } from '../electrical/derive';
import { inPlcNames } from '../deliverables/plcNames';

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
  // In the PLC's own names (%I0.0, "Machine_DB".SP_Service_Interval on an S7): what the technician sees in its software.
  // Ids stay on the app's addresses, so ticks and notes keep their item.
  const own = inPlcNames(p);
  return items.map((it) => ({ ...it, title: own(it.title), procedure: own(it.procedure), expected: own(it.expected), device: it.section === 'alarms' ? own(it.device) : it.device }));
}

/** One item's record on site. */
export interface CommResult {
  /** 'pass' / 'fail' / 'na' (not applicable); absent = not done. */
  status?: 'pass' | 'fail' | 'na';
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

export interface CommRecord { results: Record<string, CommResult>; signoff: CommSignoff | null }

export function progress(items: CommItem[], results: Record<string, CommResult>): { done: number; pass: number; fail: number; total: number } {
  let done = 0, pass = 0, fail = 0;
  for (const it of items) {
    const st = results[it.id]?.status;
    if (!st) continue;
    done++;
    if (st === 'pass') pass++;
    if (st === 'fail') fail++;
  }
  return { done, pass, fail, total: items.length };
}

export const STATUS_TEXT: Record<NonNullable<CommResult['status']>, string> = { pass: 'Pass', fail: 'FAIL', na: 'N/A' };

/** Rows for the PDF / Excel export: section, item, device, procedure, expected, result, note, by, date. */
export function exportRows(items: CommItem[], results: Record<string, CommResult>): { section: string; cells: string[] }[] {
  return items.map((it) => {
    const r = results[it.id];
    return { section: SECTION_TITLE[it.section], cells: [it.title, it.device, it.procedure, it.expected, r?.status ? STATUS_TEXT[r.status] : '', r?.note ?? '', r?.status ? r.by : '', r?.status ? r.date : ''] };
  });
}
