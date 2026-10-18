/**
 * Ladder diagram viewer/editor.
 *
 * Draws a LadderProgram the way PLC programming software does: left and right
 * power rails, parallel branches joined by vertical wires, outputs stacked on
 * the right. Read-only unless `onChange` is given.
 */
import { Fragment, memo, useCallback, useMemo, useState } from 'react';
import { useProgressiveCount } from '../../../lib/useProgressive';
import {
  ArrowDownIcon, ArrowUpIcon, ChatBubbleBottomCenterTextIcon, DocumentDuplicateIcon,
  ExclamationCircleIcon, ExclamationTriangleIcon, PlusIcon, TrashIcon,
} from '@heroicons/react/24/outline';
import type { LadderElement, LadderOutput, LadderProgram, Rung } from '../../core/ladder';
import type { RungChange } from '../../core/diff';
import type { ValidationIssue } from '../../core/validate';
import { ElementCell, OutputCell } from './RungSymbol';
import { MnemonicsContext } from './mnemonics';
import { useProjectStore } from '../../../store/useProjectStore';
import { getProfile } from '../../core/profiles';
import ElementEditor from './ElementEditor';
import { useEditsStore } from '../../../edits/useEditsStore';
import { recordRungComment, rungKey } from '../../../edits/rungComments';
import { EditedMark } from '../../../edits/EditedMark';
import type { Anchor } from './ElementEditor';
import {
  CELL_W, JOIN_GAP, MIN_COLS, OUT_STUB, OUT_W, ROW_H, WIRE_Y,
  addBranch, addContact, addOutput, deleteElement, deleteOutput, deleteRung, duplicateRung,
  moveRung, newRung, outputAddress, outputRowHeight, setElement, setOutput, updateRung,
} from './ladderEdit';
import type { OutputType } from './ladderEdit';

export interface LadderViewProps {
  program: LadderProgram;
  /** Omit for read-only. Called with a new immutable program on every edit. */
  onChange?: (program: LadderProgram) => void;
  /** Rung number shown in the gutter (when showing part of a program); default position + 1. */
  numberOf?: (rungId: string) => number;
  /** Address -> short label (nickname/description) shown under each address. */
  labels?: Map<string, string>;
  /** Per-rung highlight for AI change review. */
  changes?: Map<string, RungChange>;
  issues?: ValidationIssue[];
  selectedRungId?: string | null;
  onSelectRung?: (id: string) => void;
  /** Diagram scale (1 = 100%); the instruction editor popover is not scaled. */
  zoom?: number;
  /** Draw the first rungs (and the selected one) at once and the rest while the browser is idle (long programs on screen; not for printing). */
  progressive?: boolean;
}

const NO_ISSUES: ValidationIssue[] = [];

type EditPath =
  | { rungId: string; kind: 'element'; branch: number; index: number; anchor: Anchor }
  | { rungId: string; kind: 'output'; index: number; anchor: Anchor };

const RAIL_W = 3;
const GUTTER_W = 44;
const HEAD_H = 30; // comment / toolbar band above the diagram
const PAD_B = 10;

const CHANGE_STYLE: Record<RungChange, { bg: string; bar: string; tag?: string; tagCls?: string }> = {
  added: { bg: 'bg-emerald-50', bar: 'bg-emerald-500', tag: 'Added', tagCls: 'bg-emerald-100 text-emerald-800' },
  changed: { bg: 'bg-amber-50', bar: 'bg-amber-500', tag: 'Changed', tagCls: 'bg-amber-100 text-amber-800' },
  removed: { bg: 'bg-red-50', bar: 'bg-red-500', tag: 'Removed', tagCls: 'bg-red-100 text-red-800' },
  unchanged: { bg: '', bar: '' },
};

function Wire({ x1, x2, y }: { x1: number; x2: number; y: number }) {
  if (x2 <= x1) return null;
  return <div className="absolute h-[2px] bg-slate-800" style={{ left: x1, width: x2 - x1, top: y - 1 }} />;
}

function VWire({ x, y1, y2 }: { x: number; y1: number; y2: number }) {
  if (y2 <= y1) return null;
  return <div className="absolute w-[2px] bg-slate-800" style={{ left: x - 1, top: y1 - 1, height: y2 - y1 + 2 }} />;
}

