/**
 * Payment Adapter — จุดเดียวที่ระบบเรียกการชำระเงิน
 * รอบแรกใช้ MockPaymentAdapter เท่านั้น; ต่อ gateway จริงโดยเพิ่ม adapter ใหม่ที่ implement interface นี้
 */
export type PaymentMethod = "promptpay" | "credit_card";

export interface PaymentRequest {
  reference: string;
  amount: number;
  description: string;
  method: PaymentMethod;
}

export interface PaymentResult {
  chargeId: string;
  status: "paid" | "pending" | "failed";
  adapter: string;
  processedAt: string;
}

export interface PaymentAdapter {
  readonly name: string;
  charge(request: PaymentRequest): Promise<PaymentResult>;
}

/** ชำระสำเร็จทันทีเมื่อยอดถูกต้อง — ไม่มีการตัดเงินจริง */
export class MockPaymentAdapter implements PaymentAdapter {
  readonly name = "mock";

  constructor(private readonly now: () => string = () => new Date().toISOString()) {}

  async charge(request: PaymentRequest): Promise<PaymentResult> {
    const valid = Number.isFinite(request.amount) && request.amount > 0 && request.reference.trim().length > 0;
    return {
      chargeId: `MOCK-${request.method.toUpperCase()}-${request.reference}`,
      status: valid ? "paid" : "failed",
      adapter: this.name,
      processedAt: this.now(),
    };
  }
}

// shortcut: ใช้ mock adapter ทั้งระบบ — เปลี่ยนเป็น adapter ของ gateway จริงเมื่อได้สัญญาและคีย์ทดสอบ
export const paymentAdapter: PaymentAdapter = new MockPaymentAdapter();
