/**
 * Every level is just data: the board drawn with `#`, and the pieces drawn the
 * same way. Nothing else in the app knows about any particular level.
 *
 * They come from two places:
 *   - handmade.ts — 200 drawn silhouettes that look like something, up front,
 *     each with a name;
 *   - generated.ts — the machine-made boards that follow, written by
 *     `npm run generate-levels`. They have no names: they are deliberate
 *     abstract shapes rather than pictures of things, and a number is a more
 *     honest label for them than an invented word.
 *
 * Two rules hold for every one of them, both re-checked by `npm run verify-levels`:
 *   1. the pieces add up to exactly as many cells as the board, so a finished
 *      board is necessarily a perfect fit; and
 *   2. there is exactly ONE way to tile the board with them (pieces never
 *      rotate), so every level is a puzzle rather than a fitting exercise.
 *
 * Levels are ordered by `nodes` — how many piece placements a solver has to try
 * before it has proved the board has a single solution. It is a rough stand-in
 * for how much thinking a level demands, and the difficulty labels are cut from
 * it, so a level's label follows from the puzzle rather than from where it
 * happens to sit in the list.
 *
 * Only the scores are parsed up front. With thousands of levels, building every
 * board and piece at launch would cost a visible pause for work the player will
 * never look at, so a level is assembled the first time something asks for it.
 */

import { GENERATED } from './generated';
import { HANDMADE } from './handmade';

export type Cell = { row: number; col: number };

export type Difficulty = 'Warm-up' | 'Easy' | 'Medium' | 'Hard' | 'Expert';

export type LevelDef = {
  id: string;
  name: string;
  /** the difficulty score: placements a solver tries to prove the single solution */
  nodes: number;
  board: string[];
  pieces: string[][];
};

/** score thresholds, chosen to spread the levels across the five labels */
const BANDS: Array<[number, Difficulty]> = [
  [30, 'Warm-up'],
  [80, 'Easy'],
  [200, 'Medium'],
  [500, 'Hard'],
  [Infinity, 'Expert'],
];

export const difficultyOf = (nodes: number): Difficulty =>
  BANDS.find(([ceiling]) => nodes < ceiling)![1];

/** one hue per piece; levels use as many as they have pieces */
const PALETTE = [
  { color: '#FF6E8A', shade: '#C93F5E' },
  { color: '#FFBA5C', shade: '#C98A2E' },
  { color: '#B9E05F', shade: '#85AB33' },
  { color: '#5FD3A0', shade: '#2E9B72' },
  { color: '#6FA8FF', shade: '#3E72C9' },
  { color: '#C58BFF', shade: '#8B54C9' },
  { color: '#FF8F6B', shade: '#C95E3E' },
  { color: '#4FD8DE', shade: '#2596A8' },
  { color: '#E77BC7', shade: '#B04896' },
];

export type Piece = {
  id: string;
  cells: Cell[];
  /** bounding box, in cells */
  rows: number;
  cols: number;
  color: string;
  shade: string;
};

export type Level = {
  id: string;
  /** drawn boards have a name; generated ones go by their number */
  name?: string;
  difficulty: Difficulty;
  nodes: number;
  index: number;
  board: {
    pattern: string[];
    cells: Cell[];
    keys: Set<string>;
    rows: number;
    cols: number;
  };
  pieces: Piece[];
};

export const cellKey = (row: number, col: number) => `${row}:${col}`;

const parse = (pattern: string[]): Cell[] => {
  const cells: Cell[] = [];
  pattern.forEach((line, row) => {
    [...line].forEach((ch, col) => {
      if (ch === '#') cells.push({ row, col });
    });
  });
  return cells;
};

const extent = (cells: Cell[]) => ({
  rows: Math.max(...cells.map((c) => c.row)) + 1,
  cols: Math.max(...cells.map((c) => c.col)) + 1,
});

