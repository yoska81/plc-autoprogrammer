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
