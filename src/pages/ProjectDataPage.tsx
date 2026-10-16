import { useState, type ReactNode } from 'react';
import { useProjectStore, currentRevision, type Region, type Revision } from '../store/useProjectStore';
import { useProjectsStore } from '../store/useProjectsStore';

const input = 'w-full border border-steel-300 rounded-sm px-2 py-1 bg-white focus:outline-none focus:border-brand-500';
const th = 'text-left font-medium text-steel-500 px-3 py-1.5 border-b border-steel-200 bg-steel-50';
const td = 'px-3 py-1.5 border-b border-steel-100';

const PURPOSES = [
  'Issued for review',
  'Issued for approval',
  'Issued for construction',
  'Revised per comments',
  'As built',
];

function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="bg-white border border-steel-200">
      <div className="h-8 px-3 flex items-center justify-between bg-[#e9edef] border-b border-steel-200">
        <h4 className="text-xs font-semibold text-steel-700">{title}</h4>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-steel-600 mb-0.5">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-steel-400 mt-0.5">{hint}</span>}
    </label>
  );
}

/** Next revision letter: A, B, … Z, AA (or numeric 0, 1, 2 when numbering started with a digit). */
function nextRev(revs: Revision[]): string {
  const last = revs[revs.length - 1]?.rev;
  if (!last) return 'A';
  if (/^\d+$/.test(last)) return String(Number(last) + 1);
  const up = last.toUpperCase();
  return up.endsWith('Z') ? `${up}A` : up.slice(0, -1) + String.fromCharCode(up.charCodeAt(up.length - 1) + 1);
}

/** Project data and document control: names, numbers, approvals and revision history on every drawing and document. */
export default function ProjectDataPage() {
  // Start a fresh revision draft whenever another project is opened.
  const activeId = useProjectsStore((s) => s.activeId);
  return <ProjectData key={activeId ?? ''} />;
}

