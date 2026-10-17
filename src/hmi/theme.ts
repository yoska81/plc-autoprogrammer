import type { AccessLevel, HmiLook, HmiStyle } from './types';
import { hmiMakerOf } from './hmiCatalog';

/** Colours of one HMI look. Every look has the same keys. */
export interface HmiPalette {
  screen: string;
  /** Top of the soft glow behind the screen (equal to `screen` for a flat background). */
  glow: string;
  header: string;
  /** Text, secondary text and divider lines on the header bar. */
  headerText: string;
  headerDim: string;
  headerLine: string;
  /** Stripe under the header bar (equal to `header` when the look has none). */
  headerAccent: string;
  /** Mode / alarm badges on the header in their normal (quiet) state. */
  headerBadge: string;
  headerBadgeLine: string;
  panel: string;
  surface: string;
  surfaceUp: string;
  line: string;
  lineSoft: string;
  /** Raised-button bottom edge (3D look). */
  bevel: string;
  /** Entry / display field (numeric values, trend plot). */
  field: string;
  text: string;
  dim: string;
  faint: string;
  accent: string;
  /** Text on an accent fill. */
  onAccent: string;
  /** Neutral (off) button face and its text. */
  button: string;
  buttonText: string;
  /** Pressed (momentary) button fill. */
  pressed: string;
  /** Lamp when off. */
  lampOff: string;
  /** Band behind the navigation buttons, the label of a screen button there, and the current screen's button. */
  navBand: string;
  navText: string;
  navActive: string;
  navActiveText: string;
  ok: string;
  warning: string;
  alarm: string;
  /** State colours readable as text on the screen and panel backgrounds. */
  okText: string;
  warningText: string;
  alarmText: string;
  /** Trend line of a normal value. */
  trend: string;
  select: string;
}

// Minimal dark console style (Tesla / SpaceX look): near-black world, thin
// lines, one accent; colour only carries meaning (ok / warning / alarm), which
// also follows ISA-101 high-performance practice.
export const C: HmiPalette = {
  screen: '#0a0c0f',
  glow: '#1c1f24',
  header: '#101317',
  headerText: '#eef0f3',
  headerDim: '#8b929d',
  headerLine: '#2b3038',
  headerAccent: '#1f7bff',
  headerBadge: '#1d2128',
  headerBadgeLine: '#2b3038',
  panel: '#0f1216',
  surface: '#15181d',
  surfaceUp: '#1d2128',
  line: '#2b3038',
  lineSoft: '#20242b',
  bevel: '#2b3038',
  field: '#15181d',
  text: '#eef0f3',
  dim: '#8b929d',
  faint: '#5a616c',
  accent: '#1f7bff',
  onAccent: '#ffffff',
  button: '#1d2128',
  buttonText: '#eef0f3',
  pressed: '#10264a',
  lampOff: '#5a616c',
  navBand: '#0f1216',
  navText: '#8b929d',
  navActive: '#1d2128',
  navActiveText: '#eef0f3',
  ok: '#33c47a',
  warning: '#f2a93b',
  alarm: '#e5484d',
  okText: '#33c47a',
  warningText: '#f2a93b',
  alarmText: '#e5484d',
  trend: '#1f7bff',
  select: '#7aa2ff',
};

// Siemens WinCC Comfort / Unified operator panel in the app's blue: light grey
// screen, raised light buttons, a deep blue header bar, colour for state only
// (ISA-101). Text colours keep at least 4.5:1 on the screen and the panels.
export const SIEMENS: HmiPalette = {
  screen: '#e6e9ed',
  glow: '#e6e9ed',
  header: '#0b2a5c',
  headerText: '#ffffff',
  headerDim: '#c3d2ea',
  headerLine: '#2d4f86',
  headerAccent: '#0d6efd',
  headerBadge: '#233f6c',
  headerBadgeLine: '#506a91',
  panel: '#f4f6f8',
  surface: '#f4f6f8',
  surfaceUp: '#e9edf1',
  line: '#b9c1ca',
  lineSoft: '#d3d9df',
  bevel: '#8c96a0',
  field: '#ffffff',
  text: '#1d2327',
  dim: '#55646c',
  faint: '#5b6770',
  accent: '#0d6efd',
  onAccent: '#ffffff',
  button: '#f7f8fa',
  buttonText: '#1d2327',
  pressed: '#d5dbe1',
  lampOff: '#c3cad1',
  navBand: '#d5dbe1',
  navText: '#1d2327',
  navActive: '#0d6efd',
  navActiveText: '#ffffff',
  ok: '#1a7f43',
  warning: '#e69a00',
  alarm: '#d42f2f',
  okText: '#136d36',
  warningText: '#8a5700',
  alarmText: '#b42323',
  trend: '#0d6efd',
  select: '#0d6efd',
};

