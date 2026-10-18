/**
 * Deterministic design checks (no AI, instant). They reuse the app's own
 * checkers — program checker, electrical design warnings, calculations,
 * I/O capacity, stage status — and add the cross-stage consistency checks a
 * checking engineer does by hand: spec ↔ I/O, I/O ↔ program, safety gating,
 * HMI ↔ program, approvals.
 */
import { engineerChecksFor } from '../engineer/checks';
import type { ProjectSnapshot } from '../deliverables/collect';
import { buildModel, designWarnings, spareSpace } from '../electrical/derive';
import { codeRuleFindings } from './codeRules';
import { calcWarnings } from '../deliverables/docs/calcs';
import { ioCapacity, moduleSlots } from '../plc/core/modules';
import { rungWrites, type LadderProgram } from '../plc/core/ladder';
import { rungReads } from '../plc/sim/blocks';
import type { StageId } from '../store/useStageStore';
import type { StageInfo } from '../spec/useStages';
import { isIssueNote } from '../components/questions/classify';
import type { Finding, ReviewArea, ReviewPage, Severity } from './types';
import { isAnalog } from '../types/io';
import { analogMap, analogNeed } from '../plc/core/analog';
import { motionFit } from '../plc/core/motionFit';
import { getPart } from '../electrical/catalog';
import { specToText } from '../spec/types';
import { inPlcNames, openPlcChanges, programUse } from '../hmi/engine/upgradeHmi';
import { plcTagNameOf } from '../deliverables/plcTagNames';

export interface ReviewInput {
  p: ProjectSnapshot;
  stages: Record<StageId, StageInfo>;
  /** Expansion module part numbers in slot order. */
  modules: string[];
  /** Equipment recommendation cautions (servo, safety PLC … that CLICK can't do), if any. */
  cautions?: string[];
}

/** Short stable hash for ids built from free text. */
function hash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}

function finding(id: string, severity: Severity, area: ReviewArea, page: ReviewPage, item: string, title: string, detail: string, fix: string): Finding {
  return { id, source: 'check', severity, area, page, item, title, detail, fix };
}

const STOP = new Set(['with', 'from', 'that', 'this', 'when', 'into', 'each', 'every', 'then', 'only', 'part', 'parts', 'single', 'phase', 'line', 'across', 'about', 'the', 'and', 'for', 'off', 'until', 'once', 'after', 'before', 'while', 'retracts', 'return', 'spring', 'other', 'output', 'input', 'signal', 'status', 'type']);
const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ')
  .map((w) => w.replace(/(es|s)$/, '')).filter((w) => w.length >= 4 && !STOP.has(w) && !/^\d/.test(w));

/** Spec bullet lines that describe field devices (sensing, pneumatics, motion). */
function deviceLines(spec: ProjectSnapshot['spec']): string[] {
  return [spec.sensing, spec.pneumatics, spec.motion].flatMap((t) => (t ?? '').split(/\n+/))
    .map((l) => l.replace(/^\s*[-*•]\s*/, '').trim()).filter((l) => l.length > 3);
}

function specVsIo({ p }: ReviewInput): Finding[] {
  const out: Finding[] = [];
  if (!p.io.length) return out;
  const ioWords = p.io.map((pt) => new Set(words(pt.description)));
  for (const line of deviceLines(p.spec)) {
    const w = words(line);
    if (!w.length || ioWords.some((s) => w.some((x) => s.has(x)))) continue;
    out.push(finding(`spec-io:${hash(line)}`, 'minor', 'io', 'io', '', `Spec device may have no I/O point: "${line.slice(0, 60)}"`,
      `The specification describes "${line}", but no I/O point mentions it.`, 'Add the sensor / actuator to the I/O list, or reword the spec if it needs no PLC signal.'));
  }
  const specWords = new Set(words(Object.values(p.spec).join('\n')));
  for (const pt of p.io) {
    const w = words(pt.description);
    if (!w.length || w.some((x) => specWords.has(x))) continue;
    const a = p.addresses.get(pt.id) ?? '';
    out.push(finding(`io-spec:${pt.id}`, 'minor', 'spec', 'spec', '', `I/O point not described in the spec: ${a} ${pt.description}`,
      `"${pt.description}" is in the I/O list but the specification does not mention it, so the program and documents have nothing to base its behaviour on.`, 'Describe the device and what it does in the machine description.'));
  }
  return out;
}

/** Bits/words read by the rungs that write `addr`, following internal memory back to the inputs. */
function dependsOn(program: LadderProgram, addr: string): Set<string> {
  const writers = new Map<string, string[]>();
  for (const r of program.rungs) for (const w of rungWrites(r)) {
    const k = w.trim().toUpperCase();
    writers.set(k, [...(writers.get(k) ?? []), ...rungReads(r).map((x) => x.address)]);
  }
  const seen = new Set<string>();
  const todo = [addr];
  while (todo.length) {
    const a = todo.pop()!;
    for (const d of writers.get(a) ?? []) if (!seen.has(d)) { seen.add(d); todo.push(d); }
  }
  return seen;
}

