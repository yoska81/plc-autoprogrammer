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
export interface ClickSelector {
  id?: string; name?: string; type?: string; index?: number;
  /** 'left': the matches counted left to right on the screen (CLICK 4's Startup buttons have no names). */
  order?: 'left';
}

export interface ClickStep {
  do: 'window' | 'menu' | 'click' | 'doubleClick' | 'setText' | 'select' | 'check' | 'keys' | 'wait' | 'note' | 'waitGone' | 'waitUser' | 'oneOf';
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
  /** click: a real mouse click (CLICK's own dialogs' OK), not UI Automation's press. */
  mouse?: boolean;
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
/** The dialog where a new project's CPU is chosen (CLICK 3: "Select a CPU Module"). */
const CPU_DIALOG = '^(Select a CPU|CPU Module|New Project|Select CPU)';
/**
 * CLICK 4's "Startup" window (Select an Operation: Start a new project, Open an existing project, Connect to PLC): Ctrl+N
 * opens it, and the CPU dialog opens inside it. Its three picture buttons have no names; Start a new project is the
 * leftmost. Seen in a user's CLICK 4.00 log: main window → Startup (TfrmStartup) → Select a CPU Module (TfrmCPU).
 */
const STARTUP = '^Startup$';
/** CLICK 4's new-project password question (TfrmUserAccountsSetupDlg). */
const USER_ACCOUNTS = '^User Account Setup$';
/** A message box of CLICK's: its title is a plain word or just the program's name (not the main window's long title). */
const MESSAGE_BOX = '^(Confirm\\w*|Confirmation|Warning|Information|Error|CLICK|CLICK Programming Software)$';
/** For the result, on CLICK 4: the app answered the password question with none. */
export const clickPasswordNote = 'The new project has no password (CLICK 4 asked; the app chose none, like CLICK 3 projects): to protect it, set one in CLICK under Setup › User Account Setup.';
/**
 * CLICK 4's "What's New Feature Guide", shown when CLICK starts (a user's CLICK 4.00): nothing to do there but close
 * it. Where its pictures cannot show (the build server's real CLICK) it is a small "ClickNewFeature" box with OK.
 */
const WHATS_NEW = '^(What.s New|ClickNewFeature)';

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
 * After Ctrl+N: CLICK 4's Startup window or the CPU dialog, whichever comes; in Startup, its leftmost button (Start a new
 * project). When the CPU dialog came straight away it has no such button: the optional press is skipped.
 */
const startupThenCpu = (cpuCame: ClickStep): ClickStep[] => [
  { do: 'window', title: `${STARTUP}|${CPU_DIALOG}`, timeoutMs: 8000 },
  { do: 'click', find: { type: 'Button', name: '^(Start a new project)?$', order: 'left' }, mouse: true, timeoutMs: 2000, optional: true },
  cpuCame,
];

