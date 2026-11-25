"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useMockDb } from "@/providers/mock-db-provider";
import { PageShell } from "@/roles/shared/components/layout/PageShell";
import { FileUploadField } from "@/roles/shared/components/forms/FileUploadField";
import type { CollegeCode } from "@/roles/shared/data/college-directory";
import type { AdmissionDocument } from "@/roles/shared/features/admissions/documents";
import {
  admissionWording,
  collegeOrganisationId,
  creditBankSubjectsFor,
  offeringsForSpecialty,
  openRoundsFor,
  PROGRAM_GROUPS,
  programGroupMeta,
  programTypeLabel,
  requiresRound,
  resolveStudyFlow,
  specialtiesInGroup,
  subjectKey,
  trainingInstitutionsFor,
  type ProgramGroup,
  type ProgramOffering,
} from "@/roles/shared/features/admissions/program-offerings";
import {
  createStudyApplicationDocuments,
  STUDY_APPLICATION_DECLARATION,
  studyApplicationErrors,
  type StudyApplicationForm,
} from "@/roles/shared/features/admissions/study-application";
import {
  applicantFullName,
  currentApplicantProfile,
  MARITAL_STATUS_OPTIONS,
  snapshotApplicant,
  type MaritalStatus,
} from "@/roles/shared/features/applicant/profile";
import {
  findLicenseRegistryRecord,
  getLicenseEligibility,
  LicenseEligibilityNotice,
} from "@/roles/shared/features/license-eligibility";
import { currentMemberPassport } from "@/roles/shared/member/domain/member";

const selectedClass = "border-primary bg-primary/5";
const optionClass = "flex min-h-11 w-full flex-col gap-1 rounded-xl border p-4 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function Section({ step, title, children }: { step: number; title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{step}. {title}</CardTitle></CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

function maskCitizenId(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length === 13 ? `${digits.slice(0, 1)}-${digits.slice(1, 5)}-xxxxx-${digits.slice(10, 12)}-${digits.slice(12)}` : value || "—";
}

