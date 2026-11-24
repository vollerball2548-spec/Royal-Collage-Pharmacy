import { describe, expect, it } from "vitest";

import { COLLEGE_OPTIONS } from "@/roles/shared/data/college-directory";

import { curriculumCategoryLabel, curriculumData, curriculumPrograms, findCurriculumProgram } from "./index";

describe("imported curriculum", () => {
  it("has exactly one program for each of the 7 colleges", () => {
    expect(curriculumPrograms.map((program) => program.collegeCode).sort())
      .toEqual(COLLEGE_OPTIONS.map((option) => option.value).sort());
  });

  it("has unique subject codes within each program", () => {
    for (const program of curriculumPrograms) {
      const codes = program.subjects.flatMap((subject) => subject.code ? [subject.code] : []);
      expect(new Set(codes).size, program.collegeCode).toBe(codes.length);
    }
  });

  it("uses only known categories and gives every non-option subject a title and credits", () => {
    for (const subject of curriculumPrograms.flatMap((program) => program.subjects)) {
      expect(Object.keys(curriculumCategoryLabel)).toContain(subject.category);
      expect(subject.titleTh ?? subject.titleEn).toBeTruthy();
      if (!subject.optionOf) expect(subject.credits).toBeGreaterThan(0);
    }
  });

  it("residency subjects add up exactly to the program minimum credits", () => {
    for (const program of curriculumPrograms.filter((item) => item.system === "residency")) {
      const total = program.subjects.filter((subject) => !subject.optionOf).reduce((sum, subject) => sum + (subject.credits ?? 0), 0);
      expect(total, program.collegeCode).toBe(program.minCredits);
    }
  });

  it("credit-bank programs offer at least the minimum credits to choose from", () => {
    for (const program of curriculumPrograms.filter((item) => item.system === "credit_bank")) {
      const offered = program.subjects.reduce((sum, subject) => sum + (subject.credits ?? 0), 0);
      expect(offered, program.collegeCode).toBeGreaterThanOrEqual(program.minCredits ?? 0);
    }
  });

  it("keeps source problems visible instead of silently fixing them", () => {
    expect(curriculumData.source).toMatch(/Pharmacy_Curriculum_Courses\.xlsx$/);
    expect(Array.isArray(curriculumData.warnings)).toBe(true);
    expect(findCurriculumProgram("วภท.")?.system).toBe("residency");
  });
});
