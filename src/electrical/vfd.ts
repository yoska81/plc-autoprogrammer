/**
 * Variable frequency drive control: which PLC point goes to which drive terminal, and the
 * drive parameters that make the drive follow that wiring.
 *
 * Sources (AutomationDirect DURApulse manuals, cdn.automationdirect.com/static/manuals/…):
 * - GS20 / GS20X user manual, ch. 2 "Control Circuit Terminals" (gs20m/ch2.pdf):
 *   FWD (DI1), REV (DI2), DI3–DI7, DCM, +24V; relay R1O (N.O.) / R1C (N.C.) / R1 (common);
 *   DO1 / DO2 / DOC (open collector); +10V, AI1 (0–10 V / ±10 V), AI2 (default 0/4–20 mA), ACM;
 *   STO1 / STO2 / SCM (factory jumper to +24 V); SG+ / SG- (RS-485).
 * - GS10 user manual, ch. 2 (gs10m/ch2.pdf): FWD (DI1), REV (DI2), DI3–DI5, DCM, +24V; R1O / R1C / R1;
 *   DO1 / DOC; +10V, AI (default 0–10 V; current needs the DIP switch and P03.28), ACM; RS-485 on the RJ45 only.
 * - Parameters, both series (gs20m/ch4.pdf, gs10m/ch4.pdf): P00.20 frequency command source (2 = external
 *   analog), P00.21 operation command source (1 = external terminals), P00.22 stop method (0 = ramp),
 *   P01.00 max frequency, P01.01 motor base frequency, P01.02 motor rated voltage, P01.10 / P01.11 output
 *   frequency upper / lower limit, P01.12 / P01.13 accel / decel time 1, P02.00 two/three-wire mode
 *   (1 = two-wire FWD/STOP, REV/STOP), P02.03.. DI3.. functions (defaults: multi-step speed 1, 2, …),
 *   P02.13 relay R1 function (11 = malfunction indication, the default), P02.16 DO1 function
 *   (1 = indication during RUN), P03.00 / P03.01 AI1 / AI2 function (1 = frequency command),
 *   P03.28 / P03.29 AI1 / AI2 range (GS20 AI2: 0 = 4–20 mA; GS10 AI: 2 = 4–20 mA), P04.00.. multi-step
 *   speed frequencies, P05.01 motor full-load current, P05.03 rated speed, P05.04 poles.
 * - GS20 App. D-4 (gs20m/appxd.pdf): with a SINKING PLC output card the external supply + goes to the
 *   drive's DCM (digital input common) and each DI to a PLC output, which sinks the current; with a
 *   SOURCING card each PLC output feeds a DI and DCM returns to 0 V.
 */
import type { AnalogSetupRow } from '../plc/core/analog';

export type DriveSeries = 'GS10' | 'GS20' | 'other';

export interface DriveIoPoint { address: string; type: 'input' | 'output'; description: string; deviceTag: string; deviceType: string }

export interface DriveSpec {
  tag: string;
  partNumber: string;
  series?: string;
  /** Rated output current (A, constant torque). */
  outputAmps?: number;
  motorTag: string;
  motorDescription: string;
  motorHp: number;
  /** Motor voltage, V (230 / 460 / 575…). */
  motorVolts: number;
  /** Full-load current used for sizing (NEC 430.250 table value). */
  fla: number;
  reversing: boolean;
}

export type DriveRole = 'run' | 'reverse' | 'preset' | 'fault' | 'running' | 'speed';

export interface DriveTerminal {
  role: DriveRole;
  /** PLC address (X / Y / DF). */
  address: string;
  description: string;
  /** Drive terminal the signal lands on, and its return / common. */
  terminal: string;
  common: string;
}

export interface DriveParam {
  param: string;
  name: string;
  value: string;
  /** Where the value comes from: the design, the drive default, the motor nameplate, or to be set on site. */
  source: 'design' | 'default' | 'nameplate' | 'on site';
  note?: string;
}

export interface DriveControl {
  drive: DriveSpec;
  series: DriveSeries;
  terminals: DriveTerminal[];
  params: DriveParam[];
  /** Notes for the drawing / review (STO, braking, open-collector status). */
  notes: string[];
  /** Speed source the parameters select. */
  speedSource: 'analog' | 'presets' | 'keypad';
  /** Highest speed the PLC may command (Hz). */
  maxHz: number;
}

const seriesOf = (s: DriveSpec): DriveSeries => {
  const t = `${s.series ?? ''} ${s.partNumber}`.toUpperCase();
  if (/GS2\d|GS20/.test(t)) return 'GS20';
  if (/GS1\d|GS10/.test(t)) return 'GS10';
  return 'other';
};

const STOP = new Set(['motor', 'drive', 'vfd', 'speed', 'reference', 'command', 'the', 'and', 'of']);
const words = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w && !STOP.has(w));

