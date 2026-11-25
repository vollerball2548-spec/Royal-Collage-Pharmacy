import type { CollegeCode } from "@/roles/shared/data/college-directory";
import { prefillAnswers } from "@/domain/forms/prefill";
import type { FormContext, FormTemplate } from "@/domain/forms/schema";
import { approvalExamTemplate, entranceTemplate, shortCourseTemplate } from "@/domain/forms/templates";
import { applicantPrefillSource } from "@/domain/forms/templates/applicant-fields";
import {
  creditBankSubjectsFor,
  programOfferings,
  subjectKey,
  type ProgramOffering,
} from "@/roles/shared/features/admissions/program-offerings";
import type { ApplicantProfile } from "@/roles/shared/features/applicant/profile";
import { applicantFullName } from "@/roles/shared/features/applicant/profile";
import { courseCatalog, type ShortCourseDefinition } from "@/roles/shared/features/courses/course-catalog";
import { shortCourseFee } from "@/roles/shared/features/short-course/workflow";
import { syncDocuments } from "./workflow";
import type { Application, ApplicationActor, ApplicationKind } from "./model";

/** หลักสูตรในเส้นทาง "สมัครเรียน": Short Course (ต่อยอด/ไม่ต่อยอด) และวุฒิบัตรระบบ Credit Bank */
export function studyOfferings(extra: readonly ProgramOffering[] = []) {
  return [...programOfferings, ...extra].filter((item) => item.admissionMethod === "direct_enrollment");
}

/** หลักสูตรที่ต้องสอบคัดเลือก: ป.ชั้นสูง 1 ปี และวุฒิบัตร 4 ปี (Residency) */
export function entranceOfferings() {
  return programOfferings.filter((item) => item.admissionMethod === "entrance_exam");
}

export function approvalOfferings() {
  return programOfferings.filter((item) => item.admissionMethod === "approval_exam");
}

function subjectOptions(offering: Pick<ProgramOffering, "id">) {
  const source = programOfferings.find((item) => item.id === offering.id);
  return source ? creditBankSubjectsFor(source).map((subject) => ({ value: subjectKey(subject), label: subject.code ? `${subject.code} ${subject.titleTh}` : subject.titleTh })) : [];
}

export function templateFor(kind: ApplicationKind, offering: Pick<ProgramOffering, "id" | "collegeCode" | "creditBankEligible">): FormTemplate {
  if (kind === "approval_exam") return approvalExamTemplate(offering.collegeCode);
  if (kind === "entrance_exam") return entranceTemplate;
  // TODO(business): หลักสูตรเดียวกันเปิดทั้งแบบต่อยอดและไม่ต่อยอดได้หรือไม่ — ตอนนี้แต่ละหลักสูตรมีประเภทเดียวตามข้อมูลหลักสูตร
  return shortCourseTemplate({ tracks: [offering.creditBankEligible ? "credit_bank" : "standard"], subjects: subjectOptions(offering) });
}

export function templateForApplication(application: Pick<Application, "kind" | "offeringId" | "collegeCode" | "context">) {
  return templateFor(application.kind, {
    id: application.offeringId,
    collegeCode: application.collegeCode as CollegeCode,
    creditBankEligible: application.context.creditBank === true,
  });
}

/** ค่าธรรมเนียมจากแหล่งข้อมูลจริงเท่านั้น; ไม่มีอัตรา = undefined (เจ้าหน้าที่กำหนดก่อนเปิดชำระ) */
export function feesFor(kind: ApplicationKind, offering: ProgramOffering): Application["fees"] {
  if (kind !== "study") return { application: offering.examFee };
  const course = courseCatalog.find((item): item is ShortCourseDefinition => item.kind === "short_course" && item.id === offering.shortCourseId);
  // TODO(business): วุฒิบัตรระบบ Credit Bank และหลักสูตรจากคำขอเปิดหลักสูตรยังไม่มีอัตราค่าลงทะเบียน
  return { application: course ? shortCourseFee(course).amount : undefined };
}

export function contextFor(kind: ApplicationKind, offering: ProgramOffering): FormContext {
  return {
    kind,
    collegeCode: offering.collegeCode,
    group: offering.group,
    creditBank: offering.creditBankEligible,
    offeringId: offering.id,
  };
}

export function createDraftApplication(input: {
  id: string;
  kind: ApplicationKind;
  offering: ProgramOffering;
  profile: ApplicantProfile;
  actor: ApplicationActor;
  at: string;
  institution?: { id: string; name: string };
  round?: { id: string; label: string };
}): Application {
  const template = templateFor(input.kind, input.offering);
  const context = contextFor(input.kind, input.offering);
  const answers = prefillAnswers(template, applicantPrefillSource(input.profile));
  if (input.kind === "study") answers.courseTrack = input.offering.creditBankEligible ? "credit_bank" : "standard";
  return {
    id: input.id,
    kind: input.kind,
    templateId: template.id,
    templateVersion: template.version,
    applicantId: input.actor.userId,
    applicantName: applicantFullName(input.profile.person),
    licenseNumber: input.profile.license.licenseNumber,
    offeringId: input.offering.id,
    offeringTitle: input.offering.titleTh,
    collegeCode: input.offering.collegeCode,
    ...(input.institution ? { institutionId: input.institution.id, institutionName: input.institution.name } : {}),
    ...(input.round ? { roundId: input.round.id, roundLabel: input.round.label } : {}),
    context,
    answers,
    documents: syncDocuments(template, answers, context),
    fees: feesFor(input.kind, input.offering),
    payments: [],
    status: "draft",
    createdAt: input.at,
    updatedAt: input.at,
    history: [{ at: input.at, actorId: input.actor.userId, actorName: input.actor.userName, actorRole: input.actor.role, action: "create", to: "draft" }],
  };
}