function ProjectData() {
  const info = useProjectStore((s) => s.info);
  const setInfo = useProjectStore((s) => s.setInfo);
  const { projects, activeId, renameActive } = useProjectsStore();
  const name = projects.find((p) => p.id === activeId)?.name ?? '';
  const today = new Date().toISOString().slice(0, 10);
  const [draft, setDraft] = useState<Revision>({ rev: nextRev(info.revisions), date: today, description: PURPOSES[0], by: info.preparedBy });
  const cur = currentRevision(info);
  const issuedForConstruction = info.revisions.some((r) => /construction|as built/i.test(r.description));

  const text = (key: 'customer' | 'site' | 'company' | 'projectNumber' | 'preparedBy' | 'checkedBy' | 'approvedBy') => (
    <input value={info[key]} onChange={(e) => setInfo({ [key]: e.target.value })} className={input} aria-label={key} />
  );

  const issue = () => {
    const rev = draft.rev.trim().toUpperCase();
    if (!rev || !draft.description.trim()) return;
    if (info.revisions.some((r) => r.rev.toUpperCase() === rev)) { alert(`Revision ${rev} already exists.`); return; }
    const revisions = [...info.revisions, { ...draft, rev }];
    setInfo({ revisions });
    setDraft({ rev: nextRev(revisions), date: today, description: PURPOSES[1], by: draft.by });
  };
  const withdraw = (r: Revision) => {
    if (!confirm(`Withdraw revision ${r.rev}?`)) return;
    const revisions = info.revisions.slice(0, -1);
    setInfo({ revisions });
    // The withdrawn letter is free again.
    setDraft((d) => ({ ...d, rev: nextRev(revisions) }));
  };

  return (
    <>
      <header className="px-4 py-2.5 bg-white border-b border-steel-200">
        <h2 className="text-base font-semibold text-steel-900">Project data</h2>
        <p className="text-xs text-steel-500 mt-0.5">Names, numbers, approvals and revisions printed on every drawing title block and document cover</p>
      </header>
      <div className="flex-1 overflow-auto p-4">
        <div className="max-w-6xl grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
          <Section title="Project">
            <div className="p-3 grid grid-cols-2 gap-3">
              <Field label="Project name"><input value={name} onChange={(e) => renameActive(e.target.value)} className={input} aria-label="Project name" /></Field>
              <Field label="Project / job number">{text('projectNumber')}</Field>
              <Field label="Customer">{text('customer')}</Field>
              <Field label="Site / location">{text('site')}</Field>
              <Field label="Your company" hint="Title blocks and document headers">{text('company')}</Field>
              <Field label="Drawing / document prefix" hint={`Drawings ${info.drawingPrefix || 'PRJ'}-E01…, package ${info.drawingPrefix || 'PRJ'}-EP-001`}>
                <input value={info.drawingPrefix} maxLength={8} onChange={(e) => setInfo({ drawingPrefix: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '') })} className={`${input} uppercase font-mono`} aria-label="Drawing prefix" />
              </Field>
              <Field label="Electrical code">
                <select value={info.region} onChange={(e) => setInfo({ region: e.target.value as Region, standards: e.target.value === 'Canada' ? ['CSA C22.2 No. 14', 'CEC'] : ['NFPA 79', 'UL 508A', 'NEC'] })} className={input}>
                  <option value="US">US — NEC / NFPA 79 / UL 508A</option>
                  <option value="Canada">Canada — CEC / CSA C22.2 No. 14</option>
                </select>
              </Field>
              <Field label="Standards"><div className="py-1 text-steel-700">{info.standards.join(', ') || '—'}</div></Field>
            </div>
          </Section>

          <Section title="Approvals">
            <div className="p-3 grid grid-cols-3 gap-3">
              <Field label="Prepared (drawn) by">{text('preparedBy')}</Field>
              <Field label="Checked by">{text('checkedBy')}</Field>
              <Field label="Approved by">{text('approvedBy')}</Field>
            </div>
            <p className="px-3 pb-3 text-xs text-steel-500">
              Generated designs must be checked and approved by a qualified person before anything is bought or built.
              Until a revision is issued for construction, every drawing and document carries a "Preliminary — not for construction" status.
            </p>
            <div className={`mx-3 mb-3 px-3 py-2 border text-xs ${issuedForConstruction ? 'bg-green-50 border-green-200 text-green-800' : 'bg-amber-50 border-amber-200 text-amber-900'}`}>
              Current revision <span className="font-semibold">{cur.rev}</span> · {cur.description} · {issuedForConstruction ? 'issued for construction' : 'preliminary'}
            </div>
          </Section>

          <div className="xl:col-span-2">
            <Section title="Revision history">
              <table className="w-full">
                <thead><tr>{['Rev', 'Date', 'Description', 'By', ''].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {!info.revisions.length && <tr><td colSpan={5} className={`${td} text-steel-500`}>Not issued yet. Drawings show revision A, preliminary.</td></tr>}
                  {info.revisions.map((r, i) => (
                    <tr key={i}>
                      <td className={`${td} font-mono w-16`}>{r.rev}</td>
                      <td className={`${td} w-32`}>{r.date}</td>
                      <td className={td}>{r.description}</td>
                      <td className={`${td} w-24`}>{r.by}</td>
                      <td className={`${td} w-8`}>
                        {i === info.revisions.length - 1 && (
                          <button onClick={() => withdraw(r)}
                            className="text-steel-400 hover:text-red-600" aria-label={`Withdraw revision ${r.rev}`}>✕</button>
                        )}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-brand-50/50">
                    <td className={td}><input value={draft.rev} onChange={(e) => setDraft({ ...draft, rev: e.target.value })} className={`${input} font-mono`} aria-label="New revision" /></td>
                    <td className={td}><input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} className={input} aria-label="Revision date" /></td>
                    <td className={td}>
                      <input list="rev-purposes" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className={input} aria-label="Revision description" />
                      <datalist id="rev-purposes">{PURPOSES.map((p) => <option key={p} value={p} />)}</datalist>
                    </td>
                    <td className={td}><input value={draft.by} onChange={(e) => setDraft({ ...draft, by: e.target.value })} className={input} aria-label="Revised by" /></td>
                    <td className={td} />
                  </tr>
                </tbody>
              </table>
              <div className="px-3 py-2 flex items-center justify-end gap-3 bg-[#f7f8f9]">
                <span className="text-xs text-steel-500">Issuing a revision stamps it on every drawing and document you export from now on.</span>
                <button onClick={issue} className="px-4 py-1.5 font-medium bg-brand-600 text-brand-950 rounded-sm hover:bg-brand-700">Issue revision {draft.rev}</button>
              </div>
            </Section>
          </div>
        </div>
      </div>
    </>
  );
}
