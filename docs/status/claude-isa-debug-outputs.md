# Debug 2 — deliverables QA (`claude/isa-debug-outputs`)

PR #7 merged (batches 1–2). Branch restarted from integration d78b221. Last integration merge: 1795268 (src/plc refactor).

## Tasks (my own words)
- [x] Repeatable checkers in `tools/` (`tools/check-all.sh`, README): generate every output through the real app for 4 projects — `us480` (example), `ca600` (Canada 600 V, Class CC fuses, fused CPT, rev B), `us120` (120 V 1-ph, small enclosure, no HMI), `big` (4 VFDs, 54 I/O, modules, 10" HMI, JBs).
- [x] DXF: units header, outline = catalog size 1:1, holes inside / edge distance, no duplicates or overlaps, Ø22.5, HMI cutout = catalog, cut-only layers, coordinates = hole tables, ZIP copy identical.
- [x] STEP via OCP: loads, solids valid, names/colours, enclosure shell = catalog, door bodies on DXF cutout centres.
- [x] PDFs: page sizes, page x of y, TOC page numbers, no undefined/NaN; 60 dpi render of every page and visual pass (example + big).
- [x] Excel: headers, no bad text, numbers stored as numbers.
- [x] Cross-consistency: part numbers/qty, wires, terminals, I/O addresses, alarms, revision letter, labels; FLA vs NEC tables; 24 VDC and heat sums.
- [x] Machining in **inches by default** with dual dimensions `inch [mm]` (DXF text, Machining tab table, drilling / door-cutout sheets); verify inch and mm DXF geometry identical (×25.4) and = sheets. Verified: `check_dxf.py` compares every entity of inch vs mm files (×25.4, 0.005 mm) and every hole-table row parsed from the drawings PDF (31/31 us480, 64/64 big) against the plan in both inch and mm; sheets 11/12 inspected at 90–150 dpi; E2E downloads an inch cut-only DXF.
- [x] STEP SolidWorks readiness (detailed model a310537): AP214 `AUTOMOTIVE_DESIGN`, `SI_UNIT(.MILLI.,.METRE.)`, assembly tree (40–61 products, 31–121 NAUO; root opens as an assembly in OCP/XCAF), every solid valid (BRepCheck) with positive volume, no zero-area faces / edges below 2× tolerance, colours as STYLED_ITEM inside MECHANICAL_DESIGN_GEOMETRIC_PRESENTATION_REPRESENTATION (SolidWorks reads these), terminals instanced (57 occurrences of one DN-T10-A part in `big`), product names valid as Windows file names, 1.0–5.3 MB. Checker: `tools/check_step.py`. Only remarks: I-16, I-17.
- [x] Re-run all checkers on the integration head (1795268: final drawing set, detailed STEP a310537, labels, full package): all 0 FAIL.
- [~] Cross-check generated files of `claude/isa-dev-labels-print` and `claude/isa-dev-program-sim` every ~45 min (section "Review of …").

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
| I-10 (fixed by coordinator, verified p15) | Drawings (big, door detail) | legend "AUTO/MANUAL" squeezed into overlapping glyphs outside the plate. Root cause: `Txt` (drawings/symbols.tsx:28) squeezes with `textLength` + `lengthAdjust="spacingAndGlyphs"`; svg2pdf only tightens spacing, so glyphs overlap. Every `maxW` overflow in the PDF set is affected; shrink the font size instead | medium | coordinator | reported | — |
| I-11 | Example design | SR1 monitored manual reset (S33–S34) but no reset PB → cannot reset; sheet shows PB? | high | Dev 2 (sampleProject) | fixed on claude/isa-dev-program-sim 46dfc43 (verified: PB3 on S33/S33A, door cutout E3, warning gone) | 46dfc43 |
| I-12 | Example program | HMI alarm bits C1102/C1103 not driven by the ladder ("Not found in the program") | medium | Dev 2 | fixed on claude/isa-dev-program-sim (rungs 10–11 drive C1102/C1103) | — |
| I-13 | Layout (big) | SR1, relays, TB1 "do not fit" while PLC rail ~60 % empty (rows share rails only as a whole group) | medium | Debug 2 | fixed: compact packing when the normal pass overflows; big 21 placed / 6 not fit → 27 / 0 (same 4 rails); others unchanged; `tools/layout_summary.py` checks overlaps (parts, ducts, panel edge) | (batch 4) |
| I-15 | Door cutout sheet | longer dual HMI label overflowed into the handle mark; G-label on the HMI edge | low | Debug 2 | fixed (two-line label, size fits cutout; handle label right of mark) | (this batch) |
| I-16 | STEP header | FILE_NAME originating system / preprocessor = "PLC Autoprogrammer cabinet STEP export" (old brand) | low | coordinator | reported | — |
| I-17 | STEP names | product names use an em dash (`\\X2\\2014\\X0\\`): valid, but SolidWorks uses product names as part file names on Save As — an ASCII " - " is safer | low | coordinator | suggestion | — |
| I-18 | Wire list, sheet 6, BOM | EDM loop / reversing interlock wired to K1:21-22, but Fuji SC-E02(G)..E4(G) have no internal auxiliary contact (AD Fuji SC-E spec note 1); front block SZ-A11T is 53-54 / 61-62, side block SZ-AS1T 71-72 / 83-84 | high | Debug 2 | fixed: N.C. resolved per contactor, SZ-A11T added to BOM when missing, wires + sheet 6 show 61-62 | (batch 3) |
| I-19 | Safety reset | first pushbutton with 'reset' in its function was taken as the relay reset (big: PLC fault-reset PB3) | medium | Debug 2 | fixed: explicit 'safety reset' preferred | (batch 3) |
| I-14 | STEP | shaft named after handle "DS1H — 14831111 (2)" | low | coordinator | fixed upstream | — |

## Batch 3 verification
Integration d78b221 + batch 3: tsc, eslint, 4 unit tests, sim_example, e2e, check-all → DXF/STEP/PDF/XLSX/consistency 0 FAIL 0 WARN; I-10 AUTO/MANUAL fits its plate; no 'Not found in the program' in the package.

## Plan
1. Periodic review of the dev branches.
2. [x] 25 % spare space: `derive.spareSpace` + review finding (minor < 25 %, info otherwise). Example 30 %, ca600 36 %, big 12 % (warned), us120 0 % (overflow).
3. Review Dev 1 purchasing outputs (order CSV vs AutomationDirect format, prices vs pack sizes, purchase summary PDF) and the questions feature when they land.

## Review of claude/isa-dev-labels-print (c9f4f5c, 262d3ff)
How: worktree of the branch, dev server :5214, `tools/gen-outputs.cjs us480 big`, all checkers, plus a roll-layout harness (labelPrinterPdf with pageLayout 'roll' for B33-80-427 horizontal/vertical and THT-14-498-10), renders at 300–1200 dpi.
- OK: label-printer PDF page = label size exactly (38.0 x 12.0 mm default; 199 pages = sum of copies in the labels CSV, 865 in `big`); text fits with ~1.8 mm margin on the longest legends (EMERGENCY STOP, AUTO/MANUAL, RUNNING).
- OK: match-the-roll PDF: page = liner width x label height exactly (63.5 x 19.05 mm, 74.93 x 5.08 mm); labels at margin + k x (width + gap); 9 labels -> 3 rows; liner arithmetic of all 4 rolls adds up (margin + N x width + (N-1) x gap + margin = liner width, B33-5-422 within 0.01 mm). Unit test `labels/layout.test.ts` passes.
- OK: full package (us480, 86 pages): contents page counts sum to 86, every part starts on the page the contents and bookmarks give (engineering 3, drawings 48, HMI 67, listing 73, I/O 80, BOM 81, labels 83), 30 bookmarks incl. one per drawing sheet, no blank or duplicate pages.
- R-L1 (low): labels Excel stores **Copies** as text ('2'), not a number — label software that maps Copies to a quantity may ignore it. Repro: open labels/*_labels.xlsx, column Copies, cell type str.
- R-L2 (low): with "border" on, the first label of every page has a ~0.3 mm spike at the top-left corner of the rounded border (jsPDF roundedRect start point). Repro: labelPrinterPdf(labels, {...DEFAULT_SETUP, supply: 'THT-14-498-10', pageLayout: 'roll', border: true}), page 1/2 at 1200 dpi, top-left of label 1.
- Not this branch's (fixed on mine, pending merge): Excel qty/rung as text, BOM CSV without HMI, heat failure not in design review.

## Review of claude/isa-dev-program-sim (46dfc43)
How: worktree, dev server :5224, `gen-outputs.cjs us480`, checkers, `npx tsx src/plc/sim/engine.test.ts` (34 passed), and `tools/sim_example.ts` (example program vs the written sequence: start, part -> push + count, prox -> retract + restart, 3 s pusher timeout fault, HMI reset, safety drop with no auto restart, stop): all steps pass; DS1001 = 3 s on power-up.
- Verified fixes: I-11 (reset PB3), I-12 (C1102/C1103 driven).
- Consistency on this branch: 0 FAIL, 0 WARN (no more PB?).
- No new issues found in the generated files.

## Review of claude/isa-dev-labels-print — purchasing (ccd368c) and questions (ed94e39)
How: worktree at ed94e39 (harness from integration, dev server :5214), `gen-outputs.cjs us480 big`, purchasing files from the ZIP, AutomationDirect help page https://www.automationdirect.com/help/csvupload, live product pages, a pack-size script over `PRICES` x catalog.
- OK: order file `ItemCode,Qty` per line, no header, CRLF — exactly AutomationDirect's cart CSV upload format; quantities are in selling units (packs), as AutomationDirect sells pack items as one item.
- OK: all 58 price entries: selling unit = catalog packQty (each / pack of 2, 10, 50, 100), source URL ends in the part number; spot checks on the live site match (DN-T10-A $87.00 per 100-pack, GS23-45P0 $399.00, CM5-T7W $499.00).
- OK: every order line: order qty = ceil((need + spares) / pack); extended = unit x qty; CSV total = PDF total (us480 $3,895.25, big $10,381.25); "Needed" equals bom.csv for every part; unpriced parts shown as "price to confirm" and kept out of totals (SZ-A11T).
- R-P1 (medium): the ZIP's AutomationDirect order file includes the recommended spares by default (ZIP built with spares: true). For the example it orders 2 x PLC, HMI ($499), safety relay, power supply, contactor, overload, every pushbutton and sensor — a full spare set (~$1,200 extra on a $2,700 panel). Someone uploading "the order file" to the cart buys it all. Suggest: ZIP order file = BOM only (`_order_AutomationDirect.csv`) plus a separate `_spares_AutomationDirect.csv`, or name it `_with_spares`; the summary PDF already separates Need / Spares columns.
- R-P2 (low): big panel's "one-page" purchase summary (38 lines) puts only the price-basis note on a nearly empty page 2 (font step 5.3 pt starts at >34 lines but the notes don't fit).
- Questions (ed94e39): unit test passes; answers are appended as "- Q: … A: …" under "Answers to open questions" in the right spec section; only answered questions are merged (pending()), so no empty "A:" lines reach the spec / spec.md.

## Cross-check round 18:38 UTC (integration a38ce1e = both dev branches fully merged)
tsc, tools tsc, eslint, 7 unit tests (questions, labels layout, prices, cabinetStep, strength, sim engine 37, review 7), sim_example 11/11, e2e, check-all (layout, DXF, STEP, PDF, Excel, consistency on 4 variants): all pass, 0 FAIL / 0 WARN.
Still open from the previous review: R-P1 (ZIP order file built with spares: true, fullPackage.ts:265) and R-P2 (big purchase summary 2 pages).

## Electrical code compliance rules (src/review/codeRules) — milestone 1
- [x] 18 rules (rules.ts), region-aware clauses, plain-English message + fix, wired into runChecks; codeRules.test.ts 18/18 (pass + fail case each); Dev 2's review.test.ts 7/7.
- [x] Run on the 4 variants (data.json `codeRules`) and the ai-quality replay (only m0 has a recording; m1–m6 need ANTHROPIC_API_KEY to record).

| Variant | Findings |
|---|---|
| us480 | info mounting window 0.39–1.55 m; minor SCCR unknown PS1; minor nameplate SCCR not stated (SB 5 kA); minor no yellow E-stop background |
| ca600 | same, SCCR unknown T1 |
| us120 | same, mounting window 0.37–1.73 m |
| big | **major 18 AWG 24 VDC wiring on a 10 A supply (PSR-24-240-3) without DC protection**; SCCR unknown VFD1–4, PS1; nameplate SCCR; yellow background |

Design bugs found and fixed (derive.ts): I-20 control-transformer primary wires from a phantom device "1L"; I-21 PS1 fed twice from T1 (X1→PS1:L1 and PS1-L1 'T1:T1'→PS1:L); I-22 120 VAC control conductors black instead of red (NFPA 79 13.2.4.3, and our own sheet-1 legend).
Open, for others: drawing sheet 4 prints "NO PROTECTION" over T1 and PS1 although CT-…-1 has an integral primary + secondary fuse block (coordinator); AI design should add 24 VDC branch protection when a supply > 7 A feeds 18 AWG (electricalAI prompt — coordinator); no yellow E-stop legend plate in the catalog (catalog); SCCR ratings missing for PS / transformer / VFD parts (catalog); 'no reset' is reported by both designWarnings and safety-reset (dedupe if the score double-count matters).

## Machine layout (Electrical → Machine layout) — milestone 1
- [x] Page `/electrical?tab=layout` + tree entry: upload a picture or a PDF page (downscaled to 1600 px JPEG, stored per project) or work on a blank sheet; set the scale by two clicks + real distance (in / mm / ft / m); 1 m / 1 ft grid.
- [x] Place cabinet, air supply, junction boxes, field devices and motors of the design (click or drag from the list; drag to move); draw routes (cable tray, conduit, drag chain); delete / clear.
- [x] Routed cable lengths (src/electrical/layout/geometry.ts): orthogonal drop to the nearest route, shortest path over the route graph (crossing / touching routes connected), short hops point to point; + slack % + service loop each end (settable). The cable schedule, CSV, Excel, voltage drop table and engineering package use them; "BY SITE" stays only for unplaced ends (with a design warning).
- [x] Suggestions with Accept / Ignore (src/electrical/layout/suggest.ts): valve manifold (valves within a radius, tubing per cylinder, air supply length), JB placement, JB split / merge (applied to the design only after a confirm), remote I/O for far clusters, tray / conduit size per route, cabinet location. Accepted manifolds / remote I/O are BOM notes "part to be selected" — no invented part numbers.
- [x] Drawing sheet "MACHINE LAYOUT — CABLE ROUTES & LENGTHS" (sheets/MachineLayoutSheet.tsx + one line in plan.ts / SheetView.tsx, scale in scale.ts) and an engineering-package section (cable to order per type, manifolds).
- [x] Tests: layout.test.ts 12/12; e2e/layout.e2e.cjs (scale, cabinet + motor + two valves, tray, lengths in the schedule + CSV, JB + manifold accepted, BOM note, reload, drawing sheet); app E2E, sweep (+ layout page; sweep "example" scenario now really opens the example), checkers 0 FAIL / 0 WARN with a layout in the big variant.
- Open: purchasing order list could take `cableTotals()` (per type, m) instead of per-cable "BY SITE" — Dev 1.
- Merged integration 1beee34 (analog I/O, HMI editor, online): all unit tests, app + layout E2E, sweep, checkers (5 variants) green.

## Coordinator follow-ups after code rules merge (19:05)
- [x] Sheet 4 integral CT fuses (coordinator fix): ca600 PDF checks re-run, 0 FAIL / 0 WARN.
- [x] "No safety reset" no longer listed twice in the review: the design warning is skipped when the code rule reports it (checks.ts COVERED_BY_CODE_RULES); review.test.ts 8/8 with a new test (fails without the fix).
- [x] Yellow E-stop background: AutomationDirect ECX1651 oversized legend plate, yellow, "EMERGENCY STOP", for 22 mm devices (product page + cut sheet; $3.25 read 2026-10-16) added to the catalog (no door cutout of its own) and prices; the estop-device rule names it in its fix and passes when it is in the design. The 60 mm diameter is not on AD's page or cut sheet, so it is not claimed.
- [ ] SCCR ratings for PS / CT / VFD parts: left "unknown" — needs each AD datasheet's SCCR statement (to do with the vendor-catalog cross-check).

## Machine layout polish (after #29 merged)
- [x] Drawing sheet labels: manifolds and remote I/O join the label placement; symbols are kept clear; on very dense layouts the label goes to the spot that overlaps least (big variant: all labels readable, MV1 label visible). Checkers 0/0, layout E2E OK.
- Next: vendor catalog cross-check (+ a test that fails a catalog entry without a datasheet-backed rating).

## Vendor catalog cross-check — milestone 0 (checker)
- [x] src/electrical/catalog.test.ts (9 checks): unique, real-looking part numbers; https source page on the maker's site or the distributor that sells it (vendor host table: AD, Rockwell, Siemens, Schneider, ifm, Yaskawa, nVent Hoffman, Rittal, Phoenix, Eaton); the page is that part's page; verified = checked against the datasheet; key ratings per category; plausible numeric ranges; part-number ratings agree (GMCB poles/amps, PSx watts/amps); non-AD back-panel parts must give a datasheet footprint; prices belong to catalog/HMI parts and come from the same site. A fake part (invented PN, wrong site, unverified, 4800 A, no footprint) fails 7 of 9.
- [x] Found: C18D-0P-1A / C18D-0N-1A had no supply voltage — added 10-36VDC from AutomationDirect's item name on each product page.
- Note: 121 AutomationDirect back-panel devices (breakers, contactors, VFDs, power supplies…; terminals, rails and duct not counted) have no widthMm/heightMm and use the category footprint estimate (e.g. every VFD 100 × 180 mm) — layout sizes are estimates until filled from the datasheets.

## IEC 60204-1 rule set — milestone 1
- [x] Rule set chosen per region (ruleSetOf: US / Canada → NA, any other region → IEC; CodeInput.ruleSet overrides). To be keyed by Debug 1's region profile (src/standards/regions.ts) when it lands.
- [x] Shared rules with an IEC clause: disconnect (rated ≥ 100 % FLC under IEC, lockable OFF), mounting heights (handle ≤ 1.9 m), protective earth, E-stop red on yellow, stop category, EDM, safety reset, motor overload (not required ≤ 0.5 kW, 7.3.1).
- [x] IEC-only rules (src/review/codeRules/iec.ts): supply 400/230 V 50 Hz, Table 5 minimum mm², Table 6 (method B2, 40 °C) conductor vs protective device and motor current, control-circuit protection, PE size (Table 1), colours 13.2 (GN/YE, light-blue neutral, BK / RD / BU / OR), short-circuit protection + IEC 60947-4-1 coordination note, control supply 9.1, enclosure IP (NEMA → approx. IP), marking 16.4. Sizes read in mm² or AWG (converted).
- [x] NA-only rules (NEC 430.52, 450.3, 240.4(D), NEMA type, UL 508A SB) do not run under IEC. iec.test.ts 13/13; codeRules.test 18/18 unchanged; CI now runs the review, code-rule, IEC, layout and catalog suites.
- Values marked "(verify clause)" / Table 6 numbers need checking against the standard text.

## Vendor catalog cross-check — round 1 (integration 2013f8d: Dev 1's AB / Siemens / Schneider / Yaskawa / ifm / Hoffman / Rittal)
- Checker refined (still strict): Siemens official hosts cache.industry.siemens.com / support (siemens.com) and docs.tia.siemens.cloud accepted; a maker's PDF catalog / document portal counts as the part's page; subpanels need panelHeightIn/panelWidthIn (not outside size); modular controllers need maxExpansionModules instead of on-board I/O; UNVERIFIED_OK allowlist (reason ≥ 30 chars, stale entries fail) — empty.
- Remaining findings (data, for Dev 1): 60 parts sourced from resellers / unknown sites (crossco 16, elliottelectric 12, precision-elec 6, mouser 5, rs-online 3, tme, parmley-graham, kempston, farnell, raptor, digikey, distrelec, misumi, eplan, euautomation, adegis, simaticcontrol; and three unreliable hosts: pnap.ir, 5.imimg.com, cdn.awsli.com.br); missing ratings: motorProtector volts 26 / poles 8, plc supplyVolts 6 (Micro820/850, S7-1200 G2), breaker interruptingKA 6 (1489-M), vfd outputAmps 5 (G120C), subpanel panel size 5, PS inputVolts 1; 7 parts verified:false; ~115 back-panel parts without a datasheet footprint.
