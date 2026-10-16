# Deliverable checkers

Repeatable checks of everything the app hands to a machine builder: machining DXF, cabinet STEP,
PDFs (engineering package, drawing set, HMI screens), Excel report, CSVs, labels and the ZIP.

```bash
npm run dev -- --port 5204 &      # the generator runs inside the real app (browser-only parts)
tools/check-all.sh                # all variants; or: tools/check-all.sh us480 ca600
```

`check-all.sh` creates `tools/.venv` on first run (`ezdxf openpyxl pypdf cadquery-ocp`), needs
`pdftoppm` (poppler) for page renders, and Playwright/Chromium from the global install
(`/opt/node22/lib/node_modules/playwright`). Exit code is non-zero when any check FAILs.

## Variants (`tools/harness/variants.ts`)

| Name | What it exercises |
|---|---|
| `us480` | The example project as seeded in the preview (480 V 3-ph, 1 HP DOL, CLICK, 7" HMI) |
| `ca600` | Canada / CEC, 600 V 3-ph, motor branch on Class CC fuses, 600:120 V fused control transformer, revision B |
| `us120` | 120 V 1-ph, small 16x12 enclosure (overflows on purpose), no HMI |
| `big` | 36x30 enclosure, 4 VFDs + 2 DOL motors, 2 input + 1 output modules (54 I/O), pilot lights, selector, stack light, 10" HMI, junction boxes |

`gen-outputs.cjs` loads the harness through the Vite dev server, seeds the stores, calls the same
`buildEverythingZip` the Export page uses, and writes to `tools/out/<variant>/`:
`everything.zip` (unpacked in `zip/`), extra DXF exports in `dxf/` (mm / inch, full / cut-only),
`labels.csv`, and `data.json` (layout, drilling plans, BOM, wires, terminals, calculations,
alarms, STEP summary) used by the checkers.

## Checkers

| Script | Checks |
|---|---|
| `check_dxf.py` | `$INSUNITS`/`$MEASUREMENT` for mm and inch; closed outline = catalog back panel / enclosure door 1:1 at the datum; holes and cutouts inside with edge distance; no duplicates / overlaps; Ø22.5 operators; HMI cutout = `hmiCatalog`; cut-only has only OUTLINE/HOLES/CUTOUTS and no text; coordinates = hole tables; ZIP copies identical; handle and door-device clearances |
| `check_step.py` | OCP loads the file; every solid valid (BRepCheck); names and colours; enclosure shell = catalog size; duplicate products; door bodies on the DXF cutout centres |
| `check_pdf.py` | Page sizes (drawings ANSI B 17x11, documents Letter); no `undefined` / `NaN` / `null` / `[object Object]` / replacement glyphs; "Page x of y" and "Sheet x of y"; TOC page numbers; renders every page at 60 dpi into `tools/out/<variant>/pages/` for a visual pass (`--no-render` to skip) |
| `check_xlsx.py` | Every sheet has a header and data; no bad text; numbers in quantity / rung / amps columns stored as numbers |
| `check_consistency.py` | Part numbers and quantities (BOM CSV, Excel, drawings, package), wire numbers (CSV, Excel, labels, drawings; marker copies = 2 per conductor), terminals (CSV, Excel, labels), I/O addresses (CSV, Excel, app, nicknames, drawings, package), alarm texts, revision letter on every page / title block, motor FLA against an independent copy of NEC 430.250 / 430.248, 24 VDC load and heat sums, failed calculations listed in the design review |

Visual pass: after `check_pdf.py`, look through `tools/out/<variant>/pages/**.png`
(e.g. `montage p-*.png -tile 4x -geometry +3+3 sheet.png`) for overlaps, clipped tables and
missing text — the scripts cannot judge layout.
