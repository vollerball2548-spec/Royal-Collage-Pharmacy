import { allFields } from "./evaluate";
import type { FieldValue, FormAnswers, FormTemplate } from "./schema";

function readPath(source: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => (
    current && typeof current === "object" ? (current as Record<string, unknown>)[key] : undefined
  ), source);
}

/**
 * เติมคำตอบจากโปรไฟล์ (เช่นข้อมูลทะเบียนสภาเภสัชกรรม)
 * ฟิลด์ `locked` ใช้ค่าจากโปรไฟล์เสมอ แม้ร่างเดิมจะมีค่าอื่น — ผู้สมัครแก้ไม่ได้
 */
export function prefillAnswers(template: FormTemplate, profile: unknown, existing: FormAnswers = {}): FormAnswers {
  const answers: FormAnswers = { ...existing };
  for (const field of allFields(template)) {
    if (!field.prefill) continue;
    const value = readPath(profile, field.prefill);
    if (value === undefined || value === null) continue;
    if (field.locked || answers[field.id] === undefined || answers[field.id] === "") {
      answers[field.id] = (Array.isArray(value) ? structuredClone(value) : value) as FieldValue;
    }
  }
  return answers;
}

export function lockedFieldIds(template: FormTemplate) {
  return new Set(allFields(template).filter((field) => field.locked).map((field) => field.id));
}

/** ปฏิเสธการแก้ฟิลด์ที่ล็อก — ใช้ทั้งฝั่ง UI และก่อนบันทึก */
export function applyAnswerChange(template: FormTemplate, answers: FormAnswers, fieldId: string, value: FieldValue): FormAnswers {
  if (lockedFieldIds(template).has(fieldId)) return answers;
  return { ...answers, [fieldId]: value };
}
