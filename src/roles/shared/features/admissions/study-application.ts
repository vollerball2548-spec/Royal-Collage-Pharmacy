import {
  applicantFullName,
  type ApplicantSnapshot,
} from "@/roles/shared/features/applicant/profile";
import { createAdmissionDocuments, type AdmissionDocumentRequirement } from "./documents";
import {
  admissionWording,
  creditBankSubjectsFor,
  programOfferings,
  requiresRound,
  resolveStudyFlow,
  subjectKey,
  trainingInstitutionsFor,
  type ProgramGroup,
  type ProgramOffering,
  type ProgramRound,
} from "./program-offerings";

/**
 * ใบสมัครสอบคัดเลือกเพื่อเข้ารับการฝึกอบรม (ส่วนที่ 1–4) และใบสมัครเรียนกลุ่ม Credit Bank
 * เก็บเฉพาะ snapshot ณ วันยื่น — ข้อมูลส่วนที่ 1–2 ดึงจากฐานทะเบียนสภาเภสัชกรรม
 */
export interface StudyApplicationForm {
  offeringId: string;
  group: ProgramGroup;
  institutionId?: string;
  roundId?: string;
  /** รายวิชาที่เลือก (กลุ่ม Credit Bank) เก็บรหัส หรือชื่อวิชาเมื่อแบบฟอร์มไม่มีรหัส */
  subjects: string[];
  applicant: ApplicantSnapshot;
  declaration?: { accepted: true; signedName: string; signedAt: string };
}

export const STUDY_APPLICATION_DECLARATION = "ข้าพเจ้าขอรับรองว่าข้อความข้างต้นเป็นความจริงทุกประการ";

// ─── ส่วนที่ 4 การแนบหลักฐานประกอบการสมัคร ─────────────────────────────────────

const PATIENT_CARE_COLLEGES = new Set(["วภท.", "CPPM"]);

/** ทุกรายการที่อาจปรากฏในใบสมัคร — ใช้ตรวจข้อมูลที่อ่านกลับจาก localStorage */
export const studyDocumentRequirements: readonly AdmissionDocumentRequirement[] = [
  { id: "study-license", label: "สำเนาใบอนุญาตประกอบวิชาชีพเภสัชกรรม", required: true },
  { id: "study-employment-letter", label: "หนังสือรับรองประสบการณ์การทำงาน หรือหนังสือยินยอมจากหน่วยงานต้นสังกัด", required: true },
  {
    id: "study-patient-care-500h",
    label: "หลักฐานประสบการณ์การให้บริการทางวิชาชีพที่เกี่ยวข้องกับการดูแลผู้ป่วย ไม่น้อยกว่า 500 ชั่วโมง",
    required: true,
    hint: "สำหรับสาขาเภสัชบำบัดและสาขาเภสัชพันธุศาสตร์และเภสัชกรรมแม่นยำ",
  },
];

/** หลักฐานการชำระค่าธรรมเนียมแนบในขั้นชำระเงิน ไม่อยู่ในรายการนี้ */
export function studyDocumentRequirementsFor(offering: ProgramOffering) {
  return studyDocumentRequirements.filter((requirement) => (
    requirement.id !== "study-patient-care-500h" || (PATIENT_CARE_COLLEGES.has(offering.collegeCode) && offering.group !== "credit_bank")
  ));
}

export function createStudyApplicationDocuments(offering: ProgramOffering) {
  return createAdmissionDocuments(studyDocumentRequirementsFor(offering));
}

// ─── การตรวจความครบถ้วน ───────────────────────────────────────────────────────

