/**
 * "Machine" column of the simulator: every simulated field device as a card
 * with a small animated drawing. Pure view: all state comes from the snapshot,
 * all interaction goes through the callbacks.
 */
import type {
  AnalogInDevice, AnalogOutDevice, ConveyorDevice, CylinderDevice, EstopDevice, IndicatorDevice, LightColor, MotorDevice,
  PushbuttonDevice, SafetyRelayDevice, SelectorDevice, SensorDevice, SimDevice, StackLightDevice,
} from './machineModel';
import { PART_END } from './machineModel';

export interface MachineActions {
  press(id: string, pressed: boolean): void;
  toggle(id: string): void;
  addPart(id: string): void;
  removePart(id: string): void;
  /** Bypass a device (healthy without the plant model); value = held input value. */
  setBypass(id: string, on: boolean, value?: boolean): void;
  /** Move an analog input (engineering units). */
  setAnalog?(id: string, value: number): void;
  /** Trip / reset a drive (fault injection). */
  setDriveFault?(motorId: string, faulted: boolean): void;
}

interface Props {
  devices: SimDevice[];
  bits: Map<string, boolean>;
  inputs: Map<string, boolean>;
  actions: MachineActions;
  /** Word memory (analog outputs are read from their DF registers). */
  words?: Map<string, number>;
  /** Only show these device ids (block view); null/undefined = all. */
  visible?: Set<string> | null;
}

const LIGHT: Record<LightColor, { on: string; off: string; glow: string }> = {
  red: { on: '#ef4444', off: '#fecaca', glow: 'rgba(239,68,68,0.55)' },
  amber: { on: '#f59e0b', off: '#fde68a', glow: 'rgba(245,158,11,0.55)' },
  green: { on: '#22c55e', off: '#bbf7d0', glow: 'rgba(34,197,94,0.55)' },
  blue: { on: '#3b82f6', off: '#bfdbfe', glow: 'rgba(59,130,246,0.55)' },
  white: { on: '#f8fafc', off: '#e2e8f0', glow: 'rgba(148,163,184,0.7)' },
};
const BUTTON_FILL: Record<PushbuttonDevice['color'], string> = {
  red: '#dc2626', amber: '#d97706', green: '#16a34a', blue: '#2563eb', white: '#e2e8f0', black: '#334155',
};

// ------------------------------------------------------------ small parts

function Led({ on, color = 'green', size = 10 }: { on: boolean; color?: LightColor; size?: number }) {
  const c = LIGHT[color];
  return (
    <span
      className="inline-block shrink-0 rounded-full border border-black/10 transition-colors"
      style={{ width: size, height: size, background: on ? c.on : '#e2e8f0', boxShadow: on ? `0 0 6px 1px ${c.glow}` : undefined }}
    />
  );
}

