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

## Drawing text overlap audit (coordinator, urgent user report: "the print is going on top of other prints")
- **New checker `tools/check_overlap.cjs`** (with `tools/harness/overlap.ts`), part of `check-all.sh`:
  - renders every sheet like the PDF export;
  - takes text ink boxes (getBBox → sheet mm, trimmed to the glyphs) and every stroked line;
  - ignores lines hidden under a filled shape drawn later;
  - FAIL: text over text ≥ 0.5 mm², or a line ≥ 1 mm through a text.
  - Cross-checked against the printed PDF with PyMuPDF: same hits.
- **New harness variants:**
  - `rules-sealing`: the user's Sealing Head, designed by the engine;
  - `rules-sealing-long`: the same with I/O descriptions as long as the AI writes them.
- **Before:** 286 raw hits on 9 variants. After hidden-line occlusion and per-sheet triage, the real ones were:
  - power distribution (ca600): "FROM T1 4.07" written over "INTEGRAL SECONDARY FUSE" (11 mm²);
  - device list: long function text running into the part-number column (12 mm²);
  - panel layout: rail tags R1–R4 drawn over the first device ("R3PLC"); slim-relay labels and short terminal-strip labels crossing their outlines and terminal lines;
  - drilling sheets: hole IDs colliding (close VFD hole patterns) and sitting on reference duct lines; template labels (handle, stack light, fan, outlet filter) crossed by their own centre lines and the part outline;
  - door layout: legend plates showing the function text ("SAFETY RESET / — BLUE,"); DETAIL A frame through the E-stop tag; the handle bar through the DS1H tag;
  - input sheets: "FROM 4.07" across the line-number column;
  - machine layout: labels on cable routes and on a JB;
  - IEC symbols: the pressure-switch symbol over its cell line.
- **Fixes:**
  - `Txt` cuts text with "..." when even the smallest font doesn't fit `maxW` (so nothing with a width ever runs into the next column).
  - Placement fixes per sheet as listed:
    - free-corner hole labels and above/below/left/right template labels that avoid other cutouts and the edge band;
    - rail tags over the duct; strip labels below short strips; narrow-part labels centred or dropped when unreadable;
    - door legend = the device name (text before "—", ":", ",", "(");
    - machine-layout labels avoid routes and try side and diagonal spots;
    - legend symbols at 85 %.
- **Bug found:** the analog setup CSV was left out of the ZIP until a PLC program existed. Fixed: it is PLC configuration.
- **After:** OVERLAP 0 FAIL on all 10 variants. check-all: LAYOUT / DXF / STEP / PDF / XLSX / CONSISTENCY all 0 FAIL.
- **Open:** I asked the coordinator for the user's screenshot / project to confirm their exact case.

