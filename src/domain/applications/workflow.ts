import { membershipPolicy } from "@/roles/shared/features/membership/model";
import { organisationContains, ORGANISATION_LIST } from "@/roles/shared/features/roles/access-model";
import { validateForm, visibleDocumentFields } from "@/domain/forms/evaluate";
import type { FileValue, FormAnswers, FormTemplate } from "@/domain/forms/schema";
import type {
  Application,
  ApplicationActor,
  ApplicationDocument,
  ApplicationKind,
  ApplicationStatus,
  AuditEntry,
  DocumentReviewStatus,
  PaymentPurpose,
  PaymentRecord,
} from "./model";
import type { PaymentResult } from "@/data/payments/adapter";

/**
 * Workflow แยก 3 เส้นทาง
 * - study:          ร่าง → รอชำระ → (Credit Bank: รอขึ้นทะเบียนวิสามัญ) → ลงทะเบียนเรียน → สำเร็จ
 * - entrance_exam:  ร่าง → รอชำระค่าสมัคร → ตรวจ (↔ แก้ไข) → ประกาศรายชื่อ → ผ่าน/ไม่ผ่าน
 *                   → ผ่าน: ลงทะเบียน + ชำระค่าเรียน → วิสามัญ → ลงทะเบียนเรียน
 * - approval_exam:  ร่าง → รอชำระค่าสมัคร → ตรวจเอกสาร (↔ แก้ไข) → จัดสอบ → ผ่าน/ไม่ผ่าน
 *                   → ผ่าน: ออกหนังสืออนุมัติ + คำขอเลื่อนเป็นสมาชิกสามัญ
 */
// TODO(business): flow ใหม่ให้ชำระค่าสมัครก่อนเจ้าหน้าที่ตรวจ — หากตรวจแล้วไม่ผ่านจะคืนเงินหรือไม่ ยังไม่มีระเบียบ

export type ApplicantAction = "save_draft" | "submit" | "pay" | "resubmit" | "enroll" | "cancel";
export type StaffAction = "set_fee" | "review_document" | "request_revision" | "approve_eligibility" | "reject" | "record_result" | "issue_approval" | "complete";
export type ApplicationAction = ApplicantAction | StaffAction;

export const actionLabel: Readonly<Record<ApplicationAction, string>> = {
  save_draft: "บันทึกร่าง",
  submit: "ส่งใบสมัคร",
  pay: "ชำระเงิน",
  resubmit: "ส่งเอกสารแก้ไข",
  enroll: "ลงทะเบียนเรียน",
  cancel: "ยกเลิกใบสมัคร",
  set_fee: "กำหนดค่าธรรมเนียม",
  review_document: "ตรวจเอกสาร",
  request_revision: "ขอให้แก้ไขเอกสาร",
  approve_eligibility: "อนุมัติสิทธิ์สอบ / ประกาศรายชื่อ",
  reject: "ไม่อนุมัติ",
  record_result: "บันทึกผลสอบ",
  issue_approval: "ออกหนังสืออนุมัติ",
  complete: "บันทึกสำเร็จการอบรม",
};

const APPLICANT_ACTIONS: readonly ApplicationAction[] = ["save_draft", "submit", "pay", "resubmit", "enroll", "cancel"];

const allowedFrom: Readonly<Record<ApplicationKind, Partial<Record<ApplicationAction, readonly ApplicationStatus[]>>>> = {
  study: {
    save_draft: ["draft"], submit: ["draft"], pay: ["awaiting_payment", "membership_pending"], cancel: ["draft", "awaiting_payment"],
    set_fee: ["awaiting_payment"], complete: ["enrolled"],
  },
  entrance_exam: {
    save_draft: ["draft"], submit: ["draft"], pay: ["awaiting_payment", "awaiting_tuition", "membership_pending"], cancel: ["draft", "awaiting_payment"],
    resubmit: ["needs_revision"], enroll: ["passed"],
    set_fee: ["awaiting_payment", "passed"], review_document: ["under_review", "needs_revision"], request_revision: ["under_review"],
    approve_eligibility: ["under_review"], reject: ["under_review", "needs_revision"], record_result: ["eligible"],
  },
  approval_exam: {
    save_draft: ["draft"], submit: ["draft"], pay: ["awaiting_payment", "approval_issued"], cancel: ["draft", "awaiting_payment"],
    resubmit: ["needs_revision"],
    set_fee: ["awaiting_payment"], review_document: ["under_review", "needs_revision"], request_revision: ["under_review"],
    approve_eligibility: ["under_review"], reject: ["under_review", "needs_revision"], record_result: ["eligible"], issue_approval: ["passed"],
  },
};

