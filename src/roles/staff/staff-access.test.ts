import { describe, expect, it } from "vitest";

import { ORGANISATIONS } from "@/roles/shared/features/roles/access-model";
import type { PortalSession } from "@/roles/shared/features/roles/mock-login";

import {
  STAFF_CENTRAL_ORGANISATION_ID,
  STAFF_CENTRAL_RESOURCE_ID,
  canAccessStaffCentralWorkspace,
  canAccessStaffRoute,
  isInCollegeScope,
} from "./staff-access";

function session(overrides: Partial<PortalSession> = {}): PortalSession {
  return {
    role: "royal_college_staff",
    displayName: "เจ้าหน้าที่ราชวิทยาลัย",
    userId: "staff-test",
    organisation: ORGANISATIONS.royalCollege,
    resourceScopes: [STAFF_CENTRAL_RESOURCE_ID],
    signedInAt: "2026-08-18T05:00:00.000Z",
    ...overrides,
  };
}

describe("Royal College Staff central access", () => {
  it("requires the exact Royal College organisation and central resource", () => {
    expect(STAFF_CENTRAL_ORGANISATION_ID).toBe(ORGANISATIONS.royalCollege.id);
    expect(canAccessStaffCentralWorkspace(session())).toBe(true);
    expect(canAccessStaffCentralWorkspace(session({ resourceScopes: ["*"] }))).toBe(true);
  });

  it("denies another organisation even when it has a wildcard resource", () => {
    expect(canAccessStaffCentralWorkspace(session({
      organisation: ORGANISATIONS.therapeuticCollege,
      resourceScopes: ["*"],
    }))).toBe(false);
    expect(canAccessStaffCentralWorkspace(session({
      organisation: ORGANISATIONS.system,
      resourceScopes: ["*"],
    }))).toBe(false);
  });

  it("denies missing or unrelated resource scope and the wrong role", () => {
    expect(canAccessStaffCentralWorkspace(session({ resourceScopes: [] }))).toBe(false);
    expect(canAccessStaffCentralWorkspace(session({ resourceScopes: ["staff:finance"] }))).toBe(false);
    expect(canAccessStaffCentralWorkspace(session({ role: "super_admin" }))).toBe(false);
  });
});

describe("College Staff access", () => {
  const vpt = ORGANISATIONS.therapeuticCollege;
  const collegeStaff = session({
    role: "college_staff",
    organisation: vpt,
    resourceScopes: [`college:${vpt.id}`],
  });

  it("opens only the college page, never central Staff pages", () => {
    expect(canAccessStaffCentralWorkspace(collegeStaff)).toBe(false);
    expect(canAccessStaffRoute(collegeStaff, "/staff/college")).toBe(true);
    for (const path of ["/staff/dashboard", "/staff/finance", "/staff/requests", "/staff/collegeX"]) {
      expect(canAccessStaffRoute(collegeStaff, path)).toBe(false);
    }
    expect(canAccessStaffRoute(session(), "/staff/finance")).toBe(true);
  });

  it("denies a college scope that does not match its own college", () => {
    expect(canAccessStaffRoute(session({
      role: "college_staff",
      organisation: vpt,
      resourceScopes: [`college:${ORGANISATIONS.communityCollege.id}`],
    }), "/staff/college")).toBe(false);
  });

  it("sees records of its own college and institutions only", () => {
    expect(isInCollegeScope(collegeStaff, ORGANISATIONS.siriraj.id)).toBe(true);
    expect(isInCollegeScope(collegeStaff, vpt.id)).toBe(true);
    expect(isInCollegeScope(collegeStaff, ORGANISATIONS.communityCollege.id)).toBe(false);
    expect(isInCollegeScope(collegeStaff, ORGANISATIONS.royalCollege.id)).toBe(false);
  });
});
