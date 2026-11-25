import { describe, expect, it } from "vitest";

import { currentApplicantProfile, snapshotApplicant, type PostalAddress } from "@/roles/shared/features/applicant/profile";
import {
  advanceApprovalExam,
  approvalExamStepErrors,
  approvalExamTimeline,
  COLLEGE_QUALIFICATIONS,
  createApprovalExamDocuments,
  createApprovalExamForm,
  GENERAL_QUALIFICATIONS,
  isApprovalExamDocumentSet,
  isApprovalExamForm,
  isApprovalExamProgress,
  qualificationIds,
  type ApprovalExamForm,
} from "./approval-exam";
import { createAdmissionDocuments } from "./documents";

const address: PostalAddress = {
  houseNo: "99", moo: "", soi: "", road: "ถนนตัวอย่าง",
  subdistrict: "แขวงตัวอย่าง", district: "เขตตัวอย่าง", province: "กรุงเทพมหานคร", postalCode: "10100",
};

function completeForm(): ApprovalExamForm {
  const form = createApprovalExamForm("วภท.", snapshotApplicant(currentApplicantProfile(), "2026-11-25T00:00:00.000Z"));
  form.applicant.workplace.address = { ...address };
  form.applicant.person.contactAddress = { ...address };
  form.applicant.person.mobilePhone = "081-234-5678";
  form.declaredQualifications = GENERAL_QUALIFICATIONS.map((item) => item.id);
  form.declaration = { accepted: true, signedName: "ภก.สมชาย ใจดี", signedAt: "2026-11-25T00:00:00.000Z" };
  return form;
}

const approvedPaid = { applicationApproved: true, feePaid: true, actorName: "เจ้าหน้าที่", at: "2026-11-25T01:00:00.000Z" };

describe("approval exam form steps", () => {
  it("accepts a complete form at every step", () => {
    const form = completeForm();
    for (const step of [1, 2, 3, 4, 5, 6]) expect(approvalExamStepErrors(step, form)).toEqual([]);
  });

  it("requires workplace and contact addresses with a 5-digit postal code", () => {
    const form = completeForm();
    form.applicant.person.contactAddress = { ...address, postalCode: "1010" };
    form.applicant.workplace.address = { ...address, province: " " };
    const errors = approvalExamStepErrors(2, form);
    expect(errors.some((error) => error.includes("รหัสไปรษณีย์"))).toBe(true);
    expect(errors.some((error) => error.includes("จังหวัด"))).toBe(true);
  });

  it("requires a bachelor's record and at least one employment record", () => {
    const form = completeForm();
    form.applicant.education = form.applicant.education.map((record) => ({ ...record, institution: "" }));
    form.applicant.employment = [];
    expect(approvalExamStepErrors(3, form)).toHaveLength(2);
  });

  it("blocks submission until both general qualifications are declared", () => {
    const form = completeForm();
    form.declaredQualifications = [GENERAL_QUALIFICATIONS[0].id];
    expect(approvalExamStepErrors(4, form)).toHaveLength(1);
  });

  it("requires the declaration to be signed with the applicant's own name", () => {
    const form = completeForm();
    form.declaration = { accepted: true, signedName: "ชื่ออื่น", signedAt: "2026-11-25T00:00:00.000Z" };
    expect(approvalExamStepErrors(6, form)).toHaveLength(1);
    form.declaration = undefined;
    expect(approvalExamStepErrors(6, form)).toHaveLength(1);
  });
});

describe("approval exam reference data", () => {
  it("keeps qualification ids unique across all colleges", () => {
    const ids = [GENERAL_QUALIFICATIONS, ...Object.values(COLLEGE_QUALIFICATIONS)].flatMap(qualificationIds);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("tells approval-exam document sets apart from the legacy list", () => {
    expect(isApprovalExamDocumentSet(createApprovalExamDocuments())).toBe(true);
    expect(isApprovalExamDocumentSet(createAdmissionDocuments())).toBe(false);
  });

  it("round-trips a stored form and rejects malformed data", () => {
    const stored = JSON.parse(JSON.stringify(completeForm())) as unknown;
    expect(isApprovalExamForm(stored)).toBe(true);
    expect(isApprovalExamForm({ collegeCode: "วภท." })).toBe(false);
    expect(isApprovalExamProgress({ stage: "hacked", history: [] })).toBe(false);
  });
});

describe("approval exam stages", () => {
  it("needs an approved application and a confirmed fee before granting exam eligibility", () => {
    expect(() => advanceApprovalExam(undefined, "exam_eligible", { ...approvedPaid, feePaid: false })).toThrow();
    expect(() => advanceApprovalExam(undefined, "exam_eligible", { ...approvedPaid, applicationApproved: false })).toThrow();
    expect(advanceApprovalExam(undefined, "exam_eligible", approvedPaid).stage).toBe("exam_eligible");
  });

  it("moves in order and requires an approval letter number", () => {
    expect(() => advanceApprovalExam(undefined, "passed", approvedPaid)).toThrow();
    const eligible = advanceApprovalExam(undefined, "exam_eligible", approvedPaid);
    const passed = advanceApprovalExam(eligible, "passed", approvedPaid);
    expect(() => advanceApprovalExam(passed, "approval_issued", approvedPaid)).toThrow("เลขที่หนังสืออนุมัติ");
    const issued = advanceApprovalExam(passed, "approval_issued", { ...approvedPaid, approvalLetterNo: " AP-001 " });
    expect(issued.approvalLetterNo).toBe("AP-001");
    expect(issued.history.map((entry) => entry.stage)).toEqual(["exam_eligible", "passed", "approval_issued"]);
  });

  it("treats a failed exam as final", () => {
    const failed = advanceApprovalExam(advanceApprovalExam(undefined, "exam_eligible", approvedPaid), "failed", approvedPaid);
    expect(() => advanceApprovalExam(failed, "approval_issued", { ...approvedPaid, approvalLetterNo: "X" })).toThrow();
  });

  it("shows applicants where their request stands", () => {
    const states = (input: Parameters<typeof approvalExamTimeline>[0]) =>
      Object.fromEntries(approvalExamTimeline(input).map((step) => [step.id, step.state]));
    expect(states({ status: "pending", payment: "none" })).toMatchObject({ eligibility: "current", payment: "waiting", exam_eligible: "waiting" });
    expect(states({ status: "rejected", payment: "none" })).toMatchObject({ eligibility: "problem" });
    expect(states({ status: "approved", payment: "pending" })).toMatchObject({ payment: "current", exam_eligible: "waiting" });
    const eligible = advanceApprovalExam(undefined, "exam_eligible", approvedPaid);
    expect(states({ status: "approved", payment: "approved", progress: eligible })).toMatchObject({ exam_eligible: "completed", result: "current" });
    const failed = advanceApprovalExam(eligible, "failed", approvedPaid);
    expect(states({ status: "approved", payment: "approved", progress: failed })).toMatchObject({ result: "problem", approval_letter: "waiting" });
  });
});

describe("applicant snapshot", () => {
  it("is a detached copy so later profile edits do not change submitted applications", () => {
    const profile = currentApplicantProfile();
    const snapshot = snapshotApplicant(profile, "2026-11-25T00:00:00.000Z");
    profile.person.firstNameTh = "เปลี่ยนแล้ว";
    profile.employment[0].position = "เปลี่ยนแล้ว";
    expect(snapshot.person.firstNameTh).not.toBe("เปลี่ยนแล้ว");
    expect(snapshot.employment[0].position).not.toBe("เปลี่ยนแล้ว");
    expect(snapshot.capturedAt).toBe("2026-11-25T00:00:00.000Z");
  });
});
