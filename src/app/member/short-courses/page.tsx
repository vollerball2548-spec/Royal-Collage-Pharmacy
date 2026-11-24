import MemberShortCoursesPage from "@/roles/member/features/short-course/MemberShortCoursesPage";

export default async function Page({ searchParams }: { searchParams: Promise<{ course?: string | string[] }> }) {
  const { course } = await searchParams;
  return <MemberShortCoursesPage initialCourseId={typeof course === "string" ? course : undefined} />;
}
