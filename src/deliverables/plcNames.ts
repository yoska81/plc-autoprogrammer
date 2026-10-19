/**
 * Texts for the people at the machine in the PLC's own names: the app's operands a text quotes (X001, Y002, C21,
 * DS1003, T4, CT1) become what the PLC software shows — the I/O terminal in the brand's form (%I0.0,
 * Local:1:I.Data.0, _IO_EM_DI_00) and the internal ones by their exported tag name ("Machine_DB".SP_Service_Interval,
 * Cycle_Running). CLICK keeps its own addresses (they are CLICK's).
 */
import type { ProjectSnapshot } from './collect';
import { plcTagNameOf } from './plcTagNames';
import { moduleSlots } from '../plc/core/modules';
import { specLines } from './docs/table';
import { outsideUserText } from '../plc/core/userText';

const HAS_OPERAND = /\b(?:CTD|TD|CT|DS|DD|DH|DF|SC|C|T|X|Y)\d+\b/;
// A text that is only an operand (a tag nicknamed "C1") would shield every C1: it is not kept.
const ONLY_OPERAND = /^(?:CTD|TD|CT|DS|DD|DH|DF|SC|C|T|X|Y)\d+$/i;

/** First phrase of a rung comment, cut at a word (how the documents quote a rung). */
export function firstPhrase(comment: string): string {
  const t = comment.trim().split('\n')[0].split(/[:.](\s|$)/)[0].trim();
  return t.length <= 70 ? t : `${t.slice(0, 70).replace(/\s+\S*$/, '')}…`;
}

/**
 * The texts the user (or the AI for them) wrote that a generated text quotes: I/O descriptions, tag comments, rung
 * comments, alarm messages, device tags and the specification. Never renamed: "Pusher extended (cylinder C1, tank
 * T1)" keeps its C1 and T1 whatever the PLC calls the app's own C1. Longest first, only those quoting an operand.
 */
export function userTexts(p: ProjectSnapshot): string[] {
  const out = new Set<string>();
  const put = (t: string | undefined) => { const x = t?.trim(); if (x && HAS_OPERAND.test(x) && !ONLY_OPERAND.test(x)) out.add(x); };
  for (const x of p.io) put(x.description);
  for (const t of p.ladder.tags) { put(t.nickname); put(t.comment); }
  for (const r of p.ladder.rungs) if (r.comment) { put(r.comment); for (const l of r.comment.split('\n')) put(l); put(firstPhrase(r.comment).replace(/…$/, '')); }
  for (const a of p.hmi?.alarms ?? []) put(a.message);
  for (const w of p.electrical?.ioWiring ?? []) { put(w.deviceTag); put(w.location); }
  for (const l of specLines(p.spec.alarms)) put(l);
  return [...out].sort((a, b) => b.length - a.length);
}

/** The name the PLC software shows for one app address (the address itself on CLICK or when nothing is known). */
export function plcNameOf(p: ProjectSnapshot): (address: string) => string {
  if (p.profile.id === 'click') return (a) => a;
  const modules = moduleSlots(p.modules);
  const tagOf = plcTagNameOf(p);
  return (a) => {
    const up = a.toUpperCase();
    if (/^[XY]\d+$/.test(up)) return p.profile.ioTag?.(up, modules, p.cpu.id) ?? tagOf(up).io ?? a;
    return tagOf(up).name || a;
  };
}

/** A text with every app operand it quotes in the PLC's own names. */
export function inPlcNames(p: ProjectSnapshot): (text: string) => string {
  if (p.profile.id === 'click') return (t) => t;
  const name = plcNameOf(p);
  const users = userTexts(p);
  return (t) => outsideUserText(t, users, name);
}

/** A text with the brand's address after each I/O terminal it quotes: "Input X005 (%I0.4)". CLICK unchanged. */
export function withNativeIo(p: ProjectSnapshot): (text: string) => string {
  if (p.profile.id === 'click' || !p.profile.ioTag) return (t) => t;
  const name = plcNameOf(p);
  const users = userTexts(p);
  return (t) => outsideUserText(t, users, (m) => { const n = name(m); return n && n !== m ? `${m} (${n})` : m; }, /\b([XY]\d{3})\b(?!\s*\()/);
}
