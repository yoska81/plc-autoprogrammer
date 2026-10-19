/** Cover, notes, terminal plan and bill of materials sheets (tabular). */
import { WIRE_NUMBERING_NOTES, codeRefs, ratingText, supplyText } from '../../derive';
import { renameWire } from '../../ioNames';
import { AREA, AREA_B, AREA_R, LW, LW_HEAVY, LW_THIN, wrapText } from '../geometry';
import { TERM_ROWS, type DrawingPlan, type PlannedSheet, type SheetSpec } from '../plan';
import { Line, Txt } from '../symbols';
import { isIec, NEMA_TO_IP, SUPPLY_INFO } from '../../../standards/regions';
import { IEC_WIRE_COLORS, iecCoverNotes } from '../../../standards/iecText';
import { stripTag } from '../../../standards/designations';

const WIRE_COLORS: [string, string][] = [
  ['BK  BLACK', 'AC/DC power circuits — line and load (ungrounded)'],
  ['RD  RED', 'AC control circuits (120VAC, only if used)'],
  ['BU  BLUE', 'DC control circuits (+24VDC, 24+ / 24+S, I/O)'],
  ['WH/BU  WHITE/BLUE', 'DC grounded control conductor (0V)'],
  ['WH  WHITE', 'AC grounded neutral conductor'],
  ['GN/YE  GREEN/YELLOW', 'Protective earth (PE) — equipment grounding'],
  ['OG  ORANGE', 'Foreign voltage: circuits that stay live with DS off'],
];

function Para({ x, y, w, lines, size = 2.5, gap = 1.25, bold }: { x: number; y: number; w: number; lines: string[]; size?: number; gap?: number; bold?: boolean }) {
  return <g>{lines.map((l, i) => <Txt key={i} x={x} y={y + i * size * gap} size={size} maxW={w} bold={bold}>{l}</Txt>)}</g>;
}

/** Numbered note list with wrapping; returns rows used via the y offsets it renders. */
function NoteList({ x, y, w, items, size = 2.5, maxY }: { x: number; y: number; w: number; items: string[]; size?: number; maxY: number }) {
  const out: { n: string; l: string; y: number }[] = [];
  let yy = y;
  let cut = 0;
  items.forEach((it, i) => {
    const lines = wrapText(it, w - 8, size);
    if (yy + lines.length * size * 1.3 > maxY) { cut++; return; }
    lines.forEach((l, k) => out.push({ n: k === 0 ? `${i + 1}.` : '', l, y: yy + k * size * 1.3 }));
    yy += lines.length * size * 1.3 + size * 0.5;
  });
  return (
    <g>
      {out.map((o, i) => <g key={i}><Txt x={x} y={o.y} size={size} bold>{o.n}</Txt><Txt x={x + 7} y={o.y} size={size} maxW={w - 8}>{o.l}</Txt></g>)}
      {cut > 0 && <Txt x={x + 7} y={Math.min(yy, maxY)} size={size} italic>{`+${cut} more item(s) — see the Electrical page in the app.`}</Txt>}
    </g>
  );
}

