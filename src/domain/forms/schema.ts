/**
 * Form Engine — schema กลาง
 * ฟอร์มทุกชนิด (สมัครเรียน / สอบคัดเลือก / สอบอนุมัติ / เสนอหลักสูตร) อธิบายด้วยข้อมูลชุดนี้ ไม่ hard-code หน้าจอแยก
 * ไม่มี React หรือ browser API ในไฟล์นี้ เพื่อให้ย้ายไปใช้ฝั่ง API ได้
 */

export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "select"
  | "radio"
  | "checkbox"
  | "repeater"
  | "file"
  | "signature";

/** บริบทของใบสมัคร เช่น ประเภท วิทยาลัย กลุ่มหลักสูตร — ใช้ในเงื่อนไขแสดง/บังคับ */
export type FormContext = Readonly<Record<string, string | boolean | number | undefined>>;

export type Condition =
  | { field: string; equals: unknown }
  | { field: string; in: readonly unknown[] }
  | { field: string; truthy: true }
  | { ctx: string; equals: unknown }
  | { ctx: string; in: readonly unknown[] }
  | { all: readonly Condition[] }
  | { any: readonly Condition[] }
  | { not: Condition };

export interface FieldOption {
  value: string;
  label: string;
  /** ข้อย่อยแบบ "อย่างใดอย่างหนึ่ง" (แสดงเยื้องใต้ตัวเลือก) */
  children?: readonly FieldOption[];
}

interface FieldBase {
  id: string;
  label: string;
  hint?: string;
  /** true = บังคับเสมอ; Condition = บังคับเมื่อเงื่อนไขเป็นจริง */
  required?: boolean | Condition;
  visibleWhen?: Condition;
  /** ค่าจากโปรไฟล์ผู้สมัคร (dot path) — ใช้ prefill */
  prefill?: string;
  /** ห้ามผู้สมัครแก้ (ข้อมูลจากทะเบียนสภาเภสัชกรรม) */
  locked?: boolean;
  /** กว้างเต็มแถวในหน้าจอและหน้าพิมพ์ */
  wide?: boolean;
}

export interface TextField extends FieldBase { type: "text" | "textarea"; pattern?: { regex: string; message: string }; maxLength?: number }
export interface NumberField extends FieldBase { type: "number"; min?: number; integer?: boolean }
export interface DateField extends FieldBase { type: "date" }
export interface ChoiceField extends FieldBase { type: "select" | "radio"; options: readonly FieldOption[] }
/** checkbox เดี่ยว (ไม่มี options) = ยืนยัน/ไม่ยืนยัน; มี options = เลือกได้หลายข้อ */
export interface CheckboxField extends FieldBase { type: "checkbox"; options?: readonly FieldOption[]; minSelected?: number }
export interface RepeaterField extends FieldBase { type: "repeater"; fields: readonly FieldDef[]; minItems?: number; itemLabel: string; fixedItems?: readonly Record<string, string>[] }
export interface FileField extends FieldBase { type: "file"; documentId: string }
/** รับรองข้อความ + พิมพ์ชื่อให้ตรงกับผู้สมัคร (ลายมือชื่ออิเล็กทรอนิกส์) */
export interface SignatureField extends FieldBase { type: "signature"; statement: string; nameField: string }

export type FieldDef = TextField | NumberField | DateField | ChoiceField | CheckboxField | RepeaterField | FileField | SignatureField;

export interface FormStep {
  id: string;
  title: string;
  description?: string;
  fields: readonly FieldDef[];
}

export interface FormTemplate {
  id: string;
  version: number;
  title: string;
  /** ชื่อแบบฟอร์มกระดาษที่ใช้เป็นต้นแบบ (แสดงในหน้าพิมพ์) */
  paperTitle: readonly string[];
  steps: readonly FormStep[];
  /** กติกาข้ามฟิลด์ เช่น ชั่วโมงรวมต้องไม่น้อยกว่าเกณฑ์ */
  rules?: (answers: FormAnswers, ctx: FormContext) => readonly FormError[];
}

export interface FileValue {
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
}

export interface SignatureValue {
  accepted: boolean;
  signedName: string;
  signedAt: string;
}

export type FieldValue =
  | string
  | number
  | boolean
  | string[]
  | FileValue
  | SignatureValue
  | Record<string, unknown>[]
  | null
  | undefined;

export type FormAnswers = Record<string, FieldValue>;

export interface FormError {
  fieldId: string;
  message: string;
}
