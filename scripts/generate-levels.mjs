/**
 * Builds the level pack.
 *
 * Every level it emits has been proven to satisfy the same two rules the twelve
 * hand-made levels do (see scripts/verify-levels.mjs):
 *   1. the pieces cover exactly as many cells as the board, and
 *   2. there is exactly ONE way to tile the board with them (no rotation).
 *
 * Boards come from a handful of silhouette families rather than pure noise, so
 * they read as deliberate shapes; pieces are cut by randomised partitioning and
 * kept only if the cut happens to be uniquely solvable AND demands real search.
 *
 * Deterministic: same --seed, same pack. Run with:  npm run generate-levels
 */
import { readFileSync, writeFileSync } from 'node:fs';

// ---------------------------------------------------------------- rng

const mulberry32 = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const makeRng = (seed) => {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const int = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

// ---------------------------------------------------------------- grids

const grid = (rows, cols) => Array.from({ length: rows }, () => new Array(cols).fill(0));
const cellsIn = (g) => g.reduce((n, row) => n + row.reduce((m, v) => m + v, 0), 0);

const trim = (g) => {
  const rows = g.length;
  const cols = g[0].length;
  let top = 0;
  let bottom = rows - 1;
  let left = 0;
  let right = cols - 1;
  const rowEmpty = (r) => g[r].every((v) => !v);
  const colEmpty = (c) => g.every((row) => !row[c]);
  while (top <= bottom && rowEmpty(top)) top++;
  while (bottom >= top && rowEmpty(bottom)) bottom--;
  while (left <= right && colEmpty(left)) left++;
  while (right >= left && colEmpty(right)) right--;
  if (top > bottom) return null;
  return g.slice(top, bottom + 1).map((row) => row.slice(left, right + 1));
};

const pattern = (g) => g.map((row) => row.map((v) => (v ? '#' : '.')).join(''));

const isConnected = (g) => {
  const rows = g.length;
  const cols = g[0].length;
  let start = null;
  let total = 0;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (g[r][c]) {
        total++;
        if (!start) start = [r, c];
      }
  if (!start) return false;
  const seen = new Set([`${start[0]}:${start[1]}`]);
  const queue = [start];
  while (queue.length) {
    const [r, c] = queue.pop();
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nr = r + dr;
      const nc = c + dc;
      const key = `${nr}:${nc}`;
      if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
      if (!g[nr][nc] || seen.has(key)) continue;
      seen.add(key);
      queue.push([nr, nc]);
    }
  }
  return seen.size === total;
};

/** mirror a half-grid (plus an optional centre column) into a vertically symmetric one */
const mirrored = (half, centre) => {
  const rows = half.length;
  const halfCols = half[0].length;
  const cols = halfCols * 2 + (centre ? 1 : 0);
  const g = grid(rows, cols);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < halfCols; c++) {
      if (!half[r][c]) continue;
      g[r][c] = 1;
      g[r][cols - 1 - c] = 1;
    }
    if (centre && centre[r]) g[r][halfCols] = 1;
  }
  return g;
};

/** rows of centred, odd widths — diamonds, spires, cups and the like */
const fromWidths = (widths) => {
  const cols = Math.max(...widths);
  const g = grid(widths.length, cols);
  widths.forEach((w, r) => {
    const start = (cols - w) >> 1;
    for (let c = start; c < start + w; c++) g[r][c] = 1;
  });
  return g;
};

// ---------------------------------------------------------------- silhouettes

/** organic growth on one half of the grid, mirrored — the workhorse */
const bloom = (rng) => {
  const rows = int(rng, 4, 10);
  const halfCols = int(rng, 2, 5);
  const target = int(rng, Math.ceil(rows * halfCols * 0.5), rows * halfCols);
  const half = grid(rows, halfCols);
  // grow from the centre-most column so the two halves always meet
  let r = int(rng, 0, rows - 1);
  let c = halfCols - 1;
  half[r][c] = 1;
  const frontier = [[r, c]];
  let filled = 1;
  const open = (rr, cc) => rr >= 0 && cc >= 0 && rr < rows && cc < halfCols && !half[rr][cc];
  while (filled < target && frontier.length) {
    const i = int(rng, 0, frontier.length - 1);
    const [fr, fc] = frontier[i];
    const options = [[1, 0], [-1, 0], [0, 1], [0, -1]]
      .map(([dr, dc]) => [fr + dr, fc + dc])
      .filter(([nr, nc]) => open(nr, nc));
    if (!options.length) {
      // this cell is boxed in; it can never grow again
      frontier.splice(i, 1);
      continue;
    }
    const [nr, nc] = pick(rng, options);
    half[nr][nc] = 1;
    frontier.push([nr, nc]);
    filled++;
  }
  const centre = rng() < 0.5 ? half.map((row) => row[halfCols - 1]) : null;
  return mirrored(half, centre);
};

