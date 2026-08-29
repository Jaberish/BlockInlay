/**
 * The look of the app, and how it changes as you play.
 *
 * Every ten levels the whole app changes colour — background, panels, accent and
 * the nine piece colours all move together, so reaching level 11 looks like
 * arriving somewhere new rather than like the same board in a different hue.
 * Ten levels the whole way: with twenty palettes that means the set comes round
 * again every two hundred levels, which is far enough apart to read as a return
 * rather than as a repeat.
 *
 * A theme is written as a *seed*, not as thirty hex codes. Nearly everything a
 * screen needs — the panel, the text, the dim text, the menu thumbnails — is one
 * base hue at different lightnesses, and the piece palette is a walk around the
 * colour wheel. So a new theme is six numbers and a name, and it cannot come out
 * internally inconsistent the way a hand-picked set of thirty can.
 *
 * This file deliberately imports nothing: `npm test` loads it in plain Node to
 * check every theme is well formed and that the level-to-theme mapping is right.
 */

export type Swatch = { color: string; shade: string };

export type Theme = {
  name: string;
  bg: string;
  panel: string;
  panelEdge: string;
  panelEdgeHot: string;
  socket: string;
  socketEdge: string;
  ghost: string;
  preview: string;
  previewEdge: string;
  text: string;
  textDim: string;
  accent: string;
  /** the accent at low opacity, for an outline that shouldn't shout */
  accentSoft: string;
  /** what to write on top of a filled accent button */
  accentInk: string;
  thumb: string;
  thumbShade: string;
  thumbSolved: string;
  thumbSolvedShade: string;
  /**
   * The colours of the shapes drifting behind everything. Deliberately not the
   * accent: the background is the one place a theme can show a second colour
   * without competing with the pieces, which is what stops a chapter reading as
   * one hue applied to everything.
   */
  drift: string[];
  /** one entry per piece; levels use as many as they have pieces */
  palette: Swatch[];
};

/** the most pieces any level has, so the most colours a palette needs */
export const PIECE_COLOURS = 9;

// ---- colour arithmetic ----

const byte = (n: number) =>
  Math.round(Math.max(0, Math.min(255, n)))
    .toString(16)
    .padStart(2, '0')
    .toUpperCase();

