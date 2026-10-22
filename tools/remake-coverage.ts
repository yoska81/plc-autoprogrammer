/// <reference types="node" />
/**
 * Remake coverage of a PLC program file: how much of it converts on each PLC the app writes, as counts and
 * instruction kinds only (no tag names, register addresses, values or comments), so the numbers of a real
 * machine's program can be shared without its contents. Prints to the screen; never writes a file.
 * The app's Upgrade page gives the same text ("Copy coverage numbers").
 *
 *   npx tsx tools/remake-coverage.ts path/to/project.YMW7 [touch-panel.emtp]
 *   npx tsx tools/remake-coverage.ts path/to/program.L5X
 */
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { fileText, importProgramFiles } from '../src/plc/import/index';
import { applyUpgrade } from '../src/plc/import/ui/applyUpgrade';
import { remakeCoverageText } from '../src/plc/import/remake';
import { useProjectStore } from '../src/store/useProjectStore';
import { useIOStore } from '../src/store/useIOStore';
import { useProgramStore } from '../src/store/useProgramStore';
import { useHmiStore } from '../src/store/useHmiStore';

const paths = process.argv.slice(2).filter((a) => !a.startsWith('-'));
if (!paths.length) {
  console.error('Usage: npx tsx tools/remake-coverage.ts <program file> [companion files…]');
  process.exit(2);
}
const files = paths.map((p) => { const bytes = new Uint8Array(readFileSync(p)); const name = basename(p); return { name, bytes, text: fileText(name, bytes) }; });
const { program } = importProgramFiles(files);
applyUpgrade(program);
const { plcId, cpuId, modules } = useProjectStore.getState();
console.log(remakeCoverageText({ io: useIOStore.getState().projectIO, plcId, cpuId, modules, program: useProgramStore.getState().ladder, hmi: useHmiStore.getState().design }));
