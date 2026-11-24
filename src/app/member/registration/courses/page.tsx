"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { PageShell } from "@/roles/shared/components/layout/PageShell";
import { WorkflowStateTimeline, type WorkflowStateStep } from "@/roles/shared/components/workspace/WorkflowStateTimeline";
import { EmptyState, ForbiddenState, LoadingState } from "@/roles/shared/components/workspace/WorkspacePrimitives";
import { COLLEGE_OPTIONS, formatCollegeCourseCode } from "@/roles/shared/data/college-directory";
import { UNIVERSITY_OPTIONS } from "@/roles/shared/data/university-directory";
import { COURSE_SCHEDULE_DETAILS } from "@/roles/shared/features/academic/course-schedule";
import { getRegistrationWindowStatus } from "@/roles/shared/features/registration/registration-window";
import {
  courseCategoryMeta,
  findDuplicateRegistration,
  portalStageMeta,
  resolveCourseCategory,
  resolveRegistrationStage,
  type CourseCategory,
} from "@/roles/shared/features/registration/student-portal";
import {
  buildOpenRegistrationCourses,
  filterOpenRegistrationCourses,
  openRegistrationFilterOptions,
  type OpenRegistrationCourse,
  type OpenRegistrationFilters,
} from "@/roles/member/features/registration/open-registration-catalog";
import { useStudentPortal } from "@/roles/member/features/portal/use-student-portal";

const filterSelectClassName = "h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30";
const CATEGORY_ORDER: readonly CourseCategory[] = ["required", "elective", "practice"];
/** อัตราเดียวกับใบแจ้งชำระในระบบ (หน่วยกิต × 1,000 บาท) ใช้แสดงประมาณการเท่านั้น */
const ESTIMATED_FEE_PER_CREDIT = 1_000;

function courseCategory(course: OpenRegistrationCourse): CourseCategory {
  return resolveCourseCategory({
    classification: course.definition.classification,
    scheduleMode: COURSE_SCHEDULE_DETAILS[course.offering.id]?.mode,
  });
}

