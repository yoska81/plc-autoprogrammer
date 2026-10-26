import type { DocInfo } from '../electrical/derive';
import type { ProjectInfo } from '../store/useProjectStore';

/** Document control block for drawings and documents, from the project data. */
export function docInfo(info: ProjectInfo): DocInfo {
  return {
    company: info.company,
    customer: info.customer,
    site: info.site,
    projectNumber: info.projectNumber,
    prefix: info.drawingPrefix,
    preparedBy: info.preparedBy,
    checkedBy: info.checkedBy,
    approvedBy: info.approvedBy,
    revisions: info.revisions ?? [],
  };
}
