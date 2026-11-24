"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SegmentedFilterButton, SegmentedFilterGroup } from "@/components/ui/segmented-filter";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageShell } from "@/roles/shared/components/layout/PageShell";
import {
  WeeklyTimetable,
  type WeeklyTimetableEvent,
} from "@/roles/shared/components/schedule/WeeklyTimetable";
import { EmptyState, ForbiddenState, LoadingState } from "@/roles/shared/components/workspace/WorkspacePrimitives";
import { formatCourseCode } from "@/roles/shared/data/college-directory";
import { useStudentPortal } from "@/roles/member/features/portal/use-student-portal";
import {
  buildStudentSchedule,
  studyStatusMeta,
  WEEKDAY_ROWS,
} from "@/roles/member/features/portal/student-schedule";

type ViewMode = "week" | "list";

export default function SchedulePage() {
  const portal = useStudentPortal();
  const { db, registrations, invoices, subjectResults, shortCourseEnrollments } = portal;
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [term, setTerm] = useState("all");

  const entries = useMemo(() => buildStudentSchedule({
    studentId: portal.studentId,
    registrations,
    invoices,
    courseOfferings: db.courseOfferings,
    institutions: db.academicInstitutions,
    teachingAssignments: db.teachingAssignments,
    teachers: db.academicTeachers,
    subjectResults,
    shortCourseEnrollments,
    programLabel: portal.programLabel,
  }), [db.academicInstitutions, db.academicTeachers, db.courseOfferings, db.teachingAssignments, invoices, portal.programLabel, portal.studentId, registrations, shortCourseEnrollments, subjectResults]);

  if (!portal.isReady) {
    return <PageShell className="py-10"><LoadingState label="กำลังโหลดตารางเรียน" /></PageShell>;
  }
  if (!portal.isStudent) {
    return <PageShell className="py-10"><ForbiddenState description="ตารางเรียนแสดงเฉพาะของผู้เรียนที่เข้าสู่ระบบ" /></PageShell>;
  }

  const terms = [...new Set(entries.map((entry) => entry.term))];
  const visible = entries.filter((entry) => term === "all" || entry.term === term);
  const events: WeeklyTimetableEvent[] = visible.flatMap((entry) => entry.weekday && entry.startTime && entry.endTime ? [{
    id: entry.id,
    rowId: `weekday-${entry.weekday}`,
    title: entry.courseTitle,
    kicker: formatCourseCode(entry.courseCode),
    meta: entry.mode === "clinical" ? "ฝึกปฏิบัติ" : entry.mode === "online" ? "ออนไลน์" : "ทฤษฎี",
    location: entry.location,
    startTime: entry.startTime,
    endTime: entry.endTime,
    tone: entry.mode === "clinical" ? "success" : "info",
  }] : []);
  const usedRows = WEEKDAY_ROWS.filter((row) => events.some((event) => event.rowId === row.id));
  const unscheduled = visible.filter((entry) => !entry.weekday);

  return (
    <PageShell bottom="roomy" className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-heading text-xl font-semibold sm:text-2xl">ตารางเรียน</h2>
          <p className="mt-1 text-sm text-muted-foreground">แสดงเฉพาะรายวิชาที่ลงทะเบียนและชำระเงินสำเร็จแล้ว</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="schedule-term" className="sr-only">ภาคเรียน</label>
          <select id="schedule-term" value={term} onChange={(event) => setTerm(event.target.value)} className="h-11 rounded-xl border border-border bg-background px-3 text-sm">
            <option value="all">ทุกภาคเรียน</option>
            {terms.map((item) => <option key={item} value={item}>{item === "รายหลักสูตร" ? "Short Course" : `ภาคเรียน ${item}`}</option>)}
          </select>
          <SegmentedFilterGroup aria-label="มุมมองตารางเรียน" className="grid grid-cols-2">
            <SegmentedFilterButton active={viewMode === "week"} onClick={() => setViewMode("week")}>รายสัปดาห์</SegmentedFilterButton>
            <SegmentedFilterButton active={viewMode === "list"} onClick={() => setViewMode("list")}>รายการรายวิชา</SegmentedFilterButton>
          </SegmentedFilterGroup>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="space-y-3">
          <EmptyState icon="event_busy" title="ยังไม่มีรายวิชาในตารางเรียน" description="รายวิชาจะแสดงที่นี่หลังคำขอได้รับอนุมัติและยืนยันการชำระเงินแล้ว" />
          <div className="flex justify-center"><Button asChild variant="outline" className="min-h-11"><Link href="/member/registration">ตรวจสอบสถานะการลงทะเบียน</Link></Button></div>
        </div>
      ) : viewMode === "week" ? (
        <>
          <div className="flex flex-wrap justify-end gap-2" aria-label="คำอธิบายประเภทรายวิชา">
            <Badge variant="info" className="px-2 py-1 text-xs">ทฤษฎี (Lecture)</Badge>
            <Badge variant="success" className="px-2 py-1 text-xs">ฝึกปฏิบัติ (Clinical)</Badge>
          </div>
          {usedRows.length > 0 ? (
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <WeeklyTimetable ariaLabel="ตารางเรียนรายสัปดาห์" dayStartTime="08:00" dayEndTime="21:00" events={events} rows={usedRows} />
              </CardContent>
            </Card>
          ) : null}
          {unscheduled.length > 0 ? (
            <Card><CardContent className="p-4 text-sm">
              <p className="font-semibold">รายการที่ยังไม่มีวันเวลาแน่นอน</p>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                {unscheduled.map((entry) => <li key={entry.id}>{entry.courseTitle} · {entry.scheduleLabel} · {entry.institutionName}</li>)}
              </ul>
            </CardContent></Card>
          ) : null}
        </>
      ) : (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className="min-w-[960px]" aria-label="รายการรายวิชาที่ลงทะเบียน">
                <TableHeader><TableRow>
                  <TableHead>หลักสูตร</TableHead><TableHead>รหัสวิชา</TableHead><TableHead>ชื่อวิชา</TableHead><TableHead>ภาคเรียน</TableHead>
                  <TableHead>วัน / เวลาเรียน</TableHead><TableHead>สถานที่</TableHead><TableHead>อาจารย์ผู้สอน</TableHead><TableHead>สถาบันฝึกอบรม</TableHead><TableHead>สถานะ</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {visible.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="max-w-48 whitespace-normal text-xs">{entry.programLabel}</TableCell>
                      <TableCell className="font-mono text-xs">{entry.courseCode === "—" ? "—" : formatCourseCode(entry.courseCode)}</TableCell>
                      <TableCell className="max-w-56 whitespace-normal font-medium">{entry.courseTitle}</TableCell>
                      <TableCell className="text-xs">{entry.term}</TableCell>
                      <TableCell className="text-xs">{entry.scheduleLabel}</TableCell>
                      <TableCell className="max-w-48 whitespace-normal text-xs">{entry.location}</TableCell>
                      <TableCell className="max-w-40 whitespace-normal text-xs">{entry.teacherNames.length > 0 ? entry.teacherNames.join(", ") : "รอประกาศ"}</TableCell>
                      <TableCell className="max-w-48 whitespace-normal text-xs">{entry.institutionName}</TableCell>
                      <TableCell><Badge variant={studyStatusMeta[entry.studyStatus].variant}>{studyStatusMeta[entry.studyStatus].label}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </PageShell>
  );
}
