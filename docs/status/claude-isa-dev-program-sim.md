# Dev 2 — program & simulation (`claude/isa-dev-program-sim`)

Draft PR #5 → `claude/optimistic-maxwell-6nfcs6`. No blockers.

## Task list (restated, in priority order)

- [x] **A. Move all PLC code into `src/plc/`** as one standalone refactor commit (moves + import updates, no behaviour change) — `9235833`.
  Layout: `core/` (model, checker, profiles, usePlc), `ai/` (ladderAI), `sim/` (engine, controller, simulator UI, tests), `ui/ladder/`, `ui/program/`, `pages/` (Program, PLC setup, Simulate, Print); `src/plc/README.md` describes it. `common.tsx` (Spinner, ReasoningPanel) is generic and went to `src/components/common.tsx`.
- [x] **B. Example LADDER implements every tag of the six-screen HMI** with zero checker errors — `4619c07`.
  7 blocks (Safety & modes, Alarms, Conveyor, Pusher, Manual, Outputs, HMI & status), 40 rungs, first-scan defaults, Manual select refused while running, C1204/C1205 permissives + hold-to-run, one OUT coil per output, C1101–C1103 alarms, heartbeat C1203 from SC7, CT2 pusher cycles, DS1001 timeout as T1 preset, DS1002 batch target, DS1003 service interval, DS1101 state word (5>3>4>2>1>0), DS1102 run hours, DS1103 parts/min (six 10 s buckets), DS1104 hours since service; nickname for every address.
- [x] **C. Simulator support + unit tests + live-HMI browser check** — `4619c07`.
  Already present: SC1/SC2/SC7, register presets, counters, MATH/COPY. Added: retentive DS/DD/DH/DF + counters through Reset ("Clear memory" = cold reset), HMI momentary press held ≥ 1 scan, Skip +1 min/+10 min/+1 h.
- [x] **D. Ladder AI instructions for the standard HMI tags** — `dfcb1b2`.
  Explicit rules per tag kind (commands, mode select, permissives/hold-to-run, setpoints + first-scan defaults, state word, heartbeat, counters, run hours, service interval, rates, batch, alarms) + facts taken from the HMI screens (state tables, setpoint limits, interlocked buttons, toggles).
- [x] **E. Program page: block tree, cross-reference panel, print view** — `637bb18`, `c4a4270`.
- [x] **F. (backlog, user) Multi-vendor design** — `docs/architecture/multi-vendor.md` (design only, vendor-tool claims needing hands-on confirmation marked *verify*): profiles for Siemens / Allen-Bradley / Schneider / Yaskawa / CLICK, vendor-neutral program model, multi-vendor catalogs, chooser/electrical AI across vendors, migration steps. Design only.

## How it was verified
- `npx tsc -b`, `npx eslint src` clean after every commit.
- Unit tests `npx tsx src/plc/sim/engine.test.ts`: 34 pass. New ones cover retentive memory, custom retentive ranges, DS timer presets changed live, SC7 heartbeat, short HMI presses, cross reference, and the example program: checker 0 issues; every HMI tag written/read by the PLC; Stopped→Running→Pushing; safety stop + pusher fault (state 5 / 3, alarms, reset); Manual mode and permissives; batch stop; parts/min, run hours, service due, retentive hours.
- E2E `node e2e/app.e2e.cjs` (BASE_URL=http://localhost:5202): passes, no page errors (also after the src/plc move).
- Chromium on the live HMI (preview example, `/#/simulate`): state STOPPED → RUNNING → PUSHING PART; Manual refused while running; Manual active → jog runs the motor only while permitted, extend blocked while jogging and vice versa, nothing moves with the E-stop pressed; "Safety circuit open (E-stop)" in the alarm list and "ALARMS 1" in the header; after Skip +1 h ×2: run hours 1, since service 1, ~1500 parts, rate 13/min.
- Program page in Chromium: tree shows 7 blocks with counts and status dots; cross reference for C1204 lists rung 18 (W OUT) and 20 (R NO); clicking a row jumps to the rung (switching block); print view → PDF of 16 pages, ladder flows across pages without overlap.

## Notes / questions for the manager
- One-line edit outside my files earlier: `data-rung-id` on each rung row in LadderView (now inside `src/plc/ui/ladder/`, so mine).
- The simulator event log is dominated by the heartbeat bits (C12/C1203 every second). Could filter one-scan pulse bits from the log if Debug 1 finds it noisy.
- Debug 2: the program listing PDF (`src/deliverables/programListingPdf.ts`, Dev 1) now gets 40 rungs / 7 blocks from the example — worth checking pagination.

## Follow-ups
- [x] Example HMI explanation text describes the six screens (Main, Manual, Setup, Alarms, Diagnostics, Maintenance); SEED_VERSION 9. Verified: tsc, eslint, 34 unit tests, E2E green.
- [x] Example safety reset (bug from Debug 2): blue Safety Reset PB3 (GCX1104, door, legend "SAFETY RESET") wired SR1 S33 → PB3 13-14 → K1 21-22 → S34; spec safety/operator texts, design notes and the Safety OK / fault-reset rung comments updated (fault reset only with Safety OK; no auto restart — Start edge needed); SEED_VERSION 10. Not a PLC input (hardwired to the relay), so I/O and the HMI constant are unchanged. Electrical AI prompt now requires a dedicated blue reset pushbutton for every manual/monitored-reset safety relay. Verified: `tools/check-all.sh us480` → DXF/STEP/PDF/XLSX/consistency 0 FAIL 0 WARN; no "PB?" in any PDF; PB3 in BOM, door drilling, labels (device + legend), STEP and drawing sheet 6; tsc, eslint, 34 unit tests, E2E green.
