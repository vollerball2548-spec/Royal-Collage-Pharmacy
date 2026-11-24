import { describe, expect, it } from "vitest";

import type { CourseOffering, SubjectResult } from "@/roles/shared/features/academic/model";
import { courseCatalog } from "@/roles/shared/features/courses/course-catalog";
import type { ShortCourseEnrollment } from "@/roles/shared/features/short-course";
import { summarizeCreditBank } from "./summary";

const offerings: CourseOffering[] = [
  { id: "o-301-a", courseCode: "วภท-301", courseTitle: "องค์ความรู้", credits: 12, term: "1/2568", institutionId: "org-inst-siriraj", collegeCode: "วภท.", status: "closed" },
  { id: "o-301-b", courseCode: "วภท-301", courseTitle: "องค์ความรู้", credits: 12, term: "1/2569", institutionId: "org-inst-siriraj", collegeCode: "วภท.", status: "closed" },
  { id: "offering-vpt-302", courseCode: "วภท-302", courseTitle: "ข้างเตียง", credits: 12, term: "1/2569", institutionId: "org-inst-chula", collegeCode: "วภท.", status: "open" },
];

function result(id: string, studentId: string, offeringId: string, value: "S" | "U", status: SubjectResult["status"] = "published"): SubjectResult {
  return { id, studentId, courseOfferingId: offeringId, teacherId: "t", status, currentValue: value, updatedAt: "2026-01-01T00:00:00.000Z", revisions: [] };
}

function enrollment(patch: Partial<ShortCourseEnrollment>): ShortCourseEnrollment {
  return {
    id: "SC-1", studentId: "S-1", studentName: "ผู้เรียน", courseId: "short-chronic-care", courseTitle: "ดูแลโรคเรื้อรัง",
    creditBank: true, credits: 4, collegeCode: "วภท.", institutionId: "org-inst-siriraj", institutionName: "ศิริราช",
    status: "assessment_recorded", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    creditsAwarded: 0, history: [], ...patch,
  };
}

describe("Credit Bank summary", () => {
  it("counts only published passes, lets a retake pass replace a fail, and excludes other students", () => {
    const summary = summarizeCreditBank({
      studentId: "S-1",
      collegeCode: "วภท.",
      subjectResults: [
        result("r1", "S-1", "o-301-a", "U"),
        result("r2", "S-1", "o-301-b", "S"),
        result("r3", "S-1", "offering-vpt-302", "S", "draft"),
        result("r4", "S-2", "offering-vpt-302", "S"),
      ],
      courseOfferings: offerings,
      catalog: courseCatalog,
      shortCourseEnrollments: [],
    });
    expect(summary.totalCredits).toBe(12);
    expect(summary.passed.map((row) => row.courseCode)).toEqual(["วภท-301"]);
    expect(summary.failed).toHaveLength(0);
    expect(summary.creditsByCategory.required).toBe(12);
    expect(summary.notTaken.map((row) => row.courseCode)).toContain("วภท-302");
    expect(summary.notTaken.map((row) => row.courseCode)).not.toContain("วภท-301");
  });

  it("TC12: never adds Short Course credits before staff approval", () => {
    const pending = summarizeCreditBank({
      studentId: "S-1", subjectResults: [], courseOfferings: [], catalog: courseCatalog,
      shortCourseEnrollments: [enrollment({ status: "assessment_recorded" })],
    });
    expect(pending.totalCredits).toBe(0);
    const approved = summarizeCreditBank({
      studentId: "S-1", subjectResults: [], courseOfferings: [], catalog: courseCatalog,
      shortCourseEnrollments: [enrollment({ status: "completed", creditsAwarded: 4, certificateNo: "SC-1", certificateIssuedAt: "2026-02-01T00:00:00.000Z" })],
    });
    expect(approved.totalCredits).toBe(4);
    expect(approved.certificates).toHaveLength(1);
  });
});
