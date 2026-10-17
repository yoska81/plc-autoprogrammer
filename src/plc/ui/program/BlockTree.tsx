import { useState } from 'react';
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/20/solid';
import type { LadderProgram } from '../../core/ladder';
import type { ValidationIssue } from '../../core/validate';
import { GENERAL, blockOf, issueStatus, type BlockStatus } from './programIndex';

interface Props {
  program: LadderProgram;
  issues: ValidationIssue[];
  /** null = whole program, '' = rungs without a block. */
  active: string | null;
  selectedRungId: string | null;
  onBlock: (id: string | null) => void;
  onRung: (rungId: string) => void;
}

function StatusDot({ s, title }: { s: BlockStatus | undefined; title?: string }) {
  const color = s?.errors ? 'bg-red-500' : s?.warnings ? 'bg-amber-400' : 'bg-emerald-500';
  const text = s?.errors ? `${s.errors} error${s.errors > 1 ? 's' : ''}${s.warnings ? `, ${s.warnings} warning${s.warnings > 1 ? 's' : ''}` : ''}`
    : s?.warnings ? `${s.warnings} warning${s.warnings > 1 ? 's' : ''}` : 'Checker: OK';
  return <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${color}`} title={title ? `${title}: ${text}` : text} aria-hidden="true" />;
}

/** Program structure as a tree: blocks with rung counts and checker status, expandable to their rungs. */
export default function BlockTree({ program, issues, active, selectedRungId, onBlock, onRung }: Props) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const { byRung, byBlock } = issueStatus(program, issues);
  const total = issues.reduce((s, i) => (i.severity === 'error' ? { ...s, errors: s.errors + 1 } : { ...s, warnings: s.warnings + 1 }), { errors: 0, warnings: 0 });
  const blocks = program.blocks ?? [];
  const items = [
    ...blocks.map((b) => ({ id: b.id, name: b.name || b.id, description: b.description })),
    ...(program.rungs.some((r) => blockOf(program, r) === GENERAL) ? [{ id: GENERAL, name: blocks.length ? 'General' : 'Rungs', description: 'Rungs without a block' }] : []),
  ];
  const toggle = (id: string) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const row = (on: boolean) => `flex w-full items-center gap-1.5 rounded-sm px-1.5 py-1 text-left ${on ? 'bg-brand-600 text-white' : 'text-gray-700 hover:bg-brand-50'}`;

  return (
    <nav aria-label="Program blocks" className="h-full overflow-y-auto bg-[#f7f8f9] p-2 text-xs">
      <div className="mb-1 px-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Program</div>
      <button type="button" onClick={() => onBlock(null)} className={row(active === null)}>
        <span className="w-3.5" />
        <StatusDot s={total} title="Whole program" />
        <span className="flex-1 truncate font-medium">Whole program</span>
        <span className={active === null ? 'text-brand-100' : 'text-gray-400'}>{program.rungs.length}</span>
      </button>
      <ul className="mt-0.5 space-y-px">
        {items.map((b) => {
          const rungs = program.rungs.map((r, i) => ({ r, n: i + 1 })).filter(({ r }) => blockOf(program, r) === b.id);
          const isOpen = open.has(b.id);
          return (
            <li key={b.id || '_general'}>
              <div className={row(active === b.id)}>
                <button type="button" onClick={() => toggle(b.id)} aria-label={isOpen ? `Collapse ${b.name}` : `Expand ${b.name}`} className="shrink-0">
                  {isOpen ? <ChevronDownIcon className="h-3.5 w-3.5" /> : <ChevronRightIcon className="h-3.5 w-3.5" />}
                </button>
                <button type="button" onClick={() => onBlock(b.id)} title={b.description} className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
                  <StatusDot s={byBlock.get(b.id)} title={b.name} />
                  <span className="flex-1 truncate">{b.name}</span>
                  <span className={active === b.id ? 'text-brand-100' : 'text-gray-400'}>{rungs.length}</span>
                </button>
              </div>
              {isOpen && (
                <ul className="ml-5 border-l border-gray-200 pl-1">
                  {rungs.map(({ r, n }) => (
                    <li key={r.id}>
                      <button type="button" onClick={() => onRung(r.id)} title={r.comment}
                        className={`flex w-full items-center gap-1.5 rounded-sm px-1 py-0.5 text-left ${selectedRungId === r.id ? 'bg-sky-100 text-sky-900' : 'text-gray-600 hover:bg-white'}`}>
                        <span className="w-6 shrink-0 text-right font-mono text-[11px] text-gray-400">{n}</span>
                        {byRung.has(r.id) && <StatusDot s={byRung.get(r.id)} />}
                        <span className="truncate">{r.comment || <em className="text-gray-400">no comment</em>}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
      {total.errors + total.warnings > 0 && issues.some((i) => !i.rungId) && (
        <p className="mt-2 px-1.5 text-[11px] text-amber-700">{issues.filter((i) => !i.rungId).length} program-wide checker note(s), see the checker bar.</p>
      )}
    </nav>
  );
}
