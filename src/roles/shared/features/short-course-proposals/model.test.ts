import { describe, expect, it } from "vitest";

import { ORGANISATIONS } from "@/roles/shared/features/roles/access-model";
import {
  canPerformProposalAction,
  createProposal,
  proposalErrors,
  setProposalRoundStatus,
  transitionProposal,
  updateProposalDetails,
  type ProposalActor,
  type ShortCourseProposalDetails,
} from "./model";
import { publishedProposalCatalog } from "./store";

const at = "2026-11-25T00:00:00.000Z";
const institution: ProposalActor = { userId: "inst-1", userName: "สถาบัน", role: "institution_admin", organisationId: ORGANISATIONS.siriraj.id };
const otherInstitution: ProposalActor = { ...institution, userId: "inst-2", organisationId: ORGANISATIONS.chula.id };
const staff: ProposalActor = { userId: "staff-1", userName: "เจ้าหน้าที่", role: "royal_college_staff", organisationId: ORGANISATIONS.royalCollege.id };
const teacher: ProposalActor = { userId: "t-1", userName: "อาจารย์", role: "teacher", organisationId: ORGANISATIONS.siriraj.id };

function validDetails(base: ShortCourseProposalDetails): ShortCourseProposalDetails {
  return {
    ...base,
    titleTh: "หลักสูตรทดสอบ", titleEn: "Test Course",
    certificateNameTh: "ประกาศนียบัตรวิชาชีพเภสัชกรรม (ทดสอบ)", certificateNameEn: "Certificate in Pharmacy (Test)",
    mainAndAffiliateInstitutions: "สถาบันหลักทดสอบ", objectives: "วัตถุประสงค์",
    capacityPerRound: 6, rounds: [{ id: "r1", no: 1, startDate: "2027-01-01", endDate: "2027-05-01", status: "planned" }],
    applicationDetails: "สมัครออนไลน์",
    durationWeeks: 16, theoryCredits: 2, practiceCredits: 14, theoryLocation: "ห้องเรียน",
    topics: [{ topic: "หัวข้อ", hours: 30, instructor: "อาจารย์" }], practiceDetails: "ฝึกปฏิบัติ",
    organiser: "หน่วยงาน", practiceSite: "แหล่งฝึก",
    coordinators: [{ name: "ผู้ประสาน", affiliation: "", background: "" }], trainers: [{ name: "ผู้ฝึก", affiliation: "", background: "" }],
    books: ["1", "2", "3", "4", "5"], journals: ["J"], computers: 2, budget: "งบ",
  };
}

function submitted() {
  const draft = createProposal({ id: "P1", actor: institution, collegeCode: "วภท.", at });
  return transitionProposal(updateProposalDetails(draft, validDetails(draft.details), institution, at), "submit", { actor: institution, at });
}

describe("short-course proposal workflow", () => {
  it("only institution admins and royal staff can propose", () => {
    expect(() => createProposal({ id: "X", actor: teacher, collegeCode: "วภท.", at })).toThrow();
    expect(createProposal({ id: "X", actor: staff, collegeCode: "วภท.", at }).status).toBe("draft");
  });

  it("refuses to submit until the template minimums are met", () => {
    const draft = createProposal({ id: "P1", actor: institution, collegeCode: "วภท.", at });
    expect(proposalErrors(draft.details).length).toBeGreaterThan(0);
    expect(() => transitionProposal(draft, "submit", { actor: institution, at })).toThrow(/ข้อมูลยังไม่ครบ/);
    expect(submitted().status).toBe("submitted");
  });

  it("goes draft → submitted → under_review → revision_requested → submitted → approved → published → closed", () => {
    const review = transitionProposal(submitted(), "start_review", { actor: staff, at });
    expect(() => transitionProposal(review, "request_revision", { actor: staff, at })).toThrow(/เหตุผล/);
    const revision = transitionProposal(review, "request_revision", { actor: staff, at, note: "แก้ชั่วโมง" });
    expect(canPerformProposalAction(institution, revision, "edit")).toBe(true);
    const again = transitionProposal(transitionProposal(revision, "submit", { actor: institution, at }), "start_review", { actor: staff, at });
    expect(() => transitionProposal(again, "approve", { actor: staff, at })).toThrow(/Credit Bank/);
    const approved = transitionProposal(again, "approve", { actor: staff, at, creditBankEligible: true });
    expect(() => transitionProposal(approved, "publish", { actor: staff, at })).toThrow(/เปิดรับสมัคร/);
    const opened = setProposalRoundStatus(approved, "r1", "open", { actor: staff, at });
    const published = transitionProposal(opened, "publish", { actor: staff, at });
    expect(published.status).toBe("published");
    const closed = transitionProposal(published, "close", { actor: staff, at });
    expect(closed.details.rounds.every((round) => round.status === "closed")).toBe(true);
    expect(closed.history.map((entry) => entry.to)).toEqual(["draft", "submitted", "under_review", "revision_requested", "submitted", "under_review", "approved", "published", "closed"]);
  });

  it("keeps review, round opening and editing in the right hands", () => {
    const proposal = submitted();
    expect(canPerformProposalAction(institution, proposal, "start_review")).toBe(false);
    expect(canPerformProposalAction(otherInstitution, { ...proposal, status: "draft" }, "edit")).toBe(false);
    expect(() => setProposalRoundStatus(proposal, "r1", "open", { actor: staff, at })).toThrow(/อนุมัติแล้ว/);
  });

  it("publishes approved courses into the study catalog with their rounds and capacity", () => {
    const approved = transitionProposal(transitionProposal(submitted(), "start_review", { actor: staff, at }), "approve", { actor: staff, at, creditBankEligible: false });
    const published = transitionProposal(setProposalRoundStatus(approved, "r1", "open", { actor: staff, at }), "publish", { actor: staff, at });
    const catalog = publishedProposalCatalog([published, submitted()]);
    expect(catalog.offerings).toHaveLength(1);
    expect(catalog.offerings[0]).toMatchObject({ group: "short_course", admissionMethod: "direct_enrollment", credits: 16 });
    expect(catalog.rounds[0]).toMatchObject({ status: "open", capacity: 6 });
  });
});
