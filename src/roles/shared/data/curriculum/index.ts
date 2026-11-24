/**
 * ถังหลักสูตรกลาง (หลักสูตรวุฒิบัตร 4 ปี ทั้ง 7 วิทยาลัย)
 * ข้อมูลสร้างจากไฟล์ Excel ของราชวิทยาลัยด้วย `scripts/import-curriculum.py` — ห้ามแก้ curriculum.json ด้วยมือ
 */
import type { CollegeCode } from "@/roles/shared/data/college-directory";

import curriculum from "./curriculum.json";

/** residency = ระบบปฏิบัติงานประจำ, credit_bank = ระบบสะสมหน่วยกิต (Modular) */
export type CurriculumTrainingSystem = "residency" | "credit_bank";
/** unspecified = ไฟล์ต้นทางไม่ได้ระบุหมวดที่ map ได้ (เก็บข้อความเดิมไว้ใน categoryLabel) */
export type CurriculumCategory = "required" | "elective" | "practice" | "research" | "unspecified";

export interface CurriculumSubject {
  code: string | null;
  titleTh: string | null;
  titleEn: string | null;
  categoryLabel: string | null;
  category: CurriculumCategory;
  credits: number | null;
  creditsText: string | null;
  hours: string | null;
  /** ตัวเลือกย่อย (เลือกฝึก 1 ด้าน) ของรายวิชาที่ระบุ — ไม่นับหน่วยกิตแยก */
  optionOf: string | null;
}

export interface CurriculumProgram {
  collegeCode: CollegeCode;
  system: CurriculumTrainingSystem;
  titleTh: string | null;
  titleEn: string | null;
  credentialTh: string | null;
  credentialEn: string | null;
  years: number | null;
  minCredits: number | null;
  trainingSystem: string | null;
  councilAnnouncement: string | null;
  subjects: CurriculumSubject[];
}

export interface CurriculumData {
  source: string;
  programs: CurriculumProgram[];
  /** ความผิดปกติในไฟล์ต้นทางที่ต้องให้เจ้าของข้อมูลแก้ */
  warnings: string[];
}

export const curriculumData = curriculum as CurriculumData;
export const curriculumPrograms = curriculumData.programs;

export const curriculumSystemLabel: Readonly<Record<CurriculumTrainingSystem, string>> = {
  residency: "ระบบปฏิบัติงานประจำ (Residency)",
  credit_bank: "ระบบสะสมหน่วยกิต (Credit Bank)",
};

export const curriculumCategoryLabel: Readonly<Record<CurriculumCategory, string>> = {
  required: "วิชาบังคับ",
  elective: "วิชาเลือก",
  practice: "วิชาชีพ / ฝึกปฏิบัติ",
  research: "วิจัย / โครงงาน",
  unspecified: "ยังไม่ระบุหมวด",
};

export function findCurriculumProgram(collegeCode: CollegeCode) {
  return curriculumPrograms.find((program) => program.collegeCode === collegeCode);
}