## Electrical QA findings in my area (coordinator, before the overlap stress test)
| # | finding | fix | check |
|---|---|---|---|
| 1 critical | Sinking PLC outputs: coil wired output → OL → A1, A2 → 0V (both ends at 0V, never pulls in) | `24+S → OL 95-96 → (interlock) → A1`, `A2 → PLC output` in wire list, terminal plan (TB1 24+S feeds the chain), control rung (starts at the 24+S node, ends "Y001 TO …"), 24+S rung text and E-stop general note | new design-review rule `output-load-circuit` (every PLC-driven coil / lamp / solenoid has the output on one side and 0V/24V on the other per output style) + unit test with the old wiring injected |
| 2 major | DXF / drawings drew tapped holes at thread size | holes drawn and cut at the tap-drill size (M5 Ø4.2, M4 Ø3.3, 1/4-20 Ø5.1); DXF hole text keeps the tap ("A1 M5 TAP, Ø… DRILL") | `check_dxf.py` warns on any other hole size |
| 3 major | HMI never wired, missing from the device list | HMI1 24 VDC through its own fused terminal (TB1, DN-F6L24, 2 A) + 0V + frame ground; Ethernet ENET1 PLC↔HMI (RS-232 when the CPU has no Ethernet); control-sheet rung; device list row (DOOR); BOM: fused terminal + patch cable (part to be selected) | consistency: wire numbers on drawings, terminal counts incl. fused |
| 4 major | component removed on the Design tab still drawn | design warning "X is drawn and wired (Y001) but is not in the component list, so it is not in the BOM"; device list says NOT IN COMPONENT LIST / BOM; confirm before remove | — |
| 5 major | no GB1 → PE terminal wires, no bonding; two PE cores on one clamp | wire list: GB1 → every PE terminal, enclosure / back panel / door bonding; one PE terminal per home-run field cable on TB2/TB3 | engine goldens regenerated (expected terminal counts) |
| 6 | "SAFETY RESET — BLUE," legend | already fixed in #58 (legendOf); nameplate/labels sheets verified | — |
| 7 minor | sheet 18 ID list without DS1, example X101/PLC1; sheet 6 "FEEDS PLC OUTPUT SUPPLY PLC OUTPUTS"; ES1L "FIELD"; sheet 19 DOOR list without PB3/ES1 | DS1 kept (accessory filter on the description's first clause); marking example uses a real wire of the project; 24+S text by output style; legend plates / contact blocks located DOOR; door list from the door layout | visual |
| 8 overlaps | door "PER HANDLE TEMPLATE" / ES1 / R2 (fixed in #58, re-checked); device list text shrunk | device list cells and I/O sheet descriptions wrap onto two lines (cut with "..." past that, never shrunk); IEC actuator heads (pushbutton, mushroom, limit, pressure, selector) kept below the 3-wire sensor 0V lead of the row above (stress run found the "p" box on it); cabinet picture tag plates scale with the panel and the pictures are taller; cabinet-location suggestion never lands on a device (≥ 1 m, test) | overlap checker, new `rules-stress` variant (IEC, 32 I/O with 100+ char descriptions, 120-char component functions) |

## Review / deliverables findings (coordinator, second list)
| # | finding | fix |
|---|---|---|
| 1 | review: analog input DF registers "never written"; shield DF1SH GN/YE flagged; Equipment 11 vs Review 10 inputs; shortage critical vs minor | analog inputs skipped (filled by the analog setup); shield / drain = GN/YE in the NFPA and IEC colour rules; Equipment counts the I/O list once it exists (estimate before); capacity is one finding (Equipment, critical), the electrical duplicate is dropped |
| 2 | package printed the machining sheets twice | separate "Machining drawings" part removed; the drawings part names the machining sheet range; the machine-shop PDF stays in the ZIP next to the DXFs |
| 3 | ZIP spec.md raw, no program listing, no Order list Excel | spec.md = full machine specification; plc/…_program_listing.pdf; purchasing/…_order_list.xlsx (spares sheet) |
| 4 | HMI screens PDF without document control | header (company, project, project no.), footer (status, revision, date, page i of n), PDF title |
| 5 | cosmetics | check-out PDF named with fileBase; mm DXFs "DIMENSIONS MM [INCH]" and mm-first labels; drawings / machining PDF Title metadata; Order list CSV includes the spares section when "Show recommended spares" is on |

## Engineering notes from the electrical QA (coordinator)
| note | fix |
|---|---|
| 120 W 24 V supply, not Class 2, no secondary protection | design note per supply: within the 18 AWG rating (7 A) its current limit protects the wiring, field circuits are Class 1 / NFPA 79 (Class 2 supply as the alternative); above 7 A the TB1 feeds to the field strips become 4 A fused terminals (BOM lists fuse sizes per terminal) |
| non-fused 30 A disconnect, 14 AWG bus, no upstream protection stated | `upstreamOcpd`: required feeder OCPD by others, min. from the panel load (125 % largest motor + rest, NEC 430.24), max. from the bus conductor (NEC 240.4(D) / 310.16) and the disconnect rating; on the power sheet and as a design note (major when min > max) |
| SCCR "TBD" | SB4 calculation moved to `src/electrical/sccr.ts` (shared by the documents, the review and the drawings); the nameplate prints "N kA RMS SYM., V MAX (UL 508A SB4; LIMITED BY …)" once every power-circuit rating is known, else "TBD: RATING NEEDED FOR …" (us480: PS1; big: VFD1–4, PS1 — not in the catalog, no default in Table SB4.1) |

## Sealing head re-verification on integration (after Dev 2's #61, merged head 8b0fa7a)
`e2e/sealing-head.e2e.cjs` against the preview build: builds end to end, ZIP 54 files. Two stale checks updated (buttons are no longer on the door; stage-log text).
| # | item | status | evidence |
|---|---|---|---|
| 1 | two-hand control | PARTLY FIXED / OPEN | PB1/PB2 now at the machine (zone "Unwind"); still plain N.O. buttons into X002/X003, no two-hand relay (critical review finding still raised) |
| 2 | light curtain = prox sensor | OPEN | LS1 = PNK-AP-3H inductive prox, sensor-pnp into X004; electrical note says "OSSD into SR1" but nothing is wired that way |
| 3 | HMI closes the head without two-hand | OPEN | HMI_Start starts the auto cycle; HMI_Sealing_Head_Down hold-to-run energizes Y001 (closing stroke) from the screen |
| 4 | heater power circuit | OPEN | Y003 still drives CR1 "interposing relay", contacts go nowhere; no SSR / heater contactor / branch protection |
| 5 | over-temperature limit not hardwired | OPEN | X106 = LS4 PNK-AP-3H prox, PLC input only |
| 6 | thermocouple | OPEN | DF1 wired as 4-20 mA loop, no transmitter / TC input part |
| 7 | no seal-temperature setpoint / dwell on the HMI | OPEN | only high/low alarm limits DF101/DF102 |
| 8 | missing alarms (over-temp, air pressure, film low) | OPEN | 7 alarms, none of these three |
| 9 | Start clean keeps the example's document control | FIXED | my first read was the banner text before pressing Start clean; after it the drawings are SH-E-xx and the spec has no Example Foods / 24-117 (Debug 1, b423cd6; sealing-head.e2e now checks it) |
| 10 | ZIP crash on qa: undefined | FIXED (confirmed) | ZIP built, 54 files |
| 11 | review rules for 1–6 | FIXED (confirmed) | all six findings raised |
| 12 | zones | OPEN | light curtain, over-temp, air pressure, film low in "Unwind" |
| 13 | Safety functions table | OPEN | SF-01 E-stop and SF-02 reset only |
| 14 | pilot lights on 24+S | OPEN | PL2 (fault light) returns on 24+S, goes dark on a safety stop |
| 15 | stray space "(thermocouple )" | OPEN | HMI tag descriptions and two alarm texts |
| new | analog pair flagged "Wire DF3+ is WH, expected BU" | FIXED here | colour rules skip 4-20 mA / 0-10 V pairs (cable core colours); E2E checks it |

## Sealing head re-verification after Dev 2's #64 (integration 1c34a2c)
| # | item | status | evidence |
|---|---|---|---|
| 1 | two-hand control | FIXED | SR3 BG5933 (ISO 13851 IIIC), 2H-240002 station at the machine; Y001 (closing stroke) through SR3 13-14; SF-04 |
| 2 | light curtain | FIXED | LC1 SH4 type 4 → SR2 LG5925-48-900 OSSD relay, SR2 status on X004; SF-03 |
| 3 | HMI closes the head without two-hand | FIXED | no HMI hold-to-run on the closing stroke; HMI_Start only starts the cycle, the stroke needs SR3 |
| 4 | heater power circuit | FIXED (+ drawn here) | FU1 Class J 20 A → K1 (AC-1) → SSR1 → HTR1; power sheet now draws it with wire numbers (K1-T1, SSR1-T1, K1-T2) and the wire list follows; aux loads now size the bus (14 → 12 AWG, upstream OCPD 20 A) |
| 5 | over-temperature hardwired | FIXED | TAH1 SCU-3100 latched relay holds K1 (coil chain on sheet 6); X106 = TAH1 relay 2; SF-05 |
| 6 | thermocouple | FIXED | TT1 XTD2 transmitter, 4-20 mA loop |
| 7 | HMI setpoint / dwell | FIXED | DF103 SP_Seal_Heater_Temperature_SP, DS1002 SP_Seal_time |
| 8 | missing alarms | FIXED | light curtain, air pressure low, heater over-temperature, film roll low |
| 9 | Start clean document control | FIXED | (see above) |
| 10–11 | ZIP crash, review rules | FIXED | |
| 12 | zones | FIXED | LC1 / sealing sensors "Sealing station", air pressure and film-low at the unwinder, TAH1 in the cabinet |
| 13 | Safety Functions table | FIXED | SF-01 … SF-05 from the design |
| 14 | fault lamp on 24+S | FIXED (Dev 2, f5187ae; checked after the cfad3dd merge) | lamps on sinking modules return on the unswitched 24+; combined with the per-coil return key and p.pins[1] terminals, consistent in TB3 and the direct returns |
| 15 | stray space "(thermocouple )" | FIXED | "(thermocouple)" |
| new | double solenoid SOL1 (Y001 down / Y002 up) wired to the same A1/A2 | FIXED here | per-coil terminal pairs (A1/A2, B1/B2) in wiring, TB3 (one return per coil), cable cores; the sinking coil behind SR3 goes 24+S → SR3 → TB3 → A1, A2 → TB3 → Y001; found by the output-load-circuit rule (critical) |

## Enclosure sizing: the door counts (integration cfad3dd)
rules-big failed check-all with 35 door FAILs: ENC1 was SCE-16EL1206LP (16x12), far too small for the CM5-T10W, the operators and the DS1H handle.
- Cause: no catalog enclosure fits rules-big's back panel, and the fallback kept the candidate with the most spare space; all of them had 0 %, so the first one won, which was the smallest.
- Fix (engine): when nothing fits, the closest enclosure wins. Ranking: fewest back-panel parts left out, then a door that fits, then the most spare space.
- Fix (panelLayout): every door item (HMI bezel, operators) must be at least 25 mm from the door edges, or the door overflows with a warning. The door check already covered rows, width and the handle zone.
- Test: `engine.test.ts` "big-overflow" asserts that the chosen enclosure is not the smallest, its door fits with 25 mm clear, and a 16x12 door with CM5-T10W flags overflow. The test fails without the fix.
- rules-big now uses SCE-36EL3012LP (36x30) and check-all passes with 0 FAILs. Six parts still do not fit the back panel (PLC, IO2–IO4, SR1, TB1). That is a real "does not fit" and is reported in the layout and STEP notes: the catalog's largest NEMA 12 enclosure is 36x30, so the fix is a larger enclosure in the catalog or a second panel.

## Large catalog enclosures (Dev 1, #69, integration ce316da)
- **Overflow test:** with 72x72 enclosures in the catalog, the big machine fits. The "closest enclosure" path is now tested with `big-4x`: NEMA 4X needs stainless, and the catalog's stainless enclosures stop at 20x16. The test expects SCE-20EL1608SSLP, not the 16x12, and fails on the old ranking.
- **rules-big:** now picks SCE-42EL3612LP (42x36 wall, single door), everything placed, 29% spare. Two overlaps from the smaller sheet scale are fixed:
  - Sheet 23: the balloon of a stacked part (OL1 under K1) went just left of the part and landed on the neighbouring OL1 tag. It now goes left if clear, else below the part over the duct, and avoids part outlines and other balloons.
  - Sheet 24: "DETAIL A" ran into the HMI bezel. It now moves left of its box, or inside its corner.
- **New harness variant `rules-floor`:** the big machine in an SCE-72EL7218LPPL, a floor-standing double-door enclosure on 12in stands.
  - **Door layout:** HMI, operators and handle all go on the leaf in front of the disconnect, never across the centre split, and stay 25 mm clear of that leaf's edges. The door sheet draws the split line, both hinge sides, the latch on the device leaf and the LEFT/RIGHT DOOR labels. Its legend gives X from that leaf's lower-left corner.
  - **Floor-standing heights:** the top device is at most 1.7 m above the floor, stands included. Operators below 0.6 m get a warning. The `mounting-heights` review rule reports the actual heights instead of "mount the enclosure bottom at…".
  - **Door drilling and DXF:** the plan covers the device leaf ("RIGHT DOOR CUTOUTS"), with the leaf as datum and a double-door note.
  - **STEP:** two leaf plates hinged on the outer edges, cutouts on the device leaf, latch at the split, floor stands under the body.
  - **Thermal:** a floor-standing enclosure's bottom is no longer counted in the cooling area. The calcs basis text says so.
  - **Drilling sheets at small scale:** crowded 22 mm holes show their ID only (the tag stays in the table). An HMI cutout label moves above a short cutout. Hole labels avoid other holes' crosshairs.
  - **Checkers:** check_dxf and check_step take the door leaf and the stands into account.
- **Not done:** the in-app 3D and door views don't draw the split line yet. The layout data (`door.leaves`) is there.

## Double door in the app views; pressure and guard-door switches (integration 1703ef7)
- **In-app cabinet views:**
  - The door view draws the centre split, hinges on both outer edges and the latch on the device leaf. The nameplate and warning labels stay off the split.
  - The inside view opens each leaf about its own hinge (`openDoorPoint`). Device backs and the handle sit on their leaf, and the door wire bundle runs to the duct on that side. The view box covers both leaves.
  - Single-door renders are unchanged.
- **Catalog**, all with real part numbers checked against datasheets:
  - AutomationDirect:
    - ProSense MPS25-1C-D100D: mechanical, 10–100 psig, SPDT 3 A @ 125 VAC / 2 A @ 30 VDC, DIN pins C=1 NC=2 NO=3 PE=4.
    - ProSense PSD25-0P-0145H: electronic PNP, M12 pins 1 + / 2 OUT2 / 3 0V / 4 OUT1.
    - IDEM KM-203002 tongue interlock: 2 N.C. 11-12 / 21-22 + N.O. 33-34, AC-15 6 A @ 120 V, up to PL e with a safety relay, UL E258676.
    - Actuator 140107.
  - Siemens: 3SE5112-0QV10 with actuator 3SE5000-0AV01. The switch is listed unverified: the data sheet server returned 403, so its terminal numbers are unchecked.
  - Schneider: XMLB010A2S13 pressure switch.
  - SCCR: these are control-circuit field devices, so UL 508A SB4 doesn't apply. Each part says so.
  - No Allen-Bradley 440K or Schneider XCSPA part was added: no 2 N.C. + 1 N.O. catalog number could be confirmed (XCSPA592 is 1 N.C. + 1 N.O.).
- **Engine:**
  - Each pressure-switch input gets a mechanical pressure switch from the catalog, plus a set-point question. It no longer produces a "not in the catalog" note.
  - Each guard door gets a GS interlock and its actuator, instead of the old "not drawn yet" note. Doors come from the spec, or from a "guard door closed" input.
- **Wiring:**
  - Field dry-contact inputs use the part's own terminal numbers (`contactPin`): PRS1:1 / :3 / :4, GS1:33 / :34.
  - Guard switches sit in series after the E-stops in both SR1 channels: S11…GS1:11, GS1:12→S12, and the same for 21-22. They're drawn as N.C. contacts on the safety rungs.
  - The safety-functions document has a "Guard door interlock" entry from the design.
- **Tests:**
  - engine.test checks: the guard interlock and its actuator, the door-closed input on 33-34, the S11 / S21 chains through GS1, and the pressure switch on its DIN pins.
  - The catalog test allowlists 3SE5112-0QV10 with its reason.
  - The machine-model AI test now expects the real interlock instead of the note.

## Enclosure: the designer's choice, no over-sizing, no silent overflow, PLC drawn twice (integration afcaf88 + Dev 1's 540333b)
- **Reported by the user:**
  - The Sealing Head showed parts that "do not fit" in SCE-20EL1608SSLP.
  - After the 4X catalog arrived, it was placed in a huge, mostly empty cabinet.
  - The PLC was listed twice: PLC C0-10DD1E-D and X1 C0-10DD2E-D.
- **Cause of the over-sizing:**
  - The catalog sizes come in big steps, and the spare rule was 25 %.
  - The sealing head reached 24 % in the 30x24 steel and in the 24x30 / 30x24 stainless, so it jumped to 36x30 (66 %) and to 36x24 (54 %).
  - There was no ranking by mounting or by door count.
- **Cause of the PLC twice:**
  - The equipment choice writes its CPU into the electrical required parts.
  - After the CPU was changed on the PLC page, the old CPU stayed in that list. The engine added it under the fallback tag "X1".
- **Ranking:** `enclosureRank` and `enclosuresFor` are shared by the engine, the derive sizing and the picker.
  - Order: wall-mount single-door, then floor / two-door; smaller back panel; 304 before 316; shallower.
  - The material family is kept: steel, stainless or non-metallic.
- **Spare rule:** `SPARE_RULE` is now 20 % (shop rule 20–30 %).
  - The sealing head now lands in the 30x24 steel (24 %).
  - In 4X it lands in a wall-mount single-door 304 stainless enclosure, at most 36x30.
- **The designer's pick:**
  - `DesignInputs.enclosurePreference` is saved in the .isap and carried through regeneration and Update all. The engine, the AI path (`chooseEnclosure`) and the page all follow it.
  - Kept when the parts fit. When it's larger than needed, the note reads "This cabinet is bigger than needed — the recommended size is …".
  - When too small: the smallest enclosure of its rating and material that holds the parts is used, with the note "Your size (20x16x8) was too small for the parts; we use …". The pick stays recorded.
  - Squeezing: the layout's existing compact pass (tall parts share rails, fewer rails and ducts) is what tries to fit a pick. A narrower duct or tighter rail pitch is not added yet.
- **UI:**
  - An "Enclosure" control comes first on the Electrical page. It shows:
    - the current enclosure, with "recommended" or "your choice";
    - a material select;
    - a size list of every enclosure of that rating and material, with part number, H×W×D in inches and mm, door count and mounting. The recommended one is starred.
    - the note.
  - A red banner appears when parts still don't fit, offering a larger enclosure, 4X fiberglass, relax to NEMA 12, or split. Choosing one records it as the pick.
  - Known gap: a pick on the page swaps ENC1 / SP1 but doesn't recount DIN rail or duct lengths. "Update design" recounts them.
- **PLC twice:**
  - The engine never adds a CPU or module from the required parts, and a note names the stale part.
  - The design review warns on more than one CPU.
- **Checkers:**
  - `layout_summary` fails on parts left off the back panel, a door that doesn't fit, or two CPUs.
  - New variant `rules-sealing-4x`: the user's case with NEMA 4X, CPU 10DD1E-D, modules, and the stale 10DD2E-D in the required parts.
  - The us120 fixture moved from 16x12 to the 24x20 the engine picks (its parts never fitted the 16x12).
- **Tests (engine.test):**
  - Recommended: a wall-mount single-door 304 enclosure, at most 36x30, spare 20–50 %, no note.
  - Too small: bumped, with the note, and the pick recorded.
  - Too big: kept, with the note.
  - Picking the recommended one gives no note.
  - Regeneration keeps the pick.
  - `chooseEnclosure` follows the same rules.
  - The list order.
  - seal-4x: exactly one CPU.
- **Tests (E2E):** `e2e/enclosure-fit.e2e.cjs` covers:
  - the banner and its one-click fix;
  - the size list with the starred recommendation;
  - a bigger pick kept with its note;
  - a too-small pick bumped with its note and still recorded.
- **CAD exports:** parked as local commit 1c6cf94 (branch `cad-exports-wip`). They go into the next PR.
