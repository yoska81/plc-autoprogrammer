import { getPart } from '../../electrical/catalog';
import type { CatalogPart, VendorId } from '../../electrical/types';
import type { Fit, Need } from './fit';

/**
 * PLC hardware platforms of the multi-vendor catalogs, as data: which CPUs and
 * expansion modules belong together, their module limit (only where the
 * source states it), the Ethernet protocols, and HMI ↔ PLC compatibility.
 * Part numbers are those in src/electrical/catalogs; PLC profiles (one per
 * vendor family, docs/architecture/multi-vendor.md) point at a platform id.
 * CLICK keeps its own fit (./fit.ts).
 */

/** Ethernet protocols built into a PLC (Omron FINS: Omron's own, spoken by most third-party panels' Omron drivers). */
export type Protocol = 'EtherNet/IP' | 'PROFINET' | 'Modbus TCP' | 'Omron FINS';

export interface Platform {
  id: string;
  vendor: VendorId;
  name: string;
  /** CPU part numbers. */
  cpus: string[];
  /** Expansion I/O modules that fit these CPUs (accessories such as end caps are in `notes`). */
  modules: string[];
  /** Expansion modules per CPU when published and not in the CPU's own ratings (maxExpansionModules). */
  maxModules?: number;
  /** Modules that go in the CPU's plug-in slots (counted against its plugInSlots rating) instead of the expansion bus. */
  plugIns?: string[];
  /** Ethernet protocols the CPUs speak (for HMIs, drives and remote I/O). */
  protocols: Protocol[];
  /** What else to order or check, in plain words. */
  notes: string;
}

