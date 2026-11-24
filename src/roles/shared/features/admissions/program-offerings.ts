/**
 * รายการที่เปิดรับสมัครในหน้า "สมัครเรียน / สมัครสอบ" และกติกาเลือก flow
 *
 * หน้าจอไม่ตัดสินเองว่าต้องสอบคัดเลือกหรือไม่ — อ่านจาก `type` / `admissionMethod` ของรายการนี้เท่านั้น
 * แหล่งข้อมูล: Short Course จาก `courseCatalog` (mock เดิม), วุฒิบัตรจากถังหลักสูตรที่นำเข้าจาก Excel,
 * ป.ชั้นสูงและรายการสอบอนุมัติจากแบบฟอร์มกลางของราชวิทยาลัย
 */
import { COLLEGE_OPTIONS, type CollegeCode } from "@/roles/shared/data/college-directory";
import { curriculumPrograms } from "@/roles/shared/data/curriculum";
import { courseCatalog, type ShortCourseDefinition } from "@/roles/shared/features/courses/course-catalog";
import {
  ORGANISATION_LIST,
  ORGANISATIONS,
  type OrganisationScope,
} from "@/roles/shared/features/roles/access-model";

import type { AdmissionExamResult } from "./admission-exam-workflow";
import { resolveApplicationRoute, type ApplicationRoute, type CredentialTrack } from "./application";

export type ProgramType = "short_course" | "advanced_program" | "board_certification" | "approval_exam";
export type AdmissionMethod = "direct_enrollment" | "entrance_exam" | "approval_exam";

export const programTypeLabel: Readonly<Record<ProgramType, string>> = {
  short_course: "หลักสูตรระยะสั้น (4 เดือน)",
  advanced_program: "ประกาศนียบัตรชั้นสูง (1 ปี)",
  board_certification: "วุฒิบัตร (4 ปี)",
  approval_exam: "สอบหนังสืออนุมัติ",
};

/** ถ้อยคำที่ใช้ร่วมกันทุกหน้า — ห้ามใช้คำว่า "สอบ" เดี่ยว ๆ */
export const admissionWording = {
  hub: "สมัครเรียน / สมัครสอบ",
  study: "สมัครเรียน",
  entranceExam: "สมัครสอบคัดเลือก",
  approvalExam: "สมัครสอบอนุมัติ",
  inStudyExam: "สอบระหว่างเรียน",
  enrollAfterEntrance: "ลงทะเบียนเข้าเรียน",
} as const;

export interface ProgramOffering {
  id: string;
  collegeCode: CollegeCode;
  titleTh: string;
  titleEn?: string;
  /** ชื่อสาขา ใช้จับคู่กับ `Admission.program` ของข้อมูลเดิม */
  specialty: string;
  type: ProgramType;
  admissionMethod: AdmissionMethod;
  creditBankEligible: boolean;
  requiresTrainingInstitution: boolean;
  credits?: number;
  /** id ใน courseCatalog สำหรับ Short Course (ใช้ workflow สมัคร Short Course เดิม) */
  shortCourseId?: string;
  /** ค่าสมัครสอบ (บาท) — มีเฉพาะรายการที่ต้องสอบ */
  examFee?: number;
}

const COLLEGE_ORGANISATION_IDS: Readonly<Record<CollegeCode, string>> = {
  "วภท.": ORGANISATIONS.therapeuticCollege.id,
  "วคบท.": ORGANISATIONS.consumerProtectionCollege.id,
  สมุนไพร: ORGANISATIONS.herbalCollege.id,
  CIPT: ORGANISATIONS.industrialCollege.id,
  "วภช.": ORGANISATIONS.communityCollege.id,
  CPAT: ORGANISATIONS.administrationCollege.id,
  CPPM: ORGANISATIONS.precisionMedicineCollege.id,
};

const ADMISSION_METHOD: Readonly<Record<ProgramType, AdmissionMethod>> = {
  short_course: "direct_enrollment",
  advanced_program: "entrance_exam",
  board_certification: "entrance_exam",
  approval_exam: "approval_exam",
};

const CREDENTIAL_TRACK: Readonly<Record<ProgramType, CredentialTrack>> = {
  short_course: "certificate",
  advanced_program: "higher_certificate",
  board_certification: "board_certificate",
  approval_exam: "approval",
};

