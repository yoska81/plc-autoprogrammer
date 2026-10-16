# End-to-end test

Drives the whole app in Chromium with the AI mocked (answers come from `fixtures.json`):
wizard (project data, equipment chooser) → project data & revisions → I/O (filter) → electrical (part picker, machining DXF) → HMI → program (blocks) → simulation (blocks, bypasses) → resizable panels → Settings connection test → spec change + update all → second project (no data leaks, AI-busy switch guard) → deliverables (Excel, PDFs, ZIP). Page or console errors fail the run.

```bash
npm run dev -- --port 5173 &          # app under test
node e2e/app.e2e.cjs                  # BASE_URL=http://localhost:5173 by default
```

Screenshots and downloaded files land in `e2e/out/` (git-ignored).
Playwright is loaded from the global install (`/opt/node22/lib/node_modules/playwright`, Chromium in `/opt/pw-browsers`).

Unit tests: `npx tsx src/sim/engine.test.ts` and `npx tsx src/electrical/strength.test.ts`.

## Preview build

Drives the single-file claude.ai preview build with a fake `window.claude` runtime (`use('sample')`, `use('downloads')`):
AI runs with no API key, prompts are well-formed (system text + JSON-schema instruction, under 256 KiB),
runtime error codes read as plain English, and `.pdf/.xlsx/.csv` save as-is while `.dxf/.step` save zipped.

```bash
VITE_PREVIEW=1 npx vite build --config vite.preview.config.ts
npx http-server dist-preview -p 5203 -s &
BASE_URL=http://localhost:5203 node e2e/preview.e2e.cjs     # saved files land in e2e/out-preview/
```