/**
 * สิทธิ์: ผู้สมัครทำได้เฉพาะใบสมัครของตน; เจ้าหน้าที่ราชวิทยาลัยดำเนินการได้ทุกใบ;
 * Institution Admin ดำเนินการได้เฉพาะใบสมัครที่เลือกสถาบันของตน
 */
// TODO(business): เจ้าหน้าที่วิทยาลัยตรวจใบสมัครของวิทยาลัยตนได้หรือไม่ — ตอนนี้ดูได้อย่างเดียว
export function canActOn(actor: ApplicationActor, application: Application, action: ApplicationAction) {
  const from = allowedFrom[application.kind][action];
  if (!from || !from.includes(application.status)) return false;
  if (APPLICANT_ACTIONS.includes(action)) {
    return actor.role === "student" && actor.userId === application.applicantId;
  }
  if (actor.role === "royal_college_staff") return true;
  if (actor.role === "institution_admin" && application.institutionId) {
    const scope = ORGANISATION_LIST.find((organisation) => organisation.id === actor.organisationId);
    return Boolean(scope && organisationContains(scope, application.institutionId)) && action !== "issue_approval";
  }
  return false;
}

export function availableActions(actor: ApplicationActor, application: Application): ApplicationAction[] {
  return (Object.keys(actionLabel) as ApplicationAction[]).filter((action) => canActOn(actor, application, action));
}

function audit(actor: ApplicationActor, at: string, action: string, extra: Partial<AuditEntry> = {}): AuditEntry {
  return { at, actorId: actor.userId, actorName: actor.userName, actorRole: actor.role, action, ...extra };
}

function move(application: Application, to: ApplicationStatus, actor: ApplicationActor, at: string, action: string, note?: string, patch: Partial<Application> = {}): Application {
  return {
    ...application,
    ...patch,
    status: to,
    updatedAt: at,
    history: [...application.history, audit(actor, at, action, { from: application.status, to, ...(note ? { note } : {}) })],
  };
}

function assertCan(actor: ApplicationActor, application: Application, action: ApplicationAction) {
  if (!canActOn(actor, application, action)) {
    throw new Error(`ไม่สามารถ "${actionLabel[action]}" ได้ในสถานะปัจจุบัน หรือไม่มีสิทธิ์`);
  }
}

// ─── เอกสาร ────────────────────────────────────────────────────────────────────

/** สร้าง/ปรับ checklist ตามฟิลด์แนบไฟล์ที่มองเห็นได้ในฟอร์ม โดยคงผลตรวจเดิมของเอกสารที่ไม่เปลี่ยนไฟล์ */
export function syncDocuments(template: FormTemplate, answers: FormAnswers, context: Application["context"], previous: readonly ApplicationDocument[] = []): ApplicationDocument[] {
  return visibleDocumentFields(template, answers, context).map((field) => {
    const file = answers[field.id] as FileValue | undefined;
    const before = previous.find((document) => document.documentId === field.documentId);
    const sameFile = before?.file?.name === file?.name && before?.file?.uploadedAt === file?.uploadedAt;
    const required = field.required === true;
    return sameFile && before
      ? { ...before, label: field.label, required }
      : { documentId: field.documentId, label: field.label, required, ...(file ? { file } : {}), status: "pending" as const };
  });
}

export function requiredDocumentsApproved(application: Application) {
  return application.documents.every((document) => !document.required || (document.file && document.status === "approved"));
}

// ─── การกระทำของผู้สมัคร ─────────────────────────────────────────────────────────

export function saveDraft(application: Application, template: FormTemplate, answers: FormAnswers, actor: ApplicationActor, at: string): Application {
  assertCan(actor, application, "save_draft");
  const changed = Object.keys(answers).filter((key) => JSON.stringify(answers[key]) !== JSON.stringify(application.answers[key]));
  return {
    ...application,
    answers,
    documents: syncDocuments(template, answers, application.context, application.documents),
    updatedAt: at,
    history: changed.length > 0 ? [...application.history, audit(actor, at, "save_draft", { changedFields: changed })] : application.history,
  };
}