function diagramWidth(cols: number): number {
  return RAIL_W + cols * CELL_W + JOIN_GAP + OUT_STUB + OUT_W + OUT_STUB + RAIL_W;
}

function lookup(labels: Map<string, string> | undefined, addr: string): string | undefined {
  if (!labels || !addr) return undefined;
  return labels.get(addr) ?? labels.get(addr.toUpperCase().trim());
}

function elementLabel(labels: Map<string, string> | undefined, el: LadderElement) {
  return el.type === 'CMP' ? lookup(labels, el.left) : el.type === 'RAW' ? undefined : lookup(labels, el.address);
}

interface DiagramProps {
  rung: Rung;
  cols: number;
  labels?: Map<string, string>;
  struck: boolean;
  editing: EditPath | null;
  onElementClick?: (branch: number, index: number, e: React.MouseEvent<HTMLElement>) => void;
  onOutputClick?: (index: number, e: React.MouseEvent<HTMLElement>) => void;
}

/** The wiring + symbols of one rung (between the rails). */
function RungDiagram({ rung, cols, labels, struck, editing, onElementClick, onOutputClick }: DiagramProps) {
  const xIn = RAIL_W;
  const rows = Math.max(1, rung.branches.length);
  const inputEnd = xIn + cols * CELL_W;
  const outV = inputEnd + JOIN_GAP;
  const outX = outV + OUT_STUB;
  const rightX = outX + OUT_W + OUT_STUB;

  const outTops: number[] = [];
  let acc = 0;
  for (const o of rung.outputs) { outTops.push(acc); acc += outputRowHeight(o); }
  const outH = Math.max(ROW_H, acc);
  const height = Math.max(rows * ROW_H, outH);
  const lastBranchY = (rows - 1) * ROW_H + WIRE_Y;
  const lastOutY = (outTops.length ? outTops[outTops.length - 1] : 0) + WIRE_Y;
  const isSel = (k: 'element' | 'output', b: number, i: number) =>
    !!editing && editing.rungId === rung.id && editing.kind === k && editing.index === i && (k === 'output' || (editing.kind === 'element' && editing.branch === b));

  return (
    <div className="relative" style={{ height, width: rightX }}>
      {/* input branches */}
      {rung.branches.length === 0 && <Wire x1={xIn} x2={inputEnd} y={WIRE_Y} />}
      {rung.branches.map((br, b) => {
        const top = b * ROW_H;
        return (
          <div key={b}>
            {br.map((el, i) => (
              <div key={i} className="absolute" style={{ left: xIn + i * CELL_W, top }}>
                <ElementCell
                  element={el}
                  label={elementLabel(labels, el)}
                  struck={struck}
                  selected={isSel('element', b, i)}
                  onClick={onElementClick ? (e) => onElementClick(b, i, e) : undefined}
                />
              </div>
            ))}
            <Wire x1={xIn + br.length * CELL_W} x2={inputEnd} y={top + WIRE_Y} />
          </div>
        );
      })}
      {rows > 1 && <VWire x={inputEnd} y1={WIRE_Y} y2={lastBranchY} />}
      <Wire x1={inputEnd} x2={outV} y={WIRE_Y} />

      {/* outputs */}
      {rung.outputs.length > 1 && <VWire x={outV} y1={WIRE_Y} y2={lastOutY} />}
      {rung.outputs.length === 0 && (
        <>
          <Wire x1={outV} x2={outX + 10} y={WIRE_Y} />
          <div
            className="absolute flex items-center justify-center rounded border-2 border-dashed border-red-300 text-[11px] font-medium text-red-500"
            style={{ left: outX + 10, top: WIRE_Y - 13, width: OUT_W - 20, height: 26 }}
          >
            no output
          </div>
        </>
      )}
      {rung.outputs.map((o, k) => (
        <div key={k}>
          <Wire x1={outV} x2={outX} y={outTops[k] + WIRE_Y} />
          <div className="absolute" style={{ left: outX, top: outTops[k] }}>
            <OutputCell
              output={o}
              label={lookup(labels, outputAddress(o))}
              struck={struck}
              selected={isSel('output', 0, k)}
              onClick={onOutputClick ? (e) => onOutputClick(k, e) : undefined}
            />
          </div>
          <Wire x1={outX + OUT_W} x2={rightX} y={outTops[k] + WIRE_Y} />
        </div>
      ))}
    </div>
  );
}

