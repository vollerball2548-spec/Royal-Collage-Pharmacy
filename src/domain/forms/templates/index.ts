import type { CollegeCode } from "@/roles/shared/data/college-directory";
import {
  APPROVAL_EXAM_DECLARATION,
  COLLEGE_QUALIFICATIONS,
  GENERAL_QUALIFICATIONS,
  type QualificationItem,
} from "@/roles/shared/features/admissions/approval-exam";
import { EDUCATION_LEVELS } from "@/roles/shared/features/applicant/profile";
import {
  proposalStepErrors,
  type ShortCourseProposalDetails,
} from "@/roles/shared/features/short-course-proposals/model";
import type { FieldOption, FormAnswers, FormError, FormTemplate } from "../schema";
import {
  addressFields,
  EMAIL_PATTERN,
  lockedIdentityFields,
  maritalStatusField,
  MOBILE_PATTERN,
  registryNotice,
} from "./applicant-fields";
import { documentField } from "./documents";

export const STUDY_DECLARATION = "ข้าพเจ้าขอรับรองว่าข้อความข้างต้นเป็นความจริงทุกประการ";

// ─── 1. แบบสมัคร Short Course / Credit Bank ──────────────────────────────────

export interface ShortCourseTemplateOptions {
  /** ประเภทที่หลักสูตรนี้เปิดให้เลือก */
  tracks: readonly ("credit_bank" | "standard")[];
  /** รายวิชาให้เลือก (วุฒิบัตรระบบ Credit Bank) — ว่างได้ */
  subjects?: readonly FieldOption[];
}

export function shortCourseTemplate(options: ShortCourseTemplateOptions): FormTemplate {
  const trackOptions: FieldOption[] = options.tracks.map((track) => ({
    value: track,
    label: track === "credit_bank" ? "ต่อยอด Credit Bank (สะสมหน่วยกิต ต้องเป็นสมาชิกวิสามัญ)" : "ไม่ต่อยอด (ได้รับ Certificate เมื่อผ่านการอบรม)",
  }));
  return {
    id: "short-course",
    version: 1,
    title: "แบบสมัคร Short Course / Credit Bank",
    paperTitle: ["ใบสมัครเข้ารับการอบรมหลักสูตรระยะสั้น", "ราชวิทยาลัยเภสัชกรรมแห่งประเทศไทย"],
    steps: [
      {
        id: "applicant",
        title: "ข้อมูลผู้สมัคร",
        description: registryNotice,
        fields: [
          ...lockedIdentityFields,
          { id: "email", type: "text", label: "อีเมล", prefill: "email", required: true, pattern: EMAIL_PATTERN },
          { id: "mobilePhone", type: "text", label: "เบอร์โทรศัพท์มือถือ", prefill: "mobilePhone", required: true, pattern: MOBILE_PATTERN },
          { id: "workplace", type: "text", label: "หน่วยงาน / สถานที่ทำงาน", prefill: "workplace", required: true },
          { id: "position", type: "text", label: "ตำแหน่ง", prefill: "position" },
        ],
      },
      {
        id: "course",
        title: "ประเภทการเรียน",
        fields: [
          { id: "courseTrack", type: "radio", label: "ประเภทหลักสูตร", required: true, options: trackOptions, wide: true },
          ...(options.subjects && options.subjects.length > 0
            ? [{ id: "subjects", type: "checkbox" as const, label: "รายวิชาที่ต้องการสมัคร", options: options.subjects, minSelected: 1, required: true, wide: true }]
            : []),
        ],
      },
      {
        id: "documents",
        title: "เอกสารประกอบ",
        fields: [
          documentField("license", { required: true }),
          // TODO(business): หลักสูตร Credit Bank ต้องใช้หนังสือยินยอมต้นสังกัดหรือไม่ — ตอนนี้เป็นทางเลือก
          documentField("employer_permission"),
          documentField("photo"),
          documentField("cv"),
        ],
      },
      {
        id: "confirm",
        title: "รับรองและส่ง",
        fields: [{ id: "declaration", type: "signature", label: "การรับรองความถูกต้อง", statement: STUDY_DECLARATION, nameField: "fullName", required: true, wide: true }],
      },
    ],
  };
}

