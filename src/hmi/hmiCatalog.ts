/**
 * AutomationDirect HMI catalog for designing HMI screens for CLICK PLC machines.
 *
 * Every value here was read from AutomationDirect material (researched 2026-10-16):
 *  - Product pages https://www.automationdirect.com/pn/<PART> (price, stock,
 *    lifecycle notes; retired parts redirect to .../catalog/retired_products/...)
 *  - Cut sheets https://cdn.automationdirect.com/static/specs/cutsheet/<PART>_cutsheet.pdf
 *  - CM5 catalog section, e.g. https://cdn.automationdirect.com/static/specs/cm5t7w.pdf
 *    (pages tCM5-1..tCM5-10: selection guide, per-model cutout drawings, specs)
 *  - EA9 catalog section https://cdn.automationdirect.com/static/specs/ea9overview.pdf
 *  - C-more Micro catalog section https://cdn.automationdirect.com/static/specs/ea3overview.pdf
 *    and https://cdn.automationdirect.com/static/specs/ea3t4cl.pdf
 *  - 2D drawings https://cdn.automationdirect.com/static/drawings/<PART>.pdf
 *
 * Lifecycle as of 2026-10-16:
 *  - The C-more EA9 touch panel line is being replaced by the C-more CM5 series.
 *    Only EA9-T10WCL and EA9-RHMI are still sold, and both product pages say
 *    "Product stock is expected to be available through 2025. Once stock is
 *    depleted, this product will be discontinued." All other EA9 panels are
 *    retired (see RETIRED_HMI_MODELS).
 *  - There is no "Basic"/"-R" EA9 variant still sold: EA9-T6CL-R, EA9-T7CL-R and
 *    EA9-T15CL-R are retired. There is no current EA9 4", 6", 7", 8", 12" or 15" panel.
 *  - C-more Micro EA3 is still sold in 3", 4" and 6" sizes. EA3-T8CL and
 *    EA3-T10CL are retired.
 *
 * Dimensions: width x height in landscape orientation, in mm as printed on the
 * AutomationDirect drawing (cutout = panel hole, bezel = outside of the front bezel).
 */

import { catalogPanel } from './panels';

export interface HmiModel {
  partNumber: string; // exact maker part number
  /** 'C-more' / 'C-more Micro' for the AutomationDirect list; the product family for catalog panels. */
  family: string;
  /** Maker; absent = AutomationDirect (the C-more list below). */
  manufacturer?: string;
  /** The maker's configuration software, as the datasheet names it (catalog panels). */
  software?: string;
  /** From the multi-vendor parts catalog (src/hmi/panels.ts) rather than the C-more list. */
  catalog?: boolean;
  description: string;
  sizeIn: number; // diagonal inches
  widthPx: number;
  heightPx: number; // native resolution
  touch: boolean;
  color: boolean;
  ethernet: boolean;
  serial: string; // ports summary
  supportsClickEthernet: boolean; // can talk to CLICK over Ethernet (Modbus TCP / CLICK driver)
  cutoutMm?: { width: number; height: number }; // panel cutout, for the door layout drawing
  bezelMm?: { width: number; height: number };
  url: string;
  verified: boolean;
}

const PN_URL = 'https://www.automationdirect.com/pn/';