// TODO(business): ค่าสมัครสอบคัดเลือก 500 บาทมาจากสรุปประชุม ยังไม่มีระเบียบรองรับ — รอเจ้าหน้าที่ราชวิทยาลัยยืนยัน
export const ENTRANCE_EXAM_FEE = 500;
// TODO(business): ค่าสมัครสอบอนุมัติรายวิทยาลัยมาจาก "ตาราง ข้อมูลการรับสมัครสอบหนังสืออนุมัติ" (ระบุว่าโอนเข้าบัญชีสภาเภสัชกรรม)
// แต่สรุปประชุมระบุ 500 บาทเข้าบัญชีราชวิทยาลัย — ต้องยืนยันว่าใช้อัตราใดและเข้าบัญชีใด
const APPROVAL_EXAM_FEES: Readonly<Record<CollegeCode, number>> = {
  "วภท.": 7_500,
  "วคบท.": 1_500,
  สมุนไพร: 1_500,
  CIPT: 1_500,
  CPAT: 1_500,
  "วภช.": 2_500,
  CPPM: 1_500,
};

function collegeSpecialty(collegeCode: CollegeCode) {
  const name = COLLEGE_OPTIONS.find((option) => option.value === collegeCode)?.name ?? collegeCode;
  return name.replace(/^วิทยาลัย/, "");
}

function offering(input: Omit<ProgramOffering, "admissionMethod">): ProgramOffering {
  return { ...input, admissionMethod: ADMISSION_METHOD[input.type] };
}

function shortCourseOffering(course: ShortCourseDefinition): ProgramOffering {
  return offering({
    id: `short:${course.id}`,
    collegeCode: course.collegeCode,
    titleTh: course.titleTh,
    titleEn: course.titleEn,
    specialty: course.titleTh,
    type: "short_course",
    creditBankEligible: course.shortCourseTrack === "advanced",
    requiresTrainingInstitution: false,
    credits: course.credits,
    shortCourseId: course.id,
  });
}

export const programOfferings: readonly ProgramOffering[] = [
  ...courseCatalog
    .filter((course): course is ShortCourseDefinition => course.kind === "short_course" && course.status === "active")
    .map(shortCourseOffering),
  // ป.ชั้นสูง 1 ปี: ใบสมัครกลางเปิดเฉพาะสาขาเภสัชบำบัด
  offering({
    id: "advanced:วภท.",
    collegeCode: "วภท.",
    titleTh: "ประกาศนียบัตรวิชาชีพเภสัชกรรมชั้นสูง สาขาเภสัชบำบัด",
    titleEn: "Higher Graduate Diploma in Pharmacotherapy",
    specialty: "เภสัชบำบัด",
    type: "advanced_program",
    creditBankEligible: false,
    requiresTrainingInstitution: true,
    examFee: ENTRANCE_EXAM_FEE,
  }),
  ...curriculumPrograms.map((program) => offering({
    id: `board:${program.collegeCode}`,
    collegeCode: program.collegeCode,
    titleTh: program.credentialTh ?? program.titleTh ?? collegeSpecialty(program.collegeCode),
    titleEn: program.credentialEn ?? undefined,
    specialty: collegeSpecialty(program.collegeCode),
    type: "board_certification",
    creditBankEligible: program.system === "credit_bank",
    // TODO(business): หลักสูตรระบบ Credit Bank ไม่ได้ให้เลือกสถาบันในใบสมัครกลาง — ยืนยันว่าไม่ต้องจองที่นั่งรายสถาบัน
    requiresTrainingInstitution: program.system === "residency",
    credits: program.minCredits ?? undefined,
    examFee: ENTRANCE_EXAM_FEE,
  })),
  ...COLLEGE_OPTIONS.map((college) => offering({
    id: `approval:${college.value}`,
    collegeCode: college.value,
    titleTh: `หนังสืออนุมัติ สาขา${collegeSpecialty(college.value)}`,
    specialty: collegeSpecialty(college.value),
    type: "approval_exam",
    creditBankEligible: false,
    requiresTrainingInstitution: false,
    examFee: APPROVAL_EXAM_FEES[college.value],
  })),
];

/** รายการสำหรับปุ่ม "สมัครเรียน" — ไม่รวมรายการสอบอนุมัติ */
export function studyOfferings(collegeCode?: CollegeCode, offerings: readonly ProgramOffering[] = programOfferings) {
  return offerings.filter((item) => item.admissionMethod !== "approval_exam" && (!collegeCode || item.collegeCode === collegeCode));
}

/** รายการสำหรับปุ่ม "สมัครสอบอนุมัติ" เท่านั้น */
export function approvalExamOfferings(offerings: readonly ProgramOffering[] = programOfferings) {
  return offerings.filter((item) => item.admissionMethod === "approval_exam");
}