// ─── 2. แบบสมัครสอบคัดเลือก ป.ชั้นสูง 1 ปี / วุฒิบัตร 4 ปี ──────────────────────

export const entranceTemplate: FormTemplate = {
  id: "entrance-exam",
  version: 1,
  title: "แบบสมัครสอบคัดเลือก ป.ชั้นสูง 1 ปี / วุฒิบัตร 4 ปี",
  paperTitle: [
    "ใบสมัครสอบคัดเลือกเพื่อเข้ารับการฝึกอบรม",
    "หลักสูตรวุฒิบัตรแสดงความรู้ ความชำนาญในการประกอบวิชาชีพเภสัชกรรม",
    "ราชวิทยาลัยเภสัชกรรมแห่งประเทศไทย",
  ],
  steps: [
    {
      id: "personal",
      title: "ส่วนที่ 1: ข้อมูลส่วนบุคคล",
      description: registryNotice,
      fields: [
        { id: "title", type: "text", label: "คำนำหน้าชื่อ", prefill: "title", locked: true },
        lockedIdentityFields[0],
        { id: "fullNameEn", type: "text", label: "ชื่อ-นามสกุล (ภาษาอังกฤษ)", prefill: "fullNameEn", locked: true },
        { id: "citizenId", type: "text", label: "เลขประจำตัวประชาชน (13 หลัก)", prefill: "citizenId", locked: true },
        { id: "birthDate", type: "text", label: "วัน/เดือน/ปีเกิด", prefill: "birthDate", locked: true },
        maritalStatusField,
        { id: "mobilePhone", type: "text", label: "เบอร์โทรศัพท์มือถือ", prefill: "mobilePhone", required: true, pattern: MOBILE_PATTERN },
        { id: "email", type: "text", label: "อีเมล (E-mail)", prefill: "email", required: true, pattern: EMAIL_PATTERN },
      ],
    },
    {
      id: "license",
      title: "ส่วนที่ 2: ใบอนุญาตและประวัติการทำงาน",
      description: registryNotice,
      fields: [
        lockedIdentityFields[1],
        { id: "licenseYear", type: "text", label: "ปีที่ได้รับใบอนุญาต (พ.ศ.)", prefill: "licenseYear", locked: true },
        { id: "workplace", type: "text", label: "สถานที่ปฏิบัติงานปัจจุบัน", prefill: "workplace", required: true, wide: true },
      ],
    },
    {
      id: "documents",
      title: "ส่วนที่ 4: การแนบหลักฐานประกอบการสมัคร",
      fields: [
        documentField("license", { required: true }),
        documentField("employer_permission", { required: true }),
        documentField("patient_care_500h", {
          required: true,
          visibleWhen: { ctx: "collegeCode", in: ["วภท.", "CPPM"] },
          hint: "สำหรับสาขาเภสัชบำบัดและสาขาเภสัชพันธุศาสตร์และเภสัชกรรมแม่นยำ",
        }),
        documentField("photo"),
        documentField("degree"),
        documentField("transcript"),
        documentField("recommendation"),
        documentField("cv"),
      ],
    },
    {
      id: "confirm",
      title: "รับรองและส่ง",
      fields: [{ id: "declaration", type: "signature", label: "การรับรองความถูกต้อง", statement: STUDY_DECLARATION, nameField: "fullName", required: true, wide: true }],
    },
  ],
};

// ─── 3. แบบสมัครสอบหนังสืออนุมัติ ───────────────────────────────────────────

function qualificationOptions(items: readonly QualificationItem[]): FieldOption[] {
  return items.map((item) => ({ value: item.id, label: item.label, ...(item.anyOf ? { children: qualificationOptions(item.anyOf) } : {}) }));
}

