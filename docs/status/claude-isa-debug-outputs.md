# Debug 2 — deliverables QA (`claude/isa-debug-outputs`)

PR #7 merged (batches 1–2). PR #43 (watchdog) merged. Last integration merge: 7f3b37d (drawings as one scrolling document).

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

## VFD line contactor (from Dev 2: safety stop by contactor was detected but not drawn)
- [x] derive: a VFD motor with a contactor wires protection → K:L, K:T → VFD:L (M-C1..3 "line contactor to drive"); when no PLC output drives K, its coil hangs on the safety-switched supply (24+S → K:A1, K:A2 → 0V) so the safety relay drops it; K is in the EDM loop.
- [x] Drawings: motor sheet shows K between the breaker and the drive with its coil reference; control sheet has the K coil rung on 24+S ("SAFETY STOP: DROPS WITH 24+S") with the contact mirror (main + EDM N.C.).
- [x] src/electrical/vfdLine.test.ts (4): power path, coil + EDM + rung, PLC-driven K gets no extra coil wiring, DOL unchanged. All other suites, checkers and app E2E green (catalog.test fails only on Dev 1's data, as reported).

## IEC rules keyed by the region profile (integration 4242c4c)
- [x] ruleSetOf = isIec(region) from src/standards/regions.ts (EU, Israel, IEC → IEC 60204-1 rules; US, Canada → NA).
- [x] Duplicate tables dropped: conductor capacity from IEC_AMPACITY (Table 6, B2), AWG read as the IEC size drawn for it (mm2FromAwg), 50 Hz supply from SUPPLY_INFO; colour rule accepts the profile's spellings (BU(LT), OG) and treats the earthed transformer secondary as AC control (RD), like iecColor.
- [x] No assertion about Israeli earthing or the SI 60204-1 edition. iec.test 13/13 (region EU selects IEC); all suites, checkers, app E2E green. EU 400 V example: only mounting window, yellow background, coordination note, IP66 note, SCCR marking.

## AI robustness (user report: "loses connection", "slow", "does it stop when I change screen?")
- [x] Audit: Electrical, HMI generate and Ladder kept their busy flag and result in stores (survived navigation, but no status / cancel / retry). Lost on navigation (state in the page component): Equipment recommendation, I/O-from-spec plan, Spec intake summary/undo, Import, AI review, HMI recreate-from-picture; Update all progress lived in the dialog.
- [x] src/lib/ai/jobs.ts: global job runner (zustand). Every AI call above runs as a job: applied to the project stores when it finishes wherever the user is; results the page shows first (recommendation, I/O plan, HMI proposal, reasoning) stay on the job until the page takes them (also after coming back); held and applied later if the open project changed; one job per kind.
- [x] src/components/AiJobsIndicator.tsx in the status bar (replaces "Ready" in App.tsx): running jobs with elapsed time, stage, "retrying (n/3)…", Cancel; failures with Retry (same input) / Dismiss.
- [x] src/lib/ai/errors.ts: errors classified network / overloaded (429, 529, 5xx) / timeout / auth / limit / cancelled; transient ones retried 3× (2 s, 6 s, 15 s, or Retry-After), also streams dropped half-way; SDK retries off; abort signal threaded through all AI modules (Cancel aborts the request); preview account path keeps its error code (rate_limited retried) and takes the signal; OpenAI path the same.
- [x] Update all: runs as a job (stage in the status bar, Cancel, "Continue in background"); electrical and HMI run in parallel (both need only the I/O list).
- [x] Speed: prompt caching on the system prompt and the electrical catalog block (catalog first, cache_control). Prompt sizes measured (≈ tokens): spec 1.9k, equipment 3.4k, io 2.2k, electrical 18.7k (catalog ≈ 15k, AD only), hmi 6.5k, ladder 6.6k, ladder revise 10.8k. Wall-time per stage needs a real key (none in this session); effort default unchanged ('max').
- [x] Tests: errors.test 5/5; e2e/ai-jobs.e2e.cjs (navigate 3 pages during a generation, kept result after return, 529→retry, Cancel, 400→Retry); app E2E, layout E2E, sweep, all unit suites, checkers green. hmi-editor E2E fails at "button icon" — same on the base (pre-existing, Dev 2's).

## AI watchdog (coordinator: preview Update all hung on Equipment forever)
- [x] withWatchdog (src/lib/ai/errors.ts): a request is aborted as a timeout when no data streams for 3 min, or when it runs longer than the cap for its effort level (low 5 / medium 10 / high 20 / xhigh 25 / max 30 min); it races the call, so even a call that ignores the abort settles. Timeouts are retried like other transient failures, then reported ("The AI service stopped sending data … (tried 4 times) … lower the thinking effort in Settings").
- [x] Wired into the API-key stream (progress = every stream event), the preview account path (progress = streamed text; JSON answers: total cap) and OpenAI (total cap). Cancel still aborts (Update dialog: "Cancel now" aborts the current stage; "Stop after this stage" lets it finish).
- [x] errors.test 10/10 (watchdog idle, steady progress, total cap, cancel vs timeout, hung → retried → plain message); ai-jobs E2E scenario 6: a request that never answers is stopped, retried, recovers. App E2E, sweep, all unit suites green.

## Back panel with real footprints: tall devices + enclosure sizing (coordinator: 24x20 sample "TB2, TB3 do not fit")
- Root cause: the UL98 disconnect (189 mm) makes rail 1 tall, and the 24x20 back panel (432x533) is too small for the real footprints. No packing makes it fit with duct spacing and clearances.
- Layout (`derive.ts` panelLayout): when parts still overflow after the normal and compact passes, tall parts (≥ 140 mm, disconnect first) move to their **own column** at the right, beside a vertical duct. The rails stop at that duct, horizontal ducts end there, and the vertical ducts run to the lowest rail or column part. Parts that miss the bands also go to the column when narrow enough. The attempt with the least lost area wins. spareSpace measures each rail by its own length.
- Enclosure sizing: `smallestEnclosure(ctx)` tries the catalog enclosures with the design's NEMA rating (same maker first, smallest back panel first). It returns the first one that holds every part with `SPARE_RULE` = 25 % spare.
  - Design review warns "Enclosure ENC1 X is too small … use Y with back panel Z (N % spare)".
  - When no catalog enclosure holds the parts, it says so.
  - When the panel fits but has less than 25 % spare and nothing larger exists, it says that too.
- Electrical AI: after generation it resizes ENC/SP from the footprints and adds a note.
- Sample: ENC1 → SCE-30EL2410LP (30x24x10), SP1 → SCE-30P24, seed v12. Harness `ca600` is moved to 30x24 as well. `us120` still overflows on purpose.
- Results (`tools/layout_summary.py`):

  | Variant | Before | After |
  |---|---|---|
  | us480 | 432x533, TB2/TB3 not fit, 0 % spare | 533x686, all fit, 63 % spare (+2 rails) |
  | ca600 | 432x533, TB1 not fit | 533x686, all fit, 46 % |
  | big | 686x838, fits, 12 % | unchanged; flagged: below the 25 % rule, 36x30 is the largest catalog enclosure |
  | analog | — | 533x686, 40 % |

- Also: `e2e/sweep.e2e.cjs` finds the ANALOG sheet in the new sheet list (integration 7f3b37d removed the sheet tabs, so the sweep reported "no ANALOG drawing sheet").
- Tests: `src/electrical/enclosureFit.test.ts` (sample fits, 24x20 flagged with the 30x24, no overlaps). tsc, eslint, all unit tests, check-all.sh 0 FAIL/0 WARN on 5 variants. E2E app, ai-jobs, layout, persist, old-data, hmi-editor, sweep all pass.

## Urgent user requests (coordinator, after 8c8d7f6): wire labels, machining PDFs
- **Wire labels ("printing gives just the 24+")**: the label data was complete in every variant: 39/39 wire numbers for us480, 122/122 for big, 2 markers per conductor, natural order; the label-printer and sheet PDFs printed all of them. What the user saw had two causes:
  - The preview expanded copies and showed only the first 60 (20× 0V, 1L1–1L3, 20× 24+ …).
  - Unticked rows are kept with the project, so a "Select only these" / "Select none" made earlier silently limited every later print.
  - Fix: the preview shows each label once with a ×N copy badge (roll mode keeps real positions). A warning in section 4 lists unticked labels, with "Tick all".
  - Test case `src/electrical/labels/wireLabels.test.ts` covers every wire number (power L1…, 1L1…, M1-T1…; 24+, 0V; X…, Y…; 24+S, S11…; PE), both ends, natural order and cable tags at both ends. `check_consistency.py` checks marker copies = 2 per conductor for all variants. The app E2E checks the preview and the unticked warning.
- **Machining PDFs**: `buildMachiningPdf(ctx, 'backpanel' | 'door')` builds the drilling / cutout sheets of the drawing set as their own PDF on the project's paper. Each has dimensions from the datum, a hole table, the title block and the sheet scale, plus a new note: "do not scale this print … the DXF of this part is 1:1 (real size)".
  - Buttons on Electrical → Machining ("Back panel PDF", "Front door PDF") and on Deliverables (next to the DXFs).
  - In the ZIP as `electrical/machining/<base>_back_panel_drilling.pdf` / `_door_cutouts.pdf`. In the full package as part 3, "Machining drawings".
  - There is no enclosure-side machining in the model (no side DXF). The stack light is noted on the door sheet as enclosure-top, drilled per template.
  - `check_pdf.py`: machining PDFs must be ANSI B, each page must equal its drawing-set sheet text, the set's drilling/cutout sheets must all be present, and the scale note must be there.
- **Bug found and fixed**: drilling/cutout sheet heading said "SCALE 1:6" while the title block said "1:5" (big door 1:8 vs 1:6). The heading used `drillScale(w, h·168/150)`, the title block `drillScale(w, h)`. Both now use `drillSheetScale` in `scale.ts`. `check_pdf.py` now fails any sheet whose heading scale differs from the title block.
- `e2e/persist.e2e.cjs`: the selected-sheet case uses the sheet list (tabs removed in 7f3b37d).
- Checks: tsc, eslint, all unit tests, `check-all.sh` 0 FAIL / 0 WARN on 5 variants. E2E pass: app, ai-jobs, layout, persist, old-data, hmi-editor, sweep.

## Enclosure wall machining (coordinator, after #50): glands, fans, stack light, air inlet
- New `src/electrical/enclosureFaces.ts`, `enclosureFaceDrilling(ctx)`: one machining plan per wall that has something on it (bottom / top / left / right). Each is drawn as a drilling sheet in the drawing set, with dimensions from the datum and a hole table.
- **Cable entries (bottom, code H)**: one per cable leaving the cabinet (cable schedule rows not starting at a JB) plus the incoming supply.
  - OD is estimated from the core count and conductor size (stated on the sheet as an estimate).
  - Gland: IEC → metric (EN 62444, hole = thread + 0.5); US/Canada → NPT cord grip in a standard conduit knockout (1/2" = 22.2 mm …). Clamping ranges are typical, marked "check the datasheet".
  - Layout: control cables from the left, motor cables and the supply from the right (disconnect side). Rows are clear of the walls (40 mm), the door return (60 mm) and the back wall (40 mm). Anything that doesn't fit is listed in a note.
- **Ventilation (code J)**: when the heat calculation needs it, a filter fan goes low on the left and an outlet filter high on the right.
  - Air flow: V = 3.1 · (P − k·A·15 K) / 15 K. The calc document now states this flow too.
  - The heat logic was moved to a shared `src/electrical/thermal.ts`, so the calc and the machining agree.
  - The cutout is the typical cutout of that fan size class (92/125/177/224/292 mm), labelled ASSUMED, drawn as a template (centre mark + dashed outline on the TEMPLATE layer, never cut).
- **Stack light (code K, top)**: centre mark + base outline (Ø from the catalog); drill per the manufacturer's template.
- **Air inlet (code L, bottom)**: only when solenoid valves are inside the cabinet. Bulkhead for the valve's port size from the catalog description. Template only.
- Generic `template` flag on cutouts (the door handle uses it too): DXF centre mark + outline on TEMPLATE; the sheet draws it dashed with the reason.
- Outputs:
  - Machining page: part selector (back panel, door, each wall); DXF + PDF of the selected part.
  - Deliverables: "Enclosure walls DXF / PDF".
  - ZIP: `electrical/machining/enclosure_<wall>_cutouts_1to1_{in,mm}.dxf` + `<base>_enclosure_cutouts.pdf`.
  - Full package: under "Machining drawings".
- Checkers:
  - `check_dxf.py` covers the walls: outline = W×D / D×H, standard gland holes, templates not cut, inch = mm geometry, ZIP copies, sheet hole tables.
  - Every cable leaving the cabinet has an entry. A failed temperature calc requires fan cutouts.
  - `check_pdf.py`: wall PDFs = drawing-set sheets; machining PDFs on A3 for IEC variants.
- Results: us480 3 entries (bottom only); big 12 entries + fan/outlet + stack light (4 walls); analog 6; ca600 5; us120 5; rules 7; rules-big 11 + fan + stack light; rules-eu 7 metric glands.
- Test: `src/electrical/enclosureFaces.test.ts` covers OD estimates, one entry per cable + supply, NPT vs metric, clearances, supply on the disconnect side, fan/outlet placement and air flow, stack light, air inlet with port size, and that templates are never on the CUTOUTS layer.

## QA: the user's "Sealing Head" through the rule-based pipeline (preview build, window.claude mocked)
Flow: copy of the example + Sealing Head description → Start clean ("make the I/O list again") → Build everything (equipment → I/O → electrical engine → HMI engine → program) → deliverables. The mocks answer as a good AI would within the app's vocabulary: CLICK C0-12DD1E-D + C0-16ND3 + C0-08TD1, C-more CM5-T7W, 20 I/O (two-hand L/R, light curtain, heater SSR output, over-temp limit, TC via 4-20 mA, unwinder VFD run/fault/speed).
Regression test: `e2e/sealing-head.e2e.cjs` (needs `VITE_PREVIEW=1 npx vite --port 5206`).

Findings, ranked (✔ = fixed here, → = routed to the coordinator):
1. CRITICAL → **Two-hand control is not a safety function.** PB1/PB2 are plain green N.O. buttons on the cabinet door, wired to PLC inputs X002/X003. There is no two-hand relay (ISO 13851 type IIIC: N.O.+N.C. per button, 0.5 s synchronism), none in the catalog, nothing in the engine (machine model has no `twoHand`). The buttons belong at the machine, at the ISO 13855 distance.
2. CRITICAL → **The light curtain gets a standard inductive prox sensor (PNK-AP-3H) in the BOM** and goes to PLC input X004. Cause: `deviceTypeOf` sends any input of type `other` to `sensor-pnp`. There is no OSSD channel either: the only relay is the E-stop/gate SR1 (dry-contact inputs, manual reset), and the safety circuit sheet shows only the E-stop. Only the Schneider XPSU in the catalog takes light curtains.
3. CRITICAL → **The HMI can close the heated head without two-hand.** `HMI_Start` "starts the automatic cycle" and `HMI_Sealing_Head_Extend` is a hold-to-run jog of the closing stroke from the touch screen. On a two-hand machine the closing stroke must only come from the two-hand relay; the jog of a closing press/head needs two-hand or reduced force/speed.
4. MAJOR → **The heater has no power circuit.** Y003 "Seal heater on (SSR)" drives CR1 "Interposing relay … dry contact", and CR1's contacts go nowhere. No SSR or heater contactor, no heater branch protection, no heater on the power sheet. The disconnect is sized for 1.5 A, without the heater. There are no SSR / heater parts in the catalog.
5. MAJOR → **The over-temperature limit is not hardwired.** X106 "Heater over-temperature limit tripped" is only a PLC input, and it also got a prox sensor (same cause as 2). An independent high-limit must open the heater contactor (NFPA 79 / IEC 60204-1 7.4).
6. MAJOR → **No thermocouple support.** The analog ranges are only 4-20 mA / 0-20 mA / 0-5 V / 0-10 V. There is no TC transmitter or CLICK C0-04THM in the catalog, and the TC point is wired as a 4-20 mA two-wire loop with no transmitter part. The C0-04AD-1 is current-only.
7. MAJOR → **The HMI has no seal-temperature setpoint and no dwell time**, although the spec says the operator sets both. It only has high/low alarm limits. The program AI therefore invents DF201 / DS2, which no HMI screen writes.
8. MAJOR → **Missing alarms:** heater over-temperature (X106), air pressure low (X105), film roll low (X108). The HMI engine only makes alarms for VFD faults, timeouts and analog limits.
9. MAJOR → **Start clean keeps the example's document control**: customer "EXAMPLE FOODS INC.", site "LINE 3", project no. 24-117, drawing prefix CNV-E-… on every drawing and in the machine spec.
10. MAJOR ✔ **The deliverables ZIP crashed** (`t.trim` of undefined) on a project whose spec had `qa: undefined`. Root cause: `useSpecStore.setSections` wrote `qa: undefined`. Fixed in the store (no undefined key), in `files.ts` spec.md (string guard) and in `EquipmentPanel` (same `.trim()` pattern on an empty spec).
11. MAJOR ✔ **The design review did not see any of 1–6.** New code rules (US / Canada / IEC):
    - `two-hand-control` (critical; major when on the door)
    - `safety-device-standard-part` (critical)
    - `light-curtain-relay` (critical)
    - `heater-power-circuit` (major)
    - `heater-overtemperature` (major, plus the thermocouple-without-transmitter hit)
    Tests in codeRules.test.ts (21 pass); the E2E checks they fire on the sealing head.
12. MINOR → **Zones:** light curtain, over-temp limit, air pressure and film-low fall back to the first zone ("Unwind"); JB1 at the unwinder collects sealing-station devices.
13. MINOR → **Safety Functions table** lists only the E-stop and the reset (no light curtain, no two-hand SF).
14. MINOR → **Pilot lights on 24+S:** all PLC outputs, the fault lamp included, are on the safety-switched supply, so the fault lamp goes dark on a safety stop.
15. MINOR → **HMI tag/alarm names carry a stray space:** "Seal Heater Temperature (thermocouple )".
16. INFO **What works:**
    - equipment → I/O → electrical → HMI → program in the preview;
    - VFD analog speed 4-20 mA matched to drive AI2 (P03.29);
    - STO from SR1; double-solenoid head valve;
    - analog setup CSV;
    - wire labels for every number; machining incl. bottom glands;
    - 54-file ZIP.
