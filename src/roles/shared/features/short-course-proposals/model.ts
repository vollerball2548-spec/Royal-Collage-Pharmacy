import type { CollegeCode } from "@/roles/shared/data/college-directory";
import type { SystemRole } from "@/roles/shared/features/roles/access-model";

/**
 * คำขอเปิดหลักสูตรระยะสั้น ตามแม่แบบ "ประกาศนียบัตรวิชาชีพเภสัชกรรม" (ข้อ 1–12)
 * เกณฑ์ขั้นต่ำทุกข้อในไฟล์นี้มาจากแม่แบบ ไม่ได้กำหนดขึ้นเอง
 */

export const shortCourseProposalStatuses = [
  "draft",
  "submitted",
  "under_review",
  "revision_requested",
  "approved",
  "rejected",
  "published",
  "closed",
] as const;
export type ShortCourseProposalStatus = (typeof shortCourseProposalStatuses)[number];

export const proposalStatusMeta: Readonly<Record<ShortCourseProposalStatus, { label: string; variant: "neutral" | "info" | "warning" | "success" | "danger" | "secondary" }>> = {
  draft: { label: "ฉบับร่าง", variant: "neutral" },
  submitted: { label: "ส่งคำขอแล้ว", variant: "info" },
  under_review: { label: "อยู่ระหว่างพิจารณา", variant: "info" },
  revision_requested: { label: "ขอให้แก้ไข", variant: "warning" },
  approved: { label: "อนุมัติแล้ว", variant: "success" },
  rejected: { label: "ไม่อนุมัติ", variant: "danger" },
  published: { label: "เผยแพร่ / เปิดรับสมัคร", variant: "success" },
  closed: { label: "ปิดหลักสูตร", variant: "secondary" },
};

export interface ProposalPerson {
  name: string;
  affiliation: string;
  background: string;
}

export interface ProposalTopic {
  topic: string;
  hours: number;
  instructor: string;
}

export interface ProposalRound {
  id: string;
  /** รอบการอบรมที่ */
  no: number;
  startDate: string;
  endDate: string;
  status: "planned" | "open" | "closed";
}

export interface ShortCourseProposalDetails {
  // 1–2 ชื่อหลักสูตรและชื่อประกาศนียบัตร
  titleTh: string;
  titleEn: string;
  certificateNameTh: string;
  certificateNameEn: string;
  // 3 หน่วยงานที่รับผิดชอบ
  collegeCode: CollegeCode;
  mainAndAffiliateInstitutions: string;
  otherResponsibleUnits: string;
  // 4 ปรัชญาและวัตถุประสงค์
  objectives: string;
  // 5 กำหนดการเปิดอบรม
  capacityPerRound: number;
  rounds: ProposalRound[];
  // 6 คุณสมบัติเพิ่มเติม (6.4)
  extraQualifications: string;
  // 8 โครงสร้างหลักสูตร
  durationWeeks: number;
  theoryCredits: number;
  practiceCredits: number;
  theoryLocation: string;
  topics: ProposalTopic[];
  practiceDetails: string;
  // 9 หน่วยงานที่จัดดำเนินการ
  organiser: string;
  practiceSite: string;
  coordinators: ProposalPerson[];
  trainers: ProposalPerson[];
  books: string[];
  journals: string[];
  computers: number;
  // 10 งบประมาณ, 12 การสมัคร
  budget: string;
  applicationDetails: string;
}

export interface ProposalActor {
  userId: string;
  userName: string;
  role: SystemRole;
  organisationId: string;
}

export interface ProposalHistoryEntry {
  from?: ShortCourseProposalStatus;
  to: ShortCourseProposalStatus;
  at: string;
  actor: ProposalActor;
  note?: string;
}

export interface ShortCourseProposal {
  id: string;
  status: ShortCourseProposalStatus;
  /** หน่วยงานผู้ยื่นคำขอ (สถาบัน หรือราชวิทยาลัย) */
  ownerOrganisationId: string;
  details: ShortCourseProposalDetails;
  /** เจ้าหน้าที่ราชวิทยาลัยกำหนดเมื่ออนุมัติ: หลักสูตรนี้สะสมหน่วยกิต Credit Bank ได้หรือไม่ */
  creditBankEligible?: boolean;
  reviewNote?: string;
  createdAt: string;
  updatedAt: string;
  history: ProposalHistoryEntry[];
}

