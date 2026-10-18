import { useRef } from 'react';
import { PROJECT_NAME_MAX, useProjectsStore } from '../store/useProjectsStore';

/** The open project's name, edited in place: at most PROJECT_NAME_MAX characters, and never left empty (the name it had comes back). */
export default function ProjectNameInput({ className = '' }: { className?: string }) {
  const name = useProjectsStore((s) => s.projects.find((p) => p.id === s.activeId)?.name ?? '');
  const rename = useProjectsStore((s) => s.renameActive);
  const before = useRef(name);
  return (
    <input
      value={name}
      maxLength={PROJECT_NAME_MAX}
      onFocus={() => { before.current = name; }}
      onChange={(e) => rename(e.target.value)}
      onBlur={() => { if (!name.trim()) rename(before.current.trim() || 'Untitled project'); else if (name !== name.trim()) rename(name.trim()); }}
      aria-label="Project name"
      title={name}
      className={className}
    />
  );
}