const SAFETY_RE = /\b(e-?stop|emergency|safety|guard|light curtain|interlock switch)\b/i;
const NON_MOTION_RE = /\b(light|lamp|indicator|beacon|horn|buzzer|stack|pilot)\b/i;

function programChecks({ p }: ReviewInput): Finding[] {
  const out: Finding[] = [];
  if (p.profile.language !== 'ladder' || !p.ladder.rungs.length) return out;
  const rungNo = (id: string) => p.ladder.rungs.findIndex((r) => r.id === id) + 1;
  for (const i of p.issues) {
    out.push(finding(`chk:${i.rungId ?? ''}:${hash(i.message)}`, i.severity === 'error' ? 'major' : 'minor', 'program', 'program', i.rungId ?? '',
      `Program checker${i.rungId ? ` (rung ${rungNo(i.rungId)})` : ''}: ${i.message}`, i.message, 'Fix the rung by hand or ask the AI to fix the checker issues on the PLC Program page.'));
  }
  const reads = new Set(p.ladder.rungs.flatMap((r) => rungReads(r).map((x) => x.address)));
  const writes = new Set(p.ladder.rungs.flatMap((r) => rungWrites(r).map((w) => w.trim().toUpperCase())));
  const safetyInputs = p.io.filter((pt) => pt.type === 'input' && (pt.category === 'Safety' || SAFETY_RE.test(pt.description))).map((pt) => p.addresses.get(pt.id) ?? '').filter(Boolean);
  for (const pt of p.io) {
    const a = (p.addresses.get(pt.id) ?? '').toUpperCase();
    if (!a) continue;
    if (pt.type === 'input' && !reads.has(a)) {
      out.push(finding(`in-unused:${a}`, 'minor', 'program', 'program', '', `Input ${a} "${pt.description}" is not used by the program`,
        'The input is wired but no rung reads it, so the machine ignores this device.', 'Use the input in the logic (or remove it from the I/O list if it is not needed).'));
    }
    if (pt.type === 'output' && !writes.has(a)) {
      out.push(finding(`out-undriven:${a}`, 'major', 'program', 'program', '', `Output ${a} "${pt.description}" is never driven`,
        'No rung writes this output, so the device can never turn on.', 'Add the output rung (one OUT coil) to the program.'));
    }
    if (pt.type === 'output' && !isAnalog(pt) && writes.has(a) && safetyInputs.length && !NON_MOTION_RE.test(pt.description)) {
      const deps = dependsOn(p.ladder, a);
      if (!safetyInputs.some((s) => deps.has(s.toUpperCase()))) {
        out.push(finding(`out-unsafe:${a}`, 'critical', 'safety', 'program', '', `Output ${a} "${pt.description}" is not gated by Safety OK`,
          `Nothing in the logic that drives ${a} depends on the safety input${safetyInputs.length > 1 ? 's' : ''} (${safetyInputs.join(', ')}), so the PLC could energize it with the safety circuit open.`,
          'Put the Safety OK bit in series in every rung (auto and manual) that drives this output, and drop the output when safety is lost.'));
      }
    }
  }
  return out;
}

/** The neutral memory the touch panel writes: command bits C1001–C1300, setpoints DS1001–DS1200 and DF101–DF200 (as in the program checker). */
const HMI_WRITTEN = /^(C1(0\d\d|1\d\d|2\d\d|300)|DS1(0\d\d|1\d\d|200)|DF(1\d\d|200))$/;

/**
 * Machine without a touch panel: a command bit or setpoint only a panel would write stays OFF / 0,
 * so the program would wait for it forever (a Start that can never be pressed, a setpoint of 0).
 */
function noPanelChecks({ p }: ReviewInput): Finding[] {
  if (p.hmi || !p.noHmi || p.profile.language !== 'ladder' || !p.ladder.rungs.length) return [];
  const writes = new Set(p.ladder.rungs.flatMap((r) => rungWrites(r).map((w) => w.trim().toUpperCase())));
  const reads = [...new Set(p.ladder.rungs.flatMap((r) => rungReads(r).map((x) => x.address.trim().toUpperCase())))];
  // A bit the checker already reports as the reason a coil can never turn on (validateProgram noPanel) is not repeated here.
  const covered = new Set(p.issues.filter((i) => /can never turn on/.test(i.message)).flatMap((i) => i.message.match(/\b(C|DS|DF)\d+\b/g) ?? []));
  return reads.filter((a) => HMI_WRITTEN.test(a) && !writes.has(a) && !covered.has(a)).map((a) => {
    const name = p.labels.get(a) ? ` ${p.labels.get(a)}` : '';
    const bit = a.startsWith('C');
    return finding(`nohmi-input:${a}`, 'major', 'hmi', 'program', a, `No touch panel, but the program waits for ${bit ? 'panel command' : 'panel setpoint'} ${a}${name}`,
      bit ? `${a}${name} is a touch-panel command bit. This machine has no touch panel, so nothing turns it on and what it starts or enables never happens.`
        : `${a}${name} is a value the operator would enter on a touch panel. This machine has no touch panel, so it stays 0.`,
      bit ? 'Use the operator-station pushbutton or selector input for this command (or remove it), then update the PLC program.'
        : 'Give the value a fixed setting in the program, or add a selector / thumbwheel input for it.');
  });
}

