import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import CourseRegistrationPage from "./page";

const windowStatus = vi.hoisted(() => ({ canRegister: true }));
const portal = vi.hoisted(() => ({
  isReady: true,
  isStudent: true,
  studentId: "student-demo",
  collegeCode: "วภท.",
  actor: { userId: "student-demo", displayName: "ผู้เรียนทดสอบ", role: "student", organisationId: "org-inst-siriraj" },
  registrations: [{
    id: "REG-EXISTING", studentId: "student-demo", courseCode: "TEST-2", term: "1/2569", status: "pending", history: [],
  }],
  invoices: [{ id: "INV-REG-EXISTING", registrationId: "REG-EXISTING", status: "locked" }],
  payments: [],
  subjectResults: [],
  db: {
    settings: { registrationOpen: true, registrationOpensAt: "", registrationClosesAt: "" },
    academicInstitutions: [],
    courseOfferings: [],
    submitStudentRegistrations: vi.fn(() => ({ created: [{ id: "REG-NEW" }], skippedDuplicates: [] })),
  },
}));

vi.mock("@/roles/member/features/portal/use-student-portal", () => ({ useStudentPortal: () => portal }));
vi.mock("@/roles/shared/features/registration/registration-window", () => ({
  getRegistrationWindowStatus: () => ({ canRegister: windowStatus.canRegister, tone: "success", label: windowStatus.canRegister ? "เปิดรับลงทะเบียน" : "ปิดรับลงทะเบียนแล้ว", detail: "ทดสอบ" }),
}));
vi.mock("@/roles/member/features/registration/open-registration-catalog", () => ({
  buildOpenRegistrationCourses: () => [1, 2, 3].map((id) => ({
    definition: { id: `course-${id}`, code: `CPhT-${300 + id}`, collegeCode: "วภท.", titleTh: `วิชาทดสอบ ${id}`, titleEn: `Test ${id}`, credits: 4, capacity: 10, enrolled: 0, classification: id === 3 ? "general" : "required" },
    offering: { id: `offering-${id}`, courseCode: `TEST-${id}`, courseTitle: `วิชาทดสอบ ${id}`, credits: 4, institutionId: "org-inst-siriraj", term: "1/2569" },
    universityName: "มหาวิทยาลัยมหิดล",
    institutionName: "สถาบันทดสอบ",
    academicYear: "2569", term: "1", schedule: "วันเสาร์", room: "101",
  })),
  filterOpenRegistrationCourses: (courses: unknown[]) => courses,
  openRegistrationFilterOptions: () => ({ universities: [], academicYears: ["2569"], terms: ["1"] }),
}));

afterEach(() => { cleanup(); vi.clearAllMocks(); windowStatus.canRegister = true; });

function courseCard(number: number) {
  return within(screen.getByRole("heading", { name: `วิชาทดสอบ ${number}` }).closest("article")!);
}

describe("student course registration workflow", () => {
  it("shows step progress and groups open courses by course type", () => {
    render(<CourseRegistrationPage />);
    expect(screen.getByRole("list", { name: "ขั้นตอนการลงทะเบียนเรียน" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /วิชาบังคับ/ })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /วิชาเลือก/ })).toBeTruthy();
    expect((screen.getByLabelText("1. หลักสูตร (วิทยาลัย)") as HTMLSelectElement).value).toBe("วภท.");
  });

  it("marks an already-requested course in the same term and does not let it be selected again", () => {
    render(<CourseRegistrationPage />);
    expect(courseCard(2).getByText("รออนุมัติ")).toBeTruthy();
    expect(courseCard(2).queryByRole("button", { name: /เลือกวิชา/ })).toBeNull();
    expect(courseCard(2).getByRole("link", { name: "ดูสถานะ" })).toBeTruthy();
  });

  it("reviews the selection and submits a real registration request for the signed-in student", () => {
    render(<CourseRegistrationPage />);
    fireEvent.click(courseCard(1).getByRole("button", { name: "เลือกวิชา CPhT 301" }));
    fireEvent.click(courseCard(3).getByRole("button", { name: "เลือกวิชา CPhT 303" }));
    const summary = within(screen.getByRole("list", { name: "รายวิชาที่เลือก" }));
    expect(summary.getAllByRole("listitem")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "ตรวจสอบรายการและยืนยัน" }));
    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByText("8 หน่วยกิต")).toBeTruthy();
    fireEvent.click(dialog.getByRole("button", { name: "ยืนยันส่งคำขอลงทะเบียน" }));

    expect(portal.db.submitStudentRegistrations).toHaveBeenCalledTimes(1);
    const [actor, selections] = portal.db.submitStudentRegistrations.mock.calls[0] as unknown as [{ userId: string }, { studentId: string; courseCode: string; term: string }[]];
    expect(actor.userId).toBe("student-demo");
    expect(selections.map((item) => [item.studentId, item.courseCode, item.term])).toEqual([
      ["student-demo", "TEST-1", "1/2569"],
      ["student-demo", "TEST-3", "1/2569"],
    ]);
    expect(screen.getByRole("heading", { name: "ส่งคำขอลงทะเบียนแล้ว" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "ไปที่สถานะการลงทะเบียน" }).getAttribute("href")).toBe("/member/registration");
  });

  it("disables selection and submission outside the registration window", () => {
    windowStatus.canRegister = false;
    render(<CourseRegistrationPage />);
    expect(courseCard(1).getByRole("button", { name: "เลือกวิชา CPhT 301" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "ตรวจสอบรายการและยืนยัน" }).hasAttribute("disabled")).toBe(true);
    expect(portal.db.submitStudentRegistrations).not.toHaveBeenCalled();
  });
});
