"use client";

import { OrganizationLogo } from "@/roles/shared/components/brand/OrganizationLogo";
import { PrintProvenance } from "@/roles/shared/components/print/PrintProvenance";
import { templateForApplication } from "@/domain/applications/catalog";
import { applicationKindLabel, applicationStatusMeta, documentReviewMeta } from "@/domain/applications/model";
import { isSignatureValue, isVisible } from "@/domain/forms/evaluate";
import type { FieldDef, FieldValue } from "@/domain/forms/schema";
import { displayValue } from "./FormRenderer";
import { useApplicationActor, useApplications } from "./use-applications";

function RepeaterTable({ field, value }: { field: Extract<FieldDef, { type: "repeater" }>; value: FieldValue }) {
  const rows = Array.isArray(value) ? value as Record<string, unknown>[] : [];
  return (
    <table className="mt-1 w-full border-collapse text-[12px]">
      <thead>
        <tr>{field.fields.map((child) => <th key={child.id} className="border border-print-border px-2 py-1 text-left font-semibold">{child.label}</th>)}</tr>
      </thead>
      <tbody>
        {rows.length === 0 ? <tr><td colSpan={field.fields.length} className="border border-print-border px-2 py-1">—</td></tr> : rows.map((row, index) => (
          <tr key={index}>{field.fields.map((child) => <td key={child.id} className="border border-print-border px-2 py-1">{displayValue(child, row[child.id] as FieldValue)}</td>)}</tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * หน้าพิมพ์ใบสมัครที่สร้างจาก schema ของฟอร์ม (A4) — ใช้ "พิมพ์ / บันทึกเป็น PDF" ของเบราว์เซอร์
 */
// shortcut: Export PDF ผ่านการพิมพ์ของเบราว์เซอร์ — เพิ่ม library สร้าง PDF ฝั่งเซิร์ฟเวอร์เมื่อต้องส่งไฟล์อัตโนมัติ
export function ApplicationPrintPage({ id }: { id: string }) {
  const actor = useApplicationActor();
  const { applications, isReady } = useApplications();
  const application = applications.find((item) => item.id === id);
  if (!isReady) return <p role="status" className="p-10 text-center text-sm">กำลังโหลด…</p>;
  // ผู้สมัครเห็นเฉพาะใบของตน; บุคลากรที่ล็อกอินแล้วเปิดดูเพื่อพิมพ์ได้ (ขอบเขตละเอียดตรวจในหน้าตรวจใบสมัคร)
  if (!application || !actor || (actor.role === "student" && application.applicantId !== actor.userId)) {
    return <p className="p-10 text-center text-sm">ไม่พบใบสมัคร หรือไม่มีสิทธิ์เปิดดู</p>;
  }
  const template = templateForApplication(application);
  const signature = application.answers.declaration;

  return (
    <div className="portal-print-root flex min-h-screen flex-col items-center gap-4 bg-print-canvas py-10 print:bg-print-paper print:py-0">
      <button type="button" onClick={() => window.print()} className="rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground print:hidden">พิมพ์ / บันทึกเป็น PDF</button>
      <article className="relative min-h-[297mm] w-[210mm] bg-print-paper px-[18mm] pb-[30mm] pt-[18mm] text-[13px] leading-relaxed text-print-ink shadow-lg print:shadow-none">
        <header className="relative mb-6 border-b-2 border-print-ink pb-5 text-center">
          <OrganizationLogo variant="full" className="absolute left-0 top-0 h-[26mm] w-[20mm] object-contain" />
          <div className="absolute right-0 top-0 flex h-[36mm] w-[27mm] items-center justify-center border border-print-border text-[10px] text-print-subtle">
            {application.documents.find((document) => document.documentId === "photo")?.file ? "แนบรูปถ่ายแล้ว" : "รูปถ่าย 1 × 1.5 นิ้ว"}
          </div>
          {template.paperTitle.map((line, index) => <p key={line} className={index === 0 ? "text-lg font-bold" : "font-semibold text-print-label"}>{line}</p>)}
          <p className="mt-2 text-[11px] text-print-subtle">เลขที่ใบสมัคร {application.id} · {applicationKindLabel[application.kind]} · สถานะ {applicationStatusMeta[application.status].label}</p>
        </header>

        <section className="mb-4">
          <p className="font-semibold">หลักสูตรที่สมัคร</p>
          <p>{application.offeringTitle}{application.institutionName ? ` · สถาบันฝึกอบรม ${application.institutionName}` : ""}{application.roundLabel ? ` · ${application.roundLabel}` : ""}</p>
        </section>

        {template.steps.map((step, index) => (
          <section key={step.id} className="mb-4 break-inside-avoid">
            <p className="mb-1 font-semibold">{index + 1}. {step.title}</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1">
              {step.fields.filter((field) => isVisible(field, application.answers, application.context) && field.type !== "file" && field.type !== "signature").map((field) => (
                <div key={field.id} className={field.type === "repeater" || field.wide ? "col-span-2" : undefined}>
                  <span className="text-print-label">{field.label}: </span>
                  {field.type === "repeater" ? <RepeaterTable field={field} value={application.answers[field.id]} /> : <span className="border-b border-dotted border-print-border">{displayValue(field, application.answers[field.id])}</span>}
                </div>
              ))}
            </div>
          </section>
        ))}

        <section className="mb-4 break-inside-avoid">
          <p className="mb-1 font-semibold">รายการเอกสารหลักฐานแนบประกอบการสมัคร</p>
          <table className="w-full border-collapse text-[12px]">
            <thead><tr><th className="border border-print-border px-2 py-1">ลำดับ</th><th className="border border-print-border px-2 py-1 text-left">รายการเอกสาร</th><th className="border border-print-border px-2 py-1">ตรวจสอบ</th></tr></thead>
            <tbody>
              {application.documents.map((document, index) => (
                <tr key={document.documentId}>
                  <td className="border border-print-border px-2 py-1 text-center">{index + 1}</td>
                  <td className="border border-print-border px-2 py-1">{document.label}{document.file ? ` (แนบ: ${document.file.name})` : ""}</td>
                  <td className="border border-print-border px-2 py-1 text-center">{documentReviewMeta[document.status].label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="break-inside-avoid">
          {template.steps.flatMap((step) => step.fields).filter((field) => field.type === "signature").map((field) => (
            <p key={field.id} className="indent-8">{field.type === "signature" ? field.statement : null}</p>
          ))}
          <div className="mt-10 text-right">
            <p>(ลงชื่อ) {isSignatureValue(signature) && signature.accepted ? signature.signedName : "........................................"} ผู้สมัคร</p>
            <p>วันที่ {isSignatureValue(signature) && signature.accepted ? new Date(signature.signedAt).toLocaleDateString("th-TH", { dateStyle: "long" }) : "...... / ...... / ......"}</p>
            <p className="text-[11px] text-print-subtle">ลงลายมือชื่ออิเล็กทรอนิกส์ผ่านระบบ</p>
          </div>
        </section>
        <PrintProvenance documentTitle={template.title} />
      </article>
    </div>
  );
}
