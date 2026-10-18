import type { HmiDesign, HmiElement, HmiScreen } from './types';
import { textWidth } from './theme';

/**
 * Layout rules shared by the AI prompt, the post-processing of a generated
 * design and the HMI page's layout check.
 */
export const MIN_TOUCH = { w: 60, h: 48 };
export const GAP = 8;

/** Standard bands for a panel resolution: header on top, navigation at the bottom. */
export function layoutBands(widthPx: number, heightPx: number) {
  const headerH = heightPx <= 300 ? 36 : heightPx <= 500 ? 44 : heightPx <= 800 ? 56 : 64;
  const navH = heightPx <= 300 ? 48 : heightPx <= 500 ? 56 : heightPx <= 800 ? 64 : 72;
  return {
    header: { x: 0, y: 0, w: widthPx, h: headerH },
    nav: { x: 0, y: heightPx - navH, w: widthPx, h: navH },
    content: { x: GAP * 2, y: headerH + GAP, w: widthPx - GAP * 4, h: heightPx - headerH - navH - GAP * 2 },
  };
}

export interface LayoutIssue {
  screenId: string;
  elementId: string | null;
  severity: 'error' | 'warning';
  message: string;
}

const isTouch = (e: HmiElement) => e.kind === 'button' || e.kind === 'nav' || e.kind === 'numeric-entry';
const overlaps = (a: HmiElement, b: HmiElement) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const contains = (outer: HmiElement, inner: HmiElement) =>
  inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h;
/** Group frames and machine graphics may hold other elements; everything else must not touch. */
const isContainer = (e: HmiElement) => e.kind === 'panel' || e.kind === 'machine';

/** Room the password lock badge (top-right corner of a protected button) takes from its centred one-line label. */
export const lockInset = (el: Pick<HmiElement, 'level' | 'h'>) => (el.level && el.level !== 'operator' && el.h < 72 ? 22 : 0);

/**
 * Texts the screen draws for an element and the room each gets, as the renderer lays them out
 * (upper case and letter spacing of the dark look, the wider of the two looks; smallest font
 * the renderer shrinks to). A text wider than its room is drawn shortened ("SELECT MAN…").
 */
function textBoxes(e: HmiElement): { text: string; room: number; size: number; spacing: number }[] {
  const caps = (s: string | null | undefined) => (s ?? '').toUpperCase();
  const texts = (...xs: (string | null | undefined)[]) => [...new Set(xs.map(caps).filter(Boolean))];
  switch (e.kind) {
    case 'button': return texts(e.label, e.onText, e.action === 'toggle' ? e.offText : null).map((text) => ({ text, room: e.w - 16 - 2 * lockInset(e), size: 10, spacing: 1.5 }));
    case 'nav': return texts(e.label).map((text) => ({ text, room: e.w - 18, size: 10, spacing: 0.8 }));
    case 'indicator': return texts(e.onText || e.label, e.offText || e.label).map((text) => ({ text, room: e.w - 40 - 2 * Math.min(e.h * 0.28, 7), size: 10.5, spacing: 1.2 }));
    case 'bar': return texts(e.label).map((text) => ({ text, room: e.w * 0.6, size: 10, spacing: 1.5 }));
    case 'text':
      if (e.h >= 32) return texts(e.label).map((text) => ({ text, room: e.w, size: Math.min(30, e.h * 0.62), spacing: 3 }));
      if (e.style !== 'normal' || e.h < 24) return texts(e.label).map((text) => ({ text, room: e.w, size: Math.max(10, Math.min(13, e.h * 0.55)), spacing: 1.6 }));
      return texts(e.label).map((text) => ({ text, room: e.w - 16, size: 10, spacing: 1.5 }));
    default: return [];
  }
}

/** Texts of an element that do not fit it, with the width they need. */
export function cutTexts(e: HmiElement): { text: string; need: number; room: number }[] {
  return textBoxes(e).map((b) => ({ text: b.text, need: Math.ceil(textWidth(b.text, b.size, b.spacing)), room: Math.max(0, Math.floor(b.room)) })).filter((b) => b.need > b.room);
}

/** Check one screen against the panel size and the layout rules. */
/** `text`: also report text the screen would cut off (the HMI page's check; see cutTexts). */
export interface CheckOptions {
  text?: boolean;
  /** The project's I/O addresses: an X / Y on a screen that is not among them is reported. */
  io?: Set<string>;
}

