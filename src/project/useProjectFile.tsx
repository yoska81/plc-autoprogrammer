import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { buildProjectFile, openProjectFile, PROJECT_EXT } from './projectFile';
import { saveBlob } from '../deliverables/files';
import { desktopBridge } from '../desktop/bridge';
import { notify } from '../store/useNoticeStore';

/**
 * Save the open project as an .isap file and open .isap files as new projects:
 * menu / toolbar actions, Ctrl+S and Ctrl+O, and files opened from Explorer in the Windows app.
 */
export function useProjectFile(): { save: () => void; open: () => void; input: ReactNode } {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const save = useCallback(() => {
    void buildProjectFile()
      .then(({ name, blob }) => saveBlob(name, blob))
      .catch((e: unknown) => notify(`The project could not be saved: ${e instanceof Error ? e.message : String(e)}`));
  }, []);

  const openBlob = useCallback((blob: Blob) => {
    void openProjectFile(blob)
      .then((name) => { notify(`Opened project “${name}”.`); navigate('/spec'); })
      .catch((e: unknown) => notify(e instanceof Error ? e.message : String(e)));
  }, [navigate]);

  const open = useCallback(() => inputRef.current?.click(), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 's') { e.preventDefault(); save(); }
      else if (k === 'o') { e.preventDefault(); open(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save, open]);

  useEffect(() => {
    desktopBridge()?.onOpenFile?.((_name, bytes) => openBlob(new Blob([bytes as BlobPart])));
  }, [openBlob]);

  const input = (
    <input ref={inputRef} type="file" accept={`.${PROJECT_EXT},.zip`} className="hidden" data-testid="open-project-file"
      onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) openBlob(f); }} />
  );
  return { save, open, input };
}