export function findApprovalExamOffering(program: string, offerings: readonly ProgramOffering[] = programOfferings) {
  const normalized = program.trim();
  if (!normalized) return undefined;
  return approvalExamOfferings(offerings).find((item) => (
    normalized === item.id || normalized.includes(item.specialty) || item.specialty.includes(normalized)
  ));
}

export function trainingInstitutionsFor(offering: ProgramOffering): OrganisationScope[] {
  if (!offering.requiresTrainingInstitution) return [];
  const collegeId = COLLEGE_ORGANISATION_IDS[offering.collegeCode];
  return ORGANISATION_LIST.filter((organisation) => organisation.kind === "institution" && organisation.parentId === collegeId);
}

export function applicationRouteFor(offering: Pick<ProgramOffering, "type" | "creditBankEligible">): ApplicationRoute {
  return resolveApplicationRoute({ track: CREDENTIAL_TRACK[offering.type], creditBank: offering.creditBankEligible });
}

export type StudyFlowKind = "short_course" | "short_course_credit_bank" | "entrance_exam";

export interface StudyFlow {
  kind: StudyFlowKind;
  steps: readonly string[];
  /** ข้อความปุ่มดำเนินการต่อ */
  actionLabel: string;
}

/** เลือก flow ของปุ่ม "สมัครเรียน" จากข้อมูลหลักสูตร */
export function resolveStudyFlow(offering: ProgramOffering): StudyFlow {
  if (offering.admissionMethod === "approval_exam") {
    throw new Error("รายการสอบอนุมัติต้องสมัครผ่านปุ่มสมัครสอบอนุมัติ");
  }
  if (offering.admissionMethod === "entrance_exam") {
    return {
      kind: "entrance_exam",
      steps: [
        ...(offering.requiresTrainingInstitution ? ["เลือกสถาบันฝึกอบรม"] : []),
        admissionWording.entranceExam,
        "ชำระค่าสมัครสอบ",
        "รอผลสอบคัดเลือก",
        `ผ่าน → ${admissionWording.enrollAfterEntrance}`,
        "ชำระค่าลงทะเบียน",
        "สมาชิกวิสามัญ",
      ],
      actionLabel: admissionWording.entranceExam,
    };
  }
  if (offering.creditBankEligible) {
    return {
      kind: "short_course_credit_bank",
      // TODO(business): สรุปประชุมระบุ "ชำระค่าคอร์สก่อนแล้วจึงขึ้นทะเบียนวิสามัญ" แต่ flow ที่กำหนดให้ทำระบุวิสามัญก่อนชำระ — ยืนยันลำดับ
      steps: ["สมัคร", "ขึ้นทะเบียนสมาชิกวิสามัญ", "ชำระเงิน", "เรียน", "สะสมหน่วยกิต (Credit Bank)"],
      actionLabel: "สมัครเรียน Short Course",
    };
  }
  return {
    kind: "short_course",
    steps: ["สมัคร", "ชำระเงิน", "เริ่มเรียน"],
    actionLabel: "สมัครเรียน Short Course",
  };
}

export const approvalExamSteps = [
  "เลือกรายการสอบอนุมัติ",
  "ตรวจคุณสมบัติ",
  "ยื่นคำขอและเอกสาร",
  "ชำระค่าสมัครสอบ",
  "ประกาศสิทธิ์สอบ → สอบ → ประกาศผล",
  "ผ่าน → ออกหนังสืออนุมัติ",
  "ขึ้นทะเบียนสมาชิกสามัญ",
] as const;

interface ApplicationLike {
  id: string;
  applicationType: "exam" | "study";
}

/** ผลสอบคัดเลือกที่ประกาศแล้วของใบสมัคร (draft ไม่นับ) */
export function publishedEntranceResult(application: ApplicationLike, results: readonly AdmissionExamResult[]) {
  if (application.applicationType !== "study") return undefined;
  return results.find((result) => (
    result.admissionId === application.id &&
    (result.status === "published" || result.status === "revised")
  ));
}

/** แสดงปุ่ม "ลงทะเบียนเข้าเรียน" เฉพาะผู้สมัครสอบคัดเลือกที่ผลประกาศแล้วว่าผ่าน */
export function canEnrollAfterEntranceExam(application: ApplicationLike, results: readonly AdmissionExamResult[]) {
  return publishedEntranceResult(application, results)?.currentDecision === "passed";
}
