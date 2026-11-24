import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import SchedulePage from "./page";

const portal = vi.hoisted(() => ({
  isReady: true,
  isStudent: true,
  studentId: "S-1",
  programLabel: "วิทยาลัยเภสัชบำบัดแห่งประเทศไทย",
  registrations: [
    { id: "REG-PAID", studentId: "S-1", courseCode: "วภท-301", courseTitle: "องค์ความรู้ทางเภสัชบำบัดเฉพาะทาง", term: "1/2569", status: "enrolled", courseOfferingId: "offering-vpt-301", institutionId: "org-inst-siriraj", updatedAt: "2026-06-16T03:00:00.000Z", history: [] },
    { id: "REG-UNPAID", studentId: "S-1", courseCode: "วภท-302", courseTitle: "การประเมินผู้ป่วยข้างเตียง", term: "1/2569", status: "awaiting_payment", courseOfferingId: "offering-vpt-302", institutionId: "org-inst-chula", updatedAt: "2026-06-16T03:00:00.000Z", history: [] },
  ],
  invoices: [
    { id: "INV-REG-PAID", registrationId: "REG-PAID", status: "paid" },
    { id: "INV-REG-UNPAID", registrationId: "REG-UNPAID", status: "awaiting_payment" },
  ],
  subjectResults: [],
  shortCourseEnrollments: [],
  db: {
    courseOfferings: [
      { id: "offering-vpt-301", courseCode: "วภท-301", courseTitle: "องค์ความรู้", credits: 12, term: "1/2569", institutionId: "org-inst-siriraj", collegeCode: "วภท.", status: "open" },
      { id: "offering-vpt-302", courseCode: "วภท-302", courseTitle: "ข้างเตียง", credits: 12, term: "1/2569", institutionId: "org-inst-chula", collegeCode: "วภท.", status: "open" },
    ],
    academicInstitutions: [{ id: "org-inst-siriraj", code: "SI", name: "สถาบันฝึกอบรมโรงพยาบาลศิริราช", kind: "hospital" }],
    teachingAssignments: [{ id: "ta", teacherId: "teacher-001", courseOfferingId: "offering-vpt-301", institutionId: "org-inst-siriraj", startsAt: "2026-01-01T00:00:00.000Z", endsAt: "2027-01-01T00:00:00.000Z", status: "accepted" }],
    academicTeachers: [{ id: "teacher-001", name: "อ. ภก. กิตติพงศ์ วัฒนเภสัช" }],
  },
}));
vi.mock("@/roles/member/features/portal/use-student-portal", () => ({ useStudentPortal: () => portal }));

afterEach(() => cleanup());

describe("Member schedule page", () => {
  it("shows only enrolled and paid courses in the weekly view", () => {
    render(<SchedulePage />);
    const timetable = screen.getByRole("region", { name: "ตารางเรียนรายสัปดาห์" });
    expect(within(timetable).getByText("วันจันทร์")).toBeTruthy();
    expect(within(timetable).getByText("องค์ความรู้ทางเภสัชบำบัดเฉพาะทาง")).toBeTruthy();
    expect(screen.queryByText("การประเมินผู้ป่วยข้างเตียง")).toBeNull();
  });

  it("lists course, schedule, room, teacher, institution and study status", () => {
    render(<SchedulePage />);
    fireEvent.click(screen.getByRole("button", { name: "รายการรายวิชา" }));
    const table = within(screen.getByRole("table", { name: "รายการรายวิชาที่ลงทะเบียน" }));
    expect(table.getByText("วันจันทร์ 09:00–12:00 น.")).toBeTruthy();
    expect(table.getByText("ห้องบรรยาย 1 อาคารศูนย์การแพทย์")).toBeTruthy();
    expect(table.getByText("อ. ภก. กิตติพงศ์ วัฒนเภสัช")).toBeTruthy();
    expect(table.getByText("กำลังเรียน")).toBeTruthy();
    expect(table.queryByText("การประเมินผู้ป่วยข้างเตียง")).toBeNull();
  });
});
