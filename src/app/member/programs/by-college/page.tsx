"use client";

import { useState } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ProgramSectionNav } from "@/roles/member/features/programs/ProgramSectionNav";
import { PageShell } from "@/roles/shared/components/layout/PageShell";
import { getCollegeOption } from "@/roles/shared/data/college-directory";
import {
  curriculumCategoryLabel,
  curriculumPrograms,
  curriculumSystemLabel,
} from "@/roles/shared/data/curriculum";

export default function ByCollegePage() {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLocaleLowerCase("th-TH");
  const groups = curriculumPrograms
    .map((program) => ({
      ...program,
      subjects: program.subjects.filter((subject) => !normalized || `${subject.code ?? ""} ${subject.titleTh ?? ""} ${subject.titleEn ?? ""}`.toLocaleLowerCase("th-TH").includes(normalized)),
    }))
    .filter((program) => program.subjects.length > 0);

  return (
    <PageShell className="space-y-5">
      <ProgramSectionNav active="by-college" />
      <Card className="max-w-xl">
        <CardContent className="p-5">
          <form role="search" onSubmit={(event) => event.preventDefault()}>
            <label htmlFor="college-course-search" className="mb-1.5 block text-sm font-medium">ค้นหารายวิชา</label>
            <Input
              id="college-course-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ค้นหารหัสหรือชื่อรายวิชาในทุกวิทยาลัย"
              className="h-11 rounded-xl text-sm"
            />
          </form>
        </CardContent>
      </Card>
      <Accordion
        type="multiple"
        defaultValue={groups.slice(0, 1).map((group) => group.collegeCode)}
        className="space-y-3"
      >
        {groups.map((program) => (
          <AccordionItem key={program.collegeCode} value={program.collegeCode} className="rounded-xl border border-border bg-card px-5">
            <AccordionTrigger className="hover:no-underline">
              <span className="min-w-0 text-left">
                <span className="block font-semibold">{getCollegeOption(program.collegeCode)?.label}</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {curriculumSystemLabel[program.system]} · ไม่น้อยกว่า {program.minCredits ?? "-"} หน่วยกิต · {program.subjects.length} รายวิชา
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <p className="mb-3 text-sm text-muted-foreground">{program.credentialTh}</p>
              <div className="divide-y rounded-lg border border-border">
                {program.subjects.map((subject) => (
                  <div
                    key={`${subject.code ?? subject.titleEn ?? subject.titleTh}`}
                    className={`grid gap-2 p-4 sm:grid-cols-[120px_minmax(0,1fr)_auto] sm:items-center ${subject.optionOf ? "bg-muted/40 sm:pl-8" : ""}`}
                  >
                    <span className="font-mono text-xs text-muted-foreground">{subject.code ?? "ไม่มีรหัสวิชา"}</span>
                    <span className="min-w-0">
                      <span className="block font-medium">{subject.titleTh ?? subject.titleEn}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {subject.titleTh && subject.titleEn ? `${subject.titleEn} · ` : ""}
                        {subject.optionOf ? "ตัวเลือกฝึกปฏิบัติ (เลือก 1 ด้าน)" : `${subject.creditsText ?? subject.credits} หน่วยกิต`}
                      </span>
                    </span>
                    <Badge variant="secondary">{curriculumCategoryLabel[subject.category]}</Badge>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
      {groups.length === 0 && <div className="py-14 text-center text-sm text-muted-foreground">ไม่พบรายการที่ค้นหา</div>}
    </PageShell>
  );
}
