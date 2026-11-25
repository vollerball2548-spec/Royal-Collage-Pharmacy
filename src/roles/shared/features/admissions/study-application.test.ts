import { describe, expect, it } from "vitest";

import { currentApplicantProfile, snapshotApplicant } from "@/roles/shared/features/applicant/profile";
import { ORGANISATIONS } from "@/roles/shared/features/roles/access-model";
import {
  applicationRouteFor,
  creditBankSubjectsFor,
  offeringsForSpecialty,
  offeringsInGroup,
  openRoundsFor,
  programOfferings,
  resolveStudyFlow,
  specialtiesInGroup,
  subjectKey,
  trainingInstitutionsFor,
  type ProgramOffering,
} from "./program-offerings";
import {
  isStudyApplicationForm,
  LEGACY_ENTRANCE_EXAM_FEE,
  studyApplicationErrors,
  studyApplicationFee,
  studyApplicationKindLabel,
  studyDocumentRequirementsFor,
  type StudyApplicationForm,
} from "./study-application";

const byId = (id: string) => programOfferings.find((item) => item.id === id)!;
const residency = byId("board:วภท.");
const higherDiploma = byId("advanced:วภท.");
const pgx = byId("board:CPPM");
const cpatBoard = byId("board:CPAT");

function formFor(offering: ProgramOffering, patch: Partial<StudyApplicationForm> = {}): StudyApplicationForm {
  return {
    offeringId: offering.id,
    group: offering.group!,
    subjects: [],
    applicant: snapshotApplicant(currentApplicantProfile(), "2026-11-25T00:00:00.000Z"),
    declaration: { accepted: true, signedName: "ภก.สมชาย ใจดี", signedAt: "2026-11-25T00:00:00.000Z" },
    ...patch,
  };
}

describe("program groups from the entrance form", () => {
  it("places programs in groups 1–3 and keeps approval exams out", () => {
    expect(specialtiesInGroup("residency").map((item) => item.collegeCode)).toEqual(["วภท.", "CPPM"]);
    expect(specialtiesInGroup("higher_diploma").map((item) => item.collegeCode)).toEqual(["วภท."]);
    expect(offeringsInGroup("credit_bank").filter((item) => item.type === "board_certification").map((item) => item.collegeCode).sort())
      .toEqual(["CIPT", "CPAT", "วคบท.", "วภช.", "สมุนไพร"].sort());
    expect(programOfferings.filter((item) => item.type === "approval_exam").every((item) => item.group === undefined)).toBe(true);
  });

  it("lists the training institutions exactly as the form does", () => {
    expect(trainingInstitutionsFor(residency)).toHaveLength(9);
    expect(trainingInstitutionsFor(higherDiploma)).toHaveLength(6);
    expect(trainingInstitutionsFor(higherDiploma).map((org) => org.id)).not.toContain(ORGANISATIONS.pharmacyNU.id);
    expect(trainingInstitutionsFor(pgx).map((org) => org.id)).toEqual([ORGANISATIONS.ramathibodi.id]);
    expect(trainingInstitutionsFor(cpatBoard)).toEqual([]);
  });

  it("routes credit-bank board programs to study-and-accumulate, not the entrance exam", () => {
    expect(resolveStudyFlow(cpatBoard).kind).toBe("credit_bank_program");
    expect(applicationRouteFor(cpatBoard)).toBe("short_course_credit_bank");
    expect(resolveStudyFlow(residency).kind).toBe("entrance_exam");
    expect(resolveStudyFlow(higherDiploma).kind).toBe("entrance_exam");
  });

  it("uses fees only where the form states one", () => {
    expect(residency.examFee).toBe(1000);
    expect(pgx.examFee).toBeUndefined();
    expect(higherDiploma.examFee).toBeUndefined();
    expect(cpatBoard.examFee).toBeUndefined();
  });

  it("closes every round when admissions are closed", () => {
    expect(openRoundsFor(residency, true)).toHaveLength(1);
    expect(openRoundsFor(residency, false)).toEqual([]);
    expect(offeringsForSpecialty("short_course", "วภท.").every((item) => openRoundsFor(item, true).length === 0)).toBe(true);
  });

  it("offers the form's subject list only for credit-bank board programs", () => {
    expect(creditBankSubjectsFor(byId("board:วภช.")).map(subjectKey)).toEqual(["CCPT101", "CCPT301"]);
    expect(creditBankSubjectsFor(byId("board:สมุนไพร")).every((subject) => subject.code === undefined)).toBe(true);
    expect(creditBankSubjectsFor(residency)).toEqual([]);
  });
});

