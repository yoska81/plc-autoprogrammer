/**
 * Rittal AX compact enclosures (the AE series is discontinued).
 *
 * Verification (October 2026): from Rittal US data sheets (the page in `url`). The AX
 * ships with its mounting panel: widthMm/heightMm = outside size, panelWidthIn/panelHeightIn = the
 * mounting plate (from the data sheet).
 */
import type { CatalogPart } from '../types';

export const RITTAL: CatalogPart[] = [
  {
    partNumber: '1033.000',
    category: 'enclosure',
    description: 'Rittal AX compact wall-mounted enclosure, WHD 300x300x210 mm, carbon steel, single door, mounting panel included',
    manufacturer: 'Rittal',
    family: 'AX',
    url: 'https://www.rittal.com/pdf-creator/variant/us-en/1033000',
    mount: 'backplate',
    widthMm: 300,
    heightMm: 300,
    ratings: { kind: 'enclosure', heightMm: 300, widthMm: 300, depthMm: 210, heightIn: 11.8, widthIn: 11.8, depthIn: 8.27, nema: '1/3R/4/12', material: 'carbon steel, RAL 7035', subpanel: 'included (zinc-plated mounting panel 250 x 275 mm W x H)', panelHeightIn: 10.83, panelWidthIn: 9.84, nemaNote: 'NEMA 1/3R/4/12; UL 50E Type 1/3R/4/12; IP66' },
    verified: true,
  },
  {
    partNumber: '1045.000',
    category: 'enclosure',
    description: 'Rittal AX compact wall-mounted enclosure, WHD 400x500x210 mm, carbon steel, single door, mounting panel included',
    manufacturer: 'Rittal',
    family: 'AX',
    url: 'https://www.rittal.com/pdf-creator/variant/us-en/1045000',
    mount: 'backplate',
    widthMm: 400,
    heightMm: 500,
    ratings: { kind: 'enclosure', heightMm: 500, widthMm: 400, depthMm: 210, heightIn: 19.7, widthIn: 15.7, depthIn: 8.27, nema: '1/3R/4/12', material: 'carbon steel, RAL 7035', subpanel: 'included (zinc-plated mounting panel 350 x 475 mm W x H)', panelHeightIn: 18.7, panelWidthIn: 13.78, nemaNote: 'NEMA 1/3R/4/12; UL 50E Type 1/3R/4/12; IP66' },
    verified: true,
  },
  {
    partNumber: '1050.000',
    category: 'enclosure',
    description: 'Rittal AX compact wall-mounted enclosure, WHD 500x500x210 mm, carbon steel, single door, mounting panel included',
    manufacturer: 'Rittal',
    family: 'AX',
    url: 'https://www.rittal.com/pdf-creator/variant/us-en/1050000',
    mount: 'backplate',
    widthMm: 500,
    heightMm: 500,
    ratings: { kind: 'enclosure', heightMm: 500, widthMm: 500, depthMm: 210, heightIn: 19.7, widthIn: 19.7, depthIn: 8.27, nema: '1/3R/4/12', material: 'carbon steel, RAL 7035', subpanel: 'included (zinc-plated mounting panel 450 x 475 mm W x H)', panelHeightIn: 18.7, panelWidthIn: 17.72, nemaNote: 'NEMA 1/3R/4/12; UL 50E Type 1/3R/4/12; IP66' },
    verified: true,
  },
  {
    partNumber: '1060.000',
    category: 'enclosure',
    description: 'Rittal AX compact wall-mounted enclosure, WHD 600x600x210 mm, carbon steel, single door, mounting panel included',
    manufacturer: 'Rittal',
    family: 'AX',
    url: 'https://www.rittal.com/pdf-creator/variant/us-en/1060000',
    mount: 'backplate',
    widthMm: 600,
    heightMm: 600,
    ratings: { kind: 'enclosure', heightMm: 600, widthMm: 600, depthMm: 210, heightIn: 23.6, widthIn: 23.6, depthIn: 8.27, nema: '1/3R/4/12', material: 'carbon steel, RAL 7035', subpanel: 'included (zinc-plated mounting panel 550 x 575 mm W x H)', panelHeightIn: 22.64, panelWidthIn: 21.65, nemaNote: 'NEMA 1/3R/4/12; UL 50E Type 1/3R/4/12; IP66' },
    verified: true,
  },
  {
    partNumber: '1076.000',
    category: 'enclosure',
    description: 'Rittal AX compact wall-mounted enclosure, WHD 600x760x210 mm, carbon steel, single door, mounting panel included',
    manufacturer: 'Rittal',
    family: 'AX',
    url: 'https://www.rittal.com/pdf-creator/variant/us-en/1076000',
    mount: 'backplate',
    widthMm: 600,
    heightMm: 760,
    ratings: { kind: 'enclosure', heightMm: 760, widthMm: 600, depthMm: 210, heightIn: 29.9, widthIn: 23.6, depthIn: 8.27, nema: '1/3R/4/12', material: 'carbon steel, RAL 7035', subpanel: 'included (zinc-plated mounting panel 550 x 735 mm W x H)', panelHeightIn: 28.94, panelWidthIn: 21.65, nemaNote: 'NEMA 1/3R/4/12; UL 50E Type 1/3R/4/12; IP66' },
    verified: true,
  },
  {
    partNumber: '1077.000',
    category: 'enclosure',
    description: 'Rittal AX compact wall-mounted enclosure, WHD 760x760x210 mm, carbon steel, single door, mounting panel included',
    manufacturer: 'Rittal',
    family: 'AX',
    url: 'https://www.rittal.com/pdf-creator/variant/us-en/1077000',
    mount: 'backplate',
    widthMm: 760,
    heightMm: 760,
    ratings: { kind: 'enclosure', heightMm: 760, widthMm: 760, depthMm: 210, heightIn: 29.9, widthIn: 29.9, depthIn: 8.27, nema: '1/3R/4/12', material: 'carbon steel, RAL 7035', subpanel: 'included (zinc-plated mounting panel 705 x 735 mm W x H)', panelHeightIn: 28.94, panelWidthIn: 27.76, nemaNote: 'NEMA 1/3R/4/12; UL 50E Type 1/3R/4/12; IP66' },
    verified: true,
  },
];