/** diamonds and kites: widen to a waist, then taper */
const kite = (rng) => {
  const up = int(rng, 1, 5);
  const down = int(rng, 1, 5);
  const waist = int(rng, 0, 4);
  const step = pick(rng, [1, 1, 2]);
  const widths = [];
  for (let i = 0; i < up; i++) widths.push(1 + 2 * i * step);
  const peak = 1 + 2 * (up - 1) * step;
  for (let i = 0; i < waist; i++) widths.push(peak);
  for (let i = down - 1; i >= 0; i--) widths.push(Math.max(1, 1 + 2 * i * step));
  return fromWidths(widths.map((w) => Math.min(w, 9)));
};

/** a tapering top over a stem — trees, towers, chess pieces */
const spire = (rng) => {
  const tiers = int(rng, 2, 5);
  const stem = int(rng, 1, 5);
  const stemW = pick(rng, [1, 1, 3, 5]);
  const widths = [];
  for (let i = 0; i < tiers; i++) {
    const w = Math.min(9, 1 + 2 * i);
    const repeat = i === tiers - 1 ? int(rng, 1, 2) : 1;
    for (let k = 0; k < repeat; k++) widths.push(w);
  }
  for (let i = 0; i < stem; i++) widths.push(stemW);
  return fromWidths(widths);
};

/** solid body with a doorway cut out of the bottom */
const vault = (rng) => {
  const cols = int(rng, 5, 9) | 1;
  const rows = int(rng, 4, 9);
  const g = grid(rows, cols);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) g[r][c] = 1;
  const doorW = pick(rng, [1, 3]);
  const doorH = int(rng, 1, rows - 2);
  const start = (cols - doorW) >> 1;
  for (let r = rows - doorH; r < rows; r++) for (let c = start; c < start + doorW; c++) g[r][c] = 0;
  // shave the top corners so it reads as an arch rather than a slab
  if (rng() < 0.7) {
    g[0][0] = 0;
    g[0][cols - 1] = 0;
    if (rows > 4 && cols > 5 && rng() < 0.5) {
      g[1][0] = 0;
      g[1][cols - 1] = 0;
    }
  }
  return g;
};

/** a hollow ring */
const lantern = (rng) => {
  const rows = int(rng, 4, 9);
  const cols = int(rng, 4, 9);
  const g = grid(rows, cols);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) g[r][c] = 1;
  const holeR = int(rng, 1, rows - 3);
  const holeC = int(rng, 1, cols - 3);
  const holeH = int(rng, 1, rows - holeR - 2);
  const holeW = int(rng, 1, cols - holeC - 2);
  for (let r = holeR; r < holeR + holeH; r++) for (let c = holeC; c < holeC + holeW; c++) g[r][c] = 0;
  // rings are dense by nature; shaving the corners keeps them from reading as slabs
  if (rng() < 0.75) {
    g[0][0] = 0;
    g[0][cols - 1] = 0;
    g[rows - 1][0] = 0;
    g[rows - 1][cols - 1] = 0;
  }
  return g;
};

/** four-fold symmetry — quarter built, then mirrored both ways */
const rosette = (rng) => {
  const qr = int(rng, 2, 5);
  const qc = int(rng, 2, 5);
  const quarter = grid(qr, qc);
  // grow from the inner corner so the quarters always meet in the middle
  quarter[qr - 1][qc - 1] = 1;
  const frontier = [[qr - 1, qc - 1]];
  const target = int(rng, Math.ceil(qr * qc * 0.55), qr * qc);
  let filled = 1;
  while (filled < target && frontier.length) {
    const i = int(rng, 0, frontier.length - 1);
    const [fr, fc] = frontier[i];
    const options = [[1, 0], [-1, 0], [0, 1], [0, -1]]
      .map(([dr, dc]) => [fr + dr, fc + dc])
      .filter(([nr, nc]) => nr >= 0 && nc >= 0 && nr < qr && nc < qc && !quarter[nr][nc]);
    if (!options.length) {
      frontier.splice(i, 1);
      continue;
    }
    const [nr, nc] = pick(rng, options);
    quarter[nr][nc] = 1;
    frontier.push([nr, nc]);
    filled++;
  }
  const midRow = rng() < 0.5;
  const midCol = rng() < 0.5;
  const rows = qr * 2 + (midRow ? 1 : 0);
  const cols = qc * 2 + (midCol ? 1 : 0);
  const g = grid(rows, cols);
  for (let r = 0; r < qr; r++)
    for (let c = 0; c < qc; c++) {
      if (!quarter[r][c]) continue;
      g[r][c] = 1;
      g[r][cols - 1 - c] = 1;
      g[rows - 1 - r][c] = 1;
      g[rows - 1 - r][cols - 1 - c] = 1;
      if (midRow && r === qr - 1) {
        g[qr][c] = 1;
        g[qr][cols - 1 - c] = 1;
      }
      if (midCol && c === qc - 1) {
        g[r][qc] = 1;
        g[rows - 1 - r][qc] = 1;
      }
      if (midRow && midCol && r === qr - 1 && c === qc - 1) g[qr][qc] = 1;
    }
  return g;
};

