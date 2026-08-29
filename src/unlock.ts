/**
 * How much of the list a player is shown.
 *
 * Five thousand boards is not an invitation, it is a wall: a list that opens on
 * every one of them says "here is everything you have not done" rather than
 * "here is the next one". So it holds the boards already played, the one they
 * are on, and two more face down — enough to say the list keeps going, few
 * enough that it is still a list of what is in front of them.
 *
 * The arithmetic sits here rather than in the screen because it decides what a
 * player can reach, and an off-by-one hides the board they were about to play.
 * It imports nothing but the level count, so `npm test` can check it directly.
 */

import { LEVEL_COUNT } from './levels';

/** boards listed past the last open one, face down */
export const TEASERS = 2;

/**
 * How many boards can be opened: every one up to the furthest finished, and the
 * one after it. `furthestSolved` is -1 before anything has been solved, which
 * leaves exactly the first board open.
 */
export const openCount = (furthestSolved: number) =>
  Math.max(1, Math.min(LEVEL_COUNT, furthestSolved + 2));

/** how many boards the list holds: the open ones, and the locked teasers after them */
export const shownCount = (furthestSolved: number) =>
  Math.min(LEVEL_COUNT, openCount(furthestSolved) + TEASERS);
