# AI quality changelog

Each prompt / check change made for real-machine quality, with the reason. Scores are from
`tools/ai-quality/run.ts`; "not measured" means no recorded real-AI run exists yet (no API key in
the environment where the change was made).

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
