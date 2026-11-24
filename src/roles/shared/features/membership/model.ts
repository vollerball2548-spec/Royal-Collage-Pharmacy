/**
 * สถานะสมาชิกราชวิทยาลัย (สรุปประชุม: ไม่มีระดับภาคี มีแค่ วิสามัญ / สามัญ)
 *
 * - none: ไม่เป็นสมาชิก (เช่น ผู้เรียน Short Course ไม่ต่อยอด) เก็บไว้เป็นประวัติ
 * - extraordinary: วิสามัญ ได้เมื่อจ่ายค่าขึ้นทะเบียน มีอายุตามนโยบายนับจากวันจ่าย
 * - ordinary: สามัญ ได้เมื่อมีวุฒิบัตรหรือหนังสืออนุมัติ และยื่นคำขอพร้อมชำระเงิน
 * - lapsed: ไม่เก็บลงฐานข้อมูล คำนวณจากวันหมดอายุ จึงไม่ต้องมีงานตั้งเวลาเปลี่ยนสถานะ
 */
import type { SystemRole } from "@/roles/shared/features/roles/access-model";

export const storedMembershipStatuses = ["none", "extraordinary", "ordinary"] as const;
export type StoredMembershipStatus = (typeof storedMembershipStatuses)[number];
export type MembershipStatus = StoredMembershipStatus | "lapsed";

export const membershipStatusLabel: Readonly<Record<MembershipStatus, string>> = {
  none: "ไม่เป็นสมาชิก",
  extraordinary: "สมาชิกวิสามัญ",
  ordinary: "สมาชิกสามัญ",
  lapsed: "ขาดสมาชิกภาพ (วิสามัญหมดอายุ)",
};

// shortcut: ตัวเลขจากสรุปประชุม ยังไม่มีระเบียบรองรับ ย้ายไปตารางตั้งค่าใน DB ในระยะ 2
export const membershipPolicy = {
  extraordinaryFee: 1_000,
  renewalFee: 500,
  ordinaryFee: 1_500,
  extraordinaryTermYears: 5,
} as const;

export interface MembershipActor {
  userId: string;
  userName: string;
  role: SystemRole;
}

export type MembershipEventType = "registered_extraordinary" | "renewed" | "upgraded_ordinary";

export interface MembershipEvent {
  id: string;
  type: MembershipEventType;
  from: MembershipStatus;
  to: StoredMembershipStatus;
  at: string;
  paymentReference: string;
  evidenceReference?: string;
  actor: MembershipActor | "system";
}

export interface MembershipRecord {
  memberId: string;
  status: StoredMembershipStatus;
  extraordinarySince?: string;
  expiresAt?: string;
  ordinarySince?: string;
  history: MembershipEvent[];
}

export interface MembershipPaymentInput {
  paidAt: string;
  paymentReference: string;
  actor: MembershipActor | "system";
  evidenceReference?: string;
}

export function createMembershipRecord(memberId: string): MembershipRecord {
  return { memberId, status: "none", history: [] };
}

export function addYears(iso: string, years: number) {
  const date = new Date(iso);
  date.setUTCFullYear(date.getUTCFullYear() + years);
  return date.toISOString();
}

export function effectiveMembershipStatus(record: MembershipRecord, now: string): MembershipStatus {
  if (record.status === "extraordinary" && record.expiresAt && Date.parse(now) >= Date.parse(record.expiresAt)) {
    return "lapsed";
  }
  return record.status;
}

/** สมาชิกที่ยังมีผล (วิสามัญที่ยังไม่หมดอายุ หรือสามัญ) */
export function hasActiveMembership(record: MembershipRecord, now: string) {
  const status = effectiveMembershipStatus(record, now);
  return status === "extraordinary" || status === "ordinary";
}

function validatePayment(input: MembershipPaymentInput) {
  if (!Number.isFinite(Date.parse(input.paidAt))) throw new Error("วันที่ชำระเงินไม่ถูกต้อง");
  const paymentReference = input.paymentReference.trim();
  if (!paymentReference) throw new Error("ต้องระบุเลขอ้างอิงการชำระเงิน");
  return paymentReference;
}

function appendEvent(
  record: MembershipRecord,
  type: MembershipEventType,
  to: StoredMembershipStatus,
  input: MembershipPaymentInput,
  paymentReference: string,
): MembershipEvent[] {
  const evidenceReference = input.evidenceReference?.trim();
  return [...record.history, {
    id: `${record.memberId}-membership-${record.history.length + 1}`,
    type,
    from: effectiveMembershipStatus(record, input.paidAt),
    to,
    at: input.paidAt,
    paymentReference,
    ...(evidenceReference ? { evidenceReference } : {}),
    actor: input.actor,
  }];
}

export function registerExtraordinary(record: MembershipRecord, input: MembershipPaymentInput): MembershipRecord {
  const paymentReference = validatePayment(input);
  const current = effectiveMembershipStatus(record, input.paidAt);
  if (current !== "none") {
    throw new Error(`ขึ้นทะเบียนวิสามัญได้เฉพาะผู้ที่ยังไม่เป็นสมาชิก (สถานะปัจจุบัน: ${current})`);
  }
  return {
    ...record,
    status: "extraordinary",
    extraordinarySince: input.paidAt,
    expiresAt: addYears(input.paidAt, membershipPolicy.extraordinaryTermYears),
    history: appendEvent(record, "registered_extraordinary", "extraordinary", input, paymentReference),
  };
}

/**
 * ต่ออายุวิสามัญ: จ่ายก่อนหมดอายุ ต่อจากวันหมดอายุเดิม / จ่ายหลังขาดสมาชิกภาพ นับจากวันจ่าย
 * (สมมติฐาน: ผู้ขาดสมาชิกภาพต่ออายุได้ด้วยค่าต่ออายุ — รอเจ้าของระบบยืนยัน)
 */
export function renewExtraordinary(record: MembershipRecord, input: MembershipPaymentInput): MembershipRecord {
  const paymentReference = validatePayment(input);
  if (record.status !== "extraordinary" || !record.expiresAt) {
    throw new Error("ต่ออายุได้เฉพาะสมาชิกวิสามัญ");
  }
  const base = Math.max(Date.parse(record.expiresAt), Date.parse(input.paidAt));
  return {
    ...record,
    expiresAt: addYears(new Date(base).toISOString(), membershipPolicy.extraordinaryTermYears),
    history: appendEvent(record, "renewed", "extraordinary", input, paymentReference),
  };
}

/** เลื่อนเป็นสามัญ: ต้องเป็นวิสามัญที่ยังมีผล และแนบหลักฐานวุฒิบัตรหรือหนังสืออนุมัติ */
export function upgradeToOrdinary(record: MembershipRecord, input: MembershipPaymentInput): MembershipRecord {
  const paymentReference = validatePayment(input);
  const current = effectiveMembershipStatus(record, input.paidAt);
  if (current !== "extraordinary") {
    throw new Error(`เลื่อนเป็นสามัญได้เฉพาะสมาชิกวิสามัญที่ยังมีผล (สถานะปัจจุบัน: ${current})`);
  }
  if (!input.evidenceReference?.trim()) {
    throw new Error("ต้องแนบเลขอ้างอิงวุฒิบัตรหรือหนังสืออนุมัติ");
  }
  return {
    ...record,
    status: "ordinary",
    ordinarySince: input.paidAt,
    expiresAt: undefined,
    history: appendEvent(record, "upgraded_ordinary", "ordinary", input, paymentReference),
  };
}
