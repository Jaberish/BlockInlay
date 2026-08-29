/**
 * Writes the app icons — every one of them, from the game's own colours.
 *
 * The icon is the game: three squares inlaid into a four-square board, with the
 * fourth left as an empty socket. Drawn with the same arithmetic the pieces are
 * drawn with on screen — a shade under a raised top face, a highlight along the
 * top-left, corners rounded by a fifth of a square — so the thing on the home
 * screen is made of the same blocks as the thing behind it, rather than of a
 * separate drawing that has to be kept in step with the palette by hand.
 *
 * Generated rather than drawn for the reason the grain is: it is reviewable as
 * code, the palette comes from `theme.ts` instead of from a note in a design
 * file, and five sizes of the same picture cannot drift apart.
 *
 * Everything is drawn four times over-size and then averaged down. There is no
 * anti-aliasing here beyond that, and it is not needed: at ×4 a rounded corner
 * lands within a quarter of a pixel of where it should be.
 *
 * Run with:  npm run make-icon
 */

import { THEMES, tone } from '../src/theme.ts';
import { writePng } from './png.mjs';

/** how much bigger everything is drawn before being averaged down */
const SS = 4;

/**
 * The board, and which piece holds each square. A dot is the square left
 * unfilled — the whole idea of the game in the one place there is room for it.
 *
 * Four squares rather than nine: at the size a launcher actually draws this,
 * nine of them are a texture and four are a shape.
 */
const ART = ['ab', 'c.'];

const theme = THEMES[0];
const PIECES = { a: theme.palette[0], b: theme.palette[1], c: theme.palette[2] };

/**
 * Android's adaptive icon promises only the middle 66% will survive whatever
 * shape the launcher masks it into — and a square inside that circle can only
 * be 66/√2 of the canvas across. Rounded corners buy a little of that back, but
 * not enough to matter, so the foreground art is sized to fit the circle and
 * not to fill the square.
 */
const SAFE = 0.47;
/** the plain icon has no mask to survive, so its art can be most of the tile */
const FULL = 0.72;

// ---- a canvas, and the two shapes anything here is made of ----

const canvas = (side) => ({ side, px: new Uint8Array(side * side * 4) });

const rgb = (hex) => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

const blend = (img, x, y, [r, g, b], a) => {
  if (x < 0 || y < 0 || x >= img.side || y >= img.side) return;
  const i = (y * img.side + x) * 4;
  const da = img.px[i + 3] / 255;
  const out = a + da * (1 - a);
  if (out <= 0) return;
  img.px[i] = Math.round((r * a + img.px[i] * da * (1 - a)) / out);
  img.px[i + 1] = Math.round((g * a + img.px[i + 1] * da * (1 - a)) / out);
  img.px[i + 2] = Math.round((b * a + img.px[i + 2] * da * (1 - a)) / out);
  img.px[i + 3] = Math.round(out * 255);
};

/** a point is inside a rounded rectangle if it is within `r` of the inner one */
const inside = (px, py, x, y, w, h, r) => {
  const cx = Math.min(Math.max(px, x + r), x + w - r);
  const cy = Math.min(Math.max(py, y + r), y + h - r);
  return (px - cx) ** 2 + (py - cy) ** 2 <= r * r;
};

const roundedRect = (img, x, y, w, h, r, color, alpha = 1) => {
  const rgbColor = Array.isArray(color) ? color : rgb(color);
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  for (let py = Math.floor(y); py < Math.ceil(y + h); py++) {
    for (let px = Math.floor(x); px < Math.ceil(x + w); px++) {
      if (inside(px + 0.5, py + 0.5, x, y, w, h, radius)) blend(img, px, py, rgbColor, alpha);
    }
  }
};

/** the ×4 drawing, averaged down — colour weighted by alpha, or it darkens edges */
const shrink = (big, side) => {
  const out = canvas(side);
  const n = big.side / side;
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < n; sy++) {
        for (let sx = 0; sx < n; sx++) {
          const i = ((y * n + sy) * big.side + (x * n + sx)) * 4;
          const pa = big.px[i + 3] / 255;
          r += big.px[i] * pa;
          g += big.px[i + 1] * pa;
          b += big.px[i + 2] * pa;
          a += pa;
        }
      }
      const i = (y * side + x) * 4;
      if (a > 0) {
        out.px[i] = Math.round(r / a);
        out.px[i + 1] = Math.round(g / a);
        out.px[i + 2] = Math.round(b / a);
      }
      out.px[i + 3] = Math.round((a / (n * n)) * 255);
    }
  }
  return out;
};

// ---- the picture ----

/** one square of the board, drawn the way Blocks.tsx draws one */
const block = (img, x, y, cell, swatch, mono) => {
  const gap = cell * 0.055;
  const radius = cell * 0.2;
  const lip = cell * 0.14;
  const w = cell - gap * 2;
  if (mono) {
    // a themed icon is a stencil: one colour, and the launcher picks it
    roundedRect(img, x + gap, y + gap, w, w, radius, '#FFFFFF');
    return;
  }
  roundedRect(img, x + gap, y + gap, w, w, radius, swatch.shade);
  roundedRect(img, x + gap, y + gap, w, w - lip, radius, swatch.color);
  roundedRect(img, x + gap + radius * 0.7, y + gap + radius * 0.6, cell * 0.28, cell * 0.075, cell * 0.04, '#FFFFFF', 0.42);
};

/** the square left empty, drawn the way the board draws a socket */
const socket = (img, x, y, cell) => {
  const gap = cell * 0.055;
  const radius = cell * 0.2;
  const w = cell - gap * 2;
  roundedRect(img, x + gap, y + gap, w, w, radius, tone(theme.bg, 0.16));
  const edge = cell * 0.035;
  roundedRect(img, x + gap + edge, y + gap + edge, w - edge * 2, w - edge * 2, radius - edge, tone(theme.bg, 0.05));
};

const draw = (img, artSide, { mono = false } = {}) => {
  const cell = artSide / ART.length;
  const origin = (img.side - artSide) / 2;
  ART.forEach((row, r) => {
    [...row].forEach((ch, c) => {
      const x = origin + c * cell;
      const y = origin + r * cell;
      if (ch === '.') {
        if (!mono) socket(img, x, y, cell);
      } else {
        block(img, x, y, cell, PIECES[ch], mono);
      }
    });
  });
};

/** one finished image: drawn ×4 the size asked for, then averaged down to it */
const render = (side, { background, art, mono }) => {
  const big = canvas(side * SS);
  if (background) roundedRect(big, 0, 0, big.side, big.side, 0, background);
  draw(big, big.side * art, { mono });
  return shrink(big, side);
};

const write = (name, side, options) => {
  const image = render(side, options);
  const bytes = writePng(new URL(`../assets/${name}`, import.meta.url), {
    width: side,
    height: side,
    colorType: 6,
    pixels: Buffer.from(image.px),
  });
  console.log(`assets/${name} — ${side}x${side}, ${(bytes / 1024).toFixed(1)}kB`);
};

// the square icon: iOS, the store listing, and anywhere Android cannot mask
write('icon.png', 1024, { background: theme.bg, art: FULL });
// the three layers of the Android adaptive icon
write('android-icon-foreground.png', 1024, { art: SAFE });
write('android-icon-background.png', 1024, { background: theme.bg, art: 0 });
write('android-icon-monochrome.png', 1024, { art: SAFE, mono: true });
// the browser tab
write('favicon.png', 48, { background: theme.bg, art: FULL });
