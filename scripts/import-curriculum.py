"""นำเข้าถังหลักสูตรกลางจากไฟล์ Excel ของราชวิทยาลัย (Pharmacy_Curriculum_Courses.xlsx)

ใช้:  python -I scripts/import-curriculum.py <path-to-xlsx> [output.json]
ผลลัพธ์: src/roles/shared/data/curriculum/curriculum.json (ใช้แค่ stdlib)

แต่ละชีตวิทยาลัยมีคอลัมน์ไม่เหมือนกัน สคริปต์จึงหาคอลัมน์จากหัวตาราง และบันทึกข้อมูลที่ผิดปกติ
(รหัสซ้ำ ชื่อซ้ำต่างรหัส แถวที่ไม่มีรหัส) ไว้ใน `warnings` แทนการเดาแก้เอง
"""
import json
import os
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

NS = {
    "m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}
T = "{%s}t" % NS["m"]

SHEET_COLLEGE = {
    "ว.เภสัชบำบัด": "วภท.",
    "ว.คุ้มครองผู้บริโภค": "วคบท.",
    "ว.เภสัชกิจ": "CPAT",
    "ว.เภสัชกรรมชุมชน": "วภช.",
    "ว.อุตสาหการ": "CIPT",
    "ว.สมุนไพร": "สมุนไพร",
    "ว.เภสัชพันธุศาสตร์": "CPPM",
}
PROGRAM_COLLEGE = {
    "วิทยาลัยเภสัชบำบัด": "วภท.",
    "วิทยาลัยการคุ้มครองผู้บริโภคด้านยาและสุขภาพ": "วคบท.",
    "วิทยาลัยเภสัชกรรมสมุนไพร": "สมุนไพร",
    "วิทยาลัยเภสัชกรรมอุตสาหการ": "CIPT",
    "วิทยาลัยการบริหารเภสัชกิจ": "CPAT",
    "วิทยาลัยเภสัชกรรมชุมชน": "วภช.",
    "วิทยาลัยเภสัชพันธุศาสตร์และเภสัชกรรมแม่นยำ": "CPPM",
}
THAI = re.compile(r"[฀-๿]")


def col_index(ref):
    n = 0
    for ch in re.match(r"[A-Z]+", ref).group():
        n = n * 26 + ord(ch) - 64
    return n - 1


def clean(value):
    value = re.sub(r"\s+", " ", value or "").strip()
    return value[:-2] if re.fullmatch(r"-?\d+\.0", value) else value


def read_workbook(path):
    z = zipfile.ZipFile(path)
    shared = []
    if "xl/sharedStrings.xml" in z.namelist():
        for si in ET.fromstring(z.read("xl/sharedStrings.xml")).findall("m:si", NS):
            shared.append("".join(t.text or "" for t in si.iter(T)))
    workbook = ET.fromstring(z.read("xl/workbook.xml"))
    rels = {r.get("Id"): r.get("Target") for r in ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))}
    sheets = {}
    for sheet in workbook.find("m:sheets", NS):
        target = rels[sheet.get("{%s}id" % NS["r"])].lstrip("/")
        target = target if target.startswith("xl/") else "xl/" + target
        rows = []
        for row in ET.fromstring(z.read(target)).find("m:sheetData", NS).findall("m:row", NS):
            cells = {}
            for c in row.findall("m:c", NS):
                v, inline = c.find("m:v", NS), c.find("m:is", NS)
                if c.get("t") == "s" and v is not None:
                    text = shared[int(v.text)]
                elif inline is not None:
                    text = "".join(t.text or "" for t in inline.iter(T))
                else:
                    text = v.text if v is not None else ""
                text = clean(text)
                if text:
                    cells[col_index(c.get("r"))] = text
            if cells:
                rows.append(cells)
        sheets[sheet.get("name")] = rows
    return sheets


def find_columns(header):
    def first(*keywords):
        for index, text in sorted(header.items()):
            if any(k in text for k in keywords):
                return index
        return None

    return {
        "title": first("ชื่อรายวิชา"),
        "code": first("รหัส"),
        "detail": first("รายละเอียดวิชา"),
        "credits": first("หน่วยกิต"),
        "hours": first("ชั่วโมง"),
        "description": first("คำอธิบาย"),
    }


def split_title(text):
    match = re.fullmatch(r"(.*?)\s*\(([^()]*)\)", text)
    if not match:
        return (text, None) if THAI.search(text) else (None, text)
    main, inner = match.group(1).strip(), match.group(2).strip()
    return (main, inner) if THAI.search(main) else (inner, main)


