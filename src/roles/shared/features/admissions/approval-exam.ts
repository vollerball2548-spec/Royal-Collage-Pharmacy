import type { CollegeCode } from "@/roles/shared/data/college-directory";
import {
  applicantFullName,
  type ApplicantSnapshot,
  type PostalAddress,
} from "@/roles/shared/features/applicant/profile";
import { createAdmissionDocuments, type AdmissionDocumentRequirement } from "./documents";

/**
 * ใบสมัครสอบหนังสืออนุมัติแสดงความรู้ความชำนาญในการประกอบวิชาชีพเภสัชกรรม
 * ที่มา: แบบฟอร์มกระดาษ (ข้อ 1–7) — แปลงเป็นข้อมูลหลายขั้นตอน ไม่ใช่สำเนาหน้ากระดาษ
 */

// ─── ข้อ 5 คุณสมบัติ ─────────────────────────────────────────────────────────

export interface QualificationItem {
  id: string;
  label: string;
  /** ข้อย่อยแบบ "อย่างใดอย่างหนึ่ง" ตามแบบฟอร์ม */
  anyOf?: readonly QualificationItem[];
}

/** 5.1 คุณสมบัติทั่วไป (ทุกวิทยาลัยต้องมี) */
export const GENERAL_QUALIFICATIONS: readonly QualificationItem[] = [
  { id: "general-active-license", label: "เป็นผู้ประกอบวิชาชีพเภสัชกรรม และใบอนุญาตฯ ยังมีผลบังคับใช้ (นับถึงวันสิ้นสุดรับสมัคร)" },
  { id: "general-never-suspended", label: "ไม่เคยถูกสั่งพักใช้หรือถูกเพิกถอนใบอนุญาตประกอบวิชาชีพเภสัชกรรม" },
];

const industrialWorks: readonly QualificationItem[] = [
  { id: "cipt-work-tci", label: "บทความวิชาการด้านเภสัชกรรมอุตสาหการ ≥ 2 ชิ้น ในวารสาร TCI กลุ่ม 1 หรือ 2" },
  { id: "cipt-work-intl", label: "บทความวิชาการด้านเภสัชกรรมอุตสาหการ ≥ 1 ชิ้น ในวารสารระดับนานาชาติที่คณะผู้บริหารวิทยาลัยเห็นชอบ" },
  { id: "cipt-work-proceedings", label: "บทความที่นำเสนอในงานประชุมวิชาการและมี Proceedings ≥ 4 ชิ้น" },
  { id: "cipt-work-cpe", label: "บทความ CPE ด้านเภสัชกรรมอุตสาหการ ≥ 2 เรื่อง" },
  { id: "cipt-work-guidance", label: "ตำราหรือ Guidance ด้านเภสัชกรรมอุตสาหการที่มี peer review ≥ 1 เรื่อง" },
  { id: "cipt-work-speaker", label: "วิทยากร CPE หรือผู้บรรยายด้านเภสัชกรรมอุตสาหการ ภายใน 5 ปีย้อนหลัง รวม ≥ 50 ชั่วโมง" },
];

