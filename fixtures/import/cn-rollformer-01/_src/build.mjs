// Generator for the cn-rollformer-01 import fixture.
// Draws 8 A3 sheets as SVG (mm units), renders drawings.pdf with Playwright, writes
// geometry.json (for dxf.py) and expected.json. Run through build.sh.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import * as D from './design.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..');
const BUILD = process.env.BUILD_DIR || path.join(os.tmpdir(), 'cn-rollformer-01-build');
fs.mkdirSync(BUILD, { recursive: true });

// ---------------------------------------------------------------- geometry
const W = 420, H = 297;
const FX0 = 25, FY0 = 5, FX1 = 415, FY1 = 292; // frame
const DX0 = 30, DY0 = 10, DY1 = 264; // drawing area (inside column/row bands)
const NCOL = 8, NROW = 6;
const COLW = (FX1 - DX0) / NCOL;
const ROWH = (DY1 - DY0) / NROW;
const col = (x) => Math.min(NCOL, Math.max(1, Math.floor((x - DX0) / COLW) + 1));
const FONT = "'Liberation Sans','WenQuanYi Zen Hei',sans-serif";

function tw(s, size) {
  let w = 0;
  for (const ch of String(s)) {
    if (/[⺀-￿]/.test(ch) && !/[Ω°²×–—·]/.test(ch)) w += size * 1.0;
    else if (/[A-Z0-9#%&@MW]/.test(ch)) w += size * 0.64;
    else if (/[il.,:;'|!()\[\] /\-]/.test(ch)) w += size * 0.3;
    else w += size * 0.52;
  }
  return w;
}
function wrap(s, maxW, size) {
  const toks = String(s).match(/[⺀-鿿＀-￯]|[^\s⺀-鿿＀-￯]+\s*|\s+/g) || [];
  const lines = []; let cur = '';
  for (const t of toks) {
    if (tw(cur + t, size) > maxW && cur.trim()) { lines.push(cur.trimEnd()); cur = t.trimStart(); }
    else cur += t;
  }
  if (cur.trim()) lines.push(cur.trimEnd());
  return lines;
}

// ---------------------------------------------------------------- registries
const DEVMAIN = {}; // tag -> {sheet, x}
const DEVREFS = {}; // tag -> [{sheet, x, pins, nc}]
const PORTS = {}; // name -> [{sheet, x}]
const TERMS = []; // {strip, no, wire, internal, external, dev, size, sheet, col}
const ref = (sh, x) => `/${sh}.${col(x)}`;

class Sheet {
  constructor(no) {
    this.no = no; this.items = []; this.lazy = [];
    const m = D.SHEETS.find((q) => q.no === no); this.cn = m.cn; this.en = m.en;
  }
  add(o) { this.items.push(o); return o; }
  line(x1, y1, x2, y2, layer = 'WIRE', o = {}) { return this.add({ t: 'line', x1, y1, x2, y2, layer, w: o.w, dash: o.dash }); }
  poly(pts, layer = 'SYM', o = {}) { return this.add({ t: 'poly', pts, layer, closed: !!o.closed, fill: o.fill, w: o.w, dash: o.dash }); }
  rect(x, y, w, h, layer = 'SYM', o = {}) { return this.add({ t: 'rect', x, y, wd: w, ht: h, layer, w: o.w, dash: o.dash, fill: o.fill }); }
  circle(cx, cy, r, layer = 'SYM', o = {}) { return this.add({ t: 'circle', cx, cy, r, layer, fill: o.fill, w: o.w }); }
  arc(cx, cy, r, a1, a2, layer = 'SYM') { return this.add({ t: 'arc', cx, cy, r, a1, a2, layer }); }
  text(x, y, s, o = {}) {
    return this.add({ t: 'text', x, y, s: o.fn ? '' : String(s), fn: o.fn, size: o.size || 2.5, anchor: o.anchor || 'start',
      rot: o.rot || 0, bold: !!o.bold, layer: o.layer || 'TEXT' });
  }
  later(fn) { this.lazy.push(fn); }
  resolve() {
    for (const fn of this.lazy) fn(this);
    for (const it of this.items) if (it.t === 'text' && it.fn) it.s = it.fn();
  }
}

// ---------------------------------------------------------------- primitives
const SW = { frame: 0.6, wire: 0.3, sym: 0.25, thin: 0.15 };
function dot(s, x, y) { s.circle(x, y, 0.6, 'WIRE', { fill: '#000' }); }
function wn(s, x, y, label, o = {}) { s.text(x + (o.dx ?? 0.9), y + (o.dy ?? 0.7), label, { size: 1.7, layer: 'WIRENO', anchor: o.anchor }); }
function vline(s, x, y1, y2) { if (Math.abs(y2 - y1) > 0.01) s.line(x, y1, x, y2, 'WIRE'); }
function hline(s, y, x1, x2) { if (Math.abs(x2 - x1) > 0.01) s.line(x1, y, x2, y, 'WIRE'); }

function regMain(tag, s, x) { DEVMAIN[tag] = { sheet: s.no, x }; }
function regRef(tag, s, x, pins, nc) { (DEVREFS[tag] ||= []).push({ sheet: s.no, x, pins, nc }); }
const mainRef = (tag) => () => (DEVMAIN[tag] ? ref(DEVMAIN[tag].sheet, DEVMAIN[tag].x) : '');

function mirror(s, tag, x, y, o = {}) {
  s.later((sh) => {
    const list = (DEVREFS[tag] || []).slice().sort((a, b) => a.pins.localeCompare(b.pins, 'en', { numeric: true }));
    let yy = y;
    if (o.title) { sh.text(x, yy, o.title, { size: 1.6, bold: true, layer: 'XREF' }); yy += 2.3; }
    for (const r of list) {
      sh.text(x, yy, `${r.pins}${/N[OC]$/.test(r.pins) ? '' : r.nc ? ' NC' : ' NO'} ${ref(r.sheet, r.x)}`, { size: 1.6, layer: 'XREF' });
      yy += 2.2;
    }
  });
}

function actuator(s, x, mx, my, kind) {
  if (!kind) return;
  const ax = x - 7;
  s.line(mx, my, ax, my, 'SYM', { dash: '0.8 0.6' });
  if (kind === 'push') s.poly([[ax - 1, my - 1.6], [ax, my - 1.6], [ax, my + 1.6], [ax - 1, my + 1.6]]);
  else if (kind === 'estop') { s.line(ax, my - 1.9, ax, my + 1.9, 'SYM'); s.arc(ax, my, 1.9, 90, 270); }
  else if (kind === 'select') s.poly([[ax, my], [ax - 0.8, my - 1.6], [ax - 2, my - 1.6]]);
  else if (kind === 'limit') s.poly([[ax, my], [ax - 1.6, my - 1.4], [ax - 1.6, my + 1.4]], 'SYM', { closed: true });
  else if (kind === 'thermal') s.poly([[ax, my], [ax, my - 1.2], [ax - 1.4, my - 1.2], [ax - 1.4, my + 1.2], [ax - 2.8, my + 1.2]]);
  else if (kind === 'guard') { s.poly([[ax, my], [ax - 1.6, my - 1.4], [ax - 1.6, my + 1.4]], 'SYM', { closed: true }); s.circle(ax - 2.6, my, 0.9); }
}

// Contact, vertical, top at y, 10 mm high. o: {tag, pins:['13','14'], nc, act, ref(bool), note, delay, noLabel}
function contact(s, x, y, o) {
  s.line(x, y, x, y + 3, 'SYM'); s.line(x, y + 7, x, y + 10, 'SYM');
  let mx, my = y + 5;
  if (!o.nc) { s.line(x, y + 7, x - 2.6, y + 2.6, 'SYM'); mx = x - 1.3; }
  else { s.line(x, y + 7, x + 2.6, y + 2.4, 'SYM'); s.line(x, y + 3, x + 3.2, y + 3, 'SYM'); mx = x + 1.3; }
  if (o.main) s.arc(x, y + 3.6, 0.6, 180, 360);
  if (o.delay) { s.line(mx, my, x - 4.5, my, 'SYM'); s.arc(x - 5.6, my, 1.1, 270, 450); }
  actuator(s, x, mx, my, o.act);
  const [p1, p2] = o.pins || ['', ''];
  if (p1) s.text(x - 1.2, y + 2.2, p1, { size: 1.5, anchor: 'end', layer: 'PIN' });
  if (p2) s.text(x - 1.2, y + 9.8, p2, { size: 1.5, anchor: 'end', layer: 'PIN' });
  const tx = x + (o.nc ? 4.2 : 3.2);
  if (!o.noLabel && o.tag) {
    s.text(tx, y + 4.6, o.tag, { size: 2.3, bold: true, layer: 'TAG' });
    if (o.ref !== false) s.text(tx, y + 7.2, '', { size: 1.6, layer: 'XREF', fn: mainRef(o.tag) });
    if (o.note) s.text(tx, y + (o.ref !== false ? 9.6 : 7.4), o.note, { size: 1.5 });
  }
  if (o.tag && o.ref !== false) regRef(o.tag, s, x, `${p1}-${p2}`, !!o.nc);
  return y + 10;
}

// Coil, 12 mm high. o: {tag, kind:'relay'|'timer'|'valve', desc:[cn,en], pins}
function coil(s, x, y, o) {
  s.line(x, y, x, y + 3, 'SYM'); s.rect(x - 4, y + 3, 8, 6); s.line(x, y + 9, x, y + 12, 'SYM');
  if (o.kind === 'valve') s.line(x - 4, y + 9, x + 4, y + 3, 'SYM');
  if (o.kind === 'timer') { s.rect(x - 4, y + 3, 2.4, 6, 'SYM', { fill: '#000' }); }
  const [a1, a2] = o.pins || ['A1', 'A2'];
  s.text(x - 4.6, y + 4.6, a1, { size: 1.5, anchor: 'end', layer: 'PIN' });
  s.text(x - 4.6, y + 9.4, a2, { size: 1.5, anchor: 'end', layer: 'PIN' });
  s.text(x + 5, y + 5.6, o.tag, { size: 2.3, bold: true, layer: 'TAG' });
  if (o.desc) {
    s.text(x + 5, y + 8.1, o.desc[0], { size: 1.6 });
    if (o.desc[1]) s.text(x + 5, y + 10.4, o.desc[1], { size: 1.4 });
  }
  if (o.main !== false) regMain(o.tag, s, x);
  return y + 12;
}
function lamp(s, x, y, o) {
  s.line(x, y, x, y + 2, 'SYM'); s.circle(x, y + 5, 3); s.line(x, y + 8, x, y + 10, 'SYM');
  const d = 2.12; s.line(x - d, y + 5 - d, x + d, y + 5 + d, 'SYM'); s.line(x - d, y + 5 + d, x + d, y + 5 - d, 'SYM');
  s.text(x + 3.8, y + 4.4, o.tag, { size: 2.3, bold: true, layer: 'TAG' });
  if (o.color) s.text(x + 3.8, y + 6.9, o.color, { size: 1.5 });
  return y + 10;
}
function term(s, x, y, strip, no, wire, internal, external, o = {}) {
  s.circle(x, y, 0.9, 'TERM', { fill: '#fff' });
  const lbl = `${strip}:${no}`;
  if (o.label === 'below') s.text(x, y + 3.2, lbl, { size: 1.5, anchor: 'middle', layer: 'TERM' });
  else if (o.label === 'right') s.text(x + 1.5, y + 0.6, lbl, { size: 1.5, layer: 'TERM' });
  else s.text(x - 1.5, y + 0.6, lbl, { size: 1.5, anchor: 'end', layer: 'TERM' });
  TERMS.push({ strip, no, wire, internal, external, dev: o.dev || '', size: o.size || '0.75', sheet: s.no, col: col(x) });
}
// Off-sheet connection marker at a wire end. dir = direction the wire leaves the sheet.
function port(s, x, y, name, dir, o = {}) {
  (PORTS[name] ||= []).push({ sheet: s.no, x });
  const tri = {
    up: [[x, y - 2.2], [x - 1.1, y], [x + 1.1, y]], down: [[x, y + 2.2], [x - 1.1, y], [x + 1.1, y]],
    left: [[x - 2.2, y], [x, y - 1.1], [x, y + 1.1]], right: [[x + 2.2, y], [x, y - 1.1], [x, y + 1.1]],
  }[dir];
  s.poly(tri, 'XREF', { closed: true });
  const others = () => {
    const seen = new Set();
    for (const p of PORTS[name]) if (p.sheet !== s.no) seen.add(ref(p.sheet, p.x));
    return [...seen].join(' ');
  };
  let tx, ty, anchor = 'start';
  if (dir === 'up') { tx = x + 1.6; ty = y - 2.4; }
  else if (dir === 'down') { tx = x + 1.6; ty = y + 3.2; }
  else if (dir === 'left') { tx = x - 2.6; ty = y + 0.8; anchor = 'end'; }
  else { tx = x + 2.6; ty = y + 0.8; }
  if (o.textAt) [tx, ty, anchor] = o.textAt;
  s.text(tx, ty, name, { size: 2.0, bold: true, layer: 'XREF', anchor });
  s.text(tx, ty + 2.3, '', { size: 1.6, layer: 'XREF', anchor, fn: others });
}

// Vertical chain of elements starting at y. Elements:
// ['w', len, wireNo?] | ['c', contactOpts] | ['coil', coilOpts] | ['lamp', opts] | ['t', strip, no, wire, internal, external, opts]
function chain(s, x, y, els) {
  let yy = y;
  for (const e of els) {
    const [k] = e;
    if (k === 'w') { vline(s, x, yy, yy + e[1]); if (e[2]) wn(s, x, yy + e[1] / 2, e[2]); yy += e[1]; }
    else if (k === 'c') yy = contact(s, x, yy, e[1]);
    else if (k === 'coil') yy = coil(s, x, yy, e[1]);
    else if (k === 'lamp') yy = lamp(s, x, yy, e[1]);
    else if (k === 't') { vline(s, x, yy, yy + 1.5); term(s, x, yy + 2.4, e[1], e[2], e[3], e[4], e[5], e[6]); vline(s, x, yy + 3.3, yy + 4.8); yy += 4.8; }
  }
  return yy;
}
// two contacts in parallel (x and x+dx), top at y; returns y+16 (with 3 mm stubs)
function par(s, x, y, a, b, dx = 14) {
  vline(s, x, y, y + 3); dot(s, x, y + 3); hline(s, y + 3, x, x + dx);
  contact(s, x, y + 3, a); vline(s, x + dx, y + 3, y + 3);
  contact(s, x + dx, y + 3, b);
  hline(s, y + 13, x, x + dx); dot(s, x, y + 13); vline(s, x, y + 13, y + 16);
  return y + 16;
}
function rail(s, y, x1, x2, label, o = {}) {
  s.line(x1, y, x2, y, 'WIRE', { w: 0.35 });
  if (o.port) port(s, x1, y, label, 'left', { textAt: [x1 + 1, y - 1.2, 'start'] });
  else s.text(x1 + 1, y - 1.2, label, { size: 2.0, bold: true, layer: 'WIRENO' });
}

// ---------------------------------------------------------------- frame & title block
function frame(s) {
  s.rect(FX0, FY0, FX1 - FX0, FY1 - FY0, 'FRAME', { w: SW.frame });
  s.line(FX0, DY0, FX1, DY0, 'FRAME'); s.line(DX0, DY0, DX0, DY1, 'FRAME'); s.line(FX0, DY1, FX1, DY1, 'FRAME', { w: 0.45 });
  for (let i = 0; i < NCOL; i++) {
    const x = DX0 + i * COLW;
    if (i) s.line(x, FY0, x, DY0, 'FRAME');
    s.text(x + COLW / 2, FY0 + 3.8, String(i + 1), { size: 2.6, anchor: 'middle', layer: 'FRAME' });
  }
  for (let j = 0; j < NROW; j++) {
    const y = DY0 + j * ROWH;
    if (j) s.line(FX0, y, DX0, y, 'FRAME');
    s.text(FX0 + 2.5, y + ROWH / 2 + 1, 'ABCDEF'[j], { size: 2.6, anchor: 'middle', layer: 'FRAME' });
  }
  // title block
  const y0 = DY1, y1 = FY1, M = D.META;
  const L = (x1, ya, x2, yb) => s.line(x1, ya, x2, yb, 'TITLE', { w: 0.25 });
  for (const x of [108, 190, 292, 354]) L(x, y0, x, y1);
  s.text(66.5, y0 + 7, M.companyCn, { size: 3.4, bold: true, anchor: 'middle', layer: 'TITLE' });
  s.text(66.5, y0 + 12.3, M.companyEn, { size: 1.8, anchor: 'middle', layer: 'TITLE' });
  L(FX0, y0 + 15.5, 108, y0 + 15.5);
  s.text(66.5, y0 + 21, '电气原理图  Electrical schematic', { size: 2.5, anchor: 'middle', layer: 'TITLE' });
  s.text(66.5, y0 + 25.5, 'Confidential - do not copy 未经许可不得复制', { size: 1.4, anchor: 'middle', layer: 'TITLE' });
  s.text(110, y0 + 3.6, '项目 Project', { size: 1.5, layer: 'TITLE' });
  s.text(110, y0 + 8.6, M.projectCn, { size: 2.6, bold: true, layer: 'TITLE' });
  s.text(110, y0 + 12.6, M.projectEn, { size: Math.min(1.8, 78 / tw(M.projectEn, 1)), layer: 'TITLE' });
  L(108, y0 + 15.5, 190, y0 + 15.5);
  s.text(110, y0 + 19, '图号 Drawing No.', { size: 1.5, layer: 'TITLE' });
  s.text(110, y0 + 25.5, M.dwgNo, { size: 3.4, bold: true, layer: 'TITLE' });
  s.text(192, y0 + 3.6, '图名 Sheet title', { size: 1.5, layer: 'TITLE' });
  s.text(241, y0 + 11, s.cn, { size: Math.min(3.6, 96 / tw(s.cn, 1)), bold: true, anchor: 'middle', layer: 'TITLE' });
  s.text(241, y0 + 17.5, s.en, { size: Math.min(2.6, 96 / tw(s.en, 1)), anchor: 'middle', layer: 'TITLE' });
  s.text(241, y0 + 25, `标准 Standard: ${M.standardCn}`, { size: 1.6, anchor: 'middle', layer: 'TITLE' });
  const rows = [['设计 Designed', M.designed], ['审核 Checked', M.checked], ['批准 Approved', M.approved], ['日期 Date', M.date]];
  rows.forEach(([k, v], i) => {
    const yy = y0 + i * 7;
    if (i) L(292, yy, 354, yy);
    s.text(293.5, yy + 4.6, k, { size: 1.55, layer: 'TITLE' });
    s.text(316, yy + 4.8, v, { size: 2.0, layer: 'TITLE' });
  });
  L(354, y0 + 9.5, FX1, y0 + 9.5); L(354, y0 + 19, FX1, y0 + 19); L(384, y0, 384, y0 + 19);
  s.text(355.5, y0 + 3.4, '版本 Rev.', { size: 1.5, layer: 'TITLE' });
  s.text(369, y0 + 8.2, M.rev, { size: 3.2, bold: true, anchor: 'middle', layer: 'TITLE' });
  s.text(385.5, y0 + 3.4, '页 Sheet', { size: 1.5, layer: 'TITLE' });
  s.text(399.5, y0 + 8.2, `${s.no} / ${D.SHEETS.length}`, { size: 3.0, bold: true, anchor: 'middle', layer: 'TITLE' });
  s.text(355.5, y0 + 12.8, '比例 Scale', { size: 1.5, layer: 'TITLE' });
  s.text(369, y0 + 17.2, '无 NTS', { size: 2.0, anchor: 'middle', layer: 'TITLE' });
  s.text(385.5, y0 + 12.8, '幅面 Size', { size: 1.5, layer: 'TITLE' });
  s.text(399.5, y0 + 17.2, 'A3', { size: 2.2, anchor: 'middle', layer: 'TITLE' });
  s.text(384.5, y0 + 23.6, `${M.dwgNo}-${String(s.no).padStart(2, '0')}`, { size: 2.2, bold: true, anchor: 'middle', layer: 'TITLE' });
  s.text(384.5, y0 + 26.8, '修改 Rev B: 增加出料超长检测 SQ3/KA9', { size: 1.2, anchor: 'middle', layer: 'TITLE' });
}

function heading(s, x, y, cn, en) {
  s.text(x, y, cn, { size: 2.6, bold: true, layer: 'NOTE' });
  s.text(x, y + 3.2, en, { size: 1.9, layer: 'NOTE' });
}
function note(s, x, y, lines, size = 1.8, gap = 1.35) {
  let yy = y;
  for (const l of lines) { s.text(x, yy, l, { size, layer: 'NOTE' }); yy += size * gap; }
  return yy;
}
function box(s, x, y, w, h, o = {}) { s.rect(x, y, w, h, 'SYM', { w: o.w || 0.35, dash: o.dash }); }

function table(s, x, y, widths, rows, o = {}) {
  const rh = o.rowH || 6, size = o.size || 2.0;
  const totalW = widths.reduce((a, b) => a + b, 0);
  rows.forEach((r, i) => {
    const yy = y + i * rh, head = o.header && i === 0;
    if (head) s.rect(x, yy, totalW, rh, 'TABLE', { fill: '#e8e8e8', w: 0.01 });
    let xx = x;
    r.forEach((cell, j) => {
      const w = widths[j];
      const parts = String(cell ?? '').split('\n');
      const sz0 = head ? Math.min(size, 2.0) : size;
      if (parts.length === 1) {
        const sz = Math.min(sz0, (w - 1.6) / Math.max(0.1, tw(parts[0], 1)));
        s.text(o.center?.[j] ? xx + w / 2 : xx + 0.9, yy + rh / 2 + sz * 0.36, parts[0], { size: sz, bold: head, anchor: o.center?.[j] ? 'middle' : 'start', layer: 'TABLE' });
      } else {
        const sz = Math.min(sz0 * 0.85, ...parts.map((p) => (w - 1.6) / Math.max(0.1, tw(p, 1))));
        parts.forEach((p, k) => s.text(o.center?.[j] ? xx + w / 2 : xx + 0.9, yy + rh / 2 + (k - (parts.length - 1) / 2) * sz * 1.15 + sz * 0.36, p,
          { size: sz, bold: head && k === 0, anchor: o.center?.[j] ? 'middle' : 'start', layer: 'TABLE' }));
      }
      xx += w;
    });
  });
  const n = rows.length;
  for (let i = 0; i <= n; i++) s.line(x, y + i * rh, x + totalW, y + i * rh, 'TABLE', { w: i === 0 || i === 1 || i === n ? 0.3 : 0.15 });
  let xx = x;
  for (let j = 0; j <= widths.length; j++) { s.line(xx, y, xx, y + n * rh, 'TABLE', { w: j === 0 || j === widths.length ? 0.3 : 0.15 }); xx += widths[j] || 0; }
  return y + n * rh;
}

// ---------------------------------------------------------------- symbols for power
function poles(s, xs, y, kind, o = {}) {
  // kind: 'iso' (disconnector), 'mcb', 'km' (contactor main), 'fr' (thermal)
  xs.forEach((x, i) => {
    if (kind === 'fr') {
      s.line(x, y, x, y + 2, 'SYM'); s.rect(x - 1.7, y + 2, 3.4, 6);
      s.poly([[x, y + 2], [x, y + 3.6], [x - 1, y + 3.6], [x - 1, y + 6.4], [x, y + 6.4], [x, y + 8]]);
      s.line(x, y + 8, x, y + 10, 'SYM');
    } else {
      s.line(x, y, x, y + 3, 'SYM'); s.line(x, y + 7, x, y + 10, 'SYM');
      s.line(x, y + 7, x - 2.6, y + 2.6, 'SYM');
      if (kind === 'iso') s.line(x - 1, y + 3, x + 1, y + 3, 'SYM');
      if (kind === 'mcb') { s.line(x - 0.8, y + 2.2, x + 0.8, y + 3.8, 'SYM'); s.line(x - 0.8, y + 3.8, x + 0.8, y + 2.2, 'SYM'); }
      if (kind === 'km') s.arc(x, y + 3.6, 0.6, 180, 360);
    }
    const pin = o.pins ? o.pins[i] : null;
    if (pin) {
      s.text(x - 1.1, y + 2.0, pin[0], { size: 1.4, anchor: 'end', layer: 'PIN' });
      s.text(x - 1.1, y + 9.8, pin[1], { size: 1.4, anchor: 'end', layer: 'PIN' });
    }
  });
  const x0 = xs[0], xn = xs[xs.length - 1];
  if (kind !== 'fr') s.line(x0 - 1.3, y + 5, xn - 1.3 + (kind === 'mcb' || kind === 'iso' ? 0 : 0), y + 5, 'SYM', { dash: '0.8 0.6' });
  else s.line(x0 + 1.7, y + 5, xn - 1.7, y + 5, 'SYM', { dash: '0.8 0.6' });
  if (kind === 'mcb' || kind === 'iso') {
    s.line(x0 - 1.3, y + 5, x0 - 5, y + 5, 'SYM', { dash: '0.8 0.6' });
    if (kind === 'mcb') s.rect(x0 - 7.4, y + 3.8, 2.4, 2.4); else s.poly([[x0 - 5, y + 3.4], [x0 - 6, y + 3.4], [x0 - 6, y + 6.6], [x0 - 5, y + 6.6]]);
  }
  if (o.tag) {
    const tx = xn + 3;
    s.text(tx, y + 3.4, o.tag, { size: 2.4, bold: true, layer: 'TAG' });
    let yy = y + 5.9;
    if (o.ref) { s.text(tx, yy, '', { size: 1.6, layer: 'XREF', fn: mainRef(o.tag) }); yy += 2.3; }
    for (const l of o.lines || []) { s.text(tx, yy, l, { size: 1.6 }); yy += 2.2; }
  }
  return y + 10;
}
function motor(s, cx, cy, r, label, o = {}) {
  s.circle(cx, cy, r);
  s.text(cx, cy + (o.servo ? -0.2 : 0.4), 'M', { size: 3.2, bold: true, anchor: 'middle', layer: 'SYM' });
  s.text(cx, cy + 3.4, o.servo ? '3~ SM' : '3~', { size: 1.8, anchor: 'middle', layer: 'SYM' });
  let yy = cy + r + 3.5;
  s.text(cx, yy, label[0], { size: 2.5, bold: true, anchor: 'middle', layer: 'TAG' });
  for (const l of label.slice(1)) { yy += 2.6; s.text(cx, yy, l, { size: 1.7, anchor: 'middle' }); }
}
function earthSym(s, x, y) {
  s.line(x - 2, y, x + 2, y, 'SYM'); s.line(x - 1.3, y + 0.8, x + 1.3, y + 0.8, 'SYM'); s.line(x - 0.6, y + 1.6, x + 0.6, y + 1.6, 'SYM');
}

// ---------------------------------------------------------------- sheets
const sheets = [];
const mk = (no) => { const s = new Sheet(no); sheets.push(s); return s; };

// ===== Sheet 2: power distribution
function sheet2() {
  const s = mk(2);
  heading(s, 34, 16, '电源进线 3~380V+N+PE 50Hz', 'Incoming supply 3-phase 380 V + N + PE, 50 Hz, TN-S, cable 5×10 mm²');
  const XP = { PE: 38, L1: 46, L2: 53, L3: 60, N: 67 };
  const yT = 28;
  for (const [nm, x] of Object.entries(XP)) {
    s.line(x, 22.5, x, yT - 0.9, 'WIRE');
    s.text(x, 22, nm, { size: 1.8, anchor: 'middle', bold: true, layer: 'WIRENO' });
    term(s, x, yT, 'XT0', { L1: 1, L2: 2, L3: 3, N: 4, PE: 5 }[nm], nm, nm === 'PE' ? 'PE bar' : 'QF0', 'Supply cable 5×10 mm²', { label: 'below', size: nm === 'PE' ? '10' : '10', dev: 'supply' });
  }
  const yQ = 38;
  for (const x of [XP.L1, XP.L2, XP.L3, XP.N]) vline(s, x, yT + 0.9, yQ);
  poles(s, [XP.L1, XP.L2, XP.L3, XP.N], yQ, 'iso', { tag: 'QF0', pins: [['1', '2'], ['3', '4'], ['5', '6'], ['N', 'N']],
    lines: ['NH2-125 4P 40A', '主开关 Main switch', '上级保护 Upstream ≤40A'] });
  const bars = { L11: 60, L21: 66, L31: 72, N: 78 };
  const bx = { L11: XP.L1, L21: XP.L2, L31: XP.L3, N: XP.N };
  for (const [nm, y] of Object.entries(bars)) {
    vline(s, bx[nm], yQ + 10, y); dot(s, bx[nm], y);
    s.line(bx[nm], y, 372, y, 'WIRE', { w: 0.4 });
    s.text(374, y + 0.7, nm, { size: 2.0, bold: true, layer: 'WIRENO' });
  }
  wn(s, XP.L1, 54, 'L11'); wn(s, XP.L2, 54, 'L21'); wn(s, XP.L3, 54, 'L31');
  // branch helper: taps from bars at xs, breaker at y, outputs
  const yB = 92;
  function branch(xs, barNames, tag, pins, lines, outs, portsTo) {
    xs.forEach((x, i) => { const yb = bars[barNames[i]]; dot(s, x, yb); vline(s, x, yb, yB); });
    poles(s, xs, yB, 'mcb', { tag, pins, lines });
    xs.forEach((x, i) => { vline(s, x, yB + 10, yB + 26); wn(s, x, yB + 16, outs[i]); if (portsTo) port(s, x, yB + 26, outs[i], 'down'); });
  }
  branch([96, 103, 110], ['L11', 'L21', 'L31'], 'QF1', [['1', '2'], ['3', '4'], ['5', '6']], ['NXB-63 3P C25', '主机变频器 U1', 'Main VFD U1'], ['U11', 'V11', 'W11'], true);
  branch([146, 153, 160], ['L11', 'L21', 'L31'], 'QF2', [['1', '2'], ['3', '4'], ['5', '6']], ['NXB-63 3P C10', '液压泵 M2', 'Hydraulic pump M2'], ['U21', 'V21', 'W21'], true);
  branch([198, 205], ['L31', 'N'], 'QF3', [['1', '2'], ['N', 'N']], ['NXB-63 2P C16', '伺服驱动 U2 220V', 'Servo drive U2 (L3-N)'], ['L33', 'N33'], true);
  // QF4 -> G1
  const q4 = [246, 253];
  q4.forEach((x, i) => { const yb = bars[['L11', 'N'][i]]; dot(s, x, yb); vline(s, x, yb, yB); });
  poles(s, q4, yB, 'mcb', { tag: 'QF4', pins: [['1', '2'], ['N', 'N']], lines: ['NXB-63 2P C6', '开关电源 G1', 'PSU G1 (L1-N)'] });
  vline(s, 246, yB + 10, 130); vline(s, 253, yB + 10, 130);
  wn(s, 246, 112, 'L41'); wn(s, 253, 118, 'N41');
  box(s, 238, 130, 26, 22);
  s.text(240, 134, 'L', { size: 1.5, layer: 'PIN' }); s.text(254.8, 134, 'N', { size: 1.5, layer: 'PIN' });
  s.text(251, 141, 'G1', { size: 2.6, bold: true, anchor: 'middle', layer: 'TAG' });
  s.text(251, 144, 'AC/DC', { size: 1.5, anchor: 'middle' });
  s.text(266, 136, 'NDR-120-24', { size: 1.7 }); s.text(266, 138.4, 'Mean Well 明纬', { size: 1.5 });
  s.text(266, 140.8, '24VDC 5A 120W', { size: 1.5 }); s.text(266, 143.2, '开关电源 PSU', { size: 1.5 });
  s.text(240, 150.5, '+V', { size: 1.5, layer: 'PIN' }); s.text(253.5, 150.5, '-V', { size: 1.5, layer: 'PIN' });
  s.text(259.5, 150.5, 'FG', { size: 1.4, layer: 'PIN' });
  // QF5 -> AC control
  const q5 = [300, 307];
  q5.forEach((x, i) => { const yb = bars[['L21', 'N'][i]]; dot(s, x, yb); vline(s, x, yb, yB); });
  poles(s, q5, yB, 'mcb', { tag: 'QF5', pins: [['1', '2'], ['N', 'N']], lines: ['NXB-63 2P C4', '交流控制 220V', 'AC control (L2-N)'] });
  vline(s, 300, yB + 10, yB + 26); vline(s, 307, yB + 10, yB + 26);
  wn(s, 300, yB + 16, '101'); wn(s, 307, yB + 21, 'N51');
  port(s, 300, yB + 26, '101', 'down'); port(s, 307, yB + 26, 'N51', 'down', { textAt: [309, yB + 33, 'start'] });
  // 24V distribution
  const yP = 172, y0V = 214;
  vline(s, 241, 152, yP); dot(s, 241, yP); wn(s, 241, 162, '24V+');
  s.line(241, yP, 372, yP, 'WIRE', { w: 0.35 });
  vline(s, 255, 152, y0V); wn(s, 255, 188, '0V');
  s.line(255, y0V, 372, y0V, 'WIRE', { w: 0.35 }); dot(s, 255, y0V);
  port(s, 372, y0V, '0V', 'right');
  const fus = [['FU1', 290, '24V1', '2A', '指示灯/计数器/安全', 'lamps, counter, safety'], ['FU2', 318, '24V2', '2A', '伺服 I/O', 'servo CN1 COM+'], ['FU3', 346, '24V3', '6A', '继电器/电磁阀 (经KA0)', 'relays, valves via KA0']];
  for (const [tag, x, out, a, cn, en] of fus) {
    dot(s, x, yP); vline(s, x, yP, yP + 6);
    s.rect(x - 1.2, yP + 7, 2.4, 6); s.line(x, yP + 6, x, yP + 14, 'SYM');
    vline(s, x, yP + 14, yP + 26); wn(s, x, yP + 20, out);
    s.text(x + 2.4, yP + 9.5, tag, { size: 2.3, bold: true, layer: 'TAG' });
    s.text(x + 2.4, yP + 11.9, `RT28 ${a}`, { size: 1.5 });
    port(s, x, yP + 26, out, 'down');
    s.text(x - 3, yP + 35, cn, { size: 1.4 }); s.text(x - 3, yP + 37.2, en, { size: 1.3 });
  }
  s.text(375, yP + 0.7, '24V+', { size: 2.0, bold: true, layer: 'WIRENO' });
  // PE bar
  const yPE = 236;
  vline(s, XP.PE, yT + 0.9, yPE); dot(s, XP.PE, yPE);
  s.line(XP.PE, yPE, 372, yPE, 'WIRE', { w: 0.6 });
  s.text(40, yPE - 1.4, 'PE 接地排 PE bar', { size: 2.0, bold: true, layer: 'WIRENO' });
  vline(s, 262, 152, yPE); dot(s, 262, yPE); wn(s, 262, 200, 'PE');
  vline(s, 270, y0V, yPE); dot(s, 270, y0V); dot(s, 270, yPE); wn(s, 270, 224, '0V-PE');
  s.text(272, 229, '0V 接地 0V bonded to PE', { size: 1.5 });
  port(s, 372, yPE, 'PE', 'right');
  earthSym(s, 120, yPE + 4); vline(s, 120, yPE, yPE + 4); dot(s, 120, yPE);
  s.text(124, yPE + 5.5, '柜体/门/安装板接地 Enclosure, door & mounting plate bonded', { size: 1.6 });
  // notes
  heading(s, 34, 128, '说明 Notes', '');
  note(s, 34, 136, [
    '1. 主开关 QF0 带门联锁，可挂锁。QF0 door-interlocked, lockable.',
    '2. 小型断路器分断能力 6 kA (NXB-63, C 曲线)。MCB breaking capacity 6 kA.',
    '3. 伺服驱动器 U2 为单相 220V (L3-N)。Servo U2 is 1-phase 220 V.',
    '4. 装机功率 9.2 kW，最大相电流约 28 A (L3)。',
    '   Installed power 9.2 kW, max. phase current approx. 28 A (L3).',
    '5. 导线截面见封面。Wire sizes: see sheet 1.',
  ], 1.7, 1.45);
  return s;
}

// ===== Sheet 3: motor & servo power + pump control
function sheet3() {
  const s = mk(3);
  // -- main VFD
  heading(s, 34, 15, '主机成型电机', 'Main roll-forming motor M1');
  const xs1 = [44, 51, 58];
  ['U11', 'V11', 'W11'].forEach((n, i) => { port(s, xs1[i], 26, n, 'up', { textAt: [xs1[i] - 0.8, 22.6 - (2 - i) * 0, 'end'] }); vline(s, xs1[i], 26, 44); });
  box(s, 38, 44, 54, 34);
  regMain('U1', s, 44);
  ['R/L1', 'S/L2', 'T/L3'].forEach((p, i) => s.text(xs1[i], 47.2, p, { size: 1.3, anchor: 'middle', layer: 'PIN' }));
  ['U/T1', 'V/T2', 'W/T3'].forEach((p, i) => s.text(xs1[i], 76.6, p, { size: 1.3, anchor: 'middle', layer: 'PIN' }));
  s.text(70, 76.6, 'PE', { size: 1.3, anchor: 'middle', layer: 'PIN' });
  s.text(78, 47.2, 'B1', { size: 1.3, anchor: 'middle', layer: 'PIN' }); s.text(87, 47.2, 'B2', { size: 1.3, anchor: 'middle', layer: 'PIN' });
  s.text(41, 55, 'U1', { size: 3.0, bold: true, layer: 'TAG' });
  s.text(41, 59, 'VFD055E43A', { size: 2.0 }); s.text(41, 62, 'Delta 台达 VFD-E', { size: 1.7 });
  s.text(41, 64.8, '5.5kW 3~380-480V', { size: 1.7 }); s.text(41, 67.6, '变频器 Inverter', { size: 1.7 });
  s.text(41, 70.6, '', { size: 1.5, layer: 'XREF', fn: () => `控制端子 Control ${DEVMAIN['U1ctl'] ? ref(DEVMAIN['U1ctl'].sheet, DEVMAIN['U1ctl'].x) : ''}` });
  mirror(s, 'U1', 74, 56, { title: 'U1 继电器 relay' });
  // braking resistor
  vline(s, 78, 44, 32); vline(s, 87, 44, 32);
  s.line(78, 32, 79, 32, 'WIRE'); s.rect(79, 30.6, 7, 2.8); s.line(86, 32, 87, 32, 'WIRE');
  s.text(82.5, 29.4, 'R1', { size: 2.2, bold: true, anchor: 'middle', layer: 'TAG' });
  s.text(89, 30, 'BR1K0W075', { size: 1.5 }); s.text(89, 32.3, '1000W 75Ω 制动电阻', { size: 1.4 }); s.text(89, 34.5, 'Braking resistor', { size: 1.4 });
  const yX = 96;
  ['1U', '1V', '1W'].forEach((n, i) => { vline(s, xs1[i], 78, yX - 0.9); wn(s, xs1[i], 86 + i * 0, n, { dy: 0.7 + (i % 2) * 2.4 }); term(s, xs1[i], yX, 'XT1', i + 1, n, 'U1 ' + ['U', 'V', 'W'][i], 'M1 ' + ['U1', 'V1', 'W1'][i], { label: 'below', size: '4', dev: 'M1' }); });
  vline(s, 70, 78, yX - 0.9); term(s, 70, yX, 'XT1', 4, 'PE', 'PE bar', 'M1 PE', { label: 'below', size: '4', dev: 'M1' }); wn(s, 70, 86, 'PE');
  const mcx = 51, mcy = 124, mr = 9;
  xs1.forEach((x) => { const dy = Math.sqrt(mr * mr - (x - mcx) ** 2); vline(s, x, yX + 0.9, mcy - dy); });
  vline(s, 70, yX + 0.9, mcy); s.line(70, mcy, mcx + mr, mcy, 'WIRE'); s.text(66, mcy - 1, 'PE', { size: 1.5, layer: 'WIRENO' });
  motor(s, mcx, mcy, mr, ['M1', '5.5kW 380V 11.6A', '1440 r/min  YE3-132S-4', '主机成型 Main forming']);

  // -- hydraulic pump
  heading(s, 132, 15, '液压泵电机', 'Hydraulic pump motor M2');
  const xs2 = [140, 147, 154];
  ['U21', 'V21', 'W21'].forEach((n, i) => { port(s, xs2[i], 26, n, 'up', { textAt: [xs2[i] - 0.8, 22.6, 'end'] }); vline(s, xs2[i], 26, 40); });
  poles(s, xs2, 40, 'km', { tag: 'KM1', ref: true, pins: [['1', '2'], ['3', '4'], ['5', '6']], lines: ['NXC-12 AC220V'] });
  xs2.forEach((x, i) => regRef('KM1', s, x, ['1-2', '3-4', '5-6'][i], false));
  ['U22', 'V22', 'W22'].forEach((n, i) => { vline(s, xs2[i], 50, 60); wn(s, xs2[i], 54 + (i % 2) * 2.5, n); });
  poles(s, xs2, 60, 'fr', { tag: 'FR1', lines: ['NXR-12 4-6A', '整定 set 5.0A'] });
  regMain('FR1', s, 147);
  mirror(s, 'FR1', 158, 73.5);
  ['2U', '2V', '2W'].forEach((n, i) => { vline(s, xs2[i], 70, yX - 0.9); wn(s, xs2[i], 80 + (i % 2) * 2.5, n); term(s, xs2[i], yX, 'XT1', 5 + i, n, 'FR1 ' + ['2', '4', '6'][i], 'M2 ' + ['U1', 'V1', 'W1'][i], { label: 'below', size: '2.5', dev: 'M2' }); });
  vline(s, 164, 60, yX - 0.9); term(s, 164, yX, 'XT1', 8, 'PE', 'PE bar', 'M2 PE', { label: 'below', size: '2.5', dev: 'M2' });
  port(s, 164, 60, 'PE', 'up', { textAt: [166, 59, 'start'] });
  const m2x = 147;
  xs2.forEach((x) => { const dy = Math.sqrt(mr * mr - (x - m2x) ** 2); vline(s, x, yX + 0.9, mcy - dy); });
  vline(s, 164, yX + 0.9, mcy); s.line(164, mcy, m2x + mr, mcy, 'WIRE');
  motor(s, m2x, mcy, mr, ['M2', '2.2kW 380V 5.0A', '1430 r/min  YE3-100L1-4', '液压泵 Hydraulic pump']);

  // -- servo
  heading(s, 184, 15, '追剪伺服', 'Flying shear servo U2 / M3');
  const xs3 = [194, 201, 208];
  port(s, 194, 26, 'L33', 'up', { textAt: [192.8, 22.6, 'end'] }); port(s, 201, 26, 'N33', 'up', { textAt: [202.6, 22.6, 'start'] });
  vline(s, 194, 26, 44); vline(s, 201, 26, 44);
  dot(s, 194, 32); hline(s, 32, 194, 218); vline(s, 218, 32, 44);
  dot(s, 201, 36); hline(s, 36, 201, 224); vline(s, 224, 36, 44);
  wn(s, 218, 38, 'L33'); wn(s, 224, 41, 'N33');
  box(s, 186, 44, 64, 36);
  regMain('U2', s, 201);
  [['R', 194], ['S', 201], ['L1C', 218], ['L2C', 224]].forEach(([p, x]) => s.text(x, 47.2, p, { size: 1.3, anchor: 'middle', layer: 'PIN' }));
  [['U', 194], ['V', 201], ['W', 208], ['PE', 216]].forEach(([p, x]) => s.text(x, 78.6, p, { size: 1.3, anchor: 'middle', layer: 'PIN' }));
  s.text(189, 55, 'U2', { size: 3.0, bold: true, layer: 'TAG' });
  s.text(189, 59, 'ASD-A2-1521-L', { size: 2.0 }); s.text(189, 62, 'Delta 台达 ASDA-A2', { size: 1.7 });
  s.text(189, 64.8, '1.5kW 220V 1~ E-CAM', { size: 1.7 }); s.text(189, 67.6, '伺服驱动器 Servo drive', { size: 1.7 });
  s.text(248.6, 52, 'CN1', { size: 1.5, anchor: 'end', layer: 'PIN' });
  s.text(248.6, 62, 'CN5', { size: 1.5, anchor: 'end', layer: 'PIN' });
  s.text(248.6, 74, 'CN2', { size: 1.5, anchor: 'end', layer: 'PIN' });
  hline(s, 51.5, 250, 256); port(s, 256, 51.5, 'CN1', 'right');
  ['3U', '3V', '3W'].forEach((n, i) => { vline(s, xs3[i], 80, yX - 0.9); wn(s, xs3[i], 86 + (i % 2) * 2.5, n); term(s, xs3[i], yX, 'XT1', 9 + i, n, 'U2 ' + ['U', 'V', 'W'][i], 'M3 ' + ['U', 'V', 'W'][i], { label: 'below', size: '2.5', dev: 'M3' }); });
  vline(s, 216, 80, yX - 0.9); term(s, 216, yX, 'XT1', 12, 'PE', 'PE bar', 'M3 PE', { label: 'below', size: '2.5', dev: 'M3' });
  const m3x = 201;
  xs3.forEach((x) => { const dy = Math.sqrt(mr * mr - (x - m3x) ** 2); vline(s, x, yX + 0.9, mcy - dy); });
  vline(s, 216, yX + 0.9, mcy); s.line(216, mcy, m3x + mr, mcy, 'WIRE');
  motor(s, m3x, mcy, mr, ['M3', '1.5kW 220V 8.3A 2000 r/min', 'ECMA-E21315RS 20-bit', '追剪伺服电机 Servo motor'], { servo: true });
  // motor encoder + W2
  s.rect(213, 128, 7, 6); s.text(216.5, 132.2, 'PG', { size: 1.6, anchor: 'middle', layer: 'SYM' });
  s.line(210, 131, 213, 131, 'SYM', { dash: '0.8 0.6' });
  s.poly([[220, 131], [236, 131], [236, 74], [250, 74]], 'WIRE', { dash: '2 0.8' });
  s.text(237.5, 108, 'W2 ASD-B2EB1003', { size: 1.5, rot: -90 });
  s.text(240, 108, '编码器电缆 3m', { size: 1.4, rot: -90 });
  // measuring encoder B1 -> CN5
  s.rect(258, 106, 12, 10); s.text(264, 112, 'B1', { size: 2.4, bold: true, anchor: 'middle', layer: 'TAG' });
  s.circle(264, 124, 5.5); s.line(264, 116, 264, 118.5, 'SYM', { dash: '0.8 0.6' });
  s.text(271.5, 108, 'E50S8-1000-6-L-5', { size: 1.5 }); s.text(271.5, 110.3, 'Autonics 1000 P/R', { size: 1.5 });
  s.text(271.5, 112.6, '线驱动 line driver 5V', { size: 1.4 }); s.text(271.5, 114.9, '测长编码器', { size: 1.4 });
  s.text(271.5, 117.2, 'Length encoder', { size: 1.4 });
  s.text(271.5, 124, '测长轮 周长 200 mm', { size: 1.4 }); s.text(271.5, 126.2, 'Measuring wheel 200 mm', { size: 1.4 });
  s.poly([[264, 106], [264, 62], [250, 62]], 'WIRE', { dash: '2 0.8' });
  s.text(265.4, 92, 'W1 RVVP 8×0.3', { size: 1.5, rot: -90 });
  s.text(258.4, 103, 'A /A B /B Z /Z +5V 0V', { size: 1.3, rot: -90 });
  s.text(252, 60.4, 'E-CAM 主轴 master', { size: 1.3 });

  heading(s, 36, 170, '电机一览表', 'Motor schedule');
  table(s, 36, 176, [12, 44, 12, 12, 12, 16, 20, 56, 22], [
    ['代号\nTag', '名称 Description', 'kW', 'V', 'A', 'r/min', '启动\nStarter', '保护/驱动 Protection / drive', '端子\nTerminals'],
    ...D.MOTORS.map((m) => [m.tag, `${m.cn} ${m.en}`, String(m.kW), String(m.V), m.A.toFixed(1), String(m.rpm),
      { VFD: '变频 VFD', DOL: '直接 DOL', SERVO: '伺服 Servo' }[m.starter], m.starterTags.join(' / ') + '  ' + m.partNumbers[0].replace(/^\S+ /, ''),
      TERMS.filter((t) => t.dev === m.tag).map((t) => t.no).join(',').replace(/^(\d+),.*,(\d+)$/, 'XT1:$1-$2')]),
  ], { rowH: 6.5, size: 1.9, header: true, center: { 2: true, 3: true, 4: true, 5: true } });

  // -- AC pump control
  heading(s, 292, 15, '液压泵控制 220VAC', 'Hydraulic pump control');
  const xc = 306;
  port(s, 296, 26, '101', 'left', { textAt: [295.5, 23.5, 'end'] }); hline(s, 26, 296, xc); wn(s, 298, 24.6, '101', { dy: 0 });
  let y = 26;
  y = chain(s, xc, y, [['w', 4], ['c', { tag: 'KA0', pins: ['13', '14'], note: '安全 safety' }], ['w', 4, '103'],
    ['c', { tag: 'SB2', pins: ['11', '12'], nc: true, act: 'push', ref: false, note: '油泵停止 pump stop' }], ['w', 4, '105']]);
  y = par(s, xc, y, { tag: 'SB1', pins: ['13', '14'], act: 'push', ref: false, note: '油泵启动' }, { tag: 'KM1', pins: ['13', '14'] }, 16);
  y = chain(s, xc, y, [['w', 4, '107'], ['c', { tag: 'FR1', pins: ['95', '96'], nc: true, act: 'thermal' }], ['w', 4, '109'],
    ['coil', { tag: 'KM1', desc: ['液压泵接触器', 'Pump contactor'] }], ['w', 4]]);
  const yN = y;
  hline(s, yN, 296, xc); port(s, 296, yN, 'N51', 'left', { textAt: [295.5, yN - 2.5, 'end'] });
  mirror(s, 'KM1', xc - 4, yN + 5);
  note(s, 340, 40, ['线圈电压 Coil 220VAC', 'NXC-12 + F4-22', '辅助触头 Aux:', '13-14, 21-22,', '53-54, 63-64'], 1.6, 1.45);
  // notes
  heading(s, 292, 170, '说明 Notes', '');
  note(s, 292, 177, [
    '1. U1 运行指令=外部端子 (MI1 正转, MI2 反转, MI3 点动)；',
    '   Run command from terminals (MI1 FWD, MI2 REV, MI3 JOG).',
    '2. U1 频率由面板电位器设定；加速 3 s，减速 2 s，R1 制动。',
    '   Speed from keypad pot; accel 3 s, decel 2 s, braking via R1.',
    '3. U1 继电器 RA/RB/RC = 故障。Relay RA/RB/RC = fault.',
    '4. U2 电子凸轮追剪，主轴=CN5 编码器 B1 (1000P/R×4)。',
    '   U2 E-CAM flying shear, master = CN5 encoder B1 (1000 ppr ×4).',
    '5. 电机电缆采用屏蔽电缆，两端接地。Shielded motor cables.',
  ], 1.6, 1.45);
  return s;
}

// ===== Sheet 4: safety + VFD control + lamps
function sheet4() {
  const s = mk(4);
  const yR = 20, y0 = 236;
  rail(s, yR, 34, 408, '24V1', { port: true });
  rail(s, y0, 34, 408, '0V', { port: true });
  heading(s, 34, 30, '安全回路', 'Safety circuit KA0');
  // PNOZ box
  const bx0 = 46, bx1 = 222, byT = 176, byB = 200;
  box(s, bx0, byT, bx1 - bx0, byB - byT, { w: 0.45 });
  regMain('KA0', s, 140);
  const top = { S11: 54, S12: 70, S22: 92, S21: 108, S33: 126, S34: 142, A1: 160, '13': 178, '23': 194, '31': 210 };
  const bot = { A2: 160, '14': 178, '24': 194, '32': 210 };
  for (const [p, x] of Object.entries(top)) s.text(x, byT + 3, p, { size: 1.5, anchor: 'middle', layer: 'PIN' });
  for (const [p, x] of Object.entries(bot)) s.text(x, byB - 1.2, p, { size: 1.5, anchor: 'middle', layer: 'PIN' });
  // internal contacts
  for (const [x, nc] of [[178, false], [194, false], [210, true]]) {
    s.line(x, byT, x, byT + 4, 'SYM'); s.line(x, byT + 4, x, byT + 7.5, 'SYM');
    if (nc) { s.line(x, byT + 14.5, x + 2.6, byT + 9.9, 'SYM'); s.line(x, byT + 10.5, x + 3.2, byT + 10.5, 'SYM'); }
    else s.line(x, byT + 14.5, x - 2.6, byT + 10.1, 'SYM');
    s.line(x, byT + 7.5, x, byT + 10.5, 'SYM'); s.line(x, byT + 14.5, x, byB, 'SYM');
  }
  s.text(50, 188.5, 'KA0', { size: 3.2, bold: true, layer: 'TAG' });
  s.text(62, 188.5, 'Pilz PNOZ s3  750103  24VDC', { size: 2.0 });
  s.text(50, 193, '安全继电器 Safety relay  2NO (13-14, 23-24) + 1NC (31-32)', { size: 1.7 });
  s.text(50, 196.5, '双通道 两路急停+防护罩，手动复位 Two-channel, manual reset', { size: 1.5 });
  // channel 1: S11 up, contacts at x=70 down to S12
  const c1u = top.S11, c1 = top.S12, c2 = top.S22, c2u = top.S21;
  vline(s, c1u, byT, 34); hline(s, 34, c1u, c1); wn(s, c1u, 120, '401');
  vline(s, c2u, byT, 30); hline(s, 30, c2, c2u); wn(s, c2u, 120, '405');
  // channel 1
  let y = chain(s, c1, 34, [['w', 6], ['c', { tag: 'SB0', pins: ['11', '12'], nc: true, act: 'estop', ref: false, noLabel: true }], ['w', 4, '402'],
    ['t', 'XT2', 1, '402', 'SB0 12', 'SB10 11', { dev: 'SB10' }], ['c', { tag: 'SB10', pins: ['11', '12'], nc: true, act: 'estop', ref: false, noLabel: true }],
    ['t', 'XT2', 2, '403', 'XT2:5', 'SB10 12', { dev: 'SB10' }], ['w', 4, '403'],
    ['t', 'XT2', 5, '403', 'XT2:2', 'SQ5 11', { dev: 'SQ5' }], ['c', { tag: 'SQ5', pins: ['11', '12'], nc: true, act: 'guard', ref: false, noLabel: true }],
    ['t', 'XT2', 6, '404', 'KA0 S12', 'SQ5 12', { dev: 'SQ5' }]]);
  vline(s, c1, y, byT); wn(s, c1, 140, '404');
  y = chain(s, c2, 30, [['w', 10], ['c', { tag: 'SB0', pins: ['21', '22'], nc: true, ref: false, noLabel: true }], ['w', 4, '406'],
    ['t', 'XT2', 3, '406', 'SB0 22', 'SB10 21', { dev: 'SB10', label: 'right' }], ['c', { tag: 'SB10', pins: ['21', '22'], nc: true, ref: false, noLabel: true }],
    ['t', 'XT2', 4, '407', 'XT2:7', 'SB10 22', { dev: 'SB10', label: 'right' }], ['w', 4, '407'],
    ['t', 'XT2', 7, '407', 'XT2:4', 'SQ5 21', { dev: 'SQ5', label: 'right' }], ['c', { tag: 'SQ5', pins: ['21', '22'], nc: true, ref: false, noLabel: true }],
    ['t', 'XT2', 8, '408', 'KA0 S22', 'SQ5 22', { dev: 'SQ5', label: 'right' }]]);
  vline(s, c2, y, byT); wn(s, c2, 140, '408');
  // mechanical links (channel 2 contacts are offset 4 mm lower)
  for (const ym of [45, 63.8, 87.4]) s.line(c1 + 1.3, ym, c2 + 1.3, ym, 'SYM', { dash: '0.8 0.6' });
  // labels left
  note(s, 31.5, 42, ['SB0', '急停 操作台', 'E-stop console'], 1.6, 1.3);
  note(s, 31.5, 66, ['SB10', '急停 出料端', 'E-stop run-out'], 1.6, 1.3);
  note(s, 31.5, 92, ['SQ5', '剪切防护罩', 'Shear guard'], 1.6, 1.3);
  s.text(c2 + 4.4, 44.6, 'SB0', { size: 2.2, bold: true, layer: 'TAG' });
  s.text(c2 + 4.4, 63.4, 'SB10', { size: 2.2, bold: true, layer: 'TAG' });
  s.text(c2 + 4.4, 87, 'SQ5', { size: 2.2, bold: true, layer: 'TAG' });
  s.text(c2 + 4.4, 89.4, 'XCSPA791', { size: 1.3 });
  // reset loop
  vline(s, top.S33, byT, 34); hline(s, 34, top.S33, top.S34); wn(s, top.S33, 120, '409');
  y = chain(s, top.S34, 34, [['w', 6], ['c', { tag: 'KM1', pins: ['21', '22'], nc: true, note: '反馈 EDM' }], ['w', 6, '410'],
    ['c', { tag: 'SB9', pins: ['13', '14'], act: 'push', ref: false, note: '复位 Reset' }]]);
  vline(s, top.S34, y, byT); wn(s, top.S34, 140, '411');
  // A1/A2
  dot(s, top.A1, yR); vline(s, top.A1, yR, byT); vline(s, bot.A2, byB, y0); dot(s, bot.A2, y0);
  // 13/14 -> sheet 3 ; 23/24 -> 24VS
  vline(s, top['13'], byT, 160); s.text(top['13'] + 1, 158, '101', { size: 1.7, layer: 'WIRENO' });
  vline(s, bot['14'], byB, 212); s.text(bot['14'] + 1, 211, '103', { size: 1.7, layer: 'WIRENO' });
  mirror(s, 'KA0', 168, 216, { title: 'KA0' });
  vline(s, top['23'], byT, 150); port(s, top['23'], 150, '24V3', 'up');
  vline(s, bot['24'], byB, 222); port(s, bot['24'], 222, '24VS', 'down', { textAt: [196, 228, 'start'] });
  vline(s, top['31'], byT, 170); vline(s, bot['32'], byB, 206);
  s.text(top['31'] + 1, 168, '备用 spare', { size: 1.4 });
  // safety note
  s.rect(48, 206, 106, 20, 'NOTE', { w: 0.25 });
  note(s, 50, 210.5, [
    '安全功能 Safety functions: 急停 SB0/SB10 + 防护罩 SQ5 → KA0',
    'E-stop SB0/SB10 + shear guard SQ5 → KA0 (PNOZ s3)',
    '安全等级 PL d / Cat.3 (GB/T 16855.1-2018 / ISO 13849-1)',
    '停止类别 0 Stop category 0;  手动复位 + KM1 反馈监控 (EDM)',
  ], 1.65, 1.4);

  // VFD control
  heading(s, 238, 30, '变频器控制端子', 'VFD U1 control terminals');
  const ux = { DCM: 242, MI1: 256, MI2: 286, MI3: 302 };
  const uy = 176;
  box(s, 236, uy, 92, 18);
  regMain('U1ctl', s, 256);
  for (const [p, x] of Object.entries(ux)) s.text(x, uy + 3, p, { size: 1.5, anchor: 'middle', layer: 'PIN' });
  s.text(239, uy + 9.5, 'U1', { size: 2.8, bold: true, layer: 'TAG' });
  s.text(249, uy + 9.5, 'VFD055E43A 控制端子 control terminals', { size: 1.6 });
  s.text(239, uy + 13, '', { size: 1.5, layer: 'XREF', fn: () => `主回路 Power ${ref(DEVMAIN.U1.sheet, DEVMAIN.U1.x)}  漏型 sink (NPN) mode`, });
  const yb = 44;
  vline(s, ux.DCM, uy, yb); wn(s, ux.DCM, 120, '501'); hline(s, yb, ux.DCM, 316);
  dot(s, ux.MI1, yb); dot(s, ux.MI2, yb); dot(s, ux.MI3, yb);
  y = chain(s, ux.MI1, yb, [['w', 10]]);
  y = par(s, ux.MI1, y, { tag: 'KA1', pins: ['21', '24'], note: '联动 run' }, { tag: 'KA2', pins: ['21', '24'], note: '点动正' }, 14);
  vline(s, ux.MI1, y, uy); wn(s, ux.MI1, 120, '502');
  hline(s, yb, ux.MI2, ux.MI2);
  y = chain(s, ux.MI2, yb, [['w', 13], ['c', { tag: 'KA3', pins: ['21', '24'], note: '点动反' }]]);
  vline(s, ux.MI2, y, uy); wn(s, ux.MI2, 120, '503');
  y = chain(s, ux.MI3, yb, [['w', 10]]);
  y = par(s, ux.MI3, y, { tag: 'KA2', pins: ['31', '34'] }, { tag: 'KA3', pins: ['31', '34'] }, 14);
  vline(s, ux.MI3, y, uy); wn(s, ux.MI3, 120, '504');
  note(s, 238, 204, ['MI1 正转 FWD  MI2 反转 REV  MI3 点动 JOG', 'RA-RC 故障常开 fault NO, RB-RC 故障常闭 fault NC'], 1.6, 1.4);
  // lamps
  heading(s, 340, 30, '指示灯', 'Pilot lights');
  const lx = { HL1: 344, HL2: 358, HL4: 374, HL5: 400 };
  dot(s, lx.HL1, yR); chain(s, lx.HL1, yR, [['w', 112], ['lamp', { tag: 'HL1', color: '白 WH' }], ['w', y0 - yR - 122]]);
  dot(s, lx.HL2, yR); chain(s, lx.HL2, yR, [['w', 46], ['c', { tag: 'KM1', pins: ['63', '64'] }], ['w', 56, '601'], ['lamp', { tag: 'HL2', color: '绿 GN' }], ['w', y0 - yR - 122]]);
  dot(s, lx.HL4, yR); y = chain(s, lx.HL4, yR, [['w', 43]]);
  y = par(s, lx.HL4, y, { tag: 'KA6', pins: ['21', '24'] }, { tag: 'U1', pins: ['RA', 'RC'] }, 13);
  chain(s, lx.HL4, y, [['w', 53, '602'], ['lamp', { tag: 'HL4', color: '红 RD' }], ['w', y0 - yR - 122]]);
  dot(s, lx.HL5, yR); chain(s, lx.HL5, yR, [['w', 46], ['c', { tag: 'H7CX', pins: ['OUT', 'NO'], note: '' }], ['w', 56, '603'], ['lamp', { tag: 'HL5', color: '黄 YE' }], ['w', y0 - yR - 122]]);
  for (const x of Object.values(lx)) dot(s, x, y0);
  note(s, 342, 244, ['HL1 电源 Power on', 'HL2 油泵运行 Pump running', 'HL4 故障 Fault (servo/VFD)', 'HL5 批量完成 Batch complete', '(HL3 联动运行 → /5)'], 1.55, 1.4);
  return s;
}

// ===== Sheet 5: relay logic 1
function sheet5() {
  const s = mk(5);
  const yR = 20, y0 = 232;
  rail(s, yR, 34, 408, '24VS', { port: true });
  rail(s, y0, 34, 408, '0V', { port: true });
  // KA1 line run
  heading(s, 36, 248, '联动运行 Line run', '');
  const x = 46;
  dot(s, x, yR);
  let y = chain(s, x, yR, [['w', 4],
    ['c', { tag: 'SB4', pins: ['11', '12'], nc: true, act: 'push', ref: false, note: '联动停止 line stop' }], ['w', 3, '301'],
    ['c', { tag: 'KM1', pins: ['53', '54'], note: '油泵运行 pump on' }], ['w', 3, '302'],
    ['c', { tag: 'KA5', pins: ['11', '14'], note: '伺服准备 servo ready' }], ['w', 3, '303'],
    ['c', { tag: 'KA6', pins: ['11', '12'], nc: true, note: '伺服报警 servo alarm' }], ['w', 3, '304'],
    ['c', { tag: 'U1', pins: ['RB', 'RC'], nc: true, note: '变频器故障 VFD fault' }], ['w', 3, '305'],
    ['c', { tag: 'KT1', pins: ['15', '16'], nc: true, delay: true, note: '剪切超时 cut timeout' }], ['w', 3, '306'],
    ['c', { tag: 'H7CX', pins: ['OUT', 'NC'], nc: true, note: '批量完成 batch done' }], ['w', 3, '307'],
    ['c', { tag: 'KA9', pins: ['11', '12'], nc: true, note: '出料超长 overrun' }], ['w', 3, '308'],
    ['c', { tag: 'KA10', pins: ['11', '14'], note: '有料 material' }], ['w', 1, '']]);
  wn(s, x, y - 0.5, '309');
  y = par(s, x, y, { tag: 'SB3', pins: ['13', '14'], act: 'push', ref: false, note: '联动启动 start' }, { tag: 'KA1', pins: ['11', '14'], note: '自锁 hold' }, 18);
  y = chain(s, x, y, [['w', 3, '310']]);
  const yc = y;
  dot(s, x, yc); hline(s, yc, x, x + 18); vline(s, x + 18, yc, yc + 1);
  lamp(s, x + 18, yc + 1, { tag: 'HL3', color: '绿 GN 运行' });
  vline(s, x + 18, yc + 11, y0); dot(s, x + 18, y0);
  y = chain(s, x, yc, [['coil', { tag: 'KA1', desc: ['联动运行', 'Line run'] }]]);
  vline(s, x, y, y0); dot(s, x, y0);
  mirror(s, 'KA1', x - 4, y0 + 4);

  // jog / manual bus
  heading(s, 100, 248, '点动 / 手动剪切 Jog / manual cut', '');
  const xb = 104;
  dot(s, xb, yR);
  y = chain(s, xb, yR, [['w', 4], ['c', { tag: 'KA1', pins: ['41', '42'], nc: true, note: '联动未运行 line off' }], ['w', 6, '321']]);
  const yBus = y;
  hline(s, yBus, xb, 176);
  const jx = [104, 140, 176];
  dot(s, jx[1], yBus); dot(s, jx[0], yBus);
  let ya = chain(s, jx[0], yBus, [['w', 4], ['c', { tag: 'SB5', pins: ['13', '14'], act: 'push', ref: false, note: '点动正转 jog fwd' }], ['w', 4, '322'],
    ['c', { tag: 'KA3', pins: ['11', '12'], nc: true, note: '互锁 interlock' }], ['w', 4, '323'], ['coil', { tag: 'KA2', desc: ['点动正转', 'Jog forward'] }]]);
  vline(s, jx[0], ya, y0); dot(s, jx[0], y0); mirror(s, 'KA2', jx[0] - 4, y0 + 4);
  ya = chain(s, jx[1], yBus, [['w', 4], ['c', { tag: 'SB6', pins: ['13', '14'], act: 'push', ref: false, note: '点动反转 jog rev' }], ['w', 4, '324'],
    ['c', { tag: 'KA2', pins: ['11', '12'], nc: true, note: '互锁 interlock' }], ['w', 4, '325'], ['coil', { tag: 'KA3', desc: ['点动反转', 'Jog reverse'] }]]);
  vline(s, jx[1], ya, y0); dot(s, jx[1], y0); mirror(s, 'KA3', jx[1] - 4, y0 + 4);
  ya = chain(s, jx[2], yBus, [['w', 4], ['c', { tag: 'SB7', pins: ['13', '14'], act: 'push', ref: false, note: '手动剪切 manual cut' }], ['w', 10, '341']]);
  port(s, jx[2], ya, '341', 'down');

  // servo ON
  heading(s, 204, 248, '伺服使能 Servo ON', '');
  const xs = 210;
  dot(s, xs, yR);
  y = chain(s, xs, yR, [['w', 4], ['c', { tag: 'SA1', pins: ['13', '14'], act: 'select', ref: false, note: '伺服使能 servo on' }], ['w', 6, '331'],
    ['coil', { tag: 'KA4', desc: ['伺服使能', 'Servo ON'] }]]);
  vline(s, xs, y, y0); dot(s, xs, y0); mirror(s, 'KA4', xs - 4, y0 + 4);

  // sensors
  function sensorCircuit(cx, tag, relay, desc, termBase, part, sdesc, wireNo) {
    const xc = cx + 4, xbn = cx - 5;
    dot(s, xc, yR);
    let yy = chain(s, xc, yR, [['w', 6], ['coil', { tag: relay, desc }], ['w', 8, wireNo],
      ['t', 'XT2', termBase + 2, wireNo, `${relay} A2`, `${tag} BK`, { dev: tag, label: 'right' }]]);
    vline(s, xc, yy, 106);
    dot(s, xbn, yR);
    chain(s, xbn, yR, [['w', 64], ['t', 'XT2', termBase, '24VS', '24VS', `${tag} BN`, { dev: tag }]]);
    vline(s, xbn, yR + 68.8, 106);
    s.rect(cx - 8, 106, 16, 12);
    // sensor symbol: rhombus + arrows
    s.poly([[cx, 108], [cx + 3, 112], [cx, 116], [cx - 3, 112]], 'SYM', { closed: true });
    s.line(cx - 7, 112, cx - 4.5, 113.5, 'SYM'); s.line(cx - 7, 114, cx - 4.5, 115.5, 'SYM');
    s.text(xc + 0.8, 104.8, 'BK', { size: 1.3, layer: 'PIN' });
    s.text(xbn - 0.8, 104.8, 'BN', { size: 1.3, anchor: 'end', layer: 'PIN' });
    s.text(cx + 0.8, 121, 'BU', { size: 1.3, layer: 'PIN' });
    s.text(cx + 9, 110, tag, { size: 2.4, bold: true, layer: 'TAG' });
    s.text(cx + 9, 112.6, part, { size: 1.5 });
    s.text(cx + 9, 115, sdesc[0], { size: 1.5 }); s.text(cx + 9, 117.3, sdesc[1], { size: 1.4 });
    yy = chain(s, cx, 118, [['w', 8], ['t', 'XT2', termBase + 1, '0V', '0V', `${tag} BU`, { dev: tag }]]);
    vline(s, cx, yy, y0); dot(s, cx, y0);
    mirror(s, relay, xc - 4, y0 + 4);
  }
  heading(s, 248, 248, '传感器继电器 Sensor relays', '');
  sensorCircuit(262, 'SQ3', 'KA9', ['出料超长', 'Run-out overrun'], 9, 'BR100-DDT NPN', ['出料台末端', 'Run-out end'], '332');
  sensorCircuit(318, 'SQ4', 'KA10', ['有料', 'Material present'], 12, 'PR18-8DN NPN', ['进料检测', 'Entry material'], '333');
  // notes
  heading(s, 352, 30, '说明 Notes', '');
  note(s, 352, 37, [
    '继电器 KA1~KA10:', 'JZX-22F(D)/4Z DC24V', '4 转换触点 4 C/O:', '11-12/14, 21-22/24,', '31-32/34, 41-42/44',
    '', '线圈带续流二极管', 'Coils with freewheel', 'diode (socket CZY14A)',
    '', '24VS = 24V3 经 KA0', '23-24 安全输出', '24VS = 24V3 switched', 'by KA0 23-24',
    '', 'SQ3 遮光/有料时输出', 'SQ3/SQ4 output ON', 'when material present',
  ], 1.6, 1.4);
  return s;
}

// ===== Sheet 6: relay logic 2 (servo I/O, shear, counter)
function sheet6() {
  const s = mk(6);
  const yR = 20, y0 = 232;
  rail(s, yR, 34, 334, '24VS', { port: true });
  rail(s, y0, 34, 408, '0V', { port: true });
  s.line(34, 26, 52, 26, 'WIRE', { w: 0.35 }); port(s, 34, 26, '24V2', 'left', { textAt: [36, 30.4, 'start'] });
  heading(s, 36, 248, '伺服 I/O Servo CN1', '');
  // CN1 box
  const bx = 40, by = 124, bw = 168, bh = 20;
  box(s, bx, by, bw, bh, { w: 0.45 });
  regMain('U2cn1', s, 60);
  hline(s, by + 10, 34, bx); port(s, 34, by + 10, 'CN1', 'left', { textAt: [33.5, by + 8.6, 'start'] });
  const tp = { 'COM+': [46, '11'], 'DO1+': [80, '7'], 'DO3+': [114, '3'], 'DO5+': [148, '28'] };
  const bp = { DI1: [52, '9'], DI5: [72, '33'], DI7: [92, '31'], 'DO1-': [134, '6'], 'DO3-': [156, '2'], 'DO5-': [178, '27'], 'COM-': [198, '45'] };
  for (const [n, [x, pin]] of Object.entries(tp)) { s.text(x, by + 3, n, { size: 1.5, anchor: 'middle', layer: 'PIN' }); s.text(x + 1, by - 1, pin, { size: 1.4, layer: 'PIN' }); }
  for (const [n, [x, pin]] of Object.entries(bp)) { s.text(x, by + bh - 1.4, n, { size: 1.5, anchor: 'middle', layer: 'PIN' }); s.text(x + 1, by + bh + 2.6, pin, { size: 1.4, layer: 'PIN' }); }
  s.text(98, by + 9.5, 'U2', { size: 3.0, bold: true, layer: 'TAG' });
  s.text(108, by + 9.5, 'ASD-A2-1521-L  CN1', { size: 2.0 });
  s.text(98, by + 13, '', { size: 1.5, layer: 'XREF', fn: () => `伺服驱动器 Servo drive ${ref(DEVMAIN.U2.sheet, DEVMAIN.U2.x)}` });
  s.text(140, by + 6.5, 'SRDY', { size: 1.4, anchor: 'middle' }); s.text(162, by + 6.5, 'CUT (E-CAM)', { size: 1.4, anchor: 'middle' }); s.text(181, by + 6.5, 'ALRM', { size: 1.4, anchor: 'middle' });
  s.text(52, by + 12, 'SON', { size: 1.4, anchor: 'middle' }); s.text(72, by + 12, 'ARST', { size: 1.4, anchor: 'middle' }); s.text(92, by + 12, 'CAM', { size: 1.4, anchor: 'middle' });
  hline(s, 26, 46, 52); vline(s, 46, 26, by); dot(s, 46, 26); wn(s, 46, 80, '24V2');
  const doCoil = (x, tag, desc, wire) => {
    dot(s, x, yR);
    const yy = chain(s, x, yR, [['w', 34], ['coil', { tag, desc }], ['w', 4, wire]]);
    vline(s, x, yy, by);
    mirror(s, tag, x + 10, 80, {});
  };
  doCoil(tp['DO1+'][0], 'KA5', ['伺服准备好', 'Servo ready'], '351');
  doCoil(tp['DO3+'][0], 'KA7', ['剪切信号', 'Cut command'], '352');
  doCoil(tp['DO5+'][0], 'KA6', ['伺服报警', 'Servo alarm'], '353');
  const diContact = (x, c, wire) => {
    let yy = chain(s, x, by + bh, [['w', 20, wire], ['c', c]]);
    vline(s, x, yy, y0); dot(s, x, y0);
  };
  diContact(bp.DI1[0], { tag: 'KA4', pins: ['11', '14'], note: '伺服使能' }, '354');
  diContact(bp.DI5[0], { tag: 'SB9', pins: ['23', '24'], act: 'push', ref: false, note: '报警复位' }, '355');
  diContact(bp.DI7[0], { tag: 'KA1', pins: ['31', '34'], note: '凸轮啮合' }, '356');
  for (const k of ['DO1-', 'DO3-', 'DO5-', 'COM-']) { vline(s, bp[k][0], by + bh, y0); dot(s, bp[k][0], y0); }
  wn(s, bp['COM-'][0], 200, '0V');
  note(s, 112, 172, ['DI 漏型: COM+ 接 24V，触点接 0V 有效', 'DI sink: COM+ = 24V, contact to 0V = ON', 'DO: 继电器线圈接 DO+，DO- 接 0V', 'DO: relay coil to DO+, DO- to 0V',
    '编码器 B1 → CN5 (见 /3)', 'Encoder B1 → CN5, E-CAM master'], 1.6, 1.4);

  // shear down
  heading(s, 214, 248, '剪切 Shear', '');
  const xd = 222;
  dot(s, xd, yR);
  let y = chain(s, xd, yR, [['w', 6], ['c', { tag: 'KA7', pins: ['11', '14'], note: '伺服剪切' }], ['w', 6]]);
  const yj = y;
  port(s, xd + 22, 30, '341', 'up', { textAt: [xd + 23.6, 29, 'start'] }); vline(s, xd + 22, 30, yj); hline(s, yj, xd, xd + 22); dot(s, xd, yj);
  s.text(xd + 23.5, 37, '手动剪切 SB7', { size: 1.4 }); s.text(xd + 23.5, 39.2, 'manual cut', { size: 1.4 });
  y = chain(s, xd, yj, [['w', 4, '361'], ['c', { tag: 'KA8', pins: ['11', '12'], nc: true, note: '回程 return' }], ['w', 8, '362']]);
  const yk = y;
  dot(s, xd, yk); hline(s, yk, xd, xd + 20); vline(s, xd + 20, yk, yk + 12);
  coil(s, xd + 20, yk + 12, { tag: 'KT1', kind: 'timer', desc: ['剪切超时 2s', 'H3Y-2 cut watchdog'] });
  vline(s, xd + 20, yk + 24, y0); dot(s, xd + 20, y0); mirror(s, 'KT1', xd + 16, y0 + 4);
  y = chain(s, xd, yk, [['w', 4], ['t', 'XT2', 15, '362', 'KA8 12', 'YV1 1', { dev: 'YV1' }], ['w', 2],
    ['coil', { tag: 'YV1', kind: 'valve', pins: ['1', '2'], desc: ['剪刀下行', 'Shear down'] }], ['w', 2], ['t', 'XT2', 16, '0V', '0V', 'YV1 2', { dev: 'YV1' }]]);
  vline(s, xd, y, y0); dot(s, xd, y0);
  // KA8 latch
  const xl = 268, xh = 282;
  dot(s, xl, yR); vline(s, xl, yR, 26); dot(s, xl, 26); hline(s, 26, xl, xh);
  y = chain(s, xl, 26, [['t', 'XT2', 17, '24VS', '24VS', 'SQ1 NO', { dev: 'SQ1' }], ['c', { tag: 'SQ1', pins: ['13', '14'], act: 'limit', ref: false, note: '下限 down' }],
    ['t', 'XT2', 18, '364', 'KA8 A1', 'SQ1 NO', { dev: 'SQ1' }]]);
  const yl1 = y;
  let y2 = chain(s, xh, 26, [['w', 3], ['c', { tag: 'KA8', pins: ['21', '24'], note: '' }], ['w', 3, '363'],
    ['t', 'XT2', 19, '363', 'KA8 24', 'SQ2 NC', { dev: 'SQ2', label: 'right' }], ['c', { tag: 'SQ2', pins: ['11', '12'], nc: true, act: 'limit', ref: false, note: '上限 up' }],
    ['t', 'XT2', 20, '364', 'KA8 A1', 'SQ2 NC', { dev: 'SQ2', label: 'right' }]]);
  const ym = Math.max(yl1, y2) + 4;
  vline(s, xl, yl1, ym); vline(s, xh, y2, ym); hline(s, ym, xl, xh); dot(s, xl, ym);
  y = chain(s, xl, ym, [['w', 6, '364'], ['coil', { tag: 'KA8', desc: ['剪切回程', 'Cut return'] }]]);
  vline(s, xl, y, y0); dot(s, xl, y0); mirror(s, 'KA8', xl - 4, y0 + 4);
  // YV2
  const xu = 310;
  dot(s, xu, yR);
  y = chain(s, xu, yR, [['w', 6], ['c', { tag: 'KA8', pins: ['31', '34'], note: '' }], ['w', 8, '365'], ['t', 'XT2', 21, '365', 'KA8 34', 'YV2 1', { dev: 'YV2' }], ['w', 2],
    ['coil', { tag: 'YV2', kind: 'valve', pins: ['1', '2'], desc: ['剪刀上行', 'Shear up'] }], ['w', 2], ['t', 'XT2', 22, '0V', '0V', 'YV2 2', { dev: 'YV2' }]]);
  vline(s, xu, y, y0); dot(s, xu, y0);
  note(s, 290, 176, ['YV1/YV2: 华德 Huade', '4WE6E61B/CG24N9Z5L', '双电控 double sol. 24VDC', 'a=下 down, b=上 up'], 1.5, 1.4);

  // counter
  heading(s, 342, 248, '批量计数 Batch counter', '');
  const cx0 = 346, cy = 124;
  box(s, cx0, cy, 60, 20, { w: 0.45 });
  regMain('H7CX', s, 370);
  const cp = { '+': 350, '0V': 360, CP1: 374, RST: 392 };
  s.text(cp['+'], cy + 3, '+24V', { size: 1.4, anchor: 'middle', layer: 'PIN' });
  for (const k of ['0V', 'CP1', 'RST']) s.text(cp[k], cy + 18.6, k, { size: 1.4, anchor: 'middle', layer: 'PIN' });
  s.text(358, cy + 8.5, 'H7CX', { size: 2.8, bold: true, layer: 'TAG' });
  s.text(358, cy + 11.5, 'Omron H7CX-A4D', { size: 1.6 }); s.text(358, cy + 13.8, '批量计数器 Batch counter', { size: 1.4 });
  port(s, cp['+'], 34, '24V1', 'up'); vline(s, cp['+'], 34, cy);
  vline(s, cp['0V'], cy + 20, y0); dot(s, cp['0V'], y0);
  y = chain(s, cp.CP1, cy + 20, [['w', 22, '371'], ['c', { tag: 'KA8', pins: ['41', '44'], note: '计数 count' }]]);
  vline(s, cp.CP1, y, y0); dot(s, cp.CP1, y0);
  y = chain(s, cp.RST, cy + 20, [['w', 22, '372'], ['c', { tag: 'SB8', pins: ['13', '14'], act: 'push', ref: false, note: '计数复位' }]]);
  vline(s, cp.RST, y, y0); dot(s, cp.RST, y0);
  mirror(s, 'H7CX', 384, 104, { title: 'H7CX OUT' });
  note(s, 346, 48, ['输入方式 无电压 (NPN)', 'Input: no-voltage (NPN)', '模式 Mode: 加计数 UP,', '到预置值 OUT 保持', 'OUT held at preset', '预置 = 批量根数', 'Preset = pieces/batch'], 1.5, 1.4);
  return s;
}

// ===== Sheet 1: cover
function sheet1() {
  const s = mk(1);
  const M = D.META;
  s.text(36, 24, M.companyCn, { size: 5.0, bold: true });
  s.text(36, 30, M.companyEn, { size: 3.0 });
  s.line(36, 33, 205, 33, 'NOTE', { w: 0.5 });
  s.text(36, 43, M.projectCn, { size: 5.2, bold: true });
  s.text(36, 49.5, M.projectEn, { size: 3.2 });
  s.text(36, 58, '电气原理图  ELECTRICAL SCHEMATIC', { size: 4.0, bold: true });
  s.text(36, 64, `图号 Drawing No. ${M.dwgNo}   版本 Rev. ${M.rev}   日期 Date ${M.date}`, { size: 2.4 });
  heading(s, 36, 74, '设备说明', 'Machine description');
  let y = 82;
  for (const l of wrap(M.machineCn, 168, 2.0)) { s.text(36, y, l, { size: 2.0 }); y += 2.9; }
  y += 1.5;
  for (const l of wrap(M.machineEn, 168, 1.8)) { s.text(36, y, l, { size: 1.8 }); y += 2.55; }
  y += 3;
  heading(s, 36, y, '技术参数', 'Technical data'); y += 6;
  const td = [
    ['项目 Item', '参数 Value'],
    ['电源 Supply', '3~ 380 V + N + PE, 50 Hz, TN-S; 进线 cable 5×10 mm²'],
    ['主开关 Main switch', 'QF0 NH2-125 4P 40A; 上级保护 upstream protection ≤ 40 A'],
    ['装机功率 Installed power', '9.2 kW (M1 5.5 kW + M2 2.2 kW + M3 1.5 kW)'],
    ['最大相电流 Max. phase current', '≈ 28 A (L3)'],
    ['短路分断 Breaking capacity', '6 kA (NXB-63 MCB)'],
    ['交流控制 AC control', '220 VAC (L2-N, QF5) — 液压泵接触器 pump contactor KM1'],
    ['直流控制 DC control', '24 VDC, G1 NDR-120-24 5 A; 0V 接 PE (0V bonded to PE)'],
    ['伺服电源 Servo supply', '220 VAC 1~ (L3-N, QF3)'],
    ['控制方式 Control', '继电器逻辑，无 PLC / hard-wired relay logic, no PLC'],
    ['追剪 Flying shear', '伺服 E-CAM, 编码器 B1 1000 P/R, 测长轮 wheel 200 mm'],
    ['剪切小车 Shear carriage', '丝杠导程 ball screw lead 20 mm, 行程 stroke 500 mm'],
    ['剪切长度/线速 Cut length / speed', '300-6000 mm; 最高线速 max. line speed 30 m/min'],
    ['安全 Safety', 'PNOZ s3, PL d / Cat.3, 停止类别 stop category 0'],
    ['防护等级 Enclosure', 'IP54, 环境温度 ambient 0-40 °C'],
  ];
  table(s, 36, y, [52, 118], td, { rowH: 5.6, size: 1.9, header: true });
  // right column
  heading(s, 214, 20, '图纸目录', 'Drawing index');
  table(s, 214, 26, [16, 74, 106], [['页 Sheet', '图名 (中文)', 'Title (English)'], ...D.SHEETS.map((q) => [String(q.no), q.cn, q.en])],
    { rowH: 5.6, size: 2.0, header: true, center: { 0: true } });
  heading(s, 214, 84, '导线规格及颜色', 'Wire sizes & colours');
  table(s, 214, 90, [36, 46, 70, 44], [['用途', 'Use', '截面/颜色 Size / colour', '型号 Type'], ...D.WIRE_NOTES], { rowH: 5.2, size: 1.9, header: true });
  heading(s, 214, 149, '控制说明', 'Control notes');
  y = 156;
  for (let i = 0; i < D.CONTROL_NOTES_CN.length; i++) {
    for (const l of wrap(D.CONTROL_NOTES_CN[i], 196, 1.75)) { s.text(214, y, l, { size: 1.75 }); y += 2.5; }
    for (const l of wrap(D.CONTROL_NOTES_EN[i], 196, 1.6)) { s.text(214, y, l, { size: 1.6 }); y += 2.3; }
    y += 0.8;
  }
  y += 2;
  heading(s, 214, y, '图例及约定', 'Conventions'); y += 7;
  note(s, 214, y, [
    '交叉索引 "/页.列"，如 /5.1 = 第 5 页第 1 列。Cross-reference "/sheet.column", e.g. /5.1 = sheet 5, column 1.',
    '线圈下方列出触点位置 (NO 常开 / NC 常闭)。Contact mirror below each coil (NO / NC).',
    '端子标注 XT2:5 = 端子排 XT2 第 5 号。Terminal XT2:5 = strip XT2, terminal 5.',
    '代号按 GB/T 5094 / IEC 81346 字母码: QF 断路器, KM 接触器, FR 热继, KA 继电器, KT 时间继电器,',
    'SB 按钮, SA 选择开关, SQ 限位/传感器, YV 电磁阀, HL 指示灯, U 变频/伺服, B 编码器, XT 端子。',
  ], 1.6, 1.45);
  return s;
}

// ===== Sheet 7: terminal list
function sheet7() {
  const s = mk(7);
  const order = { XT0: 0, XT1: 1, XT2: 2 };
  const rows = TERMS.slice().sort((a, b) => order[a.strip] - order[b.strip] || a.no - b.no);
  const head = ['端子排\nStrip', '号\nNo.', '线号\nWire', '柜内 Internal', '现场 External', 'mm²', '位置\nRef.'];
  const widths = [15, 9, 13, 42, 66, 11, 15];
  const half = Math.ceil(rows.length / 2);
  const toRow = (t) => [t.strip, String(t.no), t.wire, t.internal, t.external, t.size, `/${t.sheet}.${t.col}`];
  heading(s, 36, 18, '端子表', 'Terminal list (XT0 电源 supply, XT1 电机 motors, XT2 控制现场 field control)');
  table(s, 36, 26, widths, [head, ...rows.slice(0, half).map(toRow)], { rowH: 6.2, size: 2.0, header: true, center: { 1: true, 5: true } });
  table(s, 36 + 177 + 8, 26, widths, [head, ...rows.slice(half).map(toRow)], { rowH: 6.2, size: 2.0, header: true, center: { 1: true, 5: true } });
  note(s, 222, 26 + 6.2 * (rows.length - half + 1) + 8, [
    '端子型号 Terminal types: XT0 Phoenix UK 10 N / USLKG 10 N (PE);',
    'XT1 Phoenix UK 5 N / USLKG 5 (PE); XT2 CHNT JF5-2.5/5.',
    '操作台按钮/指示灯直接接线，不经端子。',
    'Console pushbuttons / lamps are wired direct (no terminals).',
    '编码器 B1、伺服电机电缆经航空插头直连驱动器。',
    'Encoder B1 and servo cables plug directly into U2.',
  ], 1.8, 1.45);
  return s;
}

// ===== Sheet 8: BOM
function sheet8() {
  const s = mk(8);
  heading(s, 36, 17, '元件清单', 'Bill of materials');
  const head = ['序号\nItem', '代号\nTag', '名称规格 (中文)', 'Description (English)', '型号 Part number', '品牌 Maker', '数量\nQty', '类别 Category'];
  const rows = D.PARTS.map((p, i) => [String(i + 1), p[0], p[3], p[4], p[2], p[1], String(p[5]), p[6]]);
  table(s, 36, 22, [11, 22, 74, 90, 64, 36, 12, 28], [head, ...rows], { rowH: 5.2, size: 2.0, header: true, center: { 0: true, 6: true } });
  return s;
}

// ---------------------------------------------------------------- build all
sheet1(); sheet2(); sheet3(); sheet4(); sheet5(); sheet6();
for (const s of sheets) s.resolve();
sheet7(); sheet8();
sheets.sort((a, b) => a.no - b.no);
for (const s of sheets) { frame(s); s.resolve(); }

// sanity checks: every port has a partner, every xref resolves
const problems = [];
for (const [n, l] of Object.entries(PORTS)) if (new Set(l.map((p) => p.sheet)).size < 2) problems.push(`port ${n} only on sheet ${l[0].sheet}`);
for (const [t, l] of Object.entries(DEVREFS)) if (!DEVMAIN[t]) problems.push(`no main symbol for ${t} (refs on ${l.map((r) => r.sheet)})`);
for (const s of sheets) for (const it of s.items) if (it.t === 'text' && /undefined|NaN/.test(it.s)) problems.push(`bad text on sheet ${s.no}: ${it.s}`);
if (problems.length) { console.error('PROBLEMS:\n' + problems.join('\n')); process.exitCode = 2; }

// ---------------------------------------------------------------- SVG / HTML / PDF
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const f = (n) => Math.round(n * 1000) / 1000;
function toSvg(s) {
  const out = [];
  for (const it of s.items) {
    const sw = it.w ?? (it.layer === 'WIRE' ? SW.wire : it.layer === 'FRAME' ? 0.35 : SW.sym);
    const dash = it.dash ? ` stroke-dasharray="${it.dash}"` : '';
    if (it.t === 'line') out.push(`<line x1="${f(it.x1)}" y1="${f(it.y1)}" x2="${f(it.x2)}" y2="${f(it.y2)}" stroke-width="${sw}"${dash}/>`);
    else if (it.t === 'poly') out.push(`<${it.closed ? 'polygon' : 'polyline'} points="${it.pts.map((p) => `${f(p[0])},${f(p[1])}`).join(' ')}" fill="${it.fill || 'none'}" stroke-width="${sw}"${dash}/>`);
    else if (it.t === 'rect') out.push(`<rect x="${f(it.x)}" y="${f(it.y)}" width="${f(it.wd)}" height="${f(it.ht)}" fill="${it.fill || 'none'}" stroke-width="${sw}"${dash}/>`);
    else if (it.t === 'circle') out.push(`<circle cx="${f(it.cx)}" cy="${f(it.cy)}" r="${f(it.r)}" fill="${it.fill || 'none'}" stroke-width="${sw}"/>`);
    else if (it.t === 'arc') {
      const a1 = (it.a1 * Math.PI) / 180, a2 = (it.a2 * Math.PI) / 180;
      const sx = it.cx + it.r * Math.cos(a1), sy = it.cy + it.r * Math.sin(a1), ex = it.cx + it.r * Math.cos(a2), ey = it.cy + it.r * Math.sin(a2);
      out.push(`<path d="M${f(sx)} ${f(sy)} A${f(it.r)} ${f(it.r)} 0 ${it.a2 - it.a1 > 180 ? 1 : 0} 1 ${f(ex)} ${f(ey)}" fill="none" stroke-width="${sw}"/>`);
    } else if (it.t === 'text') {
      if (!it.s) continue;
      const tr = it.rot ? ` transform="rotate(${it.rot} ${f(it.x)} ${f(it.y)})"` : '';
      out.push(`<text x="${f(it.x)}" y="${f(it.y)}" font-size="${f(it.size)}"${it.bold ? ' font-weight="bold"' : ''}${it.anchor !== 'start' ? ` text-anchor="${it.anchor}"` : ''}${tr}>${esc(it.s)}</text>`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="420mm" height="297mm" viewBox="0 0 ${W} ${H}">` +
    `<g stroke="#000" stroke-linecap="round" fill="none">${out.filter((l) => !l.startsWith('<text')).join('')}</g>` +
    `<g fill="#000" font-family="${FONT.replace(/"/g, '')}">${out.filter((l) => l.startsWith('<text')).join('')}</g></svg>`;
}
const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(D.META.dwgNo)} ${esc(D.META.projectEn)}</title>
<style>@page{size:420mm 297mm;margin:0}html,body{margin:0;padding:0;background:#fff}
.sheet{width:420mm;height:297mm;overflow:hidden;page-break-after:always;break-after:page}
.sheet:last-child{page-break-after:auto;break-after:auto}svg{display:block}</style></head><body>
${sheets.map((s) => `<div class="sheet">${toSvg(s)}</div>`).join('\n')}
</body></html>`;
fs.writeFileSync(path.join(BUILD, 'drawings.html'), html);

process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/opt/pw-browsers';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('file://' + path.join(BUILD, 'drawings.html'));
await page.evaluate(() => document.fonts.ready);
await page.pdf({ path: path.join(OUT, 'drawings.pdf'), width: '420mm', height: '297mm', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
await browser.close();

// ---------------------------------------------------------------- geometry for DXF
const DXF_SHEETS = [2, 3, 5, 6];
fs.writeFileSync(path.join(BUILD, 'geometry.json'), JSON.stringify({
  title: `${D.META.dwgNo} ${D.META.projectEn}`,
  sheets: sheets.filter((s) => DXF_SHEETS.includes(s.no)).map((s) => ({ no: s.no, cn: s.cn, en: s.en, items: s.items.map(({ fn, ...r }) => r) })),
}));

// ---------------------------------------------------------------- expected.json
const termsOf = (tag) => TERMS.filter((t) => t.dev === tag).map((t) => `${t.strip}:${t.no}`);
const expected = {
  fixture: 'cn-rollformer-01',
  sourceFiles: ['drawings.pdf', 'drawings-scan.pdf', 'drawings.dxf'],
  format: 'Chinese electrical schematic set, 8 A3 landscape sheets, bilingual (Chinese/English) title block, IEC 60617 symbols, ' +
    'GB/IEC device letter codes, /sheet.column cross-references. drawings.pdf = vector with selectable text; drawings-scan.pdf = same sheets ' +
    'as 150 dpi grey images, skewed and noisy (no text layer); drawings.dxf = sheets 2, 3, 5, 6 (power + relay control) in model space.',
  drawingNumber: D.META.dwgNo,
  revision: D.META.rev,
  date: D.META.date,
  maker: D.META.companyEn + ' / ' + D.META.companyCn,
  project: D.META.projectEn + ' / ' + D.META.projectCn,
  standards: ['GB/T 5226.1-2019 (IEC 60204-1)', 'GB/T 16855.1-2018 (ISO 13849-1)'],
  sheets: D.SHEETS.map((q) => ({ no: q.no, titleCn: q.cn, title: q.en, inDxf: DXF_SHEETS.includes(q.no) })),
  machine: D.META.machineEn,
  machineCn: D.META.machineCn,
  supply: D.SUPPLY,
  hasPlc: false,
  motors: D.MOTORS.map((m) => ({
    tag: m.tag, description: m.en, descriptionCn: m.cn, kW: m.kW, V: m.V, Hz: m.Hz, A: m.A, rpm: m.rpm, starter: m.starter,
    motorModel: `${m.maker.split(' ')[0]} ${m.model}`, starterTags: m.starterTags, partNumbers: m.partNumbers,
    ...(m.overloadSettingA ? { overloadSettingA: m.overloadSettingA } : {}),
  })),
  signals: D.SIGNALS.map(([tag, device, kind, contact, cn, en, drives]) => ({
    tag, device, kind, contact, description: en, descriptionCn: cn, function: drives, terminals: termsOf(tag),
  })),
  relays: Object.entries(D.RELAYS).map(([tag, [cn, en]]) => ({
    tag, description: en, descriptionCn: cn,
    contacts: (DEVREFS[tag] || []).map((r) => ({ pins: r.pins, type: r.nc ? 'NC' : 'NO', sheet: r.sheet, column: col(r.x) })),
    coil: DEVMAIN[tag] ? { sheet: DEVMAIN[tag].sheet, column: col(DEVMAIN[tag].x) } : null,
  })),
  relayLogic: D.RELAY_LOGIC.map(([id, coilTag, sheet, cn, en]) => ({ id, coil: coilTag, sheet, description: en, descriptionCn: cn })),
  motion: D.MOTION,
  parts: D.PARTS.map(([tag, maker, partNumber, cn, en, qty, category]) => ({ tag, maker, partNumber, description: en, descriptionCn: cn, qty, category })),
  safety: D.SAFETY,
  interlocks: D.INTERLOCKS,
  terminals: TERMS.slice().sort((a, b) => a.strip.localeCompare(b.strip) || a.no - b.no)
    .map((t) => ({ strip: t.strip, no: t.no, wire: t.wire, internal: t.internal, external: t.external, mm2: t.size, sheet: t.sheet, column: t.col })),
  crossSheetConnections: Object.entries(PORTS).map(([name, l]) => ({ name, at: [...new Set(l.map((p) => ref(p.sheet, p.x)))] })),
  naNotes: D.NA_NOTES,
};
fs.writeFileSync(path.join(OUT, 'expected.json'), JSON.stringify(expected, null, 2) + '\n');
console.log(`sheets: ${sheets.length}, terminals: ${TERMS.length}, ports: ${Object.keys(PORTS).length}, build dir: ${BUILD}`);
