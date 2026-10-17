import type { LadderElement, LadderOutput, LadderProgram } from './ladder';
import type { IOPoint } from '../../types/io';

/**
 * CLICK Programming Software cannot import ladder logic, only Address Picker
 * nicknames (File > Import > Nickname). Format per AutomationDirect help
 * (Content/115.htm): Address,Data Type,Nickname,Initial Value,Retentive,Address Comment
 * Only BIT rows are confirmed in the docs, so registers are left out of the CSV
 * and listed in the printout instead.
 */

const BIT_ADDRESS = /^(X\d{3}|Y\d{3}|C\d+|T\d+|CT\d+)$/;
/** CLICK data type of an address in the nickname CSV (bits, the timer / counter values and the registers); null = not exported. */
function dataTypeOf(address: string): string | null {
  if (BIT_ADDRESS.test(address)) return 'BIT';
  if (/^(DS|TD)\d+$/.test(address)) return 'INT';
  if (/^(DD|CTD)\d+$/.test(address)) return 'INT2';
  if (/^DH\d+$/.test(address)) return 'HEX';
  if (/^DF\d+$/.test(address)) return 'FLOAT';
  return null;
}

/** CLICK nicknames: no spaces; keep them short and unique. */
function toNickname(text: string, used: Set<string>): string {
  let base = text.trim().replace(/[^A-Za-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24) || 'Tag';
  if (/^\d/.test(base)) base = `_${base}`.slice(0, 24);
  let name = base;
  for (let i = 2; used.has(name.toLowerCase()); i++) name = `${base.slice(0, 24 - String(i).length - 1)}_${i}`;
  used.add(name.toLowerCase());
  return name;
}

const q = (s: string) => `"${s.replace(/"/g, '""')}"`;

/**
 * The same CSV loads into C-more (Tag import, ".csv Format = CLICK"), so HMI
 * tags passed in `extra` get nicknames for the HMI too.
 */
export function clickNicknameCsv(program: LadderProgram, io: IOPoint[], addresses: Map<string, string>, extra: { address: string; nickname: string; comment: string }[] = []): string {
  const used = new Set<string>();
  const rows: string[] = ['Address,Data Type,Nickname,Initial Value,Retentive,Address Comment'];
  const seen = new Set<string>();
  const add = (address: string, nickname: string, comment: string) => {
    const type = dataTypeOf(address);
    if (!type || seen.has(address)) return;
    seen.add(address);
    // CLICK keeps registers (DS / DD / DH / DF) and counters through a power cycle; bits and timer values reset.
    const retentive = /^(CT|CTD|DS|DD|DH|DF)\d+$/.test(address) ? 'Yes' : 'No';
    rows.push([address, type, q(toNickname(nickname, used)), '0', retentive, q(comment)].join(','));
  };
  for (const p of io) {
    const a = addresses.get(p.id);
    if (a) add(a, p.description || p.id, `${p.id} ${p.category}`);
  }
  for (const t of program.tags) add(t.address, t.nickname, t.comment);
  for (const t of extra) add(t.address, t.nickname, t.comment);
  return rows.join('\r\n') + '\r\n';
}

const CONTACT_TEXT: Record<string, string> = { NO: 'NO contact', NC: 'NC contact', RISE: 'Rising-edge contact', FALL: 'Falling-edge contact' };
const UNIT_TEXT: Record<string, string> = { ms: 'ms', sec: 'sec', min: 'min', hour: 'hour', day: 'day' };

export function describeElement(el: LadderElement, label: (a: string) => string): string {
  if (el.type === 'CMP') return `Compare ${el.left} ${el.op} ${el.right}`;
  return `${CONTACT_TEXT[el.type]} ${el.address}${label(el.address)}`;
}

export function describeOutput(o: LadderOutput, label: (a: string) => string): string {
  switch (o.type) {
    case 'OUT': return `Out coil ${o.address}${label(o.address)}`;
    case 'SET': return `Set coil ${o.address}${label(o.address)}`;
    case 'RST': return `Reset coil ${o.address}${label(o.address)}`;
    case 'TMR':
      return `Timer ${o.address}: ${o.mode === 'ON_DELAY' ? 'On-delay' : 'Off-delay'}, setpoint ${o.preset} ${UNIT_TEXT[o.unit]}` +
        (o.accumulate ? `, current value: Reset (retentive), reset rung = ${o.resetAddress ?? '?'}` : ', current value: auto reset');
    case 'CNT':
      return `Counter ${o.address}: count ${o.direction === 'UP' ? 'Up' : 'Down'}, setpoint ${o.preset}, reset rung = ${o.resetAddress ?? '?'}`;
    case 'COPY': return `Copy (Single) ${o.source} → ${o.dest}`;
    case 'MATH': return `Math (Decimal): ${o.dest} = ${o.expression}`;
  }
}

/** Plain-text, rung-by-rung entry sheet for CLICK Programming Software. */
export function clickRungListing(program: LadderProgram, labels: Map<string, string>, header: string): string {
  const label = (a: string) => (labels.get(a) ? ` (${labels.get(a)})` : '');
  const lines: string[] = [header, ''];
  program.rungs.forEach((r, i) => {
    lines.push(`Rung ${i + 1}${r.comment ? ` — ${r.comment}` : ''}`);
    if (!r.branches.length) lines.push('  Inputs: none (wire straight to outputs)');
    r.branches.forEach((b, j) => {
      const prefix = r.branches.length > 1 ? `  Branch ${j + 1} (parallel): ` : '  Inputs in series: ';
      lines.push(prefix + (b.length ? b.map((el) => describeElement(el, label)).join('  →  ') : 'wire'));
    });
    r.outputs.forEach((o) => lines.push(`  Output: ${describeOutput(o, label)}`));
    lines.push('');
  });
  lines.push(`Rung ${program.rungs.length + 1} — END (unconditional; required by CLICK at the end of the main program)`);
  const registers = program.tags.filter((t) => !BIT_ADDRESS.test(t.address));
  if (registers.length) {
    lines.push('', 'Registers used (enter nicknames in Address Picker by hand):');
    registers.forEach((t) => lines.push(`  ${t.address}  ${t.nickname}  ${t.comment}`));
  }
  return lines.join('\r\n') + '\r\n';
}
