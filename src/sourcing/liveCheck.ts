/**
 * "Live check": Claude searches the distributors' and makers' sites for the current stock, lead time
 * and price of the parts. Every value it reports must come from a page the search returned; values
 * whose page is not among the search results are dropped, so a guess is never shown as stock data.
 */
import { callClaude, type WebSource } from '../lib/ai/anthropic';
import type { Effort } from '../store/useSettingsStore';

export interface LiveResult {
  partNumber: string;
  /** As the page states it ("In stock: 37", "Backordered"), null when not found. */
  stock: string | null;
  leadTime: string | null;
  price: string | null;
  distributor: string | null;
  /** The page the values were read on. */
  url: string | null;
  /** Date of the check (YYYY-MM-DD). */
  checkedOn: string;
  note: string;
}

export interface LiveCheck { results: LiveResult[]; sources: WebSource[] }

const SYSTEM = `You check the current availability of industrial control parts for a panel builder.
For each part number, search the distributors and the manufacturer: AutomationDirect (automationdirect.com), Digi-Key (digikey.com), Mouser (mouser.com), and the manufacturer's own site.
Report ONLY what a page you found states: stock quantity or status, lead time, unit price with currency, the distributor, and that page's URL.
If no page states a value, give null and say so in "note". Never estimate, infer or fill in typical values: a missing value is fine, a guessed one is wrong.
Answer with one JSON object and nothing else:
{"results":[{"partNumber":"…","stock":"…"|null,"leadTime":"…"|null,"price":"…"|null,"distributor":"…"|null,"url":"https://…"|null,"note":"…"}]}`;

/** First JSON object in the answer (the model may wrap it in a code fence). */
function parseJson(text: string): { results?: Partial<LiveResult>[] } {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('The live check returned no readable answer. Please try again.');
  try { return JSON.parse(m[0]); } catch (err) { throw new Error('The live check returned an answer the app could not read. Please try again.', { cause: err }); }
}

/** A page's address without protocol, "www.", query, anchor or trailing slash, to compare pages. */
const pageKey = (u: string) => { try { const x = new URL(u); return `${x.host.replace(/^www\./, '')}${x.pathname.replace(/\/+$/, '')}`.toLowerCase(); } catch { return ''; } };

/**
 * Keep a reported value only when its page is one the search returned or the answer cited (the same
 * page, ignoring query and anchor); otherwise the values are dropped and the note says why.
 */
export function verifyResults(raw: Partial<LiveResult>[], parts: string[], sources: WebSource[], today: string): LiveResult[] {
  const pages = new Set(sources.map((s) => pageKey(s.url)).filter(Boolean));
  return parts.map((pn) => {
    const r = raw.find((x) => String(x.partNumber ?? '').trim().toUpperCase() === pn.toUpperCase()) ?? {};
    const url = typeof r.url === 'string' && r.url ? r.url : null;
    const backed = Boolean(url && pages.has(pageKey(url)));
    const val = (v: unknown) => (backed && typeof v === 'string' && v.trim() ? v.trim() : null);
    const anyValue = Boolean(r.stock || r.leadTime || r.price);
    return {
      partNumber: pn, stock: val(r.stock), leadTime: val(r.leadTime), price: val(r.price),
      distributor: backed && typeof r.distributor === 'string' ? r.distributor : null, url: backed ? url : null, checkedOn: today,
      note: anyValue && !backed ? 'Values not shown: the page they came from was not among the pages the search found.' : String(r.note ?? (backed ? '' : 'Not found on the searched sites.')),
    };
  });
}

export async function liveCheck(opts: { apiKey: string; model: string; effort: Effort; signal?: AbortSignal; parts: { partNumber: string; manufacturer: string; description: string }[] }): Promise<LiveCheck> {
  const today = new Date().toISOString().slice(0, 10);
  const list = opts.parts.map((p) => `- ${p.partNumber} (${p.manufacturer}): ${p.description}`).join('\n');
  const r = await callClaude({
    apiKey: opts.apiKey, model: opts.model, effort: opts.effort, signal: opts.signal, system: SYSTEM,
    messages: [{ role: 'user', content: `Today is ${today}. Check these parts:\n${list}` }],
    webSearch: { maxUses: Math.min(20, 3 + opts.parts.length * 2) },
  });
  const sources = r.sources ?? [];
  return { results: verifyResults(parseJson(r.text).results ?? [], opts.parts.map((p) => p.partNumber), sources, today), sources };
}
