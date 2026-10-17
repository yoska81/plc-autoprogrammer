import type { IOPoint } from '../../types/io';
import type { AIProvider, Effort } from '../../store/useSettingsStore';
import type { CpuModel, PlcProfile } from '../core/profile';
import { newRungId, type LadderProgram } from '../core/ladder';
import { LADDER_RESPONSE_SCHEMA } from '../core/schema';
import type { ValidationIssue } from '../core/validate';
import { callClaude, type ChatTurn } from '../../lib/ai/anthropic';
import { callOpenAI } from '../../lib/ai/openai';

export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  model: string;
  effort: Effort;
  /** Aborts the request (job Cancel). */
  signal?: AbortSignal;
  /** May answer from the answer cache (Update all). */
  cache?: boolean;
}

export interface PlcContext {
  profile: PlcProfile;
  cpu: CpuModel;
  io: IOPoint[];
  /** I/O point id -> PLC address. */
  addresses: Map<string, string>;
  /** Field wiring from the electrical design (address -> device), when known. */
  wiring?: Map<string, { deviceTag: string; deviceType: string }>;
  /** HMI tags and alarms the program must implement; screens add state tables, setpoint limits and permissives. */
  hmi?: {
    tags: { name: string; address: string; dataType: string; access: string; description: string }[];
    alarms: { address: string; message: string; severity?: string }[];
    screens?: HmiScreenFacts[];
  };
}

/** The parts of an HMI screen the program has to match (structurally an HmiScreen). */
interface HmiScreenFacts {
  name: string;
  elements: {
    kind: string; label: string; address: string | null; action: string | null;
    onText: string | null; offText: string | null; units: string | null; min: number | null; max: number | null; note: string | null;
    states?: { value: number; text: string }[]; interlock?: string | null;
  }[];
}

export interface LadderAIResult {
  explanation: string;
  /** null when the AI answered a question without changing the program. */
  program: LadderProgram | null;
  reasoning: string | null;
}