/** A new project with the CPU: File › New Project (CLICK 3), Ctrl+N or the ribbon's key tips (CLICK 4). */
export function newProjectPlan(cpuId: string): ClickStep[] {
  const cpuCame: ClickStep = { do: 'window', title: CPU_DIALOG, timeoutMs: 8000 };
  return [
    // CLICK 4 just started may show its Startup window (over the main one, or alone)
    { do: 'window', title: `${CLICK_MAIN}|${STARTUP}|${WHATS_NEW}`, timeoutMs: 60000 },
    // and, first, its "What's New Feature Guide" (seen with CLICK 4.00): closed, it only tells news
    { do: 'window', title: WHATS_NEW, timeoutMs: 3000, optional: true },
    { do: 'click', find: { type: 'Button', name: '^(Close|OK)$' }, timeoutMs: 2000, optional: true },
    {
      do: 'oneOf', what: 'New project', say: 'New project', options: [
        {
          label: 'the Startup window CLICK shows when it starts', steps: [
            { do: 'window', title: STARTUP, timeoutMs: 4000 },
            { do: 'click', find: { type: 'Button', name: '^(Start a new project)?$', order: 'left' }, mouse: true, timeoutMs: 2000 },
            cpuCame,
          ],
        },
        { label: 'Ctrl+N', steps: [main, { do: 'keys', keys: '^n' }, ...startupThenCpu(cpuCame)] },
        { label: 'the File menu', steps: [main, { do: 'menu', path: ['File', 'New Project'] }, cpuCame] },
        { label: 'the ribbon key tips (Alt, F, N)', steps: [main, { do: 'keys', keys: '%f' }, { do: 'wait', ms: 500 }, { do: 'keys', keys: 'n' }, ...startupThenCpu(cpuCame)] },
      ],
    },
    {
      do: 'oneOf', what: `the CPU ${cpuId}`, say: `Choosing the CPU ${cpuId}`, options: [
        { label: 'its entry in the list', steps: [{ do: 'click', find: { name: `^${literal(cpuId)}\\b` }, timeoutMs: 5000 }] },
        { label: 'the CPU pick list', steps: [{ do: 'select', find: { type: 'ComboBox' }, item: `^${literal(cpuId)}\\b`, timeoutMs: 3000 }] },
      ],
    },
    { do: 'click', find: { name: '^OK$', type: 'Button' }, mouse: true },
    // CLICK 4.00 then asks for the new project's user accounts ("User Account Setup", seen in a user's log): no password,
    // as CLICK 3 projects; the result says how to set one (clickPasswordNote)
    { do: 'window', title: USER_ACCOUNTS, timeoutMs: 5000, optional: true },
    { do: 'check', find: { type: 'CheckBox', name: '^Disable Password Requirement$' }, on: true, optional: true },
    { do: 'wait', ms: 800 },
    // a question it may ask about going without a password (a message box: a plain title, Yes / OK)
    { do: 'window', title: MESSAGE_BOX, timeoutMs: 1500, optional: true },
    { do: 'click', find: { type: 'Button', name: '^(Yes|OK)$' }, optional: true },
    { do: 'wait', ms: 300 }, // (ends the skipping: User Account Setup's OK is looked for whether or not a box came)
    { do: 'window', title: USER_ACCOUNTS, timeoutMs: 1500, optional: true },
    { do: 'click', find: { type: 'Button', name: '^OK$' }, mouse: true, optional: true },
    { do: 'wait', ms: 800 },
    { do: 'window', title: MESSAGE_BOX, timeoutMs: 1500, optional: true },
    { do: 'click', find: { type: 'Button', name: '^(Yes|OK)$' }, optional: true },
    { do: 'wait', ms: 1500 },
    // (CLICK 4 closes its Startup window by itself once the project is made: pressing a Close there, as an earlier
    // plan did, closed CLICK on the build server's real CLICK)
    { do: 'window', title: CLICK_MAIN, timeoutMs: 30000 },
  ];
}

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

/**
 * The nickname CSV into the Address Picker. `csvPath`: the file the bridge wrote. CLICK 4: File › Import › Nickname
 * ("Import to Address Picker") in the ribbon's File menu, by its key tips Alt+F, I, N (seen in the real CLICK 4.00 on
 * the build server; its Address Picker has no Import button); CLICK 3: the Address Picker's own Import or File menu.
 */
export function nicknamePlan(csvPath: string): ClickStep[] {
  const picker: ClickStep = { do: 'window', title: '^Address Picker' };
  const openCame: ClickStep = { do: 'window', title: '^(Open|Import)', timeoutMs: 8000 };
  return [
    {
      do: 'oneOf', what: 'the nickname import', say: 'Importing the nicknames', options: [
        { label: 'File › Import › Nickname (key tips Alt+F, I, N)', steps: [main, { do: 'keys', keys: '%f' }, { do: 'wait', ms: 800 }, { do: 'keys', keys: 'i' }, { do: 'wait', ms: 800 }, { do: 'keys', keys: 'n' }, openCame] },
        { label: 'the Address Picker\'s Import button', steps: [...addressPickerPlan(), picker, { do: 'click', find: { type: 'Button', name: '^Import' }, timeoutMs: 3000 }, { do: 'click', find: { type: 'MenuItem', name: 'Nick ?Name' }, timeoutMs: 2000, optional: true }, openCame] },
        { label: 'the Address Picker\'s File menu', steps: [...addressPickerPlan(), picker, { do: 'menu', path: ['File', 'Import', 'Nick ?Names?'] }, openCame] },
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
