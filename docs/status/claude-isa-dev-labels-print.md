# Dev 1 — labels & printing (`claude/isa-dev-labels-print`)

Draft PR #4 → `claude/optimistic-maxwell-6nfcs6`.

## Task list (restated)

### 1. Label printing — Electrical design → "Labels" tab
- [x] "Labels" tab on the Electrical page (`?tab=labels`) and a "Labels" child in the project tree
- [x] Category checkboxes with counts: wire markers, terminal markers, cabinet device tags, field device tags, cable tags, door legend plates
- [x] Label list: filter, select all / none, row range, shift-click range, editable copies per label
- [x] Content: "Number only" or "Number + description beside it"
- [x] Size presets (12x6, 15x5, 25x10, 38x12, 50x12, 60x25, 70x30 mm; 12/18/24 mm tape with automatic length) + custom W x H in mm or inches
- [x] Auto-fit text (bold number, smaller description wrapped to ≤ 2 lines), optional border, 90° text
- [x] True-scale preview (CSS mm, 50 mm ruler, zoom)
- [x] Label-printer PDF: one page per label, page size = label size, copies respected
- [x] Sheet PDF (Letter / A4 grid with cut lines)
- [x] Print (iframe print → new tab → saveBlob fallback; preview build saves the PDF)
- [x] CSV and Excel (one row per label with copies, or one row per copy)
- [x] **NEW (user): label-printer selector** — Printer (brand groups; Brady now, Brother / Weidmüller / Phoenix Contact shown as "coming later") → model (M211, BMP21-PLUS, M611, BMP41, BMP51, i3300, i5300, i7100) → that printer's supplies grouped by kind (wire wraps, heat-shrink sleeves, terminal markers, device tags, tape). Choosing a supply sets the label size, the printable area (white part of self-laminating wraps / band of M21-1000-427 tape) and the PDF page size; printer and supply are remembered per project (new projects start with the last choice). Data in `src/electrical/labels/printers.ts`, source URL per entry; partly verified entries carry a visible "To check" note.
- [x] **Page layout (manager follow-up)**: "One label per page" (default; the driver arranges the roll) or "Match the roll: N across per page" (page = liner width, labels at their real positions). Offered only for supplies with liner data: B33-80-427 (4 across, 63.5 mm), B33-117-427 (2 across, 58.42 mm), B33-5-422 (3 across, 85.09 mm), THT-14-498-10 (4 across, 74.93 mm); disabled with a tooltip otherwise. Help text says when to use which.
- [x] **Desktop printing (manager follow-up)**: `src/electrical/labels/print.ts` — interface for the Electron preload (`window.isaDesktop.print(job)`, optional `listPrinters()`); job = PDF bytes, job name, page size in mm (label size; liner width for "match the roll"), uniform-size flag, Windows printer name ('' → show the dialog), scale 'actual', copies. "Print labels" and "Print full package" use it in the desktop app and fall back to the browser print / new tab / saved PDF elsewhere. A "Windows printer" choice appears on the Labels tab when the desktop app lists printers (remembered per project).
- [x] **Brady Workstation steps** in the labels Excel "How to import" sheet: step-by-step plain English (Custom Designer → Excel Import → Select Excel File → "Use first row as header" → drag Number / Description → print; "Check for updates" after re-export), taken from Brady support articles (links in the sheet). It tells the user to export one row per printed label because Brady prints one label per row.
- [x] **Debug 2 review R-L1** (labels Excel Copies as text): could not reproduce on the current code (openpyxl reads Copies as numeric 'n' in both the direct export and the ZIP); made it explicit anyway (integer value, number format '0') and the E2E now fails if Copies is stored as text.
- [x] **Debug 2 review R-L2** (spike at the top-left of the first label border): reproduced at 1200 dpi (THT-14-498-10, match the roll, border on) — jsPDF's rounded rect closes with an almost zero-length segment that a miter join turns into a spike. Fixed with round line joins/caps; re-rendered at 1200 dpi, spike gone (label-printer and sheet PDFs share the drawing code).
- [x] **Big projects**: label list virtualised (only rows in view render; 33 of 360 rows for the big variant), PDF builds lay out and draw in chunks of 250 and yield to the browser, with a progress bar (label-printer and sheet PDFs). Measured with `tools/harness/variants.ts` 'big' (360 labels / 865 to print): Labels tab opens in ~0.5 s (was ~0.8 s); label-printer PDF 0.26 s with the longest UI freeze 59 ms; 3x stress (2,595 pages) 0.6 s / 178 ms; 10x stress (8,650 pages) 3 s with one 1.6 s freeze in jsPDF's final serialisation (cannot be split; a Web Worker would remove it but may not survive the single-file preview build — proposed as follow-up if needed). `setupVariant` in tools/harness/variants.ts is now exported for these measurements (one-word change).

### 2. Full package PDF
- [x] `src/deliverables/fullPackage.ts` (pdf-lib): cover + contents with page numbers, engineering package, electrical drawings, HMI screens, PLC program listing, I/O list, BOM, label list
- [x] New PLC program listing PDF (`src/deliverables/programListingPdf.ts`): blocks, every rung with comment, contacts/outputs and plain-words logic, tag table, program check
- [x] PDF bookmarks per part (drawing sheets and HMI screens nested), package page number on every page
- [x] Deliverables page: "Full package" card (download / print, progress bar) and "Labels" card
- [x] Project menu: "Print full package…" (→ `/export?action=print-full`), "Print labels…"
- [x] "Download everything" ZIP includes the full package PDF and `labels/*` (CSV, Excel, label-printer PDF, sheet PDF)

### 3. Questions & answers below the description (URGENT user request, reworked)
- [x] Answers are no longer copied into the spec sections. The Machine description page shows a permanent **Questions & answers** list under the description sections (`#questions-and-answers`): every question from every page, open ones first with their answer box, answered ones staying as "Q: … / A: …" (editable with "Change"), the page it was asked on ("Asked in: …"). "Don't know — use the AI's assumption" shows "A: (AI's assumption: …)".
- [x] The Q&A list is part of the spec: `installQaSync()` (`src/components/questions/qa.ts`) keeps `sections.qa` in sync with the answered questions, so `specToText` adds a "## Questions and answers" block and the fingerprint changes when an answer is saved → every AI prompt (equipment, I/O, electrical, HMI, ladder, review, Update all) gets it and later stages go out of date. `changedSections` names "Questions and answers".
- [x] "Add to spec" (spec AI) gets the answered Q&A and is told not to ask those again; new questions are appended to the list.
- [x] Engineering package FDS: "Questions and answers" table (No. / Question / Answer / Asked in; open ones shown as "OPEN — to be answered"). Excel "Specification" sheet: Q&A rows.
- [x] I/O, Electrical, HMI and Design review keep their answer boxes; the same questions show in the list on the Machine description page.
- [x] Migration: answers merged by the earlier version stay in the sections; their questions stay listed as answered.
- [x] Tests: `npx tsx src/components/questions/questions.test.ts` (quick choices, section guess, Q&A text, specToText block, fingerprint change, changedSections). E2E: answers "How many parts per minute at most?" under the question → it stays as Q/A under the description, is not copied into the overview, later stages go out of date (0 → 5), and the I/O prompt of "Update out-of-date stages" contains "Questions and answers" + "60 parts per minute".

- [x] Only real questions go into the Q&A (manager follow-up). The HMI and electrical AI schemas return notes as `{kind: 'question'|'assumption'|'issue', text}` (`src/components/questions/classify.ts`: NOTE_SCHEMA, NOTE_KINDS_RULE, normalizeNotes). Designs keep `notes` (all, for the documents) plus `askUser` (questions and assumptions). HMI layout-checker messages and AI "issue" notes are never questions. In the design review they are minor findings ("HMI: …" / "Electrical: …") that the AI can fix. Older designs without `askUser` use a text check (layout / header bar / overlap / touch target / catalog / AWG). Stored questions of that type are dropped on load (persist `merge`), and `sync` refuses them. Tests: questions.test.ts (classifier, normalizeNotes, userNotes, isIssueNote, store). E2E: the HMI mock returns one question and one issue: the question is in the Q&A, the issue and layout messages are not, the issue is a review finding, and an injected stored layout "question" is gone after reload.