function systemPrompt(ctx: PlcContext): string {
  return `You are a senior controls engineer. You write ladder logic for a ${ctx.profile.vendor} ${ctx.profile.name} PLC (CPU: ${ctx.cpu.label}) that will run a real machine, so correctness and safety matter more than brevity.

You also act as the maintenance engineer for this program: the user describes what the machine should do, or what is wrong with it, and you write or change the program for them. The user may never read the code, so your explanation is how they understand what you did.

${ctx.profile.promptKnowledge(ctx.cpu)}

How to write the program:
- Physical I/O: use only the addresses in the I/O list. If the logic needs a signal that is not in the list, use an internal bit instead and say in the explanation which physical signal is missing.
- Safety first: the first rungs build a safety-OK bit from the safety inputs (E-stop, guards, light curtains, safety relay, air/power OK). Every rung that drives a motion or process output includes that bit. On loss of safety, outputs drop and the sequence returns to its idle step.
- Use start/stop seal-in circuits for run commands, with the stop condition in series.
- Multi-step processes: a step sequencer with one step value or step bit per state, a timeout timer on every step that waits for feedback, and a fault bit that latches on timeout and is cleared by the reset input.
- Drive each output with exactly one OUT coil in the whole program (no double coils). Use SET/RST pairs only for latches.
- Give every rung a short comment a technician can understand.
- List every internal address you use (bits, timers, counters, registers) in "tags" with a short nickname (no spaces, max 24 characters) and a comment.
- Keep the program as simple as the machine allows.
- Professional structure, in this block order (skip what the machine doesn't need): 1) Safety & modes — safety-OK bit, first-scan initialisation (reset step registers and latches on the first scan), Auto/Manual mode selection (mutually exclusive, Manual only when not cycling), cycle start/stop/reset; 2) Alarms — one latched bit per fault (set by the fault condition, cleared by reset only when the cause is gone), a summary "any alarm" bit and a summary "stop-category" bit that stops the cycle; 3) one block per station/sequence; 4) Manual — hold-to-run jog commands per actuator, interlocked (e.g. cylinder vs conveyor, end-of-travel), active only in Manual mode and with safety OK; 5) Outputs — final output rungs combining Auto and Manual requests, so each output has exactly one OUT coil; 6) HMI & status — status bits for the HMI (running, stopped, faulted, mode), counters, timers and run-hour/cycle counting if the HMI shows them.
- Sequences: a step register (DS) per station with step numbers 0 (idle), 10, 20, 30… so steps can be inserted later; each step's rung comment names the step ("Step 20: extend pusher, wait for extended"); a step-timeout timer and alarm on every step that waits for feedback; return to step 0 on stop or fault.
- Rung comments in the style "<Block> – <what this rung does>"; every tag nickname in PascalCase_With_Underscores, prefixed by its role where useful (Cmd_, Sts_, Alm_, Tmr_, Cnt_, Step_).
- Safety zones: when the machine has several safety zones (e.g. two light curtains, two pallet positions), build one safety-OK bit per zone from its safety relay status input and gate only that zone's motion with it; the E-stop bit still stops everything. Each zone needs its own reset.
- VFDs (wired per drive: run output → FWD/DI1, reverse → REV/DI2, preset-speed outputs → DI3/DI4 (binary steps), fault relay R1 → an input that is ON when the drive is faulted, analog speed reference DF → the drive's analog input):
  - Run output = (auto run request OR manual jog permitted) AND Safety OK AND NOT drive-fault alarm. Forward and reverse outputs are never ON together (each has NOT the other in series), and a direction change waits for the motor to stop (an off-delay timer of the decel time, e.g. 3 s).
  - Drive fault: the fault input SETs a latched alarm bit (C1101…, with a clear alarm text like "VFD1 fault"); the alarm drops the run output; only the fault reset (HMI button or reset pushbutton) RSTs it, and only while the fault input is OFF. Reset of the drive itself is done on the drive keypad unless a reset output exists.
  - Speed: when the I/O list has an analog speed reference (ANALOG, units Hz or %), the HMI enters the speed setpoint in a DF register (DF101–DF200) with limits; on the first scan, and whenever the setpoint is outside its limits, COPY a safe default (e.g. 30 Hz) into it; COPY / MATH it to the speed-reference DF only while running, else write 0. Clamp to the min/max with two CMP rungs before the copy. Never write a speed above the drive's upper limit (P01.10 = the reference's maximum).
  - Preset speeds: one preset output per speed; the drive's multi-step parameters hold the actual frequencies (set on site) — say which output selects which step.
  - No analog reference and no preset outputs: the speed is set on the drive keypad; say so in the explanation.
- Handshakes with other equipment (robot, servo drive with indexer, other machine): request output → wait for the done / in-position input with a timeout alarm → clear the request; never assume a step finished without its feedback; handle the other machine's fault input.
- Recipes: recipe values live in DS registers per recipe (e.g. DS1301+ recipe 1, DS1321+ recipe 2); the selected recipe is COPYed into the working setpoints only while the machine is stopped.
- Analog I/O: analog points are DF registers (marked ANALOG in the I/O list) that already hold the value in engineering units — the PLC's analog setup scales the 4-20 mA / 0-10 V signal (CLICK: Setup > System Configuration; there is no scaling instruction in ladder), so never scale raw counts. Read analog inputs with CMP (e.g. DF1 >= DF101); write analog outputs with COPY or MATH in their engineering units (e.g. COPY DF102 → DF5 for a valve position in %, MATH DF6 = DF103 for a VFD speed in Hz). Analog setpoints and alarm limits the HMI enters are DF registers DF101–DF200 (floating point, so they compare directly with analog values); give each a default on the first scan when it is outside its range.
- Analog alarms: high / low alarms latch with a deadband so they don't chatter: SET the alarm when value >= high limit (or <= low limit), RST it only when value < high limit − deadband (> low limit + deadband) AND the operator pressed Reset; use the same deadband for control switching (e.g. a fill valve opens below setpoint − deadband and closes at setpoint). A transmitter reading at the bottom of its range (≤ min) while the process should be running indicates a broken 4-20 mA loop: alarm it.
- HMI tags: when the request lists HMI tags, implement every one of them exactly as described (see "Implementing the HMI tags" below); never leave an HMI tag unused or unwritten, and never move an HMI tag to another address.
- Split the program into blocks, one per machine section or station (e.g. "safety" Safety & modes, "infeed" Infeed conveyor, "pusher" Pusher station, "alarms" Alarms & HMI). List them in "blocks" in program order (id: short lower-case, name: 1–3 words, description: one sentence) and set every rung's "block" to its block id. Rungs of one block stay together. A small machine may have only 2–3 blocks. Signals passed between blocks go through internal bits so each block can be tested on its own.

Implementing the HMI tags (standard ranges: commands C1001–C1100, setpoints DS1001–DS1100, status words DS1101–DS1200, alarms C1101–C1200, status bits C1201–C1300). For each kind the HMI design uses:
- Command buttons (HMI writes, momentary): use them as commands in the logic. Start: rising edge (RISE) in parallel with the panel Start, sealed in; Stop: NC in series. Reset: clears latched alarms only when the cause is gone. Count/cycle resets: the counter's reset bit.
- Mode select (a toggle the HMI reads and writes, e.g. HMI_Manual_Select): Manual is accepted only while the automatic cycle is not running — a rung "cycle running AND select → RST select" refuses it while running. The mode status bit (e.g. STS_Manual_Mode) = select AND NOT running. Start is blocked while Manual is active (NC of the mode status bit in the run seal-in), and the cycle drops if Manual turns on.
- Permissive bits (status bits shown as a button's interlock, e.g. STS_Jog_Permit): compute them every scan exactly as the tag description says (typically Manual mode AND safety OK AND the conflicting actuator OFF). Hold-to-run commands (Jog/Extend …): the manual request bit = command AND its permissive; when two manual requests conflict, give one priority (NC of the other request) so they cannot both energize in the same scan. Combine the Auto and Manual requests in the Outputs block: one OUT coil per output.
- Setpoints (DS, HMI reads/writes): use the register directly — as the timer preset (CLICK timer presets may be a DS register), counter preset or compare value. DS registers are retentive, so on the first scan (SC2) load the documented default only when the value is outside its min–max limits.
- Machine state word (e.g. DS1101 Machine_State): must use exactly the values of the HMI state table below. Write it every scan with one COPY rung per state, ordered from the lowest to the highest priority (an SC1 rung copies the default first), so the highest applicable state wins.
- Heartbeat (e.g. STS_Heartbeat): changes state every second: a one-scan pulse on the rising edge of SC7 (CLICK 1 s clock), then OUT heartbeat with branches (pulse AND NOT heartbeat) OR (NOT pulse AND heartbeat).
- Counters shown on the HMI (CTD): CNT on the event (part sensor, actuator output turning ON) with the HMI reset bit as reset; CTD holds the value the HMI reads.
- Run hours (retentive DS): an accumulating ON-delay timer, 3600 sec, enabled while the motor output is ON and reset by a one-scan "hour reached" bit; that bit adds 1 (MATH) to the run-hours register and to the hours-since-service register.
- Service interval: warning bit ON when hours since service >= the interval setpoint (and the interval > 0); the Service Done command COPYs 0 into hours since service.
- Rates (e.g. Parts_Per_Min): a self-restarting 10 s timer; every 10 s shift six bucket registers, store the parts counted in the last 10 s (count minus a snapshot, negative after a count reset → 0) and sum the six buckets.
- Batch target (setpoint, 0 = off): a batch-complete bit when target > 0 and count >= target; stop the cycle only once the last part has been handled, and block Start until the count is reset.
- Alarm bits: one per HMI alarm. Faults latch (SET on the fault, RST on reset when the cause is gone) and stop the cycle; condition alarms (e.g. safety open) and warnings (service due) are plain OUT coils that follow the condition.
- Status bits/words the HMI reads that are not covered above: write them from the condition their description gives.

When you change an existing program:
- Keep the "id" of every rung you keep (edited or not). Give new rungs ids like "new-1", "new-2".
- Change only what is needed for the request; don't rewrite rungs that already work.
- Keep the blocks and each rung's block. When the request names a block ("[Block: …]"), change only that block's rungs unless another block must change for it to work, and say so.
- If the request is only a question, answer it and return "program": null.

"explanation": plain language for the operator, no code. Say what the program does or what you changed and why, list any assumptions, and list what to check on the machine before running it.`;
}

