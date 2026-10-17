/**
 * "Save as AutoCAD" and "Save as EPLAN" (Electrical page): the whole drawing set in one DXF file, and the
 * EPLAN import package.
 */
import type { ProjectSnapshot } from './collect';
import { saveBlob } from './files';
import { AUTOCAD_README, drawingSetDxf, drawingSetOneDxf, type SheetDxf } from '../electrical/cad/drawingsDxf';
import { eplanPackage, type EplanOptions } from '../electrical/cad/eplan';

/** PLC address → program nickname (symbolic address for EPLAN). */
export function programSymbols(p: ProjectSnapshot): Map<string, string> {
  return new Map(p.ladder.tags.filter((t) => t.nickname).map((t) => [t.address, t.nickname]));
}

/** AutoCAD package: dxf/ (and dwg/ when converted) + README. */
export async function autocadZip(p: ProjectSnapshot, sheets: SheetDxf[] = drawingSetDxf(p.drawingCtx!), dwg: { name: string; bytes: Uint8Array }[] = []): Promise<Blob> {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  zip.file(`${p.fileBase}_drawings.dxf`, drawingSetOneDxf(p.drawingCtx!).dxf);
  for (const s of sheets) zip.file(`dxf/${s.fileName}`, s.dxf);
  for (const f of dwg) zip.file(`dwg/${f.name}`, f.bytes);
  zip.file('README.txt', AUTOCAD_README(p.projectName, sheets, dwg.length > 0));
  return zip.generateAsync({ type: 'blob' });
}

/** EPLAN import package: AML, PLC assignment list, parts XML, device / terminal / cable / connection lists, dxf/, README. */
export async function eplanZip(p: ProjectSnapshot, sheets: SheetDxf[] = drawingSetDxf(p.drawingCtx!), opts: EplanOptions = {}): Promise<Blob> {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const pkg = eplanPackage(p.drawingCtx!, { symbols: programSymbols(p), ...opts }, sheets.length);
  for (const [name, text] of Object.entries(pkg.files)) zip.file(name, text);
  zip.file(`${p.fileBase}_drawings.dxf`, drawingSetOneDxf(p.drawingCtx!).dxf);
  for (const s of sheets) zip.file(`dxf/${s.fileName}`, s.dxf);
  return zip.generateAsync({ type: 'blob' });
}

/** The whole drawing set as ONE DXF file (every sheet 1:1, five per row; opens directly in AutoCAD 2007 and later). */
export async function saveAsAutocad(p: ProjectSnapshot): Promise<void> {
  const { dxf } = drawingSetOneDxf(p.drawingCtx!);
  saveBlob(`${p.fileBase}_drawings.dxf`, new Blob([dxf], { type: 'application/dxf' }));
}

export async function saveAsEplan(p: ProjectSnapshot): Promise<void> {
  saveBlob(`${p.fileBase}_eplan_import.zip`, await eplanZip(p));
}
