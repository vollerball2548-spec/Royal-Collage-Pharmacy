"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  APPROVAL_EXAM_DECLARATION,
  COLLEGE_QUALIFICATIONS,
  GENERAL_QUALIFICATIONS,
  type ApprovalExamForm,
  type QualificationItem,
} from "@/roles/shared/features/admissions/approval-exam";
import {
  applicantFullName,
  MARITAL_STATUS_OPTIONS,
  type ApplicantSnapshot,
  type PostalAddress,
} from "@/roles/shared/features/applicant/profile";

type FormUpdater = (updater: (form: ApprovalExamForm) => ApprovalExamForm) => void;

const sectionClass = "space-y-4 rounded-xl border border-border bg-card p-5";
const selectClass = "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function Field({ id, label, required, children }: { id: string; label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-xs font-medium">
        {label}{required ? <span className="text-danger"> *</span> : null}
      </label>
      {children}
    </div>
  );
}

function ReadOnlyItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value || "—"}</dd>
    </div>
  );
}

const addressFields: readonly { key: keyof PostalAddress; label: string; required?: boolean }[] = [
  { key: "houseNo", label: "เลขที่", required: true },
  { key: "moo", label: "หมู่ที่" },
  { key: "soi", label: "ตรอก/ซอย" },
  { key: "road", label: "ถนน" },
  { key: "subdistrict", label: "ตำบล/แขวง", required: true },
  { key: "district", label: "อำเภอ/เขต", required: true },
  { key: "province", label: "จังหวัด", required: true },
  { key: "postalCode", label: "รหัสไปรษณีย์", required: true },
];

function AddressFields({ idPrefix, value, onChange }: { idPrefix: string; value: PostalAddress; onChange: (next: PostalAddress) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {addressFields.map((field) => (
        <Field key={field.key} id={`${idPrefix}-${field.key}`} label={field.label} required={field.required}>
          <Input
            id={`${idPrefix}-${field.key}`}
            value={value[field.key]}
            inputMode={field.key === "postalCode" ? "numeric" : undefined}
            maxLength={field.key === "postalCode" ? 5 : undefined}
            onChange={(event) => onChange({ ...value, [field.key]: event.target.value })}
          />
        </Field>
      ))}
    </div>
  );
}

function updateApplicant(onChange: FormUpdater, update: (applicant: ApplicantSnapshot) => ApplicantSnapshot) {
  onChange((form) => ({ ...form, applicant: update(form.applicant) }));
}

