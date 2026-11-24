/**
 * ใบสมัคร 4 เส้นทาง (สรุปประชุม Flow 3) — ผู้สมัครทุกรายเริ่มจากเว็บสภาเภสัชกรรม
 *
 * A short_course              เรียนเลย ไม่ต่อยอด: ชำระค่าคอร์ส → เข้าเรียน (ไม่เป็นสมาชิก)
 * B short_course_credit_bank  เรียนเลย ต่อยอด: ชำระค่าคอร์ส → ต้องเป็นวิสามัญ → เข้าเรียน
 * C entrance_exam             สอบเข้า ป.สูง 1 ปี / วุฒิบัตร 4 ปี: ค่าสมัครสอบ → มีสิทธิ์สอบ → ผล
 *                             → ผ่าน → ลงทะเบียน + วิสามัญ → เข้าเรียน
 * D approval_exam             สอบอนุมัติบัตร: ค่าสมัครสอบ → มีสิทธิ์สอบ → ผล (จบที่ผ่าน/ไม่ผ่าน;
 *                             การขึ้นวิสามัญ/สามัญต่อจากนี้อยู่ในโมดูลสมาชิกและคำขอ)
 */
import type { SystemRole } from "@/roles/shared/features/roles/access-model";
import { hasActiveMembership, type MembershipRecord } from "@/roles/shared/features/membership";

/** ระดับวุฒิ 4 ช่องทางตามข้อบังคับ (ยืนยันโดยผู้รู้ข้อบังคับในที่ประชุม) */
export const credentialTracks = ["certificate", "higher_certificate", "board_certificate", "approval"] as const;
export type CredentialTrack = (typeof credentialTracks)[number];

export const credentialTrackLabel: Readonly<Record<CredentialTrack, string>> = {
  certificate: "ประกาศนียบัตร (4 เดือน)",
  higher_certificate: "ประกาศนียบัตรชั้นสูง (1 ปี)",
  board_certificate: "วุฒิบัตร (4 ปี)",
  approval: "หนังสืออนุมัติ",
};

export const applicationRoutes = ["short_course", "short_course_credit_bank", "entrance_exam", "approval_exam"] as const;
export type ApplicationRoute = (typeof applicationRoutes)[number];

export const applicationStatuses = [
  "draft",
  "awaiting_fee",
  "fee_paid",
  "eligible",
  "ineligible",
  "passed",
  "failed",
  "admitted",
  "cancelled",
] as const;
export type ApplicationStatus = (typeof applicationStatuses)[number];

type TransitionTable = Partial<Record<ApplicationStatus, readonly ApplicationStatus[]>>;

const shortCourseTransitions: TransitionTable = {
  draft: ["awaiting_fee", "cancelled"],
  awaiting_fee: ["fee_paid", "cancelled"],
  fee_paid: ["admitted"],
};
const examTransitions: TransitionTable = {
  draft: ["awaiting_fee", "cancelled"],
  awaiting_fee: ["fee_paid", "cancelled"],
  fee_paid: ["eligible", "ineligible"],
  eligible: ["passed", "failed"],
};

const allowedTransitions: Readonly<Record<ApplicationRoute, TransitionTable>> = {
  short_course: shortCourseTransitions,
  short_course_credit_bank: shortCourseTransitions,
  entrance_exam: { ...examTransitions, passed: ["admitted"] },
  approval_exam: examTransitions,
};

const reasonRequired = new Set<ApplicationStatus>(["ineligible", "cancelled"]);

export function resolveApplicationRoute(input: { track: CredentialTrack; creditBank?: boolean }): ApplicationRoute {
  if (input.track === "certificate") return input.creditBank ? "short_course_credit_bank" : "short_course";
  if (input.track === "approval") return "approval_exam";
  return "entrance_exam";
}

/** เส้นทางที่ต้องเป็นสมาชิก (วิสามัญหรือสามัญที่ยังมีผล) ก่อนเข้าเรียน */
export function requiresMembershipToAdmit(route: ApplicationRoute) {
  return route === "short_course_credit_bank" || route === "entrance_exam";
}

export interface ApplicationActor {
  userId: string;
  userName: string;
  role: SystemRole;
}

export interface ApplicationHistoryEntry {
  id: string;
  from: ApplicationStatus;
  to: ApplicationStatus;
  actor: ApplicationActor | "system";
  at: string;
  reason?: string;
}

export interface Application {
  id: string;
  route: ApplicationRoute;
  applicantId: string;
  collegeOrganisationId: string;
  /** หลักสูตรที่เลือก — ไม่ใช้กับเส้นทางสอบอนุมัติบัตร */
  programId?: string;
  /** สถาบันฝึกอบรมที่เลือกตอนสมัครสอบเข้า (ใช้ตรวจโควตาที่นั่ง) */
  trainingInstitutionId?: string;
  status: ApplicationStatus;
  createdAt: string;
  updatedAt: string;
  history: ApplicationHistoryEntry[];
}

export function createApplication(input: Omit<Application, "status" | "updatedAt" | "history">): Application {
  if (!input.collegeOrganisationId.trim()) throw new Error("ต้องเลือกวิทยาลัย");
  if (input.route !== "approval_exam" && !input.programId?.trim()) throw new Error("ต้องเลือกหลักสูตร");
  if (input.route === "entrance_exam" && !input.trainingInstitutionId?.trim()) {
    throw new Error("ต้องเลือกสถาบันฝึกอบรม");
  }
  return { ...input, status: "draft", updatedAt: input.createdAt, history: [] };
}

export function canTransitionApplication(route: ApplicationRoute, from: ApplicationStatus, to: ApplicationStatus) {
  return allowedTransitions[route][from]?.includes(to) ?? false;
}

export function transitionApplication(
  application: Application,
  to: ApplicationStatus,
  actor: ApplicationActor | "system",
  options: { at: string; reason?: string; membership?: MembershipRecord },
): Application {
  if (!canTransitionApplication(application.route, application.status, to)) {
    throw new Error(`Invalid application transition (${application.route}): ${application.status} -> ${to}`);
  }
  const reason = options.reason?.trim();
  if (reasonRequired.has(to) && !reason) throw new Error(`Application transition to ${to} requires a reason`);
  if (to === "admitted" && requiresMembershipToAdmit(application.route)) {
    if (!options.membership || options.membership.memberId !== application.applicantId) {
      throw new Error("ต้องมีข้อมูลสมาชิกของผู้สมัครก่อนรับเข้าเรียน");
    }
    if (!hasActiveMembership(options.membership, options.at)) {
      throw new Error("ผู้สมัครต้องเป็นสมาชิกวิสามัญหรือสามัญที่ยังมีผลก่อนรับเข้าเรียน");
    }
  }
  return {
    ...application,
    status: to,
    updatedAt: options.at,
    history: [...application.history, {
      id: `${application.id}-${application.history.length + 1}`,
      from: application.status,
      to,
      actor,
      at: options.at,
      ...(reason ? { reason } : {}),
    }],
  };
}