/** Does this I/O point belong to this drive? Tag, motor tag or the motor's name in the description. */
function belongs(p: { description: string; deviceTag?: string }, d: DriveSpec, only: boolean, driveTags: Set<string>): boolean {
  const dev = p.deviceTag?.toUpperCase();
  if (dev && dev === d.tag.toUpperCase()) return true;
  if (dev && driveTags.has(dev)) return false; // wired to another drive
  const desc = p.description.toLowerCase();
  const re = (t: string) => new RegExp(`\\b${t.toLowerCase()}\\b`).test(desc);
  if (re(d.tag) || re(d.motorTag)) return true;
  const w = words(d.motorDescription);
  const have = new Set(words(desc));
  if (w.length && w.every((x) => have.has(x))) return true;
  return only && /\b(vfd|drive|speed)\b/.test(desc);
}

const REV_RE = /\b(rev|reverse|backward)\b/i;
const PRESET_RE = /\b(preset|speed select|multi.?speed|step speed|high speed|low speed|fast|slow|jog)\b/i;
const RUNNING_RE = /\b(running|run status|at speed|ready|in operation)\b/i;

export function driveControls(drives: DriveSpec[], io: DriveIoPoint[], analog: AnalogSetupRow[], plcOutputs: 'sinking' | 'sourcing' | 'relay', outputSupply: string): DriveControl[] {
  const only = drives.length === 1;
  const driveTags = new Set(drives.map((d) => d.tag.toUpperCase()));
  return drives.map((d) => {
    const series = seriesOf(d);
    const mine = io.filter((p) => !/^DF\d+$/i.test(p.address) && belongs(p, d, only, driveTags));
    const terminals: DriveTerminal[] = [];
    const notes: string[] = [];
    const sinking = plcOutputs === 'sinking';
    // outputs: run, reverse, presets
    const outs = mine.filter((p) => p.type === 'output');
    const rev = d.reversing ? outs.find((p) => REV_RE.test(p.description)) : undefined;
    const presets = outs.filter((p) => p !== rev && PRESET_RE.test(p.description));
    const run = outs.find((p) => p !== rev && !presets.includes(p));
    const dis = series === 'GS10' ? ['DI3', 'DI4', 'DI5'] : ['DI3', 'DI4', 'DI5', 'DI6'];
    const diCommon = sinking ? `DCM (${outputSupply})` : 'DCM (0V)';
    if (run) terminals.push({ role: 'run', address: run.address, description: run.description, terminal: 'FWD/DI1', common: diCommon });
    if (rev) terminals.push({ role: 'reverse', address: rev.address, description: rev.description, terminal: 'REV/DI2', common: diCommon });
    presets.slice(0, dis.length).forEach((p, k) => terminals.push({ role: 'preset', address: p.address, description: p.description, terminal: dis[k], common: diCommon }));
    if (presets.length > dis.length) notes.push(`${presets.length - dis.length} preset-speed output(s) beyond ${dis[dis.length - 1]} have no drive input.`);
    // inputs: fault (relay R1), running (DO1)
    const ins = mine.filter((p) => p.type === 'input');
    const running = ins.find((p) => RUNNING_RE.test(p.description) && !/fault/i.test(p.description));
    const fault = ins.find((p) => p !== running);
    if (fault) terminals.push({ role: 'fault', address: fault.address, description: fault.description, terminal: 'R1O', common: 'R1 (24+)' });
    if (running) {
      terminals.push({ role: 'running', address: running.address, description: running.description, terminal: 'DO1', common: 'DOC (0V)' });
      notes.push('DO1 is an open-collector output (sinks to DOC): the PLC input it drives needs its common at +24 V, or use an interposing relay.');
    }
    // analog speed reference (DF)
    const speed = analog.find((r) => r.kind === 'output' && r.address && belongs({ description: r.description }, d, only, driveTags));
    if (speed) {
      const current = /mA/i.test(speed.range);
      const aiTerm = series === 'GS10' ? 'AI' : current ? 'AI2' : 'AI1';
      terminals.push({ role: 'speed', address: speed.address, description: speed.description, terminal: aiTerm, common: 'ACM' });
    }
    const hzMax = speed && /hz/i.test(speed.units) ? speed.scaleMax : 60;
    const speedSource: DriveControl['speedSource'] = speed ? 'analog' : presets.length ? 'presets' : 'keypad';

    const P = (param: string, name: string, value: string, source: DriveParam['source'], note?: string): DriveParam => ({ param, name, value, source, note });
    const params: DriveParam[] = [
      P('P00.20', 'Frequency command source', speed ? '2 (external analog input)' : '0 (digital keypad)', speed ? 'design' : 'default',
        speed ? undefined : presets.length ? 'Multi-step inputs override it' : 'Keypad speed (no PLC reference)'),
      P('P00.21', 'Operation command source', '1 (external terminals)', 'design'),
      P('P00.22', 'Stop method', '0 (ramp to stop)', 'default'),
      P('P01.00', 'Maximum output frequency', `${Math.max(60, hzMax).toFixed(2)} Hz`, 'design'),
      P('P01.01', 'Motor base frequency', '60.00 Hz', 'nameplate', 'From the motor nameplate'),
      P('P01.02', 'Motor rated voltage', `${d.motorVolts.toFixed(1)} V`, 'design', 'Check against the motor nameplate'),
      P('P01.10', 'Output frequency upper limit', `${hzMax.toFixed(2)} Hz`, 'design'),
      P('P01.11', 'Output frequency lower limit', '0.00 Hz', 'default'),
      P('P01.12', 'Acceleration time 1', 'SET ON SITE', 'on site', 'Per the load (avoid over-current trips)'),
      P('P01.13', 'Deceleration time 1', 'SET ON SITE', 'on site', 'Fast stop / high inertia: braking resistor'),
      P('P02.00', 'Two/three-wire operation', '1 (two-wire: FWD/STOP, REV/STOP)', 'design'),
    ];
    presets.slice(0, dis.length).forEach((_p, k) => {
      params.push(P(`P02.0${k + 3}`, `${dis[k]} function`, `${k + 1} (multi-step speed command ${k + 1})`, 'default'));
    });
    if (presets.length) {
      const steps = Math.min(15, 2 ** Math.min(presets.length, dis.length) - 1);
      for (let s = 0; s < steps; s++) params.push(P(`P04.${String(s).padStart(2, '0')}`, `Multi-step speed ${s + 1}`, 'SET ON SITE', 'on site', s === 0 ? 'Binary: DI3=1, DI4=2, DI3+DI4=3…' : undefined));
    }
    if (fault) params.push(P('P02.13', 'Relay R1 function', '11 (malfunction indication)', 'default', 'R1O closes on a drive fault'));
    if (running) params.push(P('P02.16', 'DO1 function', '1 (indication during RUN)', 'design'));
    if (speed) {
      const current = /mA/i.test(speed.range);
      if (series === 'GS10') {
        params.push(P('P03.00', 'AI function', '1 (frequency command)', 'default'));
        params.push(P('P03.28', 'AI range', current ? '2 (4–20 mA)' : '0 (0–10 V)', 'design', current ? 'AI DIP switch to current' : undefined));
      } else if (current) {
        params.push(P('P03.01', 'AI2 function', '1 (frequency command)', 'design'));
        params.push(P('P03.29', 'AI2 range', '0 (4–20 mA)', 'default', 'AI2 DIP switch: current (default)'));
      } else {
        params.push(P('P03.00', 'AI1 function', '1 (frequency command)', 'default'));
        params.push(P('P03.28', 'AI1 range', '0 (0–10 V)', 'default'));
      }
    }
    params.push(
      P('P05.01', 'Motor full-load current', `${d.fla.toFixed(1)} A`, 'nameplate', 'Table value; enter the nameplate FLA'),
      P('P05.03', 'Motor rated speed', 'NAMEPLATE', 'nameplate'),
      P('P05.04', 'Motor poles', 'NAMEPLATE', 'nameplate', 'Default 4'),
    );
    if (series === 'other') notes.push('Parameter numbers are for DURApulse GS10/GS20; check this drive\'s manual.');
    if (series === 'GS20') notes.push('STO1/STO2 are factory-jumpered to +24 V (Safe Torque Off not used). Use STO only per the risk assessment and GS20 manual App. E.');
    notes.push(sinking
      ? `Drive inputs wired for a sinking PLC output (GS20 manual App. D-4): ${outputSupply} to DCM, each DI to its PLC output; the safety circuit removes the run command.`
      : 'Drive inputs wired for a sourcing PLC output (GS20 manual App. D-4): PLC output to the DI, DCM to 0V.');
    if (/\b(hoist|lift|elevat\w*|vertical|crane|winch|incline)\b/i.test(d.motorDescription)) notes.push('Vertical / overhauling load: a braking resistor (B1-B2) and a mechanical brake are needed; size per the drive manual.');
    if (!run) notes.push('No PLC output runs this drive.');
    return { drive: d, series, terminals, params, notes, speedSource, maxHz: hzMax };
  });
}

/** Drive parameter list as CSV (one row per drive parameter). */
export function driveParamsCsv(drives: DriveControl[]): string {
  const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const rows = ['Drive,Part number,Motor,Parameter,Name,Value,Source,Note'];
  for (const c of drives) for (const p of c.params) rows.push([c.drive.tag, c.drive.partNumber, c.drive.motorTag, p.param, p.name, p.value, p.source, p.note ?? ''].map(q).join(','));
  return rows.join('\r\n') + '\r\n';
}
