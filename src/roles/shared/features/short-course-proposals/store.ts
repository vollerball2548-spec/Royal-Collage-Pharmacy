"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { ProgramOffering, ProgramRound } from "@/roles/shared/features/admissions/program-offerings";
import { isShortCourseProposal, totalCredits, type ShortCourseProposal } from "./model";

const STORAGE_KEY = "mock_short_course_proposals";
const STORAGE_EVENT = "royal-college:short-course-proposals-updated";

function readStoredProposals(): ShortCourseProposal[] {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed.filter(isShortCourseProposal) : [];
}

/** shortcut: เก็บใน localStorage ของเบราว์เซอร์ (mock) — ย้ายไปฐานข้อมูลเมื่อมี backend */
export function useShortCourseProposals() {
  const [proposals, setProposals] = useState<ShortCourseProposal[]>([]);
  const proposalsRef = useRef(proposals);
  const [isReady, setIsReady] = useState(false);
  const [storageError, setStorageError] = useState("");

  const reload = useCallback(() => {
    try {
      const stored = readStoredProposals();
      proposalsRef.current = stored;
      setProposals(stored);
      setStorageError("");
    } catch {
      setStorageError("อ่านข้อมูลคำขอเปิดหลักสูตรที่บันทึกไว้ไม่สำเร็จ");
    } finally {
      setIsReady(true);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
    window.addEventListener("storage", reload);
    window.addEventListener(STORAGE_EVENT, reload);
    return () => {
      window.removeEventListener("storage", reload);
      window.removeEventListener(STORAGE_EVENT, reload);
    };
  }, [reload]);

  /** คืน false เมื่อบันทึกไม่สำเร็จ เพื่อให้หน้าจอแจ้งผู้ใช้แทนการทำเหมือนสำเร็จ */
  const save = useCallback((proposal: ShortCourseProposal) => {
    const exists = proposalsRef.current.some((item) => item.id === proposal.id);
    const next = exists
      ? proposalsRef.current.map((item) => (item.id === proposal.id ? proposal : item))
      : [proposal, ...proposalsRef.current];
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      setStorageError("บันทึกข้อมูลลงเครื่องไม่สำเร็จ");
      return false;
    }
    proposalsRef.current = next;
    setProposals(next);
    window.dispatchEvent(new Event(STORAGE_EVENT));
    return true;
  }, []);

  return { proposals, isReady, storageError, save };
}

/** หลักสูตรที่เผยแพร่แล้ว → รายการในหน้าสมัครเรียน (สมัครตรง ไม่มีการสอบคัดเลือก) */
export function publishedProposalCatalog(proposals: readonly ShortCourseProposal[]) {
  const published = proposals.filter((proposal) => proposal.status === "published");
  const offerings: ProgramOffering[] = published.map((proposal) => ({
    id: `proposal:${proposal.id}`,
    collegeCode: proposal.details.collegeCode,
    titleTh: proposal.details.titleTh,
    titleEn: proposal.details.titleEn,
    specialty: proposal.details.titleTh,
    type: "short_course",
    admissionMethod: "direct_enrollment",
    creditBankEligible: Boolean(proposal.creditBankEligible),
    requiresTrainingInstitution: false,
    credits: totalCredits(proposal.details),
    group: proposal.creditBankEligible ? "credit_bank" : "short_course",
  }));
  const rounds: ProgramRound[] = published.flatMap((proposal) => proposal.details.rounds.map((round) => ({
    id: `round:proposal:${proposal.id}:${round.no}`,
    offeringId: `proposal:${proposal.id}`,
    label: `รอบการอบรมที่ ${round.no} (${round.startDate} ถึง ${round.endDate})`,
    status: round.status === "open" ? "open" as const : "closed" as const,
    opensAt: round.startDate,
    closesAt: round.endDate,
    capacity: proposal.details.capacityPerRound,
  })));
  return { offerings, rounds };
}
