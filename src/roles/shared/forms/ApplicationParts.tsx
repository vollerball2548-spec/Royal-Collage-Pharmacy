"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  applicationStatusMeta,
  documentReviewMeta,
  type Application,
  type ApplicationKind,
  type ApplicationStatus,
} from "@/domain/applications/model";

const flows: Readonly<Record<ApplicationKind, readonly { label: string; statuses: readonly ApplicationStatus[] }[]>> = {
  study: [
    { label: "กรอกใบสมัคร", statuses: ["draft"] },
    { label: "ชำระเงิน", statuses: ["awaiting_payment"] },
    { label: "สมาชิกวิสามัญ (Credit Bank)", statuses: ["membership_pending"] },
    { label: "เข้าเรียน", statuses: ["enrolled"] },
    { label: "Certificate / สะสมหน่วยกิต", statuses: ["completed"] },
  ],
  entrance_exam: [
    { label: "กรอกใบสมัคร", statuses: ["draft"] },
    { label: "ชำระค่าสมัคร", statuses: ["awaiting_payment"] },
    { label: "เจ้าหน้าที่ตรวจ", statuses: ["under_review", "needs_revision", "rejected"] },
    { label: "ประกาศรายชื่อ / สอบ", statuses: ["eligible", "failed"] },
    { label: "ผ่าน → ลงทะเบียนเรียน", statuses: ["passed", "awaiting_tuition"] },
    { label: "สมาชิกวิสามัญ", statuses: ["membership_pending"] },
    { label: "เข้าเรียน", statuses: ["enrolled", "completed"] },
  ],
  approval_exam: [
    { label: "กรอกใบสมัคร", statuses: ["draft"] },
    { label: "ชำระค่าสมัคร", statuses: ["awaiting_payment"] },
    { label: "ตรวจเอกสาร", statuses: ["under_review", "needs_revision", "rejected"] },
    { label: "จัดสอบ / ประกาศผล", statuses: ["eligible", "passed", "failed"] },
    { label: "หนังสืออนุมัติ / สมาชิกสามัญ", statuses: ["approval_issued"] },
  ],
};

const problem: readonly ApplicationStatus[] = ["rejected", "failed", "cancelled"];

export function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  return <Badge variant={applicationStatusMeta[status].variant}>{applicationStatusMeta[status].label}</Badge>;
}

/** เส้นทางของใบสมัครตามประเภท — ขั้นที่ข้ามไม่ได้ใช้ (เช่น สมาชิกวิสามัญของหลักสูตรไม่ต่อยอด) แสดงเป็นจาง */
export function ApplicationTimeline({ application }: { application: Application }) {
  const steps = flows[application.kind].filter((step) => !(application.kind === "study" && step.statuses.includes("membership_pending") && application.context.creditBank !== true));
  const currentIndex = steps.findIndex((step) => step.statuses.includes(application.status));
  return (
    <ol aria-label="ความคืบหน้าของใบสมัคร" className="flex flex-wrap gap-2">
      {steps.map((step, index) => {
        const state = problem.includes(application.status) && index === currentIndex
          ? "problem"
          : currentIndex === -1 || index < currentIndex ? (currentIndex === -1 ? "waiting" : "done") : index === currentIndex ? "current" : "waiting";
        return (
          <li
            key={step.label}
            aria-current={state === "current" ? "step" : undefined}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs",
              state === "done" && "border-success-border bg-success-soft text-success-on-soft",
              state === "current" && "border-primary bg-primary text-primary-foreground",
              state === "waiting" && "border-border bg-card text-muted-foreground",
              state === "problem" && "border-danger-border bg-danger-soft text-danger-on-soft",
            )}
          >
            <span className="font-semibold">{index + 1}</span>{step.label}
          </li>
        );
      })}
    </ol>
  );
}

export function DocumentChecklist({ application, children }: { application: Application; children?: (documentId: string) => React.ReactNode }) {
  return (
    <ul className="divide-y divide-border rounded-xl border border-border">
      {application.documents.map((document) => (
        <li key={document.documentId} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium">{document.label}{document.required ? <span className="text-danger"> *</span> : null}</p>
            <p className="text-xs text-muted-foreground">{document.file ? `ไฟล์: ${document.file.name}` : "ยังไม่ได้แนบ"}</p>
            {document.note ? <p className="mt-1 text-xs text-warning-on-soft">หมายเหตุ: {document.note}</p> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={documentReviewMeta[document.status].variant}>{documentReviewMeta[document.status].label}</Badge>
            {children?.(document.documentId)}
          </div>
        </li>
      ))}
      {application.documents.length === 0 ? <li className="p-3 text-sm text-muted-foreground">ไม่มีเอกสารที่ต้องแนบ</li> : null}
    </ul>
  );
}

export function ApplicationHistory({ application }: { application: Application }) {
  return (
    <ol className="space-y-2">
      {[...application.history].reverse().map((entry, index) => (
        <li key={`${entry.at}-${index}`} className="rounded-xl border border-border p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium">{entry.action}{entry.to ? ` → ${applicationStatusMeta[entry.to].label}` : ""}</span>
            <time className="text-xs text-muted-foreground">{new Date(entry.at).toLocaleString("th-TH")}</time>
          </div>
          <p className="text-xs text-muted-foreground">{entry.actorName} ({entry.actorRole})</p>
          {entry.note ? <p className="mt-1 text-xs">{entry.note}</p> : null}
          {entry.changedFields?.length ? <p className="mt-1 text-xs text-muted-foreground">แก้ไข: {entry.changedFields.join(", ")}</p> : null}
        </li>
      ))}
    </ol>
  );
}
