/**
 * Rule-based HMI builder: HMI content (./content.ts) + panel size in, a complete HmiDesign out —
 * header and navigation identical on every screen, Main / Manual / Process / Setup / Alarms /
 * Diagnostics / Maintenance laid out on a grid that keeps every element on the screen, apart from
 * the others and at least the minimum touch size (hmi/layout.ts), continuation pages when a screen
 * is full, and every HMI tag assigned from the standard ranges with a description of what the PLC
 * must do (the PLC program is generated from these).
 */
import type { AccessLevel, HmiAlarm, HmiDesign, HmiElement, HmiScreen, HmiState, HmiTag, MachineSymbol, MachineSymbolKind } from '../types';
import { GAP, MIN_TOUCH, layoutBands } from '../layout';
import type { HmiActuator, HmiContent } from './content';

interface Rect { x: number; y: number; w: number; h: number }
type More = Partial<Omit<HmiElement, 'id' | 'kind' | 'label' | 'x' | 'y' | 'w' | 'h'>>;
/** One cell of a block row: an element without its position. */
interface Cell { kind: HmiElement['kind']; label: string; more?: More; span?: number }
interface Block { title: string; rows: Cell[][]; rowH?: number; full?: boolean }

const el = (id: string, kind: HmiElement['kind'], label: string, r: Rect, more: More = {}): HmiElement => ({
  id, kind, label, x: Math.round(r.x), y: Math.round(r.y), w: Math.floor(r.w), h: Math.floor(r.h),
  address: null, action: null, targetScreenId: null, onText: null, offText: null, style: 'normal', units: null, min: null, max: null, note: null, ...more,
});
/** A feedback text without the actuator's own name ("Pusher extended" on the Pusher panel -> "Extended"). */
function shortName(desc: string, actuator: string): string {
  const drop = new Set(actuator.toLowerCase().split(/\s+/));
  const rest = desc.split(/\s+/).filter((w) => !drop.has(w.toLowerCase()) && !/^(sensor|prox|switch|limit)$/i.test(w)).join(' ');
  return rest ? rest[0].toUpperCase() + rest.slice(1) : desc;
}
const ident = (s: string) => s.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'X';

/** Standard HMI address ranges (same as the ladder and HMI AI rules): commands C1001–, alarms C1101–, status C1201–, setpoints DS1001–, status words DS1101–, analog setpoints DF101–. */
class TagPlan {
  tags: HmiTag[] = [];
  alarms: HmiAlarm[] = [];
  private n = { cmd: 1001, alm: 1101, sts: 1201, sp: 1001, word: 1101, df: 101 };
  private role = '';
  /** Role of the next tag added (see HmiTag.role). */
  as(role: string) { this.role = role; return this; }
  private add(address: string, name: string, dataType: HmiTag['dataType'], access: HmiTag['access'], description: string) {
    this.tags.push({ name, address, dataType, access, description, ...(this.role ? { role: this.role } : {}) });
    this.role = '';
    return address;
  }
  cmd(name: string, description: string, access: HmiTag['access'] = 'write') { return this.add(`C${this.n.cmd++}`, `HMI_${ident(name)}`, 'BIT', access, description); }
  sts(name: string, description: string) { return this.add(`C${this.n.sts++}`, `STS_${ident(name)}`, 'BIT', 'read', description); }
  alarm(name: string, message: string, severity: HmiAlarm['severity'], description: string) {
    const a = this.add(`C${this.n.alm++}`, `${severity === 'alarm' ? 'ALM' : 'WRN'}_${ident(name)}`, 'BIT', 'read', description);
    this.alarms.push({ address: a, message, severity });
    return a;
  }
  sp(name: string, description: string) { return this.add(`DS${this.n.sp++}`, `SP_${ident(name)}`, 'INT', 'read-write', description); }
  word(name: string, description: string) { return this.add(`DS${this.n.word++}`, ident(name), 'INT', 'read', description); }
  df(name: string, description: string) { return this.add(`DF${this.n.df++}`, `SP_${ident(name)}`, 'FLOAT', 'read-write', description); }
  raw(address: string, name: string, dataType: HmiTag['dataType'], description: string) { return this.add(address, name, dataType, 'read', description); }
}

