/**
 * HMI alarm messages the user rewrote, kept by the generated message (the generator gives the same
 * alarm the same text), so a regenerated HMI shows the user's wording again.
 */
import type { HmiAlarm, HmiDesign } from '../hmi/types';
import { currentEdits, type TextEdit } from './useEditsStore';

const PREFIX = 'hmiAlarm:';
export const alarmKey = (generated: string) => `${PREFIX}${generated}`;

/** The user's edit behind an alarm as it is shown now, if any. */
export function alarmEdit(a: HmiAlarm, texts: Record<string, TextEdit> = currentEdits().texts): { key: string; edit: TextEdit } | null {
  const own = texts[alarmKey(a.message)];
  if (own) return { key: alarmKey(a.message), edit: own };
  for (const [key, edit] of Object.entries(texts)) if (key.startsWith(PREFIX) && edit.value === a.message) return { key, edit };
  return null;
}

/** Put the user's alarm texts into a design (generated, regenerated or restored). */
export function keepAlarmTexts(d: HmiDesign | null, texts: Record<string, TextEdit> = currentEdits().texts): HmiDesign | null {
  if (!d?.alarms?.length) return d;
  let changed = false;
  const alarms = d.alarms.map((a) => {
    const e = texts[alarmKey(a.message)];
    if (!e || e.value === a.message) return a;
    changed = true;
    return { ...a, message: e.value };
  });
  return changed ? { ...d, alarms } : d;
}
