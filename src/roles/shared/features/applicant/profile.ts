import { profileData } from "@/roles/shared/data";
import { currentMemberPassport } from "@/roles/shared/member/domain/member";

/**
 * ข้อมูลผู้สมัครกลาง (person_profile / professional_license / employment_history / education_history)
 * ทุกใบสมัครอ่านจากชุดนี้ และเก็บเฉพาะ snapshot ณ วันยื่น — ไม่เก็บข้อมูลส่วนบุคคลซ้ำเป็นแหล่งข้อมูลหลัก
 */

export interface PostalAddress {
  houseNo: string;
  moo: string;
  soi: string;
  road: string;
  subdistrict: string;
  district: string;
  province: string;
  postalCode: string;
}

export const MARITAL_STATUS_OPTIONS = ["โสด", "สมรส", "อื่นๆ"] as const;
export type MaritalStatus = (typeof MARITAL_STATUS_OPTIONS)[number];

export interface PersonProfile {
  title: string;
  firstNameTh: string;
  lastNameTh: string;
  firstNameEn: string;
  lastNameEn: string;
  citizenId: string;
  birthDate: string;
  maritalStatus: MaritalStatus;
  email: string;
  mobilePhone: string;
  /** ที่อยู่ที่ติดต่อได้สะดวกที่สุด */
  contactAddress: PostalAddress;
}

export interface ProfessionalLicense {
  licenseNumber: string;
  /** ปีที่ได้รับใบอนุญาต (พ.ศ.) */
  issuedYearBe: string;
}

export interface EmploymentRecord {
  id: string;
  /** ตำแหน่ง / ระดับ / สังกัดหน่วยงาน */
  position: string;
  organisation: string;
  responsibilities: string;
  /** ระยะเวลา (ปี-เดือน) ตามแบบฟอร์ม */
  duration: string;
  current: boolean;
}

export const EDUCATION_LEVELS = ["ปริญญาตรี", "ปริญญาโท", "ปริญญาเอก", "หนังสืออนุมัติ / วุฒิบัตรอื่น"] as const;
export type EducationLevel = (typeof EDUCATION_LEVELS)[number];

export interface EducationRecord {
  level: EducationLevel;
  institution: string;
  /** ระหว่างปี (พ.ศ.) */
  years: string;
  /** ปริญญา / วุฒิที่ได้รับ / สาขาวิชา */
  qualification: string;
}

export interface CurrentWorkplace {
  position: string;
  organisation: string;
  address: PostalAddress;
  phone: string;
  fax: string;
  email: string;
}

export interface ApplicantProfile {
  person: PersonProfile;
  license: ProfessionalLicense;
  workplace: CurrentWorkplace;
  employment: EmploymentRecord[];
  education: EducationRecord[];
}

export interface ApplicantSnapshot extends ApplicantProfile {
  capturedAt: string;
}

export function emptyAddress(): PostalAddress {
  return { houseNo: "", moo: "", soi: "", road: "", subdistrict: "", district: "", province: "", postalCode: "" };
}

function toMaritalStatus(value: string): MaritalStatus {
  return (MARITAL_STATUS_OPTIONS as readonly string[]).includes(value) ? value as MaritalStatus : "อื่นๆ";
}

/**
 * shortcut: mock — ผู้ใช้เดโม่คนเดียวจาก profileData; ที่อยู่ในข้อมูลเดิมเป็นข้อความเดียวจึงยังแยกช่องไม่ได้
 * (ผู้สมัครกรอกเองในใบสมัคร) — เปลี่ยนเป็นข้อมูลจากทะเบียนสภาเภสัชกรรมเมื่อมี API
 */
export function currentApplicantProfile(): ApplicantProfile {
  const info = profileData.personalInfo;
  const work = profileData.workHistory;
  const bachelors = profileData.education.bachelors;
  const issuedYear = /\d{4}/.exec(info.licenseIssueDate)?.[0] ?? "";
  return {
    person: {
      title: info.title,
      firstNameTh: info.firstName,
      lastNameTh: info.lastName,
      firstNameEn: info.firstNameEn,
      lastNameEn: info.lastNameEn,
      citizenId: currentMemberPassport.identity.citizenId ?? "",
      birthDate: info.birthDate,
      maritalStatus: toMaritalStatus(info.maritalStatus),
      email: info.email,
      mobilePhone: info.phone,
      contactAddress: emptyAddress(),
    },
    license: { licenseNumber: info.licenseNumber, issuedYearBe: issuedYear },
    workplace: {
      position: work.position,
      organisation: work.currentWorkplace,
      address: emptyAddress(),
      phone: work.workplacePhone,
      fax: "",
      email: "",
    },
    employment: [
      {
        id: "employment-current",
        position: `${work.position} (${work.level})`,
        organisation: work.currentWorkplace,
        responsibilities: work.responsibilities,
        duration: "",
        current: true,
      },
      ...work.previousJobs.map((job, index) => ({
        id: `employment-previous-${index + 1}`,
        position: job.position,
        organisation: job.workplace,
        responsibilities: "",
        duration: job.year,
        current: false,
      })),
    ],
    education: EDUCATION_LEVELS.map((level) => (
      level === "ปริญญาตรี"
        ? { level, institution: bachelors.institution, years: bachelors.graduationYear, qualification: bachelors.degree }
        : { level, institution: "", years: "", qualification: "" }
    )),
  };
}

export function applicantFullName(person: Pick<PersonProfile, "title" | "firstNameTh" | "lastNameTh">) {
  return `${person.title}${person.firstNameTh} ${person.lastNameTh}`.trim();
}

/** สำเนาแยกจากต้นฉบับ เพื่อให้ใบสมัครตรวจย้อนหลังได้แม้ Profile จะเปลี่ยนภายหลัง */
export function snapshotApplicant(profile: ApplicantProfile, capturedAt: string): ApplicantSnapshot {
  return { ...structuredClone(profile), capturedAt };
}

export function formatAddress(address: PostalAddress) {
  return [
    address.houseNo && `เลขที่ ${address.houseNo}`,
    address.moo && `หมู่ ${address.moo}`,
    address.soi && `ซอย ${address.soi}`,
    address.road && `ถนน ${address.road}`,
    address.subdistrict && `ตำบล/แขวง ${address.subdistrict}`,
    address.district && `อำเภอ/เขต ${address.district}`,
    address.province && `จังหวัด ${address.province}`,
    address.postalCode,
  ].filter(Boolean).join(" ");
}