def category(label):
    if not label:
        return "unspecified"
    if "เลือก" in label:
        return "elective"
    if "ฝึกปฏิบัติ" in label:
        return "practice"
    if any(k in label for k in ("วิจัย", "โครงงาน", "โครงการ")):
        return "research"
    if any(k in label for k in ("บังคับ", "หมวดที่ 1", "หมวดที่ 2", "หมวดที่ 3", "หมวดวิชาร่วม")):
        return "required"
    return "unspecified"


def credits_of(text):
    match = re.match(r"\s*(\d+(?:\.\d+)?)", text or "")
    return float(match.group(1)) if match else None


def parse_college_sheet(name, rows, warnings):
    college = SHEET_COLLEGE[name]
    header_at = next(i for i, r in enumerate(rows) if any("รหัส" in v for v in r.values()))
    system = "residency" if "Residency" in rows[0].get(0, "") else "credit_bank"
    cols = find_columns(rows[header_at])
    subjects, by_code, last_with_credits = [], {}, None

    def get(row, key):
        index = cols[key]
        return row.get(index) if index is not None else None

    for row in rows[header_at + 1:]:
        title, code, credits_text = get(row, "title"), get(row, "code"), get(row, "credits")
        if title and title.startswith("(") and title.endswith(")") and subjects and not code:
            th, en = split_title(subjects[-1]["titleRaw"] + " " + title)
            subjects[-1].update({"titleTh": th or subjects[-1]["titleTh"], "titleEn": en or subjects[-1]["titleEn"]})
            continue
        if not title or (not code and credits_text is None):
            continue  # แถวหมายเหตุ / คำอธิบายเกณฑ์หน่วยกิต
        if code and code in by_code:
            existing = by_code[code]
            th, en = split_title(title)
            existing["titleEn"] = existing["titleEn"] or en
            if th and existing["titleTh"] and th != existing["titleTh"]:
                warnings.append(f"{college} {code}: ชื่อไม่ตรงกันในแถวซ้ำ ({existing['titleTh']} / {th})")
            continue
        th, en = split_title(title)
        detail = get(row, "detail")
        is_option = code is not None and credits_text is None and detail is None
        subject = {
            "code": code,
            "titleTh": th,
            "titleEn": en,
            "titleRaw": title,
            "categoryLabel": None if is_option else detail,
            "category": "practice" if is_option else category(detail),
            "credits": credits_of(credits_text),
            "creditsText": credits_text,
            "hours": get(row, "hours"),
            "optionOf": (last_with_credits["code"] or last_with_credits["titleRaw"]) if is_option and last_with_credits else None,
        }
        if code is None:
            warnings.append(f"{college}: รายวิชาไม่มีรหัส '{title}'")
        subjects.append(subject)
        if code:
            by_code[code] = subject
        if subject["credits"] is not None:
            last_with_credits = subject

    titles = {}
    for s in subjects:
        key = s["titleTh"] or s["titleRaw"]
        if s["code"] and key in titles and titles[key] != s["code"] and not s["optionOf"]:
            warnings.append(f"{college}: ชื่อวิชาเดียวกันแต่รหัสต่างกัน '{key}' ({titles[key]} / {s['code']})")
        titles.setdefault(key, s["code"])
    for s in subjects:
        del s["titleRaw"]
    return college, system, subjects


def parse_programs(rows):
    programs = {}
    for row in rows[2:]:
        college = PROGRAM_COLLEGE.get(row.get(0, ""))
        if not college:
            continue
        years = credits_of(row.get(5))
        programs[college] = {
            "titleTh": row.get(1),
            "titleEn": row.get(2),
            "credentialTh": row.get(3),
            "credentialEn": row.get(4),
            "years": years,
            "minCredits": credits_of(row.get(6)),
            "trainingSystem": row.get(14),
            "councilAnnouncement": row.get(17),
        }
    return programs


def main():
    source = sys.argv[1]
    here = os.path.dirname(os.path.abspath(__file__))
    out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(here, "..", "src", "roles", "shared", "data", "curriculum", "curriculum.json")
    sheets = read_workbook(source)
    programs = parse_programs(sheets["รายละเอียด 4 ปี 7 วิทลัย"])
    warnings, result = [], []
    for sheet_name in SHEET_COLLEGE:
        college, system, subjects = parse_college_sheet(sheet_name, sheets[sheet_name], warnings)
        result.append({"collegeCode": college, "system": system, **programs[college], "subjects": subjects})
    payload = {"source": os.path.basename(source), "programs": result, "warnings": warnings}
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8", newline="\n") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
        f.write("\n")
    sys.stdout.reconfigure(encoding="utf-8")
    for p in result:
        print(f"{p['collegeCode']:<8} {p['system']:<12} {len(p['subjects']):>3} subjects")
    print(f"{len(warnings)} warnings")
    for w in warnings:
        print("  -", w)


if __name__ == "__main__":
    main()