/** 5.2 คุณสมบัติเฉพาะตามวิทยาลัย — ผู้สมัครแสดงเจตนา เจ้าหน้าที่เป็นผู้ตรวจรับรอง */
export const COLLEGE_QUALIFICATIONS: Readonly<Record<CollegeCode, readonly QualificationItem[]>> = {
  "วภท.": [
    { id: "vpt-experience-10y", label: "ประกอบวิชาชีพในสาขาเภสัชบำบัดหรือที่เกี่ยวข้องเกื้อกูล ไม่น้อยกว่า 10 ปี" },
    { id: "vpt-equivalent", label: "มีคุณสมบัติเทียบเท่าตามที่สภาเภสัชกรรมรับรอง" },
    { id: "vpt-research", label: "มีผลงานวิจัยตีพิมพ์ในวารสาร TCI กลุ่ม 1 หรือวารสารต่างประเทศที่ สกอ. รับรอง โดยเป็น first author หรือ corresponding author" },
  ],
  "วคบท.": [
    { id: "vkb-training-20cr", label: "ลงทะเบียนฝึกอบรมหลักสูตรหนังสืออนุมัติ สาขาการคุ้มครองผู้บริโภคด้านยาและสุขภาพ และผ่านการประเมินไม่น้อยกว่า 20 หน่วยกิต" },
    { id: "vkb-article", label: "มีบทความตีพิมพ์ในวารสาร peer review กลุ่ม 1 หรือ 2 ของ TCI ภายใน 4 ปีนับถึงวันสอบ" },
    { id: "vkb-conference", label: "เข้าร่วมประชุมวิชาการด้านคุ้มครองผู้บริโภคฯ ที่ วคบท. จัด ไม่น้อยกว่าปีละ 1 ครั้ง" },
  ],
  สมุนไพร: [
    { id: "herb-certified", label: "ได้รับหนังสืออนุมัติหรือวุฒิบัตรสาขาเภสัชกรรมสมุนไพร หรือเทียบเท่าจากสถาบันต่างประเทศที่สภาเภสัชกรรมรับรอง" },
    { id: "herb-experience-10y", label: "ปฏิบัติงานสาขาเภสัชกรรมสมุนไพร ไม่น้อยกว่า 10 ปี" },
    { id: "herb-other", label: "คุณสมบัติอื่น ๆ ตามที่สภาเภสัชกรรมจะประกาศกำหนดเพิ่มเติม" },
  ],
  CIPT: [
    { id: "cipt-practice-15y", label: "ประกอบวิชาชีพเภสัชกรรมอย่างน้อย 15 ปี และใบอนุญาตฯ ยังมีผลบังคับใช้" },
    { id: "cipt-experience-10y", label: "มีประสบการณ์ด้านเภสัชกรรมอุตสาหการอย่างต่อเนื่องไม่น้อยกว่า 10 ปี" },
    { id: "cipt-works", label: "มีผลงานอย่างใดอย่างหนึ่ง", anyOf: industrialWorks },
  ],
  CPAT: [
    { id: "cpat-experience", label: "ประกอบวิชาชีพเภสัชกรรมอย่างน้อย 15 ปี และมีประสบการณ์ด้านการบริหารเภสัชกิจไม่น้อยกว่า 10 ปี" },
    {
      id: "cpat-works",
      label: "ผลงานวิชาการที่เสนอ (อย่างน้อย 1 ข้อ)",
      anyOf: [
        { id: "cpat-work-tci", label: "บทความวิชาการด้านการบริหารเภสัชกิจ ≥ 2 ชิ้น ในวารสาร TCI กลุ่ม 1 หรือ 2" },
        { id: "cpat-work-intl", label: "บทความวิชาการด้านการบริหารเภสัชกิจ ≥ 1 ชิ้น ในวารสารนานาชาติที่ อว. รับรอง" },
        { id: "cpat-work-proceedings", label: "บทความใน Proceedings งานประชุมวิชาการ ≥ 4 ชิ้น" },
        { id: "cpat-work-cpe", label: "บทความ CPE ด้านการบริหารเภสัชกิจ ≥ 2 เรื่อง" },
        { id: "cpat-work-guidance", label: "ตำราหรือ Guidance ที่มี peer review ≥ 1 เรื่อง" },
        { id: "cpat-work-executive-summary", label: "บทสรุปผู้บริหารตามโครงการวิชาการ/พัฒนางานที่มีหลักฐานการใช้ประโยชน์เชิงประจักษ์ ≥ 1 เรื่อง" },
        { id: "cpat-work-cpe-speaker", label: "วิทยากร CPE หรือผู้บรรยายในสถาบันการศึกษา/กก.รัฐ ภายใน 5 ปีย้อนหลัง รวม ≥ 50 ชั่วโมง" },
        { id: "cpat-work-trainer", label: "วิทยากรฝึกอบรมนักศึกษาฝึกงาน/ผู้ประกอบวิชาชีพ ภายใน 5 ปีย้อนหลัง รวม ≥ 50 ชั่วโมง" },
      ],
    },
  ],
  "วภช.": [
    { id: "vpc-practice-15y", label: "ประกอบวิชาชีพเภสัชกรรมมาแล้วอย่างน้อย 15 ปี และใบอนุญาตฯ ยังมีผลบังคับใช้" },
    { id: "vpc-faculty", label: "เป็นอาจารย์ในสถาบันหลัก หรือคณะเภสัชศาสตร์ที่ประสงค์จะเข้าเป็นสถาบันหลักของวิทยาลัยเภสัชกรรมชุมชน โดยมีหนังสือรับรองจากหน่วยงาน" },
    {
      id: "vpc-experience",
      label: "มีประสบการณ์ด้านเภสัชกรรมชุมชนหรือเกี่ยวข้องต่อเนื่องไม่น้อยกว่า 10 ปี (แสดงหลักฐานอย่างใดอย่างหนึ่ง)",
      anyOf: [
        { id: "vpc-evidence-license", label: "สำเนาใบอนุญาตขายยาแผนปัจจุบัน พร้อมประวัติการเป็นผู้มีหน้าที่ปฏิบัติการตั้งแต่ต้น" },
        { id: "vpc-evidence-pharmacy", label: "หนังสือรับรองการทำงานเป็นเภสัชกรประจำร้านขายยา หรือเภสัชกรปฐมภูมิ" },
        { id: "vpc-evidence-organisation", label: "หนังสือรับรองจากหน่วยงานด้านการปฏิบัติงานหรือการบริหารจัดการทางเภสัชกรรมชุมชน" },
      ],
    },
    {
      id: "vpc-works",
      label: "มีผลงานอย่างใดอย่างหนึ่ง",
      anyOf: [
        { id: "vpc-work-tci", label: "บทความวิชาการด้านเภสัชกรรมชุมชน ≥ 3 ชิ้น ในวารสาร TCI กลุ่ม 1" },
        { id: "vpc-work-intl", label: "บทความวิชาการด้านเภสัชกรรมชุมชน ≥ 2 ชิ้น ในวารสารนานาชาติที่ อว. รับรองหรือคณะผู้บริหารวิทยาลัยเห็นชอบ" },
        { id: "vpc-work-proceedings", label: "บทความใน Proceedings ≥ 3 ชิ้น หรือบทคัดย่อในการประชุมวิชาการ ≥ 6 ชิ้น" },
        { id: "vpc-work-cpe", label: "บทความ CPE ด้านเภสัชกรรมชุมชน ≥ 6 เรื่อง" },
        { id: "vpc-work-guidance", label: "ตำราหรือ Guidance ด้านเภสัชกรรมชุมชนที่มี peer review ≥ 1 เรื่อง" },
        { id: "vpc-work-speaker", label: "วิทยากร CPE หรือผู้บรรยายด้านเภสัชกรรมชุมชน ภายใน 5 ปีย้อนหลัง รวม ≥ 50 ชั่วโมง" },
        { id: "vpc-work-preceptor", label: "อาจารย์ประจำแหล่งฝึกนักศึกษาเภสัชศาสตร์ปีที่ 6 ในร้านขายยาต่อเนื่อง ≥ 5 ปี" },
      ],
    },
  ],
  // TODO(business): แบบฟอร์มที่ได้รับมีเฉพาะข้อ 5.2.1–5.2.6 — คุณสมบัติเฉพาะของวิทยาลัยเภสัชพันธุศาสตร์และเภสัชกรรมแม่นยำคืออะไร
  CPPM: [],
};

