/**
 * Credit Bank: เชื่อม Student · Course · Subject · Assessment · Credit · Certificate
 *
 * หลักการ
 * - หน่วยกิตจากรายวิชาปกติ นับเฉพาะผลที่ประกาศแล้ว (published/revised) และผ่าน (S)
 * - หน่วยกิตจาก Short Course นับเฉพาะหลักสูตร Credit Bank ที่เจ้าหน้าที่ราชวิทยาลัย
 *   อนุมัติผลแล้ว (`creditsAwarded` > 0) — ไม่มีการเพิ่มหน่วยกิตก่อนอนุมัติ
 */
import type { CourseOffering, SubjectResult } from "@/roles/shared/features/academic/model";
import { COURSE_SCHEDULE_DETAILS } from "@/roles/shared/features/academic/course-schedule";
import type { CourseDefinition } from "@/roles/shared/features/courses/course-catalog";
import {
  resolveCourseCategory,
  type CourseCategory,
} from "@/roles/shared/features/registration/student-portal";
import type { ShortCourseEnrollment } from "@/roles/shared/features/short-course/workflow";

export type CreditBankSubjectState = "passed" | "failed" | "not_taken";

export interface CreditBankSubjectRow {
  key: string;
  courseCode: string;
  courseTitle: string;
  credits: number;
  category: CourseCategory;
  state: CreditBankSubjectState;
  term?: string;
  source: "course" | "short_course";
}

export interface CreditBankCertificate {
  id: string;
  title: string;
  issuedAt: string;
  source: "short_course";
  creditBank: boolean;
}

export interface CreditBankSummary {
  totalCredits: number;
  creditsByCategory: Record<CourseCategory, number>;
  passed: CreditBankSubjectRow[];
  failed: CreditBankSubjectRow[];
  notTaken: CreditBankSubjectRow[];
  certificates: CreditBankCertificate[];
}

function categoryForCode(courseCode: string, catalog: readonly CourseDefinition[], offeringId?: string) {
  const definition = catalog.find((item) => item.kind === "course" && item.code === courseCode);
  return resolveCourseCategory({
    classification: definition?.classification,
    scheduleMode: offeringId ? COURSE_SCHEDULE_DETAILS[offeringId]?.mode : undefined,
  });
}

export function summarizeCreditBank(input: {
  studentId: string;
  /** วิทยาลัยของหลักสูตรที่ผู้เรียนกำลังศึกษา ใช้คำนวณ "วิชาที่ยังไม่ได้เรียน" */
  collegeCode?: string;
  subjectResults: readonly SubjectResult[];
  courseOfferings: readonly CourseOffering[];
  catalog: readonly CourseDefinition[];
  shortCourseEnrollments: readonly ShortCourseEnrollment[];
}): CreditBankSummary {
  const offeringById = new Map(input.courseOfferings.map((offering) => [offering.id, offering]));
  // ผลล่าสุดต่อรหัสวิชา: ถ้าเคยผ่านแล้วถือว่าผ่าน (สอบซ่อมผ่านทับผลเดิม)
  const latestByCode = new Map<string, CreditBankSubjectRow>();

  input.subjectResults.forEach((result) => {
    if (result.studentId !== input.studentId) return;
    if (result.status !== "published" && result.status !== "revised") return;
    if (!result.currentValue) return;
    const offering = offeringById.get(result.courseOfferingId);
    if (!offering) return;
    const row: CreditBankSubjectRow = {
      key: `course:${offering.courseCode}`,
      courseCode: offering.courseCode,
      courseTitle: offering.courseTitle,
      credits: offering.credits,
      category: categoryForCode(offering.courseCode, input.catalog, offering.id),
      state: result.currentValue === "S" ? "passed" : "failed",
      term: offering.term,
      source: "course",
    };
    const previous = latestByCode.get(row.key);
    if (!previous || previous.state === "failed") latestByCode.set(row.key, row);
  });

  input.shortCourseEnrollments.forEach((enrollment) => {
    if (enrollment.studentId !== input.studentId || !enrollment.creditBank) return;
    if (enrollment.status !== "completed" && enrollment.status !== "failed") return;
    const key = `short:${enrollment.courseId}`;
    const passed = enrollment.status === "completed" && enrollment.creditsAwarded > 0;
    const row: CreditBankSubjectRow = {
      key,
      courseCode: enrollment.creditBankCode ?? "รอกำหนดรหัส CP",
      courseTitle: enrollment.courseTitle,
      credits: passed ? enrollment.creditsAwarded : enrollment.credits,
      category: "elective",
      state: passed ? "passed" : "failed",
      source: "short_course",
    };
    const previous = latestByCode.get(key);
    if (!previous || previous.state === "failed") latestByCode.set(key, row);
  });

  const rows = [...latestByCode.values()];
  const passed = rows.filter((row) => row.state === "passed");
  const failed = rows.filter((row) => row.state === "failed");
  const takenCodes = new Set(rows.filter((row) => row.source === "course").map((row) => row.courseCode));
  const notTaken: CreditBankSubjectRow[] = input.collegeCode
    ? input.catalog.flatMap((definition): CreditBankSubjectRow[] => {
        if (definition.kind !== "course" || definition.status !== "active") return [];
        if (definition.collegeCode !== input.collegeCode || takenCodes.has(definition.code)) return [];
        return [{
          key: `course:${definition.code}`,
          courseCode: definition.code,
          courseTitle: definition.titleTh,
          credits: definition.credits,
          category: resolveCourseCategory({ classification: definition.classification }),
          state: "not_taken",
          source: "course",
        }];
      })
    : [];

  const creditsByCategory: Record<CourseCategory, number> = { required: 0, elective: 0, practice: 0 };
  passed.forEach((row) => { creditsByCategory[row.category] += row.credits; });

  const certificates = input.shortCourseEnrollments
    .filter((enrollment) => (
      enrollment.studentId === input.studentId &&
      enrollment.status === "completed" &&
      Boolean(enrollment.certificateNo && enrollment.certificateIssuedAt)
    ))
    .map((enrollment) => ({
      id: enrollment.certificateNo!,
      title: enrollment.courseTitle,
      issuedAt: enrollment.certificateIssuedAt!,
      source: "short_course" as const,
      creditBank: enrollment.creditBank,
    }));

  return {
    totalCredits: passed.reduce((sum, row) => sum + row.credits, 0),
    creditsByCategory,
    passed,
    failed,
    notTaken,
    certificates,
  };
}
