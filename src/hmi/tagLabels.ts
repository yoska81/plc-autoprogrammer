/**
 * HMI addresses as the user's PLC names them. Screens, tags and alarms are bound to the neutral
 * memory the simulator runs (C1001, DS1001, X001…); on an Allen-Bradley or Siemens project the
 * exported program calls them by tag ("HMI_Start", "Machine_DB".Cycle_Running), so that is what
 * the HMI page shows next to them.
 */
const NEUTRAL = /\b(?:CTD|TD|CT|DS|DD|DF|DH|C|T|X|Y)\d{1,4}\b/g;

/** Text with each neutral address that has a PLC tag replaced by the tag (and the address in brackets). */
export function withTagNames(text: string, tagOf: ((address: string) => string | null) | null): string {
  if (!tagOf) return text;
  return text.replace(NEUTRAL, (a) => { const n = tagOf(a); return n && n !== a ? `${n} (${a})` : a; });
}