export const HMI_MODELS: HmiModel[] = [
  // ---------------------------------------------------------------------------
  // C-more CM5 series (current C-more line). Programmed with CM5-PGMSW v8.0+.
  // All CM5 panels: four-wire analog resistive single touch, 16.7M colors,
  // 12-24 VDC, NEMA 4/4X / IP65 indoor when mounted correctly. Cut sheets list
  // "AutomationDirect CLICK Ethernet" and "AutomationDirect CLICK serial" protocols.
  // Specs: https://cdn.automationdirect.com/static/specs/cm5t7w.pdf (tCM5-9, tCM5-10)
  // Cutout/bezel: "Cutout Dimensions" drawing on each model's catalog page (tCM5-2..7).
  // ---------------------------------------------------------------------------
  {
    partNumber: 'CM5-T4W',
    family: 'C-more',
    description:
      'C-more CM5 4.3in color TFT touch HMI, 480 x 272 WQVGA, resistive single-touch, (1) Ethernet, (2) serial, (2) USB, (1) SD slot, 45MB project memory. Same mounting cutout as C-more Micro EA3-T4CL and 3in panels.',
    sizeIn: 4.3,
    widthPx: 480,
    heightPx: 272,
    touch: true,
    color: true,
    ethernet: true,
    serial:
      'Port 1: 15-pin D-sub RS-232C/RS-422/485; Port 2: RJ12 RS-232C. No 3-wire RS-485 terminal (RS-485 via USB-485M adapter).',
    supportsClickEthernet: true,
    // tCM5-2: bezel 4.76in [120.9], cutout 4.02in [102.1]; bezel 3.48in [88.3], cutout 2.76in [70.1]
    cutoutMm: { width: 102.1, height: 70.1 },
    bezelMm: { width: 120.9, height: 88.3 },
    url: `${PN_URL}CM5-T4W`,
    verified: true,
  },
  {
    partNumber: 'CM5-T7W',
    family: 'C-more',
    description:
      'C-more CM5 7in color TFT touch HMI, 800 x 480 WVGA, resistive single-touch, (1) Ethernet, (2) serial, (2) USB, (1) SD slot, 45MB project memory. Comparable replacement for EA9-T7CL(-R) and EA9-T6CL(-R); mounts in the same cutout.',
    sizeIn: 7,
    widthPx: 800,
    heightPx: 480,
    touch: true,
    color: true,
    ethernet: true,
    serial:
      'Port 1: 15-pin D-sub RS-232C/RS-422/485; Port 2: RJ12 RS-232C. No 3-wire RS-485 terminal (RS-485 via USB-485M adapter).',
    supportsClickEthernet: true,
    // tCM5-3: bezel 8.08in [205.2], cutout 7.46in [189.5]; bezel 6.13in [155.8], cutout 5.51in [140.0]
    cutoutMm: { width: 189.5, height: 140.0 },
    bezelMm: { width: 205.2, height: 155.8 },
    url: `${PN_URL}CM5-T7W`,
    verified: true,
  },
  {
    partNumber: 'CM5-T10W',
    family: 'C-more',
    description:
      'C-more CM5 10.1in color TFT touch HMI, 1024 x 600 WSVGA, resistive single-touch, (2) Ethernet, (3) serial, (4) USB-A + USB-B, (1) SD slot, 90MB project memory. Comparable replacement for EA9-T8CL and EA9-T10WCL; mounts in the same cutout.',
    sizeIn: 10.1,
    widthPx: 1024,
    heightPx: 600,
    touch: true,
    color: true,
    ethernet: true,
    serial:
      'Port 1: 15-pin D-sub RS-232C/RS-422/485; Port 2: RJ12 RS-232C; Port 3: 3-wire terminal block RS-485.',
    supportsClickEthernet: true,
    // tCM5-4: bezel 10.55in [268.0], cutout 9.25in [235.0]; bezel 7.71in [195.9], cutout 7.07in [179.6]
    cutoutMm: { width: 235.0, height: 179.6 },
    bezelMm: { width: 268.0, height: 195.9 },
    url: `${PN_URL}CM5-T10W`,
    verified: true,
  },
  {
    partNumber: 'CM5-T12W',
    family: 'C-more',
    description:
      'C-more CM5 12.1in color TFT touch HMI, 1280 x 800 WXGA, resistive single-touch, (2) Ethernet, (3) serial, (4) USB-A + USB-B, (1) SD slot, 90MB project memory. Smaller cutout than EA9-T12CL; fits the EA9-T10CL cutout.',
    sizeIn: 12.1,
    widthPx: 1280,
    heightPx: 800,
    touch: true,
    color: true,
    ethernet: true,
    serial:
      'Port 1: 15-pin D-sub RS-232C/RS-422/485; Port 2: RJ12 RS-232C; Port 3: 3-wire terminal block RS-485.',
    supportsClickEthernet: true,
    // tCM5-5: bezel 12.55in [318.8], cutout 11.91in [302.5]; bezel 9.56in [242.9], cutout 8.92in [226.6]
    cutoutMm: { width: 302.5, height: 226.6 },
    bezelMm: { width: 318.8, height: 242.9 },
    url: `${PN_URL}CM5-T12W`,
    verified: true,
  },
  {
    partNumber: 'CM5-T15W',
    family: 'C-more',
    description:
      'C-more CM5 15.6in color TFT touch HMI, 1366 x 768 HD, resistive single-touch, (2) Ethernet, (3) serial, (4) USB-A + USB-B, (1) SD slot, 90MB project memory. Smaller cutout than EA9-T15CL(-R).',
    sizeIn: 15.6,
    widthPx: 1366,
    heightPx: 768,
    touch: true,
    color: true,
    ethernet: true,
    serial:
      'Port 1: 15-pin D-sub RS-232C/RS-422/485; Port 2: RJ12 RS-232C; Port 3: 3-wire terminal block RS-485.',
    supportsClickEthernet: true,
    // tCM5-6: bezel 16.05in [407.7], cutout 15.43in [391.9]; bezel 11.08in [281.5], cutout 10.47in [265.9]
    cutoutMm: { width: 391.9, height: 265.9 },
    bezelMm: { width: 407.7, height: 281.5 },
    url: `${PN_URL}CM5-T15W`,
    verified: true,
  },
  {
    partNumber: 'CM5-T22W',
    family: 'C-more',
    description:
      'C-more CM5 21.5in color TFT touch HMI, 1920 x 1080 FHD, resistive single-touch, (2) Ethernet, (3) serial, (4) USB-A + USB-B, (1) SD slot, 90MB project memory.',
    sizeIn: 21.5,
    widthPx: 1920,
    heightPx: 1080,
    touch: true,
    color: true,
    ethernet: true,
    serial:
      'Port 1: 15-pin D-sub RS-232C/RS-422/485; Port 2: RJ12 RS-232C; Port 3: 3-wire terminal block RS-485.',
    supportsClickEthernet: true,
    // tCM5-7 (cdn.automationdirect.com/static/specs/cm5t22w.pdf): bezel 21.34in [542.0],
    // cutout 20.74in [526.8]; bezel 14.17in [360.0], cutout 13.57in [344.7]
    cutoutMm: { width: 526.8, height: 344.7 },
    bezelMm: { width: 542.0, height: 360.0 },
    url: `${PN_URL}CM5-T22W`,
    verified: true,
  },
  {
    partNumber: 'CM5-RHMI',
    family: 'C-more',
    description:
      'C-more CM5 headless HMI (no display): drives an external HDMI monitor (640x480, 720x480, 1024x768, 1280x720 or 1920x1080 @ 60Hz; resolution listed is the maximum). (2) Ethernet, (2) serial, (4) USB-A + USB-B, (1) SD slot, 90MB project memory. CM5-PGMSW v8.2+. Direct replacement for EA9-RHMI. No panel cutout (not a front-panel device).',
    sizeIn: 0,
    widthPx: 1920,
    heightPx: 1080,
    touch: false, // no built-in screen; supports external USB touch monitors per the user manual
    color: true,
    ethernet: true,
    serial: 'Port 1: 15-pin D-sub RS-232C/RS-422/485; Port 2: 3-wire terminal block RS-485.',
    supportsClickEthernet: true,
    url: `${PN_URL}CM5-RHMI`,
    verified: true,
  },

  // ---------------------------------------------------------------------------
  // C-more EA9 series: only these two remain for sale, while stock lasts.
  // Programmed with EA9-PGMSW. Specs: https://cdn.automationdirect.com/static/specs/ea9overview.pdf
  // ---------------------------------------------------------------------------
  {
    partNumber: 'EA9-T10WCL',
    family: 'C-more',
    description:
      'C-more EA9 10.1in widescreen color TFT touch HMI, 1024 x 600 WSVGA, 65,536 colors, resistive single-touch, (3) serial, (1) Ethernet, (2) USB, (1) SD slot, audio line out, 43MB project memory. Being discontinued when stock is depleted; AutomationDirect suggests CM5-T10W (mounts in same cutout).',
    sizeIn: 10.1,
    widthPx: 1024,
    heightPx: 600,
    touch: true,
    color: true,
    ethernet: true,
    serial:
      'Port 1: 15-pin D-sub RS-232C/RS-422/485; Port 2: 3-wire terminal block RS-485; Port 3: RJ12 RS-232C.',
    supportsClickEthernet: true,
    // Drawing https://cdn.automationdirect.com/static/drawings/EA9-T10WCL.pdf:
    // cutout 9.25in [235.0] x 7.07in [179.7]; front bezel 11.18in [284.0] x 7.69in [195.4]
    cutoutMm: { width: 235.0, height: 179.7 },
    bezelMm: { width: 284.0, height: 195.4 },
    url: `${PN_URL}EA9-T10WCL`,
    verified: true,
  },
  {
    partNumber: 'EA9-RHMI',
    family: 'C-more',
    description:
      'C-more EA9 headless HMI (no display): HDMI audio/video out (640x480, 720x480, 1024x768 or 1280x720 @ 60Hz; resolution listed is the maximum). (2) serial, (1) Ethernet, (2) USB, (1) SD slot, 82MB project memory. Being discontinued when stock is depleted; CM5-RHMI is the direct replacement. No panel cutout.',
    sizeIn: 0,
    widthPx: 1280,
    heightPx: 720,
    touch: false, // no built-in screen; supports ELO / EETI eGalax external touch monitors
    color: true,
    ethernet: true,
    serial: 'Port 1: 15-pin D-sub RS-232C/RS-422/485; Port 2: 3-wire terminal block RS-485.',
    supportsClickEthernet: true,
    url: `${PN_URL}EA9-RHMI`,
    verified: true,
  },

  // ---------------------------------------------------------------------------
  // C-more Micro EA3 series (still sold). Programmed with the separate C-more
  // Micro software EA-MG-PGMSW (it does not program C-more/CM5 panels).
  // https://cdn.automationdirect.com/static/specs/ea3overview.pdf
  // PLC driver table (ea3t4cl.pdf, tCMM): "AutomationDirect CLICK" serial on
  // port1 or port2, "AutomationDirect CLICK Ethernet". "Ethernet port is built in
  // to EA3-S3ML and EA3-T4CL. EA3-T6CL requires the optional EA-ECOM module for
  // Ethernet. Ethernet communications require external power supply."
  // ---------------------------------------------------------------------------
  {
    partNumber: 'EA3-T4CL',
    family: 'C-more Micro',
    description:
      'C-more Micro EA3 4.3in color TFT touch HMI, 480 x 272 WQVGA, 32K colors, resistive single-touch, (2) serial, (1) Ethernet, (1) microB-USB programming port, 14MB memory, 12-24 VDC.',
    sizeIn: 4.3,
    widthPx: 480,
    heightPx: 272,
    touch: true,
    color: true,
    ethernet: true,
    serial: 'RJ12 RS-232; 15-pin D-sub RS-232/422/485.',
    supportsClickEthernet: true,
    // Drawing https://cdn.automationdirect.com/static/drawings/EA3-T4CL.pdf:
    // cutout 102.0 x 70.0 mm; bezel 120.9 x 88.3 mm
    cutoutMm: { width: 102.0, height: 70.0 },
    bezelMm: { width: 120.9, height: 88.3 },
    url: `${PN_URL}EA3-T4CL`,
    verified: true,
  },
  {
    partNumber: 'EA3-T6CL',
    family: 'C-more Micro',
    description:
      'C-more Micro EA3 5.7in color TFT touch HMI, 320 x 240 QVGA, 32K colors, resistive single-touch, (2) serial, (1) USB-B, 12-24 VDC. No built-in Ethernet: CLICK Ethernet is possible only with the optional EA-ECOM module.',
    sizeIn: 5.7,
    widthPx: 320,
    heightPx: 240,
    touch: true,
    color: true,
    ethernet: false,
    serial: 'RJ12 RS-232; 15-pin D-sub RS-232/422/485. Ethernet only via optional EA-ECOM module.',
    supportsClickEthernet: false, // true only when fitted with EA-ECOM
    // Drawing https://cdn.automationdirect.com/static/drawings/EA3-T6CL.pdf:
    // cutout 161.0 x 122.2 mm; bezel 174.0 x 135.4 mm
    cutoutMm: { width: 161.0, height: 122.2 },
    bezelMm: { width: 174.0, height: 135.4 },
    url: `${PN_URL}EA3-T6CL`,
    verified: true,
  },
  {
    partNumber: 'EA3-S3ML',
    family: 'C-more Micro',
    description:
      'C-more Micro EA3 3.1in monochrome STN touch HMI, 128 x 64 pixel, resistive single-touch, five F-keys with LEDs, (2) serial, (1) Ethernet, (1) microB-USB, 3MB memory.',
    sizeIn: 3.1,
    widthPx: 128,
    heightPx: 64,
    touch: true,
    color: false,
    ethernet: true,
    serial: 'RJ12 RS-232; 15-pin D-sub RS-232/422/485.',
    supportsClickEthernet: true,
    // Drawing https://cdn.automationdirect.com/static/drawings/EA3-S3ML.pdf:
    // cutout 102.0 x 70.0 mm; bezel 114.4 x 82.4 mm
    cutoutMm: { width: 102.0, height: 70.0 },
    bezelMm: { width: 114.4, height: 82.4 },
    url: `${PN_URL}EA3-S3ML`,
    verified: true,
  },
  {
    partNumber: 'EA3-S3ML-R',
    family: 'C-more Micro',
    description:
      'C-more Micro EA3 3.1in monochrome STN touch HMI, 128 x 64 pixel, resistive single-touch, five F-keys, (1) RJ12 serial port only, 5 VDC powered. Serial CLICK only.',
    sizeIn: 3.1,
    widthPx: 128,
    heightPx: 64,
    touch: true,
    color: false,
    ethernet: false,
    serial: 'RJ12 RS-232 only (AutomationDirect CLICK serial supported).',
    supportsClickEthernet: false,
    // Drawing https://cdn.automationdirect.com/static/drawings/EA3-S3ML-R.pdf:
    // cutout 4.02in [102.0] x 2.76in [70.0]; bezel 4.50in [114.4] x 3.24in [82.4]
    cutoutMm: { width: 102.0, height: 70.0 },
    bezelMm: { width: 114.4, height: 82.4 },
    url: `${PN_URL}EA3-S3ML-R`,
    verified: true,
  },
  {
    partNumber: 'EA3-S3ML-RN',
    family: 'C-more Micro',
    description:
      'C-more Micro EA3 3.1in monochrome STN HMI, 128 x 64 pixel, NO touch screen (five F-keys only), (1) RJ12 serial port, 5 VDC powered. NEMA 1 / IP20 unless the optional EA-MG-S3ML-GSK gasket is fitted.',
    sizeIn: 3.1,
    widthPx: 128,
    heightPx: 64,
    touch: false,
    color: false,
    ethernet: false,
    serial: 'RJ12 RS-232 only (AutomationDirect CLICK serial supported).',
    supportsClickEthernet: false,
    // Drawing https://cdn.automationdirect.com/static/drawings/EA3-S3ML-RN.pdf:
    // cutout 4.02in [102.0] x 2.76in [70.0]; bezel 4.50in [114.4] x 3.24in [82.4]
    cutoutMm: { width: 102.0, height: 70.0 },
    bezelMm: { width: 114.4, height: 82.4 },
    url: `${PN_URL}EA3-S3ML-RN`,
    verified: true,
  },
];

