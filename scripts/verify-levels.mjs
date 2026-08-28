/**
 * Proves every level is a perfect puzzle:
 *   1. its pieces cover exactly as many cells as its board has, and
 *   2. there is exactly ONE way to tile that board with them (no rotation).
 *
 * Run with:  npm run verify-levels
 */
import { LEVELS, cellKey, pieceCellCount } from '../src/levels.ts';

/** pieces that look identical are interchangeable, so count board states, not permutations */
const signature = (piece) => piece.cells.map((c) => cellKey(c.row, c.col)).join('|');

const legalPlacements = (level, piece) => {
  const out = [];
  for (let row = 0; row <= level.board.rows - piece.rows; row++) {
    for (let col = 0; col <= level.board.cols - piece.cols; col++) {
      const keys = piece.cells.map((c) => cellKey(row + c.row, col + c.col));
      if (keys.every((k) => level.board.keys.has(k))) out.push(new Set(keys));
    }
  }
  return out;
};

const countTilings = (level, limit = 2) => {
  const shapes = new Map(); // signature -> { placements, count }
  for (const piece of level.pieces) {
    const sig = signature(piece);
    const entry = shapes.get(sig);
    if (entry) entry.count++;
    else shapes.set(sig, { placements: legalPlacements(level, piece), count: 1 });
  }
  const cells = level.board.cells;
  const covered = new Set();
  let tilings = 0;

  const search = () => {
    if (tilings >= limit) return;
    if (covered.size === cells.length) {
      tilings++;
      return;
    }
    // always fill the topmost-leftmost empty cell, so each tiling is reached once
    const target = cells.find((c) => !covered.has(cellKey(c.row, c.col)));
    const targetKey = cellKey(target.row, target.col);
    for (const entry of shapes.values()) {
      if (entry.count === 0) continue;
      for (const placement of entry.placements) {
        if (!placement.has(targetKey)) continue;
        let clash = false;
        for (const k of placement) if (covered.has(k)) { clash = true; break; }
        if (clash) continue;
        entry.count--;
        for (const k of placement) covered.add(k);
        search();
        for (const k of placement) covered.delete(k);
        entry.count++;
        if (tilings >= limit) return;
      }
    }
  };
  search();
  return tilings;
};

let failures = 0;
console.log('level         cells  pieces  solutions');
for (const level of LEVELS) {
  const cells = level.board.cells.length;
  const covered = pieceCellCount(level);
  const tilings = countTilings(level);
  const exact = covered === cells;
  const unique = tilings === 1;
  if (!exact || !unique) failures++;
  const note = !exact ? `MISMATCH: pieces cover ${covered}` : !unique ? 'NOT UNIQUE' : '';
  console.log(
    `${(level.index + 1 + '. ' + level.name).padEnd(14)}${String(cells).padStart(4)}` +
      `${String(level.pieces.length).padStart(8)}${String(tilings).padStart(11)}  ${note}`,
  );
}

console.log(
  failures === 0
    ? `\nall ${LEVELS.length} levels are an exact fit with exactly one solution`
    : `\n${failures} LEVEL(S) FAILED`,
);
process.exit(failures === 0 ? 0 : 1);