export function studyApplicationErrors(
  form: StudyApplicationForm,
  offering: ProgramOffering,
  openRounds: readonly ProgramRound[],
): string[] {
  const errors: string[] = [];
  if (offering.requiresTrainingInstitution) {
    const allowed = trainingInstitutionsFor(offering).map((institution) => institution.id);
    if (allowed.length === 0) errors.push("หลักสูตรนี้ยังไม่มีสถาบันฝึกอบรมให้เลือก");
    else if (!form.institutionId || !allowed.includes(form.institutionId)) errors.push("กรุณาเลือกสถาบันฝึกอบรม");
  }
  if (requiresRound(offering)) {
    if (openRounds.length === 0) errors.push("หลักสูตรนี้ยังไม่เปิดรอบรับสมัคร");
    else if (!form.roundId || !openRounds.some((round) => round.id === form.roundId)) errors.push("กรุณาเลือกรอบรับสมัคร");
  }
  if (resolveStudyFlow(offering).kind === "credit_bank_program") {
    const allowed = new Set(creditBankSubjectsFor(offering).map(subjectKey));
    if (form.subjects.length === 0) errors.push("กรุณาเลือกรายวิชาอย่างน้อย 1 รายวิชา");
    else if (form.subjects.some((subject) => !allowed.has(subject))) errors.push("มีรายวิชาที่ไม่อยู่ในรายการของสาขานี้");
  }
  if (!/^0\d{8,9}$/.test(form.applicant.person.mobilePhone.replace(/[-\s]/g, ""))) errors.push("กรุณากรอกเบอร์โทรศัพท์มือถือให้ถูกต้อง");
  if (form.applicant.workplace.organisation.trim() === "") errors.push("กรุณากรอกสถานที่ปฏิบัติงานปัจจุบัน");
  if (!form.declaration?.accepted) errors.push("กรุณายืนยันการรับรองความถูกต้อง");
  else if (form.declaration.signedName.trim() !== applicantFullName(form.applicant.person)) {
    errors.push(`กรุณาพิมพ์ชื่อ-นามสกุลให้ตรงกับ "${applicantFullName(form.applicant.person)}"`);
  }
  return errors;
}

// ─── การแสดงผลในหน้าสถานะ ──────────────────────────────────────────────────────

export function findOffering(id: string | undefined) {
  return id ? programOfferings.find((item) => item.id === id) : undefined;
}

/** ใบสมัครกลุ่ม Credit Bank ไม่ใช่การสมัครสอบคัดเลือก */
export function studyApplicationKindLabel(form: StudyApplicationForm | undefined) {
  const offering = findOffering(form?.offeringId);
  return offering && resolveStudyFlow(offering).kind === "credit_bank_program"
    ? `${admissionWording.study} (Credit Bank)`
    : admissionWording.entranceExam;
}

// shortcut: ใบสมัครสอบคัดเลือกเดิมที่สร้างก่อนมีแบบฟอร์มดิจิทัลไม่รู้หลักสูตร จึงใช้ 500 บาทตามสรุปประชุม — ตัดออกเมื่อย้ายข้อมูลเก่าครบ
export const LEGACY_ENTRANCE_EXAM_FEE = 500;

/** undefined = ไม่มีค่าสมัครสอบ หรือแบบฟอร์มยังไม่ระบุอัตรา → ยังไม่เปิดชำระ */
export function studyApplicationFee(form: StudyApplicationForm | undefined) {
  if (!form) return LEGACY_ENTRANCE_EXAM_FEE;
  return findOffering(form.offeringId)?.examFee;
}

// ─── ตรวจข้อมูลที่อ่านกลับจาก localStorage ─────────────────────────────────────

const GROUPS: readonly ProgramGroup[] = ["residency", "higher_diploma", "credit_bank", "short_course"];

export function isStudyApplicationForm(value: unknown): value is StudyApplicationForm {
  if (!value || typeof value !== "object") return false;
  const form = value as Record<string, unknown>;
  const applicant = form.applicant as Record<string, unknown> | undefined;
  return typeof form.offeringId === "string" &&
    GROUPS.includes(form.group as ProgramGroup) &&
    (form.institutionId === undefined || typeof form.institutionId === "string") &&
    (form.roundId === undefined || typeof form.roundId === "string") &&
    Array.isArray(form.subjects) && form.subjects.every((subject) => typeof subject === "string") &&
    Boolean(applicant) && typeof applicant === "object" &&
    typeof applicant?.capturedAt === "string" &&
    typeof applicant?.person === "object" && typeof applicant?.workplace === "object";
}
