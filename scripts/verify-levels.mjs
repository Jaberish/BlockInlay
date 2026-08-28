/**
 * Proves every level is a perfect puzzle:
 *   1. its pieces cover exactly as many cells as its board has,
 *   2. there is exactly ONE way to tile that board with them (no rotation), and
 *   3. the difficulty score recorded in the data is the one the search actually
 *      produces — the labels in the menu are cut from that number, so it is not
 *      allowed to drift away from the puzzle it describes.
 *
 * This is deliberately a plain, slow, Set-of-strings implementation rather than
 * the generator's bitmask solver. It is the independent check on the generator,
 * so it does not share code with it.
 *
 * Run with:  npm run verify-levels
 */
import { LEVEL_COUNT, getLevel, cellKey, pieceCellCount, difficultyOf } from '../src/levels.ts';

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

const solve = (level, limit = 2) => {
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
  let nodes = 0;

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
        nodes++;
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
  return { tilings, nodes };
};

/** drawn boards have names; generated ones are known by their number */
const label = (level) => level.name ?? `Level ${level.index + 1}`;

const started = Date.now();
const failures = [];
const tally = new Map();
const ids = new Set();
const silhouettes = new Map();

for (let index = 0; index < LEVEL_COUNT; index++) {
  const level = getLevel(index);
  const cells = level.board.cells.length;
  const covered = pieceCellCount(level);
  const { tilings, nodes } = solve(level);

  if (covered !== cells) failures.push(`${label(level)}: pieces cover ${covered} of ${cells} cells`);
  else if (tilings !== 1) failures.push(`${label(level)}: ${tilings === 0 ? 'no solution' : 'more than one solution'}`);
  else if (nodes !== level.nodes) failures.push(`${label(level)}: recorded score ${level.nodes}, search says ${nodes}`);
  else if (level.difficulty !== difficultyOf(level.nodes)) failures.push(`${label(level)}: label does not match score`);

  if (ids.has(level.id)) failures.push(`${label(level)}: duplicate id ${level.id}`);
  ids.add(level.id);

  const shape = level.board.pattern.join('/');
  if (silhouettes.has(shape)) failures.push(`${label(level)}: same silhouette as ${silhouettes.get(shape)}`);
  silhouettes.set(shape, label(level));

  tally.set(level.difficulty, (tally.get(level.difficulty) ?? 0) + 1);
}

const every = Array.from({ length: LEVEL_COUNT }, (_, i) => getLevel(i));
const scores = every.map((l) => l.nodes);
const pieces = every.map((l) => l.pieces.length);
const sum = (xs) => xs.reduce((a, b) => a + b, 0);

console.log(`checked ${LEVEL_COUNT} levels in ${((Date.now() - started) / 1000).toFixed(1)}s\n`);
console.log(`  difficulty   ${[...tally].map(([d, n]) => `${d} ${n}`).join(', ')}`);
console.log(`  score        ${scores[0]} .. ${scores[scores.length - 1]}`);
console.log(`  pieces       ${Math.min(...pieces)} .. ${Math.max(...pieces)} (${(sum(pieces) / pieces.length).toFixed(1)} average)`);
console.log(`  board cells  ${Math.min(...every.map((l) => l.board.cells.length))} .. ${Math.max(...every.map((l) => l.board.cells.length))}`);
console.log(`  silhouettes  ${silhouettes.size} distinct`);

if (failures.length) {
  console.log(`\n${failures.length} LEVEL(S) FAILED`);
  failures.slice(0, 20).forEach((f) => console.log(`  ${f}`));
  if (failures.length > 20) console.log(`  ...and ${failures.length - 20} more`);
} else {
  console.log(`\nall ${LEVEL_COUNT} levels are an exact fit with exactly one solution`);
}
process.exit(failures.length === 0 ? 0 : 1);
