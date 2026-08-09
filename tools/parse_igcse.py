#!/usr/bin/env python3
"""Parse a Pearson Edexcel International GCSE (9-1) grade-boundaries PDF -> JSON.

International GCSE (9-1) is linear and raw-only. Two layouts exist:

    # 2018 - Jun 2025
    Chemistry Max Mark a* a b c d e f g u
    Overall grade boundaries Max Mark 9 8 7 6 5 4 3 2 1 U
    4CH1 Chemistry Subject 180 151 134 117 104 91 79 62 45 29 0
    Paper(s) 1C 2C

    # Nov 2025 onwards, where the subject sits on a bare line
    Chemistry
    Overall grade boundaries Max Mark 9 8 7 6 5 4 3 2 1 U
    4CH1 Chemistry Subject 180 136 114 92 79 67 55 43 32 21 0
    Paper(s) 1C 2C

Both are anchored the same way: the subject is whatever line precedes the
"Overall grade boundaries" header.

Two shapes need special handling:
  - Tiered papers publish fewer columns than the header lists. Higher runs 9-3
    and Foundation runs 5-1, so the tiers align to opposite ends of the scale.
  - Science (Double Award) awards paired grades (9-9, 9-8, 8-8 …), printed as
    "99 98 88", and its eighteen columns wrap onto a continuation row.
"""
import json
import re
import sys

import pdfplumber

FULL = ["9", "8", "7", "6", "5", "4", "3", "2", "1", "U"]
FOUNDATION = ["5", "4", "3", "2", "1", "U"]

OVERALL = re.compile(r"^Overall grade boundaries\s+Max Mark\s+(.*)$", re.I)
ROW = re.compile(r"^([0-9][A-Z]{2}[0-9])\s+(.*?)\s+Subject\s+([\d\s]+)$")
CONTINUATION = re.compile(r"^Subject\s+([\d\s]+)$")
CONTINUATION_LABELS = re.compile(r"^(?:\d{1,2}\s+)+U$")
PAPERS = re.compile(r"^Papers?(?:\(s\))?\s+(.*)$", re.I)


def nums(s):
    return [int(x) for x in re.findall(r"\d+", s)]


def labels_from(tokens):
    """Normalise header columns; "99" is the Double Award pair 9-9."""
    out = []
    for t in tokens:
        if t.upper() == "U":
            out.append("U")
        elif len(t) == 2 and t.isdigit():
            out.append(f"{t[0]}-{t[1]}")
        elif t.isdigit():
            out.append(t)
    return out


def parse(path):
    lines = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            for ln in (page.dedupe_chars(tolerance=1).extract_text() or "").split("\n"):
                ln = ln.strip()
                if ln:
                    lines.append(ln)

    subjects = {}
    subject = None
    labels = list(FULL)
    current = None      # variant awaiting its Paper(s) / continuation row
    filled = 0          # how many of `labels` the current variant has consumed

    for i, ln in enumerate(lines):
        head = OVERALL.match(ln)
        if head:
            labels = labels_from(head.group(1).split()) or list(FULL)
            # The preceding line names the subject, with or without a trailing
            # "Max Mark a* a b …" legend from the older layout.
            name = re.split(r"\s+Max Mark\b", lines[i - 1] if i else "")[0].strip()
            if name and not re.search(r"\d", name) and len(name) < 60:
                subject = name
                subjects.setdefault(subject, {"variants": []})
            current, filled = None, 0
            continue

        if CONTINUATION_LABELS.match(ln):
            # Double Award's eighteen columns wrap; this is the second heading row.
            labels.extend(labels_from(ln.split()))
            continue

        m = ROW.match(ln)
        if m and subject:
            title, values = m.group(2).strip(), nums(m.group(3))
            if len(values) >= 4:
                body = values[1:]
                # Foundation tops out at grade 5, so it aligns to the bottom of
                # the scale; every other tier starts at the top and stops early.
                scale = FOUNDATION if re.search(r"foundation", title, re.I) else labels
                grades = scale[-len(body):] if scale is FOUNDATION else scale[:len(body)]
                current = {
                    "code": m.group(1),
                    "title": title,
                    "max": values[0],
                    "grades": list(grades),
                    "boundaries": dict(zip(grades, body)),
                    "papers": None,
                }
                filled = len(body)
                subjects[subject]["variants"].append(current)
            continue

        m = CONTINUATION.match(ln)
        if m and current is not None:
            body = nums(m.group(1))
            grades = labels[filled:filled + len(body)]
            current["grades"].extend(grades)
            current["boundaries"].update(zip(grades, body))
            filled += len(body)
            continue

        p = PAPERS.match(ln)
        if p and current is not None and current["papers"] is None:
            current["papers"] = re.sub(r"\s*&\s*", " ", p.group(1).strip()).rstrip(",")

    return {k: v for k, v in subjects.items() if v["variants"]}


if __name__ == "__main__":
    data = parse(sys.argv[1])
    print(f"subjects: {len(data)} | variants: {sum(len(v['variants']) for v in data.values())}")
    print("subjects:", ", ".join(list(data)[:40]))
    print(json.dumps(data.get("Science (Double Award)", "NOT FOUND"), indent=1)[:900])