/*
 * Maker-style looks. Each one is our own recreation of the general feel of the
 * maker's standard screen objects (colours, corners, bevels, lamp shapes, the
 * header and navigation bands); no logos, artwork or trademarks are copied.
 */

// UniStream / Vision style: cool light screen, blue title bar with a soft
// gloss, rounded glossy buttons, round glossy lamps, titled group bands.
export const UNITRONICS: HmiPalette = {
  ...SIEMENS,
  screen: '#eaeff4', glow: '#f6f9fb',
  header: '#17508f', headerText: '#ffffff', headerDim: '#cfe0f3', headerLine: '#3d6fa8', headerAccent: '#f08a1c',
  headerBadge: '#2c6099', headerBadgeLine: '#6b93c1',
  panel: '#f7f9fb', surface: '#f7f9fb', surfaceUp: '#dfe8f1', line: '#a9b9c9', lineSoft: '#ccd7e2', bevel: '#7f93a8',
  text: '#1b2733', dim: '#4b5e70', faint: '#536678',
  accent: '#1667c1', button: '#e3ecf5', buttonText: '#1b2733', pressed: '#b9cde2', lampOff: '#b8c4d0',
  navBand: '#cfdbe7', navText: '#1b2733', navActive: '#1667c1', navActiveText: '#ffffff',
  ok: '#22863a', okText: '#1b6e30', trend: '#1667c1', select: '#f08a1c',
};

// Yaskawa iCube / MP-series HMI style: mid-grey screen, deep navy title bar,
// nearly square low-bevel keys, square lamps, flat tabbed navigation strip.
export const YASKAWA: HmiPalette = {
  ...SIEMENS,
  screen: '#d8dde3', glow: '#d8dde3',
  header: '#0a2d63', headerText: '#ffffff', headerDim: '#bccde6', headerLine: '#2a4c82', headerAccent: '#0a2d63',
  headerBadge: '#1f4176', headerBadgeLine: '#5674a3',
  panel: '#eceff2', surface: '#eceff2', surfaceUp: '#cfd6de', line: '#9ba7b4', lineSoft: '#c3cbd4', bevel: '#76828f',
  text: '#16202b', dim: '#46525e', faint: '#4c5865',
  accent: '#0062b1', button: '#f1f3f5', buttonText: '#16202b', pressed: '#c3ccd6', lampOff: '#aeb8c2',
  navBand: '#2c3e57', navText: '#e8eef6', navActive: '#0062b1', navActiveText: '#ffffff',
  ok: '#1d7d3e', okText: '#176833', warningText: '#6e4600', alarmText: '#a01f1f', trend: '#0062b1', select: '#0062b1',
};

// Weintek EasyBuilder Pro default objects: pale screen, gradient window bar,
// steel-blue glossy 3D buttons with rounded corners, round glossy lamps.
export const WEINTEK: HmiPalette = {
  ...SIEMENS,
  screen: '#f0f0f0', glow: '#fafafa',
  header: '#244a7c', headerText: '#ffffff', headerDim: '#c9d8ec', headerLine: '#4a6c99', headerAccent: '#244a7c',
  headerBadge: '#36598a', headerBadgeLine: '#7090ba',
  panel: '#fbfbfb', surface: '#fbfbfb', surfaceUp: '#e3e8ee', line: '#aab3bd', lineSoft: '#d0d5db', bevel: '#7d8894',
  text: '#1a1f24', dim: '#4c5660', faint: '#525c66',
  accent: '#2d6fc0', button: '#dfe7f1', buttonText: '#1a1f24', pressed: '#b4c4d8', lampOff: '#bcc3ca',
  navBand: '#dde1e6', navText: '#1a1f24', navActive: '#2d6fc0', navActiveText: '#ffffff',
  ok: '#1f8a3a', okText: '#1a7030', trend: '#d0021b', select: '#2d6fc0',
};

