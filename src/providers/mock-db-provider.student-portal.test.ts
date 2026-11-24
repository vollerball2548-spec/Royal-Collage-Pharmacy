import { createElement, type ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ScopedAcademicActor } from "@/roles/shared/features/academic";
import { courseCatalog } from "@/roles/shared/features/courses/course-catalog";
import { summarizeCreditBank } from "@/roles/shared/features/credit-bank";
import {
  canPayRegistration,
  latestDecisionReason,
  resolveRegistrationStage,
} from "@/roles/shared/features/registration";
import type { ShortCourseActor } from "@/roles/shared/features/short-course";
import { buildStudentSchedule } from "@/roles/member/features/portal/student-schedule";

import {
  MockDbProvider,
  useMockDb,
  type PortalActorInput,
  type RegistrationSubmissionInput,
} from "./mock-db-provider";

function wrapper({ children }: { children: ReactNode }) {
  return createElement(MockDbProvider, null, children);
}

const STUDENT_ID = "วภท-2568-001";
const student: PortalActorInput = {
  userId: STUDENT_ID,
  displayName: "ภก. สมชาย ใจดี",
  role: "student",
  organisationId: "org-inst-siriraj",
};
const sirirajTeacher: ScopedAcademicActor = {
  userId: "teacher-001",
  userName: "อ. ภก. กิตติพงศ์ วัฒนเภสัช",
  role: "teacher",
  organisationId: "org-inst-siriraj",
  resourceScopes: ["course:assigned"],
};
const sirirajInstitution: ShortCourseActor = {
  userId: "institution-admin-001",
  userName: "ภก. วิชาญ อัครเวช",
  role: "institution_admin",
  organisationId: "org-inst-siriraj",
};
const chulaInstitution: ShortCourseActor = {
  userId: "institution-admin-002",
  userName: "ภญ. อรอนงค์ วัฒนกิจ",
  role: "institution_admin",
  organisationId: "org-inst-chula",
};
const staff: ShortCourseActor = {
  userId: "staff-001",
  userName: "ภญ. ปาริชาติ สุขเกษม",
  role: "royal_college_staff",
  organisationId: "org-royal-college",
};
const evidence = {
  referenceNo: "PP-TEST-001",
  evidenceFileName: "proof.png",
  evidenceFileType: "image/png",
  evidenceFileSize: 1_024,
  evidenceDataUrl: "data:image/png;base64,cHJvb2Y=",
};

function selection(input: Partial<RegistrationSubmissionInput> & Pick<RegistrationSubmissionInput, "courseCode" | "courseOfferingId" | "term">): RegistrationSubmissionInput {
  return {
    studentId: STUDENT_ID,
    studentName: student.displayName,
    courseId: input.courseCode,
    courseTitle: input.courseCode,
    credits: 4,
    institutionId: "org-inst-chula",
    ...input,
  };
}

// ผู้เรียนตัวอย่างยังไม่เคยเรียน วภช-201 (สถาบันศิริราช, อาจารย์ teacher-001)
const community201 = selection({ courseCode: "วภช-201", courseOfferingId: "offering-community-201", term: "1/2569", courseTitle: "การบริหารจัดการทางเภสัชกรรมชุมชน", credits: 3, institutionId: "org-inst-siriraj" });

async function renderDb() {
  const hook = renderHook(() => useMockDb(), { wrapper });
  await waitFor(() => expect(hook.result.current.isLoaded).toBe(true));
  return hook.result;
}

