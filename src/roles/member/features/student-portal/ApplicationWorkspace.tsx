"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { paymentAdapter, type PaymentMethod } from "@/data/payments/adapter";
import { templateForApplication } from "@/domain/applications/catalog";
import { applicationKindLabel, paymentPurposeLabel, type Application } from "@/domain/applications/model";
import {
  amountDue,
  canActOn,
  cancel,
  enroll,
  recordPayment,
  resubmit,
  saveDraft,
  submitApplication,
} from "@/domain/applications/workflow";
import { validateStep } from "@/domain/forms/evaluate";
import { applyAnswerChange, lockedFieldIds } from "@/domain/forms/prefill";
import type { FieldValue, FormAnswers, FormError } from "@/domain/forms/schema";
import { effectiveMembershipStatus, registerExtraordinary, renewExtraordinary } from "@/roles/shared/features/membership/model";
import { ApplicationHistory, ApplicationStatusBadge, ApplicationTimeline, DocumentChecklist } from "@/roles/shared/forms/ApplicationParts";
import { FormRenderer } from "@/roles/shared/forms/FormRenderer";
import { useApplicationActor, useApplications, useMembership } from "@/roles/shared/forms/use-applications";
import { Icon, NavButton, Panel, SectionTitle, StudentHeader, StudentPage } from "./StudentUI";

export default function ApplicationWorkspace({ id }: { id: string }) {
  const actor = useApplicationActor();
  const { applications, isReady, save } = useApplications();
  const application = applications.find((item) => item.id === id);
  if (!isReady || !actor) return <StudentPage><Panel><p role="status" className="text-sm text-muted-foreground">กำลังโหลดใบสมัคร…</p></Panel></StudentPage>;
  if (!application || application.applicantId !== actor.userId) {
    return <StudentPage><Panel><p className="text-sm">ไม่พบใบสมัครนี้ หรือไม่ใช่ใบสมัครของคุณ</p><div className="mt-4"><NavButton href="/member/applications" outline>ใบสมัครของฉัน</NavButton></div></Panel></StudentPage>;
  }
  return <Workspace key={`${application.id}-${application.updatedAt}`} application={application} save={save} actor={actor} />;
}

