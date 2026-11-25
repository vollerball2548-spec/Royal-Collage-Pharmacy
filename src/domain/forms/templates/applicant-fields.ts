import type { ApplicantProfile } from "@/roles/shared/features/applicant/profile";
import { applicantFullName, MARITAL_STATUS_OPTIONS } from "@/roles/shared/features/applicant/profile";
import type { FieldDef, TextField } from "../schema";

/** แหล่งข้อมูลสำหรับ prefill — แปลงโปรไฟล์ผู้สมัครเป็นค่าแบน ๆ ที่ฟอร์มอ้างถึงได้ */
export function applicantPrefillSource(profile: ApplicantProfile) {
  return {
    title: profile.person.title,
    fullName: applicantFullName(profile.person),
    fullNameEn: `${profile.person.firstNameEn} ${profile.person.lastNameEn}`.trim(),
    citizenId: profile.person.citizenId,
    birthDate: profile.person.birthDate,
    maritalStatus: profile.person.maritalStatus,
    email: profile.person.email,
    mobilePhone: profile.person.mobilePhone,
    licenseNumber: profile.license.licenseNumber,
    licenseYear: profile.license.issuedYearBe,
    workplace: profile.workplace.organisation,
    position: profile.workplace.position,
    workplacePhone: profile.workplace.phone,
    education: profile.education.map((record) => ({ ...record })),
    employment: profile.employment.map(({ position, organisation, responsibilities, duration }) => ({ position, organisation, responsibilities, duration })),
  };
}

export const EMAIL_PATTERN = { regex: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$", message: "รูปแบบอีเมลไม่ถูกต้อง" };
export const MOBILE_PATTERN = { regex: "^0[0-9]{1,2}-?[0-9]{3}-?[0-9]{4}$", message: "กรุณากรอกเบอร์โทรศัพท์มือถือให้ถูกต้อง" };
export const POSTAL_PATTERN = { regex: "^[0-9]{5}$", message: "รหัสไปรษณีย์ต้องเป็นตัวเลข 5 หลัก" };

export const registryNotice = "ข้อมูลจากฐานทะเบียนสภาเภสัชกรรม แก้ไขไม่ได้ในใบสมัคร";

export const lockedIdentityFields: readonly FieldDef[] = [
  { id: "fullName", type: "text", label: "ชื่อ-นามสกุล", prefill: "fullName", locked: true, required: true },
  { id: "licenseNumber", type: "text", label: "เลขที่ใบอนุญาตประกอบวิชาชีพเภสัชกรรม", prefill: "licenseNumber", locked: true, required: true },
];

/** ช่องที่อยู่แบบฟอร์มกระดาษ: ชื่อช่องสั้น จัดหลายช่องต่อแถว ข้อความแจ้งเตือนยังระบุว่าเป็นที่อยู่ใด */
export function addressFields(prefix: string, label: string, group: string): TextField[] {
  const field = (id: string, short: string, width: TextField["width"], extra: Partial<TextField> = {}): TextField => ({
    id: `${prefix}${id}`, type: "text", label: short, errorLabel: `${label}: ${short}`, width, group, ...extra,
  });
  return [
    field("HouseNo", "เลขที่", "quarter", { required: true }),
    field("Moo", "หมู่ที่", "quarter"),
    field("Soi", "ตรอก/ซอย", "half"),
    field("Road", "ถนน", "half"),
    field("Subdistrict", "ตำบล/แขวง", "half", { required: true }),
    field("District", "อำเภอ/เขต", "third", { required: true }),
    field("Province", "จังหวัด", "third", { required: true }),
    field("PostalCode", "รหัสไปรษณีย์", "third", { required: true, pattern: POSTAL_PATTERN, maxLength: 5 }),
  ];
}

export const maritalStatusField: FieldDef = {
  id: "maritalStatus",
  type: "radio",
  label: "สถานภาพ",
  prefill: "maritalStatus",
  required: true,
  options: MARITAL_STATUS_OPTIONS.map((value) => ({ value, label: value })),
};
