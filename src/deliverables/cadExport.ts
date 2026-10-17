/**
 * "Save as AutoCAD" and "Save as EPLAN" (Electrical page): the drawing set as DXF (DWG through the ODA File
 * Converter in the desktop app, when installed) and the EPLAN import package.
 */
import type { ProjectSnapshot } from './collect';
import { desktopBridge } from '../desktop/bridge';
import { notify } from '../store/useNoticeStore';
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

/** Desktop app with the ODA File Converter: DWG + DXF; otherwise DXF, with a note why. */
export async function saveAsAutocad(p: ProjectSnapshot): Promise<void> {
  const sheets = drawingSetDxf(p.drawingCtx!);
  const oda = desktopBridge()?.oda;
  let dwg: { name: string; bytes: Uint8Array }[] = [];
  if (oda) {
    const found = await oda.detect();
    if (found.found) {
      const r = await oda.convert(sheets.map((s) => ({ name: s.fileName, text: s.dxf })));
      if (r.ok) dwg = r.files;
      else notify(`DWG conversion failed (${r.error}). Saved DXF instead — it opens directly in AutoCAD.`);
    } else {
      notify('DWG needs the free ODA File Converter (opendesign.com > ODA File Converter), which is not installed. Saved DXF instead — it opens directly in AutoCAD.');
    }
  }
  saveBlob(`${p.fileBase}_autocad_${dwg.length ? 'dwg' : 'dxf'}.zip`, await autocadZip(p, sheets, dwg));
}

export async function saveAsEplan(p: ProjectSnapshot): Promise<void> {
  saveBlob(`${p.fileBase}_eplan_import.zip`, await eplanZip(p));
}