function hmiChecks({ p }: ReviewInput): Finding[] {
  const out: Finding[] = [];
  if (!p.hmi || p.profile.language !== 'ladder' || !p.ladder.rungs.length) return out;
  const { writes, sets, resets } = programUse(p.ladder);
  const reads = new Set(p.ladder.rungs.flatMap((r) => rungReads(r).map((x) => x.address)));
  // An upgraded program: what it still lacks for the HMI is one list of PLC changes, not a finding per tag.
  const changes = p.hmi.plcChanges ? new Set(p.hmi.plcChanges.map((c) => c.address)) : new Set<string>();
  const open = openPlcChanges(p.hmi, p.ladder);
  if (open.length) {
    // In the PLC's own tag names (CLICK's are its addresses), so each change can be typed in as it reads.
    const nameOf = p.profile.id === 'click' ? (a: string) => ({ name: a }) : plcTagNameOf(p);
    const list = open.slice(0, 15).map((c) => `• ${inPlcNames(c.change, nameOf)}`).join('\n') + (open.length > 15 ? `\n• … and ${open.length - 15} more` : '');
    out.push(finding('hmi-plc-changes', 'major', 'hmi', 'program', '', `The HMI needs ${open.length} change(s) in the upgraded PLC program`,
      `The HMI uses the imported program's own addresses where it has them. These HMI functions have nothing in the program yet:\n${list}`,
      'Make these changes in the PLC program, or take the elements off the HMI screens.'));
  }
  // analog input registers are filled by the module's analog setup, not by a rung
  const analogIn = new Set(p.io.filter((pt) => pt.type === 'input' && isAnalog(pt)).map((pt) => (p.addresses.get(pt.id) ?? '').toUpperCase()).filter(Boolean));
  for (const t of p.hmi.tags) {
    const a = t.address.trim().toUpperCase();
    if (/^[XY]\d/.test(a) || analogIn.has(a) || changes.has(a)) continue;
    if (t.access === 'read' && !writes.has(a)) {
      out.push(finding(`hmi-unwritten:${a}`, 'major', 'hmi', 'program', '', `HMI tag ${a} ${t.name} is never written by the PLC`,
        `The HMI shows ${t.name} (${t.description}) but no rung writes ${a}, so the screen would always show 0 / OFF.`, 'Implement the tag in the program as its description says.'));
    } else if (t.access !== 'read' && !reads.has(a)) {
      out.push(finding(`hmi-unused:${a}`, 'major', 'hmi', 'program', '', `HMI command/setpoint ${a} ${t.name} is not used by the PLC`,
        `The operator can press or enter ${t.name} (${t.description}) but no rung reads ${a}, so it does nothing.`, 'Use the tag in the program as its description says.'));
    }
  }
  for (const al of p.hmi.alarms) {
    const a = al.address.trim().toUpperCase();
    if (changes.has(a)) continue;
    if (!writes.has(a)) {
      out.push(finding(`alm-unset:${a}`, 'major', 'hmi', 'program', '', `Alarm ${a} "${al.message}" is never set`,
        'The alarm is on the HMI alarm list but no rung turns the bit on, so the operator is never warned.', 'Set the alarm bit from its fault condition in the Alarms block.'));
    } else if (sets.has(a) && !resets.has(a)) {
      out.push(finding(`alm-noreset:${a}`, 'major', 'hmi', 'program', '', `Latched alarm ${a} "${al.message}" can never be reset`,
        'The alarm is latched with SET but no rung resets it, so the machine stays faulted until the PLC is power-cycled.', 'Add a reset rung (Reset button, only when the cause is gone).'));
    }
  }
  for (const s of p.hmi.screens) for (const e of s.elements) {
    const il = e.interlock?.trim().toUpperCase();
    if (il && !writes.has(il) && !changes.has(il)) {
      out.push(finding(`hmi-interlock:${il}`, 'major', 'hmi', 'program', '', `Permissive ${il} for "${e.label}" is never written`,
        `The ${s.name} screen enables "${e.label}" only while ${il} is ON, but no rung writes it, so the button can never be used.`, 'Compute the permissive in the Manual block.'));
    }
  }
  return out;
}