// AutomationDirect C-more style: classic grey screen, navy title bar with a
// gold rule, chunky square-cornered raised keys, upper-case labels, round lamps.
export const CMORE: HmiPalette = {
  ...SIEMENS,
  screen: '#c9cfd6', glow: '#c9cfd6',
  header: '#1b3456', headerText: '#ffffff', headerDim: '#c4d1e3', headerLine: '#3c5579', headerAccent: '#e3a21a',
  headerBadge: '#2c4467', headerBadgeLine: '#62789a',
  panel: '#e3e7eb', surface: '#e3e7eb', surfaceUp: '#d0d6dd', line: '#8d98a4', lineSoft: '#b5bec7', bevel: '#5f6a76',
  text: '#121a22', dim: '#3c4752', faint: '#414c58',
  accent: '#1f5fae', button: '#e9ecef', buttonText: '#121a22', pressed: '#b3bcc6', lampOff: '#9da7b1',
  navBand: '#aab3bd', navText: '#121a22', navActive: '#1f5fae', navActiveText: '#ffffff',
  ok: '#1c7c38', okText: '#155f2b', warningText: '#6e4600', alarmText: '#a31f1f', trend: '#1f5fae', select: '#1f5fae',
};

// Allen-Bradley FactoryTalk View / PanelView Plus style: neutral grey screen,
// charcoal title bar, square-cornered Windows-like 3D keys, flat round lamps.
export const FACTORYTALK: HmiPalette = {
  ...SIEMENS,
  screen: '#c6c6c6', glow: '#c6c6c6',
  header: '#3a3a3a', headerText: '#ffffff', headerDim: '#d0d0d0', headerLine: '#5a5a5a', headerAccent: '#3a3a3a',
  headerBadge: '#4a4a4a', headerBadgeLine: '#7a7a7a',
  panel: '#d6d6d6', surface: '#d6d6d6', surfaceUp: '#bdbdbd', line: '#8a8a8a', lineSoft: '#a9a9a9', bevel: '#5c5c5c',
  field: '#ffffff', text: '#111111', dim: '#3a3a3a', faint: '#3f3f3f',
  accent: '#1f5ca8', button: '#dcdcdc', buttonText: '#111111', pressed: '#a6a6a6', lampOff: '#8f8f8f',
  navBand: '#b0b0b0', navText: '#111111', navActive: '#1f5ca8', navActiveText: '#ffffff',
  ok: '#17803a', alarm: '#c41e1e', okText: '#0e5626', warningText: '#5f3d00', alarmText: '#8a1818', trend: '#1f5ca8', select: '#1f5ca8',
};

// Pro-face GP-Pro EX style: dark slate screen, glossy dark title bar, rounded
// glossy part-library switches, bright round lamps; light text.
export const PROFACE: HmiPalette = {
  screen: '#1f252d', glow: '#2b333d',
  header: '#11161c', headerText: '#f2f5f8', headerDim: '#a9b4c0', headerLine: '#36404c', headerAccent: '#2a8cf0',
  headerBadge: '#232b35', headerBadgeLine: '#4a5664',
  panel: '#262d36', surface: '#262d36', surfaceUp: '#323b46', line: '#4a5664', lineSoft: '#36404c', bevel: '#0c1015',
  field: '#0f1318', text: '#f2f5f8', dim: '#b2bcc7', faint: '#9aa5b1',
  accent: '#2a8cf0', onAccent: '#08111c', button: '#3b4654', buttonText: '#f2f5f8', pressed: '#1c2836', lampOff: '#4a5562',
  navBand: '#161b21', navText: '#d5dce4', navActive: '#2a8cf0', navActiveText: '#08111c',
  ok: '#1f9a46', warning: '#f5b324', alarm: '#d23431', okText: '#4fd57a', warningText: '#f5b324', alarmText: '#ff7c78',
  trend: '#4fc3ff', select: '#7fbfff',
};

