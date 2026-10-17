/**
 * PLC tag names as the exporters write them, keyed by the app's neutral address — for HMI tag lists that
 * bind HMI screens (which keep the neutral memory: C1001, DS1001, DF101, X / Y …) to the vendor's tags.
 * Built by running the same code as the exporters (toLogix / toIecSt), so the names always match the
 * L5X / ST / SCL files, including nicknames from the HMI's extraTags.
 */
import type { LadderProgram } from './ladder';
import type { ExportContext, PlcProfile } from './profile';
import { toLogix } from './profiles/logixExport';
import { logixIoTag } from './profiles/logix';
import { toMicro800St } from './profiles/micro800';
import { buildScl } from './profiles/siemens';
import { buildUniLogicSt } from './profiles/unilogic';
import { visiOperands } from './profiles/visilogic';

export interface PlcTagName {
  /** As the PLC software shows it: 'Start_PB', 'Jam_Timer.DN', '"Machine_DB".Run', 'C1001'. */
  name: string;
  /** Where the tag lives: 'Controller' (Logix), 'Program' (Micro800 program variables), 'Machine_DB' / 'PLC tags' (S7), 'CLICK'. */
  scope: string;
  /** Vendor data type: BOOL / DINT / REAL / TIMER member types (Logix), BOOL / DINT / REAL / TIME (Micro800), Bool / DInt / Real / Time (S7). */
  dataType: string;
  /** Physical I/O behind the tag, when known (Local:1:I.Pt00.Data, _IO_EM_DI_00, %I0.0). */
  io?: string;
}

/** Every operand a program (or the HMI) uses, mapped to its exported vendor tag. */
export function plcTagNames(profile: PlcProfile, program: LadderProgram, ctx: ExportContext): Map<string, PlcTagName> {
  const out = new Map<string, PlcTagName>();
  switch (profile.id) {
    case 'logix': {
      const lx = toLogix(program, ctx, logixIoTag);
      for (const t of lx.tags) {
        if (!t.base) continue;
        const b = t.base, n = /^(T|CT)(\d+)$/.exec(b);
        if (t.dataType === 'TIMER' && n) {
          out.set(b, { name: `${t.name}.DN`, scope: 'Controller', dataType: 'BOOL' });
          out.set(`TD${n[2]}`, { name: `${t.name}.ACC`, scope: 'Controller', dataType: 'DINT' }); // milliseconds
        } else if (t.dataType === 'COUNTER' && n) {
          out.set(b, { name: `${t.name}.DN`, scope: 'Controller', dataType: 'BOOL' });
          out.set(`CTD${n[2]}`, { name: `${t.name}.ACC`, scope: 'Controller', dataType: 'DINT' });
        } else out.set(b, { name: t.name, scope: 'Controller', dataType: t.dataType, ...(t.aliasFor ? { io: t.aliasFor } : {}) });
      }
      break;
    }
    case 'micro800': {
      const st = toMicro800St(program, ctx);
      for (const v of st.variables) addIec(out, v.base, v.name, v.type, 'Program', v.io, { bool: 'BOOL', time: 'TIME', dint: 'DINT' });
      break;
    }
    case 'siemens-s7': {
      const { st, tags } = buildScl(program, ctx);
      const plc = new Map(tags.map((t) => [t.name, t]));
      for (const v of st.variables) {
        const io = plc.get(v.name);
        addIec(out, v.base, `"Machine_DB".${v.name}`, v.type, 'Machine_DB', io?.address, { bool: 'Bool', time: 'Time', dint: 'DInt' });
      }
      break;
    }
    case 'unitronics-unistream': {
      const { program: st } = buildUniLogicSt(program, ctx);
      for (const v of st.variables) {
        // Accumulating timers are emulated: the done bit and the elapsed ms are plain tags.
        const t = /^T(\d+)(_ET)?$/.exec(v.base);
        if (t && v.type !== 'TON' && v.type !== 'TOF') { out.set(t[2] ? `TD${t[1]}` : v.base, { name: v.name, scope: 'Global', dataType: v.type }); continue; }
        if (/_(TON|ACC|LAST|WAS)$/.test(v.base)) continue;
        addIec(out, v.base, v.name, v.type, 'Global', profile.ioTag?.(v.base, ctx.modules ?? []) ?? undefined, { bool: 'BOOL', time: 'TIME', dint: 'INT' });
      }
      break;
    }
    case 'unitronics-vision': {
      const map = visiOperands(program, ctx);
      for (const [b, v] of map.byBase) {
        const n = /^(T|CT)(\d+)$/.exec(b);
        const name = n && n[1] === 'T' && map.offDelay.has(b) ? map.offDelay.get(b)!.operand : v.operand;
        out.set(b, { name, scope: 'VisiLogic', dataType: v.type === 'I' || v.type === 'O' || v.type === 'SB' || v.type === 'MB' || n ? 'Bit' : v.type });
        // Timer / counter current values (a timer counts down from its preset).
        if (n) out.set(`${n[1] === 'T' ? 'TD' : 'CTD'}${n[2]}`, { name: `${v.operand} current`, scope: 'VisiLogic', dataType: n[1] === 'T' ? 'Timer' : 'Counter' });
      }
      break;
    }
    default: {
      // CLICK (and other memory-addressed PLCs): the address is the tag; nicknames come from the program / HMI.
      const nick = new Map([...ctx.extraTags, ...program.tags].map((t) => [t.address.toUpperCase(), t.nickname]));
      for (const a of new Set([...nick.keys(), ...ctx.addresses.values()].filter(Boolean))) {
        const type = profile.dataTypeOf?.(a) ?? 'BOOL';
        out.set(a.toUpperCase(), { name: a.toUpperCase(), scope: 'CLICK', dataType: type });
      }
    }
  }
  return out;
}

/** IEC block instances: T1 → .Q / TD1 → .ET, CT1 → .Q / CTD1 → .CV; plain variables as they are. */
function addIec(out: Map<string, PlcTagName>, base: string, name: string, type: string, scope: string, io: string | undefined, t: { bool: string; time: string; dint: string }) {
  const n = /^(T|CT)(\d+)$/.exec(base);
  if (n && n[1] === 'T') {
    out.set(base, { name: `${name}.Q`, scope, dataType: t.bool });
    out.set(`TD${n[2]}`, { name: `${name}.ET`, scope, dataType: t.time });
  } else if (n) {
    out.set(base, { name: `${name}.Q`, scope, dataType: t.bool });
    out.set(`CTD${n[2]}`, { name: `${name}.CV`, scope, dataType: t.dint });
  } else if (!/^(RT|FT)_\d+$|_RST$|^CLOCK_TMR$/.test(base)) out.set(base, { name, scope, dataType: type, ...(io ? { io } : {}) });
}