function AddrChip({ address, on, kind }: { address: string; on: boolean; kind: 'in' | 'out' }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-px font-mono text-[10.5px] font-semibold ${
        on ? (kind === 'in' ? 'bg-brand-100 text-brand-800' : 'bg-emerald-100 text-emerald-800') : 'bg-steel-100 text-steel-500'
      }`}
      title={`${address} is ${on ? 'ON' : 'OFF'}`}
    >
      <Led on={on} color={kind === 'in' ? 'blue' : 'green'} size={7} />
      {address}
    </span>
  );
}

const BYPASS_HELP: Partial<Record<SimDevice['kind'], string>> = {
  cylinder: 'Bypass: the position sensors follow the solenoid instantly',
  motor: 'Bypass: the running feedback follows the command instantly',
  estop: 'Bypass: the E-stop contact always reads healthy',
  safetyRelay: 'Bypass: the safety relay always reads OK',
  conveyor: 'Bypass: hold the conveyor sensors at a chosen value',
  sensor: 'Bypass: hold the sensor at a chosen value',
  pushbutton: 'Bypass: hold the button input at a chosen value',
  selector: 'Bypass: hold the selector input at a chosen value',
};
const HAS_VALUE = new Set<SimDevice['kind']>(['sensor', 'pushbutton', 'selector', 'conveyor']);

/** "Bypass" button, or the amber BYPASSED state with an optional held value. */
function BypassControl({ d, onSet }: { d: SimDevice; onSet: MachineActions['setBypass'] }) {
  const b = d.bypass;
  if (!b) return null;
  if (!b.on) {
    return (
      <button type="button" onClick={() => onSet(d.id, true)} title={BYPASS_HELP[d.kind]}
        className="rounded border border-steel-300 bg-white px-1.5 py-px text-[10.5px] font-semibold text-steel-500 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-700">
        Bypass
      </button>
    );
  }
  const seg = (v: boolean) => `px-1.5 py-px text-[10px] font-bold ${b.value === v ? 'bg-amber-500 text-amber-950' : 'bg-white text-amber-700 hover:bg-amber-50'}`;
  return (
    <span className="inline-flex items-center gap-1">
      <button type="button" onClick={() => onSet(d.id, false)} title="Remove the bypass"
        className="rounded bg-amber-500 px-1.5 py-px text-[10.5px] font-bold text-amber-950 hover:bg-amber-600">
        BYPASSED ✕
      </button>
      {HAS_VALUE.has(d.kind) && (
        <span className="inline-flex overflow-hidden rounded border border-amber-400" title="Held input value">
          <button type="button" className={seg(true)} onClick={() => onSet(d.id, true, true)}>ON</button>
          <button type="button" className={`${seg(false)} border-l border-amber-400`} onClick={() => onSet(d.id, true, false)}>OFF</button>
        </span>
      )}
    </span>
  );
}

function Card({ title, tag, children, accent, bypass }: {
  title: string; tag?: string; children: React.ReactNode; accent?: string; bypass?: { d: SimDevice; onSet: MachineActions['setBypass'] };
}) {
  const on = !!bypass?.d.bypass?.on;
  return (
    <section className={`rounded-lg border bg-white shadow-sm ${on ? 'border-amber-400 ring-1 ring-amber-300' : accent ?? 'border-steel-200'}`}>
      <header className={`flex items-center gap-2 border-b px-3 py-1.5 ${on ? 'border-amber-200 bg-amber-50' : 'border-steel-100'}`}>
        <h3 className="min-w-0 flex-1 truncate text-[13px] font-semibold text-steel-800" title={title}>{title}</h3>
        {tag && <span className="rounded bg-steel-100 px-1.5 py-px font-mono text-[10px] text-steel-500">{tag}</span>}
        {bypass && <BypassControl d={bypass.d} onSet={bypass.onSet} />}
      </header>
      <div className="px-3 py-2">{children}</div>
    </section>
  );
}

// ------------------------------------------------------------ operator station

function EstopControl({ d, inputs, onToggle }: { d: EstopDevice; inputs: Map<string, boolean>; onToggle: () => void }) {
  const p = d.state.pressed;
  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={onToggle}
        title={p ? 'E-stop pressed: click to twist-release' : 'Click to press the E-stop (latches)'}
        aria-pressed={p}
        className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
      >
        <svg width="64" height="64" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="31" fill="#facc15" stroke="#a16207" strokeWidth="1" />
          <circle cx="32" cy="32" r={p ? 19 : 22} fill="#b91c1c" />
          <circle cx="32" cy="32" r={p ? 16 : 19} fill={p ? '#991b1b' : '#dc2626'} />
          {!p && <ellipse cx="26" cy="24" rx="7" ry="4" fill="white" opacity="0.25" />}
        </svg>
      </button>
      <span className="max-w-[88px] text-center text-[12px] font-medium leading-tight text-steel-700">{d.label}</span>
      <span className={`rounded px-1.5 text-[10px] font-bold ${p ? 'bg-red-600 text-white' : 'bg-steel-100 text-steel-500'}`}>
        {p ? 'PRESSED' : 'released'}
      </span>
      {d.input && <AddrChip address={d.input} on={inputs.get(d.input) ?? false} kind="in" />}
    </div>
  );
}

function PushbuttonControl({ d, inputs, onPress }: { d: PushbuttonDevice; inputs: Map<string, boolean>; onPress: (p: boolean) => void }) {
  const p = d.state.pressed;
  const fill = BUTTON_FILL[d.color];
  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        title={`Press and hold (${d.nc ? 'NC contact: input is ON until pressed' : 'NO contact'})`}
        aria-pressed={p}
        className="touch-none select-none rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        onPointerDown={(e) => { try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* synthetic event */ } onPress(true); }}
        onPointerUp={() => onPress(false)}
        onPointerCancel={() => onPress(false)}
        onKeyDown={(e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); onPress(true); } }}
        onKeyUp={(e) => { if (e.key === ' ' || e.key === 'Enter') onPress(false); }}
      >
        <svg width="56" height="56" viewBox="0 0 56 56">
          <circle cx="28" cy="28" r="27" fill="#cbd5e1" stroke="#64748b" strokeWidth="1" />
          <circle cx="28" cy="28" r="22" fill="#94a3b8" />
          <circle cx="28" cy={p ? 29 : 27} r={p ? 17 : 19} fill={fill} stroke="rgba(0,0,0,0.25)" strokeWidth="1" />
          {!p && <ellipse cx="23" cy="21" rx="6" ry="3.5" fill="white" opacity="0.3" />}
        </svg>
      </button>
      <span className="max-w-[88px] text-center text-[12px] font-medium leading-tight text-steel-700">{d.label}</span>
      <span className="text-[10px] text-steel-400">{d.nc ? 'NC' : 'NO'} · hold</span>
      <AddrChip address={d.input} on={inputs.get(d.input) ?? false} kind="in" />
    </div>
  );
}

function SelectorControl({ d, inputs, onToggle }: { d: SelectorDevice; inputs: Map<string, boolean>; onToggle: () => void }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <button type="button" onClick={onToggle} title="Click to switch" className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400">
        <svg width="56" height="56" viewBox="0 0 56 56">
          <circle cx="28" cy="28" r="27" fill="#cbd5e1" stroke="#64748b" strokeWidth="1" />
          <circle cx="28" cy="28" r="20" fill="#1e293b" />
          <g transform={`rotate(${d.state.on ? 45 : -45} 28 28)`} style={{ transition: 'transform 150ms' }}>
            <rect x="24" y="10" width="8" height="36" rx="3" fill="#f1f5f9" />
          </g>
        </svg>
      </button>
      <span className="max-w-[88px] text-center text-[12px] font-medium leading-tight text-steel-700">{d.label}</span>
      <span className="text-[10px] text-steel-400">{d.state.on ? 'ON' : 'OFF'}</span>
      <AddrChip address={d.input} on={inputs.get(d.input) ?? false} kind="in" />
    </div>
  );
}

function SafetyRelayStatus({ d, inputs, onSet, onReset }: { d: SafetyRelayDevice; inputs: Map<string, boolean>; onSet: MachineActions['setBypass']; onReset: () => void }) {
  const ok = inputs.get(d.input) ?? false;
  const byp = !!d.bypass?.on;
  return (
    <div className={`flex flex-wrap items-center gap-2 rounded-md border px-2 py-1.5 ${byp ? 'border-amber-400 bg-amber-50' : ok ? 'border-emerald-200 bg-emerald-50' : 'border-red-300 bg-red-50'}`}>
      <Led on color={ok ? 'green' : 'red'} size={12} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[11.5px] font-semibold text-steel-700">{d.label}{d.tag ? ` (${d.tag})` : ''}</div>
        <div className={`text-[10.5px] font-bold ${byp ? 'text-amber-700' : ok ? 'text-emerald-700' : 'text-red-700'}`}>{byp ? 'BYPASSED: reads OK' : ok ? 'SAFETY OK' : d.state.ok ? 'SAFETY TRIPPED (E-stop)' : 'SAFETY TRIPPED: release the E-stop, then Reset'}</div>
      </div>
      {!ok && !byp && (
        <button onClick={onReset} title="Manual reset of the safety relay (or press the Reset button)" className="rounded border border-steel-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-steel-700 hover:bg-steel-50">Reset relay</button>
      )}
      <AddrChip address={d.input} on={ok} kind="in" />
      <BypassControl d={d} onSet={onSet} />
    </div>
  );
}

function OperatorStation({ devices, inputs, actions }: { devices: SimDevice[]; inputs: Map<string, boolean>; actions: MachineActions }) {
  const relays = devices.filter((d): d is SafetyRelayDevice => d.kind === 'safetyRelay');
  const controls = devices.filter((d) => d.kind === 'estop' || d.kind === 'pushbutton' || d.kind === 'selector');
  if (!relays.length && !controls.length) return null;
  const tripped = devices.some((d) => d.kind === 'estop' && d.state.pressed);
  return (
    <Card title="Operator station" accent={tripped ? 'border-red-300' : undefined}>
      <div className="space-y-2">
        {relays.map((d) => <SafetyRelayStatus key={d.id} d={d} inputs={inputs} onSet={actions.setBypass} onReset={() => actions.toggle(d.id)} />)}
        <div className="flex flex-wrap justify-around gap-x-1 gap-y-2 pt-1">
          {controls.map((d) => {
            let ctl: React.ReactNode = null;
            if (d.kind === 'estop') ctl = <EstopControl d={d} inputs={inputs} onToggle={() => actions.toggle(d.id)} />;
            else if (d.kind === 'pushbutton') ctl = <PushbuttonControl d={d} inputs={inputs} onPress={(p) => actions.press(d.id, p)} />;
            else if (d.kind === 'selector') ctl = <SelectorControl d={d} inputs={inputs} onToggle={() => actions.toggle(d.id)} />;
            return (
              <div key={d.id} className={`flex flex-col items-center gap-1 rounded-md px-1 py-1 ${d.bypass?.on ? 'bg-amber-50 ring-1 ring-amber-400' : ''}`}>
                {ctl}
                <BypassControl d={d} onSet={actions.setBypass} />
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

// ------------------------------------------------------------ machine devices

function MotorIcon({ running, angle, size = 40 }: { running: boolean; angle: number; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-label={running ? 'motor running' : 'motor stopped'}>
      <circle cx="20" cy="20" r="18" fill={running ? '#dcfce7' : '#f1f5f9'} stroke={running ? '#16a34a' : '#94a3b8'} strokeWidth="2" />
      <g transform={`rotate(${angle} 20 20)`}>
        {[0, 120, 240].map((a) => (
          <path key={a} d="M20 20 C 17 13, 19 7, 24 6 C 25 11, 23 16, 20 20 Z" fill={running ? '#16a34a' : '#94a3b8'} transform={`rotate(${a} 20 20)`} />
        ))}
      </g>
      <circle cx="20" cy="20" r="3" fill="#334155" />
    </svg>
  );
}

/** VFD status under a motor: output frequency, direction, fault, and fault injection. */
function DriveStatus({ d, bits, inputs, onFault }: { d: MotorDevice; bits: Map<string, boolean>; inputs: Map<string, boolean>; onFault?: MachineActions['setDriveFault'] }) {
  const dr = d.drive!;
  const hz = dr.state.hz;
  const pct = Math.min(100, (Math.abs(hz) / dr.maxHz) * 100);
  return (
    <div className="mt-1.5 rounded border border-steel-200 bg-steel-50 px-2 py-1.5">
      <div className="flex items-center gap-2 text-[11px]">
        <span className="font-semibold text-steel-600">VFD</span>
        <span className={`font-mono font-bold ${dr.state.faulted ? 'text-red-700' : 'text-steel-800'}`}>{dr.state.faulted ? 'FAULT' : `${hz < 0 ? 'REV ' : ''}${Math.abs(hz).toFixed(1)} Hz`}</span>
        <div className="h-1.5 flex-1 overflow-hidden rounded bg-steel-200"><div className={`h-full ${dr.state.faulted ? 'bg-red-500' : 'bg-brand-600'}`} style={{ width: `${pct}%` }} /></div>
        <span className="text-[10px] text-steel-400">0–{dr.maxHz} Hz</span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-1">
        {dr.reverseOutput && <AddrChip address={dr.reverseOutput} on={bits.get(dr.reverseOutput) ?? false} kind="out" />}
        {dr.presetOutputs.map((a) => <AddrChip key={a} address={a} on={bits.get(a) ?? false} kind="out" />)}
        {dr.speedRef && <span className="font-mono text-[10px] text-steel-500">{dr.speedRef} ref</span>}
        {dr.faultInput && <AddrChip address={dr.faultInput} on={inputs.get(dr.faultInput) ?? false} kind="in" />}
        {onFault && (
          <button type="button" onClick={() => onFault(d.id, !dr.state.faulted)}
            className={`ml-auto whitespace-nowrap rounded border px-2 py-0.5 text-[11px] font-medium ${dr.state.faulted ? 'border-steel-300 bg-white text-steel-700 hover:bg-steel-50' : 'border-red-300 bg-white text-red-700 hover:bg-red-50'}`}>
            {dr.state.faulted ? 'Reset drive' : 'Trip drive'}
          </button>
        )}
      </div>
      <div className="mt-0.5 text-[10px] text-steel-400">{dr.speedRef ? `speed from ${dr.speedRef} (${dr.refUnits})` : dr.presetOutputs.length ? 'preset speeds' : 'full speed (keypad)'} · ramp {dr.accelS} s to {dr.maxHz} Hz · fault coasts to stop</div>
    </div>
  );
}

function MotorCard({ d, bits, inputs, onSet, onFault }: { d: MotorDevice; bits: Map<string, boolean>; inputs: Map<string, boolean>; onSet: MachineActions['setBypass']; onFault?: MachineActions['setDriveFault'] }) {
  const on = bits.get(d.output) ?? false;
  return (
    <Card title={d.label} tag={d.tag} bypass={{ d, onSet }}>
      <div className="flex items-center gap-3">
        <MotorIcon running={d.state.running} angle={d.state.angle} />
        <div className="flex-1">
          <div className={`text-sm font-bold ${d.state.running ? 'text-emerald-700' : 'text-steel-400'}`}>{d.state.running ? 'RUNNING' : 'STOPPED'}</div>
          <div className="mt-1 flex flex-wrap gap-1">
            <AddrChip address={d.output} on={on} kind="out" />
            {d.feedbackInput && <AddrChip address={d.feedbackInput} on={inputs.get(d.feedbackInput) ?? false} kind="in" />}
          </div>
        </div>
      </div>
      {d.drive && <DriveStatus d={d} bits={bits} inputs={inputs} onFault={onFault} />}
    </Card>
  );
}

function CylinderDrawing({ d }: { d: CylinderDevice }) {
  const stroke = 60;
  const rod = 10 + d.state.pos * stroke;
  return (
    <svg width="100%" viewBox="0 0 200 44" className="block max-h-[64px]">
      {/* barrel */}
      <rect x="4" y="10" width="80" height="24" rx="3" fill="#e2e8f0" stroke="#64748b" strokeWidth="1.5" />
      <rect x="6" y="14" width="10" height="16" fill="#94a3b8" />
      {/* piston + rod */}
      <rect x={12 + d.state.pos * 64} y="12" width="6" height="20" fill="#475569" />
      <rect x="84" y="19" width={rod} height="6" fill="#94a3b8" stroke="#475569" strokeWidth="1" />
      <rect x={84 + rod} y="12" width="8" height="20" rx="2" fill="#f59e0b" stroke="#b45309" strokeWidth="1" />
      {/* end-of-stroke marks */}
      <line x1="94" y1="38" x2="94" y2="42" stroke="#94a3b8" />
      <line x1={94 + stroke} y1="38" x2={94 + stroke} y2="42" stroke="#94a3b8" />
    </svg>
  );
}

function CylinderCard({ d, bits, inputs, onSet }: { d: CylinderDevice; bits: Map<string, boolean>; inputs: Map<string, boolean>; onSet: MachineActions['setBypass'] }) {
  const pos = d.state.pos;
  const status = pos >= 0.999 ? 'EXTENDED' : pos <= 0.001 ? 'RETRACTED' : 'MOVING';
  return (
    <Card title={`${d.label} cylinder`} tag={d.tag} bypass={{ d, onSet }}>
      <CylinderDrawing d={d} />
      <div className="mt-1 flex flex-wrap items-center gap-1">
        <span className={`mr-1 text-[11px] font-bold ${status === 'EXTENDED' ? 'text-amber-700' : status === 'MOVING' ? 'text-brand-800' : 'text-steel-500'}`}>{status}</span>
        <span className="text-[10px] text-steel-400">sol</span>
        <AddrChip address={d.extendOutput} on={bits.get(d.extendOutput) ?? false} kind="out" />
        {d.retractOutput && <AddrChip address={d.retractOutput} on={bits.get(d.retractOutput) ?? false} kind="out" />}
        {(d.extendedInput || d.retractedInput) && <span className="ml-1 text-[10px] text-steel-400">sensors</span>}
        {d.retractedInput && <AddrChip address={d.retractedInput} on={inputs.get(d.retractedInput) ?? false} kind="in" />}
        {d.extendedInput && <AddrChip address={d.extendedInput} on={inputs.get(d.extendedInput) ?? false} kind="in" />}
      </div>
      <div className="mt-0.5 text-[10px] text-steel-400">
        {d.retractOutput ? 'double solenoid' : 'spring return'} · {d.bypass?.on ? 'bypassed: sensors follow the valve' : d.state.pos > 0 && d.state.pos < 1 ? `${Math.round(pos * 100)} %` : `${d.travelMs} ms stroke`}
      </div>
    </Card>
  );
}

function ConveyorCard({ d, devices, bits, inputs, actions }: {
  d: ConveyorDevice; devices: SimDevice[]; bits: Map<string, boolean>; inputs: Map<string, boolean>; actions: MachineActions;
}) {
  const motor = devices.find((x): x is MotorDevice => x.id === d.motorId && x.kind === 'motor');
  const pusher = devices.find((x): x is CylinderDevice => x.id === d.pusherId && x.kind === 'cylinder');
  const running = !!motor?.state.running;
  const W = 300, x0 = 14, x1 = 286, beltY = 70, beltH = 14;
  const xOf = (pos: number) => x0 + pos * (x1 - x0);
  const cleats = Array.from({ length: 14 }, (_, i) => x0 + ((i / 14 + d.state.belt) % 1) * (x1 - x0));
  const pushX = xOf(PART_END);
  const rodLen = 6 + (pusher?.state.pos ?? 0) * 36;
  return (
    <Card title={/conveyor|belt/i.test(d.label) ? d.label : `${d.label} conveyor`} tag={motor?.tag} bypass={{ d, onSet: actions.setBypass }}>
      <svg width="100%" viewBox={`0 0 ${W} 100`} className="mx-auto block max-h-[150px]">
        {/* pusher above the end of the belt */}
        {pusher && (
          <g>
            <rect x={pushX - 13} y="2" width="26" height="16" rx="2" fill="#e2e8f0" stroke="#64748b" />
            <rect x={pushX - 3} y="18" width="6" height={rodLen} fill="#94a3b8" stroke="#475569" strokeWidth="0.8" />
            <rect x={pushX - 13} y={18 + rodLen} width="26" height="5" rx="1" fill="#f59e0b" stroke="#b45309" strokeWidth="0.8" />
            <text x={pushX - 17} y="13" fontSize="8" textAnchor="end" fill="#64748b">{pusher.label}</text>
          </g>
        )}
        {/* sensors: beam across the part path */}
        {d.sensors.map((s) => {
          const on = inputs.get(s.input) ?? false;
          const x = xOf(s.position);
          return (
            <g key={s.input}>
              <rect x={x - 4} y={beltY - 40} width="8" height="6" rx="1" fill={on ? '#1a4fc6' : '#64748b'} />
              <line x1={x} y1={beltY - 34} x2={x} y2={beltY - 1} stroke={on ? '#1a4fc6' : '#f87171'} strokeWidth={on ? 2 : 1} strokeDasharray={on ? undefined : '3 2'} />
            </g>
          );
        })}
        {/* parts */}
        {d.state.parts.map((p) => (
          <g key={p.id}>
            <rect x={xOf(p.pos) - 13} y={beltY - 24} width="26" height="23" rx="2" fill="#fb923c" stroke="#c2410c" strokeWidth="1.2" />
            <line x1={xOf(p.pos) - 13} y1={beltY - 15} x2={xOf(p.pos) + 13} y2={beltY - 15} stroke="#c2410c" strokeWidth="0.8" opacity="0.6" />
          </g>
        ))}
        {/* belt */}
        <rect x={x0 - 8} y={beltY} width={x1 - x0 + 16} height={beltH} rx={beltH / 2} fill="#334155" />
        <clipPath id={`belt-${d.id}`}><rect x={x0} y={beltY} width={x1 - x0} height={beltH} /></clipPath>
        <g clipPath={`url(#belt-${d.id})`}>
          {cleats.map((x, i) => <rect key={i} x={x} y={beltY + 1} width="3" height={beltH - 2} fill="#64748b" />)}
        </g>
        <circle cx={x0} cy={beltY + beltH / 2} r="5" fill="#94a3b8" stroke="#1e293b" />
        <circle cx={x1} cy={beltY + beltH / 2} r="5" fill="#94a3b8" stroke="#1e293b" />
        {running && <text x={W / 2} y={beltY + beltH + 11} fontSize="9" textAnchor="middle" fill="#16a34a">→ moving →</text>}
      </svg>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        {motor && <MotorIcon running={running} angle={motor.state.angle} size={28} />}
        <div className="flex flex-1 flex-wrap items-center gap-1">
          <span className={`mr-1 text-[11px] font-bold ${running ? 'text-emerald-700' : 'text-steel-400'}`}>{running ? 'RUNNING' : 'STOPPED'}</span>
          {motor && <AddrChip address={motor.output} on={bits.get(motor.output) ?? false} kind="out" />}
          {motor?.feedbackInput && <AddrChip address={motor.feedbackInput} on={inputs.get(motor.feedbackInput) ?? false} kind="in" />}
        </div>
        {motor?.bypass && <span className="flex items-center gap-1 text-[10.5px] text-steel-500">motor <BypassControl d={motor} onSet={actions.setBypass} /></span>}
      </div>
      {motor?.drive && <DriveStatus d={motor} bits={bits} inputs={inputs} onFault={actions.setDriveFault} />}
      <ul className="mt-1 space-y-0.5">
        {d.sensors.map((s) => (
          <li key={s.input} className="flex items-center gap-1.5 text-[11px] text-steel-600">
            <AddrChip address={s.input} on={inputs.get(s.input) ?? false} kind="in" />
            <span className="truncate">{s.label}</span>
          </li>
        ))}
      </ul>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <button type="button" onClick={() => actions.addPart(d.id)} className="whitespace-nowrap rounded border border-steel-300 bg-white px-2 py-0.5 text-[11px] font-medium text-steel-700 hover:bg-steel-50">+ Add part</button>
        <button type="button" onClick={() => actions.removePart(d.id)} disabled={!d.state.parts.length} className="whitespace-nowrap rounded border border-steel-300 bg-white px-2 py-0.5 text-[11px] font-medium text-steel-700 hover:bg-steel-50 disabled:opacity-40">Remove part</button>
        <span className="ml-auto whitespace-nowrap text-[10.5px] text-steel-500"><b className="text-steel-700">{d.state.removed}</b> parts done</span>
      </div>
      <div className="mt-0.5 text-[10px] text-steel-400">A part is loaded every {d.spawnEveryMs / 1000} s of belt running; {d.travelMs / 1000} s end to end.</div>
    </Card>
  );
}

