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
  ORGANISATIONS,
  type OrganisationScope,
} from "@/roles/shared/features/roles/access-model";

import type { AdmissionExamResult } from "./admission-exam-workflow";
import { resolveApplicationRoute, type ApplicationRoute, type CredentialTrack } from "./application";

export type ProgramType = "short_course" | "advanced_program" | "board_certification" | "approval_exam";
/** กลุ่มหลักสูตรตามใบสมัครสอบคัดเลือก (กลุ่มที่ 1–3) + หลักสูตรระยะสั้นแบบสมัครตรง */
export type ProgramGroup = "residency" | "higher_diploma" | "credit_bank" | "short_course";
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
  /** ค่าสมัครสอบ (บาท) — มีเฉพาะรายการที่ต้องสอบและแบบฟอร์มระบุอัตราไว้ */
  examFee?: number;
  /** กลุ่มหลักสูตร — ไม่มีค่าสำหรับรายการสอบอนุมัติ */
  group?: ProgramGroup;
}

export const programGroupMeta: Readonly<Record<ProgramGroup, { label: string; labelEn: string; description: string }>> = {
  residency: {
    label: "การฝึกอบรมระบบปฏิบัติงานประจำ",
    labelEn: "Residency Program",
    description: "เน้นการฝึกปฏิบัติงานวิชาชีพอย่างเข้มข้นในสถาบันฝึกอบรมหรือหอผู้ป่วย ระยะเวลาฝึกอบรม 4 ปี",
  },
  higher_diploma: {
    label: "การฝึกอบรมระบบปฏิบัติงานประจำ",
    labelEn: "Higher Graduate Diploma",
    description: "เน้นการฝึกปฏิบัติงานวิชาชีพอย่างเข้มข้นในสถาบันฝึกอบรมหรือหอผู้ป่วย ระยะเวลาฝึกอบรม 1 ปี",
  },
  credit_bank: {
    label: "การฝึกอบรมระบบสะสมหน่วยกิต",
    labelEn: "Credit Bank / Modular System",
    description: "เลือกรายวิชาหรือหลักสูตรระยะสั้นเพื่อสะสมหน่วยกิต วุฒิบัตรต้องผ่านการฝึกอบรมระยะสั้น 4 หลักสูตร และจัดทำโครงการวิจัยเชิงปฏิบัติการ",
  },
  short_course: {
    label: "หลักสูตรระยะสั้นแบบสมัครตรง",
    labelEn: "Short Course",
    description: "สมัครและชำระเงินแล้วเริ่มเรียนได้ ไม่สะสมหน่วยกิต",
  },
};

export const PROGRAM_GROUPS: readonly ProgramGroup[] = ["residency", "higher_diploma", "credit_bank", "short_course"];

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

// TODO(business): ใบสมัครสอบคัดเลือกระบุสาขาเภสัชบำบัด (Residency) 1,000 บาท แต่สรุปประชุมระบุ 500 บาท — ใช้อัตราตามแบบฟอร์มไปก่อน
// สาขาเภสัชพันธุศาสตร์ฯ แบบฟอร์มเขียน "รอข้อมูล" และกลุ่ม Higher Graduate Diploma ไม่ระบุค่าสมัคร จึงยังไม่เปิดชำระ
export const ENTRANCE_EXAM_FEES: Readonly<Partial<Record<string, number>>> = {
  "board:วภท.": 1_000,
};
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
    group: course.shortCourseTrack === "advanced" ? "credit_bank" : "short_course",
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
    examFee: ENTRANCE_EXAM_FEES["advanced:วภท."],
    group: "higher_diploma",
  }),
  ...curriculumPrograms.map((program): ProgramOffering => {
    const creditBank = program.system === "credit_bank";
    const id = `board:${program.collegeCode}`;
    return {
      ...offering({
        id,
        collegeCode: program.collegeCode,
        titleTh: program.credentialTh ?? program.titleTh ?? collegeSpecialty(program.collegeCode),
        titleEn: program.credentialEn ?? undefined,
        specialty: collegeSpecialty(program.collegeCode),
        type: "board_certification",
        creditBankEligible: creditBank,
        // ใบสมัครกลางให้เลือกสถาบันเฉพาะกลุ่ม Residency; กลุ่ม Credit Bank "ลงทะเบียนไปยังผู้รับผิดชอบหลักสูตร"
        requiresTrainingInstitution: !creditBank,
        credits: program.minCredits ?? undefined,
        examFee: creditBank ? undefined : ENTRANCE_EXAM_FEES[id],
        group: creditBank ? "credit_bank" : "residency",
      }),
      // TODO(business): แบบฟอร์มเป็น "ใบสมัครสอบคัดเลือก" ทุกกลุ่ม แต่กลุ่ม Credit Bank ไม่มีค่าสมัครสอบ และ flow ที่กำหนดไม่มีการสอบ — ยืนยันว่าไม่ต้องสอบคัดเลือก
      ...(creditBank ? { admissionMethod: "direct_enrollment" as const } : {}),
    };
  }),
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

