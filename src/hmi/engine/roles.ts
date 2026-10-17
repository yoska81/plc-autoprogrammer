/**
 * Roles for HMI tags made before the rule-based engine (the example, every older project, hand-made and
 * AI designs): read from the tag's name, description and access, the screens (a button's interlock is
 * its permit) and the machine content (actuator names, outputs, faults). With a role, both engines keep
 * the tag's address for that function — an address once assigned never changes its meaning — and the
 * PLC program implements the tag. Tags no rule recognises are returned in `unmatched`.
 */
import type { HmiAlarm, HmiScreen, HmiTag } from '../types';
import type { HmiActuator, HmiContent } from './content';

/** Internal program bits some HMIs show directly (Safety OK, cycle running). */
export const INTERNAL_BITS: Record<string, string> = { C1: 'int:safety', C2: 'int:running' };

const words = (s: string) => s.toLowerCase().replace(/_/g, ' ');

export function inferRoles(tags: HmiTag[], opts: { screens?: HmiScreen[]; alarms?: HmiAlarm[]; content?: HmiContent } = {}): { tags: HmiTag[]; unmatched: HmiTag[] } {
  const acts = opts.content?.actuators ?? [];
  const outputsOf = (a: HmiActuator) => [a.run, a.reverse, a.extend, a.retract].filter((p): p is NonNullable<typeof p> => !!p);
  const allOuts = acts.flatMap(outputsOf);
  // The actuator the text names: all its name words, else the one sharing the most name words (an HMI made
  // with shorter names, "Film Unwinder" for "Film Unwinder Drive 1"); a tie is no match.
  const nameWords = (a: HmiActuator) => a.name.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 1 && !/^\d+$/.test(w));
  const actOf = (text: string) => {
    const full = acts.find((a) => a.name.toLowerCase().split(' ').every((w) => text.includes(w)));
    if (full) return full;
    const words = new Set(text.split(/[^a-z0-9]+/));
    const scored = acts.map((a) => ({ a, n: nameWords(a).filter((w) => words.has(w)).length })).filter((x) => x.n > 0).sort((x, y) => y.n - x.n);
    return scored.length && (scored.length === 1 || scored[0].n > scored[1].n) ? scored[0].a : undefined;
  };
  // Roles tied to an I/O address the I/O list no longer has (the PLC or its modules changed) are read again.
  const ioAddr = new Set((opts.content?.io ?? []).map((p) => p.address.toUpperCase()));
  const stale = (role: string) => {
    const m = /:([XY]\d+)$/i.exec(role);
    return !!m && ioAddr.size > 0 && !ioAddr.has(m[1].toUpperCase());
  };
  const alarmAddr = new Set((opts.alarms ?? []).map((a) => a.address.toUpperCase()));
  // A button's interlock: command address -> permit address.
  const interlockOf = new Map<string, string>();
  for (const s of opts.screens ?? []) for (const e of s.elements) if (e.address && e.interlock) interlockOf.set(e.address.toUpperCase(), e.interlock.toUpperCase());
  tags = tags.map((t) => (t.role && stale(t.role) ? { ...t, role: undefined } : t));
  const used = new Set(tags.filter((t) => t.role).map((t) => t.role!));
  const out: HmiTag[] = [];
  const unmatched: HmiTag[] = [];
  const assign = (t: HmiTag, role: string | undefined) => {
    if (role && !used.has(role)) { used.add(role); out.push({ ...t, role }); return true; }
    return false;
  };
  const pending: HmiTag[] = [];
  for (const t of tags) {
    if (t.role) { out.push(t); continue; }
    pending.push(t);
  }
  // Permits first (they are named by their button's command), then everything else.
  const permitFor = new Map<string, string>();
  for (const t of pending) {
    const a = t.address.toUpperCase();
    const n = words(t.name), d = words(t.description);
    const both = `${n} ${d}`;
    const write = t.access !== 'read';
    let role: string | undefined;
    if (INTERNAL_BITS[a] && /\b(safety|running|cycle)\b/.test(both)) role = INTERNAL_BITS[a];
    else if (write && /^hmi start$|\bstart\b/.test(n) && !/\b(jog|reset|count)\b/.test(n)) role = 'cmd:start';
    else if (write && /\bstop\b/.test(n) && !/\b(jog|e-?stop)\b/.test(n)) role = 'cmd:stop';
    else if (write && /\bmanual\b/.test(n) && /\b(select|mode|request)\b/.test(both)) role = 'cmd:manual';
    else if (write && /\bservice\b/.test(n) && /\b(done|reset|clear)\b/.test(n)) role = 'cmd:servicedone';
    else if (write && /\breset\b/.test(n) && /\b(count|counter|part|parts)\b/.test(n)) role = 'cmd:countreset';
    else if (write && /\breset\b/.test(n) && !/\b(cycle|cycles|service|hour)\b/.test(n)) role = 'cmd:reset';
    else if (!write && /\bmanual\b/.test(n) && /\b(mode|active|sts|status)\b/.test(both)) role = 'sts:manual';
    else if (!write && /\bheartbeat\b/.test(both)) role = 'sts:heartbeat';
    else if (!write && /^sts running$|\brunning\b/.test(n) && /^C\d+$/.test(a) && !INTERNAL_BITS[a]) role = 'sts:running';
    else if (/^DS\d+$/.test(a) && /\bmachine state\b|\bstate\b/.test(n)) role = 'word:state';
    else if (/^CTD\d+$/.test(a) && /\b(part|parts|count)\b/.test(n) && !/\bcycle/.test(n)) role = 'word:count';
    else if (/\bbatch\b/.test(n)) role = 'sp:batch';
    else if (/\b(per min|rate|ppm)\b/.test(n)) role = 'word:rate';
    else if (/\bsince service\b/.test(n)) role = 'word:sinceservice';
    else if (/\brun hours\b/.test(n)) role = 'word:runhours';
    else if (/\bservice interval\b/.test(n)) role = 'sp:serviceinterval';
    else if (/\bservice due\b/.test(n) || (alarmAddr.has(a) && /\bservice\b/.test(both))) role = 'alarm:servicedue';
    else if ((alarmAddr.has(a) || /^(alm|wrn)\b/.test(n)) && /\b(safety|e-?stop)\b/.test(both) && !/\b(timeout|fault)\b/.test(n)) role = 'alarm:safety';
    else if ((alarmAddr.has(a) || /^alm\b/.test(n)) && /\b(step|sequence)\b/.test(both)) role = 'alarm:step';
    else {
      const act = actOf(both);
      if (act && (alarmAddr.has(a) || /^alm\b/.test(n))) {
        if (act.kind === 'cylinder' && /\b(timeout|fault|extend|retract|time)\b/.test(both)) role = `alarm:timeout:${(act.extend ?? act.run)!.address}`;
        else if (act.fault && /\b(fault|trip|overload)\b/.test(both)) role = `alarm:fault:${act.fault.address}`;
      } else if (act && /^DS\d+$/.test(a) && /\btimeout\b/.test(n)) role = `sp:timeout:${(act.extend ?? act.run)!.address}`;
      else if (act && act.kind === 'cylinder' && /^TD\d+$/.test(a) && /\b(timer|timeout)\b/.test(both)) role = `timer:timeout:${(act.extend ?? act.run)!.address}`;
      else if (act && /^DF\d+$/.test(a) && /\bspeed\b/.test(n) && act.speedRef) role = `sp:speed:${act.speedRef.address}`;
      else if (write && /^C\d+$/.test(a)) {
        // Hold-to-run command: the output it energizes is named in its description.
        const y = /\b(Y\d{3})\b/i.exec(t.description)?.[1]?.toUpperCase() ?? (act ? outputsOf(act)[0]?.address : undefined);
        if (y && allOuts.some((o) => o.address === y) && /\b(jog|extend|retract|hold|open|close|up|down|run)\b/.test(both)) {
          role = `jog:${y}`;
          const il = interlockOf.get(a);
          if (il) permitFor.set(il, `permit:${y}`);
        }
      }
    }
    if (!assign(t, role)) out.push(t);
  }
  // Permits named by their button's interlock; analog limits by the analog value's name.
  const final = out.map((t) => {
    if (t.role) return t;
    const p = permitFor.get(t.address.toUpperCase());
    if (p && !used.has(p)) { used.add(p); return { ...t, role: p }; }
    for (const an of opts.content?.analogs ?? []) {
      const n = words(t.name);
      if (!an.name.toLowerCase().split(' ').every((w) => n.includes(w))) continue;
      const hi = /\b(high|hi|max)\b/.test(n), lo = /\b(low|lo|min)\b/.test(n);
      const kind = alarmAddr.has(t.address.toUpperCase()) || /^(alm|wrn)\b/.test(n) ? 'alarm' : /^DF\d+$/i.test(t.address) ? 'sp' : t.address.toUpperCase() === an.address ? 'analog' : '';
      const role = kind === 'analog' ? `analog:${an.address}` : kind && (hi || lo) ? `${kind}:${hi ? 'high' : 'low'}:${an.address}` : '';
      if (role && !used.has(role)) { used.add(role); return { ...t, role }; }
    }
    return t;
  });
  for (const t of final) if (!t.role && !/^[XY]\d/i.test(t.address)) unmatched.push(t);
  return { tags: final, unmatched };
}