export const PLATFORMS: Platform[] = [
  {
    id: 'ab-micro820', vendor: 'allen-bradley', name: 'Allen-Bradley Micro820',
    cpus: ['2080-L20E-20QBB', '2080-L20E-20QWB'],
    modules: ['2080-IF4', '2080-OF2', '2080-OB4'],
    plugIns: ['2080-IF4', '2080-OF2', '2080-OB4'],
    protocols: ['EtherNet/IP'],
    notes: 'Takes 2080 plug-in modules only (2 slots); 2085 expansion I/O does not fit the Micro820.',
  },
  {
    id: 'ab-micro850', vendor: 'allen-bradley', name: 'Allen-Bradley Micro850',
    cpus: ['2080-L50E-24QBB', '2080-L50E-24QWB', '2080-L50E-48QBB'],
    modules: ['2085-IQ16', '2085-OB16', '2085-OW16', '2085-IF4', '2085-OF4', '2080-IF4', '2080-OF2', '2080-OB4'],
    plugIns: ['2080-IF4', '2080-OF2', '2080-OB4'],
    protocols: ['EtherNet/IP'],
    notes: 'Up to 4 expansion modules (2085) and 3 plug-in modules (24-point) or 5 (48-point). The 2085 expansion bus needs a 2085-ECR end cap.',
  },
  {
    id: 'ab-compactlogix-5380', vendor: 'allen-bradley', name: 'Allen-Bradley CompactLogix 5380',
    cpus: ['5069-L306ER', '5069-L310ER', '5069-L320ER'],
    modules: ['5069-IB16', '5069-OB16', '5069-IF8', '5069-OF4', '5069-OF8'],
    protocols: ['EtherNet/IP'],
    notes: 'Every 5069 I/O module needs a 5069-RTB18-SCREW terminal block; the controller and the 5069-FPD field potential distributor need 5069-RTB64-SCREW.',
  },
  {
    id: 'ab-compactlogix-5370', vendor: 'allen-bradley', name: 'Allen-Bradley CompactLogix 5370 (1769 L2 / L3)',
    cpus: ['1769-L30ER', '1769-L30ERM', '1769-L30ER-NSE', '1769-L33ER', '1769-L33ERM', '1769-L36ERM', '1769-L24ER-QB1B', '1769-L24ER-QBFC1B', '1769-L27ERM-QBFC1B'],
    modules: ['1769-IQ16', '1769-IQ16F', '1769-IQ32', '1769-OB16', '1769-OB16P', '1769-OB32', '1769-OW8', '1769-OW16', '1769-IF4', '1769-IF8', '1769-OF2', '1769-OF4', '1769-IR6', '1769-IT6', '1769-HSC'],
    protocols: ['EtherNet/IP'],
    notes: 'L3 controllers need a 1769-PA2 / PB2 / PA4 / PB4 power supply (up to 3 I/O banks); L2 controllers power up to 4 modules from their built-in 24 VDC supply. Every bank ends with a 1769-ECR (or ECL) end cap. Rockwell lists most of the family as Active Mature.',
  },
  {
    id: 'ab-compactlogix-5370-l1', vendor: 'allen-bradley', name: 'Allen-Bradley CompactLogix 5370 L1',
    cpus: ['1769-L16ER-BB1B', '1769-L18ER-BB1B', '1769-L18ERM-BB1B'],
    modules: [],
    protocols: ['EtherNet/IP'],
    notes: 'Embedded 16 DC inputs / 16 DC outputs; expansion is 1734 POINT I/O (up to 6 on the L16, 8 on the L18), not 1769 Compact I/O, and POINT I/O is not in the catalog yet.',
  },
  {
    id: 'siemens-s7-1200', vendor: 'siemens', name: 'Siemens S7-1200',
    cpus: ['6ES7212-1AE40-0XB0', '6ES7214-1AG40-0XB0', '6ES7215-1AG40-0XB0'],
    modules: ['6ES7221-1BH32-0XB0', '6ES7222-1BH32-0XB0', '6ES7223-1BL32-0XB0', '6ES7231-4HD32-0XB0', '6ES7232-4HB32-0XB0'],
    protocols: ['PROFINET'],
    notes: 'Signal modules plug in on the right of the CPU: 2 on the 1212C, 8 on the 1214C / 1215C.',
  },
  {
    id: 'siemens-s7-1200-g2', vendor: 'siemens', name: 'Siemens S7-1200 G2',
    cpus: ['6ES7214-1AH50-0XB0', '6ES7212-1AG50-0XB0'],
    modules: [],
    protocols: ['PROFINET'],
    notes: 'Built-in I/O only here: G2 expansion modules are not in the catalog yet (the S7-1200 G1 signal modules are not confirmed for G2).',
  },
  {
    id: 'siemens-s7-1500', vendor: 'siemens', name: 'Siemens S7-1500 + ET 200SP',
    cpus: ['6ES7511-1AL03-0AB0', '6ES7513-1AM03-0AB0'],
    modules: ['6ES7131-6BH01-0BA0', '6ES7132-6BH01-0BA0', '6ES7134-6GD01-0BA1', '6ES7135-6HD00-0BA1'],
    protocols: ['PROFINET'],
    notes: 'The CPU has no I/O of its own: the I/O is an ET 200SP station (IM 155-6 PN ST 6ES7155-6AU01-0BN0 with BusAdapter 6ES7193-6AR00-0AA0, one BaseUnit per module, server module 6ES7193-6PA00-0AA0). The CPU needs a SIMATIC Memory Card (6ES7954-8LE03-0AA0).',
  },
  {
    id: 'yaskawa-slio', vendor: 'yaskawa', name: 'Yaskawa System SLIO (TIA Portal)',
    cpus: ['015-CEFPR01'],
    modules: ['021-1BF00', '021-1BH00', '022-1BF00', '022-1BH00', '031-1BD30', '031-1BD40', '032-1BD30', '032-1BD40'],
    maxModules: 64,
    protocols: ['PROFINET'],
    notes: 'Programmed in TIA Portal as a Siemens CPU 315-2 PN/DP (6ES7 315-2EH14 V3.2); the I/O modules through Yaskawa\'s GSDML "SLIO System". Up to 64 SLIO modules (power and clamp modules included); the CPU feeds the modules up to 3 A on the backplane, above that a power module 007-1AB10.',
  },
  {
    id: 'schneider-m221', vendor: 'schneider', name: 'Schneider Modicon M221',
    cpus: ['TM221CE24T', 'TM221CE40T', 'TM221ME16T'],
    modules: ['TM3DI16', 'TM3DQ16T', 'TM3DQ16R', 'TM3AI4', 'TM3AQ2', 'TM3AM6'],
    protocols: ['EtherNet/IP', 'Modbus TCP'],
    notes: 'Up to 7 local TM3 modules (more through a TM3BCEIP coupler). The M221 is an EtherNet/IP adapter only (it cannot scan EtherNet/IP devices).',
  },
  {
    id: 'schneider-m241', vendor: 'schneider', name: 'Schneider Modicon M241',
    cpus: ['TM241CE24T', 'TM241CEC24T', 'TM241CE40T'],
    modules: ['TM3DI16', 'TM3DQ16T', 'TM3DQ16R', 'TM3AI4', 'TM3AQ2', 'TM3AM6'],
    protocols: ['EtherNet/IP', 'Modbus TCP'],
    notes: 'Up to 7 local TM3 modules (more through a TM3BCEIP coupler). EtherNet/IP scanner and Modbus TCP client built in.',
  },
  {
    id: 'omron-cp2e', vendor: 'omron', name: 'Omron CP2E',
    cpus: ['CP2E-N20DT-D', 'CP2E-N30DT-D', 'CP2E-N30DT1-D', 'CP2E-N40DT-D', 'CP2E-N40DT1-D', 'CP2E-N60DT-D'],
    modules: ['CP1W-8ED', 'CP1W-16ER', 'CP1W-16ET', 'CP1W-16ET1', 'CP1W-20EDR1', 'CP1W-20EDT', 'CP1W-20EDT1', 'CP1W-AD041', 'CP1W-DA041', 'CP1W-MAD11', 'CP1W-MAD42'],
    protocols: ['Omron FINS'],
    notes: 'CP2E-N (network type) CPUs have built-in Ethernet (N20: 1 port; N30/40/60: 2 ports with switch) for FINS/TCP, FINS/UDP and socket services - Omron does not list EtherNet/IP or Modbus TCP for CP2E. CP2E-N20 takes NO expansion units; N30/40/60 take up to 3 CP1W expansion I/O / expansion units (each comes with a short horizontal connecting cable; CP1W-CN811 80 cm cable for a second row). Option board slots: N20 1, N30/40/60 2 - serial boards CP1W-CIF01/CIF11/CIF12-V1, CP2W-CIFD1/2/3, and max. one analog option board CP1W-ADB21/DAB21V/MAB221 (not in this catalog: no maker footprint). Option battery CP2W-BAT02. "DT" = sinking (NPN) transistor outputs, "DT1" = sourcing (PNP); "-D" = 24 VDC supply. Program with CX-Programmer 9.72+ (CX-One 4.51+).',
    // https://assets.omron.com/m/79b5d624707bfd69/original/CP2E-Series-Programmable-Controller-Datasheet.pdf
  },
  {
    id: 'omron-cp1e', vendor: 'omron', name: 'Omron CP1E',
    cpus: ['CP1E-N30DT-D', 'CP1E-N30DT1-D', 'CP1E-N40DT-D', 'CP1E-N40DT1-D'],
    modules: ['CP1W-8ED', 'CP1W-16ER', 'CP1W-16ET', 'CP1W-16ET1', 'CP1W-20EDR1', 'CP1W-20EDT', 'CP1W-20EDT1', 'CP1W-AD041', 'CP1W-DA041', 'CP1W-MAD11', 'CP1W-MAD42'],
    protocols: [],
    notes: 'CP1E-N CPUs have NO built-in Ethernet (USB programming port + RS-232C); Ethernet needs the CP1W-CIF41 version 2.0+ option board (FINS) in the single option board slot. N30/40/60 take up to 3 CP1W expansion I/O / expansion units (N14/N20 none). Analog option boards CP1W-ADB21/DAB21V/MAB221 need CPU unit version 1.2+. "DT" = sinking, "DT1" = sourcing transistor outputs, "-D" = 24 VDC supply. Omron positions CP2E as the replacement (CP1E-to-CP2E replacement guide); CP1E is still Active on Omron Americas but no longer listed on Omron Europe.',
    // https://assets.omron.com/m/00c4c2eb278c16b3/original/CP1E-Datasheet.pdf
  },
  {
    id: 'omron-nx1p2', vendor: 'omron', name: 'Omron NX1P2',
    cpus: ['NX1P2-9024DT', 'NX1P2-9024DT1', 'NX1P2-1040DT', 'NX1P2-1040DT1', 'NX1P2-1140DT', 'NX1P2-1140DT1'],
    modules: ['NX-ID5342', 'NX-ID5442', 'NX-OD5256', 'NX-AD3603', 'NX-AD3203', 'NX-DA3603', 'NX-DA3203', 'NX-PF0630'],
    plugIns: ['NX1W-ADB21', 'NX1W-DAB21V', 'NX1W-MAB221'],
    protocols: ['EtherNet/IP'],
    notes: 'Up to 8 NX I/O units on the CPU NX bus (24 total incl. 16 on EtherCAT slave terminals). The NX-END02 end cover is included with the CPU. The CPU does NOT supply I/O power to NX units: add an NX-PF0630 (4 A) / NX-PF0730 (10 A) additional I/O power supply unit (counts as an NX unit) or wire I/O power directly. Option board slots: 40-point CPUs 2, 24-point CPUs 1 (NX1W-CIF01/11/12 serial, NX1W-ADB21/DAB21V/MAB221 analog). Built-in ports: 1 EtherNet/IP + 1 EtherCAT master. "DT" = NPN, "DT1" = PNP outputs. Program with Sysmac Studio. NX-OD5121 (16 x NPN out) exists but is omitted here (no maker footprint found).',
    // https://assets.omron.com/m/26af8e730226b1c1/original/NX1P-Machine-Automation-Controller-Datasheet.pdf
  },
  {
    id: 'mitsubishi-fx5u', vendor: 'mitsubishi', name: 'Mitsubishi Electric MELSEC iQ-F FX5U',
    cpus: ['FX5U-32MT/ES', 'FX5U-64MT/ES', 'FX5U-80MT/ES', 'FX5U-32MR/ES', 'FX5U-32MT/DS'],
    modules: ['FX5-16EX/ES', 'FX5-16EYT/ES', 'FX5-16EYR/ES', 'FX5-16ER/ES', 'FX5-16ET/ES', 'FX5-4AD', 'FX5-4DA', 'FX5-8AD', 'FX5-C16EX/DS', 'FX5-C32EX/DS', 'FX5-C32EYT/D', 'FX5-C32ET/DSS'],
    plugIns: ['FX5-4AD-ADP', 'FX5-4DA-ADP', 'FX5-4A-ADP'],
    protocols: ['Modbus TCP'],
    notes: 'All-in-one CPU (built-in PSU, 2 AI + 1 AO, Ethernet, RS-485, SD slot). Right side: up to 16 extension modules (512 control points incl. remote, 256 local); screw-terminal "cable type" modules (FX5-16EX/ES etc.) connect directly; connector-type FX5-C... modules need the FX5-CNV-IF connector conversion module first. Large systems may need an extension power supply module (FX5-1PSU-5V) - check the 5 V / 24 V power budget in the hardware manual. Left side: up to 6 expansion adapters (max 2 communication FX5-232ADP/485ADP + max 4 analog FX5-4AD-ADP/4DA-ADP/4A-ADP/4AD-PT-ADP/4AD-TC-ADP). Front: 1 expansion board slot (FX5-232-BD / 485-BD / 422-BD-GOT / FX5-3A-BD). Built-in Ethernet does SLMP, MODBUS/TCP, socket, FTP, CC-Link IE Field Basic master; EtherNet/IP needs FX5-ENET/IP or FX5-EIP module (not built in). Optional battery FX3U-32BL for latch retention. "/ES" = 100-240 VAC supply, "/DS" = 24 VDC supply; MT = transistor sink, MT/ESS & MT/DSS = transistor source, MR = relay. Program with GX Works3.',
    // https://dl.mitsubishielectric.co.jp/dl/fa/document/catalog/plcf/l08428eng/l08428eng-j.pdf
  },
  {
    id: 'mitsubishi-fx5uc', vendor: 'mitsubishi', name: 'Mitsubishi Electric MELSEC iQ-F FX5UC',
    cpus: ['FX5UC-32MT/D', 'FX5UC-32MT/DSS', 'FX5UC-64MT/D', 'FX5UC-96MT/D'],
    modules: ['FX5-C16EX/DS', 'FX5-C32EX/DS', 'FX5-C32EYT/D', 'FX5-C32ET/DSS', 'FX5-16EX/ES', 'FX5-16EYT/ES', 'FX5-16EYR/ES', 'FX5-16ER/ES', 'FX5-16ET/ES', 'FX5-4AD', 'FX5-4DA', 'FX5-8AD'],
    plugIns: ['FX5-4AD-ADP', 'FX5-4DA-ADP', 'FX5-4A-ADP'],
    protocols: ['Modbus TCP'],
    notes: 'Ultra-compact 24 VDC CPU with connector (MIL/ribbon) I/O - order I/O cables or terminal blocks separately; -TS variants use spring-clamp terminals. No built-in analog and no expansion-board slot. Right side: up to 16 extension modules; connector-type FX5-C... modules connect directly; screw-terminal cable-type modules (FX5-16EX/ES, FX5-4AD ...) need FX5-CNV-IFC connector conversion or FX5-C1PS-5V extension power supply first. Left side: up to 6 expansion adapters (max 2 comms + max 4 analog). Transistor outputs: Y0-Y3 0.3 A, Y4+ 0.1 A per point - use relays/interposing for loads. "/D" = sink inputs + sink outputs, "/DSS" = sink/source inputs + source outputs. Built-in Ethernet: SLMP, MODBUS/TCP, socket; EtherNet/IP via FX5-ENET/IP or FX5-EIP.',
    // https://dl.mitsubishielectric.co.jp/dl/fa/document/catalog/plcf/l08428eng/l08428eng-j.pdf
  },
  {
    id: 'delta-dvp', vendor: 'delta', name: 'Delta DVP-SE (slim, Ethernet)',
    cpus: ['DVP12SE11T', 'DVP26SE11T'],
    modules: ['DVP16SM11N', 'DVP16SN11T', 'DVP16SP11T', 'DVP04AD-S', 'DVP04DA-S'],
    protocols: ['EtherNet/IP', 'Modbus TCP'],
    notes: 'DVP-S slim modules clip onto the right side of the CPU (no backplane, no end cover listed). Delta: max. 14 right-side modules, of which -S/-S2 analog/special modules must be 8 or fewer. DVP12SE11T also accepts left-side high-speed modules (e.g. DVPEN01-SL, DVP04AD-SL); DVP26SE11T supports right-side modules only and has 1 RS-485 instead of 2. CPUs need a 24 VDC supply (e.g. DVPPS02 24 V 2 A). The newer DVP-SE2 (DVP28SE211T) exists but was not added (no maker dimensions found).',
    // https://www.deltaww.com/IA/downloadcenter/catalogue/3.Control/DVP/DELTA_IA-PLC_DVP_TP_C_EN_20220906.pdf
  },
  {
    id: 'delta-as300', vendor: 'delta', name: 'Delta AS300',
    cpus: ['AS332T-A', 'AS332P-A', 'AS324MT-A'],
    modules: ['AS16AM10N-A', 'AS16AN01T-A', 'AS16AP11T-A', 'AS04AD-A', 'AS04DA-A'],
    protocols: ['EtherNet/IP', 'Modbus TCP'],
    notes: 'Backplane-less right-side expansion: max. 32 modules (max. 16 analog / 4 communication), 1,024 I/O. CPUs take 24 VDC (AS-PS02 power module 24 V 2 A, or external 24 V). CPU built-in I/O is on MIL connectors: order UC-ET010/020/030-24D cables plus UB-10-ID16A (inputs) / UB-10-OR16A (NPN-to-relay outputs) terminal boards. AS300 CPUs have 2 function-card slots (e.g. AS-F485, AS-FCOPM CANopen, AS-F2AD/F2DA, AS-FEN02) - not catalogued here. CANopen DS301 needs the AS-FCOPM card on AS300.',
    // https://www.deltaww.com/IA/downloadcenter/catalogue/3.Control/AS/DELTA_IA-PLC_AS_C_EN_20230116.pdf
  },
  {
    id: 'unitronics-unistream', vendor: 'unitronics', name: 'Unitronics UniStream',
    cpus: ['US5-B5-B1', 'US5-B10-TR22', 'US7-B5-B1', 'US7-B10-TR22', 'US10-B5-B1', 'US10-B10-TR22', 'US15-B10-B1', 'USC-B10-TR22', 'USC-P-B10'],
    modules: ['UID-1600', 'UID-0016T', 'UID-0016R', 'UID-0808T', 'UID-0808R', 'UIA-0402N', 'UIS-04PTN', 'UIS-WCB1'],
    protocols: ['Modbus TCP', 'EtherNet/IP'],
    notes: 'Programmed with UniLogic. US5 / US7 / US10 / US15 are PLC + touch screen in one unit (the HMI is built in); "-TR22" models have 10 DI / 2 AI / 8 relay + 2 npn outputs on board, "-B1" models none. Built-in models connect Uni-I/O modules only through a UAG-CX I/O expansion adapter kit (base, end unit and cable, order separately; up to 80 modules). USC-B10-TR22 is the stand-alone DIN-rail CPU (up to 8 modules directly). USC-P-B10 plugs onto the back of a USP-070-B10 / USP-104-B10 / USP-156-B10 panel (order the panel as the HMI); the panel back holds 3 / 5 modules, more need a UAG-CX kit. UIS-WCB1 is a wide module (counts as 1.5). Ethernet: Modbus TCP master / slave, EtherNet/IP scanner and adapter.',
    // https://www.unitronicsplc.com/Documents/UniStream/Built-in/UG_US5_7_10_15-Bx-B1_TR22_T24.pdf
  },
  {
    id: 'unitronics-vision', vendor: 'unitronics', name: 'Unitronics Vision',
    cpus: ['V130-33-T38', 'V130-33-TR34', 'V350-35-TR34', 'V350-35-TR20', 'V350-35-T38', 'V700-T20BJ', 'V1040-T20B', 'V1210-T20BJ'],
    modules: ['V200-18-E1B', 'V200-18-E2B', 'V200-18-E3XB', 'V200-18-E46B'],
    plugIns: ['V200-18-E1B', 'V200-18-E2B', 'V200-18-E3XB', 'V200-18-E46B'],
    protocols: ['Modbus TCP'],
    notes: 'Programmed with VisiLogic. PLC + touch screen in one unit (the HMI is built in). V130 / V350 have their I/O on board; two of their digital inputs double as the analog inputs (jumper). V700 / V1040 / V1210 have no on-board I/O: one V200-18 snap-in I/O module plugs into the back. EX-A2X local expansion (up to 8 modules) is not in this catalog. Ethernet (Modbus TCP) is built into the V700; the V130 / V350 / V1040 / V1210 need the optional Ethernet port module.',
    // https://unitronicsplc.com/Documents/Vision/PLC/UG_V700.pdf
  },
  {
    id: 'unitronics-samba', vendor: 'unitronics', name: 'Unitronics Samba',
    cpus: ['SM43-J-T20', 'SM70-J-T20', 'SM35-J-TA22'],
    modules: [],
    protocols: [],
    notes: 'Programmed with VisiLogic. PLC + touch screen in one unit with on-board I/O only (no expansion). Two digital inputs double as the analog inputs (jumper). No built-in Ethernet: optional Ethernet / serial port module.',
    // https://unitronicsplc.com/Documents/Samba/PLC/UG_SM35_43_70_R20_T20.pdf
  },
  {
    id: 'unitronics-jazz', vendor: 'unitronics', name: 'Unitronics Jazz',
    cpus: ['JZ20-R31', 'JZ20-T40', 'JZ20-J-T20HS'],
    modules: [],
    protocols: [],
    notes: 'Micro PLC with a 2 x 16 character text display and keypad (not a touch screen), on-board I/O only. Programmed with U90 Ladder: 64 on-delay timers, no counter operands, no program import. No built-in Ethernet (MJ20-ET1 add-on).',
    // https://unitronicsplc.com/wp-content/uploads/2015/12/JZ20-R31_JZ20-J-R31_TECH-SPEC_01-141.pdf
  },
];