/** ข้อ 2 ข้อมูลส่วนบุคคล — ข้อมูลจากทะเบียนสภาฯ แสดงอย่างเดียว ส่วนที่ทำงานและที่อยู่ติดต่อกรอกในใบสมัคร */
export function ApplicantStep({ form, onChange }: { form: ApprovalExamForm; onChange: FormUpdater }) {
  const { person, license, workplace } = form.applicant;
  return (
    <div className="space-y-5">
      <section className={sectionClass} aria-labelledby="applicant-registry-heading">
        <h3 id="applicant-registry-heading" className="text-base font-semibold">ข้อมูลจากทะเบียนสภาเภสัชกรรม</h3>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ReadOnlyItem label="ชื่อ-นามสกุล" value={applicantFullName(person)} />
          <ReadOnlyItem label="ใบอนุญาตประกอบวิชาชีพเภสัชกรรม เลขที่" value={license.licenseNumber} />
          <ReadOnlyItem label="วัน/เดือน/ปีเกิด" value={person.birthDate} />
          <ReadOnlyItem label="อีเมล" value={person.email} />
        </dl>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="applicant-marital" label="สถานภาพ">
            <select
              id="applicant-marital"
              className={selectClass}
              value={person.maritalStatus}
              onChange={(event) => updateApplicant(onChange, (applicant) => ({ ...applicant, person: { ...applicant.person, maritalStatus: event.target.value as typeof person.maritalStatus } }))}
            >
              {MARITAL_STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </Field>
          <Field id="applicant-mobile" label="โทรศัพท์เคลื่อนที่" required>
            <Input
              id="applicant-mobile"
              inputMode="tel"
              value={person.mobilePhone}
              onChange={(event) => updateApplicant(onChange, (applicant) => ({ ...applicant, person: { ...applicant.person, mobilePhone: event.target.value } }))}
            />
          </Field>
        </div>
      </section>

      <section className={sectionClass} aria-labelledby="applicant-workplace-heading">
        <h3 id="applicant-workplace-heading" className="text-base font-semibold">ตำแหน่งและสถานที่ทำงานปัจจุบัน</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="workplace-position" label="ปัจจุบันปฏิบัติงานในตำแหน่ง" required>
            <Input id="workplace-position" value={workplace.position} onChange={(event) => updateApplicant(onChange, (applicant) => ({ ...applicant, workplace: { ...applicant.workplace, position: event.target.value } }))} />
          </Field>
          <Field id="workplace-organisation" label="สังกัดหน่วยงาน/สถานที่ทำงาน" required>
            <Input id="workplace-organisation" value={workplace.organisation} onChange={(event) => updateApplicant(onChange, (applicant) => ({ ...applicant, workplace: { ...applicant.workplace, organisation: event.target.value } }))} />
          </Field>
        </div>
        <AddressFields idPrefix="workplace" value={workplace.address} onChange={(address) => updateApplicant(onChange, (applicant) => ({ ...applicant, workplace: { ...applicant.workplace, address } }))} />
        <div className="grid gap-3 sm:grid-cols-3">
          {(["phone", "fax", "email"] as const).map((key) => (
            <Field key={key} id={`workplace-${key}`} label={{ phone: "โทรศัพท์", fax: "โทรสาร", email: "E-mail" }[key]}>
              <Input id={`workplace-${key}`} type={key === "email" ? "email" : "text"} value={workplace[key]} onChange={(event) => updateApplicant(onChange, (applicant) => ({ ...applicant, workplace: { ...applicant.workplace, [key]: event.target.value } }))} />
            </Field>
          ))}
        </div>
      </section>

      <section className={sectionClass} aria-labelledby="applicant-contact-heading">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="applicant-contact-heading" className="text-base font-semibold">ที่อยู่ปัจจุบันที่สามารถติดต่อได้สะดวกที่สุด</h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => updateApplicant(onChange, (applicant) => ({ ...applicant, person: { ...applicant.person, contactAddress: { ...applicant.workplace.address } } }))}
          >
            ใช้ที่อยู่เดียวกับสถานที่ทำงาน
          </Button>
        </div>
        <AddressFields idPrefix="contact" value={person.contactAddress} onChange={(contactAddress) => updateApplicant(onChange, (applicant) => ({ ...applicant, person: { ...applicant.person, contactAddress } }))} />
      </section>
    </div>
  );
}

