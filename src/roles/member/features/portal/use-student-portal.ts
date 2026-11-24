"use client";

import { useMemo } from "react";
import { useMockDb, type PortalActorInput } from "@/providers/mock-db-provider";
import { resolveMockPaymentOwner } from "@/roles/shared/data";
import { colleges } from "@/roles/shared/data";
import { isCollegeCode, type CollegeCode } from "@/roles/shared/data/college-directory";
import { usePortalSession } from "@/roles/shared/features/roles/use-portal-session";

/** วิทยาลัยของหลักสูตรที่ผู้เรียนกำลังศึกษา: จาก Session ก่อน แล้วจึงจากรหัสนักศึกษา (เช่น วภท-2568-001) */
export function resolveStudentCollegeCode(session: { collegeCode?: string; userId: string } | null): CollegeCode | undefined {
  if (!session) return undefined;
  if (isCollegeCode(session.collegeCode)) return session.collegeCode;
  const prefix = session.userId.split("-")[0];
  const candidate = `${prefix}.`;
  if (isCollegeCode(candidate)) return candidate;
  return isCollegeCode(prefix) ? prefix : undefined;
}

/**
 * ข้อมูลทั้งหมดของ Student Portal ถูกกรองด้วยผู้ใช้ที่ Login อยู่ — ผู้เรียนจะไม่เห็นข้อมูลของผู้อื่น
 */
export function useStudentPortal() {
  const db = useMockDb();
  const { session, isReady } = usePortalSession();
  const isStudent = session?.role === "student";
  const studentId = isStudent ? session.userId : "";

  const actor = useMemo<PortalActorInput | null>(() => (isStudent && session ? {
    userId: session.userId,
    displayName: session.displayName,
    role: session.role,
    organisationId: session.organisation.id,
  } : null), [isStudent, session]);

  const scoped = useMemo(() => {
    if (!studentId) {
      return { registrations: [], invoices: [], payments: [], shortCourseEnrollments: [], subjectResults: [] };
    }
    const owner = resolveMockPaymentOwner(studentId);
    const ownerIds = new Set([studentId, owner.studentId, ...(owner.legacyStudentIds ?? [])]);
    return {
      registrations: db.registrations.filter((item) => item.studentId === studentId),
      invoices: db.registrationInvoices.filter((item) => ownerIds.has(item.studentId)),
      payments: db.payments.filter((item) => ownerIds.has(item.studentId)),
      shortCourseEnrollments: db.shortCourseEnrollments.filter((item) => item.studentId === studentId),
      subjectResults: db.subjectResults.filter((item) => item.studentId === studentId),
    };
  }, [db.payments, db.registrationInvoices, db.registrations, db.shortCourseEnrollments, db.subjectResults, studentId]);

  const collegeCode = resolveStudentCollegeCode(session);
  const programLabel = collegeCode && collegeCode in colleges
    ? colleges[collegeCode as keyof typeof colleges].fullName
    : "หลักสูตรที่กำลังศึกษา";

  return {
    db,
    session,
    isReady: isReady && db.isLoaded,
    isStudent,
    studentId,
    actor,
    collegeCode,
    programLabel,
    ...scoped,
  };
}