// ─── ข้อความคงที่ตามแม่แบบ ────────────────────────────────────────────────────

export const FIXED_QUALIFICATIONS = [
  "เป็นผู้ประกอบวิชาชีพเภสัชกรรม",
  "เป็นผู้ได้รับใบประกอบวิชาชีพเภสัชกรรมและไม่เคยถูกลงโทษในคดีทางจรรยาบรรณในระยะเวลา 2 ปีก่อนจะสมัครเข้ารับการอบรม",
  "เป็นผู้ที่กำลังปฏิบัติงานในสาขาที่เกี่ยวข้องกับหลักสูตร",
] as const;

export const SELECTION_METHOD = "ผู้ที่มีคุณสมบัติครบถ้วนสามารถเข้ารับการอบรมได้โดยไม่มีการสอบคัดเลือก";

export const REQUIRED_ACTIVITIES = [
  "นำเสนอการวิพากษ์วรรณกรรมปฐมภูมิ จำนวน 1 ครั้ง",
  "นำเสนอหัวข้อวิชาการที่น่าสนใจ จำนวน 1 ครั้ง",
  "เขียนบทความวิชาการ หรือกรณีศึกษา (case study) จำนวน 1 ฉบับ",
] as const;

/** 8.4–8.5 และใบรายงานผลการฝึกอบรม — เกณฑ์ผ่านแต่ละองค์ประกอบ (ร้อยละ) */
export const ASSESSMENT_COMPONENTS = [
  { id: "practice_evaluation", label: "การประเมินผลการฝึกปฏิบัติโดยอาจารย์แหล่งฝึก", passPercent: 80 },
  { id: "portfolio", label: "แฟ้มปฏิบัติงานส่วนตัว (portfolio)", passPercent: 80 },
  { id: "written_exam", label: "การสอบข้อเขียน", passPercent: 70 },
  { id: "practical_exam", label: "การสอบปฏิบัติ", passPercent: 70 },
] as const;

export const CERTIFICATE_FEE_BAHT = 500;

/** เกณฑ์ขั้นต่ำในแม่แบบข้อ 8 และ 9.4 */
export const PROPOSAL_MINIMUMS = {
  durationWeeks: 16,
  totalCredits: 16,
  theoryCredits: 2,
  practiceCredits: 14,
  theoryHoursPerCredit: 15,
  practiceHoursPerCredit: 30,
  books: 5,
  journals: 1,
  traineesPerComputer: 3,
} as const;

export function emptyProposalDetails(collegeCode: CollegeCode): ShortCourseProposalDetails {
  return {
    titleTh: "", titleEn: "", certificateNameTh: "ประกาศนียบัตรวิชาชีพเภสัชกรรม ()", certificateNameEn: "Certificate in Pharmacy ()",
    collegeCode, mainAndAffiliateInstitutions: "", otherResponsibleUnits: "", objectives: "",
    capacityPerRound: 0, rounds: [], extraQualifications: "",
    durationWeeks: PROPOSAL_MINIMUMS.durationWeeks, theoryCredits: PROPOSAL_MINIMUMS.theoryCredits, practiceCredits: PROPOSAL_MINIMUMS.practiceCredits,
    theoryLocation: "", topics: [], practiceDetails: "",
    organiser: "", practiceSite: "", coordinators: [], trainers: [], books: [], journals: [], computers: 0,
    budget: "", applicationDetails: "",
  };
}

// ─── การตรวจความครบถ้วน (แยกตามขั้นของฟอร์ม) ───────────────────────────────────

export const PROPOSAL_FORM_STEPS = [
  { id: 1, title: "ข้อมูลหลักสูตร" },
  { id: 2, title: "รอบอบรมและผู้สมัคร" },
  { id: 3, title: "โครงสร้างและรายวิชา" },
  { id: 4, title: "การวัดผล" },
  { id: 5, title: "ผู้สอนและทรัพยากร" },
  { id: 6, title: "ตรวจทานและส่ง" },
] as const;

function blank(value: string) {
  return value.trim().length === 0;
}

export function totalCredits(details: Pick<ShortCourseProposalDetails, "theoryCredits" | "practiceCredits">) {
  return details.theoryCredits + details.practiceCredits;
}