function SensorsCard({ sensors, inputs, onToggle, onSet }: { sensors: SensorDevice[]; inputs: Map<string, boolean>; onToggle: (id: string) => void; onSet: MachineActions['setBypass'] }) {
  return (
    <Card title="Sensors (click to trigger)">
      <ul className="space-y-1">
        {sensors.map((s) => {
          const on = inputs.get(s.input) ?? false;
          return (
            <li key={s.id} className={`flex items-center gap-1.5 rounded ${s.bypass?.on ? 'bg-amber-50 p-1 ring-1 ring-amber-400' : ''}`}>
              <button
                type="button"
                onClick={() => onToggle(s.id)}
                disabled={!!s.bypass?.on}
                className={`flex min-w-0 flex-1 items-center gap-2 rounded border px-2 py-1 text-left text-[12px] disabled:cursor-not-allowed ${on ? 'border-brand-300 bg-brand-50' : 'border-steel-200 bg-white hover:bg-steel-50'}`}
              >
                <Led on={on} color="blue" />
                <span className="min-w-0 flex-1 truncate text-steel-700">{s.label}</span>
                <span className="font-mono text-[10.5px] text-steel-500">{s.input}</span>
              </button>
              <BypassControl d={s} onSet={onSet} />
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function IndicatorsCard({ items, bits }: { items: IndicatorDevice[]; bits: Map<string, boolean> }) {
  return (
    <Card title="Indicators">
      <div className="flex flex-wrap gap-3">
        {items.map((d) => {
          const on = bits.get(d.output) ?? false;
          const c = LIGHT[d.color];
          return (
            <div key={d.id} className="flex w-[84px] flex-col items-center gap-1 text-center">
              {d.style === 'buzzer' ? (
                <svg width="30" height="30" viewBox="0 0 30 30">
                  <circle cx="15" cy="15" r="13" fill={on ? '#fde68a' : '#f1f5f9'} stroke="#64748b" />
                  <circle cx="15" cy="15" r="4" fill="#334155" />
                  {on && <circle cx="15" cy="15" r="9" fill="none" stroke="#f59e0b" strokeWidth="1.5" opacity="0.8" />}
                </svg>
              ) : d.style === 'relay' || d.style === 'valve' ? (
                <span className={`flex h-[30px] w-[30px] items-center justify-center rounded border font-mono text-[10px] font-bold ${on ? 'border-emerald-400 bg-emerald-100 text-emerald-800' : 'border-steel-300 bg-steel-50 text-steel-400'}`}>{d.style === 'valve' ? 'SOL' : 'CR'}</span>
              ) : (
                <span className="h-[30px] w-[30px] rounded-full border-2 border-steel-400 transition-all"
                  style={{ background: on ? c.on : c.off, boxShadow: on ? `0 0 14px 4px ${c.glow}` : 'inset 0 2px 4px rgba(0,0,0,0.15)' }} />
              )}
              <span className="text-[11px] leading-tight text-steel-700">{d.label}</span>
              <AddrChip address={d.output} on={on} kind="out" />
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function StackLightCard({ d, bits }: { d: StackLightDevice; bits: Map<string, boolean> }) {
  return (
    <Card title={d.label}>
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center">
          {d.segments.map((s) => {
            const on = bits.get(s.output) ?? false;
            if (s.color === 'buzzer') return <div key={s.output} className={`h-4 w-9 rounded-b border border-steel-500 ${on ? 'bg-steel-700' : 'bg-steel-300'}`} />;
            const c = LIGHT[s.color];
            return <div key={s.output} className="h-6 w-9 border border-b-0 border-steel-500 first:rounded-t-md" style={{ background: on ? c.on : c.off, boxShadow: on ? `0 0 12px 3px ${c.glow}` : undefined }} />;
          })}
          <div className="h-6 w-2 bg-steel-500" />
        </div>
        <ul className="flex-1 space-y-1">
          {d.segments.map((s) => (
            <li key={s.output} className="flex items-center gap-1.5 text-[11px] text-steel-600">
              <AddrChip address={s.output} on={bits.get(s.output) ?? false} kind="out" />
              <span className="truncate">{s.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

const fmt = (v: number) => (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(1));

function Bar({ value, min, max }: { value: number; min: number; max: number }) {
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min || 1)) * 100));
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-steel-100" role="meter" aria-valuemin={min} aria-valuemax={max} aria-valuenow={value}>
      <div className="h-full rounded-full bg-sky-500 transition-[width] duration-200" style={{ width: `${pct}%` }} />
    </div>
  );
}

function AnalogInCard({ d, onSet }: { d: AnalogInDevice; onSet?: (id: string, v: number) => void }) {
  const step = (d.max - d.min) / 200 || 0.1;
  const how = d.process === 'level' ? `Level model: rises with ${d.raise.join(', ') || '—'}, falls with ${d.lower.join(', ') || '—'}`
    : d.process === 'temperature' ? `Temperature model: heats with ${d.raise.join(', ') || '—'}, cools to ambient` : 'Set by hand';
  return (
    <Card title={d.label} tag={d.input}>
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-lg font-semibold text-steel-900">{fmt(d.state.value)}</span>
        <span className="text-[11px] text-steel-500">{d.units} · {fmt(d.min)}–{fmt(d.max)}</span>
      </div>
      <input type="range" min={d.min} max={d.max} step={step} value={d.state.value} aria-label={`${d.label} value`}
        onChange={(e) => onSet?.(d.id, Number(e.target.value))} className="mt-1 w-full accent-sky-600" />
      <p className="mt-0.5 text-[11px] text-steel-500">{how}</p>
    </Card>
  );
}

function AnalogOutCard({ d, words }: { d: AnalogOutDevice; words?: Map<string, number> }) {
  const v = words?.get(d.output) ?? 0;
  return (
    <Card title={d.label} tag={d.output}>
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-lg font-semibold text-steel-900">{fmt(v)}</span>
        <span className="text-[11px] text-steel-500">{d.units} · {fmt(d.min)}–{fmt(d.max)}</span>
      </div>
      <Bar value={v} min={d.min} max={d.max} />
      <p className="mt-0.5 text-[11px] text-steel-500">Analog output written by the PLC</p>
    </Card>
  );
}

export default function MachinePanel({ devices: all, bits, inputs, actions, words, visible }: Props) {
  const devices = visible ? all.filter((d) => visible.has(d.id)) : all;
  const sensors = devices.filter((d): d is SensorDevice => d.kind === 'sensor');
  const indicators = devices.filter((d): d is IndicatorDevice => d.kind === 'indicator');
  return (
    <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 lg:grid-cols-1">
      <OperatorStation devices={devices} inputs={inputs} actions={actions} />
      {devices.map((d) => {
        switch (d.kind) {
          case 'conveyor': return <ConveyorCard key={d.id} d={d} devices={all} bits={bits} inputs={inputs} actions={actions} />;
          case 'motor': return d.conveyorId ? null : <MotorCard key={d.id} d={d} bits={bits} inputs={inputs} onSet={actions.setBypass} onFault={actions.setDriveFault} />;
          case 'cylinder': return <CylinderCard key={d.id} d={d} bits={bits} inputs={inputs} onSet={actions.setBypass} />;
          case 'stackLight': return <StackLightCard key={d.id} d={d} bits={bits} />;
          case 'analogIn': return <AnalogInCard key={d.id} d={d} onSet={actions.setAnalog} />;
          case 'analogOut': return <AnalogOutCard key={d.id} d={d} words={words} />;
          default: return null;
        }
      })}
      {indicators.length > 0 && <IndicatorsCard items={indicators} bits={bits} />}
      {sensors.length > 0 && <SensorsCard sensors={sensors} inputs={inputs} onToggle={actions.toggle} onSet={actions.setBypass} />}
      {devices.length === 0 && (
        <p className="rounded-lg border border-dashed border-steel-300 bg-white p-4 text-center text-xs text-steel-500">
          {all.length ? 'No field devices are used by this block.' : 'No I/O points with addresses yet. Add I/O to simulate the machine.'}
        </p>
      )}
    </div>
  );
}
