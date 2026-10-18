/**
 * Importing an existing PLC program ("Upgrade existing program").
 *
 * Every reader turns its file into one ForeignProgram: the controller, its tags and its routines,
 * with rungs already in the app's ladder model but with the PROGRAM'S OWN NAMES as operands
 * (e.g. "Start_PB", "Conv_Tmr.DN", "Local:1:I.Data.0", "%I0.0", "X0"). convert.ts then maps every
 * name to a neutral address (X/Y via the I/O list, C, DS, DD, DF, T, CT) and keeps the original names
 * as nicknames, so the program can be exported back with its own names or to another brand.
 */
import type { LadderProgram, Rung } from '../core/ladder';

export type SourceFormat =
  | 'l5x' | 'l5k' | 'click-csv' | 'plcopen' | 'st'
  | 'siemens-scl' | 'siemens-stl' | 'siemens-xml' | 'siemens-tags'
  | 'mitsubishi-csv' | 'il-text' | 'printout';

export const FORMAT_LABEL: Record<SourceFormat, string> = {
  l5x: 'Studio 5000 / RSLogix 5000 export (.L5X)',
  l5k: 'Studio 5000 / RSLogix 5000 export (.L5K)',
  'click-csv': 'CLICK nickname / address list (.csv)',
  plcopen: 'IEC 61131-3 PLCopen XML',
  st: 'Structured Text source',
  'siemens-scl': 'Siemens SCL source',
  'siemens-stl': 'Siemens STL / AWL source',
  'siemens-xml': 'Siemens TIA Portal block (XML)',
  'siemens-tags': 'Siemens PLC tag table',
  'mitsubishi-csv': 'Mitsubishi GX Works program (CSV)',
  'il-text': 'Instruction list (Mitsubishi / Delta / Inovance / Xinje)',
  printout: 'Printout or screenshot of the program (read by the AI)',
};

export type ForeignType = 'BOOL' | 'INT' | 'DINT' | 'REAL' | 'TIMER' | 'COUNTER' | 'STRING' | 'OTHER';

export interface ForeignTag {
  /** The name rungs use (scope prefix removed). */
  name: string;
  dataType: ForeignType;
  /** The type as written in the file (e.g. "TIMER", "Motor_UDT", "Array[0..9] of Int"). */
  rawType?: string;
  /** Physical address or module point it stands for: "Local:1:I.Data.0", "%I0.0", "X0", "X001". */
  address?: string;
  comment: string;
  /** Known to be a physical input / output. */
  io?: 'input' | 'output';
  /** Analog channel (word / real on an analog module). */
  analog?: boolean;
  /** Stored preset of a timer (ms) or counter, for rungs that write "?" (use the tag's value). */
  preset?: string;
}

/** A rung with the program's own names as operands. */
export type ForeignRung = Rung;

export interface ForeignRoutine {
  name: string;
  /** Language the routine was written in (ladder rungs are converted; others too where the reader can). */
  language: 'ladder' | 'st' | 'il' | 'fbd' | 'sfc' | 'other';
  rungs: ForeignRung[];
  /** Original text of what could not be turned into rungs (kept for the user and for re-export). */
  untranslated: string[];
  /** Where the routine is in the original file (program and routine name), for writing changes back into it. */
  origin?: { program: string; routine: string };
  /** Rung id → the number of the original rung it came from (one original rung can give several). */
  rungNumbers?: Record<string, string>;
}

export interface ForeignProgram {
  format: SourceFormat;
  vendor: string;
  /** Controller / CPU as the file names it (e.g. "1769-L33ER", "CPU 1214C", "FX5U"). */
  controller: string;
  projectName: string;
  tags: ForeignTag[];
  routines: ForeignRoutine[];
  /** What the reader noticed (unsupported instructions, guesses). */
  notes: string[];
  /** Parts of the file the app's program does not hold (add-on instructions, FBD / SFC routines, message tags…). */
  outside?: string[];
}

/** One physical I/O point found in the program. */
export interface ImportedIoPoint {
  /** Name in the program. */
  name: string;
  description: string;
  type: 'input' | 'output';
  /** Original physical address / module point. */
  original: string;
  analog: boolean;
  /** How sure the reader is that this is a physical point. */
  confidence: 'high' | 'medium' | 'low';
}

export interface ImportReport {
  rungs: number;
  /** Rungs converted completely. */
  converted: number;
  /** Instructions or statements not converted (with where they are). `kept`: in the program as the original text (RAW). */
  notConverted: { where: string; text: string; kept?: boolean }[];
  notes: string[];
  /** Parts of the original file the app's program does not hold: kept only when the changes are written into that file. */
  outside: string[];
}

export interface ImportedProgram {
  source: { format: SourceFormat; vendor: string; controller: string; projectName: string; fileName: string };
  /** Program with neutral addresses; I/O points are written as "@IN:<n>" / "@OUT:<n>" until a PLC is chosen (materialize). */
  program: LadderProgram;
  io: ImportedIoPoint[];
  /** Neutral address (or @IN/@OUT placeholder) → original name in the program. */
  names: Record<string, string>;
  report: ImportReport;
  /** Block id → its routine in the original file. */
  blockOrigin: Record<string, { program: string; routine: string }>;
  /** App rung id → number of the original rung it came from (in its routine). */
  rungOrigin: Record<string, string>;
}