export function theoryHours(details: Pick<ShortCourseProposalDetails, "topics">) {
  return details.topics.reduce((sum, topic) => sum + (Number.isFinite(topic.hours) ? topic.hours : 0), 0);
}

export function proposalStepErrors(step: number, details: ShortCourseProposalDetails): string[] {
  const min = PROPOSAL_MINIMUMS;
  const errors: string[] = [];
  if (step === 1) {
    if (blank(details.titleTh) || blank(details.titleEn)) errors.push("กรุณากรอกชื่อหลักสูตรภาษาไทยและภาษาอังกฤษ");
    if (blank(details.certificateNameTh) || blank(details.certificateNameEn) || /\(\s*\)/.test(details.certificateNameTh + details.certificateNameEn)) {
      errors.push("กรุณากรอกชื่อประกาศนียบัตรภาษาไทยและภาษาอังกฤษ พร้อมระบุสาขาในวงเล็บ");
    }
    if (blank(details.mainAndAffiliateInstitutions)) errors.push("กรุณาระบุสถาบันหลักและสถาบันสมทบ");
    if (blank(details.objectives)) errors.push("กรุณากรอกปรัชญาและวัตถุประสงค์ของหลักสูตร");
  }
  if (step === 2) {
    if (!Number.isInteger(details.capacityPerRound) || details.capacityPerRound <= 0) errors.push("กรุณาระบุจำนวนผู้รับต่อรอบเป็นจำนวนเต็มมากกว่า 0");
    if (details.rounds.length === 0) errors.push("กรุณาเพิ่มรอบการอบรมอย่างน้อย 1 รอบ");
    details.rounds.forEach((round) => {
      if (!round.startDate || !round.endDate) errors.push(`รอบที่ ${round.no}: กรุณาระบุวันเริ่มและวันสิ้นสุด`);
      else if (round.startDate > round.endDate) errors.push(`รอบที่ ${round.no}: วันเริ่มต้องไม่หลังวันสิ้นสุด`);
    });
    if (blank(details.applicationDetails)) errors.push("กรุณาระบุรายละเอียดการสมัครเข้ารับการอบรม");
  }
  if (step === 3) {
    if (details.durationWeeks < min.durationWeeks) errors.push(`ระยะเวลาการฝึกอบรมต้องไม่น้อยกว่า ${min.durationWeeks} สัปดาห์`);
    if (details.theoryCredits < min.theoryCredits) errors.push(`ภาคทฤษฎีต้องไม่น้อยกว่า ${min.theoryCredits} หน่วยกิต`);
    if (details.practiceCredits < min.practiceCredits) errors.push(`ภาคปฏิบัติต้องไม่น้อยกว่า ${min.practiceCredits} หน่วยกิต`);
    if (totalCredits(details) < min.totalCredits) errors.push(`หน่วยกิตรวมต้องไม่น้อยกว่า ${min.totalCredits} หน่วยกิต`);
    if (blank(details.theoryLocation)) errors.push("กรุณาระบุสถานที่บรรยายภาคทฤษฎี");
    if (details.topics.length === 0) errors.push("กรุณาเพิ่มหัวข้อภาคทฤษฎีอย่างน้อย 1 หัวข้อ");
    if (details.topics.some((topic) => blank(topic.topic) || blank(topic.instructor) || !(topic.hours > 0))) {
      errors.push("ทุกหัวข้อต้องมีชื่อหัวข้อ จำนวนชั่วโมง และผู้สอน");
    }
    const requiredTheoryHours = details.theoryCredits * min.theoryHoursPerCredit;
    if (theoryHours(details) < requiredTheoryHours) {
      errors.push(`ชั่วโมงบรรยายรวม ${theoryHours(details)} ชั่วโมง น้อยกว่า ${requiredTheoryHours} ชั่วโมง (${min.theoryHoursPerCredit} ชั่วโมง/หน่วยกิต)`);
    }
    if (blank(details.practiceDetails)) errors.push("กรุณาระบุรายละเอียดภาคปฏิบัติ");
  }
  if (step === 5) {
    if (blank(details.organiser)) errors.push("กรุณาระบุหน่วยงานที่จัดอบรม");
    if (blank(details.practiceSite)) errors.push("กรุณาระบุหน่วยงานที่เป็นแหล่งฝึกปฏิบัติงาน");
    if (!details.coordinators.some((person) => !blank(person.name))) errors.push("กรุณาระบุผู้ประสานงานการฝึกอบรมอย่างน้อย 1 คน");
    if (!details.trainers.some((person) => !blank(person.name))) errors.push("กรุณาระบุผู้ฝึกอบรมอย่างน้อย 1 คน");
    if (details.books.filter((item) => !blank(item)).length < min.books) errors.push(`หนังสือในสาขาเฉพาะทางโรคต้องมีอย่างน้อย ${min.books} เล่ม`);
    if (details.journals.filter((item) => !blank(item)).length < min.journals) errors.push(`วารสารต่างประเทศต้องมีอย่างน้อย ${min.journals} รายการ`);
    const requiredComputers = Math.ceil(details.capacityPerRound / min.traineesPerComputer);
    if (details.computers < requiredComputers) errors.push(`คอมพิวเตอร์ต้องมีอย่างน้อย ${requiredComputers} เครื่อง (1 เครื่อง/ผู้ฝึกอบรม ${min.traineesPerComputer} ราย)`);
    if (blank(details.budget)) errors.push("กรุณาระบุงบประมาณในการฝึกอบรม");
  }
  return errors;
}

