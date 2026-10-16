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
- [ ] **NEW (user): label-printer selector** — brand (Brady first; structure ready for Brother, Weidmüller, Phoenix Contact) → model (M211, M611, BMP21-PLUS, BMP41/BMP51, i3300, i5300, i7100) → compatible supplies with real part numbers, sizes and material. Choosing a supply sets label size, printable area, orientation and labels per page, and the CSV/Excel columns for Brady Workstation. Data in `src/electrical/labels/printers.ts` with a source URL per entry; only verified part numbers; remembered per project.

### 2. Full package PDF
- [x] `src/deliverables/fullPackage.ts` (pdf-lib): cover + contents with page numbers, engineering package, electrical drawings, HMI screens, PLC program listing, I/O list, BOM, label list
- [x] New PLC program listing PDF (`src/deliverables/programListingPdf.ts`): blocks, every rung with comment, contacts/outputs and plain-words logic, tag table, program check
- [x] PDF bookmarks per part (drawing sheets and HMI screens nested), package page number on every page
- [x] Deliverables page: "Full package" card (download / print, progress bar) and "Labels" card
- [x] Project menu: "Print full package…" (→ `/export?action=print-full`), "Print labels…"
- [x] "Download everything" ZIP includes the full package PDF and `labels/*` (CSV, Excel, label-printer PDF, sheet PDF)

## How it was verified
- `npx tsc -b`, `npx eslint src` clean; unit tests pass incl. new `npx tsx src/electrical/labels/layout.test.ts` (every preset × content × orientation: text inside the label, number never overlaps the description).
- Label-printer PDFs checked with `pdfinfo`: 38x12 → 107.717 x 34.016 pt, 12x6 → 34.016 x 17.008 pt, 25x10 → 70.866 x 28.347 pt, 70x30 → 198.425 x 85.039 pt (all exact); 199 pages for the example project (copies included). Rendered with `pdftoppm` and inspected: bold number + description beside it, tape length follows text, rotated text OK, legend plates.
- Sheet PDF (Letter): 2–3 pages, cut lines, header with size/content/page.
- Full package (example project): 80 pages; contents page numbers match; bookmarks checked with pypdf (Cover, Contents, 7 parts, 19 drawing sheets and 6 HMI screens nested); package stamp sits below the drawing border on ANSI B sheets.
- E2E (`BASE_URL=http://localhost:5201 node e2e/app.e2e.cjs`): new steps — label-printer PDF (every page 25.0 x 10.0 mm), sheet PDF, CSV rows, Excel sheets, full package PDF with bookmarks (pdf-lib), ZIP contains `labels/*` and `*_full_package.pdf`.

## Notes / questions
- 12x6 mm markers with "number + description" are cramped by nature; "number only" is the sensible choice there.
- "Print" in the claude.ai preview window saves the PDF instead (printing is blocked there).
- Brady part numbers: only entries verified on Brady / distributor pages go into `printers.ts`; anything unverified is listed here.
