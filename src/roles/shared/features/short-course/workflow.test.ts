import { describe, expect, it } from "vitest";

import { courseCatalog, type ShortCourseDefinition } from "@/roles/shared/features/courses/course-catalog";
import {
  approveShortCourseAssessment,
  createShortCourseEnrollment,
  createShortCourseInvoice,
  markShortCoursePaid,
  normalizeShortCourseEnrollments,
  recordShortCourseAssessment,
  reviewShortCourseEnrollment,
  shortCourseFee,
  type ShortCourseActor,
} from "./workflow";

const definition = (id: string) => courseCatalog.find((item): item is ShortCourseDefinition => item.kind === "short_course" && item.id === id)!;
const at = "2026-09-01T03:00:00.000Z";
const institution: ShortCourseActor = { userId: "i-1", userName: "สถาบัน", role: "institution_admin", organisationId: "org-inst-siriraj" };
const staff: ShortCourseActor = { userId: "s-1", userName: "เจ้าหน้าที่", role: "royal_college_staff", organisationId: "org-royal-college" };

describe("short course workflow", () => {
  it("routes credit-bank courses through approval and non-credit-bank straight to payment", () => {
    const creditBank = createShortCourseEnrollment({ id: "SC-A", student: { id: "S-1", name: "ผู้เรียน" }, definition: definition("short-chronic-care"), at });
    expect(creditBank.status).toBe("pending_approval");
    expect(createShortCourseInvoice(creditBank, definition("short-chronic-care"), at).status).toBe("locked");

    const standard = createShortCourseEnrollment({ id: "SC-B", student: { id: "S-1", name: "ผู้เรียน" }, definition: definition("short-community-screening"), at });
    expect(standard.status).toBe("awaiting_payment");
    expect(standard.creditBank).toBe(false);
  });

  it("requires a reason to reject and blocks payment before approval", () => {
    const enrollment = createShortCourseEnrollment({ id: "SC-A", student: { id: "S-1", name: "ผู้เรียน" }, definition: definition("short-chronic-care"), at });
    expect(() => markShortCoursePaid(enrollment, at, "ref")).toThrow();
    expect(() => reviewShortCourseEnrollment(enrollment, "reject", institution, { at })).toThrow("กรุณาระบุเหตุผลการไม่อนุมัติ");
    const rejected = reviewShortCourseEnrollment(enrollment, "reject", institution, { at, reason: "ที่นั่งเต็ม" });
    expect(rejected).toMatchObject({ status: "rejected", decisionReason: "ที่นั่งเต็ม" });
    expect(rejected.history.at(-1)).toMatchObject({ from: "pending_approval", to: "rejected", actorName: "สถาบัน", note: "ที่นั่งเต็ม" });
  });

  it("awards credits only after staff approves a passing assessment", () => {
    let enrollment = createShortCourseEnrollment({ id: "SC-A", student: { id: "S-1", name: "ผู้เรียน" }, definition: definition("short-chronic-care"), at });
    enrollment = reviewShortCourseEnrollment(enrollment, "approve", institution, { at });
    enrollment = markShortCoursePaid(enrollment, at, "ref");
    enrollment = recordShortCourseAssessment(enrollment, "pass", institution, { at, note: "ผ่าน" });
    expect(enrollment).toMatchObject({ status: "assessment_recorded", creditsAwarded: 0 });
    expect(() => approveShortCourseAssessment(enrollment, "approve", institution, { at })).toThrow();
    const returned = approveShortCourseAssessment(enrollment, "return", staff, { at, reason: "แนบหลักฐานไม่ครบ" });
    expect(returned).toMatchObject({ status: "registered", assessment: undefined, creditsAwarded: 0 });
    const approved = approveShortCourseAssessment(enrollment, "approve", staff, { at });
    expect(approved).toMatchObject({ status: "completed", creditsAwarded: 4 });
    expect(approved.certificateNo).toBeDefined();
  });

  it("records a failed credit-bank assessment without credits", () => {
    let enrollment = createShortCourseEnrollment({ id: "SC-A", student: { id: "S-1", name: "ผู้เรียน" }, definition: definition("short-chronic-care"), at });
    enrollment = markShortCoursePaid(reviewShortCourseEnrollment(enrollment, "approve", institution, { at }), at, "ref");
    const failed = approveShortCourseAssessment(recordShortCourseAssessment(enrollment, "fail", institution, { at, note: "ไม่ผ่าน" }), "approve", staff, { at });
    expect(failed).toMatchObject({ status: "failed", creditsAwarded: 0 });
    expect(failed.certificateNo).toBeUndefined();
  });

  it("blocks an institution outside the course scope", () => {
    const enrollment = createShortCourseEnrollment({ id: "SC-A", student: { id: "S-1", name: "ผู้เรียน" }, definition: definition("short-chronic-care"), at });
    expect(() => reviewShortCourseEnrollment(enrollment, "approve", { ...institution, organisationId: "org-inst-chula" }, { at })).toThrow();
  });

  it("uses the per-credit fallback fee when the course has no configured fee", () => {
    expect(shortCourseFee(definition("short-chronic-care"))).toEqual({ amount: 4_000, source: "per_credit_default" });
    expect(shortCourseFee({ ...definition("short-chronic-care"), fee: 7_500 })).toEqual({ amount: 7_500, source: "course_setting" });
  });

  it("never trusts stored credits for unapproved enrollments", () => {
    const stored = { ...createShortCourseEnrollment({ id: "SC-A", student: { id: "S-1", name: "ผู้เรียน" }, definition: definition("short-chronic-care"), at }), creditsAwarded: 99 };
    expect(normalizeShortCourseEnrollments([stored, { bogus: true }])).toEqual([{ ...stored, creditsAwarded: 0 }]);
  });
});
