"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { browserRepositories, REPOSITORY_EVENT } from "@/data/applications/repository";
import type { Application, ApplicationActor } from "@/domain/applications/model";
import { hasActiveMembership, type MembershipRecord } from "@/roles/shared/features/membership/model";
import { usePortalSession } from "@/roles/shared/features/roles/use-portal-session";

export function useApplicationActor(): ApplicationActor | null {
  const { session } = usePortalSession();
  return useMemo(() => (session ? {
    userId: session.userId,
    userName: session.displayName,
    role: session.role,
    organisationId: session.organisation.id,
  } : null), [session]);
}

/** โหลด/บันทึกใบสมัครผ่าน repository (ตอนนี้คือ localStorage) */
export function useApplications() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    try {
      setApplications(await browserRepositories().applications.list());
      setError("");
    } catch {
      setError("อ่านข้อมูลใบสมัครไม่สำเร็จ");
    } finally {
      setIsReady(true);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
    const handler = () => { void reload(); };
    window.addEventListener(REPOSITORY_EVENT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(REPOSITORY_EVENT, handler);
      window.removeEventListener("storage", handler);
    };
  }, [reload]);

  /** คืน false ถ้าบันทึกไม่สำเร็จ เพื่อไม่ให้หน้าจอแสดงเหมือนสำเร็จ */
  const save = useCallback(async (application: Application) => {
    try {
      await browserRepositories().applications.save(application);
      return true;
    } catch {
      setError("บันทึกใบสมัครไม่สำเร็จ");
      return false;
    }
  }, []);

  return { applications, isReady, error, save };
}

export function useMembership(memberId: string | undefined) {
  const [record, setRecord] = useState<MembershipRecord | null>(null);

  useEffect(() => {
    if (!memberId) return;
    let active = true;
    void browserRepositories().membership.get(memberId).then((value) => { if (active) setRecord(value); });
    return () => { active = false; };
  }, [memberId]);

  const save = useCallback(async (next: MembershipRecord) => {
    await browserRepositories().membership.save(next);
    setRecord(next);
  }, []);

  return { record, isActive: record ? hasActiveMembership(record, new Date().toISOString()) : false, save };
}
