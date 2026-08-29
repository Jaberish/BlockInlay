/**
 * A finished board as a solid, and where its faces land as it turns.
 *
 * The moment a board is filled it stops being a puzzle and becomes an object.
 * The squares close up the gaps they were laid out with and fuse into one piece
 * of material: the picture the player made is the front of it, the same picture
 * unlit is its back, and the outline they drew is the wall around the edge. It
 * turns about its own upright centre, forever.
 *
 * Two things follow from that fusing. Only the outline gets a wall — a square
 * with a neighbour has nothing between them any more — and the light has to do
 * the work the gaps used to, which is why there is a light in here at all.
 *
 * The projection is orthographic and the turn is about that one axis, which is
 * what keeps this cheap. Every face stays an upright rectangle at every angle,
 * so the whole solid is a few dozen plain views whose position, width and shade
 * are native-driven transforms — no per-frame redraw, and nothing the phone has
 * to think about while the player reads the banner.
 *
 * Four lines of trigonometry that are quietly wrong is exactly the sort of thing
 * that ships, so nothing here imports React Native and `npm test` holds all of
 * it to the numbers.
 */

import type { Cell } from './levels';

/** how deep the slab is, as a fraction of one square */
export const DEPTH = 0.8;

/**
 * Samples taken around one turn: the driver is linear, and none of this is.
 *
 * The geometry is smooth enough at half this. It is the shine that wants them:
 * a mirror lobe is narrow by nature, and at 72 it crosses a fifth of its range
 * between one sample and the next, so the glint arrives in flat steps instead of
 * swelling. Doubling costs a few hundred numbers, worked out once.
 */
export const TURN_STEPS = 144;

/**
 * Where a point of the solid lands once it has turned.
 *
 * `x` is measured from the turning axis and `z` from the middle of the slab —
 * so the front face is at `z = +depth / 2` and the back at `-depth / 2`. The
 * answer is how far left or right of the axis that point is drawn. Everything
 * below is this one line, applied to a face, a wall, or an edge.
 */
export const turnedX = (x: number, z: number, cos: number, sin: number) => x * cos + z * sin;

/**
 * Where the light comes from: over the player's left shoulder and a little
 * above them.
 *
 * Fixed in the viewer's frame rather than the object's, so a face brightens as
 * it turns into the light and dims as it turns out again. That is what the turn
 * is for — the same picture squashed and unsquashed is a picture being
 * squashed; it only becomes an object once the light moves across it.
 */
const LIGHT = { x: -0.45, y: -0.55, z: 0.7 };
const LIGHT_REACH = Math.hypot(LIGHT.x, LIGHT.y, LIGHT.z);
/**
 * Full light is what a face looking straight back at the player catches, not the
 * most that is theoretically going: the board was laid out flat and facing them,
 * and that is the brightness they have been looking at all level. Measuring from
 * there means the solid starts at exactly the colours the board ended on, and
 * every angle after that is the light coming off it. The reading saturates a
 * little to the upper left, which is a highlight rather than an error.
 */
const HEAD_ON = LIGHT.z / LIGHT_REACH;

/**
 * How much of the light a face is catching, 0 to 1, from the way it is facing.
 * Faces here never tilt, so the normal is two numbers: across, and towards.
 */
export const litBy = (nx: number, nz: number) =>
  Math.min(1, Math.max(0, (nx * LIGHT.x + nz * LIGHT.z) / LIGHT_REACH) / HEAD_ON);

/**
 * How tight the shine is: the higher, the more it is a glint and the less a
 * sheen. It is the one number here chosen by eye rather than derived.
 */
const POLISH = 9;

/** the most shine any face of this solid can catch, since none of them ever tilt */
const SHINE_BEST = Math.hypot(LIGHT.x, LIGHT.z) / LIGHT_REACH;