function scheduleOf(db: ReturnType<typeof useMockDb>) {
  return buildStudentSchedule({
    studentId: STUDENT_ID,
    registrations: db.registrations,
    invoices: db.registrationInvoices,
    courseOfferings: db.courseOfferings,
    institutions: db.academicInstitutions,
    teachingAssignments: db.teachingAssignments,
    teachers: db.academicTeachers,
    subjectResults: db.subjectResults,
    shortCourseEnrollments: db.shortCourseEnrollments,
    programLabel: "วิทยาลัยเภสัชบำบัดแห่งประเทศไทย",
  });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-01T03:00:00.000Z"));
  window.localStorage.clear();
  window.localStorage.setItem("mock_settings", JSON.stringify({
    admissionOpen: true,
    registrationOpen: true,
    registrationOpensAt: "2026-08-24T09:00:00+07:00",
    registrationClosesAt: "2026-09-30T16:30:00+07:00",
  }));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Student Portal: term registration (หลักสูตร 1 ปี / 4 ปี)", () => {
  it("TC1/5/6/7: submits per term, blocks payment before approval, needs confirmed payment before schedule", async () => {
    const db = await renderDb();

    let created = "";
    act(() => {
      const result = db.current.submitStudentRegistrations(student, [community201]);
      expect(result.created).toHaveLength(1);
      created = result.created[0].id;
    });
    const registration = db.current.registrations.find((item) => item.id === created)!;
    const invoice = () => db.current.registrationInvoices.find((item) => item.registrationId === created)!;
    expect(registration.status).toBe("pending");
    expect(resolveRegistrationStage(registration, { invoiceStatus: invoice().status })).toBe("pending_approval");
    expect(registration.history.map((entry) => entry.to)).toEqual(["selected", "submitted", "pending"]);
    expect(registration.history[1]).toMatchObject({ actorUserId: STUDENT_ID, actorRole: "student", from: "selected" });

    // TC5: รออนุมัติ → ยังชำระเงินไม่ได้
    expect(invoice().status).toBe("locked");
    expect(canPayRegistration(registration, invoice().status)).toBe(false);
    expect(() => db.current.submitStudentPayment(student, { invoiceId: invoice().id, ...evidence }))
      .toThrowError("รายการนี้ยังไม่เปิดให้ชำระเงิน");
    expect(scheduleOf(db.current).some((entry) => entry.id === created)).toBe(false);

    act(() => db.current.reviewRegistration({ registrationId: created, decision: "approve", actor: sirirajTeacher, reason: "คุณสมบัติครบถ้วน" }));
    expect(db.current.registrations.find((item) => item.id === created)?.status).toBe("awaiting_payment");
    expect(invoice().status).toBe("awaiting_payment");

    // TC6: อนุมัติแล้วจึงชำระได้ — แต่การกดชำระไม่ทำให้เป็น Paid
    act(() => { db.current.submitStudentPayment(student, { invoiceId: invoice().id, ...evidence }); });
    const payment = db.current.payments.find((item) => item.invoiceId === invoice().id)!;
    expect(payment.status).toBe("pending");
    expect(invoice().status).toBe("awaiting_payment");
    expect(invoice().receiptNo).toBeUndefined();
    expect(scheduleOf(db.current).some((entry) => entry.id === created)).toBe(false);
    expect(() => db.current.submitStudentPayment(student, { invoiceId: invoice().id, ...evidence }))
      .toThrowError("มีหลักฐานการชำระเงินรอตรวจสอบอยู่แล้ว");

    // ยืนยันรับชำระโดยเจ้าหน้าที่ (Payment Sandbox ของระบบ)
    act(() => db.current.updatePaymentStatus(payment.id, "approved"));
    expect(invoice()).toMatchObject({ status: "paid" });
    expect(invoice().receiptNo).toMatch(/^RC-2569-/);
    expect(db.current.registrations.find((item) => item.id === created)?.status).toBe("enrolled");

    // TC7: ชำระสำเร็จแล้วจึงแสดงตารางเรียน
    const entry = scheduleOf(db.current).find((item) => item.id === created);
    expect(entry).toMatchObject({ courseCode: "วภช-201", term: "1/2569", scheduleLabel: "วันพุธ 18:00–21:00 น." });
    expect(entry?.teacherNames).toContain("อ. ภก. กิตติพงศ์ วัฒนเภสัช");
  });

  it("TC2: supports term registration beyond year 4 without a maximum duration", async () => {
    window.localStorage.setItem("mock_course_offerings", JSON.stringify([{
      id: "offering-vpt-303-2574", courseCode: "วภท-303", courseTitle: "การสอบโครงร่างวิทยานิพนธ์", credits: 12,
      term: "2/2574", institutionId: "org-inst-chula", collegeCode: "วภท.", status: "open",
    }]));
    const db = await renderDb();
    act(() => {
      const result = db.current.submitStudentRegistrations(student, [
        selection({ courseCode: "วภท-303", courseOfferingId: "offering-vpt-303-2574", term: "2/2574", credits: 12 }),
      ]);
      expect(result.created).toHaveLength(1);
      expect(result.created[0].term).toBe("2/2574");
    });
  });

  it("TC8: blocks registering the same course twice in the same term", async () => {
    const db = await renderDb();
    act(() => { db.current.submitStudentRegistrations(student, [community201]); });
    const before = db.current.registrations.length;
    act(() => {
      const again = db.current.submitStudentRegistrations(student, [community201, community201]);
      expect(again.created).toHaveLength(0);
      expect(again.skippedDuplicates).toContain("วภช-201");
    });
    expect(db.current.registrations).toHaveLength(before);
  });

  it("TC9: shows the rejection reason and cancels the invoice", async () => {
    const db = await renderDb();
    let id = "";
    act(() => { id = db.current.submitStudentRegistrations(student, [community201]).created[0].id; });
    expect(() => db.current.reviewRegistration({ registrationId: id, decision: "reject", actor: sirirajTeacher, reason: "" }))
      .toThrowError();
    act(() => db.current.reviewRegistration({ registrationId: id, decision: "reject", actor: sirirajTeacher, reason: "ยังไม่ผ่านรายวิชาบังคับก่อนหน้า" }));
    const rejected = db.current.registrations.find((item) => item.id === id)!;
    expect(resolveRegistrationStage(rejected)).toBe("rejected");
    expect(latestDecisionReason(rejected)).toBe("ยังไม่ผ่านรายวิชาบังคับก่อนหน้า");
    expect(db.current.registrationInvoices.find((item) => item.registrationId === id)?.status).toBe("cancelled");
  });

  it("TC10: a failed course can be registered again in the next term", async () => {
    window.localStorage.setItem("mock_course_offerings", JSON.stringify([
      { id: "offering-cpc-103-2568", courseCode: "วคบท-103", courseTitle: "การวิเคราะห์และจัดการความเสี่ยง", credits: 4, term: "1/2568", institutionId: "org-inst-chula", collegeCode: "วคบท.", status: "closed" },
      { id: "offering-cpc-103-2569", courseCode: "วคบท-103", courseTitle: "การวิเคราะห์และจัดการความเสี่ยง", credits: 4, term: "2/2569", institutionId: "org-inst-chula", collegeCode: "วคบท.", status: "open" },
    ]));
    window.localStorage.setItem("mock_subject_results", JSON.stringify([{
      id: "result-cpc-103-2568", studentId: STUDENT_ID, courseOfferingId: "offering-cpc-103-2568", teacherId: "teacher-002",
      status: "published", currentValue: "U", publishedAt: "2025-10-01T00:00:00.000Z", updatedAt: "2025-10-01T00:00:00.000Z", revisions: [],
    }]));
    const db = await renderDb();
    act(() => {
      const result = db.current.submitStudentRegistrations(student, [
        selection({ courseCode: "วคบท-103", courseOfferingId: "offering-cpc-103-2569", term: "2/2569" }),
      ]);
      expect(result.created).toHaveLength(1);
    });
  });

  it("TC13: a student cannot act for another person or approve their own request", async () => {
    const db = await renderDb();
    expect(() => db.current.submitStudentRegistrations(student, [{ ...community201, studentId: "RPC-2569-001" }]))
      .toThrowError("ไม่สามารถส่งคำขอลงทะเบียนแทนผู้เรียนคนอื่นได้");
    const othersInvoice = db.current.registrationInvoices.find((item) => item.registrationId === "REG-001")!;
    expect(() => db.current.submitStudentPayment(student, { invoiceId: othersInvoice.id, ...evidence }))
      .toThrowError("ไม่พบรายการชำระเงินของผู้เรียน");
    expect(() => db.current.submitStudentRegistrations({ ...student, role: "teacher" }, [community201])).toThrowError();
    let id = "";
    act(() => { id = db.current.submitStudentRegistrations(student, [community201]).created[0].id; });
    expect(() => db.current.reviewRegistration({
      registrationId: id,
      decision: "approve",
      actor: { userId: STUDENT_ID, userName: student.displayName, role: "student", organisationId: "org-inst-siriraj", resourceScopes: ["course:assigned"] },
      reason: "อนุมัติตัวเอง",
    })).toThrowError();
    expect(db.current.registrations.find((item) => item.id === id)?.status).toBe("pending");
  });
});