function equipmentChecks({ p, modules }: ReviewInput): Finding[] {
  if (!p.io.length || p.profile.id === 'generic-st') return [];
  const cap = ioCapacity(p.cpu, moduleSlots(modules));
  const out: Finding[] = [];
  for (const kind of ['inputs', 'outputs'] as const) {
    const used = p.io.filter((pt) => !isAnalog(pt) && pt.type === (kind === 'inputs' ? 'input' : 'output')).length;
    const have = cap[kind];
    if (used > have) {
      out.push(finding(`cap:${kind}`, 'critical', 'equipment', 'equipment', '', `Not enough PLC ${kind}: ${used} needed, ${have} available`,
        `The CPU ${p.cpu.id}${modules.length ? ` and its modules` : ''} has ${have} ${kind}, the I/O list needs ${used}.`, 'Add an expansion module or choose a larger CPU on the Equipment page.'));
    } else if (have && (have - used) / have < 0.1) {
      out.push(finding(`spare:${kind}`, 'minor', 'equipment', 'equipment', '', `Little spare PLC ${kind}: ${have - used} of ${have} free`,
        'Less than 10% spare points leaves no room for changes during commissioning.', 'Consider an extra module or a larger CPU (about 20% spare is usual).'));
    }
  }
  const { channels, byPoint } = analogMap(p.profile, p.cpu, moduleSlots(modules), p.io);
  const a = analogNeed(p.io, channels);
  for (const kind of ['input', 'output'] as const) {
    // enough channels by count, but none of them takes the signal (a 0-10 V input with only a thermocouple module)
    const misfit = a.need[kind] <= a.have[kind] ? p.io.filter((q) => isAnalog(q) && q.type === kind && !byPoint.has(q.id)) : [];
    if (misfit.length) {
      const tc = misfit.some((q) => q.analog?.range === 'thermocouple');
      out.push(finding(`fit:analog-${kind}s`, 'critical', 'equipment', 'equipment', '', `No analog channel takes ${misfit.map((q) => `"${q.description}" (${q.analog?.range ?? '4-20mA'})`).join(', ')}`,
        `The free analog ${kind} channels of the CPU ${p.cpu.id}${modules.length ? ' and its modules' : ''} do not take ${misfit.length === 1 ? 'this signal' : 'these signals'} (a thermocouple module takes no voltage / current signal, a voltage / current module no thermocouple).`,
        `Add ${tc ? 'a thermocouple module (e.g. C0-04THM)' : `a voltage / current analog ${kind} module (e.g. ${kind === 'input' ? 'C0-04AD-1 for 4-20 mA; a 0-10 V signal needs a voltage input module such as C0-04AD-2, not in the parts catalog yet' : 'C0-04DA-1 / C0-04DA-2'})`} on the Equipment page.`));
    }
    if (a.need[kind] > a.have[kind]) {
      out.push(finding(`cap:analog-${kind}s`, 'critical', 'equipment', 'equipment', '', `Not enough analog ${kind}s: ${a.need[kind]} needed, ${a.have[kind]} available`,
        `The I/O list has ${a.need[kind]} analog ${kind}${a.need[kind] === 1 ? '' : 's'}, the CPU ${p.cpu.id}${modules.length ? ' and its modules' : ''} provide ${a.have[kind]}.`,
        `Add an analog ${kind} module (e.g. ${kind === 'input' ? 'C0-04AD-1' : 'C0-04DA-1'}) or an analog CPU on the Equipment page.`));
    }
  }
  return out;
}


const STAGE_PAGE: Record<StageId, ReviewPage> = { spec: 'spec', equipment: 'equipment', io: 'io', electrical: 'electrical', hmi: 'hmi', program: 'program' };
const STAGE_NAME: Record<StageId, string> = { spec: 'Machine description', equipment: 'Equipment', io: 'I/O list', electrical: 'Electrical design', hmi: 'HMI screens', program: 'PLC program' };

function stageChecks({ stages }: ReviewInput): Finding[] {
  const out: Finding[] = [];
  for (const s of Object.values(stages)) {
    if (s.status === 'stale') {
      out.push(finding(`stale:${s.id}`, 'major', s.id === 'spec' ? 'spec' : s.id, STAGE_PAGE[s.id], '', `${STAGE_NAME[s.id]} is out of date`,
        s.reason ?? 'It was made from an older version of its inputs.', 'Update it on its page (or "Update out-of-date stages" on the Machine description page).'));
    } else if (s.status === 'empty') {
      out.push(finding(`empty:${s.id}`, s.id === 'equipment' ? 'info' : 'major', s.id === 'spec' ? 'spec' : s.id, STAGE_PAGE[s.id], '', `${STAGE_NAME[s.id]} has not been made yet`,
        'This part of the project is missing, so the design cannot be complete.', `Create it on the ${STAGE_NAME[s.id]} page.`));
    }
  }
  return out;
}

const MAJOR_WARN_RE = /\b(no reset|no safety relay|no e-stop|below the motor|transformer is required|not rated|without contactor|needs two contactors|no plc output|not possible with these parts)\b/i;
/** Design warnings a code rule already reports (with its clause): not listed twice in the review. */
const COVERED_BY_CODE_RULES = /safety relay has no reset pushbutton/i;
// PLC I/O capacity is one finding, in Equipment (critical), with the same count as the Equipment page
const COVERED_BY_EQUIPMENT = /^PLC (inputs|outputs) over capacity/i;
const INFO_WARN_RE = /\b(estimated|by site|suggestions|calculate and mark|confirm with datasheets)\b/i;

