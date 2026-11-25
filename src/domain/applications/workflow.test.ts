import { describe, expect, it } from "vitest";

import { LocalApplicationRepository, LocalMembershipRepository, type KeyValueStore } from "@/data/applications/repository";
import { MockPaymentAdapter } from "@/data/payments/adapter";
import type { FormAnswers } from "@/domain/forms/schema";
import { programOfferings, type ProgramOffering } from "@/roles/shared/features/admissions/program-offerings";
import { currentApplicantProfile } from "@/roles/shared/features/applicant/profile";
import { ORGANISATIONS } from "@/roles/shared/features/roles/access-model";
import { createDraftApplication, templateForApplication } from "./catalog";
import type { Application, ApplicationActor, ApplicationKind } from "./model";
import {
  amountDue,
  approveEligibility,
  availableActions,
  canActOn,
  enroll,
  issueApproval,
  recordPayment,
  recordResult,
  reject,
  requestRevision,
  resubmit,
  reviewDocument,
  saveDraft,
  seatsLeft,
  setFee,
  submitApplication,
} from "./workflow";

const at = "2026-11-25T03:00:00.000Z";
const applicant: ApplicationActor = { userId: "member-1", userName: "ภก.สมชาย ใจดี", role: "student", organisationId: ORGANISATIONS.siriraj.id };
const staff: ApplicationActor = { userId: "staff-001", userName: "เจ้าหน้าที่", role: "royal_college_staff", organisationId: ORGANISATIONS.royalCollege.id };
const chulaAdmin: ApplicationActor = { userId: "inst-chula", userName: "แอดมินจุฬาฯ", role: "institution_admin", organisationId: ORGANISATIONS.chula.id };
const sirirajAdmin: ApplicationActor = { userId: "inst-siriraj", userName: "แอดมินศิริราช", role: "institution_admin", organisationId: ORGANISATIONS.siriraj.id };
const file = { name: "doc.pdf", size: 100, type: "application/pdf", uploadedAt: at };
const adapter = new MockPaymentAdapter(() => at);
const byId = (id: string) => programOfferings.find((item) => item.id === id)!;

function draft(kind: ApplicationKind, offering: ProgramOffering, institution?: { id: string; name: string }) {
  return createDraftApplication({ id: `T-${kind}`, kind, offering, profile: currentApplicantProfile(), actor: applicant, at, institution });
}

/** กรอกส่วนที่ผู้สมัครต้องกรอกเองให้ครบ (ข้อมูลทดสอบ) */
function complete(application: Application): Application {
  const template = templateForApplication(application);
  const address = { HouseNo: "1", Subdistrict: "แขวง", District: "เขต", Province: "กรุงเทพมหานคร", PostalCode: "10100" };
  const answers: FormAnswers = { ...application.answers };
  for (const step of template.steps) {
    for (const field of step.fields) {
      if (field.type === "file") answers[field.id] = file;
      if (field.type === "signature") answers[field.id] = { accepted: true, signedName: String(answers.fullName), signedAt: at };
      if (field.id === "generalQualifications" && field.type === "checkbox") answers[field.id] = field.options!.map((option) => option.value);
      if (field.id === "subjects" && field.type === "checkbox") answers[field.id] = [field.options![0].value];
    }
  }
  for (const prefix of ["workplace", "contact"]) for (const [key, value] of Object.entries(address)) answers[`${prefix}${key}`] = value;
  return saveDraft(application, template, answers, applicant, at);
}

async function pay(application: Application, hasActiveMembership = false) {
  const due = amountDue(application)!;
  const reference = `${application.id}-${due.purpose}`;
  const result = await adapter.charge({ reference, amount: due.amount!, description: due.purpose, method: "promptpay" });
  return recordPayment(application, { ...result, reference, amount: due.amount! }, applicant, { hasActiveMembership });
}

function approveAllDocuments(application: Application) {
  return application.documents.reduce((current, document) => reviewDocument(current, document.documentId, "approved", staff, at), application);
}