export const platformById = (id: string) => PLATFORMS.find((p) => p.id === id);
export const platformOfCpu = (cpu: string) => PLATFORMS.find((p) => p.cpus.includes(cpu));
export const platformsOf = (vendors: VendorId[]) => PLATFORMS.filter((p) => vendors.includes(p.vendor));

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** I/O a CPU plus modules provide, from the catalog ratings. */
export function platformCapacity(cpu: CatalogPart, modules: string[]) {
  const parts = modules.map((m) => getPart(m)).filter((p): p is CatalogPart => Boolean(p));
  const sum = (k: string) => parts.reduce((n, p) => n + num(p.ratings[k]), 0);
  return {
    inputs: num(cpu.ratings.discreteInputs) + sum('inputs'),
    outputs: num(cpu.ratings.discreteOutputs) + sum('outputs'),
    analogInputs: num(cpu.ratings.analogInputs) + sum('analogInputs'),
    analogOutputs: num(cpu.ratings.analogOutputs) + sum('analogOutputs'),
  };
}

/** Digital inputs that double as the analog inputs (Unitronics: ratings.analogSharedWith = 'I14,I15'). */
export const sharedAnalogInputs = (cpu: CatalogPart): string[] => String(cpu.ratings.analogSharedWith ?? '').split(',').map((s) => s.trim()).filter(Boolean);