export function approvalExamTemplate(collegeCode: CollegeCode): FormTemplate {
  const collegeOptions = qualificationOptions(COLLEGE_QUALIFICATIONS[collegeCode]);
  return {
    id: "approval-exam",
    version: 1,
    title: "แบบสมัครสอบหนังสืออนุมัติ",
    paperTitle: ["ใบสมัครสอบหนังสืออนุมัติแสดงความรู้", "ความชำนาญในการประกอบวิชาชีพเภสัชกรรม"],
    steps: [
      {
        id: "personal",
        title: "ข้อมูลผู้สมัคร",
        groups: [
          { id: "program", title: "สาขาวิชาและวิทยาลัยที่สมัครสอบ", description: "เลือกไว้แล้วจากขั้นตอนก่อนหน้า (เลือกได้ 1 สาขา)" },
          { id: "person", title: "ข้อมูลส่วนบุคคล", description: registryNotice },
          { id: "work", title: "ตำแหน่งและสถานที่ทำงานปัจจุบัน", description: "กรอกที่อยู่ของหน่วยงานที่สังกัด" },
          {
            id: "contact",
            title: "ที่อยู่ปัจจุบันที่สามารถติดต่อได้สะดวกที่สุด",
            copy: {
              label: "ใช้ที่อยู่เดียวกับสถานที่ทำงาน",
              from: Object.fromEntries(["HouseNo", "Moo", "Soi", "Road", "Subdistrict", "District", "Province", "PostalCode"].map((key) => [`contact${key}`, `workplace${key}`])),
            },
          },
        ],
        fields: [
          { id: "program", type: "text", label: "สาขาวิชา / วิทยาลัย", locked: true, group: "program", width: "full" },
          { ...lockedIdentityFields[0], label: "ข้าพเจ้า (ภก. / ภญ.)", group: "person", width: "half" },
          { ...lockedIdentityFields[1], label: "ใบอนุญาตฯ เลขที่ ภ.", group: "person", width: "quarter" },
          { id: "birthDate", type: "text", label: "วัน/เดือน/ปีเกิด", prefill: "birthDate", locked: true, group: "person", width: "quarter" },
          { id: "position", type: "text", label: "ตำแหน่ง", errorLabel: "ปัจจุบันปฏิบัติงานในตำแหน่ง", prefill: "position", required: true, group: "work", width: "half" },
          { id: "workplace", type: "text", label: "สังกัดหน่วยงาน / สถานที่ทำงาน", prefill: "workplace", required: true, group: "work", width: "half" },
          ...addressFields("workplace", "ที่อยู่สถานที่ทำงาน", "work"),
          { id: "workplacePhone", type: "text", label: "โทรศัพท์", errorLabel: "โทรศัพท์ที่ทำงาน", prefill: "workplacePhone", group: "work", width: "third" },
          { id: "workplaceFax", type: "text", label: "โทรสาร", group: "work", width: "third" },
          { id: "email", type: "text", label: "E-mail", prefill: "email", required: true, pattern: EMAIL_PATTERN, group: "work", width: "third" },
          ...addressFields("contact", "ที่อยู่ปัจจุบันที่ติดต่อได้", "contact"),
          { id: "mobilePhone", type: "text", label: "โทรศัพท์เคลื่อนที่", prefill: "mobilePhone", required: true, pattern: MOBILE_PATTERN, group: "contact", width: "half" },
        ],
      },
      {
        id: "history",
        title: "ประวัติการศึกษาและการทำงาน",
        fields: [
          {
            id: "education",
            type: "repeater",
            label: "ประวัติการศึกษา",
            itemLabel: "ระดับการศึกษา",
            prefill: "education",
            minItems: 1,
            required: true,
            wide: true,
            fixedItems: EDUCATION_LEVELS.map((level) => ({ level })),
            fields: [
              { id: "level", type: "select", label: "ระดับการศึกษา", options: EDUCATION_LEVELS.map((value) => ({ value, label: value })), required: true },
              { id: "institution", type: "text", label: "ชื่อสถานศึกษา / สถาบัน", required: { field: "level", equals: "ปริญญาตรี" } },
              { id: "years", type: "text", label: "ระหว่างปี (พ.ศ.)" },
              { id: "qualification", type: "text", label: "ปริญญา / วุฒิที่ได้รับ / สาขาวิชา", required: { field: "level", equals: "ปริญญาตรี" } },
            ],
          },
          {
            id: "employment",
            type: "repeater",
            label: "ประวัติการทำงาน",
            itemLabel: "ตำแหน่งงาน",
            prefill: "employment",
            minItems: 1,
            required: true,
            wide: true,
            fields: [
              { id: "position", type: "text", label: "ตำแหน่ง / ระดับ", required: true },
              { id: "organisation", type: "text", label: "สังกัดหน่วยงาน", required: true },
              { id: "responsibilities", type: "textarea", label: "หน้าที่ความรับผิดชอบหลัก" },
              { id: "duration", type: "text", label: "ระยะเวลา (ปี-เดือน)" },
            ],
          },
        ],
      },
      {
        id: "qualifications",
        title: "การตรวจสอบคุณสมบัติ",
        description: "ทำเครื่องหมายคุณสมบัติที่ท่านมี เจ้าหน้าที่จะตรวจสอบและรับรองพร้อมหลักฐาน",
        fields: [
          { id: "generalQualifications", type: "checkbox", label: "คุณสมบัติทั่วไป (ทุกวิทยาลัยต้องมี)", options: qualificationOptions(GENERAL_QUALIFICATIONS), minSelected: GENERAL_QUALIFICATIONS.length, required: true, wide: true },
          ...(collegeOptions.length > 0
            ? [{ id: "collegeQualifications", type: "checkbox" as const, label: "คุณสมบัติเฉพาะของวิทยาลัย", options: collegeOptions, wide: true }]
            // TODO(business): แบบฟอร์มยังไม่มีคุณสมบัติเฉพาะของวิทยาลัยนี้ (เช่น CPPM)
            : []),
          { id: "qualificationNote", type: "textarea", label: "รายละเอียดเพิ่มเติม (ระยะเวลาประสบการณ์ ชื่อผลงาน)", wide: true },
        ],
      },
      {
        id: "documents",
        title: "เอกสารหลักฐานแนบประกอบการสมัคร",
        description: "กรุณาลงนามรับรองสำเนาถูกต้องทุกฉบับ",
        fields: [
          documentField("photo", { required: true }),
          documentField("license", { required: true }),
          documentField("work_experience", { required: true }),
          documentField("academic_works", { required: true }),
          documentField("name_change", { hint: "แนบเฉพาะกรณีชื่อ-นามสกุลไม่ตรงกับใบอนุญาตฯ" }),
        ],
      },
      {
        id: "confirm",
        title: "การรับรองความถูกต้อง",
        fields: [{ id: "declaration", type: "signature", label: "การรับรองความถูกต้อง", statement: APPROVAL_EXAM_DECLARATION, nameField: "fullName", required: true, wide: true }],
      },
    ],
  };
}

