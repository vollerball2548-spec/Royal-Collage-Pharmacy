/**
 * กฎธุรกิจฝั่ง Student Portal สำหรับการลงทะเบียนเรียนรายเทอม (หลักสูตร 1 ปี / 4 ปี)
 *
 * โมดูลนี้ไม่เปลี่ยน state machine เดิมใน `workflow.ts` แต่แปลงสถานะเดิม
 * (RegistrationStatus + Invoice + Payment) ให้เป็นขั้นตอนที่ผู้เรียนเข้าใจได้
 * และรวมเงื่อนไขที่ต้องใช้ร่วมกันระหว่าง UI กับ MockDbProvider
 */
import type { InvoiceLifecycleStatus } from "@/roles/shared/features/finance";
import type {
  RegistrationActor,
  RegistrationHistoryEntry,
  RegistrationRecord,
  RegistrationStatus,
} from "./workflow";
import { registrationStatusMeta } from "./workflow";

export type PaymentReviewStatus = "pending" | "approved" | "rejected";

/** สถานะที่แสดงต่อผู้เรียน (ตามรายการสถานะที่กำหนดใน Requirement) */
export const portalStages = [
  "draft",
  "submitted",
  "pending_approval",
  "needs_info",
  "approved",
  "rejected",
  "pending_payment",
  "payment_review",
  "paid",
  "registered",
  "in_progress",
  "completed",
  "failed",
  "cancelled",
] as const;
export type PortalStage = (typeof portalStages)[number];

export type PortalStageVariant = "brand" | "info" | "warning" | "success" | "danger" | "neutral";

export const portalStageMeta: Readonly<Record<PortalStage, { label: string; variant: PortalStageVariant; hint: string }>> = {
  draft: { label: "ร่าง", variant: "brand", hint: "ตรวจสอบรายวิชาแล้วกดยืนยันส่งคำขอ" },
  submitted: { label: "ส่งคำขอแล้ว", variant: "info", hint: "ระบบกำลังตรวจคุณสมบัติ" },
  pending_approval: { label: "รออนุมัติ", variant: "warning", hint: "รอสถาบันหลักพิจารณาคำขอ ยังไม่ต้องชำระเงิน" },
  needs_info: { label: "รอข้อมูลเพิ่ม", variant: "warning", hint: "ผู้พิจารณาขอข้อมูลเพิ่ม กรุณาตรวจเหตุผลแล้วส่งคำขออีกครั้ง" },
  approved: { label: "อนุมัติแล้ว", variant: "success", hint: "ระบบกำลังเปิดยอดชำระเงิน" },
  rejected: { label: "ไม่อนุมัติ", variant: "danger", hint: "ดูเหตุผลจากผู้พิจารณา แล้วเลือกรายวิชาใหม่ได้" },
  pending_payment: { label: "รอชำระเงิน", variant: "warning", hint: "ชำระเงินที่เมนูการเงินภายในกำหนด" },
  payment_review: { label: "รอตรวจสอบการชำระเงิน", variant: "info", hint: "เจ้าหน้าที่กำลังตรวจหลักฐานการชำระเงิน" },
  paid: { label: "ชำระเงินแล้ว", variant: "success", hint: "ระบบกำลังยืนยันการลงทะเบียน" },
  registered: { label: "ลงทะเบียนสำเร็จ", variant: "success", hint: "รายวิชาแสดงในตารางเรียนแล้ว" },
  in_progress: { label: "กำลังเรียน", variant: "info", hint: "เข้าเรียนตามตารางและรอผลการประเมิน" },
  completed: { label: "ผ่าน", variant: "success", hint: "ประกาศผลแล้ว" },
  failed: { label: "ไม่ผ่าน", variant: "danger", hint: "ลงทะเบียนภาคเรียนถัดไปได้ การสอบซ่อมครั้งที่ 2 ขึ้นไปต้องยื่นคำร้อง" },
  cancelled: { label: "ยกเลิก/ถอนแล้ว", variant: "neutral", hint: "รายการนี้ไม่มีผลต่อการลงทะเบียน" },
};

export interface StageContext {
  invoiceStatus?: InvoiceLifecycleStatus;
  paymentStatus?: PaymentReviewStatus;
  /** ผลการประเมินที่ประกาศแล้วของรายวิชานี้ (ถ้ามี) */
  publishedResult?: "S" | "U";
}

export function resolveRegistrationStage(
  registration: Pick<RegistrationRecord, "status">,
  context: StageContext = {},
): PortalStage {
  switch (registration.status) {
    case "selected":
      return "draft";
    case "submitted":
      return "submitted";
    case "pending":
      return "pending_approval";
    case "needs_info":
      return "needs_info";
    case "rejected":
      return "rejected";
    case "withdrawn":
      return "cancelled";
    case "drop_pending":
      return "cancelled";
    case "approved":
    case "awaiting_payment": {
      if (context.invoiceStatus === "paid") return "paid";
      if (context.paymentStatus === "pending") return "payment_review";
      if (context.invoiceStatus === "awaiting_payment") return "pending_payment";
      return "approved";
    }
    case "enrolled": {
      if (context.publishedResult === "S") return "completed";
      if (context.publishedResult === "U") return "failed";
      return context.invoiceStatus === "paid" ? "registered" : "paid";
    }
  }
}

/** สถานะที่ยังถือว่า "ถือครอง" รายวิชาในภาคเรียนนั้น จึงห้ามลงทะเบียนซ้ำ */
const ACTIVE_REGISTRATION_STATUSES: ReadonlySet<RegistrationStatus> = new Set([
  "selected",
  "submitted",
  "pending",
  "needs_info",
  "approved",
  "awaiting_payment",
  "enrolled",
  "drop_pending",
]);

