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

### 3. Questions with the answer under each question (URGENT user request)
- [x] `src/components/questions/`: `QuestionList` — each question is a card with its answer box directly under it, quick choices (Yes / No, the alternatives named in "A or B" questions, "Correct as stated" for stated assumptions), "Don't know — use the AI's assumption", status (open / answered / AI's assumption used), "Change". `useQuestionStore` keeps questions + answers per project id (persisted; survives reload and project switch). Answers are merged into the spec automatically ~1.5 s after the last answer: one spec-AI call with all new answers, or (no AI / AI error) appended under "Answers to open questions" in the matching section (word-overlap guess). Changing the spec makes the later stages out of date, so Update uses the answers.
- [x] Used in: Machine description (SpecIntake "Open questions"), I/O (review dialog + above the I/O table while open), Electrical "Assumptions to confirm", HMI "To confirm" tab, Design review (all stages in one list + review "info" items that need input). Open-question counts in the project tree (Machine description, I/O list, Electrical design, HMI screens, Design review).
- [x] Tests: `npx tsx src/components/questions/questions.test.ts` (quick choices, section guess, plain merge); E2E answers "How many parts per minute at most?" under the question, waits for "Added to the spec", checks the spec overview contains it. Two minimal E2E fixes: review "Save" click made exact (the page now also has "Save answer"), and the review → program step waits for the program's request box.

### 4. Purchasing (manager assignment)
- [x] Order list (`src/deliverables/purchasing.ts`, card `src/deliverables/OrderListCard.tsx` on the Deliverables page, "Order list" button on the Electrical page): BOM rolled up per part number, optional recommended spares (same rule as the maintenance chapter) and label supplies from the Labels tab (rolls from labels to print ÷ labels per roll), grouped by supplier (from the catalog product page; "Supplier to confirm" otherwise). Parts sold in packs are ordered in packs (catalog `packQty`, e.g. 31 terminals → 1 pack of 100). BOM items without a part number are listed as "still to select". Exports: order list Excel / CSV.
- [x] AutomationDirect ordering: order file = one `PartNumber,Quantity` line per part, no header — the format of AutomationDirect's cart "CSV Upload" (help page https://www.automationdirect.com/help/csvupload: two columns, item code and quantity, example `D2-04B-1,4`); the same lines can be copied for the cart's "Enter Items" paste box ("PartNumber and Quantity separated by comma, tab, or space", max 4000 characters — the app warns above that). Step-by-step instructions in the card.
- [x] Prices (`src/electrical/prices.ts`): 58 list prices, every part used by the example and test variants, read on each part's automationdirect.com page on 2026-10-16 (JSON-LD offers.price, equal to the displayed price; selling unit from the page's pack attribute). Extended prices, supplier subtotals, total of verified prices; parts without a price show "price to confirm" and are left out of the total; "List prices as of <date>, USD, excl. tax and shipping". Unit test: every price links to the supplier's page for that exact part and its selling unit matches the catalog pack size.
- [x] Purchase summary PDF (`src/deliverables/purchaseSummaryPdf.ts`): one page (customer, job no., revision; supplier groups with need / spares / order qty / unit / unit price / extended; totals; to-select items; price basis) — one page for all four test variants (pdfinfo). In the ZIP (`purchasing/`: summary PDF, order list CSV, one order file per supplier) and in the full package (new part after the BOM).

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
