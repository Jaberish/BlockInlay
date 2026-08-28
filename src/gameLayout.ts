/**
 * How a level is sized to the screen.
 *
 * Kept apart from the screen for the same reason as the menu's layout: with 1000
 * levels there is no eyeballing this. Levels range from 12 to 46 cells, boards
 * from 4 to 10 columns and pieces from 3 to 9, so "does it fit" has to be a
 * property the tests can check on every level at every phone size, not something
 * that looked fine on the one board that was open at the time.
 */

import type { Level } from './levels';

export const ROOT_PADDING = 18;
export const TRAY_PADDING = 8;
export const SLOT_MARGIN_X = 8;
export const SLOT_MARGIN_Y = 6;
/** header + tray chrome + paddings that the board has to share the screen with */
export const CHROME = 128;

/** the smallest square the tray will shrink a piece to before giving up */
const MIN_TRAY_CELL = 11;
const MAX_TRAY_CELL = 30;
const MAX_TRAY_ROWS = 3;

export type TrayLayout = { cell: number; rows: number; height: number };

/**
 * The largest square size that still wraps every piece of this level into at
 * most three rows. Levels differ in piece count and piece height, so this is
 * measured rather than assumed.
 */
export const trayLayout = (level: Level, width: number, height: number): TrayLayout => {
  const maxWidth = width - ROOT_PADDING * 2 - TRAY_PADDING * 2;
  const maxHeight = Math.max(104, height * 0.28);
  const pack = (size: number) => {
    let rowWidth = 0;
    let rowHeight = 0;
    let total = 0;
    let rows = 1;
    for (const piece of level.pieces) {
      const w = piece.cols * size + SLOT_MARGIN_X * 2;
      const h = piece.rows * size + SLOT_MARGIN_Y * 2;
      if (rowWidth + w > maxWidth && rowWidth > 0) {
        rows++;
        total += rowHeight;
        rowWidth = 0;
        rowHeight = 0;
      }
      rowWidth += w;
      rowHeight = Math.max(rowHeight, h);
    }
    return { rows, height: total + rowHeight };
  };
  for (let size = MAX_TRAY_CELL; size > MIN_TRAY_CELL; size--) {
    const fit = pack(size);
    if (fit.rows <= MAX_TRAY_ROWS && fit.height <= maxHeight) return { cell: size, ...fit };
  }
  return { cell: MIN_TRAY_CELL, ...pack(MIN_TRAY_CELL) };
};

/** the size of one board square, given the space the tray left behind */
export const boardCell = (
  level: Level,
  width: number,
  height: number,
  insets: { top: number; bottom: number },
  tray: TrayLayout,
) => {
  const byWidth = (width - ROOT_PADDING * 2 - 8) / level.board.cols;
  const spare = height - insets.top - insets.bottom - CHROME - tray.height;
  return Math.max(18, Math.min(64, Math.floor(Math.min(byWidth, spare / level.board.rows))));
};
