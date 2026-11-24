"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  getInvoiceBreakdown,
  invoiceKindLabel,
  resolveInvoiceKind,
  type RegistrationInvoice,
} from "@/roles/shared/features/finance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageShell } from "@/roles/shared/components/layout/PageShell";
import { ForbiddenState, LoadingState } from "@/roles/shared/components/workspace/WorkspacePrimitives";
import PaymentDialog, { type PromptPaySubmission } from "@/roles/member/features/finance/components/PaymentDialog";
import { useStudentPortal } from "@/roles/member/features/portal/use-student-portal";
import { formatPortalDateTime } from "@/roles/member/features/portal/ApprovalTimeline";
import {
  resolveStudentInvoiceDisplayStatus,
  type StudentInvoiceDisplayStatus,
} from "./payment-flow";

type InvoiceView = RegistrationInvoice & {
  displayStatus: StudentInvoiceDisplayStatus;
  amountDue: number;
  lateFee: number;
  paidAmount?: number;
  evidenceFileName?: string;
  referenceNo?: string;
};

const statusMeta = {
  locked: { variant: "warning", label: "รออนุมัติก่อนชำระ" },
  awaiting_payment: { variant: "warning", label: "รอชำระเงิน" },
  overdue: { variant: "danger", label: "ค้างชำระ" },
  pending_review: { variant: "info", label: "รอตรวจสอบการชำระเงิน" },
  payment_rejected: { variant: "danger", label: "หลักฐานไม่ผ่านการตรวจสอบ" },
  paid: { variant: "success", label: "ชำระแล้ว" },
  cancelled: { variant: "neutral", label: "ยกเลิก" },
} as const;

function formatDueAt(invoice: RegistrationInvoice) {
  if (invoice.status === "locked") return "เปิดหลังอนุมัติ";
  if (!invoice.dueAt) return "—";
  return formatPortalDateTime(invoice.dueAt);
}

