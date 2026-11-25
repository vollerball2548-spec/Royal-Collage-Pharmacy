"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageShell } from "@/roles/shared/components/layout/PageShell";
import { EmptyState, WorkspaceHeader } from "@/roles/shared/components/workspace/WorkspacePrimitives";
import { templateForApplication } from "@/domain/applications/catalog";
import { applicationKindLabel, applicationStatusMeta, type Application, type ApplicationStatus } from "@/domain/applications/model";
import {
  actionLabel,
  approveEligibility,
  canActOn,
  complete,
  issueApproval,
  recordResult,
  reject,
  requestRevision,
  reviewDocument,
  setFee,
} from "@/domain/applications/workflow";
import { isVisible } from "@/domain/forms/evaluate";
import { createAuditActorSnapshot, useAuditLog } from "@/roles/shared/features/audit";
import { ORGANISATION_LIST, organisationContains } from "@/roles/shared/features/roles/access-model";
import { usePortalSession } from "@/roles/shared/features/roles/use-portal-session";
import { ApplicationHistory, ApplicationStatusBadge, ApplicationTimeline, DocumentChecklist } from "./ApplicationParts";
import { displayValue } from "./FormRenderer";
import { useApplicationActor, useApplications } from "./use-applications";

const filterStatuses: readonly ApplicationStatus[] = ["under_review", "needs_revision", "eligible", "passed", "awaiting_payment", "approval_issued"];

/** เจ้าหน้าที่ราชวิทยาลัยเห็นทุกใบ; สถาบัน/วิทยาลัยเห็นเฉพาะใบที่อยู่ในขอบเขตองค์กรตน (ไม่รวมฉบับร่าง) */
function inScope(application: Application, role: string, organisationId: string) {
  if (application.status === "draft") return false;
  if (role === "royal_college_staff") return true;
  const scope = ORGANISATION_LIST.find((organisation) => organisation.id === organisationId);
  if (!scope) return false;
  const owner = application.institutionId ?? ORGANISATION_LIST.find((organisation) => organisation.kind === "college" && organisation.code === application.collegeCode)?.id;
  return Boolean(owner && organisationContains(scope, owner));
}

