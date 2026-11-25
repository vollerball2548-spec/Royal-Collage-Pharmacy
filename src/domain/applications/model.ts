import type { SystemRole } from "@/roles/shared/features/roles/access-model";
import type { FileValue, FormAnswers, FormContext } from "@/domain/forms/schema";

/** เส้นทางการสมัคร 3 แบบที่แยกกันชัด */
export type ApplicationKind = "study" | "entrance_exam" | "approval_exam";

export const applicationKindLabel: Readonly<Record<ApplicationKind, string>> = {
  study: "สมัครเรียน (Short Course / Credit Bank)",
  entrance_exam: "สมัครสอบคัดเลือกเข้าเรียน",
  approval_exam: "สมัครสอบหนังสืออนุมัติ",
};

export const applicationStatuses = [
  "draft",
  "awaiting_payment",
  "under_review",
  "needs_revision",
  "eligible",
  "rejected",
  "passed",
  "failed",
  "awaiting_tuition",
  "membership_pending",
  "enrolled",
  "completed",
  "approval_issued",
  "cancelled",
] as const;
export type ApplicationStatus = (typeof applicationStatuses)[number];

export const applicationStatusMeta: Readonly<Record<ApplicationStatus, { label: string; variant: "neutral" | "info" | "warning" | "success" | "danger" }>> = {
  draft: { label: "ฉบับร่าง", variant: "neutral" },
  awaiting_payment: { label: "รอชำระเงิน", variant: "warning" },
  under_review: { label: "เจ้าหน้าที่กำลังตรวจ", variant: "info" },
  needs_revision: { label: "ขอให้แก้ไขเอกสาร", variant: "warning" },
  eligible: { label: "มีสิทธิ์สอบ (ประกาศรายชื่อแล้ว)", variant: "info" },
  rejected: { label: "ไม่ผ่านการตรวจคุณสมบัติ", variant: "danger" },
  passed: { label: "สอบผ่าน", variant: "success" },
  failed: { label: "สอบไม่ผ่าน (ปิดใบสมัคร)", variant: "danger" },
  awaiting_tuition: { label: "รอชำระค่าลงทะเบียนเรียน", variant: "warning" },
  membership_pending: { label: "รอขึ้นทะเบียนสมาชิกวิสามัญ", variant: "warning" },
  enrolled: { label: "ลงทะเบียนเรียนแล้ว", variant: "success" },
  completed: { label: "สำเร็จการอบรม", variant: "success" },
  approval_issued: { label: "ได้รับหนังสืออนุมัติ", variant: "success" },
  cancelled: { label: "ยกเลิก", variant: "neutral" },
};

/** สถานะที่ปิดใบสมัครแล้ว ไม่กันที่นั่ง */
export const closedStatuses: readonly ApplicationStatus[] = ["draft", "cancelled", "rejected", "failed"];

export type DocumentReviewStatus = "pending" | "approved" | "rejected" | "needs_revision";

export const documentReviewMeta: Readonly<Record<DocumentReviewStatus, { label: string; variant: "info" | "success" | "danger" | "warning" }>> = {
  pending: { label: "รอตรวจ", variant: "info" },
  approved: { label: "ผ่าน", variant: "success" },
  rejected: { label: "ไม่ผ่าน", variant: "danger" },
  needs_revision: { label: "ขอแก้ไข", variant: "warning" },
};

export interface ApplicationDocument {
  documentId: string;
  label: string;
  required: boolean;
  file?: FileValue;
  status: DocumentReviewStatus;
  note?: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

export type PaymentPurpose = "application_fee" | "tuition" | "membership" | "membership_upgrade";

export const paymentPurposeLabel: Readonly<Record<PaymentPurpose, string>> = {
  application_fee: "ค่าสมัคร",
  tuition: "ค่าลงทะเบียนเรียน",
  membership: "ค่าขึ้นทะเบียนสมาชิกวิสามัญ",
  membership_upgrade: "ค่าเลื่อนเป็นสมาชิกสามัญ",
};

export interface PaymentRecord {
  purpose: PaymentPurpose;
  amount: number;
  reference: string;
  chargeId: string;
  adapter: string;
  status: "paid" | "pending" | "failed";
  processedAt: string;
}

export interface ApplicationActor {
  userId: string;
  userName: string;
  role: SystemRole;
  organisationId: string;
}

export interface AuditEntry {
  at: string;
  actorId: string;
  actorName: string;
  actorRole: SystemRole;
  action: string;
  from?: ApplicationStatus;
  to?: ApplicationStatus;
  note?: string;
  /** ฟิลด์ที่เปลี่ยน (สำหรับการแก้ไขร่าง/คำตอบ) */
  changedFields?: string[];
}

export interface Application {
  id: string;
  kind: ApplicationKind;
  templateId: string;
  templateVersion: number;
  applicantId: string;
  applicantName: string;
  licenseNumber: string;
  offeringId: string;
  offeringTitle: string;
  collegeCode: string;
  institutionId?: string;
  institutionName?: string;
  roundId?: string;
  roundLabel?: string;
  /** บริบทที่ใช้ประเมินเงื่อนไขฟอร์ม (ประเภท, วิทยาลัย, Credit Bank ฯลฯ) */
  context: FormContext;
  answers: FormAnswers;
  documents: ApplicationDocument[];
  /** undefined = ยังไม่มีอัตราในแหล่งข้อมูล — เจ้าหน้าที่ต้องกำหนดก่อนเปิดชำระ */
  fees: { application?: number; tuition?: number };
  payments: PaymentRecord[];
  status: ApplicationStatus;
  examResult?: { decision: "passed" | "failed"; note?: string; recordedAt: string; recordedBy: string };
  approvalLetterNo?: string;
  /** หลังได้หนังสืออนุมัติ: คำขอเลื่อนเป็นสมาชิกสามัญ (ไม่เปลี่ยนสถานะสมาชิกอัตโนมัติ) */
  membershipUpgradeRequest?: { status: "awaiting_payment" | "paid"; requestedAt: string };
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  history: AuditEntry[];
}