function Workspace({ application, save, actor }: {
  application: Application;
  save: (application: Application) => Promise<boolean>;
  actor: NonNullable<ReturnType<typeof useApplicationActor>>;
}) {
  const template = useMemo(() => templateForApplication(application), [application]);
  const locked = useMemo(() => lockedFieldIds(template), [template]);
  const membership = useMembership(actor.userId);
  const editing = application.status === "draft" || application.status === "needs_revision";
  const steps = application.status === "needs_revision" ? template.steps.filter((step) => step.fields.some((field) => field.type === "file")) : template.steps;
  // ใบสมัครที่สร้างก่อนมีช่อง "สาขาวิชา" ใช้ชื่อหลักสูตรของใบสมัครแทน
  const [answers, setAnswers] = useState<FormAnswers>(() => (
    application.kind === "approval_exam" && !application.answers.program ? { ...application.answers, program: application.offeringTitle } : application.answers
  ));
  const [stepIndex, setStepIndex] = useState(0);
  const [errors, setErrors] = useState<FormError[]>([]);
  const [method, setMethod] = useState<PaymentMethod>("promptpay");
  const [busy, setBusy] = useState(false);
  const step = steps[Math.min(stepIndex, steps.length - 1)];
  const due = amountDue(application);
  const canPay = canActOn(actor, application, "pay");

  const persist = async (next: Application, message: string) => {
    if (await save(next)) toast.success(message);
    else toast.error("บันทึกไม่สำเร็จ");
  };

  const run = async (work: () => Promise<void> | void) => {
    setBusy(true);
    try {
      await work();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ดำเนินการไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const change = (fieldId: string, value: FieldValue) => {
    setAnswers((current) => applyAnswerChange(template, current, fieldId, value));
    setErrors([]);
  };

  const goNext = () => {
    const stepErrors = validateStep(template, step.id, answers, application.context);
    setErrors(stepErrors);
    if (stepErrors.length === 0) setStepIndex((current) => Math.min(current + 1, steps.length - 1));
  };

  const saveAsDraft = () => run(() => persist(saveDraft(application, template, answers, actor, new Date().toISOString()), "บันทึกร่างแล้ว กลับมากรอกต่อได้ภายหลัง"));

  const submit = () => run(async () => {
    const at = new Date().toISOString();
    if (application.status === "needs_revision") {
      await persist(resubmit(application, template, answers, actor, at), "ส่งเอกสารแก้ไขแล้ว");
      return;
    }
    const drafted = saveDraft(application, template, answers, actor, at);
    // ที่นั่งนับเฉพาะเมื่อรอบกำหนดจำนวนไว้ (ดู ApplyWizard) — ตรวจซ้ำตอนส่งไม่ได้เพราะยังไม่มีจำนวนที่นั่งจริง
    await persist(submitApplication(drafted, template, actor, at), "ส่งใบสมัครแล้ว");
  });

  const pay = () => run(async () => {
    if (!due || due.amount === undefined) return;
    const reference = `${application.id}-${due.purpose}`.toUpperCase();
    const result = await paymentAdapter.charge({ reference, amount: due.amount, description: paymentPurposeLabel[due.purpose], method });
    const at = result.processedAt;
    if (due.purpose === "membership" && result.status === "paid" && membership.record) {
      const input = { paidAt: at, paymentReference: reference, actor: { userId: actor.userId, userName: actor.userName, role: actor.role } };
      const status = effectiveMembershipStatus(membership.record, at);
      await membership.save(status === "lapsed" ? renewExtraordinary(membership.record, input) : registerExtraordinary(membership.record, input));
    }
    // TODO(business): การเลื่อนเป็นสมาชิกสามัญต้องให้เจ้าหน้าที่ตรวจหลักฐานหนังสืออนุมัติก่อน — ตอนนี้บันทึกเฉพาะการชำระของคำขอ
    await persist(recordPayment(application, { ...result, reference, amount: due.amount }, actor, { hasActiveMembership: membership.isActive }), result.status === "paid" ? "ชำระเงินสำเร็จ (ระบบจำลอง)" : "การชำระเงินไม่สำเร็จ");
  });

  return (
    <StudentPage>
      <StudentHeader
        eyebrow={applicationKindLabel[application.kind]}
        title={application.offeringTitle}
        description={[application.institutionName, application.roundLabel, `เลขที่ใบสมัคร ${application.id}`].filter(Boolean).join(" · ")}
        action={<div className="flex flex-wrap gap-2" data-student-no-print>
          <NavButton href="/member/applications" outline><Icon name="list" className="text-base" /> ใบสมัครของฉัน</NavButton>
          <NavButton href={`/print/application/${application.id}`} outline><Icon name="print" className="text-base" /> พิมพ์ / PDF</NavButton>
        </div>}
      />
      <Panel>
        <div className="mb-4 flex flex-wrap items-center gap-3"><ApplicationStatusBadge status={application.status} /></div>
        <ApplicationTimeline application={application} />
        {application.examResult ? <p className="mt-4 text-sm">ผลสอบ: <strong>{application.examResult.decision === "passed" ? "ผ่าน" : "ไม่ผ่าน"}</strong>{application.examResult.note ? ` · ${application.examResult.note}` : ""}</p> : null}
        {application.approvalLetterNo ? <p className="mt-2 text-sm">หนังสืออนุมัติเลขที่ <strong>{application.approvalLetterNo}</strong></p> : null}
      </Panel>

      {editing && step && (
        <Panel>
          <nav aria-label="ขั้นตอนใบสมัคร" className="mb-5 overflow-x-auto">
            <ol className="flex min-w-max gap-2">
              {steps.map((item, index) => (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-current={index === stepIndex ? "step" : undefined}
                    onClick={() => { setErrors([]); setStepIndex(index); }}
                    className={cn("rounded-full border px-3 py-1.5 text-xs font-medium", index === stepIndex ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:bg-surface-container-low")}
                  >
                    {index + 1}. {item.title}
                  </button>
                </li>
              ))}
            </ol>
          </nav>
          <SectionTitle icon="edit_document" title={step.title} subtitle={application.status === "needs_revision" ? "แนบไฟล์ใหม่แทนเอกสารที่เจ้าหน้าที่ขอให้แก้ไข" : undefined} />
          <FormRenderer step={step} answers={answers} context={application.context} locked={locked} errors={errors} onChange={change} />
          {errors.length > 0 && (
            <div role="alert" className="mt-4 rounded-xl border border-danger-border bg-danger-soft p-4 text-sm text-danger-on-soft">
              <p className="font-semibold">กรุณาแก้ไขก่อนไปขั้นถัดไป</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">{errors.map((error) => <li key={`${error.fieldId}-${error.message}`}>{error.message}</li>)}</ul>
            </div>
          )}
          <div className="mt-6 flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-between">
            <Button variant="outline" className="h-11" disabled={stepIndex === 0 || busy} onClick={() => { setErrors([]); setStepIndex((current) => current - 1); }}>ย้อนกลับ</Button>
            <div className="flex flex-col gap-3 sm:flex-row">
              {application.status === "draft" && <Button variant="outline" className="h-11" disabled={busy} onClick={() => void saveAsDraft()}>บันทึกร่าง</Button>}
              {stepIndex < steps.length - 1
                ? <Button className="h-11" disabled={busy} onClick={goNext}>ถัดไป</Button>
                : <Button className="h-11" disabled={busy} onClick={() => void submit()}>{application.status === "needs_revision" ? "ส่งเอกสารแก้ไข" : "ส่งใบสมัคร"}</Button>}
            </div>
          </div>
        </Panel>
      )}

      {canPay && due && (
        <Panel>
          <SectionTitle icon="payments" title={paymentPurposeLabel[due.purpose]} subtitle="ระบบชำระเงินจำลอง (Mock Payment Adapter) — ไม่มีการตัดเงินจริง" />
          {due.amount === undefined ? (
            <p className="rounded-xl border border-warning-border bg-warning-soft p-4 text-sm text-warning-on-soft">ยังไม่มีอัตราค่าธรรมเนียมของรายการนี้ในประกาศ เจ้าหน้าที่จะกำหนดยอดก่อนเปิดให้ชำระ</p>
          ) : (
            <div className="space-y-4">
              <p className="text-3xl font-semibold tabular-nums">{due.amount.toLocaleString("th-TH")} <span className="text-base font-normal">บาท</span></p>
              <fieldset className="flex flex-wrap gap-3">
                <legend className="sr-only">ช่องทางชำระเงิน</legend>
                {(["promptpay", "credit_card"] as const).map((item) => (
                  <label key={item} className={cn("flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-4 text-sm", method === item ? "border-primary bg-brand-soft/40" : "border-border")}>
                    <input type="radio" name="payment-method" className="accent-primary" checked={method === item} onChange={() => setMethod(item)} />
                    {item === "promptpay" ? "พร้อมเพย์" : "บัตรเครดิต"}
                  </label>
                ))}
              </fieldset>
              <Button className="h-11" disabled={busy} onClick={() => void pay()}>ชำระเงิน (จำลอง)</Button>
            </div>
          )}
        </Panel>
      )}

      {canActOn(actor, application, "enroll") && (
        <Panel>
          <SectionTitle icon="how_to_reg" title="สอบผ่านแล้ว — ลงทะเบียนเรียน" subtitle="ลงทะเบียนแล้วชำระค่าเรียน จากนั้นขึ้นทะเบียนสมาชิกวิสามัญ (ถ้ายังไม่เป็นสมาชิก)" />
          <Button className="h-11" disabled={busy} onClick={() => void run(() => persist(enroll(application, actor, new Date().toISOString()), "ลงทะเบียนเรียนแล้ว"))}>ลงทะเบียนเข้าเรียน</Button>
        </Panel>
      )}

      {application.membershipUpgradeRequest?.status === "paid" ? (
        <Panel><p className="text-sm">ชำระค่าเลื่อนเป็นสมาชิกสามัญแล้ว รอเจ้าหน้าที่ปรับสถานะสมาชิก</p></Panel>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel><SectionTitle icon="checklist" title="เอกสารประกอบการสมัคร" /><DocumentChecklist application={application} /></Panel>
        <Panel><SectionTitle icon="history" title="ประวัติการดำเนินการ" /><ApplicationHistory application={application} /></Panel>
      </div>

      {canActOn(actor, application, "cancel") && (
        <div className="text-right" data-student-no-print>
          <Button variant="ghost" className="text-danger" disabled={busy} onClick={() => void run(() => persist(cancel(application, actor, new Date().toISOString()), "ยกเลิกใบสมัครแล้ว"))}>ยกเลิกใบสมัคร</Button>
        </div>
      )}
      <p className="text-center text-xs text-muted-foreground"><Link href="/member/admission" className="underline">ดูใบสมัครที่ยื่นด้วยระบบเดิม</Link></p>
    </StudentPage>
  );
}