/** Facts from the HMI screens the program must match: state tables, setpoint limits, permissives, toggles. */
export function hmiScreenFacts(screens: HmiScreenFacts[] | undefined): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const once = (key: string, line: string) => { if (!seen.has(key)) { seen.add(key); out.push(line); } };
  for (const s of screens ?? []) for (const e of s.elements) {
    const a = e.address?.trim().toUpperCase();
    if (!a) continue;
    if (e.states?.length && /^(DS|DD|DH)\d+$/.test(a)) {
      once(`st:${a}`, `${a} state table (HMI "${e.label}"): ${e.states.map((x) => `${x.value} = ${x.text}`).join(', ')}`);
    }
    if (e.kind === 'numeric-entry') {
      const lim = [e.min !== null ? `min ${e.min}` : '', e.max !== null ? `max ${e.max}` : '', e.units ? `units ${e.units}` : ''].filter(Boolean).join(', ');
      once(`sp:${a}`, `${a} setpoint "${e.label}"${lim ? ` (${lim})` : ''}${e.note ? ` — ${e.note}` : ''}`);
    }
    if (e.kind === 'button' && e.interlock) {
      once(`il:${a}`, `${a} "${e.label}" (${e.action ?? 'momentary'}${e.note ? `, ${e.note}` : ''}) is only enabled while permissive ${e.interlock.toUpperCase()} is ON — the PLC must also require ${e.interlock.toUpperCase()}`);
    }
    if (e.kind === 'button' && e.action === 'toggle') {
      once(`tg:${a}`, `${a} "${e.label}" is a toggle (HMI writes ON/OFF and shows the bit)${e.note ? ` — ${e.note}` : ''}`);
    }
  }
  return out;
}

