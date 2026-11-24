# ระยะ 1: Data model, State machine, Permission matrix, API contract

แหล่งข้อกำหนด: สรุปประชุมและ flow การทำงาน (P-COR) + gap analysis ของ repo นี้
สัญลักษณ์: ✅ ยืนยันจากประชุม · 💭 สมมติฐาน · ❓ รอเจ้าของระบบ

> ตัวเลขค่าธรรมเนียมทั้งหมดยังไม่มีระเบียบรองรับ (ประชุมระบุว่าต้อง "เคาะระเบียบ") จึงเก็บเป็นค่าตั้งค่า
> ห้ามฝังใน UI — ตอนนี้อยู่ใน `membershipPolicy` และจะย้ายเข้าตารางตั้งค่าในระยะ 2

---

## 1. Entities

| Entity | Field สำคัญ | ที่มา / สถานะในโค้ด |
|---|---|---|
| `Person` | id, licenseNumber, ข้อมูลพื้นฐานจากสภาฯ (snapshot + `fetchedAt`), ข้อมูลเพิ่มเติม | ✅ auto-fill จากสภาฯ · ❓ API |
| `Membership` | memberId, status (`none`/`extraordinary`/`ordinary`), extraordinarySince, expiresAt, ordinarySince, history | **ใหม่** [`membership/model.ts`](../src/roles/shared/features/membership/model.ts) |
| `Organisation` | id, kind (`royal_college`/`college`/`institution`), parentId | มีแล้ว [`access-model.ts`](../src/roles/shared/features/roles/access-model.ts) |
| `Program` (ถังหลักสูตรกลาง) | id, collegeId, `credentialTrack`, creditBank flag, creditBankCode, payee, visible, dynamicFields[] | ✅ · แทน `CourseDefinition` เดิม; `credentialTrack` **ใหม่** |
| `Subject` | id, programId, code, credits, category (`required`/`elective`/`practice`) | มี category แล้ว; SC: หลักสูตร = รายวิชา ✅ |
| `Cohort` (รุ่น SC) | programId, cohortNo, opensAt, closesAt | **ใหม่** ✅ ปีละ 2–3 รุ่น |
| `ExamRound` | kind (`entrance`/`approval`/`year_exam`), collegeId, programIds, opensAt, closesAt | ต่อยอด `admission-exam-workflow` (เปลี่ยนเจ้าของเป็นส่วนกลาง) |
| `SeatQuota` | roundId, institutionId, programId, seats | **ใหม่** ✅ เช็กตอนสมัคร · ❓ กันที่นั่งตอนไหน |
| `Application` | route, applicantId, collegeId, programId, trainingInstitutionId, status, history | **ใหม่** [`admissions/application.ts`](../src/roles/shared/features/admissions/application.ts) |
| `ExamResult` | roundId, applicantId/studentId, decision, publishedAt, revisions | มีแล้ว |
| `Registration` | term/subject, status, approver, history | มีแล้ว — ต้องเปลี่ยนผู้อนุมัติ (ข้อ 4) |
| `Invoice` | kind, amount, payee, `revenueShares[]`, dueAt, status | มีแล้ว — เพิ่ม `revenueShares` และ kind `exam_fee`, `membership_renewal` |
| `Payment` / `Reconciliation` | invoiceId, provider ref, evidence file ref, verifiedBy | มีแล้วแบบ mock — ต้องยืนยันจาก webhook/เจ้าหน้าที่เท่านั้น |
| `Request` | category, documents, signature workflow | มีแล้ว — เพิ่มประเภท `retake_exam`, `ordinary_membership` |
| `CourseProposal` | proposer (ไม่ต้องล็อกอิน), targetCollegeId หรือ ส่วนกลาง, subjects[], isRevision, councilDecision | ต่อยอด `course-proposal-workflow` |
| `Certificate` | credentialType, councilDecision, issuedAt | มีแล้ว — e-Service **นอกเฟส 1** ✅ |
| `AuditEvent` | append-only | มีแล้ว — ย้ายเข้า DB ระยะ 2 |

---

## 2. State machines

### 2.1 Application (ใหม่ · มี test)
```
draft ─▶ awaiting_fee ─▶ fee_paid ─┬─(A, B)──────────────────────▶ admitted
  │           │                    │                                 ▲ B, C: ต้องมีสมาชิกที่ยังมีผล
  └─▶ cancelled ◀┘                 └─(C, D)─▶ eligible ─▶ passed ──(C)┘
                                             └▶ ineligible  └▶ failed
```
- A `short_course` / B `short_course_credit_bank` / C `entrance_exam` / D `approval_exam`
- `ineligible`, `cancelled` ต้องมีเหตุผล
- D จบที่ `passed` แล้วไปต่อที่โมดูลสมาชิกและคำขอ (ตาม Flow 3D)