// Omron NA / NB style: bright modern screen, white title bar with a blue rule,
// flat rounded buttons, rounded-square lamps, flat tabbed navigation.
export const OMRON: HmiPalette = {
  ...SIEMENS,
  screen: '#f3f5f8', glow: '#f3f5f8',
  header: '#ffffff', headerText: '#14202c', headerDim: '#4d5c6b', headerLine: '#d3dae2', headerAccent: '#005eb8',
  headerBadge: '#eef2f6', headerBadgeLine: '#c3ccd6',
  panel: '#ffffff', surface: '#ffffff', surfaceUp: '#eaeef3', line: '#c3ccd6', lineSoft: '#dde3e9', bevel: '#9aa6b2',
  text: '#14202c', dim: '#4d5c6b', faint: '#536170',
  accent: '#005eb8', button: '#e6ebf1', buttonText: '#14202c', pressed: '#c8d3df', lampOff: '#c6ced7',
  navBand: '#ffffff', navText: '#3b4957', navActive: '#e3eefa', navActiveText: '#004a91',
  ok: '#1e8743', okText: '#18703a', trend: '#005eb8', select: '#005eb8',
};

// Schneider Vijeo Designer style: warm light grey screen, dark green-grey title
// bar with a green rule, raised rounded keys, round glossy lamps, titled bands.
export const SCHNEIDER: HmiPalette = {
  ...SIEMENS,
  screen: '#e3e5e2', glow: '#eef0ed',
  header: '#26332b', headerText: '#ffffff', headerDim: '#c5d3c9', headerLine: '#46554b', headerAccent: '#3dae5b',
  headerBadge: '#36443b', headerBadgeLine: '#6a7a6f',
  panel: '#f3f4f2', surface: '#f3f4f2', surfaceUp: '#dde1dc', line: '#a7aea6', lineSoft: '#cbd0ca', bevel: '#7b8379',
  text: '#1b201c', dim: '#4a524b', faint: '#4f5750',
  accent: '#00803a', button: '#f2f3f1', buttonText: '#1b201c', pressed: '#c9cfc8', lampOff: '#b9bfb8',
  navBand: '#cfd4ce', navText: '#1b201c', navActive: '#00803a', navActiveText: '#ffffff',
  ok: '#1f8a3e', okText: '#1a7033', trend: '#00803a', select: '#00803a',
};

// ISA-101 high-performance HMI: grey world, dark grey text, no colour unless
// something is abnormal (alarm / warning). Running equipment is a dark grey
// fill, stopped is a hollow light grey; START / STOP are grey keys like the rest.
export const ISA101: HmiPalette = {
  screen: '#d4d4d4', glow: '#d4d4d4',
  header: '#bdbdbd', headerText: '#141414', headerDim: '#333333', headerLine: '#9a9a9a', headerAccent: '#bdbdbd',
  headerBadge: '#cccccc', headerBadgeLine: '#8f8f8f',
  panel: '#dddddd', surface: '#dddddd', surfaceUp: '#cacaca', line: '#9e9e9e', lineSoft: '#bdbdbd', bevel: '#8a8a8a',
  field: '#ececec', text: '#141414', dim: '#3b3b3b', faint: '#404040',
  accent: '#3f5f80', onAccent: '#ffffff', button: '#e4e4e4', buttonText: '#141414', pressed: '#b5b5b5', lampOff: '#f0f0f0',
  navBand: '#c4c4c4', navText: '#262626', navActive: '#efefef', navActiveText: '#141414',
  ok: '#4a4a4a', warning: '#f0b400', alarm: '#d71920', okText: '#2b2b2b', warningText: '#6a4a00', alarmText: '#a5141a',
  trend: '#1f3f66', select: '#1f4f8f',
};

/**
 * Shapes and drawing style of a look: what the renderer changes besides colours.
 * 'console' looks use the dark console renderer; 'panel' looks the operator-panel renderer.
 */
export interface HmiShape {
  family: 'console' | 'panel';
  /** Corner radius of buttons and screen buttons. */
  radius: number;
  /** Corner radius of fields, group frames and boxes. */
  boxRadius: number;
  /** Button body: 3D bevel (darker bottom edge), glossy gradient, or flat with a 1 px border. */
  button: 'bevel' | 'gloss' | 'flat';
  lamp: 'round' | 'square' | 'rounded';
  /** Highlight on lamps (a lens) or flat colour. */
  lampGloss: boolean;
  /** Screen buttons as raised keys, or flat tabs (the current screen marked by a bar). */
  nav: 'tiles' | 'tabs';
  /** Header bar: solid with an accent stripe, a soft gloss, or plain with a thin rule. */
  header: 'stripe' | 'gloss' | 'plain';
  /** Corner radius of the header's mode / alarm badges. */
  badgeRadius: number;
  /** Group frame title: a light strip, a header-coloured band, or a caption over a rule. */
  frame: 'strip' | 'band' | 'line';
  /** Sunken (inset) value fields. */
  fieldInset: boolean;
  /** Labels on buttons and screen buttons in upper case. */
  upper: boolean;
  /** Weight of button labels, values and titles. */
  weight: number;
  /** Green START / red STOP faces (false: grey keys like the rest, ISA-101 high performance). */
  colorKeys: boolean;
}

