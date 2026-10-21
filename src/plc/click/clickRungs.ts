/**
 * Send to CLICK, the rungs: each rung of the program as steps the CLICK bridge runs in CLICK's ladder editor while
 * the user watches. The entry sheet (clickEntryBlocks: instruction, row, column and dialog fields per rung) says
 * what goes where; the keymap says how CLICK takes it: the keys that move the cursor, the Instruction List entry
 * that opens each instruction's dialog at the cursor (double-click, as the CLICK help describes), the dialog's
 * fields and OK. AutomationDirect documents no keyboard map for this, so the keymap is data, fitted to the user's
 * CLICK version by the calibration (it enters three sample rungs and reads them back) and the recorded controls.
 * A rung with an instruction the keymap cannot enter (one kept as the original text, a timer's reset input) is the
 * user's turn: the run waits while they type it (Continue in the app), so the rungs stay in order.
 */
import { clickEntryBlocks, type EntryCell, type EntryOutput, type EntryRung } from '../core/clickEntrySheet';
import type { LadderProgram } from '../core/ladder';
import { CLICK_MAIN, literal, type ClickSelector, type ClickStep } from './clickPlan';

/** How one instruction is entered: its Instruction List entry, its dialog's title, and which control takes each field. */
export interface ClickInstruction {
  /** The entry in CLICK's Instruction List (a pattern of its name). */
  list: string;
  /** The instruction dialog that opens (a pattern of its title). */
  dialog: string;
  /** Entry sheet field name → the control that takes it (setText; `select` for a pick list). */
  fields: Record<string, ClickSelector & { select?: boolean }>;
}

export interface ClickKeymap {
  /** The CLICK version it was fitted to ("" = the first version, not yet checked on a PC). */
  checkedOn: string;
  /** Keys that put the cursor at row 1, column 1 of a new rung after the last one. */
  newRung: string;
  /** Keys that move the cursor by rows (+ down) and columns (+ right). */
  move: (rows: number, columns: number) => string;
  /** Where the cursor is after an instruction's dialog closes, from the cell it was put in. */
  afterEntry: { rows: number; columns: number };
  /** The column of the outputs (at the right rail). */
  outputColumn: number;
  /** Keys that draw the line joining a parallel row back to the row above, the cursor on the row's last cell. */
  joinUp: string;
  /** How the rung comment is written, the cursor anywhere in the rung (null: not entered by the app). */
  comment: { keys: string; dialog: string; field: ClickSelector } | null;
  /** The dialogs' OK button. */
  ok: ClickSelector;
  /** Entry sheet instruction name (a pattern) → how it is entered. */
  instructions: { match: RegExp; how: ClickInstruction }[];
}

const edit = (name: string, index = 0): ClickSelector => ({ type: 'Edit', name, index });

/**
 * The first version, from the CLICK help (Instruction List entries and instruction dialogs by their names);
 * the cursor keys are the editor's arrows. Not yet checked on a PC with CLICK: the calibration says.
 */
export const DEFAULT_KEYMAP: ClickKeymap = {
  checkedOn: '',
  newRung: '^{END}{DOWN}{HOME}',
  move: (rows, columns) => `${rows > 0 ? `{DOWN ${rows}}` : rows < 0 ? `{UP ${-rows}}` : ''}${columns > 0 ? `{RIGHT ${columns}}` : columns < 0 ? `{LEFT ${-columns}}` : ''}`,
  afterEntry: { rows: 0, columns: 1 },
  outputColumn: 32,
  joinUp: '+{UP}',
  comment: { keys: '^m', dialog: '^(Rung )?Comment', field: edit('', 0) },
  ok: { type: 'Button', name: '^OK$' },
  instructions: [
    { match: /^NO contact/, how: { list: '^NO Contact', dialog: 'Contact', fields: { Address: edit('Address|Bit') } } },
    { match: /^NC contact/, how: { list: '^NC Contact', dialog: 'Contact', fields: { Address: edit('Address|Bit') } } },
    { match: /^Edge contact/, how: { list: '^Edge Contact', dialog: 'Edge', fields: { Address: edit('Address|Bit') } } },
    { match: /^Compare contact/, how: { list: '^Compare', dialog: 'Compare', fields: { 'Value A': edit('Value A|A'), Operator: { type: 'ComboBox', select: true }, 'Value B': edit('Value B|B') } } },
    { match: /^Out coil/, how: { list: '^Out', dialog: '^Out', fields: { Address: edit('Address|Bit') } } },
    { match: /^Set coil/, how: { list: '^Set', dialog: '^Set', fields: { Address: edit('Address|Bit') } } },
    { match: /^Reset coil/, how: { list: '^Reset', dialog: '^Reset', fields: { Address: edit('Address|Bit') } } },
    { match: /^Timer/, how: { list: '^Timer', dialog: 'Timer', fields: { 'Timer number': edit('Timer|T'), Setpoint: edit('Set ?Point'), Unit: { type: 'ComboBox', name: 'Unit', select: true } } } },
    { match: /^Counter/, how: { list: '^Counter', dialog: 'Counter', fields: { 'Counter number': edit('Counter|CT'), Setpoint: edit('Set ?Point') } } },
    { match: /^Copy/, how: { list: '^Copy', dialog: 'Copy', fields: { Source: edit('Source'), Destination: edit('Destination') } } },
    { match: /^Math/, how: { list: '^Math', dialog: 'Math', fields: { Result: edit('Result'), Formula: edit('Formula') } } },
  ],
};