/**
 * The shine on a face, 0 to 1, from the way it is facing.
 *
 * `litBy` is the light the surface soaks up and throws back everywhere at once,
 * which is why it does not care where the viewer is. This is the other half: the
 * light not soaked up but bounced, which only reaches a viewer standing where
 * the bounce goes. So this is the line of sight mirrored in the face, asked how
 * near it passes the light.
 *
 * A face never tilts here, and the light is over the player's shoulder rather
 * than behind their eye, so the bounce never lands squarely on it — the best any
 * angle can do is `SHINE_BEST`, and that is what full shine is measured against.
 * Anything else and a solid that is doing all it can would still read as matt.
 *
 * Both faces of the slab give the same answer, and so do both of its sides: a
 * mirror is the plane, not the side of it you happen to be standing on.
 */
export const shineBy = (nx: number, nz: number) => {
  // the line of sight, mirrored in the face: 2(n·v)n − v, with v straight at the viewer
  const outX = 2 * nz * nx;
  const outZ = 2 * nz * nz - 1;
  const towards = (outX * LIGHT.x + outZ * LIGHT.z) / LIGHT_REACH;
  return Math.pow(Math.max(0, towards) / SHINE_BEST, POLISH);
};

export type Spin = {
  /** where each sample sits in the turn, 0 to 1 */
  stops: number[];
  /** how wide the mosaic is drawn, as a fraction of its flat width */
  squash: number[];
  /** how far the front face slides off the axis, per unit of depth */
  faceSlide: number[];
  /** how wide a wall opens, as a fraction of the depth */
  wallOpen: number[];
  /** how far a wall slides, per pixel of its own distance from the axis */
  wallSlide: number[];
  /** the light on each of the four faces the solid ever shows */
  frontLit: number[];
  backLit: number[];
  leftLit: number[];
  rightLit: number[];
  /** and the shine, which both faces share, and both sides share */
  faceShine: number[];
  wallShine: number[];
};

/**
 * The whole turn, sampled.
 *
 * The animation driver runs from 0 to 1 in a straight line; these are the curves
 * it is bent through on the way to a transform. Sampling rather than computing
 * per frame is what lets every one of them run on the native driver, and 72
 * samples put the error under a pixel on any board that fits on a phone.
 *
 * The first sample and the last are the same angle, which is what makes the loop
 * seamless — the value the driver ends a lap on is the one it starts the next on.
 */
export const spinOverTurn = (steps: number = TURN_STEPS): Spin => {
  const spin: Spin = {
    stops: [],
    squash: [],
    faceSlide: [],
    wallOpen: [],
    wallSlide: [],
    frontLit: [],
    backLit: [],
    leftLit: [],
    rightLit: [],
    faceShine: [],
    wallShine: [],
  };
  for (let i = 0; i <= steps; i++) {
    const at = i / steps;
    const angle = at * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    spin.stops.push(at);
    // a square a pixel out from the axis ends up here, so the mosaic is drawn
    // that much of its width — negative past a quarter turn, which is the
    // mirrored view of the back, and exactly what you should see from behind
    spin.squash.push(turnedX(1, 0, cos, sin));
    // the front face rides half a depth in front of the axis, and that half
    // depth swings out to the side as the solid turns
    spin.faceSlide.push(turnedX(0, 0.5, cos, sin));
    // a wall is a depth of slab seen end-on: nothing face-on, all of it at a
    // quarter turn, when the solid is showing the player its edge
    spin.wallOpen.push(Math.abs(turnedX(0, 1, cos, sin)));
    // and it is carried sideways by its own distance from the axis, less and
    // less as that distance turns away from the viewer
    spin.wallSlide.push(turnedX(1, 0, cos, sin) - 1);
    // the four faces, each turning its own way into and out of the light
    spin.frontLit.push(litBy(sin, cos));
    spin.backLit.push(litBy(-sin, -cos));
    spin.leftLit.push(litBy(-cos, sin));
    spin.rightLit.push(litBy(cos, -sin));
    // and what they bounce rather than soak up — one reading for the pair of
    // faces and one for the pair of sides, because a mirror is the plane
    spin.faceShine.push(shineBy(sin, cos));
    spin.wallShine.push(shineBy(-cos, sin));
  }
  return spin;
};

