/**
 * Rules of the game, checked without a screen:
 *   npm test
 */
import { LEVELS, cellKey, levelById } from '../src/levels.ts';
import { emptyBoard, fitsAt, isSolved, occupiedExcept, snapToBoard } from '../src/placement.ts';

let failures = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};
const at = (spot) => (spot ? `(${spot.row},${spot.col})` : 'null');

// ---- the brief: the heart's tip piece drops into the bottom point of the heart ----
const heart = levelById('heart');
const tip = heart.pieces[4];
check('the heart tip piece is the shape from the brief', tip.rows === 2 && tip.cols === 3 && tip.cells.length === 4);

let hit = snapToBoard(heart, tip, 3, 2, emptyBoard(heart));
check('tip piece lands in the heart tip', hit?.row === 3 && hit?.col === 2, at(hit));

// ---- sloppy drops still snap, wild drops go back to the tray ----
hit = snapToBoard(heart, tip, 3.3, 2.25, emptyBoard(heart));
check('a slightly-off drop snaps home', hit?.row === 3 && hit?.col === 2, at(hit));
hit = snapToBoard(heart, tip, 3.9, 2.9, emptyBoard(heart));
check('a drop in no-mans-land is refused', hit === null, at(hit));
hit = snapToBoard(heart, tip, -2, -2, emptyBoard(heart));
check('a drop off the board is refused', hit === null, at(hit));

// ---- pieces never land on top of each other ----
const busy = emptyBoard(heart);
busy[heart.pieces[3].id] = { row: 2, col: 1 }; // the long piece across the middle
const jay = heart.pieces[1];
hit = snapToBoard(heart, jay, 2, 1, busy);
const overlapped =
  hit != null &&
  jay.cells.some((c) => occupiedExcept(heart, busy, jay.id).has(cellKey(hit.row + c.row, hit.col + c.col)));
check('a piece never lands on an occupied cell', !overlapped, at(hit));

// ---- and now the same rules across every level ----
let drops = 0;
let illegal = 0;
let unplaceable = [];
for (const level of LEVELS) {
  const board = emptyBoard(level);
  // one piece already down, so occupancy is exercised too
  board[level.pieces[0].id] = { row: 0, col: 0 };
  const seated = fitsAt(level, level.pieces[0], 0, 0, new Set());
  if (!seated) board[level.pieces[0].id] = null;

  for (const piece of level.pieces) {
    let anywhere = false;
    for (let row = -2; row <= level.board.rows + 1; row += 0.25) {
      for (let col = -2; col <= level.board.cols + 1; col += 0.25) {
        const spot = snapToBoard(level, piece, row, col, board);
        if (spot == null) continue;
        anywhere = true;
        drops++;
        if (!fitsAt(level, piece, spot.row, spot.col, occupiedExcept(level, board, piece.id))) illegal++;
      }
    }
    if (!anywhere) unplaceable.push(`${level.name}/${piece.id}`);
  }
}
check(`every snap result is legal, all ${LEVELS.length} levels (${drops} drops tested)`, illegal === 0, `${illegal} illegal`);
check('every piece can be dropped somewhere', unplaceable.length === 0, unplaceable.join(', '));

// ---- each level's own solution is reachable and recognised ----
for (const level of LEVELS) {
  // rebuild the solution by placing pieces greedily into the one legal tiling
  const board = emptyBoard(level);
  let placed = 0;
  const solve = (i) => {
    if (i === level.pieces.length) return true;
    const piece = level.pieces[i];
    const taken = occupiedExcept(level, board, piece.id);
    for (let row = 0; row <= level.board.rows - piece.rows; row++) {
      for (let col = 0; col <= level.board.cols - piece.cols; col++) {
        if (!fitsAt(level, piece, row, col, taken)) continue;
        board[piece.id] = { row, col };
        if (solve(i + 1)) return true;
        board[piece.id] = null;
      }
    }
    return false;
  };
  const ok = solve(0);
  placed = level.pieces.filter((p) => board[p.id]).length;
  const cells = new Set();
  for (const piece of level.pieces) {
    const spot = board[piece.id];
    if (!spot) continue;
    for (const c of piece.cells) cells.add(cellKey(spot.row + c.row, spot.col + c.col));
  }
  check(
    `${level.name}: solution fills the board exactly and reads as solved`,
    ok && placed === level.pieces.length && cells.size === level.board.cells.length && isSolved(level, board),
  );
}

check('a fresh board is not solved', LEVELS.every((l) => !isSolved(l, emptyBoard(l))));

console.log(failures === 0 ? '\nall checks passed' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
