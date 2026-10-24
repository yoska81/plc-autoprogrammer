import { collectProject } from '../../deliverables/collect';
import { saveBlob } from '../../deliverables/save';
import { useDraftStore } from '../../store/useDraftStore';
import { upgradeOriginal } from '../import/ui/applyUpgrade';
import { projectChanges } from './changeLog';
import { buildChangeReport, changeReportDocx, changeReportPdf } from './changeReport';

/** Where the open project's program came from, when it was read from a file ("capper.L5X, Allen-Bradley 1769-L33ER"). */
export function programSource(): string | undefined {
  const o = upgradeOriginal(useDraftStore.getState().drafts);
  return o ? `${o.source.fileName}, ${[o.source.vendor, o.source.controller].filter(Boolean).join(' ')}` : undefined;
}

/** Download the Change report of this session's changes as a PDF and a Word file. */
export async function downloadChangeReport(): Promise<void> {
  const p = collectProject();
  const r = buildChangeReport(p, projectChanges(), programSource());
  saveBlob(`${p.fileBase}_change_report.pdf`, await changeReportPdf(p, r));
  saveBlob(`${p.fileBase}_change_report.docx`, await changeReportDocx(r));
}
