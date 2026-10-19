import type { HTMLAttributes } from 'react';

/** Element ids that tie a phone tab to the pane it shows. */
export const phoneTabId = (base: string, id: string) => `${base}-tab-${id}`;
export const phonePanelId = (base: string, id: string) => `${base}-panel-${id}`;

/** Props for a pane shown by a phone tab strip (nothing on a wider screen, where every pane shows). */
export function phonePanel(narrow: boolean, base: string, id: string): HTMLAttributes<HTMLDivElement> {
  return narrow ? { role: 'tabpanel', id: phonePanelId(base, id), 'aria-labelledby': phoneTabId(base, id) } : {};
}
