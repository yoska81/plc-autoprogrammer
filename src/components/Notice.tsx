import { useEffect } from 'react';
import { useNoticeStore } from '../store/useNoticeStore';

/** Bottom-of-window message (see useNoticeStore); closes by itself after a while. */
export default function Notice() {
  const { message, clear } = useNoticeStore();
  useEffect(() => {
    if (!message) return;
    const t = window.setTimeout(clear, 10000);
    return () => window.clearTimeout(t);
  }, [message, clear]);
  if (!message) return null;
  return (
    <div role="alert" className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[60] max-w-xl flex items-start gap-3 px-4 py-2.5 bg-steel-900 text-white text-[13px] shadow-xl rounded-sm">
      <span className="flex-1">{message}</span>
      <button onClick={clear} aria-label="Close message" className="text-steel-300 hover:text-white">✕</button>
    </div>
  );
}