/**
 * Retired parts (product page redirects to .../catalog/retired_products/...),
 * with the replacement AutomationDirect names on the CM5 product pages. Do not
 * offer these for new designs.
 */
export const RETIRED_HMI_MODELS: { partNumber: string; replacement?: string; note: string }[] = [
  { partNumber: 'EA9-T6CL', replacement: 'CM5-T7W', note: 'CM5-T7W mounts in same cutout.' },
  { partNumber: 'EA9-T6CL-R', replacement: 'CM5-T7W', note: 'CM5-T7W mounts in same cutout.' },
  { partNumber: 'EA9-T7CL', replacement: 'CM5-T7W', note: 'CM5-T7W mounts in same cutout.' },
  { partNumber: 'EA9-T7CL-R', replacement: 'CM5-T7W', note: 'CM5-T7W mounts in same cutout.' },
  { partNumber: 'EA9-T8CL', replacement: 'CM5-T10W', note: 'CM5-T10W mounts in same cutout.' },
  { partNumber: 'EA9-T10CL', replacement: 'CM5-T12W', note: 'CM5-T12W fits the EA9-T10CL cutout.' },
  { partNumber: 'EA9-T12CL', replacement: 'CM5-T12W', note: 'CM5-T12W has a smaller cutout than EA9-T12CL.' },
  { partNumber: 'EA9-T15CL', replacement: 'CM5-T15W', note: 'CM5-T15W has a smaller cutout than EA9-T15CL.' },
  { partNumber: 'EA9-T15CL-R', replacement: 'CM5-T15W', note: 'CM5-T15W has a smaller cutout than EA9-T15CL-R.' },
  { partNumber: 'EA3-T8CL', note: 'Retired C-more Micro 8in; no replacement named on the page checked.' },
  { partNumber: 'EA3-T10CL', note: 'Retired C-more Micro 10in; no replacement named on the page checked.' },
];