describe("Student Portal: Short Course", () => {
  it("TC3/TC12: Credit Bank course needs institution approval, payment, and staff-approved results before credits", async () => {
    const db = await renderDb();
    let id = "";
    act(() => { id = db.current.applyShortCourse(student, "short-chronic-care").id; });
    const enrollment = () => db.current.shortCourseEnrollments.find((item) => item.id === id)!;
    const invoice = () => db.current.registrationInvoices.find((item) => item.registrationId === id)!;
    expect(enrollment()).toMatchObject({ status: "pending_approval", creditBank: true, institutionId: "org-inst-siriraj" });
    expect(invoice()).toMatchObject({ status: "locked", kind: "short_course", payee: { organisationId: "org-inst-siriraj" } });
    expect(() => db.current.submitStudentPayment(student, { invoiceId: invoice().id, ...evidence })).toThrowError();
    expect(() => db.current.applyShortCourse(student, "short-chronic-care")).toThrowError("มีคำขอหรือการลงทะเบียนหลักสูตรนี้อยู่แล้ว");

    // สถาบันอื่นอนุมัติไม่ได้
    expect(() => db.current.reviewShortCourseEnrollment({ actor: chulaInstitution, enrollmentId: id, decision: "approve" })).toThrowError();
    act(() => db.current.reviewShortCourseEnrollment({ actor: sirirajInstitution, enrollmentId: id, decision: "approve", reason: "เอกสารครบ" }));
    expect(enrollment().status).toBe("awaiting_payment");
    expect(invoice().status).toBe("awaiting_payment");

    act(() => { db.current.submitStudentPayment(student, { invoiceId: invoice().id, ...evidence }); });
    expect(enrollment().status).toBe("awaiting_payment");
    const payment = db.current.payments.find((item) => item.invoiceId === invoice().id)!;
    act(() => db.current.updatePaymentStatus(payment.id, "approved"));
    expect(enrollment().status).toBe("registered");
    expect(invoice().receiptNo).toBeDefined();
    expect(scheduleOf(db.current).some((entry) => entry.id === id)).toBe(true);

    act(() => db.current.recordShortCourseAssessment({ actor: sirirajInstitution, enrollmentId: id, result: "pass", note: "ผ่านการประเมิน 85%" }));
    expect(enrollment()).toMatchObject({ status: "assessment_recorded", creditsAwarded: 0 });
    const summarize = () => summarizeCreditBank({
      studentId: STUDENT_ID,
      subjectResults: [],
      courseOfferings: db.current.courseOfferings,
      catalog: courseCatalog,
      shortCourseEnrollments: db.current.shortCourseEnrollments,
    });
    expect(summarize().totalCredits).toBe(0);

    // นักศึกษา/สถาบันอนุมัติผลเองไม่ได้
    expect(() => db.current.approveShortCourseAssessment({ actor: sirirajInstitution, enrollmentId: id, decision: "approve" })).toThrowError();
    expect(() => db.current.approveShortCourseAssessment({ actor: { ...staff, role: "student" }, enrollmentId: id, decision: "approve" })).toThrowError();

    act(() => db.current.approveShortCourseAssessment({ actor: staff, enrollmentId: id, decision: "approve", reason: "ตรวจหลักฐานแล้ว" }));
    expect(enrollment()).toMatchObject({ status: "completed", creditsAwarded: 4 });
    expect(enrollment().certificateNo).toMatch(/^SC-/);
    expect(summarize().totalCredits).toBe(4);
    expect(summarize().certificates).toHaveLength(1);
    expect(enrollment().history.map((entry) => entry.to)).toEqual([
      "pending_approval", "awaiting_payment", "registered", "assessment_recorded", "completed",
    ]);
  });

  it("TC4: non-credit-bank course records training history and certificate without credits", async () => {
    const db = await renderDb();
    let id = "";
    act(() => { id = db.current.applyShortCourse(student, "short-community-screening").id; });
    const enrollment = () => db.current.shortCourseEnrollments.find((item) => item.id === id)!;
    const invoice = () => db.current.registrationInvoices.find((item) => item.registrationId === id)!;
    expect(enrollment()).toMatchObject({ status: "awaiting_payment", creditBank: false });
    expect(invoice().status).toBe("awaiting_payment");

    act(() => { db.current.submitStudentPayment(student, { invoiceId: invoice().id, ...evidence }); });
    const payment = db.current.payments.find((item) => item.invoiceId === invoice().id)!;
    act(() => db.current.updatePaymentStatus(payment.id, "approved"));
    act(() => db.current.recordShortCourseAssessment({ actor: sirirajInstitution, enrollmentId: id, result: "pass", note: "เข้าอบรมครบ" }));

    expect(enrollment()).toMatchObject({ status: "completed", creditsAwarded: 0 });
    expect(enrollment().certificateNo).toBeDefined();
    const summary = summarizeCreditBank({
      studentId: STUDENT_ID,
      subjectResults: [],
      courseOfferings: db.current.courseOfferings,
      catalog: courseCatalog,
      shortCourseEnrollments: db.current.shortCourseEnrollments,
    });
    expect(summary.totalCredits).toBe(0);
    expect(summary.passed).toHaveLength(0);
    expect(summary.certificates).toHaveLength(1);
  });

  it("persists short course enrollments across reloads", async () => {
    const db = await renderDb();
    act(() => { db.current.applyShortCourse(student, "short-community-screening"); });
    await waitFor(() => expect(window.localStorage.getItem("mock_short_course_enrollments")).toContain("short-community-screening"));
    const reloaded = await renderDb();
    expect(reloaded.current.shortCourseEnrollments.some((item) => item.courseId === "short-community-screening")).toBe(true);
  });
});
