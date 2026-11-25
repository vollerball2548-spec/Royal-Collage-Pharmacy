"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { FileUploadField } from "@/roles/shared/components/forms/FileUploadField";
import { isFileValue, isRequired, isSignatureValue, isVisible } from "@/domain/forms/evaluate";
import type {
  FieldDef,
  FieldOption,
  FieldValue,
  FileValue,
  FormAnswers,
  FormContext,
  FormError,
  FormStep,
} from "@/domain/forms/schema";

/**
 * วาดฟอร์มจาก schema — ไม่มี logic ของหลักสูตรใด ๆ ในไฟล์นี้
 */
interface RendererProps {
  step: FormStep;
  answers: FormAnswers;
  context: FormContext;
  locked: ReadonlySet<string>;
  errors: readonly FormError[];
  onChange: (fieldId: string, value: FieldValue) => void;
  readOnly?: boolean;
}

const selectClass = "h-11 w-full rounded-xl border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-70";

function errorFor(errors: readonly FormError[], id: string) {
  return errors.find((error) => error.fieldId === id)?.message;
}

function Label({ htmlFor, field, required }: { htmlFor: string; field: FieldDef; required: boolean }) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-medium">
      {field.label}
      {required ? <span className="text-danger"> *</span> : null}
      {field.locked ? <span className="ml-2 rounded-md bg-muted px-1.5 py-0.5 text-2xs font-normal text-muted-foreground">จากทะเบียนสภาฯ</span> : null}
    </label>
  );
}

