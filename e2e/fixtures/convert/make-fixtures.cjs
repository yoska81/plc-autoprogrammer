// Builds the sample drawing set of a Chinese-style sorting conveyor (used by e2e/convert.e2e.cjs):
//   sorting_conveyor_drawings.pdf  4 sheets: power circuit, control circuit, PLC I/O, parts list (GB tags, 380 V 50 Hz)
//   E-03_PLC_IO.dxf                the PLC I/O sheet as a CAD export, Chinese text stored as \U+ escapes
//   node e2e/fixtures/convert/make-fixtures.cjs
const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const DIR = __dirname;

async function pdf() {
  const doc = await PDFDocument.create();
  doc.setTitle('FJSSX-2019 Sorting conveyor electrical drawings');
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const sheet = (no, title) => {
    const page = doc.addPage([1190, 842]); // A3 landscape
    page.drawRectangle({ x: 20, y: 20, width: 1150, height: 802, borderWidth: 1.5, borderColor: rgb(0, 0, 0) });
    page.drawRectangle({ x: 830, y: 20, width: 340, height: 70, borderWidth: 1, borderColor: rgb(0, 0, 0) });
    const t = (s, x, y, size = 9, f = font) => page.drawText(s, { x, y, size, font: f });
    t('Ningbo Huada Machinery Co. (NINGBO HUADA JIXIE)', 840, 70, 8);
    t(`FJSSX-2019  Sorting conveyor (FENJIAN SHUSONGXIAN)  Sheet ${no}/4`, 840, 55, 8, bold);
    t(title, 840, 40, 9, bold);
    t('Drawn: Wang L.  Checked: Li M.  2019-06-12  GB/T 4728 / GB/T 5094', 840, 27, 7);
    return { page, t, line: (x1, y1, x2, y2) => page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 1 }), box: (x, y, w, h) => page.drawRectangle({ x, y, width: w, height: h, borderWidth: 1, borderColor: rgb(0, 0, 0) }) };
  };

  // 1: power circuit
  {
    const { t, line, box } = sheet(1, 'MAIN CIRCUIT (ZHU DIANLU)');
    t('3~380V 50Hz  L1 L2 L3 N PE (SANXIANG WUXIAN)', 40, 790, 11);
    for (const [i, y] of [770, 760, 750].entries()) { line(40, y, 1100, y); t(`L${i + 1}`, 1105, y - 3); }
    box(60, 690, 60, 40); t('QS1', 65, 735); t('NH40-63/3', 62, 680, 7);
    const branch = (x, tag, cb, km, fr, motor, extra = '') => {
      box(x, 640, 50, 40); t(tag[0], x + 5, 685); t(cb, x - 5, 630, 7);
      box(x, 560, 50, 40); t(tag[1], x + 5, 605); t(km, x - 5, 550, 7); t('coil AC220V', x - 5, 541, 7);
      if (extra) { box(x + 90, 560, 50, 40); t(extra, x + 95, 605); t(km, x + 85, 550, 7); t('reverse L1/L3', x + 85, 541, 7); }
      box(x, 480, 50, 40); t(tag[2], x + 5, 525); t(fr, x - 5, 470, 7);
      page1Circle(x + 25, 400); t(tag[3], x + 18, 397); t(motor, x - 5, 365, 7);
      for (const dy of [0, 10, 20]) line(x + 10 + dy, 770 - dy, x + 10 + dy, 420);
    };
    const pg = doc.getPage(0);
    function page1Circle(x, y) { pg.drawCircle({ x, y, size: 22, borderWidth: 1, borderColor: rgb(0, 0, 0) }); }
    branch(220, ['QF1', 'KM1', 'FR1', 'M1'], 'DZ47-63 3P C16 6kA', 'CJX2-1210', 'JR36-20 2.2-3.5A', '1.1kW 380V conveyor', 'KM2');
    branch(520, ['QF2', 'KM3', 'FR2', 'M2'], 'DZ47-63 3P C10 6kA', 'CJX2-0910', 'JR36-20 1.6-2.4A', '0.75kW 380V pump');
    box(820, 640, 50, 40); t('QF3', 825, 685); t('DZ47-63 2P C6', 810, 630, 7);
    box(820, 560, 50, 40); t('TC1', 825, 605); t('BK-150 380/220V', 805, 550, 7);
    box(920, 560, 50, 40); t('V1', 925, 605); t('DR-60-24 24VDC', 905, 550, 7);
    t('Wires: main 2.5 mm2, motor 1.5 mm2 BVR, control 1.0 mm2', 40, 120, 9);
  }
  // 2: control circuit
  {
    const { t, line, box } = sheet(2, 'CONTROL CIRCUIT (KONGZHI DIANLU)');
    t('AC220V from TC1', 40, 790, 10);
    line(60, 770, 60, 150); line(1050, 770, 1050, 150);
    const rung = (y, items, coil, note) => {
      line(60, y, 1050, y);
      items.forEach((s, i) => { box(140 + i * 140, y - 12, 60, 24); t(s, 145 + i * 140, y + 16, 8); });
      box(950, y - 12, 60, 24); t(coil, 958, y - 4, 9);
      t(note, 140, y - 30, 7);
    };
    rung(720, ['SB1 E-STOP NC'], 'KA1', 'Emergency stop relay KA1 MY2N-GS DC24 via 24V (single channel)');
    rung(640, ['KA1 NO', 'Y0', 'KM2 NC', 'FR1 NC'], 'KM1', 'Conveyor forward, interlocked with KM2');
    rung(560, ['KA1 NO', 'Y1', 'KM1 NC', 'FR1 NC'], 'KM2', 'Conveyor reverse, interlocked with KM1');
    rung(480, ['KA1 NO', 'Y2', 'FR2 NC'], 'KM3', 'Pump');
    rung(400, ['KA1 NO', 'Y3', 'SP1 NO'], 'YV1', 'Pusher valve 4V210-08 DC24V, only with air pressure OK');
    rung(320, ['Y4'], 'HL1', 'Running lamp green ND16-22DS/4 AC220V');
    rung(240, ['Y5', 'FR1 NO'], 'HL2', 'Fault lamp red (also on conveyor overload)');
  }
  // 3: PLC I/O
  {
    const { t, box } = sheet(3, 'PLC I/O  FX3U-32MR/ES-A');
    box(450, 150, 200, 620); t('PLC FX3U-32MR/ES-A', 470, 750, 10);
    const ins = [['X0', 'SB1', 'E-stop (JITING) LAY39-11ZS'], ['X1', 'SB2', 'Start (QIDONG) NP2-BA31'], ['X2', 'SB3', 'Stop (TINGZHI) NP2-BA42'], ['X3', 'SA1', 'Auto/Manual NP2-BD21'],
      ['X4', 'B1', 'Part photo-eye E3Z-D61'], ['X5', 'SQ1', 'Pusher out D4N-1120'], ['X6', 'SQ2', 'Pusher back D4N-1120'], ['X7', 'FR1', 'Conveyor overload aux'], ['X10', 'SP1', 'Air pressure OK ISE30A-01-N']];
    ins.forEach(([a, tag, d], i) => { t(a, 455, 720 - i * 50, 9); t(`${tag}  ${d}`, 120, 720 - i * 50, 8); });
    const outs = [['Y0', 'KM1', 'Conveyor forward'], ['Y1', 'KM2', 'Conveyor reverse'], ['Y2', 'KM3', 'Pump'], ['Y3', 'YV1', 'Pusher valve'], ['Y4', 'HL1', 'Running lamp'], ['Y5', 'HL2', 'Fault lamp']];
    outs.forEach(([a, tag, d], i) => { t(a, 620, 720 - i * 50, 9); t(`${tag}  ${d}`, 700, 720 - i * 50, 8); });
  }
  // 4: parts list
  {
    const { t, line } = sheet(4, 'PARTS LIST (YUANJIAN BIAO)');
    const rows = [['QS1', 'Main switch', 'NH40-63/3', 'CHINT', 1], ['QF1', 'Breaker conveyor', 'DZ47-63 3P C16', 'CHINT', 1], ['QF2', 'Breaker pump', 'DZ47-63 3P C10', 'CHINT', 1], ['QF3', 'Breaker control', 'DZ47-63 2P C6', 'CHINT', 1],
      ['KM1,KM2', 'Contactor coil AC220V', 'CJX2-1210', 'Delixi', 2], ['KM3', 'Contactor coil AC220V', 'CJX2-0910', 'Delixi', 1], ['FR1,FR2', 'Thermal overload', 'JR36-20', 'CHINT', 2],
      ['TC1', 'Control transformer 380/220V 150VA', 'BK-150', 'CHINT', 1], ['V1', 'Power supply 24VDC 2.5A', 'DR-60-24', 'Mean Well', 1], ['KA1', 'Relay DC24V', 'MY2N-GS DC24', 'Omron', 1],
      ['PLC', 'PLC 16DI/16DO relay', 'FX3U-32MR/ES-A', 'Mitsubishi', 1], ['SB1', 'E-stop', 'LAY39-11ZS', 'CHINT', 1], ['SB2,SB3', 'Push button', 'NP2-BA31 / BA42', 'CHINT', 2],
      ['SA1', 'Selector 2 pos', 'NP2-BD21', 'CHINT', 1], ['HL1,HL2', 'Pilot lamp AC220V', 'ND16-22DS/4', 'CHINT', 2], ['B1', 'Photo-eye', 'E3Z-D61', 'Omron', 1],
      ['SQ1,SQ2', 'Limit switch', 'D4N-1120', 'Omron', 2], ['SP1', 'Pressure switch', 'ISE30A-01-N', 'SMC', 1], ['YV1', 'Valve 5/2 DC24V', '4V210-08', 'AirTAC', 1]];
    ['Tag', 'Name', 'Model', 'Maker', 'Qty'].forEach((h, i) => t(h, [40, 140, 420, 620, 760][i], 780, 10));
    rows.forEach((r, k) => { r.forEach((c, i) => t(String(c), [40, 140, 420, 620, 760][i], 755 - k * 30, 9)); line(30, 748 - k * 30, 800, 748 - k * 30); });
  }
  fs.writeFileSync(path.join(DIR, 'sorting_conveyor_drawings.pdf'), await doc.save());
}

