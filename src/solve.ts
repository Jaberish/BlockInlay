/**
 * The one arrangement that fills a board.
 *
 * Every level is built so exactly one exists (see levels.ts), which is what lets
 * a hint be definite rather than a guess: there is no "a" solution to choose
 * between. Boards top out around 50 cells and 9 pieces, so the search finishes
 * in well under a frame — the answer is not worth storing alongside 5000 levels
 * when it can be re-derived the moment someone asks for one.
 */

import { cellKey, type Cell, type Level } from './levels';
import type { Placements } from './placement';

const CACHE = new Map<string, Placements | null>();

const search = (level: Level): Placements | null => {
  const cells = level.board.cells;
  const total = cells.length;
  const covered = new Set<string>();
  const at: Placements = {};
  for (const piece of level.pieces) at[piece.id] = null;
  const used = new Array<boolean>(level.pieces.length).fill(false);

  const step = (): boolean => {
    if (covered.size === total) return true;
    // always fill the topmost-leftmost empty cell, so no arrangement is tried twice
    const target = cells.find((c) => !covered.has(cellKey(c.row, c.col)))!;

    for (let i = 0; i < level.pieces.length; i++) {
      if (used[i]) continue;
      const piece = level.pieces[i];
      for (const anchor of piece.cells) {
        const row = target.row - anchor.row;
        const col = target.col - anchor.col;
        const keys = piece.cells.map((c) => cellKey(row + c.row, col + c.col));
        if (!keys.every((k) => level.board.keys.has(k) && !covered.has(k))) continue;
        used[i] = true;
        at[piece.id] = { row, col };
        for (const k of keys) covered.add(k);
        if (step()) return true;
        for (const k of keys) covered.delete(k);
        at[piece.id] = null;
        used[i] = false;
      }
    }
    return false;
  };

  return step() ? at : null;
};

export const solveLevel = (level: Level): Placements | null => {
  if (!CACHE.has(level.id)) CACHE.set(level.id, search(level));
  return CACHE.get(level.id)!;
};

export type Hint = { pieceId: string; at: Cell };

/**
 * The next piece worth revealing: one that isn't already sitting where it
 * belongs. Untouched pieces come first, so a hint adds to the board rather than
 * silently correcting something the player put down deliberately.
 */
export const nextHint = (level: Level, placements: Placements): Hint | null => {
  const solution = solveLevel(level);
  if (!solution) return null;
  let misplaced: Hint | null = null;
  for (const piece of level.pieces) {
    const home = solution[piece.id];
    if (!home) continue;
    const now = placements[piece.id];
    if (now && now.row === home.row && now.col === home.col) continue;
    if (!now) return { pieceId: piece.id, at: home };
    misplaced ??= { pieceId: piece.id, at: home };
  }
  return misplaced;
};