export function isActiveRegistration(registration: Pick<RegistrationRecord, "status">) {
  return ACTIVE_REGISTRATION_STATUSES.has(registration.status);
}

export function normalizeTerm(term: string) {
  return term.replace(/\s+/g, "");
}

export function registrationDuplicateKey(studentId: string, courseCode: string, term: string) {
  return `${studentId}:${courseCode}:${normalizeTerm(term)}`;
}

/**
 * ป้องกันการลงทะเบียนวิชาเดิมซ้ำ "ในภาคเรียนเดียวกัน" เท่านั้น
 * (วิชาที่สอบไม่ผ่านต้องลงทะเบียนในภาคเรียนถัดไปได้)
 */
export function findDuplicateRegistration(
  registrations: readonly RegistrationRecord[],
  selection: { studentId: string; courseCode: string; term: string },
) {
  const key = registrationDuplicateKey(selection.studentId, selection.courseCode, selection.term);
  return registrations.find((registration) => (
    isActiveRegistration(registration) &&
    registrationDuplicateKey(registration.studentId, registration.courseCode, registration.term) === key
  ));
}

/** เปิดชำระเงินได้เฉพาะเมื่ออนุมัติแล้วและระบบเปิดยอดแล้วเท่านั้น */
export function canPayRegistration(
  registration: Pick<RegistrationRecord, "status"> | undefined,
  invoiceStatus: InvoiceLifecycleStatus | undefined,
) {
  if (!registration) return false;
  return (registration.status === "approved" || registration.status === "awaiting_payment") &&
    invoiceStatus === "awaiting_payment";
}

/** แสดงในตารางเรียนได้เมื่อชำระเงินสำเร็จและลงทะเบียนสำเร็จแล้วเท่านั้น */
export function isScheduleVisible(
  registration: Pick<RegistrationRecord, "status">,
  invoiceStatus: InvoiceLifecycleStatus | undefined,
) {
  return registration.status === "enrolled" && invoiceStatus === "paid";
}

export type CourseCategory = "required" | "elective" | "practice";

export const courseCategoryMeta: Readonly<Record<CourseCategory, { label: string; variant: "brand" | "info" | "success" }>> = {
  required: { label: "วิชาบังคับ", variant: "brand" },
  elective: { label: "วิชาเลือก", variant: "info" },
  practice: { label: "วิชาชีพ / ฝึกปฏิบัติ", variant: "success" },
};

/**
 * จัดประเภทรายวิชาจากข้อมูลเดิม: classification ใน Course Catalog และรูปแบบการเรียน
 * (`clinical` = ฝึกปฏิบัติ) ใน Course Schedule
 */
export function resolveCourseCategory(input: {
  classification?: "required" | "general";
  scheduleMode?: "onsite" | "online" | "clinical";
}): CourseCategory {
  if (input.scheduleMode === "clinical") return "practice";
  return input.classification === "general" ? "elective" : "required";
}

export const EXAM_RETAKE_FEE = 500;

/**
 * นโยบายการสอบ: ครั้งแรกไม่มีค่าใช้จ่าย ครั้งที่ 2 เป็นต้นไปต้องยื่นคำร้องและชำระ 500 บาท
 */
export function examAttemptPolicy(attemptNumber: number) {
  if (!Number.isInteger(attemptNumber) || attemptNumber < 1) {
    throw new Error("attemptNumber must be a positive integer");
  }
  const isRetake = attemptNumber >= 2;
  return {
    attemptNumber,
    fee: isRetake ? EXAM_RETAKE_FEE : 0,
    requiresRequest: isRetake,
  };
}

const actorLabels: Readonly<Record<RegistrationActor, string>> = {
  member: "ผู้เรียน",
  student: "ผู้เรียน",
  teacher: "อาจารย์ผู้รับผิดชอบรายวิชา",
  registrar: "นายทะเบียน",
  royal_college_staff: "เจ้าหน้าที่ราชวิทยาลัย",
  system: "ระบบ",
  migration: "ระบบ (ย้ายข้อมูล)",
};

export interface RegistrationTimelineEntry {
  id: string;
  at: string;
  actorLabel: string;
  fromLabel?: string;
  toLabel: string;
  reason?: string;
  evidenceReference?: string;
}

/** ประวัติการเปลี่ยนสถานะ: ผู้ดำเนินการ วันเวลา สถานะเดิม สถานะใหม่ เหตุผล */
export function buildRegistrationTimeline(history: readonly RegistrationHistoryEntry[]): RegistrationTimelineEntry[] {
  return [...history]
    .sort((left, right) => Date.parse(left.at) - Date.parse(right.at))
    .map((entry) => ({
      id: entry.id,
      at: entry.at,
      actorLabel: entry.actorName ?? actorLabels[entry.actor],
      ...(entry.from ? { fromLabel: registrationStatusMeta[entry.from].label } : {}),
      toLabel: registrationStatusMeta[entry.to].label,
      ...(entry.reason ? { reason: entry.reason } : {}),
      ...(entry.evidenceReference ? { evidenceReference: entry.evidenceReference } : {}),
    }));
}

export function latestDecisionReason(registration: RegistrationRecord) {
  if (registration.status !== "rejected" && registration.status !== "needs_info") return undefined;
  return registration.teacherDecision?.reason ??
    registration.reviewReason ??
    [...registration.history].reverse().find((entry) => entry.reason)?.reason;
}
