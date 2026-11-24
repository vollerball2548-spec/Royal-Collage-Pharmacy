"use client";

import { useMemo } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageShell } from "@/roles/shared/components/layout/PageShell";
import { WorkflowStateTimeline } from "@/roles/shared/components/workspace/WorkflowStateTimeline";
import { EmptyState, ForbiddenState, LoadingState, MetricCard } from "@/roles/shared/components/workspace/WorkspacePrimitives";
import { formatCourseCode } from "@/roles/shared/data/college-directory";
import { getInvoiceBreakdown } from "@/roles/shared/features/finance";
import {
  buildRegistrationTimeline,
  canPayRegistration,
  latestDecisionReason,
  portalStageMeta,
  resolveRegistrationStage,
  type RegistrationRecord,
} from "@/roles/shared/features/registration";
import { shortCourseStatusMeta } from "@/roles/shared/features/short-course";
import { useStudentPortal } from "@/roles/member/features/portal/use-student-portal";
import { ApprovalTimeline, formatPortalDateTime as formatDateTime } from "@/roles/member/features/portal/ApprovalTimeline";
import { registrationTimelineSteps } from "./registration-timeline";

export default function RegistrationStatusPage() {
  const portal = useStudentPortal();
  const { db, registrations, invoices, payments, shortCourseEnrollments } = portal;

  const groups = useMemo(() => {
    const byTerm = new Map<string, RegistrationRecord[]>();
    [...registrations]
      .sort((left, right) => Date.parse(right.submittedAt) - Date.parse(left.submittedAt))
      .forEach((registration) => byTerm.set(registration.term, [...(byTerm.get(registration.term) ?? []), registration]));
    return [...byTerm.entries()].sort(([left], [right]) => {
      const [lt, ly] = left.split("/").map(Number);
      const [rt, ry] = right.split("/").map(Number);
      return (ry - ly) || (rt - lt);
    });
  }, [registrations]);

  if (!portal.isReady) {
    return <PageShell className="py-10"><LoadingState label="กำลังโหลดสถานะการลงทะเบียน" /></PageShell>;
  }
  if (!portal.isStudent) {
    return <PageShell className="py-10"><ForbiddenState description="หน้านี้แสดงเฉพาะคำขอลงทะเบียนของผู้เรียนที่เข้าสู่ระบบ" /></PageShell>;
  }

  const stageOf = (registration: RegistrationRecord) => {
    const invoice = invoices.find((item) => item.registrationId === registration.id);
    const payment = invoice ? payments.find((item) => item.invoiceId === invoice.id) : undefined;
    return { invoice, payment, stage: resolveRegistrationStage(registration, { invoiceStatus: invoice?.status, paymentStatus: payment?.status }) };
  };
  const stages = registrations.map((registration) => stageOf(registration).stage);
  const pendingApproval = stages.filter((stage) => stage === "pending_approval" || stage === "needs_info").length;
  const pendingPayment = stages.filter((stage) => stage === "pending_payment" || stage === "payment_review").length;
  const registered = stages.filter((stage) => stage === "registered" || stage === "completed" || stage === "failed").length;

  const handleResubmit = (registration: RegistrationRecord) => {
    if (registration.studentId !== portal.studentId) return;
    try {
      db.resubmitRegistration(registration.id);
      toast.success("ส่งคำขออีกครั้งแล้ว", { description: "รอสถาบันหลักพิจารณา" });
    } catch {
      toast.error("ส่งคำขอไม่สำเร็จ กรุณาลองใหม่");
    }
  };

  return (
    <PageShell size="wide" bottom="roomy" className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-heading text-xl font-semibold sm:text-2xl">ความคืบหน้าคำขอลงทะเบียน</h2>
          <p className="mt-1 text-sm text-muted-foreground">ติดตามการอนุมัติ การชำระเงิน และประวัติการเปลี่ยนสถานะของแต่ละรายวิชา</p>
        </div>
        <Button asChild className="min-h-11 sm:min-h-9">
          <Link href="/member/registration/courses"><span aria-hidden="true" className="material-symbols-outlined text-lg">add_circle</span>ลงทะเบียนเรียน</Link>
        </Button>
      </div>

      <section className="grid gap-3 sm:grid-cols-3" aria-label="สรุปสถานะ">
        <MetricCard size="sm" label="รออนุมัติ / รอข้อมูล" value={pendingApproval} note="สถาบันหลักกำลังพิจารณา" icon="hourglass_top" emphasis={pendingApproval > 0 ? "warning" : "default"} />
        <MetricCard size="sm" label="รอชำระ / ตรวจสอบการชำระ" value={pendingPayment} note="ชำระได้ที่เมนูการเงิน" icon="payments" emphasis={pendingPayment > 0 ? "warning" : "default"} />
        <MetricCard size="sm" label="ลงทะเบียนสำเร็จ" value={registered} note="แสดงในตารางเรียนแล้ว" icon="task_alt" emphasis="success" />
      </section>

      {registrations.length === 0 && shortCourseEnrollments.length === 0 ? (
        <EmptyState icon="timeline" title="ยังไม่มีคำขอลงทะเบียน" description="เลือกรายวิชาจากหน้าลงทะเบียนเรียน แล้วสถานะและลำดับการดำเนินงานจะแสดงที่นี่" />
      ) : null}

      {groups.map(([term, items]) => (
        <Card key={term}>
          <CardHeader className="pb-0"><CardTitle className="text-base">ภาคเรียน {term}</CardTitle></CardHeader>
          <CardContent className="space-y-4 p-5">
            {items.map((registration) => {
              const { invoice, payment, stage } = stageOf(registration);
              const meta = portalStageMeta[stage];
              const reason = latestDecisionReason(registration);
              const payable = canPayRegistration(registration, invoice?.status);
              const breakdown = invoice ? getInvoiceBreakdown(invoice) : undefined;
              const displayCourseCode = formatCourseCode(registration.courseCode);
              return (
                <article key={registration.id} className="overflow-hidden rounded-2xl border border-border">
                  <details className="group" open={stage === "rejected" || stage === "needs_info" || stage === "pending_payment"}>
                    <summary className="flex min-h-20 cursor-pointer list-none items-center justify-between gap-4 p-4 transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30 [&::-webkit-details-marker]:hidden">
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-foreground">{displayCourseCode} · {registration.courseTitle}</span>
                        <span className="mt-1 block text-xs text-muted-foreground">ใบลงทะเบียน {registration.id} · {registration.credits} หน่วยกิต</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <Badge variant={meta.variant}>{meta.label}</Badge>
                        <span aria-hidden="true" className="material-symbols-outlined text-xl text-muted-foreground transition-transform group-open:rotate-180">expand_more</span>
                      </span>
                    </summary>
                    <div className="space-y-4 border-t border-border px-4 pb-4">
                      <WorkflowStateTimeline steps={registrationTimelineSteps(registration, invoice?.status, payment?.status)} label={`สถานะการลงทะเบียน ${displayCourseCode}`} className="mt-4" />
                      <p className="flex items-start gap-2 text-sm text-muted-foreground"><span aria-hidden="true" className="material-symbols-outlined text-base">lightbulb</span>{meta.hint}</p>

                      {reason ? (
                        <div role="note" className="rounded-lg border border-danger-border bg-danger-soft px-3 py-2 text-sm text-danger-on-soft">
                          <span className="font-semibold">{stage === "rejected" ? "เหตุผลที่ไม่อนุมัติ:" : "ข้อมูลที่ต้องส่งเพิ่ม:"}</span> {reason}
                        </div>
                      ) : null}

                      <div className="grid gap-4 lg:grid-cols-2">
                        <section aria-label={`สรุปการชำระเงิน ${displayCourseCode}`} className="rounded-xl border border-border bg-surface-container-low p-4 text-sm">
                          <h3 className="font-semibold">สรุปการชำระเงิน</h3>
                          {invoice && breakdown ? (
                            <dl className="mt-2 space-y-1.5">
                              <div className="flex justify-between gap-3"><dt className="shrink-0 text-muted-foreground">เลขที่ใบแจ้งชำระ</dt><dd className="min-w-0 break-all text-right font-mono text-xs">{invoice.id}</dd></div>
                              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">ยอดชำระ</dt><dd className="font-semibold tabular-nums">฿{breakdown.total.toLocaleString()}</dd></div>
                              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">กำหนดชำระ</dt><dd>{invoice.status === "locked" ? "เปิดหลังอนุมัติ" : formatDateTime(invoice.dueAt)}</dd></div>
                              {invoice.receiptNo ? <div className="flex justify-between gap-3"><dt className="text-muted-foreground">เลขที่ใบเสร็จ</dt><dd className="font-mono text-xs">{invoice.receiptNo}</dd></div> : null}
                            </dl>
                          ) : <p className="mt-2 text-muted-foreground">ยังไม่มีใบแจ้งชำระ</p>}
                          <div className="mt-3 flex flex-wrap gap-2">
                            {payable && payment?.status !== "pending" ? (
                              <Button asChild size="sm" className="min-h-11"><Link href="/member/finance">ชำระเงิน</Link></Button>
                            ) : null}
                            {!payable && (stage === "pending_approval" || stage === "submitted") ? (
                              <p className="text-xs text-muted-foreground">ยังชำระเงินไม่ได้จนกว่าคำขอจะได้รับอนุมัติ</p>
                            ) : null}
                            {stage === "needs_info" ? <Button size="sm" variant="outline" className="min-h-11" onClick={() => handleResubmit(registration)}>ส่งคำขออีกครั้ง</Button> : null}
                            {stage === "registered" ? <Button asChild size="sm" variant="outline" className="min-h-11"><Link href="/member/schedule">ดูตารางเรียน</Link></Button> : null}
                            {stage === "rejected" ? <Button asChild size="sm" variant="outline" className="min-h-11"><Link href="/member/registration/courses">เลือกรายวิชาใหม่</Link></Button> : null}
                          </div>
                        </section>
                        <section aria-label={`ประวัติการพิจารณา ${displayCourseCode}`}>
                          <h3 className="mb-2 text-sm font-semibold">Timeline การพิจารณา</h3>
                          <ApprovalTimeline entries={buildRegistrationTimeline(registration.history)} label={`ประวัติสถานะ ${displayCourseCode}`} />
                        </section>
                      </div>
                    </div>
                  </details>
                </article>
              );
            })}
          </CardContent>
        </Card>
      ))}

      {shortCourseEnrollments.length > 0 ? (
        <Card>
          <CardHeader className="pb-0"><CardTitle className="text-base">Short Course (ลงทะเบียนรายหลักสูตร)</CardTitle></CardHeader>
          <CardContent className="space-y-4 p-5">
            {shortCourseEnrollments.map((enrollment) => {
              const meta = shortCourseStatusMeta[enrollment.status];
              return (
                <article key={enrollment.id} className="rounded-2xl border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{enrollment.courseTitle}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{enrollment.creditBank ? `Credit Bank · ${enrollment.creditBankCode ?? "รอกำหนดรหัส CP"}` : "ไม่ต่อยอด"} · {enrollment.institutionName}</p>
                    </div>
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                  </div>
                  {enrollment.decisionReason ? <p role="note" className="mt-3 rounded-lg border border-danger-border bg-danger-soft px-3 py-2 text-sm text-danger-on-soft"><span className="font-semibold">เหตุผลที่ไม่อนุมัติ:</span> {enrollment.decisionReason}</p> : null}
                  <div className="mt-3">
                    <ApprovalTimeline
                      label={`ประวัติสถานะ ${enrollment.courseTitle}`}
                      entries={enrollment.history.map((entry) => ({
                        id: entry.id,
                        at: entry.at,
                        actorLabel: entry.actorName,
                        ...(entry.from ? { fromLabel: shortCourseStatusMeta[entry.from].label } : {}),
                        toLabel: shortCourseStatusMeta[entry.to].label,
                        ...(entry.note ? { reason: entry.note } : {}),
                      }))}
                    />
                  </div>
                  {enrollment.status === "awaiting_payment" ? <Button asChild size="sm" className="mt-3 min-h-11"><Link href="/member/finance">ชำระค่าหลักสูตร</Link></Button> : null}
                </article>
              );
            })}
          </CardContent>
        </Card>
      ) : null}
    </PageShell>
  );
}
