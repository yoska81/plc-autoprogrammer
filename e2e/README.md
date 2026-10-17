# End-to-end test

Drives the whole app in Chromium with the AI mocked (answers come from `fixtures.json`):
wizard (project data, equipment chooser) → project data & revisions → I/O (filter) → electrical (part picker, machining DXF) → labels (label-printer PDF page size, sheet PDF, CSV, Excel) → HMI → program (blocks) → simulation (blocks, bypasses) → resizable panels → Settings connection test → spec change + update all → second project (no data leaks, AI-busy switch guard, delete) → deliverables (Excel, PDFs, full package PDF with bookmarks, ZIP with label files). Page or console errors fail the run.

```bash
npm run dev -- --port 5173 &          # app under test
node e2e/app.e2e.cjs                  # BASE_URL=http://localhost:5173 by default
```

Screenshots and downloaded files land in `e2e/out/` (git-ignored).
Playwright is loaded from the global install (`/opt/node22/lib/node_modules/playwright`, Chromium in `/opt/pw-browsers`).

Unit tests: `npx tsx src/plc/sim/engine.test.ts`, `npx tsx src/electrical/strength.test.ts`, `npx tsx src/electrical/step/cabinetStep.test.ts`, `npx tsx src/electrical/labels/layout.test.ts`, `npx tsx src/electrical/prices.test.ts`, `npx tsx src/review/codeRules/codeRules.test.ts`, `npx tsx src/review/codeRules/iec.test.ts`, `npx tsx src/components/questions/questions.test.ts`, `npx tsx src/electrical/layout/layout.test.ts`, `npx tsx src/electrical/catalog.test.ts`, `npx tsx src/electrical/vfdLine.test.ts`, `npx tsx src/online/online.test.ts`, `npx tsx src/hmi/editor.test.ts`, `npx tsx src/hmi/theme.test.ts`, `npx tsx src/plc/core/analog.test.ts`, `npx tsx src/electrical/analog.test.ts`, `npx tsx src/plc/core/profiles/logix.test.ts`, `npx tsx src/plc/core/profiles/micro800.test.ts`, `npx tsx src/plc/core/profiles/siemens.test.ts`, `npx tsx src/plc/core/tagNames.test.ts` and `npx tsx src/electrical/vfd.test.ts`.

## Preview build

Drives the single-file claude.ai preview build with a fake `window.claude` runtime (`use('sample')`, `use('downloads')`):
AI runs with no API key, prompts are well-formed (system text + JSON-schema instruction, under 256 KiB),
runtime error codes read as plain English, and `.pdf/.xlsx/.csv` save as-is while `.dxf/.step` save zipped.

```bash
VITE_PREVIEW=1 npx vite build --config vite.preview.config.ts
npx http-server dist-preview -p 5203 -s &
BASE_URL=http://localhost:5203 node e2e/preview.e2e.cjs     # saved files land in e2e/out-preview/
```

## AI jobs

```bash
BASE_URL=http://localhost:5204 node e2e/ai-jobs.e2e.cjs   # (on "AI full design") generation survives navigation (3 pages), kept result shown on return, 529 → retry, Cancel, final failure → Retry; Generate with the AI failing → the rules design the panel
```
Screenshots land in `e2e/out-ai-jobs/`.

## Machine layout

```bash
BASE_URL=http://localhost:5204 node e2e/layout.e2e.cjs   # scale, cabinet + motor + two valves, a tray, routed lengths, JB + manifold suggestions, CSV/BOM, reload, drawing sheet
```
Screenshots land in `e2e/out-layout/`.

## Improve design

```bash
BASE_URL=http://localhost:5204 node e2e/improve.e2e.cjs   # cost-down (accept, checks re-run), what-if compare + apply, panel library (save, export/import, add a section, new project from a panel), spare parts Excel/PDF here and on Deliverables
npx tsx src/electrical/improve/costDown.test.ts && npx tsx src/electrical/improve/library.test.ts && npx tsx src/electrical/improve/whatIf.test.ts && npx tsx src/electrical/improve/spares.test.ts
```
Screenshots land in `e2e/out-improve/`.

