/**
 * Every level is just data: the board drawn with `#`, and the pieces drawn the
 * same way. Nothing else in the app knows about any particular level — adding
 * one here is all it takes.
 *
 * Two rules hold for every level below, both checked by `npm run verify-level`:
 *   1. the pieces add up to exactly as many cells as the board, so a finished
 *      board is necessarily a perfect fit; and
 *   2. there is exactly ONE way to tile the board with them (pieces never
 *      rotate), so every level is a puzzle rather than a fitting exercise.
 *
 * Levels are ordered by how much backtracking they demand.
 */

export type Cell = { row: number; col: number };

export type Difficulty = 'Warm-up' | 'Easy' | 'Medium' | 'Hard' | 'Expert';

type LevelDef = {
  id: string;
  name: string;
  difficulty: Difficulty;
  board: string[];
  pieces: string[][];
};

const DEFS: LevelDef[] = [
  {
    id: 'crescent',
    name: 'Crescent',
    difficulty: 'Warm-up',
    board: [
      '.###',
      '##..',
      '##..',
      '##..',
      '.###',
    ],
    pieces: [
      ['#.', '##', '#.'],
      ['###', '#..'],
      ['#..', '###'],
    ],
  },
  {
    id: 'butterfly',
    name: 'Butterfly',
    difficulty: 'Warm-up',
    board: [
      '##...##',
      '#######',
      '..###..',
      '#######',
      '##...##',
    ],
    pieces: [
      ['.#.', '###', '.#.'],
      ['##.', '###'],
      ['.##', '###'],
      ['###', '##.'],
      ['###', '.##'],
    ],
  },
  {
    id: 'pine',
    name: 'Pine',
    difficulty: 'Easy',
    board: [
      '..#..',
      '.###.',
      '#####',
      '.###.',
      '#####',
      '..#..',
      '..#..',
    ],
    pieces: [
      ['#', '#', '#', '#', '#'],
      ['##', '.#', '##'],
      ['##', '#.', '##'],
      ['.#.', '###'],
    ],
  },
  {
    id: 'boot',
    name: 'Boot',
    difficulty: 'Easy',
    board: [
      '###..',
      '###..',
      '###..',
      '#####',
      '#####',
    ],
    pieces: [
      ['##', '#.', '#.', '#.'],
      ['#..', '#..', '###'],
      ['#..', '###', '..#'],
      ['###', '..#'],
    ],
  },
  {
    id: 'star',
    name: 'Star',
    difficulty: 'Easy',
    board: [
      '...#...',
      '..###..',
      '#######',
      '.#####.',
      '..###..',
      '.##.##.',
    ],
    pieces: [
      ['..#', '###', '.#.'],
      ['#..', '##.', '.##'],
      ['###', '##.'],
      ['#.', '##', '#.'],
      ['.#', '.#', '##'],
    ],
  },
  {
    id: 'heart',
    name: 'Heart',
    difficulty: 'Medium',
    board: [
      '.##.##.',
      '#######',
      '.#####.',
      '..###..',
      '...#...',
    ],
    pieces: [
      ['.##', '##.'],
      ['..#', '###'],
      ['#.', '##', '#.'],
      ['####'],
      ['###', '.#.'],
    ],
  },
  {
    id: 'ghost',
    name: 'Ghost',
    difficulty: 'Medium',
    board: [
      '.###.',
      '#####',
      '#####',
      '#####',
      '#.#.#',
    ],
    pieces: [
      ['##', '##', '.#'],
      ['#', '#', '#', '#'],
      ['#.', '##', '.#'],
      ['###', '#..'],
      ['###', '..#'],
    ],
  },
  {
    id: 'cat',
    name: 'Cat',
    difficulty: 'Hard',
    board: [
      '#.....#',
      '#######',
      '#######',
      '.#####.',
      '..###..',
    ],
    pieces: [
      ['#.', '##', '#.'],
      ['.#', '##', '.#'],
      ['.#', '##', '#.'],
      ['#.', '#.', '##'],
      ['#.', '##', '.#'],
      ['#..', '###'],
    ],
  },
  {
    id: 'arrow',
    name: 'Arrow',
    difficulty: 'Hard',
    board: [
      '...#...',
      '..###..',
      '.#####.',
      '#######',
      '..###..',
      '..###..',
    ],
    pieces: [
      ['#..', '##.', '.##'],
      ['.#.', '###', '..#'],
      ['.#', '##', '#.'],
      ['#.', '##', '.#'],
      ['.#.', '###'],
    ],
  },
  {
    id: 'diamond',
    name: 'Diamond',
    difficulty: 'Hard',
    board: [
      '..##..',
      '.####.',
      '######',
      '######',
      '.####.',
      '..##..',
    ],
    pieces: [
      ['#.', '##', '.#'],
      ['##', '.#', '.#'],
      ['.#', '##', '#.'],
      ['.#', '.#', '##'],
      ['.##', '##.'],
      ['##', '##'],
    ],
  },
  {
    id: 'crown',
    name: 'Crown',
    difficulty: 'Hard',
    board: [
      '#..#..#',
      '#.###.#',
      '#######',
      '#######',
      '.#####.',
    ],
    pieces: [
      ['.#', '.#', '##', '.#'],
      ['#.', '#.', '##', '.#'],
      ['#.', '##', '##'],
      ['#', '#', '#', '#'],
      ['.#', '##', '#.'],
      ['#.', '#.', '##'],
    ],
  },
  {
    id: 'tower',
    name: 'Tower',
    difficulty: 'Expert',
    board: [
      '...#...',
      '..###..',
      '.#####.',
      '#######',
      '.#####.',
      '.#####.',
    ],
    pieces: [
      ['.#', '##', '.#', '.#'],
      ['#..', '##.', '.##'],
      ['#', '#', '#', '#'],
      ['.#', '##', '.#'],
      ['#.', '#.', '##'],
      ['#.', '##', '.#'],
    ],
  },];

/** one hue per piece; levels use as many as they have pieces */
const PALETTE = [
  { color: '#FF6E8A', shade: '#C93F5E' },
  { color: '#FFBA5C', shade: '#C98A2E' },
  { color: '#B9E05F', shade: '#85AB33' },
  { color: '#5FD3A0', shade: '#2E9B72' },
  { color: '#6FA8FF', shade: '#3E72C9' },
  { color: '#C58BFF', shade: '#8B54C9' },
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

const build = (def: LevelDef, index: number): Level => {
  const cells = parse(def.board);
  return {
    id: def.id,
    name: def.name,
    difficulty: def.difficulty,
    index,
    board: {
      pattern: def.board,
      cells,
      keys: new Set(cells.map((c) => cellKey(c.row, c.col))),
      ...extent(cells),
    },
    pieces: def.pieces.map((pattern, i) => {
      const pieceCells = parse(pattern);
      return {
        id: `${def.id}:${i}`,
        cells: pieceCells,
        ...extent(pieceCells),
        ...PALETTE[i % PALETTE.length],
      };
    }),
  };
};

export const LEVELS: Level[] = DEFS.map(build);

export const levelById = (id: string) => LEVELS.find((level) => level.id === id);

export const pieceCellCount = (level: Level) =>
  level.pieces.reduce((n, p) => n + p.cells.length, 0);
