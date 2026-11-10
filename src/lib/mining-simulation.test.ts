import { describe, expect, it } from "vitest";
import {
  SIMULATED_BASE_COINS_PER_HOUR,
  calculateSimulatedMiningCoins,
} from "./mining-simulation";

describe("simulated mining accrual", () => {
  it("accrues the configured base rate over elapsed eligible time", () => {
    expect(calculateSimulatedMiningCoins(3600, 1)).toBeCloseTo(1.78, 12);
    expect(calculateSimulatedMiningCoins(86400, 1)).toBeCloseTo(42.72, 12);
  });

  it("multiplies accrual using qualified referral speed tiers", () => {
    expect(calculateSimulatedMiningCoins(86400, 2)).toBeCloseTo(85.44, 12);
    expect(calculateSimulatedMiningCoins(86400, 5)).toBeCloseTo(213.6, 12);
  });

  it("does not accrue for zero or negative eligible time", () => {
    expect(calculateSimulatedMiningCoins(0, 1)).toBe(0);
    expect(calculateSimulatedMiningCoins(-60, 3)).toBe(0);
  });

  it("uses safe bounds for invalid multipliers and non-finite input", () => {
    expect(calculateSimulatedMiningCoins(3600, Number.NaN)).toBeCloseTo(SIMULATED_BASE_COINS_PER_HOUR, 12);
    expect(calculateSimulatedMiningCoins(Number.POSITIVE_INFINITY, 2)).toBe(0);
  });
});