/** ข้อ 3 ประวัติการศึกษา และข้อ 4 ประวัติการทำงาน */
export function HistoryStep({ form, onChange }: { form: ApprovalExamForm; onChange: FormUpdater }) {
  const { education, employment } = form.applicant;
  const setEducation = (index: number, key: "institution" | "years" | "qualification", value: string) =>
    updateApplicant(onChange, (applicant) => ({
      ...applicant,
      education: applicant.education.map((record, i) => (i === index ? { ...record, [key]: value } : record)),
    }));
  const setEmployment = (id: string, key: "position" | "organisation" | "responsibilities" | "duration", value: string) =>
    updateApplicant(onChange, (applicant) => ({
      ...applicant,
      employment: applicant.employment.map((record) => (record.id === id ? { ...record, [key]: value } : record)),
    }));

  return (
    <div className="space-y-5">
      <section className={sectionClass} aria-labelledby="education-heading">
        <h3 id="education-heading" className="text-base font-semibold">ประวัติการศึกษา</h3>
        <p className="text-xs text-muted-foreground">กรอกเฉพาะระดับที่สำเร็จการศึกษา ระดับปริญญาตรีจำเป็นต้องกรอก</p>
        {education.map((record, index) => (
          <fieldset key={record.level} className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-3">
            <legend className="px-1 text-sm font-medium">{record.level}{record.level === "ปริญญาตรี" ? <span className="text-danger"> *</span> : null}</legend>
            <Field id={`education-${index}-institution`} label="ชื่อสถานศึกษา / สถาบัน">
              <Input id={`education-${index}-institution`} value={record.institution} onChange={(event) => setEducation(index, "institution", event.target.value)} />
            </Field>
            <Field id={`education-${index}-years`} label="ระหว่างปี (พ.ศ.)">
              <Input id={`education-${index}-years`} placeholder="เช่น 2559-2565" value={record.years} onChange={(event) => setEducation(index, "years", event.target.value)} />
            </Field>
            <Field id={`education-${index}-qualification`} label="ปริญญา / วุฒิที่ได้รับ / สาขาวิชา">
              <Input id={`education-${index}-qualification`} value={record.qualification} onChange={(event) => setEducation(index, "qualification", event.target.value)} />
            </Field>
          </fieldset>
        ))}
      </section>

      <section className={sectionClass} aria-labelledby="employment-heading">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="employment-heading" className="text-base font-semibold">ประวัติการทำงาน</h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => updateApplicant(onChange, (applicant) => ({
              ...applicant,
              employment: [...applicant.employment, { id: `employment-${Date.now()}`, position: "", organisation: "", responsibilities: "", duration: "", current: false }],
            }))}
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">add</span>
            เพิ่มรายการ
          </Button>
        </div>
        {employment.map((record, index) => (
          <fieldset key={record.id} className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-2">
            <legend className="px-1 text-sm font-medium">รายการที่ {index + 1}{record.current ? " (ปัจจุบัน)" : ""}</legend>
            <Field id={`${record.id}-position`} label="ตำแหน่ง / ระดับ">
              <Input id={`${record.id}-position`} value={record.position} onChange={(event) => setEmployment(record.id, "position", event.target.value)} />
            </Field>
            <Field id={`${record.id}-organisation`} label="สังกัดหน่วยงาน">
              <Input id={`${record.id}-organisation`} value={record.organisation} onChange={(event) => setEmployment(record.id, "organisation", event.target.value)} />
            </Field>
            <Field id={`${record.id}-responsibilities`} label="หน้าที่ความรับผิดชอบหลัก">
              <Textarea id={`${record.id}-responsibilities`} rows={2} value={record.responsibilities} onChange={(event) => setEmployment(record.id, "responsibilities", event.target.value)} />
            </Field>
            <Field id={`${record.id}-duration`} label="ระยะเวลา (ปี-เดือน)">
              <Input id={`${record.id}-duration`} placeholder="เช่น 3 ปี 6 เดือน" value={record.duration} onChange={(event) => setEmployment(record.id, "duration", event.target.value)} />
            </Field>
            {employment.length > 1 && !record.current ? (
              <div className="sm:col-span-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-danger"
                  onClick={() => updateApplicant(onChange, (applicant) => ({ ...applicant, employment: applicant.employment.filter((item) => item.id !== record.id) }))}
                >
                  ลบรายการนี้
                </Button>
              </div>
            ) : null}
          </fieldset>
        ))}
      </section>
    </div>
  );
}

