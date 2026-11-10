export const MINING_ACTIVITY_WINDOW_MS = 24 * 60 * 60 * 1000;

export function getMiningSpeedMultiplier(qualifiedReferrals: number): number {
  const safeCount = Number.isFinite(qualifiedReferrals)
    ? Math.max(0, Math.floor(qualifiedReferrals))
    : 0;
  return Math.max(1, Math.floor(safeCount / 10) + 1);
}

export function isMiningActivityCurrent(
  eligibleUntil: string | null | undefined,
  now = Date.now(),
): boolean {
  if (!eligibleUntil) return false;
  const expiry = new Date(eligibleUntil).getTime();
  return Number.isFinite(expiry) && expiry > now;
}

export function getMiningActivityLabel(
  activated: boolean,
  eligibleUntil: string | null | undefined,
  now = Date.now(),
): "active" | "paused" | "not_activated" {
  if (!activated) return "not_activated";
  return isMiningActivityCurrent(eligibleUntil, now) ? "active" : "paused";
}