const buildBoard = (pattern: string[]) => {
  const cells = parse(pattern);
  let keys: Set<string> | null = null;
  return {
    pattern,
    cells,
    ...extent(cells),
    /**
     * Built on first use. Only the level being played needs the lookup set, and
     * holding one per level would mean a lot of strings resident for nothing.
     */
    get keys(): Set<string> {
      return (keys ??= new Set(cells.map((c) => cellKey(c.row, c.col))));
    },
  };
};

const GENERATED_LINES = GENERATED.trim().split('\n');

/** the drawn boards run first; the generated ramp starts over gently after them */
export const DRAWN_COUNT = HANDMADE.length;
export const LEVEL_COUNT = DRAWN_COUNT + GENERATED_LINES.length;

/**
 * Every level's score, read up front. It is one number per level, and the menu
 * needs all of them at once to work out where its sections start and end.
 */
const SCORES = new Int32Array(LEVEL_COUNT);
for (let i = 0; i < DRAWN_COUNT; i++) SCORES[i] = HANDMADE[i].nodes;
for (let i = 0; i < GENERATED_LINES.length; i++) {
  const line = GENERATED_LINES[i];
  SCORES[DRAWN_COUNT + i] = Number(line.slice(0, line.indexOf('|')));
}

export const scoreAt = (index: number) => SCORES[index];
export const difficultyAt = (index: number) => difficultyOf(SCORES[index]);
export const nameAt = (index: number) => (index < DRAWN_COUNT ? HANDMADE[index].name : undefined);

/**
 * What the menu groups a level under. The drawn boards are one chapter of their
 * own rather than five difficulty bands, because their ramp is separate from the
 * generated one that follows.
 */
export const sectionAt = (index: number): string =>
  index < DRAWN_COUNT ? 'Drawn boards' : difficultyAt(index);

export const idAt = (index: number) =>
  index < DRAWN_COUNT ? HANDMADE[index].id : `g${index - DRAWN_COUNT + 1}`;

const DRAWN_INDEX = new Map(HANDMADE.map((def, i) => [def.id, i]));

export const indexOfId = (id: string): number => {
  const drawn = DRAWN_INDEX.get(id);
  if (drawn !== undefined) return drawn;
  if (id.charCodeAt(0) !== 103 /* g */) return -1;
  const n = Number(id.slice(1));
  if (!Number.isInteger(n) || n < 1 || n > GENERATED_LINES.length) return -1;
  return DRAWN_COUNT + n - 1;
};

const defAt = (index: number): LevelDef => {
  if (index < DRAWN_COUNT) return HANDMADE[index];
  const [nodes, board, pieces] = GENERATED_LINES[index - DRAWN_COUNT].split('|');
  return {
    id: idAt(index),
    name: '',
    nodes: Number(nodes),
    board: board.split('/'),
    pieces: pieces.split(';').map((piece) => piece.split('/')),
  };
};

const build = (index: number): Level => {
  const def = defAt(index);
  return {
    id: def.id,
    name: index < DRAWN_COUNT ? def.name : undefined,
    difficulty: difficultyOf(def.nodes),
    nodes: def.nodes,
    index,
    board: buildBoard(def.board),
    pieces: def.pieces.map((pattern, i) => {
      const cells = parse(pattern);
      return {
        id: `${def.id}:${i}`,
        cells,
        ...extent(cells),
        ...PALETTE[i % PALETTE.length],
      };
    }),
  };
};

const CACHE: Array<Level | undefined> = new Array(LEVEL_COUNT);

/** the level at this position, assembled on first use and kept */
export const getLevel = (index: number): Level => (CACHE[index] ??= build(index));

export const levelById = (id: string): Level | undefined => {
  const index = indexOfId(id);
  return index < 0 ? undefined : getLevel(index);
};

export const pieceCellCount = (level: Level) =>
  level.pieces.reduce((n, p) => n + p.cells.length, 0);
