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
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

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

// greyscale plus alpha: two bytes a pixel, and a row of them behind a filter byte
const raw = Buffer.alloc(SIDE * (SIDE * 2 + 1));
let at = 0;
for (let y = 0; y < SIDE; y++) {
  raw[at++] = 0; // filter: none
  for (let x = 0; x < SIDE; x++) {
    const n = y * 8191 + x * 131;
    // black or white, so the two sides of the average are equally represented
    raw[at++] = wobble(n) < 0.5 ? 0 : 255;
    // and its own strength, so the pixels differ from each other and not only
    // from the colour underneath
    raw[at++] = Math.round(wobble(n + 1) * 255);
  }
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (buf) => {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const chunk = (kind, body) => {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(body.length, 0);
  head.write(kind, 4, 'ascii');
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc(Buffer.concat([head.subarray(4), body])), 0);
  return Buffer.concat([head, body, tail]);
};

const header = Buffer.alloc(13);
header.writeUInt32BE(SIDE, 0);
header.writeUInt32BE(SIDE, 4);
header[8] = 8; // bits per channel
header[9] = 4; // grey + alpha
// the remaining three are compression, filter and interlace, all the only
// method there is

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', header),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

writeFileSync(new URL('../assets/grain.png', import.meta.url), png);
console.log(`assets/grain.png — ${SIDE}x${SIDE}, ${(png.length / 1024).toFixed(1)}kB`);