/** stacked slabs of alternating width — totems, robots, keys */
const totem = (rng) => {
  const tiers = int(rng, 3, 6);
  const widths = [];
  let last = -1;
  for (let i = 0; i < tiers; i++) {
    let w = pick(rng, [1, 3, 3, 5, 5, 7]);
    if (w === last) w = w === 7 ? 5 : w + 2;
    last = w;
    const h = w === 1 ? int(rng, 1, 2) : int(rng, 1, 2);
    for (let k = 0; k < h; k++) widths.push(w);
  }
  return fromWidths(widths);
};

/** two arms meeting at a point — chevrons, wings, bows */
const crest = (rng) => {
  const rows = int(rng, 3, 8);
  const thick = int(rng, 1, 3);
  const halfCols = rows + thick - 1;
  const half = grid(rows, halfCols);
  for (let r = 0; r < rows; r++)
    for (let t = 0; t < thick; t++) {
      const c = halfCols - 1 - r - t;
      if (c >= 0) half[r][c] = 1;
    }
  // fill the notch under the point so the two arms are joined by a body
  const body = int(rng, 0, 2);
  for (let r = rows - body; r < rows; r++) for (let c = 0; c < halfCols; c++) half[r][c] = 1;
  return mirrored(half, half.map((row) => (row[halfCols - 1] ? 1 : 0)));
};

/** waisted shapes — hourglasses, anvils, bowties */
const anvil = (rng) => {
  const topW = int(rng, 2, 4) * 2 + 1;
  const waistW = pick(rng, [1, 3]);
  const bottomW = int(rng, 2, 4) * 2 + 1;
  const topH = int(rng, 1, 4);
  const waistH = int(rng, 1, 3);
  const bottomH = int(rng, 1, 4);
  const widths = [];
  for (let i = 0; i < topH; i++) widths.push(topW);
  for (let i = 0; i < waistH; i++) widths.push(waistW);
  for (let i = 0; i < bottomH; i++) widths.push(bottomW);
  return fromWidths(widths);
};

/** a plus or a T — bars crossing a stem */
const bracket = (rng) => {
  const rows = int(rng, 4, 8);
  const cols = int(rng, 5, 9) | 1;
  const stemW = pick(rng, [1, 3]);
  const g = grid(rows, cols);
  const stemStart = (cols - stemW) >> 1;
  for (let r = 0; r < rows; r++) for (let c = stemStart; c < stemStart + stemW; c++) g[r][c] = 1;
  const bars = int(rng, 1, 2);
  const used = new Set();
  for (let b = 0; b < bars; b++) {
    let r = int(rng, 0, rows - 1);
    if (used.has(r)) r = (r + 1) % rows;
    used.add(r);
    const barH = int(rng, 1, 2);
    const inset = int(rng, 0, 1);
    for (let rr = r; rr < Math.min(rows, r + barH); rr++)
      for (let c = inset; c < cols - inset; c++) g[rr][c] = 1;
  }
  return g;
};

/** stepped shapes — staircases and terraces */
const ridge = (rng) => {
  const steps = int(rng, 3, 7);
  const stepW = int(rng, 1, 3);
  const stepH = int(rng, 1, 3);
  const rows = steps * stepH;
  const cols = steps * stepW;
  const g = grid(rows, cols);
  const flip = rng() < 0.5;
  for (let s = 0; s < steps; s++) {
    const width = (s + 1) * stepW;
    for (let r = s * stepH; r < (s + 1) * stepH; r++)
      for (let c = 0; c < width; c++) g[r][flip ? cols - 1 - c : c] = 1;
  }
  return g;
};

