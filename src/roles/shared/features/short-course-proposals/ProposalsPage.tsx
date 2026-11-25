"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { PageShell } from "@/roles/shared/components/layout/PageShell";
import { EmptyState, WorkspaceHeader } from "@/roles/shared/components/workspace/WorkspacePrimitives";
import { COLLEGE_OPTIONS, type CollegeCode } from "@/roles/shared/data/college-directory";
import { validateForm, validateStep } from "@/domain/forms/evaluate";
import type { FieldValue, FormAnswers, FormError } from "@/domain/forms/schema";
import { answersToProposalDetails, courseProposalTemplate, proposalDetailsToAnswers } from "@/domain/forms/templates";
import { createAuditActorSnapshot, useAuditLog } from "@/roles/shared/features/audit";
import { usePortalSession } from "@/roles/shared/features/roles/use-portal-session";
import { displayValue, FormRenderer } from "@/roles/shared/forms/FormRenderer";
import {
  canCreateProposal,
  canPerformProposalAction,
  createProposal,
  proposalStatusMeta,
  setProposalRoundStatus,
  transitionProposal,
  updateProposalDetails,
  type ProposalActor,
  type ShortCourseProposal,
} from "./model";
import { useShortCourseProposals } from "./store";

const template = courseProposalTemplate(COLLEGE_OPTIONS.map((college) => ({ value: college.value, label: college.label })));
const noLocks: ReadonlySet<string> = new Set();

/**
 * คำขอเปิดหลักสูตรระยะสั้น: Institution Admin / เจ้าหน้าที่ราชวิทยาลัยกรอกด้วย Form Engine
 * เจ้าหน้าที่ราชวิทยาลัยพิจารณา อนุมัติ (กำหนด Credit Bank) เปิดรอบ และเผยแพร่
 */
