"use client";

import { RoleWorkspaceShell } from "@/roles/shared/components/workspace/RoleWorkspaceShell";
import { usePortalSession } from "@/roles/shared/features/roles/use-portal-session";
import { StaffCentralAccessBoundary } from "@/roles/staff/components/StaffCentralAccessBoundary";
import {
  STAFF_CENTRAL_ORGANISATION_ID,
  STAFF_CENTRAL_RESOURCE_ID,
  collegeStaffResourceId,
} from "@/roles/staff/staff-access";
import { COLLEGE_STAFF_NAV_ITEMS, STAFF_NAV_ITEMS } from "@/roles/staff/staff-workspace";

export function StaffWorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { session } = usePortalSession();
  const collegeStaff = session?.role === "college_staff" ? session : null;
  return (
    <RoleWorkspaceShell
      area="staff"
      role={collegeStaff ? "college_staff" : "royal_college_staff"}
      navItems={collegeStaff ? COLLEGE_STAFF_NAV_ITEMS : STAFF_NAV_ITEMS}
      exactOrganisationId={collegeStaff ? undefined : STAFF_CENTRAL_ORGANISATION_ID}
      resourceId={collegeStaff ? collegeStaffResourceId(collegeStaff.organisation.id) : STAFF_CENTRAL_RESOURCE_ID}
    >
      <StaffCentralAccessBoundary>{children}</StaffCentralAccessBoundary>
    </RoleWorkspaceShell>
  );
}
