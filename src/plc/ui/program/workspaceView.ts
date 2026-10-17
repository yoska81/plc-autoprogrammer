/**
 * Program page view helpers: full screen (the ladder workspace over the whole window) and undo / redo of
 * hand edits to the ladder.
 *
 * Full screen uses the Fullscreen API on the document (Chromium and Electron) so popovers that are
 * position: fixed (the instruction editor) stay visible, and the workspace is shown as a fixed overlay on
 * top of the app either way — which is also the fallback where the API is missing or refused.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { LadderProgram } from '../../core/ladder';

const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

export function useFullScreen(): { full: boolean; toggle: () => void } {
  const [full, setFull] = useState(false);
  const enter = useCallback(() => {
    setFull(true);
    const el = document.documentElement;
    if (document.fullscreenEnabled && !document.fullscreenElement && el.requestFullscreen) el.requestFullscreen().catch(() => { /* the overlay alone */ });
  }, []);
  const exit = useCallback(() => {
    setFull(false);
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
  }, []);
  const toggle = useCallback(() => (full ? exit() : enter()), [full, enter, exit]);

  useEffect(() => {
    // Esc in browser full screen leaves it without a keydown reaching the page.
    const onChange = () => { if (!document.fullscreenElement) setFull(false); };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'f') { e.preventDefault(); toggle(); return; }
      // Esc leaves full screen unless it is closing a popover (the instruction editor handles its own Esc).
      if (e.key === 'Escape' && full && !document.querySelector('[role=dialog]')) exit();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [full, toggle, exit]);
  // Leaving the page while in full screen: leave browser full screen too.
  useEffect(() => () => { if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {}); }, []);
  return { full, toggle };
}

/**
 * Undo / redo for hand edits (Ctrl+Z, Ctrl+Shift+Z / Ctrl+Y, also from the toolbar). A program set from
 * elsewhere (AI change approved, rebuild, history restore) starts a new history.
 */
export function useLadderHistory(ladder: LadderProgram, set: (p: LadderProgram) => void) {
  const past = useRef<LadderProgram[]>([]);
  const future = useRef<LadderProgram[]>([]);
  const mine = useRef<LadderProgram | null>(null);
  const [avail, setAvail] = useState({ undo: false, redo: false });
  useEffect(() => {
    if (ladder !== mine.current) { past.current = []; future.current = []; mine.current = ladder; setAvail({ undo: false, redo: false }); }
  }, [ladder]);
  const apply = useCallback((p: LadderProgram) => { mine.current = p; set(p); setAvail({ undo: past.current.length > 0, redo: future.current.length > 0 }); }, [set]);
  const edit = useCallback((p: LadderProgram) => { past.current = [...past.current, ladder].slice(-100); future.current = []; apply(p); }, [ladder, apply]);
  const undo = useCallback(() => {
    const prev = past.current.at(-1);
    if (!prev) return;
    past.current = past.current.slice(0, -1); future.current = [...future.current, ladder]; apply(prev);
  }, [ladder, apply]);
  const redo = useCallback(() => {
    const next = future.current.at(-1);
    if (!next) return;
    future.current = future.current.slice(0, -1); past.current = [...past.current, ladder]; apply(next);
  }, [ladder, apply]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || typing(e.target)) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); } else if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); redo(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [undo, redo]);
  return { edit, undo, redo, canUndo: avail.undo, canRedo: avail.redo };
}