export function ShortCourseProposalsPage({ mode }: { mode: "institution" | "staff" }) {
  const { session } = usePortalSession();
  const { appendEvent } = useAuditLog();
  const { proposals, isReady, save } = useShortCourseProposals();
  const actor: ProposalActor | null = useMemo(() => (session ? { userId: session.userId, userName: session.displayName, role: session.role, organisationId: session.organisation.id } : null), [session]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<FormAnswers>({});
  const [stepIndex, setStepIndex] = useState(0);
  const [errors, setErrors] = useState<FormError[]>([]);
  const [note, setNote] = useState("");
  const [creditBank, setCreditBank] = useState<boolean | undefined>(undefined);

  const visible = proposals.filter((proposal) => actor && (
    proposal.ownerOrganisationId === actor.organisationId || (mode === "staff" && actor.role === "royal_college_staff" && proposal.status !== "draft")
  ));
  const selected = visible.find((proposal) => proposal.id === selectedId);
  const editable = Boolean(selected && actor && canPerformProposalAction(actor, selected, "edit"));
  const step = template.steps[stepIndex];

  const open = (proposal: ShortCourseProposal) => {
    setSelectedId(proposal.id);
    setAnswers(proposalDetailsToAnswers(proposal.details));
    setStepIndex(0);
    setErrors([]);
    setNote("");
    setCreditBank(undefined);
  };

  const commit = (next: ShortCourseProposal, label: string) => {
    if (!session) return;
    const event = appendEvent({
      actor: createAuditActorSnapshot(session),
      action: "short_course_proposal.update",
      resource: { type: "short_course_proposal", id: next.id, label: next.details.titleTh || next.id, organisationId: session.organisation.id },
      before: selected ? { status: selected.status } : null,
      after: { status: next.status },
      reason: label,
      evidenceReference: `proposal:${next.id}`,
    });
    if (!event || !save(next)) {
      toast.error("บันทึกไม่สำเร็จ");
      return;
    }
    toast.success(label);
    open(next);
  };

  const run = (label: string, work: () => ShortCourseProposal) => {
    try {
      commit(work(), label);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ดำเนินการไม่สำเร็จ");
    }
  };

  const create = () => {
    if (!actor) return;
    run("สร้างคำขอเปิดหลักสูตรแล้ว", () => createProposal({ id: `SCP-${Date.now().toString(36).toUpperCase()}`, actor, collegeCode: "วภท.", at: new Date().toISOString() }));
  };

  const details = () => answersToProposalDetails(answers, (answers.collegeCode as CollegeCode | undefined) ?? "วภท.");
  const at = () => new Date().toISOString();

  return (
    <PageShell size="wide" bottom="roomy" className="space-y-5">
      <WorkspaceHeader
        eyebrow="ฟอร์มเสนอหลักสูตร"
        title={mode === "staff" ? "คำขอเปิดหลักสูตรระยะสั้น" : "เสนอหลักสูตรระยะสั้น"}
        description="กรอกตามแม่แบบประกาศนียบัตรวิชาชีพเภสัชกรรม: draft → submitted → under_review → revision_requested → approved → published → closed เปิดรอบรับสมัครได้หลังอนุมัติเท่านั้น"
      />
      {actor && canCreateProposal(actor) ? <div><Button onClick={create}>สร้างคำขอใหม่</Button></div> : null}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <section aria-label="รายการคำขอ" className="rounded-2xl border border-border bg-card">
          {!isReady ? <p role="status" className="p-5 text-sm">กำลังโหลด…</p> : visible.length === 0 ? (
            <div className="p-5"><EmptyState title="ยังไม่มีคำขอ" description="กดสร้างคำขอใหม่เพื่อเริ่มกรอกแบบเสนอหลักสูตร" /></div>
          ) : (
            <ul className="divide-y divide-border">
              {visible.map((proposal) => (
                <li key={proposal.id}>
                  <button type="button" aria-pressed={proposal.id === selectedId} onClick={() => open(proposal)} className="flex w-full flex-col gap-1 p-4 text-left hover:bg-surface-container-low aria-pressed:bg-brand-soft/40">
                    <span className="font-mono text-xs text-primary">{proposal.id}</span>
                    <span className="font-medium">{proposal.details.titleTh || "(ยังไม่ตั้งชื่อหลักสูตร)"}</span>
                    <Badge variant={proposalStatusMeta[proposal.status].variant}>{proposalStatusMeta[proposal.status].label}</Badge>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {selected && actor ? (
          <section aria-label="รายละเอียดคำขอ" className="space-y-5 rounded-2xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={proposalStatusMeta[selected.status].variant}>{proposalStatusMeta[selected.status].label}</Badge>
              {selected.reviewNote ? <span className="text-sm text-warning-on-soft">หมายเหตุผู้พิจารณา: {selected.reviewNote}</span> : null}
              {selected.creditBankEligible !== undefined ? <Badge variant={selected.creditBankEligible ? "brand" : "neutral"}>{selected.creditBankEligible ? "สะสม Credit Bank ได้" : "ไม่สะสม Credit Bank"}</Badge> : null}
            </div>

            {editable ? (
              <>
                <ol className="flex flex-wrap gap-2">
                  {template.steps.map((item, index) => (
                    <li key={item.id}>
                      <button type="button" aria-current={index === stepIndex ? "step" : undefined} onClick={() => { setErrors([]); setStepIndex(index); }} className={cn("rounded-full border px-3 py-1.5 text-xs font-medium", index === stepIndex ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground")}>
                        {index + 1}. {item.title}
                      </button>
                    </li>
                  ))}
                </ol>
                <FormRenderer step={step} answers={answers} context={{ collegeCode: String(answers.collegeCode ?? "") }} locked={noLocks} errors={errors} onChange={(fieldId: string, value: FieldValue) => { setAnswers((current) => ({ ...current, [fieldId]: value })); setErrors([]); }} />
                {errors.length > 0 && (
                  <div role="alert" className="rounded-xl border border-danger-border bg-danger-soft p-4 text-sm text-danger-on-soft">
                    <ul className="list-disc space-y-1 pl-5">{errors.map((error) => <li key={`${error.fieldId}-${error.message}`}>{error.message}</li>)}</ul>
                  </div>
                )}
                <div className="flex flex-wrap justify-between gap-2 border-t border-border pt-4">
                  <Button variant="outline" disabled={stepIndex === 0} onClick={() => setStepIndex((current) => current - 1)}>ย้อนกลับ</Button>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => run("บันทึกร่างแล้ว", () => updateProposalDetails(selected, details(), actor, at()))}>บันทึกร่าง</Button>
                    {stepIndex < template.steps.length - 1 ? (
                      <Button onClick={() => {
                        const stepErrors = validateStep(template, step.id, answers, {});
                        setErrors(stepErrors);
                        if (stepErrors.length === 0) setStepIndex((current) => current + 1);
                      }}>ถัดไป</Button>
                    ) : (
                      <Button onClick={() => {
                        const formErrors = validateForm(template, answers, { collegeCode: String(answers.collegeCode ?? "") });
                        setErrors(formErrors);
                        if (formErrors.length === 0) run("ส่งคำขอเปิดหลักสูตรแล้ว", () => transitionProposal(updateProposalDetails(selected, details(), actor, at()), "submit", { actor, at: at() }));
                      }}>ส่งคำขอ</Button>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <details open className="rounded-xl border border-border p-4">
                <summary className="cursor-pointer text-sm font-medium">รายละเอียดคำขอ</summary>
                {template.steps.map((item) => (
                  <div key={item.id} className="mt-3">
                    <p className="text-sm font-semibold">{item.title}</p>
                    <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
                      {item.fields.map((field) => <div key={field.id}><dt className="text-xs text-muted-foreground">{field.label}</dt><dd>{displayValue(field, answers[field.id])}</dd></div>)}
                    </dl>
                  </div>
                ))}
              </details>
            )}

            {mode === "staff" && actor.role === "royal_college_staff" && (
              <div className="space-y-3 rounded-xl border border-border p-4">
                <p className="text-sm font-semibold">การพิจารณา</p>
                <div className="space-y-1.5">
                  <label htmlFor="proposal-note" className="text-xs font-medium">หมายเหตุ / เหตุผล</label>
                  <Input id="proposal-note" value={note} onChange={(event) => setNote(event.target.value)} />
                </div>
                {canPerformProposalAction(actor, selected, "approve") && (
                  <fieldset className="flex flex-wrap gap-3 text-sm">
                    <legend className="mb-1 text-xs font-medium">หลักสูตรนี้สะสมหน่วยกิต Credit Bank ได้หรือไม่</legend>
                    {[true, false].map((value) => (
                      <label key={String(value)} className="flex min-h-11 items-center gap-2"><input type="radio" name="credit-bank" checked={creditBank === value} onChange={() => setCreditBank(value)} />{value ? "ได้" : "ไม่ได้"}</label>
                    ))}
                  </fieldset>
                )}
                <div className="flex flex-wrap gap-2">
                  {canPerformProposalAction(actor, selected, "start_review") && <Button size="sm" onClick={() => run("เริ่มพิจารณา", () => transitionProposal(selected, "start_review", { actor, at: at() }))}>เริ่มพิจารณา</Button>}
                  {canPerformProposalAction(actor, selected, "request_revision") && <Button size="sm" variant="outline" onClick={() => run("ขอให้แก้ไข", () => transitionProposal(selected, "request_revision", { actor, at: at(), note }))}>ขอให้แก้ไข</Button>}
                  {canPerformProposalAction(actor, selected, "approve") && <Button size="sm" onClick={() => run("อนุมัติหลักสูตร", () => transitionProposal(selected, "approve", { actor, at: at(), creditBankEligible: creditBank }))}>อนุมัติ</Button>}
                  {canPerformProposalAction(actor, selected, "reject") && <Button size="sm" variant="outline" onClick={() => run("ไม่อนุมัติ", () => transitionProposal(selected, "reject", { actor, at: at(), note }))}>ไม่อนุมัติ</Button>}
                  {canPerformProposalAction(actor, selected, "publish") && <Button size="sm" onClick={() => run("เผยแพร่และเปิดรับสมัคร", () => transitionProposal(selected, "publish", { actor, at: at() }))}>เผยแพร่</Button>}
                  {canPerformProposalAction(actor, selected, "close") && <Button size="sm" variant="outline" onClick={() => run("ปิดหลักสูตร", () => transitionProposal(selected, "close", { actor, at: at(), note }))}>ปิดหลักสูตร</Button>}
                </div>
                {(selected.status === "approved" || selected.status === "published") && (
                  <ul className="space-y-2">
                    {selected.details.rounds.map((round) => (
                      <li key={round.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-2 text-sm">
                        <span>รอบที่ {round.no}: {round.startDate} ถึง {round.endDate} · {round.status === "open" ? "เปิดรับสมัคร" : round.status === "closed" ? "ปิดรับ" : "ยังไม่เปิด"}</span>
                        {round.status !== "open"
                          ? <Button size="sm" variant="outline" onClick={() => run(`เปิดรับสมัครรอบที่ ${round.no}`, () => setProposalRoundStatus(selected, round.id, "open", { actor, at: at() }))}>เปิดรับสมัคร</Button>
                          : <Button size="sm" variant="outline" onClick={() => run(`ปิดรับสมัครรอบที่ ${round.no}`, () => setProposalRoundStatus(selected, round.id, "closed", { actor, at: at() }))}>ปิดรับสมัคร</Button>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div>
              <p className="mb-2 text-sm font-semibold">ประวัติ</p>
              <ol className="space-y-1 text-xs text-muted-foreground">
                {[...selected.history].reverse().map((entry, index) => <li key={`${entry.at}-${index}`}>{new Date(entry.at).toLocaleString("th-TH")} · {entry.actor.userName} · {entry.from ? `${proposalStatusMeta[entry.from].label} → ` : ""}{proposalStatusMeta[entry.to].label}{entry.note ? ` · ${entry.note}` : ""}</li>)}
              </ol>
            </div>
          </section>
        ) : (
          <section className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">เลือกคำขอจากรายการ</section>
        )}
      </div>
    </PageShell>
  );
}
