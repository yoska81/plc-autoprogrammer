/** Design review: findings a checking engineer raises before anything is built. */

export type Severity = 'critical' | 'major' | 'minor' | 'info';
export type ReviewArea = 'project' | 'spec' | 'equipment' | 'io' | 'electrical' | 'safety' | 'hmi' | 'program';
/** App page a finding links to. */
export type ReviewPage = 'project' | 'spec' | 'equipment' | 'io' | 'electrical' | 'hmi' | 'program' | 'simulate';

export interface Finding {
  /** Stable across re-runs (rule + subject), so resolved/ignored marks stick. */
  id: string;
  source: 'check' | 'ai';
  severity: Severity;
  area: ReviewArea;
  title: string;
  /** Plain English: what is wrong and why it matters. */
  detail: string;
  /** Recommended fix. */
  fix: string;
  page: ReviewPage;
  /** Item on that page: rung id, address, device tag, screen id … ('' = page only). */
  item: string;
}

export type FindingStatus = 'open' | 'resolved' | 'ignored';

export interface FindingMark {
  status: FindingStatus;
  /** Why it was resolved / ignored. */
  reason: string;
  at: string;
}

export const SEVERITY_ORDER: Severity[] = ['critical', 'major', 'minor', 'info'];

export const SEVERITY_LABEL: Record<Severity, string> = { critical: 'Critical', major: 'Major', minor: 'Minor', info: 'Info' };

export const AREA_LABEL: Record<ReviewArea, string> = {
  project: 'Project', spec: 'Specification', equipment: 'Equipment', io: 'I/O list', electrical: 'Electrical',
  safety: 'Safety', hmi: 'HMI', program: 'PLC program',
};

/** Route of each page (with the item where the page supports it). */
export function pageRoute(page: ReviewPage, item = ''): string {
  switch (page) {
    case 'project': return '/project';
    case 'spec': return '/spec';
    case 'equipment': return '/equipment';
    case 'io': return '/io';
    case 'electrical': return '/electrical?tab=design';
    case 'hmi': return item ? `/hmi?screen=${encodeURIComponent(item)}` : '/hmi';
    case 'program': return '/program';
    case 'simulate': return '/simulate';
  }
}

export function sortFindings(list: Finding[]): Finding[] {
  return [...list].sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity) || a.area.localeCompare(b.area) || a.title.localeCompare(b.title));
}
