import { useState } from 'react';

export function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}

export function ReasoningPanel({ reasoning }: { reasoning: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-indigo-200 rounded overflow-hidden text-xs">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 bg-indigo-50 text-indigo-700 font-medium hover:bg-indigo-100"
      >
        <span>View the AI's reasoning</span>
        <span>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <pre className="px-3 py-3 text-gray-600 whitespace-pre-wrap max-h-64 overflow-y-auto bg-white font-mono leading-relaxed">{reasoning}</pre>
      )}
    </div>
  );
}
