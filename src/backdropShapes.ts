/**
 * The shapes that drift behind the app, and the maths that makes their edges
 * soft. Kept apart from the component for the usual reason: none of this throws
 * when it is wrong, it just looks wrong — and "looks wrong" is the one thing a
 * background gets to be for weeks before anyone mentions it.
 *
 * Nothing here imports React Native, so `npm test` can hold it to the numbers.
 */

export type Shape = {
  /** where its centre sits, as a fraction of the screen */
  x: number;
  y: number;
  /** the core's width as a fraction of the screen's longer side */
  size: number;
  /** how squat it is — 1 is round, below 1 is wide */
  aspect: number;
  /** the four corner radii, as fractions of the core's width */
  corners: [number, number, number, number];
  /** the loop it wanders, in fractions of its own size; it must end where it starts */
  path: Array<[number, number]>;
  /** seconds for one lap of that loop */
  period: number;
  /** whole turns it makes over a lap — a whole number, or the loop would jump */
  spin: number;
  /** how much it swells and settles over a lap */
  breathe: number;
  /** which of the theme's drift colours it wears */
  tint: number;
};

/** copies per shape, how far the outermost reaches, and how they bunch up */
export const SHELLS = 9;
const SPREAD = 1.5;
const FALLOFF = 1.8;

/**
 * Each copy is barely there; it is the overlap you actually see. Nine of these
 * compose to about a tenth of the colour at a shape's core, and shapes overlap
 * each other on top of that — anything stronger stops being a background and
 * starts competing with the board.
 */
export const SHELL_ALPHA = 0.011;

/**
 * How much bigger each copy is than the core. Bunched near the core and spread
 * out towards the edge, which puts a brighter middle behind a long faint tail
 * rather than the flat cone that even spacing would give.
 */
export const shellScales = (): number[] =>
  Array.from({ length: SHELLS }, (_, i) => 1 + SPREAD * (i / (SHELLS - 1)) ** FALLOFF);

/** what the stack composes to where every copy overlaps */
export const coreAlpha = () => 1 - (1 - SHELL_ALPHA) ** SHELLS;

/**
 * Six of them, no two alike. Every period is a prime, so no two shapes share a
 * factor: with round numbers they would fall into step every couple of minutes
 * and the whole background would visibly repeat.
 */
export const SHAPES: Shape[] = [
  {
    x: 0.18, y: 0.14, size: 0.34, aspect: 0.86,
    corners: [0.5, 0.38, 0.5, 0.44],
    path: [[0, 0], [0.34, 0.2], [0.18, 0.52], [-0.22, 0.36], [-0.3, 0.08], [0, 0]],
    period: 37, spin: 1, breathe: 0.12, tint: 0,
  },
  {
    x: 0.82, y: 0.26, size: 0.29, aspect: 1.14,
    corners: [0.4, 0.5, 0.36, 0.5],
    path: [[0, 0], [-0.28, 0.3], [-0.06, 0.6], [0.26, 0.34], [0.2, -0.06], [0, 0]],
    period: 47, spin: -1, breathe: 0.16, tint: 1,
  },
  {
    x: 0.5, y: 0.55, size: 0.38, aspect: 0.72,
    corners: [0.5, 0.46, 0.5, 0.34],
    path: [[0, 0], [0.22, -0.24], [0.4, 0.1], [0.08, 0.3], [-0.24, 0.12], [0, 0]],
    period: 41, spin: 1, breathe: 0.1, tint: 2,
  },
  {
    x: 0.12, y: 0.74, size: 0.31, aspect: 1.0,
    corners: [0.36, 0.5, 0.48, 0.5],
    path: [[0, 0], [0.3, -0.18], [0.44, 0.16], [0.14, 0.4], [-0.14, 0.22], [0, 0]],
    period: 43, spin: -1, breathe: 0.14, tint: 1,
  },
  {
    x: 0.88, y: 0.82, size: 0.33, aspect: 0.9,
    corners: [0.5, 0.34, 0.5, 0.46],
    path: [[0, 0], [-0.36, -0.12], [-0.2, -0.44], [0.12, -0.3], [0.22, -0.04], [0, 0]],
    period: 53, spin: 1, breathe: 0.13, tint: 0,
  },
  {
    x: 0.44, y: 1.02, size: 0.36, aspect: 0.8,
    corners: [0.46, 0.5, 0.38, 0.5],
    path: [[0, 0], [-0.3, -0.26], [-0.44, 0.08], [-0.1, 0.24], [0.16, 0.1], [0, 0]],
    period: 59, spin: -1, breathe: 0.11, tint: 2,
  },
];

/** where a shape's centre sits, in screen fractions, at each corner of its loop */
export const wander = (shape: Shape, aspect: number): Array<[number, number]> =>
  shape.path.map(([dx, dy]) => {
    // the path is in fractions of the shape's own size, and the shape is sized
    // off the screen's longer side, so x and y move by different screen fractions
    const long = Math.max(1, aspect);
    return [shape.x + (dx * shape.size * long) / aspect, shape.y + dy * shape.size * long] as [
      number,
      number,
    ];
  });
