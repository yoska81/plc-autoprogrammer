/**
 * The one rule for "issued for construction" (drawings, documents and the Project data page agree):
 * the CURRENT revision says for construction / IFC / as built (not "not for construction"), and a
 * checker and an approver are named.
 */
export function issuedForConstruction(info: { revisions?: { description?: string }[]; checkedBy?: string; approvedBy?: string }): boolean {
  const cur = info.revisions?.[info.revisions.length - 1]?.description ?? '';
  const issue = /construction|\bIFC\b|as[- ]?built/i.test(cur) && !/not\s+for\s+construction/i.test(cur);
  return issue && Boolean(info.checkedBy?.trim()) && Boolean(info.approvedBy?.trim());
}