export function submitApplication(application: Application, template: FormTemplate, actor: ApplicationActor, at: string, seatsLeft?: number): Application {
  assertCan(actor, application, "submit");
  const errors = validateForm(template, application.answers, application.context);
  if (errors.length > 0) throw new Error(`ข้อมูลยังไม่ครบ: ${errors[0].message}`);
  if (seatsLeft !== undefined && seatsLeft <= 0) throw new Error("ที่นั่งของสถาบัน/รอบนี้เต็มแล้ว");
  return move(application, "awaiting_payment", actor, at, "submit", undefined, {
    submittedAt: at,
    documents: syncDocuments(template, application.answers, application.context, application.documents),
  });
}

/** ยอดที่ต้องชำระในสถานะปัจจุบัน — undefined เมื่อยังไม่มีอัตรา */
export function amountDue(application: Application): { purpose: PaymentPurpose; amount?: number } | undefined {
  switch (application.status) {
    case "awaiting_payment":
      return { purpose: "application_fee", amount: application.fees.application };
    case "awaiting_tuition":
      return { purpose: "tuition", amount: application.fees.tuition };
    case "membership_pending":
      return { purpose: "membership", amount: membershipPolicy.extraordinaryFee };
    case "approval_issued":
      return application.membershipUpgradeRequest?.status === "awaiting_payment"
        ? { purpose: "membership_upgrade", amount: membershipPolicy.ordinaryFee }
        : undefined;
    default:
      return undefined;
  }
}

/** บันทึกผลชำระจาก Payment Adapter แล้วเลื่อนสถานะ */
export function recordPayment(
  application: Application,
  result: PaymentResult & { reference: string; amount: number },
  actor: ApplicationActor,
  context: { hasActiveMembership: boolean },
): Application {
  assertCan(actor, application, "pay");
  const due = amountDue(application);
  if (!due || due.amount === undefined) throw new Error("ยังไม่มีอัตราค่าธรรมเนียมสำหรับรายการนี้");
  if (result.amount !== due.amount) throw new Error("ยอดชำระไม่ตรงกับยอดที่ต้องชำระ");
  const payment: PaymentRecord = {
    purpose: due.purpose, amount: result.amount, reference: result.reference, chargeId: result.chargeId,
    adapter: result.adapter, status: result.status, processedAt: result.processedAt,
  };
  const withPayment = { ...application, payments: [...application.payments, payment] };
  if (result.status !== "paid") {
    return { ...withPayment, updatedAt: result.processedAt, history: [...application.history, audit(actor, result.processedAt, `payment_${result.status}`, { note: payment.reference })] };
  }
  const at = result.processedAt;
  const creditBank = application.context.creditBank === true;
  const afterMembership: ApplicationStatus = "enrolled";
  switch (due.purpose) {
    case "application_fee":
      if (application.kind === "study") {
        return move(withPayment, creditBank && !context.hasActiveMembership ? "membership_pending" : afterMembership, actor, at, "pay", payment.reference);
      }
      return move(withPayment, "under_review", actor, at, "pay", payment.reference);
    case "tuition":
      return move(withPayment, context.hasActiveMembership ? afterMembership : "membership_pending", actor, at, "pay", payment.reference);
    case "membership":
      return move(withPayment, afterMembership, actor, at, "pay", payment.reference);
    case "membership_upgrade":
      return {
        ...withPayment,
        membershipUpgradeRequest: { status: "paid", requestedAt: application.membershipUpgradeRequest?.requestedAt ?? at },
        updatedAt: at,
        history: [...application.history, audit(actor, at, "pay_membership_upgrade", { note: payment.reference })],
      };
  }
}

export function resubmit(application: Application, template: FormTemplate, answers: FormAnswers, actor: ApplicationActor, at: string): Application {
  assertCan(actor, application, "resubmit");
  const documents = syncDocuments(template, answers, application.context, application.documents);
  if (documents.some((document) => document.status === "needs_revision" || document.status === "rejected")) {
    throw new Error("กรุณาแนบไฟล์ใหม่แทนเอกสารที่ขอให้แก้ไขก่อนส่ง");
  }
  return move({ ...application, answers, documents }, "under_review", actor, at, "resubmit");
}

export function enroll(application: Application, actor: ApplicationActor, at: string): Application {
  assertCan(actor, application, "enroll");
  return move(application, "awaiting_tuition", actor, at, "enroll");
}

export function cancel(application: Application, actor: ApplicationActor, at: string, note?: string): Application {
  assertCan(actor, application, "cancel");
  return move(application, "cancelled", actor, at, "cancel", note);
}

// ─── การกระทำของเจ้าหน้าที่ ──────────────────────────────────────────────────────

