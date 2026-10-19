import { buildModel } from '../../electrical/derive';
import { ioNames, renameAddressText } from '../../electrical/ioNames';
import type { ProjectSnapshot } from '../collect';

/**
 * Text of a project document with its I/O addresses in the PLC's own naming (%I0.1 on an S7), the same names its
 * drawings and wire markers use; unchanged for CLICK.
 */
export function addressTextFor(p: ProjectSnapshot): (t: string) => string {
  const names = p.drawingCtx ? buildModel(p.drawingCtx).ioNames : ioNames(p.cpu.id, p.modules, [...p.addresses.values()]);
  return (t) => renameAddressText(names, t);
}