export function checkScreen(screen: HmiScreen, widthPx: number, heightPx: number, design?: HmiDesign, opts: CheckOptions = {}): LayoutIssue[] {
  const out: LayoutIssue[] = [];
  const add = (el: HmiElement | null, severity: LayoutIssue['severity'], message: string) => out.push({ screenId: screen.id, elementId: el?.id ?? null, severity, message });
  const els = screen.elements;
  for (const e of els) {
    if (e.x < 0 || e.y < 0 || e.x + e.w > widthPx || e.y + e.h > heightPx) add(e, 'error', `“${e.label || e.id}” runs off the ${widthPx}×${heightPx} screen.`);
    if (isTouch(e) && (e.w < MIN_TOUCH.w || e.h < MIN_TOUCH.h)) add(e, 'warning', `“${e.label || e.id}” is ${e.w}×${e.h} px; touch targets should be at least ${MIN_TOUCH.w}×${MIN_TOUCH.h}.`);
    if (e.kind === 'nav' && e.targetScreenId && design && !design.screens.some((s) => s.id === e.targetScreenId)) add(e, 'error', `“${e.label}” goes to a screen that does not exist (${e.targetScreenId}).`);
    if ((e.kind === 'button' || e.kind === 'indicator' || e.kind === 'numeric' || e.kind === 'numeric-entry' || e.kind === 'multistate' || e.kind === 'bar' || e.kind === 'trend') && !e.address) add(e, 'warning', `“${e.label || e.id}” has no PLC address.`);
    if (e.kind === 'multistate' && !(e.states?.length)) add(e, 'warning', `“${e.label || e.id}” has no state texts.`);
    if (opts.text) for (const c of cutTexts(e)) add(e, 'warning', `“${c.text}” does not fit its ${e.kind === 'nav' ? 'navigation button' : e.kind} and is cut off (needs about ${c.need} px, has ${c.room}); widen it or shorten the text.`);
  }
  for (let i = 0; i < els.length; i++) {
    for (let j = i + 1; j < els.length; j++) {
      const a = els[i], b = els[j];
      if (!overlaps(a, b)) continue;
      if (isContainer(a) && contains(a, b)) continue;
      if (isContainer(b) && contains(b, a)) continue;
      add(b, 'error', `“${b.label || b.id}” overlaps “${a.label || a.id}”.`);
    }
  }
  if (!els.some((e) => e.kind === 'header')) add(null, 'warning', 'No header bar (machine name, screen, mode, alarms, clock).');
  if (!els.some((e) => e.kind === 'nav')) add(null, 'warning', 'No navigation buttons.');
  return out;
}

