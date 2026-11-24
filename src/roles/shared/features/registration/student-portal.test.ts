import { describe, expect, it } from "vitest";

import {
  buildRegistrationTimeline,
  canPayRegistration,
  examAttemptPolicy,
  findDuplicateRegistration,
  isScheduleVisible,
  resolveCourseCategory,
  resolveRegistrationStage,
} from "./student-portal";
import {
  createSubmittedRegistration,
  transitionRegistration,
  type RegistrationActionActor,
} from "./workflow";

const at = "2026-09-01T03:00:00.000Z";
const base = createSubmittedRegistration({
  id: "REG-T-1",
  studentId: "S-1",
  studentName: "ผู้เรียน",
  courseId: "C-1",
  courseCode: "TEST-101",
  courseTitle: "วิชาทดสอบ",
  credits: 3,
  term: "1/2569",
}, at);
const teacher: RegistrationActionActor = { userId: "T-1", userName: "อาจารย์", role: "teacher", organisationId: "org-1" };

describe("student portal registration rules", () => {
  it("maps workflow + invoice + payment into learner-facing stages", () => {
    expect(resolveRegistrationStage(base)).toBe("pending_approval");
    const approved = transitionRegistration(transitionRegistration(base, "approved", teacher, { at, reason: "ok" }), "awaiting_payment", "system", { at });
    expect(resolveRegistrationStage(approved, { invoiceStatus: "awaiting_payment" })).toBe("pending_payment");
    expect(resolveRegistrationStage(approved, { invoiceStatus: "awaiting_payment", paymentStatus: "pending" })).toBe("payment_review");
    const enrolled = transitionRegistration(approved, "enrolled", "system", { at });
    expect(resolveRegistrationStage(enrolled, { invoiceStatus: "paid" })).toBe("registered");
    expect(resolveRegistrationStage(enrolled, { invoiceStatus: "paid", publishedResult: "U" })).toBe("failed");
    expect(resolveRegistrationStage(enrolled, { invoiceStatus: "paid", publishedResult: "S" })).toBe("completed");
  });

  it("only allows payment after approval and an unlocked invoice", () => {
    expect(canPayRegistration(base, "locked")).toBe(false);
    expect(canPayRegistration(base, "awaiting_payment")).toBe(false);
    const approved = transitionRegistration(base, "approved", teacher, { at, reason: "ok" });
    expect(canPayRegistration(approved, "locked")).toBe(false);
    expect(canPayRegistration(approved, "awaiting_payment")).toBe(true);
  });

  it("shows a course in the schedule only when enrolled and paid", () => {
    expect(isScheduleVisible(base, "paid")).toBe(false);
    const approved = transitionRegistration(base, "approved", teacher, { at, reason: "ok" });
    const awaiting = transitionRegistration(approved, "awaiting_payment", "system", { at });
    expect(isScheduleVisible(awaiting, "awaiting_payment")).toBe(false);
    const enrolled = transitionRegistration(awaiting, "enrolled", "system", { at });
    expect(isScheduleVisible(enrolled, "awaiting_payment")).toBe(false);
    expect(isScheduleVisible(enrolled, "paid")).toBe(true);
  });

  it("treats duplicates per term only, and ignores rejected/withdrawn requests", () => {
    expect(findDuplicateRegistration([base], { studentId: "S-1", courseCode: "TEST-101", term: "1 / 2569" })).toBe(base);
    expect(findDuplicateRegistration([base], { studentId: "S-1", courseCode: "TEST-101", term: "2/2569" })).toBeUndefined();
    expect(findDuplicateRegistration([base], { studentId: "S-2", courseCode: "TEST-101", term: "1/2569" })).toBeUndefined();
    const rejected = transitionRegistration(base, "rejected", teacher, { at, reason: "ไม่ผ่านเงื่อนไข" });
    expect(findDuplicateRegistration([rejected], { studentId: "S-1", courseCode: "TEST-101", term: "1/2569" })).toBeUndefined();
  });

  it("classifies required, elective and professional-practice courses", () => {
    expect(resolveCourseCategory({ classification: "required" })).toBe("required");
    expect(resolveCourseCategory({ classification: "general" })).toBe("elective");
    expect(resolveCourseCategory({ classification: "required", scheduleMode: "clinical" })).toBe("practice");
  });

  it("TC11: first exam attempt is free; retakes from attempt 2 need a request and 500 THB", () => {
    expect(examAttemptPolicy(1)).toEqual({ attemptNumber: 1, fee: 0, requiresRequest: false });
    expect(examAttemptPolicy(2)).toEqual({ attemptNumber: 2, fee: 500, requiresRequest: true });
    expect(examAttemptPolicy(5).fee).toBe(500);
    expect(() => examAttemptPolicy(0)).toThrow();
  });

  it("builds a timeline with actor, time, previous/new status and reason", () => {
    const rejected = transitionRegistration(base, "rejected", teacher, { at: "2026-09-02T03:00:00.000Z", reason: "เอกสารไม่ครบ" });
    const timeline = buildRegistrationTimeline(rejected.history);
    expect(timeline.at(-1)).toMatchObject({
      actorLabel: "อาจารย์",
      fromLabel: "รอตรวจสอบ",
      toLabel: "ไม่อนุมัติ",
      reason: "เอกสารไม่ครบ",
      at: "2026-09-02T03:00:00.000Z",
    });
  });
});
