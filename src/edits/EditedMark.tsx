import { ArrowUturnLeftIcon } from '@heroicons/react/20/solid';

/** "edited by you" chip with a button back to the generated value. */
export function EditedMark({ onReset, generated, label = 'edited by you', className = '' }: {
  onReset?: () => void; generated?: string; label?: string; className?: string;
}) {
  return (
    <span data-testid="edited-mark" className={`inline-flex items-center gap-0.5 whitespace-nowrap rounded-sm bg-sky-100 px-1 text-[10px] font-semibold text-sky-800 ${className}`}
      title={generated !== undefined ? `Generated value: ${generated || '(empty)'}` : undefined}>
      ✎ {label}
      {onReset && (
        <button type="button" onClick={(e) => { e.stopPropagation(); onReset(); }} data-testid="reset-edit"
          aria-label={`Back to the generated value${generated !== undefined ? ` (${generated || 'empty'})` : ''}`}
          title={`Back to the generated value${generated !== undefined ? `: ${generated || '(empty)'}` : ''}`}
          className="ml-0.5 rounded-sm p-px text-sky-700 hover:bg-sky-200">
          <ArrowUturnLeftIcon className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}

const cellCls = 'w-full min-w-[3rem] bg-transparent border border-transparent rounded-sm px-1 py-0.5 hover:border-steel-300 focus:bg-white focus:border-brand-500 focus:outline-none';

/**
 * A value in a table the user can type over: saved on Enter or when leaving the box, Escape
 * cancels. Edited values show the "edited by you" chip (under the box) with a way back to the
 * generated value. `wrap`: long text in a box that wraps (about this many characters per line).
 */
export function EditableCell({ value, label, onCommit, edited = false, onReset, generated, type = 'text', placeholder, className = '', inputClassName = '', markLabel, align = 'left', mark = true, wrap, inline = false }: {
  value: string;
  label: string;
  onCommit: (v: string) => void;
  edited?: boolean;
  onReset?: () => void;
  generated?: string;
  type?: 'text' | 'number';
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  markLabel?: string;
  align?: 'left' | 'right';
  /** Show the chip under the box (off when the caller shows it elsewhere). */
  mark?: boolean;
  wrap?: number;
  /** Chip beside the box instead of under it (rows of a fixed height). */
  inline?: boolean;
}) {
  const cls = `${cellCls} ${align === 'right' ? 'text-right' : ''} ${edited ? 'text-sky-900 font-medium' : ''} ${inputClassName}`;
  const commit = (v: string) => { if (v !== value) onCommit(v); };
  return (
    <span className={`flex ${inline ? 'items-center gap-1' : `flex-col gap-0.5 ${align === 'right' ? 'items-end' : 'items-start'}`} ${className}`}>
      {wrap ? (
        <textarea
          key={value}
          defaultValue={value}
          placeholder={placeholder}
          aria-label={label}
          rows={Math.max(1, Math.ceil(value.length / wrap))}
          style={{ fieldSizing: 'content' } as React.CSSProperties}
          onBlur={(e) => commit(e.currentTarget.value.replace(/\s*\n\s*/g, ' '))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); }
            if (e.key === 'Escape') { e.currentTarget.value = value; e.currentTarget.blur(); }
          }}
          className={`${cls} resize-none leading-snug`}
        />
      ) : (
        <input
          key={value}
          type={type}
          defaultValue={value}
          placeholder={placeholder}
          aria-label={label}
          step={type === 'number' ? 'any' : undefined}
          min={type === 'number' ? 0 : undefined}
          onBlur={(e) => commit(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') { e.currentTarget.value = value; e.currentTarget.blur(); }
          }}
          className={cls}
        />
      )}
      {mark && edited && <EditedMark onReset={onReset} generated={generated} label={markLabel} />}
    </span>
  );
}
