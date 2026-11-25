import type {
  Condition,
  FieldDef,
  FieldValue,
  FileValue,
  FormAnswers,
  FormContext,
  FormError,
  FormTemplate,
  SignatureValue,
} from "./schema";

export function evaluateCondition(condition: Condition | undefined, answers: FormAnswers, ctx: FormContext): boolean {
  if (!condition) return true;
  if ("all" in condition) return condition.all.every((item) => evaluateCondition(item, answers, ctx));
  if ("any" in condition) return condition.any.some((item) => evaluateCondition(item, answers, ctx));
  if ("not" in condition) return !evaluateCondition(condition.not, answers, ctx);
  const value: unknown = "field" in condition ? answers[condition.field] : ctx[condition.ctx];
  if ("equals" in condition) return value === condition.equals;
  if ("in" in condition) return condition.in.includes(value);
  return Boolean(value) && !(Array.isArray(value) && value.length === 0);
}

export function isVisible(field: FieldDef, answers: FormAnswers, ctx: FormContext) {
  return evaluateCondition(field.visibleWhen, answers, ctx);
}

export function isRequired(field: FieldDef, answers: FormAnswers, ctx: FormContext) {
  if (!isVisible(field, answers, ctx)) return false;
  if (field.required === undefined || field.required === false) return false;
  if (field.required === true) return true;
  return evaluateCondition(field.required, answers, ctx);
}

export function isFileValue(value: unknown): value is FileValue {
  return Boolean(value) && typeof value === "object" && typeof (value as FileValue).name === "string" && typeof (value as FileValue).size === "number";
}

export function isSignatureValue(value: unknown): value is SignatureValue {
  return Boolean(value) && typeof value === "object" && typeof (value as SignatureValue).signedName === "string";
}

function isEmpty(value: FieldValue) {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "boolean") return value === false;
  return false;
}

function nameOf(field: FieldDef) {
  return field.errorLabel ?? field.label;
}

function fieldErrors(field: FieldDef, value: FieldValue, answers: FormAnswers, ctx: FormContext, prefix = ""): FormError[] {
  const id = `${prefix}${field.id}`;
  if (!isVisible(field, answers, ctx)) return [];
  const required = isRequired(field, answers, ctx);
  if (field.type === "signature") {
    if (!required && !value) return [];
    const expected = String(answers[field.nameField] ?? "").trim();
    if (!isSignatureValue(value) || !value.accepted) return [{ fieldId: id, message: `กรุณายืนยัน "${nameOf(field)}"` }];
    if (value.signedName.trim() !== expected) return [{ fieldId: id, message: `กรุณาพิมพ์ชื่อให้ตรงกับ "${expected}"` }];
    return [];
  }
  if (field.type === "repeater") {
    const rows = Array.isArray(value) ? value as Record<string, unknown>[] : [];
    const errors: FormError[] = [];
    const min = field.minItems ?? (required ? 1 : 0);
    if (rows.length < min) errors.push({ fieldId: id, message: `${nameOf(field)}: ต้องมีอย่างน้อย ${min} รายการ` });
    rows.forEach((row, index) => {
      field.fields.forEach((child) => {
        errors.push(...fieldErrors(child, row[child.id] as FieldValue, { ...answers, ...(row as FormAnswers) }, ctx, `${id}.${index}.`));
      });
    });
    return errors;
  }
  if (isEmpty(value)) return required ? [{ fieldId: id, message: `กรุณากรอก "${nameOf(field)}"` }] : [];
  if (field.type === "number") {
    const number = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(number)) return [{ fieldId: id, message: `"${nameOf(field)}" ต้องเป็นตัวเลข` }];
    if (field.integer && !Number.isInteger(number)) return [{ fieldId: id, message: `"${nameOf(field)}" ต้องเป็นจำนวนเต็ม` }];
    if (field.min !== undefined && number < field.min) return [{ fieldId: id, message: `"${nameOf(field)}" ต้องไม่น้อยกว่า ${field.min}` }];
  }
  if ((field.type === "text" || field.type === "textarea") && field.pattern && typeof value === "string" && !new RegExp(field.pattern.regex).test(value.trim())) {
    return [{ fieldId: id, message: field.pattern.message }];
  }
  if ((field.type === "select" || field.type === "radio") && !field.options.some((option) => option.value === value)) {
    return [{ fieldId: id, message: `"${nameOf(field)}" ไม่อยู่ในตัวเลือก` }];
  }
  if (field.type === "checkbox" && field.options && Array.isArray(value) && field.minSelected && value.length < field.minSelected) {
    return [{ fieldId: id, message: `"${nameOf(field)}" ต้องเลือกอย่างน้อย ${field.minSelected} ข้อ` }];
  }
  if (field.type === "file" && !isFileValue(value)) return [{ fieldId: id, message: `กรุณาแนบ "${nameOf(field)}"` }];
  return [];
}

export function validateStep(template: FormTemplate, stepId: string, answers: FormAnswers, ctx: FormContext): FormError[] {
  const step = template.steps.find((item) => item.id === stepId);
  if (!step) return [];
  return step.fields.flatMap((field) => fieldErrors(field, answers[field.id], answers, ctx));
}

/** ตรวจทั้งฟอร์ม + กติกาข้ามฟิลด์ของ template */
export function validateForm(template: FormTemplate, answers: FormAnswers, ctx: FormContext): FormError[] {
  return [
    ...template.steps.flatMap((step) => validateStep(template, step.id, answers, ctx)),
    ...(template.rules?.(answers, ctx) ?? []),
  ];
}

export function allFields(template: FormTemplate): FieldDef[] {
  return template.steps.flatMap((step) => [...step.fields]);
}

/** ฟิลด์แนบไฟล์ที่มองเห็นได้ → ใช้สร้าง document checklist ต่อใบสมัคร */
export function visibleDocumentFields(template: FormTemplate, answers: FormAnswers, ctx: FormContext) {
  return allFields(template).filter((field): field is Extract<FieldDef, { type: "file" }> => field.type === "file" && isVisible(field, answers, ctx));
}
