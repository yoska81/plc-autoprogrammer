/**
 * The machine description as one AI request reads it. The description goes into nearly every request, and on an
 * imported program most of it is lists the app wrote from the program and the I/O (every timer, every point by
 * kind, the I/O by register word, the drawings): the request gets the I/O list and the program on their own where
 * it needs them, so those lists are left out here. What is left is cut to the task's size: each section keeps its
 * first lines (a short section whole, the room left over shared by the long ones), cut at a line end.
 */
import { SPEC_SECTIONS, specToText, type SpecSections } from '../../spec/types';

/** What the description is read for. */
export type SpecTask = 'equipment' | 'hmi-names' | 'hmi' | 'cycle' | 'machine' | 'io' | 'program' | 'engineer' | 'review' | 'electrical' | 'fix-it';

/** Most characters of the description per task. */
export const SPEC_CHARS: Record<SpecTask, number> = {
  equipment: 6000, 'hmi-names': 6000, hmi: 6000, cycle: 6000, machine: 6000,
  'fix-it': 3500,
  io: 12000, program: 12000, engineer: 12000, review: 12000, electrical: 12000,
};

const OVERVIEW = SPEC_SECTIONS[0].title;
export const SHORTENED = '(… shortened)';
const LEFT_OUT = '(The app\'s lists of I/O points, timers, counters, register words and drawings are left out here.)';

/** The header of a list the app wrote from the program or the I/O ("Timers:", "Motion I/O (…):"). */
const LIST_HEAD = /^(Timers|Counters|Other I\/O|I\/O by register word|Drawings \(in scan order\)|Motion I\/O\b.*):$/;
const LIST_ITEM = /^\s*- /;
/** One I/O point as the app writes it: "- Name: description (input, analog, IB00012)", and the "… and N more" after it. */
const IO_LINE = /^- .+ \((input|output)(, analog)?, [^()]*\)$|^- … and \d+ more \(all are on the I\/O list\)$/;

/** A line longer than this (a list of every part on one line) keeps its start. */
const LONG_LINE = 400;
const clipLine = (line: string) => { const at = Math.max(line.lastIndexOf(', ', LONG_LINE), line.lastIndexOf(' ', LONG_LINE)); return `${line.slice(0, at > LONG_LINE / 2 ? at : LONG_LINE)} …`; };

/** A section's text without the app-written lists; true when something was left out. */
function withoutLists(text: string): { text: string; cut: boolean } {
  const out: string[] = [];
  let inList = false, cut = false;
  for (const line of text.split('\n')) {
    if (LIST_HEAD.test(line.trim())) { inList = true; cut = true; continue; }
    if (inList && LIST_ITEM.test(line)) continue;
    inList = false;
    if (IO_LINE.test(line.trim())) { cut = true; continue; }
    out.push(line.length > LONG_LINE ? clipLine(line) : line);
  }
  return { text: out.join('\n').replace(/\n{3,}/g, '\n\n').trim(), cut };
}

/** The first lines of `text` within `max` characters (at least one line, cut there if it alone is longer). */
function firstLines(text: string, max: number): string {
  if (text.length <= max) return text;
  const room = Math.max(0, max - SHORTENED.length - 1);
  let end = text.lastIndexOf('\n', room);
  if (end <= 0) end = room;
  return `${text.slice(0, end).trimEnd()}\n${SHORTENED}`;
}

/** "## Title\nbody" sections of a description already written as text. */
function sectionsOf(text: string): { title: string; body: string }[] {
  const out: { title: string; body: string }[] = [];
  const head = text.split(/^## /m);
  if (head[0].trim()) out.push({ title: '', body: head[0].trim() });
  for (const s of head.slice(1)) { const nl = s.indexOf('\n'); out.push({ title: (nl < 0 ? s : s.slice(0, nl)).trim(), body: nl < 0 ? '' : s.slice(nl + 1).trim() }); }
  return out;
}

/** The machine description for one AI request of this task (sections, or the text specToText wrote). */
export function specForAI(spec: SpecSections | string | null | undefined, task: SpecTask, max = SPEC_CHARS[task]): string {
  const text = typeof spec === 'string' ? spec : spec ? specToText(spec) : '';
  let cut = false;
  const sections = sectionsOf(text).map((s) => { const w = withoutLists(s.body); cut ||= w.cut; return { ...s, body: w.text }; }).filter((s) => s.body);
  if (!sections.length) return '';
  // Each section's heading line, and the note, are kept whole; the bodies share the rest. The overview comes first
  // (up to a third of the room); of the others, a body shorter than an equal share keeps all of it and gives what it
  // does not use to the longer ones.
  const fixed = sections.reduce((n, s) => n + (s.title ? s.title.length + 4 : 0) + 2, 0) + (cut ? LEFT_OUT.length + 2 : 0);
  let room = Math.max(0, max - fixed);
  const share = new Map<number, number>();
  const first = sections.findIndex((s) => s.title === OVERVIEW || !s.title);
  if (first >= 0) { const take = Math.min(sections[first].body.length, Math.floor(room / 3)); share.set(first, take); room -= take; }
  const order = sections.map((_, i) => i).filter((i) => i !== first).sort((a, b) => sections[a].body.length - sections[b].body.length);
  order.forEach((i, k) => { const each = Math.floor(room / (order.length - k)); const take = Math.min(sections[i].body.length, each); share.set(i, take); room -= take; });
  const body = sections.map((s, i) => {
    const b = firstLines(s.body, share.get(i)!);
    return s.title ? `## ${s.title}\n${b}` : b;
  }).join('\n\n');
  return cut ? `${body}\n\n${LEFT_OUT}` : body;
}