export function qualificationIds(items: readonly QualificationItem[]): string[] {
  return items.flatMap((item) => [item.id, ...(item.anyOf ? qualificationIds(item.anyOf) : [])]);
}

// ─── ข้อ 6 เอกสารหลักฐาน ─────────────────────────────────────────────────────

/** ข้อ 5 หลักฐานการชำระเงินไม่อยู่ในรายการนี้ — แนบในขั้นชำระเงินหลังคำขอผ่านการตรวจคุณสมบัติ */
export const approvalExamDocumentRequirements: readonly AdmissionDocumentRequirement[] = [
  { id: "approval-photo", label: "รูปถ่ายหน้าตรง ขนาด 1 × 1.5 นิ้ว (ถ่ายไว้ไม่เกิน 1 ปี) จำนวน 1 รูป", required: true },
  { id: "approval-license", label: "สำเนาใบอนุญาตเป็นผู้ประกอบวิชาชีพเภสัชกรรม จำนวน 1 ฉบับ", required: true },
  { id: "approval-experience", label: "เอกสารหลักฐานแสดงประสบการณ์การทำงาน (ระบุระยะเวลาและหน่วยงานรับรอง) จำนวน 1 ชุด", required: true },
  { id: "approval-academic-works", label: "สำเนาผลงานวิชาการ / บทความ / ตำรา / หลักฐานการเป็นวิทยากร ตามเกณฑ์ของแต่ละวิทยาลัย จำนวน 1 ชุด", required: true },
  { id: "approval-name-change", label: "สำเนาหลักฐานการเปลี่ยนชื่อ หรือนามสกุล จำนวน 1 ชุด", required: false, hint: "แนบเฉพาะกรณีชื่อ-นามสกุลไม่ตรงกับใบอนุญาตฯ" },
];

