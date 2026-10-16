import type { Effort } from '../../store/useSettingsStore';
import type { CpuModel, PlcProfile } from '../../plc/core/profile';
import type { IOPoint } from '../../types/io';
import type { HmiDesign, HmiElement, HmiScreen } from '../../hmi/types';
import { HMI_ELEMENT_KINDS, MACHINE_SYMBOL_KINDS } from '../../hmi/types';
import type { HmiModel } from '../../hmi/hmiCatalog';
import { checkDesign, fixDesignLayout, layoutBands, MIN_TOUCH, GAP } from '../../hmi/layout';
import { specToText, type SpecSections } from '../../spec/types';
import { callClaude } from './anthropic';

const obj = (properties: Record<string, unknown>) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const ns = { type: ['string', 'null'] };
const nn = { type: ['number', 'null'] };
const STYLE = { type: 'string', enum: ['normal', 'ok', 'warning', 'alarm'] };
const LEVEL = { type: 'string', enum: ['operator', 'maintenance', 'engineer'] };

// New fields are non-nullable (empty string / empty array / "operator" mean
// "not used") to keep the number of union types in the schema small.
const SCHEMA = obj({
  explanation: { type: 'string' },
  machineName: { type: 'string' },
  screens: {
    type: 'array',
    items: obj({
      id: { type: 'string' },
      name: { type: 'string' },
      purpose: { type: 'string' },
      level: LEVEL,
      elements: {
        type: 'array',
        items: obj({
          id: { type: 'string' },
          kind: { type: 'string', enum: HMI_ELEMENT_KINDS },
          label: { type: 'string' },
          x: { type: 'integer' }, y: { type: 'integer' }, w: { type: 'integer' }, h: { type: 'integer' },
          address: ns,
          action: { anyOf: [{ type: 'string', enum: ['momentary', 'set', 'reset', 'toggle'] }, { type: 'null' }] },
          targetScreenId: ns,
          onText: ns, offText: ns,
          style: STYLE,
          units: ns, min: nn, max: nn,
          note: ns,
          level: LEVEL,
          interlock: { type: 'string' },
          states: { type: 'array', items: obj({ value: { type: 'integer' }, text: { type: 'string' }, style: STYLE }) },
          symbols: {
            type: 'array',
            items: obj({
              kind: { type: 'string', enum: MACHINE_SYMBOL_KINDS },
              label: { type: 'string' },
              address: { type: 'string' },
              x: { type: 'integer' }, y: { type: 'integer' }, w: { type: 'integer' }, h: { type: 'integer' },
            }),
          },
        }),
      },
    }),
  },
  alarms: { type: 'array', items: obj({ address: { type: 'string' }, message: { type: 'string' }, severity: { type: 'string', enum: ['alarm', 'warning'] } }) },
  tags: {
    type: 'array',
    items: obj({
      name: { type: 'string' }, address: { type: 'string' },
      dataType: { type: 'string', enum: ['BIT', 'INT', 'INT2', 'FLOAT'] },
      access: { type: 'string', enum: ['read', 'write', 'read-write'] },
      description: { type: 'string' },
    }),
  },
  notes: { type: 'array', items: { type: 'string' } },
});