function electricalChecks({ p }: ReviewInput): Finding[] {
  const out: Finding[] = [];
  if (p.drawingCtx) {
    for (const w of designWarnings(p.drawingCtx)) {
      if (COVERED_BY_CODE_RULES.test(w) || COVERED_BY_EQUIPMENT.test(w)) continue;
      const sev: Severity = MAJOR_WARN_RE.test(w) ? 'major' : INFO_WARN_RE.test(w) ? 'info' : 'minor';
      out.push(finding(`elec:${hash(w)}`, sev, /safety|e-stop/i.test(w) ? 'safety' : 'electrical', 'electrical', '', w.length > 90 ? `${w.slice(0, 88)}…` : w, w, 'Check the electrical design and correct it, or record why it is acceptable.'));
    }
    // Spare mounting space (customer / panel-shop rule: at least 25 % for later additions).
    const sp = spareSpace(p.drawingCtx);
    const pct = (f: number) => `${Math.round(f * 100)} %`;
    const perRail = sp.rails.map((r) => `rail ${r.rail}: ${pct(r.spare)}`).join(', ');
    if (sp.rails.length && sp.panel < 0.25) {
      out.push(finding('elec:spare-space', 'minor', 'electrical', 'electrical', '', `Back panel has only ${pct(sp.panel)} spare space (25 % recommended)`,
        `Spare DIN-rail length: ${perRail || 'none'}${sp.extraRails ? `; room for ${sp.extraRails} more rail(s)` : ''}. Panels are normally built with at least 25 % spare space for later changes.`,
        'Choose a larger enclosure / back panel, or record that the customer accepts less spare space.'));
    } else if (sp.rails.length) {
      out.push(finding('elec:spare-space-info', 'info', 'electrical', 'electrical', '', `Back panel spare space ${pct(sp.panel)}`,
        `Spare DIN-rail length: ${perRail}${sp.extraRails ? `; room for ${sp.extraRails} more rail(s)` : ''}.`, 'No action needed (25 % or more is free).'));
    }
    for (const w of calcWarnings(p)) {
      out.push(finding(`calc:${hash(w)}`, 'minor', 'electrical', 'electrical', '', w.length > 90 ? `${w.slice(0, 88)}…` : w, w, 'Review the calculation in the engineering package and change the design if needed.'));
    }
  }
  // Notes for the customer are "To confirm"; technical issues from the AI or the layout checker are findings to fix.
  for (const n of p.electrical?.notes ?? []) {
    if (isIssueNote(p.electrical!, n)) {
      out.push(finding(`eissue:${hash(n)}`, 'minor', 'electrical', 'electrical', '', `Electrical: ${n.length > 80 ? `${n.slice(0, 78)}…` : n}`, n, 'Change the electrical design (or use "Ask AI to fix").'));
      continue;
    }
    out.push(finding(`enote:${hash(n)}`, 'info', 'electrical', 'electrical', '', `To confirm (electrical): ${n.length > 70 ? `${n.slice(0, 68)}…` : n}`, n, 'Confirm with the customer or the datasheet and record the answer.'));
  }
  for (const n of p.hmi?.notes ?? []) {
    if (isIssueNote(p.hmi!, n)) {
      out.push(finding(`hissue:${hash(n)}`, 'minor', 'hmi', 'hmi', '', `HMI: ${n.length > 80 ? `${n.slice(0, 78)}…` : n}`, n, 'Change the screens on the HMI page (or use "Ask AI to fix").'));
      continue;
    }
    out.push(finding(`hnote:${hash(n)}`, 'info', 'hmi', 'hmi', '', `To confirm (HMI): ${n.length > 70 ? `${n.slice(0, 68)}…` : n}`, n, 'Confirm with the customer and record the answer.'));
  }
  return out;
}

