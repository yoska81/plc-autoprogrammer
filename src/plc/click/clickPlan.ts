/**
 * "Send to CLICK": what the CLICK bridge (tools/click-bridge) does in CLICK Programming Software, as step plans the
 * bridge runs while the user watches. AutomationDirect publishes no API, so the steps name CLICK's windows, menus
 * and controls the way UI Automation shows them; they are the first version (CLICK v3, from its help: File › New
 * Project, the "Select a CPU Module" list, Setup › System Configuration, the Address Picker's File › Import ›
 * Nickname) and are corrected from the controls the bridge records on the user's PC ("Record CLICK's windows").
 * Nothing here saves: the bridge refuses any step that would (Ctrl+S, a Save menu or button).
 */

/** How a step names a control: its UI Automation id, its name (a pattern), its control type, the nth match. */
export interface ClickSelector { id?: string; name?: string; type?: string; index?: number }

export interface ClickStep {
  do: 'window' | 'menu' | 'click' | 'doubleClick' | 'setText' | 'select' | 'keys' | 'wait' | 'note' | 'waitGone' | 'waitUser';
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
  /** May not happen (a confirmation that does not come): skipped, with the optional steps after it. */
  optional?: boolean;
}

/** CLICK's main window. */
export const CLICK_MAIN = '^CLICK Programming Software';

/** A text as a pattern matching it exactly. */
export const literal = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A new project with the CPU (File › New Project, then the CPU in "Select a CPU Module"). */
export function newProjectPlan(cpuId: string): ClickStep[] {
  return [
    { do: 'window', title: CLICK_MAIN, timeoutMs: 60000 },
    { do: 'menu', path: ['File', 'New Project'], say: 'New project' },
    { do: 'window', title: '^(Select a CPU Module|New Project|Select CPU)', say: `Choosing the CPU ${cpuId}` },
    { do: 'click', find: { name: `^${literal(cpuId)}\\b` }, say: `CPU ${cpuId}` },
    { do: 'click', find: { name: '^OK$', type: 'Button' } },
    { do: 'window', title: CLICK_MAIN, timeoutMs: 30000 },
  ];
}

/**
 * The expansion modules, slot by slot: System Configuration is opened and the user adds them there (its slot
 * pictures are not controls UI Automation can name yet); the run waits until the window is closed.
 */
export function modulesPlan(modules: string[]): ClickStep[] {
  if (!modules.length) return [];
  const list = modules.map((m, i) => `slot ${i + 1}: ${m}`).join(', ');
  return [
    { do: 'window', title: CLICK_MAIN },
    { do: 'menu', path: ['Setup', 'System Configuration'], say: 'System Configuration' },
    { do: 'window', title: '^System Configuration' },
    { do: 'note', text: `Add the modules in System Configuration: ${list}. Then press OK there; the app goes on when the window closes.` },
    { do: 'waitGone', title: '^System Configuration', say: `Your turn: add ${list}, then OK` },
  ];
}

/** The nickname CSV into the Address Picker (its File › Import › Nickname). `csvPath`: the file the bridge wrote. */
export function nicknamePlan(csvPath: string): ClickStep[] {
  return [
    { do: 'window', title: CLICK_MAIN },
    { do: 'menu', path: ['View', 'Address Picker'], say: 'Address Picker' },
    { do: 'window', title: '^Address Picker' },
    { do: 'menu', path: ['File', 'Import', 'Nick ?Names?'], say: 'Importing the nicknames' },
    { do: 'window', title: '^(Open|Import)' },
    { do: 'setText', find: { type: 'Edit', name: '^File name' }, text: csvPath },
    { do: 'click', find: { type: 'Button', name: '^Open$' } },
    // CLICK may ask to confirm or say it is done
    { do: 'window', title: '^(Import|CLICK|Address Picker)', timeoutMs: 3000, optional: true },
    { do: 'click', find: { type: 'Button', name: '^(OK|Yes)$' }, timeoutMs: 2000, optional: true },
    { do: 'note', text: 'Nicknames imported: check them in the Address Picker, then close it.' },
  ];
}

/** The project set up: CPU, modules, nicknames (the rungs come in the next step). */
export function setupPlan(o: { cpuId: string; modules: string[]; nicknameCsvPath: string }): ClickStep[] {
  return [...newProjectPlan(o.cpuId), ...modulesPlan(o.modules), ...nicknamePlan(o.nicknameCsvPath)];
}

/** Steps the bridge would refuse (a save): none of the app's plans has one (checked by the tests, as the bridge does). */
export function saveSteps(steps: ClickStep[]): number[] {
  const saveName = /^\s*\^?\s*save\b/i;
  return steps.flatMap((s, i) => (
    (s.do === 'keys' && /\^\{?[sS]\}?|\{F12\}/.test(s.keys ?? ''))
    || (s.do === 'menu' && (s.path ?? []).some((p) => saveName.test(p)))
    || ((s.do === 'click' || s.do === 'doubleClick' || s.do === 'select') && saveName.test(s.find?.name ?? ''))
      ? [i] : []));
}
