import {
  ORGANISATIONS,
  hasResourceScope,
  organisationContains,
} from "@/roles/shared/features/roles/access-model";
import type { PortalSession } from "@/roles/shared/features/roles/mock-login";

export const STAFF_CENTRAL_ORGANISATION_ID = ORGANISATIONS.royalCollege.id;
export const STAFF_CENTRAL_RESOURCE_ID = "staff:central";

/** Central Staff data and actions require the canonical Royal College scope. */
export function canAccessStaffCentralWorkspace(session: PortalSession | null) {
  return session?.role === "royal_college_staff" &&
    session.organisation.id === STAFF_CENTRAL_ORGANISATION_ID &&
    hasResourceScope(session.resourceScopes, STAFF_CENTRAL_RESOURCE_ID);
}

export const COLLEGE_STAFF_HOME = "/staff/college";
// College Staff may only open college-scoped pages; every other Staff page shows central (all-college) data.
const COLLEGE_STAFF_ROUTES = [COLLEGE_STAFF_HOME] as const;

export function collegeStaffResourceId(collegeOrganisationId: string) {
  return `college:${collegeOrganisationId}`;
}

export function canAccessCollegeStaffWorkspace(session: PortalSession | null) {
  return session?.role === "college_staff" &&
    session.organisation.kind === "college" &&
    hasResourceScope(session.resourceScopes, collegeStaffResourceId(session.organisation.id));
}

export function canAccessStaffRoute(session: PortalSession | null, pathname: string) {
  if (canAccessStaffCentralWorkspace(session)) return true;
  return canAccessCollegeStaffWorkspace(session) &&
    COLLEGE_STAFF_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

/** Records owned by an institution under the staff member's college (or by the college itself). */
export function isInCollegeScope(session: PortalSession, organisationId: string) {
  return organisationContains(session.organisation, organisationId);
}