### 4. Purchasing (manager assignment)
- [x] Order list (`src/deliverables/purchasing.ts`, card `src/deliverables/OrderListCard.tsx` on the Deliverables page, "Order list" button on the Electrical page): BOM rolled up per part number, optional recommended spares (same rule as the maintenance chapter) and label supplies from the Labels tab (rolls from labels to print ÷ labels per roll), grouped by supplier (from the catalog product page; "Supplier to confirm" otherwise). Parts sold in packs are ordered in packs (catalog `packQty`, e.g. 31 terminals → 1 pack of 100). BOM items without a part number are listed as "still to select". Exports: order list Excel / CSV.
- [x] AutomationDirect ordering: order file = one `PartNumber,Quantity` line per part, no header — the format of AutomationDirect's cart "CSV Upload" (help page https://www.automationdirect.com/help/csvupload: two columns, item code and quantity, example `D2-04B-1,4`); the same lines can be copied for the cart's "Enter Items" paste box ("PartNumber and Quantity separated by comma, tab, or space", max 4000 characters — the app warns above that). Step-by-step instructions in the card.
- [x] Prices (`src/electrical/prices.ts`): 58 list prices, every part used by the example and test variants, read on each part's automationdirect.com page on 2026-10-16 (JSON-LD offers.price, equal to the displayed price; selling unit from the page's pack attribute). Extended prices, supplier subtotals, total of verified prices; parts without a price show "price to confirm" and are left out of the total; "List prices as of <date>, USD, excl. tax and shipping". Unit test: every price links to the supplier's page for that exact part and its selling unit matches the catalog pack size.
- [x] Purchase summary PDF (`src/deliverables/purchaseSummaryPdf.ts`): one page (customer, job no., revision; supplier groups with need / spares / order qty / unit / unit price / extended; totals; to-select items; price basis) — one page for all four test variants (pdfinfo). In the ZIP (`purchasing/`: summary PDF, order list CSV, one order file per supplier) and in the full package (new part after the BOM).

### 5. Online / commissioning with a real CLICK PLC (manager assignment)
- [x] PLC program → "Online (real PLC)" page (`src/online/OnlinePage.tsx`, route `/online`): IP / port 502 / unit id; READ-ONLY by default. Tabs: Monitor (every X/Y/C/T/CT/SC/DS/DD/DH/DF/TD/CTD/SD address the project uses, with Modbus number, name and live value), Live ladder (simulator's LiveLadder, power flow computed from the PLC's values in `src/online/power.ts`), Live HMI (HmiScreenView with PLC values, view only), I/O check-out (tick per point with technician, date, note and the PLC value at that moment; saved per project; printable sheet; fills the "Result" of each SAT I/O loop-check line; sheet in the ZIP under `commissioning/`).
- [x] Writes: only behind "Allow writes" (never remembered, resets on connect) + a confirm dialog per write + a red banner; only C bits (FC 05) and DS registers (FC 06); X / Y are never written (no button, refused in code). Write log on the page.
- [x] Modbus map `src/online/clickModbus.ts` from AutomationDirect docs (StrideLinx manual appendix D, CLICK help Address Picker / Modbus send-receive, C0-USER-M ch. 4), cited in the code; X/Y 32 per slot; TXT not documented → not supported; 32-bit word order not documented → "32-bit high word first" setting.
- [x] Runs on Debug 1's merged desktop bridge: types `ModbusBridge` / `ModbusConnectOptions` from `src/desktop/bridge.ts`, connection through `window.isaDesktop.modbus` (`modbusBridge()` in `src/online/useOnline.ts`). My earlier copy `src/online/bridge.ts` is deleted. In the browser / preview the page explains it needs the desktop app (address list and manual check-out still work).
- [x] One fake server: Debug 1's `e2e/fake-modbus.cjs`, plus an additive request log (`state.log`: fc, address, count or written value) that the write checks need. My `tools/modbus/` (fake server + Node client) is deleted; the tests now drive the desktop app's own client `electron/modbus.cjs`. Unit test `src/online/online.test.ts` (map, read planning, decoding, read/write against the fake server, power flow). E2E: the page calls the real desktop client through `page.exposeFunction` to a fake CLICK → live values match, no writes while read-only, X/Y have no write buttons, one C write lands at 16384 and reads back ON, check-out tick, ZIP has the check-out sheet.

### 6. Purchasing review fixes
- [x] R-P1: order file / order list = panel parts only; recommended spares = separate optional order (own file `*_spares_order.csv`, own section, off by default). R-P2: summary 1 page for all variants.