const tbBtn =
  'inline-flex h-6 items-center gap-1 rounded border border-slate-300 bg-white px-1.5 text-[11px] font-medium text-slate-700 hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40';

interface ToolbarProps {
  rung: Rung;
  index: number;
  count: number;
  onEditComment: () => void;
  apply: (fn: (p: LadderProgram) => LadderProgram) => void;
}

function RungToolbar({ rung, index, count, onEditComment, apply }: ToolbarProps) {
  const upd = (fn: (r: Rung) => Rung) => apply((p) => updateRung(p, rung.id, fn));
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  return (
    <div className="flex items-center gap-1" onClick={stop}>
      <button type="button" className={tbBtn} onClick={onEditComment} title="Edit comment">
        <ChatBubbleBottomCenterTextIcon className="h-3.5 w-3.5" /> Comment
      </button>
      {rung.branches.length > 1 ? (
        <select
          className={`${tbBtn} pr-6`}
          value=""
          title="Add contact at the end of a branch"
          onChange={(e) => { const b = Number(e.target.value); upd((r) => addContact(r, b)); }}
        >
          <option value="" disabled hidden>+ Contact</option>
          {rung.branches.map((_, b) => <option key={b} value={b}>Branch {b + 1}</option>)}
        </select>
      ) : (
        <button type="button" className={tbBtn} onClick={() => upd((r) => addContact(r, 0))} title="Add contact in series">
          <PlusIcon className="h-3.5 w-3.5" /> Contact
        </button>
      )}
      <button type="button" className={tbBtn} onClick={() => upd(addBranch)} title="Add parallel branch">
        <PlusIcon className="h-3.5 w-3.5" /> Branch
      </button>
      <select
        className={`${tbBtn} pr-6`}
        value=""
        title="Add output instruction"
        onChange={(e) => { const t = e.target.value as OutputType; upd((r) => addOutput(r, t)); }}
      >
        <option value="" disabled hidden>+ Output</option>
        <option value="OUT">Out coil</option>
        <option value="SET">Set coil</option>
        <option value="RST">Reset coil</option>
        <option value="TMR">Timer</option>
        <option value="CNT">Counter</option>
        <option value="COPY">Copy</option>
        <option value="MATH">Math</option>
      </select>
      <span className="mx-0.5 h-4 w-px bg-slate-300" />
      <button type="button" className={tbBtn} disabled={index === 0} onClick={() => apply((p) => moveRung(p, rung.id, -1))} title="Move rung up">
        <ArrowUpIcon className="h-3.5 w-3.5" />
      </button>
      <button type="button" className={tbBtn} disabled={index === count - 1} onClick={() => apply((p) => moveRung(p, rung.id, 1))} title="Move rung down">
        <ArrowDownIcon className="h-3.5 w-3.5" />
      </button>
      <button type="button" className={tbBtn} onClick={() => apply((p) => duplicateRung(p, rung.id))} title="Duplicate rung">
        <DocumentDuplicateIcon className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        className={`${tbBtn} text-red-600 hover:border-red-300 hover:bg-red-50`}
        onClick={() => { if (window.confirm(`Delete rung ${index + 1}?`)) apply((p) => deleteRung(p, rung.id)); }}
        title="Delete rung"
      >
        <TrashIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function IssueList({ issues }: { issues: ValidationIssue[] }) {
  if (!issues.length) return null;
  return (
    <ul className="space-y-0.5">
      {issues.map((iss, i) => (
        <li key={i} className={`flex items-start gap-1.5 text-xs ${iss.severity === 'error' ? 'text-red-700' : 'text-amber-700'}`}>
          {iss.severity === 'error'
            ? <ExclamationCircleIcon className="mt-px h-3.5 w-3.5 shrink-0" />
            : <ExclamationTriangleIcon className="mt-px h-3.5 w-3.5 shrink-0" />}
          <span>{iss.message}</span>
        </li>
      ))}
    </ul>
  );
}

interface RungRowProps {
  rung: Rung;
  index: number;
  number: number;
  count: number;
  cols: number;
  labels?: Map<string, string>;
  change: RungChange;
  issues: ValidationIssue[];
  selected: boolean;
  editable: boolean;
  editingComment: boolean;
  editing: EditPath | null;
  onSelect?: (id: string) => void;
  setEditingComment: (id: string | null) => void;
  setEditing: (p: EditPath | null) => void;
  apply: (fn: (p: LadderProgram) => LadderProgram) => void;
}

function anchorOf(e: React.MouseEvent<HTMLElement>): Anchor {
  const r = e.currentTarget.getBoundingClientRect();
  return { left: r.left, top: r.top, bottom: r.bottom, el: e.currentTarget };
}

// Memoized: selecting or editing one rung redraws that rung only.
const RungRow = memo(function RungRow(props: RungRowProps) {
  const { rung, index, count, cols, labels, change, issues, selected, editable, editingComment, editing } = props;
  const st = CHANGE_STYLE[change];
  const removed = change === 'removed';
  const width = diagramWidth(cols);
  const errors = issues.filter((i) => i.severity === 'error').length;
  // A comment the user rewrote: marked, with a way back to the generated one.
  const commentEdit = useEditsStore((s) => s.texts[rungKey(rung.id)]);
  const commentEdited = Boolean(commentEdit && commentEdit.value === rung.comment);

  return (
    <div
      data-rung-id={rung.id}
      className={`group relative flex ${st.bg} ${selected ? 'ring-2 ring-inset ring-sky-400' : ''}`}
      style={{ minWidth: GUTTER_W + width + 24 }}
      onClick={() => props.onSelect?.(rung.id)}
    >
      {/* change bar + rung number */}
      <div className="relative shrink-0 select-none" style={{ width: GUTTER_W }}>
        {st.bar && <div className={`absolute inset-y-0 left-0 w-1 ${st.bar}`} />}
        <div
          className={`pr-2 text-right font-mono text-sm font-bold ${errors ? 'text-red-600' : 'text-slate-500'}`}
          style={{ paddingTop: HEAD_H + WIRE_Y - 10 }}
        >
          {props.number}
        </div>
      </div>

      <div className={`relative ${removed ? 'opacity-50' : ''}`} style={{ width, paddingBottom: PAD_B }}>
        {/* power rails span the whole rung block so they read as continuous */}
        <div className="absolute inset-y-0 left-0 bg-slate-800" style={{ width: RAIL_W }} />
        <div className="absolute inset-y-0 right-0 bg-slate-800" style={{ width: RAIL_W }} />

        <div className="flex items-center gap-2 pl-3 pr-3" style={{ height: HEAD_H }}>
          {st.tag && (
            <span className={`shrink-0 rounded px-1.5 py-px text-[10px] font-bold uppercase tracking-wide ${st.tagCls}`}>{st.tag}</span>
          )}
          {editingComment ? (
            <input
              autoFocus
              className="h-6 min-w-0 flex-1 rounded border border-sky-400 px-1.5 text-xs italic text-slate-700 focus:outline-none"
              defaultValue={rung.comment}
              placeholder="Rung comment"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
                if (e.key === 'Escape') props.setEditingComment(null);
              }}
              onBlur={(e) => {
                const v = e.currentTarget.value;
                props.setEditingComment(null);
                if (v !== rung.comment) { recordRungComment(rung.id, v, rung.comment); props.apply((p) => updateRung(p, rung.id, (r) => ({ ...r, comment: v }))); }
              }}
            />
          ) : (
            <span
              className={`min-w-0 truncate text-xs italic text-slate-500 ${removed ? 'line-through' : ''}`}
              title={rung.comment}
              onDoubleClick={editable ? () => props.setEditingComment(rung.id) : undefined}
            >
              {rung.comment}
            </span>
          )}
          {commentEdited && commentEdit && !editingComment && (
            <EditedMark className="shrink-0" generated={commentEdit.generated} onReset={editable ? () => {
              useEditsStore.getState().resetText(rungKey(rung.id));
              props.apply((p) => updateRung(p, rung.id, (r) => ({ ...r, comment: commentEdit.generated })));
            } : undefined} />
          )}
          {editable && !removed && !editingComment && (
            <div className={`absolute right-3 top-[3px] z-10 rounded bg-white/95 pl-2 shadow-[-8px_0_8px_-4px_rgba(255,255,255,0.95)] ${selected ? 'flex' : 'hidden group-hover:flex'}`}>
              <RungToolbar
                rung={rung}
                index={index}
                count={count}
                onEditComment={() => props.setEditingComment(rung.id)}
                apply={props.apply}
              />
            </div>
          )}
        </div>

        <RungDiagram
          rung={rung}
          cols={cols}
          labels={labels}
          struck={removed}
          editing={editing}
          onElementClick={editable && !removed ? (b, i, e) => {
            e.stopPropagation();
            props.onSelect?.(rung.id);
            props.setEditing({ rungId: rung.id, kind: 'element', branch: b, index: i, anchor: anchorOf(e) });
          } : undefined}
          onOutputClick={editable && !removed ? (k, e) => {
            e.stopPropagation();
            props.onSelect?.(rung.id);
            props.setEditing({ rungId: rung.id, kind: 'output', index: k, anchor: anchorOf(e) });
          } : undefined}
        />

        {issues.length > 0 && (
          <div className="mx-3 mt-1 rounded border border-slate-200 bg-white/80 px-2 py-1">
            <IssueList issues={issues} />
          </div>
        )}
      </div>
    </div>
  );
});

