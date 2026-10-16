# Debug 2 — deliverables QA (`claude/isa-debug-outputs`)

PR: #7 (draft → `claude/optimistic-maxwell-6nfcs6`). Last integration merge: 1795268 (src/plc refactor).

## Tasks (my own words)
- [x] Repeatable checkers in `tools/` (`tools/check-all.sh`, README): generate every output through the real app for 4 projects — `us480` (example), `ca600` (Canada 600 V, Class CC fuses, fused CPT, rev B), `us120` (120 V 1-ph, small enclosure, no HMI), `big` (4 VFDs, 54 I/O, modules, 10" HMI, JBs).
- [x] DXF: units header, outline = catalog size 1:1, holes inside / edge distance, no duplicates or overlaps, Ø22.5, HMI cutout = catalog, cut-only layers, coordinates = hole tables, ZIP copy identical.
- [x] STEP via OCP: loads, solids valid, names/colours, enclosure shell = catalog, door bodies on DXF cutout centres.
- [x] PDFs: page sizes, page x of y, TOC page numbers, no undefined/NaN; 60 dpi render of every page and visual pass (example + big).
- [x] Excel: headers, no bad text, numbers stored as numbers.
- [x] Cross-consistency: part numbers/qty, wires, terminals, I/O addresses, alarms, revision letter, labels; FLA vs NEC tables; 24 VDC and heat sums.
- [x] Machining in **inches by default** with dual dimensions `inch [mm]` (DXF text, Machining tab table, drilling / door-cutout sheets); verify inch and mm DXF geometry identical (×25.4) and = sheets. Verified: `check_dxf.py` compares every entity of inch vs mm files (×25.4, 0.005 mm) and every hole-table row parsed from the drawings PDF (31/31 us480, 64/64 big) against the plan in both inch and mm; sheets 11/12 inspected at 90–150 dpi; E2E downloads an inch cut-only DXF.
- [ ] STEP SolidWorks readiness: AP214 schema, mm units, assembly structure (NAUO), names/colours, instanced parts, invalid/zero faces, file size, opens as assembly in OCP.
- [ ] Re-run all checkers on the final drawing set (25 sheets) and detailed STEP (a310537).
- [ ] Cross-check generated files of `claude/isa-dev-labels-print` and `claude/isa-dev-program-sim` every ~45 min (section "Review of …").

## Verification so far
`npx tsc -b`, `npx eslint src`, unit tests, `node e2e/app.e2e.cjs` (BASE_URL=http://localhost:5204) pass; `tools/check-all.sh` → DXF 0 FAIL, STEP 0 FAIL, PDF 0 FAIL, XLSX 0 FAIL, consistency 0 FAIL (6 WARN = unassigned reset button `PB?`, see I-11).

## Issues
| id | output | evidence | severity | owner | status | fix commit |
|---|---|---|---|---|---|---|
| I-01 | Door DXF + DOOR CUTOUTS sheet | handle cutout at (encW−70, 45 %) while DS1 sat top-left: hole ~300 mm from the shaft; STEP/pictures used the shaft axis | high | Debug 2 (derive) | fixed: handle on the disconnect centre, disconnect right end of its rail, colliding door devices slide | 2ae2fda, 6c46216 |
| I-02 | Door DXF | direct-mount stack light STK1 drilled as Ø22.5 door operator | medium | Debug 2 | fixed: listed as enclosure-top mounted + door-sheet note | 2ae2fda |
| I-03 | Design review | PLC capacity ignored module quantity (2×16-pt counted 16) | low | Debug 2 | fixed | 2ae2fda |
| I-04 | bom.csv, drawing BOM | project HMI missing (Excel/package added it separately) | high | Debug 2 | fixed in billOfMaterials | 072ade8 |
| I-05 | Package/Excel calcs | fused motor branch showed holder 30 A instead of fuse 5 A; no 430.52 max | medium | Debug 2 | fixed + NEC 430.52 / CEC 28-200 check | 072ade8 |
| I-06 | Heat calc | door HMI heat (14–24 W) ignored; failed calcs not in design review | medium | Debug 2 | fixed | 072ade8 |
| I-07 | Design review | false "PS1 no primary protection" behind a CT-…-1 fused transformer | low | Debug 2 | fixed | 072ade8 |
| I-08 | Excel | qty / rung columns stored as text | low | Debug 2 | fixed | 5a6ceaf |
| I-09 | Wire list vs sheet 6 | "RESET:13" vs "PB?:13" | low | Debug 2 | fixed (both PB?) | 5a6ceaf |
| I-10 | Drawings (big, door detail) | legend "AUTO/MANUAL" squeezed into overlapping glyphs outside the plate. Root cause: `Txt` (drawings/symbols.tsx:28) squeezes with `textLength` + `lengthAdjust="spacingAndGlyphs"`; svg2pdf only tightens spacing, so glyphs overlap. Every `maxW` overflow in the PDF set is affected; shrink the font size instead | medium | coordinator | reported | — |
| I-11 | Example design | SR1 monitored manual reset (S33–S34) but no reset PB → cannot reset; sheet shows PB? | high | Dev 2 (sampleProject) | reported | — |
| I-12 | Example program | HMI alarm bits C1102/C1103 and many HMI tags not driven by the ladder ("Not found in the program") | medium | Dev 2 | reported | — |
| I-13 | Layout (big) | SR1, relays, TB1 "do not fit" while PLC rail ~60 % empty (rows share rails only as a whole group) | medium | Debug 2 / coordinator decision | open (proposal) | — |
| I-15 | Door cutout sheet | longer dual HMI label overflowed into the handle mark; G-label on the HMI edge | low | Debug 2 | fixed (two-line label, size fits cutout; handle label right of mark) | (this batch) |
| I-14 | STEP | shaft named after handle "DS1H — 14831111 (2)" | low | coordinator | fixed upstream | — |

## Plan
1. Inches by default + dual dimensions (dxf.ts, MachiningPanel.tsx, drilling/door-cutout sheets), checker for inch≡mm geometry.
2. STEP SolidWorks checks on a310537.
3. Re-run everything on the integration head; review the dev branches.
