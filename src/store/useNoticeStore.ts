import { create } from 'zustand';

/**
 * One short message shown at the bottom of the window. Used instead of
 * alert(), which the claude.ai preview frame blocks (the user would see nothing).
 */
/** A button on the message (e.g. Undo); the message closes when it is pressed. */
export interface NoticeAction { label: string; run: () => void }

interface NoticeStore {
  message: string | null;
  action: NoticeAction | null;
  show: (message: string, action?: NoticeAction) => void;
  clear: () => void;
}

export const useNoticeStore = create<NoticeStore>()((set) => ({
  message: null,
  action: null,
  show: (message, action) => set({ message, action: action ?? null }),
  clear: () => set({ message: null, action: null }),
}));

export const notify = (message: string, action?: NoticeAction) => useNoticeStore.getState().show(message, action);
