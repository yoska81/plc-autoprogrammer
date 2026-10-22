/**
 * "Send to Studio 5000": what the Studio 5000 bridge imports into (a copy of) the user's Logix Designer project
 * through Rockwell's Logix Designer SDK: the app's L5X (buildL5x, a whole controller) and the parts of it to take
 * over, as the SDK's partial import names them (XPaths into the project): the user-defined data types and Add-On
 * Instructions the program uses, the controller tags, and MainProgram. The controller itself (its type, its I/O
 * configuration, its tasks) stays the user's.
 */
import type { ProjectSnapshot } from '../../deliverables/collect';
import { exportContext } from '../../deliverables/exportContext';
import { buildL5x } from '../core/profiles/l5x';

export interface StudioImport {
  l5x: string;
  /** In import order: types before the tags that use them, tags before the program. */
  xpaths: string[];
}

export const MAIN_PROGRAM = "Controller/Programs/Program[@Name='MainProgram']";

/** The parts of an L5X to import (the empty ones left out). */
export function l5xParts(l5x: string): string[] {
  const has = (tag: string) => new RegExp(`<${tag}>[\\s\\S]*?<\\/${tag}>`).test(l5x) && !new RegExp(`<${tag}/>`).test(l5x);
  return [
    ...(has('DataTypes') ? ['Controller/DataTypes'] : []),
    ...(has('AddOnInstructionDefinitions') ? ['Controller/AddOnInstructionDefinitions'] : []),
    'Controller/Tags',
    MAIN_PROGRAM,
  ];
}

export function studioImport(p: ProjectSnapshot): StudioImport {
  const l5x = buildL5x(p.ladder, exportContext(p));
  return { l5x, xpaths: l5xParts(l5x) };
}
