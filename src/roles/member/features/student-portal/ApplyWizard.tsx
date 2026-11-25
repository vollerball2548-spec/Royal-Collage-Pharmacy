"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { COLLEGE_OPTIONS, type CollegeCode } from "@/roles/shared/data/college-directory";
import { approvalOfferings, createDraftApplication, entranceOfferings, studyOfferings } from "@/domain/applications/catalog";
import type { ApplicationKind } from "@/domain/applications/model";
import { seatsLeft } from "@/domain/applications/workflow";
import {
  admissionWording,
  openRoundsFor,
  programRounds,
  programTypeLabel,
  trainingInstitutionsFor,
  type ProgramOffering,
  type ProgramRound,
} from "@/roles/shared/features/admissions/program-offerings";
import { currentApplicantProfile } from "@/roles/shared/features/applicant/profile";
import { useMockDb } from "@/providers/mock-db-provider";
import { publishedProposalCatalog, useShortCourseProposals } from "@/roles/shared/features/short-course-proposals/store";
import { useApplicationActor, useApplications } from "@/roles/shared/forms/use-applications";
import { ChoiceCard, Icon, NavButton, Panel, StudentHeader, StudentPage } from "./StudentUI";

type StudyPath = "short" | "entrance";

function newId() {
  return `APP-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 36 ** 2).toString(36).toUpperCase()}`;
}

function CollegeGrid({ codes, value, onChange }: { codes: ReadonlySet<string>; value: CollegeCode | null; onChange: (code: CollegeCode) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {COLLEGE_OPTIONS.filter((college) => codes.has(college.value)).map((college) => (
        <ChoiceCard key={college.value} selected={value === college.value} onClick={() => onChange(college.value)}>
          <p className="text-xs font-medium tracking-wider text-primary">{college.abbreviation}</p>
          <h4 className="mt-1 pr-6 text-sm font-medium leading-relaxed">{college.name}</h4>
        </ChoiceCard>
      ))}
    </div>
  );
}

function SeatBadge({ seats }: { seats: number | undefined }) {
  if (seats === undefined) return <Badge variant="neutral">ยังไม่ประกาศจำนวนที่นั่ง</Badge>;
  return <Badge variant={seats === 0 ? "danger" : seats <= 3 ? "warning" : "success"}>{seats === 0 ? "ที่นั่งเต็ม" : `ว่าง ${seats} ที่นั่ง`}</Badge>;
}