export function createApprovalExamDocuments() {
  return createAdmissionDocuments(approvalExamDocumentRequirements);
}

/** ใบสมัครที่สร้างจากฟอร์มใหม่ใช้รายการเอกสารตามแบบฟอร์มสอบอนุมัติ; ใบเก่ายังใช้รายการเดิม */
export function isApprovalExamDocumentSet(documents: readonly { id: string }[]) {
  return documents.some((document) => approvalExamDocumentRequirements.some((requirement) => requirement.id === document.id));
}

export const APPROVAL_EXAM_DOCUMENT_NOTE = "กรุณาลงนามรับรองสำเนาถูกต้องทุกฉบับ";

// ─── ข้อ 7 การรับรองความถูกต้อง ───────────────────────────────────────────────

export const APPROVAL_EXAM_DECLARATION =
  "ข้าพเจ้าขอรับรองว่าข้อความที่แจ้งไว้ในใบสมัครนี้ รวมถึงเอกสารหลักฐานต่าง ๆ เป็นความจริงทุกประการ และข้าพเจ้าเป็นผู้มีคุณสมบัติครบถ้วนตรงตามประกาศรับสมัครทุกประการ หากปรากฏภายหลังว่าข้าพเจ้ามีคุณสมบัติไม่ตรงตามประกาศ ให้ถือว่าข้าพเจ้าเป็นผู้ขาดคุณสมบัติในการสอบครั้งนี้ทันที ทั้งนี้ การลงลายมือชื่อด้วยวิธีการอิเล็กทรอนิกส์ให้ถือเป็นการลงลายมือชื่อตามพระราชบัญญัติว่าด้วยธุรกรรมทางอิเล็กทรอนิกส์ พ.ศ. 2544 และที่แก้ไขเพิ่มเติม";

// ─── ข้อมูลใบสมัคร ───────────────────────────────────────────────────────────

export interface ApprovalExamForm {
  collegeCode: CollegeCode;
  applicant: ApplicantSnapshot;
  /** id ของคุณสมบัติที่ผู้สมัครแสดงว่ามี (ทั้ง 5.1 และ 5.2) */
  declaredQualifications: string[];
  qualificationNote: string;
  declaration?: { accepted: true; signedName: string; signedAt: string };
}

export const APPROVAL_EXAM_FORM_STEPS = [
  { id: 1, title: "สาขาและวิทยาลัย" },
  { id: 2, title: "ข้อมูลผู้สมัคร" },
  { id: 3, title: "การศึกษาและการทำงาน" },
  { id: 4, title: "ตรวจคุณสมบัติ" },
  { id: 5, title: "เอกสารแนบ" },
  { id: 6, title: "รับรองและส่งคำขอ" },
] as const;

function blank(value: string) {
  return value.trim().length === 0;
}

function addressErrors(address: PostalAddress, label: string) {
  const errors: string[] = [];
  if (blank(address.houseNo)) errors.push(`${label}: กรุณากรอกเลขที่`);
  if (blank(address.subdistrict)) errors.push(`${label}: กรุณากรอกตำบล/แขวง`);
  if (blank(address.district)) errors.push(`${label}: กรุณากรอกอำเภอ/เขต`);
  if (blank(address.province)) errors.push(`${label}: กรุณากรอกจังหวัด`);
  if (!/^\d{5}$/.test(address.postalCode.trim())) errors.push(`${label}: รหัสไปรษณีย์ต้องเป็นตัวเลข 5 หลัก`);
  return errors;
}

