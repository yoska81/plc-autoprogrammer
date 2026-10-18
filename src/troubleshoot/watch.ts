/**
 * Live PLC watch for guided fault finding: while the technician wiggles a wire or a connector, an input that
 * changes state on its own points at a loose connection on that path ("X003 flickered while you wiggled S3
 * → loose connection on wire 103").
 */
import type { PathHop, WiringPath } from './wiringPath';

export interface Sample { t: number; value: boolean }

/** Records the value changes of the watched addresses (from the Online page's polling). */
export class FlickerWatch {
  private changes = new Map<string, number[]>();
  private last = new Map<string, boolean>();

  /** Feed one polled value; only changes are recorded. */
  feed(address: string, value: boolean, t: number): void {
    const prev = this.last.get(address);
    this.last.set(address, value);
    if (prev === undefined || prev === value) return;
    const list = this.changes.get(address) ?? [];
    list.push(t);
    this.changes.set(address, list);
  }

  /** Number of state changes of an address since a time. */
  changesSince(address: string, since: number): number {
    return (this.changes.get(address) ?? []).filter((t) => t >= since).length;
  }

  reset(): void { this.changes.clear(); this.last.clear(); }
}

export interface WiggleResult {
  /** 'loose' = it changed while wiggling, 'steady' = no change. */
  verdict: 'loose' | 'steady';
  changes: number;
  message: string;
}

/** Hops worth wiggling, from the PLC out (terminals, cable cores, the device connector). */
export function wiggleSpots(path: WiringPath): PathHop[] {
  return path.signal.filter((h) => h.kind === 'terminal' || h.kind === 'cable' || h.kind === 'junction-box' || h.kind === 'device');
}

/**
 * The result of a wiggle test at a spot: two or more changes while the operator was not touching the device
 * itself is a loose connection between the PLC and that spot (one change can be the device really switching).
 */
export function wiggleResult(path: WiringPath, spot: PathHop, changes: number): WiggleResult {
  const where = spot.kind === 'device' ? `${spot.tag}${spot.terminal ? ` terminal ${spot.terminal}` : ''}` : spot.label.replace(/^Terminal strip /, '');
  if (changes >= 2) {
    return { verdict: 'loose', changes, message: `${path.address} flickered ${changes} times while you wiggled ${where} → loose connection on wire ${spot.wire ?? path.signal[0]?.wire ?? ''} at ${where} (or the conductor just before it). Switch off and lock out first, then tighten or re-terminate it and wiggle again.` };
  }
  return { verdict: 'steady', changes, message: `${path.address} stayed steady while you wiggled ${where}: that connection is good. Try the next one.` };
}
