/**
 * Regenerating an HMI the user has edited by hand. Screens never touched are replaced by the new ones;
 * screens marked `edited` (the editor sets it) keep the user's elements: their addresses are re-bound
 * to the new tag list by tag name, the header and navigation bar follow the new screen set, and items
 * the new design needs that the screen lacks go on an "(added)" screen at their generated places.
 * Hand-added screens are kept. Everything kept or changed is listed in the returned notes.
 */
import type { HmiDesign, HmiElement, HmiScreen } from '../types';
import { MIN_TOUCH } from '../layout';
import { fitTexts } from './build';

/** Same elements apart from the header and navigation (adding a screen adds a nav button to every screen). */
const sameContent = (a: HmiScreen, b: HmiScreen) => {
  const body = (s: HmiScreen) => JSON.stringify(s.elements.filter((e) => e.kind !== 'header' && e.kind !== 'nav'));
  return body(a) === body(b);
};

/** Screens whose elements changed between two versions (the editor's commit): marked edited. */
export function markEdited(prev: HmiDesign | null, next: HmiDesign): HmiDesign {
  if (!prev) return next;
  const before = new Map(prev.screens.map((s) => [s.id, s]));
  return {
    ...next,
    screens: next.screens.map((s) => {
      const old = before.get(s.id);
      if (s.edited || (old && (old.elements === s.elements || sameContent(old, s)) && old.name === s.name)) return s;
      return { ...s, edited: true };
    }),
  };
}

const BOUND_KINDS = new Set<HmiElement['kind']>(['button', 'indicator', 'numeric', 'numeric-entry', 'multistate', 'bar', 'trend']);
const isFrame = (e: HmiElement, navY: number) => e.kind === 'header' || (e.kind === 'nav' && e.y >= navY);

export function mergeRegenerated(old: HmiDesign | null, fresh: HmiDesign): { design: HmiDesign; notes: string[] } {
  const edited = (old?.screens ?? []).filter((s) => s.edited);
  if (!old || !edited.length) return { design: fresh, notes: [] };
  const notes: string[] = [];
  // Old address -> new address for every tag name in both lists.
  const newByName = new Map(fresh.tags.map((t) => [t.name, t.address] as const));
  const remap = new Map<string, string>();
  for (const t of old.tags) { const a = newByName.get(t.name); if (a && a !== t.address) remap.set(t.address.toUpperCase(), a); }
  const rebind = (a: string | null | undefined) => (a ? remap.get(a.toUpperCase()) ?? a : a ?? null);
  const freshById = new Map(fresh.screens.map((s) => [s.id, s]));
  const screens: HmiScreen[] = [];
  const keptTags = new Set<string>();

  for (const fs of fresh.screens) {
    const os = edited.find((s) => s.id === fs.id);
    if (!os) { screens.push(fs); continue; }
    // Header / navigation band of the new screen (its lowest nav buttons).
    const navY = Math.min(...fs.elements.filter((e) => e.kind === 'nav' && e.id.includes('-nav-')).map((e) => e.y), Infinity);
    let changed = 0;
    const own = os.elements.filter((e) => !isFrame(e, navY)).map((e) => {
      const next = { ...e, address: rebind(e.address), ...(e.interlock ? { interlock: rebind(e.interlock) } : {}), ...(e.symbols ? { symbols: e.symbols.map((x) => ({ ...x, address: rebind(x.address) })) } : {}) };
      if (next.address !== e.address || next.interlock !== e.interlock) changed++;
      return next;
    });
    const frame = fs.elements.filter((e) => isFrame(e, navY));
    screens.push({ ...os, elements: [...frame, ...own], edited: true });
    for (const e of own) for (const a of [e.address, e.interlock]) if (a) keptTags.add(a.toUpperCase());
    // What the new screen needs that the user's screen does not show.
    const shown = new Set(own.flatMap((e) => [e.address, e.interlock]).filter(Boolean).map((a) => a!.toUpperCase()));
    const missing = fs.elements.filter((e) => BOUND_KINDS.has(e.kind) && e.address && !shown.has(e.address.toUpperCase()));
    let added = '';
    if (missing.length) {
      // Their generated positions are free of each other; with the frame they make a valid screen.
      const panels = fs.elements.filter((p) => p.kind === 'panel' && missing.some((m) => m.x >= p.x && m.y >= p.y && m.x + m.w <= p.x + p.w && m.y + m.h <= p.y + p.h));
      const id = `${fs.id}-added`;
      screens.push({ id, name: `${fs.name} (added)`, purpose: `Items the regenerated ${fs.name} screen needs that your edited screen does not show: move them where you want.`, ...(fs.level ? { level: fs.level } : {}),
        elements: [...frame.map((e) => ({ ...e, id: `${id}-${e.id}` })), ...panels.map((e) => ({ ...e, id: `${id}-${e.id}` })), ...missing.map((e) => ({ ...e, id: `${id}-${e.id}` }))] });
      added = `; ${missing.length} new item(s) it needs are on "${fs.name} (added)"`;
    }
    notes.push(`Kept your edited screen "${os.name}" (${own.length} elements${changed ? `, ${changed} re-bound to the new tags` : ''}, header and navigation updated)${added}. Use "Rebuild this screen" to replace it with the generated one.`);
  }
  // Hand-added screens that the new design does not have.
  for (const os of edited.filter((s) => !freshById.has(s.id))) {
    screens.push({ ...os, elements: os.elements.map((e) => ({ ...e, address: rebind(e.address), ...(e.interlock ? { interlock: rebind(e.interlock) } : {}) })) });
    for (const e of os.elements) for (const a of [rebind(e.address), e.interlock ? rebind(e.interlock) : null]) if (a) keptTags.add(a.toUpperCase());
    notes.push(`Kept your screen "${os.name}" (not part of the generated set).`);
  }
  withNavigation(screens, fresh, old, notes);
  // Hand tags still used on kept screens stay in the tag list.
  const freshAddr = new Set(fresh.tags.map((t) => t.address.toUpperCase()));
  const handTags = old.tags.filter((t) => !freshAddr.has(t.address.toUpperCase()) && !remap.has(t.address.toUpperCase()) && keptTags.has(t.address.toUpperCase()));
  return { design: { ...fresh, screens, tags: [...fresh.tags, ...handTags], notes: [...notes, ...fresh.notes] }, notes };
}

