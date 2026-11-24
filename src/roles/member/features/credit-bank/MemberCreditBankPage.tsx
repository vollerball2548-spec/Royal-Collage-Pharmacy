"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageShell } from "@/roles/shared/components/layout/PageShell";
import { EmptyState, ForbiddenState, LoadingState, MetricCard } from "@/roles/shared/components/workspace/WorkspacePrimitives";
import { formatCourseCode } from "@/roles/shared/data/college-directory";
import { courseCatalog } from "@/roles/shared/features/courses/course-catalog";
import { summarizeCreditBank, type CreditBankSubjectRow } from "@/roles/shared/features/credit-bank";
import { courseCategoryMeta } from "@/roles/shared/features/registration/student-portal";
import { useStudentPortal } from "@/roles/member/features/portal/use-student-portal";
import { formatPortalDateTime } from "@/roles/member/features/portal/ApprovalTimeline";

function SubjectTable({ rows, label }: { rows: readonly CreditBankSubjectRow[]; label: string }) {
  if (rows.length === 0) return <p className="px-5 pb-5 text-sm text-muted-foreground">ไม่มีรายการ</p>;
  return (
    <div className="overflow-x-auto">
      <Table className="min-w-[560px]" aria-label={label}>
        <TableHeader><TableRow><TableHead>รหัสวิชา</TableHead><TableHead>ชื่อวิชา</TableHead><TableHead>ประเภท</TableHead><TableHead>ภาคเรียน</TableHead><TableHead className="text-right">หน่วยกิต</TableHead></TableRow></TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.key}>
              <TableCell className="font-mono text-xs">{row.source === "course" ? formatCourseCode(row.courseCode) : row.courseCode}</TableCell>
              <TableCell className="max-w-72 whitespace-normal font-medium">{row.courseTitle}{row.source === "short_course" ? <Badge variant="outline" className="ml-2">Short Course</Badge> : null}</TableCell>
              <TableCell><Badge variant={courseCategoryMeta[row.category].variant}>{courseCategoryMeta[row.category].label}</Badge></TableCell>
              <TableCell className="text-xs">{row.term ?? "—"}</TableCell>
              <TableCell className="text-right tabular-nums">{row.credits}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function MemberCreditBankPage() {
  const portal = useStudentPortal();
  const { db, subjectResults, shortCourseEnrollments } = portal;
  const summary = useMemo(() => summarizeCreditBank({
    studentId: portal.studentId,
    collegeCode: portal.collegeCode,
    subjectResults,
    courseOfferings: db.courseOfferings,
    catalog: courseCatalog,
    shortCourseEnrollments,
  }), [db.courseOfferings, portal.collegeCode, portal.studentId, shortCourseEnrollments, subjectResults]);

  if (!portal.isReady) return <PageShell className="py-10"><LoadingState label="กำลังโหลด Credit Bank" /></PageShell>;
  if (!portal.isStudent) return <PageShell className="py-10"><ForbiddenState description="Credit Bank แสดงเฉพาะข้อมูลของผู้เรียนที่เข้าสู่ระบบ" /></PageShell>;

  const pendingApproval = shortCourseEnrollments.filter((item) => item.creditBank && item.status === "assessment_recorded");

  return (
    <PageShell size="wide" bottom="roomy" className="space-y-5">
      <div>
        <h2 className="font-heading text-xl font-semibold sm:text-2xl">Credit Bank</h2>
        <p className="mt-1 text-sm text-muted-foreground">หน่วยกิตสะสมนับเฉพาะผลที่ประกาศ/อนุมัติแล้วเท่านั้น · {portal.programLabel}</p>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="สรุปหน่วยกิต">
        <MetricCard size="sm" label="หน่วยกิตสะสม" value={summary.totalCredits} note={`ผ่าน ${summary.passed.length} รายวิชา`} icon="savings" emphasis="success" />
        <MetricCard size="sm" label={courseCategoryMeta.required.label} value={summary.creditsByCategory.required} note="หน่วยกิตที่ผ่าน" icon="verified" />
        <MetricCard size="sm" label={courseCategoryMeta.elective.label} value={summary.creditsByCategory.elective} note="รวม Short Course ที่อนุมัติแล้ว" icon="tune" />
        <MetricCard size="sm" label={courseCategoryMeta.practice.label} value={summary.creditsByCategory.practice} note="หน่วยกิตที่ผ่าน" icon="clinical_notes" />
      </section>

      {pendingApproval.length > 0 ? (
        <div role="note" className="rounded-xl border border-info-border bg-info-soft p-4 text-sm text-info-on-soft">
          มีผลการประเมิน Short Course รอเจ้าหน้าที่ราชวิทยาลัยอนุมัติ {pendingApproval.length} รายการ — หน่วยกิตจะถูกเพิ่มหลังอนุมัติเท่านั้น
        </div>
      ) : null}

      <Card><CardHeader><CardTitle className="text-base">วิชาที่ผ่าน</CardTitle></CardHeader><CardContent className="p-0"><SubjectTable rows={summary.passed} label="วิชาที่ผ่าน" /></CardContent></Card>
      <Card>
        <CardHeader><CardTitle className="text-base">วิชาที่ยังไม่ผ่าน</CardTitle></CardHeader>
        <CardContent className="p-0">
          <SubjectTable rows={summary.failed} label="วิชาที่ยังไม่ผ่าน" />
          {summary.failed.length > 0 ? <p className="px-5 pb-5 text-xs text-muted-foreground">ลงทะเบียนเรียนในภาคเรียนถัดไปได้ หรือยื่นคำร้องสอบซ่อม (ครั้งที่ 2 ขึ้นไป 500 บาท) ที่ <Link href="/member/results" className="text-primary underline-offset-4 hover:underline">ผลการเรียน / ผลสอบ</Link></p> : null}
        </CardContent>
      </Card>
      <Card><CardHeader><CardTitle className="text-base">วิชาที่ยังไม่ได้เรียน</CardTitle></CardHeader><CardContent className="p-0"><SubjectTable rows={summary.notTaken} label="วิชาที่ยังไม่ได้เรียน" /></CardContent></Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Certificate ที่ได้รับ</CardTitle></CardHeader>
        <CardContent>
          {summary.certificates.length === 0 ? (
            <EmptyState icon="workspace_premium" title="ยังไม่มี Certificate" description="Certificate จะแสดงเมื่อผ่านเงื่อนไขและได้รับการอนุมัติผลแล้ว" />
          ) : (
            <ul className="space-y-2">
              {summary.certificates.map((certificate) => (
                <li key={certificate.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3 text-sm">
                  <span><span className="font-medium">{certificate.title}</span><span className="block font-mono text-xs text-muted-foreground">{certificate.id}</span></span>
                  <span className="text-xs text-muted-foreground">ออกเมื่อ {formatPortalDateTime(certificate.issuedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
