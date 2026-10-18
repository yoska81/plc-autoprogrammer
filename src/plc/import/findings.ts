/**
 * Bugs the app looks for in a machine's program (the reason to upgrade it), worded as questions for the
 * user: each one is a likely mistake the program cannot prove on its own.
 * - Missing seal-in: a momentary start pushbutton drives a "running" coil with no seal-in contact and no
 *   latch, while other rungs use that coil as the machine's running state — it drops when the button is
 *   released.
 * - Interlock on the wrong sensor: an actuator's rung checks a sensor that belongs to another station
 *   (none of its words match the actuator, its rung comment or its part of the program) while a sensor
 *   that does match exists and is not checked.
 * Works on the app's addresses: X = inputs, Y = outputs; names and descriptions from the tag list.
 */
import type { LadderProgram, Rung } from '../core/ladder';

export interface ProgramFinding {
  rungId: string;
  kind: 'seal-in' | 'interlock';
  address: string;
  /** The finding as a question for the Machine description page. */
  message: string;
}

const isInput = (a: string) => /^X\d+$/i.test(a);
const isOutput = (a: string) => /^Y\d+$/i.test(a);

/** Words that say nothing about where on the machine a device is. */
const GENERIC = new Set(['the', 'and', 'for', 'with', 'without', 'only', 'from', 'onto', 'into', 'when', 'until', 'while', 'not', 'one', 'all', 'has', 'have', 'there', 'this', 'that', 'pe', 'ls', 'px', 'sv', 'sol', 'prox', 'sensor', 'switch', 'photo', 'eye', 'limit', 'valve', 'motor', 'contactor', 'relay', 'lamp', 'light', 'run', 'running', 'runs', 'on', 'off', 'ok', 'in', 'out', 'at', 'of', 'to', 'is', 'up', 'down', 'fwd', 'rev', 'open', 'close', 'closed', 'extend', 'extended', 'retract', 'retracted', 'present', 'place', 'position', 'pos', 'detect', 'detected', 'nc', 'no', 'pb', 'push', 'button', 'pushbutton', 'auto', 'manual', 'mode', 'cycle', 'step', 'done', 'tmr', 'timer', 'raw', 'low', 'high', 'full', 'empty', 'top', 'bottom', 'left', 'right', 'front', 'back', 'new', 'old']);

/** Location words of a text: "Infeed_Case_PE" → infe, case (4-letter stems: pusher ≈ push, layers ≈ layer). */
function zone(text: string): Set<string> {
  const words = text.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().match(/[a-z]{3,}/g) ?? [];
  return new Set(words.filter((w) => !GENERIC.has(w) && !GENERIC.has(w.replace(/s$/, ''))).map((w) => w.slice(0, 4)));
}

const START = /\bstart\b|start_?pb|\bstrt\b/i;
/**
 * Inputs that are permissives, not station sensors: guards and lids, safety, overloads, process conditions.
 * They are interlocks on purpose; a finding never questions (or suggests removing) them.
 */
const PERMISSIVE = /start|stop|reset|e-?stop|emergency|safety|safe\b|guard|curtain|\blid\b|lid_|door|hatch|manway|gate|interlock|permissive|thermostat|overload|\bol\b|_ol_|ol_ok|motor ?protect|breaker|pressure|press_|\bair\b|air_|flow|level|temp|feedback|running|aux|selector|auto|manual|jog|\bpb\b|_pb\b|push ?button|healthy|_ok\b|\bok\b/i;

/** Kind of a position sensor: only a sensor of the same kind is offered instead. */
function kindOf(text: string): 'photo' | 'prox' | 'limit' | 'reed' | null {
  if (/(^|_|\b)PE(\b|_|$)|photo|eye|beam|retro|diffuse/i.test(text)) return 'photo';
  if (/(^|_|\b)PX(\b|_|$)|prox|inductive|capacitive/i.test(text)) return 'prox';
  if (/(^|_|\b)LS(\b|_|$)|limit/i.test(text)) return 'limit';
  if (/reed|extended|retracted|cyl.*(in|out)\b/i.test(text)) return 'reed';
  return null;
}

