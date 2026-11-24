"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMockDb } from "@/providers/mock-db-provider";
import { PageShell } from "@/roles/shared/components/layout/PageShell";
import { COLLEGE_OPTIONS, type CollegeCode } from "@/roles/shared/data/college-directory";
import { profileData } from "@/roles/shared/data";
import { createAdmissionDocuments } from "@/roles/shared/features/admissions/documents";
import {
  admissionWording,
  programTypeLabel,
  resolveStudyFlow,
  studyOfferings,
  trainingInstitutionsFor,
} from "@/roles/shared/features/admissions/program-offerings";
import {
  findLicenseRegistryRecord,
  getLicenseEligibility,
  LicenseEligibilityNotice,
} from "@/roles/shared/features/license-eligibility";
import { COLLEGE_ORGANISATIONS, ORGANISATIONS } from "@/roles/shared/features/roles/access-model";
import { currentMemberPassport } from "@/roles/shared/member/domain/member";

// Programs without a training institution are handled by the owning college (seen by College Staff).
function collegeOrganisationId(collegeCode: string) {
  return COLLEGE_ORGANISATIONS.find((organisation) => organisation.code === collegeCode)?.id ?? ORGANISATIONS.royalCollege.id;
}

export default function StudyApplicationPage() {
  const router = useRouter();
  const { settings, setAdmissions } = useMockDb();
  const [collegeCode, setCollegeCode] = useState<CollegeCode | null>(null);
  const [offeringId, setOfferingId] = useState<string | null>(null);
  const [institutionId, setInstitutionId] = useState<string | null>(null);

  const licenseRecord = findLicenseRegistryRecord(currentMemberPassport.license.licenseNumber);
  const licenseStatus = licenseRecord?.status ?? "unverified";
  const licenseEligibility = getLicenseEligibility(licenseStatus);

  const offerings = collegeCode ? studyOfferings(collegeCode) : [];
  const offering = offerings.find((item) => item.id === offeringId);
  const flow = offering ? resolveStudyFlow(offering) : undefined;
  const institutions = offering ? trainingInstitutionsFor(offering) : [];

  const chooseCollege = (code: CollegeCode) => {
    setCollegeCode(code);
    setOfferingId(null);
    setInstitutionId(null);
  };

  const submitEntranceApplication = () => {
    if (!offering || !flow || flow.kind !== "entrance_exam") return;
    if (!licenseEligibility.canApplyForExam) {
      toast.error(`ไม่สามารถ${admissionWording.entranceExam}ได้`, { description: licenseEligibility.description });
      return;
    }
    if (offering.requiresTrainingInstitution && !institutionId) {
      toast.error("กรุณาเลือกสถาบันฝึกอบรม");
      return;
    }
    const submittedAt = new Date();
    setAdmissions((previous) => [
      {
        id: `ENT-2569-${Math.floor(Math.random() * 1000).toString().padStart(3, "0")}`,
        name: `${profileData.personalInfo.title}${profileData.personalInfo.firstName} ${profileData.personalInfo.lastName}`,
        license: profileData.personalInfo.licenseNumber || "รอตรวจสอบ",
        program: offering.titleTh,
        date: submittedAt.toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" }),
        submittedAt: submittedAt.toISOString(),
        // TODO(business): ใบสมัครวุฒิบัตรระบบ Credit Bank ส่งไปที่วิทยาลัย แต่เจ้าหน้าที่วิทยาลัยอนุมัติ/ปฏิเสธเองได้หรือไม่ยังรอยืนยัน
        institutionId: institutionId ?? collegeOrganisationId(offering.collegeCode),
        applicationType: "study",
        status: "pending",
        documents: createAdmissionDocuments(),
        documentStatus: "pending",
        licenseStatus,
        licenseCheckedAt: licenseRecord?.checkedAt ?? submittedAt.toISOString(),
      },
      ...previous,
    ]);
    toast.success(`ส่งใบ${admissionWording.entranceExam}แล้ว`, {
      description: "แนบเอกสารและติดตามสถานะได้ที่หน้าสถานะการสมัคร เมื่อได้รับอนุมัติจึงชำระค่าสมัครสอบ",
    });
    router.push("/member/admission");
  };

  return (
    <PageShell size="content" className="space-y-5">
      <Link href="/member/apply" className="inline-flex min-h-11 items-center gap-1 text-sm text-primary hover:underline">
        <span className="material-symbols-outlined text-base" aria-hidden="true">arrow_back</span>
        {admissionWording.hub}
      </Link>

      <Card>
        <CardHeader><CardTitle className="text-base">1. เลือกวิทยาลัย</CardTitle></CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {COLLEGE_OPTIONS.map((college) => (
            <Button
              key={college.value}
              type="button"
              variant={collegeCode === college.value ? "default" : "outline"}
              aria-pressed={collegeCode === college.value}
              className="h-auto min-h-11 justify-start whitespace-normal text-left"
              onClick={() => chooseCollege(college.value)}
            >
              {college.label}
            </Button>
          ))}
        </CardContent>
      </Card>

      {collegeCode && (
        <Card>
          <CardHeader><CardTitle className="text-base">2. เลือกหลักสูตร</CardTitle></CardHeader>
          <CardContent className="grid gap-2">
            {offerings.length === 0 && <p className="text-sm text-muted-foreground">ยังไม่มีหลักสูตรที่เปิดรับในวิทยาลัยนี้</p>}
            {offerings.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={offeringId === item.id}
                onClick={() => { setOfferingId(item.id); setInstitutionId(null); }}
                className={`flex min-h-11 flex-col gap-1 rounded-xl border p-4 text-left transition-colors hover:bg-muted/40 ${offeringId === item.id ? "border-primary bg-primary/5" : "border-border"}`}
              >
                <span className="font-medium">{item.titleTh}</span>
                <span className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary">{programTypeLabel[item.type]}</Badge>
                  {item.creditBankEligible && <Badge variant="info">Credit Bank</Badge>}
                  {item.admissionMethod === "entrance_exam" && <Badge variant="warning">ต้องสอบคัดเลือก</Badge>}
                </span>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {offering && flow && (
        <Card>
          <CardHeader><CardTitle className="text-base">3. ขั้นตอนของหลักสูตรนี้</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid gap-2 text-sm sm:grid-cols-3">
              <div><dt className="text-muted-foreground">ประเภท</dt><dd className="font-medium">{programTypeLabel[offering.type]}</dd></div>
              {offering.credits !== undefined && <div><dt className="text-muted-foreground">หน่วยกิต</dt><dd className="font-medium">{offering.credits}</dd></div>}
              {offering.examFee !== undefined && <div><dt className="text-muted-foreground">ค่าสมัครสอบคัดเลือก</dt><dd className="font-medium">{offering.examFee.toLocaleString("th-TH")} บาท</dd></div>}
            </dl>
            <ol aria-label="ขั้นตอนการสมัครเรียน" className="grid gap-2">
              {flow.steps.map((step, index) => (
                <li key={step} className="flex items-center gap-3 text-sm">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{index + 1}</span>
                  {step}
                </li>
              ))}
            </ol>

            {flow.kind !== "entrance_exam" && offering.shortCourseId && (
              <Button asChild className="min-h-11">
                <Link href={`/member/short-courses?course=${encodeURIComponent(offering.shortCourseId)}`}>{flow.actionLabel}</Link>
              </Button>
            )}

            {flow.kind === "entrance_exam" && (
              <div className="space-y-4">
                {offering.requiresTrainingInstitution && (
                  <fieldset className="space-y-2">
                    <legend className="text-sm font-medium">เลือกสถาบันฝึกอบรม</legend>
                    {institutions.length === 0 && (
                      // TODO(business): ยังไม่มีรายชื่อสถาบันฝึกอบรมและโควตาที่นั่งของหลักสูตรนี้ในข้อมูล mock
                      <p className="text-sm text-muted-foreground">ยังไม่มีสถาบันฝึกอบรมของหลักสูตรนี้ในระบบ</p>
                    )}
                    {institutions.map((institution) => (
                      <label key={institution.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-border px-3 text-sm">
                        <input
                          type="radio"
                          name="training-institution"
                          value={institution.id}
                          checked={institutionId === institution.id}
                          onChange={() => setInstitutionId(institution.id)}
                        />
                        {institution.name}
                      </label>
                    ))}
                  </fieldset>
                )}
                <LicenseEligibilityNotice
                  status={licenseStatus}
                  licenseNumber={currentMemberPassport.license.licenseNumber}
                  checkedAt={licenseRecord?.checkedAt}
                  compact
                />
                {!settings.admissionOpen && <p className="text-sm text-danger">ขณะนี้ปิดรับสมัคร</p>}
                <Button
                  className="min-h-11"
                  onClick={submitEntranceApplication}
                  disabled={
                    !settings.admissionOpen ||
                    !licenseEligibility.canApplyForExam ||
                    (offering.requiresTrainingInstitution && !institutionId)
                  }
                >
                  {flow.actionLabel}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </PageShell>
  );
}
