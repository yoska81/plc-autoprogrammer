import { useMemo, useState } from 'react';
import { collectProject } from '../../../deliverables/collect';
import { saveBlob } from '../../../deliverables/save';
import { useProgramStore } from '../../../store/useProgramStore';
import { explainProgram, type AiSummaries } from '../../tidy/explain';
import { blockSections, buildExplanationDocx, buildExplanationPdf } from '../../tidy/explainExport';
import { useExplainSummaries } from '../../tidy/explainStore';

/**
 * The Explain tab: how the program works, one section per block, from the program itself; "Explain with AI" adds a
 * paragraph per block (kept while the block's logic stays the same). PDF and Word downloads; the same files go into
 * the deliverables.
 */
export default function ExplainPanel({ onShowBlock, onExplainWithAi, aiReady, busy }: {
  onShowBlock: (blockId: string) => void;
  onExplainWithAi: () => void;
  aiReady: boolean;
  busy: boolean;
}) {
  const ladder = useProgramStore((s) => s.ladder);
  const [summaries] = useExplainSummaries();
  const x = useMemo(() => (ladder.rungs.length ? explainProgram(collectProject(), summaries as AiSummaries) : null), [ladder, summaries]);
  const [saving, setSaving] = useState(false);
  if (!x) return <p className="text-sm text-gray-500">Build or import a program first: its explanation appears here.</p>;
  const withAi = x.blocks.filter((b) => b.aiSummary).length;
  const save = (kind: 'pdf' | 'docx') => async () => {
    setSaving(true);
    try {
      const p = collectProject();
      const blob = kind === 'pdf' ? await buildExplanationPdf(p, x) : await buildExplanationDocx(x);
      saveBlob(`${p.fileBase}_how_the_program_works.${kind}`, blob);
    } finally { setSaving(false); }
  };
  return (
    <div className="space-y-3 text-sm" data-testid="explain-panel">
      <div className="flex flex-wrap gap-2">
        <button onClick={onExplainWithAi} disabled={!aiReady || busy}
          title={aiReady ? 'A short paragraph per block from the AI, from the same facts; kept while the block does not change' : 'Add your API key in Settings to use the AI'}
          className="px-2.5 py-1 text-xs rounded border border-brand-300 text-brand-800 hover:bg-brand-50 disabled:opacity-50">{withAi ? 'Explain again with AI' : 'Explain with AI'}</button>
        <button onClick={save('pdf')} disabled={saving} className="px-2.5 py-1 text-xs rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50">Download PDF</button>
        <button onClick={save('docx')} disabled={saving} className="px-2.5 py-1 text-xs rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50">Download Word</button>
      </div>
      <div className="space-y-1 text-gray-700">{x.overview.map((t, i) => <p key={i}>{t}</p>)}</div>
      {withAi > 0 && <p className="text-xs text-gray-500">Paragraphs marked AI: {withAi} of {x.blocks.length} blocks. They summarise the facts below; check them against the logic.</p>}
      {x.blocks.map((b) => (
        <section key={b.id || 'general'} className="border-t border-gray-200 pt-2 space-y-1" aria-label={`Block ${b.name}`} data-testid="explain-block">
          <h3 className="font-semibold text-gray-800 flex items-baseline gap-2">
            <span className="flex-1">{b.name}</span>
            <button onClick={() => onShowBlock(b.id)} className="text-xs font-normal text-brand-700 underline" title="Show this block in the ladder">{b.rungs}</button>
          </h3>
          {b.aiSummary && <p className="text-gray-800"><span className="mr-1 rounded bg-brand-50 px-1 text-[10px] font-semibold text-brand-700">AI</span>{b.aiSummary}</p>}
          <p className="text-gray-700">{b.what}</p>
          {blockSections(b).map(([title, items]) => (
            <div key={title}>
              <p className="text-xs font-semibold text-gray-600">{title}</p>
              <ul className="list-disc ml-5 text-xs text-gray-700 space-y-0.5">
                {items.slice(0, 30).map((t, i) => <li key={i}>{t}</li>)}
                {items.length > 30 && <li className="text-gray-500">… and {items.length - 30} more (all of them in the PDF / Word file)</li>}
              </ul>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
