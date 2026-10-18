/**
 * Rung entry sheet for CLICK Programming Software. CLICK cannot import ladder logic (only nicknames:
 * File > Import > Nickname), so every rung is typed in by hand: this sheet says, rung by rung and block
 * by block, which instruction goes in which row and column and what to type in each instruction dialog,
 * with a box to tick per rung. Instruction and dialog names as in the CLICK help (contacts: NO / NC /
 * Edge, Compare; coils: Out / Set / Reset; Timer, Counter, Copy, Math; the END instruction ends the main
 * program).
 */
import { rawTodo, type LadderElement, type LadderOutput, type LadderProgram, type Rung } from './ladder';

export interface EntryCell { column: number; instruction: string; fields: [string, string][] }
export interface EntryOutput { instruction: string; fields: [string, string][]; note?: string }
export interface EntryRung { number: number; comment: string; rows: EntryCell[][]; outputs: EntryOutput[] }
export interface EntryBlock { name: string; description: string; rungs: EntryRung[] }

const UNIT: Record<string, string> = { ms: 'msec', sec: 'sec', min: 'min', hour: 'hour', day: 'day' };
const OP: Record<string, string> = { '==': '= (equal)', '<>': '<> (not equal)', '>': '> (greater)', '>=': '>= (greater or equal)', '<': '< (less)', '<=': '<= (less or equal)' };

function cell(el: LadderElement, column: number, label: (a: string) => string): EntryCell {
  if (el.type === 'CMP') return { column, instruction: 'Compare contact', fields: [['Value A', `${el.left}${label(el.left)}`], ['Operator', OP[el.op]], ['Value B', `${el.right}${label(el.right)}`]] };
  if (el.type === 'RAW') return { column, instruction: el.vendor === 'click' ? 'As in the original program' : 'Not converted', fields: [['Instruction', el.vendor === 'click' ? el.text : rawTodo(el)]] };
  if (el.type === 'RISE' || el.type === 'FALL') return { column, instruction: `Edge contact — ${el.type === 'RISE' ? 'Rising' : 'Falling'}`, fields: [['Address', `${el.address}${label(el.address)}`]] };
  return { column, instruction: el.type === 'NO' ? 'NO contact (normally open)' : 'NC contact (normally closed)', fields: [['Address', `${el.address}${label(el.address)}`]] };
}

function output(o: LadderOutput, label: (a: string) => string): EntryOutput {
  const at = (a: string) => `${a}${label(a)}`;
  switch (o.type) {
    case 'OUT': return { instruction: 'Out coil', fields: [['Address', at(o.address)]] };
    case 'SET': return { instruction: 'Set coil', fields: [['Address', at(o.address)]] };
    case 'RST': return { instruction: 'Reset coil', fields: [['Address', at(o.address)]] };
    case 'TMR': return {
      instruction: 'Timer',
      fields: [['Timer number', at(o.address)], ['Type', o.mode === 'ON_DELAY' ? 'On-delay' : 'Off-delay'], ['Setpoint', /^\d/.test(o.preset) ? o.preset : at(o.preset)], ['Unit', UNIT[o.unit] ?? o.unit],
        ['Current value', o.accumulate ? 'retained until reset (retentive)' : 'reset when the input goes OFF']],
      ...(o.accumulate ? { note: `Reset input (second input line of the Timer box): NO contact ${o.resetAddress ? at(o.resetAddress) : '— add the reset contact'}` } : {}),
    };
    case 'CNT': return {
      instruction: 'Counter',
      fields: [['Counter number', at(o.address)], ['Count', o.direction === 'UP' ? 'Up' : 'Down'], ['Setpoint', /^\d/.test(o.preset) ? o.preset : at(o.preset)]],
      note: `Reset input (second input line of the Counter box): ${o.resetAddress ? `NO contact ${at(o.resetAddress)}` : 'none (leave the reset line open)'}`,
    };
    case 'COPY': return { instruction: 'Copy — Single copy', fields: [['Source', /^-?\d/.test(o.source) ? o.source : at(o.source)], ['Destination', at(o.dest)]] };
    case 'MATH': return { instruction: 'Math — Decimal', fields: [['Result', at(o.dest)], ['Formula', o.expression]] };
    case 'RAW': return { instruction: o.vendor === 'click' ? 'As in the original program' : 'Not converted', fields: [['Instruction', o.vendor === 'click' ? o.text : rawTodo(o)]] };
  }
}