export function proposalErrors(details: ShortCourseProposalDetails) {
  return PROPOSAL_FORM_STEPS.flatMap((step) => proposalStepErrors(step.id, details));
}

// ─── สิทธิ์และ state machine ──────────────────────────────────────────────────

export type ProposalAction =
  | "edit"
  | "submit"
  | "start_review"
  | "request_revision"
  | "approve"
  | "reject"
  | "publish"
  | "open_round"
  | "close_round"
  | "close";

const transitions: Readonly<Record<Exclude<ProposalAction, "edit" | "open_round" | "close_round">, { from: readonly ShortCourseProposalStatus[]; to: ShortCourseProposalStatus }>> = {
  submit: { from: ["draft", "revision_requested"], to: "submitted" },
  start_review: { from: ["submitted"], to: "under_review" },
  request_revision: { from: ["under_review"], to: "revision_requested" },
  approve: { from: ["under_review"], to: "approved" },
  reject: { from: ["under_review"], to: "rejected" },
  publish: { from: ["approved"], to: "published" },
  close: { from: ["published"], to: "closed" },
};

const PROPOSER_ACTIONS: readonly ProposalAction[] = ["edit", "submit"];

/**
 * ผู้เสนอ: Institution Admin (เฉพาะคำขอของสถาบันตน) หรือเจ้าหน้าที่ราชวิทยาลัย
 * ผู้พิจารณา/เผยแพร่/เปิดรอบ: เจ้าหน้าที่ราชวิทยาลัยเท่านั้น
 */
// TODO(business): เจ้าหน้าที่วิทยาลัยต้องกลั่นกรองคำขอก่อนส่งราชวิทยาลัยหรือไม่ (สรุปประชุม: "วิทยาลัย (หรือส่งตรง) → ราชวิทยาลัย") — ยังไม่เปิดสิทธิ์ให้ college_staff
export function canPerformProposalAction(actor: ProposalActor, proposal: Pick<ShortCourseProposal, "status" | "ownerOrganisationId">, action: ProposalAction) {
  const isOwner = actor.organisationId === proposal.ownerOrganisationId &&
    (actor.role === "institution_admin" || actor.role === "royal_college_staff");
  if (PROPOSER_ACTIONS.includes(action)) {
    if (!isOwner) return false;
    if (action === "edit") return proposal.status === "draft" || proposal.status === "revision_requested";
  } else if (actor.role !== "royal_college_staff") {
    return false;
  }
  if (action === "open_round" || action === "close_round") return proposal.status === "approved" || proposal.status === "published";
  if (action === "edit") return false;
  return transitions[action].from.includes(proposal.status);
}

export function canCreateProposal(actor: Pick<ProposalActor, "role">) {
  return actor.role === "institution_admin" || actor.role === "royal_college_staff";
}

export function createProposal(input: { id: string; actor: ProposalActor; collegeCode: CollegeCode; at: string }): ShortCourseProposal {
  if (!canCreateProposal(input.actor)) throw new Error("เฉพาะ Institution Admin หรือเจ้าหน้าที่ราชวิทยาลัยที่สร้างคำขอเปิดหลักสูตรได้");
  return {
    id: input.id,
    status: "draft",
    ownerOrganisationId: input.actor.organisationId,
    details: emptyProposalDetails(input.collegeCode),
    createdAt: input.at,
    updatedAt: input.at,
    history: [{ to: "draft", at: input.at, actor: input.actor }],
  };
}