## Page sweep and old projects

```bash
BASE_URL=http://localhost:5203 node e2e/sweep.e2e.cjs      # every page, 1366x768 + 1920x1080, empty + example project; IEC regions; a copy of the example (leftover warnings)
BASE_URL=http://localhost:5203 node e2e/start-clean.e2e.cjs # a copy of the example: leftover warnings, "Start clean from my description" keeps the description + I/O
BASE_URL=http://localhost:5203 node e2e/persist.e2e.cjs    # what was typed/selected survives leaving a page, reloading and switching projects
BASE_URL=http://localhost:5203 node e2e/hmi-brands.e2e.cjs # Allen-Bradley + Siemens panels: equipment, HMI, simulator, tag list
BASE_URL=http://localhost:5203 node e2e/old-data.e2e.cjs   # projects saved by older versions (e2e/old-data/*.json) still open and export
HASH=1 BASE_URL=http://localhost:5203 node e2e/old-data.e2e.cjs   # preview build: a new example version never replaces the open project
```
The sweep fails on page/console errors, sideways scrolling, controls pushed off-screen, text below 3:1 contrast and light
text on lime. `old-data/<commit>.json` is the browser storage the example project of that commit left behind.

## Sourcing and Engineer review

```bash
BASE_URL=http://localhost:5203 node e2e/sourcing.e2e.cjs   # BOM sourcing, alternatives + Swap (impact, Undo), live check (web search mocked), Optimise, Engineer review (rules + AI with one-click fix), review package
npx tsx src/sourcing/sourcing.test.ts                      # sourcing data, equivalents, swap impact (mounting), optimise, live-check source verification
```

## HMI screens made by hand

```bash
BASE_URL=http://localhost:5203 node e2e/hmi-editor.e2e.cjs   # picture behind a screen, place/move/resize/undo, tags, AI recreate (mocked), simulator, PNG export
npx tsx src/hmi/editor.test.ts                               # editor model: move, resize, snap, align, distribute, duplicate, undo, tags
```

## Voice and hand edits

```bash
npx vite --port 5205 &
BASE_URL=http://localhost:5205 node e2e/voice-edit.e2e.cjs
```
Voice (speech services faked in the page, fake microphone): dictation with live words, Done / add vs replace / Cancel,
speaker buttons, hands-free answers (question read, answer heard, "yes" saves), Settings → Voice (language, Hebrew voice,
test voice), recording + OpenAI transcription (mocked: model and language checked), on-device model download failure
explained. Hand edits: order-list price / quantity / part number / description (marked "entered by you", in the total and
the CSV), machine spec text, label text, cable and wire notes (in the CSVs), I/O description and back to generated, review
note, HMI alarm text, rung comment; all kept after a reload, in the .isap file and after the electrical design is generated
again; a new project starts clean. Screenshots land in `e2e/out-voice-edit/`.

Unit tests: `npx tsx src/edits/edits.test.ts` (store, order list totals and files, labels, notes in CSVs, rung comments and
HMI alarm texts kept through regeneration) and `npx tsx src/voice/text.test.ts` (add / replace, engine choice, spoken
yes / no / skip / stop in several languages, Markdown read aloud, long texts split for speech).

## Desktop microphone permission

```bash
npm run build:desktop
xvfb-run -a node e2e/desktop-mic.e2e.cjs
```
The first press of a microphone asks with a native dialog (stubbed: Allow once / Always allow / Don't allow);
"Always" is remembered across a restart in `mic-permission.json` and reset in Settings → Voice; "Don't allow"
is explained in the mic popover (no address-bar advice); "Allow once" lasts until the app closes; camera
requests are refused. Unit test: `npx tsx src/voice/micAccess.test.ts`. The preview e2e checks that the
preview shows the mic as not available (it has no microphone) and makes no microphone request.