export default function FinancePage() {
  const portal = useStudentPortal();
  const { db, actor, invoices: studentInvoices, payments } = portal;
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const currentTime = Date.now();
    const nextDueAt = studentInvoices
      .filter((invoice) => invoice.status === "awaiting_payment" && Boolean(invoice.dueAt))
      .map((invoice) => new Date(invoice.dueAt!).getTime())
      .filter((dueAt) => !Number.isNaN(dueAt) && dueAt >= currentTime)
      .sort((left, right) => left - right)[0];
    if (nextDueAt === undefined) return;
    const delay = Math.min(nextDueAt - currentTime + 1, 2_147_483_647);
    const timeoutId = window.setTimeout(() => setNowMs(Date.now()), delay);
    return () => window.clearTimeout(timeoutId);
  }, [nowMs, studentInvoices]);

  const invoices = useMemo<InvoiceView[]>(() => {
    const now = new Date(nowMs);
    return [...studentInvoices]
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
      .map((invoice) => {
        const invoicePayments = payments
          .filter((payment) => payment.invoiceId === invoice.id)
          .sort((left, right) => Date.parse(right.submittedAt ?? "") - Date.parse(left.submittedAt ?? ""));
        const latestPayment = invoicePayments[0];
        const approvedPayment = invoicePayments.find((payment) => payment.status === "approved");
        const breakdown = getInvoiceBreakdown(invoice, now);
        const displayStatus = resolveStudentInvoiceDisplayStatus(
          invoice,
          latestPayment?.status === "pending" || latestPayment?.status === "rejected" ? latestPayment.status : null,
          now,
        );
        return {
          ...invoice,
          displayStatus,
          amountDue: breakdown.total,
          lateFee: breakdown.lateFee,
          paidAmount: invoice.status === "paid" ? approvedPayment?.amount ?? invoice.baseAmount : undefined,
          evidenceFileName: latestPayment?.evidenceFileName,
          referenceNo: latestPayment?.referenceNo,
        };
      });
  }, [nowMs, payments, studentInvoices]);

  const selectedInvoice = selectedInvoiceId ? invoices.find((invoice) => invoice.id === selectedInvoiceId) ?? null : null;

  if (!portal.isReady) {
    return <PageShell className="py-10"><LoadingState label="กำลังโหลดข้อมูลการเงิน" /></PageShell>;
  }
  if (!portal.isStudent || !actor) {
    return <PageShell className="py-10"><ForbiddenState description="หน้าการเงินแสดงเฉพาะรายการของผู้เรียนที่เข้าสู่ระบบ" /></PageShell>;
  }

  const totalFees = invoices.filter((invoice) => invoice.displayStatus !== "cancelled").reduce((total, invoice) => total + invoice.baseAmount, 0);
  const outstandingBalance = invoices
    .filter((invoice) => ["awaiting_payment", "overdue", "payment_rejected"].includes(invoice.displayStatus))
    .reduce((total, invoice) => total + invoice.amountDue, 0);
  const paidTotal = invoices.reduce((total, invoice) => total + (invoice.paidAmount ?? 0), 0);
  const hasLockedInvoice = invoices.some((invoice) => invoice.displayStatus === "locked");

  const handleSubmitted = (invoiceId: string, submission: PromptPaySubmission) => {
    try {
      db.submitStudentPayment(actor, { invoiceId, ...submission });
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "รายการนี้ยังไม่พร้อมชำระเงิน");
      return false;
    }
  };

  return (
    <>
      <PageShell className="space-y-5">
        {hasLockedInvoice ? (
          <div role="note" className="flex items-start gap-3 rounded-xl border border-warning-border bg-warning-soft p-4 text-warning-on-soft">
            <span aria-hidden="true" className="material-symbols-outlined">hourglass_top</span>
            <div>
              <p className="text-sm font-semibold">มีรายการที่รออนุมัติก่อนชำระเงิน</p>
              <p className="mt-1 text-xs">ระบบจะเปิดยอดและวันครบกำหนดชำระหลังสถาบันหลักอนุมัติคำขอลงทะเบียน</p>
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card><CardContent className="flex items-center gap-4 p-5">
            <span aria-hidden="true" className="material-symbols-outlined flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-xl text-primary">account_balance_wallet</span>
            <div><h2 className="mb-0.5 text-xs font-medium text-muted-foreground">ค่าใช้จ่ายทั้งหมด</h2><div className="text-2xl font-bold tabular-nums">฿{totalFees.toLocaleString()}</div></div>
          </CardContent></Card>
          <Card className="border-danger-border"><CardContent className="flex items-center gap-4 p-5">
            <span aria-hidden="true" className="material-symbols-outlined flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-xl text-destructive">warning</span>
            <div><h2 className="mb-0.5 text-xs font-medium text-muted-foreground">ยอดรอชำระ/ค้างชำระ</h2><div className="text-2xl font-bold tabular-nums text-destructive">฿{outstandingBalance.toLocaleString()}</div></div>
          </CardContent></Card>
          <Card><CardContent className="flex items-center gap-4 p-5">
            <span aria-hidden="true" className="material-symbols-outlined flex h-10 w-10 items-center justify-center rounded-full bg-success-soft text-xl text-success-on-soft">receipt_long</span>
            <div><h2 className="mb-0.5 text-xs font-medium text-muted-foreground">ชำระแล้ว (มีใบเสร็จ)</h2><div className="text-2xl font-bold tabular-nums">฿{paidTotal.toLocaleString()}</div></div>
          </CardContent></Card>
        </div>

        <Card>
          <CardHeader className="px-5 pb-0 pt-4"><CardTitle className="text-sm">รายการชำระเงินและใบเสร็จ</CardTitle></CardHeader>
          <CardContent className="mt-3 p-0">
            <div className="overflow-x-auto">
              <Table className="min-w-[860px]">
                <TableHeader><TableRow>
                  <TableHead className="h-9 text-xs">รายการ</TableHead>
                  <TableHead className="h-9 text-xs">ประเภท</TableHead>
                  <TableHead className="h-9 text-xs">ผู้รับชำระ</TableHead>
                  <TableHead className="h-9 text-xs">ยอดชำระ</TableHead>
                  <TableHead className="h-9 text-xs">กำหนด / วันที่ชำระ</TableHead>
                  <TableHead className="h-9 text-xs">สถานะ</TableHead>
                  <TableHead className="h-9 text-xs">หลักฐาน / ใบเสร็จ</TableHead>
                  <TableHead className="h-9 text-xs">การดำเนินการ</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {invoices.map((invoice) => {
                    const status = statusMeta[invoice.displayStatus];
                    const payable = ["awaiting_payment", "overdue", "payment_rejected"].includes(invoice.displayStatus);
                    return (
                      <TableRow key={invoice.id}>
                        <TableCell className="max-w-64 whitespace-normal py-3 text-xs"><span className="block font-medium">{invoice.description}</span><span className="mt-0.5 block font-mono text-2xs text-muted-foreground">{invoice.id}</span></TableCell>
                        <TableCell className="py-3 text-xs">{invoiceKindLabel[resolveInvoiceKind(invoice)]}</TableCell>
                        <TableCell className="max-w-48 whitespace-normal py-3 text-xs">{invoice.payee?.label ?? "ราชวิทยาลัยเภสัชกรรมแห่งประเทศไทย (ชำระเงินส่วนกลาง)"}</TableCell>
                        <TableCell className="py-3 text-xs font-medium tabular-nums">
                          ฿{(invoice.paidAmount ?? invoice.amountDue).toLocaleString()}
                          {invoice.lateFee > 0 && invoice.status !== "paid" ? <p className="mt-1 text-xs text-danger">รวมค่าปรับ ฿{invoice.lateFee.toLocaleString()}</p> : null}
                        </TableCell>
                        <TableCell className="py-3 text-xs">{invoice.status === "paid" ? `ชำระ ${formatPortalDateTime(invoice.paidAt)}` : formatDueAt(invoice)}</TableCell>
                        <TableCell className="py-3 text-xs"><Badge variant={status.variant}>{status.label}</Badge></TableCell>
                        <TableCell className="max-w-48 whitespace-normal py-3 text-xs">
                          {invoice.receiptNo ? <span className="block font-mono">ใบเสร็จ {invoice.receiptNo}</span> : null}
                          {invoice.evidenceFileName ? <span className="block text-muted-foreground">{invoice.evidenceFileName}{invoice.referenceNo ? ` · Ref ${invoice.referenceNo}` : ""}</span> : null}
                          {!invoice.receiptNo && !invoice.evidenceFileName ? <span className="text-muted-foreground">—</span> : null}
                        </TableCell>
                        <TableCell className="py-3 text-xs">
                          {payable ? <Button size="sm" className="min-h-11 text-xs" onClick={() => setSelectedInvoiceId(invoice.id)}>{invoice.displayStatus === "payment_rejected" ? "ส่งหลักฐานใหม่" : "ชำระเงิน"}</Button> : null}
                          {invoice.displayStatus === "pending_review" ? <span className="text-muted-foreground">กำลังตรวจสอบ</span> : null}
                          {invoice.displayStatus === "paid" ? <Button variant="ghost" size="sm" className="min-h-11" onClick={() => toast.info(`ใบเสร็จเลขที่ ${invoice.receiptNo}`, { description: "TODO: การออกไฟล์ใบเสร็จ PDF ยังไม่เชื่อมระบบเอกสาร" })}>ใบเสร็จ</Button> : null}
                          {invoice.displayStatus === "locked" ? <span className="text-muted-foreground">ยังชำระไม่ได้</span> : null}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {invoices.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="h-28 text-center text-content-muted">ยังไม่มีใบแจ้งชำระเงิน</TableCell></TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
        <p className="text-xs text-muted-foreground">สถานะ “ชำระแล้ว” และเลขที่ใบเสร็จจะแสดงหลังเจ้าหน้าที่การเงินยืนยันรับชำระจากหลักฐานเท่านั้น</p>
      </PageShell>
      {selectedInvoice ? (
        <PaymentDialog
          successDescription="ส่งหลักฐานแล้ว สถานะเป็น “รอตรวจสอบการชำระเงิน” จนกว่าเจ้าหน้าที่การเงินจะยืนยันรับชำระ"
          item={{
            id: selectedInvoice.id,
            description: selectedInvoice.description,
            amount: selectedInvoice.amountDue,
            baseAmount: selectedInvoice.baseAmount,
            lateFee: selectedInvoice.lateFee,
            dueAt: selectedInvoice.dueAt,
          }}
          onSubmitted={handleSubmitted}
          onOpenChange={(open) => { if (!open) setSelectedInvoiceId(null); }}
        />
      ) : null}
    </>
  );
}