/** A C-more model, else a catalog panel of another maker with a confirmed resolution. */
export function getHmi(partNumber: string): HmiModel | undefined {
  const key = partNumber.trim().toUpperCase();
  return HMI_MODELS.find((m) => m.partNumber === key) ?? (key ? catalogPanel(key) : undefined);
}

/** Maker of a panel model. */
export const hmiMaker = (m: Pick<HmiModel, 'manufacturer'>) => m.manufacturer ?? 'AutomationDirect';
/** Maker of a panel by part number (AutomationDirect for the C-more list and unknown numbers). */
export const hmiMakerOf = (partNumber: string) => { const m = getHmi(partNumber); return m ? hmiMaker(m) : 'AutomationDirect'; };
/** True for AutomationDirect C-more / C-more Micro panels (programmed with C-more software). */
export const isCmore = (m: Pick<HmiModel, 'catalog' | 'family'> | undefined) => Boolean(m && !m.catalog && /^C-more/.test(m.family));

/**
 * How C-more talks to a CLICK PLC.
 * Sources:
 *  - C-more help CM500 "AutomationDirect CLICK Ethernet Setup":
 *    https://cdn.automationdirect.com/static/helpfiles/c-more/cm5/Content/500.htm
 *  - C-more help CM501 "AutomationDirect CLICK Serial Setup":
 *    https://cdn.automationdirect.com/static/helpfiles/c-more/cm5/Content/501.htm
 *  - C-more help CM502 "CLICK Modbus Addressing":
 *    https://cdn.automationdirect.com/static/helpfiles/c-more/cm5/Content/502.htm
 *  - CLICK help "Communications Ethernet" (ports / connection limits):
 *    https://cdn.automationdirect.com/static/helpfiles/click/Content/234.htm
 *  - C-more help CM187 "Button Objects" (Momentary On etc.):
 *    https://cdn.automationdirect.com/static/helpfiles/c-more/cm5/Content/187.htm
 *  - Cut sheets (protocol lists), e.g.
 *    https://cdn.automationdirect.com/static/specs/cutsheet/CM5-T7W_cutsheet.pdf
 */
