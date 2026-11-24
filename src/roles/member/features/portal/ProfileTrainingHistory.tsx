"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { shortCourseStatusMeta } from "@/roles/shared/features/short-course";
import { useStudentPortal } from "./use-student-portal";

/** ประวัติการอบรม Short Course และ Certificate ใน Pharmacist Profile (เฉพาะของผู้ใช้ที่ Login) */
export function ProfileTrainingHistory() {
  const portal = useStudentPortal();
  if (!portal.isReady || !portal.isStudent) return null;
  const history = portal.shortCourseEnrollments.filter((item) => ["registered", "assessment_recorded", "completed", "failed"].includes(item.status));

  return (
    <section aria-labelledby="profile-training-history" className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="profile-training-history" className="text-base font-semibold">ประวัติการอบรม Short Course</h2>
        <Link href="/member/certificates" className="text-sm font-semibold text-primary hover:underline">ดู Certificate</Link>
      </div>
      {history.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">ยังไม่มีประวัติการอบรม</p> : (
        <ul className="mt-3 space-y-2">
          {history.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm">
              <span><span className="font-medium">{item.courseTitle}</span><span className="block text-xs text-muted-foreground">{item.creditBank ? `Credit Bank · ${item.creditsAwarded} หน่วยกิตที่บันทึกแล้ว` : "ไม่ต่อยอด"}{item.certificateNo ? ` · Certificate ${item.certificateNo}` : ""}</span></span>
              <Badge variant={shortCourseStatusMeta[item.status].variant}>{shortCourseStatusMeta[item.status].label}</Badge>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