describe("study: Short Course / Credit Bank", () => {
  const standard = programOfferings.find((item) => item.type === "short_course" && !item.creditBankEligible)!;
  const creditBank = programOfferings.find((item) => item.type === "short_course" && item.creditBankEligible)!;

  it("standard course: submit → pay → enrolled (no membership step)", async () => {
    const submitted = submitApplication(complete(draft("study", standard)), templateForApplication(draft("study", standard)), applicant, at);
    expect(submitted.status).toBe("awaiting_payment");
    expect((await pay(submitted)).status).toBe("enrolled");
  });

  it("credit bank: pay → extraordinary membership → enrolled, unless already a member", async () => {
    const submitted = submitApplication(complete(draft("study", creditBank)), templateForApplication(draft("study", creditBank)), applicant, at);
    const paid = await pay(submitted);
    expect(paid.status).toBe("membership_pending");
    expect(amountDue(paid)).toEqual({ purpose: "membership", amount: 1000 });
    expect((await pay(paid)).status).toBe("enrolled");
    expect((await pay(submitted, true)).status).toBe("enrolled");
  });

  it("refuses to submit an incomplete form", () => {
    expect(() => submitApplication(draft("study", standard), templateForApplication(draft("study", standard)), applicant, at)).toThrow(/ข้อมูลยังไม่ครบ/);
  });
});

describe("entrance exam: ป.ชั้นสูง / วุฒิบัตร", () => {
  const residency = byId("board:วภท.");
  const start = () => {
    const application = complete(draft("entrance_exam", residency, { id: ORGANISATIONS.chula.id, name: ORGANISATIONS.chula.name }));
    return submitApplication(application, templateForApplication(application), applicant, at);
  };

  it("uses the form's 1,000 THB fee and goes to review after payment", async () => {
    const submitted = start();
    expect(submitted.fees.application).toBe(1000);
    expect((await pay(submitted)).status).toBe("under_review");
  });

  it("needs every required document approved before announcing eligibility", async () => {
    const reviewing = await pay(start());
    expect(() => approveEligibility(reviewing, staff, at)).toThrow(/เอกสาร/);
    expect(approveEligibility(approveAllDocuments(reviewing), staff, at).status).toBe("eligible");
  });

  it("revision loop: staff flags a document, applicant re-uploads and resubmits", async () => {
    const reviewing = await pay(start());
    const flagged = reviewDocument(reviewing, "license", "needs_revision", staff, at, "สำเนาไม่ชัด");
    const revision = requestRevision(flagged, staff, at, "แก้ไขสำเนาใบอนุญาต");
    expect(revision.status).toBe("needs_revision");
    const template = templateForApplication(revision);
    expect(() => resubmit(revision, template, revision.answers, applicant, at)).toThrow(/แนบไฟล์ใหม่/);
    const back = resubmit(revision, template, { ...revision.answers, doc_license: { ...file, uploadedAt: "2026-11-26T00:00:00.000Z" } }, applicant, at);
    expect(back.status).toBe("under_review");
    expect(back.documents.find((document) => document.documentId === "license")?.status).toBe("pending");
  });

  it("failed result closes the application and keeps the result in history", async () => {
    const eligible = approveEligibility(approveAllDocuments(await pay(start())), staff, at);
    const failed = recordResult(eligible, "failed", staff, at, "คะแนนไม่ถึงเกณฑ์");
    expect(failed.status).toBe("failed");
    expect(failed.examResult?.decision).toBe("failed");
    expect(failed.history.at(-1)).toMatchObject({ action: "record_result", to: "failed" });
    expect(availableActions(applicant, failed)).toEqual([]);
  });

  it("pass → enroll → tuition (fee set by staff) → membership → enrolled", async () => {
    const passed = recordResult(approveEligibility(approveAllDocuments(await pay(start())), staff, at), "passed", staff, at);
    const waiting = enroll(passed, applicant, at);
    expect(waiting.status).toBe("awaiting_tuition");
    expect(amountDue(waiting)?.amount).toBeUndefined();
    const priced = setFee(passed, "tuition", 30000, staff, at);
    const tuitionDue = enroll(priced, applicant, at);
    const member = await pay(tuitionDue);
    expect(member.status).toBe("membership_pending");
    expect((await pay(member)).status).toBe("enrolled");
  });

  it("limits staff actions to the right people", async () => {
    const reviewing = await pay(start());
    expect(canActOn(chulaAdmin, reviewing, "review_document")).toBe(true);
    expect(canActOn(sirirajAdmin, reviewing, "review_document")).toBe(false);
    expect(canActOn({ ...applicant, userId: "someone-else" }, start(), "pay")).toBe(false);
    expect(canActOn(applicant, reviewing, "approve_eligibility")).toBe(false);
    expect(() => reject(reviewing, staff, at, " ")).toThrow(/เหตุผล/);
  });
});