export const CLICK_HMI_COMMUNICATION = `C-more <-> CLICK communication (AutomationDirect C-more help v8.23, CLICK help)

DRIVER
- In C-more Programming Software: Panel Manager (Setup > Panel Manager) > DEV001 > PLC Protocol = "AutomationDirect CLICK Ethernet" (or "AutomationDirect CLICK Serial"). The C-more panel is the master.
- CM5, EA9-T10WCL/RHMI and C-more Micro EA3-S3ML/T4CL cut sheets list both "AutomationDirect CLICK Ethernet" and "AutomationDirect CLICK serial". EA3-S3ML-R/-RN have serial only; EA3-T6CL needs the EA-ECOM module for Ethernet.

ETHERNET SETUP
- IP Address = the CLICK CPU IP (from CLICK software: Setup > Com Port Setup > Com Port1 / Ethernet). The IP Address and TCP port in CLICK Com Port Setup must match the C-more Protocol Manager.
- PLC Port: default 502 (Modbus TCP). Registers per Message default 64, Coils per Message default 64, Retries 0-10, Timeout 1-255 x100 ms, Poll Time 0-30000 ms.
- CLICK limits (CLICK help 234): Modbus TCP Server on TCP 502, max 3 connections per Ethernet port (C0-1x Ethernet CPUs and C2-0xCPU). One HMI uses one of them.
- If the CLICK password is enabled, "Read Data from PLC" and "Write Data into PLC" in CLICK Password Setup must NOT be selected, or the HMI cannot read/write.

SERIAL SETUP (alternative)
- CLICK Port 1 (fixed settings): slave/node 1, 38400 baud, odd parity, Modbus RTU (RTU is the only choice for CLICK). For Port 2 match node, baud, parity and stop bit to the CLICK Com Port2 settings.

ADDRESSES C-more CAN USE (help CM502 "CLICK Modbus Addressing")
  Type  Range        Meaning                     Access      C-more data type
  X     mod 0-8, pt 1-16  Input bit (X001..X816) Read only   Discrete
  XD    0-8          Input word                  Read only   Word
  Y     mod 0-8, pt 1-16  Output bit (Y001..Y816) R/W        Discrete
  YD    0-8          Output word                 R/W         Word (listed as Discrete in the help table)
  C     1-2000       Internal control relay bit  R/W         Discrete
  T     1-500        Timer complete bit          R/W         Discrete
  TD    1-500        Timer current value         R/W         Word
  CT    1-250        Counter complete bit        R/W         Discrete
  CTD   1-250        Counter current value       R/W         Double word
  SC    1-1000       System control bit          Read only   Discrete
  DS    1-4500       Data register signed 16-bit R/W         Word
  DD    1-1000       Data register signed 32-bit R/W         Double word
  DH    1-500        Data register hex           R/W         Word
  DF    1-500        Data register float         R/W         Double word (Floating_PT_32)
  SD    1-1000       System data register        Read only   Word
  TXT   1-1000       Text register               R/W         Byte
- X/Y syntax is module location + point number (module 0 = CPU), e.g. X001 = CPU input 1, X101 = slot 1 point 1.
- The table has no timer/counter SETPOINT memory type (T/CT are done bits, TD/CTD are current values). To make a preset HMI-editable, have the ladder use a data register (e.g. DS) as the setpoint. [engineering practice, not stated in the cited C-more pages]
- C-more cannot set the CLICK clock with its "Internal Clock source" feature; use the CLICK method for changing date/time from an external device.

CONVENTIONS FOR HMI <-> LADDER
- X inputs are READ ONLY from the HMI (CM502). So HMI pushbuttons write to C bits (e.g. C101 "HMI_Start_PB"), and the ladder combines those C bits with the physical X inputs. Y is writable, but do not write HMI buttons directly to Y outputs; let the ladder own the outputs so interlocks apply. [C-bit convention follows from CM502; "don't write Y" is engineering practice]
- Use the C-more Pushbutton "Momentary On" mode (ON only while pressed) for start/jog style commands, "Set On"/"Set Off" or "Toggle" only for latched selections (help CM187). Buttons also offer Press Delay / Release Delay and per-object passwords.
- Use DS for integer setpoints/counts shown on screen, DF for engineering-unit floats, TD/CTD to display timer/counter current values, Y/C bits for indicator lamps.
- Keep HMI-written bits in a dedicated C range and HMI setpoints in a dedicated DS/DF range so they are easy to audit.`;

