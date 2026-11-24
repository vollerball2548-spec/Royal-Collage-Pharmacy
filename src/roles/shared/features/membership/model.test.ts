import { describe, expect, it } from "vitest";

import {
  createMembershipRecord,
  effectiveMembershipStatus,
  hasActiveMembership,
  registerExtraordinary,
  renewExtraordinary,
  upgradeToOrdinary,
} from "./model";

const paid = (paidAt: string, extra: { evidenceReference?: string } = {}) => ({
  paidAt,
  paymentReference: `PAY-${paidAt.slice(0, 10)}`,
  actor: "system" as const,
  ...extra,
});

describe("membership", () => {
  it("starts as non-member and registers extraordinary for 5 years from payment", () => {
    const record = registerExtraordinary(createMembershipRecord("M-1"), paid("2026-01-15T00:00:00.000Z"));

    expect(record.status).toBe("extraordinary");
    expect(record.expiresAt).toBe("2031-01-15T00:00:00.000Z");
    expect(record.history.map((event) => [event.from, event.to])).toEqual([["none", "extraordinary"]]);
  });

  it("lapses on the expiry instant without a stored status change", () => {
    const record = registerExtraordinary(createMembershipRecord("M-1"), paid("2026-01-15T00:00:00.000Z"));

    expect(effectiveMembershipStatus(record, "2031-01-14T23:59:59.000Z")).toBe("extraordinary");
    expect(effectiveMembershipStatus(record, "2031-01-15T00:00:00.000Z")).toBe("lapsed");
    expect(hasActiveMembership(record, "2031-01-15T00:00:00.000Z")).toBe(false);
    expect(record.status).toBe("extraordinary");
  });

  it("rejects registering twice", () => {
    const record = registerExtraordinary(createMembershipRecord("M-1"), paid("2026-01-15T00:00:00.000Z"));

    expect(() => registerExtraordinary(record, paid("2026-02-01T00:00:00.000Z"))).toThrow(/สถานะปัจจุบัน: extraordinary/);
  });

  it("renews from the old expiry when paid early, from payment date when lapsed", () => {
    const record = registerExtraordinary(createMembershipRecord("M-1"), paid("2026-01-15T00:00:00.000Z"));

    expect(renewExtraordinary(record, paid("2030-12-01T00:00:00.000Z")).expiresAt).toBe("2036-01-15T00:00:00.000Z");
    expect(renewExtraordinary(record, paid("2032-03-01T00:00:00.000Z")).expiresAt).toBe("2037-03-01T00:00:00.000Z");
  });

  it("upgrades only an active extraordinary member with credential evidence", () => {
    const none = createMembershipRecord("M-1");
    const extraordinary = registerExtraordinary(none, paid("2026-01-15T00:00:00.000Z"));

    expect(() => upgradeToOrdinary(none, paid("2026-06-01T00:00:00.000Z", { evidenceReference: "CERT-1" }))).toThrow();
    expect(() => upgradeToOrdinary(extraordinary, paid("2026-06-01T00:00:00.000Z"))).toThrow(/วุฒิบัตร/);
    expect(() => upgradeToOrdinary(extraordinary, paid("2031-06-01T00:00:00.000Z", { evidenceReference: "CERT-1" })))
      .toThrow(/lapsed/);

    const ordinary = upgradeToOrdinary(extraordinary, paid("2026-06-01T00:00:00.000Z", { evidenceReference: "CERT-1" }));
    expect(ordinary.status).toBe("ordinary");
    expect(ordinary.expiresAt).toBeUndefined();
    expect(effectiveMembershipStatus(ordinary, "2040-01-01T00:00:00.000Z")).toBe("ordinary");
  });

  it("requires a payment reference", () => {
    expect(() => registerExtraordinary(createMembershipRecord("M-1"), { ...paid("2026-01-15T00:00:00.000Z"), paymentReference: " " }))
      .toThrow(/เลขอ้างอิง/);
  });
});
