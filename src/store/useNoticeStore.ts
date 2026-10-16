import { create } from 'zustand';

/**
 * One short message shown at the bottom of the window. Used instead of
 * alert(), which the claude.ai preview frame blocks (the user would see nothing).
 */
interface NoticeStore {
  message: string | null;
  show: (message: string) => void;
  clear: () => void;
}

export const useNoticeStore = create<NoticeStore>()((set) => ({
  message: null,
  show: (message) => set({ message }),
  clear: () => set({ message: null }),
}));

export const notify = (message: string) => useNoticeStore.getState().show(message);
