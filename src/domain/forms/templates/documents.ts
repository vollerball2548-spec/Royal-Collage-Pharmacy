import type { Condition, FileField } from "../schema";

/**
 * ประเภทเอกสารกลาง — หลักสูตร/ฟอร์มกำหนดเองว่าใช้รายการใดและบังคับเมื่อใด
 * หลักฐานการชำระเงินได้จาก Payment Adapter (ใบเสร็จ/ผลชำระ) จึงไม่ใช่ช่องแนบไฟล์ในฟอร์ม
 */
export const DOCUMENT_TYPES = {
  photo: "รูปถ่ายหน้าตรง ขนาด 1 × 1.5 นิ้ว (ถ่ายไว้ไม่เกิน 1 ปี)",
  degree: "สำเนาปริญญาบัตร หรือหนังสือรับรองการศึกษา",
  license: "สำเนาใบอนุญาตประกอบวิชาชีพเภสัชกรรม",
  transcript: "ใบแสดงผลการศึกษา (Transcript)",
  recommendation: "หนังสือรับรอง (Recommendation)",
  cv: "ประวัติส่วนบุคคล (Curriculum Vitae)",
  employer_permission: "หนังสือรับรองประสบการณ์การทำงาน หรือหนังสือยินยอมจากหน่วยงานต้นสังกัด",
  patient_care_500h: "หลักฐานประสบการณ์การให้บริการทางวิชาชีพที่เกี่ยวข้องกับการดูแลผู้ป่วย ไม่น้อยกว่า 500 ชั่วโมง",
  work_experience: "เอกสารหลักฐานแสดงประสบการณ์การทำงาน (ระบุระยะเวลาและหน่วยงานรับรอง)",
  academic_works: "สำเนาผลงานวิชาการ / บทความ / ตำรา / หลักฐานการเป็นวิทยากร ตามเกณฑ์ของวิทยาลัย",
  name_change: "สำเนาหลักฐานการเปลี่ยนชื่อ หรือนามสกุล",
  payment_proof: "หลักฐานการชำระเงิน",
} as const;

export type DocumentTypeId = keyof typeof DOCUMENT_TYPES;

export function documentField(
  documentId: DocumentTypeId,
  options: { required?: boolean | Condition; visibleWhen?: Condition; hint?: string } = {},
): FileField {
  return {
    id: `doc_${documentId}`,
    type: "file",
    documentId,
    label: DOCUMENT_TYPES[documentId],
    required: options.required ?? false,
    ...(options.visibleWhen ? { visibleWhen: options.visibleWhen } : {}),
    ...(options.hint ? { hint: options.hint } : {}),
  };
}
