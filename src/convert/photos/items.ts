import type { CatalogCategory } from '../../electrical/types';
import type { PhotoDevice, TerminalStrip } from './recognise';

/** One recognised device or terminal strip in the photo review, with the user's corrections. */
export type ReviewStatus = 'pending' | 'confirmed' | 'rejected';

export interface ReviewItem {
  key: string;
  kind: 'device' | 'strip';
  device?: PhotoDevice;
  strip?: TerminalStrip;
  status: ReviewStatus;
  /** The user's corrections. */
  tag?: string;
  partNumber?: string;
  category?: CatalogCategory;
}

export const itemTag = (it: ReviewItem) => (it.tag ?? it.device?.tag ?? it.strip?.tag ?? '').trim();
export const itemPart = (it: ReviewItem) => (it.partNumber ?? it.device?.partNumber ?? '').trim();
export const itemCategory = (it: ReviewItem): CatalogCategory => it.category ?? it.device?.category ?? 'terminal';