export function updateProposalDetails(proposal: ShortCourseProposal, details: ShortCourseProposalDetails, actor: ProposalActor, at: string) {
  if (!canPerformProposalAction(actor, proposal, "edit")) throw new Error("แก้ไขคำขอนี้ไม่ได้ในสถานะปัจจุบัน");
  return { ...proposal, details, updatedAt: at };
}

export function transitionProposal(
  proposal: ShortCourseProposal,
  action: Exclude<ProposalAction, "edit" | "open_round" | "close_round">,
  input: { actor: ProposalActor; at: string; note?: string; creditBankEligible?: boolean },
): ShortCourseProposal {
  if (!canPerformProposalAction(input.actor, proposal, action)) throw new Error("ไม่มีสิทธิ์ หรือสถานะปัจจุบันไม่อนุญาตให้ดำเนินการนี้");
  if (action === "submit") {
    const errors = proposalErrors(proposal.details);
    if (errors.length > 0) throw new Error(`ข้อมูลยังไม่ครบ: ${errors[0]}`);
  }
  if ((action === "request_revision" || action === "reject") && blank(input.note ?? "")) {
    throw new Error("กรุณาระบุเหตุผล");
  }
  if (action === "approve" && input.creditBankEligible === undefined) {
    throw new Error("กรุณากำหนดว่าหลักสูตรนี้สะสมหน่วยกิต Credit Bank ได้หรือไม่");
  }
  if (action === "publish" && !proposal.details.rounds.some((round) => round.status === "open")) {
    throw new Error("ต้องเปิดรับสมัครอย่างน้อย 1 รอบก่อนเผยแพร่");
  }
  const to = transitions[action].to;
  return {
    ...proposal,
    status: to,
    ...(action === "approve" ? { creditBankEligible: input.creditBankEligible } : {}),
    ...(input.note ? { reviewNote: input.note } : {}),
    details: action === "close"
      ? { ...proposal.details, rounds: proposal.details.rounds.map((round) => ({ ...round, status: "closed" as const })) }
      : proposal.details,
    updatedAt: input.at,
    history: [...proposal.history, { from: proposal.status, to, at: input.at, actor: input.actor, ...(input.note ? { note: input.note } : {}) }],
  };
}

/** เปิดรอบรับสมัครได้หลังหลักสูตรได้รับอนุมัติเท่านั้น */
export function setProposalRoundStatus(
  proposal: ShortCourseProposal,
  roundId: string,
  status: "open" | "closed",
  input: { actor: ProposalActor; at: string },
): ShortCourseProposal {
  if (!canPerformProposalAction(input.actor, proposal, status === "open" ? "open_round" : "close_round")) {
    throw new Error("เปิดหรือปิดรอบได้เฉพาะหลักสูตรที่อนุมัติแล้ว โดยเจ้าหน้าที่ราชวิทยาลัย");
  }
  if (!proposal.details.rounds.some((round) => round.id === roundId)) throw new Error("ไม่พบรอบอบรมนี้");
  return {
    ...proposal,
    details: { ...proposal.details, rounds: proposal.details.rounds.map((round) => (round.id === roundId ? { ...round, status } : round)) },
    updatedAt: input.at,
  };
}

// ─── ตรวจข้อมูลที่อ่านกลับจาก localStorage ─────────────────────────────────────

export function isShortCourseProposal(value: unknown): value is ShortCourseProposal {
  if (!value || typeof value !== "object") return false;
  const proposal = value as Record<string, unknown>;
  const details = proposal.details as Record<string, unknown> | undefined;
  return typeof proposal.id === "string" &&
    shortCourseProposalStatuses.includes(proposal.status as ShortCourseProposalStatus) &&
    typeof proposal.ownerOrganisationId === "string" &&
    Boolean(details) && typeof details === "object" &&
    typeof details?.titleTh === "string" &&
    typeof details?.collegeCode === "string" &&
    Array.isArray(details?.rounds) && Array.isArray(details?.topics) &&
    Array.isArray(proposal.history);
}