/** สถาบันฝึกอบรมตามลำดับในใบสมัครสอบคัดเลือก */
const TRAINING_INSTITUTIONS: Readonly<Record<string, readonly OrganisationScope[]>> = {
  "board:วภท.": [
    ORGANISATIONS.pharmacyPSU, ORGANISATIONS.pharmacyNU, ORGANISATIONS.pharmacyKKU, ORGANISATIONS.pharmacyMU,
    ORGANISATIONS.chula, ORGANISATIONS.pharmacySU, ORGANISATIONS.pharmacyCMU, ORGANISATIONS.pharmacyTU, ORGANISATIONS.pharmacyUBU,
  ],
  "advanced:วภท.": [
    ORGANISATIONS.pharmacyPSU, ORGANISATIONS.pharmacyKKU, ORGANISATIONS.chula,
    ORGANISATIONS.pharmacySU, ORGANISATIONS.pharmacyCMU, ORGANISATIONS.pharmacyUBU,
  ],
  "board:CPPM": [ORGANISATIONS.ramathibodi],
};

// TODO(business): จำนวนที่นั่ง (โควตา) ต่อสถาบันต่อรอบยังไม่มีในแบบฟอร์ม
export function trainingInstitutionsFor(offering: ProgramOffering): OrganisationScope[] {
  if (!offering.requiresTrainingInstitution) return [];
  return [...(TRAINING_INSTITUTIONS[offering.id] ?? [])];
}

export function collegeOrganisationId(collegeCode: CollegeCode) {
  return COLLEGE_ORGANISATION_IDS[collegeCode];
}

export function applicationRouteFor(offering: Pick<ProgramOffering, "type" | "creditBankEligible" | "admissionMethod">): ApplicationRoute {
  // วุฒิบัตรระบบ Credit Bank สมัครตรงแบบสะสมหน่วยกิต จึงใช้เส้นทางเดียวกับ Short Course Credit Bank
  if (offering.admissionMethod === "direct_enrollment") {
    return resolveApplicationRoute({ track: "certificate", creditBank: offering.creditBankEligible });
  }
  return resolveApplicationRoute({ track: CREDENTIAL_TRACK[offering.type], creditBank: offering.creditBankEligible });
}

// ─── กลุ่มหลักสูตร → สาขา → หลักสูตร ─────────────────────────────────────────

export function offeringsInGroup(group: ProgramGroup, offerings: readonly ProgramOffering[] = programOfferings) {
  return offerings.filter((item) => item.group === group);
}

/** สาขาในกลุ่ม (แบบฟอร์มจับคู่ 1 สาขา ต่อ 1 วิทยาลัย) เรียงตามลำดับวิทยาลัยกลาง */
export function specialtiesInGroup(group: ProgramGroup, offerings: readonly ProgramOffering[] = programOfferings) {
  const codes = new Set(offeringsInGroup(group, offerings).map((item) => item.collegeCode));
  return COLLEGE_OPTIONS
    .filter((college) => codes.has(college.value))
    .map((college) => ({ collegeCode: college.value, specialty: collegeSpecialty(college.value), collegeName: college.name }));
}

export function offeringsForSpecialty(group: ProgramGroup, collegeCode: CollegeCode, offerings: readonly ProgramOffering[] = programOfferings) {
  return offeringsInGroup(group, offerings).filter((item) => item.collegeCode === collegeCode);
}

// ─── รอบรับสมัคร (program_round) ──────────────────────────────────────────────

export interface ProgramRound {
  id: string;
  offeringId: string;
  label: string;
  status: "open" | "closed";
  opensAt?: string;
  closesAt?: string;
  capacity?: number;
}

/**
 * shortcut: ข้อมูลตัวอย่าง 1 รอบต่อหลักสูตรที่สมัครผ่านใบสมัครกลาง เพราะยังไม่มีประกาศรอบจริง —
 * แทนด้วยรอบที่เจ้าหน้าที่เปิดในระยะ C (เปิดรอบได้หลังหลักสูตรได้รับอนุมัติ)
 */