export function ApplicationReviewPage({ title, description }: { title: string; description: string }) {
  const actor = useApplicationActor();
  const { session } = usePortalSession();
  const { appendEvent } = useAuditLog();
  const { applications, isReady, save } = useApplications();
  const [status, setStatus] = useState<ApplicationStatus | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState("");

  const visible = useMemo(() => applications.filter((item) => (
    actor && inScope(item, actor.role, actor.organisationId) && (status === "all" || item.status === status)
  )), [actor, applications, status]);
  const selected = visible.find((item) => item.id === selectedId);

  const act = async (label: string, work: (application: Application) => Application) => {
    if (!selected || !actor || !session) return;
    try {
      const next = work(selected);
      const event = appendEvent({
        actor: createAuditActorSnapshot(session),
        action: "application.update",
        resource: { type: "application", id: selected.id, label: selected.offeringTitle, organisationId: session.organisation.id },
        before: { status: selected.status },
        after: { status: next.status },
        reason: label,
        evidenceReference: `application:${selected.id}`,
      });
      if (!event) throw new Error("บันทึก Audit Log ไม่สำเร็จ จึงยังไม่บันทึกการเปลี่ยนแปลง");
      if (!(await save(next))) throw new Error("บันทึกไม่สำเร็จ");
      setNote("");
      setAmount("");
      toast.success(label);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ดำเนินการไม่สำเร็จ");
    }
  };

  const at = () => new Date().toISOString();
  const can = (action: Parameters<typeof canActOn>[2]) => Boolean(selected && actor && canActOn(actor, selected, action));

  return (
    <PageShell size="wide" bottom="roomy" className="space-y-5">
      <WorkspaceHeader eyebrow="Form Engine · ใบสมัคร" title={title} description={description} />
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="application-status-filter" className="text-sm">สถานะ</label>
        <select id="application-status-filter" className="h-10 rounded-xl border border-input bg-background px-3 text-sm" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>
          <option value="all">ทั้งหมด</option>
          {filterStatuses.map((item) => <option key={item} value={item}>{applicationStatusMeta[item].label}</option>)}
        </select>
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <section aria-label="รายการใบสมัคร" className="rounded-2xl border border-border bg-card">
          {!isReady ? <p role="status" className="p-5 text-sm text-muted-foreground">กำลังโหลด…</p> : visible.length === 0 ? (
            <div className="p-5"><EmptyState title="ยังไม่มีใบสมัคร" description="ใบสมัครที่ส่งแล้วในขอบเขตของคุณจะแสดงที่นี่" /></div>
          ) : (
            <ul className="divide-y divide-border">
              {visible.map((item) => (
                <li key={item.id}>
                  <button type="button" aria-pressed={item.id === selectedId} onClick={() => { setSelectedId(item.id); setNote(""); setAmount(""); }} className="flex w-full flex-col gap-1 p-4 text-left hover:bg-surface-container-low aria-pressed:bg-brand-soft/40">
                    <span className="font-mono text-xs text-primary">{item.id}</span>
                    <span className="font-medium">{item.applicantName}</span>
                    <span className="text-xs text-muted-foreground">{applicationKindLabel[item.kind]} · {item.offeringTitle}</span>
                    <span><ApplicationStatusBadge status={item.status} /></span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {selected ? (
          <section aria-label="รายละเอียดใบสมัคร" className="space-y-5 rounded-2xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-xs text-primary">{selected.id}</p>
                <h2 className="text-lg font-semibold">{selected.applicantName} · {selected.licenseNumber}</h2>
                <p className="text-sm text-muted-foreground">{selected.offeringTitle}{selected.institutionName ? ` · ${selected.institutionName}` : ""}</p>
              </div>
              <Button asChild variant="outline" size="sm"><Link href={`/print/application/${selected.id}`}>พิมพ์ใบสมัคร</Link></Button>
            </div>
            <ApplicationTimeline application={selected} />

            <details className="rounded-xl border border-border p-4">
              <summary className="cursor-pointer text-sm font-medium">ข้อมูลในใบสมัคร (snapshot ณ วันยื่น)</summary>
              {templateForApplication(selected).steps.map((step) => (
                <div key={step.id} className="mt-3">
                  <p className="text-sm font-semibold">{step.title}</p>
                  <dl className="mt-1 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
                    {step.fields.filter((field) => field.type !== "file" && isVisible(field, selected.answers, selected.context)).map((field) => (
                      <div key={field.id}><dt className="text-xs text-muted-foreground">{field.label}</dt><dd>{displayValue(field, selected.answers[field.id])}</dd></div>
                    ))}
                  </dl>
                </div>
              ))}
            </details>

            <div>
              <p className="mb-2 text-sm font-semibold">ตรวจเอกสาร</p>
              <DocumentChecklist application={selected}>
                {(documentId) => can("review_document") ? (
                  <span className="flex flex-wrap gap-1">
                    <Button size="sm" variant="outline" onClick={() => void act("ตรวจเอกสาร: ผ่าน", (app) => reviewDocument(app, documentId, "approved", actor!, at()))}>ผ่าน</Button>
                    <Button size="sm" variant="outline" onClick={() => void act("ตรวจเอกสาร: ขอแก้ไข", (app) => reviewDocument(app, documentId, "needs_revision", actor!, at(), note))}>ขอแก้ไข</Button>
                    <Button size="sm" variant="outline" onClick={() => void act("ตรวจเอกสาร: ไม่ผ่าน", (app) => reviewDocument(app, documentId, "rejected", actor!, at(), note))}>ไม่ผ่าน</Button>
                  </span>
                ) : null}
              </DocumentChecklist>
            </div>

            <div className="space-y-3 rounded-xl border border-border p-4">
              <p className="text-sm font-semibold">ดำเนินการ</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="review-note" className="text-xs font-medium">หมายเหตุ / เหตุผล / เลขที่หนังสืออนุมัติ</label>
                  <Input id="review-note" value={note} onChange={(event) => setNote(event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="review-amount" className="text-xs font-medium">ยอดค่าธรรมเนียม (บาท)</label>
                  <Input id="review-amount" type="number" min={0} value={amount} onChange={(event) => setAmount(event.target.value)} />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {can("set_fee") && <Button size="sm" variant="outline" disabled={amount === ""} onClick={() => void act(actionLabel.set_fee, (app) => setFee(app, app.status === "passed" ? "tuition" : "application", Number(amount), actor!, at()))}>{selected.status === "passed" ? "กำหนดค่าลงทะเบียนเรียน" : "กำหนดค่าสมัคร"}</Button>}
                {can("request_revision") && <Button size="sm" variant="outline" onClick={() => void act(actionLabel.request_revision, (app) => requestRevision(app, actor!, at(), note))}>{actionLabel.request_revision}</Button>}
                {can("approve_eligibility") && <Button size="sm" onClick={() => void act(actionLabel.approve_eligibility, (app) => approveEligibility(app, actor!, at()))}>{actionLabel.approve_eligibility}</Button>}
                {can("reject") && <Button size="sm" variant="outline" onClick={() => void act(actionLabel.reject, (app) => reject(app, actor!, at(), note))}>{actionLabel.reject}</Button>}
                {can("record_result") && <Button size="sm" onClick={() => void act("บันทึกผล: ผ่าน", (app) => recordResult(app, "passed", actor!, at(), note || undefined))}>บันทึกผล: ผ่าน</Button>}
                {can("record_result") && <Button size="sm" variant="outline" onClick={() => void act("บันทึกผล: ไม่ผ่าน", (app) => recordResult(app, "failed", actor!, at(), note || undefined))}>บันทึกผล: ไม่ผ่าน</Button>}
                {can("issue_approval") && <Button size="sm" onClick={() => void act(actionLabel.issue_approval, (app) => issueApproval(app, note, actor!, at()))}>{actionLabel.issue_approval}</Button>}
                {can("complete") && <Button size="sm" onClick={() => void act(actionLabel.complete, (app) => complete(app, actor!, at(), note || undefined))}>{actionLabel.complete}</Button>}
              </div>
              {actor?.role === "college_staff" ? <p className="text-xs text-muted-foreground">เจ้าหน้าที่วิทยาลัยดูได้อย่างเดียว</p> : null}
            </div>

            <div><p className="mb-2 text-sm font-semibold">ประวัติการแก้ไขและการดำเนินการ</p><ApplicationHistory application={selected} /></div>
          </section>
        ) : (
          <section className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">เลือกใบสมัครจากรายการเพื่อตรวจ</section>
        )}
      </div>
    </PageShell>
  );
}
