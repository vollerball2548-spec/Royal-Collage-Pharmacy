"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMockDb } from "@/providers/mock-db-provider";
import { PageShell } from "@/roles/shared/components/layout/PageShell";
import {
  EmptyState,
  ForbiddenState,
  LoadingState,
  MetricCard,
  WorkspaceHeader,
} from "@/roles/shared/components/workspace/WorkspacePrimitives";
import type { AdmissionExamRoundStatus } from "@/roles/shared/features/admissions/admission-exam-workflow";
import { admissionWording } from "@/roles/shared/features/admissions/program-offerings";
import { ORGANISATION_LIST } from "@/roles/shared/features/roles/access-model";
import { usePortalSession } from "@/roles/shared/features/roles/use-portal-session";
import { canAccessCollegeStaffWorkspace, isInCollegeScope } from "@/roles/staff/staff-access";

const admissionStatusMeta = {
  pending: { label: "รอพิจารณา", variant: "warning" },
  approved: { label: "อนุมัติแล้ว", variant: "success" },
  rejected: { label: "ไม่อนุมัติ", variant: "danger" },
} as const;

const roundStatusLabel: Record<AdmissionExamRoundStatus, string> = {
  draft: "ร่าง",
  open: "เปิดรับ",
  closed: "ปิดรับ",
  results_draft: "กำลังบันทึกผล",
  published: "ประกาศผลแล้ว",
  cancelled: "ยกเลิก",
};

function organisationName(id: string) {
  return ORGANISATION_LIST.find((organisation) => organisation.id === id)?.name ?? id;
}

export default function CollegeStaffWorkspacePage() {
  const { session, isReady } = usePortalSession();
  const { admissions, admissionExamRounds, isLoaded } = useMockDb();

  if (!isReady || !isLoaded) return <PageShell className="py-10"><LoadingState label="กำลังโหลดข้อมูลวิทยาลัย" /></PageShell>;
  if (!session || !canAccessCollegeStaffWorkspace(session)) {
    return <PageShell className="py-10"><ForbiddenState description="หน้านี้สำหรับเจ้าหน้าที่วิทยาลัย และแสดงเฉพาะข้อมูลของวิทยาลัยที่สังกัด" /></PageShell>;
  }

  const collegeAdmissions = admissions.filter((admission) => isInCollegeScope(session, admission.institutionId));
  const collegeRounds = admissionExamRounds.filter((round) => isInCollegeScope(session, round.institutionId));
  const pendingCount = collegeAdmissions.filter((admission) => admission.status === "pending").length;

  return (
    <PageShell size="wide" bottom="roomy" className="space-y-5">
      <WorkspaceHeader
        eyebrow={session.organisation.name}
        title="งานวิทยาลัย"
        description="ติดตามใบสมัครและรอบสอบคัดเลือกของสถาบันฝึกอบรมในวิทยาลัยนี้เท่านั้น ข้อมูลของวิทยาลัยอื่นและงานส่วนกลางจะไม่แสดง"
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="ใบสมัครทั้งหมด" value={collegeAdmissions.length} note="สมัครสอบคัดเลือก / สมัครสอบอนุมัติ" icon="assignment" />
        <MetricCard label="รอพิจารณา" value={pendingCount} note="รอสถาบันหรือวิทยาลัยพิจารณา" icon="pending_actions" emphasis={pendingCount > 0 ? "warning" : "default"} />
        <MetricCard label="รอบสอบคัดเลือก" value={collegeRounds.length} note="ทุกสถานะ" icon="event" />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">ใบสมัครของวิทยาลัย</CardTitle></CardHeader>
        <CardContent className="p-0">
          {collegeAdmissions.length === 0 ? (
            <div className="p-5"><EmptyState title="ยังไม่มีใบสมัคร" description="เมื่อมีผู้สมัครในหลักสูตรของวิทยาลัยนี้ รายการจะแสดงที่นี่" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>เลขที่</TableHead>
                  <TableHead>ผู้สมัคร</TableHead>
                  <TableHead>หลักสูตร</TableHead>
                  <TableHead>ประเภท</TableHead>
                  <TableHead>หน่วยงานที่รับเรื่อง</TableHead>
                  <TableHead>สถานะ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {collegeAdmissions.map((admission) => (
                  <TableRow key={admission.id}>
                    <TableCell className="font-mono text-xs">{admission.id}</TableCell>
                    <TableCell>{admission.name}</TableCell>
                    <TableCell>{admission.program}</TableCell>
                    <TableCell>{admission.applicationType === "study" ? admissionWording.entranceExam : admissionWording.approvalExam}</TableCell>
                    <TableCell>{organisationName(admission.institutionId)}</TableCell>
                    <TableCell><Badge variant={admissionStatusMeta[admission.status].variant}>{admissionStatusMeta[admission.status].label}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">รอบสอบคัดเลือก</CardTitle></CardHeader>
        <CardContent className="p-0">
          {collegeRounds.length === 0 ? (
            <div className="p-5"><EmptyState icon="event_busy" title="ยังไม่มีรอบสอบ" description="รอบสอบที่สถาบันในวิทยาลัยนี้สร้างจะแสดงที่นี่" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>รอบสอบ</TableHead>
                  <TableHead>สถาบัน</TableHead>
                  <TableHead>ผู้มีสิทธิ์สอบ / ที่นั่ง</TableHead>
                  <TableHead>สถานะ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {collegeRounds.map((round) => (
                  <TableRow key={round.id}>
                    <TableCell>{round.title}</TableCell>
                    <TableCell>{organisationName(round.institutionId)}</TableCell>
                    <TableCell className="tabular-nums">{round.candidateAdmissionIds.length} / {round.capacity}</TableCell>
                    <TableCell><Badge variant="secondary">{roundStatusLabel[round.status]}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* TODO(business): เจ้าหน้าที่วิทยาลัยเปิด-ปิดรอบสอบ, ประกาศผลสอบคัดเลือก, พิจารณาใบสมัครวุฒิบัตรระบบ Credit Bank และกลั่นกรองคำขอหลักสูตรได้เองหรือไม่ (permission matrix ❓) — เมื่อยืนยันแล้วจึงเปิดปุ่มดำเนินการ */}
      <p className="text-xs text-muted-foreground">ขณะนี้เป็นการดูอย่างเดียว ส่วนการเปิด-ปิดรอบสอบ ประกาศผล และกลั่นกรองหลักสูตร จะเปิดให้ใช้เมื่อราชวิทยาลัยยืนยันขอบเขตสิทธิ์ของเจ้าหน้าที่วิทยาลัยแล้ว</p>
    </PageShell>
  );
}
