import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { PageShell } from "@/roles/shared/components/layout/PageShell";
import { admissionWording } from "@/roles/shared/features/admissions/program-offerings";

const choices = [
  {
    href: "/member/apply/study",
    icon: "school",
    title: admissionWording.study,
  },
  {
    href: "/member/admission",
    icon: "workspace_premium",
    title: admissionWording.approvalExam,
  },
] as const;

export default function ApplyHubPage() {
  return (
    <PageShell size="content" className="space-y-5">
      <div className="mx-auto grid max-w-3xl gap-5 sm:grid-cols-2">
        {choices.map((choice) => (
          <Link key={choice.href} href={choice.href} className="group rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Card className="h-full border border-border transition-all duration-200 group-hover:border-primary/40 group-hover:shadow-lg motion-safe:group-hover:-translate-y-1">
              <CardContent className="flex h-full flex-col items-center justify-center gap-5 px-6 py-10 text-center">
                <span className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 transition-colors group-hover:bg-primary/15">
                  <span className="material-symbols-outlined text-5xl! text-primary" aria-hidden="true">{choice.icon}</span>
                </span>
                <span className="text-xl font-semibold">{choice.title}</span>
                <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                  เริ่มต้น
                  <span className="material-symbols-outlined text-lg! transition-transform motion-safe:group-hover:translate-x-1" aria-hidden="true">arrow_forward</span>
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </PageShell>
  );
}