function dxf() {
  // Chinese text as \U+ escapes (how AutoCAD R12-2004 DXF exports store it)
  const u = (s) => [...s].map((c) => (c.charCodeAt(0) > 127 ? `\\U+${c.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}` : c)).join('');
  const ents = [];
  const text = (x, y, s, layer = 'TEXT') => ents.push('0', 'TEXT', '8', layer, '10', String(x), '20', String(y), '40', '3.5', '1', u(s));
  const attrib = (x, y, tag, s) => ents.push('0', 'ATTRIB', '8', 'DEVICE', '10', String(x), '20', String(y), '40', '2.5', '2', tag, '1', u(s));
  text(10, 290, 'FX3U-32MR/ES-A PLC 输入输出 (E-03)', 'TITLE');
  const ins = [['X0', 'SB1', '急停'], ['X1', 'SB2', '启动'], ['X2', 'SB3', '停止'], ['X3', 'SA1', '自动/手动'], ['X4', 'B1', '光电检测'], ['X5', 'SQ1', '推出到位'], ['X6', 'SQ2', '缩回到位'], ['X7', 'FR1', '输送过载'], ['X10', 'SP1', '气压正常']];
  ins.forEach(([a, tag, d], i) => { text(20, 270 - i * 12, a, 'IO'); attrib(40, 270 - i * 12, 'TAG1', tag); text(60, 270 - i * 12, d); });
  const outs = [['Y0', 'KM1', '输送正转'], ['Y1', 'KM2', '输送反转'], ['Y2', 'KM3', '水泵'], ['Y3', 'YV1', '推料电磁阀'], ['Y4', 'HL1', '运行指示'], ['Y5', 'HL2', '故障指示']];
  outs.forEach(([a, tag, d], i) => { text(160, 270 - i * 12, a, 'IO'); attrib(180, 270 - i * 12, 'TAG1', tag); text(200, 270 - i * 12, d); });
  ents.push('0', 'MTEXT', '8', 'NOTE', '10', '20', '20', '140', '1', u('{\\fSimSun|b0;注: 急停为单回路 KA1, 控制电压 AC220V}'));
  const out = ['0', 'SECTION', '2', 'HEADER', '9', '$ACADVER', '1', 'AC1015', '0', 'ENDSEC', '0', 'SECTION', '2', 'ENTITIES', ...ents, '0', 'ENDSEC', '0', 'EOF'];
  fs.writeFileSync(path.join(DIR, 'E-03_PLC_IO.dxf'), out.join('\r\n'));
}

(async () => { await pdf(); dxf(); console.log('fixtures written to', DIR); })();