### 7. Multi-vendor equipment catalogs + brand preference (manager assignment, user priority)
- [x] Catalog framework (design: docs/architecture/multi-vendor.md §3.4–3.5): one file per vendor in `src/electrical/catalogs/` — `automationdirect.ts` (moved, unchanged), `allenBradley.ts` (92), `siemens.ts` (82), `schneider.ts` (89), `yaskawa.ts` (22), `ifm.ts` (20), `hoffman.ts` (12), `rittal.ts` (6). `CatalogPart` gained `vendor`, `family`, `verify`. `index.ts`: VENDORS (name, supplier, notes for the AI), groups (PLC and I/O, HMI, drives, panel parts, field devices, enclosure), `partsFor` / `catalogFor` / `fallbackCategories` (a category the chosen brands don't offer falls back to AutomationDirect), `supplierOfPart`. `src/electrical/catalog.ts` stays the lookup: `getPart` / `CATALOG` = all vendors, `partsIn(category, pref)` = preferred vendors (AutomationDirect by default, so nothing changes for existing projects).
- [x] Verification rule kept: every part number seen on the manufacturer's page or official data sheet (or a distributor page where the manufacturer site blocks fetching) — the page in `url`; `verified: false` + `verify` text otherwise (7 parts). Discontinued numbers replaced by current ones (Micro820/850 L20E/L50E, E100 overloads, 140MT, Rittal AX instead of AE). Not published → left out (e.g. 100-C / GV2 HP and UL Type E, 1489-M kA).
- [x] Brand preference per project (`info.vendors`, "Preferred brands / customer standard" card on the Equipment page and in the wizard's equipment step): per group, several brands allowed (e.g. AB PLC + ifm sensors + Yaskawa drives), "one brand for everything". Electrical AI gets only the chosen brands' catalog plus per-brand catalog notes (coil codes, overload pairing, end barriers …); the AutomationDirect-specific prompt line moved into its notes. Part picker / "Change…" and "Parts you already chose" list the preferred brands. Purchasing groups by the vendor's supplier.
- [x] Tests: `src/electrical/catalogs/catalogs.test.ts` (per vendor: shape, unique part numbers across vendors, source URL, verify text, default = AutomationDirect only, fallback rules); `multiVendor.test.ts` (the sample machine rebuilt with AB / Siemens / Schneider panel parts runs BOM, wiring, terminals, layout, drilling, warnings and code rules; overload range check works per brand). E2E: brand preference saved with the project, Allen-Bradley contactors offered for K1 when preferred, electrical prompt carries the brand notes.
- [x] Catalogs widened (milestone 2): Siemens 3RU2 overloads now cover 0.35–25 A without gaps, more 3RV2 protectors with UL HP, 5SJ4 UL 489 breakers 1/2/3-pole, small SITOP / LOGO!POWER supplies (Siemens 125 parts); 140MT below 1 A (AB 95). Ratings from a publication other than the part's page carry it in `ratings.ratingsSource`: 100-C HP (100-TD013), GV2 HP / SCCR (8536DB0901), Micro800 module and plug-in limits (2080-SG001), S7-1200 module limits. GV2ME = group installation with LC1D, not UL Type E (Type E = GV2P + GV2GH7) — in the AI notes.
- [x] PLC platforms as data (`src/plc/core/platforms.ts`, milestone 2): AB Micro820 / Micro850 / CompactLogix 5380, Siemens S7-1200 / S7-1200 G2 / S7-1500 + ET 200SP, Schneider M221 / M241 — CPUs, modules that fit, plug-in vs expansion limits (only where published), protocols, notes. `platformFit` (same grey-out reasons as the CLICK `cpuFit`, plus wrong-family module and slot limits), `suggestModules` (fewest modules covering the I/O), `hmiCompatible` (same brand unless stated protocols differ; another brand only with a shared EtherNet/IP / PROFINET / Modbus TCP stated for the panel). Tests: `platforms.test.ts`.
- [x] Equipment page: when a non-CLICK PLC brand is preferred, a comparison card lists that brand's CPUs with the modules each would need, fit / reason, compatible touch panels and the platform notes — for quotes; the project's program stays CLICK (proposal sent to the manager: Dev 2's profiles point at a platform id and use these part numbers, then the existing chooser and applyEquipment take over).
- [x] multiVendor.test: the Siemens machine now uses a fitting overload and breakers; for every brand a too-small overload is flagged by the code rules.
- [x] Manager decision: platforms plan approved; no non-CLICK CPU in the BOM while the program is CLICK (the comparison card is read-only). Dev 2 told the platform interface (`platformId` on PlcProfile, cpuModels = catalog part numbers).
- [x] Debug 2's catalog checker (`src/electrical/catalog.test.ts`, maker-host policy #34) passes 9/9 over all vendors: every non-AutomationDirect part re-sourced to the maker's own page for that part (Siemens data sheets per MLFB, Rockwell product pages, Schneider data sheets, nVent product pages, Yaskawa spare-parts pages per model, Rittal data sheets — Rittal part numbers are the order numbers, e.g. 1033.000), datasheet footprints for every back-panel part (values from Rockwell / Siemens / Schneider / Yaskawa / ifm publications are named in `ratingsSource`), missing key ratings filled (140MT / 3RV2 / GV2 volts and poles, 1489-M 10 kA, Micro800 24 V supply, 5069 controllers no onboard I/O, G120C output current), all 7 open parts confirmed. Dropped (not confirmable on the maker's site): GV2GH7 (no footprint), Yaskawa SI-EN3 / SI-EN3/D / SI-EP3 network cards and the JOHB-GA50 carrier. AutomationDirect subpanels got panelHeightIn / panelWidthIn (= their own panel size).
- [x] Layout: memory cards and plug-in I/O modules (forUse "plug-in slot") are not placed on the back panel (they plug into the CPU).
- [x] AutomationDirect back-panel footprints: 111 of 129 filled from each part's own AutomationDirect dimension drawing (cdn.automationdirect.com/static/drawings/<PN>.pdf, stored per part in ratings.footprintSource; 4 from the series row of the spec sheet). Body sizes without mounting tabs / DIN latches; the UL 98 rotary disconnects are 78 x 189 mm including their terminal shrouds; CT transformers include the fuse / terminal overhang. Not filled (18): accessories (shafts, contactor links / aux blocks), ice-cube relays (plug into their sockets), fuse cartridges, TK-E2-2600 (no drawing published). Source keys (*Source) are left out of the electrical AI's catalog text.
- [x] Layout: front-mounted contactor auxiliary contact blocks (SZ-A11T) are accessories, no longer placed as a 50 x 50 mm estimate.
- [ ] Note for the layout owner: with real footprints the sample 24 x 20 in panel no longer fits all terminal strips (the 189 mm disconnect makes row 1 tall, so no third rail) — the layout warns "Back panel … too small"; options: let a tall device span two rails, or a larger enclosure from the AI.
- [x] Chooser wiring for Dev 2's profiles: `platformOf(cpuId)` in fit.ts reads `profile.platformId`; `cpuFit` uses `platformFit` for platform CPUs (CLICK unchanged), the Equipment page lists the platform's modules, and C-more panels are not offered for non-CLICK CPUs. Test in platforms.test (active as soon as a profile sets platformId). 5069-OF8 (8 AO) added from its Rockwell page and to the CompactLogix 5380 platform.
- [x] Brand chooser (user request): each equipment group shows the chosen brands as chips (first = first choice, × removes) and a type-to-search, scrollable list to add more — fits 1366×768 (E2E: card 1062×327 px).
- [x] New brands (user request), maker hosts only, footprints, checker 9/9: Omron (56: CP2E / CP1E / NX1P2 + CP1W / NX I/O, 3G3M1 drives, S8VK-C PSUs), Mitsubishi Electric (42: FX5U / FX5UC + FX5 I/O and left-side adapters, GOT2000 GS21 / GT21, FR-E800), Delta (46: DVP-SE / AS300 + I/O, PSUs, DOP-100, MS300 / C2000 Plus), Weintek (8: cMT X, MT8000iP), Red Lion (12: Graphite, CR1000, CR3000; Red Lion's site is now hms-networks.com), Maple Systems (7), Pro-face (10: GP4000, ST6000 WADE). Not added: Omron MX2 (discontinued), Mitsubishi FR-D700 (discontinued), Weintek MT8000iE (end of life), items without a maker footprint.
- [x] Platforms: omron-cp2e (Omron FINS), omron-cp1e (no built-in Ethernet), omron-nx1p2, mitsubishi-fx5u / -fx5uc (Modbus TCP; left-side adapters as plug-ins), delta-dvp, delta-as300 — 15 platforms.
- [x] HMI ↔ PLC: panels carry `ratings.plcDrivers` (platform ids) from their maker's driver list (`driversSource`); a panel with a driver list is compatible only with the families on it (test: Red Lion G07 not with NX1P2 although both mention EtherNet/IP).
- [x] `platformOf` prefers the CPU model's own platformId (Dev 2: Micro820 / Micro850 in one profile).
- [ ] Open (manager): touch panels for non-CLICK PLCs need a second HMI family in the HMI designer, or panels for the BOM only — asked the manager.
- [x] **Brand card, one dropdown per group (user request)**: every row (PLC, HMI, drives, panel parts, sensors, enclosure) is a dropdown like "Use one brand for everything", listing the brands that offer parts for that group with a part count. Projects saved with several brands in a group show "also: …" until another brand is picked. E2E updated (card 1062x357 at 1366x768).
- [x] **Catalog spot-checks (Debug 2)**: Rittal footprint = enclosure outside size, mounting plate in panelWidthIn/HeightIn; 8WH9000-1PA00 for 2.5-10 mm2; 5SY4106-7 10 kA IEC 60898 / 5 kA UL 1077, supplementary protector; 1734-AENTR checked, unchanged.
- [x] **HMI panel specs for the vendor-neutral designer (Debug 1)**: all 62 third-party panels carry, from the maker's datasheet, resolutionPx (WxH), displayIn (sizeIn kept equal), touch (resistive/capacitive), ethernetPorts, serialPorts (physical connectors), usbPorts, software (as the datasheet names it), datasheet (URL), specsSource; HMIG3U <-> HMIDT732 pairsWith. Keys the maker data could not confirm are left out (5 panels without resolutionPx, listed in platforms.test.ts with reasons). Corrections: 2713P-T10CD1 is 10.4 in; Delta software DOPSoft 4.0; Siemens MTP700 capacitive. Red Lion values were read from text extracts of the hms-networks.com pages (the site refuses direct requests here); values only a sibling model showed were left out.

- [x] **Sealing-head QA parts (manager, for Dev 2's engine)**, AutomationDirect catalog, each from AutomationDirect's page / attribute data / drawing / spec sheet:
  - Two-hand relays (ISO 13851 type IIIC): BG5933-22-61-24 (Dold, 24 VDC), SCR2H-180030 (IDEM, 24 VAC/DC). OSSD / light-curtain relay: LG5925-48-900-61 (Dold), plus the existing Schneider XPSU. SCR31P-280003 left out (AutomationDirect's sources disagree on its outputs and supply).
  - Light curtains (Datasensing SH4, Type 4, 14 mm, PL e, pair per part number): SH4-14-0300-B-5 / -0450- / -0600-; cable 7000-12241-2150500 (2 per curtain). Two-hand stations: 2H-240002 (IDEM), SEPK02.0.S-3065 (Schmersal, with E-stop).
  - Heater SSRs (the AD-SSR series is retired): Gefran GQ-25/50 (need HS-60-10 / HS-52-50 / HS-70-67 heat sinks), GRSH-25/40 (built-in heat sink), Eltwin SC3DD4010 / SC3DD4020 (3-phase), SC2DD4030 (2-pole). Contactors: ampsAC1 added to SC-E02..SC-E1 (20/20/25/32/50 A).
  - Heater fuses: Edison HCLR10..30 (class CC fast, fit EHCC holders), JHL20-1/25-1/30-1 (class J high-speed) with CH30J1/2/3 holders.
  - Temperature: C0-04THM (4-ch thermocouple), XTD2-0-UNV-S / XTD2-0500F-K / SC6-7102 (TC to 4-20 mA), SCU-3100 limit alarm (latching relay; AutomationDirect sells no FM high-limit controller; needs SCU-PDM2 to program).

- [x] **QA findings (manager)**: (1) "Change…" now reads voltage ratings written as text (`parseVolts`: '480Y/277 VAC/125 VDC', '240 VAC/125 VDC', '10-36VDC', '24VAC/VDC'); a lower AC rating (or DC-only on an AC circuit) is grey, e.g. GMCBU-3C-30 (240 V) on a 480 V branch. Breakers / fuse cartridges in a motor branch are grey when above the NEC 430.52 maximum (250 % breaker, 175 % time-delay, 300 % non-time-delay fuse, next standard size; not for IEC regions), e.g. 30 A for a 2.1 A motor (max 15 A). (2) Key ratings no longer double units ("480Y/277 VAC/125 VDC", "10-36VDC") and bare voltages get "V" ("24 V"). (3) Equipment fit: analog I/O points count against analog channels, not discrete inputs/outputs.

- [x] **Drive / power supply SCCR (manager, for Debug 2's UL 508A SB4 table)**: ratings.sccrKA + sccrCondition (upstream protection in plain words) + sccrSource (maker manual URL) on 106 drives, all from the makers' manuals. sccrKA is the rating with ordinary UL branch fuses / breakers and no extra parts; higher combinations are in the condition: GS10 / GS20 100 kA (Class T fuses); PowerFlex 525, G120C, V20, ATV630, GA500 (min. enclosure volume), GA800, 3G3M1, C2000 Plus 100 kA; ATV320 5 / 22 kA without the line reactor (65-100 kA with it); FR-E800 31 kA with Class J/T/CC fuses (100 kA only with semiconductor fuses, 10 kA with a breaker). No published rating, left empty: all power supplies (AutomationDirect, Rockwell 1606, SITOP / LOGO!POWER, Phaseo / ABLS, S8VK-C, Delta), Delta MS300 (manual behind a CAPTCHA; third-party copies say 5 kA, not used).

- [x] **Large enclosures (manager, for Debug 2's enclosure sizer)**: 66 parts from the makers' / AutomationDirect pages, drawings and datasheets. AutomationDirect (Saginaw): wall 1-door SCE-42EL3612LP / 48EL36xx / 60EL36xx / 72EL3612LP, freestanding SCE-603624FS / 723624FS / 72EL3624FS, 2-door floor (stands included) SCE-60EL4818LPPL / 60EL6018LPPL / 72EL6018LPPL / 72EL7218LPPL, 2-door freestanding SCE-724818FSD / 726018FSD / 727218FSD / 72EL4818FSD, each with its subpanel. Hoffman: A423612LP, A4836xxLP, A6036xxLP, A723624FSG, A72xx18FSDG (2-door), A726016ULP / A727216ULP (2-door with stands) + panels. Rittal: AX 1090/1180/1260/1280 (1-door), 1100/1213/1114 (2-door), VX25 8606/8805/8806 (1-door) and 8006/8206 (2-door) + VX mounting plates 5051.0xx. Engine golden (big machine) now picks SCE-42EL3612LP (46 % spare) instead of SCE-36EL3012LP (14 %).

- [x] **NEMA 4X enclosures (manager, unblocks a stainless sealing-head user)**: 122 AutomationDirect parts: Saginaw Enviroline 304 / 316L stainless wall-mount 24x20..72x36, freestanding 60x24..90x72 (1 and 2 doors), 2-door floor-mount 60x48..72x72; Stahlin fiberglass to 60x36; AttaBox / Integra polycarbonate to 24x24; all with subpanels. Enclosure fit and junction boxes keep the material family; NEMA 4X default stays stainless.
- [x] **HMI review (manager / user)**: every brand checked against the maker's datasheets (series, size, resolution, ports, protocols, cutout, power, software, lifecycle + successor, public list price). AB PanelView 800/5310/5510 (PV5310: Logix 5000 only; PV800: Micro800 + CompactLogix 5380 L306x); Siemens Basic 2nd gen / Unified Basic / Unified Comfort active, Comfort legacy; Weintek cMT X / servers / gateways / iP, iE / XE / eMT legacy; Schneider ST6 / STM6 / STW6 / STO / STU / GTO / GXU / ET6 / GTU; Pro-face GP4000 / GP4100 / GP6000 / SP5000 / ST6000 / STM6000 / STW6000 / ET6000; Omron NB / NA5 (new); Mitsubishi GOT2000 / GOT SIMPLE / GOT3000; Delta DOP-100 (models in Delta's DOP-100 catalogue); Red Lion G10R; Maple cMT / HMI5000; C-more list prices, EA9 legacy. Chooser grouped by maker / series with a size filter and a "Show legacy models" switch.
- [x] **Sourcing layer + cross-reference (manager, for Debug 1's Sourcing page)**: src/electrical/sourcing.ts (sourcingOf: list price + source, stock class + lead-time words, lifecycle + successor, checked date) with src/electrical/sourcingData.ts (610 records: AutomationDirect price / stock / lifecycle incl. 10 EOL with successors; Rockwell lifecycle + lead time; Schneider, ifm (prices), Omron, Mitsubishi, Delta status; Siemens / nVent / Rittal / Yaskawa publish nothing without login). src/electrical/crossref.ts: functionKey / crossReference / equivalents / differences (coil voltage, footprint, SCCR, kA, terminals, cutout, network). Next: Eaton / ABB / Phoenix / Weidmüller catalogs for the cross-reference functions.

- [x] **Cross-reference brands (manager, step 4)**: Phoenix Contact (30: QUINT4 / UNO supplies, PLC-RSC / RIF relays, PT push-in / UT screw terminals), Weidmüller (31: PRO TOP1 / ECO / BAS supplies, TRS relays, A2C / WDU / WPE terminals), ABB (92: AF contactors, TF42, MS132 / MS116, S200U UL 489 240 VAC, CP-E / CP-C.1 / CP-T, CR-M / CR-P), Eaton (12, partial: PSG supplies, XTCE B-frame; eaton.com blocks this environment, the rest is listed as not yet confirmed). Phoenix / Weidmüller / Eaton page text read through a search index of the makers' pages (their sites refuse direct requests). Cross-reference: 123 function groups; terminal sizes and trip class "10A"/"10" normalised; differences add "Mounts on" for accessories. HMI chooser lists built-in PLC panels (Unitronics, with Dev 2's PR #77).

- [x] **Large drives + Class T fuses (manager, from Debug 4's QA)**: AutomationDirect GS20 to 30 HP 460 V / 20 HP 230 V, GS30 to 100 HP 460 V / 30 HP 230 V, each with fuseClass / fuseAmps / fusePart (all GS drives) and SCCR (GS30 5-10 kA per the model tables, not the manual's general 100 kA); Edison TJN / TJS Class T fuses 3-350 A, Bussmann Class T blocks to 60 A (AutomationDirect retired the larger ones), Class J 60 A holders and 100 / 200 A blocks. Cross-reference: PowerFlex 525 to 30 HP, G120C to 150 hp, GA500 to 40 HP, ABB ACS180 / ACS380 to 30 HP, all with SCCR and fuse / breaker conditions from the makers' UL tables. Catalog test: apim.industry.siemens.cloud (Siemens datasheet host) allowed.

## CLICK / CLICK PLUS CPUs (all of them)
- Added the 19 CPUs the PLC profile offered but the catalog lacked (C0-11DD2E-D first): C0-11DRE-D, C0-12DD2E-D, C0-12DRE-D, C0-10ARE-D, C0-11ARE-D, C0-12ARE-D, C0-00DD1-D, C0-00DD2-D, C0-00DR-D, C0-00AR-D, C0-01DD2-D, C0-01DR-D, C0-01AR-D, C0-02DD2-D, C0-02DR-D, C2-01CPU, C2-02CPU, C2-03CPU.
- Footprints are read from each AutomationDirect drawing. All C0 units are 53.5 x 93 mm. C2-01CPU is 53.5 x 97.1 mm and C2-02/03CPU are 53.5 x 101.8 mm (including the plug and antenna connector; see footprintNote).
- I/O counts, output type and amps come from the AutomationDirect attribute data; ports from hardware manual ch. 4; `supplyCurrentMa` from the spec sheets.
- Correction: the AR/ARE CPUs are 24 VDC powered, like the others. Only their inputs are 100-120 VAC (`inputType`).
- CLICK PLUS: no on-board I/O, `optionSlots: 1`, and wifi/bluetooth flags. `powerWatts: 20` is AutomationDirect's maximum with the most I/O modules attached (`powerNote`).
- Prices and stock as of 2026-10-18 from each product page (JSON-LD), USD $104-$294. C0-00DD1-D is backordered until 11/02 and recorded as `short`.
- New catalog test: every CPU in CLICK_CPUS is in the catalog with a footprint.

## Enclosure cooling parts (fans, filters, AC, heat exchangers, thermostats)
- AutomationDirect (78): 19 Stego filter fans (115 VAC / 24 VDC, 12-391 CFM free-blowing, plus CFM with filters) and 9 matching exhaust grilles; 26 air conditioners (Stratus TA10/TA20, Saginaw NextGen, 1,195-14,300 BTU/h nominal); 16 heat exchangers (Stratus TE, Saginaw SCE-HE, 7.2-71.6 W/K); 8 Stego thermostats. Prices and stock (2026-10-18) are in sourcingData: 46 in stock, 25 short, 7 long. Saginaw's direct-ship / R-513A note is kept as `orderingNote`.
- nVent HOFFMAN (43), from maker PDFs (nvent.com blocks scripted reads): TFP fan packages 4/6/10 in. (25-215 CFM with one exhaust grille) and TEP exhaust packages from Cat-00004 (2018, so current availability is unconfirmed); SpectraCool N17/G28/G52 air conditioners from Spec-00750/00728; ATEMNC/ATEMNO thermostats.
- Rittal (29): Blue e+ filter fans (20-910 m³/h) and outlet filters, Blue e+ cooling units (780-5,500 W at L35/L35, plus the L35/L50 figure), TopTherm heat exchangers (17.5-60 W/K), SK 3110.000 thermostat. Part numbers use the existing '3237.710' style. The old TopTherm fans have been discontinued since 29 Apr 2025.
- Keys for the engine: `kind` (filter fan / exhaust filter / air conditioner / heat exchanger / thermostat), `airflowCfm` (+ `airflowM3h` for Rittal), `coolingW` / `coolingBtuh`, `wPerK`, `cutoutWidthMm`/`cutoutHeightMm`, or `cutout1..2WidthMm/HeightMm` + `cutoutCount` for two-opening units, `cutoutNote` where the cutout isn't a single rectangle (most AC/HX units; Hoffman AC cutouts are only in the instruction manuals), and `pairsWith` from fan to exhaust filter.
- Cross-reference: new "Enclosure cooling" groups for filter fans by CFM class and supply (AC / 24 VDC), air conditioners by capacity in W (BTU/h ÷ 3.412 when only BTU/h is published) and heat exchangers by W/K. That is 17 groups across AD / Hoffman / Rittal. A swap shows the airflow, cooling and cutout differences.
- Picker for the engine (src/electrical/cooling.ts):
  - `pickFilterFan(airflowM3h, { vendors, supply: 'AC'|'24VDC', volts, nema })` returns the smallest fan that moves the airflow with filters fitted, plus its exhaust filter.
  - `pickAirConditioner(watts, …)` and `pickHeatExchanger(watts, deltaK, …)` pick by capacity in the same way.
  - The `nema` filter doesn't count a type the part only reaches with an accessory hood (Rittal 4X).
  - Its input is `cabinetHeat().ventilation` (thermal.ts). Wiring it into the engine, layout and door/side drilling is Debug 2's work.
  - Test: src/electrical/cooling.test.ts. There is no 4X air conditioner in the catalog; 4X cabinets get the Stratus TE…-4X heat exchangers.
- Test change: the `amps` plausibility floor is now 0.01 A, since small fans draw 0.06 A.

## Servo systems: AutomationDirect SureServo2
- 213 parts:
  - 16 SV2A drives (230 V and 460 V, 400 W to 15 kW), with footprints from the AD spec sheet;
  - 52 SV2L/M/H motors;
  - 128 SV2C power, encoder and brake cables;
  - 17 accessories.
- Prices and stock come from each product page (2026-10-18).
- New categories: `servoDrive` (backplate), `servoMotor` (field) and `encoder` (field). Cables are `other` with kind 'servo cable' or 'encoder cable', plus `lengthM`, `forMotor` and `forDrive`.
- Drive keys: ratedWatts, inputVolts, inputPhases, outputAmps, peakAmps, controlModes, pulseInputMaxKHz (line driver 4000; the open-collector 200 kHz is in pulseInputNote), network, sto and stoRating, brakeOutput, regenResistor, pairsWith.
- Motor keys: ratedWatts, ratedTorqueNm, peakTorqueNm, ratedRpm, maxRpm, ratedAmps, flangeMm, shaftMm, encoder, brake and brakeVolts, inertiaKgm2, pairsWith, plus the powerCable and encoderCable families (`xx` = length code 03/05/10/20 m).
- Accessories that plug into the drive (comm modules, battery box, connectors, STO plug, SV2-TOR1 toroid) take no back-panel space. They are `mount: 'field'` with `mountsOn`.
- AutomationDirect lists no braking resistor, line reactor or EMC filter for SureServo2.
- Source typo kept as published: the SV2H-455B inertia equals the SV2H-445B figure (see inertiaNote).

## Imported (IEC / Chinese) parts → UL cross-reference ("Convert existing drawings")
- 273 imported parts, each from the maker's own catalogue (src/electrical/catalogs/foreignPartsData.ts):
  - CHINT (78): NXC contactors with one record per coil, NXR overloads, NS2 motor protectors, NXB-63 and NB1-63 MCBs, JXB terminals.
  - Delixi (45): CJX2s, JRS1Dsp, CDP6.
  - Schneider IEC-only (64): LC1D…M7C/F7C/Q7C, LRD, GV2ME, iC60N/iC65N/OSMC32N, XB2/XB4/XB5/ZB5.
  - Siemens 5SY6 (17), ABB S200 (16), Mean Well DIN supplies (25), IDEC RJ/RU relays (14), Omron MY/LY/G3NA/H3CR (14).
- Each record carries the maker's own UL wording. CHINT NXC/NXR/NXB, all Delixi parts and Schneider's Chinese-market parts state no UL listing. 5SY, S200 and NB1-63 are UL 1077 supplementary protectors.
- These parts are kept OUT of the catalog, so a new design never picks one.
- `FOREIGN_PART_DATA` (catalogs/foreignParts.ts) is keyed by the exact part number and uses Debug 1's DrawnRatings units (`drawn`). It also holds `part`, the full record. `foreignPart(pn)` ignores case and spacing.
- `foreignEquivalents(pn)` (src/electrical/foreign.ts) returns UL catalog parts with their differences:
  - contactors: same poles and at least the AC-3 current;
  - MCBs: same poles and curve, current within 20 % (16 A → 15 A, listed as a change), UL 489 first; UL 1077 is flagged as not branch rated;
  - overloads: a range that contains the middle of the drawn range;
  - supplies: same voltage, at least the current;
  - relays: 1CO = SPDT, 2CO = DPDT, same coil first;
  - 22 mm operators: same colour.
- Every CHINT and Delixi contactor, overload and motor protector has at least one UL equivalent (tested).
- Automation parts:
  - 131 imported parts added: Inovance H3U/H5U/Easy PLCs, GL20 modules and MD290/MD500 drives; Xinje XD3/XD5, VH1/VH5 and TG HMIs; Mitsubishi FX3U/FX3G and FR-D700 -CHT; Autonics PR/PRD/BJ sensors, E40/E50 encoders and TCN/TK controllers; Omron E2E/E3Z/E5CC/E6B2.
  - The 7 Inovance MD200 drives were left out: their part numbers were assembled from a brochure pattern, not printed.
  - Records whose maker documents state no UL get `ul: 'not stated in the maker documents read'`.
  - Delta (UL listed, sold in North America) went into the catalog instead (delta.ts, 39 parts): DVP-ES2/EX2/SS2 and AS200/AS300 CPUs, DVP modules, VFD-E, and MS300 1-phase 230 V. The 3 MS300 drives without the EMC filter are unverified (their output current comes from the same-kW filtered model).
  - New matching rules:
    - PLC: inputs and outputs at least the drawn ones, same output type.
    - Sensors: same type and PNP/NPN.
    - Encoders: same PPR and output type (encoder catalog parts are still to come).
    - Drives use the cross-reference HP/voltage key.
- Gaps:
  - Delixi MCBs and CHINT DZ47: the maker pages are captcha- or 403-blocked.
  - Fuji: already in the catalog under AD part numbers.
  - IDEC pilot lights and pushbuttons.
  - The 12 V supplies and Omron timers/SSRs have no catalog equivalent yet.
  - The CHINT JXB footprints are unverified.

## Servo systems: Allen-Bradley Kinetix 5100, Siemens SINAMICS V90, Inovance (imported)
- **Kinetix 5100** (allenBradley.ts, 133 parts):
  - 16 2198-E… drives (230/480 V): ratings and dimensions from KNX-TD003N, pulse input from 2198-UM004 (4 MHz line driver), SCCR 5 kA.
  - 72 TLP motors (KNX-TD001J), with pairings from KNX-RM011D. TLP-B235-11K is paired with E4150 only: its 70 A peak exceeds E4075's 53.3 A.
  - 45 continuous-flex cables (…-xxF). The standard cables were discontinued in May 2024.
- **SINAMICS V90** (siemens.ts, 133 parts):
  - 30 PN/PTI drives (200/400 V) from each part's Siemens datasheet. The PTI pulse input is 1 MHz line driver / 200 kHz optocoupler. The PN versions have no pulse input.
  - 76 1FL6 motors (keyed or plain shaft, with or without brake) and 27 MOTION-CONNECT 300 cables, with pairings from catalog D33.
  - The 4 new FSA drives are on the unverified list: their datasheets give no peak current.
- **Inovance SV660P** (imported data): 27 MS1 motors. The 12 drives were left out because their part numbers would be assembled from a pattern.
- **Delta ASDA-B3/A3:** not added. Delta's documents now sit behind a captcha; it was not bypassed, and third-party copies were not used.

## Encoders, ultrasonic sensors, CLICK high-speed counter / pulse output limits
- **Encoders (category `encoder`):** 225 AD-sold JTEKT/Koyo incremental encoders (TRD-N/NH, TRD-SR, TRD-GK, TRDA-20, TRDA-25) plus 6 TRDA-25 cables. Fields: ppr, outputs, outputType, supplyVolts, maxFreqKHz, shaft/bore.
  - Retired lines were not added (TRD-S/SH, TRDA-2E, TRD-MX).
  - Encoder Products base models were dropped: full order codes are built from an ordering guide, and AD does not sell them.
- **Ultrasonic sensors** (category `sensor`, type 'ultrasonic', with rangeMm, rangeMinMm and rangeMaxMm):
  - AD Micro Detectors UK1/UK6 (100): PNP, NPN, 0-10 V, 4-20 mA, and analog + PNP.
  - Pepperl+Fuchs UB (20) and Banner T30UX/QS18U/S18U (20) are new vendors (`pepperl`, `banner`). Their source is the maker datasheet PDF.
  - Baumer was not added: baumer.com returned 403 to every request.
- **Prices:** 353 AD prices and stock records (2026-10-18).
- **File split:** the new AD parts are in automationdirectSensors.ts. automationdirect.ts became too large for the TypeScript compiler to type as one list (TS2590).
- **CLICK high-speed limits, as data on the CPUs** (hsc*/pto* keys, manual page in hscSource):
  - C0-10/C0-12 Ethernet DC CPUs: 4 HSC on X001-X004, 2 quadrature (1 with Z), 100 kHz.
  - C0-11: 6 HSC on X001-X008, 3 quadrature (2 with Z).
  - The C0 CPUs have no PTO (ptoNote says so). C0-0x and AC-input CPUs have no high-speed inputs.
  - CLICK PLUS C2-0xCPU: the limits come from the module in option slot 0. C2-14D1/D2/TTL give 6 HSC, 4 quadrature, 3 PTO axes on Y1/Y3/Y5 at 100 kHz. C2-08D1/D2 give 2 axes on Y1/Y3.
- **New CLICK parts:** 13 option-slot modules, 3 two-slot CPUs (-2) and 6 C0 Ethernet Analog -1/-2 CPUs.
  - The slot modules have no footprint of their own because they sit inside the CPU.
  - The -2 CPU width (80.5 mm) comes from the manual drawing. Both are on the unverified list with the reason.

## Troubleshooter: device fault knowledge (src/troubleshoot)
- The API is in deviceFaults.ts: DeviceFaultProfile holds normal terminal readings per state, LED/display meanings, and faults (code, symptom, causes, confirm, fix, source). Lookups: faultProfilesFor(part) (most specific first), faultCode(part, code) and faultsMatching(part, words).
- The test checks that every source is an https URL, every match selects a real catalog or imported part, codes are unique per profile, and each fault has symptom, confirm and fix.
- Drives and servo (faults/drives.ts): 5 profiles, 408 faults, all from the maker manuals with chapter and page.
  - GS20 (75), GS10 (60), GS30 (85): every keypad code (ocA, ovd, GFF, oH1, cF2, CE10 …). Confirm steps use fault records P06.17-22 and the values at malfunction (P06.34 DC bus, P06.35 current, P06.40 DI status). Normal readings include the supply range, the DC bus band between Lv and ov, +24V-DCM, DI levels for source and sink, and STO1/STO2 to SCM.
  - Inovance MD290/MD500 (37; codes E002.0… with the Err02 panel text in the symptom).
  - SureServo2 (151 alarms AL001-AL809; P0.001 and P4.000-004 history; STO state table).
- I/O and field devices (faults/ioField.ts): 28 profiles, 240 faults.
  - CLICK C0 and CLICK PLUS CPUs, with every error code (101-108, 201-205, 301-384, 001, 109); DC inputs (sink/source, with the C1 wiring for PNP vs NPN); AC inputs; sinking, sourcing and relay outputs; analog, thermocouple and built-in analog; option-slot I/O.
  - PNP/NPN inductive and photoelectric sensors; ultrasonic sensors (AD UK1/UK6, P+F UB, Banner T30UX/S18U/QS18U); TRD encoders by output type; GCX pushbuttons and E-stops; Mindman valves.
  - To check: the C0 sourcing-output common extracted as "CO" and may be "C0" on the part.
- Power and protection (faults/power.ts): 28 profiles, 87 faults.
  - Rhino PSR/PSN/PSL, QUINT4, SITOP PSU6200 and S8VK-C supplies; Gladiator, S200U, 5SJ4, C60BP and 1489-M breakers; Class T, J and CC fuses; Fuji SC-E contactors and TK-E overloads; 78x, GQ and GRS-H relays; Dold, IDEM, 440R, 3SK1 and XPSUAF safety relays.
  - The QUINT4 data sheet was read from a distributor's copy of Phoenix's own document, because Phoenix refused scripted access.
  - No maker states a "~0 V across a healthy fuse" figure, so the fuse profiles use the Bussmann continuity test.
- Extension (manager request):
  - **VFDs (faults/vfd2.ts):** PowerFlex 525 (51), G120C (103), V20 (50), GA500 (184), ACS380 (191). Each drive's fault-history parameters are used in `confirm`, with relay pairs per state. For five V20 codes the manual gives no remedy, so their fix says exactly that instead of an invented remedy.
  - **Servos and controllers (faults/servoCtrl.ts):** Kinetix 5100 (115), V90 PTI 400 V (105) and PN (86), Micro800 error codes (61) plus Micro820/850 and 2085 I/O, CompactLogix 5380 (201: major faults and #xxxx I/O codes), Compact 5000 I/O, and Unitronics UniStream/Vision/Jazz.
  - **Pilz PNOZ s3 / X2.8P** (faults/pilz.ts and catalog vendor `pilz`).
  - **Pins and internal pairs** backfilled into the 61 earlier profiles (194 of 237 readings; 105 pairs).
  - `symptomKind` and `faultsOfKind()` added for Dev 2. faultCode() ignores spaces and dots, so 'E001' finds Kinetix 'E 001' and 'AL009' finds 'AL.009'.
  - **Total:** 83 profiles, 1,933 faults.
  - **Gaps:**
    - V90 200 V PTI: the 2021 manual returned 403.
    - Unitronics publishes no numeric system-error list in these guides.
    - Micro800 plug-ins: 2080-UM004 not read.
    - ACS355: not in the catalog.
    - Delta drives: their manuals are behind a captcha.
- Coverage of the families asked for:
  - Every CLICK part, every encoder, fuse, safety relay and valve, the GS drives and SureServo2.
  - Other brands' contactors, overloads, VFDs and servo motors have no profile yet.
- Gaps:
  - Delta VFD-E/MS300/C2000: manuals are behind a captcha.
  - No drive manual gives a DC bus nominal value, so only the trip band is used.
  - In the GS20 short-circuit check, one terminal is a symbol that did not extract. The text says so instead of guessing the terminal.

## Roll former / servo flying shear (Debug 1's acceptance case)
- **Machine symptom map** (machineSymptoms.ts + machineSymptomData.ts), roll-former-flying-shear, 6 symptoms:
  - cut-length-wrong (7 causes; EPC TB-108 ranks wheel misalignment as the most common);
  - shear-does-not-fire (5), material-slips (5), shear-cuts-crooked-or-burr (2), line-stops-servo-alarm (5), hydraulic-cutter-slow (5).
  - Each cause has devices (fault profile ids or categories), checks, fix and a maker source.
  - Ranking is the sources' own where they state one; otherwise it follows the documents' emphasis and the cause's `mechanism` says so.
- **Device fault profiles** (faults/rollformer.ts), 10 profiles, 50 faults:
  - Omron E6B2-C encoders, NPN and line driver.
  - Omron H7CX counters, with E1/E2/E3 codes, CP1/CP2 NPN/PNP levels, the factory 30 Hz count-speed trap, and output contact pairs.
  - Rexroth 4WE6 DC solenoid valves and HED 8 pressure switches.
- **Imported-part data:**
  - 15 Omron H7CX counters, discontinued in 2023 (the H7CC successor is named in each record).
  - 16 Rexroth 4WE6/3WE6 valves (24 VDC K4).
  - 8 HED 8 pressure switches, unverified: data sheet RE 50061 needs a Rexroth login.
- **foreignPart() now ignores spaces**, so Rexroth's '4WE 6 E6X/EG24N9K4' finds its record.
- **Gaps:**
  - Delta ASDA-A2: deltaww.com is behind a captcha and Delta EMEA redirects there; no mirrors were used.
  - "KT timers": KT is the Chinese drawing letter code for a time relay, not a brand.
  - Huade 4WE6: no English data sheet on huade-hyd.com.
  - Blade wear / burrs, and strip slip in the roll stands: no maker document covers them.

## No-PLC roll-former → CLICK conversion: catalog coverage
- **Already covered:** CLICK PLUS C2-0xCPU + C2-14D1/D2/TTL (3 PTO axes and 6 HSC at 100 kHz); GS20/GS23; SureServo2; TRD encoders; 17 safety relays.
- **CLICK C0 modules (17):**
  - Discrete: C0-08NE3, C0-16NE3, C0-08NA, C0-08ND3-1, C0-08TD2, C0-08TA, C0-08TR-3, C0-04TRS-10, C0-08CDR, C0-16CDD2.
  - Analog: C0-04AD-2, C0-04DA-2, C0-4AD2DA-1/-2, C0-04RTD.
  - Simulators: C0-08SIM, C0-04POT.
  - C0-00AC is retired; C0-01AC is the current CLICK power supply.
- **Encoder accessories (48):**
  - Measuring wheels: Wachendorff MR200/MR500 (10 mm bore, fits TRD-GK); Lika AR01X 250 mm / 12.5 in with BR1 reducer bushings.
  - Lika AR01 complete measuring-wheel kits (encoder + wheels + spring arm + bracket).
  - 14 couplings and 13 brackets.
  - Gap: AD sells no spring arm for the TRD encoders. The WDGMA arms fit Wachendorff WDG 58V/WDGI 36J only.
- **Safety outputs:**
  - Dold LG5929 (5 N.O.) and UG6929-60/61/62 (5/6/7 N.O.) expansions.
  - IDEM SCR73 base relay with 7 N.O. Its spec sheet transposes N.O./N.C. and prints PFHd 7.20E-05; both are noted.
  - Pilz PNOZ s7 (4 N.O. + 1 N.C.) and s7.1 (3 N.O., cascade) for the PNOZ s3.
  - Combinations covering 2+2 STO channels + valves: PNOZ s3 + s7 = 6 N.O.; LG5925 + UG6929-62 = 10 N.O.; SCR73 = 7 N.O.
- **Prices:** 71 AD prices and stock records. STP-MTRA-SC-3812 is end of life, successor SRBA-32C-9.525-12.7.

## Fault knowledge: review fixes (old main) and copyright rewrite
- **Safety:**
  - Dold LG5925: the S33-S34 bridge advice is replaced (never bridge on an E-stop or guard relay).
  - STO jumper / bypass / CN10 plug fixes (PowerFlex 525, GA500, Kinetix 5100, SureServo2 AL500, GS10 / GS20 / GS30 SrL / Sto short-circuit lines) are in `fixIfNoStoWiring`, behind `fixesFor(fault, { stoWired })`. Unknown STO wiring counts as wired. A test fails on any ungated STO jumper, short-circuit line/plug or bridge fix. Disabling DC-link monitoring (servo) or phase-loss detection (L8-05 = 0) is prefixed "Only after confirming the supply is correct; a qualified person must decide".
  - CLICK output overrides and valve manual overrides carry "Keep everyone clear" (tested).
  - LIVE_WORK_CAUTION + `readingsFor(profile)` / `needsLiveWorkCaution()`, decided by what the terminals connect to.
- **Lazy loading:** `loadFaultKnowledge()` (knowledge.ts) keeps the knowledge out of the main and preview bundles.
- **Copyright:** the 3,550 text fields over 150 characters were rewritten in our own short words (cause / check / fix). Only codes, parameters, terminals, values and the citation are kept. kbText.test.ts fails on any text field over 150 characters (URLs and citations not counted). The 156 remaining manual-style lists ("•" bullets, "1. … 2. …" steps) were also reworded; none are left.
  - Dropped from the rewrite: list numbering, words such as "2nd" / "7-segment", the generic "H2-xx" (the specific H2-01 to H2-03 is kept), and a few long aux-code lists, which end in "(see source)".
- **IDEM SCR73:** verified from IDEM's own data sheet 102581 (Jan 19) p.3: PFH 8.4E-10 1/h, SIL 3, PL e, Cat. 4, MTTFd 71 a, DC 99 %. The AD spec sheet's "PFHd 7.20E-05" is IDEM's PFDav figure under the wrong label.

## Allen-Bradley CompactLogix 5370 (1769), for L5X upgrades
- 34 parts in allenBradley.ts, from Rockwell product pages and 1769-TD005 / TD006 / TD008 / IN015:
  - 13 CPUs: L30ER / L30ERM / L30ER-NSE / L33ER / L33ERM / L36ERM, L16 / L18 / L18ERM / L19ER-BB1B, L24ER-QB1B / L24ER-QBFC1B / L27ERM-QBFC1B.
  - 15 Compact I/O modules, PA2 / PA4 / PB2 / PB4 supplies, and ECL / ECR end caps.
- Lifecycle: the L1 CPUs are Active; everything else is Active Mature.
- LOGIX_CPUS gains the 12 CPUs (id = catalog number), appended after the 5069 ones. builtInInputs / builtInOutputs are 16 / 16 on L1 / L2.
- Platforms:
  - ab-compactlogix-5370: L2 / L3 with 1769 modules.
  - ab-compactlogix-5370-l1: expansion is 1734 POINT I/O, which is not in the catalog.
- No HMI driver list names the 5370 yet, so panels show as unconfirmed for it.
- 1769 I/O addressing (Local:n:I.Data bit-of-DINT) is Dev 3's. L19ER-BB1B (1 MB, 8 nodes, 8 POINT I/O; TD005O) is in the catalog only: LOGIX_CPUS and the L1 platform are Dev 3's to extend.
- Checked against 1769-UM021K / TD005O: L1 embedded inputs are 24V DC sink only (L2 are sink/source); QBFC1B has 4 high-speed counters.

## How it was verified
- `npx tsc -b`, `npx eslint src` clean; unit tests pass incl. new `npx tsx src/electrical/labels/layout.test.ts` (every preset × content × orientation: text inside the label, number never overlaps the description).
- Label-printer PDFs checked with `pdfinfo`: 38x12 → 107.717 x 34.016 pt, 12x6 → 34.016 x 17.008 pt, 25x10 → 70.866 x 28.347 pt, 70x30 → 198.425 x 85.039 pt (all exact); 199 pages for the example project (copies included). Rendered with `pdftoppm` and inspected: bold number + description beside it, tape length follows text, rotated text OK, legend plates.
- Sheet PDF (Letter): 2–3 pages, cut lines, header with size/content/page.
- Full package (example project): 80 pages; contents page numbers match; bookmarks checked with pypdf (Cover, Contents, 7 parts, 19 drawing sheets and 6 HMI screens nested); package stamp sits below the drawing border on ANSI B sheets.
- E2E (`BASE_URL=http://localhost:5201 node e2e/app.e2e.cjs`): new steps — label-printer PDF (every page 25.0 x 10.0 mm), sheet PDF, CSV rows, Excel sheets, full package PDF with bookmarks (pdf-lib), ZIP contains `labels/*` and `*_full_package.pdf`.

- Brady supplies: `pdfinfo` page sizes B33-80-427 36 x 54 pt (12.7 x 19.05 mm), THT-136-499-3 108 x 54 pt, M4-91-427 72 x 108 pt, M21-1000-427 tape 25.4 mm high with text only in the 9.53 mm band; rendered and checked. Unit test: every supply's text stays inside its printable area, every supply references known printers and has an https source. E2E: Brady i3300 + B33-80-427 → 199 pages, all 12.7 x 19.1 mm.
- Match the roll: unit test checks every liner row fits with equal margins; E2E prints i3300 + B33-80-427 with "match the roll" → 50 pages of 63.5 x 19.05 mm (199 labels, 4 per row); rendered page shows 4 labels at 2.54 + k x 15.24 mm with text in the printable band.
- Desktop print: E2E mocks `window.isaDesktop.print` and clicks "Print labels" → job 25 x 10 mm, scale 'actual', uniform page size, dialog shown, PDF bytes passed. Excel: E2E checks the Brady steps are in the workbook; sheet read back with openpyxl.
- Purchasing: price test (58 prices, sources, pack units); E2E — order list card, AutomationDirect order file (26 lines, all `PN,qty`), purchase summary PDF 1 page, order list Excel, full package 73 pages / 10 bookmarks, ZIP has `purchasing/*`. Rendered the summary for us480 / big / ca600 / us120: 1 page each.

## Brady data — what is verified / to check
- Brady's own sites (bradyid.com, brady.eu) returned HTTP 403 to the research, so every entry cites a Brady spec sheet hosted by a distributor (l-com, RS, DigiKey, goind) or a distributor product page (Advanced Automation, DigiKey, Global Industrial) showing the Brady part number and size.
- To check (marked in the UI): printable area of die-cut M6-18-427, M6-32-427, M4-91-427 (not stated; text uses the whole label); M6-125-175-342-WT compatibility with the M611 (inferred from the M6- prefix); THT-14-498-10 as a terminal marker (inferred from size); M-48-427 and M-131-499 are older BMP41 datasheet numbers (may be superseded by M4- parts).
- Not found / not included: verified terminal-block markers for M611, BMP41/BMP51 and i3300/i5300; i7100 dpi (300 and 600 dpi models exist); BMP51 may be discontinued (replaced by M510) — not confirmed.
- Liner geometry: liner ("web") width and label repeat across the roll are from Brady's spec fields on advanced-automationinc.com product pages; gap = repeat − label width; the edge margin is not published, so the row is assumed centred. That gives 2.54 mm (0.1 in) on all four rolls, which supports the assumption. The UI shows a "To check … test print" note for it.
- The PermaSleeve rolls PS-250-2-WT-S-2 and B33-187-2-342-2 state two different widths (web 88.65 mm vs roll 50.8 mm) and no label repeat → "match the roll" stays disabled for them.
- Corrected from the liner data: B33-5-422 is 25.4 mm across the roll and 12.7 mm along it; THT-64-427-3's 57.15 mm side runs across the roll (noted).

## Notes / questions
- 12x6 mm markers with "number + description" are cramped by nature; "number only" is the sensible choice there.
- "Print" in the claude.ai preview window saves the PDF instead (printing is blocked there).
- Brady part numbers: only entries verified on Brady / distributor pages go into `printers.ts`; anything unverified is listed here.

## Motion parts, safety data and the supply swap (after the 0e7b78c merge)
- **IDEM SCR73-280005 / -P:** verified from IDEM's data sheet 102581 (Jan 19): PFH 8.4E-10 1/h, SIL 3, PL e, Cat. 4, MTTFd 71 a, DC 99 %. AD prints PFDav 7.2E-05 as "PFHd".
- **SINAMICS V90 FSA (-1UA2 / -2UA2 / -1UF2 / -2UF2):** peak current 3.6 / 4.2 A confirmed in Siemens D 33 07/2022 p.2/6, so now verified.
- **IP ratings added:** Kinetix TLP is IP40 without a shaft seal; IP65 needs the S option or a TLP-SSN seal kit (KNX-TD001J p.129 / 207). S-1FL6 is IP65 with an oil seal (D 33 p.1/17).
- **Coverage for servo / encoder / ultrasonic machines, all verified and sourced:**
  - Servo systems (drive + motor + power/encoder cables): SureServo2, Kinetix 5100 + TLP, V90 + S-1FL6.
  - Encoders: TRD-N / TRDA-20 / TRDA-25 (line driver and push-pull), TRD-SR, TRD-GK.
  - Measuring wheels: MR wheels and the AR01 measuring-wheel encoder kit.
  - Ultrasonic sensors: UK1 / UK6, P+F UB, Banner T30UX / S18U / QS18U, each with 4-20 mA and discrete versions.
- **Gaps left:**
  - Only the TLP motors without a shaft seal (option A) are in the catalog; the S variants are not.
  - Measuring wheels and cables have no IP rating, because their makers give none.
- **Swap picker:** compareStrength now refuses a power supply with a different input class, and a candidate whose AC input range does not hold `StrengthContext.feedVolts` (Dev 4 passes the PS feed from the picker). A 90-264 VAC supply is no longer "Equivalent" to a 480 V 3-phase one. A 200-500 V L-L supply (ABL8RPS) may stand in for a 1-phase or 3-phase one, but not the reverse. The cross-reference key carries the same input class (crossref.ts / strength.ts supplyInputClass).
- **Touch panels for CompactLogix 5370** (both `ab-compactlogix-5370` and `-l1`). Before this, no panel listed 5370, so an L5X upgrade that keeps its 1769-L33ER could not get an HMI. Each entry gives its source in `drivers5370Source`.
  - Rockwell names 5370 for the PanelView 800 (VIEW-SG002D p.12; product page: "5370 L1, L2, L3"), the PanelView 5310 (2713P-TD001K p.3, firmware V27+) and the PanelView 5510 (2715P-TD001G p.1).
  - Pro-face's driver manual ROC_ETIP_27 names the 1769-L1x/L2x/L3x CPUs, in its L5K import lists.
  - Weintek, Maple and Red Lion only say "CompactLogix", without naming a series. That is the same basis on which they already list 5380.
  - C-more (Dev 5's HMI list) also says only "CompactLogix" (ea9drivers.pdf). Neither the PanelView Plus 7 nor the C-more is in the catalog's driver lists.
  - Test: a 1769-L33ER has at least 10 compatible panels, including Allen-Bradley ones (platforms.test.ts).
  - Review fixes:
    - The serial-only Pro-face GP4100 panels (PFXGP4115T2D / T3D, PFXGP4116T2D) no longer list any CompactLogix driver.
    - Tests: a Logix driver needs ethernetPorts > 0; the 5370 / 5370-l1 / 5380 ids stay in step; L1 works on Weintek and Red Lion panels.
    - PanelView 5310 / 5510 carry `logixFirmwareMin: 27` (controller firmware V27 or later). The upgrade plan should check the L5X's firmware against it.
- **PanelView Plus 7:** Standard 2711P-T7/T10/T15C22D8S and Performance 2711P-T7/T10/T15C22D9P. 6.5 / 10.4 / 15 in, 4:3, 24 VDC, 2 x Ethernet (DLR), FactoryTalk View ME.
  - Size, resolution, power, cutout, dimensions and weight come from 2711P-TD008J / TD009M. Lifecycle is Active on each product page.
  - CompactLogix 5370 is named in the TDs. 5380 appears only in the portfolio comparison 2711P-SP011L (Nov 2025).
  - Standard catalog numbers end in D8S (series D needs firmware 13.x or later). "-B" means no brand label, not a series.
- **Panels with no Ethernet port:** a panel keeps a PLC family only where the panel maker's own serial or fieldbus driver names it. Generic Modbus does not count; unclear cases are removed. The route, any module needed and the source are in `serialRouteNote`.
  - Pro-face GP4115T2D / T3D (RS-232) keep M221, CP2E and FX5U/UC (via FX5-232 boards). GP4116T2D (RS-485) also keeps S7-1200 via a CM 1243-5.
  - Omron NB loses S7-1200 (Ethernet only). It keeps NX1P2, which needs an NX1W-CIF option board.
  - Mitsubishi GT21 loses S7-1200, S7-1500 and NX1P2.
  - Delta DOP-100 serial models keep only DVP and AS300.
  - KTP Basic DP needs a CM 1243-5 on an S7-1200, and a DP CPU or CM 1542-5 on an S7-1500.
  - Tested in platforms.test.ts.
- **PLC module a serial panel needs:** `ratings.plcModules` ("platform-id=module; …") on the serial-only and PROFIBUS panels. `plcModuleFor(hmi, platformId)` in platforms.ts returns it, or null when nothing is needed.
  - Modules: CM 1243-5 on an S7-1200, CM 1542-5 on a non-DP S7-1500, FX5-232-BD/ADP on an FX5U, NX1W-CIF01 on an NX1P2, CP1W-CIF01/11 on a CP2E-N.
  - The picker (Dev 5) shows the note and the BOM (Dev 4) adds the module. The modules themselves are not catalog parts yet.
- **PLC interface modules as verified catalog parts** (category `commModule`, never the I/O `plcModule`, so they never take an I/O slot or shift addresses). Each comes from its maker's datasheet or manual.
  - The parts:
    - Siemens CM 1243-5 (6GK7243-5DX30-0XE0, 30 x 100 mm, 24 VDC 0.1 A).
    - Siemens CM 1542-5 (6GK7542-5DX10-0XE0, which supersedes DX00; 35 x 142 mm, 200 mA at 15 V on the backplane).
    - Mitsubishi FX5-232-BD (board; FX5S/UJ/U only, not FX5UC).
    - Mitsubishi FX5-232ADP (17.6 x 106 mm adapter).
    - Omron NX1W-CIF01 and CIF11.
    - Omron CP1W-CIF01 and CIF11.
  - The boards carry `inCpu: 'yes'`: they take no panel space.
  - `plcModulePart(hmi, platformId)` returns the bare part number, for the BOM and the rack.
- **Operator contacts in one form:** every maker now writes "(1) N.O." / "(1) N.C." (22 Allen-Bradley / Siemens / Schneider entries normalized). This lets the pushbutton pick choose non-AutomationDirect buttons. Enforced in catalog.test.
- **Siemens SIRIUS ACT 3SU1 complete units**, from the Siemens TED datasheets:
  - 1 NO, plain: blue (reset), black, yellow, white.
  - 1 NO, illuminated with a 24 V AC/DC LED: white and blue.
  - Front IP66/67/69K, 22.3 mm hole, 49.7 mm behind the panel.
  - The 230 V and metal variants are left out.