/** Variable frequency drives (electrical/vfd.ts): size, control I/O, braking, commissioning values. */
function driveChecks({ p }: ReviewInput): Finding[] {
  if (!p.drawingCtx) return [];
  const out: Finding[] = [];
  const model = buildModel(p.drawingCtx);
  const safetyStop = !!(model.safety.relay || model.safety.estops.length);
  for (const c of model.drives) {
    const d = c.drive, t = d.tag;
    // Dropping the run command (even from 24+S) is not a safety function while STO is jumpered.
    if (safetyStop && c.safetyStop === 'none') {
      out.push(finding(`drive:sto:${t}`, 'major', 'safety', 'electrical', t, `${t}: E-stop does not remove motor torque`,
        `Motor ${d.motorTag} on ${t} stops on an E-stop only because the PLC run signal drops. With the drive's Safe Torque Off ${c.series === 'GS20' ? 'jumpered (factory setting)' : 'not available'} and no contactor, that is not a safety function: a drive fault or wiring error could keep the motor turning.`,
        c.series === 'GS20'
          ? `Wire ${t} STO1 and STO2 from the safety relay outputs (remove the factory jumper) — write "STO from safety relay" in the ${t} component function and regenerate — or add a motor contactor controlled by the safety relay.`
          : `Add a contactor in the ${d.motorTag} branch controlled by the safety relay (${c.series} has no STO terminals), or choose a GS20 drive and wire its STO from the safety relay.`));
    }
    if (d.outputAmps !== undefined && d.outputAmps < d.fla) {
      out.push(finding(`drive:size:${t}`, 'critical', 'electrical', 'electrical', t, `${t} output ${d.outputAmps} A is below motor ${d.motorTag} FLA ${d.fla.toFixed(1)} A`,
        `${d.partNumber} is rated ${d.outputAmps} A output; motor ${d.motorTag} (${d.motorHp} HP, ${d.motorVolts} V) draws ${d.fla.toFixed(1)} A at full load (NEC 430.250). The drive would trip on overload or fail.`,
        'Choose a drive whose rated output current is at least the motor full-load current (nameplate) and regenerate.'));
    }
    if (!c.terminals.some((x) => x.role === 'run')) {
      out.push(finding(`drive:run:${t}`, 'major', 'io', 'io', t, `${t} has no PLC run output`, `No PLC output is wired to ${t} FWD/DI1, so the program cannot start or stop motor ${d.motorTag}.`,
        `Add a "${d.motorDescription} run" output (device ${t}) to the I/O list, then update the electrical design and program.`));
    }
    if (!c.terminals.some((x) => x.role === 'fault')) {
      out.push(finding(`drive:fault:${t}`, 'minor', 'io', 'io', t, `${t} fault is not monitored`, `No PLC input reads ${t} relay R1 (fault). The PLC cannot stop the sequence or show an alarm when the drive trips.`,
        `Add a "${d.motorDescription} drive fault" input (device ${t}) wired to R1O / R1.`));
    }
    for (const n of c.notes.filter((x) => /braking resistor/i.test(x))) {
      out.push(finding(`drive:brake:${t}`, 'major', 'electrical', 'electrical', t, `${t}: braking resistor needed`, n, 'Add the braking resistor (and a mechanical brake for a vertical load) to the design, sized from the drive manual.'));
    }
    const site = c.params.filter((x) => x.source === 'nameplate' || x.source === 'on site');
    if (site.length) {
      out.push(finding(`drive:commission:${t}`, 'info', 'electrical', 'electrical', t, `${t}: ${site.length} drive parameters to set at commissioning`,
        `${site.map((x) => `${x.param} ${x.name}`).join(', ')} come from the motor nameplate or the load and are marked on the drive sheet.`, 'Enter them during commissioning and record the values.'));
    }
  }
  return out;
}

/** Servo axes / encoders the chosen PLC cannot run (pulse axes, counters, rates, coordinated moves): said, never generated silently. */
function motionChecks({ p }: ReviewInput): Finding[] {
  const f = motionFit(p.io, getPart(p.cpu.id), specToText(p.spec));
  const out: Finding[] = [];
  if (!f.ok) out.push(finding('motion:fit', 'critical', 'equipment', 'equipment', p.cpu.id, `The motion does not fit ${p.cpu.id}`, f.problems.join(' '), f.recommend.join(' ')));
  for (const [i, n] of f.notes.entries()) out.push(finding(`motion:note:${i}`, 'info', 'equipment', 'equipment', p.cpu.id, 'High-speed I/O set-up', n, 'Set it up in the PLC software (CLICK: High Speed I/O Setup) before writing the program.'));
  return out;
}

function projectChecks({ p }: ReviewInput): Finding[] {
  const out: Finding[] = [];
  if (!p.info.revisions?.length) {
    out.push(finding('doc:revision', 'minor', 'project', 'project', '', 'No revision issued yet', 'Drawings and documents carry no revision history.', 'Issue revision A on the Project data page when the design is sent for review.'));
  }
  if (!p.info.checkedBy?.trim()) {
    out.push(finding('doc:checked', 'minor', 'project', 'project', '', 'Design not checked by a named engineer', 'The "Checked by" field is empty on every title block.', 'Have a qualified engineer check the design and enter their name on the Project data page.'));
  }
  if (!p.info.approvedBy?.trim()) {
    out.push(finding('doc:approved', 'minor', 'project', 'project', '', 'Design not approved', 'The "Approved by" field is empty, so the package is not released for construction.', 'Enter the approver on the Project data page once the open findings are resolved.'));
  }
  return out;
}