export function CoverSheet({ plan }: { plan: DrawingPlan; sheet: PlannedSheet }) {
  const { ctx, model } = plan;
  const inp = ctx.design.inputs;
  const x0 = AREA.x + 10;
  const RX = 222;
  const W = AREA_R - RX - 4;
  const codes = codeRefs(ctx);
  const hasFuses = model.rc.some((c) => c.category === 'fuse');
  const hasCb = model.rc.some((c) => c.category === 'breaker');
  const protText = hasFuses && !hasCb ? 'FUSES (CLASS PER FUSE HOLDER), SPARE FUSES TO BE SUPPLIED' : hasFuses ? 'CIRCUIT BREAKERS AND FUSES' : 'CIRCUIT BREAKERS';
  const iec = isIec(ctx.region);
  const colors = iec ? IEC_WIRE_COLORS : WIRE_COLORS;
  const notes = iec ? iecCoverNotes(ctx.region, {
    supply: supplyText(inp.supply), threePhase: model.phases === 3, neutral: SUPPLY_INFO[inp.supply].neutral, disconnect: model.disconnect?.tag ?? '(NOT SPECIFIED)',
    supplies: model.psBranches.map((b) => b.ps.tag).join(', ') || 'POWER SUPPLY', enclosure: `${NEMA_TO_IP[inp.enclosureRating] ?? inp.enclosureRating} (≈ ${inp.enclosureRating})`,
    protection: hasFuses && !hasCb ? 'FUSES (gG / aM)' : hasFuses ? 'MINIATURE CIRCUIT BREAKERS AND FUSES' : 'MINIATURE CIRCUIT BREAKERS (MCB)',
    transformer: model.transformer ? `${model.transformer.tag} (${ratingText(model.transformer)})` : null,
  }) : [
    `SUPPLY: ${supplyText(inp.supply)}${model.phases === 3 ? ', 3-WIRE + PE' : ', L1 + N + PE'}. MAIN DISCONNECT ${model.disconnect?.tag ?? '(NOT SPECIFIED)'} LOCKABLE IN OFF POSITION.`,
    `CONTROL VOLTAGE: 24VDC FROM ${model.psBranches.map((b) => b.ps.tag).join(', ') || 'POWER SUPPLY'}. 0V IS A GROUNDED CONDUCTOR, BONDED TO PE AT ONE POINT (NFPA 79 9.4.3).`,
    `ENCLOSURE: ${inp.enclosureRating}. CONTROL PANEL TO BE BUILT AND LABELED PER ${codes.panel}${codes.region === 'Canada' ? ' (CSA/cUL CERTIFIED)' : ''}; MARK SCCR, SUPPLY VOLTAGE, FLA OF LARGEST MOTOR AND FULL-LOAD CURRENT ON THE NAMEPLATE.`,
    codes.region === 'Canada'
      ? 'INSTALLATION PER CANADIAN ELECTRICAL CODE (CSA C22.1), MOTOR BRANCH CIRCUITS PER CEC SECTION 28; MACHINE ELECTRICAL EQUIPMENT PER NFPA 79 / CSA C22.2 No. 14 AS APPLICABLE.'
      : 'INSTALLATION PER NEC (NFPA 70) ARTICLES 409 / 430 / 670; INDUSTRIAL MACHINERY PER NFPA 79.',
    `BRANCH PROTECTION: ${protText}.${model.transformer ? ` CONTROL POWER VIA TRANSFORMER ${model.transformer.tag} (${ratingText(model.transformer)}), X2 GROUNDED.` : ''}`,
    'ALL WIRING 600V, 90°C MTW/TEW/SIS COPPER (NFPA 79 CH. 12). POWER CONDUCTORS SIZED PER MOTOR SHEETS; CONTROL 18 AWG MIN., I/O 18 AWG MIN. UNLESS NOTED.',
    'EVERY CONDUCTOR IDENTIFIED AT BOTH ENDS WITH ITS WIRE NUMBER (NFPA 79 13.2.1). ONE WIRE NUMBER PER ELECTRICALLY COMMON POTENTIAL; SUFFIX LETTER AFTER EACH SERIES DEVICE.',
    'FIELD WIRING VIA TERMINAL STRIPS TB2 (INPUTS) / TB3 (OUTPUTS); MOTOR LEADS VIA TB1. ~15% SPARE TERMINALS PROVIDED.',
    `E-STOP IS STOP CATEGORY 0 VIA SAFETY RELAY REMOVING 24+S FROM ${model.groups.some((g) => g.type === 'output' && g.outputStyle === 'sinking') ? 'THE OUTPUT LOADS (SINKING OUTPUTS: EACH LOAD IS FED FROM 24+S AND SWITCHED TO 0V BY THE PLC)' : 'THE PLC OUTPUT SUPPLY'}; PERFORM RISK ASSESSMENT AND VALIDATE (ISO 13849-1 / NFPA 79 9.2.5.4).`,
    'LINE REFERENCES "SHEET.LINE": "/4.05" = SHEET 4, LINE 05. CONTACT LISTS UNDER EACH COIL; "TO" / "FROM" ARROWS FOR CONTINUATIONS. SYMBOLS, ABBREVIATIONS AND DEVICE TAGS (NFPA 79 ANNEX D) ON SHEET 2.',
    'THIS DRAWING SET IS AI-GENERATED. ALL PARTS, RATINGS, WIRE SIZES AND LAYOUT MUST BE CHECKED AND APPROVED BY A QUALIFIED ENGINEER BEFORE PURCHASE, BUILD OR USE.',
  ];
  type IdxRow = { head: string } | { sheet: (typeof plan.sheets)[number] };
  const idxRows: IdxRow[] = [];
  for (const [sec, head] of [['cover', ''], ['cabinet', 'CABINET WIRING'], ['machine', 'MACHINE WIRING']] as const) {
    const list = plan.sheets.filter((x) => x.section === sec);
    if (!list.length) continue;
    if (head) idxRows.push({ head });
    for (const sh of list) idxRows.push({ sheet: sh });
  }
  const noteH = notes.reduce((h, n) => h + wrapText(n, W - 8, 2.4).length * 2.4 * 1.3 + 1.2, 0);
  const cy = AREA.y + 15 + noteH + 6;
  const ny = cy + 5.5 + colors.length * 3.6 + 5;
  const numLines: { text: string; y: number; bullet: boolean }[] = [];
  let yy = ny + 5.5;
  // the examples in the PLC's own naming (I0.0 / Q0.0 on an S7)
  const ex = (a: string) => renameWire(model.ioNames, a);
  for (const n of WIRE_NUMBERING_NOTES.map((t) => t.replace(/\bY001A\b/g, ex('Y001A')).replace(/\bX001\b/g, ex('X001')).replace(/\bY001\b/g, ex('Y001')))) {
    wrapText(n, W - 4, 2.3).forEach((t, k) => { numLines.push({ text: t, y: yy, bullet: k === 0 }); yy += 3.1; });
    yy += 0.8;
  }
  const IY = 96;
  const rowH = Math.min(4.6, (AREA_B - 4 - (IY + 6)) / Math.max(1, idxRows.length));
  const rs = plan.doc.rs;
  const d = plan.doc;
  const projRows: [string, string][] = [['CUSTOMER', d.customer.toUpperCase()], ['SITE', d.site.toUpperCase()], ['PROJECT NO.', d.projectNumber.toUpperCase()], ['ENGINEERING', d.company.toUpperCase()]];
  // revision history block (bottom of the right column)
  const hist = rs.revisions.length ? rs.revisions : [{ rev: rs.rev, date: '', description: 'PRELIMINARY — NOT YET ISSUED', by: '' }];
  const histH = 15 + hist.length * 3.8;
  const HY = Math.max(yy + 6, AREA_B - 3 - histH);
  return (
    <g>
      <Txt x={x0} y={AREA.y + 18} size={7} bold maxW={RX - x0 - 10}>{ctx.projectName.toUpperCase() || 'UNTITLED PROJECT'}</Txt>
      <Txt x={x0} y={AREA.y + 27} size={4.2}>ELECTRICAL CONTROL PANEL — DRAWING SET</Txt>
      <Txt x={x0} y={AREA.y + 34} size={2.8}>{`${supplyText(inp.supply)}  •  24VDC CONTROL  •  ${iec ? `${NEMA_TO_IP[inp.enclosureRating] ?? inp.enclosureRating}` : inp.enclosureRating}  •  ${model.motors.length} MOTOR${model.motors.length === 1 ? '' : 'S'}`}</Txt>
      <Txt x={x0} y={AREA.y + 39} size={2.8} maxW={RX - x0 - 10}>{`PLC: ${ctx.plc.vendor} ${ctx.plc.name} — ${ctx.plc.cpuLabel}`}</Txt>
      <Txt x={x0} y={AREA.y + 44} size={2.8}>{`I/O: ${model.io.filter((p) => p.type === 'input').length} INPUTS, ${model.io.filter((p) => p.type === 'output').length} OUTPUTS   •   ${rs.revisions.length ? `REV ${rs.rev} ${rs.date}` : `REV ${rs.rev} — NOT YET ISSUED`}   •   ${plan.sheets.length} SHEETS`}</Txt>
      {/* project data */}
      {projRows.map(([k, v], i) => (
        <g key={k}>
          <Txt x={x0 + (i % 2) * 100} y={AREA.y + 50 + Math.floor(i / 2) * 4.2} size={2.2} bold>{k}</Txt>
          <Txt x={x0 + (i % 2) * 100 + 26} y={AREA.y + 50 + Math.floor(i / 2) * 4.2} size={2.3} maxW={72}>{v || '—'}</Txt>
        </g>
      ))}
      <rect x={x0} y={AREA.y + 56} width={RX - x0 - 10} height={16} strokeWidth={0.8} />
      {rs.preliminary && <rect x={x0 + 1} y={AREA.y + 57} width={RX - x0 - 12} height={14} strokeWidth={LW_THIN} />}
      <Txt x={x0 + 4} y={AREA.y + 62.5} size={3.4} bold>{rs.preliminary ? 'AI-GENERATED — PRELIMINARY, NOT FOR CONSTRUCTION' : `${rs.status} — REV ${rs.rev}`}</Txt>
      <Para x={x0 + 4} y={AREA.y + 67} w={RX - x0 - 18} size={2.3} lines={wrapText('Generated by ISA Auto Programmer. Must be checked and approved by a qualified engineer before use. Part numbers, ratings, dimensions and wire sizes are suggestions only.', RX - x0 - 18, 2.3)} />

      {/* drawing index */}
      <Txt x={x0} y={IY - 5} size={3.2} bold>DRAWING INDEX</Txt>
      <Line x1={x0} y1={IY - 3} x2={RX - 10} y2={IY - 3} w={LW} />
      <Txt x={x0} y={IY + 0.6} size={2.3} bold>SHEET</Txt>
      <Txt x={x0 + 16} y={IY + 0.6} size={2.3} bold>DRAWING NO.</Txt>
      <Txt x={x0 + 46} y={IY + 0.6} size={2.3} bold>TITLE</Txt>
      <Txt x={RX - 12} y={IY + 0.6} size={2.3} bold anchor="end">REV</Txt>
      <Line x1={x0} y1={IY + 2} x2={RX - 10} y2={IY + 2} w={LW_THIN} />
      {idxRows.map((r, i) => ('head' in r ? (
        <g key={`h${i}`}>
          <Txt x={x0} y={IY + 6 + i * rowH} size={2.5} bold>{r.head}</Txt>
          <Line x1={x0 + 32} y1={IY + 5 + i * rowH} x2={RX - 10} y2={IY + 5 + i * rowH} w={LW_THIN} />
        </g>
      ) : (
        <g key={r.sheet.n}>
          <Txt x={x0 + 5} y={IY + 6 + i * rowH} size={2.4} mono anchor="middle">{r.sheet.n}</Txt>
          <Txt x={x0 + 16} y={IY + 6 + i * rowH} size={2.4} mono>{r.sheet.drawingNo}</Txt>
          <Txt x={x0 + 46} y={IY + 6 + i * rowH} size={2.4} maxW={RX - x0 - 72}>{r.sheet.title}</Txt>
          <Txt x={RX - 15} y={IY + 6 + i * rowH} size={2.4} mono bold anchor="middle">{r.sheet.rev}</Txt>
        </g>
      )))}

      {/* general notes */}
      <Line x1={RX - 4} y1={AREA.y + 4} x2={RX - 4} y2={AREA_B - 4} w={LW_THIN} />
      <Txt x={RX} y={AREA.y + 9} size={3.2} bold>GENERAL NOTES</Txt>
      <NoteList x={RX} y={AREA.y + 15} w={W} items={notes} size={2.4} maxY={AREA_B} />
      <Txt x={RX} y={cy} size={3} bold>{iec ? 'CONDUCTOR COLOURS (IEC 60204-1 13.2)' : 'WIRE COLORS (NFPA 79 13.2.4)'}</Txt>
      {colors.map(([c, d], i) => (
        <g key={c}>
          <Txt x={RX} y={cy + 5.5 + i * 3.6} size={2.3} mono bold>{c}</Txt>
          <Txt x={RX + 42} y={cy + 5.5 + i * 3.6} size={2.3} maxW={W - 42}>{d}</Txt>
        </g>
      ))}
      <Txt x={RX} y={ny} size={3} bold>WIRE NUMBERING</Txt>
      {numLines.map((l, i) => (
        <g key={i}>
          {l.bullet && <Txt x={RX} y={l.y} size={2.3}>•</Txt>}
          <Txt x={RX + 3} y={l.y} size={2.3} maxW={W - 4}>{l.text}</Txt>
        </g>
      ))}
      {/* revision history */}
      <Txt x={RX} y={HY + 3} size={3} bold>REVISION HISTORY</Txt>
      <rect x={RX} y={HY + 5} width={W} height={histH - 7} strokeWidth={LW} />
      {['REV', 'DATE', 'DESCRIPTION', 'BY'].map((h, i) => <Txt key={h} x={RX + [1.5, 12, 34, W - 24][i]} y={HY + 8.6} size={2.1} bold>{h}</Txt>)}
      <Line x1={RX} y1={HY + 9.8} x2={RX + W} y2={HY + 9.8} w={LW_THIN} />
      {[10.5, 32, W - 25.5].map((c) => <Line key={c} x1={RX + c} y1={HY + 5} x2={RX + c} y2={HY + histH - 2} w={LW_THIN} />)}
      {hist.map((h, i) => (
        <g key={i}>
          <Txt x={RX + 5.2} y={HY + 13 + i * 3.8} size={2.2} mono bold anchor="middle">{h.rev}</Txt>
          <Txt x={RX + 12} y={HY + 13 + i * 3.8} size={2.1} mono>{h.date}</Txt>
          <Txt x={RX + 34} y={HY + 13 + i * 3.8} size={2.1} maxW={W - 61}>{(h.description ?? '').toUpperCase()}</Txt>
          <Txt x={RX + W - 24} y={HY + 13 + i * 3.8} size={2.1} maxW={22}>{(h.by ?? '').toUpperCase()}</Txt>
        </g>
      ))}
    </g>
  );
}

