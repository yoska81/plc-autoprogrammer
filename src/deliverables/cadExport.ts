/**
 * "Save as AutoCAD" and "Save as EPLAN" (Electrical page): the drawing set as DXF (DWG through the ODA File
 * Converter in the desktop app, when installed) and the EPLAN import package.
 */
import type { ProjectSnapshot } from './collect';
import { saveBlob } from './files';
import { AUTOCAD_README, drawingSetDxf, type SheetDxf } from '../electrical/cad/drawingsDxf';
import { eplanPackage, type EplanOptions } from '../electrical/cad/eplan';

/** PLC address → program nickname (symbolic address for EPLAN). */
export function programSymbols(p: ProjectSnapshot): Map<string, string> {
  return new Map(p.ladder.tags.filter((t) => t.nickname).map((t) => [t.address, t.nickname]));
}

/** AutoCAD package: dxf/ (and dwg/ when converted) + README. */
export async function autocadZip(p: ProjectSnapshot, sheets: SheetDxf[] = drawingSetDxf(p.drawingCtx!), dwg: { name: string; bytes: Uint8Array }[] = []): Promise<Blob> {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
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
  for (const s of sheets) zip.file(`dxf/${s.fileName}`, s.dxf);
  return zip.generateAsync({ type: 'blob' });
}

/** The drawing set as DXF (opens directly in AutoCAD 2007 and later, LT and AutoCAD Electrical). */
export async function saveAsAutocad(p: ProjectSnapshot): Promise<void> {
  saveBlob(`${p.fileBase}_autocad_dxf.zip`, await autocadZip(p, drawingSetDxf(p.drawingCtx!)));
}

export async function saveAsEplan(p: ProjectSnapshot): Promise<void> {
  saveBlob(`${p.fileBase}_eplan_import.zip`, await eplanZip(p));
}
