import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import FinancePage from "./page";

const portal = vi.hoisted(() => ({
  isReady: true,
  isStudent: true,
  studentId: "student-test",
  actor: { userId: "student-test", displayName: "ผู้เรียน", role: "student", organisationId: "org-inst-siriraj" },
  invoices: [
    {
      id: "INV-LOCKED", registrationId: "REG-LOCKED", studentId: "student-test",
      description: "ค่าลงทะเบียนรอการอนุมัติ", baseAmount: 5_000, status: "locked", kind: "registration",
      createdAt: "2026-09-01T00:00:00Z", updatedAt: "2026-09-01T00:00:00Z",
    },
    {
      id: "INV-OPEN", registrationId: "REG-OPEN", studentId: "student-test",
      description: "ค่าลงทะเบียนที่อนุมัติแล้ว", baseAmount: 3_000, status: "awaiting_payment", kind: "registration",
      createdAt: "2026-09-02T00:00:00Z", updatedAt: "2026-09-02T00:00:00Z", dueAt: "2099-01-01T23:59:59+07:00",
    },
    {
      id: "INV-PAID", registrationId: "SC-1", studentId: "student-test",
      description: "หลักสูตรดูแลผู้ป่วยโรคเรื้อรัง", baseAmount: 4_000, status: "paid", kind: "short_course",
      payee: { organisationId: "org-inst-siriraj", label: "สถาบันฝึกอบรมโรงพยาบาลศิริราช" },
      paidAt: "2026-09-03T00:00:00Z", receiptNo: "RC-2569-SC-1",
      createdAt: "2026-09-03T00:00:00Z", updatedAt: "2026-09-03T00:00:00Z",
    },
  ],
  payments: [],
  db: { submitStudentPayment: vi.fn() },
}));
vi.mock("@/roles/member/features/portal/use-student-portal", () => ({ useStudentPortal: () => portal }));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

function row(text: string) {
  return within(screen.getByText(text).closest("tr")!);
}

describe("student finance", () => {
  it("separates payment types, payees and receipts, and blocks payment before approval", () => {
    render(<FinancePage />);
    expect(row("ค่าลงทะเบียนรอการอนุมัติ").getByText("ยังชำระไม่ได้")).toBeTruthy();
    expect(row("ค่าลงทะเบียนรอการอนุมัติ").queryByRole("button", { name: "ชำระเงิน" })).toBeNull();
    expect(row("หลักสูตรดูแลผู้ป่วยโรคเรื้อรัง").getByText("ค่าหลักสูตร Short Course", { selector: "td" })).toBeTruthy();
    expect(row("หลักสูตรดูแลผู้ป่วยโรคเรื้อรัง").getByText("สถาบันฝึกอบรมโรงพยาบาลศิริราช")).toBeTruthy();
    expect(row("หลักสูตรดูแลผู้ป่วยโรคเรื้อรัง").getByText("ใบเสร็จ RC-2569-SC-1")).toBeTruthy();
  });

  it("sends evidence through the guarded store action instead of marking the invoice paid", async () => {
    render(<FinancePage />);
    fireEvent.click(row("ค่าลงทะเบียนที่อนุมัติแล้ว").getByRole("button", { name: "ชำระเงิน" }));
    fireEvent.change(screen.getByLabelText("Reference No."), { target: { value: "REF-1" } });
    fireEvent.change(screen.getByLabelText(/หลักฐานการชำระเงิน/, { selector: "input" }), {
      target: { files: [new File(["proof"], "proof.png", { type: "image/png" })] },
    });
    fireEvent.click(screen.getByRole("button", { name: "ส่งหลักฐานการชำระเงิน" }));
    await waitFor(() => expect(portal.db.submitStudentPayment).toHaveBeenCalledTimes(1));
    expect(portal.db.submitStudentPayment.mock.calls[0]).toEqual([
      portal.actor,
      expect.objectContaining({ invoiceId: "INV-OPEN", referenceNo: "REF-1", evidenceFileName: "proof.png" }),
    ]);
    await waitFor(() => expect(screen.getByRole("heading", { name: "ส่งหลักฐานการชำระเงินแล้ว" })).toBeTruthy());
  });
});