export function NotesSheet({ plan, sheet }: { plan: DrawingPlan; sheet: PlannedSheet }) {
  const sp = sheet.spec as Extract<SheetSpec, { kind: 'notes' }>;
  const half = (AREA.w - 30) / 2;
  const x1 = AREA.x + 8, x2 = x1 + half + 14;
  return (
    <g>
      <Txt x={x1} y={AREA.y + 9} size={3.2} bold>DESIGN NOTES & ASSUMPTIONS</Txt>
      <Line x1={x1} y1={AREA.y + 11.5} x2={x1 + half} y2={AREA.y + 11.5} w={LW} />
      {sp.notes.length
        ? <NoteList x={x1} y={AREA.y + 17} w={half} items={sp.notes} maxY={AREA_B - 6} />
        : <Txt x={x1} y={AREA.y + 17} size={2.5} italic>No design notes.</Txt>}
      <Line x1={x2 - 7} y1={AREA.y + 4} x2={x2 - 7} y2={AREA_B - 4} w={LW_THIN} />
      <Txt x={x2} y={AREA.y + 9} size={3.2} bold>ENGINEERING REVIEW ITEMS (AUTO-CHECKED)</Txt>
      <Line x1={x2} y1={AREA.y + 11.5} x2={x2 + half} y2={AREA.y + 11.5} w={LW} />
      <NoteList x={x2} y={AREA.y + 17} w={half} items={sp.warnings} size={2.4} maxY={AREA_B - 6} />
      <Txt x={x1} y={AREA_B - 2} size={2.3} italic>{`Review items are generated from the design data (${plan.model.rc.length} components, ${plan.model.io.length} I/O points). Resolve or accept each item before release.`}</Txt>
    </g>
  );
}

