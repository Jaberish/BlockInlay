/**
 * Turning 1000 levels into a scrollable list.
 *
 * Kept apart from the screen because it is the part that can be wrong in a way
 * you would not see: the list places rows arithmetically rather than measuring
 * them, so if these offsets disagree with what the tiles actually render at,
 * jumping to a level lands somewhere else — or on blank space.
 */

import { LEVELS, sectionOf, type Level } from './levels';

export const GRID_GAP = 12;
export const TILE_HEIGHT = 178;
export const ROW_HEIGHT = TILE_HEIGHT + GRID_GAP;
export const SECTION_HEIGHT = 46;

export type Row = { kind: 'row'; key: string; levels: Level[] };
export type Section = { kind: 'section'; key: string; label: string; count: number };
export type Item = Row | Section;

export type MenuLayout = {
  items: Item[];
  /** which item each level sits in, so "jump to" can scroll straight to it */
  itemOfLevel: number[];
  /** distance from the top of the list to each item */
  offsets: number[];
  height: number;
};

export const heightOf = (item: Item) => (item.kind === 'section' ? SECTION_HEIGHT : ROW_HEIGHT);

/** how many levels each section holds, counted once rather than once per section */
const SECTION_SIZES = LEVELS.reduce((sizes, level) => {
  const key = sectionOf(level);
  sizes.set(key, (sizes.get(key) ?? 0) + 1);
  return sizes;
}, new Map<string, number>());

/** the whole list, chopped into section headings and rows of `columns` tiles */
export const buildMenu = (columns: number): MenuLayout => {
  const items: Item[] = [];
  const itemOfLevel = new Array<number>(LEVELS.length);
  let section: string | null = null;
  let bucket: Level[] = [];

  const flushRow = () => {
    if (!bucket.length) return;
    bucket.forEach((level) => {
      itemOfLevel[level.index] = items.length;
    });
    items.push({ kind: 'row', key: `r${bucket[0].id}`, levels: bucket });
    bucket = [];
  };

  for (const level of LEVELS) {
    const next = sectionOf(level);
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
    bucket.push(level);
    if (bucket.length === columns) flushRow();
  }
  flushRow();

  // running offsets, so the list can place any item without adding up every one
  // before it each time it asks
  const offsets: number[] = [];
  let y = 0;
  for (const item of items) {
    offsets.push(y);
    y += heightOf(item);
  }
  return { items, itemOfLevel, offsets, height: y };
};
