# mitsubishi-capper-01: Mitsubishi FX5U bottle capper (test fixture)

**This is a synthetic test fixture, made for testing the "import an existing PLC program" feature.**
It is not taken from a real machine and must not be downloaded to a controller.

## What it is

A single-head inline bottle capper on a MELSEC iQ-F **FX5U-32MT/ES** (X0-X17 / Y0-Y17, octal), programmed in
GX Works3. The machine clamps each bottle, lowers the head, and screws the cap on until a torque switch
makes. It counts good bottles against a batch size in D0, and rejects bottles that do not reach torque.

| File | Content |
|------|---------|
| `CAPPER_MAIN.csv` | program MAIN as a GX Works3 instruction-list CSV export |
| `CAPPER_DeviceComment.csv` | device comments (`Device Name`, `Comment`) |
| `expected.json` | answer key |
| `_src/generate.py` | generator; it self-checks that every device has a comment, that every I/O point is used, and that the file ends with END |

### File format

Both CSV files follow the GX Works3 CSV export layout:

- **UTF-16 LE with BOM**, **tab-delimited**, every field in double quotes, CRLF line endings;
- title lines (`"MAIN"`, `"Module Type:FX5UCPU"`), then the header
  `Step No. | Line Statement | Instruction | I/O(Device) | Blank | PI Statement | Note`;
- one row per instruction. Each extra operand goes on its own continuation row with an empty step and
  an empty instruction, for example `OUT T0` followed by `K5`, or `MOV K500` followed by `D0`;
- the rung comment is in the `Line Statement` column of the rung's first row.

In the device comment CSV, each I/O comment starts with a symbol (`X4 → "Bottle_At_Station_PE: Bottle in
capping position photo eye"`). That symbol is the `tag` in `expected.json`. Internal devices have plain comments.

Instructions used: LD, LDI, AND, ANI, OR, OUT (bit, timer `OUT Tn Kn`, counter `OUT Cn Kn/Dn`), SET, RST,
MOV, END. Devices: X, Y, M, T, C, D, SM400 / SM402 / SM412.

## Known issue (left in on purpose)

**MEL-1** Double coil: `Y4` (spindle) is driven by `OUT Y4` in the auto rung and again in the maintenance
jog rung at the end of the program. The later one wins, so the spindle never runs in AUTO. See `expected.json`.

## Fidelity notes

The step numbers come from a simplified step-size table: one step for basic bit instructions, 4 for
`OUT T/C` with a set value, 3 for `MOV`, and 2 for `RST T/C`. They are consistent within the file and the
answer key, but they may differ from GX Works3's real step counts. The header and title lines vary with
the GX Works3 language and version. An importer should find the header row by its column names.

Regenerate with `python3 -I fixtures/import/mitsubishi-capper-01/_src/generate.py`.