// ---------------------------------------------------------------------------
// Terminal plan
// ---------------------------------------------------------------------------

export function TerminalSheet({ plan, sheet }: { plan: DrawingPlan; sheet: PlannedSheet }) {
  const sp = sheet.spec as Extract<SheetSpec, { kind: 'terminals' }>;
  const colW = (AREA.w - 24) / 2;
  const rowH = 5.1;
  const cols = [0, 14, 36, 98, 160];
  const heads = ['TERM', 'WIRE', 'INTERNAL (PANEL SIDE)', 'EXTERNAL (FIELD SIDE)', 'TYPE'];
  return (
    <g>
      {sp.columns.map((col, ci) => {
        const x = AREA.x + 8 + ci * (colW + 8);
        const y0 = AREA.y + 8;
        return (
          <g key={ci}>
            <rect x={x} y={y0 - 4.5} width={colW} height={(TERM_ROWS + 1) * rowH + 1} strokeWidth={LW_HEAVY} />
            {heads.map((h, i) => <Txt key={h} x={x + cols[i] + 1.5} y={y0} size={2.3} bold>{h}</Txt>)}
            <Line x1={x} y1={y0 + 1.6} x2={x + colW} y2={y0 + 1.6} w={LW} />
            {cols.slice(1).map((c) => <Line key={c} x1={x + c} y1={y0 - 4.5} x2={x + c} y2={y0 - 4.5 + (TERM_ROWS + 1) * rowH + 1} w={LW_THIN} />)}
            {col.map((r, ri) => {
              const yy = y0 + 1.6 + (ri + 1) * rowH;
              if (r.kind === 'header') {
                return (
                  <g key={ri}>
                    <rect x={x} y={yy - rowH} width={colW} height={rowH} fill="#e8e8e8" stroke="none" />
                    <Line x1={x} y1={yy - rowH} x2={x + colW} y2={yy - rowH} w={LW} />
                    <Txt x={x + 1.5} y={yy - 1.4} size={2.6} bold mono maxW={colW - 3}>{r.cont ? `${r.strip.tag} — ${r.strip.title} (CONTINUED)` : `${r.strip.tag} — ${r.strip.title} (${r.strip.terminals.length} TERMINALS, ${r.strip.endPlates} END PLATE, ${r.strip.endStops} END STOPS)`}</Txt>
                    <Line x1={x} y1={yy} x2={x + colW} y2={yy} w={LW_THIN} />
                  </g>
                );
              }
              const t = r.t;
              return (
                <g key={ri}>
                  <Txt x={x + cols[0] + 7} y={yy - 1.4} size={2.4} mono bold anchor="middle">{t.number}</Txt>
                  <Txt x={x + cols[1] + 1.5} y={yy - 1.4} size={2.4} mono bold maxW={cols[2] - cols[1] - 3}>{t.wire || '—'}</Txt>
                  <Txt x={x + cols[2] + 1.5} y={yy - 1.4} size={2.3} mono maxW={cols[3] - cols[2] - 3}>{t.internal}</Txt>
                  <Txt x={x + cols[3] + 1.5} y={yy - 1.4} size={2.3} mono maxW={cols[4] - cols[3] - 3}>{t.external}</Txt>
                  <Txt x={x + cols[4] + 1.5} y={yy - 1.4} size={2.2} maxW={colW - cols[4] - 3}>{t.kind === 'ground' ? 'PE (GN/YE)' : t.kind === 'spare' ? 'SPARE' : t.fuse ? `FUSED ${t.fuse}` : t.group === t.wire ? 'JUMPERED' : 'FEED'}</Txt>
                  <Line x1={x} y1={yy} x2={x + colW} y2={yy} w={0.12} />
                </g>
              );
            })}
          </g>
        );
      })}
      <Txt x={AREA.x + 8} y={AREA_B - 2} size={2.3} italic>{`TERMINALS IN A "JUMPERED" GROUP (24+, 24+S, 0V) ARE COMMONED WITH PLUG-IN JUMPER BARS. SENSOR 24+/0V TERMINALS ON ${stripTag(plan.ctx.designations, 2)} ARE JUMPERED TO ${stripTag(plan.ctx.designations, 1)}. ONE CONDUCTOR PER TERMINAL CLAMP.`}</Txt>
    </g>
  );
}

