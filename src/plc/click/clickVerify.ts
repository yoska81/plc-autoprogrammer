/**
 * Send to CLICK, the check: what CLICK has, compared with the project. AutomationDirect documents no ladder export,
 * so the two things CLICK does write are used: the Address Picker's nickname export (CSV), and the printed ladder
 * (CLICK's Print, to the "Microsoft Print to PDF" printer). The bridge opens those dialogs and types the file name
 * (in its own folder); the user presses Save there (the app never presses Save). Then:
 *   - nicknames: every address's nickname, ours against CLICK's;
 *   - rungs: the addresses of each rung, in order, ours against the printout's text (a missing, extra or wrong
 *     address is found and named by its rung; how the instructions are drawn is not compared).
 */
import { clickEntryBlocks } from '../core/clickEntrySheet';
import type { LadderProgram } from '../core/ladder';
import { addressPickerPlan, CLICK_MAIN, type ClickStep } from './clickPlan';
import { value } from './clickRungs';

/** The bridge's folder joined with a file name (Windows path). */
export const inFolder = (folder: string, name: string) => `${folder.replace(/[\\/]+$/, '')}\\${name}`;

/** The nicknames exported from the Address Picker to `folder\name`; the user presses Save. */
export function exportNicknamesPlan(folder: string, name: string): ClickStep[] {
  const picker: ClickStep = { do: 'window', title: '^Address Picker' };
  const saveCame: ClickStep = { do: 'window', title: '(Save As|Export)', timeoutMs: 8000 };
  return [
    ...addressPickerPlan(),
    {
      do: 'oneOf', what: 'the nickname export', say: 'Exporting the nicknames', options: [
        { label: 'its Export button', steps: [picker, { do: 'click', find: { type: 'Button', name: '^Export' }, timeoutMs: 3000 }, { do: 'click', find: { type: 'MenuItem', name: 'Nick ?Name' }, timeoutMs: 2000, optional: true }, saveCame] },
        { label: 'its File menu', steps: [picker, { do: 'menu', path: ['File', 'Export', 'Nick ?Names?'] }, saveCame] },
      ],
    },
    { do: 'setText', find: { type: 'Edit', name: '^File name' }, text: inFolder(folder, name) },
    { do: 'waitGone', title: '(Save As|Export)', say: 'Your turn: press Save in the dialog (the file name is filled in)' },
    { do: 'window', title: '^(Export|CLICK|Address Picker)', timeoutMs: 3000, optional: true },
    { do: 'click', find: { type: 'Button', name: '^OK$' }, timeoutMs: 2000, optional: true },
  ];
}

/** The ladder printed to a PDF at `folder\name` (CLICK's Print, the Microsoft Print to PDF printer); the user presses Save. */
export function printLadderPlan(folder: string, name: string): ClickStep[] {
  const printCame: ClickStep = { do: 'window', title: '^Print', timeoutMs: 8000 };
  const main: ClickStep = { do: 'window', title: CLICK_MAIN };
  return [
    main,
    {
      do: 'oneOf', what: 'Print', say: 'Printing the ladder to a PDF', options: [
        { label: 'Ctrl+P', steps: [main, { do: 'keys', keys: '^p' }, printCame] },
        { label: 'the File menu', steps: [main, { do: 'menu', path: ['File', 'Print'] }, printCame] },
      ],
    },
    // CLICK 4.00's Print dialog: the printer is its leftmost list (top); the Ladder tab's check box (on by default) is
    // its leftmost unnamed one; the printout as text, not an image (the check reads the PDF's text)
    { do: 'select', find: { type: 'ComboBox', order: 'left' }, item: '^Microsoft Print to PDF$', optional: true },
    { do: 'check', find: { type: 'CheckBox', name: '^$', order: 'left' }, optional: true },
    { do: 'check', find: { name: '^Improved Image Quality$' }, on: false, optional: true },
    // the Cross Reference tab's box (the third unnamed one from the left): every address with the rungs that use it,
    // as text (CLICK 4.00 prints the ladder itself as a picture)
    { do: 'check', find: { type: 'CheckBox', name: '^$', order: 'left', index: 2 }, optional: true },
    { do: 'click', find: { type: 'Button', name: '^(OK|Print)$' }, mouse: true },
    // then Windows' own Print dialog (also "Print", class #32770): its OK, with the mouse (pressed through UI
    // Automation it waits for the Save dialog that follows)
    { do: 'window', title: '^Print \\[#32770\\]$', timeoutMs: 10000, optional: true },
    { do: 'click', find: { type: 'Button', name: '^OK$' }, mouse: true, optional: true },
    { do: 'window', title: 'Save Print Output As', timeoutMs: 30000 },
    { do: 'setText', find: { type: 'Edit', name: '^File name' }, text: inFolder(folder, name) },
    { do: 'waitGone', title: 'Save Print Output As', say: 'Your turn: press Save in the dialog (the file name is filled in)' },
    { do: 'wait', ms: 2000 },
  ];
}