const ANALOG_RE = /\b(4\s*-\s*20\s*ma|0\s*-\s*10\s*v|analog|transmitter|rtd|thermocouple|proportional|modulating|open(?:s)? partly|variable speed|speed (?:from|on) the screen|set the speed)\b/i;
const GUARD_RE = /\b(light curtains?|safety mats?|guard doors?|door switch(?:es)?|interlocked (?:door|gate|guard)s?|gate switch(?:es)?|doors? around it)\b/i;
const VFD_RE = /\b(vfds?|variable speed|variable frequency|drives? so we can set the speed|inverters?|speed drives?)\b/i;
const SERVO_RE = /\bservo\b/i;
const HP_RE = /(\d+(?:\.\d+)?|\d+\/\d+)\s*hp\b/gi;
// Words that don't name a motor: the motor's name is the nearest other word next to its rating.
const NOT_A_NAME = new Set(['the', 'a', 'an', 'and', 'or', 'with', 'of', 'on', 'for', 'each', 'one', 'two', 'three', 'four', 'motor', 'motors', 'drive', 'drives', 'hp', 'kw', 'at', 'is', 'are', 'to', 'v', 'vac', 'vdc', 'phase', 'rated', 'by', 'via', 'its', 'their', 'it', 'has', 'have', 'uses', 'use', 'runs', 'driven', 'about', 'approx', 'approximately', 'tefc', 'induction', 'gear', 'gearmotor', 'new', 'existing', 'yes', 'no', 'answer', 'question']);

/**
 * Distinct motors the spec gives a rating for, e.g. ["conveyor 2 HP", "m2 1 HP"]. A motor described in two
 * sections (the overview and an answered question) counts once: each rating is paired with what names its
 * motor (a tag like M1 and/or the nearest word that names something); mentions of one rating that share a
 * name or tag are one motor, and unnamed mentions count only as often as one section repeats them. Never
 * counts more motors than the spec describes.
 */
export function specMotorRatings(sections: Record<string, string | undefined>): string[] {
  const isName = (w: string) => /^[a-z][a-z-]{1,}$/.test(w) && !NOT_A_NAME.has(w);
  const wordsOf = (t: string) => t.toLowerCase().split(/[^a-z0-9/.]+/).filter(Boolean);
  /** What names the motor of one rating: the clause's naming words before it (or after it, up to "motor"), and its tag. */
  const idsOf = (clause: string, m: RegExpMatchArray) => {
    const before = wordsOf(clause.slice(0, m.index));
    const after = wordsOf(clause.slice(m.index! + m[0].length));
    const stop = after.findIndex((w) => /^(motors?|drives?|gearmotors?)$/.test(w));
    const ids = new Set([...before, ...(stop >= 0 ? after.slice(0, stop) : after.slice(0, 1))].filter(isName));
    const tag = /\bm\d+\b/i.exec(clause)?.[0];
    if (tag) ids.add(tag.toLowerCase());
    return ids;
  };
  // Every mention, by rating: its section and what names it (empty = unnamed).
  const mentions = new Map<string, { section: number; ids: Set<string> }[]>();
  Object.values(sections).forEach((text, section) => {
    for (const clause of (text ?? '').split(/[;:\n!?,()]+|\.(?=\s|$)|\b(?:and|or|with)\b/i)) {
      for (const m of clause.matchAll(HP_RE)) {
        const [n, d] = m[1].split('/');
        const v = String(d ? Number(n) / Number(d) : Number(n));
        mentions.set(v, [...(mentions.get(v) ?? []), { section, ids: idsOf(clause, m) }]);
      }
    }
  });
  const out: string[] = [];
  for (const [v, list] of mentions) {
    // mentions of one rating that share a name or tag are one motor, across the whole spec
    let groups: Set<string>[] = [];
    for (const { ids } of list) {
      if (!ids.size) continue;
      const same = groups.filter((g) => [...ids].some((i) => g.has(i)));
      groups = [...groups.filter((g) => !same.includes(g)), new Set([...ids, ...same.flatMap((g) => [...g])])];
    }
    // per section: the motors it names, or its unnamed mentions (which may be one of those): the larger, never the sum
    let count = groups.length;
    for (const section of new Set(list.map((x) => x.section))) {
      const here = list.filter((x) => x.section === section);
      const named = new Set(here.filter((x) => x.ids.size).map((x) => groups.findIndex((g) => [...x.ids].some((i) => g.has(i)))));
      count = Math.max(count, named.size, here.filter((x) => !x.ids.size).length);
    }
    for (let i = 0; i < count; i++) out.push(`${groups[i] ? [...groups[i]].join(' ') : 'motor'} ${v} HP`);
  }
  return out;
}

/**
 * Spec coverage: things the machine description asks for that the generated
 * design is missing. These catch the typical AI misses on real machines.
 */
