"use client";

import { usePathname } from "next/navigation";
import {
  ForbiddenState,
  LoadingState,
} from "@/roles/shared/components/workspace/WorkspacePrimitives";
import { usePortalSession } from "@/roles/shared/features/roles/use-portal-session";
import { canAccessStaffRoute } from "@/roles/staff/staff-access";

/** Defense-in-depth boundary: scoped Staff data/actions never mount without central access. */
export function StaffCentralAccessBoundary({ children }: { children: React.ReactNode }) {
  const { session, isReady } = usePortalSession();
  const pathname = usePathname();

  if (!isReady) {
    return <LoadingState label="กำลังตรวจสอบขอบเขตงานส่วนกลาง" />;
  }

  if (!canAccessStaffRoute(session, pathname)) {
    return (
      <ForbiddenState
        title="ไม่มีสิทธิ์เข้าถึงงานส่วนกลาง"
        description={session?.role === "college_staff"
          ? "หน้านี้แสดงข้อมูลของทุกวิทยาลัย เจ้าหน้าที่วิทยาลัยใช้ได้เฉพาะเมนู งานวิทยาลัย"
          : "ต้องใช้ Role เจ้าหน้าที่ราชวิทยาลัย พร้อม Organisation Scope ราชวิทยาลัยและ Resource Scope staff:central"}
      />
    );
  }

  return children;
}
