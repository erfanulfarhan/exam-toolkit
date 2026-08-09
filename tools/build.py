#!/usr/bin/env python3
"""Build public/data/{ial,igcse}.json from every published grade-boundary PDF.

Run:  python3 tools/build.py
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import sources  # noqa: E402
from parse_ial import parse as parse_ial  # noqa: E402
from parse_igcse import parse as parse_igcse  # noqa: E402

OUT = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "public", "data"))

# A subject heading rendered from two overlapping text layers, e.g.
# "Business StuBdiuessiness Studies", where a lowercase letter butts into a capital.
MANGLED = re.compile(r"[a-z][A-Z]")


def tidy(name):
    name = re.sub(r"\s+", " ", name).strip()
    # "Accounting: New Specification", and its garbled twin from the overlapping
    # text layers, "Applied ICT: ANpepwl ieSdp eICciTfic: aNtieown Specification".
    name = re.sub(r":\s*\S.*\bSpecification\s*$", "", name, flags=re.I)
    name = re.sub(r"\s*\(Continued\)\s*$", "", name, flags=re.I)
    name = name.replace(" & ", " and ")
    # "Chemistry Chemistry" -> "Chemistry"
    half = len(name) // 2
    if len(name) % 2 == 1 and name[:half] == name[half + 1:]:
        name = name[:half]
    return name.strip()


def is_subsequence(needle, haystack):
    it = iter(haystack)
    return all(ch in it for ch in needle)


def unmangle(name, canonical):
    """Recover a readable subject name from an overlapping-text-layer heading.

    The true name survives as a subsequence of the garbled string, so the
    longest known subject name that still fits is the right answer.
    """
    if not MANGLED.search(name):
        return name
    for cand in canonical:
        if is_subsequence(cand.lower(), name.lower()):
            return cand
    return name


def merge_subject(dst, src):
    """Fold a duplicate subject heading's rows into the one already collected."""
    seen_units = {(u["code"], u.get("variant")) for u in dst["units"]}
    for u in src["units"]:
        if (u["code"], u.get("variant")) not in seen_units:
            dst["units"].append(u)
            seen_units.add((u["code"], u.get("variant")))
    seen_cash = {c["code"] for c in dst["cashins"]}
    for c in src["cashins"]:
        if c["code"] not in seen_cash:
            dst["cashins"].append(c)
            seen_cash.add(c["code"])


def build_ial():
    raw = {}
    for label, path, filename in sources.ial_pdfs():
        if not path:
            print(f"  ! IAL {label}: could not download {filename}")
            continue
        raw[label] = {tidy(k): v for k, v in parse_ial(path).items()}

    canonical = sorted(
        {n for sess in raw.values() for n in sess if not MANGLED.search(n)},
        key=len, reverse=True)

    out = {}
    for label, subjects in raw.items():
        clean = {}
        for name, payload in subjects.items():
            name = unmangle(name, canonical)
            if name in clean:
                merge_subject(clean[name], payload)
            else:
                clean[name] = payload
        for payload in clean.values():
            payload["units"].sort(key=lambda u: (u["code"], u.get("variant") or ""))
        out[label] = clean
        units = sum(len(v["units"]) for v in clean.values())
        cash = sum(len(v["cashins"]) for v in clean.values())
        print(f"  IAL   {label:9s} {len(clean):3d} subjects  {units:4d} units  {cash:3d} cash-ins")
    return {"qualification": "IAL", "sessions": out}


def build_igcse():
    out = {}
    for label, path, filename in sources.igcse_pdfs():
        if not path:
            print(f"  ! IGCSE {label}: could not download {filename}")
            continue
        subjects = {}
        for name, payload in parse_igcse(path).items():
            name = tidy(name)
            if name in subjects:
                subjects[name]["variants"].extend(payload["variants"])
            else:
                subjects[name] = payload
        out[label] = subjects
        variants = sum(len(v["variants"]) for v in subjects.values())
        print(f"  IGCSE {label:9s} {len(subjects):3d} subjects  {variants:4d} paper combinations")
    return {"qualification": "IGCSE", "sessions": out}


def write(name, data):
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, name)
    with open(path, "w") as f:
        json.dump(data, f, separators=(",", ":"))
    print(f"wrote {path} ({os.path.getsize(path) // 1024} KB, {len(data['sessions'])} sessions)")


if __name__ == "__main__":
    write("ial.json", build_ial())
    write("igcse.json", build_igcse())