/** free-form blob, no symmetry — deliberately the odd one out */
const drift = (rng) => {
  const rows = int(rng, 4, 8);
  const cols = int(rng, 4, 8);
  const target = int(rng, Math.ceil(rows * cols * 0.55), Math.floor(rows * cols * 0.9));
  const g = grid(rows, cols);
  let r = int(rng, 0, rows - 1);
  let c = int(rng, 0, cols - 1);
  g[r][c] = 1;
  let filled = 1;
  let guard = 0;
  while (filled < target && guard++ < 4000) {
    const [dr, dc] = pick(rng, [[1, 0], [-1, 0], [0, 1], [0, -1]]);
    const nr = r + dr;
    const nc = c + dc;
    if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
    r = nr;
    c = nc;
    if (!g[r][c]) {
      g[r][c] = 1;
      filled++;
    }
  }
  return g;
};

const FAMILIES = [
  { name: 'Bloom', build: bloom, weight: 22 },
  { name: 'Rosette', build: rosette, weight: 12 },
  { name: 'Kite', build: kite, weight: 8 },
  { name: 'Spire', build: spire, weight: 8 },
  { name: 'Vault', build: vault, weight: 9 },
  { name: 'Lantern', build: lantern, weight: 9 },
  { name: 'Crest', build: crest, weight: 8 },
  { name: 'Anvil', build: anvil, weight: 6 },
  { name: 'Bracket', build: bracket, weight: 7 },
  { name: 'Totem', build: totem, weight: 7 },
  { name: 'Ridge', build: ridge, weight: 5 },
  { name: 'Drift', build: drift, weight: 5 },
];

const FAMILY_BAG = FAMILIES.flatMap((f) => new Array(f.weight).fill(f));

// ---------------------------------------------------------------- board rules

/**
 * Thresholds calibrated against the twelve hand-made boards: every one of them
 * clears these bars, and the shapes they reject are the ones that read as
 * accidents — bare rectangles, rounded slabs, and noisy blobs.
 */
const MIN_CELLS = 18;
const MAX_CELLS = 54;
const MAX_SIDE = 10;
const MIN_DENSITY = 0.45;
const MAX_DENSITY = 0.86;
/** perimeter per cell: a plain rectangle sits near 0.75, every hand-made board is >= 1.0 */
const MIN_PERIMETER_RATIO = 1.0;
/** cells hanging off the shape by a single neighbour — a few are character, many are noise */
const MAX_LONE = 5;
/** distinct row patterns + distinct column patterns; a rectangle scores 2 */
const MIN_VARIETY = 5;

const shapeStats = (g) => {
  const rows = g.length;
  const cols = g[0].length;
  const at = (r, c) => r >= 0 && c >= 0 && r < rows && c < cols && g[r][c] === 1;
  let cells = 0;
  let perimeter = 0;
  let lone = 0;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      if (!at(r, c)) continue;
      cells++;
      let neighbours = 0;
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (at(r + dr, c + dc)) neighbours++;
        else perimeter++;
      }
      if (neighbours <= 1) lone++;
    }
  // a lone empty cell bitten out of the edge reads as damage, not design
  let chips = 0;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      if (at(r, c)) continue;
      let filledNeighbours = 0;
      let emptyNeighbours = 0;
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
        if (at(nr, nc)) filledNeighbours++;
        else emptyNeighbours++;
      }
      if (filledNeighbours >= 3 && emptyNeighbours === 0) chips++;
    }
  const rowKeys = g.map((row) => row.join(''));
  const colKeys = [];
  for (let c = 0; c < cols; c++) colKeys.push(g.map((row) => row[c]).join(''));
  const symV = rowKeys.every((row) => row === [...row].reverse().join(''));
  const symH = rowKeys.join('|') === rowKeys.slice().reverse().join('|');
  const sym180 = rowKeys.join('|') === rowKeys.slice().reverse().map((row) => [...row].reverse().join('')).join('|');
  return {
    cells,
    density: cells / (rows * cols),
    perimeterRatio: perimeter / cells,
    lone,
    variety: new Set(rowKeys).size + new Set(colKeys).size,
    chips,
    symmetric: symV || symH || sym180,
  };
};

const boardOk = (g) => {
  if (g.length > MAX_SIDE || g[0].length > MAX_SIDE) return false;
  if (!isConnected(g)) return false;
  const s = shapeStats(g);
  if (s.cells < MIN_CELLS || s.cells > MAX_CELLS) return false;
  if (s.density < MIN_DENSITY || s.density > MAX_DENSITY) return false;
  if (s.perimeterRatio < MIN_PERIMETER_RATIO) return false;
  if (s.lone > MAX_LONE) return false;
  if (s.variety < MIN_VARIETY) return false;
  if (s.chips > 0) return false;
  // an asymmetric shape has to earn it by being solid and un-frayed, or it just
  // looks like the generator slipped
  if (!s.symmetric && (s.lone > 2 || s.density < 0.55)) return false;
  return true;
};

