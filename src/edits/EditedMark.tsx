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

const cellCls = 'w-full min-w-0 bg-transparent border border-transparent rounded-sm px-1 py-0.5 hover:border-steel-300 focus:bg-white focus:border-brand-500 focus:outline-none';

/**
 * A value in a table the user can type over: saved on Enter or when leaving the box, Escape
 * cancels. Edited values show the "edited by you" chip with a way back to the generated value.
 */
export function EditableCell({ value, label, onCommit, edited = false, onReset, generated, type = 'text', placeholder, className = '', inputClassName = '', markLabel, align = 'left', mark = true }: {
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
  /** Show the chip next to the box (off when the caller shows it elsewhere). */
  mark?: boolean;
}) {
  return (
    <span className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : ''} ${className}`}>
      <input
        key={value}
        type={type}
        defaultValue={value}
        placeholder={placeholder}
        aria-label={label}
        step={type === 'number' ? 'any' : undefined}
        min={type === 'number' ? 0 : undefined}
        onBlur={(e) => { const v = e.currentTarget.value; if (v !== value) onCommit(v); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') { e.currentTarget.value = value; e.currentTarget.blur(); }
        }}
        className={`${cellCls} ${align === 'right' ? 'text-right' : ''} ${edited ? 'text-sky-900 font-medium' : ''} ${inputClassName}`}
      />
      {mark && edited && <EditedMark onReset={onReset} generated={generated} label={markLabel} />}
    </span>
  );
}