describe("study application form", () => {
  it("requires an institution and a round for residency", () => {
    const rounds = openRoundsFor(residency, true);
    const errors = studyApplicationErrors(formFor(residency), residency, rounds);
    expect(errors).toEqual(expect.arrayContaining(["กรุณาเลือกสถาบันฝึกอบรม", "กรุณาเลือกรอบรับสมัคร"]));
    expect(studyApplicationErrors(formFor(residency, { institutionId: ORGANISATIONS.chula.id, roundId: rounds[0].id }), residency, rounds)).toEqual([]);
  });

  it("rejects an institution that is not on the program's list", () => {
    const rounds = openRoundsFor(higherDiploma, true);
    const form = formFor(higherDiploma, { institutionId: ORGANISATIONS.pharmacyNU.id, roundId: rounds[0].id });
    expect(studyApplicationErrors(form, higherDiploma, rounds)).toContain("กรุณาเลือกสถาบันฝึกอบรม");
  });

  it("requires at least one subject from the college's list for credit-bank programs", () => {
    const rounds = openRoundsFor(cpatBoard, true);
    const base = { roundId: rounds[0].id };
    expect(studyApplicationErrors(formFor(cpatBoard, base), cpatBoard, rounds)).toContain("กรุณาเลือกรายวิชาอย่างน้อย 1 รายวิชา");
    expect(studyApplicationErrors(formFor(cpatBoard, { ...base, subjects: ["CCPT101"] }), cpatBoard, rounds)).toContain("มีรายวิชาที่ไม่อยู่ในรายการของสาขานี้");
    expect(studyApplicationErrors(formFor(cpatBoard, { ...base, subjects: ["CPAT201"] }), cpatBoard, rounds)).toEqual([]);
  });

  it("blocks submission when admissions are closed or the signature does not match", () => {
    expect(studyApplicationErrors(formFor(cpatBoard, { subjects: ["CPAT201"] }), cpatBoard, [])).toContain("หลักสูตรนี้ยังไม่เปิดรอบรับสมัคร");
    const unsigned = formFor(cpatBoard, { subjects: ["CPAT201"], roundId: openRoundsFor(cpatBoard, true)[0].id, declaration: { accepted: true, signedName: "x", signedAt: "" } });
    expect(studyApplicationErrors(unsigned, cpatBoard, openRoundsFor(cpatBoard, true))).toHaveLength(1);
  });

  it("asks for 500 patient-care hours only for pharmacotherapy and PGx residency", () => {
    const ids = (offering: ProgramOffering) => studyDocumentRequirementsFor(offering).map((item) => item.id);
    expect(ids(residency)).toContain("study-patient-care-500h");
    expect(ids(pgx)).toContain("study-patient-care-500h");
    expect(ids(cpatBoard)).not.toContain("study-patient-care-500h");
  });

  it("labels and prices applications from their own program", () => {
    expect(studyApplicationKindLabel(formFor(cpatBoard))).toBe("สมัครเรียน (Credit Bank)");
    expect(studyApplicationKindLabel(formFor(residency))).toBe("สมัครสอบคัดเลือก");
    expect(studyApplicationFee(formFor(residency))).toBe(1000);
    expect(studyApplicationFee(formFor(pgx))).toBeUndefined();
    expect(studyApplicationFee(undefined)).toBe(LEGACY_ENTRANCE_EXAM_FEE);
  });

  it("round-trips through storage and rejects malformed data", () => {
    expect(isStudyApplicationForm(JSON.parse(JSON.stringify(formFor(residency))))).toBe(true);
    expect(isStudyApplicationForm({ ...formFor(residency), group: "other" })).toBe(false);
    expect(isStudyApplicationForm({ ...formFor(residency), subjects: [1] })).toBe(false);
  });
});