export default function CourseRegistrationPage() {
  const portal = useStudentPortal();
  const { db, actor, collegeCode, registrations, invoices, payments, subjectResults } = portal;
  const [filters, setFilters] = useState<Required<OpenRegistrationFilters>>({
    query: "", college: "all", university: "all", academicYear: "all", term: "all",
  });
  const [collegeInitialized, setCollegeInitialized] = useState(false);
  const [cart, setCart] = useState<Set<string>>(new Set());
  const [expandedOfferingId, setExpandedOfferingId] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitted, setSubmitted] = useState<{ count: number; skipped: string[] } | null>(null);
  const [syllabusPreviewCourse, setSyllabusPreviewCourse] = useState<OpenRegistrationCourse | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const reviewTriggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  // ขั้นตอนที่ 1: ตั้งค่าเริ่มต้นเป็นหลักสูตร (วิทยาลัย) ที่ผู้เรียนกำลังศึกษา
  if (!collegeInitialized && collegeCode) {
    setCollegeInitialized(true);
    setFilters((previous) => ({ ...previous, college: collegeCode }));
  }

  const registrationWindow = getRegistrationWindowStatus({
    enabled: db.settings.registrationOpen,
    opensAt: db.settings.registrationOpensAt,
    closesAt: db.settings.registrationClosesAt,
    now,
  });
  const openCourses = useMemo(
    () => buildOpenRegistrationCourses(db.courseOfferings, db.academicInstitutions),
    [db.academicInstitutions, db.courseOfferings],
  );
  const filterOptions = useMemo(() => openRegistrationFilterOptions(openCourses), [openCourses]);
  const institutionOptions = useMemo(() => [
    ...UNIVERSITY_OPTIONS,
    ...filterOptions.universities.filter((institution) => !UNIVERSITY_OPTIONS.some((option) => option === institution)),
  ], [filterOptions.universities]);
  const displayedCourses = useMemo(() => filterOpenRegistrationCourses(openCourses, filters), [filters, openCourses]);

  const passedCodes = useMemo(() => new Set(subjectResults.flatMap((result) => {
    if (result.currentValue !== "S" || (result.status !== "published" && result.status !== "revised")) return [];
    const offering = db.courseOfferings.find((item) => item.id === result.courseOfferingId);
    return offering ? [offering.courseCode] : [];
  })), [db.courseOfferings, subjectResults]);

  const courseState = (course: OpenRegistrationCourse) => {
    const existing = findDuplicateRegistration(registrations, {
      studentId: portal.studentId,
      courseCode: course.offering.courseCode,
      term: course.offering.term,
    });
    if (existing) {
      const invoice = invoices.find((item) => item.registrationId === existing.id);
      const payment = invoice ? payments.find((item) => item.invoiceId === invoice.id) : undefined;
      return { kind: "existing" as const, stage: resolveRegistrationStage(existing, { invoiceStatus: invoice?.status, paymentStatus: payment?.status }) };
    }
    if (passedCodes.has(course.offering.courseCode)) return { kind: "passed" as const };
    return { kind: "available" as const };
  };

  const cartCourses = openCourses.filter((course) => cart.has(course.offering.id));
  const cartCredits = cartCourses.reduce((sum, course) => sum + course.definition.credits, 0);
  const activeFilterCount = Object.entries(filters).filter(([key, value]) => (
    key === "query" ? value.trim().length > 0 : value !== "all"
  )).length;

  const steps: WorkflowStateStep[] = [
    { id: "program", label: "เลือกหลักสูตร", description: filters.college === "all" ? "ยังไม่เลือก" : filters.college, state: filters.college === "all" ? "waiting" : "completed" },
    { id: "term", label: "ปีการศึกษา / ภาคเรียน", description: filters.academicYear !== "all" && filters.term !== "all" ? `${filters.term}/${filters.academicYear}` : "ยังไม่ระบุครบ", state: filters.academicYear !== "all" && filters.term !== "all" ? "completed" : "waiting" },
    { id: "courses", label: "เลือกรายวิชา", description: `${cart.size} รายวิชา`, state: cart.size > 0 || submitted ? "completed" : "waiting" },
    { id: "review", label: "ตรวจสอบรายการ", description: submitted ? "ตรวจสอบแล้ว" : "รอตรวจสอบ", state: submitted ? "completed" : "waiting" },
    { id: "submit", label: "ส่งคำขออนุมัติ", description: submitted ? "ส่งแล้ว รอสถาบันพิจารณา" : "ยังไม่ส่ง", state: submitted ? "completed" : "waiting" },
  ];
  const currentStepId = submitted ? "submit" : reviewOpen ? "review" : steps.find((step) => step.state !== "completed")?.id;
  const progressSteps = steps.map((step) => ({ ...step, current: step.id === currentStepId }));

  const updateFilter = (key: keyof OpenRegistrationFilters, value: string) => {
    setSubmitted(null);
    setFilters((previous) => ({ ...previous, [key]: value }));
  };

  const toggleCart = (course: OpenRegistrationCourse) => {
    setSubmitted(null);
    setCart((previous) => {
      const next = new Set(previous);
      if (next.has(course.offering.id)) {
        next.delete(course.offering.id);
        return next;
      }
      // ภาคเรียนเดียวกันเลือกวิชาเดียวกันได้เพียง 1 รายการ
      for (const id of next) {
        const other = openCourses.find((item) => item.offering.id === id);
        if (other && other.offering.courseCode === course.offering.courseCode && other.offering.term === course.offering.term) next.delete(id);
      }
      next.add(course.offering.id);
      return next;
    });
  };

  const handleSubmit = () => {
    if (!actor || cartCourses.length === 0 || isSubmitting) return;
    setSubmitError("");
    setIsSubmitting(true);
    try {
      const result = db.submitStudentRegistrations(actor, cartCourses.map((course) => ({
        studentId: actor.userId,
        studentName: actor.displayName,
        courseId: course.definition.id,
        courseCode: course.offering.courseCode,
        courseTitle: course.offering.courseTitle,
        credits: course.offering.credits,
        term: course.offering.term,
        courseOfferingId: course.offering.id,
        institutionId: course.offering.institutionId,
      })));
      setSubmitted({ count: result.created.length, skipped: result.skippedDuplicates });
      setCart(new Set());
      if (result.created.length > 0) {
        toast.success(`ส่งคำขอลงทะเบียน ${result.created.length} รายวิชาแล้ว`, { description: "รอสถาบันหลักพิจารณาอนุมัติก่อนเปิดชำระเงิน" });
      } else {
        toast.warning("ไม่มีรายวิชาใหม่ถูกส่ง", { description: "รายวิชาที่เลือกลงทะเบียนในภาคเรียนนี้แล้ว" });
      }
    } catch (error) {
      setSubmitError(error instanceof Error && error.message === "Registration window is not open"
        ? "ขณะนี้ไม่อยู่ในช่วงเวลาลงทะเบียน"
        : error instanceof Error ? error.message : "ส่งคำขอไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!portal.isReady) {
    return <PageShell className="py-10"><LoadingState label="กำลังโหลดข้อมูลการลงทะเบียน" /></PageShell>;
  }
  if (!portal.isStudent) {
    return <PageShell className="py-10"><ForbiddenState description="หน้าลงทะเบียนเรียนใช้ได้เฉพาะผู้เรียนที่เข้าสู่ระบบ" /></PageShell>;
  }

  const grouped = CATEGORY_ORDER.map((category) => ({
    category,
    courses: displayedCourses.filter((course) => courseCategory(course) === category),
  })).filter((group) => group.courses.length > 0);

  return (
    <PageShell size="wide" bottom="roomy" className="space-y-5">
      <Card>
        <CardContent className="space-y-3 p-4 sm:p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span aria-hidden="true" className="material-symbols-outlined text-xl text-primary">schedule</span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-heading text-sm font-semibold">ช่วงเวลาลงทะเบียนรายเทอม</h2>
                  <Badge variant={registrationWindow.tone}>{registrationWindow.label}</Badge>
                </div>
                <p role="timer" aria-live="off" className="mt-0.5 text-xs tabular-nums text-muted-foreground">{registrationWindow.detail}</p>
              </div>
            </div>
            <Button asChild variant="outline" className="min-h-11 sm:min-h-9">
              <Link href="/member/registration"><span aria-hidden="true" className="material-symbols-outlined text-lg">how_to_reg</span>สถานะการลงทะเบียน</Link>
            </Button>
          </div>
          <WorkflowStateTimeline steps={progressSteps} label="ขั้นตอนการลงทะเบียนเรียน" />
          <p className="text-xs text-muted-foreground">
            ลำดับถัดไปหลังส่งคำขอ: สถาบันหลักพิจารณาอนุมัติ → ชำระเงิน → ลงทะเบียนสำเร็จและแสดงในตารางเรียน
            · Short Course ลงทะเบียนรายหลักสูตรที่ <Link href="/member/short-courses" className="font-medium text-primary underline-offset-4 hover:underline">หน้า Short Course</Link>
          </p>
        </CardContent>
      </Card>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section aria-labelledby="open-courses-heading" className="min-w-0 space-y-4">
          <div>
            <h2 id="open-courses-heading" className="font-heading text-xl font-semibold text-foreground sm:text-2xl">รายวิชาที่เปิดให้ลงทะเบียน</h2>
            <p className="mt-1 text-sm text-muted-foreground">เลือกหลักสูตร ปีการศึกษา และภาคเรียน แล้วเพิ่มรายวิชาลงรายการลงทะเบียน</p>
          </div>

          <Card>
            <CardContent className="p-5">
              <form role="search" onSubmit={(event) => event.preventDefault()} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <div><label htmlFor="course-college" className="mb-1.5 block text-sm font-medium">1. หลักสูตร (วิทยาลัย)</label><select id="course-college" value={filters.college} onChange={(event) => updateFilter("college", event.target.value)} className={filterSelectClassName}><option value="all">ทุกหลักสูตร</option>{COLLEGE_OPTIONS.map((college) => <option key={college.value} value={college.value}>{college.label}</option>)}</select></div>
                <div><label htmlFor="course-year" className="mb-1.5 block text-sm font-medium">2. ปีการศึกษา</label><select id="course-year" value={filters.academicYear} onChange={(event) => updateFilter("academicYear", event.target.value)} className={filterSelectClassName}><option value="all">ทุกปีการศึกษา</option>{filterOptions.academicYears.map((year) => <option key={year} value={year}>{year}</option>)}</select></div>
                <div><label htmlFor="course-term" className="mb-1.5 block text-sm font-medium">3. ภาคเรียน</label><select id="course-term" value={filters.term} onChange={(event) => updateFilter("term", event.target.value)} className={filterSelectClassName}><option value="all">ทุกภาคเรียน</option>{filterOptions.terms.map((term) => <option key={term} value={term}>ภาคเรียนที่ {term}</option>)}</select></div>
                <div><label htmlFor="course-institution" className="mb-1.5 block text-sm font-medium">สถาบันฝึกอบรม</label><select id="course-institution" value={filters.university} onChange={(event) => updateFilter("university", event.target.value)} className={filterSelectClassName}><option value="all">ทุกสถาบัน</option>{institutionOptions.map((institution) => <option key={institution}>{institution}</option>)}</select></div>
                <div>
                  <label htmlFor="course-search" className="mb-1.5 block text-sm font-medium">ค้นหารายวิชา</label>
                  <Input id="course-search" type="search" value={filters.query} onChange={(event) => updateFilter("query", event.target.value)} placeholder="รหัสหรือชื่อรายวิชา" className="h-11 rounded-xl text-sm" />
                </div>
              </form>
              <div className="mt-4 flex min-h-11 flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                <p role="status" aria-live="polite" className="text-sm text-muted-foreground">พบ <strong className="font-semibold tabular-nums text-foreground">{displayedCourses.length}</strong> รายวิชาที่เปิดสอน</p>
                <Button type="button" variant="ghost" className="min-h-11" onClick={() => setFilters({ query: "", college: "all", university: "all", academicYear: "all", term: "all" })} disabled={activeFilterCount === 0}><span aria-hidden="true" className="material-symbols-outlined text-lg">filter_alt_off</span>ล้างตัวกรอง{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}</Button>
              </div>
            </CardContent>
          </Card>

          {grouped.length === 0 ? (
            <EmptyState icon="search_off" title={openCourses.length === 0 ? "ยังไม่มีรายวิชาเปิดลงทะเบียน" : "ไม่พบรายวิชาที่ตรงกับเงื่อนไข"} description={openCourses.length === 0 ? "เมื่อมีรายวิชาเปิดรับ รายการจะแสดงในส่วนนี้" : "ลองเปลี่ยนหลักสูตร ปีการศึกษา ภาคเรียน หรือล้างตัวกรอง"} />
          ) : grouped.map((group) => (
            <section key={group.category} aria-labelledby={`category-${group.category}`} className="space-y-3">
              <h3 id={`category-${group.category}`} className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Badge variant={courseCategoryMeta[group.category].variant}>{courseCategoryMeta[group.category].label}</Badge>
                <span className="text-muted-foreground">{group.courses.length} รายวิชา</span>
              </h3>
              {group.courses.map((course) => {
                const state = courseState(course);
                const inCart = cart.has(course.offering.id);
                const isExpanded = expandedOfferingId === course.offering.id;
                const detailsId = `course-details-${course.offering.id}`;
                const code = formatCollegeCourseCode(course.definition.code, course.definition.collegeCode);
                return (
                  <article key={course.offering.id} className="overflow-hidden rounded-2xl border border-border bg-card shadow-app-card">
                    <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-primary">{code}</span>
                          <Badge variant="outline">{course.definition.collegeCode}</Badge>
                          {state.kind === "existing" ? <Badge variant={portalStageMeta[state.stage].variant}>{portalStageMeta[state.stage].label}</Badge> : null}
                          {state.kind === "passed" ? <Badge variant="success">ผ่านแล้ว</Badge> : null}
                          {inCart ? <Badge variant="brand">อยู่ในรายการลงทะเบียน</Badge> : null}
                        </div>
                        <h4 className="mt-2 text-base font-semibold leading-6 text-foreground">{course.definition.titleTh}</h4>
                        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                          <span>ภาคเรียน {course.offering.term}</span>
                          <span>{course.universityName}</span>
                          <span>{course.definition.credits} หน่วยกิต</span>
                          <span>{course.schedule}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                        <Button variant="ghost" className="min-h-11" aria-expanded={isExpanded} aria-controls={detailsId} onClick={() => setExpandedOfferingId(isExpanded ? null : course.offering.id)}>
                          {isExpanded ? "ซ่อนรายละเอียด" : "ดูรายละเอียด"}
                          <span aria-hidden="true" className="material-symbols-outlined text-lg">{isExpanded ? "expand_less" : "expand_more"}</span>
                        </Button>
                        {state.kind === "available" ? (
                          <Button
                            className="min-h-11"
                            variant={inCart ? "outline" : "default"}
                            disabled={!registrationWindow.canRegister}
                            aria-label={`${inCart ? "นำออกจากรายการ" : "เลือกวิชา"} ${code}`}
                            onClick={() => toggleCart(course)}
                          >
                            {inCart ? "นำออก" : "เลือกวิชา"}
                          </Button>
                        ) : (
                          <Button asChild variant="outline" className="min-h-11"><Link href="/member/registration">ดูสถานะ</Link></Button>
                        )}
                      </div>
                    </div>
                    {isExpanded ? (
                      <div id={detailsId} className="border-t border-border bg-surface-container-low p-4">
                        <p className="mb-3 text-xs leading-5 text-muted-foreground">{course.definition.titleEn}</p>
                        <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                          <div><dt className="text-xs text-muted-foreground">ประเภทวิชา</dt><dd className="mt-0.5 font-medium">{courseCategoryMeta[courseCategory(course)].label}</dd></div>
                          <div><dt className="text-xs text-muted-foreground">ปี / ภาคการศึกษา</dt><dd className="mt-0.5 font-medium">{course.academicYear} / {course.term}</dd></div>
                          <div><dt className="text-xs text-muted-foreground">สถานที่เรียน</dt><dd className="mt-0.5 font-medium">{course.room}</dd></div>
                          <div><dt className="text-xs text-muted-foreground">หน่วยงานผู้ดูแล</dt><dd className="mt-0.5 font-medium">{course.universityName}</dd></div>
                        </dl>
                        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                          <div className="w-full max-w-xl">
                            <div className="flex justify-between gap-3 text-xs"><span>จำนวนรับ {course.definition.capacity} คน</span><span>ลงทะเบียนแล้ว {course.definition.enrolled} คน</span></div>
                            <Progress value={course.definition.enrolled} max={course.definition.capacity} tone={course.definition.enrolled >= course.definition.capacity ? "warning" : "brand"} className="mt-2" aria-label={`ลงทะเบียนแล้ว ${course.definition.enrolled} จาก ${course.definition.capacity} คน วิชา ${code}`} />
                          </div>
                          {course.syllabus ? (
                            <Button type="button" variant="outline" className="min-h-11 shrink-0" onClick={() => setSyllabusPreviewCourse(course)}>
                              <span aria-hidden="true" className="material-symbols-outlined text-lg">picture_as_pdf</span>Syllabus (.pdf)
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </section>
          ))}
        </section>

        <aside aria-labelledby="registration-summary-heading" className="xl:sticky xl:top-24">
          <Card>
            <CardHeader className="pb-2"><CardTitle id="registration-summary-heading" className="text-base">สรุปรายการลงทะเบียน</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {submitted ? (
                <div role="status" className="rounded-xl border border-success-border bg-success-soft p-3 text-sm text-success-on-soft">
                  <p className="font-semibold">ส่งคำขอแล้ว {submitted.count} รายวิชา</p>
                  <p className="mt-1 text-xs">สถานะ: รออนุมัติ — ยังไม่ต้องชำระเงินจนกว่าสถาบันหลักจะอนุมัติ</p>
                  {submitted.skipped.length > 0 ? <p className="mt-1 text-xs">ข้ามรายการที่ลงทะเบียนในภาคเรียนนี้แล้ว: {submitted.skipped.join(", ")}</p> : null}
                  <Button asChild size="sm" className="mt-3 min-h-11"><Link href="/member/registration">ติดตามสถานะ</Link></Button>
                </div>
              ) : null}
              {cartCourses.length === 0 ? (
                <p className="text-sm text-muted-foreground">ยังไม่ได้เลือกรายวิชา</p>
              ) : (
                <ul className="space-y-2" aria-label="รายวิชาที่เลือก">
                  {cartCourses.map((course) => (
                    <li key={course.offering.id} className="flex items-start justify-between gap-2 rounded-xl border border-border p-3 text-sm">
                      <span className="min-w-0"><span className="block font-mono text-xs text-primary">{formatCollegeCourseCode(course.definition.code, course.definition.collegeCode)}</span><span className="block font-medium leading-5">{course.definition.titleTh}</span><span className="block text-xs text-muted-foreground">ภาคเรียน {course.offering.term}</span></span>
                      <span className="shrink-0 tabular-nums">{course.definition.credits} นก.</span>
                    </li>
                  ))}
                </ul>
              )}
              <dl className="grid grid-cols-2 gap-3 rounded-xl bg-surface-container-low p-3 text-sm">
                <div><dt className="text-xs text-muted-foreground">รายวิชา</dt><dd className="font-semibold tabular-nums">{cartCourses.length}</dd></div>
                <div><dt className="text-xs text-muted-foreground">หน่วยกิตรวม</dt><dd className="font-semibold tabular-nums">{cartCredits}</dd></div>
                <div className="col-span-2"><dt className="text-xs text-muted-foreground">ประมาณการค่าลงทะเบียน</dt><dd className="font-semibold tabular-nums">฿{(cartCredits * ESTIMATED_FEE_PER_CREDIT).toLocaleString()}</dd><p className="text-2xs text-muted-foreground">ยอดจริงเปิดหลังได้รับอนุมัติ</p></div>
              </dl>
              {!registrationWindow.canRegister ? (
                <p role="note" className="rounded-xl border border-warning-border bg-warning-soft p-3 text-xs text-warning-on-soft">{registrationWindow.label} — ส่งคำขอได้เฉพาะในช่วงเวลาลงทะเบียน</p>
              ) : null}
              <Button
                ref={reviewTriggerRef}
                className="min-h-11 w-full"
                disabled={cartCourses.length === 0 || !registrationWindow.canRegister}
                onClick={() => { setSubmitError(""); setReviewOpen(true); }}
              >
                ตรวจสอบรายการและยืนยัน
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>

      <Dialog open={Boolean(syllabusPreviewCourse?.syllabus)} onOpenChange={(open) => { if (!open) setSyllabusPreviewCourse(null); }}>
        <DialogContent className="flex h-[min(90dvh,900px)] max-h-[calc(100dvh-2rem)] flex-col gap-4 overflow-hidden p-4 sm:max-w-5xl sm:p-6">
          <DialogHeader className="shrink-0 pr-12">
            <DialogTitle className="text-balance text-xl font-semibold leading-7">
              {syllabusPreviewCourse ? `${formatCollegeCourseCode(syllabusPreviewCourse.definition.code, syllabusPreviewCourse.definition.collegeCode)} · ${syllabusPreviewCourse.definition.titleTh}` : "เอกสารประกอบรายวิชา"}
            </DialogTitle>
            <DialogDescription className="font-normal leading-6">Syllabus (.pdf)</DialogDescription>
          </DialogHeader>
          {syllabusPreviewCourse?.syllabus ? (
            <iframe title={`เอกสาร Syllabus ${syllabusPreviewCourse.definition.titleTh}`} src={syllabusPreviewCourse.syllabus.url} className="min-h-0 w-full flex-1 rounded-xl border border-border bg-background" />
          ) : null}
          <DialogFooter className="shrink-0"><DialogClose asChild><Button type="button" variant="outline" className="min-h-11">ปิด</Button></DialogClose></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reviewOpen} onOpenChange={(open) => { if (!isSubmitting) setReviewOpen(open); }}>
        <DialogContent
          className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"
          aria-describedby="registration-review-description"
          onCloseAutoFocus={(event) => { event.preventDefault(); reviewTriggerRef.current?.focus(); }}
        >
          <DialogHeader>
            <DialogTitle className="text-xl">{submitted ? "ส่งคำขอลงทะเบียนแล้ว" : "ตรวจสอบรายการลงทะเบียน"}</DialogTitle>
            <DialogDescription id="registration-review-description" className="leading-6">
              {submitted
                ? "ระบบสร้างใบลงทะเบียนและส่งให้สถาบันหลักพิจารณาแล้ว จะเปิดให้ชำระเงินเมื่อได้รับอนุมัติ"
                : "เมื่อยืนยัน ระบบจะสร้างใบลงทะเบียนและส่งให้สถาบันหลักพิจารณาอนุมัติ"}
            </DialogDescription>
          </DialogHeader>
          {submitted ? (
            <div className="space-y-3">
              <div role="status" className="flex items-start gap-3 rounded-xl border border-success-border bg-success-soft p-4 text-sm text-success-on-soft">
                <span aria-hidden="true" className="material-symbols-outlined text-2xl">check_circle</span>
                <p>ส่งคำขอ {submitted.count} รายวิชา · สถานะปัจจุบัน “รออนุมัติ”</p>
              </div>
              <DialogFooter>
                <Button variant="outline" className="min-h-11" onClick={() => setReviewOpen(false)}>เลือกวิชาเพิ่ม</Button>
                <Button asChild className="min-h-11"><Link href="/member/registration">ไปที่สถานะการลงทะเบียน</Link></Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 rounded-2xl bg-surface-container-low p-4">
                <div><p className="text-xs text-muted-foreground">รายวิชาที่เลือก</p><p className="mt-1 text-lg font-semibold tabular-nums">{cartCourses.length} วิชา</p></div>
                <div><p className="text-xs text-muted-foreground">หน่วยกิตรวม</p><p className="mt-1 text-lg font-semibold tabular-nums">{cartCredits} หน่วยกิต</p></div>
              </div>
              <ul className="max-h-72 space-y-2 overflow-y-auto pr-1" aria-label="รายวิชาที่จะส่งคำขอ">
                {cartCourses.map((course) => (
                  <li key={course.offering.id} className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-mono text-xs font-semibold text-primary">{formatCollegeCourseCode(course.definition.code, course.definition.collegeCode)}</p>
                        <p className="mt-1 text-sm font-semibold leading-6">{course.definition.titleTh}</p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">{courseCategoryMeta[courseCategory(course)].label} · {course.universityName} · ภาคเรียน {course.offering.term} · {course.schedule}</p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold tabular-nums">{course.definition.credits} หน่วยกิต</span>
                    </div>
                  </li>
                ))}
              </ul>
              {submitError ? <p role="alert" className="rounded-xl border border-danger-border bg-danger-soft p-3 text-sm text-danger-on-soft">{submitError}</p> : null}
              <DialogFooter>
                <Button variant="outline" className="min-h-11" disabled={isSubmitting} onClick={() => setReviewOpen(false)}>แก้ไขรายการ</Button>
                <Button className="min-h-11" onClick={handleSubmit} disabled={cartCourses.length === 0 || isSubmitting}>
                  {isSubmitting ? "กำลังส่งคำขอ…" : "ยืนยันส่งคำขอลงทะเบียน"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