function system(hmi: HmiModel, guidelines: string, comms: string) {
  const W = hmi.widthPx, H = hmi.heightPx;
  const b = layoutBands(W, H);
  const navCount = 6;
  const navW = Math.floor((W - GAP * (navCount + 1)) / navCount);
  return `You are a senior HMI designer at a professional machine builder. Design the complete operator panel for an AutomationDirect ${hmi.partNumber} (${hmi.sizeIn}" ${W}x${H} px touch panel) connected to the machine's PLC. The customer is not an engineer and wants it as detailed and professional as a top machine builder's HMI: ISA-101 high-performance practice in a dark minimal console style.

SCREEN SET (always produce all of these, adapted to the machine; ids in brackets):
1. Main [main] — overview: a "machine" schematic of the machine (conveyors, motors, cylinders, sensors, parts bound to their bits), machine state as a "multistate" (Stopped / Running / sequence steps / Faulted ...), mode, cycle state, key counts and rates (numeric), a short production "trend", Start / Stop / Reset buttons, and an "alarm-banner" with the newest alarm.
2. Manual [manual] — one row per actuator (motor, cylinder, valve): row label, hold-to-run (action "momentary") jog/extend/retract buttons, the actuator's position/feedback indicators, and the interlock status. Every manual button has "interlock" = a PLC status bit that is ON only when that motion is permitted (manual mode selected, safety OK, actuator-specific permissives). Include a Manual/Auto mode selector (toggle). Screen level "maintenance" if motions can be hazardous.
3. Setup [setup] — every adjustable setpoint as "numeric-entry" with units, min and max, label short; group with "panel". level "maintenance" (or "engineer" for machine constants) on the entries and on the screen; a small "text" note naming the password level.
4. Alarms [alarms] — an "alarm-list" filling most of the screen (time, message, state; the panel keeps the history), Reset button, and an alarm count/active indicators.
5. Diagnostics [diagnostics] — I/O status lamps ("indicator" bound to every X and Y point) grouped in "panel" frames per module/slot (inputs, outputs, each card), with the address in the label (e.g. "X001 E-stop OK"); a communications panel with a PLC heartbeat indicator and comm status text.
6. Maintenance [maintenance] — cycle counters, run hours, service interval (numeric), resettable counters with reset buttons (level "maintenance"), and a "datetime".
Add further screens only if the machine really needs them: Recipes when the spec mentions products / recipes (a recipe number entry DS, the recipe's values as numeric-entry fields, Load and Save buttons as C bits), Homing / Axis for servo axes (home, jog, position status), and one status panel per safety zone when the machine has several (zone OK / tripped / reset needed).

EVERY SCREEN has, at identical positions:
- A "header" at x=0 y=0 w=${W} h=${b.header.h}: label = the machine name (short, e.g. "Conveyor Cell"); address = the mode status bit or mode register with "states" for its values (e.g. 0 "Auto" normal, 1 "Manual" warning); targetScreenId = "alarms". The app draws the screen name, mode pill, alarm counter and date/time inside it — do not add separate title texts or clocks in the header band.
- A bottom navigation bar of "nav" buttons, one per screen, y=${b.nav.y + 4} h=${b.nav.h - 8}, each w=${navW} with ${GAP} px gaps starting at x=${GAP} (for ${navCount} screens; recompute evenly for another count). Same order on every screen. Short labels: Main, Manual, Setup, Alarms, Diagnostics (or "I/O"), Maintenance (or "Service").
- Content area between them: x ${b.content.x}..${b.content.x + b.content.w}, y ${b.content.y}..${b.content.y + b.content.h}.

ELEMENT KINDS
- header, nav, button (action momentary | set | reset | toggle), indicator (bit lamp; onText/offText), multistate (address + "states": [{value, text, style}] for every value the PLC writes), numeric (display; units), numeric-entry (setpoint; units, min, max), bar (register vs min/max), trend (register over time; min/max = scale; units), machine (schematic; "symbols" with kind conveyor|motor|cylinder|sensor|valve|pump|tank|light|part|station, a short label, a bit address ("" if none), and x/y/w/h RELATIVE to the machine element's top-left; leave 16 px under each symbol for its label and 24 px at the top for the title; a cylinder taller than wide is drawn vertically with its rod extending down and its label to the right), alarm-list (no address; uses "alarms"), alarm-banner (no address), datetime (no address), panel (titled group frame drawn behind the elements fully inside it; label = group title; leave 26 px at the top of a panel for its title), text (label; h ≥ 32 = heading, h < 24 = small caption; use style warning for a caution note).
- Unused fields: address/action/targetScreenId/onText/offText/units/min/max/note null, "states" [], "symbols" [], "interlock" "", level "operator".
- "level": access level needed to operate the element (operator = no password, maintenance, engineer); shown as a lock icon. Screen "level" likewise.

LAYOUT RULES (the app validates and reports violations)
- Native pixels: 0 ≤ x, x+w ≤ ${W}; 0 ≤ y, y+h ≤ ${H}. No overlapping elements except elements fully inside a "panel" or "machine". Keep ${GAP} px gaps; align on an 8 px grid with consistent column widths and row heights.
- Touch targets (button, nav, numeric-entry) at least ${MIN_TOUCH.w}x${MIN_TOUCH.h} px (prefer ${Math.max(64, MIN_TOUCH.h + 8)} px tall for main actions); indicators/numerics at least 36 px tall.
- Labels: short (1–3 words), Title Case, shown in capitals by the app — never full sentences on buttons. Keep text proportional to the box (about 9 px of width per character at 14 px font).
- Style: near-black background, generous spacing, few large elements; colour only for meaning (ok green = running/healthy, warning amber, alarm red; "normal" for everything else). Stop/reset-type danger buttons may use style "alarm".
- Hierarchy: Level 1 overview (Main) → Level 2 control (Manual) → Level 3 detail (Setup, Diagnostics, Maintenance). Navigation buttons never mixed with machine command buttons.

PLC ADDRESSING (the PLC program will be written to match these tags exactly)
- HMI commands (buttons, mode selector, counter resets) write C bits C1001–C1100 (never X inputs or Y outputs directly).
- Setpoints entered on the HMI are DS1001–DS1100. Analog setpoints and alarm limits (level, temperature, pressure, speed) are DF101–DF200 (floating point, same units as the analog value).
- Analog values (I/O points marked ANALOG, DF registers in engineering units): show each on the Main or a Process screen as a "numeric" with its units (and min/max), plus a "trend" for the important ones; analog outputs (valve %, VFD speed Hz) as a "numeric" too, and in Manual mode as a "numeric-entry" the PLC copies to the output only in Manual. Put the high / low alarm limits on the Setup screen as "numeric-entry" fields with units and min/max.
- PLC-computed status words for display (machine state / sequence step for multistate, rates, run hours) are DS1101–DS1200; counters may be shown from CTD, timers from TD.
- Alarm bits the PLC sets: C1101–C1200 (one per alarm, also listed in "alarms"). Status bits the PLC sets for display (mode active, permissives/interlocks, heartbeat, service due): C1201–C1300. Indicators may also read X/Y directly.
- Every element that reads or writes the PLC has an address (interlock bits and machine symbol bits too). Every address used except X/Y appears once in "tags" with a clear name and a description of exactly what the PLC must do (e.g. "PLC sets ON when manual mode is active and safety is OK"). Physical X/Y may be listed too.
- "alarms": one entry per alarm bit with a clear operator message (what happened + where), severity alarm (stops the machine) or warning.

${guidelines ? `Guidelines:\n${guidelines}\n` : ''}${comms ? `PLC communication notes:\n${comms}\n` : ''}
"machineName": short machine name for the header. "notes": what the engineer must confirm (passwords per level, recipe needs, missing information). "explanation": a short summary of the screens for the customer.`;
}

