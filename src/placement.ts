import { cellKey, type Cell, type Level, type Piece } from './levels';

/** where every piece in a level currently is — null means "still in the tray" */
export type Placements = Record<string, Cell | null>;

export const emptyBoard = (level: Level): Placements =>
  level.pieces.reduce<Placements>((acc, p) => {
    acc[p.id] = null;
    return acc;
  }, {});

/** how far (in cells) a piece may sit from a legal spot and still snap into it */
export const SNAP_TOLERANCE = 0.85;

/** every board cell taken by a piece other than `excludeId` */
export const occupiedExcept = (level: Level, placements: Placements, excludeId: string) => {
  const taken = new Set<string>();
  for (const piece of level.pieces) {
    const at = placements[piece.id];
    if (!at || piece.id === excludeId) continue;
    for (const c of piece.cells) taken.add(cellKey(at.row + c.row, at.col + c.col));
  }
  return taken;
};

/** does the piece sit inside the board, on free cells, with its corner at row/col? */
export const fitsAt = (level: Level, piece: Piece, row: number, col: number, taken: Set<string>) =>
  piece.cells.every((c) => {
    const key = cellKey(row + c.row, col + c.col);
    return level.board.keys.has(key) && !taken.has(key);
  });

/**
 * The home a dropped piece should snap into, or null for "send it back to the tray".
 *
 * `row`/`col` are where the piece's top-left corner floats, measured in board cells
 * from the board's top-left corner — so the drop is resolution independent.
 */
export const snapToBoard = (
  level: Level,
  piece: Piece,
  row: number,
  col: number,
  placements: Placements,
): Cell | null => {
  const taken = occupiedExcept(level, placements, piece.id);
  let best: Cell | null = null;
  let bestDistance = Infinity;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const candidateRow = Math.round(row) + dr;
      const candidateCol = Math.round(col) + dc;
      if (!fitsAt(level, piece, candidateRow, candidateCol, taken)) continue;
      const distance = Math.hypot(candidateRow - row, candidateCol - col);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = { row: candidateRow, col: candidateCol };
      }
    }
  }
  return bestDistance <= SNAP_TOLERANCE ? best : null;
};

/** every piece placed means the board is full — the pieces cover it exactly */
export const isSolved = (level: Level, placements: Placements) =>
  level.pieces.every((p) => placements[p.id] != null);
