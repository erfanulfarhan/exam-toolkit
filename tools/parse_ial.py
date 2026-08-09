#!/usr/bin/env python3
"""Parse a Pearson Edexcel IAL grade-boundaries PDF into structured JSON.

Layout (from pdfplumber text): a subject name on its own line, section headers
that set the unit type, then per unit a 'Raw' line and a 'UMS' line:

    Accounting
    International AS unit grade boundaries Max Mark a b c d e u
    WAC11 Unit 1: The Accounting System and Costing Raw 200 137 115 94 73 52 0
    UMS 300 240 210 180 150 120 0
    ...
    Cash-in grade boundaries Max Mark A B C D E U
    YAC11 International A Level Accounting UMS 600 480 420 360 300 240 0
"""
import json, re, sys
import pdfplumber

def nums(s):
    return [int(x) for x in re.findall(r"\d+", s)]

def parse(path):
    lines = []
    with pdfplumber.open(path) as pdf:
        for pg in pdf.pages:
            for ln in (pg.extract_text() or "").split("\n"):
                ln = ln.strip()
                if ln:
                    lines.append(ln)

    subjects = {}
    subject = None
    section = None           # 'AS' | 'A2' | 'cashin'
    grades_for = {"AS": ["a", "b", "c", "d", "e", "u"],
                  "A2": ["a*", "a", "b", "c", "d", "e", "u"],
                  "cashin": ["A", "B", "C", "D", "E", "U"]}
    pending = None           # a unit awaiting its UMS line

    HEADER = re.compile(r"grade boundaries\s+Max Mark", re.I)
    UNIT_RAW = re.compile(r"^([A-Z]{3}\d{2})\s+(.*?)\s+Raw\s+([\d\s]+)$")
    UNIT_UMS = re.compile(r"^UMS\s+([\d\s]+)$")
    CASHIN = re.compile(r"^([A-Z]{3}\d{2})\s+(.*?)\s+UMS\s+([\d\s]+)$")

    def cur():
        return subjects.setdefault(subject, {"units": [], "cashins": []})

    for ln in lines:
        if HEADER.search(ln):
            low = ln.lower()
            section = "cashin" if low.startswith("cash-in") else ("A2" if "a2" in low else "AS")
            pending = None
            continue
        m = UNIT_RAW.match(ln)
        if m and subject:
            code, title, raw = m.group(1), m.group(2).strip(), nums(m.group(3))
            g = grades_for.get(section, grades_for["AS"])
            # raw = [max, <boundaries in g order>]; last is u=0
            if len(raw) >= 2:
                mx, bnd = raw[0], raw[1:]
                rawmap = {gr: bnd[i] for i, gr in enumerate(g) if i < len(bnd)}
                pending = {"code": code, "title": title, "type": section,
                           "raw_max": mx, "raw": rawmap}
            continue
        m = UNIT_UMS.match(ln)
        if m and pending is not None:
            u = nums(m.group(1))
            g = grades_for.get(pending["type"], grades_for["AS"])
            if u:
                pending["ums_max"] = u[0]
                pending["ums"] = {gr: u[1:][i] for i, gr in enumerate(g) if i < len(u) - 1}
            cur()["units"].append(pending)
            pending = None
            continue
        m = CASHIN.match(ln)
        if m and subject and section == "cashin":
            code, title, u = m.group(1), m.group(2).strip(), nums(m.group(3))
            if u:
                cur()["cashins"].append({
                    "code": code, "title": title, "ums_max": u[0],
                    "ums": {gr: u[1:][i] for i, gr in enumerate(grades_for["cashin"]) if i < len(u) - 1}})
            continue
        # otherwise: a subject name (no digits, not a structural line)
        if not re.search(r"\d", ln) and "Max Mark" not in ln and len(ln) < 60 \
           and not ln.lower().startswith(("understanding", "this document", "for ", "international as units",
                                          "international a2", "overall", "where grade", "the unit", "no ",
                                          "grade boundaries", "edexcel")):
            subject = ln.strip()
            section = None
            pending = None

    return subjects

if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else "ial_2601.pdf"
    data = parse(path)
    total_units = sum(len(v["units"]) for v in data.values())
    total_cash = sum(len(v["cashins"]) for v in data.values())
    print(f"subjects: {len(data)} | units: {total_units} | cash-ins: {total_cash}")
    print("subject names:", ", ".join(list(data)[:40]))
    print("\n=== sample: Chemistry ===")
    print(json.dumps(data.get("Chemistry", "NOT FOUND"), indent=1)[:1600])