const PANEL: HmiShape = {
  family: 'panel', radius: 3, boxRadius: 2, button: 'bevel', lamp: 'round', lampGloss: true, nav: 'tiles', header: 'stripe',
  badgeRadius: 3, frame: 'strip', fieldInset: true, upper: false, weight: 700, colorKeys: true,
};

export const SHAPES: Record<HmiLook, HmiShape> = {
  dark: { ...PANEL, family: 'console', radius: 12, boxRadius: 10, button: 'flat', nav: 'tabs', header: 'plain', badgeRadius: 15, upper: true, weight: 600 },
  siemens: PANEL,
  unitronics: { ...PANEL, radius: 8, boxRadius: 5, button: 'gloss', header: 'gloss', badgeRadius: 10, frame: 'band' },
  yaskawa: { ...PANEL, radius: 2, boxRadius: 1, lamp: 'square', lampGloss: false, nav: 'tabs', header: 'plain', badgeRadius: 1, frame: 'band', upper: true },
  weintek: { ...PANEL, radius: 6, boxRadius: 3, button: 'gloss', header: 'gloss', badgeRadius: 4 },
  cmore: { ...PANEL, radius: 1, boxRadius: 1, badgeRadius: 2, upper: true },
  factorytalk: { ...PANEL, radius: 0, boxRadius: 0, lampGloss: false, header: 'plain', badgeRadius: 0, frame: 'line' },
  proface: { ...PANEL, radius: 10, boxRadius: 6, button: 'gloss', header: 'gloss', badgeRadius: 12, fieldInset: false },
  omron: { ...PANEL, radius: 6, boxRadius: 6, button: 'flat', lamp: 'rounded', lampGloss: false, nav: 'tabs', badgeRadius: 12, frame: 'line', fieldInset: false, weight: 600 },
  schneider: { ...PANEL, radius: 4, boxRadius: 3, frame: 'band' },
  isa101: { ...PANEL, radius: 2, boxRadius: 2, button: 'flat', lamp: 'square', lampGloss: false, nav: 'tabs', header: 'plain', badgeRadius: 2, frame: 'line', fieldInset: false, weight: 600, colorKeys: false },
};

/** Every look, in the order the picker lists them. */
export const HMI_LOOKS: HmiLook[] = ['dark', 'siemens', 'isa101', 'factorytalk', 'cmore', 'weintek', 'unitronics', 'yaskawa', 'proface', 'omron', 'schneider'];

export const PALETTES: Record<HmiLook, HmiPalette> = {
  dark: C, siemens: SIEMENS, unitronics: UNITRONICS, yaskawa: YASKAWA, weintek: WEINTEK, cmore: CMORE,
  factorytalk: FACTORYTALK, proface: PROFACE, omron: OMRON, schneider: SCHNEIDER, isa101: ISA101,
};

export const LOOK_LABEL: Record<HmiLook, string> = {
  dark: 'Dark console',
  siemens: 'Siemens (light)',
  isa101: 'High performance (ISA-101 grey)',
  factorytalk: 'Allen-Bradley style',
  cmore: 'C-more style',
  weintek: 'Weintek style',
  unitronics: 'Unitronics style',
  yaskawa: 'Yaskawa style',
  proface: 'Pro-face style',
  omron: 'Omron style',
  schneider: 'Schneider style',
};

/** One line about each look, for the picker. */
export const LOOK_NOTE: Record<HmiLook, string> = {
  dark: 'Near-black screen, thin lines, one blue accent.',
  siemens: 'Light grey screen, raised keys, deep blue header.',
  isa101: 'Grey screen; colour only for alarms and warnings.',
  factorytalk: 'Grey screen, charcoal header, square 3D keys.',
  cmore: 'Classic grey, navy header, chunky upper-case keys.',
  weintek: 'Pale screen, glossy steel-blue rounded keys.',
  unitronics: 'Cool light screen, glossy rounded keys, blue bar.',
  yaskawa: 'Mid grey, navy header, square keys and lamps, tabs.',
  proface: 'Dark slate screen, glossy rounded switches.',
  omron: 'Bright and flat, white header, rounded tabs.',
  schneider: 'Warm grey, green rule, raised rounded keys.',
};

