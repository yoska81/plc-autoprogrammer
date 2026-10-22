/**
 * The Test card (Help › Test card): for the owner trying "Send to PLC software" on a Windows PC, per PLC brand,
 * what to install, the few clicks, and which log to send us when it goes wrong. Plain words, no engineering.
 * The engineers' longer checklists: tools/*-bridge/README.md.
 */
import { softwareFor } from './sendRoutes';

export interface TestCardBrand {
  /** The PLC as the PLC page names it. */
  brand: string;
  software: string;
  install: string[];
  clicks: string[];
  /** The log to send (in the logs folder); null: nothing is sent to the software, so there is no log. */
  log: string | null;
}

/** Where the desktop app keeps the logs (Open log folder opens it). */
export const LOGS_FOLDER = '%APPDATA%\\ISA Auto Programmer\\logs';

const START = 'Open a project with this PLC, go to the PLC program page and press Send to PLC software.';
const AT_MACHINE = 'Only at the machine, and only if you want to: Download… shows a confirm screen; tick the boxes, then Download now.';

export const TEST_CARD: TestCardBrand[] = [
  {
    brand: 'Siemens S7-1200 / S7-1500',
    software: softwareFor('siemens-s7', 'Siemens'),
    install: [
      'TIA Portal V17 or newer, with "TIA Openness" ticked in its setup.',
      'Your Windows user in the "Siemens TIA Openness" group (an administrator adds it), then sign out of Windows and in again.',
    ],
    clicks: [
      START,
      'Open TIA Portal. When TIA Portal asks whether to allow ISA Auto Programmer, answer Yes.',
      'Add the PLC and its tags, then Put the program in and compile.',
      AT_MACHINE,
    ],
    log: 'tia-bridge.log',
  },
  {
    brand: 'AutomationDirect CLICK',
    software: softwareFor('click', 'AutomationDirect'),
    install: ['CLICK Programming Software version 4 (free from AutomationDirect).'],
    clicks: [
      START,
      'Press Put the project into CLICK, then keep your hands off the mouse and keyboard until the app says Done.',
      'Read what is left to do (such as modules to add), then save the project in CLICK.',
    ],
    log: 'click-bridge.log',
  },
  {
    brand: 'CODESYS (Structured Text)',
    software: softwareFor('generic-st', 'CODESYS'),
    install: [
      'CODESYS Development System V3.5 (free from the CODESYS Store), with your PLC\'s device package.',
      'To download: the CODESYS Gateway running (its icon in the Windows taskbar).',
    ],
    clicks: [
      START,
      'Press Put the program in and build (to use your own project: close it in CODESYS, then Choose my project… first).',
      'Press Open in CODESYS and look at the program.',
      AT_MACHINE,
    ],
    log: 'codesys-bridge.log',
  },
  {
    brand: 'Allen-Bradley ControlLogix / CompactLogix',
    software: softwareFor('logix', 'Rockwell'),
    install: [
      'Studio 5000 Logix Designer (your licence).',
      'Rockwell\'s Logix Designer SDK, with its Python client.',
    ],
    clicks: [
      START,
      'Close your project in Studio 5000, press Choose my project… and pick your .ACD file.',
      'Press Put the program in (the app works on a copy next to your file: yours is not changed), then Open in Studio 5000.',
      AT_MACHINE,
    ],
    log: 'studio5000-bridge.log',
  },
  ...([
    ['Allen-Bradley Micro800', 'micro800', 'Rockwell'],
    ['Unitronics UniStream', 'unitronics-unistream', 'Unitronics'],
    ['Unitronics Vision', 'unitronics-vision', 'Unitronics'],
  ] as const).map(([brand, id, vendor]): TestCardBrand => ({
    brand,
    software: softwareFor(id, vendor),
    install: [`${softwareFor(id, vendor)}, from ${vendor}.`],
    clicks: [
      START,
      `The app says it cannot send to ${softwareFor(id, vendor)}: press Load into PLC instead and follow its steps.`,
    ],
    log: null,
  })),
  {
    brand: 'Yaskawa MP',
    software: softwareFor('yaskawa-mp', 'Yaskawa'),
    install: ['Nothing: the app reads a Yaskawa program, it does not write one.'],
    clicks: [
      'Import › PLC program: read the machine\'s Yaskawa program and choose the PLC to move it to.',
      'Then follow the card of that PLC.',
    ],
    log: null,
  },
];