export const programRounds: readonly ProgramRound[] = programOfferings
  .filter((item) => item.group === "residency" || item.group === "higher_diploma" || (item.group === "credit_bank" && item.type === "board_certification"))
  .map((item) => ({ id: `round:${item.id}:2570-1`, offeringId: item.id, label: "รอบรับสมัคร ปีการศึกษา 2570 (ข้อมูลตัวอย่าง)", status: "open" }));

export function requiresRound(offering: ProgramOffering, rounds: readonly ProgramRound[] = programRounds) {
  return rounds.some((round) => round.offeringId === offering.id);
}

/** รอบที่สมัครได้ — ไม่มีเลยเมื่อระบบปิดรับสมัคร */
export function openRoundsFor(offering: ProgramOffering, admissionOpen: boolean, rounds: readonly ProgramRound[] = programRounds) {
  if (!admissionOpen) return [];
  return rounds.filter((round) => round.offeringId === offering.id && round.status === "open");
}

// ─── รายวิชาที่เลือกได้ในกลุ่ม Credit Bank (ใบสมัครส่วนที่ 3 กลุ่มที่ 3) ───────────

export interface CreditBankSubjectOption {
  /** รหัสตามแบบฟอร์ม — สาขาที่แบบฟอร์มยังไม่ระบุรหัสจะไม่มีค่า */
  code?: string;
  titleTh: string;
}

