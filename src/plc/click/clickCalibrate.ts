/**
 * Send to CLICK, the calibration: before a real program, three sample rungs are entered in a new, empty CLICK
 * project through the keymap (a contact and a coil; a seal-in with a parallel row and an NC contact; a timer), then
 * CLICK prints them to a PDF and the app reads the printout back (clickVerify.compareRungs). The result says
 * whether the keymap fits this CLICK version, rung by rung, and a report file (the CLICK version, the keymap, the
 * steps, the printout's text, what matched) is written for support, to fit the keymap when it does not.
 */
import type { LadderProgram } from '../core/ladder';
import { DEFAULT_KEYMAP, rungsPlan, type ClickKeymap } from './clickRungs';
import { compareRungs, printLadderPlan, type RungCheck } from './clickVerify';
import type { ClickStep } from './clickPlan';

/** The three sample rungs (addresses every CLICK CPU has; the project they go into is a new, empty one). */
export const CALIBRATION_PROGRAM: LadderProgram = {
  tags: [],
  rungs: [
    { id: 'cal_1', comment: 'Calibration 1: contact and coil', branches: [[{ type: 'NO', address: 'X001' }]], outputs: [{ type: 'OUT', address: 'Y001' }] },
    {
      id: 'cal_2', comment: 'Calibration 2: seal-in',
      branches: [[{ type: 'NO', address: 'X002' }, { type: 'NC', address: 'X003' }], [{ type: 'NO', address: 'C2001' }, { type: 'NC', address: 'X003' }]],
      outputs: [{ type: 'OUT', address: 'C2001' }],
    },
    { id: 'cal_3', comment: 'Calibration 3: timer', branches: [[{ type: 'NO', address: 'C2001' }]], outputs: [{ type: 'TMR', address: 'T50', mode: 'ON_DELAY', preset: '5', unit: 'sec', accumulate: false, resetAddress: null }] },
  ],
};

export const CALIBRATION_PDF = 'click_calibration.pdf';
export const CALIBRATION_REPORT = 'click_calibration.txt';

/** The steps: the sample rungs, then the printout (the user presses Save there). */
export function calibrationPlan(folder: string, km: ClickKeymap = DEFAULT_KEYMAP): { rungs: ClickStep[]; print: ClickStep[]; entered: number } {
  const p = rungsPlan(CALIBRATION_PROGRAM, new Map(), km);
  return { rungs: p.steps, print: printLadderPlan(folder, CALIBRATION_PDF), entered: p.entered };
}

export interface Calibration {
  check: RungCheck;
  /** Every sample rung found in the printout, in order: the keymap fits this CLICK. */
  fits: boolean;
}

export function calibrationResult(printedText: string): Calibration {
  const check = compareRungs(CALIBRATION_PROGRAM, printedText);
  return { check, fits: check.ok === check.rungs && !check.extra.length };
}

/** The report for support: plain text, everything needed to fit the keymap to this CLICK. */
export function calibrationReport(o: { clickVersion: string; when: string; result: Calibration | null; error?: string; printedText: string; steps: ClickStep[]; km?: ClickKeymap }): string {
  const km = o.km ?? DEFAULT_KEYMAP;
  const r = o.result;
  return [
    'ISA Auto Programmer: CLICK calibration',
    `When: ${o.when}`,
    `CLICK Programming Software: ${o.clickVersion || 'version not known'}`,
    `Keymap: ${km.checkedOn ? `fitted to CLICK ${km.checkedOn}` : 'the first version (from the CLICK help)'}; new rung ${km.newRung}, join up ${km.joinUp}, outputs in column ${km.outputColumn}, after an entry the cursor moves ${km.afterEntry.rows} row(s), ${km.afterEntry.columns} column(s)`,
    '',
    'Result:',
    o.error ? `  Stopped: ${o.error}` : r ? (r.fits ? '  All 3 sample rungs are in CLICK as they should be: the keys fit this CLICK.' : `  ${r.check.ok} of ${r.check.rungs} sample rungs as they should be.`) : '  No result.',
    ...(r?.check.differences ?? []).map((d) => `  Rung ${d.rung}: ${d.missing.join(', ')} not where it should be`),
    ...(r?.check.extra.length ? [`  In CLICK but not in the sample: ${r.check.extra.join(', ')}`] : []),
    '',
    'The sample rungs:',
    ...CALIBRATION_PROGRAM.rungs.map((g, i) => `  ${i + 1}. ${g.comment}: ${g.branches.map((b) => b.map((e) => ('address' in e ? `${e.type} ${e.address}` : e.type)).join(' AND ')).join(' OR ')} -> ${g.outputs.map((x) => `${x.type} ${'address' in x ? x.address : ''}`).join(', ')}`),
    '',
    'The printout\'s text:',
    o.printedText.trim() ? o.printedText.trim() : '  (none)',
    '',
    `The steps (${o.steps.length}):`,
    ...o.steps.map((s, i) => `  ${i + 1}. ${JSON.stringify(s)}`),
    '',
  ].join('\r\n');
}
