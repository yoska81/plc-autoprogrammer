/**
 * Studio 5000 Logix Designer .L5X writer (full controller project).
 *
 * Structure and syntax from the Logix 5000 Controllers Import/Export Reference Manual
 * (publication 1756-RM014D-EN-P, Sept 2025; Rockwell number 1756-RM084):
 * - root RSLogix5000Content (SchemaRevision, SoftwareRevision, TargetName, TargetType="Controller",
 *   ContainsContext="false", ExportDate "Ddd Mmm DD HH:MM:SS YYYY") — p38;
 * - Controller Use="Target" with children in the prescribed order RedundancyInfo, Security, SafetyInfo,
 *   DataTypes, Tags, Programs, Tasks (p53–63; "Tags must be defined after modules", "Tasks must be
 *   defined after programs");
 * - Tag Name / TagType="Base" / DataType / Radix, Description CDATA, Data Format="Decorated"
 *   (DataValue for BOOL / DINT / REAL, Structure + DataValueMember for TIMER / COUNTER) — p42–46, p122–129;
 * - Program › Tags › Routines › Routine Type="RLL" › RLLContent › Rung Number Type="N" › Comment CDATA,
 *   Text CDATA "rung;" — p194–210; Task with ScheduledPrograms — p312–315.
 * Not shown in the manual and therefore inferred (stated in the export notes): ProcessorType for 5069
 * controllers (the catalog number), MajorRev / SoftwareRevision 33 (before the v36 mnemonic renames),
 * the CONTINUOUS task in L5X, decorated COUNTER members (from the COUNTER structure, 1756-RM003).
 * I/O points are Base tags here; the 5069 module points they map to are in each tag's description and
 * in the I/O mapping file (logixIoMapping), applied after the modules are added in Studio 5000.
 */
import type { LadderProgram } from '../ladder';
import type { ExportContext } from '../profile';
import { logixIoTag, LOGIX_CPUS } from './logix';
import { toLogix, type LogixTag } from './logixExport';

export const L5X_REVISION = { major: 33, minor: 11, software: '33.11' };

export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const cdata = (s: string) => `<![CDATA[${s.replace(/]]>/g, ']]]]><![CDATA[>')}]]>`;

/** "Mon May 19 08:26:42 2014" (manual p38). */
export function l5xDate(d: Date): string {
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()];
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()];
  const p = (n: number) => String(n).padStart(2, '0');
  return `${day} ${mon} ${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())} ${d.getUTCFullYear()}`;
}

export function tagXml(t: LogixTag, ind: string): string {
  const text = t.aliasFor ? `${t.description} — module point ${t.aliasFor}` : t.description;
  const desc = text ? `\n${ind}  <Description>${cdata(text)}</Description>` : '';
  const member = (name: string, type: 'DINT' | 'BOOL', v = '0') => `${ind}      <DataValueMember Name="${name}" DataType="${type}"${type === 'DINT' ? ' Radix="Decimal"' : ''} Value="${v}"/>`;
  let data: string;
  switch (t.dataType) {
    case 'BOOL': data = `${ind}    <DataValue DataType="BOOL" Radix="Decimal" Value="0"/>`; break;
    case 'DINT': data = `${ind}    <DataValue DataType="DINT" Radix="Decimal" Value="0"/>`; break;
    case 'REAL': data = `${ind}    <DataValue DataType="REAL" Radix="Float" Value="0.0"/>`; break;
    case 'TIMER':
      data = [`${ind}    <Structure DataType="TIMER">`, member('PRE', 'DINT'), member('ACC', 'DINT'), member('EN', 'BOOL'), member('TT', 'BOOL'), member('DN', 'BOOL'), `${ind}    </Structure>`].join('\n');
      break;
    case 'COUNTER':
      data = [`${ind}    <Structure DataType="COUNTER">`, member('PRE', 'DINT'), member('ACC', 'DINT'), member('CU', 'BOOL'), member('CD', 'BOOL'), member('DN', 'BOOL'), member('OV', 'BOOL'), member('UN', 'BOOL'), `${ind}    </Structure>`].join('\n');
      break;
  }
  const radix = t.dataType === 'REAL' ? ' Radix="Float"' : t.dataType === 'BOOL' || t.dataType === 'DINT' ? ' Radix="Decimal"' : '';
  return `${ind}<Tag Name="${esc(t.name)}" TagType="Base" DataType="${t.dataType}"${radix} Constant="false" ExternalAccess="Read/Write">${desc}
${ind}  <Data Format="Decorated">
${data}
${ind}  </Data>
${ind}</Tag>`;
}

