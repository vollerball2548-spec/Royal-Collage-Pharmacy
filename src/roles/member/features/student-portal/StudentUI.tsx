/** UI kit จาก pharmacy-main (student-portal) — ตัดส่วนข้อมูลจำลองออก */
import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Icon({ name, className }: { name: string; className?: string }) {
  return <span aria-hidden="true" className={cn("material-symbols-outlined", className)}>{name}</span>;
}

export function StudentPage({ children }: { children: ReactNode }) {
  return <div className="student-experience mx-auto w-full max-w-app space-y-6 px-2 pb-12 pt-4 md:px-4 md:pt-6">{children}</div>;
}

export function StudentHeader({ eyebrow, title, description, action }: {
  eyebrow: string; title: string; description: string; action?: ReactNode;
}) {
  return <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
    <div>
      <p className="mb-2 text-xs font-semibold tracking-widest text-primary">{eyebrow}</p>
      <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>
    </div>
    {action}
  </header>;
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("rounded-2xl border border-border bg-card p-5 shadow-app-card md:p-6", className)}>{children}</section>;
}

export function SectionTitle({ icon, title, subtitle }: { icon: string; title: string; subtitle?: string }) {
  return <div className="mb-5 flex items-center gap-3">
    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-on-soft"><Icon name={icon} /></span>
    <div><h3 className="font-semibold text-foreground">{title}</h3>{subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}</div>
  </div>;
}

export function ChoiceCard({ selected, onClick, children, disabled = false, label }: {
  selected: boolean; onClick: () => void; children: ReactNode; disabled?: boolean; label?: string;
}) {
  return <button type="button" aria-pressed={selected} aria-label={label} disabled={disabled} onClick={onClick}
    className={cn("relative rounded-2xl border p-5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
      selected ? "border-primary bg-brand-soft/40 ring-1 ring-primary" : "border-border bg-card hover:border-primary/50 hover:bg-surface-container-low")}>
    {selected && <Icon name="check_circle" className="absolute right-4 top-4 text-xl text-primary" />}
    {children}
  </button>;
}

export function NavButton({ href, children, outline = false }: { href: string; children: ReactNode; outline?: boolean }) {
  return <Button asChild variant={outline ? "outline" : "default"} className="h-11 gap-2 rounded-xl px-5"><Link href={href}>{children}</Link></Button>;
}