export function setFee(application: Application, purpose: "application" | "tuition", amount: number, actor: ApplicationActor, at: string): Application {
  assertCan(actor, application, "set_fee");
  if (!Number.isFinite(amount) || amount < 0) throw new Error("ยอดเงินไม่ถูกต้อง");
  return {
    ...application,
    fees: { ...application.fees, [purpose]: amount },
    updatedAt: at,
    history: [...application.history, audit(actor, at, "set_fee", { note: `${purpose}: ${amount}` })],
  };
}

export function reviewDocument(application: Application, documentId: string, status: DocumentReviewStatus, actor: ApplicationActor, at: string, note?: string): Application {
  assertCan(actor, application, "review_document");
  if ((status === "rejected" || status === "needs_revision") && !note?.trim()) throw new Error("กรุณาระบุเหตุผล");
  if (!application.documents.some((document) => document.documentId === documentId)) throw new Error("ไม่พบเอกสารนี้");
  return {
    ...application,
    documents: application.documents.map((document) => (
      document.documentId === documentId ? { ...document, status, note: note?.trim() || undefined, reviewedBy: actor.userName, reviewedAt: at } : document
    )),
    updatedAt: at,
    history: [...application.history, audit(actor, at, "review_document", { note: `${documentId}: ${status}${note ? ` (${note.trim()})` : ""}` })],
  };
}

export function requestRevision(application: Application, actor: ApplicationActor, at: string, note: string): Application {
  assertCan(actor, application, "request_revision");
  if (!application.documents.some((document) => document.status === "needs_revision" || document.status === "rejected") && !note.trim()) {
    throw new Error("ระบุเอกสารที่ต้องแก้ไขหรือเหตุผล");
  }
  return move(application, "needs_revision", actor, at, "request_revision", note.trim() || undefined);
}

export function approveEligibility(application: Application, actor: ApplicationActor, at: string): Application {
  assertCan(actor, application, "approve_eligibility");
  if (!requiredDocumentsApproved(application)) throw new Error("ต้องตรวจเอกสารที่บังคับให้ผ่านครบก่อนอนุมัติสิทธิ์สอบ");
  return move(application, "eligible", actor, at, "approve_eligibility");
}

export function reject(application: Application, actor: ApplicationActor, at: string, note: string): Application {
  assertCan(actor, application, "reject");
  if (!note.trim()) throw new Error("กรุณาระบุเหตุผล");
  return move(application, "rejected", actor, at, "reject", note.trim());
}

/** ไม่ผ่าน = ปิดใบสมัครพร้อมเก็บผลสอบไว้ในประวัติ */
export function recordResult(application: Application, decision: "passed" | "failed", actor: ApplicationActor, at: string, note?: string): Application {
  assertCan(actor, application, "record_result");
  return move(application, decision, actor, at, "record_result", note, {
    examResult: { decision, ...(note ? { note } : {}), recordedAt: at, recordedBy: actor.userName },
  });
}

export function issueApproval(application: Application, letterNo: string, actor: ApplicationActor, at: string): Application {
  assertCan(actor, application, "issue_approval");
  if (!letterNo.trim()) throw new Error("กรุณาระบุเลขที่หนังสืออนุมัติ");
  // TODO(business): หนังสืออนุมัติออกผ่าน e-Service ของสภาเภสัชกรรม — ระบบบันทึกเลขอ้างอิงเท่านั้น
  return move(application, "approval_issued", actor, at, "issue_approval", letterNo.trim(), {
    approvalLetterNo: letterNo.trim(),
    membershipUpgradeRequest: { status: "awaiting_payment", requestedAt: at },
  });
}

export function complete(application: Application, actor: ApplicationActor, at: string, note?: string): Application {
  assertCan(actor, application, "complete");
  return move(application, "completed", actor, at, "complete", note);
}

// ─── ที่นั่ง ──────────────────────────────────────────────────────────────────

/** ที่นั่งคงเหลือของสถาบัน/รอบ — undefined เมื่อยังไม่มีการประกาศจำนวนที่นั่ง */
export function seatsLeft(
  capacity: number | undefined,
  applications: readonly Application[],
  target: { offeringId: string; institutionId?: string; roundId?: string },
): number | undefined {
  if (capacity === undefined) return undefined;
  const taken = applications.filter((application) => (
    application.offeringId === target.offeringId &&
    (application.institutionId ?? "") === (target.institutionId ?? "") &&
    (application.roundId ?? "") === (target.roundId ?? "") &&
    !["draft", "cancelled", "rejected", "failed"].includes(application.status)
  )).length;
  return Math.max(0, capacity - taken);
}
