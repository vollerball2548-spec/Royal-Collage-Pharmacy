import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { PageShell } from "@/roles/shared/components/layout/PageShell";
import { admissionWording } from "@/roles/shared/features/admissions/program-offerings";

const choices = [
  {
    href: "/member/apply/study",
    icon: "school",
    title: admissionWording.study,
    description: "เลือกวิทยาลัยและหลักสูตร ระบบจะพาไปขั้นตอนที่ถูกต้องให้เอง ทั้ง Short Course, ป.ชั้นสูง และวุฒิบัตร (ซึ่งต้องสมัครสอบคัดเลือก)",
  },
  {
    href: "/member/admission",
    icon: "workspace_premium",
    title: admissionWording.approvalExam,
    description: "สอบเพื่อขอหนังสืออนุมัติแสดงความรู้ความชำนาญ โดยไม่ต้องเข้าเรียน พร้อมติดตามสถานะการสมัครทั้งหมด",
  },
] as const;

export default function ApplyHubPage() {
  return (
    <PageShell size="content" className="space-y-5">
      <p className="text-sm text-muted-foreground">
        ระบบจะดึงข้อมูลจาก Pharmacist Profile มาใช้โดยอัตโนมัติ เลือกสิ่งที่ต้องการทำ
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {choices.map((choice) => (
          <Link key={choice.href} href={choice.href} className="group rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Card className="h-full transition-colors group-hover:bg-muted/40">
              <CardContent className="flex h-full flex-col gap-3 p-6">
                <span className="material-symbols-outlined text-4xl text-primary" aria-hidden="true">{choice.icon}</span>
                <span className="text-lg font-semibold">{choice.title}</span>
                <span className="text-sm text-muted-foreground">{choice.description}</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </PageShell>
  );
}