// ---------------------------------------------------------------------------
// BOM
// ---------------------------------------------------------------------------

/** A BOM cell that wraps onto a second line of its row instead of shrinking long text to an unreadable size. */
function Cell2({ x, yy, w, text, mono, italic }: { x: number; yy: number; w: number; text: string; mono?: boolean; italic?: boolean }) {
  const one = wrapText(text, w, 2.4, mono);
  if (one.length <= 1) return <Txt x={x} y={yy - 1.8} size={2.4} mono={mono} italic={italic} maxW={w}>{text}</Txt>;
  const [a, ...rest] = wrapText(text, w, 2.2, mono);
  return (
    <g>
      <Txt x={x} y={yy - 3.6} size={2.2} mono={mono} italic={italic} maxW={w}>{a}</Txt>
      <Txt x={x} y={yy - 0.9} size={2.2} mono={mono} italic={italic} maxW={w}>{rest.join(' ')}</Txt>
    </g>
  );
}

export function BomSheet({ sheet }: { plan: DrawingPlan; sheet: PlannedSheet }) {
  const sp = sheet.spec as Extract<SheetSpec, { kind: 'bom' }>;
  const x = AREA.x + 8;
  const w = AREA.w - 16;
  const cols = [0, 12, 24, 72, 108, 318];
  const heads = ['ITEM', 'QTY', 'PART NUMBER', 'MANUFACTURER', 'DESCRIPTION', 'DEVICE TAGS'];
  const rowH = 6.2;
  const y0 = AREA.y + 8;
  return (
    <g>
      <rect x={x} y={y0 - 4.8} width={w} height={(sp.rows.length + 1) * rowH + 1.2} strokeWidth={LW_HEAVY} />
      {heads.map((h, i) => <Txt key={h} x={x + cols[i] + 1.5} y={y0} size={2.5} bold>{h}</Txt>)}
      <Line x1={x} y1={y0 + 1.6} x2={x + w} y2={y0 + 1.6} w={LW} />
      {sp.rows.map((r, i) => {
        const yy = y0 + 1.6 + (i + 1) * rowH;
        if (r.kind === 'group') {
          return (
            <g key={i}>
              <rect x={x} y={yy - rowH} width={w} height={rowH} fill="#e8e8e8" stroke="none" />
              <Txt x={x + 1.5} y={yy - 1.8} size={2.7} bold>{r.title.toUpperCase()}</Txt>
              <Line x1={x} y1={yy} x2={x + w} y2={yy} w={LW_THIN} />
            </g>
          );
        }
        const l = r.line;
        return (
          <g key={i}>
            {cols.slice(1).map((c) => <Line key={c} x1={x + c} y1={yy - rowH} x2={x + c} y2={yy} w={LW_THIN} />)}
            <Txt x={x + cols[0] + 6} y={yy - 1.8} size={2.5} mono anchor="middle">{l.item}</Txt>
            <Txt x={x + cols[1] + 6} y={yy - 1.8} size={2.5} mono bold anchor="middle">{l.qty}</Txt>
            <Txt x={x + cols[2] + 1.5} y={yy - 1.8} size={2.5} mono bold maxW={cols[3] - cols[2] - 3}>{l.partNumber || '—'}</Txt>
            <Txt x={x + cols[3] + 1.5} y={yy - 1.8} size={2.4} maxW={cols[4] - cols[3] - 3}>{l.manufacturer || '—'}</Txt>
            <Cell2 x={x + cols[4] + 1.5} yy={yy} w={cols[5] - cols[4] - 3} italic={l.note} text={l.description} />
            <Cell2 x={x + cols[5] + 1.5} yy={yy} w={w - cols[5] - 3} mono text={l.tags.join(', ')} />
            <Line x1={x} y1={yy} x2={x + w} y2={yy} w={0.12} />
          </g>
        );
      })}
      {sp.first && <Txt x={x} y={AREA_B - 2} size={2.3} italic>LINES WITHOUT A PART NUMBER ARE DERIVED QUANTITIES — SELECT A PART. VERIFY ALL PART NUMBERS AND PRICING AT AUTOMATIONDIRECT.COM BEFORE ORDERING.</Txt>}
    </g>
  );
}
