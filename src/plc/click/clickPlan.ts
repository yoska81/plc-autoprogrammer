/**
 * "Send to CLICK": what the CLICK bridge (tools/click-bridge) does in CLICK Programming Software, as step plans the
 * bridge runs while the user watches. AutomationDirect publishes no API, so the steps name CLICK's windows and
 * controls the way UI Automation shows them. CLICK 4 has a ribbon UI Automation cannot see into (no menus), a
 * Navigation tree (Address Picker, the ladder program) and an Instruction List whose entries are named; CLICK 3 has
 * the classic menus. So each action is a oneOf: the ways to do it, tried in turn (CLICK 4's first), and the run says
 * which it tried when none works. The bridge records every window it opens in its log, and every window on a
 * failure, so the steps can be fitted to the user's CLICK from the log alone.
 * Nothing here saves: the bridge refuses any step that would (Ctrl+S, a Save menu or button).
 */

/** How a step names a control: its UI Automation id, its name (a pattern), its control type, the nth match. */
export interface ClickSelector { id?: string; name?: string; type?: string; index?: number }

export interface ClickStep {
  do: 'window' | 'menu' | 'click' | 'doubleClick' | 'setText' | 'select' | 'check' | 'keys' | 'wait' | 'note' | 'waitGone' | 'waitUser' | 'oneOf'
    /** close: the windows like `title`, when open (as their close box: Cancel). focus: the control gets the keyboard.
     * expect: a control like `find` shows `item` as chosen, else the step fails. refuse: a window like `title` ends the
     * run with `text`. */
    | 'close' | 'focus' | 'expect' | 'refuse';
  title?: string;
  find?: ClickSelector;
  text?: string;
  item?: string;
  keys?: string;
  /** Menu path; each part a pattern of the item's name. */
  path?: string[];
  ms?: number;
  timeoutMs?: number;
  /** Shown to the user while the step runs. */
  say?: string;
  /** check: the box on (default) or off. */
  on?: boolean;
  /** May not happen (a confirmation that does not come): skipped, with the optional steps after it. */
  optional?: boolean;
  /** oneOf: what it does ("New project"), and the ways to do it, tried in turn until one works. */
  what?: string;
  options?: { label: string; steps: ClickStep[] }[];
}

/** CLICK's main window. */
export const CLICK_MAIN = '^CLICK Programming Software';
/** The dialog where a new project's CPU is chosen ("Select a CPU Module": CPU Category, the list of CPUs, OK). */
const CPU_DIALOG = '(Select a CPU|CPU Module|New Project|Select CPU)';
/** CLICK 4's startup chooser: Start a new project, Open an existing project, Connect to PLC (and Close, Help). */
export const CHOOSER = '^Select an Operation';
/** CLICK asking whether to save the project open in it: the run never answers it (the user's project). */
const SAVE_QUESTION = '(Save|save changes|Do you want to save)';
const SAVE_REFUSED = 'CLICK asks whether to save the project that is open in it. Save or close that project in CLICK yourself, then press Put the project into CLICK again.';
/** The CPU list: a list or a table of the CPUs (not the CPU Category box). */
const CPU_LIST = 'List|DataGrid|Table|Tree';

/** A text as a pattern matching it exactly. */
export const literal = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const main: ClickStep = { do: 'window', title: CLICK_MAIN };

/** An entry of CLICK 4's Navigation tree (on its Program tab), opened by a double-click. */
const treeItem = (name: string): ClickStep[] => [
  main,
  { do: 'click', find: { type: 'TabItem', name: '^Program$' }, timeoutMs: 2000, optional: true },
  main,
  { do: 'doubleClick', find: { type: 'TreeItem', name } },
];

/**
 * A new project with the CPU, hands off. New project: Ctrl+N or the ribbon's key tips (CLICK 4), File › New Project
 * (CLICK 3); CLICK 4 may answer with its startup chooser ("Select an Operation") instead of the CPU dialog, or with
 * both: then Start a new project in it, or close it when the CPU dialog is already there. The CPU: its entry in the
 * list (scrolled to), picked in the list, or typed into the list; OK only once the list shows exactly that CPU as
 * chosen (else the run ends, and closes the dialogs it opened). CLICK asking to save the open project ends the run:
 * the user's project, never answered by the app.
 */