export function programFindings(program: LadderProgram, labels: Map<string, string> = new Map()): ProgramFinding[] {
  const nick = new Map(program.tags.map((t) => [t.address.toUpperCase(), t]));
  const name = (a: string) => nick.get(a.toUpperCase())?.nickname || a;
  const text = (a: string) => [nick.get(a.toUpperCase())?.nickname, nick.get(a.toUpperCase())?.comment, labels.get(a.toUpperCase()) ?? labels.get(a)].filter(Boolean).join(' ');
  const blockName = (r: Rung) => program.blocks?.find((b) => b.id === r.block)?.name ?? '';
  const out: ProgramFinding[] = [];

  // ── Missing seal-in ──
  const sets = new Set(program.rungs.flatMap((r) => r.outputs).filter((o) => o.type === 'SET').map((o) => (o.type === 'SET' ? o.address.toUpperCase() : '')));
  for (const r of program.rungs) {
    for (const o of r.outputs) {
      if (o.type !== 'OUT') continue;
      const coil = o.address.toUpperCase();
      if (sets.has(coil)) continue;
      const contacts = r.branches.flat().filter((e) => e.type === 'NO' || e.type === 'RISE');
      const start = contacts.find((e) => 'address' in e && isInput(e.address) && START.test(text(e.address)));
      if (!start || !('address' in start)) continue;
      const sealed = r.branches.some((b) => b.some((e) => e.type === 'NO' && e.address.toUpperCase() === coil));
      if (sealed) continue;
      const users = program.rungs.filter((x) => x !== r && x.branches.some((b) => b.some((e) => e.type === 'NO' && e.address.toUpperCase() === coil)));
      if (users.length < 1) continue;
      out.push({
        rungId: r.id, kind: 'seal-in', address: coil,
        message: `${name(coil)} is switched on by the ${name(start.address)} pushbutton but has no seal-in: it turns off as soon as the button is released, while ${users.length} other rung${users.length === 1 ? ' uses' : 's use'} it as the running state. Should it stay on (seal-in contact or latch) until Stop?`,
      });
    }
  }

  // ── Interlock on another station's sensor ──
  const sensorsUsed = new Set(program.rungs.flatMap((r) => r.branches.flat()).flatMap((e) => ('address' in e && isInput(e.address) ? [e.address.toUpperCase()] : [])));
  const allSensors = [...new Set([...program.tags.map((t) => t.address.toUpperCase()).filter(isInput), ...sensorsUsed])].filter((a) => !PERMISSIVE.test(text(a)) && kindOf(text(a)));
  for (const r of program.rungs) {
    for (const o of r.outputs) {
      if ((o.type !== 'OUT' && o.type !== 'SET') || !isOutput(o.address)) continue;
      const actuator = o.address.toUpperCase();
      const checked = [...new Set(r.branches.flat().flatMap((e) => ('address' in e && isInput(e.address) && (e.type === 'NO' || e.type === 'NC') ? [e.address.toUpperCase()] : [])))];
      for (const s of checked) {
        if (PERMISSIVE.test(text(s))) continue;
        const kind = kindOf(text(s));
        if (!kind) continue;
        // Where this actuator works: its own name and description, its part of the program, and the rung
        // comment without the words other checked sensors already account for ("case stop up" → Case_Stop_Up_PX).
        const explained = new Set(checked.filter((x) => x !== s).flatMap((x) => [...zone(text(x))]));
        const own = new Set([...zone(text(actuator)), ...zone(blockName(r)), ...[...zone(r.comment)].filter((w) => !explained.has(w))]);
        const z = zone(text(s));
        if (!own.size || !z.size || [...z].some((w) => own.has(w))) continue;
        // A sensor of the same kind that belongs where the actuator works, not checked in this rung.
        const better = allSensors.filter((x) => x !== s && !checked.includes(x) && kindOf(text(x)) === kind && [...zone(text(x))].some((w) => own.has(w)));
        if (!better.length) continue;
        const desc = text(s).replace(name(s), '').trim().replace(/^[—:-]\s*/, '');
        out.push({
          rungId: r.id, kind: 'interlock', address: actuator,
          message: `${name(actuator)} waits for ${name(s)}${desc ? ` (${desc})` : ''}, a sensor at another place on the machine than ${r.comment ? `this rung describes ("${r.comment}")` : 'this output'}. Should it check ${better.map(name).join(' or ')}? (Other interlocks in the rung stay as they are.)`,
        });
      }
    }
  }
  return out;
}
