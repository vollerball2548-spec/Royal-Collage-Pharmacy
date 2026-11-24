export function formatPortalDateTime(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" });
}

export interface ApprovalTimelineEntry {
  id: string;
  at: string;
  actorLabel: string;
  fromLabel?: string;
  toLabel: string;
  reason?: string;
}

/** ประวัติการเปลี่ยนสถานะ: ผู้ดำเนินการ · วันเวลา · สถานะเดิม → สถานะใหม่ · เหตุผล */
export function ApprovalTimeline({ entries, label }: { entries: readonly ApprovalTimelineEntry[]; label: string }) {
  if (entries.length === 0) return <p className="text-sm text-muted-foreground">ยังไม่มีประวัติ</p>;
  return (
    <ol aria-label={label} className="space-y-3 border-l-2 border-border pl-4">
      {entries.map((entry) => (
        <li key={entry.id} className="relative rounded-xl border border-border p-3 text-sm before:absolute before:-left-[1.35rem] before:top-4 before:h-2 before:w-2 before:rounded-full before:bg-primary">
          <p className="font-medium">{entry.fromLabel ? `${entry.fromLabel} → ` : ""}{entry.toLabel}</p>
          <p className="mt-1 text-xs text-muted-foreground">{entry.actorLabel} · {formatPortalDateTime(entry.at)}</p>
          {entry.reason ? <p className="mt-2 text-muted-foreground">หมายเหตุ/เหตุผล: {entry.reason}</p> : null}
        </li>
      ))}
    </ol>
  );
}