export function newProjectPlan(cpuId: string): ClickStep[] {
  const opened: ClickStep = { do: 'window', title: `(${CPU_DIALOG}|${CHOOSER.slice(1)})`, timeoutMs: 8000 };
  const cpu = `^${literal(cpuId)}\\b`;
  const cpuDialog: ClickStep = { do: 'window', title: CPU_DIALOG, timeoutMs: 8000 };
  const chosen: ClickStep = { do: 'expect', find: { type: CPU_LIST }, item: `^${literal(cpuId)}(\\s|$)`, timeoutMs: 2000 };
  const refuseSave: ClickStep = { do: 'refuse', title: SAVE_QUESTION, text: SAVE_REFUSED, timeoutMs: 1000 };
  return [
    { do: 'window', title: CLICK_MAIN, timeoutMs: 60000 },
    {
      do: 'oneOf', what: 'New project', say: 'New project', options: [
        { label: 'Ctrl+N', steps: [main, { do: 'keys', keys: '^n' }, opened] },
        { label: 'the File menu', steps: [main, { do: 'menu', path: ['File', 'New Project'] }, opened] },
        { label: 'the ribbon key tips (Alt, F, N)', steps: [main, { do: 'keys', keys: '%f' }, { do: 'wait', ms: 500 }, { do: 'keys', keys: 'n' }, opened] },
      ],
    },
    refuseSave,
    {
      do: 'oneOf', what: 'the CPU window', say: 'New project', options: [
        // the CPU dialog came (perhaps with the chooser beside it: closed)
        { label: 'the CPU dialog', steps: [{ ...cpuDialog, timeoutMs: 1500 }, { do: 'close', title: CHOOSER }] },
        { label: 'Start a new project in "Select an Operation"', steps: [{ do: 'window', title: CHOOSER, timeoutMs: 1500 }, { do: 'click', find: { name: '^Start a new project' } }, refuseSave, cpuDialog, { do: 'close', title: CHOOSER }] },
      ],
    },
    cpuDialog,
    {
      do: 'oneOf', what: `the CPU ${cpuId}`, say: `Choosing the CPU ${cpuId}`, options: [
        { label: 'its entry in the list', steps: [{ do: 'click', find: { name: cpu, type: 'ListItem|DataItem|TreeItem|Text' }, timeoutMs: 3000 }, chosen] },
        { label: 'picked in the list', steps: [{ do: 'select', find: { type: CPU_LIST }, item: cpu, timeoutMs: 2000 }, chosen] },
        { label: 'typed into the list', steps: [{ do: 'focus', find: { type: CPU_LIST }, timeoutMs: 2000 }, { do: 'keys', keys: `{HOME}${sendKeysText(cpuId)}` }, chosen] },
      ],
    },
    { do: 'click', find: { name: '^OK$', type: 'Button' } },
    refuseSave,
    { do: 'window', title: CLICK_MAIN, timeoutMs: 30000 },
  ];
}

/** Text typed as it is (SendKeys reads + ^ % ~ ( ) { } [ ] as keys). */
export const sendKeysText = (s: string) => s.replace(/[+^%~(){}[\]]/g, (c) => `{${c}}`);

/**
 * The expansion modules, slot by slot, for the user to add in System Configuration after the run (its slot
 * pictures are not controls UI Automation can name): one line for the result, not a stop in the middle.
 */
export function modulesLine(modules: string[]): string | null {
  return modules.length ? `Add ${modules.length === 1 ? 'this module' : `these ${modules.length} modules`} in CLICK's System Configuration: ${modules.map((m, i) => `slot ${i + 1}: ${m}`).join(', ')}.` : null;
}

