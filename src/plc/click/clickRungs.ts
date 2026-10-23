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
  /** Entry sheet field name → the control that takes it (setText; `select` for a pick list; `choose`: one button per
   * value, e.g. the Compare dialog's symbol buttons). */
  fields: Record<string, ClickSelector & { select?: boolean; choose?: Record<string, ClickSelector> }>;
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
  /** Steps that add a row to the rung under the cursor's row (a parallel branch or a second output goes there). */
  newRow: ClickStep[];
  /** How the rung comment is written, the cursor anywhere in the rung (null: not entered by the app). */
  comment: { keys: string; dialog: string; field: ClickSelector | 'typed' } | null;
  /** The dialogs' OK button. */
  ok: ClickSelector;
  /** Entry sheet instruction name (a pattern) → how it is entered. */
  instructions: { match: RegExp; how: ClickInstruction }[];
}

/** A dialog's box by its control id (CLICK 4.00's instruction dialogs: their boxes have no names). */
const box = (id: string, type = 'Edit'): ClickSelector => ({ type, id });

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
  // CLICK's keyboard shortcuts (its help, "Keyboard Shortcuts (Hot Keys)"): Ctrl+Up draws a wire up, Ctrl+K edits the
  // rung comments
  joinUp: '^{UP}',
  // the Insert key opens CLICK's Insert dialog (What? Rung / Row / Column, Where? Before / After Cursor): a row after
  newRow: [
    { do: 'keys', keys: '{INSERT}' },
    { do: 'window', title: '^Insert$', timeoutMs: 5000 },
    // (with the mouse: picked through UI Automation the dialog kept "Rung" and inserted a rung)
    { do: 'click', find: { type: 'RadioButton', name: '^Row$' }, mouse: true },
    { do: 'click', find: { type: 'RadioButton', name: '^After Cursor$' }, mouse: true },
    { do: 'click', find: { type: 'Button', name: '^OK$' }, mouse: true },
    { do: 'window', title: CLICK_MAIN },
  ],
  // Ctrl+K: "Edit Rung Comment", its text box (a rich edit without a name) has the cursor: the comment is typed
  comment: { keys: '^k', dialog: '^Edit Rung Comment$', field: 'typed' },
  ok: { type: 'Button', name: '^OK$' },
  instructions: [
    // (each entry's name exactly: "Timer" also begins its heading "Timer/Counter", "Copy" its "Copy/Search")
    // the Instruction List's entries as CLICK 4 names them ("Contact (NO)", "Out" …), CLICK 3's names as well; the
    // dialogs' boxes by their control ids, as the real CLICK 4.00 shows them (recorded on the build server)
    { match: /^NO contact/, how: { list: '^(Contact \\(NO\\)|NO Contact)', dialog: 'Contact', fields: { Address: box('5001') } } },
    { match: /^NC contact/, how: { list: '^(Contact \\(NC\\)|NC Contact)', dialog: 'Contact', fields: { Address: box('5001') } } },
    { match: /^Edge contact/, how: { list: '^Edge Contact$', dialog: 'Edge', fields: { Address: box('1003') } } },
    {
      match: /^Compare contact/,
      how: {
        list: '^Compare$', dialog: 'Compare',
        fields: {
          'Value A': box('5002'),
          // the symbol buttons: = > >= on top, <> < <= below
          Operator: { choose: { '=': box('5006', 'Button'), '>': box('5008', 'Button'), '>=': box('5010', 'Button'), '<>': box('5007', 'Button'), '!=': box('5007', 'Button'), '<': box('5009', 'Button'), '<=': box('5011', 'Button') } },
          'Value B': box('5003'),
        },
      },
    },
    { match: /^Out coil/, how: { list: '^Out$', dialog: '^Out', fields: { Address: box('5002') } } },
    { match: /^Set coil/, how: { list: '^Set$', dialog: '^Set', fields: { Address: box('5002') } } },
    { match: /^Reset coil/, how: { list: '^Reset$', dialog: '^Reset', fields: { Address: box('5002') } } },
    { match: /^Timer/, how: { list: '^Timer$', dialog: 'Timer', fields: { 'Timer number': box('5001'), Setpoint: box('5004'), Unit: { ...box('5006', 'ComboBox'), select: true } } } },
    { match: /^Counter/, how: { list: '^Counter$', dialog: 'Counter', fields: { 'Counter number': box('5001'), Setpoint: box('5004') } } },
    { match: /^Copy/, how: { list: '^Copy$', dialog: 'Copy', fields: { Source: box('5006'), Destination: box('5014') } } },
    { match: /^Math/, how: { list: '^Math$', dialog: 'Math', fields: { Result: box('2001'), Formula: box('2006', 'Document') } } },
  ],
};

/** Text typed as it is (the keys syntax reads + ^ % ~ ( ) { } [ ] as keys; the bridge's SendKeys). */
export const typed = (text: string) => text.replace(/[+^%~(){}[\]]/g, (c) => `{${c}}`);

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
    const { select, choose, ...find } = sel;
    if (choose) {
      const button = choose[value(val).replace(/\s+/g, '')];
      if (!button) return null; // a value the dialog has no button for: the user's
      steps.push({ do: 'click', find: button, mouse: true });
    } else steps.push(select ? { do: 'select', find, item: `^${pick(val)}` } : { do: 'setText', find, text: value(val) });
  }
  steps.push({ do: 'click', find: km.ok });
  return steps;
}

