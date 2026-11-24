import type {
  AcademicInstitution,
  AcademicTeacher,
  CourseOffering,
  SubjectResult,
  TeachingAssignment,
} from "@/roles/shared/features/academic/model";
import {
  COURSE_SCHEDULE_DETAILS,
  formatCourseSchedule,
  type CourseScheduleWeekday,
} from "@/roles/shared/features/academic/course-schedule";
import type { RegistrationInvoice } from "@/roles/shared/features/finance";
import type { RegistrationRecord } from "@/roles/shared/features/registration";
import { isScheduleVisible } from "@/roles/shared/features/registration/student-portal";
import type { ShortCourseEnrollment } from "@/roles/shared/features/short-course";
import { getUniversityNameForInstitution } from "@/roles/shared/data/university-directory";

export type StudyStatus = "studying" | "passed" | "failed" | "awaiting_result";

export const studyStatusMeta: Readonly<Record<StudyStatus, { label: string; variant: "info" | "success" | "danger" | "warning" }>> = {
  studying: { label: "กำลังเรียน", variant: "info" },
  awaiting_result: { label: "รอประกาศผล", variant: "warning" },
  passed: { label: "ผ่าน", variant: "success" },
  failed: { label: "ไม่ผ่าน", variant: "danger" },
};

export interface StudentScheduleEntry {
  id: string;
  source: "course" | "short_course";
  programLabel: string;
  courseCode: string;
  courseTitle: string;
  term: string;
  weekday?: CourseScheduleWeekday;
  startTime?: string;
  endTime?: string;
  scheduleLabel: string;
  location: string;
  mode?: "onsite" | "online" | "clinical";
  teacherNames: string[];
  institutionName: string;
  studyStatus: StudyStatus;
}

export const WEEKDAY_ROWS: readonly { id: string; weekday: CourseScheduleWeekday; label: string; shortLabel: string }[] = [
  { id: "weekday-1", weekday: 1, label: "วันจันทร์", shortLabel: "จ." },
  { id: "weekday-2", weekday: 2, label: "วันอังคาร", shortLabel: "อ." },
  { id: "weekday-3", weekday: 3, label: "วันพุธ", shortLabel: "พ." },
  { id: "weekday-4", weekday: 4, label: "วันพฤหัสบดี", shortLabel: "พฤ." },
  { id: "weekday-5", weekday: 5, label: "วันศุกร์", shortLabel: "ศ." },
  { id: "weekday-6", weekday: 6, label: "วันเสาร์", shortLabel: "ส." },
  { id: "weekday-7", weekday: 7, label: "วันอาทิตย์", shortLabel: "อา." },
];

/**
 * ตารางเรียน: แสดงเฉพาะรายวิชาที่ "ลงทะเบียนสำเร็จ" และ "ชำระเงินสำเร็จ" แล้วเท่านั้น
 */
export function buildStudentSchedule(input: {
  studentId: string;
  registrations: readonly RegistrationRecord[];
  invoices: readonly RegistrationInvoice[];
  courseOfferings: readonly CourseOffering[];
  institutions: readonly AcademicInstitution[];
  teachingAssignments: readonly TeachingAssignment[];
  teachers: readonly AcademicTeacher[];
  subjectResults: readonly SubjectResult[];
  shortCourseEnrollments: readonly ShortCourseEnrollment[];
  programLabel: string;
}): StudentScheduleEntry[] {
  const invoiceByRegistration = new Map(input.invoices.map((invoice) => [invoice.registrationId, invoice]));
  const offeringById = new Map(input.courseOfferings.map((offering) => [offering.id, offering]));
  const institutionById = new Map(input.institutions.map((institution) => [institution.id, institution]));
  const teacherById = new Map(input.teachers.map((teacher) => [teacher.id, teacher]));

  const courseEntries = input.registrations.flatMap((registration): StudentScheduleEntry[] => {
    if (registration.studentId !== input.studentId) return [];
    const invoice = invoiceByRegistration.get(registration.id);
    if (!isScheduleVisible(registration, invoice?.status)) return [];
    const offering = registration.courseOfferingId ? offeringById.get(registration.courseOfferingId) : undefined;
    const details = offering ? COURSE_SCHEDULE_DETAILS[offering.id] : undefined;
    const institutionId = offering?.institutionId ?? registration.institutionId;
    const institutionName = (institutionId && (getUniversityNameForInstitution(institutionId) ?? institutionById.get(institutionId)?.name)) ?? "สถาบันจะแจ้ง";
    const teacherNames = input.teachingAssignments
      .filter((assignment) => assignment.courseOfferingId === offering?.id && assignment.status === "accepted")
      .filter((assignment) => !assignment.endsAt || Date.parse(assignment.endsAt) > Date.parse(registration.updatedAt))
      .flatMap((assignment) => teacherById.get(assignment.teacherId)?.name ?? []);
    const result = input.subjectResults.find((item) => (
      item.studentId === input.studentId &&
      item.courseOfferingId === offering?.id &&
      (item.status === "published" || item.status === "revised")
    ));
    const studyStatus: StudyStatus = result?.currentValue === "S"
      ? "passed"
      : result?.currentValue === "U"
        ? "failed"
        : "studying";
    return [{
      id: registration.id,
      source: "course",
      programLabel: input.programLabel,
      courseCode: registration.courseCode,
      courseTitle: registration.courseTitle,
      term: registration.term,
      ...(details ? {
        weekday: details.weekday,
        startTime: details.startTime,
        endTime: details.endTime,
        mode: details.mode,
      } : {}),
      scheduleLabel: details ? formatCourseSchedule(details) : "สถาบันจะแจ้งวันและเวลา",
      location: details?.room ?? "สถาบันจะแจ้งสถานที่เรียน",
      teacherNames: [...new Set(teacherNames)],
      institutionName,
      studyStatus,
    }];
  });

  const shortCourseEntries = input.shortCourseEnrollments.flatMap((enrollment): StudentScheduleEntry[] => {
    if (enrollment.studentId !== input.studentId) return [];
    if (!["registered", "assessment_recorded", "completed", "failed"].includes(enrollment.status)) return [];
    const studyStatus: StudyStatus = enrollment.status === "completed"
      ? "passed"
      : enrollment.status === "failed"
        ? "failed"
        : enrollment.status === "assessment_recorded"
          ? "awaiting_result"
          : "studying";
    return [{
      id: enrollment.id,
      source: "short_course",
      programLabel: enrollment.creditBank ? "Short Course (ต่อยอด Credit Bank)" : "Short Course (ไม่ต่อยอด)",
      courseCode: enrollment.creditBankCode ?? "—",
      courseTitle: enrollment.courseTitle,
      term: "รายหลักสูตร",
      // TODO(schedule): Short Course ยังไม่มีข้อมูลกำหนดการอบรมในระบบ
      scheduleLabel: "สถาบันจะแจ้งกำหนดการอบรม",
      location: "สถาบันจะแจ้งสถานที่",
      teacherNames: [],
      institutionName: enrollment.institutionName,
      studyStatus,
    }];
  });

  return [...courseEntries, ...shortCourseEntries];
}
