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
import { chapterAt } from './theme';

export const GRID_GAP = 12;
export const TILE_HEIGHT = 178;
export const ROW_HEIGHT = TILE_HEIGHT + GRID_GAP;
export const SECTION_HEIGHT = 46;

export type Row = { kind: 'row'; key: string; levels: number[] };
export type Section = { kind: 'section'; key: string; label: string; count: number };
export type Item = Row | Section;

export type MenuLayout = {
  items: Item[];
  /** which item each level sits in, or -1 for a level the list does not hold */
  itemOfLevel: Int32Array;
  /** distance from the top of the list to each item */
  offsets: Float64Array;
  height: number;
};

export const heightOf = (item: Item) => (item.kind === 'section' ? SECTION_HEIGHT : ROW_HEIGHT);

/**
 * The list, chopped into section headings and rows of `columns` tiles.
 *
 * `shown` is how many levels from the start it holds — the list stops where the
 * player's progress does, so it is nearly always far shorter than the pack. The
 * section counts are counted over that same stretch rather than over the whole
 * pack: a heading saying 200 above three tiles describes a list nobody is
 * looking at.
 */
export const buildMenu = (columns: number, shown: number = LEVEL_COUNT): MenuLayout => {
  const count = Math.max(0, Math.min(LEVEL_COUNT, Math.floor(shown)));
  const sizes = new Map<string, number>();
  for (let i = 0; i < count; i++) {
    const key = sectionAt(i);
    sizes.set(key, (sizes.get(key) ?? 0) + 1);
  }

  const items: Item[] = [];
  // -1 rather than 0: an unlisted level has no item, and a zero would send a
  // jump to the top of the list as though it had found one
  const itemOfLevel = new Int32Array(LEVEL_COUNT).fill(-1);
  let section: string | null = null;
  let bucket: number[] = [];

  const flushRow = () => {
    if (!bucket.length) return;
    for (const index of bucket) itemOfLevel[index] = items.length;
    items.push({ kind: 'row', key: `r${bucket[0]}`, levels: bucket });
    bucket = [];
  };

  for (let index = 0; index < count; index++) {
    const next = sectionAt(index);
    if (next !== section) {
      flushRow();
      section = next;
      items.push({
        kind: 'section',
        key: `s${section}`,
        label: section,
        count: sizes.get(section) ?? 0,
      });
    }
    // A row never spans two chapters. Each tile draws its board in its own
    // chapter's colours, and ten levels do not divide by three: on a wide screen
    // the tenth board would sit in a row beside the eleventh and twelfth wearing
    // the next chapter's colour, which reads as the theme being broken rather
    // than as a boundary. The cost is a short last row per chapter.
    if (index > 0 && chapterAt(index) !== chapterAt(index - 1)) flushRow();
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

/**
 * Whether the strip down the right edge is worth showing.
 *
 * Early on the list is a handful of tiles that fit on the screen, and a thumb
 * filling its whole track is a control saying there is somewhere to go when
 * there is not. A list that does not overflow by at least a row keeps its space
 * instead.
 *
 * `viewHeight` is 0 until a layout has been reported, and an unmeasured list
 * keeps the scrollbar: losing a control to a measurement that has not arrived
 * yet is the worse of the two ways to be wrong here.
 */
export const worthScrubbing = (contentHeight: number, viewHeight: number) =>
  viewHeight <= 0 || contentHeight > viewHeight + ROW_HEIGHT;

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