export function checkDesign(design: HmiDesign, widthPx: number, heightPx: number, opts: CheckOptions = {}): LayoutIssue[] {
  const out = design.screens.flatMap((s) => checkScreen(s, widthPx, heightPx, design, opts));
  // Every address used on a screen should be in the tag list (the PLC program implements tags).
  const tagged = new Set(design.tags.map((t) => t.address.toUpperCase()));
  const missing = new Set<string>();
  for (const s of design.screens) for (const e of s.elements) {
    for (const a of [e.address, e.interlock ?? null, ...(e.symbols ?? []).map((x) => x.address)]) {
      if (a && !tagged.has(a.toUpperCase()) && !/^[XY]\d+$/i.test(a)) missing.add(a.toUpperCase());
      // An input / output the I/O list does not have shows nothing (or another point after a renumbering).
      if (a && opts.io && /^[XY]\d+$/i.test(a) && !opts.io.has(a.toUpperCase())) out.push({ screenId: s.id, elementId: e.id, severity: 'error', message: `“${e.label || e.id}” uses ${a.toUpperCase()}, which is not in the I/O list.` });
    }
    if (e.lostIo) out.push({ screenId: s.id, elementId: e.id, severity: 'error', message: `“${e.label || e.id}” was bound to ${e.lostIo}, whose I/O point was deleted: bind it to another point or delete it.` });
  }
  // Every screen must be reachable: a navigation button (or the header's alarm link) on another screen goes to it.
  const home = design.screens[0]?.id;
  for (const s of design.screens) {
    if (s.id === home) continue;
    const reachable = design.screens.some((o) => o.id !== s.id && o.elements.some((e) => (e.kind === 'nav' || e.kind === 'header') && e.targetScreenId === s.id));
    if (!reachable) out.push({ screenId: s.id, elementId: null, severity: 'warning', message: `No screen has a navigation button to “${s.name}”: operators cannot reach it. Add it to the navigation bar.` });
  }
  if (missing.size) out.push({ screenId: '', elementId: null, severity: 'warning', message: `Addresses used on screens but missing from the tag list: ${[...missing].join(', ')}.` });
  for (const a of design.alarms) if (!tagged.has(a.address.toUpperCase())) out.push({ screenId: '', elementId: null, severity: 'warning', message: `Alarm bit ${a.address} is not in the tag list.` });
  return out;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Repair what can be repaired safely: keep elements on the panel, grow small
 * touch targets, push overlapping elements down (or right) into free space,
 * and add a header bar when the top band is free. Returns the fixed screens
 * and human-readable notes for everything changed or still wrong.
 */
export function fixDesignLayout(design: HmiDesign, widthPx: number, heightPx: number): { design: HmiDesign; notes: string[] } {
  const notes: string[] = [];
  const bands = layoutBands(widthPx, heightPx);
  const screens = design.screens.map((sc) => {
    const placed: HmiElement[] = [];
    let moved = 0, grown = 0, clamped = 0;
    for (const raw of sc.elements) {
      let e = { ...raw };
      const w = clamp(Math.round(e.w), 8, widthPx);
      const h = clamp(Math.round(e.h), 8, heightPx);
      if (w !== e.w || h !== e.h) clamped++;
      e = { ...e, w, h };
      if (isTouch(e) && (e.w < MIN_TOUCH.w || e.h < MIN_TOUCH.h)) { e = { ...e, w: Math.max(e.w, MIN_TOUCH.w), h: Math.max(e.h, MIN_TOUCH.h) }; grown++; }
      const x = clamp(Math.round(e.x), 0, widthPx - e.w);
      const y = clamp(Math.round(e.y), 0, heightPx - e.h);
      if (x !== e.x || y !== e.y) clamped++;
      e = { ...e, x, y };
      // Resolve overlaps with elements already placed (containers may hold others).
      const clash = (c: HmiElement) => placed.find((p) => overlaps(p, c) && !(isContainer(p) && contains(p, c)) && !(isContainer(c) && contains(c, p)));
      const hit = clash(e);
      if (hit) {
        const tryPos = (cand: HmiElement) => cand.x >= 0 && cand.y >= 0 && cand.x + cand.w <= widthPx && cand.y + cand.h <= heightPx && !clash(cand);
        const below = { ...e, y: hit.y + hit.h + GAP };
        const right = { ...e, x: hit.x + hit.w + GAP };
        if (tryPos(below)) { e = below; moved++; }
        else if (tryPos(right)) { e = right; moved++; }
        else notes.push(`${sc.name}: “${e.label || e.id}” overlaps “${hit.label || hit.id}” and could not be moved automatically; adjust it on the HMI page.`);
      }
      placed.push(e);
    }
    if (clamped) notes.push(`${sc.name}: ${clamped} element position(s)/size(s) were brought back onto the ${widthPx}×${heightPx} screen.`);
    if (grown) notes.push(`${sc.name}: ${grown} touch target(s) enlarged to at least ${MIN_TOUCH.w}×${MIN_TOUCH.h} px.`);
    if (moved) notes.push(`${sc.name}: ${moved} overlapping element(s) moved into free space.`);
    if (!placed.some((e) => e.kind === 'header')) {
      const bandFree = !placed.some((e) => e.y < bands.header.h);
      if (bandFree) {
        placed.unshift({
          id: `${sc.id}-header`, kind: 'header', label: design.machineName ?? '', ...bands.header,
          address: null, action: null, targetScreenId: design.screens.find((s) => /alarm/i.test(s.id) || /alarm/i.test(s.name))?.id ?? null,
          onText: null, offText: null, style: 'normal', units: null, min: null, max: null, note: null,
        });
        notes.push(`${sc.name}: header bar added.`);
      } else {
        notes.push(`${sc.name}: no header bar and the top band is in use; add one on the HMI page.`);
      }
    }
    return { ...sc, elements: placed };
  });
  return { design: { ...design, screens }, notes };
}