/** Full-controller L5X of the program. */
export function buildL5x(program: LadderProgram, ctx: ExportContext): string {
  const lx = toLogix(program, ctx, logixIoTag);
  const cpu = LOGIX_CPUS.find((c) => c.id === ctx.cpuId) ?? LOGIX_CPUS[1];
  const name = (ctx.projectName || 'Machine').replace(/[^A-Za-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').replace(/^(\d)/, 'P_$1').slice(0, 40) || 'Machine';
  const date = l5xDate(ctx.now ?? new Date());
  const routines = lx.routines.map((r) => {
    const rungs = r.rungs.map((g, i) => [
      `            <Rung Number="${i}" Type="N">`,
      ...(g.comment ? [`              <Comment>${cdata(g.comment)}</Comment>`] : []),
      `              <Text>${cdata(g.text)}</Text>`,
      '            </Rung>',
    ].join('\n')).join('\n');
    return `        <Routine Name="${esc(r.name)}" Type="RLL">\n          <RLLContent>\n${rungs}\n          </RLLContent>\n        </Routine>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<RSLogix5000Content SchemaRevision="1.0" SoftwareRevision="${L5X_REVISION.software}" TargetName="${esc(name)}" TargetType="Controller" ContainsContext="false" ExportDate="${date}" ExportOptions="DecoratedData">
  <Controller Use="Target" Name="${esc(name)}" ProcessorType="${esc(cpu.id)}" MajorRev="${L5X_REVISION.major}" MinorRev="${L5X_REVISION.minor}" TimeSlice="20" ShareUnusedTimeSlice="1" ProjectCreationDate="${date}" LastModifiedDate="${date}" SFCExecutionControl="CurrentActive" SFCRestartPosition="MostRecent" SFCLastScan="DontScan" MatchProjectToController="false" InhibitAutomaticFirmwareUpdate="0">
    <Description>${cdata(ctx.header)}</Description>
    <RedundancyInfo Enabled="false" KeepTestEditsOnSwitchOver="false" IOMemoryPadPercentage="90" DataTablePadPercentage="50"/>
    <Security Code="0" ChangesToDetect="16#ffff_ffff_ffff_ffff"/>
    <SafetyInfo/>
    ${lx.decls.dataTypes.length ? `<DataTypes>\n${lx.decls.dataTypes.join('\n')}\n    </DataTypes>` : '<DataTypes/>'}${lx.decls.aois.length ? `\n    <AddOnInstructionDefinitions>\n${lx.decls.aois.join('\n')}\n    </AddOnInstructionDefinitions>` : ''}
    <Tags>
${[...lx.tags.map((t) => tagXml(t, '      ')), ...lx.decls.tags].join('\n')}
    </Tags>
    <Programs>
      <Program Name="MainProgram" TestEdits="false" MainRoutineName="MainRoutine" Disabled="false" UseAsFolder="false">
        <Tags/>
        <Routines>
${routines}
        </Routines>
      </Program>
    </Programs>
    <Tasks>
      <Task Name="MainTask" Type="CONTINUOUS" Priority="10" Watchdog="500" DisableUpdateOutputs="false" InhibitTask="false">
        <ScheduledPrograms>
          <ScheduledProgram Name="MainProgram"/>
        </ScheduledPrograms>
      </Task>
    </Tasks>
  </Controller>
</RSLogix5000Content>
`;
}

/**
 * I/O mapping for after the 5069 modules are configured in Studio 5000: alias records for the
 * Logix tag CSV import (Tools › Import › Tags and Logic Comments; record format manual ch. 21:
 * ALIAS,"Scope","Name","Description","Datatype","Specifier","Attributes") and, as an alternative,
 * the buffering rungs to paste into an IO_Mapping routine.
 */
export function logixIoMapping(program: LadderProgram, ctx: ExportContext): string {
  const lx = toLogix(program, ctx, logixIoTag);
  const io = lx.tags.filter((t) => t.aliasFor);
  const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const lines = [
    'REMARK,"I/O mapping for the generated Studio 5000 project (CompactLogix 5380 + Compact 5000 I/O)."',
    `REMARK,${q(ctx.header)}`,
    'REMARK,"1. Add the 5069 modules in the slots listed below (I/O Configuration). 2. Either delete the Base tags of these names and import this file as aliases, or paste the IO_Mapping rungs at the end of this file into a routine called first from MainRoutine."',
    ...io.map((t) => `ALIAS,"",${q(t.name)},${q(t.description)},"",${q(t.aliasFor!)},""`),
    'REMARK,"IO_Mapping rungs (neutral text):"',
    ...io.map((t) => {
      const isIn = /:I\./.test(t.aliasFor!);
      const text = t.dataType === 'REAL' ? (isIn ? `MOV(${t.aliasFor},${t.name});` : `MOV(${t.name},${t.aliasFor});`) : (isIn ? `XIC(${t.aliasFor})OTE(${t.name});` : `XIC(${t.name})OTE(${t.aliasFor});`);
      return `REMARK,${q(text)}`;
    }),
  ];
  return lines.join('\r\n') + '\r\n';
}
