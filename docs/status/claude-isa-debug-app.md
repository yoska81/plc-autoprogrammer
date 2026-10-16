# Debug 1 — app & workflow QA (`claude/isa-debug-app`)

PRs: #3 (merged), #12 (merged: Windows installer), next PR (draft → `claude/optimistic-maxwell-6nfcs6`). Dev server / test port: 5203.

## Tasks (my own words)
- [x] **TOP PRIORITY — Windows program with an installer** (details below). Windows CI on PR #12 is green: run 38944010761 on windows-latest (lint, unit tests, `npm run dist:win`) uploaded the artifact `ISA-Auto-Programmer-Setup` (112.8 MB).
- [x] Plain-English generation errors (manager queue #1): f0aa0b1.
- [x] Project switching while the AI works + Delete project (manager queue #3): f0aa0b1, beddcd4.
- [x] Fix the E2E for the redesigned HMI page and the live HMI in the simulator, then extend it to every user flow listed by the manager.
- [x] Test the claude.ai preview build with a fake `window.claude` (AI without a key, prompt shape and size, error wording, how files are saved).
- [x] Click through every page at 1366×768 and 1920×1080. Look for errors, clipping, unreadable text (nothing light on lime), empty states, buttons that do nothing, and data leaking between projects. Check that older saved projects still open.
- [x] Keep tsc, eslint, unit tests and the E2E green. Small commits.
- [x] E2E for the preview example update (manager): own project stays open and intact, example separate, backup reopens. Old-data `HASH=1` covers it for 4 older versions. Found and fixed duplicate "Conveyor Cell (example)" names (95dbe29).
- [x] ISA icon everywhere: `build/icon.svg` (graphite tile, lime "ISA") is now also the web favicon. It is readable at 16 px. The Electron window and the installer already used it.
- [x] Cross-check the UI of `claude/isa-dev-labels-print` and `claude/isa-dev-program-sim` (round 1, see "Review of …" below). Repeat every ~45 min.

## Windows desktop app — decisions and evidence
- **Electron + electron-builder (NSIS x64, per user)**, not Tauri. Electron's Chromium is the same engine the app is tested on: the E2E, the PDF/canvas/SVG code and the HMI rendering behave identically. Tauri would use the system WebView2 and needs Rust tooling in CI. The cost is size: the installer is 113 MB.
- **App served from `app://isa`** (privileged standard scheme) instead of `file://`. It gives a fixed origin, so localStorage keeps projects, CORS works for api.anthropic.com, and BrowserRouter works with an index.html fallback. No HashRouter change was needed.
- **Security:** contextIsolation, sandbox, nodeIntegration off; the preload exposes only `isaDesktop`. Navigation outside app://isa opens in the browser.
- **Printing:** Electron's PDF viewer prints blank pages from a hidden window, so pdf.js draws each page as an image at its real size in mm (labels at 600 dpi, sheets at 200 dpi) on CSS @page boxes of that size. It is then printed with webContents.print: scale 100, no margins, `pageSize` = label size in microns when `uniformPageSize`. Mixed sizes use named @page rules.
- **Evidence:**
  - `xvfb-run -a node e2e/desktop.e2e.cjs` passes:
    - window title "ISA Auto Programmer" at `app://isa/spec`
    - bridge keys print/listPrinters/saveFile, no Node in the page
    - version 0.7.0 from package.json (status bar too)
    - project "Desktop Test Cell" still there after a restart
    - window-state.json written
    - saveFile writes through the (stubbed) Save dialog, and the Excel report button saves 20 KB with the notice "Saved: <path>"
    - Cancel reported
    - printing a 2-page 38×12 mm label PDF gives 38.1×12.0 mm pages (print-to-PDF rounds to whole points; the printer gets exact microns)
    - a Letter + Tabloid PDF gives 215.9×279.4 and 431.8×279.4 mm pages
    - the 300-dpi render of the printed label is crisp and unscaled
    - screenshots in e2e/out-desktop/
  - `npm run dist:win` on Linux with wine64 + wine32 builds `release/ISA-Auto-Programmer-Setup-0.7.0.exe` (113 MB). app.asar is 6 MB: only dist-desktop and electron/.
- **Not proven here:** running the Windows .exe itself. Under Wine it starts but draws no window (GPU/DirectComposition not available). Proof comes from the Windows CI job (`.github/workflows/windows-installer.yml`, which also runs on PRs into the integration branch) and from the user installing it. Real printers can't be tested here: no printers exist on this machine.
- **Later:** code signing (removes the SmartScreen warning) and auto-update (latest.yml is already produced). The web favicon is still Vite's default purple logo (brand item for the coordinator); the desktop app has its own ISA icon in build/icon.svg.

## Test suites (all in `e2e/`, all pass on this branch)
| Command (BASE_URL=http://localhost:5203) | What it proves |
|---|---|
| `node e2e/app.e2e.cjs` | Full workflow, with the AI mocked: wizard project data (company, job no., prefix, engineer, US/Canada, 600 V) → equipment chooser (weak CPUs greyed, bigger CPU applied) → revisions shown in the status bar → I/O filter → part picker → machining (inch, cut-only DXF) → labels → HMI → program blocks / rung numbers → simulator block-only and bypass banner → resizable panels (drag, reload, double-click) → Settings test connection (401/404/credit/OK) → update all → second project (no leaks, rename, delete, switch refused while the AI is busy, plain-English generation error) → deliverables. Fails on any page or console error. |
| `node e2e/preview.e2e.cjs` (against `dist-preview` served on 5203) | Preview build with a fake Claude runtime: no key needed. The 5 generation prompts carry the system text and a parseable JSON-schema instruction; the largest is the electrical prompt at 60 KiB, under the 256 KiB limit. not_granted, rate_limited, session_expired and unknown error codes read as plain English. .xlsx/.csv/.pdf are saved as-is and .dxf/.step zipped. A failed save shows a notice. No direct calls to the AI APIs. |
| `node e2e/sweep.e2e.cjs` (`HASH=1` for the preview) | 18 pages × 2 sizes × (empty, example project): no errors, no sideways scroll, no controls off-screen, no text below 3:1 contrast, no light text on lime. Screenshots go to `e2e/out-sweep/`. |
| `node e2e/old-data.e2e.cjs` | Storage left behind by 4 older versions (`e2e/old-data/*.json`). Each opens as the active project and when switched to; every page renders, and the Excel report, engineering package and ZIP build. |

## Bugs found
| id | where | problem | status | commit |
|---|---|---|---|---|
| A-01 | E2E | HMI step waited for the removed "HMI tags (n)" text; simulator step looked for START in `<aside>` | fixed | c159542 |
| A-02 | Project data | after withdrawing a revision the draft still offered the next letter (C instead of B); the draft carried over between projects; the duplicate check was case-sensitive | fixed | 586e01e |
| A-03 | Projects | switching or creating a project while an AI request ran wrote the AI answer into the other project. The wizard could also write its data into the still-open project | fixed: switching/creating refused while the AI is busy (`src/lib/ai/busy.ts`) | f0aa0b1 |
| A-04 | AI errors | generation errors showed raw API text (`Anthropic API error 400: {…credit balance…}`) | fixed: shared plain-English messages with the connection test | f0aa0b1 |
| A-05 | Preview saves | zipped .dxf/.step were stored uncompressed (STEP 3.2 MB) | fixed: DEFLATE (≈0.5–0.65 MB) | 2a202a2 |
| A-06 | File names | project names ending in punctuation gave `Name__report.xlsx` | fixed | 2a202a2 |
| A-07 | Simulator 1366 px | I/O column clipped behind the live HMI | fixed: body scrolls sideways; HMI pane starts narrower on small screens | a6097f5 |
| A-08 | Live logic | in a narrow column the coils were drawn over the contacts | fixed: the rung scrolls instead | a6097f5 |
| A-09 | Wizard | before the project existed, the summary showed the open project's description, CPU and HMI | fixed | 2a202a2 |
| A-10 | Theme | grey-400 hint text was 2.5–2.9:1 on white (hard to read) | fixed: gray/slate/steel-400 darkened to ≈3.5:1 in `tailwind.config.js` | a6097f5 |
| A-11 | Projects | no way to delete a project; the empty starting project piled up in the list | fixed: list with Open / Delete on Project data | beddcd4 |
| A-12 | Preview | `alert()` is blocked in the preview frame, so save failures, the AI-busy refusal and the duplicate-revision message were invisible | fixed: on-page notice (`components/Notice.tsx`) | 623c651 |
| A-13 | Electrical / Deliverables headers | with no CPU chosen they name the default CPU (C0-10DD1E-D) while the status bar says "PLC: —" | open, low (`usePlc` falls back to a default CPU; the ExportPage header is Dev 1's) | — |
| A-14 | Preview | "Print / PDF" on the Electrical page opens a new tab (`target=_blank`), which the preview frame may block | open, needs a check in the real preview (coordinator) | — |
| A-16 | Preview example update | viewers of older previews got two projects named "Conveyor Cell (example)" | fixed: their copy becomes "Conveyor Cell (your copy)" | 95dbe29 |
| A-17 | Design review badge, simulator force/bypass | white text on amber-500 (2.15:1) on every page | fixed: dark text on amber | see "Readable text on amber badges" |
| A-15 | Preview | the connection test asks for the `complex` model tier to get a one-word reply | open, cosmetic (`claudeAccount.ts`) | — |
| A-18 | I/O list, analog | an analog point on a PLC without analog channels just shows address "—"; only Design review says why | open, low (Dev 2: a hint in `AnalogCell` like "no analog channel — add C0-04AD-1 on Equipment") | — |
| A-20 | Program tree, simulator block chips | after the blue restyle the selected rung count was brand-800 on brand-600 (1.57:1) | fixed: brand-100 | 95e66ab |
| A-19 | HMI editor, bar graph | a bar bound to an analog DF register keeps 0–100 and no units instead of the point's scale (e.g. 0–150 psi) | open, low (fill min/max/units from the I/O point when the address is set) | — |

## Review of claude/isa-dev-labels-print (head 6c55e83, 2026-10-16 17:30)
- tsc/eslint clean. Their own `e2e/app.e2e.cjs` passes (labels incl. Brady i3300 page sizes, full package 72 pages / 9 bookmarks).
- My sweep (all pages incl. the Labels tab, 1366×768 and 1920×1080, empty and example project): 0 problems (no errors, no overflow, no text below 3:1, nothing light on lime).
- Old saved projects (4 versions), active and switched to: every page renders, and the Excel/engineering package/ZIP build.
- No UI bugs found.

## Review of claude/isa-dev-program-sim (head 09fa81e, 2026-10-16 17:30)
- tsc/eslint clean. Their own E2E passes (program blocks, simulation, full package).
- Sweep: 0 problems. Old-data: all pass.
- No UI bugs found. (Fixed earlier in my branch, now in src/plc/sim: at 1366 px the simulator clipped the I/O column and Live logic drew coils over contacts; see A-07/A-08.)

## Review round 2 (2026-10-16 18:30): labels-print ccd368c (purchasing), program-sim 31f4fe5
- Both heads are already merged into my branch. Web E2E, sweep (now with /review and the purchasing card on Deliverables) and old-data (15 pages) pass.
- Found A-17: the design-review badge used white text on amber (2.15:1) on every page. Fixed, together with the same pattern in the simulator force/bypass controls.

## Review round 3 (2026-10-16 evening): integration 90d950b/e21b015, program-sim 1f62935 (merge only), labels-print (nothing new)
- Integration merged into my branch. tsc, eslint, all 12 unit suites, web E2E, sweep, old-data (web and HASH=1 preview), hmi-editor E2E, Modbus test (14) and the desktop E2E (Online page on my bridge, Dev 1's `fake-modbus` log) pass.
- The sweep now has an analog pass (60421db): adds C0-04AD-1 / C0-04DA-1 to the example, makes an input and an output analog (4-20 mA, 0–150 psi / 0–60 Hz), then checks the ANALOG loop sheet, the simulator slider (max 150, takes a value) and an HMI bar graph bound to DF1. 0 problems.
- Found A-18 and A-19 (both low, see table).
- The Windows installer CI now runs every `src/**/*.test.ts`.
- Re-run after merging integration c633ca0 (blue restyle, coordinator's movable-picture fix 5c5c5f7): tsc, eslint, 12 unit suites, Modbus 14, web E2E, sweep (+ analog), old-data, hmi-editor, preview E2E, HASH=1 sweep and old-data all pass. Found and fixed A-20. My unpushed `local/movable-picture` (2408468) is superseded by 5c5c5f7 and will be dropped.

## Regions & standards (Europe / IEC, Israel, other IEC countries)
- e473ad1 — region model `src/standards/regions.ts` (+ tests): five regions; 400 V 3-ph + N / 230 V / 690 V 50 Hz supplies; IEC 60204-1 §13.2 colours, Table 6 mm² sizing, AWG↔mm², IEC 60947-4-1 Annex G motor currents, MCB curves, IEC 81346 letters, NEMA→IP. Wizard, Project data, Electrical page and the electrical AI prompt use it.
- 0b5a8bf — IEC drawings and documents: mm² and IEC colours in the model (wire list, cables), kW/Ie on motor sheets, 50 Hz nameplate with Icc and IP, IEC cover notes and colour legend, CE/UKCA or Israeli notes, IEC standards list and abbreviations, IEC clauses in calcs, protection table, FAT, safety, maintenance and the review prompt. A design made for another region's supply is flagged.
- e7d07b1 — per-project drawing options (default from the region): IEC 81346 designations (design + layout renamed in the drawing context), IEC 60617 symbols, A3 paper (ANSI B layout at 97.3 %, scales corrected).
- Verified: US and Canada outputs byte-identical (wire list, BOM, terminal plan, cable schedule, warnings, nameplate); sweep IEC pass (Europe, Israel) 0 problems; A3 PDF pages 420 × 297 mm; full package builds.
- Facts checked with sources (in regions.ts). Not confirmed: Israel's earthing system (TN-C-S/TN-S or TT by site — the app says to confirm) and which IEC 60204-1 edition SI 60204-1 adopts.
- Open: derived terminal strips keep TB1… under IEC designations; the AutomationDirect/Fuji catalog is North American (the AI is told to name IEC/CE-marked replacements); Debug 2 owns the IEC code-rule set (`review/codeRules/rules.ts` still treats IEC as US).
