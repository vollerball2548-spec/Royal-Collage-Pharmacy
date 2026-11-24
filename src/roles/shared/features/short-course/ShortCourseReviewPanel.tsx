"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useMockDb } from "@/providers/mock-db-provider";
import { usePortalSession } from "@/roles/shared/features/roles/use-portal-session";
import { shortCourseStatusMeta, type ShortCourseActor, type ShortCourseEnrollment } from "./workflow";

type Mode = "institution" | "staff";

/**
 * งานพิจารณา Short Course ฝั่งผู้อนุมัติ
 * - institution: ผู้ดูแลสถาบันหลัก อนุมัติคำขอ และบันทึกผลการประเมิน/ประวัติการอบรม (เฉพาะสถาบันของตน)
 * - staff: เจ้าหน้าที่ราชวิทยาลัย อนุมัติผลการประเมิน Credit Bank ก่อนเพิ่มหน่วยกิต
 */
export function ShortCourseReviewPanel({ mode }: { mode: Mode }) {
  const db = useMockDb();
  const { session } = usePortalSession();
  const [notes, setNotes] = useState<Record<string, string>>({});

  if (!session?.organisation) return null;
  const actor: ShortCourseActor = {
    userId: session.userId,
    userName: session.displayName,
    role: session.role,
    organisationId: session.organisation.id,
  };
  const allowed = mode === "institution" ? session.role === "institution_admin" : session.role === "royal_college_staff";
  if (!allowed) return null;

  const items = (db.shortCourseEnrollments ?? []).filter((item: ShortCourseEnrollment) => (
    mode === "institution"
      ? item.institutionId === session.organisation.id && ["pending_approval", "registered"].includes(item.status)
      : item.creditBank && item.status === "assessment_recorded"
  ));

  const run = (id: string, action: () => void, success: string) => {
    try {
      action();
      setNotes((previous) => ({ ...previous, [id]: "" }));
      toast.success(success);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ดำเนินการไม่สำเร็จ");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{mode === "institution" ? "Short Course: คำขอและการบันทึกผล" : "Short Course Credit Bank: รออนุมัติผลการประเมิน"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? <p className="text-sm text-muted-foreground">ไม่มีรายการที่รอดำเนินการ</p> : items.map((item) => {
          const note = notes[item.id] ?? "";
          const noteId = `short-course-note-${item.id}`;
          return (
            <article key={item.id} className="space-y-3 rounded-2xl border border-border p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">{item.courseTitle}</p>
                  <p className="text-xs text-muted-foreground">{item.studentName} · {item.studentId} · {item.creditBank ? `Credit Bank ${item.credits} หน่วยกิต` : "ไม่ต่อยอด"}</p>
                  {item.assessment ? <p className="mt-1 text-xs">ผลจากสถาบัน: <strong>{item.assessment.result === "pass" ? "ผ่าน" : "ไม่ผ่าน"}</strong> · {item.assessment.note} ({item.assessment.recordedBy})</p> : null}
                </div>
                <Badge variant={shortCourseStatusMeta[item.status].variant}>{shortCourseStatusMeta[item.status].label}</Badge>
              </div>
              <div>
                <label htmlFor={noteId} className="mb-1 block text-xs font-medium">เหตุผล / หมายเหตุ</label>
                <Textarea id={noteId} value={note} onChange={(event) => setNotes((previous) => ({ ...previous, [item.id]: event.target.value }))} rows={2} />
              </div>
              <div className="flex flex-wrap gap-2">
                {mode === "institution" && item.status === "pending_approval" ? (
                  <>
                    <Button size="sm" className="min-h-11" onClick={() => run(item.id, () => db.reviewShortCourseEnrollment({ actor, enrollmentId: item.id, decision: "approve", reason: note }), "อนุมัติคำขอแล้ว")}>อนุมัติ</Button>
                    <Button size="sm" variant="outline" className="min-h-11 text-destructive" onClick={() => run(item.id, () => db.reviewShortCourseEnrollment({ actor, enrollmentId: item.id, decision: "reject", reason: note }), "บันทึกไม่อนุมัติแล้ว")}>ไม่อนุมัติ</Button>
                  </>
                ) : null}
                {mode === "institution" && item.status === "registered" ? (
                  <>
                    <Button size="sm" className="min-h-11" onClick={() => run(item.id, () => db.recordShortCourseAssessment({ actor, enrollmentId: item.id, result: "pass", note }), "บันทึกผลแล้ว")}>บันทึกผล: ผ่าน</Button>
                    <Button size="sm" variant="outline" className="min-h-11" onClick={() => run(item.id, () => db.recordShortCourseAssessment({ actor, enrollmentId: item.id, result: "fail", note }), "บันทึกผลแล้ว")}>บันทึกผล: ไม่ผ่าน</Button>
                  </>
                ) : null}
                {mode === "staff" ? (
                  <>
                    <Button size="sm" className="min-h-11" onClick={() => run(item.id, () => db.approveShortCourseAssessment({ actor, enrollmentId: item.id, decision: "approve", reason: note }), "อนุมัติผลการประเมินแล้ว")}>อนุมัติผล</Button>
                    <Button size="sm" variant="outline" className="min-h-11" onClick={() => run(item.id, () => db.approveShortCourseAssessment({ actor, enrollmentId: item.id, decision: "return", reason: note }), "ส่งกลับให้สถาบันแล้ว")}>ส่งกลับแก้ไข</Button>
                  </>
                ) : null}
              </div>
            </article>
          );
        })}
      </CardContent>
    </Card>
  );
}