export function entryRung(r: Rung, number: number, label: (a: string) => string): EntryRung {
  return {
    number, comment: r.comment,
    rows: r.branches.map((b) => b.map((el, i) => cell(el, i + 1, label))),
    outputs: r.outputs.map((o) => output(o, label)),
  };
}

/** The program as CLICK entry steps, one group per block, real rung numbers. */
export function clickEntryBlocks(program: LadderProgram, labels: Map<string, string>): EntryBlock[] {
  const label = (a: string) => (labels.get(a.toUpperCase()) ? ` (${labels.get(a.toUpperCase())})` : '');
  const num = new Map(program.rungs.map((r, i) => [r.id, i + 1]));
  // Blocks in their own order; rungs without a (known) block go to "General".
  const known = new Set((program.blocks ?? []).map((b) => b.id));
  const groups = [...(program.blocks ?? []).map((b) => ({ name: b.name || b.id, description: b.description ?? '', ids: program.rungs.filter((r) => r.block === b.id).map((r) => r.id) })),
    { name: program.blocks?.length ? 'General' : 'Program', description: '', ids: program.rungs.filter((r) => !r.block || !known.has(r.block)).map((r) => r.id) }].filter((g) => g.ids.length);
  // Rungs in program order: CLICK runs them top to bottom, so they are typed in that order.
  const byId = new Map(program.rungs.map((r) => [r.id, r]));
  return groups.map((g) => ({ name: g.name, description: g.description, rungs: [...g.ids].sort((a, b) => num.get(a)! - num.get(b)!).map((id) => entryRung(byId.get(id)!, num.get(id)!, label)) }));
}

const fieldText = (f: [string, string][]) => f.map(([k, v]) => `${k}: ${v}`).join(' · ');