function hmiText(ctx: PlcContext): string {
  if (!ctx.hmi?.tags.length) return '';
  const tags = ctx.hmi.tags.map((t) => `${t.address}\t${t.dataType}\t${t.access === 'write' ? 'HMI writes' : t.access === 'read' ? 'HMI reads' : 'HMI reads/writes'}\t${t.name}: ${t.description}`).join('\n');
  const alarms = ctx.hmi.alarms.map((a) => `${a.address}\t${a.severity ? `${a.severity}\t` : ''}${a.message}`).join('\n');
  const facts = hmiScreenFacts(ctx.hmi.screens);
  return `\n\nHMI tags the program must implement — every one, at exactly these addresses (address, type, direction, name: what the PLC does). HMI buttons are momentary unless stated; treat HMI-written bits as commands and use them in the logic; write every bit/word the HMI reads. Follow "Implementing the HMI tags":\n${tags}${alarms ? `\n\nHMI alarm bits (address, severity, message) — set each from its condition:\n${alarms}` : ''}${facts.length ? `\n\nFrom the HMI screens (the program must match these):\n${facts.map((f) => `- ${f}`).join('\n')}` : ''}`;
}

function ioTable(ctx: PlcContext): string {
  if (!ctx.io.length) return '(no I/O defined yet)';
  return ctx.io
    .map((p) => {
      const a = ctx.addresses.get(p.id) || '';
      const w = a ? ctx.wiring?.get(a) : undefined;
      const an = p.signal === 'analog' && p.analog ? `\tANALOG ${p.analog.range}, value in engineering units ${p.analog.min}–${p.analog.max} ${p.analog.units}` : '';
      return `${a || '(unassigned)'}\t${p.type}\t${p.category}\t${p.description || '(no description)'}${an}${w ? `\tfield device ${w.deviceTag} (${w.deviceType})` : ''}`;
    })
    .join('\n');
}

