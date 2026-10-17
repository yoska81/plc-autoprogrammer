# src/plc — everything about the PLC program

All PLC programming code lives here: the program model, PLC profiles, the AI that writes
the program, the simulator, the editor UI and the PLC pages. Owner: Dev 2
(`claude/isa-dev-program-sim`).

| Folder | What it holds | Main entry points |
|---|---|---|
| `core/` | Vendor-neutral ladder model, checker, diff, JSON schema for the AI, PLC profiles and address assignment | `ladder.ts` (`LadderProgram`, `Rung`), `validate.ts` (`validateProgram`), `profile.ts` (`PlcProfile` incl. the vendor-neutral hooks `dataTypeOf` → IEC types, `simSemantics`, `exporters`), `profiles/` (`getProfile`, CLICK in `click.ts` / `clickData.ts` — the first profile implementing the hooks), `tags.ts` (`tagTable`: every operand as an IEC symbol + data type), `usePlc.ts` (profile + I/O addresses for the open project), `clickExport.ts` (CLICK import files), `diff.ts`, `schema.ts`, `fit.ts`, `modules.ts` |
| `ai/` | The AI that writes and fixes ladder programs (calls `src/lib/ai/anthropic.ts` / `openai.ts`) | `ladderAI.ts` (`generateLadder`, `reviseLadder`) |
| `sim/` | Scan engine (CLICK semantics: SC bits, retentive memory, timers, counters, MATH/COPY), machine model built from the I/O list and wiring, run-loop controller, simulator UI | `engine.ts` (`createSimulator`), `controller.ts` (`SimController`, `SimHandle` for the live HMI), `SimulatorPanel.tsx`, `engine.test.ts` (unit tests: `npx tsx src/plc/sim/engine.test.ts`) |
| `ui/ladder/` | Ladder drawing and hand editing | `LadderView.tsx` |
| `ui/program/` | Program page workspace: AI assistant, review of AI changes, block tree, cross reference, print view, Structured Text view | `LadderWorkspace.tsx`, `BlockTree.tsx`, `CrossRefPanel.tsx`, `ProgramPrint.tsx`, `programIndex.ts`, `StProgramView.tsx` |
| `pages/` | Routed pages | `ProgramPage.tsx` (/program), `SimulatePage.tsx` (/simulate), `PlcSetupPage.tsx` (/plc), `PrintPage.tsx` (/print) |

Outside this folder: the example program is `LADDER` in `src/preview/sampleProject.ts`;
the live HMI (`src/hmi/LiveHmi.tsx`) runs against `SimHandle`; generic UI helpers
(`Spinner`, `ReasoningPanel`) are in `src/components/common.tsx`.

Keep new code in `core/`, `ai/` and `sim/` vendor-neutral where it costs nothing; CLICK
specifics belong in `core/profiles/`. The simulator takes its system bits and retentive defaults
from `SimSemantics` (default CLICK). Plan: `docs/architecture/multi-vendor.md`.