/** Digital inputs left once the machine's analog inputs take their shared terminals. */
function digitalInputsLeft(cpu: CatalogPart, modules: string[], need: Need): number {
  const cap = platformCapacity(cpu, modules);
  const moduleAi = cap.analogInputs - num(cpu.ratings.analogInputs);
  const onCpu = Math.max(0, need.analogInputs - moduleAi);
  return cap.inputs - Math.min(sharedAnalogInputs(cpu).length, onCpu);
}

/** Module limits of a CPU: its own ratings, else the platform's; undefined = not published (no check). */
export function moduleLimits(platform: Platform, cpu: CatalogPart): { expansion?: number; plugIn?: number } {
  const r = cpu.ratings;
  return {
    expansion: typeof r.maxExpansionModules === 'number' ? r.maxExpansionModules : platform.maxModules,
    plugIn: typeof r.plugInSlots === 'number' ? r.plugInSlots : undefined,
  };
}

const isPlugIn = (platform: Platform, m: string) => Boolean(platform.plugIns?.includes(m));

/** Does this CPU + modules cover the machine? Same reasons as the CLICK fit. */
export function platformFit(platform: Platform, cpuPn: string, modules: string[], need: Need): Fit {
  const cpu = getPart(cpuPn);
  if (!cpu || !platform.cpus.includes(cpuPn)) return { ok: false, reason: `${cpuPn} is not a ${platform.name} CPU.`, spareIn: 0, spareOut: 0 };
  const cap = platformCapacity(cpu, modules);
  const inputs = digitalInputsLeft(cpu, modules, need);
  const spareIn = inputs - need.digitalInputs;
  const spareOut = cap.outputs - need.digitalOutputs;
  const limits = moduleLimits(platform, cpu);
  const plugs = modules.filter((m) => isPlugIn(platform, m)).length;
  const exps = modules.length - plugs;
  const foreign = modules.find((m) => !platform.modules.includes(m));
  let reason: string | null = null;
  if (foreign) reason = `${foreign} does not fit the ${platform.name}.`;
  else if (limits.plugIn !== undefined && plugs > limits.plugIn) reason = `Has ${limits.plugIn} plug-in slots; ${plugs} plug-in modules chosen.`;
  else if (limits.expansion !== undefined && exps > limits.expansion) reason = limits.expansion ? `Takes at most ${limits.expansion} expansion modules; ${exps} chosen.` : 'Takes no expansion modules.';
  else if (spareIn < 0) reason = `Only ${inputs} inputs${inputs < cap.inputs ? ` (${cap.inputs - inputs} used as analog inputs)` : ''}; ${need.digitalInputs} needed.`;
  else if (spareOut < 0) reason = `Only ${cap.outputs} outputs; ${need.digitalOutputs} needed.`;
  else if (need.analogInputs > cap.analogInputs) reason = `No analog inputs for ${need.analogInputs} analog signals.`;
  else if (need.analogOutputs > cap.analogOutputs) reason = `No analog outputs for ${need.analogOutputs} analog signals.`;
  // A built-in screen talks to its own CPU: no Ethernet needed for it.
  else if (need.ethernetHmi && !platform.protocols.length && cpu.ratings.builtInPanel !== 'yes') reason = 'No Ethernet port for the touch panel.';
  return { ok: !reason, reason, spareIn, spareOut };
}

