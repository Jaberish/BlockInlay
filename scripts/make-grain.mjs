/**
 * Writes assets/grain.png — the grain laid over the finished solid, so that the
 * material is not one hex code repeated across every pixel of it.
 *
 * A tile of pure per-pixel noise: each pixel is either black or white, at its
 * own strength, and it is laid over the colour at a low opacity. Half of them
 * darken and half lighten by about as much, so a patch of it averages back to
 * the colour it was laid on and only the pixels differ — which is the whole
 * point. Anything with structure larger than a pixel would be a pattern, and a
 * pattern in a tile this size would repeat about five times across a board and
 * be seen doing it.
 *
 * Generated rather than downloaded so it is reviewable as code, and written as
 * a file rather than inlined because a tile that is mostly noise does not
 * compress, and eight kilobytes of base64 in a source file is not source.
 *
 * Run with:  npm run make-grain
 */
import { writePng } from './png.mjs';

/** the tile, in pixels — big enough that the repeat is not a texture in itself */
const SIDE = 64;

/**
 * A small deterministic hash, so the grain is the same every time it is built.
 * `Math.random` would give a different asset on every run and every diff of it
 * would be the whole file.
 */
const wobble = (n) => {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// greyscale plus alpha: two bytes a pixel, row after row — the encoder is what
// puts a filter byte in front of each row
const raw = Buffer.alloc(SIDE * SIDE * 2);
let at = 0;
for (let y = 0; y < SIDE; y++) {
  for (let x = 0; x < SIDE; x++) {
    const n = y * 8191 + x * 131;
    // black or white, so the two sides of the average are equally represented
    raw[at++] = wobble(n) < 0.5 ? 0 : 255;
    // and its own strength, so the pixels differ from each other and not only
    // from the colour underneath
    raw[at++] = Math.round(wobble(n + 1) * 255);
  }
}

// grey plus alpha: colour type 4, which is what the two bytes a pixel above are
const bytes = writePng(new URL('../assets/grain.png', import.meta.url), {
  width: SIDE,
  height: SIDE,
  colorType: 4,
  pixels: raw,
});
console.log(`assets/grain.png — ${SIDE}x${SIDE}, ${(bytes / 1024).toFixed(1)}kB`);
