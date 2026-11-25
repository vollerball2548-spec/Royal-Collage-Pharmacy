import { applicationStatuses, type Application } from "@/domain/applications/model";
import { createMembershipRecord, type MembershipRecord } from "@/roles/shared/features/membership/model";

/**
 * Data layer — UI เรียกผ่าน interface นี้เท่านั้น เพื่อเปลี่ยนจาก localStorage เป็น API/ฐานข้อมูลได้ภายหลัง
 */
export interface ApplicationRepository {
  list(): Promise<Application[]>;
  get(id: string): Promise<Application | undefined>;
  save(application: Application): Promise<void>;
}

export interface MembershipRepository {
  get(memberId: string): Promise<MembershipRecord>;
  save(record: MembershipRecord): Promise<void>;
}

/** พื้นที่เก็บข้อมูลแบบ key-value (localStorage ในเบราว์เซอร์ หรือ Map ในเทสต์) */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const APPLICATIONS_KEY = "pcor_applications_v1";
export const MEMBERSHIP_KEY = "pcor_membership_v1";
export const REPOSITORY_EVENT = "pcor:applications-updated";

export function isApplication(value: unknown): value is Application {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === "string" &&
    (item.kind === "study" || item.kind === "entrance_exam" || item.kind === "approval_exam") &&
    applicationStatuses.includes(item.status as Application["status"]) &&
    typeof item.applicantId === "string" &&
    typeof item.answers === "object" && item.answers !== null &&
    Array.isArray(item.documents) && Array.isArray(item.payments) && Array.isArray(item.history);
}

function readJson(store: KeyValueStore, key: string): unknown {
  const raw = store.getItem(key);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

export class LocalApplicationRepository implements ApplicationRepository {
  constructor(private readonly store: KeyValueStore, private readonly notify: () => void = () => {}) {}

  async list() {
    const parsed = readJson(this.store, APPLICATIONS_KEY);
    return Array.isArray(parsed) ? parsed.filter(isApplication) : [];
  }

  async get(id: string) {
    return (await this.list()).find((application) => application.id === id);
  }

  async save(application: Application) {
    if (!isApplication(application)) throw new Error("ข้อมูลใบสมัครไม่ถูกต้อง");
    const current = await this.list();
    const next = current.some((item) => item.id === application.id)
      ? current.map((item) => (item.id === application.id ? application : item))
      : [application, ...current];
    this.store.setItem(APPLICATIONS_KEY, JSON.stringify(next));
    this.notify();
  }
}

export class LocalMembershipRepository implements MembershipRepository {
  constructor(private readonly store: KeyValueStore) {}

  async get(memberId: string) {
    const parsed = readJson(this.store, MEMBERSHIP_KEY);
    const records = parsed && typeof parsed === "object" ? parsed as Record<string, MembershipRecord> : {};
    return records[memberId] ?? createMembershipRecord(memberId);
  }

  async save(record: MembershipRecord) {
    const parsed = readJson(this.store, MEMBERSHIP_KEY);
    const records = parsed && typeof parsed === "object" ? parsed as Record<string, MembershipRecord> : {};
    this.store.setItem(MEMBERSHIP_KEY, JSON.stringify({ ...records, [record.memberId]: record }));
  }
}

export function browserRepositories() {
  const notify = () => window.dispatchEvent(new Event(REPOSITORY_EVENT));
  return {
    applications: new LocalApplicationRepository(window.localStorage, notify),
    membership: new LocalMembershipRepository(window.localStorage),
  };
}