/** Ethernet protocols named in a part's ratings. */
export function protocolsOf(p: CatalogPart): Protocol[] {
  const t = String(p.ratings.protocols ?? '');
  const out: Protocol[] = [];
  if (/ethernet\/ip/i.test(t)) out.push('EtherNet/IP');
  if (/profinet/i.test(t)) out.push('PROFINET');
  if (/modbus\s*tcp/i.test(t)) out.push('Modbus TCP');
  return out;
}

/** Platform ids a panel's maker lists in its PLC driver list (ratings.plcDrivers, sourced in ratings.driversSource). */
export const driversOf = (hmi: CatalogPart): string[] => String(hmi.ratings.plcDrivers ?? '').split(',').map((s) => s.trim()).filter(Boolean);

/**
 * The interface module the PLC needs before this panel can reach it (serial / PROFIBUS panels: a CM 1243-5 on an
 * S7-1200, an FX5-232 board on an FX5U …), from ratings.plcModules ("platform-id=module; …"). null when none is needed.
 */
export function plcModuleFor(hmi: CatalogPart, platformId: string): string | null {
  for (const part of String(hmi.ratings.plcModules ?? '').split(';')) {
    const [id, ...rest] = part.split('=');
    if (id.trim() === platformId) return rest.join('=').trim() || null;
  }
  return null;
}

