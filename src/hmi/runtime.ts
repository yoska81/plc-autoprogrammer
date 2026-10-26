import type { HmiDesign, HmiAlarm } from './types';

/** One alarm occurrence as the panel's alarm log records it. */
export interface AlarmEvent {
  id: number;
  address: string;
  message: string;
  severity: HmiAlarm['severity'];
  /** Wall-clock ms when the alarm bit turned ON / OFF (null while active). */
  on: number;
  off: number | null;
}

/** Live data the panel itself keeps (clock, alarm log, trend buffers) while it runs against the PLC. */
export interface HmiRuntime {
  now: number;
  /** Newest first: active alarms and the cleared history. */
  alarms: AlarmEvent[];
  /** Recent samples per trended address, oldest first. */
  trends: Map<string, number[]>;
}

export const TREND_SAMPLES = 120;
const TREND_PERIOD_MS = 500;
const MAX_HISTORY = 100;

/** Addresses shown by any 'trend' element of the design. */
export function trendAddresses(design: HmiDesign): string[] {
  const out = new Set<string>();
  for (const s of design.screens) for (const e of s.elements) if (e.kind === 'trend' && e.address) out.add(e.address);
  return [...out];
}

/**
 * Tracks alarm transitions and trend history from a read function. Call
 * `sample` whenever the PLC values may have changed (and on a clock tick); it
 * returns a fresh immutable snapshot when something changed.
 */
export class HmiRuntimeTracker {
  private events: AlarmEvent[] = [];
  private active = new Map<string, AlarmEvent>();
  private trends = new Map<string, number[]>();
  private lastTrend = 0;
  private nextId = 1;
  private readonly design: HmiDesign;
  private readonly trendAddrs: string[];

  constructor(design: HmiDesign) {
    this.design = design;
    this.trendAddrs = trendAddresses(design);
  }

  sample(read: (address: string) => boolean | number, now: number): HmiRuntime {
    for (const a of this.design.alarms) {
      const on = Boolean(read(a.address));
      const cur = this.active.get(a.address);
      if (on && !cur) {
        const ev: AlarmEvent = { id: this.nextId++, address: a.address, message: a.message, severity: a.severity, on: now, off: null };
        this.active.set(a.address, ev);
        this.events = [ev, ...this.events].slice(0, MAX_HISTORY);
      } else if (!on && cur) {
        this.active.delete(a.address);
        this.events = this.events.map((e) => (e.id === cur.id ? { ...e, off: now } : e));
      }
    }
    if (now - this.lastTrend >= TREND_PERIOD_MS) {
      this.lastTrend = now;
      const next = new Map(this.trends);
      for (const addr of this.trendAddrs) {
        const v = Number(read(addr)) || 0;
        next.set(addr, [...(next.get(addr) ?? []), v].slice(-TREND_SAMPLES));
      }
      this.trends = next;
    }
    return { now, alarms: this.events, trends: this.trends };
  }
}