export interface RungsPlan {
  /** Every rung's steps, in program order. */
  steps: ClickStep[];
  /** How many rungs the app enters. */
  entered: number;
  /** Rungs the app hands to the user (an instruction it cannot enter): typed while the run waits, or after it
   * (`list`), each after the rung named in `after` (0: before the first). */
  leftForYou: { number: number; why: string; after: number }[];
}

/** One rung: a new rung, its cells row by row, the parallel rows joined, its outputs, its comment. The cursor is
 * followed from cell to cell (the keymap says where a dialog leaves it). A rung with something the app cannot
 * enter is the user's turn: the run waits until they typed it and pressed Continue (so the rungs stay in order). */
export function rungSteps(km: ClickKeymap, r: EntryRung): { number: number; steps: ClickStep[]; leftForYou?: string } {
  const head: ClickStep[] = [{ do: 'window', title: CLICK_MAIN }, { do: 'keys', keys: km.newRung, say: `Rung ${r.number}${r.comment ? `: ${r.comment}` : ''}` }];
  const steps = [...head];
  const at = { row: 1, column: 1 };
  let rows = 1; // the rung's rows in CLICK so far (a new rung has one)
  const move = (row: number, column: number) => {
    // the output column by End ("go to right column"): counting Right keys to it put outputs rungs lower in the
    // real CLICK 4.00
    const keys = column === km.outputColumn && at.column !== km.outputColumn
      ? `${km.move(row - at.row, 0)}{END}`
      : km.move(row - at.row, column - at.column);
    if (keys) steps.push({ do: 'keys', keys });
    at.row = row; at.column = column;
  };
  // to a cell; a row the rung does not have yet is added first, under its last row (the cursor's column kept)
  const goTo = (row: number, column: number) => {
    while (rows < row) {
      move(rows, at.column);
      steps.push(...km.newRow);
      rows++;
      at.row = rows; // CLICK puts the cursor on the new row (same column): seen in the real CLICK 4.00
    }
    move(row, column);
  };
  const entered = () => { at.row += km.afterEntry.rows; at.column = Math.min(at.column + km.afterEntry.columns, km.outputColumn); };
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
      // the wire up is drawn on the cursor cell's left edge: from the cell after the row's last instruction, so the
      // row joins the one above after its own instructions (seen in the real CLICK 4.00)
      goTo(ri + 1, row[row.length - 1].column + 1);
      steps.push({ do: 'keys', keys: km.joinUp });
      at.row -= 1; // drawing the wire up takes the cursor up with it (seen in the real CLICK 4.00)
    }
  }
  for (const [oi, o] of r.outputs.entries()) {
    if (o.note && /second input line/.test(o.note) && /NO contact/.test(o.note)) return yours(`a ${o.instruction} with a reset input`);
    const s = instructionSteps(km, o, `rung ${r.number}, output ${oi + 1}`);
    if (!s) return yours(o.instruction);
    goTo(1 + oi, km.outputColumn);
    steps.push(...s);
    entered();
    if (oi > 0) {
      // a second output's row joins the first on the output column's left edge (without it the real CLICK 4.00's
      // Syntax Check: "Row 2, Column AF: Missing line connection")
      steps.push({ do: 'keys', keys: km.joinUp });
      at.row -= 1;
    }
  }
  if (r.comment && km.comment) {
    steps.push(
      { do: 'keys', keys: km.comment.keys },
      { do: 'window', title: km.comment.dialog, timeoutMs: 3000, optional: true },
      km.comment.field === 'typed'
        ? { do: 'keys', keys: typed(r.comment), optional: true }
        : { do: 'setText', find: km.comment.field, text: r.comment, optional: true },
      { do: 'click', find: km.ok, mouse: true, optional: true },
    );
  }
  return { number: r.number, steps };
}

/**
 * Every rung of the program, in program order (CLICK runs them top to bottom). A rung the app cannot enter is the
 * user's: `wait` stops the run for it (Continue), `list` (one click) leaves it out and lists it for afterwards,
 * with the rung it goes after.
 */
export function rungsPlan(program: LadderProgram, labels: Map<string, string>, km: ClickKeymap = DEFAULT_KEYMAP, yourTurn: 'wait' | 'list' = 'wait'): RungsPlan {
  const out: RungsPlan = { steps: [], entered: 0, leftForYou: [] };
  const all = clickEntryBlocks(program, labels).flatMap((b) => b.rungs).sort((a, b) => a.number - b.number);
  let last = 0;
  for (const r of all) {
    const p = rungSteps(km, r);
    if (p.leftForYou) {
      out.leftForYou.push({ number: p.number, why: p.leftForYou, after: last });
      if (yourTurn === 'wait') { out.steps.push(...p.steps); last = p.number; }
      continue;
    }
    out.steps.push(...p.steps);
    out.entered++;
    last = p.number;
  }
  out.steps.push(...endRung(km));
  return out;
}

/** The last rung: an unconditional END (CLICK's Syntax Check: "No unconditional END instruction in the Main Program"). */
export function endRung(km: ClickKeymap): ClickStep[] {
  return [
    { do: 'window', title: CLICK_MAIN },
    { do: 'keys', keys: km.newRung, say: 'Rung END: the end of the Main Program (CLICK needs it)' },
    { do: 'keys', keys: '{END}' },
    { do: 'window', title: CLICK_MAIN },
    { do: 'doubleClick', find: { name: '^End$' }, say: 'the END instruction' },
    { do: 'window', title: '^End', timeoutMs: 3000, optional: true },
    { do: 'click', find: km.ok, optional: true },
    { do: 'wait', ms: 300 },
  ];
}
