# AI quality changelog

Each prompt / check change made for real-machine quality, with the reason. Scores are from
`tools/ai-quality/run.ts`; "not measured" means no recorded real-AI run exists yet (no API key in
the environment where the change was made).

## 2026-10-17 — electrical design: rules first, AI second (Dev 2)
- **electrical**: Generate / Update all no longer ask the AI for the whole panel. The AI reads the spec
  into a small machine model (`src/lib/ai/machineModelAI.ts`: motors with power and start method,
  E-stops, guard doors, light curtains, zones, other machines, questions; no catalog, no part numbers)
  and the rule-based engine (`src/electrical/engine`) picks and sizes every part. Without a key, or
  when the AI fails, the engine reads the model from the I/O and motor lists itself. The old all-AI
  design stays as "AI full design (experimental)". Why: the full design sent the whole catalog
  (~68k chars, ~17k tokens) and its mistakes (missing aux blocks, wrong overloads, undersized panels)
  were the main electrical findings; the machine model prompt is ~5.6k chars (~1.4k tokens).
- Fixture recording `m0-example-conveyor/04-electrical.json` is now a machine-model answer
  (`record-from-e2e.ts`). m0 replay: electrical 70 (1 major, 6 minor) with the old path → 94
  (0 major, 2 minor) with the engine; total 93 → 97. Real-AI scores for m1–m6: not measured (no key).

## 2026-10-16 — first pass (static review against tools/machines m1–m6)

No real-AI recordings yet: these changes come from reviewing every prompt against what the six
machines need. Before/after scores: not measured (m0 fixture replay: 97 → 97, unaffected by prompts).

### Data-model gap found (not fixable by prompts)
- **Analog I/O is not representable**: the I/O model, CLICK addressing (X/Y), drawings and ladder are
  discrete only, while the equipment step already picks analog modules. m5 (level/temperature, steam
  valve) and m6 (VFD speed from the screen) cannot be designed correctly. Proposed as its own milestone.

### Checks (src/review/checks.ts → specCoverage)
- `spec-analog` (major) / `analog-on-discrete` (critical): analog signals in the spec; a transmitter or
  proportional valve given a discrete point. Why: the I/O prompt asked for a "discrete" list, so analog
  signals were either dropped silently or wired to 24 V inputs.
- `spec-guard` (major): light curtains / guard doors / mats in the spec but not in the safety circuit (m1, m2, m3, m4).
- `spec-motors` (major): more motor ratings (HP) in the spec than motors in the panel (m5 has four).
- `spec-vfd` (major): adjustable speed asked for but no drive in the panel (m6).
- `spec-servo` (major): servo motion with no axis I/O and no equipment caution — CLICK cannot close a servo loop (m2).

### Prompts
- **spec** (`specAI.ts`): write explicitly, one per line, every motor (HP, voltage, starter/VFD/servo),
  sensor, actuator, safety device and what it stops (per zone), analog signal with range, interface
  signals to other equipment, recipes, supply and country. Why: every later step reads only the spec;
  facts left in prose were lost (zones in m4, analog ranges in m5, handshakes in m4).
- **io** (`ioAI.ts`): guarding devices go to a safety relay (one PLC status input per zone); robot /
  other-machine handshakes one point per signal; VFD points (run, fault, preset speeds); servo drive
  handshake points; analog signals never on discrete points but asked as "Analog signal needed".
- **electrical** (`electricalAI.ts`): light curtains / mats / doors into safety relay channels, one relay
  per independent zone with its own reset and status; muting/robot zoning → recommend a safety controller;
  interposing relays for handshakes with other controllers; link the other machine's E-stop.
- **hmi** (`hmiAI.ts`): Recipes screen (recipe number, values, Load/Save), Homing/Axis screen for servo
  axes, one status panel per safety zone.
- **ladder** (`ladderAI.ts`): one safety-OK bit per zone gating only that zone; VFD run = request AND
  safety AND NOT fault, fault alarm; handshakes request → feedback with timeout; recipes in DS tables
  copied to working setpoints only while stopped; be explicit when analog logic is missing.

## Analog I/O and variable-speed drives (Dev 2)
- **ladder** (`ladderAI.ts`): analog points are DF registers already scaled to engineering units (CMP to
  read, COPY/MATH to write, setpoints DF101–DF200, alarms with deadband). VFDs as wired by
  `electrical/vfd.ts`: run = request AND Safety OK AND NOT latched fault; forward/reverse interlocked with a
  stop delay; fault latches an alarm reset only when the fault is gone; analog speed setpoint clamped and
  written only while running. Why: m5 (mixing tank) and m6 (VFD conveyor line) need both; the old rule told
  the AI it could not write a speed.
- **hmi** (`hmiAI.ts`): analog values as numeric / bar / trend; per drive a status display, fault alarm and a
  speed setpoint entry with limits. Why: same machines; the operator must see and set speed.
