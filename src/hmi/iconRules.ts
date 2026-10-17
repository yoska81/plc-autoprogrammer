/**
 * Which icon a button or navigation tile gets (Siemens look), chosen from what
 * it does: its label, on/off texts or target screen name.
 */

export type HmiIconName = 'play' | 'stop' | 'reset' | 'home' | 'hand' | 'gear' | 'warning' | 'search' | 'wrench' | 'power' | 'list' | 'chart';

const RULES: [RegExp, HmiIconName][] = [
  [/\b(reset|ack|acknowledge|clear|restart|retry)\b/i, 'reset'],
  [/\b(e-?stop|emergency|stop|halt|abort)\b/i, 'stop'],
  [/\b(start|run|cycle|go|resume)\b/i, 'play'],
  [/\b(alarms?|faults?|warnings?|events?)\b/i, 'warning'],
  [/\b(home|main|overview|start ?screen)\b/i, 'home'],
  [/\b(manual|hand|jog|inch)\b/i, 'hand'],
  [/\b(maint\w*|service|calibrat\w*)\b/i, 'wrench'],
  [/\b(diag\w*|i\/?o|inputs?|outputs?|monitor|status|inspect\w*)\b/i, 'search'],
  [/\b(setup|set-?up|settings?|config\w*|param\w*|recipes?|setpoints?|system)\b/i, 'gear'],
  [/\b(trends?|production|counts?|statistics?|reports?)\b/i, 'chart'],
  [/\b(power|on\/off)\b/i, 'power'],
  [/\b(log|history|list)\b/i, 'list'],
];

/** Icon for a button / nav tile, from the texts that describe it (first match wins). */
export function iconFor(...texts: (string | null | undefined)[]): HmiIconName | null {
  const t = texts.filter(Boolean).join(' ').replace(/_/g, ' ');
  if (!t) return null;
  for (const [re, name] of RULES) if (re.test(t)) return name;
  return null;
}
