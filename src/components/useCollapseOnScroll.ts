import { useEffect, useState } from 'react';

/**
 * On a phone the page header folds to one line once a pane inside the page is scrolled down, so the
 * workspace gets the height, and unfolds when that pane is scrolled back to the top. Returns whether it
 * is folded and a setter for the header's own "More" button.
 */
export function useCollapseOnScroll(enabled: boolean) {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    const on = (e: Event) => {
      const t = e.target;
      if (!(t instanceof HTMLElement) || !t.closest('main') || t.closest('main header')) return;
      if (t.scrollTop > 24) setCollapsed(true);
      // Back at the top of something that still scrolls: a pane that fits once the header folds stays folded.
      else if (t.scrollTop === 0 && t.scrollHeight > t.clientHeight) setCollapsed(false);
    };
    document.addEventListener('scroll', on, true);
    return () => document.removeEventListener('scroll', on, true);
  }, [enabled]);
  return [enabled && collapsed, setCollapsed] as const;
}
