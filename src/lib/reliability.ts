/**
 * Show-up reliability (0–100) from finalized events.
 *
 * Laplace-smoothed so a single no-show doesn't zero someone out and newcomers start at 100:
 *   100 × (attended + 1) / (attended + noShows + 1)
 */
export function reliabilityScore(attended: number, noShows: number): number {
  if (attended < 0 || noShows < 0) throw new RangeError("counts must be non-negative");
  return Math.round((100 * (attended + 1)) / (attended + noShows + 1));
}