/** which side of its squares a wall stands on */
export type Side = 'left' | 'right';

/** the sides of a square that no other square is against */
export type Edges = { top: boolean; right: boolean; bottom: boolean; left: boolean };

/**
 * Every square, told which of its sides are on the outside of the solid.
 *
 * This is what the fusing comes down to. An edge between two squares is inside
 * the material and has nothing to draw; an edge with nothing beyond it is where
 * the solid actually ends, and it is the only place a wall stands or the light
 * catches. Working it out from the squares rather than from the pieces is the
 * point — the pieces stop existing as separate things the moment they fuse.
 */
export const edgesOf = <T extends Cell>(cells: T[]): Array<T & { edges: Edges }> => {
  const filled = new Set(cells.map((c) => `${c.row}:${c.col}`));
  const bare = (row: number, col: number) => !filled.has(`${row}:${col}`);
  return cells.map((c) => ({
    ...c,
    edges: {
      top: bare(c.row - 1, c.col),
      right: bare(c.row, c.col + 1),
      bottom: bare(c.row + 1, c.col),
      left: bare(c.row, c.col - 1),
    },
  }));
};

/** how far a square's wall stands from the turning axis, in pixels */
export const wallEdge = (col: number, side: Side, cell: number, width: number) =>
  col * cell + (side === 'left' ? 0 : cell) - width / 2;

/**
 * The walls of one side, gathered into columns and put in painting order.
 *
 * Only one side of the solid ever faces the viewer, so every wall in a column is
 * the same distance away and the column can be moved as one piece. The order is
 * the part that matters. With the left walls showing, the columns further right
 * are further away; with the right walls showing it is the other way round.
 * Painted the wrong way round the far side of the solid paints over the near
 * side, which reads as the colours scrambling every time the board goes edge-on.
 */
export const wallColumns = <T extends Cell>(cells: T[], side: Side) => {
  const byColumn = new Map<number, T[]>();
  for (const c of cells) {
    const column = byColumn.get(c.col);
    if (column) column.push(c);
    else byColumn.set(c.col, [c]);
  }
  return [...byColumn.entries()]
    .map(([col, group]) => ({ col, cells: group }))
    // furthest from the viewer first
    .sort((a, b) => (side === 'left' ? b.col - a.col : a.col - b.col));
};

/**
 * The furthest any part of the solid gets from the axis over a whole turn.
 *
 * Barely more than the flat board's own half width: the walls only reach out to
 * the side as the mosaic they belong to is drawing in, and the two trade off
 * almost exactly. That is why a turning board can be left in the space the flat
 * one was laid out in, without a hair of room set aside for it.
 */
export const reach = (halfWidth: number, depth: number) => Math.hypot(halfWidth, depth / 2);

/**
 * Consecutive numbers, gathered into the stretches they run in.
 *
 * The one piece of arithmetic behind every continuous thing on the solid: a
 * length of outline, a run of wall. Ten squares in a row are one edge of one
 * object, and drawing them as ten is what put the grid back.
 */
export const stretches = (of: number[]): Array<{ start: number; span: number }> => {
  const runs: Array<{ start: number; span: number }> = [];
  for (const n of [...of].sort((a, b) => a - b)) {
    const last = runs[runs.length - 1];
    if (last && n === last.start + last.span) last.span++;
    else runs.push({ start: n, span: 1 });
  }
  return runs;
};

/**
 * A straight length of the outline: `span` squares of one side, from row/col —
 * and whether either of its ends turns a corner of the object rather than
 * running into more of it.
 *
 * A corner that turns is rounded off, the way the loose pieces are, so anything
 * drawn along the outline has to be rounded off at the same ends and by the same
 * amount or it stands proud of the shape it belongs to.
 */
