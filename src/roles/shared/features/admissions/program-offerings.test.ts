import { describe, expect, it } from "vitest";

import type { AdmissionExamResult } from "./admission-exam-workflow";
import {
  applicationRouteFor,
  approvalExamOfferings,
  canEnrollAfterEntranceExam,
  findApprovalExamOffering,
  programOfferings,
  resolveStudyFlow,
  studyOfferings,
  trainingInstitutionsFor,
  type ProgramOffering,
} from "./program-offerings";

const base: Omit<ProgramOffering, "type" | "admissionMethod" | "creditBankEligible" | "requiresTrainingInstitution"> = {
  id: "TEST",
  collegeCode: "วภท.",
  titleTh: "หลักสูตรทดสอบ",
  specialty: "ทดสอบ",
};

function result(partial: Partial<AdmissionExamResult>): AdmissionExamResult {
  return { id: "R", roundId: "ROUND", admissionId: "APP-1", status: "published", updatedAt: "2026-01-01T00:00:00.000Z", revisions: [], ...partial };
}

describe("program offerings", () => {
  it("routes each program type to the right flow from data only", () => {
    expect(resolveStudyFlow({ ...base, type: "short_course", admissionMethod: "direct_enrollment", creditBankEligible: false, requiresTrainingInstitution: false }).kind)
      .toBe("short_course");
    expect(resolveStudyFlow({ ...base, type: "short_course", admissionMethod: "direct_enrollment", creditBankEligible: true, requiresTrainingInstitution: false }).kind)
      .toBe("short_course_credit_bank");
    expect(resolveStudyFlow({ ...base, type: "advanced_program", admissionMethod: "entrance_exam", creditBankEligible: false, requiresTrainingInstitution: true }).kind)
      .toBe("entrance_exam");
    expect(resolveStudyFlow({ ...base, type: "board_certification", admissionMethod: "entrance_exam", creditBankEligible: true, requiresTrainingInstitution: false }).kind)
      .toBe("entrance_exam");
    expect(() => resolveStudyFlow({ ...base, type: "approval_exam", admissionMethod: "approval_exam", creditBankEligible: false, requiresTrainingInstitution: false }))
      .toThrow(/สมัครสอบอนุมัติ/);
  });

  it("derives admission method from program type and agrees with the application routes", () => {
    for (const item of programOfferings) {
      const expected = { short_course: "direct_enrollment", advanced_program: "entrance_exam", board_certification: "entrance_exam", approval_exam: "approval_exam" }[item.type];
      expect(item.admissionMethod, item.id).toBe(expected);
    }
    const route = (item: ProgramOffering) => applicationRouteFor(item);
    expect(programOfferings.filter((item) => item.type === "short_course").map(route))
      .toEqual(expect.arrayContaining(["short_course", "short_course_credit_bank"]));
    expect(new Set(programOfferings.filter((item) => item.admissionMethod === "entrance_exam").map(route))).toEqual(new Set(["entrance_exam"]));
    expect(new Set(approvalExamOfferings().map(route))).toEqual(new Set(["approval_exam"]));
  });

  it("keeps approval exams out of study offerings and vice versa", () => {
    expect(studyOfferings().some((item) => item.type === "approval_exam")).toBe(false);
    expect(approvalExamOfferings().every((item) => item.type === "approval_exam")).toBe(true);
    expect(approvalExamOfferings()).toHaveLength(7);
    expect(studyOfferings("CPAT").every((item) => item.collegeCode === "CPAT")).toBe(true);
  });

  it("shows the extraordinary-membership step only for credit-bank short courses", () => {
    const creditBank = programOfferings.find((item) => item.type === "short_course" && item.creditBankEligible)!;
    const standard = programOfferings.find((item) => item.type === "short_course" && !item.creditBankEligible)!;

    expect(resolveStudyFlow(creditBank).steps).toContain("ขึ้นทะเบียนสมาชิกวิสามัญ");
    expect(resolveStudyFlow(standard).steps).not.toContain("ขึ้นทะเบียนสมาชิกวิสามัญ");
  });

  it("asks for a training institution only when the program requires one", () => {
    const residency = programOfferings.find((item) => item.id === "board:วภท.")!;
    const creditBankBoard = programOfferings.find((item) => item.id === "board:CPAT")!;

    expect(resolveStudyFlow(residency).steps[0]).toBe("เลือกสถาบันฝึกอบรม");
    expect(trainingInstitutionsFor(residency).map((org) => org.id)).toContain("org-inst-siriraj");
    expect(resolveStudyFlow(creditBankBoard).steps).not.toContain("เลือกสถาบันฝึกอบรม");
    expect(trainingInstitutionsFor(creditBankBoard)).toEqual([]);
  });

  it("shows enrol-after-entrance only for a published passed entrance result", () => {
    const study = { id: "APP-1", applicationType: "study" as const };

    expect(canEnrollAfterEntranceExam(study, [result({ currentDecision: "passed" })])).toBe(true);
    expect(canEnrollAfterEntranceExam(study, [result({ currentDecision: "passed", status: "revised" })])).toBe(true);
    expect(canEnrollAfterEntranceExam(study, [result({ status: "draft", draftDecision: "passed" })])).toBe(false);
    expect(canEnrollAfterEntranceExam(study, [result({ currentDecision: "failed" })])).toBe(false);
    expect(canEnrollAfterEntranceExam(study, [result({ currentDecision: "passed", admissionId: "OTHER" })])).toBe(false);
    expect(canEnrollAfterEntranceExam({ id: "APP-1", applicationType: "exam" }, [result({ currentDecision: "passed" })])).toBe(false);
  });

  it("matches legacy admission program names to approval-exam offerings", () => {
    expect(findApprovalExamOffering("เภสัชบำบัด")?.id).toBe("approval:วภท.");
    expect(findApprovalExamOffering("การคุ้มครองผู้บริโภค")?.id).toBe("approval:วคบท.");
    expect(findApprovalExamOffering("approval:CPAT")?.examFee).toBe(1500);
    expect(findApprovalExamOffering("")).toBeUndefined();
  });
});