// ─── 4. ฟอร์มเสนอโครงการ/หลักสูตรระยะสั้น ─────────────────────────────────────

const PROPOSAL_STEP_BY_RULE: Record<number, string> = { 3: "structure", 5: "resources" };

/** แปลงคำตอบของฟอร์มเป็นรายละเอียดคำขอ (ใช้ state machine ของ short-course-proposals) */
export function answersToProposalDetails(answers: FormAnswers, collegeCode: CollegeCode): ShortCourseProposalDetails {
  const text = (key: string) => String(answers[key] ?? "");
  const number = (key: string) => Number(answers[key] ?? 0) || 0;
  const rows = (key: string) => (Array.isArray(answers[key]) ? answers[key] as Record<string, unknown>[] : []);
  return {
    titleTh: text("titleTh"), titleEn: text("titleEn"), certificateNameTh: text("certificateNameTh"), certificateNameEn: text("certificateNameEn"),
    collegeCode: (answers.collegeCode as CollegeCode | undefined) ?? collegeCode,
    mainAndAffiliateInstitutions: text("mainAndAffiliateInstitutions"), otherResponsibleUnits: text("otherResponsibleUnits"), objectives: text("objectives"),
    capacityPerRound: number("capacityPerRound"),
    rounds: rows("rounds").map((row, index) => ({ id: String(row.id ?? `round-${index + 1}`), no: index + 1, startDate: String(row.startDate ?? ""), endDate: String(row.endDate ?? ""), status: "planned" as const })),
    extraQualifications: text("extraQualifications"),
    durationWeeks: number("durationWeeks"), theoryCredits: number("theoryCredits"), practiceCredits: number("practiceCredits"),
    theoryLocation: text("theoryLocation"),
    topics: rows("topics").map((row) => ({ topic: String(row.topic ?? ""), hours: Number(row.hours ?? 0) || 0, instructor: String(row.instructor ?? "") })),
    practiceDetails: text("practiceDetails"),
    organiser: text("organiser"), practiceSite: text("practiceSite"),
    coordinators: rows("coordinators").map((row) => ({ name: String(row.name ?? ""), affiliation: String(row.affiliation ?? ""), background: String(row.background ?? "") })),
    trainers: rows("trainers").map((row) => ({ name: String(row.name ?? ""), affiliation: String(row.affiliation ?? ""), background: String(row.background ?? "") })),
    books: rows("books").map((row) => String(row.title ?? "")),
    journals: rows("journals").map((row) => String(row.title ?? "")),
    computers: number("computers"),
    budget: text("budget"), applicationDetails: text("applicationDetails"),
  };
}

