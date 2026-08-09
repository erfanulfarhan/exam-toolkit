#!/usr/bin/env python3
"""Parse a Pearson Edexcel IAL grade-boundaries PDF into structured JSON.

The layout has drifted over the twelve years of published documents, so the
parser is written against the invariants rather than one era's shape:

  * a section header ends in "... boundaries Max Mark <grade labels>"
  * a unit is a "Raw" line followed by a "UMS" line
  * a cash-in is a single "UMS" line carrying its own subject code

Quirks handled:
  - Grade label sets differ per session (AS sometimes lists a* it never awards),
    so labels come from the header and values are aligned to the *right*, since
    the final column is always u = 0.
  - Long unit titles wrap, putting the tail of the title in front of "UMS"
    ("Costing UMS 300 240 …") and occasionally gluing the title to "Raw"
    ("… Gene TechnologyRaw 90 67 …").
  - The June 2017 PDF has a doubled text layer, so every header comes out
    interleaved with itself ("InternationalI nAt2e runnaitti ognraadl e…") and
    rows carry a stray "WAC11Raw" prefix token.
"""
import json
import re
import sys

import pdfplumber

# "... boundaries Max Mark a* a b c d e u", tolerant of the mangled 2017 text,
# where "grade" is shredded but "boundaries Max Mark" survives intact.
HEADER = re.compile(r"boundaries\s+Max Mark\s+(.*)$", re.I)
# A stray "WAC11Raw" / "WAC11UMS" token the 2017 doubled text layer prepends.
GHOST = re.compile(r"^[A-Z0-9]{4,6}(?:Raw|UMS)\s+")
GHOST_ONLY = re.compile(r"^[A-Z0-9]{4,6}(?:Raw|UMS)$")

UNIT_RAW = re.compile(r"^([A-Z0-9]{3,4}\d{2})\s+(.*?)\s*Raw\s+([\d\s]+)$")
# Allows a wrapped title fragment before UMS, e.g. "Costing UMS 300 240 …".
UNIT_UMS = re.compile(r"^(?:(.*?)\s+)?UMS\s+([\d\s]+)$")
CASHIN = re.compile(r"^([A-Z0-9]{3,4}\d{1,2})\s+(.*?)\s+UMS\s+([\d\s]+)$")

VARIANT = re.compile(r"^Unit\s*\d+([A-Z])\s*:", re.I)

SKIP_PREFIXES = (
    "understanding", "this document", "for ", "international as",
    "international a2", "international a level", "overall", "where grade",
    "the unit", "no ", "grade boundaries", "edexcel", "definition of terms",
    "you can find", "a grade boundary", "notes", "please note", "raw mark",
    "uniform mark", "cash-in", "unit grade boundaries",
)


def nums(s):
    return [int(x) for x in re.findall(r"\d+", s)]


def align(values, labels):
    """Map boundary values onto grade labels, anchored on the right.

    The last column is always u = 0, so right-anchoring survives sessions where
    the header advertises a grade (typically a*) that the unit never awards.
    """
    if len(values) > len(labels):
        values = values[len(values) - len(labels):]
    elif len(values) < len(labels):
        labels = labels[len(labels) - len(values):]
    return {g: v for g, v in zip(labels, values)}


def section_of(header_line):
    """'AS' | 'A2' | 'cashin' from a (possibly text-mangled) section header."""
    low = header_line.lower()
    if low.startswith("cash-in") or "cash-in" in low[:20]:
        return "cashin"
    # In the doubled-layer PDFs "A2" survives as "At2"/"b2o"; "AS" never gains a 2.
    head = header_line.split("Max Mark")[0]
    if re.search(r"A.{0,2}2", head):
        return "A2"
    return "AS"


def type_from_code(code):
    """Fallback unit type when the section header is unreadable.

    IAL unit codes end in the unit number: 1-3 are AS, 4-6 are A2.
    """
    m = re.search(r"(\d)$", code)
    return "A2" if m and int(m.group(1)) >= 4 else "AS"


def parse(path):
    lines = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            # Some sessions (notably June 2017) ship two identical text layers a
            # fraction of a point apart, which interleaves into gibberish unless
            # the duplicate glyphs are dropped first.
            text = page.dedupe_chars(tolerance=1).extract_text() or ""
            for ln in text.split("\n"):
                ln = ln.strip()
                if ln and not GHOST_ONLY.match(ln):
                    lines.append(GHOST.sub("", ln))

    subjects = {}
    subject = None
    section = None
    labels = []
    pending = None

    def cur():
        return subjects.setdefault(subject, {"units": [], "cashins": []})

    for ln in lines:
        h = HEADER.search(ln)
        if h:
            section = section_of(ln)
            labels = h.group(1).split()
            pending = None
            continue

        if subject and section == "cashin":
            m = CASHIN.match(ln)
            if m:
                vals = nums(m.group(3))
                if len(vals) >= 2:
                    cur()["cashins"].append({
                        "code": m.group(1),
                        "title": m.group(2).strip(),
                        "ums_max": vals[0],
                        "ums": align(vals[1:], [g.upper() for g in labels]),
                    })
                continue

        m = UNIT_RAW.match(ln)
        if m and subject:
            vals = nums(m.group(3))
            if len(vals) >= 2:
                code, title = m.group(1), m.group(2).strip()
                v = VARIANT.match(title)
                pending = {
                    "code": code,
                    "title": title,
                    "variant": v.group(1).upper() if v else None,
                    "type": section if section in ("AS", "A2") else type_from_code(code),
                    "raw_max": vals[0],
                    "raw": align(vals[1:], [g.lower() for g in labels]),
                }
            continue

        m = UNIT_UMS.match(ln)
        if m and pending is not None:
            vals = nums(m.group(2))
            if vals:
                # A wrapped title fragment sits before "UMS", so stitch it back on.
                tail = (m.group(1) or "").strip()
                if tail and not tail.isdigit():
                    pending["title"] = f"{pending['title']} {tail}".strip()
                pending["ums_max"] = vals[0]
                pending["ums"] = align(vals[1:], [g.lower() for g in labels])
                cur()["units"].append(pending)
            pending = None
            continue

        # A digit-free line straight after a Raw line is the tail of a wrapped
        # unit title, not a new subject.
        if pending is not None and not re.search(r"\d", ln) and len(ln) < 70:
            pending["title"] = f"{pending['title']} {ln}".strip()
            continue

        # Anything else with no digits is a subject heading.
        if (not re.search(r"\d", ln) and "Max Mark" not in ln and len(ln) < 70
                and not ln.lower().startswith(SKIP_PREFIXES)):
            subject = re.sub(r":\s*(New|Old|Legacy)\s+Specification.*$", "", ln).strip()
            section = None
            pending = None

    # Drop subjects that produced nothing (stray headings picked up as names).
    return {k: v for k, v in subjects.items() if v["units"] or v["cashins"]}


if __name__ == "__main__":
    data = parse(sys.argv[1])
    units = sum(len(v["units"]) for v in data.values())
    cash = sum(len(v["cashins"]) for v in data.values())
    print(f"subjects: {len(data)} | units: {units} | cash-ins: {cash}")
    print("subjects:", ", ".join(list(data)[:40]))
    print(json.dumps(data.get("Chemistry", "NOT FOUND"), indent=1)[:1600])
