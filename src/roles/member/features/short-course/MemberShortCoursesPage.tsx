"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageShell } from "@/roles/shared/components/layout/PageShell";
import { EmptyState, ForbiddenState, LoadingState } from "@/roles/shared/components/workspace/WorkspacePrimitives";
import { courseCatalog, type ShortCourseDefinition } from "@/roles/shared/features/courses/course-catalog";
import {
  findActiveShortCourseEnrollment,
  isCreditBankShortCourse,
  shortCourseFee,
  shortCoursePayee,
  shortCourseStatusMeta,
} from "@/roles/shared/features/short-course";
import { useStudentPortal } from "@/roles/member/features/portal/use-student-portal";

const shortCourses = courseCatalog.filter((item): item is ShortCourseDefinition => (
  item.kind === "short_course" && item.status === "active"
));

export default function MemberShortCoursesPage({ initialCourseId }: { initialCourseId?: string } = {}) {
  const portal = useStudentPortal();
  const { db, actor, shortCourseEnrollments } = portal;
  const [track, setTrack] = useState<"all" | "credit_bank" | "standard">("all");
  const [selected, setSelected] = useState<ShortCourseDefinition | null>(() => (
    shortCourses.find((course) => course.id === initialCourseId) ?? null
  ));
  const [error, setError] = useState("");

  if (!portal.isReady) return <PageShell className="py-10"><LoadingState label="กำลังโหลดหลักสูตร Short Course" /></PageShell>;
  if (!portal.isStudent || !actor) return <PageShell className="py-10"><ForbiddenState description="การสมัคร Short Course ใช้ได้เฉพาะผู้เรียนที่เข้าสู่ระบบ" /></PageShell>;

  const visible = shortCourses.filter((course) => (
    track === "all" || (track === "credit_bank") === isCreditBankShortCourse(course)
  ));

  const handleApply = () => {
    if (!selected) return;
    setError("");
    try {
      const enrollment = db.applyShortCourse(actor, selected.id);
      toast.success(enrollment.creditBank ? "ส่งคำขอลงทะเบียนแล้ว" : "สมัครหลักสูตรแล้ว", {
        description: enrollment.creditBank ? "รอสถาบันหลักอนุมัติก่อนเปิดชำระเงิน" : "ชำระค่าหลักสูตรได้ที่เมนูการเงิน",
      });
      setSelected(null);
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : "ส่งคำขอไม่สำเร็จ");
    }
  };

  return (
    <PageShell size="wide" bottom="roomy" className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-heading text-xl font-semibold sm:text-2xl">Short Course (4 เดือน)</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">ลงทะเบียนรายหลักสูตร/รายวิชา ไม่ใช่รายเทอม · หลักสูตรต่อยอด Credit Bank ต้องรอสถาบันหลักอนุมัติก่อนชำระเงิน และจะบันทึกหน่วยกิตหลังเจ้าหน้าที่ราชวิทยาลัยอนุมัติผลการประเมินแล้วเท่านั้น</p>
        </div>
        <label className="text-sm">
          <span className="sr-only">ประเภทหลักสูตร</span>
          <select value={track} onChange={(event) => setTrack(event.target.value as typeof track)} className="h-11 rounded-xl border border-border bg-background px-3 text-sm">
            <option value="all">ทุกประเภท</option>
            <option value="credit_bank">ต่อยอด Credit Bank</option>
            <option value="standard">ไม่ต่อยอด</option>
          </select>
        </label>
      </div>

      {visible.length === 0 ? <EmptyState icon="school" title="ยังไม่มี Short Course ที่เปิดรับสมัคร" description="เมื่อมีหลักสูตรเปิดรับ รายการจะแสดงที่นี่" /> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((course) => {
            const creditBank = isCreditBankShortCourse(course);
            const fee = shortCourseFee(course);
            const enrollment = findActiveShortCourseEnrollment(shortCourseEnrollments, portal.studentId, course.id);
            return (
              <Card key={course.id} role="article" aria-label={course.titleTh}>
                <CardContent className="flex h-full flex-col gap-3 p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={creditBank ? "brand" : "neutral"}>{creditBank ? "ต่อยอด Credit Bank" : "ไม่ต่อยอด"}</Badge>
                    <Badge variant="outline">{course.collegeCode}</Badge>
                    {enrollment ? <Badge variant={shortCourseStatusMeta[enrollment.status].variant}>{shortCourseStatusMeta[enrollment.status].label}</Badge> : null}
                  </div>
                  <div>
                    <p className="font-mono text-xs font-semibold text-primary">{creditBank ? (course.creditBankCode ?? "รหัส CP: รอกำหนด") : "ไม่มีรหัส Credit Bank"}</p>
                    <h3 className="mt-1 font-semibold leading-6">{course.titleTh}</h3>
                    <p className="text-xs text-muted-foreground">{course.titleEn}</p>
                  </div>
                  <dl className="grid grid-cols-2 gap-2 text-xs">
                    <div><dt className="text-muted-foreground">ระยะเวลา</dt><dd className="font-medium">{course.duration}</dd></div>
                    <div><dt className="text-muted-foreground">หน่วยกิต</dt><dd className="font-medium">{course.credits}</dd></div>
                    <div><dt className="text-muted-foreground">ค่าหลักสูตร</dt><dd className="font-medium tabular-nums">฿{fee.amount.toLocaleString()}{fee.source === "per_credit_default" ? " *" : ""}</dd></div>
                    <div><dt className="text-muted-foreground">ผู้รับชำระ</dt><dd className="font-medium">{shortCoursePayee(course).label}</dd></div>
                  </dl>
                  <div className="mt-auto flex flex-wrap gap-2 pt-2">
                    {enrollment ? (
                      <Button asChild variant="outline" className="min-h-11"><Link href="/member/registration">ดูสถานะ</Link></Button>
                    ) : (
                      <Button className="min-h-11" onClick={() => { setError(""); setSelected(course); }}>{creditBank ? "ส่งคำขอลงทะเบียน" : "สมัครหลักสูตร"}</Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      <p className="text-xs text-muted-foreground">* TODO: หลักสูตรยังไม่ได้กำหนดค่าหลักสูตรในระบบ จึงแสดงตามอัตราต่อหน่วยกิตเดิม (1,000 บาท/หน่วยกิต) · หลักสูตรไม่ต่อยอดไม่สร้างสมาชิกวิสามัญและไม่บันทึก Credit Bank แต่บันทึกประวัติการอบรมใน Pharmacist Profile</p>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{selected && isCreditBankShortCourse(selected) ? "ยืนยันส่งคำขอลงทะเบียน" : "ยืนยันสมัครหลักสูตร"}</DialogTitle>
            <DialogDescription>{selected?.titleTh}</DialogDescription>
          </DialogHeader>
          {selected ? (
            <div className="space-y-3 text-sm">
              <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
                {isCreditBankShortCourse(selected) ? (
                  <>
                    <li>ส่งคำขอ → สถาบันหลักตรวจสอบและอนุมัติ</li>
                    <li>ชำระค่าหลักสูตรหลังอนุมัติ</li>
                    <li>เข้าเรียนและประเมินผล → สถาบันบันทึกผล</li>
                    <li>เจ้าหน้าที่ราชวิทยาลัยอนุมัติผล → บันทึกหน่วยกิตลง Credit Bank และออก Certificate</li>
                  </>
                ) : (
                  <>
                    <li>สมัครและชำระค่าหลักสูตร</li>
                    <li>เข้าเรียนตามกำหนด</li>
                    <li>สถาบันบันทึกประวัติการอบรม → ออก Certificate เมื่อผ่านเงื่อนไข</li>
                  </>
                )}
              </ol>
              {error ? <p role="alert" className="rounded-xl border border-danger-border bg-danger-soft p-3 text-danger-on-soft">{error}</p> : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" className="min-h-11" onClick={() => setSelected(null)}>ยกเลิก</Button>
            <Button className="min-h-11" onClick={handleApply}>ยืนยัน</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
