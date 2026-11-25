import { ApplicationPrintPage } from "@/roles/shared/forms/ApplicationPrintPage";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ApplicationPrintPage id={id} />;
}
