/**
 * Deep scan of everything this app kept in the browser, to find pieces of a
 * project that was replaced: program versions in History, the Fix & Ask
 * conversation, program notes, specification text and uploaded document names.
 * Content identical to the built-in example is skipped.
 */
import type { LadderProgram } from '../plc/core/ladder';
import { appStorage, CLEARED_PREFIX } from '../lib/appStorage';

export interface Piece {
  id: string;
  where: string;
  kind: 'program' | 'conversation' | 'notes' | 'spec' | 'documents';
  title: string;
  /** Plain text for reading / copying. */
  text: string;
  when: string | null;
  program?: LadderProgram;
}

interface ProgramState {
  ladder?: LadderProgram;
  versions?: { id: string; label: string; at: string; program: LadderProgram }[];
  chat?: { role: string; text: string; at?: string }[];
  userPrompt?: string;
  projectName?: string;
}

function programText(p: LadderProgram): string {
  return p.rungs.map((r, i) => `${i + 1}. ${r.comment || '(no comment)'}`).join('\n');
}

function scanProgram(where: string, st: ProgramState | undefined, out: Piece[], exampleJson: string) {
  if (!st) return;
  const name = st.projectName ? ` (${st.projectName})` : '';
  if (st.ladder?.rungs?.length && JSON.stringify(st.ladder) !== exampleJson) {
    out.push({ id: `${where}:ladder`, where: where + name, kind: 'program', title: `Program, ${st.ladder.rungs.length} rungs`, text: programText(st.ladder), when: null, program: st.ladder });
  }
  for (const v of st.versions ?? []) {
    if (!v.program?.rungs?.length || JSON.stringify(v.program) === exampleJson) continue;
    out.push({ id: `${where}:v:${v.id}`, where: where + name, kind: 'program', title: `Program history — ${v.label}, ${v.program.rungs.length} rungs`, text: programText(v.program), when: v.at, program: v.program });
  }
  const userMsgs = (st.chat ?? []).filter((m) => m.role === 'user' && m.text?.trim());
  if (userMsgs.length) {
    out.push({ id: `${where}:chat`, where: where + name, kind: 'conversation', title: `Your ${userMsgs.length} request(s) to the AI (Fix & Ask)`, text: userMsgs.map((m) => `• ${m.text}`).join('\n'), when: userMsgs[userMsgs.length - 1].at ?? null });
  }
  if (st.userPrompt?.trim()) {
    out.push({ id: `${where}:notes`, where: where + name, kind: 'notes', title: 'Notes for the program', text: st.userPrompt.trim(), when: null });
  }
}

function scanSpec(where: string, st: { sections?: Record<string, string>; documents?: { name: string }[] } | undefined, out: Piece[], exampleSpec: string) {
  if (!st) return;
  const text = Object.entries(st.sections ?? {}).filter(([, t]) => t?.trim()).map(([k, t]) => `${k}:\n${t.trim()}`).join('\n\n');
  if (text && text !== exampleSpec) out.push({ id: `${where}:spec`, where, kind: 'spec', title: 'Machine description', text, when: null });
  if (st.documents?.length) out.push({ id: `${where}:docs`, where, kind: 'documents', title: 'Documents you uploaded', text: st.documents.map((d) => d.name).join('\n'), when: null });
}

export function deepScan(example: { ladder: LadderProgram; spec: Record<string, string> }): Piece[] {
  const out: Piece[] = [];
  const exampleJson = JSON.stringify(example.ladder);
  const exampleSpec = Object.entries(example.spec).filter(([, t]) => t?.trim()).map(([k, t]) => `${k}:\n${t.trim()}`).join('\n\n');
  let keys: string[];
  try { keys = appStorage.keys(); } catch { return out; }
  for (const stored of keys) {
    let raw: unknown;
    try { raw = JSON.parse(appStorage.getItem(stored) ?? 'null'); } catch { continue; }
    if (!raw || typeof raw !== 'object') continue;
    // kept aside when the app's storage was found cleared (appStorage.ts): found under its own key
    const aside = stored.startsWith(CLEARED_PREFIX) ? /^[^:]+:\d+:(.*)$/.exec(stored) : null;
    const k = aside ? aside[1] : stored;
    const before = aside ? ' (from before the app\'s storage was cleared)' : '';
    if (k === 'plc-program-store') scanProgram(`Open project${before}`, (raw as { state?: ProgramState }).state, out, exampleJson);
    else if (k === 'plc-spec-store') scanSpec(`Open project${before}`, (raw as { state?: never }).state, out, exampleSpec);
    else if (k.startsWith('plc-project-data:') || k.startsWith('plc-backup:')) {
      const data = (k.startsWith('plc-backup:') ? (raw as { data?: Record<string, unknown> }).data : raw) as Record<string, unknown> | undefined;
      const where = (k.startsWith('plc-backup:') ? `Backup ${k.slice('plc-backup:'.length).slice(0, 16).replace('T', ' ')}` : 'Saved project copy') + before;
      scanProgram(where, data?.program as ProgramState | undefined, out, exampleJson);
      scanSpec(where, data?.spec as never, out, exampleSpec);
    }
  }
  // The same history can sit in several copies: keep one of each.
  const seen = new Set<string>();
  return out.filter((p) => {
    const key = `${p.kind}|${p.title}|${p.text}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map((p, i) => ({ ...p, id: `${p.id}#${i}` })); // several saved copies share a label
}

/** Program versions kept unfolded per project; older ones fold away. */
const KEEP_VERSIONS = 2;

/** Pieces per project (`where`), projects by their newest piece; history versions beyond the latest few in `older`. */
export function groupPieces(pieces: Piece[]): { where: string; latest: string | null; shown: Piece[]; older: Piece[] }[] {
  const by = new Map<string, Piece[]>();
  for (const pc of pieces) by.set(pc.where, [...(by.get(pc.where) ?? []), pc]);
  const time = (pc: Piece) => (pc.when ? Date.parse(pc.when) || 0 : 0);
  return [...by].map(([where, list]) => {
    const history = list.filter((pc) => pc.id.includes(':v:')).sort((a, b) => time(b) - time(a));
    // The current state (no date: the program, notes, description) first, then the dated pieces newest first.
    const rest = list.filter((pc) => !pc.id.includes(':v:')).map((pc, i) => ({ pc, i })).sort((a, b) => (b.pc.when ? time(b.pc) : Infinity) - (a.pc.when ? time(a.pc) : Infinity) || a.i - b.i).map((x) => x.pc);
    const latest = list.reduce<string | null>((m, pc) => (pc.when && (!m || Date.parse(pc.when) > Date.parse(m)) ? pc.when : m), null);
    return { where, latest, shown: [...rest, ...history.slice(0, KEEP_VERSIONS)], older: history.slice(KEEP_VERSIONS) };
  }).sort((a, b) => (b.latest ? Date.parse(b.latest) : 0) - (a.latest ? Date.parse(a.latest) : 0));
}
