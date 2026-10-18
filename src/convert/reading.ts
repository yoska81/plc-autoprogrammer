/**
 * The machine read for the open project, from any Import tab (Drawings, Program, Cabinet photos). A tab
 * reads its upload its own way and hands the result over with setReading; the shared review below the
 * tabs (src/convert/ReviewAndConvert.tsx) shows it, the user confirms or corrects every reading, and the
 * same conversion and rebuild run. Kept with the project (draft "convert.read").
 */
import { useDraftStore } from '../store/useDraftStore';
import { EMPTY_REVIEW } from './review';
import type { ExistingMachine } from './types';

export const READ_KEY = 'convert.read';
export const REVIEW_KEY = 'convert.review';

export interface Reading {
  machine: ExistingMachine;
  reasoning: string | null;
  /** When it was read (ISO). */
  at: string;
  /** What it was read from: file names, or e.g. "PLC program Line3.L5X". */
  files: string[];
  /** Which tab read it. */
  from?: 'drawings' | 'program' | 'photos';
}

/** Show a new reading in the shared review (the previous review marks are cleared). */
export function setReading(r: Omit<Reading, 'at'> & { at?: string }) {
  const { setDraft } = useDraftStore.getState();
  setDraft(READ_KEY, { ...r, at: r.at ?? new Date().toISOString() });
  setDraft(REVIEW_KEY, EMPTY_REVIEW);
}

/** The reading of the open project, if any. */
export const currentReading = (): Reading | null => (useDraftStore.getState().drafts[READ_KEY] as Reading | undefined) ?? null;
