import { describe, expect, it } from "vitest";

import { createMembershipRecord, registerExtraordinary } from "@/roles/shared/features/membership";

import {
  createApplication,
  resolveApplicationRoute,
  transitionApplication,
  type Application,
  type ApplicationRoute,
  type ApplicationStatus,
} from "./application";

const at = "2026-03-01T00:00:00.000Z";

function application(route: ApplicationRoute): Application {
  return createApplication({
    id: `APP-${route}`,
    route,
    applicantId: "APPLICANT-1",
    collegeOrganisationId: "org-college-vpt",
    programId: route === "approval_exam" ? undefined : "PROGRAM-1",
    trainingInstitutionId: route === "entrance_exam" ? "org-inst-siriraj" : undefined,
    createdAt: at,
  });
}

function walk(app: Application, steps: ApplicationStatus[]) {
  return steps.reduce((current, to) => transitionApplication(current, to, "system", { at }), app);
}

const member = registerExtraordinary(createMembershipRecord("APPLICANT-1"), {
  paidAt: at,
  paymentReference: "PAY-1",
  actor: "system",
});

describe("application routes", () => {
  it("maps credential track and credit-bank flag to the 4 routes", () => {
    expect(resolveApplicationRoute({ track: "certificate" })).toBe("short_course");
    expect(resolveApplicationRoute({ track: "certificate", creditBank: true })).toBe("short_course_credit_bank");
    expect(resolveApplicationRoute({ track: "higher_certificate" })).toBe("entrance_exam");
    expect(resolveApplicationRoute({ track: "board_certificate" })).toBe("entrance_exam");
    expect(resolveApplicationRoute({ track: "approval" })).toBe("approval_exam");
  });

  it("validates required selections per route", () => {
    expect(() => createApplication({ id: "X", route: "entrance_exam", applicantId: "A", collegeOrganisationId: "C", programId: "P", createdAt: at }))
      .toThrow(/สถาบันฝึกอบรม/);
    expect(() => createApplication({ id: "X", route: "short_course", applicantId: "A", collegeOrganisationId: "C", createdAt: at }))
      .toThrow(/หลักสูตร/);
    expect(application("approval_exam").status).toBe("draft");
  });

  it("A: non-credit-bank short course admits after the fee without membership", () => {
    const admitted = walk(application("short_course"), ["awaiting_fee", "fee_paid", "admitted"]);
    expect(admitted.history.map((entry) => entry.to)).toEqual(["awaiting_fee", "fee_paid", "admitted"]);
  });

  it("B: credit-bank short course needs active membership to admit", () => {
    const paid = walk(application("short_course_credit_bank"), ["awaiting_fee", "fee_paid"]);

    expect(() => transitionApplication(paid, "admitted", "system", { at })).toThrow(/ข้อมูลสมาชิก/);
    expect(() => transitionApplication(paid, "admitted", "system", { at, membership: createMembershipRecord("APPLICANT-1") }))
      .toThrow(/วิสามัญ/);
    expect(transitionApplication(paid, "admitted", "system", { at, membership: member }).status).toBe("admitted");
  });

  it("C: entrance exam cannot skip eligibility or results", () => {
    const paid = walk(application("entrance_exam"), ["awaiting_fee", "fee_paid"]);

    expect(() => transitionApplication(paid, "passed", "system", { at })).toThrow(/Invalid application transition/);
    const passed = walk(paid, ["eligible", "passed"]);
    expect(transitionApplication(passed, "admitted", "system", { at, membership: member }).status).toBe("admitted");
  });

  it("C: rejects membership belonging to someone else", () => {
    const passed = walk(application("entrance_exam"), ["awaiting_fee", "fee_paid", "eligible", "passed"]);
    const other = registerExtraordinary(createMembershipRecord("OTHER"), { paidAt: at, paymentReference: "PAY-2", actor: "system" });

    expect(() => transitionApplication(passed, "admitted", "system", { at, membership: other })).toThrow(/ข้อมูลสมาชิก/);
  });

  it("D: approval exam ends at passed; admission is not part of this route", () => {
    const passed = walk(application("approval_exam"), ["awaiting_fee", "fee_paid", "eligible", "passed"]);

    expect(() => transitionApplication(passed, "admitted", "system", { at, membership: member })).toThrow(/Invalid/);
  });

  it("requires a reason for ineligible and cancelled", () => {
    const paid = walk(application("approval_exam"), ["awaiting_fee", "fee_paid"]);

    expect(() => transitionApplication(paid, "ineligible", "system", { at })).toThrow(/requires a reason/);
    expect(() => transitionApplication(application("short_course"), "cancelled", "system", { at })).toThrow(/requires a reason/);
    expect(transitionApplication(paid, "ineligible", "system", { at, reason: "เอกสารไม่ครบ" }).history.at(-1)?.reason)
      .toBe("เอกสารไม่ครบ");
  });
});
