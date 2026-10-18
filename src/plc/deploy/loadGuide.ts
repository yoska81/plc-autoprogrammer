/**
 * "Load into PLC": the honest path from this app's program to the project's real PLC, step by step, with the
 * files each step needs. No PLC brand here accepts a program over the network from a third-party tool: CLICK
 * takes programs only from CLICK Programming Software (no ladder import; File > Import > Nickname only), the
 * others import a file into their own software, which then downloads it.
 *
 * CLICK facts (AutomationDirect CLICK help and manuals):
 * - free CLICK Programming Software, for all CLICK and CLICK PLUS PLCs (C0-PGMSW);
 * - Com Port 1 (Ethernet) setup, help 211: default fixed address 192.168.0.10, subnet mask 255.255.0.0, gateway
 *   0.0.0.0; with DHCP and no DHCP server the PLC takes a 169.254.x.x (APIPA) address;
 * - Connect dialog (PLC menu): Port Type Ethernet, pick the PC's network adapter, the software scans the LAN and
 *   lists the CLICK PLCs; PC and PLC must be in the same subnet; the dialog can change the PLC's IP address;
 * - Setup > System Configuration, offline too, Select / Change per slot (help 057); with the start-up I/O
 *   config check on, a mismatch keeps the PLC out of RUN;
 * - Write Project into PLC (PLC menu, help 090); SC10 / SC11 = mode switch in RUN / PLC in RUN mode (help 109);
 * - the Modbus TCP server of the Ethernet port is on by default at port 502 (up to 3 connections).
 */

export interface LoadStep {
  title: string;
  text: string[];
  /** Files of the program package (by file name) the step needs, offered as download buttons. */
  files?: string[];
  link?: { label: string; url: string };
  /** The step happens in this app (Online page). */
  online?: boolean;
}

export interface LoadGuideInput {
  profileId: string;
  profileName: string;
  vendor: string;
  cpuId: string;
  modules: string[];
  fileBase: string;
  /** File names the program package has (deliverables programFiles). */
  files: string[];
  /** The profile's own import steps (Unitronics …), when it has them. */
  importSteps?: string[];
  /** Program checker errors (the files will not work as they are). */
  errors: number;
}

const has = (i: LoadGuideInput, suffix: string) => i.files.filter((f) => f.endsWith(suffix));

function clickSteps(i: LoadGuideInput): LoadStep[] {
  const hw = [`CPU ${i.cpuId}`, ...i.modules.map((m, k) => `slot ${k + 1}: ${m}`)];
  return [
    {
      title: 'Install CLICK Programming Software (free)',
      text: ['CLICK PLCs are programmed only with AutomationDirect\'s own software; no other tool can download a program into them. It is free and works for every CLICK and CLICK PLUS PLC.', 'Download it, unzip and run Install.exe on the Windows PC you take to the machine.'],
      link: { label: 'AutomationDirect: free CLICK software', url: 'https://www.automationdirect.com/clickplcs/clickplus/free-software/free-click-software' },
    },
    {
      title: 'New project with this hardware',
      text: ['Start a new project and select the CPU, then open Setup > System Configuration and pick the module of each slot (Select / Change), in this order:', ...hw.map((h) => `• ${h}`), 'The modules must match the PLC: with the start-up I/O configuration check on, a CLICK does not go to RUN when they differ.'],
    },
    {
      title: 'Import the nicknames',
      text: ['File > Import > Nickname, and choose the nicknames CSV. Every address then shows its name from this project (inputs, outputs, internal bits, setpoints, timers, counters).'],
      files: has(i, '_nicknames.csv'),
    },
    {
      title: 'Type in the rungs',
      text: ['CLICK cannot import ladder logic, so the rungs are typed in by hand. The rung entry sheet lists every rung in order, block by block: which instruction goes in which row and column, and every field of its dialog, with a box to tick per rung. Open it in a browser or print it.', 'End with the END instruction on its own last rung, then check the program for errors and save the project.', ...(i.errors ? [`The program checker finds ${i.errors} error${i.errors === 1 ? '' : 's'} for the CLICK: fix them on the PLC program page first.`] : [])],
      files: [...has(i, '_CLICK_entry_sheet.html'), ...has(i, '_rungs.txt')],
    },
    {
      title: 'Connect the PC to the PLC\'s network',
      text: [
        'Plug an Ethernet cable from the PC to the PLC (or to the same switch). PC and PLC must be in the same subnet.',
        'CLICK Ethernet CPUs set to the default fixed address use 192.168.0.10, subnet mask 255.255.0.0. Give the PC a fixed address in that subnet, e.g. 192.168.0.20 / 255.255.0.0, no gateway (Windows: Settings > Network & Internet > Ethernet > IP assignment > Edit > Manual).',
        'A PLC set to DHCP with no DHCP server on the network takes a 169.254.x.x address. The Connect dialog (next step) lists the PLCs it finds with their addresses and can change the PLC\'s IP address.',
      ],
    },
    {
      title: 'Write the project into the PLC and switch to RUN',
      text: ['PLC > Connect: Port Type Ethernet, pick the PC\'s network adapter, select the PLC in the list.', 'PLC > Write Project into PLC.', 'Put the mode switch on the CPU in RUN (the RUN LED lights). Keep the machine safe: outputs switch as soon as the program runs.'],
    },
    {
      title: 'Check it in this app (Online)',
      text: ['Open Online, enter the PLC\'s IP address and press Test connection: it shows whether the PLC answers on Modbus TCP (port 502) and whether it is in RUN.', 'Connect, then Program check: it reads every address of the nickname list and the first-scan setpoints, so you can see the program you typed in is running.', 'Then work through the I/O check-out tab, point by point.'],
      online: true,
    },
  ];
}

