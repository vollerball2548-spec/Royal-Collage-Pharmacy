/**
 * Workflow การลงทะเบียน Short Course (4 เดือน)
 *
 * - แบบต่อยอด Credit Bank (shortCourseTrack = "advanced")
 *   ส่งคำขอ → สถาบันหลักอนุมัติ → ชำระเงิน → เรียน/ประเมิน → สถาบันบันทึกผล
 *   → เจ้าหน้าที่ราชวิทยาลัยอนุมัติผล → (ผ่าน) บันทึกหน่วยกิตลง Credit Bank + Certificate
 * - แบบไม่ต่อยอด (shortCourseTrack = "standard")
 *   สมัคร → ชำระค่าหลักสูตร → เข้าเรียน → สถาบันบันทึกประวัติการอบรม → Certificate เมื่อผ่าน
 *   ไม่สร้าง Credit Bank และไม่สร้างสมาชิกวิสามัญ
 */
import {
  createReceiptNumber,
  type InvoicePayee,
  type RegistrationInvoice,
} from "@/roles/shared/features/finance";
import {
  courseInstitutions,
  type ShortCourseDefinition,
} from "@/roles/shared/features/courses/course-catalog";
import type { SystemRole } from "@/roles/shared/features/roles/access-model";

export const shortCourseEnrollmentStatuses = [
  "pending_approval",
  "rejected",
  "awaiting_payment",
  "registered",
  "assessment_recorded",
  "completed",
  "failed",
  "cancelled",
] as const;
export type ShortCourseEnrollmentStatus = (typeof shortCourseEnrollmentStatuses)[number];

export const shortCourseStatusMeta: Readonly<Record<ShortCourseEnrollmentStatus, {
  label: string;
  variant: "warning" | "danger" | "info" | "success" | "neutral";
}>> = {
  pending_approval: { label: "รออนุมัติ", variant: "warning" },
  rejected: { label: "ไม่อนุมัติ", variant: "danger" },
  awaiting_payment: { label: "รอชำระเงิน", variant: "warning" },
  registered: { label: "ลงทะเบียนสำเร็จ / กำลังอบรม", variant: "info" },
  assessment_recorded: { label: "รออนุมัติผลการประเมิน", variant: "info" },
  completed: { label: "ผ่าน", variant: "success" },
  failed: { label: "ไม่ผ่าน", variant: "danger" },
  cancelled: { label: "ยกเลิก", variant: "neutral" },
};

export interface ShortCourseActor {
  userId: string;
  userName: string;
  role: SystemRole;
  organisationId: string;
}

export interface ShortCourseHistoryEntry {
  id: string;
  from?: ShortCourseEnrollmentStatus;
  to: ShortCourseEnrollmentStatus;
  actorUserId: string;
  actorName: string;
  actorRole: SystemRole | "system";
  at: string;
  note?: string;
}

export interface ShortCourseAssessment {
  result: "pass" | "fail";
  note: string;
  recordedBy: string;
  recordedAt: string;
}

export interface ShortCourseEnrollment {
  id: string;
  studentId: string;
  studentName: string;
  courseId: string;
  courseTitle: string;
  /** รหัสวิชา Credit Bank (เช่น CP...) จากข้อมูลหลักสูตร ถ้ายังไม่กำหนดจะว่าง */
  creditBankCode?: string;
  creditBank: boolean;
  credits: number;
  collegeCode: string;
  /** องค์กรสถาบันหลักที่รับผิดชอบ (OrganisationScope id) */
  institutionId: string;
  institutionName: string;
  status: ShortCourseEnrollmentStatus;
  createdAt: string;
  updatedAt: string;
  decisionReason?: string;
  assessment?: ShortCourseAssessment;
  /** หน่วยกิตที่บันทึกลง Credit Bank แล้ว — มีค่าเฉพาะหลังเจ้าหน้าที่อนุมัติผลว่าผ่าน */
  creditsAwarded: number;
  certificateNo?: string;
  certificateIssuedAt?: string;
  history: ShortCourseHistoryEntry[];
}

/** สถาบันในแคตตาล็อก (`inst-*`) ↔ Organisation Scope (`org-inst-*`) */
export function shortCourseInstitutionOrganisationId(definition: Pick<ShortCourseDefinition, "responsibleInstitutionId">) {
  return `org-${definition.responsibleInstitutionId}`;
}

export function isCreditBankShortCourse(definition: Pick<ShortCourseDefinition, "shortCourseTrack">) {
  return definition.shortCourseTrack === "advanced";
}

/** ผู้รับชำระอ้างอิงสถาบันผู้รับผิดชอบที่ตั้งไว้ในหลักสูตร */
export function shortCoursePayee(definition: ShortCourseDefinition): InvoicePayee {
  const institution = courseInstitutions[definition.responsibleInstitutionId as keyof typeof courseInstitutions];
  return {
    organisationId: shortCourseInstitutionOrganisationId(definition),
    label: institution?.name ?? definition.responsibleInstitutionId,
  };
}