/** A CSV line's cells (quotes as Excel writes them). */
function cells(line: string): string[] {
  const out: string[] = [];
  let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out.map((x) => x.trim());
}

/** Address → nickname of a nickname CSV (the header names the Address and Nickname columns). */
export function nicknamesOf(csv: string): Map<string, string> {
  const lines = csv.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim());
  const head = cells(lines[0] ?? '').map((h) => h.toLowerCase());
  const ai = head.findIndex((h) => /address/.test(h)), ni = head.findIndex((h) => /nick ?name/.test(h));
  const out = new Map<string, string>();
  if (ai < 0 || ni < 0) return out;
  for (const l of lines.slice(1)) {
    const c = cells(l);
    if (c[ai] && c[ni]) out.set(c[ai].toUpperCase(), c[ni]);
  }
  return out;
}

export interface NicknameCheck { checked: number; missing: string[]; different: { address: string; ours: string; click: string }[] }

/** Our nicknames against CLICK's export: each of ours must be there, the same. */
export function compareNicknames(oursCsv: string, clickCsv: string): NicknameCheck {
  const ours = nicknamesOf(oursCsv), theirs = nicknamesOf(clickCsv);
  const missing: string[] = [], different: NicknameCheck['different'] = [];
  for (const [a, n] of ours) {
    const t = theirs.get(a);
    if (t === undefined) missing.push(a);
    else if (t !== n) different.push({ address: a, ours: n, click: t });
  }
  return { checked: ours.size, missing, different };
}

/** CLICK addresses in a text, in order (X001, Y101, C1, DS10, T1, CT1, TD1, CTD1, DF5, SC2 …). */
export function addressesIn(text: string): string[] {
  return [...text.toUpperCase().matchAll(/\b(XD|YD|CTD|CT|TD|SC|SD|DS|DD|DH|DF|TXT|X|Y|C|T)(\d{1,4})\b/g)].map((m) => {
    const [, area, n] = m;
    // inputs and outputs have three digits in CLICK (X1 = X001)
    return /^[XY]$/.test(area) ? `${area}${n.padStart(3, '0')}` : `${area}${Number(n)}`;
  });
}

/** Each rung's addresses in the order they are drawn: row by row, then the outputs. */
export function rungAddressesInOrder(program: LadderProgram): { rung: number; addresses: string[] }[] {
  return clickEntryBlocks(program, new Map()).flatMap((b) => b.rungs).sort((a, b) => a.number - b.number).map((r) => ({
    rung: r.number,
    addresses: [...r.rows.flat(), ...r.outputs].flatMap((c) => c.fields.flatMap(([, v]) => addressesIn(value(v)))),
  }));
}

export interface RungCheck {
  rungs: number;
  /** Rungs whose every address is in the printout, in order. */
  ok: number;
  /** Rungs with an address not found where it should be. */
  differences: { rung: number; missing: string[] }[];
  /** Addresses in the printout that no rung of ours has there (an extra or wrong instruction). */
  extra: string[];
}

/**
 * Our rungs against the printout's text: the longest common sequence of addresses (both in reading order) finds,
 * for each rung, which of its addresses the printout has where they belong; the printout's leftovers are extra.
 */
export function compareRungs(program: LadderProgram, printedText: string): RungCheck {
  const ours = rungAddressesInOrder(program);
  const seq = ours.flatMap((r) => r.addresses.map((a) => ({ a, rung: r.rung })));
  const got = addressesIn(printedText);
  // LCS table over the two sequences (programs of a few thousand addresses: fine)
  const n = seq.length, m = got.length;
  const L: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = seq[i].a === got[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const found = new Array<boolean>(n).fill(false), used = new Array<boolean>(m).fill(false);
  for (let i = 0, j = 0; i < n && j < m;) {
    if (seq[i].a === got[j]) { found[i] = used[j] = true; i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) i++;
    else j++;
  }
  const missingBy = new Map<number, string[]>();
  seq.forEach((s, i) => { if (!found[i]) missingBy.set(s.rung, [...(missingBy.get(s.rung) ?? []), s.a]); });
  const differences = [...missingBy].map(([rung, missing]) => ({ rung, missing }));
  return { rungs: ours.length, ok: ours.length - differences.length, differences, extra: got.filter((_, j) => !used[j]) };
}
