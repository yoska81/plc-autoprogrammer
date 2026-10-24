/** Big programs made for tests (hundreds of parts, thousands of rungs and I/O): no customer data. */

/** PLCopen XML like a MotionWorks IEC export: POUs with their own variables, global I/O with addresses. */
export function plcopen(pous: number, io: number): string {
  const vars = (p: number) => Array.from({ length: 20 }, (_, i) => `<variable name="P${p}_v${i}"><type><BOOL/></type></variable>`).join('');
  const out = ['<?xml version="1.0" encoding="utf-8"?>\n<project xmlns="http://www.plcopen.org/xml/tc6_0201"><fileHeader companyName="Maker" productName="IEC tool"/><contentHeader name="Big"/><types><dataTypes/><pous>'];
  for (let p = 0; p < pous; p++) {
    const lines = Array.from({ length: 40 }, (_, k) => `IF P${p}_v${k % 20} AND NOT G_In${(p * 7 + k) % io} THEN G_Out${(p * 3 + k) % io} := TRUE; ELSE P${p}_v${(k + 1) % 20} := FALSE; END_IF;`);
    out.push(`<pou name="P${p}" pouType="program"><interface><localVars>${vars(p)}</localVars></interface><body><ST><xhtml xmlns="http://www.w3.org/1999/xhtml">${lines.join('\n')}</xhtml></ST></body></pou>`);
  }
  out.push('</pous></types><instances><configurations><configuration name="C"><resource name="R"><globalVars>');
  for (let i = 0; i < io; i++) out.push(`<variable name="G_In${i}" address="%IX${i >> 3}.${i % 8}"><type><BOOL/></type></variable><variable name="G_Out${i}" address="%QX${i >> 3}.${i % 8}"><type><BOOL/></type></variable>`);
  out.push('</globalVars></resource></configuration></configurations></instances></project>');
  return out.join('\n');
}

/**
 * An L5X with one program per station, each with timers, counters and alias I/O. `io` a multiple of 16 gives whole
 * 16-point modules (with another count the output aliases land on fractional slots and read as internal bits).
 */
export function l5x(programs: number, io: number): string {
  const slots = io / 16;
  const tags = Array.from({ length: io }, (_, i) => `<Tag Name="In_${i}" TagType="Alias" AliasFor="Local:${(i >> 4) + 1}:I.Data.${i % 16}"/><Tag Name="Out_${i}" TagType="Alias" AliasFor="Local:${slots + (i >> 4) + 1}:O.Data.${i % 16}"/>`);
  const mods = Array.from({ length: slots * 2 }, (_, s) => `<Module Name="M${s}" CatalogNumber="${s < slots ? '1769-IQ16/A' : '1769-OB16/A'}" ParentModule="Local"><Ports><Port Id="1" Address="${s + 1}" Type="Compact" Upstream="true"/></Ports></Module>`);
  const progs = Array.from({ length: programs }, (_, p) => {
    const rungs = Array.from({ length: 50 }, (_, r) => {
      const a = `In_${(p * 7 + r) % io}`, o = `Out_${(p * 5 + r) % io}`;
      const text = [`[XIC(${a}),XIC(Run_${r})]OTE(Run_${r});`, `XIC(Run_${r - 1})OTE(${o});`, `XIC(${a})TON(Tmr_${r},1000,0);`, `XIC(Tmr_${r - 1}.DN)CTU(Cnt_${r},10,0);`, `XIC(Cnt_${r - 1}.DN)OTE(Done_${r});`][r % 5];
      return `<Rung Number="${r}" Type="N"><Comment><![CDATA[Station ${p} step ${r}]]></Comment><Text><![CDATA[${text}]]></Text></Rung>`;
    });
    const local = Array.from({ length: 10 }, (_, k) => `<Tag Name="Run_${k * 5}" DataType="BOOL"/><Tag Name="Tmr_${k * 5 + 2}" DataType="TIMER"/><Tag Name="Cnt_${k * 5 + 3}" DataType="COUNTER"/><Tag Name="Done_${k * 5 + 4}" DataType="BOOL"/>`);
    return `<Program Name="Station_${p}" MainRoutineName="Main"><Tags>${local.join('')}</Tags><Routines><Routine Name="Main" Type="RLL"><RLLContent>${rungs.join('\n')}</RLLContent></Routine></Routines></Program>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<RSLogix5000Content SchemaRevision="1.0" TargetName="Big" TargetType="Controller"><Controller Use="Target" Name="Big" ProcessorType="1769-L33ER"><Modules><Module Name="Local" CatalogNumber="1769-L33ER" ParentModule="Local"/>${mods.join('')}</Modules><Tags>${tags.join('\n')}</Tags><Programs>${progs.join('\n')}</Programs></Controller></RSLogix5000Content>`;
}