/**
 * ค่าหลักสูตร: ใช้ค่าที่ตั้งไว้ในหลักสูตร (`fee`) ก่อน
 * TODO(finance): หลักสูตรใน Catalog ปัจจุบันยังไม่มีค่าหลักสูตรจริง ระบบจึงใช้อัตราต่อหน่วยกิต
 * เดียวกับค่าลงทะเบียนรายวิชาเดิม (หน่วยกิต × 1,000 บาท) จนกว่าจะกำหนดค่าในหลักสูตร
 */
export function shortCourseFee(definition: ShortCourseDefinition) {
  if (typeof definition.fee === "number" && definition.fee >= 0) {
    return { amount: definition.fee, source: "course_setting" as const };
  }
  return { amount: definition.credits * 1_000, source: "per_credit_default" as const };
}

function move(
  enrollment: ShortCourseEnrollment,
  to: ShortCourseEnrollmentStatus,
  actor: ShortCourseActor | "system",
  at: string,
  note?: string,
): ShortCourseEnrollment {
  const entry: ShortCourseHistoryEntry = {
    id: `${enrollment.id}-${enrollment.history.length + 1}`,
    from: enrollment.status,
    to,
    actorUserId: actor === "system" ? "system" : actor.userId,
    actorName: actor === "system" ? "ระบบ" : actor.userName,
    actorRole: actor === "system" ? "system" : actor.role,
    at,
    ...(note?.trim() ? { note: note.trim() } : {}),
  };
  return { ...enrollment, status: to, updatedAt: at, history: [...enrollment.history, entry] };
}

function requireReason(reason: string | undefined, message: string) {
  const value = reason?.trim();
  if (!value) throw new Error(message);
  return value;
}

export function createShortCourseEnrollment(input: {
  id: string;
  student: { id: string; name: string };
  definition: ShortCourseDefinition;
  at: string;
}): ShortCourseEnrollment {
  if (input.definition.status !== "active") throw new Error("หลักสูตรนี้ไม่ได้เปิดรับสมัคร");
  const creditBank = isCreditBankShortCourse(input.definition);
  const institutionId = shortCourseInstitutionOrganisationId(input.definition);
  const status: ShortCourseEnrollmentStatus = creditBank ? "pending_approval" : "awaiting_payment";
  return {
    id: input.id,
    studentId: input.student.id,
    studentName: input.student.name,
    courseId: input.definition.id,
    courseTitle: input.definition.titleTh,
    ...(input.definition.creditBankCode ? { creditBankCode: input.definition.creditBankCode } : {}),
    creditBank,
    credits: input.definition.credits,
    collegeCode: input.definition.collegeCode,
    institutionId,
    institutionName: shortCoursePayee(input.definition).label,
    status,
    createdAt: input.at,
    updatedAt: input.at,
    creditsAwarded: 0,
    history: [{
      id: `${input.id}-1`,
      to: status,
      actorUserId: input.student.id,
      actorName: input.student.name,
      actorRole: "student",
      at: input.at,
      note: creditBank ? "ส่งคำขอลงทะเบียนรายวิชา Credit Bank" : "สมัครหลักสูตรระยะสั้น (ไม่ต่อยอด)",
    }],
  };
}

export function createShortCourseInvoice(
  enrollment: ShortCourseEnrollment,
  definition: ShortCourseDefinition,
  at: string,
): RegistrationInvoice {
  const fee = shortCourseFee(definition);
  const unlocked = enrollment.status === "awaiting_payment";
  return {
    id: `INV-${enrollment.id}`,
    registrationId: enrollment.id,
    studentId: enrollment.studentId,
    description: `ค่าหลักสูตร Short Course ${enrollment.creditBankCode ? `${enrollment.creditBankCode} ` : ""}${enrollment.courseTitle}`,
    baseAmount: fee.amount,
    status: unlocked ? "awaiting_payment" : "locked",
    createdAt: at,
    updatedAt: at,
    kind: "short_course",
    payee: shortCoursePayee(definition),
  };
}

function assertInstitutionActor(enrollment: ShortCourseEnrollment, actor: ShortCourseActor) {
  if (actor.role !== "institution_admin" || actor.organisationId !== enrollment.institutionId) {
    throw new Error("เฉพาะผู้ดูแลสถาบันหลักของหลักสูตรนี้เท่านั้นที่ดำเนินการได้");
  }
}

export function reviewShortCourseEnrollment(
  enrollment: ShortCourseEnrollment,
  decision: "approve" | "reject",
  actor: ShortCourseActor,
  options: { at: string; reason?: string },
) {
  assertInstitutionActor(enrollment, actor);
  if (enrollment.status !== "pending_approval") throw new Error("คำขอนี้ไม่ได้อยู่ในสถานะรออนุมัติ");
  if (decision === "reject") {
    const reason = requireReason(options.reason, "กรุณาระบุเหตุผลการไม่อนุมัติ");
    return { ...move(enrollment, "rejected", actor, options.at, reason), decisionReason: reason };
  }
  return move(enrollment, "awaiting_payment", actor, options.at, options.reason ?? "อนุมัติคำขอลงทะเบียน");
}