interface ManualCmd { label: string; address: string; permit: string; output: string; note: string }
interface Plan {
  start: string; stop: string; reset: string; manualSel: string; manualSts: string; running: string; heartbeat: string; state: string;
  safetyAlarm?: string; manual: Map<HmiActuator, ManualCmd[]>; faults: Map<HmiActuator, string>; timeouts: Map<HmiActuator, { sp: string; alarm: string }>;
  speed: Map<HmiActuator, string>; limits: Map<string, { hi: string; lo: string; almHi: string; almLo: string }>;
  count?: { counter: string; reset: string; batch: string; rate: string };
  runHours: string; sinceService: string; serviceInterval: string; serviceDone: string; serviceDue: string;
}

function planTags(c: HmiContent, t: TagPlan): Plan {
  const safeText = c.safetyOk ? `Safety OK (${c.safetyOk.address})` : 'Safety OK';
  const start = t.as('cmd:start').cmd('Start', `Momentary Start: the PLC starts the automatic cycle when ${safeText} is ON, no alarm is latched and Manual mode is off.`);
  const stop = t.as('cmd:stop').cmd('Stop', 'Momentary Stop: the PLC ends the automatic cycle (stops all motion).');
  const reset = t.as('cmd:reset').cmd('Reset', 'Momentary Reset: clears latched alarms whose cause is gone. Never restarts anything by itself.');
  const manualSel = t.as('cmd:manual').cmd('Manual_Select', 'Toggle from the HMI: ON requests Manual mode; the PLC accepts it only while the cycle is stopped.', 'read-write');
  const manualSts = t.as('sts:manual').sts('Manual_Mode', `PLC sets ON while Manual mode is active (${manualSel} ON and the cycle stopped); Start is blocked while ON.`);
  const running = t.as('sts:running').sts('Running', 'PLC sets ON while the automatic cycle runs.');
  const heartbeat = t.as('sts:heartbeat').sts('Heartbeat', 'PLC toggles every second (communication watchdog on the Diagnostics screen).');
  const state = t.as('word:state').word('Machine_State', `PLC writes ${c.states.map((s) => `${s.value} ${s.text}`).join(', ')} (highest applicable wins).`);
  const plan: Plan = {
    start, stop, reset, manualSel, manualSts, running, heartbeat, state,
    manual: new Map(), faults: new Map(), timeouts: new Map(), speed: new Map(), limits: new Map(),
    runHours: '', sinceService: '', serviceInterval: '', serviceDone: '', serviceDue: '',
  };
  if (c.safetyOk) plan.safetyAlarm = t.as('alarm:safety').alarm('Safety_Open', 'Safety circuit open (E-stop or guard)', 'alarm', `PLC sets ON while ${safeText} is OFF.`);

  const outputsOf = (a: HmiActuator) => [a.run, a.reverse, a.extend, a.retract].filter((p): p is NonNullable<typeof p> => !!p);
  for (const a of c.actuators) {
    const others = c.actuators.filter((b) => b !== a && b.manual).flatMap(outputsOf).map((p) => p.address);
    const permitWhy = `Manual mode (${manualSts}) active, ${safeText} ON${others.length ? ` and no other motion (${others.join(', ')} OFF)` : ''}`;
    if (a.manual) {
      const cmds: ManualCmd[] = [];
      const add = (label: string, out: { address: string; description: string } | undefined, hold: string) => {
        if (!out) return;
        const opposite = out === a.retract ? a.extend : out === a.extend ? a.retract : undefined;
        const permit = t.as(`permit:${out.address}`).sts(`${a.name}_${label}_Permit`, `PLC sets ON when ${permitWhy}${opposite ? ` and ${opposite.address} OFF` : ''}.`);
        const cmd = t.as(`jog:${out.address}`).cmd(`${a.name}_${label}`, `Hold-to-run: while ON and ${permit} is ON the PLC energizes ${out.address} (${out.description}); ${hold}`);
        cmds.push({ label, address: cmd, permit, output: out.address, note: hold });
      };
      if (a.kind === 'motor' || a.kind === 'drive') {
        add(a.reverse ? 'Jog Fwd' : 'Jog', a.run, 'stops on release.');
        add('Jog Rev', a.reverse, 'stops on release.');
      } else if (a.kind === 'cylinder') {
        add(verb(a.extend?.description, 'Extend'), a.extend, a.retract ? 'holds position on release (double solenoid).' : 'spring return retracts on release.');
        add(verb(a.retract?.description, 'Retract'), a.retract, 'holds position on release.');
      }
      plan.manual.set(a, cmds);
    }
    if (a.fault) plan.faults.set(a, t.as(`alarm:fault:${a.fault.address}`).alarm(`${a.name}_Fault`, `${a.name}: ${a.kind === 'drive' ? 'drive fault' : 'overload tripped'}`, 'alarm',
      `PLC latches ON when ${a.fault.address} (${a.fault.description}) is ON and stops ${a.name}; Reset (${reset}) clears it once the input is OFF.`));
    if (a.kind === 'cylinder' && a.feedback.length) {
      const sp = t.as(`sp:timeout:${(a.extend ?? a.run)?.address}`).sp(`${a.name}_Timeout`, `Seconds allowed for ${a.name} to reach ${a.feedback.map((f) => `${f.address} (${f.description})`).join(' / ')} (1–30, default 3 on the first scan).`);
      const alarm = t.as(`alarm:timeout:${(a.extend ?? a.run)?.address}`).alarm(`${a.name}_Timeout`, `${a.name} did not reach its position in time`, 'alarm', `PLC latches ON when ${a.name} does not reach its feedback position within ${sp} seconds after its valve switches; Reset (${reset}) clears it.`);
      plan.timeouts.set(a, { sp, alarm });
    }
    if (a.speedRef) plan.speed.set(a, t.as(`sp:speed:${a.speedRef.address}`).df(`${a.name}_Speed`, `${a.name} speed setpoint (${a.speedRef.units}, ${a.speedRef.min}–${a.speedRef.max}); the PLC copies it to ${a.speedRef.address} while ${a.name} runs, 0 when stopped; safe default on the first scan.`));
  }
  // Analog values shown on screens (already in engineering units: the PLC's analog setup scales them).
  for (const an of c.analogs) t.as(`analog:${an.address}`).raw(an.address, `${an.kind === 'input' ? 'AI' : 'AO'}_${ident(an.name)}`, 'FLOAT', `${an.kind === 'input' ? 'Analog input' : 'Analog output'} ${an.name} in ${an.units || 'engineering units'} (${an.min}-${an.max}), scaled by the PLC's analog setup.`);
  for (const an of c.analogs.filter((x) => x.kind === 'input')) {
    const span = an.max - an.min;
    const hi = t.as(`sp:high:${an.address}`).df(`${an.name}_High`, `High alarm limit for ${an.address} ${an.name} (${an.units}); default ${an.min + span * 0.9} on the first scan.`);
    const lo = t.as(`sp:low:${an.address}`).df(`${an.name}_Low`, `Low alarm limit for ${an.address} ${an.name} (${an.units}); default ${an.min + span * 0.1} on the first scan.`);
    const almHi = t.as(`alarm:high:${an.address}`).alarm(`${an.name}_High`, `${an.name} high`, 'warning', `PLC sets ON while ${an.address} >= ${hi} (with a small deadband).`);
    const almLo = t.as(`alarm:low:${an.address}`).alarm(`${an.name}_Low`, `${an.name} low`, 'warning', `PLC sets ON while ${an.address} <= ${lo} (with a small deadband).`);
    plan.limits.set(an.address, { hi, lo, almHi, almLo });
  }
  if (c.partSensor) {
    const counter = t.as('word:count').raw('CTD1', 'Part_Count', 'INT2', `Counter CT1 counts each rising edge of ${c.partSensor.address} (${c.partSensor.description}).`);
    const resetC = t.as('cmd:countreset').cmd('Count_Reset', 'Momentary: resets the part counter CT1.');
    const batch = t.as('sp:batch').sp('Batch_Target', 'Batch size in parts (0 = no limit): the PLC stops the cycle when CTD1 reaches it.');
    const rate = t.as('word:rate').word('Parts_Per_Min', 'Parts counted in the last 60 s.');
    plan.count = { counter, reset: resetC, batch, rate };
  }
  plan.runHours = t.as('word:runhours').word('Run_Hours', 'Retentive machine run hours (count while the cycle runs).');
  plan.sinceService = t.as('word:sinceservice').word('Hours_Since_Service', `Retentive run hours since the last Service Done.`);
  plan.serviceInterval = t.as('sp:serviceinterval').sp('Service_Interval', 'Run hours between services (50–2000, default 500 on the first scan).');
  plan.serviceDone = t.as('cmd:servicedone').cmd('Service_Done', `Momentary: resets the hours since service (${plan.sinceService}) to 0.`);
  plan.serviceDue = t.as('alarm:servicedue').alarm('Service_Due', 'Service due: run hours reached', 'warning', `PLC sets ON when ${plan.sinceService} >= ${plan.serviceInterval}.`);
  return plan;
}

