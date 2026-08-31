/**
 * The confetti thrown when the last board of all five thousand is finished.
 *
 * Kept apart from `Fanfare.tsx` for the same reason the drifting background is
 * kept apart from `Backdrop.tsx`:
 * none of this throws when it is wrong, it just looks wrong — and a burst that
 * only fires once, on one board, at the far end of the game, is not something
 * anyone is going to see go wrong by accident. So it is arithmetic here, held to
 * numbers by `npm test`, and the component only reads it out.
 *
 * Nothing here imports React Native.
 */

import { seedFrom, shuffleInPlace, streamFrom } from './rng';

/** how many flecks are thrown, and how long the whole throw takes */
export const FLECKS = 46;
export const THROW_MS = 2800;

/** where the burst comes from, as a fraction of the screen — the banner, roughly */
export const ORIGIN = { x: 0.5, y: 0.72 };

export type Fleck = {
  /** where it starts, as a fraction of the screen width either side of ORIGIN.x */
  from: number;
  /** how far across it travels over its flight, in screen widths */
  drift: number;
  /** how high it gets, in screen heights, and how far through the flight it peaks */
  peak: number;
  apex: number;
  /** when it launches and how long it flies, both as fractions of the whole throw */
  delay: number;
  life: number;
  /** its side in px, the whole turns it makes, and which palette colour it wears */
  size: number;
  spin: number;
  tint: number;
};

/**
 * One value per fleck per property, evenly spread and independent of each other.
 *
 * A Latin hypercube: each property's range is cut into as many equal bands as
 * there are flecks, every fleck gets exactly one band, and the bands are handed
 * out in a different order for each property. So each property is covered
 * evenly — with only forty-six flecks, a gap on one side of the burst shows —
 * while no property can be read off another.
 *
 * The obvious alternative, one low-discrepancy sequence per property, is the
 * thing this is avoiding. Eight sequences built by stepping through the interval
 * are shifted copies of one another, and shifted copies are correlated: every
 * fleck that flew furthest right would have risen highest too, and the burst
 * would come out combed rather than scattered. Measured, the worst pair of eight
 * such sequences moved together at 0.48; these come in under 0.2.
 */
const FIELDS = 8;

const BANDS: number[][] = (() => {
  const next = streamFrom(seedFrom('block-inlay:confetti'));
  return Array.from({ length: FIELDS }, () =>
    shuffleInPlace(
      Array.from({ length: FLECKS }, (_, i) => (i + 0.5) / FLECKS),
      next,
    ),
  );
})();

const spread = (i: number, field: number) => BANDS[field][i];

/** how many piece colours a palette has, so the flecks can wear all of them */
const TINTS = 9;

export const fleckAt = (i: number): Fleck => {
  const delay = 0.02 + spread(i, 5) * 0.26;
  return {
    // thrown from a narrow band, not a point: a true point source reads as a
    // firework, and this is meant to read as the board itself coming apart
    from: (spread(i, 0) - 0.5) * 0.26,
    drift: (spread(i, 1) - 0.5) * 1.7,
    peak: 0.2 + spread(i, 2) * 0.45,
    // the flattest throw still has to clear the bottom of the screen before its
    // flight is over: a fleck that runs out of time at 0.9 down stops in mid-air
    // and fades where it stopped, which is the one way this can look cheap
    apex: 0.24 + spread(i, 3) * 0.12,
    delay,
    // the one property derived rather than drawn: a fleck launched late has less
    // of the throw left to fly through, so this is capped by `delay` and the two
    // of them move together on purpose
    life: Math.min(0.6 + spread(i, 6) * 0.32, 1 - delay),
    size: 7 + spread(i, 4) * 10,
    spin: (spread(i, 7) - 0.5) * 1440,
    // stepped rather than drawn, so all nine colours come out in equal numbers
    tint: i % TINTS,
  };
};

export const thrown = (): Fleck[] => Array.from({ length: FLECKS }, (_, i) => fleckAt(i));

/**
 * Where a fleck is, in screen fractions, at each of a handful of moments across
 * its flight.
 *
 * Sampled rather than handed over as the two numbers the curve is made of,
 * because `Animated` straightens the line between the points it is given: the
 * arc has to arrive already drawn. Seven points is enough that the corners do
 * not show at the sizes a fleck is drawn at.
 *
 * The curve itself is a thrown object — up fast, over, and down faster — set by
 * how high it gets and how far through the flight it gets there, which are the
 * two things that can be judged by eye. `u` is 0 at launch and 1 at the end.
 */
export const FRAMES = 7;

export const heightAt = (fleck: Fleck, u: number): number => {
  // the launch speed and the pull that together peak at `peak` after `apex`
  const up = (-2 * fleck.peak) / fleck.apex;
  const pull = (2 * fleck.peak) / (fleck.apex * fleck.apex);
  return up * u + (pull * u * u) / 2;
};

export const flightOf = (fleck: Fleck) => {
  const at: number[] = [];
  const across: number[] = [];
  const up: number[] = [];
  for (let i = 0; i < FRAMES; i++) {
    const u = i / (FRAMES - 1);
    // the flight is placed inside the throw, so one clock drives every fleck
    at.push(fleck.delay + u * fleck.life);
    across.push(fleck.drift * u);
    up.push(heightAt(fleck, u));
  }
  return { at, across, up };
};

/**
 * When a fleck is visible: in over the first moment of its flight, out over the
 * last third of it. Given as one interpolation so the component does not have to
 * know that a fleck exists before it is thrown.
 */
export const fadeOf = (fleck: Fleck) => {
  const { delay, life } = fleck;
  return {
    at: [0, delay, delay + life * 0.04, delay + life * 0.66, delay + life],
    opacity: [0, 0, 1, 1, 0],
  };
};