/**
 * Shave a few cells off a family's output, mirrored so the shape stays
 * deliberate. The narrow families (kites, spires, vaults) have only a few dozen
 * parameter combinations between them; this is what lets them keep contributing
 * once a pack wants thousands of distinct silhouettes rather than hundreds. The
 * board filters still get the last word, so anything this turns into noise is
 * thrown out anyway.
 */
const notch = (g, rng) => {
  if (rng() < 0.4) return g;
  const rows = g.length;
  const cols = g[0].length;
  const bites = int(rng, 1, 3);
  for (let i = 0; i < bites; i++) {
    const r = int(rng, 0, rows - 1);
    const c = int(rng, 0, Math.floor((cols - 1) / 2));
    const mirror = cols - 1 - c;
    if (!g[r][c] || !g[r][mirror]) continue;
    g[r][c] = 0;
    g[r][mirror] = 0;
    if (!isConnected(g)) {
      g[r][c] = 1;
      g[r][mirror] = 1;
    }
  }
  return g;
};

const makeBoard = (rng) => {
  const family = pick(rng, FAMILY_BAG);
  const raw = notch(family.build(rng), rng);
  const g = trim(raw);
  if (!g || !boardOk(g)) return null;
  return { family: family.name, pattern: pattern(g) };
};

// ---------------------------------------------------------------- cutting pieces

const MIN_PIECE = 3;
const MAX_PIECE = 6;
const MAX_PIECE_SIDE = 4;
/** one hue per piece, and nine clearly distinct hues is about the limit */
const MAX_PIECES = 9;

/** carve the board into connected pieces, always starting from the first free cell */
const cutPieces = (boardPattern, rng) => {
  const rows = boardPattern.length;
  const cols = boardPattern[0].length;
  const free = boardPattern.map((line) => [...line].map((ch) => ch === '#'));
  const total = free.flat().filter(Boolean).length;
  const pieces = [];
  let remaining = total;

  const neighbours = (r, c) => [[r + 1, c], [r - 1, c], [r, c + 1], [r, c - 1]];
  const isFree = (r, c) => r >= 0 && c >= 0 && r < rows && c < cols && free[r][c];

  /** the smallest surviving pocket, so we never strand a 1- or 2-cell hole */
  const smallestRegion = () => {
    const seen = new Set();
    let smallest = Infinity;
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        if (!free[r][c] || seen.has(`${r}:${c}`)) continue;
        let size = 0;
        const queue = [[r, c]];
        seen.add(`${r}:${c}`);
        while (queue.length) {
          const [qr, qc] = queue.pop();
          size++;
          for (const [nr, nc] of neighbours(qr, qc)) {
            if (!isFree(nr, nc) || seen.has(`${nr}:${nc}`)) continue;
            seen.add(`${nr}:${nc}`);
            queue.push([nr, nc]);
          }
        }
        smallest = Math.min(smallest, size);
        if (smallest < MIN_PIECE) return smallest;
      }
    return smallest;
  };

  while (remaining > 0) {
    let anchor = null;
    for (let r = 0; r < rows && !anchor; r++)
      for (let c = 0; c < cols && !anchor; c++) if (free[r][c]) anchor = [r, c];

    const sizes = [];
    for (let s = MIN_PIECE; s <= MAX_PIECE; s++) if (s <= remaining) sizes.push(s);
    if (!sizes.length) return null;
    // prefer 4s and 5s: 3s make levels mushy, 6s crowd the tray
    const bag = sizes.flatMap((s) => new Array(s === 4 || s === 5 ? 3 : 1).fill(s));

    let placed = null;
    for (let attempt = 0; attempt < 14 && !placed; attempt++) {
      const size = pick(rng, bag);
      if (remaining - size !== 0 && remaining - size < MIN_PIECE) continue;
      const cells = [anchor];
      free[anchor[0]][anchor[1]] = false;
      const frontier = [anchor];
      while (cells.length < size && frontier.length) {
        const i = int(rng, 0, frontier.length - 1);
        const [fr, fc] = frontier[i];
        const options = neighbours(fr, fc).filter(([nr, nc]) => isFree(nr, nc));
        if (!options.length) {
          frontier.splice(i, 1);
          continue;
        }
        const [nr, nc] = pick(rng, options);
        free[nr][nc] = false;
        cells.push([nr, nc]);
        frontier.push([nr, nc]);
      }
      const minR = Math.min(...cells.map(([r]) => r));
      const maxR = Math.max(...cells.map(([r]) => r));
      const minC = Math.min(...cells.map(([, c]) => c));
      const maxC = Math.max(...cells.map(([, c]) => c));
      const tooWide = maxR - minR + 1 > MAX_PIECE_SIDE || maxC - minC + 1 > MAX_PIECE_SIDE;
      if (cells.length === size && !tooWide && smallestRegion() >= MIN_PIECE) {
        placed = cells;
      } else {
        for (const [r, c] of cells) free[r][c] = true;
      }
    }
    if (!placed) return null;
    pieces.push(placed);
    remaining -= placed.length;
  }

  return pieces.map((cells) => {
    const minR = Math.min(...cells.map(([r]) => r));
    const minC = Math.min(...cells.map(([, c]) => c));
    const rowsN = Math.max(...cells.map(([r]) => r)) - minR + 1;
    const colsN = Math.max(...cells.map(([, c]) => c)) - minC + 1;
    const g = grid(rowsN, colsN);
    for (const [r, c] of cells) g[r - minR][c - minC] = 1;
    return pattern(g);
  });
};