type RawElement = Omit<HmiElement, 'level' | 'interlock' | 'states' | 'symbols'> & {
  level: HmiElement['level']; interlock: string; states: NonNullable<HmiElement['states']>;
  symbols: (Omit<NonNullable<HmiElement['symbols']>[number], 'address'> & { address: string })[];
};
type RawScreen = Omit<HmiScreen, 'elements' | 'level'> & { level: HmiScreen['level']; elements: RawElement[] };

/** Turn the schema's "unused" placeholders back into optional fields. */
function normalizeElement(e: RawElement): HmiElement {
  const { level, interlock, states, symbols, ...rest } = e;
  const out: HmiElement = { ...rest };
  if (level && level !== 'operator') out.level = level;
  if (interlock && interlock.trim()) out.interlock = interlock.trim().toUpperCase();
  if (states?.length) out.states = states;
  if (symbols?.length) out.symbols = symbols.map((s) => ({ ...s, address: s.address.trim() ? s.address.trim().toUpperCase() : null }));
  if (out.address) out.address = out.address.trim().toUpperCase();
  return out;
}

export async function generateHmiDesign(opts: {
  apiKey: string; model: string; effort: Effort;
  hmi: HmiModel; guidelines: string; comms: string;
  spec: SpecSections; io: IOPoint[]; addresses: Map<string, string>;
  profile: PlcProfile; cpu: CpuModel;
}): Promise<{ design: HmiDesign; explanation: string; reasoning: string | null }> {
  const io = opts.io.map((p) => `${opts.addresses.get(p.id) || '(unassigned)'}\t${p.type}\t${p.description}${p.signal === 'analog' && p.analog ? `\tANALOG ${p.analog.min}–${p.analog.max} ${p.analog.units}` : ''}`).join('\n') || '(none)';
  const content = `PLC: ${opts.profile.vendor} ${opts.profile.name} ${opts.cpu.id}

Machine specification:
${specToText(opts.spec) || '(empty)'}

Physical I/O (address, type, description):
${io}

${opts.profile.id === 'click' ? 'CLICK I/O module grouping for the Diagnostics screen: X001–X0xx / Y001–Y0xx are the CPU\'s built-in points, X1xx/Y1xx slot 1, X2xx/Y2xx slot 2, and so on.\n\n' : ''}Design the complete HMI screen set.`;
  const { text, reasoning } = await callClaude({
    apiKey: opts.apiKey, model: opts.model, effort: opts.effort,
    system: system(opts.hmi, opts.guidelines, opts.comms), messages: [{ role: 'user', content }], schema: SCHEMA,
  });
  let parsed: Omit<HmiDesign, 'hmiPartNumber' | 'generatedAt' | 'screens'> & { explanation: string; machineName: string; screens: RawScreen[] };
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error('The AI returned an HMI design the app could not read. Please try again.', { cause: err });
  }
  const screens: HmiScreen[] = parsed.screens.map((sc) => {
    const { level, elements, ...rest } = sc;
    return { ...rest, ...(level && level !== 'operator' ? { level } : {}), elements: elements.map(normalizeElement) };
  });
  const draft: HmiDesign = {
    hmiPartNumber: opts.hmi.partNumber, machineName: parsed.machineName || undefined, screens,
    alarms: parsed.alarms, tags: parsed.tags, notes: parsed.notes, generatedAt: new Date().toISOString(),
  };
  // Validate and repair the layout; report what was changed or is still wrong.
  const { design, notes: fixes } = fixDesignLayout(draft, opts.hmi.widthPx, opts.hmi.heightPx);
  const remaining = checkDesign(design, opts.hmi.widthPx, opts.hmi.heightPx).filter((i) => i.severity === 'error' || !i.elementId);
  const layoutNotes = [...fixes, ...remaining.map((i) => `Layout check: ${i.message}`)].slice(0, 20);
  return {
    design: { ...design, notes: [...design.notes, ...layoutNotes] },
    explanation: parsed.explanation,
    reasoning,
  };
}