function QualificationChecklist({ items, declared, onToggle }: { items: readonly QualificationItem[]; declared: readonly string[]; onToggle: (id: string) => void }) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.id}>
          <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-border p-3 text-sm hover:bg-muted/30">
            <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0" checked={declared.includes(item.id)} onChange={() => onToggle(item.id)} />
            <span>{item.label}</span>
          </label>
          {item.anyOf ? (
            <div className="ml-7 mt-2">
              <QualificationChecklist items={item.anyOf} declared={declared} onToggle={onToggle} />
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/** ข้อ 5 การตรวจสอบคุณสมบัติทั่วไปและคุณสมบัติเฉพาะของวิทยาลัย */
export function QualificationStep({ form, onChange, collegeName }: { form: ApprovalExamForm; onChange: FormUpdater; collegeName: string }) {
  const toggle = (id: string) => onChange((current) => ({
    ...current,
    declaredQualifications: current.declaredQualifications.includes(id)
      ? current.declaredQualifications.filter((item) => item !== id)
      : [...current.declaredQualifications, id],
  }));
  const collegeItems = COLLEGE_QUALIFICATIONS[form.collegeCode];
  return (
    <div className="space-y-5">
      <p className="rounded-xl border border-info-border bg-info-soft p-4 text-sm text-info-on-soft">
        ทำเครื่องหมายคุณสมบัติที่ท่านมี และแนบหลักฐานในขั้นถัดไป เจ้าหน้าที่จะตรวจสอบและรับรองคุณสมบัติอีกครั้ง
      </p>
      <section className={sectionClass} aria-labelledby="general-qualification-heading">
        <h3 id="general-qualification-heading" className="text-base font-semibold">คุณสมบัติทั่วไป (ทุกวิทยาลัยต้องมี)</h3>
        <QualificationChecklist items={GENERAL_QUALIFICATIONS} declared={form.declaredQualifications} onToggle={toggle} />
      </section>
      <section className={sectionClass} aria-labelledby="college-qualification-heading">
        <h3 id="college-qualification-heading" className="text-base font-semibold">คุณสมบัติเฉพาะของ{collegeName}</h3>
        {collegeItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">ยังไม่มีเกณฑ์คุณสมบัติเฉพาะของวิทยาลัยนี้ในระบบ เจ้าหน้าที่จะตรวจตามประกาศรับสมัคร</p>
        ) : (
          <QualificationChecklist items={collegeItems} declared={form.declaredQualifications} onToggle={toggle} />
        )}
        <Field id="qualification-note" label="รายละเอียดเพิ่มเติม (เช่น ระยะเวลาประสบการณ์ ชื่อผลงาน)">
          <Textarea id="qualification-note" rows={3} value={form.qualificationNote} onChange={(event) => onChange((current) => ({ ...current, qualificationNote: event.target.value }))} />
        </Field>
      </section>
    </div>
  );
}

/** ข้อ 7 การรับรองความถูกต้อง + ลายมือชื่ออิเล็กทรอนิกส์ */
export function DeclarationFields({ form, onChange }: { form: ApprovalExamForm; onChange: FormUpdater }) {
  const accepted = Boolean(form.declaration?.accepted);
  const signedName = form.declaration?.signedName ?? "";
  const setDeclaration = (nextAccepted: boolean, nextName: string) => onChange((current) => ({
    ...current,
    declaration: nextAccepted ? { accepted: true, signedName: nextName, signedAt: new Date().toISOString() } : undefined,
  }));
  return (
    <section className={sectionClass} aria-labelledby="declaration-heading">
      <h3 id="declaration-heading" className="text-base font-semibold">การรับรองความถูกต้อง</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">{APPROVAL_EXAM_DECLARATION}</p>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium">
        <input type="checkbox" className="h-4 w-4" checked={accepted} onChange={(event) => setDeclaration(event.target.checked, signedName)} />
        ข้าพเจ้าได้อ่านและขอรับรองตามข้อความข้างต้น
      </label>
      <Field id="declaration-signature" label={`ลงชื่อผู้สมัครสอบ (พิมพ์ "${applicantFullName(form.applicant.person)}")`} required>
        <Input id="declaration-signature" disabled={!accepted} value={signedName} onChange={(event) => setDeclaration(true, event.target.value)} />
      </Field>
    </section>
  );
}
