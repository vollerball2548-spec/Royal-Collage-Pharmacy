import { StaffApprovalExamPanel } from "@/roles/staff/features/exams/StaffApprovalExamPanel";
import StaffOperationsPage from "@/roles/staff/features/operations/StaffOperationsPage";

export default function Page() {
  return (
    <>
      <div className="px-4 pt-4 md:px-6"><StaffApprovalExamPanel /></div>
      <StaffOperationsPage domain="exams" />
    </>
  );
}