/**
 * The catalog part number of the module plcModuleFor() names: the first catalog number in its text that is a
 * catalog part ("FX5-232-BD or FX5-232ADP" → FX5-232-BD on an FX5U). null when none is needed or the module is not
 * in the catalog yet (plcModuleFor() still gives the text for a BOM note).
 */
export function plcModulePart(hmi: CatalogPart, platformId: string): string | null {
  const text = plcModuleFor(hmi, platformId);
  if (!text) return null;
  for (const token of text.match(/[A-Z0-9][A-Z0-9.\-/]{4,}/g) ?? []) if (getPart(token)) return token;
  return null;
}

/**
 * Can this touch panel talk to the platform? Panels with a maker's PLC driver
 * list: only the families on it. Same brand: yes unless its protocols are stated and
 * don't match. Another brand: only when a shared Ethernet protocol is stated
 * for the panel.
 */
export function hmiCompatible(platform: Platform, hmi: CatalogPart): { ok: boolean; reason: string | null } {
  // A panel with a maker's driver list: that list alone decides (no guessing from protocol names).
  if (hmi.ratings.plcDrivers !== undefined) {
    return driversOf(hmi).includes(platform.id) ? { ok: true, reason: null } : { ok: false, reason: `Not in ${hmi.manufacturer}'s driver list for the ${platform.name}.` };
  }
  const hp = protocolsOf(hmi);
  const shared = hp.filter((x) => platform.protocols.includes(x));
  if (hmi.vendor === platform.vendor) {
    if (hp.length && !shared.length) return { ok: false, reason: `Speaks ${hp.join(' / ')}; the ${platform.name} speaks ${platform.protocols.join(' / ')}.` };
    return { ok: true, reason: null };
  }
  if (shared.length) return { ok: true, reason: null };
  return { ok: false, reason: hp.length ? `Speaks ${hp.join(' / ')}; the ${platform.name} speaks ${platform.protocols.join(' / ')}.` : `Not confirmed to talk to the ${platform.name}.` };
}