// ---------------------------------------------------------------- solver

const parseCells = (pat) => {
  const out = [];
  pat.forEach((line, r) => [...line].forEach((ch, c) => ch === '#' && out.push([r, c])));
  return out;
};

/**
 * Counts tilings (identical pieces are interchangeable, so this counts board
 * states) and, on the way, how many placements the search had to try — which is
 * the closest cheap stand-in we have for how much thinking a level demands.
 */
const analyse = (boardPattern, piecePatterns, nodeCap = 400000) => {
  const boardCells = parseCells(boardPattern);
  const n = boardCells.length;
  if (n > 60) return null;
  const index = new Map(boardCells.map(([r, c], i) => [`${r}:${c}`, i]));
  const rows = boardPattern.length;
  const cols = boardPattern[0].length;

  const shapes = new Map(); // signature -> { cells, count }
  for (const pat of piecePatterns) {
    const cells = parseCells(pat);
    const sig = pat.join('/');
    const entry = shapes.get(sig);
    if (entry) entry.count++;
    else shapes.set(sig, { cells, count: 1, rows: pat.length, cols: pat[0].length });
  }

  const byCell = Array.from({ length: n }, () => []);
  const shapeList = [...shapes.values()];
  shapeList.forEach((shape, shapeId) => {
    for (let r = 0; r + shape.rows <= rows; r++)
      for (let c = 0; c + shape.cols <= cols; c++) {
        let lo = 0;
        let hi = 0;
        let ok = true;
        const covered = [];
        for (const [dr, dc] of shape.cells) {
          const i = index.get(`${r + dr}:${c + dc}`);
          if (i === undefined) {
            ok = false;
            break;
          }
          covered.push(i);
          if (i < 30) lo |= 1 << i;
          else hi |= 1 << (i - 30);
        }
        if (!ok) continue;
        const spot = { shapeId, lo, hi };
        for (const i of covered) byCell[i].push(spot);
      }
  });

  const counts = shapeList.map((s) => s.count);
  const fullLo = n >= 30 ? 0x3fffffff : (1 << n) - 1;
  const fullHi = n > 30 ? (1 << (n - 30)) - 1 : 0;

  let tilings = 0;
  let nodes = 0;
  let capped = false;

  const search = (occLo, occHi) => {
    if (occLo === fullLo && occHi === fullHi) {
      tilings++;
      return;
    }
    const freeLo = ~occLo & fullLo;
    const freeHi = ~occHi & fullHi;
    const target = freeLo ? 31 - Math.clz32(freeLo & -freeLo) : 30 + (31 - Math.clz32(freeHi & -freeHi));
    for (const spot of byCell[target]) {
      if (counts[spot.shapeId] === 0) continue;
      if ((occLo & spot.lo) !== 0 || (occHi & spot.hi) !== 0) continue;
      if (++nodes > nodeCap) {
        capped = true;
        return;
      }
      counts[spot.shapeId]--;
      search(occLo | spot.lo, occHi | spot.hi);
      counts[spot.shapeId]++;
      if (tilings > 1 || capped) return;
    }
  };
  search(0, 0);
  return capped ? null : { tilings, nodes };
};

// ---------------------------------------------------------------- pack

const canonical = (pat) => pat.join('/');
const flipped = (pat) => pat.map((line) => [...line].reverse().join('')).join('/');

/**
 * Some families are narrowly parameterised and run dry after a few dozen shapes
 * (there are only so many kites); the organic ones are effectively unlimited.
 * Quotas keep the pack from turning into one long run of blobs.
 */
const FAMILY_CAP = {
  Bloom: 0.34,
  Totem: 0.16,
  Rosette: 0.14,
  Lantern: 0.09,
  Bracket: 0.09,
  Drift: 0.07,
  Vault: 0.05,
  Anvil: 0.05,
  Kite: 0.04,
  Spire: 0.03,
  Crest: 0.03,
  Ridge: 0.02,
};

