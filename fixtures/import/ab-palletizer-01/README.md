# ab-palletizer-01: Allen-Bradley layer palletizer (test fixture)

**This is a synthetic test fixture, made for testing the "import an existing PLC program" feature.**
It is not taken from a real machine and must not be downloaded to a controller.

## What it is

`Palletizer_PL01.L5X` is a Studio 5000 Logix Designer v33.11 full-controller export for a
CompactLogix 5380 **5069-L306ER** with local Compact 5000 I/O:

| Slot | Module    | Use |
|------|-----------|-----|
| 0    | 5069-L306ER | controller (`Local`) |
| 1    | 5069-IB16 | 16 digital inputs (`Local:1:I.Pt00.Data` …) |
| 2    | 5069-OB16 | 11 digital outputs in use (`Local:2:O.Pt00.Data` …) |
| 3    | 5069-IF8  | Ch00 elevator height, 4-20 mA scaled in the module to 0-2000 mm |

The program is a simple layer palletizer: it counts cases onto a layer table, pushes the layer onto a
pallet on a hoist elevator, lowers one layer at a time, then discharges the full pallet.

What the file exercises:

- I/O as **Alias tags** (`TagType="Alias" AliasFor="Local:1:I.Pt05.Data"`) with descriptions, controller scope;
- internal tags in **program scope** (MainProgram), HMI and alarm tags in controller scope;
- `Data Format="L5K"` and `Data Format="Decorated"` for every base tag (TIMER / COUNTER structures, INT, DINT array);
- alarm texts as **per-bit tag comments** (`<Comments><Comment Operand="[0].4">`) on the `Alm` DINT[2] array;
- MainTask (continuous) › MainProgram › routines MainRoutine (JSR calls), Safety_Modes, Infeed, LayerForm,
  Elevator, Alarms, HMI, all RLL with rung comments and neutral rung text;
- XIC, XIO, OTE, OTL, OTU, ONS, TON, CTU, RES, MOV, EQU, NEQ, GRT, JSR, branches, `S:FS`;
- a step sequencer on the INT `Seq_Step` (0, 10 … 90).

## Known issues (left in on purpose)

1. **AB-1** `Safety_Modes` rung 1: `Machine_Running` has no seal-in branch.
2. **AB-2** `LayerForm` rung 4: pusher interlock examines `Infeed_Case_PE` instead of `Pallet_Present_PE`
   (the rung comment describes the correct intent).

Details and fixes are in `expected.json` › `knownIssues`.

## Files

- `Palletizer_PL01.L5X`: the program (UTF-8, CRLF)
- `expected.json`: the answer key: machine, plc, io, sequence, timers, counters, alarms, interlocks, knownIssues
- `_src/generate.py`: generator (one table produces both files; it self-checks operands and XML)

Regenerate with `python3 -I fixtures/import/ab-palletizer-01/_src/generate.py`.

## Fidelity notes

The structure follows the Logix 5000 Import/Export manual (1756-RM084) and the repo's own writer
(`src/plc/core/profiles/l5x.ts`). Module entries are trimmed: `ProductCode` values are representative,
and only the IF8 channel-0 scaling of the module configuration tag is included. Studio 5000 would
regenerate the full configuration on import.
