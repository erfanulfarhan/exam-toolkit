#!/usr/bin/env python3
"""Parse a Pearson Edexcel International GCSE (9-1) grade-boundaries PDF -> JSON.

IGCSE (9-1) is linear and raw-only. Layout:

    Chemistry Max Mark a* a b c d e f g u
    Overall grade boundaries Max Mark 9 8 7 6 5 4 3 2 1 U
    4CH1 Chemistry Subject 180 151 134 117 104 91 79 62 45 29 0
    Paper(s) 1C 2C
    4CH1 Chemistry Subject 180 154 136 119 106 93 81 64 47 31 0   <- a variant (R papers)
    Paper(s) 1CR 2CR
"""
import json, re, sys
import pdfplumber

GRADES = ["9", "8", "7", "6", "5", "4", "3", "2", "1", "U"]
HEADER = re.compile(r"^(.+?)\s+Max Mark\s+a\*", re.I)
ROW = re.compile(r"^([0-9][A-Z]{2}[0-9])\s+(.*?)\s+Subject\s+([\d\s]+)$")
PAPERS = re.compile(r"^Paper\(s\)\s+(.*)$")

def nums(s): return [int(x) for x in re.findall(r"\d+", s)]

def parse(path):
    lines = []
    with pdfplumber.open(path) as pdf:
        for pg in pdf.pages:
            for ln in (pg.extract_text() or "").split("\n"):
                ln = ln.strip()
                if ln: lines.append(ln)
    subjects = {}
    subject = None
    last = None
    for ln in lines:
        h = HEADER.match(ln)
        if h and "grade boundaries" not in h.group(1).lower():
            subject = h.group(1).strip()
            subjects.setdefault(subject, {"variants": []})
            last = None
            continue
        m = ROW.match(ln)
        if m and subject:
            code, title, ns = m.group(1), m.group(2).strip(), nums(m.group(3))
            if len(ns) >= 11:
                mx, b = ns[0], ns[1:11]
                last = {"code": code, "title": title, "max": mx,
                        "boundaries": {g: b[i] for i, g in enumerate(GRADES)}, "papers": None}
                subjects[subject]["variants"].append(last)
            continue
        p = PAPERS.match(ln)
        if p and last is not None:
            last["papers"] = p.group(1).strip()
            last = None
    return subjects

if __name__ == "__main__":
    d = parse(sys.argv[1])
    v = sum(len(x["variants"]) for x in d.values())
    print(f"subjects: {len(d)} | variants: {v}")
    print("names:", ", ".join(list(d)[:30]))
    print(json.dumps(d.get("Chemistry", "NA"), indent=1)[:700])