export default function ApplyWizard({ mode }: { mode: "study" | "approval" }) {
  const router = useRouter();
  const actor = useApplicationActor();
  const { settings } = useMockDb();
  const { applications, save } = useApplications();
  const { proposals } = useShortCourseProposals();
  const proposalCatalog = useMemo(() => publishedProposalCatalog(proposals), [proposals]);
  const rounds: readonly ProgramRound[] = useMemo(() => [...programRounds, ...proposalCatalog.rounds], [proposalCatalog]);

  const [path, setPath] = useState<StudyPath | null>(null);
  const [programType, setProgramType] = useState<ProgramOffering["type"] | null>(null);
  const [collegeCode, setCollegeCode] = useState<CollegeCode | null>(null);
  const [offeringId, setOfferingId] = useState<string | null>(null);
  const [institutionId, setInstitutionId] = useState<string | null>(null);
  const [roundId, setRoundId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const kind: ApplicationKind = mode === "approval" ? "approval_exam" : path === "entrance" ? "entrance_exam" : "study";
  const pool: ProgramOffering[] = mode === "approval"
    ? approvalOfferings()
    : path === "entrance" ? entranceOfferings().filter((item) => !programType || item.type === programType) : path === "short" ? studyOfferings(proposalCatalog.offerings) : [];
  const collegeCodes = new Set(pool.map((item) => item.collegeCode));
  const offerings = collegeCode ? pool.filter((item) => item.collegeCode === collegeCode) : [];
  const offering = offerings.find((item) => item.id === offeringId) ?? (mode === "approval" || path === "entrance" ? offerings[0] : undefined);
  const institutions = offering && kind === "entrance_exam" ? trainingInstitutionsFor(offering) : [];
  const offeringRounds = offering ? openRoundsFor(offering, settings.admissionOpen, rounds) : [];
  const needsRound = offering ? rounds.some((round) => round.offeringId === offering.id) : false;
  const round = offeringRounds.find((item) => item.id === roundId);
  const seats = offering ? seatsLeft(round?.capacity, applications, { offeringId: offering.id, institutionId: institutionId ?? undefined, roundId: round?.id }) : undefined;

  const ready = Boolean(
    actor && offering &&
    (kind !== "entrance_exam" || (institutionId && institutions.some((item) => item.id === institutionId))) &&
    (!needsRound || round) &&
    seats !== 0,
  );

  const reset = (level: "path" | "type" | "college" | "offering") => {
    if (level === "path") setProgramType(null);
    if (level === "path" || level === "type") setCollegeCode(null);
    if (level !== "offering") setOfferingId(null);
    setInstitutionId(null);
    setRoundId(null);
  };

  const start = async () => {
    if (!actor || !offering) return;
    const existing = applications.find((item) => item.applicantId === actor.userId && item.offeringId === offering.id && item.status === "draft");
    if (existing) {
      router.push(`/member/applications/${existing.id}`);
      return;
    }
    setCreating(true);
    const institution = institutions.find((item) => item.id === institutionId);
    const application = createDraftApplication({
      id: newId(),
      kind,
      offering,
      profile: currentApplicantProfile(),
      actor,
      at: new Date().toISOString(),
      ...(institution ? { institution: { id: institution.id, name: institution.name } } : {}),
      ...(round ? { round: { id: round.id, label: round.label } } : {}),
    });
    if (await save(application)) router.push(`/member/applications/${application.id}`);
    else {
      toast.error("สร้างใบสมัครไม่สำเร็จ");
      setCreating(false);
    }
  };

  let step = 0;
  const heading = (title: string) => <h3 className="mb-4 text-lg font-semibold">{++step}. {title}</h3>;

  return (
    <StudentPage>
      <StudentHeader
        eyebrow={mode === "approval" ? "APPROVAL EXAMINATION" : "LEARNING APPLICATION"}
        title={mode === "approval" ? admissionWording.approvalExam : admissionWording.study}
        description={mode === "approval" ? "เลือกสาขาและวิทยาลัยที่ประสงค์สมัครสอบหนังสืออนุมัติ (เลือกได้ 1 สาขา)" : "เลือกเส้นทาง วิทยาลัย และหลักสูตร ระบบจะพาไปกรอกใบสมัครที่ถูกต้องให้เอง"}
        action={<NavButton href="/member/apply" outline><Icon name="arrow_back" className="text-base" /> เปลี่ยนเส้นทาง</NavButton>}
      />

      {mode === "study" && (
        <Panel>
          {heading("เลือกเส้นทาง")}
          <div className="grid gap-4 md:grid-cols-2">
            <ChoiceCard selected={path === "short"} onClick={() => { setPath("short"); reset("path"); }}>
              <Icon name="auto_stories" className="text-primary" />
              <h4 className="mt-3 font-semibold">Short Course / Credit Bank</h4>
              <p className="mt-1 pr-6 text-sm text-muted-foreground">หลักสูตรระยะสั้นแบบไม่ต่อยอด หรือสะสมหน่วยกิต Credit Bank — สมัครแล้วชำระเงินเพื่อเริ่มเรียน</p>
            </ChoiceCard>
            <ChoiceCard selected={path === "entrance"} onClick={() => { setPath("entrance"); reset("path"); }}>
              <Icon name="workspace_premium" className="text-primary" />
              <h4 className="mt-3 font-semibold">หลักสูตรที่ต้องสอบคัดเลือก</h4>
              <p className="mt-1 pr-6 text-sm text-muted-foreground">ป.ชั้นสูง 1 ปี และวุฒิบัตร 4 ปี (Residency) — เลือกสถาบันฝึกอบรม สอบผ่านแล้วจึงลงทะเบียนเรียน</p>
            </ChoiceCard>
          </div>
        </Panel>
      )}

      {path === "entrance" && (
        <Panel>
          {heading("เลือกประเภทหลักสูตร")}
          <div className="grid gap-4 md:grid-cols-2">
            {(["advanced_program", "board_certification"] as const).map((type) => (
              <ChoiceCard key={type} selected={programType === type} onClick={() => { setProgramType(type); reset("type"); }}>
                <h4 className="pr-6 font-semibold">{programTypeLabel[type]}</h4>
                <p className="mt-1 text-sm text-muted-foreground">{type === "advanced_program" ? "Higher Graduate Diploma · ฝึกอบรม 1 ปี" : "Residency Program · ฝึกอบรม 4 ปี"}</p>
              </ChoiceCard>
            ))}
          </div>
        </Panel>
      )}

      {(mode === "approval" || path === "short" || (path === "entrance" && programType)) && (
        <Panel>
          {heading(mode === "approval" ? "เลือกสาขาและวิทยาลัย" : "เลือกวิทยาลัย")}
          <CollegeGrid codes={collegeCodes} value={collegeCode} onChange={(code) => { setCollegeCode(code); reset("college"); }} />
        </Panel>
      )}

      {path === "short" && collegeCode && (
        <Panel>
          {heading("เลือกหลักสูตร")}
          <div className="grid gap-3">
            {offerings.map((item) => (
              <ChoiceCard key={item.id} selected={offeringId === item.id} onClick={() => { setOfferingId(item.id); reset("offering"); }}>
                <h4 className="pr-6 font-medium">{item.titleTh}</h4>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge variant={item.creditBankEligible ? "brand" : "info"}>{item.creditBankEligible ? "ต่อยอด Credit Bank" : "ไม่ต่อยอด"}</Badge>
                  <Badge variant="neutral">{programTypeLabel[item.type]}</Badge>
                  {item.credits ? <Badge variant="neutral">{item.credits} หน่วยกิต</Badge> : null}
                </div>
              </ChoiceCard>
            ))}
            {offerings.length === 0 && <p className="text-sm text-muted-foreground">ยังไม่มีหลักสูตรที่เปิดรับในวิทยาลัยนี้</p>}
          </div>
        </Panel>
      )}

      {kind === "entrance_exam" && offering && (
        <Panel>
          {heading("เลือกสถาบันฝึกอบรม")}
          <p className="mb-3 text-sm text-muted-foreground">{offering.titleTh}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {institutions.map((institution) => {
              const institutionSeats = seatsLeft(round?.capacity, applications, { offeringId: offering.id, institutionId: institution.id, roundId: round?.id });
              return (
                <ChoiceCard key={institution.id} selected={institutionId === institution.id} disabled={institutionSeats === 0} onClick={() => setInstitutionId(institution.id)}>
                  <Icon name="local_hospital" className="text-primary" />
                  <h4 className="mt-2 pr-6 text-sm font-medium">{institution.name}</h4>
                  <div className="mt-3"><SeatBadge seats={institutionSeats} /></div>
                </ChoiceCard>
              );
            })}
            {institutions.length === 0 && <p className="text-sm text-muted-foreground">ยังไม่มีสถาบันฝึกอบรมของหลักสูตรนี้ในระบบ</p>}
          </div>
          {/* TODO(business): จำนวนที่นั่งจริงต่อสถาบันต่อรอบยังไม่มีในแหล่งข้อมูล — ระบบนับที่นั่งให้เมื่อรอบรับสมัครกำหนดจำนวนไว้ */}
        </Panel>
      )}

      {offering && needsRound && (
        <Panel>
          {heading("เลือกรอบรับสมัคร")}
          {offeringRounds.length === 0 ? <p className="text-sm text-danger">ขณะนี้ยังไม่เปิดรับสมัครหลักสูตรนี้</p> : (
            <div className="grid gap-3">
              {offeringRounds.map((item) => (
                <ChoiceCard key={item.id} selected={roundId === item.id} onClick={() => setRoundId(item.id)}>
                  <p className="pr-6 text-sm font-medium">{item.label}</p>
                  {kind !== "entrance_exam" ? <div className="mt-2"><SeatBadge seats={seatsLeft(item.capacity, applications, { offeringId: offering.id, roundId: item.id })} /></div> : null}
                </ChoiceCard>
              ))}
            </div>
          )}
        </Panel>
      )}

      {offering && (
        <Panel className={cn(!ready && "opacity-90")}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs text-muted-foreground">หลักสูตรที่เลือก</p>
              <p className="font-semibold">{offering.titleTh}</p>
              {offering.examFee !== undefined ? <p className="text-xs text-muted-foreground">ค่าสมัคร {offering.examFee.toLocaleString("th-TH")} บาท</p> : null}
            </div>
            <Button className="h-11 gap-2 rounded-xl px-5" disabled={!ready || creating} onClick={() => void start()}>
              กรอกใบสมัคร <Icon name="arrow_forward" className="text-base" />
            </Button>
          </div>
        </Panel>
      )}
    </StudentPage>
  );
}