/** The address part of a sheet field ("X001 (Start button)" → "X001"); other values as they are. */
export const value = (v: string) => v.replace(/\s+\(.*\)$/, '').trim();

/** A sheet field value as the dialog's pick list shows it ("= (equal)" → "="; "msec" stays). */
const pick = (v: string) => literal(v.replace(/\s+\(.*\)$/, '').trim());

function instructionSteps(km: ClickKeymap, what: EntryCell | EntryOutput, where: string): ClickStep[] | null {
  const how = km.instructions.find((i) => i.match.test(what.instruction))?.how;
  if (!how) return null;
  const steps: ClickStep[] = [
    { do: 'window', title: CLICK_MAIN },
    { do: 'doubleClick', find: { name: how.list }, say: `${where}: ${what.instruction}` },
    { do: 'window', title: how.dialog },
  ];
  for (const [name, val] of what.fields) {
    const sel = how.fields[name];
    if (!sel) continue; // shown in the dialog with its default (e.g. the timer's mode)
    const { select, ...find } = sel;
    steps.push(select ? { do: 'select', find, item: `^${pick(val)}` } : { do: 'setText', find, text: value(val) });
  }
  steps.push({ do: 'click', find: km.ok });
  return steps;
}

export interface RungsPlan {
  /** Every rung's steps, in program order. */
  steps: ClickStep[];
  /** How many rungs the app enters. */
  entered: number;
  /** Rungs the app hands to the user (an instruction it cannot enter): the run waits while they type them. */
  leftForYou: { number: number; why: string }[];
}

/** One rung: a new rung, its cells row by row, the parallel rows joined, its outputs, its comment. The cursor is
 * followed from cell to cell (the keymap says where a dialog leaves it). A rung with something the app cannot
 * enter is the user's turn: the run waits until they typed it and pressed Continue (so the rungs stay in order). */
export function rungSteps(km: ClickKeymap, r: EntryRung): { number: number; steps: ClickStep[]; leftForYou?: string } {
  const head: ClickStep[] = [{ do: 'window', title: CLICK_MAIN }, { do: 'keys', keys: km.newRung, say: `Rung ${r.number}${r.comment ? `: ${r.comment}` : ''}` }];
  const steps = [...head];
  const at = { row: 1, column: 1 };
  const goTo = (row: number, column: number) => {
    const keys = km.move(row - at.row, column - at.column);
    if (keys) steps.push({ do: 'keys', keys });
    at.row = row; at.column = column;
  };
  const entered = () => { at.row += km.afterEntry.rows; at.column += km.afterEntry.columns; };
  const yours = (why: string) => ({
    number: r.number,
    leftForYou: why,
    steps: [...head, { do: 'waitUser' as const, text: `Type rung ${r.number}${r.comment ? ` (${r.comment})` : ''} in CLICK from the entry sheet: the app cannot enter ${why}.`, say: `Rung ${r.number}: your turn` }],
  });
  for (const [ri, row] of r.rows.entries()) {
    for (const c of row) {
      const s = instructionSteps(km, c, `rung ${r.number}, row ${ri + 1}, column ${c.column}`);
      if (!s) return yours(`${c.instruction} (row ${ri + 1}, column ${c.column})`);
      goTo(ri + 1, c.column);
      steps.push(...s);
      entered();
    }
    if (ri > 0 && row.length) {
      goTo(ri + 1, row[row.length - 1].column);
      steps.push({ do: 'keys', keys: km.joinUp });
    }
  }
  for (const [oi, o] of r.outputs.entries()) {
    if (o.note && /second input line/.test(o.note) && /NO contact/.test(o.note)) return yours(`a ${o.instruction} with a reset input`);
    const s = instructionSteps(km, o, `rung ${r.number}, output ${oi + 1}`);
    if (!s) return yours(o.instruction);
    goTo(1 + oi, km.outputColumn);
    steps.push(...s);
    entered();
  }
  if (r.comment && km.comment) {
    steps.push(
      { do: 'keys', keys: km.comment.keys },
      { do: 'window', title: km.comment.dialog, timeoutMs: 3000, optional: true },
      { do: 'setText', find: km.comment.field, text: r.comment, optional: true },
      { do: 'click', find: km.ok, optional: true },
    );
  }
  return { number: r.number, steps };
}

/** Every rung of the program, in program order (CLICK runs them top to bottom). */
export function rungsPlan(program: LadderProgram, labels: Map<string, string>, km: ClickKeymap = DEFAULT_KEYMAP): RungsPlan {
  const out: RungsPlan = { steps: [], entered: 0, leftForYou: [] };
  const all = clickEntryBlocks(program, labels).flatMap((b) => b.rungs).sort((a, b) => a.number - b.number);
  for (const r of all) {
    const p = rungSteps(km, r);
    out.steps.push(...p.steps);
    if (p.leftForYou) out.leftForYou.push({ number: p.number, why: p.leftForYou }); else out.entered++;
  }
  return out;
}
