"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageShell } from "@/roles/shared/components/layout/PageShell";
import { LoadingState, MetricCard } from "@/roles/shared/components/workspace/WorkspacePrimitives";
import { formatCourseCode } from "@/roles/shared/data/college-directory";
import { courseCatalog } from "@/roles/shared/features/courses/course-catalog";
import { summarizeCreditBank } from "@/roles/shared/features/credit-bank";
import { courseCategoryMeta, latestDecisionReason, resolveRegistrationStage } from "@/roles/shared/features/registration/student-portal";
import { getRegistrationWindowStatus } from "@/roles/shared/features/registration/registration-window";
import { useStudentPortal } from "@/roles/member/features/portal/use-student-portal";
import { buildStudentSchedule } from "@/roles/member/features/portal/student-schedule";

interface NextAction { id: string; icon: string; title: string; detail: string; href: string; tone: "warning" | "danger" | "info" }

export default function DashboardPage() {
  const portal = useStudentPortal();
  const { db, session, registrations, invoices, payments, subjectResults, shortCourseEnrollments } = portal;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 60_000); return () => window.clearInterval(timer); }, []);
  const registrationWindow = getRegistrationWindowStatus({
    enabled: db.settings.registrationOpen,
    opensAt: db.settings.registrationOpensAt,
    closesAt: db.settings.registrationClosesAt,
    now,
  });

  const schedule = useMemo(() => buildStudentSchedule({
    studentId: portal.studentId, registrations, invoices, courseOfferings: db.courseOfferings,
    institutions: db.academicInstitutions, teachingAssignments: db.teachingAssignments, teachers: db.academicTeachers,
    subjectResults, shortCourseEnrollments, programLabel: portal.programLabel,
  }), [db.academicInstitutions, db.academicTeachers, db.courseOfferings, db.teachingAssignments, invoices, portal.programLabel, portal.studentId, registrations, shortCourseEnrollments, subjectResults]);
  const creditBank = useMemo(() => summarizeCreditBank({
    studentId: portal.studentId, collegeCode: portal.collegeCode, subjectResults,
    courseOfferings: db.courseOfferings, catalog: courseCatalog, shortCourseEnrollments,
  }), [db.courseOfferings, portal.collegeCode, portal.studentId, shortCourseEnrollments, subjectResults]);

  if (!portal.isReady) return <PageShell className="py-10"><LoadingState label="กำลังโหลดภาพรวม" /></PageShell>;

  const actions: NextAction[] = [];
  registrations.forEach((registration) => {
    const invoice = invoices.find((item) => item.registrationId === registration.id);
    const payment = invoice ? payments.find((item) => item.invoiceId === invoice.id) : undefined;
    const stage = resolveRegistrationStage(registration, { invoiceStatus: invoice?.status, paymentStatus: payment?.status });
    const label = `${formatCourseCode(registration.courseCode)} ${registration.courseTitle}`;
    if (stage === "pending_payment") actions.push({ id: registration.id, icon: "payments", title: "ชำระค่าลงทะเบียน", detail: label, href: "/member/finance", tone: "warning" });
    if (stage === "needs_info") actions.push({ id: registration.id, icon: "edit_document", title: "ส่งข้อมูลเพิ่มเติม", detail: `${label} · ${latestDecisionReason(registration) ?? ""}`, href: "/member/registration", tone: "warning" });
    if (stage === "rejected") actions.push({ id: registration.id, icon: "block", title: "คำขอไม่ได้รับอนุมัติ", detail: `${label} · ${latestDecisionReason(registration) ?? ""}`, href: "/member/registration", tone: "danger" });
    if (stage === "pending_approval") actions.push({ id: registration.id, icon: "hourglass_top", title: "รอสถาบันหลักอนุมัติ", detail: label, href: "/member/registration", tone: "info" });
  });
  shortCourseEnrollments.forEach((enrollment) => {
    if (enrollment.status === "awaiting_payment") actions.push({ id: enrollment.id, icon: "payments", title: "ชำระค่าหลักสูตร Short Course", detail: enrollment.courseTitle, href: "/member/finance", tone: "warning" });
    if (enrollment.status === "rejected") actions.push({ id: enrollment.id, icon: "block", title: "คำขอ Short Course ไม่ได้รับอนุมัติ", detail: `${enrollment.courseTitle} · ${enrollment.decisionReason ?? ""}`, href: "/member/registration", tone: "danger" });
  });

  return (
    <PageShell className="space-y-5">
      <header className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b-2 border-primary bg-gradient-to-r from-primary/[0.07] to-transparent px-5 py-5 md:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0"><h2 className="text-xl font-bold md:text-2xl">ยินดีต้อนรับ {session?.displayName ?? ""}</h2><p className="mt-1 break-words text-sm text-muted-foreground">{portal.programLabel} · รหัสนักศึกษา <span className="font-mono">{portal.studentId || "—"}</span></p></div>
            <Link href="/member/passport" className="inline-flex shrink-0 items-center gap-2 self-start rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"><span aria-hidden="true" className="material-symbols-outlined text-lg">badge</span>เปิด Pharmacist Profile</Link>
          </div>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-3" aria-label="ข้อมูลการศึกษาโดยสรุป">
        <MetricCard size="sm" label="หน่วยกิตสะสม (Credit Bank)" value={creditBank.totalCredits} note={`ผ่าน ${creditBank.passed.length} · ยังไม่ผ่าน ${creditBank.failed.length}`} icon="credit_score" />
        <MetricCard size="sm" label="รายวิชาในตารางเรียน" value={schedule.length} note="ลงทะเบียนและชำระเงินสำเร็จแล้ว" icon="menu_book" />
        <MetricCard size="sm" label="สิ่งที่ต้องดำเนินการ" value={actions.filter((item) => item.tone !== "info").length} note="รายการที่รอให้คุณทำต่อ" icon="pending_actions" emphasis={actions.some((item) => item.tone !== "info") ? "warning" : "default"} />
      </section>

      <Card className="overflow-hidden"><CardContent className="grid gap-5 p-5 md:grid-cols-[1fr_auto] md:items-center"><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-bold">การลงทะเบียนภาคการศึกษาปัจจุบัน</h2><Badge variant={registrationWindow.tone}>{registrationWindow.label}</Badge></div><p className="mt-2 text-sm text-muted-foreground">{registrationWindow.detail}</p></div><Link href={registrationWindow.canRegister ? "/member/registration/courses" : "/member/registration"} className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">{registrationWindow.canRegister ? "ลงทะเบียนเรียน" : "ตรวจสอบการลงทะเบียน"}<span aria-hidden="true" className="material-symbols-outlined text-base">chevron_right</span></Link></CardContent></Card>

      <div className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
        <Card>
          <CardHeader><CardTitle className="text-lg">สิ่งที่ต้องทำต่อ</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {actions.length === 0 ? <p className="text-sm text-muted-foreground">ไม่มีรายการค้าง — ดูรายวิชาที่เปิดลงทะเบียนได้ที่เมนูลงทะเบียนเรียน</p> : actions.map((action) => (
              <Link key={`${action.id}-${action.title}`} href={action.href} className="flex items-start gap-3 rounded-xl border border-border p-3 transition-colors hover:bg-muted/40">
                <span aria-hidden="true" className={`material-symbols-outlined mt-0.5 text-xl ${action.tone === "danger" ? "text-danger" : action.tone === "warning" ? "text-warning" : "text-info"}`}>{action.icon}</span>
                <span className="min-w-0"><span className="block text-sm font-semibold">{action.title}</span><span className="block break-words text-xs text-muted-foreground">{action.detail}</span></span>
              </Link>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-lg">หน่วยกิตตามประเภทวิชา</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {(["required", "elective", "practice"] as const).map((category) => (
              <div key={category} className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-4 py-3"><span className="text-sm">{courseCategoryMeta[category].label}</span><strong>{creditBank.creditsByCategory[category]} หน่วยกิต</strong></div>
            ))}
            <Link href="/member/credit-bank" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">ดู Credit Bank<span aria-hidden="true" className="material-symbols-outlined text-base">chevron_right</span></Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">ตารางเรียน</CardTitle></CardHeader>
        <CardContent className="divide-y p-0">
          {schedule.length === 0 ? <p className="px-5 pb-5 text-sm text-muted-foreground">ยังไม่มีรายวิชาที่ลงทะเบียนสำเร็จ</p> : schedule.slice(0, 5).map((item) => (
            <div key={item.id} className="grid gap-2 px-5 py-4 sm:grid-cols-[180px_1fr_auto] sm:items-center">
              <p className="font-medium text-primary">{item.scheduleLabel}</p>
              <div className="min-w-0"><p className="font-medium">{item.courseTitle}</p><p className="mt-1 text-xs text-muted-foreground">{item.courseCode === "—" ? "Short Course" : formatCourseCode(item.courseCode)} · {item.term}</p></div>
              <p className="text-sm text-muted-foreground">{item.location}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </PageShell>
  );
}
