/**
 * Turning thousands of levels into a scrollable list.
 *
 * Kept apart from the screen because it is the part that can be wrong in a way
 * you would not see: the list places rows arithmetically rather than measuring
 * them, so if these offsets disagree with what the tiles actually render at,
 * jumping to a level lands somewhere else — or on blank space.
 *
 * Rows hold level *indices*, not levels. Building a level parses its board and
 * pieces, and the whole point of the list is that only the handful of tiles on
 * screen ever pay that.
 */

import { LEVEL_COUNT, sectionAt } from './levels';

export const GRID_GAP = 12;
export const TILE_HEIGHT = 178;
export const ROW_HEIGHT = TILE_HEIGHT + GRID_GAP;
export const SECTION_HEIGHT = 46;

export type Row = { kind: 'row'; key: string; levels: number[] };
export type Section = { kind: 'section'; key: string; label: string; count: number };
export type Item = Row | Section;

export type MenuLayout = {
  items: Item[];
  /** which item each level sits in, so a jump can scroll straight to it */
  itemOfLevel: Int32Array;
  /** distance from the top of the list to each item */
  offsets: Float64Array;
  height: number;
};

export const heightOf = (item: Item) => (item.kind === 'section' ? SECTION_HEIGHT : ROW_HEIGHT);

/** how many levels each section holds, counted once rather than once per section */
const SECTION_SIZES = (() => {
  const sizes = new Map<string, number>();
  for (let i = 0; i < LEVEL_COUNT; i++) {
    const key = sectionAt(i);
    sizes.set(key, (sizes.get(key) ?? 0) + 1);
  }
  return sizes;
})();

/** the whole list, chopped into section headings and rows of `columns` tiles */
export const buildMenu = (columns: number): MenuLayout => {
  const items: Item[] = [];
  const itemOfLevel = new Int32Array(LEVEL_COUNT);
  let section: string | null = null;
  let bucket: number[] = [];

  const flushRow = () => {
    if (!bucket.length) return;
    for (const index of bucket) itemOfLevel[index] = items.length;
    items.push({ kind: 'row', key: `r${bucket[0]}`, levels: bucket });
    bucket = [];
  };

  for (let index = 0; index < LEVEL_COUNT; index++) {
    const next = sectionAt(index);
    if (next !== section) {
      flushRow();
      section = next;
      items.push({
        kind: 'section',
        key: `s${section}`,
        label: section,
        count: SECTION_SIZES.get(section) ?? 0,
      });
    }
    bucket.push(index);
    if (bucket.length === columns) flushRow();
  }
  flushRow();

  // running offsets, so the list can place any item without adding up every one
  // before it each time it asks
  const offsets = new Float64Array(items.length);
  let y = 0;
  for (let i = 0; i < items.length; i++) {
    offsets[i] = y;
    y += heightOf(items[i]);
  }
  return { items, itemOfLevel, offsets, height: y };
};

/** the item showing at a given scroll offset — a binary search over the offsets */
export const itemAtOffset = (offsets: Float64Array, offset: number) => {
  let lo = 0;
  let hi = offsets.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (offsets[mid] <= offset) lo = mid;
    else hi = mid - 1;
  }
  return lo;
};

/**
 * Where a drag on the scrollbar should scroll to.
 *
 * `y` is measured from the top of the strip. The thumb is grabbed by its middle
 * rather than its top edge, so dragging to the very bottom reaches the end of
 * the list instead of stopping a thumb's height short of it.
 */
export const scrubOffset = (
  y: number,
  thumbHeight: number,
  travel: number,
  maxScroll: number,
) => {
  const ratio = Math.min(1, Math.max(0, (y - thumbHeight / 2) / travel));
  return ratio * maxScroll;
};
