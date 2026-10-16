/** Electrical code compliance rules as design-review findings. */
import type { ProjectSnapshot } from '../../deliverables/collect';
import { sccrTable } from '../../deliverables/docs/electrical';
import type { Finding } from '../types';
import { runCodeRules } from './rules';

export { RULES, makeEnv, runCodeRules, type CodeHit, type CodeInput, type Env } from './rules';

export function codeRuleFindings(p: ProjectSnapshot): Finding[] {
  if (!p.drawingCtx) return [];
  const s = sccrTable(p);
  return runCodeRules({ ctx: p.drawingCtx, spec: p.spec, sccr: { unknown: s.unknown, lowest: s.lowest } }).map((h) => ({
    id: `code:${h.rule}:${h.subject}`, source: 'check', severity: h.severity, area: h.area, page: 'electrical', item: '',
    title: h.title, detail: `${h.detail} (${h.clause})`, fix: h.fix,
  }));
}
