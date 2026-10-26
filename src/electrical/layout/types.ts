/**
 * Machine layout: a plan view of the machine (uploaded picture / PDF page, or blank) with the
 * electrical cabinet, junction boxes and field devices placed on it and the cable routes drawn,
 * so cable lengths can be calculated and manifolds / junction boxes suggested.
 * Positions are stored in canvas units (pixels of the background, or of the blank sheet);
 * the scale converts them to metres.
 */

export type LayoutItemKind = 'cabinet' | 'jb' | 'device' | 'motor' | 'air' | 'manifold' | 'remoteio';
export type RouteKind = 'tray' | 'conduit' | 'chain';
export type LengthUnit = 'm' | 'mm' | 'in' | 'ft';

export interface LayoutItem {
  id: string;
  /** Design tag (CABINET for the electrical cabinet, JB1, PE1, SOL2, M1 …; AIR for the air supply). */
  tag: string;
  kind: LayoutItemKind;
  /** Canvas units. */
  x: number;
  y: number;
}

export interface LayoutRoute {
  id: string;
  kind: RouteKind;
  /** Polyline vertices, canvas units. */
  points: [number, number][];
}

export interface LayoutScale {
  /** Canvas units per metre. */
  unitsPerMeter: number;
  /** The reference the user measured: two canvas points and the real distance. */
  a: [number, number];
  b: [number, number];
  value: number;
  unit: LengthUnit;
}

export interface ServiceAllowance {
  /** Extra length for routing slack, % of the routed length. */
  pct: number;
  /** Service loop / drop at each end of every cable, metres. */
  endM: number;
}

/** A manifold the user accepted: valves grouped at one point. */
export interface AcceptedManifold { tag: string; valves: string[]; x: number; y: number }
/** A remote I/O / IO-Link block the user accepted. */
export interface AcceptedRemoteIo { tag: string; devices: string[]; x: number; y: number }

export interface MachineLayout {
  background?: { dataUrl: string; w: number; h: number; name: string };
  /** Canvas size (background size, or the blank sheet). */
  canvas: { w: number; h: number };
  scale?: LayoutScale;
  /** Units for showing lengths. */
  display: 'm' | 'ft';
  items: LayoutItem[];
  routes: LayoutRoute[];
  service: ServiceAllowance;
  /** Valves of cylinders closer than this (m) are suggested on one manifold. */
  manifoldRadiusM: number;
  /** Suggestion id -> decision. */
  decisions: Record<string, 'accepted' | 'ignored'>;
  manifolds: AcceptedManifold[];
  remoteIo: AcceptedRemoteIo[];
}

export const EMPTY_LAYOUT: MachineLayout = {
  canvas: { w: 1600, h: 1000 },
  display: 'm',
  items: [],
  routes: [],
  service: { pct: 10, endM: 1 },
  manifoldRadiusM: 2,
  decisions: {},
  manifolds: [],
  remoteIo: [],
};

/**
 * What the electrical design needs from the layout, in metres (on DrawingContext.machineLayout).
 * Only placed items are listed; no scale = no layout for the design.
 */
export interface LayoutForDesign {
  pos: Record<string, { x: number; y: number }>;
  routes: { kind: RouteKind; pts: [number, number][] }[];
  service: ServiceAllowance;
  manifolds: AcceptedManifold[];
  remoteIo: AcceptedRemoteIo[];
  /** For the drawing sheet: background picture and its size in metres. */
  background?: { dataUrl: string; wM: number; hM: number };
  /** Canvas size in metres. */
  sizeM: { w: number; h: number };
}

export const CABINET = 'CABINET';
export const AIR = 'AIR';
