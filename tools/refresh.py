#!/usr/bin/env python3
"""Pull in any exam session Pearson has published since the last build.

Run on its own, or as part of `npm run build`, where it is best effort: if
Pearson is unreachable, or pdfplumber is not installed, or a PDF does not parse,
it leaves the committed dataset exactly as it was and exits 0. A deploy must
never ship empty boundaries.

    python3 tools/refresh.py            # merge anything new into data/
    python3 tools/refresh.py --check    # report only, change nothing
"""
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DATA = os.path.join(ROOT, 'data')
sys.path.insert(0, HERE)

MONTHS = {'Jan': 1, 'Jun': 6, 'Oct': 10, 'Nov': 11}
MONTH_NAMES = {1: 'january', 6: 'june', 10: 'october', 11: 'november'}

# How Pearson has named these files recently. Newest convention first.
IAL_PATTERNS = [
    '{yy}{mm:02d}-ial-subject-grade-boundaries.pdf',
    '{yy}{mm:02d}-ial-subject-grade-boundaries-v1.pdf',
    'grade-boundaries-{month}-{year}-international-advanced-level.pdf',
]
IGCSE_PATTERNS = [
    '{yy}{mm:02d}-international-gcse-subject-grade-boundaries.pdf',
    '{yy}{mm:02d}-intgcse-9-1-subject-grade-boundaries.pdf',
    '{yy}{mm:02d}-intgcse-9-1-subject-grade-boundaries-v1.pdf',
    'grade-boundaries-{month}-{year}-int-gcse.pdf',
]


def order(label):
    month, year = label.split()
    return int(year) * 100 + MONTHS.get(month, 0)


def upcoming(known, count=3):
    """The next few sessions after the newest one we already hold."""
    latest = max(known, key=order)
    month, year = latest.split()
    cycle = sorted({s.split()[0] for s in sorted(known, key=order)[-6:]},
                   key=lambda m: MONTHS[m])
    out = []
    m, y = MONTHS[month], int(year)
    for _ in range(count):
        later = [x for x in cycle if MONTHS[x] > m]
        if later:
            m = MONTHS[later[0]]
        else:
            m, y = MONTHS[cycle[0]], y + 1
        out.append((f'{[k for k, v in MONTHS.items() if v == m][0]} {y}', m, y))
    return out


def candidates(patterns, month, year):
    return [p.format(yy=str(year)[2:], mm=month, month=MONTH_NAMES[month], year=year)
            for p in patterns]


def main():
    check_only = '--check' in sys.argv
    try:
        import sources
    except Exception as exc:  # pragma: no cover
        print(f'refresh: skipped ({exc})')
        return 0

    found = []
    for name, patterns, directory in (
        ('ial', IAL_PATTERNS, sources.IAL_DIR),
        ('igcse', IGCSE_PATTERNS, sources.IGCSE_DIR),
    ):
        path = os.path.join(DATA, f'{name}.json')
        blob = json.load(open(path))
        known = set(blob['sessions'])

        for label, month, year in upcoming(known):
            if label in known:
                continue
            for filename in candidates(patterns, month, year):
                url = f'{directory}/{filename}'
                probe = subprocess.run(
                    ['curl', '-sI', '-A', sources.UA, '--max-time', '20', url],
                    capture_output=True, text=True)
                if 'application/pdf' not in probe.stdout.lower():
                    continue
                print(f'refresh: {name} {label} is published ({filename})')
                found.append((name, label, filename))
                if check_only:
                    break
                if not merge(name, label, filename, directory, blob, path):
                    print(f'refresh: {name} {label} did not parse, leaving data untouched')
                break

    if not found:
        print('refresh: nothing new on qualifications.pearson.com')
    return 0


def merge(name, label, filename, directory, blob, path):
    try:
        import sources
        from parse_ial import parse as parse_ial
        from parse_igcse import parse as parse_igcse
        from build import tidy, fix_title
    except Exception as exc:
        print(f'refresh: parser unavailable ({exc})')
        return False

    local = sources.fetch(directory, filename)
    if not local:
        return False
    try:
        if name == 'ial':
            parsed = {}
            for subject, payload in parse_ial(local).items():
                for unit in payload['units']:
                    unit['title'] = fix_title(unit['title'])
                parsed[tidy(subject)] = payload
        else:
            parsed = {tidy(s): v for s, v in parse_igcse(local).items()}
    except Exception as exc:
        print(f'refresh: parse failed ({exc})')
        return False

    if not parsed:
        return False

    blob['sessions'][label] = parsed
    with open(path, 'w') as f:
        json.dump(blob, f, separators=(',', ':'))
    subjects = len(parsed)
    print(f'refresh: added {label} to {name}.json ({subjects} subjects)')
    return True


if __name__ == '__main__':
    sys.exit(main())
