import { describe, expect, it } from "vitest";
import {
  getMiningActivityLabel,
  getMiningSpeedMultiplier,
  isMiningActivityCurrent,
} from "./mining";

describe("mining activity rules", () => {
  it("keeps the base multiplier until ten qualified referrals", () => {
    expect(getMiningSpeedMultiplier(0)).toBe(1);
    expect(getMiningSpeedMultiplier(9)).toBe(1);
  });

  it("increases the multiplier once per ten qualified referrals", () => {
    expect(getMiningSpeedMultiplier(10)).toBe(2);
    expect(getMiningSpeedMultiplier(19)).toBe(2);
    expect(getMiningSpeedMultiplier(20)).toBe(3);
    expect(getMiningSpeedMultiplier(40)).toBe(5);
  });

  it("does not allow negative or invalid referral counts to increase speed", () => {
    expect(getMiningSpeedMultiplier(-5)).toBe(1);
    expect(getMiningSpeedMultiplier(Number.NaN)).toBe(1);
  });

  it("treats the 24-hour eligibility boundary as expired", () => {
    const now = Date.parse("2026-11-10T09:00:00.000Z");
    expect(isMiningActivityCurrent("2026-11-10T09:00:01.000Z", now)).toBe(true);
    expect(isMiningActivityCurrent("2026-11-10T09:00:00.000Z", now)).toBe(false);
    expect(isMiningActivityCurrent("2026-11-10T08:59:59.000Z", now)).toBe(false);
  });

  it("distinguishes users who have not activated mining", () => {
    expect(getMiningActivityLabel(false, "2026-11-11T09:00:00.000Z")).toBe("not_activated");
    expect(getMiningActivityLabel(true, null)).toBe("paused");
  });
});
