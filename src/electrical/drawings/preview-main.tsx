import { createRoot } from 'react-dom/client';
import '../../index.css';
import { sampleContext } from './__fixtures__/sample';
import { realCatalogContext } from './__fixtures__/realCatalog';
import DrawingSet from './DrawingSet';
import { planDrawings } from './plan';
import SheetView from './SheetView';
import { bomCsv, cableScheduleCsv, designWarnings, machineWiring, wireListCsv } from '../derive';

const q = new URLSearchParams(location.search);
const ctx = q.get('real') === '1' ? realCatalogContext() : sampleContext({ reversing: q.get('rev') === '1' });
const plan = planDrawings(ctx);
(window as unknown as Record<string, unknown>).__info = { count: plan.sheets.length, titles: plan.sheets.map((s) => `${s.section}: ${s.title}`), warnings: designWarnings(ctx), bom: bomCsv(ctx), wires: wireListCsv(ctx), cables: cableScheduleCsv(ctx), machine: machineWiring(ctx) };
const sheet = q.get('sheet');
const root = createRoot(document.getElementById('root')!);
if (sheet) root.render(<SheetView plan={plan} sheet={plan.sheets[Number(sheet) - 1]} width="1728px" height={`${1728 * 279.4 / 431.8}px`} />);
else root.render(<DrawingSet ctx={ctx} printMode={q.get('print') === '1'} section={(q.get('section') as 'all' | 'cabinet' | 'machine' | null) ?? 'all'} />);
