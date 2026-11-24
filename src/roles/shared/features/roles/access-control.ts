import {
  hasResourceScope,
  organisationContains,
  type SystemRole,
} from "./access-model";
import type { PortalSession } from "./mock-login";

export type PortalArea =
  | "student"
  | "teacher"
  | "institution"
  | "staff"
  | "president"
  | "admin";

/** Temporary route alias while the existing Student layout remains under `/member`. */
export type LegacyPortalArea = "member";
export type PortalAreaInput = PortalArea | LegacyPortalArea;

export interface PortalAccessTarget {
  organisationId?: string;
  exactOrganisationId?: string;
  resourceId?: string;
}

const AREA_POLICIES: Record<PortalArea, { roles: readonly SystemRole[]; routeRoot: string }> = {
  student: { roles: ["student"], routeRoot: "/member" },
  teacher: { roles: ["teacher"], routeRoot: "/teacher" },
  institution: { roles: ["institution_admin"], routeRoot: "/institution" },
  // College Staff shares the Staff Portal shell; StaffCentralAccessBoundary limits it to college-scoped pages.
  staff: { roles: ["royal_college_staff", "college_staff"], routeRoot: "/staff" },
  president: { roles: ["president"], routeRoot: "/president" },
  admin: { roles: ["super_admin"], routeRoot: "/admin" },
};

const SUPER_ADMIN_ROUTE_ALLOWLIST = [
  "/admin/dashboard",
  "/admin/users",
  "/admin/scopes",
  "/admin/organisations",
  "/admin/terms",
  "/admin/integrations",
  "/admin/audit",
  "/admin/settings",
] as const;

function normalizeArea(area: PortalAreaInput): PortalArea {
  return area === "member" ? "student" : area;
}

function isInsideRouteRoot(pathname: string, routeRoot: string) {
  return pathname === routeRoot || pathname.startsWith(`${routeRoot}/`);
}

function isAllowedAreaPath(area: PortalArea, pathname: string, routeRoot: string) {
  if (!isInsideRouteRoot(pathname, routeRoot)) return false;
  if (area !== "admin") return true;
  if (pathname === "/admin") return true;
  return SUPER_ADMIN_ROUTE_ALLOWLIST.some((allowedPath) => (
    pathname === allowedPath || pathname.startsWith(`${allowedPath}/`)
  ));
}

export function canPortalSessionAccessScope(
  session: PortalSession | null,
  target: PortalAccessTarget = {},
) {
  if (!session) return false;
  if (
    target.exactOrganisationId &&
    session.organisation.id !== target.exactOrganisationId
  ) {
    return false;
  }
  if (
    target.organisationId &&
    !organisationContains(session.organisation, target.organisationId)
  ) {
    return false;
  }
  if (target.resourceId && !hasResourceScope(session.resourceScopes, target.resourceId)) {
    return false;
  }
  return true;
}

export function canPortalSessionAccessArea(
  session: PortalSession | null,
  area: PortalAreaInput,
  pathname: string,
  target: PortalAccessTarget = {},
) {
  if (!session) return false;
  const normalizedArea = normalizeArea(area);
  const policy = AREA_POLICIES[normalizedArea];
  return policy.roles.includes(session.role) &&
    isAllowedAreaPath(normalizedArea, pathname, policy.routeRoot) &&
    canPortalSessionAccessScope(session, target);
}