export function markShortCoursePaid(enrollment: ShortCourseEnrollment, at: string, evidenceReference: string) {
  if (enrollment.status === "registered") return enrollment;
  if (enrollment.status !== "awaiting_payment") throw new Error("ยังชำระเงินรายการนี้ไม่ได้");
  return move(enrollment, "registered", "system", at, `ยืนยันรับชำระเงิน (${evidenceReference})`);
}

export function recordShortCourseAssessment(
  enrollment: ShortCourseEnrollment,
  result: "pass" | "fail",
  actor: ShortCourseActor,
  options: { at: string; note: string },
) {
  assertInstitutionActor(enrollment, actor);
  if (enrollment.status !== "registered") throw new Error("บันทึกผลได้เฉพาะผู้เรียนที่ลงทะเบียนสำเร็จแล้ว");
  const note = requireReason(options.note, "กรุณาระบุหมายเหตุผลการประเมิน");
  const assessment: ShortCourseAssessment = { result, note, recordedBy: actor.userName, recordedAt: options.at };
  if (enrollment.creditBank) {
    // Credit Bank: ต้องรอเจ้าหน้าที่ราชวิทยาลัยอนุมัติผลก่อน จึงยังไม่เพิ่มหน่วยกิต
    return { ...move(enrollment, "assessment_recorded", actor, options.at, note), assessment };
  }
  // ไม่ต่อยอด: บันทึกประวัติการอบรม ออก Certificate เมื่อผ่าน ไม่สร้าง Credit Bank
  const recorded = { ...move(enrollment, result === "pass" ? "completed" : "failed", actor, options.at, note), assessment };
  return result === "pass" ? issueShortCourseCertificate(recorded, options.at) : recorded;
}

export function approveShortCourseAssessment(
  enrollment: ShortCourseEnrollment,
  decision: "approve" | "return",
  actor: ShortCourseActor,
  options: { at: string; reason?: string },
) {
  if (actor.role !== "royal_college_staff") throw new Error("เฉพาะเจ้าหน้าที่ราชวิทยาลัยเท่านั้นที่อนุมัติผลการประเมินได้");
  if (!enrollment.creditBank) throw new Error("หลักสูตรนี้ไม่ใช่หลักสูตร Credit Bank");
  if (enrollment.status !== "assessment_recorded" || !enrollment.assessment) {
    throw new Error("ยังไม่มีผลการประเมินที่รออนุมัติ");
  }
  if (decision === "return") {
    const reason = requireReason(options.reason, "กรุณาระบุเหตุผลการส่งกลับให้สถาบันแก้ไข");
    return { ...move(enrollment, "registered", actor, options.at, reason), assessment: undefined };
  }
  if (enrollment.assessment.result === "fail") {
    return move(enrollment, "failed", actor, options.at, options.reason ?? "อนุมัติผลการประเมิน: ไม่ผ่าน");
  }
  const completed = {
    ...move(enrollment, "completed", actor, options.at, options.reason ?? "อนุมัติผลการประเมิน: ผ่าน"),
    creditsAwarded: enrollment.credits,
  };
  return issueShortCourseCertificate(completed, options.at);
}

export function issueShortCourseCertificate(enrollment: ShortCourseEnrollment, at: string): ShortCourseEnrollment {
  if (enrollment.status !== "completed") throw new Error("ออก Certificate ได้เฉพาะผู้ที่ผ่านเงื่อนไขแล้ว");
  if (enrollment.certificateNo) return enrollment;
  return {
    ...enrollment,
    certificateNo: createReceiptNumber(enrollment.id, at).replace(/^RC-/, "SC-"),
    certificateIssuedAt: at,
  };
}

export function isShortCourseEnrollmentStatus(value: unknown): value is ShortCourseEnrollmentStatus {
  return typeof value === "string" && (shortCourseEnrollmentStatuses as readonly string[]).includes(value);
}

/** ป้องกันสมัครหลักสูตรเดิมซ้ำขณะที่ยังมีรายการค้างอยู่หรือผ่านแล้ว */
export function findActiveShortCourseEnrollment(
  enrollments: readonly ShortCourseEnrollment[],
  studentId: string,
  courseId: string,
) {
  return enrollments.find((item) => (
    item.studentId === studentId &&
    item.courseId === courseId &&
    item.status !== "rejected" &&
    item.status !== "cancelled" &&
    item.status !== "failed"
  ));
}

export function normalizeShortCourseEnrollments(value: unknown): ShortCourseEnrollment[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is ShortCourseEnrollment => {
    if (!item || typeof item !== "object") return false;
    const record = item as Record<string, unknown>;
    return typeof record.id === "string" &&
      typeof record.studentId === "string" &&
      typeof record.courseId === "string" &&
      typeof record.institutionId === "string" &&
      typeof record.credits === "number" &&
      typeof record.creditBank === "boolean" &&
      isShortCourseEnrollmentStatus(record.status) &&
      Array.isArray(record.history);
  }).map((item) => ({
    ...item,
    // หน่วยกิตต้องไม่เกิดขึ้นก่อนผลได้รับอนุมัติ แม้ข้อมูลที่เก็บไว้จะผิดรูปแบบ
    creditsAwarded: item.creditBank && item.status === "completed" ? item.credits : 0,
  }));
}
