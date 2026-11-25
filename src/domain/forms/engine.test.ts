import { describe, expect, it } from "vitest";

import { currentApplicantProfile } from "@/roles/shared/features/applicant/profile";
import { evaluateCondition, isRequired, isVisible, validateForm, validateStep, visibleDocumentFields } from "./evaluate";
import { applyAnswerChange, lockedFieldIds, prefillAnswers } from "./prefill";
import type { FieldDef, FormTemplate } from "./schema";
import { approvalExamTemplate, courseProposalTemplate, entranceTemplate, shortCourseTemplate } from "./templates";
import { applicantPrefillSource } from "./templates/applicant-fields";

const source = applicantPrefillSource(currentApplicantProfile());

describe("conditions", () => {
  it("evaluates field, context and composite conditions", () => {
    const answers = { a: "x", list: ["1"] };
    const ctx = { collegeCode: "วภท.", creditBank: true };
    expect(evaluateCondition({ field: "a", equals: "x" }, answers, ctx)).toBe(true);
    expect(evaluateCondition({ ctx: "collegeCode", in: ["วภท.", "CPPM"] }, answers, ctx)).toBe(true);
    expect(evaluateCondition({ all: [{ field: "list", truthy: true }, { not: { ctx: "creditBank", equals: false } }] }, answers, ctx)).toBe(true);
    expect(evaluateCondition({ any: [{ field: "a", equals: "y" }, { ctx: "collegeCode", equals: "CPAT" }] }, answers, ctx)).toBe(false);
  });

  it("only requires a field while it is visible", () => {
    const field: FieldDef = { id: "x", type: "text", label: "X", required: true, visibleWhen: { ctx: "show", equals: true } };
    expect(isVisible(field, {}, { show: false })).toBe(false);
    expect(isRequired(field, {}, { show: false })).toBe(false);
    expect(isRequired(field, {}, { show: true })).toBe(true);
  });
});

describe("validation by field type", () => {
  const template: FormTemplate = {
    id: "t", version: 1, title: "T", paperTitle: [],
    steps: [{ id: "s", title: "S", fields: [
      { id: "name", type: "text", label: "ชื่อ", required: true },
      { id: "count", type: "number", label: "จำนวน", min: 2, integer: true },
      { id: "choice", type: "radio", label: "ตัวเลือก", options: [{ value: "a", label: "A" }], required: true },
      { id: "multi", type: "checkbox", label: "หลายข้อ", options: [{ value: "1", label: "1" }, { value: "2", label: "2" }], minSelected: 2 },
      { id: "rows", type: "repeater", label: "รายการ", itemLabel: "แถว", minItems: 1, fields: [{ id: "title", type: "text", label: "ชื่อแถว", required: true }] },
      { id: "doc", type: "file", label: "ไฟล์", documentId: "license", required: true },
      { id: "sign", type: "signature", label: "รับรอง", statement: "...", nameField: "name", required: true },
    ] }],
  };
  const file = { name: "a.pdf", size: 10, type: "application/pdf", uploadedAt: "2026-11-25T00:00:00.000Z" };

  it("reports each problem and accepts a complete form", () => {
    const errors = validateStep(template, "s", { count: 1.5, choice: "z", multi: ["1"], rows: [{ title: "" }] }, {});
    const ids = errors.map((error) => error.fieldId);
    expect(ids).toEqual(expect.arrayContaining(["name", "count", "choice", "multi", "rows.0.title", "doc", "sign"]));
    expect(validateStep(template, "s", {
      name: "ภก.ทดสอบ", count: 3, choice: "a", multi: ["1", "2"], rows: [{ title: "แถว 1" }], doc: file,
      sign: { accepted: true, signedName: "ภก.ทดสอบ", signedAt: "x" },
    }, {})).toEqual([]);
  });

  it("requires the signature name to match the applicant", () => {
    const errors = validateStep(template, "s", { name: "ก", sign: { accepted: true, signedName: "ข", signedAt: "x" } }, {});
    expect(errors.find((error) => error.fieldId === "sign")?.message).toMatch(/ตรงกับ/);
  });
});