export const DEFAULT_LOOK: HmiLook = 'dark';
const isLook = (l: unknown): l is HmiLook => typeof l === 'string' && (HMI_LOOKS as string[]).includes(l);

/** The look that matches a panel maker's own standard screens (the dark console for makers without one). */
export function lookForMaker(maker: string | null | undefined): HmiLook {
  const m = (maker ?? '').toLowerCase();
  if (/siemens/.test(m)) return 'siemens';
  if (/allen-?bradley|rockwell/.test(m)) return 'factorytalk';
  if (/automationdirect|c-more/.test(m)) return 'cmore';
  // Maple Systems panels are configured in an editor built on the same base as Weintek's.
  if (/weintek|weinview|maple/.test(m)) return 'weintek';
  if (/unitronics/.test(m)) return 'unitronics';
  if (/yaskawa/.test(m)) return 'yaskawa';
  if (/pro-?face/.test(m)) return 'proface';
  if (/omron/.test(m)) return 'omron';
  if (/schneider/.test(m)) return 'schneider';
  return DEFAULT_LOOK;
}

/** The look a panel part number gets when the user has not picked one. */
export const defaultLookFor = (hmiPartNumber: string | null | undefined): HmiLook => (hmiPartNumber ? lookForMaker(hmiMakerOf(hmiPartNumber)) : DEFAULT_LOOK);

/**
 * The look a design renders with: the one the user picked, else the look of the panel's
 * maker (a Weintek panel → the Weintek look; also designs saved before looks existed).
 */
export function lookOf(design: { look?: HmiLook; hmiPartNumber?: string } | undefined | null): HmiLook {
  const picked = design?.look;
  return isLook(picked) ? picked : defaultLookFor(design?.hmiPartNumber);
}
export const palette = (look: HmiLook = DEFAULT_LOOK): HmiPalette => PALETTES[look] ?? C;

export const FONT = "Barlow, 'D-DIN', 'Segoe UI', Arial, sans-serif";
export const MONO = "'JetBrains Mono', 'SFMono-Regular', Consolas, monospace";
/** Siemens panels use Arial-like fonts. */
export const SIEMENS_FONT = "Arial, 'Segoe UI', Helvetica, sans-serif";
/** Web-safe font stacks of the maker looks (all end on Arial-width fallbacks, so text fits the same everywhere). */
const TAHOMA = "Tahoma, 'Segoe UI', Arial, Helvetica, sans-serif";
const SEGOE = "'Segoe UI', Arial, Helvetica, sans-serif";

