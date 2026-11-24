import { StaffWorkspaceLayout } from "@/roles/staff/components/StaffWorkspaceLayout";

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return <StaffWorkspaceLayout>{children}</StaffWorkspaceLayout>;
}