describe("prefill from the Pharmacy Council profile", () => {
  it("fills locked registry fields and refuses edits to them", () => {
    const answers = prefillAnswers(entranceTemplate, source, { fullName: "แก้เอง", mobilePhone: "0899999999" });
    expect(answers.fullName).toBe(source.fullName);
    expect(answers.mobilePhone).toBe("0899999999");
    expect(lockedFieldIds(entranceTemplate).has("citizenId")).toBe(true);
    expect(applyAnswerChange(entranceTemplate, answers, "licenseNumber", "ภ.00000").licenseNumber).toBe(source.licenseNumber);
    expect(applyAnswerChange(entranceTemplate, answers, "workplace", "รพ.ทดสอบ").workplace).toBe("รพ.ทดสอบ");
  });
});

describe("form templates", () => {
  it("asks for 500 patient-care hours only for pharmacotherapy and PGx", () => {
    const ids = (collegeCode: string) => visibleDocumentFields(entranceTemplate, {}, { collegeCode }).map((field) => field.documentId);
    expect(ids("วภท.")).toContain("patient_care_500h");
    expect(ids("CPPM")).toContain("patient_care_500h");
    expect(ids("CPAT")).not.toContain("patient_care_500h");
  });

  it("builds approval-exam qualifications from the chosen college", () => {
    const stepFields = (code: Parameters<typeof approvalExamTemplate>[0]) => approvalExamTemplate(code).steps.find((step) => step.id === "qualifications")!.fields.map((field) => field.id);
    expect(stepFields("CIPT")).toContain("collegeQualifications");
    expect(stepFields("CPPM")).not.toContain("collegeQualifications");
  });

  it("validates a prefilled approval form except what the applicant must add", () => {
    const template = approvalExamTemplate("วภท.");
    const answers = prefillAnswers(template, source);
    const ids = validateForm(template, answers, { collegeCode: "วภท." }).map((error) => error.fieldId);
    expect(ids).toEqual(expect.arrayContaining(["workplaceHouseNo", "generalQualifications", "doc_photo", "declaration"]));
    expect(ids).not.toContain("fullName");
  });

  it("groups the approval form like the paper form and keeps error messages specific", () => {
    const step = approvalExamTemplate("วภท.").steps[0];
    const groupIds = new Set(step.groups?.map((group) => group.id));
    expect([...groupIds]).toEqual(["program", "person", "work", "contact"]);
    expect(step.fields.every((field) => field.group && groupIds.has(field.group))).toBe(true);
    expect(step.fields.find((field) => field.id === "contactHouseNo")?.label).toBe("เลขที่");
    const errors = validateStep(approvalExamTemplate("วภท."), "personal", {}, {});
    expect(errors.find((error) => error.fieldId === "contactHouseNo")?.message).toMatch(/ที่อยู่ปัจจุบันที่ติดต่อได้: เลขที่/);
    const copy = step.groups?.find((group) => group.id === "contact")?.copy;
    expect(copy?.from.contactPostalCode).toBe("workplacePostalCode");
  });

  it("offers only the program's own track and subjects on the short-course form", () => {
    const template = shortCourseTemplate({ tracks: ["credit_bank"], subjects: [{ value: "CPAT201", label: "CPAT201" }] });
    const course = template.steps.find((step) => step.id === "course")!;
    expect(course.fields.map((field) => field.id)).toEqual(["courseTrack", "subjects"]);
    expect(validateStep(template, "course", { courseTrack: "standard" }, {}).map((error) => error.fieldId)).toEqual(["courseTrack", "subjects"]);
  });

  it("applies the announcement template's cross-field minimums to course proposals", () => {
    const template = courseProposalTemplate([{ value: "วภท.", label: "วภท." }]);
    const errors = template.rules!({ capacityPerRound: 10, theoryCredits: 2, practiceCredits: 14, topics: [{ topic: "a", hours: 10, instructor: "b" }], computers: 1 }, { collegeCode: "วภท." });
    expect(errors.map((error) => error.message).join(" ")).toMatch(/ชั่วโมงบรรยายรวม 10/);
    expect(errors.map((error) => error.message).join(" ")).toMatch(/คอมพิวเตอร์ต้องมีอย่างน้อย 4/);
  });
});