/**
 * Smallest set of expansion modules (greedy, in the platform's module order)
 * that covers the machine's I/O on this CPU; stops at the module limit.
 */
export function suggestModules(platform: Platform, cpuPn: string, need: Need): string[] {
  const cpu = getPart(cpuPn);
  if (!cpu) return [];
  const limits = moduleLimits(platform, cpu);
  const mods: string[] = [];
  const room = (m: string) => {
    const plug = isPlugIn(platform, m);
    const used = mods.filter((x) => isPlugIn(platform, x) === plug).length;
    const max = plug ? limits.plugIn : limits.expansion;
    return max === undefined || used < max;
  };
  const best = (key: string) => platform.modules
    .filter(room)
    .map((m) => ({ m, n: num(getPart(m)?.ratings[key]) }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)[0]?.m;
  const short = () => {
    const cap = platformCapacity(cpu, mods);
    return [
      ['inputs', need.digitalInputs - digitalInputsLeft(cpu, mods, need)], ['outputs', need.digitalOutputs - cap.outputs],
      ['analogInputs', need.analogInputs - cap.analogInputs], ['analogOutputs', need.analogOutputs - cap.analogOutputs],
    ].find(([, n]) => Number(n) > 0)?.[0] as string | undefined;
  };
  for (let k = short(); k && mods.length < 32; k = short()) {
    const m = best(k);
    if (!m) break;
    mods.push(m);
  }
  return mods;
}
