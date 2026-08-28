/**
 * Every level is just data: the board drawn with `#`, and the pieces drawn the
 * same way. Nothing else in the app knows about any particular level.
 *
 * There are 1000 of them, from two sources:
 *   - handmade.ts — 50 drawn silhouettes that look like something, up front;
 *   - generated.ts — 950 machine-made boards, written by `npm run generate-levels`.
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

/** score thresholds, chosen to spread the 1000 levels across the five labels */
const BANDS: Array<[number, Difficulty]> = [
  [25, 'Warm-up'],
  [60, 'Easy'],
  [150, 'Medium'],
  [330, 'Hard'],
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
  name: string;
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
     * holding one per level would mean 30,000 strings resident for nothing.
     */
    get keys(): Set<string> {
      return (keys ??= new Set(cells.map((c) => cellKey(c.row, c.col))));
    },
  };
};

const build = (def: LevelDef, index: number): Level => ({
  id: def.id,
  name: def.name,
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
});

/** `Bloom 12` -> `bloom-12`, so a level keeps its saved progress across rebuilds */
const slug = (name: string) => name.toLowerCase().replace(/\s+/g, '-');

const decode = (line: string): LevelDef => {
  const [name, nodes, board, pieces] = line.split('|');
  return {
    id: slug(name),
    name,
    nodes: Number(nodes),
    board: board.split('/'),
    pieces: pieces.split(';').map((piece) => piece.split('/')),
  };
};

const DEFS: LevelDef[] = [...HANDMADE, ...GENERATED.trim().split('\n').map(decode)];

export const LEVELS: Level[] = DEFS.map(build);

/** the drawn boards run first; the generated ramp starts over gently after them */
export const DRAWN_COUNT = HANDMADE.length;

/**
 * What the menu groups a level under. The drawn boards are one chapter of their
 * own rather than five difficulty bands, because their difficulty ramp is
 * separate from the generated one that follows.
 */
export const sectionOf = (level: Level) =>
  level.index < DRAWN_COUNT ? 'Drawn boards' : level.difficulty;

const BY_ID = new Map(LEVELS.map((level) => [level.id, level]));

export const levelById = (id: string) => BY_ID.get(id);

export const pieceCellCount = (level: Level) =>
  level.pieces.reduce((n, p) => n + p.cells.length, 0);