export default function StudyApplicationPage() {
  const router = useRouter();
  const { settings, setAdmissions } = useMockDb();
  const [group, setGroup] = useState<ProgramGroup | null>(null);
  const [collegeCode, setCollegeCode] = useState<CollegeCode | null>(null);
  const [offeringId, setOfferingId] = useState<string | null>(null);
  const [form, setForm] = useState<StudyApplicationForm | null>(null);
  const [documents, setDocuments] = useState<AdmissionDocument[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  const licenseRecord = findLicenseRegistryRecord(currentMemberPassport.license.licenseNumber);
  const licenseStatus = licenseRecord?.status ?? "unverified";
  const licenseEligibility = getLicenseEligibility(licenseStatus);

  const specialties = group ? specialtiesInGroup(group) : [];
  const offerings = group && collegeCode ? offeringsForSpecialty(group, collegeCode) : [];
  const offering = offerings.find((item) => item.id === offeringId);
  const flow = offering ? resolveStudyFlow(offering) : undefined;
  const institutions = offering ? trainingInstitutionsFor(offering) : [];
  const rounds = offering ? openRoundsFor(offering, settings.admissionOpen) : [];
  const subjects = offering ? creditBankSubjectsFor(offering) : [];
  const appliesHere = flow?.kind === "entrance_exam" || flow?.kind === "credit_bank_program";

  const chooseOffering = (next: ProgramOffering) => {
    setOfferingId(next.id);
    setErrors([]);
    const nextFlow = resolveStudyFlow(next);
    if (nextFlow.kind === "entrance_exam" || nextFlow.kind === "credit_bank_program") {
      setForm({
        offeringId: next.id,
        group: next.group ?? "credit_bank",
        subjects: [],
        applicant: form?.applicant ?? snapshotApplicant(currentApplicantProfile(), new Date().toISOString()),
      });
      setDocuments(createStudyApplicationDocuments(next));
    } else {
      setForm(null);
    }
  };

  const chooseGroup = (next: ProgramGroup) => {
    setGroup(next);
    setCollegeCode(null);
    setOfferingId(null);
    setForm(null);
    setErrors([]);
  };

  const chooseSpecialty = (code: CollegeCode) => {
    setCollegeCode(code);
    setOfferingId(null);
    setForm(null);
    setErrors([]);
    const only = group ? offeringsForSpecialty(group, code) : [];
    if (only.length === 1) chooseOffering(only[0]);
  };

  const update = (patch: (current: StudyApplicationForm) => StudyApplicationForm) => {
    setForm((current) => (current ? patch(current) : current));
    setErrors([]);
  };

  const submit = () => {
    if (!form || !offering) return;
    if (!licenseEligibility.canApplyForExam) {
      toast.error(`ไม่สามารถ${admissionWording.study}ได้`, { description: licenseEligibility.description });
      return;
    }
    const nextErrors = studyApplicationErrors(form, offering, rounds);
    setErrors(nextErrors);
    if (nextErrors.length > 0) {
      toast.error("กรุณากรอกข้อมูลให้ครบถ้วน", { description: nextErrors[0] });
      return;
    }
    const submittedAt = new Date();
    const prefix = flow?.kind === "credit_bank_program" ? "CBK" : "ENT";
    setAdmissions((previous) => [
      {
        id: `${prefix}-2570-${Math.floor(Math.random() * 1000).toString().padStart(3, "0")}`,
        name: applicantFullName(form.applicant.person),
        license: form.applicant.license.licenseNumber || "รอตรวจสอบ",
        program: offering.titleTh,
        date: submittedAt.toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" }),
        submittedAt: submittedAt.toISOString(),
        // กลุ่ม Credit Bank "ลงทะเบียนไปยังผู้รับผิดชอบหลักสูตร" จึงส่งถึงวิทยาลัยเจ้าของหลักสูตร
        institutionId: form.institutionId ?? collegeOrganisationId(offering.collegeCode),
        applicationType: "study",
        status: "pending",
        documents,
        documentStatus: documents.some((document) => document.file) ? "pending" : "complete",
        licenseStatus,
        licenseCheckedAt: licenseRecord?.checkedAt ?? submittedAt.toISOString(),
        studyApplication: { ...form, applicant: { ...form.applicant, capturedAt: submittedAt.toISOString() } },
      },
      ...previous,
    ]);
    toast.success(flow?.kind === "credit_bank_program" ? `ส่งใบ${admissionWording.study}แล้ว` : `ส่งใบ${admissionWording.entranceExam}แล้ว`, {
      description: "ติดตามสถานะและแนบเอกสารเพิ่มได้ที่หน้าสถานะการสมัคร",
    });
    router.push("/member/admission");
  };

  let step = 0;
  const next = () => ++step;
  const { person, license, workplace } = form?.applicant ?? currentApplicantProfile();

  return (
    <PageShell size="content" className="space-y-5">
      <Link href="/member/apply" className="inline-flex min-h-11 items-center gap-1 text-sm text-primary hover:underline">
        <span className="material-symbols-outlined text-base" aria-hidden="true">arrow_back</span>
        {admissionWording.hub}
      </Link>

      <Section step={next()} title="เลือกกลุ่มหลักสูตร">
        <div className="grid gap-3 sm:grid-cols-2">
          {PROGRAM_GROUPS.map((item) => (
            <button key={item} type="button" aria-pressed={group === item} onClick={() => chooseGroup(item)} className={`${optionClass} ${group === item ? selectedClass : "border-border"}`}>
              <span className="font-semibold">{programGroupMeta[item].labelEn}</span>
              <span className="text-sm">{programGroupMeta[item].label}</span>
              <span className="text-xs text-muted-foreground">{programGroupMeta[item].description}</span>
            </button>
          ))}
        </div>
      </Section>

      {group && (
        <Section step={next()} title="เลือกสาขา">
          <div className="grid gap-2 sm:grid-cols-2">
            {specialties.map((item) => (
              <button key={item.collegeCode} type="button" aria-pressed={collegeCode === item.collegeCode} onClick={() => chooseSpecialty(item.collegeCode)} className={`${optionClass} ${collegeCode === item.collegeCode ? selectedClass : "border-border"}`}>
                <span className="font-medium">สาขา{item.specialty}</span>
                <span className="text-xs text-muted-foreground">{item.collegeName}</span>
              </button>
            ))}
          </div>
          {specialties.length === 0 && <p className="text-sm text-muted-foreground">ยังไม่มีสาขาที่เปิดรับในกลุ่มนี้</p>}
        </Section>
      )}

      {group && collegeCode && (
        <Section step={next()} title="เลือกหลักสูตร">
          <div className="grid gap-2">
            {offerings.map((item) => (
              <button key={item.id} type="button" aria-pressed={offeringId === item.id} onClick={() => chooseOffering(item)} className={`${optionClass} ${offeringId === item.id ? selectedClass : "border-border"}`}>
                <span className="font-medium">{item.titleTh}</span>
                <span className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary">{programTypeLabel[item.type]}</Badge>
                  {item.creditBankEligible && <Badge variant="info">Credit Bank</Badge>}
                  {item.admissionMethod === "entrance_exam" && <Badge variant="warning">ต้องสอบคัดเลือก</Badge>}
                </span>
              </button>
            ))}
          </div>
          {offering && flow && (
            <>
              <ol aria-label="ขั้นตอนการสมัครเรียน" className="grid gap-2 pt-2">
                {flow.steps.map((item, index) => (
                  <li key={item} className="flex items-center gap-3 text-sm">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{index + 1}</span>
                    {item}
                  </li>
                ))}
              </ol>
              {!appliesHere && offering.shortCourseId && (
                <Button asChild className="min-h-11">
                  <Link href={`/member/short-courses?course=${encodeURIComponent(offering.shortCourseId)}`}>{flow.actionLabel}</Link>
                </Button>
              )}
            </>
          )}
        </Section>
      )}

      {form && offering && appliesHere && (
        <>
          {offering.requiresTrainingInstitution && (
            <Section step={next()} title="เลือกสถาบันฝึกอบรม">
              {institutions.length === 0 && <p className="text-sm text-muted-foreground">ยังไม่มีสถาบันฝึกอบรมของหลักสูตรนี้ในระบบ</p>}
              <fieldset className="grid gap-2 sm:grid-cols-2">
                <legend className="sr-only">สถาบันฝึกอบรม</legend>
                {institutions.map((institution) => (
                  <label key={institution.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-border px-3 text-sm">
                    <input type="radio" name="training-institution" checked={form.institutionId === institution.id} onChange={() => update((current) => ({ ...current, institutionId: institution.id }))} />
                    {institution.name}
                  </label>
                ))}
              </fieldset>
            </Section>
          )}

          {requiresRound(offering) && (
            <Section step={next()} title="เลือกรอบรับสมัคร">
              {rounds.length === 0 ? (
                <p className="text-sm text-danger">ขณะนี้ยังไม่เปิดรับสมัครหลักสูตรนี้</p>
              ) : (
                <fieldset className="grid gap-2">
                  <legend className="sr-only">รอบรับสมัคร</legend>
                  {rounds.map((round) => (
                    <label key={round.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-border px-3 text-sm">
                      <input type="radio" name="program-round" checked={form.roundId === round.id} onChange={() => update((current) => ({ ...current, roundId: round.id }))} />
                      {round.label}
                    </label>
                  ))}
                </fieldset>
              )}
            </Section>
          )}

          {flow?.kind === "credit_bank_program" && (
            <Section step={next()} title="เลือกรายวิชาที่ต้องการสมัคร">
              <p className="text-xs text-muted-foreground">วุฒิบัตรระบบสะสมหน่วยกิตต้องผ่านการฝึกอบรมระยะสั้น 4 หลักสูตร และจัดทำโครงการวิจัยเชิงปฏิบัติการ</p>
              <fieldset className="grid gap-2">
                <legend className="sr-only">รายวิชา</legend>
                {subjects.map((subject) => {
                  const key = subjectKey(subject);
                  return (
                    <label key={key} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-border p-3 text-sm">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 shrink-0"
                        checked={form.subjects.includes(key)}
                        onChange={() => update((current) => ({
                          ...current,
                          subjects: current.subjects.includes(key) ? current.subjects.filter((item) => item !== key) : [...current.subjects, key],
                        }))}
                      />
                      <span>{subject.code ? <span className="mr-2 font-mono text-xs text-primary">{subject.code}</span> : null}{subject.titleTh}</span>
                    </label>
                  );
                })}
              </fieldset>
            </Section>
          )}

          <Section step={next()} title="ข้อมูลผู้สมัคร (จากฐานทะเบียนสภาเภสัชกรรม)">
            <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {[
                ["ชื่อ-นามสกุล (ภาษาไทย)", applicantFullName(person)],
                ["ชื่อ-นามสกุล (ภาษาอังกฤษ)", `${person.firstNameEn} ${person.lastNameEn}`],
                ["เลขประจำตัวประชาชน", maskCitizenId(person.citizenId)],
                ["วัน/เดือน/ปีเกิด", person.birthDate],
                ["อีเมล", person.email],
                ["เลขที่ใบอนุญาตประกอบวิชาชีพเภสัชกรรม", license.licenseNumber],
                ["ปีที่ได้รับใบอนุญาต (พ.ศ.)", license.issuedYearBe],
              ].map(([label, value]) => (
                <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="font-medium">{value || "—"}</dd></div>
              ))}
            </dl>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <label htmlFor="study-marital" className="text-xs font-medium">สถานภาพ</label>
                <select id="study-marital" className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" value={person.maritalStatus} onChange={(event) => update((current) => ({ ...current, applicant: { ...current.applicant, person: { ...current.applicant.person, maritalStatus: event.target.value as MaritalStatus } } }))}>
                  {MARITAL_STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="study-mobile" className="text-xs font-medium">เบอร์โทรศัพท์มือถือ <span className="text-danger">*</span></label>
                <Input id="study-mobile" inputMode="tel" value={person.mobilePhone} onChange={(event) => update((current) => ({ ...current, applicant: { ...current.applicant, person: { ...current.applicant.person, mobilePhone: event.target.value } } }))} />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="study-workplace" className="text-xs font-medium">สถานที่ปฏิบัติงานปัจจุบัน <span className="text-danger">*</span></label>
                <Input id="study-workplace" value={workplace.organisation} onChange={(event) => update((current) => ({ ...current, applicant: { ...current.applicant, workplace: { ...current.applicant.workplace, organisation: event.target.value } } }))} />
              </div>
            </div>
            <LicenseEligibilityNotice status={licenseStatus} licenseNumber={currentMemberPassport.license.licenseNumber} checkedAt={licenseRecord?.checkedAt} compact />
          </Section>

          <Section step={next()} title="แนบหลักฐานประกอบการสมัคร">
            <p className="text-xs text-muted-foreground">ส่งใบสมัครได้ก่อนแล้วกลับมาแนบเพิ่มภายหลัง หลักฐานการชำระค่าธรรมเนียมแนบในขั้นชำระเงิน</p>
            <div className="grid gap-3 lg:grid-cols-2">
              {documents.map((document) => (
                <div key={document.id} className="rounded-lg border border-border bg-muted/20 p-3">
                  <FileUploadField
                    compact
                    label={document.label}
                    description={document.hint ?? "เอกสารที่ต้องใช้ประกอบการพิจารณา"}
                    required={document.required}
                    value={document.file}
                    onChange={(file) => setDocuments((current) => current.map((item) => (item.id === document.id ? { ...item, file, reviewStatus: "pending" } : item)))}
                  />
                </div>
              ))}
            </div>
          </Section>

          <Section step={next()} title="รับรองและส่งใบสมัคร">
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={Boolean(form.declaration)}
                onChange={(event) => update((current) => ({
                  ...current,
                  declaration: event.target.checked ? { accepted: true, signedName: "", signedAt: new Date().toISOString() } : undefined,
                }))}
              />
              {STUDY_APPLICATION_DECLARATION}
            </label>
            <div className="space-y-1.5">
              <label htmlFor="study-signature" className="text-xs font-medium">ลงชื่อผู้สมัคร (พิมพ์ &quot;{applicantFullName(person)}&quot;) <span className="text-danger">*</span></label>
              <Input
                id="study-signature"
                disabled={!form.declaration}
                value={form.declaration?.signedName ?? ""}
                onChange={(event) => update((current) => ({ ...current, declaration: { accepted: true, signedName: event.target.value, signedAt: new Date().toISOString() } }))}
              />
            </div>
            {errors.length > 0 && (
              <div role="alert" className="rounded-xl border border-danger-border bg-danger-soft p-4 text-sm text-danger-on-soft">
                <p className="font-semibold">กรุณาแก้ไขก่อนส่งใบสมัคร</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">{errors.map((error) => <li key={error}>{error}</li>)}</ul>
              </div>
            )}
            <Button className="min-h-11" onClick={submit} disabled={!licenseEligibility.canApplyForExam}>
              {flow?.actionLabel}
            </Button>
          </Section>
        </>
      )}
    </PageShell>
  );
}