export type Rim = {
  side: keyof Edges;
  row: number;
  col: number;
  span: number;
  capStart: boolean;
  capEnd: boolean;
};

const SIDES = ['top', 'bottom', 'left', 'right'] as const;

/**
 * The outline of the solid, as the straight lengths it is actually made of.
 *
 * The edge of a solid is lit along its whole length at once, and the way to
 * draw that is one soft band per length. Drawn per square instead, each band
 * has two ends inside the material, and light that leaks around an end lands on
 * the join between two squares that have no join — which is the tiled board,
 * back again, in the one place it was supposed to be gone. So the squares are
 * gathered into runs first, and the light never has an end to leak around
 * except at a real corner of the object.
 */
export const rimRuns = <T extends Cell & { edges: Edges }>(cells: T[]): Rim[] => {
  const runs: Rim[] = [];
  const at = new Map(cells.map((c) => [`${c.row}:${c.col}`, c.edges]));
  for (const side of SIDES) {
    // top and bottom run along a row; left and right run down a column
    const across = side === 'top' || side === 'bottom';
    const lanes = new Map<number, number[]>();
    for (const c of cells) {
      if (!c.edges[side]) continue;
      const lane = across ? c.row : c.col;
      const found = lanes.get(lane);
      if (found) found.push(across ? c.col : c.row);
      else lanes.set(lane, [across ? c.col : c.row]);
    }
    for (const [lane, along] of lanes) {
      for (const { start, span } of stretches(along)) {
        // the run ends where the outline turns if the square at that end is bare
        // on the side the run is heading in as well as on the side it is drawn on
        const first = at.get(across ? `${lane}:${start}` : `${start}:${lane}`)!;
        const last = at.get(across ? `${lane}:${start + span - 1}` : `${start + span - 1}:${lane}`)!;
        const caps = across
          ? { capStart: first.left, capEnd: last.right }
          : { capStart: first.top, capEnd: last.bottom };
        runs.push(
          across
            ? { side, row: lane, col: start, span, ...caps }
            : { side, row: start, col: lane, span, ...caps },
        );
      }
    }
  }
  return runs;
};

/**
 * The solid, row by row, as the unbroken stretches of material in each.
 *
 * The same idea as the outline's runs, one step in: a window onto the material
 * that is wider than a square. Anything drawn in the solid's own frame rather
 * than a square's — a shine that lies across the whole object and slides — needs
 * one of these to be cut to, or it is a square's worth of it at a time and the
 * grid is back.
 */
export const rowRuns = <T extends Cell>(cells: T[]): Array<{ row: number; col: number; span: number }> => {
  const rows = new Map<number, number[]>();
  for (const c of cells) {
    const row = rows.get(c.row);
    if (row) row.push(c.col);
    else rows.set(c.row, [c.col]);
  }
  const runs: Array<{ row: number; col: number; span: number }> = [];
  for (const [row, cols] of rows) {
    for (const { start, span } of stretches(cols)) runs.push({ row, col: start, span });
  }
  return runs;
};

/**
 * Which end of a wall is the one against the face the player is looking at.
 *
 * A wall is drawn as a flat strip a depth wide and then squeezed, so one end of
 * that strip is the front of the slab and the other is the back — and which is
 * which decides which way it has to shade, since a side that darkens towards the
 * viewer instead of away from them reads as a hole rather than a thickness.
 *
 * It is fixed, and that is the whole point of asking. A wall is only ever drawn
 * through the half turn its own side of the solid faces the viewer, and the sine
 * of the angle keeps one sign for the whole of that half — so the answer never
 * changes while anyone can see it, and none of this has to be animated.
 */
export const wallFront = (side: Side): Side => (side === 'left' ? 'right' : 'left');