/**
 * Tag database import into C-more Programming Software.
 * Sources:
 *  - C-more help CM418 "Import a Tag Name Database":
 *    https://cdn.automationdirect.com/static/helpfiles/c-more/cm5/Content/418.htm
 *  - C-more help CM474 "Tag Name Database Specifications" (exported file layout):
 *    https://cdn.automationdirect.com/static/helpfiles/c-more/cm5/Content/474.htm
 *  - C-more help CM417 "Export a Tag Name Database":
 *    https://cdn.automationdirect.com/static/helpfiles/c-more/cm5/Content/417.htm
 *  - C-more help CM523 "Import Tags from the CLICK PLC to C-more":
 *    https://cdn.automationdirect.com/static/helpfiles/c-more/cm5/Content/523.htm
 *  - CLICK help CL115 "Export Nickname":
 *    https://cdn.automationdirect.com/static/helpfiles/click/Content/115.htm
 */
export const CMORE_TAG_IMPORT = `C-more tag import (C-more Programming Software help v8.23 - CM5 / C-more line; C-more Micro software EA-MG-PGMSW is a different program and is not covered here)

YES - CSV import is documented: File > Import > Tag Name Database accepts .csv, .xls (C-more export only), and Allen-Bradley L5K/L5X.
Options: ".csv Format" (C-more default, DirectSOFT, CLICK, Productivity Series, Do-more, A-B SLC/MicroLogix), "My File contains a header row" (first row skipped), Device (target device from Panel Manager, or Default = use the file's DeviceName column), Append Text (suffix, up to 10 characters per CM523), Overwrite Existing Tags. C-more does not allow duplicate tag names, even across devices.
Avoid special characters ! @ # $ % ^ & * ( ) + = \\ | ] } [ { / ? . > , < ; : ' " in names - they break the file delimiting.

RECOMMENDED PATH FOR CLICK (documented end to end, CM523)
1. CLICK software: File > Export > Nickname -> CSV with columns
   Address, Data Type, Nickname, Initial Value, Retentive, Address Comment   (CLICK help CL115)
2. C-more: File > Import > Tag Name Database, ".csv Format" = CLICK, pick the CLICK device.
   Only addresses that have a Nickname are imported (the nickname becomes the C-more tag name).
So the AI tool can generate a CLICK nickname CSV once and use it for both the PLC project and the HMI.

NATIVE C-more CSV LAYOUT (CM474 "Tag Name Database Specifications", describes the EXPORTED file)
  ProtocolID, DeviceName, TagName, DataType, DataCount, Retentive, Address, ArrayStart, ArrayEnd
  - ProtocolID: numeric; 0 = <INTERNAL>; 107 = "AutomationDirect Modbus (CLICK)"; 211 = Modbus TCP/IP. The published table has NO separate ID for "AutomationDirect CLICK Ethernet".
  - DeviceName: no spaces, e.g. DEV001, or <INTERNAL>.  TagName: alphanumeric, spaces allowed.
  - DataType: Discrete | Signed_int_16 | Signed_int_32 | Unsigned_int_16 | Unsigned_int_32 | BCD_int_16 | BCD_int_32 | Floating_PT_32 | ASCII_String
  - Retentive: TRUE/FALSE.  Address: protocol dependent, blank for internal tags.
  - DataCount, ArrayStart, ArrayEnd: "Preset by the system - editing this field may cause Import Errors."
  Example rows from the help: 0,<INTERNAL>,EXAMPLE,Signed_int_16,1,FALSE,,0  and  100,DEV001,TEST,BCD_int_32,1,False,V10,0
NOT DOCUMENTED: the exact header-row spelling, the ProtocolID to use for a CLICK Ethernet device, and the exact CLICK address string syntax in this file. The example shows only 8 values although 9 fields are described. Before generating native C-more CSV, export a Tag Name Database (File > Export > Tag Name Database, .csv) from a project that already has a CLICK Ethernet device and copy its header and ProtocolID. Prefer the CLICK-nickname path above.`;