function OptionList({ name, options, selected, multiple, disabled, onToggle }: {
  name: string; options: readonly FieldOption[]; selected: readonly string[]; multiple: boolean; disabled: boolean; onToggle: (value: string) => void;
}) {
  return (
    <ul className="space-y-2">
      {options.map((option) => (
        <li key={option.value}>
          <label className={cn("flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm", selected.includes(option.value) ? "border-primary bg-brand-soft/40" : "border-border hover:bg-surface-container-low")}>
            <input
              type={multiple ? "checkbox" : "radio"}
              name={name}
              className="mt-0.5 size-4 shrink-0 accent-primary"
              checked={selected.includes(option.value)}
              disabled={disabled}
              onChange={() => onToggle(option.value)}
            />
            <span>{option.label}</span>
          </label>
          {option.children ? (
            <div className="ml-7 mt-2">
              <OptionList name={name} options={option.children} selected={selected} multiple={multiple} disabled={disabled} onToggle={onToggle} />
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function toFileValue(file: { name: string; type: string; size: number } | undefined): FileValue | undefined {
  return file ? { name: file.name, type: file.type, size: file.size, uploadedAt: new Date().toISOString() } : undefined;
}

export function FieldControl({ field, value, answers, context, locked, errors, onChange, readOnly, idPrefix = "" }: {
  field: FieldDef; value: FieldValue; answers: FormAnswers; context: FormContext; locked: boolean; errors: readonly FormError[];
  onChange: (value: FieldValue) => void; readOnly?: boolean; idPrefix?: string;
}) {
  const id = `${idPrefix}${field.id}`;
  const domId = `field-${id.replace(/\./g, "-")}`;
  const required = isRequired(field, answers, context);
  const error = errorFor(errors, id);
  const disabled = Boolean(readOnly || locked);

  if (field.type === "file") {
    const file = isFileValue(value) ? value : undefined;
    return (
      <div className="rounded-xl border border-border bg-surface-container-low/50 p-3">
        <FileUploadField
          compact
          label={field.label}
          description={field.hint ?? (required ? "เอกสารที่ต้องใช้" : "เอกสารทางเลือก")}
          required={required}
          value={file ? { name: file.name, type: file.type, size: file.size, lastModified: Date.parse(file.uploadedAt) || 0 } : undefined}
          onChange={(next) => { if (!disabled) onChange(toFileValue(next) ?? null); }}
          error={error}
        />
      </div>
    );
  }

  if (field.type === "signature") {
    const signature = isSignatureValue(value) ? value : undefined;
    const expected = String(answers[field.nameField] ?? "");
    return (
      <div className="space-y-3 rounded-xl border border-border p-4">
        <p className="text-sm leading-relaxed text-muted-foreground">{field.statement}</p>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            disabled={disabled}
            checked={Boolean(signature?.accepted)}
            onChange={(event) => onChange(event.target.checked ? { accepted: true, signedName: signature?.signedName ?? "", signedAt: new Date().toISOString() } : null)}
          />
          ข้าพเจ้าได้อ่านและขอรับรองตามข้อความข้างต้น
        </label>
        <div className="space-y-1.5">
          <label htmlFor={domId} className="text-sm font-medium">ลงชื่อ (พิมพ์ &quot;{expected}&quot;){required ? <span className="text-danger"> *</span> : null}</label>
          <Input
            id={domId}
            disabled={disabled || !signature?.accepted}
            value={signature?.signedName ?? ""}
            onChange={(event) => onChange({ accepted: true, signedName: event.target.value, signedAt: new Date().toISOString() })}
          />
        </div>
        {error ? <p className="text-xs text-danger">{error}</p> : null}
      </div>
    );
  }

  if (field.type === "repeater") {
    const rows = Array.isArray(value) ? value as Record<string, unknown>[] : [];
    const fixed = Boolean(field.fixedItems);
    return (
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">{field.label}{required ? <span className="text-danger"> *</span> : null}</legend>
        {field.hint ? <p className="text-xs text-muted-foreground">{field.hint}</p> : null}
        {rows.map((row, index) => (
          <div key={`${id}-${index}`} className="space-y-3 rounded-xl border border-border p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{field.itemLabel} {index + 1}</p>
              {!fixed && !disabled ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => onChange(rows.filter((_, i) => i !== index))}>ลบ</Button>
              ) : null}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {field.fields.map((child) => (
                <div key={child.id} className={cn(child.type === "textarea" && "sm:col-span-2")}>
                  <FieldControl
                    field={child}
                    value={row[child.id] as FieldValue}
                    answers={{ ...answers, ...(row as FormAnswers) }}
                    context={context}
                    locked={disabled || (fixed && child.id === Object.keys(field.fixedItems?.[0] ?? {})[0])}
                    errors={errors}
                    idPrefix={`${id}.${index}.`}
                    onChange={(next) => onChange(rows.map((item, i) => (i === index ? { ...item, [child.id]: next } : item)))}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
        {!fixed && !disabled ? (
          <Button type="button" variant="outline" size="sm" onClick={() => onChange([...rows, {}])}>
            <span className="material-symbols-outlined text-base" aria-hidden="true">add</span>เพิ่ม{field.itemLabel}
          </Button>
        ) : null}
        {error ? <p className="text-xs text-danger">{error}</p> : null}
      </fieldset>
    );
  }

  if (field.type === "radio" || (field.type === "checkbox" && field.options)) {
    const multiple = field.type === "checkbox";
    const selected = multiple ? (Array.isArray(value) ? value as string[] : []) : typeof value === "string" ? [value] : [];
    return (
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{field.label}{required ? <span className="text-danger"> *</span> : null}</legend>
        {field.hint ? <p className="text-xs text-muted-foreground">{field.hint}</p> : null}
        <OptionList
          name={id}
          options={field.options ?? []}
          selected={selected}
          multiple={multiple}
          disabled={disabled}
          onToggle={(option) => onChange(multiple ? (selected.includes(option) ? selected.filter((item) => item !== option) : [...selected, option]) : option)}
        />
        {error ? <p className="text-xs text-danger">{error}</p> : null}
      </fieldset>
    );
  }

  if (field.type === "checkbox") {
    return (
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
        <input type="checkbox" className="size-4 accent-primary" disabled={disabled} checked={value === true} onChange={(event) => onChange(event.target.checked)} />
        {field.label}{required ? <span className="text-danger"> *</span> : null}
        {error ? <span className="text-xs text-danger">{error}</span> : null}
      </label>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={domId} field={field} required={required} />
      {field.type === "textarea" ? (
        <Textarea id={domId} rows={3} disabled={disabled} value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value)} aria-invalid={Boolean(error)} />
      ) : field.type === "select" ? (
        <select id={domId} className={selectClass} disabled={disabled} value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value)} aria-invalid={Boolean(error)}>
          <option value="">— เลือก —</option>
          {field.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      ) : (
        <Input
          id={domId}
          type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
          disabled={disabled}
          readOnly={locked}
          maxLength={field.type === "text" ? field.maxLength : undefined}
          min={field.type === "number" ? field.min : undefined}
          value={value === undefined || value === null ? "" : String(value)}
          onChange={(event) => onChange(field.type === "number" ? (event.target.value === "" ? null : Number(event.target.value)) : event.target.value)}
          aria-invalid={Boolean(error)}
        />
      )}
      {field.hint ? <p className="text-xs text-muted-foreground">{field.hint}</p> : null}
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}

export function FormRenderer({ step, answers, context, locked, errors, onChange, readOnly }: RendererProps) {
  return (
    <div className="space-y-4">
      {step.description ? <p className="rounded-xl border border-info-border bg-info-soft px-4 py-3 text-xs text-info-on-soft">{step.description}</p> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        {step.fields.filter((field) => isVisible(field, answers, context)).map((field) => (
          <div key={field.id} className={cn((field.wide || field.type === "repeater" || field.type === "signature" || field.type === "textarea") && "sm:col-span-2")}>
            <FieldControl
              field={field}
              value={answers[field.id]}
              answers={answers}
              context={context}
              locked={locked.has(field.id)}
              errors={errors}
              readOnly={readOnly}
              onChange={(value) => onChange(field.id, value)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/** ค่าที่อ่านได้สำหรับหน้าสรุป/หน้าพิมพ์ */
export function displayValue(field: FieldDef, value: FieldValue): string {
  if (value === undefined || value === null || value === "") return "—";
  if (field.type === "file") return isFileValue(value) ? `แนบแล้ว: ${value.name}` : "—";
  if (field.type === "signature") return isSignatureValue(value) && value.accepted ? `ลงชื่อ ${value.signedName}` : "—";
  if ((field.type === "radio" || field.type === "select" || field.type === "checkbox") && "options" in field && field.options) {
    const flat = (options: readonly FieldOption[]): FieldOption[] => options.flatMap((option) => [option, ...(option.children ? flat(option.children) : [])]);
    const labels = flat(field.options);
    const values = Array.isArray(value) ? value as string[] : [String(value)];
    return values.map((item) => labels.find((option) => option.value === item)?.label ?? item).join(", ") || "—";
  }
  if (field.type === "checkbox") return value === true ? "ใช่" : "—";
  if (Array.isArray(value)) return `${value.length} รายการ`;
  return String(value);
}