/** The Address Picker: CLICK 4's Navigation tree, else View › Address Picker (CLICK 3). */
export function addressPickerPlan(): ClickStep[] {
  const came: ClickStep = { do: 'window', title: '^Address Picker', timeoutMs: 8000 };
  return [{
    do: 'oneOf', what: 'the Address Picker', say: 'Address Picker', options: [
      { label: 'the Navigation tree', steps: [...treeItem('^Address Picker$'), came] },
      { label: 'the View menu', steps: [main, { do: 'menu', path: ['View', 'Address Picker'] }, came] },
    ],
  }];
}

/** The nickname CSV into the Address Picker. `csvPath`: the file the bridge wrote. */
export function nicknamePlan(csvPath: string): ClickStep[] {
  const picker: ClickStep = { do: 'window', title: '^Address Picker' };
  const openCame: ClickStep = { do: 'window', title: '^(Open|Import)', timeoutMs: 8000 };
  return [
    ...addressPickerPlan(),
    {
      do: 'oneOf', what: 'the nickname import', say: 'Importing the nicknames', options: [
        { label: 'its Import button', steps: [picker, { do: 'click', find: { type: 'Button', name: '^Import' }, timeoutMs: 3000 }, { do: 'click', find: { type: 'MenuItem', name: 'Nick ?Name' }, timeoutMs: 2000, optional: true }, openCame] },
        { label: 'its File menu', steps: [picker, { do: 'menu', path: ['File', 'Import', 'Nick ?Names?'] }, openCame] },
      ],
    },
    { do: 'setText', find: { type: 'Edit', name: '^File name' }, text: csvPath },
    { do: 'click', find: { type: 'Button', name: '^Open$' } },
    // CLICK may ask to confirm or say it is done
    { do: 'window', title: '^(Import|CLICK|Address Picker)', timeoutMs: 3000, optional: true },
    { do: 'click', find: { type: 'Button', name: '^(OK|Yes)$' }, timeoutMs: 2000, optional: true },
    // the Address Picker closed again, so the ladder editor is in front for the rungs
    { do: 'window', title: '^Address Picker', timeoutMs: 2000, optional: true },
    { do: 'click', find: { type: 'Button', name: '^(Close|OK)$' }, timeoutMs: 2000, optional: true },
  ];
}

/** The ladder editor in front, at its first rung: CLICK 4's tree (Main Program), else the editor as it is. */
export function editorPlan(): ClickStep[] {
  return [
    {
      do: 'oneOf', what: 'the ladder editor', say: 'Ladder editor', options: [
        { label: 'Main Program in the Navigation tree', steps: [...treeItem('^Main Program$'), { do: 'wait', ms: 500 }] },
        { label: 'the editor that is open', steps: [main] },
      ],
    },
    main,
    { do: 'keys', keys: '^{HOME}' },
  ];
}

/** The project set up: CPU, nicknames, the ladder editor ready for the rungs (modules: modulesLine, after the run). */
export function setupPlan(o: { cpuId: string; nicknameCsvPath: string }): ClickStep[] {
  return [...newProjectPlan(o.cpuId), ...nicknamePlan(o.nicknameCsvPath), ...editorPlan()];
}

/** Every step of a plan, the ways of a oneOf included. */
export const allSteps = (steps: ClickStep[]): ClickStep[] => steps.flatMap((s) => [s, ...allSteps((s.options ?? []).flatMap((o) => o.steps))]);

/** Steps the bridge would refuse (a save): none of the app's plans has one (checked by the tests, as the bridge does). */
export function saveSteps(steps: ClickStep[]): number[] {
  const saveName = /^\s*\^?\s*save\b/i;
  const saves = (s: ClickStep): boolean => (
    (s.do === 'keys' && /\^\{?[sS]\}?|\{F12\}/.test(s.keys ?? ''))
    || (s.do === 'menu' && (s.path ?? []).some((p) => saveName.test(p)))
    || ((s.do === 'click' || s.do === 'doubleClick' || s.do === 'select') && saveName.test(s.find?.name ?? ''))
    || (s.options ?? []).some((o) => o.steps.some(saves)));
  return steps.flatMap((s, i) => (saves(s) ? [i] : []));
}
