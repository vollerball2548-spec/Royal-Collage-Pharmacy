"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageShell } from "@/roles/shared/components/layout/PageShell";
import { EmptyState, ForbiddenState, LoadingState } from "@/roles/shared/components/workspace/WorkspacePrimitives";
import { shortCourseStatusMeta } from "@/roles/shared/features/short-course";
import { useCertificateCases } from "@/roles/staff/features/certificates/certificate-store";
import { useStudentPortal } from "@/roles/member/features/portal/use-student-portal";
import { formatPortalDateTime } from "@/roles/member/features/portal/ApprovalTimeline";

const credentialLabel = {
  board_certificate: "วุฒิบัตร",
  approval_certificate: "หนังสืออนุมัติ",
  diploma: "ประกาศนียบัตร",
} as const;

export default function MemberCertificatesPage() {
  const portal = useStudentPortal();
  const { records } = useCertificateCases();

  if (!portal.isReady) return <PageShell className="py-10"><LoadingState label="กำลังโหลด Certificate" /></PageShell>;
  if (!portal.isStudent) return <PageShell className="py-10"><ForbiddenState description="Certificate แสดงเฉพาะของผู้เรียนที่เข้าสู่ระบบ" /></PageShell>;

  // แสดงเฉพาะเอกสารของผู้เรียนเองที่ออกแล้วเท่านั้น
  const issuedCredentials = records.filter((record) => record.studentId === portal.studentId && record.status === "issued" && record.document);
  const shortCourseCertificates = portal.shortCourseEnrollments.filter((item) => item.status === "completed" && item.certificateNo);
  const trainingHistory = portal.shortCourseEnrollments.filter((item) => ["registered", "assessment_recorded", "completed", "failed"].includes(item.status));

  return (
    <PageShell size="wide" bottom="roomy" className="space-y-5">
      <div>
        <h2 className="font-heading text-xl font-semibold sm:text-2xl">Certificate</h2>
        <p className="mt-1 text-sm text-muted-foreground">เอกสารรับรองที่ออกแล้ว และประวัติการอบรม Short Course</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Certificate / วุฒิบัตรที่ได้รับ</CardTitle></CardHeader>
        <CardContent>
          {issuedCredentials.length === 0 && shortCourseCertificates.length === 0 ? (
            <EmptyState icon="workspace_premium" title="ยังไม่มี Certificate" description="Certificate จะแสดงเมื่อผ่านเงื่อนไขและได้รับการอนุมัติผลแล้ว" />
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {shortCourseCertificates.map((item) => (
                <li key={item.id} className="rounded-2xl border border-border p-4">
                  <div className="flex flex-wrap items-center gap-2"><Badge variant="success">Short Course</Badge>{item.creditBank ? <Badge variant="brand">Credit Bank {item.creditsAwarded} หน่วยกิต</Badge> : <Badge variant="neutral">ไม่ต่อยอด</Badge>}</div>
                  <p className="mt-2 font-semibold">{item.courseTitle}</p>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">เลขที่ {item.certificateNo}</p>
                  <p className="text-xs text-muted-foreground">ออกเมื่อ {formatPortalDateTime(item.certificateIssuedAt)} · {item.institutionName}</p>
                </li>
              ))}
              {issuedCredentials.map((record) => (
                <li key={record.id} className="rounded-2xl border border-border p-4">
                  <Badge variant="success">{credentialLabel[record.credentialType]}</Badge>
                  <p className="mt-2 font-semibold">{record.program}</p>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">เลขที่ {record.document!.id}</p>
                  <p className="text-xs text-muted-foreground">ออกเมื่อ {formatPortalDateTime(record.document!.issuedAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">ประวัติการอบรม (บันทึกใน Pharmacist Profile)</CardTitle></CardHeader>
        <CardContent>
          {trainingHistory.length === 0 ? <p className="text-sm text-muted-foreground">ยังไม่มีประวัติการอบรม</p> : (
            <ul className="space-y-2">
              {trainingHistory.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3 text-sm">
                  <span><span className="font-medium">{item.courseTitle}</span><span className="block text-xs text-muted-foreground">{item.creditBank ? "ต่อยอด Credit Bank" : "ไม่ต่อยอด"} · {item.institutionName}{item.assessment ? ` · บันทึกผลโดย ${item.assessment.recordedBy}` : ""}</span></span>
                  <Badge variant={shortCourseStatusMeta[item.status].variant}>{shortCourseStatusMeta[item.status].label}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
