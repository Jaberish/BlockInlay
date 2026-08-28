/**
 * The hint bank's arithmetic, with no React and no storage.
 *
 * Split out because a refill measured against the wall clock is easy to get
 * subtly wrong and the bug only shows up an hour later — or, worse, only after
 * the app has been closed overnight. Here it can be checked directly.
 */

export const MAX_HINTS = 3;
/** one hint back per hour */
export const REFILL_MS = 60 * 60 * 1000;

/**
 * `since` is the moment the current hour started counting, or 0 when the bank is
 * full and nothing is owed. Storing that rather than a countdown is what makes
 * the refill survive the app being closed: what is owed gets worked out from the
 * clock on the way back in, so time passes whether or not anything is running.
 */
export type Bank = { count: number; since: number };

export const FULL_BANK: Bank = { count: MAX_HINTS, since: 0 };

/** bring a bank up to date with the clock */
export const settle = (bank: Bank, now: number): Bank => {
  if (bank.count >= MAX_HINTS) return bank.since === 0 ? bank : { count: MAX_HINTS, since: 0 };
  const earned = Math.floor((now - bank.since) / REFILL_MS);
  if (earned <= 0) return bank;
  const count = Math.min(MAX_HINTS, bank.count + earned);
  // a full bank stops the clock; otherwise the leftover minutes carry forward
  return count >= MAX_HINTS ? { count, since: 0 } : { count, since: bank.since + earned * REFILL_MS };
};

/** take one hint, starting the clock if the bank was full */
export const spend = (bank: Bank, now: number): Bank => {
  if (bank.count <= 0) return bank;
  return { count: bank.count - 1, since: bank.count >= MAX_HINTS ? now : bank.since };
};

/** how far through the current hour, 0..1; a full bank reads as 1 */
export const refillProgress = (bank: Bank, now: number) => {
  if (bank.count >= MAX_HINTS) return 1;
  return Math.min(1, Math.max(0, (now - bank.since) / REFILL_MS));
};