describe("approval exam", () => {
  const offering = byId("approval:CIPT");
  const start = () => {
    const application = complete(draft("approval_exam", offering));
    return submitApplication(application, templateForApplication(application), applicant, at);
  };

  it("pass → approval letter → ordinary-membership request awaiting payment", async () => {
    const eligible = approveEligibility(approveAllDocuments(await pay(start())), staff, at);
    const passed = recordResult(eligible, "passed", staff, at);
    expect(() => issueApproval(passed, " ", staff, at)).toThrow(/เลขที่/);
    const issued = issueApproval(passed, "AP-0001", staff, at);
    expect(issued.status).toBe("approval_issued");
    expect(issued.membershipUpgradeRequest?.status).toBe("awaiting_payment");
    expect(amountDue(issued)).toEqual({ purpose: "membership_upgrade", amount: 1500 });
    expect((await pay(issued)).membershipUpgradeRequest?.status).toBe("paid");
  });

  it("institution admins cannot issue approval letters", async () => {
    const passed = recordResult(approveEligibility(approveAllDocuments(await pay(start())), staff, at), "passed", staff, at);
    expect(canActOn({ ...chulaAdmin }, passed, "issue_approval")).toBe(false);
  });
});

describe("seats, fees and data layer", () => {
  it("counts active applications against the announced capacity only", () => {
    const base = draft("entrance_exam", byId("board:วภท."), { id: ORGANISATIONS.chula.id, name: "จุฬาฯ" });
    const active = { ...base, id: "A", status: "under_review" as const };
    const closed = { ...base, id: "B", status: "failed" as const };
    expect(seatsLeft(2, [active, closed], { offeringId: base.offeringId, institutionId: ORGANISATIONS.chula.id })).toBe(1);
    expect(seatsLeft(undefined, [active], { offeringId: base.offeringId })).toBeUndefined();
  });

  it("blocks payment until a fee exists for the program", async () => {
    const pgx = complete(draft("entrance_exam", byId("board:CPPM"), { id: ORGANISATIONS.ramathibodi.id, name: "รามาธิบดี" }));
    const submitted = submitApplication(pgx, templateForApplication(pgx), applicant, at);
    expect(amountDue(submitted)).toEqual({ purpose: "application_fee", amount: undefined });
    await expect(pay(submitted)).rejects.toThrow();
  });

  it("stores applications and membership through the repository interface", async () => {
    const memory = new Map<string, string>();
    const store: KeyValueStore = { getItem: (key) => memory.get(key) ?? null, setItem: (key, value) => { memory.set(key, value); } };
    const repository = new LocalApplicationRepository(store);
    const application = draft("study", programOfferings.find((item) => item.type === "short_course")!);
    await repository.save(application);
    expect((await repository.get(application.id))?.status).toBe("draft");
    memory.set("pcor_applications_v1", "not json");
    expect(await repository.list()).toEqual([]);
    const membership = new LocalMembershipRepository(store);
    expect((await membership.get("member-1")).status).toBe("none");
  });

  it("mock payment adapter never charges a zero amount", async () => {
    expect((await adapter.charge({ reference: "R", amount: 0, description: "x", method: "promptpay" })).status).toBe("failed");
  });
});