const personFields = [
  { id: "name", type: "text" as const, label: "ชื่อ-สกุล", required: true },
  { id: "affiliation", type: "text" as const, label: "สังกัด" },
  { id: "background", type: "text" as const, label: "การศึกษา / ประสบการณ์" },
];

export function courseProposalTemplate(collegeOptions: readonly FieldOption[]): FormTemplate {
  return {
    id: "course-proposal",
    version: 1,
    title: "ฟอร์มเสนอหลักสูตรระยะสั้น",
    paperTitle: ["ประกาศนียบัตรวิชาชีพเภสัชกรรม", "(คำขอเปิดหลักสูตรการฝึกอบรมระยะสั้น)"],
    steps: [
      {
        id: "course",
        title: "ข้อมูลหลักสูตร",
        fields: [
          { id: "titleTh", type: "text", label: "ชื่อหลักสูตร (ภาษาไทย)", required: true },
          { id: "titleEn", type: "text", label: "ชื่อหลักสูตร (ภาษาอังกฤษ)", required: true },
          { id: "certificateNameTh", type: "text", label: "ชื่อประกาศนียบัตร (ภาษาไทย)", hint: "ประกาศนียบัตรวิชาชีพเภสัชกรรม (สาขา...)", required: true },
          { id: "certificateNameEn", type: "text", label: "ชื่อประกาศนียบัตร (ภาษาอังกฤษ)", hint: "Certificate in Pharmacy (...)", required: true },
          { id: "collegeCode", type: "select", label: "วิทยาลัยเจ้าของหลักสูตร", options: collegeOptions, required: true },
          { id: "mainAndAffiliateInstitutions", type: "textarea", label: "สถาบันหลักและสถาบันสมทบ", required: true, wide: true },
          { id: "otherResponsibleUnits", type: "text", label: "หน่วยงานรับผิดชอบอื่น (ถ้ามี)", wide: true },
          { id: "objectives", type: "textarea", label: "ปรัชญาและวัตถุประสงค์ของหลักสูตร", required: true, wide: true },
        ],
      },
      {
        id: "rounds",
        title: "รอบอบรมและการรับสมัคร",
        fields: [
          { id: "capacityPerRound", type: "number", label: "จำนวนผู้รับต่อรอบ (คน)", required: true, min: 1, integer: true },
          { id: "rounds", type: "repeater", label: "รอบการอบรม", itemLabel: "รอบการอบรมที่", minItems: 1, required: true, wide: true, fields: [
            { id: "startDate", type: "date", label: "ระหว่างวันที่", required: true },
            { id: "endDate", type: "date", label: "ถึงวันที่", required: true },
          ] },
          { id: "extraQualifications", type: "textarea", label: "คุณสมบัติผู้สมัครเพิ่มเติม (ถ้ามี)", hint: "คุณสมบัติข้อ 6.1–6.3 เป็นไปตามแม่แบบ", wide: true },
          { id: "applicationDetails", type: "textarea", label: "การสมัครเข้ารับการอบรม", required: true, wide: true },
        ],
      },
      {
        id: "structure",
        title: "โครงสร้างหลักสูตรและรายวิชา",
        fields: [
          { id: "durationWeeks", type: "number", label: "ระยะเวลาการฝึกอบรม (สัปดาห์)", min: 16, required: true },
          { id: "theoryCredits", type: "number", label: "ภาคทฤษฎี (หน่วยกิต)", hint: "15 ชั่วโมง/หน่วยกิต", min: 2, required: true },
          { id: "practiceCredits", type: "number", label: "ภาคปฏิบัติ (หน่วยกิต)", hint: "30 ชั่วโมง/หน่วยกิต", min: 14, required: true },
          { id: "theoryLocation", type: "text", label: "สถานที่บรรยายภาคทฤษฎี", required: true },
          { id: "topics", type: "repeater", label: "หัวข้อภาคทฤษฎี", itemLabel: "หัวข้อที่", minItems: 1, required: true, wide: true, fields: [
            { id: "topic", type: "text", label: "หัวข้อ", required: true },
            { id: "hours", type: "number", label: "จำนวนชั่วโมง", min: 1, required: true },
            { id: "instructor", type: "text", label: "ผู้สอน", required: true },
          ] },
          { id: "practiceDetails", type: "textarea", label: "รายละเอียดภาคปฏิบัติ", required: true, wide: true },
        ],
      },
      {
        id: "resources",
        title: "หน่วยงาน ผู้สอน และทรัพยากร",
        fields: [
          { id: "organiser", type: "text", label: "หน่วยงานที่จัดอบรม", required: true },
          { id: "practiceSite", type: "text", label: "หน่วยงานที่เป็นแหล่งฝึกปฏิบัติงาน", required: true },
          { id: "coordinators", type: "repeater", label: "ผู้ประสานงานการฝึกอบรม", itemLabel: "ผู้ประสานงาน", minItems: 1, required: true, wide: true, fields: personFields },
          { id: "trainers", type: "repeater", label: "ผู้ฝึกอบรม", itemLabel: "ผู้ฝึกอบรม", minItems: 1, required: true, wide: true, fields: personFields },
          { id: "books", type: "repeater", label: "หนังสือในสาขาเฉพาะทางโรค (อย่างน้อย 5 เล่ม)", itemLabel: "หนังสือ", minItems: 5, required: true, wide: true, fields: [{ id: "title", type: "text", label: "ชื่อหนังสือ", required: true }] },
          { id: "journals", type: "repeater", label: "วารสารต่างประเทศ (อย่างน้อย 1 รายการ)", itemLabel: "วารสาร", minItems: 1, required: true, wide: true, fields: [{ id: "title", type: "text", label: "ชื่อวารสาร", required: true }] },
          { id: "computers", type: "number", label: "คอมพิวเตอร์สำหรับสืบค้นข้อมูล (เครื่อง)", hint: "1 เครื่อง/ผู้ฝึกอบรม 3 ราย", min: 0, integer: true, required: true },
          { id: "budget", type: "textarea", label: "งบประมาณในการฝึกอบรม", required: true, wide: true },
        ],
      },
    ],
    // กติกาข้ามฟิลด์ของแม่แบบ (ชั่วโมงบรรยาย หน่วยกิตรวม จำนวนคอมพิวเตอร์) — ใช้ชุดเดียวกับ state machine ของคำขอ
    rules: (answers, ctx) => {
      const details = answersToProposalDetails(answers, (ctx.collegeCode as CollegeCode | undefined) ?? "วภท.");
      const errors: FormError[] = [];
      for (const step of [3, 5]) {
        for (const message of proposalStepErrors(step, details)) {
          if (/ชั่วโมงบรรยายรวม|หน่วยกิตรวม|คอมพิวเตอร์/.test(message)) errors.push({ fieldId: PROPOSAL_STEP_BY_RULE[step], message });
        }
      }
      return errors;
    },
  };
}

export function proposalDetailsToAnswers(details: ShortCourseProposalDetails): FormAnswers {
  return {
    ...details,
    rounds: details.rounds.map((round) => ({ id: round.id, startDate: round.startDate, endDate: round.endDate })),
    topics: details.topics.map((topic) => ({ ...topic })),
    coordinators: details.coordinators.map((person) => ({ ...person })),
    trainers: details.trainers.map((person) => ({ ...person })),
    books: details.books.map((title) => ({ title })),
    journals: details.journals.map((title) => ({ title })),
  } as FormAnswers;
}
