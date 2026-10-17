import { useEffect, useState } from 'react';
import { isThinking, percentOf, useAiProgressStore } from '../lib/ai/progress';
import { cancelAiJob, dismissAiJob, retryAiJob, useAiJobs, type AiJob } from '../lib/ai/jobs';
import { KIND_TEXT } from '../lib/ai/errors';
import { useProjectsStore } from '../store/useProjectsStore';

const mmss = (ms: number) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const btn = 'px-1.5 leading-4 rounded border border-white/60 hover:bg-white/15';

/**
 * Status-bar view of the AI jobs: running jobs with elapsed time, stage, retries and Cancel;
 * failures with Retry / Dismiss; results waiting for another project. Nothing when idle.
 */
export default function AiJobsIndicator() {
  const jobs = useAiJobs((s) => s.jobs);
  const projects = useProjectsStore((s) => s.projects);
  const running = jobs.filter((j) => j.status === 'running');
  const failed = jobs.filter((j) => j.status === 'failed' && !j.dismissed);
  const held = jobs.filter((j) => j.held);
  const [now, setNow] = useState(() => Date.now());
  const progress = useAiProgressStore((s) => s.byKey);
  useEffect(() => {
    if (!running.length) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running.length]);

  if (!running.length && !failed.length && !held.length) return null;
  const pctText = (j: AiJob) => { const p = progress[j.kind]; const pct = percentOf(j.kind, p, now); return pct === null ? '' : ` · ${isThinking(p) ? 'thinking' : 'writing'} ${pct}%`; };
  const runningText = (j: AiJob) => `${j.label}${j.stage ? ` · ${j.stage}` : ''}${j.kind === 'update-all' ? '' : pctText(j)} · ${mmss(now - j.startedAt)}${j.retry ? ` · ${KIND_TEXT[j.retry.kind]}, retrying (${j.retry.attempt}/${j.retry.max})…` : ''}`;
  return (
    <span className="flex items-center gap-3 min-w-0" data-testid="ai-jobs" aria-live="polite">
      {running.map((j) => (
        <span key={j.id} className="flex items-center gap-1.5 min-w-0" data-job={j.kind} data-status="running">
          <span className="inline-block w-2 h-2 rounded-full bg-white animate-pulse shrink-0" aria-hidden />
          <span className="truncate" title={runningText(j)}>AI: {runningText(j)}</span>
          <button className={btn} onClick={() => cancelAiJob(j.id)} aria-label={`Cancel ${j.label}`}>Cancel</button>
        </span>
      ))}
      {failed.map((j) => (
        <span key={j.id} className="flex items-center gap-1.5 min-w-0" data-job={j.kind} data-status="failed">
          <span className="truncate" title={j.error}>{j.label} failed{j.error ? `: ${j.error}` : ''}</span>
          <button className={btn} onClick={() => retryAiJob(j.id)} aria-label={`Retry ${j.label}`}>Retry</button>
          <button className={btn} onClick={() => dismissAiJob(j.id)} aria-label={`Dismiss ${j.label}`}>×</button>
        </span>
      ))}
      {held.map((j) => (
        <span key={j.id} className="truncate" data-job={j.kind} data-status="held">
          {j.label} finished for “{projects.find((p) => p.id === j.projectId)?.name ?? 'another project'}” — open it to apply
        </span>
      ))}
    </span>
  );
}