// TODO(business): สาขาเภสัชกรรมสมุนไพรและการคุ้มครองผู้บริโภคฯ แบบฟอร์มยังไม่ระบุรหัสรายวิชา
// TODO(business): แบบฟอร์มใช้รหัส "CIPT 401" แต่ถังหลักสูตร Excel ใช้ "วภอ 401" — ยืนยันรหัสที่ถูกต้อง
const CREDIT_BANK_SUBJECTS: Readonly<Partial<Record<CollegeCode, readonly CreditBankSubjectOption[]>>> = {
  "วภช.": [
    { code: "CCPT101", titleTh: "เภสัชกรรมชั้นสูง" },
    { code: "CCPT301", titleTh: "จิตวิทยาสุขภาพและการปรับเปลี่ยนพฤติกรรมสำหรับเภสัชกร" },
  ],
  CPAT: [
    { code: "CPAT002", titleTh: "การวิจัยและพัฒนางานเภสัชกรรมและระบบสุขภาพ : สาขาย่อยเฉพาะ (ถ้ามี)" },
    { code: "CPAT003", titleTh: "ระบบเภสัชกรรมโรงพยาบาลสู่ความเป็นเลิศ" },
    { code: "CPAT201", titleTh: "ความเป็นผู้ประกอบการภายในหน่วยงานสำหรับเภสัชกร" },
    { code: "CPAT203", titleTh: "แนวทางการเฝ้าระวังติดตามความปลอดภัยจากการใช้ยาที่ดีสำหรับอุตสาหกรรมยา 2022" },
    { code: "CPAT205", titleTh: "การจัดการคลังสินค้าและการบริหารเวชภัณฑ์คงคลัง" },
    { code: "CPAT206", titleTh: "การคัดเลือกและจัดซื้อเวชภัณฑ์" },
    { code: "CPAT207", titleTh: "บริหารรัฐกิจและกฎหมาย" },
    { code: "CPAT208", titleTh: "การจัดการธุรกิจทางเภสัชกรรม 1" },
    { code: "CPAT210", titleTh: "การวิเคราะห์ และพยากรณ์ความต้องการ และการวางแผนกำลังคนเภสัชกร" },
    { code: "CPAT302", titleTh: "การบริหารการเงินและการวิเคราะห์ทางเศรษฐศาสตร์ในงานเภสัชกรรม" },
    { code: "CPAT303", titleTh: "การสร้างแบบจำลองและการประเมินความคุ้มค่าของเทคโนโลยีและนโยบายด้านสุขภาพ" },
    { code: "CPAT304", titleTh: "การจัดการการเข้าถึงการบริการด้านสุขภาพที่มีราคาแพง" },
    { code: "CPAT402", titleTh: "การพัฒนาและจัดการฐานข้อมูลเภสัชกรรม" },
    { code: "CPAT501", titleTh: "การออกแบบระบบยาสุขภาพที่ซับซ้อน" },
    { code: "CPAT502", titleTh: "การนำนโยบายสู่การปฏิบัติและการประเมินผลนโยบาย" },
  ],
  CIPT: [
    { code: "CIPT 401", titleTh: "ระบบคุณภาพด้านยา" },
    { code: "CIPT 402", titleTh: "การจัดการความเสี่ยงด้านคุณภาพ" },
    { code: "CIPT 404", titleTh: "ด้านการตรวจสอบความถูกต้อง" },
    { code: "CIPT 501", titleTh: "ด้านการจัดการเอกสารขึ้นทะเบียนตำรับยา" },
  ],
  สมุนไพร: [
    { titleTh: "การควบคุมกำกับผลิตภัณฑ์สุขภาพจากสมุนไพร" },
    { titleTh: "การบริหารจัดการผลิตภัณฑ์สมุนไพร" },
    { titleTh: "การบูรณาการ การแพทย์ดั้งเดิม การแพทย์เสริม การแพทย์ทางเลือก และผลิตภัณฑ์สุขภาพในระบบสุขภาพ" },
    { titleTh: "การประยุกต์เภสัชกรรมสมุนไพรบนหลักฐานเชิงประจักษ์" },
    { titleTh: "การวิจัยและพัฒนาผลิตภัณฑ์สมุนไพร" },
    { titleTh: "นวัตกรรมเทคโนโลยีเภสัชกรรมสมุนไพร" },
  ],
  "วคบท.": [
    { titleTh: "กฎหมายและการบังคับใช้กฎหมายเพื่อคุ้มครองผู้บริโภค" },
    { titleTh: "การกำกับดูแลผลิตภัณฑ์สุขภาพเพื่อการคุ้มครองผู้บริโภค" },
    { titleTh: "การคุ้มครองผู้บริโภคและการพัฒนางานประจำสู่งานวิจัย" },
    { titleTh: "การคุ้มครองผู้บริโภคและดูแลผู้ป่วยในชุมชน" },
    { titleTh: "การจัดการเภสัชกรรมในระบบสุขภาพ" },
    { titleTh: "การวิจัยผลลัพธ์และประเมินนโยบายทางสุขภาพ" },
    { titleTh: "คุ้มครองผู้บริโภคในชุมชน" },
    { titleTh: "งานเภสัชกรรมปฐมภูมิ : เภสัชกรรมครอบครัวและชุมชน" },
    { titleTh: "ด้านการวิเคราะห์การจัดการความเสี่ยงในงานคุ้มครองผู้บริโภค" },
    { titleTh: "ด้านนโยบายและการบริหารระบบยาเพื่อคุ้มครองผู้บริโภค" },
    { titleTh: "บูรณาการเพื่อการคุ้มครองผู้บริโภคด้านยาและสุขภาพ (ต่อยอด)" },
    { titleTh: "ผู้จัดการความเสี่ยงด้านยาและผลิตภัณฑ์สุขภาพ" },
    { titleTh: "ระบาดวิทยาเพื่อการคุ้มครองผู้บริโภคด้านยาและสุขภาพ" },
  ],
};

export function creditBankSubjectsFor(offering: ProgramOffering): readonly CreditBankSubjectOption[] {
  if (offering.group !== "credit_bank" || offering.type !== "board_certification") return [];
  return CREDIT_BANK_SUBJECTS[offering.collegeCode] ?? [];
}

export function subjectKey(subject: CreditBankSubjectOption) {
  return subject.code ?? subject.titleTh;
}

export type StudyFlowKind = "short_course" | "short_course_credit_bank" | "credit_bank_program" | "entrance_exam";

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
        "ตรวจคุณสมบัติ",
        "ชำระค่าสมัครสอบ",
        "ประกาศสิทธิ์สอบ",
        "สอบ",
        `ผ่าน → ${admissionWording.enrollAfterEntrance}`,
        "ชำระค่าลงทะเบียน",
        "สมาชิกวิสามัญ",
      ],
      actionLabel: admissionWording.entranceExam,
    };
  }
  if (offering.type === "board_certification" && offering.creditBankEligible) {
    return {
      kind: "credit_bank_program",
      steps: ["สมัครและเลือกรายวิชา", "ผู้รับผิดชอบหลักสูตรตรวจสอบสิทธิ์", "ชำระเงิน", "เรียน", "บันทึกหน่วยกิต (Credit Bank)"],
      actionLabel: `ส่งใบ${admissionWording.study}`,
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
