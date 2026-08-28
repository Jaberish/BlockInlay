/**
 * Rules of the game, checked without a screen:
 *   npm test
 */
import { LEVELS, cellKey, levelById, sectionOf } from '../src/levels.ts';
import { buildMenu, heightOf } from '../src/menuLayout.ts';
import { boardCell, trayLayout, CHROME, ROOT_PADDING } from '../src/gameLayout.ts';
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

// ---- the level list -------------------------------------------------------
// The menu places 1000 tiles by arithmetic rather than by measuring them, so a
// wrong offset here does not throw — it silently scrolls to blank space.

for (const columns of [2, 3]) {
  const { items, itemOfLevel, offsets, height } = buildMenu(columns);

  const listed = items.filter((i) => i.kind === 'row').flatMap((i) => i.levels);
  check(
    `${columns} columns: every level appears exactly once, in order`,
    listed.length === LEVELS.length && listed.every((level, i) => level.index === i),
  );

  check(
    `${columns} columns: no row holds more tiles than there are columns`,
    items.every((item) => item.kind === 'section' || item.levels.length <= columns),
  );

  check(
    `${columns} columns: each section heading is announced once, before its levels`,
    items.filter((i) => i.kind === 'section').length === new Set(LEVELS.map(sectionOf)).size &&
      items.every((item, i) =>
        item.kind === 'section' ||
        item.levels.every((level) => {
          for (let j = i; j >= 0; j--) if (items[j].kind === 'section') return items[j].label === sectionOf(level);
          return false;
        }),
      ),
  );

  check(
    `${columns} columns: section counts match how many levels follow them`,
    items.every((item, i) => {
      if (item.kind !== 'section') return true;
      let n = 0;
      for (let j = i + 1; j < items.length && items[j].kind === 'row'; j++) n += items[j].levels.length;
      return n === item.count;
    }),
  );

  let running = 0;
  check(
    `${columns} columns: offsets are the running height of everything above`,
    items.every((item, i) => {
      const ok = offsets[i] === running;
      running += heightOf(item);
      return ok;
    }) && running === height,
  );

  check(
    `${columns} columns: jumping to a level lands on the item that holds it`,
    LEVELS.every((level) => {
      const item = items[itemOfLevel[level.index]];
      return item.kind === 'row' && item.levels.includes(level);
    }),
  );
}

// ---- fitting a level on a screen ------------------------------------------
// Boards run from 12 to 46 cells and 4 to 10 columns wide, with up to 9 pieces
// in the tray. Every one of them has to fit on the smallest phone we care about
// without the board running off the edge or the tray eating the screen.

const SCREENS = [
  { name: 'small phone', width: 320, height: 568, insets: { top: 20, bottom: 0 } },
  { name: 'phone', width: 390, height: 844, insets: { top: 47, bottom: 34 } },
  { name: 'large phone', width: 430, height: 932, insets: { top: 59, bottom: 34 } },
  { name: 'tablet', width: 820, height: 1180, insets: { top: 24, bottom: 20 } },
  { name: 'landscape phone', width: 844, height: 390, insets: { top: 0, bottom: 21 } },
];

for (const screen of SCREENS) {
  const { width, height, insets } = screen;
  let tooWide = null;
  let tooTall = null;
  let smallestCell = Infinity;
  let deepestTray = 0;

  for (const level of LEVELS) {
    const tray = trayLayout(level, width, height);
    const cell = boardCell(level, width, height, insets, tray);
    const boardWidth = level.board.cols * cell;
    const boardHeight = level.board.rows * cell;
    const across = width - ROOT_PADDING * 2;
    const down = height - insets.top - insets.bottom - CHROME - tray.height;

    if (boardWidth > across) tooWide ??= `${level.name} wants ${boardWidth}px of ${across}px`;
    // 18px is the floor the sizing refuses to go below, so a board can overflow
    // there by design rather than by accident
    if (boardHeight > Math.max(down, 0) && cell > 18) {
      tooTall ??= `${level.name} wants ${boardHeight}px of ${Math.round(down)}px`;
    }
    smallestCell = Math.min(smallestCell, cell);
    deepestTray = Math.max(deepestTray, tray.height);
  }

  check(`${screen.name}: every board fits across the screen`, tooWide === null, tooWide ?? '');
  check(`${screen.name}: every board fits in the space the tray leaves`, tooTall === null, tooTall ?? '');
  check(`${screen.name}: board squares stay big enough to aim at`, smallestCell >= 18, `${smallestCell}px`);
  check(
    `${screen.name}: the tray never takes more than a third of the screen`,
    deepestTray <= height * 0.34,
    `${deepestTray}px of ${height}px`,
  );
}

// the tray shrinks pieces rather than dropping them, so every piece needs a slot
const cramped = LEVELS.find((level) => {
  const tray = trayLayout(level, 320, 568);
  return tray.cell < 11 || tray.rows > 3;
});
check(
  'every level packs its pieces into the tray on a small phone',
  cramped === undefined,
  cramped ? `${cramped.name} with ${cramped.pieces.length} pieces` : '',
);

console.log(failures === 0 ? '\nall checks passed' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