### 2.2 Membership (ใหม่ · มี test)
```
none ──(จ่ายค่าขึ้นทะเบียน)──▶ extraordinary ──(คำขอ + วุฒิบัตร/หนังสืออนุมัติ + ชำระ)──▶ ordinary
                                 │  ▲
                 (เลยวันหมดอายุ)  ▼  │ (ต่ออายุ)
                               lapsed  ← คำนวณจาก expiresAt ไม่เก็บลง DB
```
- อายุวิสามัญนับจากวันจ่าย; ต่ออายุก่อนหมด → ต่อจากวันหมดอายุเดิม; ต่อหลังขาด → นับจากวันจ่าย 💭
- สามัญไม่มีวันหมดอายุ 💭 ❓

### 2.3 Registration (มีอยู่ — ต้องแก้)
ปัจจุบัน `pending → approved` โดย **teacher** ([`workflow.ts:229`](../src/roles/shared/features/registration/workflow.ts)).
เป้าหมาย: `pending → approved` โดย **สถาบันหลัก** แล้ว `awaiting_payment → enrolled` → ออกตารางเรียน
ทางเลือกตามข้อขัดแย้ง #1 ในข้อ 5

### 2.4 ผลสอบประจำชั้นปี / ผลประเมิน SC ต่อยอด (มีบางส่วน)
`draft (สถาบันหลัก/ส่วนกลางกรอก) → pending_approval → published (เจ้าหน้าที่ราชวิทยาลัย approve)`
สอบครั้งแรกฟรี; สอบซ่อมผ่านคำขอ `retake_exam` + invoice ✅

---

## 3. Permission matrix (7 role)

`college_staff` = **role ใหม่** (organisation kind `college`). ทุกช่องต้องผ่าน organisation scope ด้วย

| การกระทำ | นักศึกษา | อาจารย์ | สถาบันหลัก | จนท.วิทยาลัย | จนท.ราชวิทยาลัย | ประธานราชวิทยาลัย | Super Admin |
|---|---|---|---|---|---|---|---|
| สมัคร / ชำระ / ดูของตัวเอง | ✓ (self) | | | | | | |
| เปิด-ปิดรอบสอบ / รุ่น SC | | | | ✓ (วิทยาลัยตน) | ✓ (ทั้ง 7) | | |
| ประกาศผู้มีสิทธิ์สอบ / ผลสอบเข้า | | | | ❓ | ✓ | | |
| อนุมัติลงทะเบียนเรียน | | ✗ (ตัดสิทธิ์เดิม) | ✓ (สถาบันตน) ❓#1 | | | | |
| กรอกผลประเมิน | | ❓ | ✓ | | ✓ (สอบส่วนกลาง) | | |
| อนุมัติผลก่อนประกาศ | | | | | ✓ | | |
| กลั่นกรองหลักสูตรที่เสนอ | | | | ✓ (วิทยาลัยตน) | ✓ | | |
| นำเข้าถังหลักสูตร / flag / ผู้รับเงิน / เปิดแสดง | | | | | ✓ | | |
| จัดการสมาชิก (ค้นหา / ประวัติ / ต่ออายุ) | self | | | ❓ ดูได้? | ✓ | | |
| ตรวจ / กระทบยอดการชำระ | | | ❓ (SC ที่เข้าบัญชีสถาบัน) | | ✓ | | |
| ลงนามเอกสาร | | | ❓#1 | | | ✓ | |
| ผู้ใช้ / scope / ตั้งค่าระบบ | | | | | | | ✓ |

การบังคับใช้: ตาราง policy เดียวที่ server (ระยะ 3) — ฝั่ง client ใช้แค่ซ่อนเมนู

---

## 4. API contract (ร่าง · REST `/api/v1`)

