# End-to-end test

Drives the whole app in Chromium with the AI mocked (answers come from `fixtures.json`):
wizard → equipment → I/O → electrical → labels (label-printer PDF page size, sheet PDF, CSV, Excel) → HMI → program → simulation → spec change + update all → deliverables (Excel, PDFs, full package PDF with bookmarks, ZIP with label files).

```bash
npm run dev -- --port 5173 &          # app under test
node e2e/app.e2e.cjs                  # BASE_URL=http://localhost:5173 by default
```

Screenshots and downloaded files land in `e2e/out/` (git-ignored).
Playwright is loaded from the global install (`/opt/node22/lib/node_modules/playwright`, Chromium in `/opt/pw-browsers`).

Unit tests: `npx tsx src/sim/engine.test.ts`, `npx tsx src/electrical/strength.test.ts`, `npx tsx src/electrical/step/cabinetStep.test.ts` and `npx tsx src/electrical/labels/layout.test.ts`.