/** Everything the renderer needs to draw in one look. */
export interface HmiTheme extends HmiPalette {
  look: HmiLook;
  shape: HmiShape;
  font: string;
  mono: string;
  /** Upper-case labels (dark console) or text as written (Siemens). */
  caps: (s: string) => string;
  /** Letter spacing: as given on the dark console, none on the panel looks. */
  ls: (n: number) => number;
  /** Weight of big values and titles (light on the console, regular on the panels). */
  thin: number;
  /** Date under the clock. */
  date: (ms: number) => string;
  /** Light screen (dark text) or dark screen. */
  light: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
export const fmtTime = (ms: number) => { const d = new Date(ms); return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; };
export const fmtDate = (ms: number) => { const d = new Date(ms); return `${pad(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
/** Numeric date as on a WinCC panel: 16.10.2026. */
export const fmtDateNum = (ms: number) => { const d = new Date(ms); return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`; };

/** US date as on a C-more / PanelView: 10/16/2026. */
export const fmtDateUs = (ms: number) => { const d = new Date(ms); return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()}`; };
/** ISO date (Asian makers' panels): 2026-10-16. */
export const fmtDateIso = (ms: number) => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

const asIs = (s: string) => s;
const upper = (s: string) => s.toUpperCase();
const panelTheme = (look: HmiLook, font: string, date: (ms: number) => string = fmtDateNum): HmiTheme => ({
  ...PALETTES[look], look, shape: SHAPES[look], font, mono: font, caps: SHAPES[look].upper ? upper : asIs, ls: () => 0, thin: 400, date,
  light: contrast(PALETTES[look].text, '#000000') < contrast(PALETTES[look].text, '#ffffff'),
});

const THEMES: Record<HmiLook, HmiTheme> = {
  dark: { ...C, look: 'dark', shape: SHAPES.dark, font: FONT, mono: MONO, caps: upper, ls: (n) => n, thin: 300, date: fmtDate, light: false },
  siemens: panelTheme('siemens', SIEMENS_FONT),
  isa101: panelTheme('isa101', SEGOE),
  factorytalk: panelTheme('factorytalk', SIEMENS_FONT, fmtDateUs),
  cmore: panelTheme('cmore', SIEMENS_FONT, fmtDateUs),
  weintek: panelTheme('weintek', SIEMENS_FONT, fmtDateIso),
  unitronics: panelTheme('unitronics', TAHOMA),
  yaskawa: panelTheme('yaskawa', SEGOE, fmtDateIso),
  proface: panelTheme('proface', TAHOMA, fmtDateIso),
  omron: panelTheme('omron', SEGOE, fmtDateIso),
  schneider: panelTheme('schneider', SIEMENS_FONT),
};
/** The renderer's theme for a look (defaults to the dark console). */
export const hmiTheme = (look: HmiLook = DEFAULT_LOOK): HmiTheme => THEMES[look] ?? THEMES[DEFAULT_LOOK];

/** Fill (null = none) and text colour of a group frame's title in the look's frame style. */
export const frameTitle = (t: HmiTheme): { fill: string | null; text: string } =>
  t.shape.frame === 'band' ? { fill: t.header, text: t.headerText } : t.shape.frame === 'strip' ? { fill: t.surfaceUp, text: t.text } : { fill: null, text: t.text };

export const styleColor = (style: HmiStyle | undefined, p: HmiPalette = C) =>
  style === 'alarm' ? p.alarm : style === 'warning' ? p.warning : style === 'ok' ? p.ok : p.accent;

/** Text colour for a state: abnormal states are coloured, normal ones stay plain (ISA-101). */
export const stateTextColor = (style: HmiStyle | undefined, p: HmiPalette = C) =>
  style === 'alarm' ? p.alarmText : style === 'warning' ? p.warningText : style === 'ok' ? p.okText : p.text;

/** WCAG contrast ratio of two #rrggbb colours. */
export function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  };
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

export const caps = (s: string) => s.toUpperCase();

/** A #rrggbb colour mixed towards black (f < 0) or white (f > 0) by |f|. */
export function shade(hex: string, f: number): string {
  const to = f < 0 ? 0 : 255, k = Math.min(1, Math.abs(f));
  return `#${[1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - k) + to * k).toString(16).padStart(2, '0')).join('')}`;
}

/** Text on an amber (warning) fill: the look's dark text, or near-black on dark looks. */
export const onWarning = (t: HmiPalette & { light: boolean }) => (t.light ? t.text : '#111111');

/** Rough rendered width of a label (no DOM measuring, works off-screen and in PDF export). */
export function textWidth(text: string, fontSize: number, letterSpacing = 0): number {
  let w = 0;
  for (const ch of text) w += /[MW]/.test(ch) ? 0.86 : /[A-Z0-9]/.test(ch) ? 0.62 : /[mw]/.test(ch) ? 0.8 : /[ .,:;'|!il1jtf]/.test(ch) ? 0.3 : 0.55;
  return w * fontSize + text.length * letterSpacing;
}

/** Largest font size (down to `min`) at which `text` fits `maxW`. */
export function fitSize(text: string, maxW: number, size: number, min: number, letterSpacing = 0): number {
  let fs = size;
  while (fs > min && textWidth(text, fs, letterSpacing) > maxW) fs -= 0.5;
  return fs;
}

/** Shorten text with an ellipsis so it fits `maxW`. */
export function fitText(text: string, maxW: number, fontSize: number, letterSpacing = 0): string {
  if (textWidth(text, fontSize, letterSpacing) <= maxW) return text;
  let t = text;
  while (t.length > 1 && textWidth(`${t}…`, fontSize, letterSpacing) > maxW) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

export const LEVEL_LABEL: Record<AccessLevel, string> = { operator: 'Operator', maintenance: 'Maintenance', engineer: 'Engineer' };
export const LEVEL_SHORT: Record<AccessLevel, string> = { operator: '', maintenance: 'M', engineer: 'E' };