const VENDOR_STEPS: Record<string, (i: LoadGuideInput) => LoadStep[]> = {
  logix: (i) => [
    { title: 'Open the project in Studio 5000 Logix Designer', text: ['File > Open, choose the .L5X file: Studio 5000 imports it as a new project (controller, tags, routines). Check the controller type and firmware revision it asks for.'], files: has(i, '.L5X') },
    { title: 'Map the I/O', text: ['Add the 5069 I/O modules in the slots listed in the I/O mapping file; the alias tags in the project point at them.'], files: has(i, '_logix_io.csv') },
    { title: 'Download and run', text: ['Communications > Who Active: select the controller over Ethernet, Download, then switch to Run (Remote Run or the key switch). Keep the machine safe.'] },
  ],
  micro800: (i) => [
    { title: 'Create the program in Connected Components Workbench', text: ['CCW has no program import for Micro800: add a Structured Text program to the project and paste the .st file into it.'], files: has(i, '_micro800.st') },
    { title: 'Declare the variables', text: ['Enter the variables from the variable list in the program\'s variable grid (name, data type, comment).'], files: has(i, '_micro800_variables.csv') },
    { title: 'Download and run', text: ['Build, connect to the controller over Ethernet, download and switch to Run. Keep the machine safe.'] },
  ],
  'siemens-s7': (i) => [
    { title: 'Import the source into TIA Portal', text: ['In the PLC: External source files > Add new external file, choose the .scl file, then right-click it > Generate blocks from source (FB "Machine", its instance DB and OB "Main").'], files: has(i, '_s7.scl') },
    { title: 'Import the PLC tags', text: ['PLC tags > Import, choose the .sdf file. Module addresses marked "check against Device configuration" depend on the slots in your device configuration.'], files: has(i, '_PLCTags.sdf') },
    { title: 'Download and run', text: ['Compile, Download to device over Ethernet, then RUN. Keep the machine safe.'] },
  ],
};

/** The steps for the project's PLC. */
export function loadGuide(i: LoadGuideInput): LoadStep[] {
  if (i.profileId === 'click') return clickSteps(i);
  const own = VENDOR_STEPS[i.profileId]?.(i);
  if (own) return own;
  const exportFiles = i.files.filter((f) => !/_program\.json$|_analog_setup\.csv$/.test(f));
  if (i.importSteps?.length) return i.importSteps.map((t, k) => ({ title: `Step ${k + 1}`, text: [t], ...(k === 0 ? { files: exportFiles } : {}) }));
  return [{ title: `Load into the ${i.vendor} ${i.profileName}`, text: [`Import these files into the ${i.vendor} programming software, then download from there.`], files: exportFiles }];
}
