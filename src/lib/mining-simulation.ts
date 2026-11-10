import { getMiningSpeedMultiplier } from "./mining";

export const SIMULATED_BASE_COINS_PER_HOUR = 0.05;
export const SIMULATED_MINING_ASSET = "MINE";

/**
 * Calculates simulated dashboard credits for eligible time.
 * These are in-app reward units, not proof-of-work output or on-chain coins.
 */
export function calculateSimulatedMiningCoins(
  eligibleSeconds: number,
  multiplier: number,
  baseCoinsPerHour = SIMULATED_BASE_COINS_PER_HOUR,
): number {
  if (!Number.isFinite(eligibleSeconds) || eligibleSeconds <= 0) return 0;

  const safeRate = Number.isFinite(baseCoinsPerHour)
    ? Math.max(0, baseCoinsPerHour)
    : SIMULATED_BASE_COINS_PER_HOUR;
  const safeMultiplier = Number.isFinite(multiplier)
    ? Math.max(1, multiplier)
    : 1;

  return (eligibleSeconds / 3600) * safeRate * safeMultiplier;
}

export function getReferralMiningMultiplier(qualifiedReferrals: number): number {
  return getMiningSpeedMultiplier(qualifiedReferrals);
}