/** grow a pool of proven levels, then choose the pack from it */
const buildPool = ({ target, seed, minNodeRatio, maxPerBoard, effortMultiplier, exclude }) => {
  const rng = makeRng(seed);
  const pool = [];
  const seenBoards = new Map();
  const seenLevels = new Set();
  const stats = { boardTries: 0, cutTries: 0, notUnique: 0, tooForced: 0, capped: 0 };
  const limit = target * effortMultiplier;

  while (pool.length < limit && stats.boardTries < limit * 900) {
    stats.boardTries++;
    const board = makeBoard(rng);
    if (!board) continue;
    const key = canonical(board.pattern);
    const alt = flipped(board.pattern);
    if (exclude && (exclude.has(key) || exclude.has(alt))) continue;
    const used = seenBoards.get(key) ?? seenBoards.get(alt) ?? 0;
    if (used >= maxPerBoard) continue;

    for (let attempt = 0; attempt < 30; attempt++) {
      stats.cutTries++;
      const pieces = cutPieces(board.pattern, rng);
      if (!pieces || pieces.length < 3 || pieces.length > MAX_PIECES) continue;
      const levelKey = `${key}#${pieces.map((p) => p.join('/')).slice().sort().join('|')}`;
      if (seenLevels.has(levelKey)) continue;
      const result = analyse(board.pattern, pieces);
      if (!result) {
        stats.capped++;
        continue;
      }
      if (result.tilings !== 1) {
        stats.notUnique++;
        continue;
      }
      // a level whose every step is forced is a fitting exercise, not a puzzle
      if (result.nodes < pieces.length * minNodeRatio) {
        stats.tooForced++;
        continue;
      }
      seenLevels.add(levelKey);
      seenBoards.set(key, used + 1);
      pool.push({
        family: board.family,
        board: board.pattern,
        pieces,
        cells: parseCells(board.pattern).length,
        nodes: result.nodes,
        silhouette: key,
      });
      break;
    }
  }
  return { pool, stats };
};

/**
 * Picks the pack out of the pool against a designed difficulty ramp.
 *
 * Left alone, random cuts pile up at the easy end — two thirds of everything the
 * generator finds is under 40 search nodes. So instead of skimming the pool we
 * lay out `count` target difficulties on a geometric curve and take the nearest
 * unused candidate to each, which turns a lopsided pool into a steady climb.
 *
 * Two things constrain the pick: no silhouette may appear twice in the pack, and
 * no family may exceed its share, so the ramp can't quietly become 400 blobs.
 */
const selectPack = (pool, count, { rampTop, rampFloor } = {}) => {
  const sorted = pool.slice().sort((a, b) => a.nodes - b.nodes);
  if (sorted.length <= count) return sorted;

  const floor = rampFloor ?? sorted[0].nodes;
  // stop the curve short of the very hardest finds: the last few are freaks and
  // aiming at them would starve the top of the ramp
  const ceiling = rampTop ?? sorted[Math.floor(sorted.length * 0.998)].nodes;
  const caps = new Map(
    Object.entries(FAMILY_CAP).map(([family, share]) => [family, Math.ceil(count * share)]),
  );
  const familyUsed = new Map();
  const silhouettes = new Set();
  const chosen = [];

  const target = (i) =>
    Math.exp(Math.log(floor) + ((Math.log(ceiling) - Math.log(floor)) * i) / (count - 1));

  const usable = (level) => {
    if (level.taken) return false;
    if (silhouettes.has(level.silhouette)) return false;
    const cap = caps.get(level.family) ?? Math.ceil(count * 0.05);
    return (familyUsed.get(level.family) ?? 0) < cap;
  };

  let cursor = 0;
  for (let i = 0; i < count; i++) {
    const want = target(i);
    // sorted is ascending, and so are the targets, so the search start only moves forward
    while (cursor < sorted.length - 1 && sorted[cursor].nodes < want) cursor++;
    let best = null;
    for (let step = 0; step < sorted.length; step++) {
      const up = sorted[cursor + step];
      const down = step === 0 ? null : sorted[cursor - step];
      const upOk = up && usable(up);
      const downOk = down && usable(down);
      if (!upOk && !downOk) {
        if (!up && !down) break;
        continue;
      }
      if (upOk && downOk) best = Math.abs(up.nodes - want) <= Math.abs(down.nodes - want) ? up : down;
      else best = upOk ? up : down;
      break;
    }
    if (!best) break;
    best.taken = true;
    silhouettes.add(best.silhouette);
    familyUsed.set(best.family, (familyUsed.get(best.family) ?? 0) + 1);
    chosen.push(best);
  }

  chosen.sort((a, b) => a.nodes - b.nodes || a.cells - b.cells || a.pieces.length - b.pieces.length);
  return chosen;
};