/**
 * Industrial HMI screen guidelines for the generator.
 * Sources (each rule cites one):
 *  [AD-16]   AutomationDirect Library, "16 Tips for an Effective HMI":
 *            https://library.automationdirect.com/16-hmi-tips/
 *  [AD-LAY]  AutomationDirect Library, "Tips for a Better HMI Layout" (Chip McDaniel; cites ISA101):
 *            https://library.automationdirect.com/tips-better-hmi-layout/
 *  [AD-SIM]  AutomationDirect Library, "Keep Things Simple to Create Great Automation HMI Designs" (2020; cites ISA101):
 *            https://library.automationdirect.com/simple-automation-hmi-designs/
 *  [AD-BP]   AutomationDirect Library, "HMI Best Practices for an Effective HMI Every Time":
 *            https://library.automationdirect.com/best-practices-effective-hmi-every-time/
 *  [AD-SI]   AutomationDirect Library, "System Integrators Talk: HMI Gotchas":
 *            https://library.automationdirect.com/system-integrators-talk-hmi-gotchas/
 *  [ISA]     ISA-101 series overview (standard text is paywalled; only ISA's public summary used):
 *            https://isa.org/standards-and-publications/isa-standards/isa-101-standards
 *  [CM-PB]   C-more help CM187 Button Objects:
 *            https://cdn.automationdirect.com/static/helpfiles/c-more/cm5/Content/187.htm
 *  [CM-PW]   C-more help CM315 Password Tab / CM084 Configure Password:
 *            https://cdn.automationdirect.com/static/helpfiles/c-more/cm5/Content/315.htm
 *            https://cdn.automationdirect.com/static/helpfiles/c-more/cm5/Content/084.htm
 *  [CM-SEC]  C-more help CM528 Remote Access Security Best Practices:
 *            https://cdn.automationdirect.com/static/helpfiles/c-more/cm5/Content/528.htm
 */
