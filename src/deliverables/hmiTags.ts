/**
 * HMI tag list for touch panels other than C-more: every address the screens use, with the name
 * of the matching tag in the exported PLC program, so the screens can be rebuilt in the panel
 * maker's own software from the screen images. No project file of that software is written (its
 * format is the maker's). C-more projects keep the CLICK nickname CSV (C-more tag import).
 */
import type { ProjectSnapshot } from './collect';
import { getHmi, hmiMaker, isCmore } from '../hmi/hmiCatalog';
import { moduleSlots } from '../plc/core/modules';
import { plcTagNameOf } from './plcTagNames';
import { getPart } from '../electrical/catalog';
import { hasBuiltInPanel } from '../hmi/panels';

export interface HmiTagRow { name: string; address: string; plcTag: string; plcScope: string; plcType: string; plcIo: string; dataType: string; access: string; description: string; screens: string }

/** True when the project's panel is not a C-more (needs the tag list and software note). */
export const needsHmiTagList = (p: ProjectSnapshot) => {
  const m = p.hmi ? getHmi(p.hmi.hmiPartNumber) : undefined;
  return Boolean(p.hmi && m && !isCmore(m));
};

export function hmiTagRows(p: ProjectSnapshot): HmiTagRow[] {
  if (!p.hmi) return [];
  const used = new Map<string, Set<string>>();
  const note = (a: string | null | undefined, screen: string) => { if (!a) return; const k = a.toUpperCase(); (used.get(k) ?? used.set(k, new Set()).get(k)!).add(screen); };
  for (const s of p.hmi.screens) for (const e of s.elements) { note(e.address, s.name); note(e.interlock, s.name); for (const y of e.symbols ?? []) note(y.address, s.name); }
  for (const a of p.hmi.alarms) note(a.address, 'Alarms');
  const tagOf = plcTagNameOf(p);
  const plc = (k: string) => { const t = tagOf(k); return { plcTag: t.name || '(not in the program)', plcScope: t.scope, plcType: t.dataType, plcIo: t.io ?? '' }; };
  const rows = new Map<string, HmiTagRow>();
  for (const t of p.hmi.tags) {
    const k = t.address.toUpperCase();
    rows.set(k, { name: t.name, address: k, ...plc(k), dataType: t.dataType, access: t.access, description: t.description, screens: [...(used.get(k) ?? [])].join(', ') });
  }
  // Physical I/O shown on screens without an HMI tag of their own.
  for (const [k, screens] of used) if (!rows.has(k)) {
    const io = p.io.find((x) => (p.addresses.get(x.id) ?? '').toUpperCase() === k);
    rows.set(k, { name: io?.description ?? k, address: k, ...plc(k), dataType: /^(X|Y|C|T|CT|SC)\d+$/.test(k) ? 'BIT' : /^DF/.test(k) ? 'FLOAT' : 'INT', access: 'read', description: io?.description ?? '', screens: [...screens].join(', ') });
  }
  return [...rows.values()].sort((a, b) => a.address.localeCompare(b.address, 'en', { numeric: true }));
}

const cell = (v: string) => `"${v.replace(/"/g, '""')}"`;

export function hmiTagCsv(p: ProjectSnapshot): string {
  const head = ['HMI tag', 'Program address', `PLC tag (${p.profile.vendor} ${p.profile.name})`, 'PLC scope', 'PLC data type', 'PLC I/O', 'HMI data type', 'Access', 'Description', 'Used on screens'];
  return [head.map(cell).join(','), ...hmiTagRows(p).map((r) => [r.name, r.address, r.plcTag, r.plcScope, r.plcType, r.plcIo, r.dataType, r.access, r.description, r.screens].map(cell).join(','))].join('\r\n');
}

/** Plain-text note: which software builds the panel project, and how to use the files. */
export function hmiReadme(p: ProjectSnapshot): string {
  const m = p.hmi ? getHmi(p.hmi.hmiPartNumber) : undefined;
  if (!p.hmi || !m) return '';
  const sw = m.software ?? `the ${hmiMaker(m)} configuration software for the ${m.partNumber} (see the panel's datasheet)`;
  const builtIn = hasBuiltInPanel(getPart(m.partNumber));
  return [
    `${p.projectName} — operator panel ${hmiMaker(m)} ${m.partNumber} (${m.sizeIn}" ${m.widthPx}x${m.heightPx})`,
    '',
    `Build the panel project in ${sw}.`,
    'This package does not contain a project file for that software; its format belongs to the maker.',
    '',
    'Files:',
    `- ${p.fileBase}_hmi_screens.pdf and the PNG images: every screen at the panel's resolution (${m.widthPx}x${m.heightPx}), element positions in pixels.`,
    `- ${p.fileBase}_hmi_tags.csv: every address the screens use, with the PLC tag of the exported ${p.profile.vendor} ${p.profile.name} program to bind it to.`,
    '',
    'Steps:',
    ...(builtIn
      ? [`1. The ${m.partNumber} is PLC and screen in one: build the screens in the HMI editor of the same ${sw} project as the PLC program (no PLC connection or driver).`,
        '2. Bind each screen element to the PLC tag / operand in the CSV (PLC tag column).']
      : [`1. Create a ${m.partNumber} project and add the PLC connection (${p.profile.vendor} ${p.cpu.label}) with the maker's driver.`,
        '2. Import or create the tags from the CSV (PLC tag column).']),
    '3. Rebuild each screen from its image: same layout, labels, colours and access levels.',
    '4. Test every button and lamp against the PLC (or the simulator in ISA Auto Programmer) before commissioning.',
    '',
    `Modules for the PLC: ${moduleSlots(p.modules).map((s) => s.partNumber).join(', ') || 'none'}.`,
  ].join('\r\n');
}