/** ตรวจความครบถ้วนรายขั้น — ขั้นที่ไม่มีเงื่อนไขคืนค่า [] */
export function approvalExamStepErrors(step: number, form: ApprovalExamForm): string[] {
  const { applicant } = form;
  if (step === 2) {
    return [
      ...(blank(applicant.workplace.position) ? ["กรุณากรอกตำแหน่งปัจจุบัน"] : []),
      ...(blank(applicant.workplace.organisation) ? ["กรุณากรอกสังกัดหน่วยงาน/สถานที่ทำงาน"] : []),
      ...addressErrors(applicant.workplace.address, "ที่อยู่สถานที่ทำงาน"),
      ...addressErrors(applicant.person.contactAddress, "ที่อยู่ปัจจุบันที่ติดต่อได้"),
      ...(!/^0\d{8,9}$/.test(applicant.person.mobilePhone.replace(/[-\s]/g, "")) ? ["กรุณากรอกโทรศัพท์เคลื่อนที่ให้ถูกต้อง"] : []),
    ];
  }
  if (step === 3) {
    const bachelors = applicant.education.find((record) => record.level === "ปริญญาตรี");
    const errors: string[] = [];
    if (!bachelors || blank(bachelors.institution) || blank(bachelors.qualification)) errors.push("กรุณากรอกประวัติการศึกษาระดับปริญญาตรี");
    if (!applicant.employment.some((record) => !blank(record.position) && !blank(record.organisation))) {
      errors.push("กรุณากรอกประวัติการทำงานอย่างน้อย 1 รายการ");
    }
    return errors;
  }
  if (step === 4) {
    return GENERAL_QUALIFICATIONS
      .filter((item) => !form.declaredQualifications.includes(item.id))
      .map((item) => `คุณสมบัติทั่วไปที่ทุกวิทยาลัยต้องมี: ${item.label}`);
  }
  if (step === 6) {
    if (!form.declaration?.accepted) return ["กรุณายืนยันการรับรองความถูกต้อง"];
    if (form.declaration.signedName.trim() !== applicantFullName(applicant.person)) {
      return [`กรุณาพิมพ์ชื่อ-นามสกุลให้ตรงกับ "${applicantFullName(applicant.person)}" เพื่อลงลายมือชื่ออิเล็กทรอนิกส์`];
    }
  }
  return [];
}

export function approvalExamFormErrors(form: ApprovalExamForm) {
  return APPROVAL_EXAM_FORM_STEPS.flatMap((step) => approvalExamStepErrors(step.id, form));
}

// ─── สถานะหลังชำระเงิน: สิทธิ์สอบ → ผลสอบ → หนังสืออนุมัติ ─────────────────────

export type ApprovalExamStage = "exam_eligible" | "passed" | "failed" | "approval_issued";

export interface ApprovalExamStageEntry {
  stage: ApprovalExamStage;
  at: string;
  actorName: string;
  note?: string;
}

export interface ApprovalExamProgress {
  stage?: ApprovalExamStage;
  /** เลขที่หนังสืออนุมัติที่ออกผ่าน e-Service ของสภาเภสัชกรรม (ระบบนี้บันทึกอ้างอิงเท่านั้น) */
  approvalLetterNo?: string;
  history: ApprovalExamStageEntry[];
}

const nextStages: Record<ApprovalExamStage | "paid", readonly ApprovalExamStage[]> = {
  paid: ["exam_eligible"],
  exam_eligible: ["passed", "failed"],
  passed: ["approval_issued"],
  failed: [],
  approval_issued: [],
};

export interface ApprovalExamStageContext {
  applicationApproved: boolean;
  feePaid: boolean;
}

export function canAdvanceApprovalExam(
  progress: ApprovalExamProgress | undefined,
  to: ApprovalExamStage,
  context: ApprovalExamStageContext,
) {
  if (!context.applicationApproved || !context.feePaid) return false;
  return nextStages[progress?.stage ?? "paid"].includes(to);
}

export function advanceApprovalExam(
  progress: ApprovalExamProgress | undefined,
  to: ApprovalExamStage,
  context: ApprovalExamStageContext & { actorName: string; at: string; note?: string; approvalLetterNo?: string },
): ApprovalExamProgress {
  if (!canAdvanceApprovalExam(progress, to, context)) {
    throw new Error("ยังเปลี่ยนสถานะการสมัครสอบอนุมัตินี้ไม่ได้ ต้องผ่านการตรวจคุณสมบัติ ชำระค่าสมัครสอบ และเรียงตามลำดับขั้น");
  }
  if (to === "approval_issued" && blank(context.approvalLetterNo ?? "")) {
    throw new Error("กรุณาระบุเลขที่หนังสืออนุมัติ");
  }
  return {
    stage: to,
    approvalLetterNo: to === "approval_issued" ? context.approvalLetterNo?.trim() : progress?.approvalLetterNo,
    history: [
      ...(progress?.history ?? []),
      { stage: to, at: context.at, actorName: context.actorName, ...(context.note ? { note: context.note } : {}) },
    ],
  };
}

