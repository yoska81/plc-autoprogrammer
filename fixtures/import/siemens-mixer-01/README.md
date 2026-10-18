# siemens-mixer-01: Siemens S7-1200 mixing tank (test fixture)

**This is a synthetic test fixture, made for testing the "import an existing PLC program" feature.**
It is not taken from a real machine and must not be downloaded to a controller.

## What it is

A batch mixing tank on an S7-1200 **CPU 1214C DC/DC/DC** (6ES7214-1AG40-0XB0, FW V4.6) with an
**SM 1231 AI4** (6ES7231-4HD32-0XB0) for two 4-20 mA transmitters (level 0-100 %, temperature 0-150 °C).
The sequence fills ingredient A and then B, heats with agitation, mixes for 5 min, drains, and counts the batch.

| File | Content |
|------|---------|
| `MixTank_MT01.xml` | PLCopen TC6 XML 2.01 (`http://www.plcopen.org/xml/tc6_0201`) |
| `PLC_Tags_MT01.csv` | PLC tag table: the columns of the TIA Portal tag export (.xlsx) saved as CSV (UTF-8 with BOM) |
| `expected.json` | answer key |
| `_src/generate.py` | generator; self-checks the XML, LD connections, tag table and answer key |

What the XML contains:

- `FC_ScaleAnalog` (`pouType="function"`, body **ST**, SCL syntax with `#` locals): 4-20 mA scaling with
  `NORM_X` / `SCALE_X`, and a wire-break / range check (raw > 32511 or < -4864);
- `FB_Mixer` (`pouType="functionBlock"`, body **LD**): left/right power rails, contacts (NO, NC,
  rising edge), coils (normal, set, reset), blocks `TON`, `CTU`, `GE`, `LE`, `LT` and calls of
  `FC_ScaleAnalog` with in/outVariables, and network titles as `comment` elements. Step bits use set and
  reset coils; the alarms are latched static bits;
- the global PLC tags with `%I/%Q/%IW/%M` addresses in `resource/globalVars`; the CPU and modules in
  `contentHeader/Comment` and in a resource `addData` element.

The XML validates against the PLCopen TC6 2.01 XSD.

## Known issue (left in on purpose)

**S7-1** `FC_ScaleAnalog`: `NORM_X(... MAX := 32767)` should be `MAX := 27648`, the S7 nominal range
for 4-20 mA. All scaled values read 15.6 % low, so the tank overfills and overheats. See `expected.json`.

## Fidelity notes

TIA Portal's native Openness export is SimaticML (one XML file per block). This fixture uses the
vendor-neutral PLCopen TC6 format that was requested. The `addData` elements carry Siemens block metadata
under a fixture namespace. TIA's tag export is .xlsx; it is given here as CSV with the same column headers
(`Name, Path, Data Type, Logical Address, Comment, Hmi Visible, Hmi Accessible, Hmi Writeable, Typeobject ID, Version ID`).

Regenerate with `python3 -I fixtures/import/siemens-mixer-01/_src/generate.py`.