export const HMI_DESIGN_GUIDELINES = `Industrial HMI screen guidelines (ISA-101 "high-performance HMI" ideas as summarized by AutomationDirect)

COLOR
- Grey, low-contrast backgrounds; limit color. Example: light grey background, indicator dark grey when OFF and white when ON. [AD-16, AD-BP]
- "The ISA101 HMI standard ... suggests using less distracting, more grayscale type displays"; color used sparingly for abnormal conditions. Reserve bright, saturated colors for abnormal states/alarms. [AD-LAY, AD-16, AD-SIM]
- Do not rely on color alone (about 8% of men are color-blind; red/green conventions differ by region): add text/symbols and make state changes obvious. [AD-SI, AD-SIM]
- Avoid decorative animation and 3-D; animate only when it makes the operator more efficient (e.g. part position on a conveyor). [AD-LAY, AD-BP]

LAYOUT AND NAVIGATION
- Screen hierarchy: Level 1 dashboard/overview, Level 2 typical control, Level 3 detailed control, Level 4 diagnostics/configuration popups (not regularly used). [AD-SIM, after ISA101]
- Keep important controls (Stop, Start, setpoints, navigation) always visible in a reserved band at the top or side, identical on every screen. In C-more use a Background Screen for this band. [AD-16, AD-LAY]
- Titles at the top, navigation buttons at the screen edges; do not mix screen-change buttons with start/stop buttons. Consistent menus and a clear "back"/Home path. [AD-BP, AD-LAY]
- Show units and min/max next to numeric values; make clear what is display-only versus enterable. [AD-BP, AD-SIM]
- Use a style guide and reusable object/screen libraries (C-more object library / screen library) for consistency. [AD-LAY, ISA]

ALARMS
- Use an always-visible alarm banner/area instead of cascades of pop-ups that must each be acknowledged; use pop-ups sparingly. [AD-LAY, AD-16]
- Date/time-stamp and log alarms; give each alarm a clear description. [AD-LAY, AD-SIM]

OPERATOR ACTIONS
- Give visual (and audible) feedback when a button is pressed, even if an interlock blocks the action. Indicator buttons whose lamp shows the actual PLC state work well. [AD-LAY, AD-SI]
- Jog / manual motion: C-more Pushbutton "Momentary On" is ON only while pressed - use it for hold-to-run jog bits (C bits) and let the ladder stop motion when the bit drops; consider a ladder watchdog so a lost HMI connection cannot leave a jog bit on. [CM-PB; watchdog is engineering practice, not from a cited source]
- Confirmation for critical actions (reset counters, change recipes, start a cycle from manual): use a confirm popup or Press Delay. C-more buttons support Press Delay/Release Delay. [CM-PB; the confirm-popup rule is engineering practice, not from a cited source]
- Emergency stop must be a hard-wired E-stop, never only an HMI button. [engineering practice; not from a cited AutomationDirect page]
- Touch target size: use large buttons (project rule of thumb >= ~15 mm per side, larger for gloves; all C-more panels are resistive single-touch). No AutomationDirect or ISA public source with a millimetre figure was found - treat 15 mm as a project convention, not a cited requirement.

SECURITY / PASSWORDS IN C-more
- Per-object Password tab: tick to require a password, choose which groups may operate the object. Eight password groups (names up to 20 characters); each group's password is either Static (numeric, up to 10 characters) or read from a tag (BCD/unsigned/signed 16/32-bit). Some object styles do not support passwords. [CM-PW]
- Restrict maintenance/engineering screens, but avoid over-restriction that leads to password sharing. [AD-16, AD-LAY]
- For remotely reachable panels: send a Protected Project, use a VPN instead of port forwarding, keep firmware current. [CM-SEC]`;

/**
 * PLC communication notes for the HMI design prompt: the C-more ↔ CLICK text for a C-more panel
 * on CLICK; otherwise how the chosen panel reaches the PLC (no project-file format is assumed).
 */
export function hmiCommsText(m: HmiModel, profileId: string, plcName: string): string {
  if (isCmore(m) && profileId === 'click') return CLICK_HMI_COMMUNICATION;
  return `The panel is a ${hmiMaker(m)} ${m.partNumber}${m.software ? `, configured in ${m.software}` : ''}. It talks to the ${plcName} over the maker's PLC driver (Ethernet). The addresses in this design (X/Y, C bits, DS/DF registers) are the program's neutral memory; the app exports an HMI tag list that maps each one to the PLC tag name in the exported program, and the screens are rebuilt in the maker's software from the screen images and that list.`;
}
