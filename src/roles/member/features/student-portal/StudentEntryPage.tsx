import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { admissionWording } from "@/roles/shared/features/admissions/program-offerings";
import { Icon, NavButton, StudentPage } from "./StudentUI";

/** จุดเริ่มต้นเดียวของ "สมัครเรียน / สมัครสอบ" (ดีไซน์จาก pharmacy-main เชื่อมกับ workflow จริง) */
const paths = [
  {
    href: "/member/apply/study",
    title: admissionWording.study,
    icon: "auto_stories",
    eyebrow: "LEARN & GROW",
    description: "Short Course แบบไม่ต่อยอด หรือสะสม Credit Bank และหลักสูตรที่ต้องสอบคัดเลือก ป.ชั้นสูง 1 ปี / วุฒิบัตร 4 ปี",
    tags: ["Short Course", "Credit Bank", "สอบคัดเลือกเข้าเรียน"],
    footer: "เลือกหลักสูตรและสมัครเรียน",
  },
  {
    href: "/member/apply/approval",
    title: admissionWording.approvalExam,
    icon: "workspace_premium",
    eyebrow: "ADVANCE YOUR PRACTICE",
    description: "สมัครสอบเพื่อขอหนังสืออนุมัติแสดงความรู้ความชำนาญ โดยไม่เข้าสู่การลงทะเบียนเรียน เมื่อผ่านจึงต่อเรื่องหนังสืออนุมัติและสมาชิกสามัญ",
    tags: ["7 วิทยาลัย", "ไม่ต้องลงทะเบียนเรียน"],
    footer: "เริ่มกรอกใบสมัครสอบหนังสืออนุมัติ",
  },
] as const;

export default function StudentEntryPage() {
  return (
    <StudentPage>
      <section className="student-hero overflow-hidden rounded-3xl border border-brand-border px-6 py-10 md:px-10 md:py-14">
        <Badge variant="brand"><Icon name="school" className="mr-1 text-base" /> สมัครเรียน / สมัครสอบ</Badge>
        <h2 className="mt-5 max-w-2xl text-3xl font-semibold leading-snug tracking-tight text-foreground md:text-4xl">ก้าวต่อไปในวิชาชีพ<br /><span className="text-primary">เริ่มต้นในเส้นทางของคุณ</span></h2>
        <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground">ระบบเติมข้อมูลจากทะเบียนสภาเภสัชกรรมให้ บันทึกร่างแล้วกลับมากรอกต่อได้ทุกเมื่อ</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <NavButton href="/member/applications" outline>ใบสมัครของฉัน <Icon name="arrow_forward" className="text-lg" /></NavButton>
        </div>
      </section>
      <div className="grid gap-5 md:grid-cols-2">
        {paths.map((path) => (
          <Link key={path.href} href={path.href} className="group flex flex-col rounded-3xl border border-border bg-card p-7 shadow-app-card transition-all hover:-translate-y-1 hover:border-primary/60 hover:shadow-app-float focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transform-none md:p-8">
            <div className="flex items-center justify-between">
              <span className="flex size-16 items-center justify-center rounded-2xl bg-brand-soft text-brand-on-soft"><Icon name={path.icon} className="text-4xl!" /></span>
              <Icon name="north_east" className="text-muted-foreground transition-transform group-hover:-translate-y-1 group-hover:translate-x-1" />
            </div>
            <p className="mt-7 text-xs font-medium tracking-widest text-primary">{path.eyebrow}</p>
            <h3 className="mt-2 text-3xl font-semibold">{path.title}</h3>
            <p className="mt-4 flex-1 text-sm leading-7 text-muted-foreground">{path.description}</p>
            <div className="mt-5 flex flex-wrap gap-2">{path.tags.map((tag) => <Badge key={tag} variant="neutral">{tag}</Badge>)}</div>
            <div className="mt-7 flex items-center justify-between border-t border-border pt-5 text-sm font-medium text-primary">{path.footer}<Icon name="arrow_forward" /></div>
          </Link>
        ))}
      </div>
    </StudentPage>
  );
}
