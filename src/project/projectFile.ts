/**
 * ISA Auto Programmer project file (.isap).
 *
 * A ZIP container (so pictures and long programs stay small) holding:
 *   manifest.json  – { format: 'isa-auto-programmer-project', formatVersion, appVersion, savedAt, name, sourceId }
 *   project.json   – every project store (spec, I/O, PLC, program, electrical, HMI, stages, review)
 *                    plus the per-project data kept in shared stores (machine layout, questions & answers,
 *                    I/O check-out, label setup).
 * Settings and API keys are never written to the file.
 * Opening a file always adds it as a NEW project; nothing already in the app is overwritten.
 */
import JSZip from 'jszip';
import { activeProjectData, addProjectFromData, useProjectsStore } from '../store/useProjectsStore';
import { useLayoutStore } from '../electrical/layout/useLayoutStore';
import { useQuestionStore } from '../components/questions/useQuestionStore';
import { useCheckoutStore } from '../online/useCheckoutStore';
import { useCommissioningStore } from '../commissioning/useCommissioningStore';
import { useRedlineStore } from '../redlines/useRedlineStore';
import { useLabelSetupStore } from '../electrical/labels/setup';

export const PROJECT_EXT = 'isap';
export const PROJECT_FORMAT = 'isa-auto-programmer-project';
export const PROJECT_FORMAT_VERSION = 1;

export interface ProjectManifest {
  format: typeof PROJECT_FORMAT;
  formatVersion: number;
  appVersion: string;
  savedAt: string;
  name: string;
  sourceId: string | null;
}

interface ProjectFileBody {
  stores: Record<string, unknown>;
  perProject: { layout?: unknown; questions?: unknown; checkout?: unknown; labels?: unknown; commissioning?: unknown; redlines?: unknown };
}

const fileSafe = (s: string) => s.replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '') || 'project';

/** The open project as an .isap file. */
export async function buildProjectFile(): Promise<{ name: string; blob: Blob }> {
  const { id, name, data } = activeProjectData();
  const k = id ?? 'default';
  const body: ProjectFileBody = {
    stores: data,
    perProject: {
      layout: id ? useLayoutStore.getState().byProject[id] : undefined,
      questions: useQuestionStore.getState().byProject[k],
      checkout: useCheckoutStore.getState().byProject[k],
      commissioning: useCommissioningStore.getState().byProject[k],
      redlines: useRedlineStore.getState().byProject[k],
      labels: id ? useLabelSetupStore.getState().byProject[id] : undefined,
    },
  };
  const manifest: ProjectManifest = {
    format: PROJECT_FORMAT, formatVersion: PROJECT_FORMAT_VERSION, appVersion: __APP_VERSION__,
    savedAt: new Date().toISOString(), name, sourceId: id,
  };
  const zip = new JSZip();
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  zip.file('project.json', JSON.stringify(body));
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 }, mimeType: 'application/octet-stream' });
  return { name: `${fileSafe(name)}.${PROJECT_EXT}`, blob };
}

/** Read an .isap file (or a .zip that contains one, as the preview delivers it). */
export async function readProjectFile(file: Blob): Promise<{ manifest: ProjectManifest; body: ProjectFileBody }> {
  let zip: JSZip;
  try { zip = await JSZip.loadAsync(file); } catch { throw new Error('This is not an ISA Auto Programmer project file (.isap).'); }
  if (!zip.file('manifest.json')) {
    const inner = Object.values(zip.files).find((f) => !f.dir && f.name.toLowerCase().endsWith(`.${PROJECT_EXT}`));
    if (!inner) throw new Error('This is not an ISA Auto Programmer project file (.isap).');
    zip = await JSZip.loadAsync(await inner.async('blob'));
  }
  const manifest = JSON.parse(await zip.file('manifest.json')!.async('string')) as ProjectManifest;
  if (manifest.format !== PROJECT_FORMAT) throw new Error('This is not an ISA Auto Programmer project file (.isap).');
  if (manifest.formatVersion > PROJECT_FORMAT_VERSION) throw new Error(`This project was saved by a newer version of ISA Auto Programmer (${manifest.appVersion}). Update the program to open it.`);
  const json = zip.file('project.json');
  if (!json) throw new Error('The project file is damaged: project.json is missing.');
  const body = JSON.parse(await json.async('string')) as ProjectFileBody;
  if (!body || typeof body.stores !== 'object') throw new Error('The project file is damaged: no project data.');
  return { manifest, body };
}

/** Open a project file as a new project. Returns the new project's id and name. */
export async function openProjectFile(file: Blob): Promise<{ id: string; name: string }> {
  const { manifest, body } = await readProjectFile(file);
  const existing = new Set(useProjectsStore.getState().projects.map((p) => p.name));
  let name = manifest.name || 'Opened project';
  if (existing.has(name)) { let n = 2; while (existing.has(`${name} (${n})`)) n++; name = `${name} (${n})`; }
  const id = addProjectFromData(name, body.stores);
  if (!id) throw new Error('Wait until the AI has finished, then open the project again.');
  const pp = body.perProject ?? {};
  if (pp.layout) useLayoutStore.setState((s) => ({ byProject: { ...s.byProject, [id]: pp.layout as never } }));
  if (pp.questions) useQuestionStore.setState((s) => ({ byProject: { ...s.byProject, [id]: pp.questions as never } }));
  if (pp.checkout) useCheckoutStore.setState((s) => ({ byProject: { ...s.byProject, [id]: pp.checkout as never } }));
  if (pp.commissioning) useCommissioningStore.setState((s) => ({ byProject: { ...s.byProject, [id]: pp.commissioning as never } }));
  if (pp.redlines) useRedlineStore.setState((s) => ({ byProject: { ...s.byProject, [id]: pp.redlines as never } }));
  if (pp.labels) useLabelSetupStore.setState((s) => ({ byProject: { ...s.byProject, [id]: pp.labels as never } }));
  return { id, name };
}