/** Plain-text version (same content as the printable sheet). */
export function clickEntryText(program: LadderProgram, labels: Map<string, string>, header: string): string {
  const lines: string[] = [header, '', 'Type the rungs in this order in CLICK Programming Software (it cannot import ladder logic).', 'Row 1 is the top line of the rung; columns count from the left power rail. Rows 2, 3 … are parallel branches: draw them under row 1 and join them before the output.', ''];
  for (const b of clickEntryBlocks(program, labels)) {
    lines.push(`=== ${b.name}${b.description ? ` — ${b.description}` : ''} ===`, '');
    for (const r of b.rungs) {
      lines.push(`[ ] Rung ${r.number}${r.comment ? ` — ${r.comment}` : ''}`);
      if (!r.rows.length || r.rows.every((x) => !x.length)) lines.push('    Row 1: no contacts (wire straight to the output)');
      r.rows.forEach((row, i) => lines.push(`    Row ${i + 1}${i ? ' (parallel)' : ''}: ${row.length ? row.map((c) => `col ${c.column} ${c.instruction} [${fieldText(c.fields)}]`).join('  →  ') : 'wire'}`));
      r.outputs.forEach((o, i) => { lines.push(`    Output ${i + 1}${i ? ' (stacked below)' : ''}: ${o.instruction} [${fieldText(o.fields)}]`); if (o.note) lines.push(`      ${o.note}`); });
      lines.push('');
    }
  }
  lines.push(`[ ] Rung ${program.rungs.length + 1} — END instruction on its own rung, the last rung of the main program (CLICK needs it to run).`);
  return lines.join('\r\n') + '\r\n';
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Printable HTML entry sheet with a tick box per rung (open in a browser, print or tick on screen). */
export function clickEntrySheetHtml(program: LadderProgram, labels: Map<string, string>, header: string, cpuAndModules: string[]): string {
  const blocks = clickEntryBlocks(program, labels);
  const fields = (f: [string, string][]) => `<table class="f">${f.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</table>`;
  const rung = (r: EntryRung) => `
<section class="rung">
  <h3><label><input type="checkbox"> Rung ${r.number}</label>${r.comment ? ` <span class="c">${esc(r.comment)}</span>` : ''}</h3>
  <table class="grid">
    <tr><th></th>${Array.from({ length: Math.max(1, ...r.rows.map((x) => x.length)) }, (_, i) => `<th>Column ${i + 1}</th>`).join('')}<th class="out">Output (right rail)</th></tr>
    ${(r.rows.length ? r.rows : [[]]).map((row, i) => `<tr><th>Row ${i + 1}${i ? '<br><small>parallel</small>' : ''}</th>${Array.from({ length: Math.max(1, ...r.rows.map((x) => x.length)) }, (_, k) => {
      const c = row[k];
      return c ? `<td><b>${esc(c.instruction)}</b>${fields(c.fields)}</td>` : '<td class="w">— wire —</td>';
    }).join('')}${i === 0 ? `<td class="out" rowspan="${Math.max(1, r.rows.length)}">${r.outputs.map((o, j) => `<div class="o"><b>${j ? `Output ${j + 1} (stacked below): ` : ''}${esc(o.instruction)}</b>${fields(o.fields)}${o.note ? `<p class="n">${esc(o.note)}</p>` : ''}</div>`).join('')}</td>` : ''}</tr>`).join('')}
  </table>
</section>`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${esc(header)} — CLICK rung entry sheet</title>
<style>
body{font:13px/1.35 system-ui,Segoe UI,Arial,sans-serif;margin:16px;color:#1f2933}
h1{font-size:18px;margin:0 0 4px} h2{font-size:15px;margin:22px 0 6px;padding:4px 8px;background:#e9edef;border:1px solid #c5ccd3}
h3{font-size:13px;margin:0 0 4px} .c{font-weight:normal;color:#52606d}
.rung{border:1px solid #c5ccd3;padding:8px;margin:8px 0;break-inside:avoid}
table.grid{border-collapse:collapse;width:100%} .grid th,.grid td{border:1px solid #d9dee3;padding:4px 6px;vertical-align:top;text-align:left}
.grid>tbody>tr>th{background:#f5f7f9;font-weight:600;white-space:nowrap} td.w{color:#9aa5b1;text-align:center}
td.out{background:#f8fafc;min-width:220px} .o+.o{margin-top:6px;border-top:1px dashed #c5ccd3;padding-top:6px}
table.f{border-collapse:collapse;margin-top:2px} .f th{font-weight:normal;color:#52606d;padding:0 6px 0 0;border:0;background:none} .f td{font-family:Consolas,monospace;border:0;padding:0}
.n{margin:4px 0 0;color:#7b4b00} ol{padding-left:20px} .steps{border:1px solid #c5ccd3;padding:8px 12px;background:#fbfcfd}
@media print{input{width:14px;height:14px} body{margin:8mm}}
</style></head><body>
<h1>${esc(header)} — rung entry sheet for CLICK Programming Software</h1>
<div class="steps"><ol>
<li>CLICK cannot import ladder logic: type each rung below, in this order, then tick its box. Import the nicknames first (File &gt; Import &gt; Nickname, the _nicknames.csv file) so every address shows its name.</li>
<li>Hardware in the project (in this order): ${esc(cpuAndModules.join(', '))}.</li>
<li>Row 1 is the top line of a rung; columns count from the left power rail. Rows 2, 3 … are parallel branches under row 1, joined before the output. Fill every instruction dialog exactly as listed.</li>
<li>Finish with the END instruction on its own last rung, then check the program (it must show no errors) and save.</li>
</ol></div>
${blocks.map((b) => `<h2>${esc(b.name)}${b.description ? ` — <span class="c">${esc(b.description)}</span>` : ''}</h2>${b.rungs.map(rung).join('')}`).join('\n')}
<section class="rung"><h3><label><input type="checkbox"> Rung ${program.rungs.length + 1}</label> <span class="c">END — the last rung of the main program</span></h3><p>Add the <b>END</b> instruction on its own rung (no contacts). CLICK needs it to run.</p></section>
</body></html>
`;
}