| Method | Path | ผู้เรียก | หมายเหตุ |
|---|---|---|---|
| GET | `/me/council-profile` | ผู้สมัคร | auto-fill จากสภาฯ — **stub จนกว่าได้ API** ❓ |
| GET | `/programs?track=&college=` | ทุกคน | เฉพาะ `visible` |
| GET | `/rounds?programId=` · `/rounds/:id/seats` | ทุกคน | ที่นั่งคงเหลือต่อสถาบัน |
| POST · PATCH | `/rounds` · `/rounds/:id` | จนท.วิทยาลัย / ราชวิทยาลัย | เปิด-ปิดรอบ |
| POST | `/applications` | ผู้สมัคร | สร้าง `draft` (validate ตาม route) |
| POST | `/applications/:id/submit` | ผู้สมัคร | → `awaiting_fee` + ออก invoice + ตรวจที่นั่ง |
| POST | `/rounds/:id/eligibility` · `/results` · `/publish` | จนท.ราชวิทยาลัย | bulk |
| POST | `/applications/:id/admit` | system | หลังชำระ + ตรวจสมาชิก |
| GET | `/members?status=&q=` · `/members/:id` | จนท.ราชวิทยาลัย | 3 ถัง + ประวัติชำระ/ต่ออายุ |
| POST | `/members/:id/extraordinary` · `/renewals` | system (หลังชำระ) | |
| POST | `/requests` (`ordinary_membership`, `retake_exam`, …) | นักศึกษา | |
| POST | `/registrations` · `/registrations/:id/decision` | นักศึกษา · สถาบันหลัก | |
| GET | `/invoices?mine` | นักศึกษา | |
| POST | `/payments/webhook` | payment provider | **ทางเดียวที่ทำให้ invoice เป็น `paid`** (นอกจากเจ้าหน้าที่ยืนยันสลิป) |
| POST | `/course-proposals` | สาธารณะ (ไม่ login) | ต้องมี rate limit + anti-spam ❓ |
| POST | `/course-proposals/:id/screen` · `/council-decision` · `/import` | จนท.วิทยาลัย / ราชวิทยาลัย | หลักสูตรปรับปรุงข้ามขั้นสภาฯ |

Invoice ต้องมี `revenueShares: [{ organisationId, rate }]` — ค่าสมัครสอบ: ราชวิทยาลัย 90% / วิทยาลัย 10% ✅

---

## 5. ข้อขัดแย้งที่ออกแบบเป็นทางเลือกไว้

| # | ประเด็น | ทางเลือก | ข้อเสนอ |
|---|---|---|---|
| 1 | ผู้อนุมัติลงทะเบียน: "สถาบันหลัก Approve" vs "ประธานสถาบันลงนาม" | (ก) สถาบันหลักกด approve อย่างเดียว · (ข) สถาบันหลัก approve + แนบใบที่ประธานสถาบันเซ็น · (ค) เพิ่ม role ประธานสถาบันใน signature workflow | (ข) — ใช้ของเดิมได้มากสุด ไม่เพิ่ม role |
| 2 | ลำดับสอบอนุมัติบัตร: กระดาน vs Flow 3D | ยึด Flow 3D (ผ่าน → วิสามัญ → คำขอสามัญ → หนังสืออนุมัติที่ e-Service สภาฯ) | ยึด 3D — **implement ไว้แล้ว** |
| 3 | 3 vs 4 เส้นทาง | ใช้ 4 route ในระบบ แสดงเป็น "เรียน" / "สอบ" 2 ปุ่มบนหน้าแรก | **implement ไว้แล้ว** |
| 4 | ประธานระดับวิทยาลัย (`signature:college`) ที่ไม่อยู่ใน 7 role | คงไว้เป็น scope ของ role `president` · หรือตัดออก | รอคำตอบ — ไม่แตะโค้ดเดิม |

## 6. คำถามที่ยังเปิด

1. API สภาฯ: endpoint, วิธียืนยันตัวตน, field ที่ได้ (บล็อก auto-fill)
2. ขาดสมาชิกภาพแล้วต่ออายุด้วย 500 ได้ หรือต้องขึ้นทะเบียนใหม่ 1,000
3. สามัญมีวันหมดอายุไหม
4. กันที่นั่งตอนส่งใบสมัคร ตอนจ่ายค่าสอบ หรือตอนสอบผ่าน
5. ระยะชำระ 14 วัน / ค่าปรับ 500 ในโค้ดเดิม ยังใช้ไหม
6. อาจารย์ยังกรอกผลรายวิชาได้ไหม หรือย้ายไปสถาบันหลักทั้งหมด
7. Payment gateway / hosting / ฐานข้อมูล

## 7. สิ่งที่ทำในระยะ 1

- เพิ่ม `src/roles/shared/features/membership/` (model + test)
- เพิ่ม `src/roles/shared/features/admissions/application.ts` (+ test)
- เอกสารนี้
- **ยังไม่ได้** แก้ของเดิม (registration approver, payee, mock DB, UI) — ทำในระยะ 4–6 หลังเคลียร์ข้อ 5