// ---------------------------------------------------------------- cli

const arg = (flag, fallback) => {
  const i = process.argv.indexOf(flag);
  return i === -1 ? fallback : process.argv[i + 1];
};

const count = Number(arg('--count', 60));
const seed = Number(arg('--seed', 20260828));
const minNodeRatio = Number(arg('--min-node-ratio', 2));
const maxPerBoard = Number(arg('--max-per-board', 2));
const effortMultiplier = Number(arg('--pool', 6));
const out = arg('--out', null);
const preview = process.argv.includes('--preview');

const started = Date.now();
/** silhouettes already spoken for by the hand-drawn chapter */
const excludeFile = arg('--exclude', null);
const exclude = excludeFile
  ? new Set(
      JSON.parse(readFileSync(excludeFile, 'utf8')).flatMap((board) => [
        board.join('/'),
        board.map((row) => [...row].reverse().join('')).join('/'),
      ]),
    )
  : null;

const { pool, stats } = buildPool({ target: count, seed, minNodeRatio, maxPerBoard, effortMultiplier, exclude });
const levels = selectPack(pool, count, {
  rampTop: Number(arg('--ramp-top', 0)) || undefined,
  rampFloor: Number(arg('--ramp-floor', 0)) || undefined,
});
const elapsed = ((Date.now() - started) / 1000).toFixed(1);

const familyCounts = new Map();
levels.forEach((level) => familyCounts.set(level.family, (familyCounts.get(level.family) ?? 0) + 1));

console.log(`pool ${pool.length} candidates -> pack of ${levels.length}/${count} in ${elapsed}s`);
console.log(`  board attempts ${stats.boardTries}, cut attempts ${stats.cutTries}`);
console.log(`  rejected: ${stats.notUnique} not unique, ${stats.tooForced} too forced, ${stats.capped} over node cap`);
console.log(`  families: ${[...familyCounts].sort((a, b) => b[1] - a[1]).map(([f, n]) => `${f} ${n}`).join(', ')}`);
console.log(`  distinct silhouettes: ${new Set(levels.map((l) => l.silhouette)).size}`);

const stat = (xs) => {
  const s = xs.slice().sort((a, b) => a - b);
  return `min ${s[0]}, p25 ${s[Math.floor(s.length * 0.25)]}, median ${s[s.length >> 1]}, p75 ${s[Math.floor(s.length * 0.75)]}, p95 ${s[Math.floor(s.length * 0.95)]}, max ${s[s.length - 1]}`;
};
console.log(`  search nodes: ${stat(levels.map((l) => l.nodes))}`);
console.log(`  board cells:  ${stat(levels.map((l) => l.cells))}`);
console.log(`  pieces:       ${stat(levels.map((l) => l.pieces.length))}`);

if (preview) {
  const step = Math.max(1, Math.floor(levels.length / 24));
  for (let i = 0; i < levels.length; i += step) {
    const l = levels[i];
    console.log(`\n#${i + 1} ${l.family} — ${l.cells} cells, ${l.pieces.length} pieces, ${l.nodes} nodes`);
    console.log(l.board.map((row) => '   ' + row.replace(/#/g, '\u2588').replace(/\./g, '\u00b7')).join('\n'));
    console.log('   pieces: ' + l.pieces.map((p) => p.join(' ')).join('   '));
  }
}

if (out) {
  const lines = levels.map(
    (l) => `${l.nodes}|${l.board.join('/')}|${l.pieces.map((p) => p.join('/')).join(';')}`,
  );
  const file = out.endsWith('.ts')
    ? `/**
 * Machine-written by \`npm run generate-levels\` — do not edit by hand.
 *
 * ${levels.length} generated boards, each proven to have exactly one tiling. Silhouettes
 * come from a dozen shape families (see the generator) and are filtered against
 * thresholds calibrated so every hand-drawn board in handmade.ts clears them.
 *
 * One level per line:  difficulty score | board rows | piece shapes
 * Rows are separated by /, pieces by ;. The score is how many placements a
 * solver has to try to prove the board has a single solution; levels are in
 * ascending order of it.
 */
export const GENERATED = \`\\
${lines.join('\n')}
\`;
`
    : JSON.stringify(lines, null, 0);
  writeFileSync(out, file);
  console.log(`\nwrote ${out} (${levels.length} levels, ${(file.length / 1024).toFixed(0)} KB)`);
}