/** Make AI output safe to store: unique rung ids, trimmed upper-case addresses. */
function normalize(program: LadderProgram): LadderProgram {
  const seen = new Set<string>();
  const up = (s: string) => s.trim().toUpperCase();
  const blocks = (program.blocks ?? []).filter((b, i, all) => b.id?.trim() && all.findIndex((x) => x.id === b.id) === i);
  const blockIds = new Set(blocks.map((b) => b.id));
  return {
    ...(blocks.length ? { blocks } : {}),
    tags: program.tags.map((t) => ({ ...t, address: up(t.address) })),
    rungs: program.rungs.map((r) => {
      const id = !r.id || seen.has(r.id) || r.id.startsWith('new-') ? newRungId() : r.id;
      seen.add(id);
      const { block, ...rest } = r;
      return {
        ...rest,
        ...(block && blockIds.has(block) ? { block } : {}),
        id,
        branches: r.branches.map((b) => b.map((el) =>
          el.type === 'CMP' ? { ...el, left: up(el.left), right: up(el.right) } : { ...el, address: up(el.address) })),
        outputs: r.outputs.map((o) => {
          switch (o.type) {
            case 'COPY': return { ...o, source: up(o.source), dest: up(o.dest) };
            case 'MATH': return { ...o, dest: up(o.dest) };
            case 'TMR': case 'CNT':
              return { ...o, address: up(o.address), preset: up(o.preset), resetAddress: o.resetAddress ? up(o.resetAddress) : null };
            default: return { ...o, address: up(o.address) };
          }
        }),
      };
    }),
  };
}

async function run(ai: AIConfig, system: string, messages: ChatTurn[]): Promise<LadderAIResult> {
  let text: string;
  let reasoning: string | null = null;
  if (ai.provider === 'anthropic') {
    ({ text, reasoning } = await callClaude({ ...ai, task: 'program', system, messages, schema: LADDER_RESPONSE_SCHEMA }));
  } else {
    text = await callOpenAI({ ...ai, system, messages, schema: LADDER_RESPONSE_SCHEMA });
  }

  let parsed: { explanation: string; program: LadderProgram | null };
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error('The AI returned a program the app could not read. Please try again.', { cause: err });
  }
  return {
    explanation: parsed.explanation,
    program: parsed.program ? normalize(parsed.program) : null,
    reasoning,
  };
}

export function generateLadder(ai: AIConfig, ctx: PlcContext, description: string): Promise<LadderAIResult> {
  const content = `I/O list (address, type, category, description, field device if known):\n${ioTable(ctx)}${hmiText(ctx)}\n\nWhat the machine must do:\n${description}\n\nWrite the complete program.`;
  return run(ai, systemPrompt(ctx), [{ role: 'user', content }]);
}

/**
 * Continue the fix-it conversation. `history` holds earlier requests and the
 * AI's explanations; the current program (which may include manual edits) and
 * its validation issues are always sent fresh.
 */
export function reviseLadder(
  ai: AIConfig,
  ctx: PlcContext,
  program: LadderProgram,
  issues: ValidationIssue[],
  history: ChatTurn[],
  request: string,
): Promise<LadderAIResult> {
  const issueText = issues.length
    ? issues.map((i) => `- [${i.severity}] ${i.rungId ? `rung ${i.rungId}: ` : ''}${i.message}`).join('\n')
    : '(none)';
  const content = `I/O list (address, type, category, description, field device if known):\n${ioTable(ctx)}${hmiText(ctx)}\n\nCurrent program (JSON, includes any manual edits):\n${JSON.stringify(program)}\n\nIssues the app's checker found:\n${issueText}\n\nRequest:\n${request}`;
  return run(ai, systemPrompt(ctx), [...history, { role: 'user', content }]);
}
