# cn-rollformer-01: drawings of a Chinese-built roll-forming machine (no PLC)

Test fixture for the import feature. The feature reads an existing electrical drawing set,
recognises every part, field signal, motor, relay circuit and safety function, and converts
the design to North American practice.

Machine: **HC-YX840 roof-panel roll former with servo flying shear**, built in China to
IEC 60204-1 / GB standards. It has 380 V 3-phase + N 50 Hz supply, 220 VAC contactor
control and 24 VDC relay logic. The maker is fictional.

- **M1:** 5.5 kW main roll motor on a Delta VFD055E43A (U1) with braking resistor R1.
- **M2:** 2.2 kW hydraulic pump, direct-on-line (Chint NXC-12 + NXR-12).
- **M3 (flying shear):** 1.5 kW Delta ECMA servo on an ASD-A2-1521-L drive (U2). The drive's
  E-CAM flying-shear function uses a 1000 ppr measuring-wheel encoder B1 on CN5 as the master.
  A hydraulic shear (Huade 4WE6 valve, YV1 down / YV2 up) cuts on the fly, with limit
  switches SQ1/SQ2.
- **Control:** no PLC. Hard-wired relays KA1–KA10, cut watchdog timer KT1 (Omron H3Y-2) and
  Omron H7CX batch counter. Sensors: SQ3 run-out end photo sensor, SQ4 material-present
  inductive sensor.
- **Safety:** two E-stops (SB0, SB10) and shear guard SQ5 feed a Pilz PNOZ s3 (KA0).
  Drawn as PL d / Cat 3, stop category 0, manual reset with KM1 feedback.

## Files

| File | What it is |
|---|---|
| `drawings.pdf` | 8 A3 landscape sheets, vector, selectable text (Chinese + English). Each sheet has a frame, 1–8 / A–F grid and bilingual title block. Uses IEC symbols, wire numbers, terminal marks (`XT2:5`), `/sheet.column` cross-references, and contact mirrors under the coils. |
| `drawings-scan.pdf` | The same 8 sheets as 150 dpi greyscale JPEG images, skewed ±0.5–1.2°, shifted, blurred, noisy, with specks, binding shadow and a fold line. No text layer. |
| `drawings.dxf` | Sheets 2, 3, 5 and 6 (power distribution, motor/servo power, relay control 1 and 2). DXF R2018, mm units, model space with sheets side by side every 450 mm. Text style GB (gbenor.shx + gbcbig.shx). Layers: FRAME, TITLE, WIRE, SYM, TAG, PIN, XREF, WIRENO, TERM, TEXT, NOTE, TABLE. |
| `expected.json` | The answer key (below). |
| `preview-sheet5.png` | 100 dpi render of sheet 5, for a quick look. |
| `_src/` | Generators: `design.mjs` (all data), `build.mjs` (drawing + PDF + expected.json), `dxf.py`, `scan.py`, `build.sh`. |

Sheets:
1. Cover, index and technical data
2. Power distribution
3. Motor and servo power + pump control
4. Safety circuit, VFD control and pilot lights
5. Relay control 1: line run and jog
6. Relay control 2: servo I/O, shear and counter
7. Terminal list
8. BOM

## expected.json

- **Overview:** `machine`, `supply` and `hasPlc: false`.
- **`motors`:** `starter` is `VFD`, `DOL` or `SERVO`, with `partNumbers`.
- **Field devices and logic:**
  - `signals`: every field and operator device, what it does, what it drives, and its terminals.
  - `relays`: every relay and timer, with each contact's pins, NO/NC and sheet/column.
  - `relayLogic`: each control circuit in plain words.
  - `motion`: servo axis, encoder 1000 ppr on a 200 mm wheel, E-CAM flying-shear mode, CN1 I/O and batch counter.
- **Parts and safety:** `parts` (BOM: tag, maker, part number, qty, category), `safety` (function, devices, Cat/PL as drawn) and `interlocks`.
- **Wiring:** `terminals` (39 terminals on XT0/XT1/XT2) and `crossSheetConnections`.
- **`naNotes`:** what a North American conversion must change. This covers:
  - 480 V/60 Hz with no neutral, plus control and servo transformers
  - kW to hp and NEC FLA
  - UL 489 / Class CC instead of IEC MCBs, and a UL 98 disconnect
  - SCCR
  - GB tags to NFPA 79/JIC tags
  - mm² to AWG, and NFPA 79 wire colours
  - non-UL parts
  - the single-channel VFD/servo stop that does not meet the drawn Cat 3

The data that is both drawn and written to the key comes from the same tables in
`_src/design.mjs`. Positions (cross-references, terminal list, contact mirrors) are collected
while drawing. So the PDF, the DXF and `expected.json` cannot disagree. The build stops with
an error if a cross-sheet connection has no partner or a contact has no coil.

## Regenerate

```bash
bash fixtures/import/cn-rollformer-01/_src/build.sh [work-dir]
```

- **Node + Playwright:** global install at `/opt/node22/lib/node_modules/playwright`, Chromium in `/opt/pw-browsers`.
- **Python:** `tools/.venv` with ezdxf, Pillow and numpy. `dxf.py` and `scan.py` are copied to `<work-dir>/scripts` and run with `python -I` from there.
- **Other tools:** `pdftoppm`, and the fonts Liberation Sans and WenQuanYi Zen Hei.

The scan uses a fixed random seed, so output is stable apart from PDF timestamps.