function specCoverage({ p, cautions = [] }: ReviewInput): Finding[] {
  const out: Finding[] = [];
  const spec = Object.values(p.spec).join('\n');
  if (!spec.trim()) return out;
  const io = p.io;
  const comps = p.electrical?.components ?? [];
  const catOf = (pn: string) => p.drawingCtx?.getPart(pn)?.category;
  // analog signals
  const analogLine = spec.split('\n').find((l) => ANALOG_RE.test(l));
  if (analogLine && io.length) {
    const onDiscrete = io.filter((pt) => !isAnalog(pt) && /\b(transmitter|4\s*-\s*20|0\s*-\s*10\s*v|rtd|thermocouple|analog|proportional|speed reference)\b/i.test(pt.description));
    for (const pt of onDiscrete) {
      const a = p.addresses.get(pt.id) ?? '';
      out.push(finding(`analog-on-discrete:${pt.id}`, 'critical', 'io', 'io', '', `Analog signal on a discrete ${pt.type}: ${a} ${pt.description}`,
        `"${pt.description}" is an analog signal but the I/O list gives it a discrete ${pt.type} (${a}). A 4-20 mA / 0-10 V / RTD signal cannot be wired to a 24 V on/off point.`,
        'Switch the point to "Analog" in the I/O list (range and engineering units) so it gets an analog channel.'));
    }
    if (!io.some(isAnalog)) {
      out.push(finding('spec-analog', 'major', 'io', 'io', '', 'The spec needs analog signals but the I/O list has none',
        `The specification asks for analog measurement or control ("${analogLine.trim().slice(0, 120)}"), but every I/O point is discrete (on/off).`,
        'Add the analog points (switch them to "Analog" with range and engineering units) or regenerate the I/O list; confirm that on/off switches are enough otherwise.'));
    }
  }
  // guarding devices in the safety circuit
  const guard = GUARD_RE.exec(spec);
  if (guard && io.length) {
    const word = guard[1].toLowerCase().replace(/s$/, '').split(' ')[0];
    const inSafety = io.some((pt) => (pt.category === 'Safety' || SAFETY_RE.test(pt.description)) && new RegExp(`\\b(${word}|curtain|door|guard|gate|zone|mat)`, 'i').test(pt.description))
      || comps.some((c) => new RegExp(`\\b(${word}|curtain|door|guard|gate|mat)`, 'i').test(c.function));
    if (!inSafety) {
      out.push(finding('spec-guard', 'major', 'safety', 'electrical', '', `Spec guarding (${guard[1]}) is not in the safety circuit`,
        `The specification has ${guard[1]}, but no safety input, safety relay channel or device in the design covers it, so opening it would not stop the machine.`,
        'Wire the guard devices (light curtain OSSDs, door switches) into a safety relay channel and give the PLC a status input per safety zone.'));
    }
  }
  // motors and drives
  const specMotors = specMotorRatings(p.spec);
  const designMotors = p.electrical?.inputs.motors.length ?? 0;
  if (p.electrical && specMotors.length > designMotors) {
    out.push(finding('spec-motors', 'major', 'electrical', 'electrical', '', `The spec names ${specMotors.length} motor${specMotors.length > 1 ? 's' : ''}, the panel has ${designMotors}`,
      `Some motors described in the specification have no starter, overload or drive in the electrical design. Motors in the spec: ${specMotors.join(', ')}.`, 'Add every motor (HP, voltage, starter or VFD) to the electrical design inputs and regenerate.'));
  }
  if (p.electrical && VFD_RE.test(spec) && !comps.some((c) => catOf(c.partNumber) === 'vfd')) {
    out.push(finding('spec-vfd', 'major', 'electrical', 'electrical', '', 'The spec asks for variable-speed drives; the panel has none',
      'The specification wants adjustable speed / soft starting, but every motor is on a contactor.', 'Set those motors to "VFD" in the electrical design inputs and regenerate.'));
  }
  if (SERVO_RE.test(spec) && !io.some((pt) => pt.category === 'Servo/Axis') && !cautions.some((c) => SERVO_RE.test(c))) {
    out.push(finding('spec-servo', 'major', 'equipment', 'equipment', '', 'Servo motion is in the spec but not in the design',
      'The specification needs a servo axis, but there is no motion hardware, axis I/O or equipment caution for it. A CLICK PLC cannot close a servo position loop by itself.',
      'Add a servo drive with built-in indexer (or a motion controller) and its handshake I/O (enable, home, start move, in position, fault), or record why it is not needed.'));
  }
  return out;
}

/** Every deterministic finding for the project. */
export function runChecks(input: ReviewInput): Finding[] {
  const all = [
    ...stageChecks(input), ...specVsIo(input), ...specCoverage(input), ...equipmentChecks(input), ...electricalChecks(input), ...driveChecks(input),
    ...programChecks(input), ...hmiChecks(input), ...noPanelChecks(input), ...motionChecks(input), ...projectChecks(input), ...codeRuleFindings(input.p),
  ];
  // The Engineer review's rule checks (SCCR weak link, heat, voltage drop…) count here too: one set of findings everywhere.
  const eng = engineerChecksFor(input.p);
  all.push(...eng.filter((e) => !all.some((f) => f.title === e.title)));
  const seen = new Set<string>();
  return all.filter((f) => (seen.has(f.id) ? false : (seen.add(f.id), true)));
}
