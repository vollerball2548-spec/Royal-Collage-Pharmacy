"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useMockDb } from "@/providers/mock-db-provider";
import {
  advanceApprovalExam,
  canAdvanceApprovalExam,
  type ApprovalExamStage,
} from "@/roles/shared/features/admissions/approval-exam";
import { admissionWording } from "@/roles/shared/features/admissions/program-offerings";
import { createAuditActorSnapshot, useAuditLog } from "@/roles/shared/features/audit";
import { usePortalSession } from "@/roles/shared/features/roles/use-portal-session";
import { EmptyState } from "@/roles/shared/components/workspace/WorkspacePrimitives";

const stageLabel: Record<ApprovalExamStage | "paid" | "unpaid", string> = {
  unpaid: "รอชำระค่าสมัครสอบ",
  paid: "ชำระแล้ว รอประกาศสิทธิ์สอบ",
  exam_eligible: "มีสิทธิ์สอบ",
  passed: "สอบผ่าน รอบันทึกหนังสืออนุมัติ",
  failed: "สอบไม่ผ่าน",
  approval_issued: "ได้รับหนังสืออนุมัติแล้ว",
};

/** เจ้าหน้าที่ราชวิทยาลัย: สิทธิ์สอบ → ผลสอบ → หนังสืออนุมัติ ของใบสมัครสอบอนุมัติที่ผ่านการตรวจคุณสมบัติแล้ว */
export function StaffApprovalExamPanel() {
  const { admissions, payments, setAdmissions, isLoaded } = useMockDb();
  const { session } = usePortalSession();
  const { appendEvent } = useAuditLog();
  const [letterNo, setLetterNo] = useState<Record<string, string>>({});

  const applications = admissions.filter((admission) => admission.applicationType === "exam" && admission.status === "approved");
  const feePaid = (id: string) => payments.some((payment) => payment.invoiceId === `admission-${id}` && payment.status === "approved");

  const advance = (id: string, to: ApprovalExamStage) => {
    const admission = admissions.find((item) => item.id === id);
    if (!admission || !session) return;
    try {
      const at = new Date().toISOString();
      const progress = advanceApprovalExam(admission.approvalProgress, to, {
        applicationApproved: admission.status === "approved",
        feePaid: feePaid(id),
        actorName: session.displayName,
        at,
        approvalLetterNo: letterNo[id],
      });
      const auditEvent = appendEvent({
        actor: createAuditActorSnapshot(session),
        action: "approval_exam.stage_update",
        resource: { type: "admission", id, label: admission.program, organisationId: session.organisation.id },
        before: admission.approvalProgress ?? null,
        after: progress,
        reason: stageLabel[to],
        evidenceReference: to === "approval_issued" ? `approval-letter:${progress.approvalLetterNo}` : `admission:${id}`,
      });
      if (!auditEvent) {
        toast.error("บันทึก Audit Log ไม่สำเร็จ จึงยังไม่เปลี่ยนสถานะ");
        return;
      }
      setAdmissions((previous) => previous.map((item) => (item.id === id ? { ...item, approvalProgress: progress } : item)));
      toast.success(`บันทึกสถานะ: ${stageLabel[to]}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "เปลี่ยนสถานะไม่สำเร็จ");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{admissionWording.approvalExam}: สิทธิ์สอบ ผลสอบ และหนังสืออนุมัติ</CardTitle>
        <p className="text-sm text-muted-foreground">แสดงเฉพาะใบสมัครที่ผ่านการตรวจคุณสมบัติแล้ว ทุกการเปลี่ยนสถานะบันทึกลง Audit Log</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {!isLoaded ? null : applications.length === 0 ? (
          <EmptyState icon="workspace_premium" title={`ยังไม่มีใบ${admissionWording.approvalExam}ที่ผ่านการตรวจคุณสมบัติ`} description="เมื่อคำขอผ่านการตรวจคุณสมบัติ รายการจะแสดงที่นี่" />
        ) : applications.map((admission) => {
          const paid = feePaid(admission.id);
          const stage = admission.approvalProgress?.stage;
          const context = { applicationApproved: true, feePaid: paid };
          const can = (to: ApprovalExamStage) => canAdvanceApprovalExam(admission.approvalProgress, to, context);
          return (
            <div key={admission.id} className="flex flex-col gap-3 rounded-xl border border-border p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="font-mono text-xs font-semibold text-primary">{admission.id}</p>
                <p className="font-medium">{admission.name}</p>
                <p className="text-sm text-muted-foreground">{admission.program}</p>
                <Badge variant={stage === "failed" ? "danger" : stage === "approval_issued" ? "success" : "secondary"} className="mt-1">
                  {stageLabel[stage ?? (paid ? "paid" : "unpaid")]}
                  {admission.approvalProgress?.approvalLetterNo ? ` · ${admission.approvalProgress.approvalLetterNo}` : ""}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {can("exam_eligible") && <Button size="sm" onClick={() => advance(admission.id, "exam_eligible")}>ประกาศสิทธิ์สอบ</Button>}
                {can("passed") && <Button size="sm" onClick={() => advance(admission.id, "passed")}>บันทึกผล: ผ่าน</Button>}
                {can("failed") && <Button size="sm" variant="outline" onClick={() => advance(admission.id, "failed")}>บันทึกผล: ไม่ผ่าน</Button>}
                {can("approval_issued") && (
                  <>
                    <label htmlFor={`letter-${admission.id}`} className="sr-only">เลขที่หนังสืออนุมัติ</label>
                    <Input
                      id={`letter-${admission.id}`}
                      className="h-9 w-48"
                      placeholder="เลขที่หนังสืออนุมัติ"
                      value={letterNo[admission.id] ?? ""}
                      onChange={(event) => setLetterNo((current) => ({ ...current, [admission.id]: event.target.value }))}
                    />
                    <Button size="sm" onClick={() => advance(admission.id, "approval_issued")}>บันทึกหนังสืออนุมัติ</Button>
                  </>
                )}
              </div>
            </div>
          );
        })}
        {/* TODO(business): หนังสืออนุมัติออกผ่าน e-Service ของสภาเภสัชกรรม — ระบบนี้บันทึกเลขอ้างอิงเท่านั้น ยังไม่เชื่อมระบบสภาฯ */}
      </CardContent>
    </Card>
  );
}
