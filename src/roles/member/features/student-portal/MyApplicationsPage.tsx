"use client";

import Link from "next/link";
import { applicationKindLabel } from "@/domain/applications/model";
import { ApplicationStatusBadge } from "@/roles/shared/forms/ApplicationParts";
import { useApplicationActor, useApplications } from "@/roles/shared/forms/use-applications";
import { Icon, NavButton, Panel, StudentHeader, StudentPage } from "./StudentUI";

export default function MyApplicationsPage() {
  const actor = useApplicationActor();
  const { applications, isReady } = useApplications();
  const mine = applications.filter((item) => item.applicantId === actor?.userId);
  return (
    <StudentPage>
      <StudentHeader
        eyebrow="MY APPLICATIONS"
        title="ใบสมัครของฉัน"
        description="ร่างที่บันทึกไว้ สถานะการตรวจ การชำระเงิน และผลสอบของทุกใบสมัคร"
        action={<NavButton href="/member/apply"><Icon name="add" className="text-base" /> สมัครใหม่</NavButton>}
      />
      <Panel>
        {!isReady ? <p role="status" className="text-sm text-muted-foreground">กำลังโหลด…</p> : mine.length === 0 ? (
          <p className="text-sm text-muted-foreground">ยังไม่มีใบสมัคร เริ่มจากปุ่ม &quot;สมัครใหม่&quot;</p>
        ) : (
          <ul className="divide-y divide-border">
            {mine.map((application) => (
              <li key={application.id}>
                <Link href={`/member/applications/${application.id}`} className="flex flex-col gap-2 py-4 hover:bg-surface-container-low sm:flex-row sm:items-center sm:justify-between sm:px-2">
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-primary">{application.id}</p>
                    <p className="font-medium">{application.offeringTitle}</p>
                    <p className="text-xs text-muted-foreground">{applicationKindLabel[application.kind]}{application.institutionName ? ` · ${application.institutionName}` : ""}</p>
                  </div>
                  <ApplicationStatusBadge status={application.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </StudentPage>
  );
}
