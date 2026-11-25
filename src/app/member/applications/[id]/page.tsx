import ApplicationWorkspace from "@/roles/member/features/student-portal/ApplicationWorkspace";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ApplicationWorkspace id={id} />;
}