/** Button text from the coil's own word (gripper "close" / "open", head "down" / "up"), else the default. */
function verb(desc: string | undefined, fallback: string): string {
  const m = /\b(close|clamp|unclamp|open|down|up|advance|return|lift|lower|in|out)\b/i.exec(desc ?? '');
  return m ? m[1][0].toUpperCase() + m[1].slice(1).toLowerCase() : fallback;
}

/** The HMI tag plan for some content (the same addresses buildHmi assigns), for the PLC program templates. */
export function planHmiTags(c: HmiContent): { tags: HmiTag[]; alarms: HmiAlarm[] } {
  const t = new TagPlan();
  planTags(c, t);
  return { tags: t.tags, alarms: t.alarms };
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

const PANEL_TITLE = 28;

/** Pack blocks into the content area: columns top to bottom, full-width blocks across; returns pages of placed blocks. */
function pack(blocks: Block[], area: Rect, rowH: number): { block: Block; r: Rect }[][] {
  const cols = area.w >= 600 ? 2 : 1;
  const cw = (area.w - GAP * (cols - 1)) / cols;
  const heightOf = (b: Block) => PANEL_TITLE + b.rows.length * ((b.rowH ?? rowH) + GAP);
  // Split blocks too tall for one page.
  const split: Block[] = [];
  for (const b of blocks) {
    const per = Math.max(1, Math.floor((area.h - PANEL_TITLE) / ((b.rowH ?? rowH) + GAP)));
    for (let i = 0; i < b.rows.length; i += per) split.push({ ...b, title: i ? `${b.title} (cont.)` : b.title, rows: b.rows.slice(i, i + per) });
  }
  const pages: { block: Block; r: Rect }[][] = [[]];
  let colY = Array(cols).fill(area.y) as number[];
  for (const b of split) {
    const h = heightOf(b);
    const full = b.full || cols === 1;
    let col = full ? 0 : colY.indexOf(Math.min(...colY));
    let y = full ? Math.max(...colY) : colY[col];
    if (y + h > area.y + area.h && pages[pages.length - 1].length) {
      pages.push([]); colY = Array(cols).fill(area.y); col = 0; y = area.y;
    }
    const r = { x: area.x + (full ? 0 : col * (cw + GAP)), y, w: full ? area.w : cw, h };
    pages[pages.length - 1].push({ block: b, r });
    if (full) colY = colY.map(() => y + h + GAP); else colY[col] = y + h + GAP;
  }
  return pages;
}

function placeBlock(prefix: string, b: Block, r: Rect, rowH: number): HmiElement[] {
  const out: HmiElement[] = [el(`${prefix}-p`, 'panel', b.title, r)];
  const rh = b.rowH ?? rowH;
  b.rows.forEach((row, i) => {
    const units = row.reduce((s, c) => s + (c.span ?? 1), 0);
    const inner = r.w - 2 * GAP;
    const unitW = (inner - GAP * (units - 1)) / units;
    let x = r.x + GAP;
    const y = r.y + PANEL_TITLE + i * (rh + GAP);
    row.forEach((c, j) => {
      const w = unitW * (c.span ?? 1) + GAP * ((c.span ?? 1) - 1);
      out.push(el(`${prefix}-${i}-${j}`, c.kind, c.label, { x, y, w, h: c.kind === 'text' ? Math.min(20, rh) : rh }, c.more));
      x += w + GAP;
    });
  });
  return out;
}

// ---------------------------------------------------------------------------
// Screens
// ---------------------------------------------------------------------------

export interface BuildOptions { partNumber: string; widthPx: number; heightPx: number; now?: string; plcText?: string }

export function buildHmi(c: HmiContent, o: BuildOptions): HmiDesign {
  const W = o.widthPx, H = o.heightPx;
  const bands = layoutBands(W, H);
  const area = bands.content;
  const rowH = Math.max(MIN_TOUCH.h, H <= 300 ? 48 : H <= 600 ? 52 : 60);
  const lampH = H <= 300 ? 26 : 30;
  const t = new TagPlan();
  const p = planTags(c, t);
  const level: AccessLevel = 'maintenance';
  const safetyLamp = (label = 'Safety OK'): Cell | null => (c.safetyOk ? { kind: 'indicator', label, more: { address: c.safetyOk.address, style: 'ok', onText: 'Safety OK', offText: 'Safety Open' } } : null);
  const cells = (xs: (Cell | null)[]) => xs.filter((x): x is Cell => !!x);

  // --- block lists per screen group
  const groups: { id: string; name: string; purpose: string; level?: AccessLevel; blocks?: Block[]; custom?: (r: Rect, id: string) => HmiElement[] }[] = [];

  groups.push({ id: 'main', name: 'Main', purpose: 'Overview: machine, state, production and the run controls.', custom: (r, id) => mainScreen(c, p, r, id, rowH) });

  const manualActs = c.actuators.filter((a) => a.manual && (p.manual.get(a)?.length ?? 0) > 0);
  if (manualActs.length) {
    const blocks: Block[] = [{ title: 'Mode', full: true, rows: [cells([
      { kind: 'button', label: 'Manual Mode', more: { address: p.manualSel, action: 'toggle', onText: 'Manual On', offText: 'Select Manual', level, note: 'Accepted by the PLC only while the cycle is stopped' } },
      { kind: 'indicator', label: 'Manual Active', more: { address: p.manualSts, style: 'warning', onText: 'Manual Active', offText: 'Auto Mode' } },
      safetyLamp(),
    ])] }];
    for (const a of manualActs) {
      const cmds = p.manual.get(a)!;
      blocks.push({ title: a.name, rows: [
        cmds.map((m): Cell => ({ kind: 'button', label: m.label, more: { address: m.address, action: 'momentary', interlock: m.permit, level, note: `Hold to run; ${m.note}` } })),
        [...cmds.map((m): Cell => ({ kind: 'indicator', label: `${m.label} permitted`, more: { address: m.permit, style: 'ok', onText: `${m.label} OK`, offText: `${m.label} blocked` } })),
          ...a.feedback.slice(0, 2).map((f): Cell => { const t = shortName(f.description, a.name); return { kind: 'indicator', label: t, more: { address: f.address, onText: t, offText: t } }; })],
      ] });
    }
    groups.push({ id: 'manual', name: 'Manual', purpose: 'Hold-to-run jog of each actuator in Manual mode; every button shows its interlock.', level, blocks });
  }

  const process: Block[] = c.analogs.map((an) => ({ title: `${an.name} (${an.address})`, rows: [[
    { kind: 'bar', label: an.name, span: 2, more: { address: an.address, units: an.units, min: an.min, max: an.max } },
    { kind: 'numeric', label: an.units || 'Value', more: { address: an.address, units: an.units || null } },
  ]] }));

  const setup: Block[] = [];
  const entry = (label: string, address: string, units: string, min: number, max: number, lvl: AccessLevel = level, note: string | null = null): Cell =>
    ({ kind: 'numeric-entry', label, more: { address, units, min, max, level: lvl, note } });
  const timeouts = [...p.timeouts].map(([a, x]) => entry(`${a.name} timeout`, x.sp, 's', 1, 30));
  if (timeouts.length) setup.push({ title: 'Timeouts', rows: timeouts.map((x) => [x]) });
  const speeds = [...p.speed].map(([a, x]) => entry(`${a.name} speed`, x, a.speedRef!.units, a.speedRef!.min, a.speedRef!.max));
  if (speeds.length) setup.push({ title: 'Drive speeds', rows: speeds.map((x) => [x]) });
  for (const an of c.analogs.filter((x) => x.kind === 'input')) {
    const l = p.limits.get(an.address)!;
    setup.push({ title: `${an.name} alarms`, rows: [[entry('High', l.hi, an.units, an.min, an.max), entry('Low', l.lo, an.units, an.min, an.max)]] });
  }
  if (p.count) setup.push({ title: 'Production', rows: [[entry('Batch target', p.count.batch, 'pcs', 0, 9999, level, '0 = no batch limit')]] });
  setup.push({ title: 'Service', rows: [[entry('Service interval', p.serviceInterval, 'h', 50, 2000, 'engineer', 'Engineer password')]] });

  const maint: Block[] = [];
  if (p.count) maint.push({ title: 'Counters', rows: [[{ kind: 'numeric', label: 'Parts', more: { address: p.count.counter } }, { kind: 'button', label: 'Reset Parts', more: { address: p.count.reset, action: 'momentary', level } }]] });
  maint.push({ title: 'Run time', rows: [
    [{ kind: 'numeric', label: 'Run hours', more: { address: p.runHours, units: 'h' } }, { kind: 'numeric', label: 'Since service', more: { address: p.sinceService, units: 'h' } }],
    [{ kind: 'button', label: 'Service Done', more: { address: p.serviceDone, action: 'momentary', level, note: 'Resets the hours since service' } }, { kind: 'indicator', label: 'Service Due', more: { address: p.serviceDue, style: 'warning', onText: 'Service Due', offText: 'Service OK' } }],
  ] });
  maint.push({ title: 'Clock', rows: [[{ kind: 'datetime', label: 'Date / Time' }, { kind: 'numeric', label: 'Service interval', more: { address: p.serviceInterval, units: 'h' } }]] });

  // Diagnostics: every discrete point by module (CLICK X0xx = CPU, X1xx slot 1 …; others 16 per group).
  const diag: Block[] = [];
  const byGroup = new Map<string, typeof c.io>();
  c.io.forEach((pt, i) => {
    const m = /^([XY])(\d)(\d\d)$/.exec(pt.address);
    const key = m ? `${pt.type === 'input' ? 'Inputs' : 'Outputs'}${m[2] === '0' ? ' (CPU)' : ` (slot ${m[2]})`}` : `${pt.type === 'input' ? 'Inputs' : 'Outputs'} ${Math.floor(c.io.filter((q, j) => q.type === pt.type && j < i).length / 16) + 1}`;
    byGroup.set(key, [...(byGroup.get(key) ?? []), pt]);
  });
  for (const [key, pts] of byGroup) diag.push({ title: `${key}  ${pts[0].address}–${pts[pts.length - 1].address}`, rowH: lampH, rows: pts.map((pt) => [{ kind: 'indicator', label: `${pt.address} ${pt.description}`, more: { address: pt.address } }]) });
  diag.push({ title: 'Communications', rowH: lampH, rows: [
    [{ kind: 'indicator', label: 'PLC heartbeat', more: { address: p.heartbeat, style: 'ok', note: 'Blinks once a second while the PLC runs and the link is up' } }],
    ...(o.plcText ? [[{ kind: 'text', label: o.plcText } as Cell]] : []),
  ] });

  // Navigation: one button per screen group; small panels fold Process / Maintenance into Setup.
  const navFits = (n: number) => (W - GAP * (n + 1)) / n >= MIN_TOUCH.w;
  let setupBlocks = setup, maintBlocks: Block[] | null = maint, processBlocks: Block[] | null = process.length ? process : null;
  const count = () => groups.length + (processBlocks ? 1 : 0) + 3 + (maintBlocks ? 1 : 0);
  if (!navFits(count()) && processBlocks) { setupBlocks = [...processBlocks, ...setupBlocks]; processBlocks = null; }
  if (!navFits(count()) && maintBlocks) { setupBlocks = [...setupBlocks, ...maintBlocks]; maintBlocks = null; }
  if (processBlocks) groups.push({ id: 'process', name: 'Process', purpose: 'Analog values with their ranges.', blocks: processBlocks });
  groups.push({ id: 'setup', name: 'Setup', purpose: 'Setpoints with units and limits (Maintenance password; service interval: Engineer).', level, blocks: setupBlocks });
  groups.push({ id: 'alarms', name: 'Alarms', purpose: 'Active alarms and history; Reset once the cause is gone.', custom: (r, id) => alarmScreen(t.alarms, p, r, id, rowH) });
  groups.push({ id: 'diag', name: 'Diagnostics', purpose: 'Every input and output by module, plus PLC communication.', blocks: diag });
  if (maintBlocks) groups.push({ id: 'maint', name: 'Maintenance', purpose: 'Counters, run hours and the service reminder.', blocks: maintBlocks });

  const navW = (W - GAP * (groups.length + 1)) / groups.length;
  const navH = Math.min(bands.nav.h, Math.max(MIN_TOUCH.h, bands.nav.h - 8));
  const frame = (id: string, current: string): HmiElement[] => [
    el(`${id}-hdr`, 'header', c.machineName, bands.header, { address: p.manualSts, targetScreenId: 'alarms', states: [{ value: 0, text: 'Auto', style: 'normal' }, { value: 1, text: 'Manual', style: 'warning' }] }),
    ...groups.map((g, i) => el(`${id}-nav-${g.id}`, 'nav', g.name, { x: GAP + i * (navW + GAP), y: bands.nav.y + Math.max(0, (bands.nav.h - navH) / 2), w: navW, h: navH }, { targetScreenId: g.id, style: g.id === current ? 'ok' : 'normal' })),
  ];

  const screens: HmiScreen[] = [];
  for (const g of groups) {
    if (g.custom) { screens.push({ id: g.id, name: g.name, purpose: g.purpose, ...(g.level ? { level: g.level } : {}), elements: [...frame(g.id, g.id), ...g.custom(area, g.id)] }); continue; }
    // Several pages: Previous / Next buttons in a strip on the right of the content area.
    const bw = Math.max(MIN_TOUCH.w, 72);
    let pages = pack(g.blocks ?? [], area, rowH);
    if (pages.length > 1) pages = pack(g.blocks ?? [], { ...area, w: area.w - bw - GAP }, rowH);
    pages.forEach((page, k) => {
      const id = k ? `${g.id}${k + 1}` : g.id;
      const els = [...frame(id, g.id), ...page.flatMap(({ block, r }, i) => placeBlock(`${id}-b${i}`, block, r, rowH))];
      if (pages.length > 1) {
        const x = area.x + area.w - bw;
        if (k > 0) els.push(el(`${id}-prev`, 'nav', '< Prev', { x, y: area.y, w: bw, h: MIN_TOUCH.h }, { targetScreenId: k === 1 ? g.id : `${g.id}${k}` }));
        if (k < pages.length - 1) els.push(el(`${id}-next`, 'nav', 'Next >', { x, y: area.y + area.h - MIN_TOUCH.h, w: bw, h: MIN_TOUCH.h }, { targetScreenId: `${g.id}${k + 2}` }));
      }
      screens.push({ id, name: pages.length > 1 ? `${g.name} ${k + 1}/${pages.length}` : g.name, purpose: g.purpose, ...(g.level ? { level: g.level } : {}), elements: els });
    });
  }

  return {
    hmiPartNumber: o.partNumber, machineName: c.machineName, screens, alarms: t.alarms, tags: t.tags,
    notes: [
      `Rule-based HMI: ${screens.length} screens (${groups.map((g) => g.name).join(', ')}), ${t.tags.length} HMI tags in the standard ranges (commands C1001-, alarms C1101-, status C1201-, setpoints DS1001-/DF101-, status words DS1101-).`,
      'Passwords: Maintenance for Manual, Setup and counter resets; Engineer for the service interval. Confirm the levels with the customer.',
      ...c.questions,
    ],
    askUser: ['Passwords: Maintenance for Manual, Setup and counter resets; Engineer for the service interval. Confirm the levels with the customer.', ...c.questions],
    generatedAt: o.now ?? new Date().toISOString(),
  };
}

/** Main: machine picture on the left, state and run buttons on the right, counts below, alarm banner at the bottom. */
function mainScreen(c: HmiContent, p: Plan, a: Rect, id: string, rowH: number): HmiElement[] {
  const out: HmiElement[] = [];
  const bannerH = 32;
  const body = { ...a, h: a.h - bannerH - GAP };
  const rightW = Math.max(2 * MIN_TOUCH.w + GAP, Math.round(body.w * 0.38));
  const left = { x: body.x, y: body.y, w: body.w - rightW - GAP, h: body.h };
  const right = { x: left.x + left.w + GAP, y: body.y, w: rightW, h: body.h };
  const half = (right.w - GAP) / 2;
  const rows = [
    [{ kind: 'multistate' as const, label: 'Machine State', more: { address: p.state, states: c.states } }],
    [{ kind: 'button' as const, label: 'Start', more: { address: p.start, action: 'momentary' as const, style: 'ok' as const } }, { kind: 'button' as const, label: 'Stop', more: { address: p.stop, action: 'momentary' as const, style: 'alarm' as const } }],
    [{ kind: 'button' as const, label: 'Reset', more: { address: p.reset, action: 'momentary' as const } }, c.safetyOk
      ? { kind: 'indicator' as const, label: 'Safety OK', more: { address: c.safetyOk.address, style: 'ok' as const, onText: 'Safety OK', offText: 'Safety Open' } }
      : { kind: 'indicator' as const, label: 'Running', more: { address: p.running, style: 'ok' as const, onText: 'Running', offText: 'Stopped' } }],
  ];
  const fit = Math.max(1, Math.floor((right.h + GAP) / (rowH + GAP)));
  rows.slice(0, fit).forEach((row, i) => row.forEach((cell, j) => {
    const w = row.length === 1 ? right.w : half;
    out.push(el(`${id}-r${i}${j}`, cell.kind, cell.label, { x: right.x + j * (half + GAP), y: right.y + i * (rowH + GAP), w, h: rowH }, cell.more));
  }));
  // Counts / rate under the picture when there is a part sensor; running lamp otherwise.
  const stats: [HmiElement['kind'], string, More][] = p.count
    ? [['numeric', 'Parts', { address: p.count.counter }], ['numeric', 'Rate', { address: p.count.rate, units: '/min' }], ['indicator', 'Running', { address: p.running, style: 'ok', onText: 'Running', offText: 'Stopped' }]]
    : [['indicator', 'Running', { address: p.running, style: 'ok', onText: 'Running', offText: 'Stopped' }]];
  const statsY = left.y + left.h - rowH;
  const sw = (left.w - GAP * (stats.length - 1)) / stats.length;
  stats.forEach(([kind, label, more], i) => out.push(el(`${id}-s${i}`, kind, label, { x: left.x + i * (sw + GAP), y: statsY, w: sw, h: rowH }, more)));
  const pic = { x: left.x, y: left.y, w: left.w, h: left.h - rowH - GAP };
  if (pic.h >= 60) out.push(el(`${id}-mach`, 'machine', `${c.machineName}`, pic, { symbols: symbols(c, pic) }));
  out.push(el(`${id}-banner`, 'alarm-banner', 'Alarms', { x: a.x, y: a.y + a.h - bannerH, w: a.w, h: bannerH }));
  return out;
}

const SYMBOL: Record<HmiActuator['kind'], MachineSymbolKind> = { motor: 'motor', drive: 'motor', cylinder: 'cylinder', valve: 'valve', heater: 'station' };

/** Machine picture: one slot per actuator (conveyors as belts, pumps, cylinders with their feedback), tanks for analog levels, the part sensor. */
function symbols(c: HmiContent, r: Rect): MachineSymbol[] {
  const items: { kind: MachineSymbolKind; label: string; address: string | null; wide?: boolean }[] = [];
  for (const a of c.actuators) {
    const conveyor = /\b(conveyor|belt|feed)/i.test(a.name);
    const kind: MachineSymbolKind = conveyor ? 'conveyor' : /\bpump\b/i.test(a.name) ? 'pump' : SYMBOL[a.kind];
    items.push({ kind, label: a.name, address: (a.run ?? a.extend)?.address ?? null, wide: conveyor });
  }
  for (const an of c.analogs.filter((x) => x.kind === 'input' && /\b(level|tank)\b/i.test(x.name))) items.push({ kind: 'tank', label: an.name, address: null });
  if (c.partSensor) items.push({ kind: 'sensor', label: 'Part', address: c.partSensor.address });
  if (!items.length) return [];
  const top = 24, labelH = 16;
  const units = items.reduce((s, i) => s + (i.wide ? 2 : 1), 0);
  const unitW = (r.w - 16) / units;
  const maxH = r.h - top - labelH - 8;
  let x = 8;
  return items.map((it) => {
    const slot = unitW * (it.wide ? 2 : 1);
    const w = Math.round(it.kind === 'conveyor' ? slot - 12 : it.kind === 'sensor' ? Math.min(44, slot - 12) : it.kind === 'cylinder' ? Math.min(28, slot - 12) : Math.min(48, slot - 12, maxH));
    const h = Math.round(it.kind === 'conveyor' ? Math.min(36, maxH) : it.kind === 'sensor' ? 12 : it.kind === 'cylinder' ? Math.min(64, maxH) : Math.min(48, maxH, slot - 12));
    const s: MachineSymbol = { kind: it.kind, label: it.label, address: it.address, x: Math.round(x + (slot - w) / 2), y: Math.round(top + (maxH - h) / 2), w: Math.max(8, w), h: Math.max(8, h) };
    x += slot;
    return s;
  });
}

/** Alarms: the list on the left, Reset and one lamp per alarm on the right (as many as fit). */
function alarmScreen(alarms: HmiAlarm[], p: Plan, a: Rect, id: string, rowH: number): HmiElement[] {
  const sideW = Math.max(MIN_TOUCH.w * 2, Math.round(a.w * 0.28));
  const out = [
    el(`${id}-list`, 'alarm-list', 'Message', { x: a.x, y: a.y, w: a.w - sideW - GAP, h: a.h }),
    el(`${id}-reset`, 'button', 'Reset', { x: a.x + a.w - sideW, y: a.y, w: sideW, h: rowH }, { address: p.reset, action: 'momentary', note: 'Clears latched alarms once the cause is gone' }),
  ];
  const lampH = 36;
  const room = Math.floor((a.h - rowH - GAP) / (lampH + GAP));
  alarms.slice(0, room).forEach((al, i) => out.push(el(`${id}-a${i}`, 'indicator', al.message.length > 28 ? `${al.message.slice(0, 25)}...` : al.message,
    { x: a.x + a.w - sideW, y: a.y + rowH + GAP + i * (lampH + GAP), w: sideW, h: lampH }, { address: al.address, style: al.severity === 'alarm' ? 'alarm' : 'warning' })));
  return out;
}

export type { HmiState };