/** hue in degrees, saturation and lightness in percent */
export const hsl = (h: number, s: number, l: number): string => {
  const hue = ((h % 360) + 360) % 360;
  const sat = Math.max(0, Math.min(100, s)) / 100;
  const light = Math.max(0, Math.min(100, l)) / 100;
  const a = sat * Math.min(light, 1 - light);
  const channel = (n: number) => {
    const k = (n + hue / 30) % 12;
    return (light - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255;
  };
  return `#${byte(channel(0))}${byte(channel(8))}${byte(channel(4))}`;
};

const rgbOf = (hex: string) => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

/** the same colour, see-through — for borders that pick up the accent */
export const alpha = (hex: string, a: number) => {
  const [r, g, b] = rgbOf(hex);
  return `rgba(${r},${g},${b},${a})`;
};

/**
 * The same colour with more or less light on it: towards white above zero,
 * towards black below. A piece's two colours describe a block lit from the front
 * — turn that block and its other faces need the same colour under more or less
 * of that light, which is one number away rather than another palette.
 */
export const tone = (hex: string, amount: number): string => {
  const towards = amount > 0 ? 255 : 0;
  const strength = Math.min(1, Math.abs(amount));
  return `#${rgbOf(hex)
    .map((channel) => byte(channel + (towards - channel) * strength))
    .join('')}`;
};

/**
 * The darker face under a block's raised top. Twenty points of lightness down,
 * with a ceiling on saturation — a side face that stays as vivid as the top
 * competes with it, which is what the hand-picked pairs of the first palette
 * were quietly avoiding.
 */
const SHADE_SAT_CAP = 62;
const shadeOf = (h: number, s: number, l: number) => hsl(h, Math.min(s, SHADE_SAT_CAP), l - 20);

const swatch = (h: number, s: number, l: number): Swatch => ({
  color: hsl(h, s, l),
  shade: shadeOf(h, s, l),
});

/** where a palette starts on the wheel, how far round it goes, and how vivid */
type Recipe = { hue: number; spread: number; sat: number; light: number };

/**
 * How far round the finished arc each successive piece jumps. Four ninths of it,
 * which is coprime with nine so every colour is still used exactly once. Handing
 * the colours out in the order they were made would give a three-piece level
 * three neighbouring hues; this way the pieces a player actually sees on an
 * early board are the furthest apart in the set.
 */
const HANDOUT_STRIDE = 4;

const paletteFrom = ({ hue, spread, sat, light }: Recipe): Swatch[] => {
  const arc = Array.from({ length: PIECE_COLOURS }, (_, i) => {
    // lightness and saturation step as well as the hue: on a palette that only
    // covers part of the wheel, neighbouring pieces would otherwise be told
    // apart by hue alone, which is exactly what colour blindness takes away
    const l = light + ((i % 3) - 1) * 5;
    const s = sat - (i % 2) * 8;
    return swatch(hue + (spread * i) / PIECE_COLOURS, s, l);
  });
  return Array.from(
    { length: PIECE_COLOURS },
    (_, i) => arc[(i * HANDOUT_STRIDE) % PIECE_COLOURS],
  );
};

// ---- the themes ----

type Seed = {
  name: string;
  /** the hue every neutral in the theme is tinted with */
  hue: number;
  /** how strongly the neutrals carry that hue */
  chroma: number;
  /** how dark the background sits, in percent lightness */
  depth: number;
  /** the highlight colour: buttons, ticks, the finish banner */
  accent: [hue: number, sat: number, light: number];
  palette: Recipe | Swatch[];
};

const build = ({ name, hue, chroma, depth, accent, palette }: Seed): Theme => {
  const [ah, as, al] = accent;
  const accentColor = hsl(ah, as, al);
  return {
    name,
    bg: hsl(hue, chroma, depth),
    panel: hsl(hue, chroma + 5, depth + 4.7),
    // the see-through whites are the same in every theme on purpose: they are
    // light falling on the surface, and every background here is dark
    panelEdge: 'rgba(255,255,255,0.07)',
    panelEdgeHot: alpha(accentColor, 0.55),
    socket: 'rgba(255,255,255,0.05)',
    socketEdge: 'rgba(255,255,255,0.10)',
    ghost: 'rgba(255,255,255,0.13)',
    preview: 'rgba(255,255,255,0.20)',
    previewEdge: 'rgba(255,255,255,0.55)',
    text: hsl(hue, 100, 97.5),
    textDim: hsl(hue, chroma - 3, 66),
    accent: accentColor,
    accentSoft: alpha(accentColor, 0.45),
    accentInk: hsl(ah, 60, 10),
    thumb: hsl(hue, chroma, 35),
    thumbShade: hsl(hue, chroma + 3, 25),
    thumbSolved: accentColor,
    thumbSolvedShade: shadeOf(ah, as, al),
    // a third of the wheel apart, starting just off the accent — near enough to
    // belong to the chapter, far enough that the drift is a colour of its own
    drift: [25, 145, 265].map((turn, i) => hsl(ah + turn, 62 - i * 6, 58 + i * 4)),
    palette: Array.isArray(palette) ? palette : paletteFrom(palette),
  };
};

/**
 * The first one is the purple the game has always been; the rest rotate. Order
 * matters — a player crosses these boundaries one after another — so warm and
 * cool alternate rather than drifting, and no two neighbours share a base hue.
 */
const SEEDS: Seed[] = [
  {
    name: 'Amethyst',
    hue: 254,
    chroma: 26,
    depth: 9.6,
    accent: [348, 100, 71.6],
    // the original nine, kept by hand: this is the palette the game shipped with
    palette: [
      { color: '#FF6E8A', shade: '#C93F5E' },
      { color: '#FFBA5C', shade: '#C98A2E' },
      { color: '#B9E05F', shade: '#85AB33' },
      { color: '#5FD3A0', shade: '#2E9B72' },
      { color: '#6FA8FF', shade: '#3E72C9' },
      { color: '#C58BFF', shade: '#8B54C9' },
      { color: '#FF8F6B', shade: '#C95E3E' },
      { color: '#4FD8DE', shade: '#2596A8' },
      { color: '#E77BC7', shade: '#B04896' },
    ],
  },
  { name: 'Ember', hue: 20, chroma: 18, depth: 9, accent: [24, 95, 62], palette: { hue: 10, spread: 260, sat: 78, light: 64 } },
  { name: 'Harbour', hue: 212, chroma: 30, depth: 10.5, accent: [190, 90, 62], palette: { hue: 195, spread: 300, sat: 72, light: 65 } },
  { name: 'Saffron', hue: 38, chroma: 24, depth: 8, accent: [45, 95, 60], palette: { hue: 30, spread: 280, sat: 80, light: 65 } },
  { name: 'Fern', hue: 150, chroma: 22, depth: 8, accent: [90, 70, 60], palette: { hue: 80, spread: 300, sat: 64, light: 65 } },
  { name: 'Orchid', hue: 310, chroma: 26, depth: 10, accent: [320, 88, 72], palette: { hue: 300, spread: 340, sat: 74, light: 66 } },
  { name: 'Clay', hue: 12, chroma: 22, depth: 10, accent: [40, 90, 63], palette: { hue: 350, spread: 250, sat: 70, light: 62 } },
  { name: 'Lagoon', hue: 186, chroma: 28, depth: 7.5, accent: [168, 80, 58], palette: { hue: 150, spread: 300, sat: 66, light: 65 } },
  { name: 'Rosewood', hue: 340, chroma: 24, depth: 10, accent: [350, 85, 70], palette: { hue: 330, spread: 260, sat: 68, light: 64 } },
  { name: 'Ink', hue: 225, chroma: 40, depth: 6, accent: [165, 95, 58], palette: { hue: 160, spread: 340, sat: 85, light: 63 } },
  { name: 'Cocoa', hue: 26, chroma: 20, depth: 8, accent: [32, 72, 60], palette: { hue: 20, spread: 240, sat: 62, light: 63 } },
  { name: 'Cobalt', hue: 228, chroma: 36, depth: 10.5, accent: [218, 95, 66], palette: { hue: 210, spread: 320, sat: 76, light: 66 } },
  { name: 'Moss', hue: 95, chroma: 20, depth: 7, accent: [78, 72, 58], palette: { hue: 60, spread: 280, sat: 62, light: 65 } },
  { name: 'Plum', hue: 288, chroma: 30, depth: 9.5, accent: [330, 78, 68], palette: { hue: 285, spread: 300, sat: 68, light: 64 } },
  { name: 'Mint', hue: 162, chroma: 26, depth: 8.5, accent: [150, 75, 62], palette: { hue: 140, spread: 320, sat: 64, light: 68 } },
  { name: 'Coral', hue: 6, chroma: 26, depth: 10.5, accent: [8, 92, 70], palette: { hue: 355, spread: 300, sat: 76, light: 68 } },
  { name: 'Storm', hue: 205, chroma: 14, depth: 11, accent: [210, 85, 68], palette: { hue: 200, spread: 300, sat: 58, light: 66 } },
  { name: 'Aurora', hue: 175, chroma: 32, depth: 7, accent: [128, 80, 62], palette: { hue: 120, spread: 350, sat: 72, light: 66 } },
  { name: 'Slate', hue: 240, chroma: 10, depth: 10.5, accent: [260, 70, 72], palette: { hue: 235, spread: 340, sat: 62, light: 69 } },
  { name: 'Marigold', hue: 48, chroma: 22, depth: 8, accent: [55, 90, 62], palette: { hue: 45, spread: 260, sat: 74, light: 66 } },
];

export const THEMES: Theme[] = SEEDS.map(build);

// ---- which theme a level wears ----

/** levels per chapter, the whole way through */
export const CHAPTER = 10;

/** which chapter a level belongs to, counted from zero and never wrapped */
export const chapterAt = (levelIndex: number): number => Math.floor(Math.max(0, levelIndex) / CHAPTER);

/**
 * Chapters outrun the palettes long before level 5000, so the set recycles —
 * with ten levels to a chapter and twenty palettes, every two hundred levels.
 */
export const themeIndexAt = (levelIndex: number): number => chapterAt(levelIndex) % THEMES.length;

export const themeAt = (levelIndex: number): Theme => THEMES[themeIndexAt(levelIndex)];

/** the purple, for anything drawn before a level is in hand */
export const DEFAULT_THEME = THEMES[0];