export default function LadderView({
  program, onChange, labels, changes, issues = NO_ISSUES, selectedRungId = null, onSelectRung, numberOf, zoom = 1, progressive = false,
}: LadderViewProps) {
  const [editing, setEditing] = useState<EditPath | null>(null);
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const editable = !!onChange;
  const mnemonics = getProfile(useProjectStore((s) => s.plcId)).mnemonics;

  const apply = useCallback(
    (fn: (p: LadderProgram) => LadderProgram) => { if (onChange) onChange(fn(program)); },
    [onChange, program],
  );
  const closeEditor = useCallback(() => setEditing(null), []);

  const blocks = program.blocks ?? [];
  const blockOf = (r: Rung) => (r.block && blocks.some((b) => b.id === r.block) ? r.block : '');
  const cols = Math.max(MIN_COLS, ...program.rungs.map((r) => Math.max(0, ...r.branches.map((b) => b.length))));
  const globalIssues = issues.filter((i) => !i.rungId || !program.rungs.some((r) => r.id === i.rungId));
  const issuesOf = useMemo(() => {
    const m = new Map<string, ValidationIssue[]>();
    for (const i of issues) if (i.rungId) m.set(i.rungId, [...(m.get(i.rungId) ?? []), i]);
    return m;
  }, [issues]);
  const selectedIndex = selectedRungId ? program.rungs.findIndex((r) => r.id === selectedRungId) : -1;
  const shownCount = useProgressiveCount(program.rungs.length, progressive ? Math.max(40, selectedIndex + 10) : program.rungs.length);

  // Resolve the popover target from the current program so it never goes stale.
  const editRung = editing ? program.rungs.find((r) => r.id === editing.rungId) : undefined;
  let editorEl: React.ReactNode = null;
  if (editing && editRung && onChange) {
    if (editing.kind === 'element') {
      const el = editRung.branches[editing.branch]?.[editing.index];
      if (el) {
        const { branch, index } = editing;
        editorEl = (
          <ElementEditor
            anchor={editing.anchor}
            target={{ kind: 'element', value: el, onChange: (v: LadderElement) => apply((p) => updateRung(p, editRung.id, (r) => setElement(r, branch, index, v))) }}
            onDelete={() => { apply((p) => updateRung(p, editRung.id, (r) => deleteElement(r, branch, index))); setEditing(null); }}
            onClose={closeEditor}
          />
        );
      }
    } else {
      const o = editRung.outputs[editing.index];
      if (o) {
        const { index } = editing;
        editorEl = (
          <ElementEditor
            anchor={editing.anchor}
            target={{ kind: 'output', value: o, onChange: (v: LadderOutput) => apply((p) => updateRung(p, editRung.id, (r) => setOutput(r, index, v))) }}
            onDelete={() => { apply((p) => updateRung(p, editRung.id, (r) => deleteOutput(r, index))); setEditing(null); }}
            onClose={closeEditor}
          />
        );
      }
    }
  }

  return (
    <MnemonicsContext.Provider value={mnemonics}>
    <div className="h-full overflow-auto bg-white">
      {globalIssues.length > 0 && (
        <div className="sticky left-0 m-2 rounded border border-slate-200 bg-slate-50 px-3 py-2">
          <IssueList issues={globalIssues} />
        </div>
      )}
      <div className="inline-block min-w-full py-2" style={zoom !== 1 ? { zoom } : undefined} data-ladder-width={GUTTER_W + diagramWidth(cols)}>
        {/* top rail cap */}
        <div className="flex">
          <div className="shrink-0" style={{ width: GUTTER_W }} />
          <div className="relative h-3" style={{ width: diagramWidth(cols) }}>
            <div className="absolute inset-y-0 left-0 bg-slate-800" style={{ width: RAIL_W }} />
            <div className="absolute inset-y-0 right-0 bg-slate-800" style={{ width: RAIL_W }} />
          </div>
        </div>
        {program.rungs.slice(0, shownCount).map((rung, i) => (
          <Fragment key={rung.id}>
          {blocks.length > 0 && (i === 0 || blockOf(program.rungs[i - 1]) !== blockOf(rung)) && (
            <div className="flex sticky left-0">
              <div className="shrink-0" style={{ width: GUTTER_W }} />
              <div className="flex items-baseline gap-2 px-3 py-1.5 bg-[#e9edef] border-y border-slate-300" style={{ width: diagramWidth(cols) }}>
                <span className="text-xs font-semibold text-slate-800">{blocks.find((b) => b.id === blockOf(rung))?.name ?? 'General'}</span>
                <span className="text-[11px] text-slate-500 truncate">{blocks.find((b) => b.id === blockOf(rung))?.description ?? 'Rungs without a block'}</span>
              </div>
            </div>
          )}
          <RungRow
            rung={rung}
            index={i}
            number={numberOf ? numberOf(rung.id) : i + 1}
            count={program.rungs.length}
            cols={cols}
            labels={labels}
            change={changes?.get(rung.id) ?? 'unchanged'}
            issues={issuesOf.get(rung.id) ?? NO_ISSUES}
            selected={selectedRungId === rung.id}
            editable={editable}
            editingComment={editingComment === rung.id}
            editing={editing?.rungId === rung.id ? editing : null}
            onSelect={onSelectRung}
            setEditingComment={setEditingComment}
            setEditing={setEditing}
            apply={apply}
          />
          </Fragment>
        ))}
        <div className="flex">
          <div className="shrink-0" style={{ width: GUTTER_W }} />
          <div className="relative" style={{ width: diagramWidth(cols) }}>
            <div className="absolute inset-y-0 left-0 bg-slate-800" style={{ width: RAIL_W }} />
            <div className="absolute inset-y-0 right-0 bg-slate-800" style={{ width: RAIL_W }} />
            <div className="flex items-center gap-2 px-3 py-3">
              {program.rungs.length === 0 && <span className="text-xs italic text-slate-400">No rungs.</span>}
              {editable && (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded border border-dashed border-slate-400 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-sky-500 hover:text-sky-700"
                  onClick={() => apply((p) => ({ ...p, rungs: [...p.rungs, newRung()] }))}
                >
                  <PlusIcon className="h-3.5 w-3.5" /> Add rung
                </button>
              )}
            </div>
          </div>
        </div>
        {/* END rung, as in CLICK / RSLogix */}
        <div className="flex">
          <div className="shrink-0 pr-2 text-right font-mono text-sm font-bold text-slate-400" style={{ width: GUTTER_W }} />
          <div className="relative flex h-8 items-center justify-center" style={{ width: diagramWidth(cols) }}>
            <div className="absolute inset-y-0 left-0 bg-slate-800" style={{ width: RAIL_W }} />
            <div className="absolute inset-y-0 right-0 bg-slate-800" style={{ width: RAIL_W }} />
            <div className="absolute inset-x-0 top-1/2 h-[2px] bg-slate-300" />
            <span className="relative bg-white px-2 font-mono text-[11px] font-bold tracking-widest text-slate-400">END</span>
          </div>
        </div>
      </div>
      {editorEl}
    </div>
    </MnemonicsContext.Provider>
  );
}
