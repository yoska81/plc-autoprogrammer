# HMI generation: rules first, AI second — PLAN

Status: **plan only** (nothing implemented). Author: Dev 2. Follows the electrical engine
(`src/electrical/engine`, PR #48), which takes the same approach.

## 1. Why

Today `src/lib/ai/hmiAI.ts` asks the AI for the whole operator panel in one answer: every screen,
every element with pixel x/y/w/h, every address, the state texts, the alarms and the tags.

- **Cost and time are in the answer, not the prompt.** The prompt is about 23k chars: 16.7k system
  rules, 3.2k schema, plus the spec and I/O. The answer is six screens with 100–200 positioned elements,
  so it is long, slow, and the step most likely to be cut off (`max_tokens`). It is also the reason
  for the preview's "continued when cut off" logic.
- **What goes wrong is mechanical.** Problems are overlaps, items off the screen, touch targets
  under 60×48, nav bars that differ between screens, Diagnostics lamps missing for some I/O points,
  and addresses the PLC program never writes. Half the system prompt exists to prevent these, and
  `hmi/layout.ts` `checkScreen` still finds them afterwards.
- **No HMI without the AI.** With no key, or when the AI fails, there is no HMI at all.
- **HMI and program agree only by convention.** The tag conventions (commands C1001…, permissives
  C1201…, state word DS1101…) live as prose in two prompts (hmiAI and ladderAI).

## 2. Target

Same split as the electrical engine:

```
spec + I/O list + electrical design + panel model + (program, if any)
        │
        ├── AI (small, optional): HMI content model — names, groupings, sequence steps,
        │     setpoints with units/limits, alarm texts, extra screens, questions. NO pixels, NO addresses.
        │     Fallback: defaultHmiContent() from the I/O list + electrical design (rules only).
        ▼
  src/hmi/engine/ (pure, deterministic, tested)
        tagPlan      → every HMI address (one source for HMI, ladder AI, checker, review)
        screens      → Main / Manual / Setup / Alarms / Diagnostics / Maintenance (+ Recipes, Axis, zones)
        layout       → grid/flow layout per panel resolution; checkScreen = 0 errors by construction
        ▼
  HmiDesign (unchanged data model) → editor, simulator, exports, review
```

The old all-AI path stays as **"AI full design (experimental)"**. "Recreate from a picture" stays AI,
because it is a vision task.

## 3. Pieces

### 3.1 `src/hmi/engine/tagPlan.ts` — one tag allocation (do this first)

A pure function `hmiTagPlan(io, electrical, content)` returns typed entries `{ role, address,
dataType, access, description }`:

| Role | Example | Notes |
|---|---|---|
| Commands | Start / Stop / Reset C1001… | momentary, HMI writes |
| Mode select | Auto/Manual C1010, mode word DS1100 | |
| Manual jog / extend / retract per actuator | C1101… | one per actuator direction |
| Permissives per manual action | C1201… | PLC writes; `interlock` on the button |
| State word | DS1101 + state table | Stopped / Running / steps / Faulted |
| Heartbeat | C1203 | |
| Counters, rates, run hours, service | DS1102–DS1104, CT | |
| Setpoints | DS1001… (timeouts, batch target, service interval) | |
| Drive speed setpoints | DF101… | analog setpoints DF101–DF200, as now |
| Alarms | C1101… | one bit per alarm with message and severity |

It reproduces the example's current addresses exactly (golden), so the hand-made example stays valid.

`ladderAI` and `hmiAI` get the plan as a **table of data** instead of prose rules. `review/checks.ts`
(HMI ↔ program) reads the same plan, so the HMI and the program agree by construction.

The CLICK neutral memory is unchanged. Vendor tag names come from `plcTagNames` at export.

### 3.2 HMI content model (the AI's job, small schema)

```ts
interface HmiContent {
  machineName: string;
  actuators: { name: string; kind: 'motor'|'drive'|'cylinder'|'valve'|'pump'|'heater';
               ioDescriptions: string[]; zone: string; manual: boolean }[];   // grouped from the I/O list
  sequence: { value: number; text: string; style: HmiStyle }[];             // state word texts
  setpoints: { name: string; units: string; min: number; max: number; default: number; level: AccessLevel }[];
  alarms: { name: string; message: string; severity: 'alarm'|'warning' }[];
  counters: { name: string }[];
  extraScreens: ('recipes'|'axis'|'zones')[];
  questions: string[];
}
```

- No coordinates, no addresses (the tag plan assigns them), no panel facts.
- Expected prompt: about 3–5k chars (spec + I/O descriptions + short rules). The answer is about
  1–2k chars, against roughly 30–60k today.
- **`defaultHmiContent()`** (rules, no AI) builds the same structure from the I/O list and the
  electrical engine's machine model:
  - actuators: motor outputs → motors and drives; solenoid pairs + extended/retracted sensors →
    cylinders (the same pairing `electrical/engine/devices.ts` uses for double-solenoid valves);
  - setpoints: a timeout per cylinder, a batch target, a service interval, a speed per drive, alarm
    limits per analog input;
  - alarms: safety open, overloads and drive faults, cylinder timeouts, analog high/low;
  - sequence: Stopped / Running / Faulted.
- `mergeHmiContent(ai, base)`: the user's existing HMI edits and the designer's choices win. This is
  the same rule as the motor list in the electrical engine.

### 3.3 `src/hmi/engine/screens.ts` + `layout.ts` — deterministic screens

- **Fixed bands** from `layoutBands(W, H)`: header and nav are identical on every screen, built once.
- **Layout primitive:** a small grid/flow layout (rows of cells, cell sizes from the panel class
  4.3" / 7" / 10" / 12–15"). Minimum touch size 60×48 and an 8 px gap are guaranteed, so overlaps
  and off-screen items cannot happen. When content does not fit, it moves to a continuation screen
  ("Manual 2/2", "Diagnostics 2/3"), never shrinks below the minimum.

| Screen | Content |
|---|---|
| Main | Machine schematic built from zones and actuators: conveyor symbols for motors (left to right by zone), cylinders with their sensors, tanks from analog level, lights. Plus state multistate, mode, key counters/rate, production trend, Start/Stop/Reset, alarm banner. |
| Manual | One row per actuator: label, hold-to-run buttons with `interlock` = its permissive bit, feedback lamps. |
| Setup | Panels of numeric-entry setpoints with units/min/max and access level. |
| Alarms | alarm-list, Reset, count. |
| Diagnostics | Fully deterministic: every X/Y point as a lamp, grouped per slot/module (as the AI prompt asks today), heartbeat, comms. Analog points as numeric/bar. |
| Maintenance | Counters, run hours, service interval and reset. |

Optional screens:
- Recipes, when the spec has products;
- Axis, for servo axes;
- one status panel per safety zone.

Looks (`siemens` / `dark`) are unchanged: the look is a theme over the same elements.

### 3.4 Integration

- `generateRuleBasedHmi()` mirrors `generateRuleBasedDesign()`: content AI (optional) → engine → `HmiDesign`.
  An AI failure gives a rules design plus a note.
- HMI page "Generate", "Update all" (`spec/updateAll.ts` hmi step) and Retarget to another panel use it.
  Retarget becomes a re-layout of the same content instead of scaling coordinates.
- **The ladder uses the plan.** `ladderAI` is given the tag plan rows. The review check "HMI tag written/read
  by the PLC" stays the referee.

## 4. Tests (same pattern as the electrical engine)

- **Goldens** (`src/hmi/engine/__fixtures__`):
  - example (must reproduce the example's tag addresses and screen set);
  - big (55 I/O → Diagnostics continuation screens);
  - analog (bars/trends);
  - vfd (speed setpoints, drive status);
  - Allen-Bradley and Siemens panels (other resolutions);
  - 4.3" and 15" panels.
- **Every screen:** `checkScreen` = 0 errors and 0 touch warnings; nav identical on every screen; every
  nav target exists.
- **Diagnostics:** shows every discrete and analog point.
- **Example ladder:** `review` HMI ↔ program checks give no new findings against the example ladder.
- **AI stubbed to fail:** a rules HMI plus a note. With no key, no AI call.
- **Recorded content model:** merged correctly.
- **Size:** prompt and answer size before vs after, measured with the interceptor as in
  `machineModelAI.test.ts`.
- **Harness and e2e:**
  - harness variants `rules-hmi`, `rules-hmi-big`; HMI deliverables (C-more project, screen PDFs,
    tag CSV) through `tools/check-all.sh` at 0 FAIL;
  - e2e app / ai-jobs / preview updated as done for electrical.

## 5. Steps (each one a reviewable PR)

1. **tagPlan** + example golden; ladderAI / hmiAI / review read it (no visible change).
2. **Layout primitive** + Diagnostics and Maintenance screens (fully deterministic, no AI needed).
3. **Manual / Setup / Alarms** from `defaultHmiContent()`.
4. **Main schematic** from zones/actuators (hardest to make look good; compare with the hand-made example).
5. **Content AI** (small schema), merge, fallback, wiring into the HMI page / Update all / Retarget.
   Old path → "AI full design (experimental)".
6. Goldens for all machines, harness variants, e2e, prompt/answer-size report, docs.

Steps 1–3 already give an HMI without any AI. Each step leaves the app working.

## 6. Risks / open questions for the coordinator

- **Main-screen quality.** A rules-built schematic will be plainer than the hand-made example.
  Proposal: rules layout, with the AI allowed to suggest symbol order/labels only (still no pixels).
- **Edited HMIs.** User edits made in the HMI editor: regeneration must keep hand-placed elements
  (match by tag role) or ask first. Today's "Replace?" confirm stays.
- **C-more export** depends on today's element model only. No change is expected, but it should be checked
  with Debug 1 (owns the generic-panel HMI) because #46 just added other makers' panels.
- **Coordination.** Ladder generation must follow the tag plan. That is the ladder AI prompt (mine) plus
  the review checks (mine). Dev 1 / Debug 1 should confirm nothing else hard-codes HMI addresses.
- **Order.** Do steps 1–2 now, or wait until PR #48 (electrical engine) is merged?