export type ApprovalTimelineState = "completed" | "current" | "waiting" | "problem";

export interface ApprovalTimelineStep {
  id: "submitted" | "eligibility" | "payment" | "exam_eligible" | "result" | "approval_letter";
  label: string;
  state: ApprovalTimelineState;
  detail?: string;
}

/** สถานะคำขอ → สิทธิ์สอบ → ผลสอบ → หนังสืออนุมัติ สำหรับแสดงให้ผู้สมัครเห็น */
export function approvalExamTimeline(input: {
  status: "pending" | "approved" | "rejected";
  payment: "none" | "pending" | "approved" | "rejected";
  progress?: ApprovalExamProgress;
}): ApprovalTimelineStep[] {
  const stage = input.progress?.stage;
  const reached = (stages: readonly ApprovalExamStage[]) => Boolean(stage && stages.includes(stage));
  const eligibility: ApprovalTimelineState = input.status === "approved" ? "completed" : input.status === "rejected" ? "problem" : "current";
  const payment: ApprovalTimelineState = input.payment === "approved"
    ? "completed"
    : input.status !== "approved" ? "waiting" : input.payment === "rejected" ? "problem" : "current";
  const examEligible: ApprovalTimelineState = reached(["exam_eligible", "passed", "failed", "approval_issued"])
    ? "completed"
    : payment === "completed" ? "current" : "waiting";
  const result: ApprovalTimelineState = reached(["passed", "approval_issued"])
    ? "completed"
    : stage === "failed" ? "problem" : stage === "exam_eligible" ? "current" : "waiting";
  const letter: ApprovalTimelineState = stage === "approval_issued" ? "completed" : stage === "passed" ? "current" : "waiting";
  return [
    { id: "submitted", label: "ยื่นคำขอ", state: "completed" },
    { id: "eligibility", label: "ตรวจคุณสมบัติ", state: eligibility, detail: input.status === "rejected" ? "ไม่ผ่านการพิจารณา" : undefined },
    { id: "payment", label: "ชำระค่าสมัครสอบ", state: payment, detail: input.payment === "pending" ? "รอตรวจหลักฐาน" : undefined },
    { id: "exam_eligible", label: "ประกาศสิทธิ์สอบ", state: examEligible },
    { id: "result", label: "ผลสอบ", state: result, detail: stage === "failed" ? "ไม่ผ่าน" : reached(["passed", "approval_issued"]) ? "ผ่าน" : undefined },
    { id: "approval_letter", label: "หนังสืออนุมัติ", state: letter, detail: input.progress?.approvalLetterNo ? `เลขที่ ${input.progress.approvalLetterNo}` : undefined },
  ];
}

// ─── ตรวจข้อมูลที่อ่านกลับจาก localStorage ─────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isApprovalExamForm(value: unknown): value is ApprovalExamForm {
  if (!isRecord(value) || typeof value.collegeCode !== "string" || !isRecord(value.applicant)) return false;
  const applicant = value.applicant;
  return isRecord(applicant.person) &&
    isRecord(applicant.license) &&
    isRecord(applicant.workplace) &&
    Array.isArray(applicant.employment) &&
    Array.isArray(applicant.education) &&
    typeof applicant.capturedAt === "string" &&
    Array.isArray(value.declaredQualifications) &&
    value.declaredQualifications.every((id) => typeof id === "string");
}

const STAGES: readonly ApprovalExamStage[] = ["exam_eligible", "passed", "failed", "approval_issued"];

export function isApprovalExamProgress(value: unknown): value is ApprovalExamProgress {
  if (!isRecord(value) || !Array.isArray(value.history)) return false;
  return (value.stage === undefined || STAGES.includes(value.stage as ApprovalExamStage)) &&
    value.history.every((entry) => isRecord(entry) && STAGES.includes(entry.stage as ApprovalExamStage) && typeof entry.at === "string");
}

export function createApprovalExamForm(collegeCode: CollegeCode, applicant: ApplicantSnapshot): ApprovalExamForm {
  return { collegeCode, applicant, declaredQualifications: [], qualificationNote: "" };
}