/**
 * Screens no other screen leads to ("(added)" screens, hand-added screens, a continuation page whose kept
 * first page has no Next) get a button in every navigation bar, after the generated ones (a hand-added
 * screen keeps its button's text).
 */
function withNavigation(screens: HmiScreen[], fresh: HmiDesign, old: HmiDesign, notes: string[]) {
  const isBar = (e: HmiElement) => e.kind === 'nav' && /-nav-/.test(e.id);
  // Not reached from another screen: added / hand-added screens, and a continuation page whose kept first page has no Next button.
  const reached = (s: HmiScreen) => screens.some((o) => o.id !== s.id && o.elements.some((e) => (e.kind === 'nav' || e.kind === 'header') && e.targetScreenId === s.id));
  const extra = screens.filter((s) => !reached(s));
  const sample = fresh.screens[0]?.elements.filter(isBar) ?? [];
  if (!extra.length || !sample.length) return;
  const oldLabel = new Map<string, string>();
  for (const s of old.screens) for (const e of s.elements) if (e.kind === 'nav' && e.targetScreenId && !oldLabel.has(e.targetScreenId)) oldLabel.set(e.targetScreenId, e.label);
  const entries = [
    ...sample.map((e) => ({ target: e.targetScreenId!, label: e.label })),
    ...extra.map((s) => ({ target: s.id, label: s.id.endsWith('-added') ? `+ ${s.name.replace(/ \(added\)$/, '')}` : oldLabel.get(s.id) ?? s.name })),
  ];
  const left = Math.min(...sample.map((e) => e.x)), right = Math.max(...sample.map((e) => e.x + e.w));
  const gap = sample.length > 1 ? Math.max(0, sample[1].x - sample[0].x - sample[0].w) : 8;
  const w = Math.floor((right - left - gap * (entries.length - 1)) / entries.length);
  if (w < MIN_TOUCH.w) {
    notes.push(`No room in the navigation bar for ${extra.map((s) => `"${s.name}"`).join(', ')}: add a button to ${extra.length === 1 ? 'it' : 'them'} on another screen.`);
    return;
  }
  const { y, h } = sample[0];
  screens.forEach((s, k) => {
    if (!s.elements.some(isBar)) return;
    const current = new Set(s.elements.filter((e) => isBar(e) && e.style === 'ok').map((e) => e.targetScreenId));
    const bar = entries.map((n, i) => fitTexts({ ...sample[0], id: `${s.id}-nav-${n.target}`, label: n.label, targetScreenId: n.target, x: left + i * (w + gap), y, w, h,
      style: n.target === s.id || current.has(n.target) ? 'ok' : 'normal' }));
    screens[k] = { ...s, elements: [...s.elements.filter((e) => !isBar(e)), ...bar] };
  });
}

/** "Rebuild this screen": the generated version of one screen (and its continuation pages) replaces the user's. */
export function rebuildScreen(current: HmiDesign, generated: HmiDesign, screenId: string): HmiDesign | null {
  const base = screenId.replace(/\d+$/, '').replace(/-added$/, '');
  const gen = generated.screens.filter((s) => s.id === base || new RegExp(`^${base}\\d+$`).test(s.id));
  if (!gen.length) return null;
  const others = current.screens.filter((s) => !(s.id === base || new RegExp(`^${base}\\d+$`).test(s.id) || s.id === `${base}-added`));
  // Keep the generated order: insert where the first page of this screen was.
  const at = current.screens.findIndex((s) => s.id === base);
  const screens = [...others];
  screens.splice(at < 0 ? screens.length : Math.min(at, screens.length), 0, ...gen);
  const have = new Set(current.tags.map((t) => t.address.toUpperCase()));
  return { ...current, screens, tags: [...current.tags, ...generated.tags.filter((t) => !have.has(t.address.toUpperCase()))] };
}
