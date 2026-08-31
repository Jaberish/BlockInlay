/**
 * The app's one source of arranged-in-advance randomness.
 *
 * Two things want it, and both want the same guarantee: the tray a level deals
 * (see `levels.ts`) and the confetti thrown over the last board (`confetti.ts`).
 * Neither may use `Math.random`. A level has to deal the same tray every time it
 * is opened or a player who had learnt where two pieces went would find them
 * moved, and the confetti has to be the same burst every time so that what the
 * tests measure is what the screen does.
 *
 * So: a name goes in, and the same numbers come out, on every device and every
 * run, forever. Nothing here imports React Native.
 */

/**
 * A 32-bit seed from a string.
 *
 * FNV-1a, then murmur3's finaliser over the result. The finaliser is the half
 * that earns its place: the names this is given are short, similar and
 * lowercase — `boat`, `banana`, `crescent` — and FNV alone leaves them near
 * enough to each other that the generator below, whose *first* output is its
 * least mixed, hands all three the same answer.
 */
export const seedFrom = (text: string): number => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193);
  hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b);
  hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35);
  return (hash ^ (hash >>> 16)) | 0;
};

/** numbers in [0, 1) from a seed — mulberry32, which is small and mixes well */
export const streamFrom = (seed: number): (() => number) => {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Fisher-Yates, in place, so the caller keeps hold of what it handed over */
export const shuffleInPlace = <T>(items: T[], next: () => number): T[] => {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
};
