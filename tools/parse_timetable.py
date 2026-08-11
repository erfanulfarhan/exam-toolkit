#!/usr/bin/env python3
"""Extract exam dates and times from Pearson's published examination timetables.

Only the scheduling facts are taken out: unit code, paper, date, session and
duration. Rows look like this in the PDF's text layer:

    Tuesday 05 May  WCH11 01  Chemistry  Unit 1: Structure, ...  Afternoon  1h 30m

Subject and title sit in separate columns that collapse into one string when the
text is extracted, so the subject is recovered by matching the longest known
subject name from data/ial.json against the front of that string.

Run: python3 tools/parse_timetable.py
"""
import json
import os
import re
import sys

import pdfplumber

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)

import sources  # noqa: E402

BASE = 'https://qualifications.pearson.com/content/dam/pdf/Support'
IAL_DIR = f'{BASE}/Examination-timetables-for-International-Advanced-Levels'
IGCSE_DIR = f'{BASE}/Examination-timetables-for-Edexcel-International-GCSE'

# label -> (directory, filename, calendar year the sitting falls in)
SERIES = {
    'Jun 2026': (IAL_DIR, 'ial-summer-2026-final.pdf', 2026, 'IAL'),
    'Oct 2026': (IAL_DIR, 'ial-october2026-final.pdf', 2026, 'IAL'),
    'Jan 2027': (IAL_DIR, 'ial-january-2027-final.pdf', 2027, 'IAL'),
    'Jun 2027': (IAL_DIR, 'ial-summer-2027-final.pdf', 2027, 'IAL'),
    'Jun 2026 IGCSE': (IGCSE_DIR, 'int-gcse-summer-2026-final.pdf', 2026, 'IGCSE'),
    'Nov 2026 IGCSE': (IGCSE_DIR, 'intgcse-nov-2026-final.pdf', 2026, 'IGCSE'),
    'Jun 2027 IGCSE': (IGCSE_DIR, 'int-gcse-summer-2027-final.pdf', 2027, 'IGCSE'),
}

MONTHS = {m: i for i, m in enumerate(
    ['January', 'February', 'March', 'April', 'May', 'June',
     'July', 'August', 'September', 'October', 'November', 'December'], 1)}

ROW = re.compile(
    r'^(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+'
    r'(\d{1,2})\s+([A-Z][a-z]+)\s+'          # 05 May
    r'([0-9A-Z]{4,6})\s+(\d{2})\s+'          # WCH11 01
    r'(.+?)\s+'                              # subject + title
    r'(Morning|Afternoon)\s+'
    r'(\d+)h\s*(\d+)m\s*$')


def known_subjects():
    """Subject names from the boundary dataset, longest first for prefix matching."""
    names = set()
    for path in ('ial.json', 'igcse.json'):
        full = os.path.join(ROOT, 'data', path)
        if not os.path.exists(full):
            continue
        blob = json.load(open(full))
        for session in blob['sessions'].values():
            names.update(session.keys())
    return sorted(names, key=len, reverse=True)


def split_subject(text, subjects):
    for name in subjects:
        if text.startswith(name):
            return name, text[len(name):].strip()
    # Fall back to the first word or two, so a row is never dropped outright.
    parts = text.split()
    return parts[0] if parts else text, ' '.join(parts[1:])


def parse(path, year, subjects):
    exams = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            for line in (page.extract_text() or '').split('\n'):
                m = ROW.match(line.strip())
                if not m:
                    continue
                day, month, code, paper, middle, session, hours, mins = m.groups()
                if month not in MONTHS:
                    continue
                subject, title = split_subject(middle.strip(), subjects)
                exams.append({
                    'code': code,
                    'paper': paper,
                    'subject': subject,
                    'title': title,
                    'date': f'{year}-{MONTHS[month]:02d}-{int(day):02d}',
                    'session': session,
                    'minutes': int(hours) * 60 + int(mins),
                })
    # One row per code and paper; the timetable repeats some in week views.
    seen, unique = set(), []
    for e in exams:
        key = (e['code'], e['paper'], e['date'], e['session'])
        if key in seen:
            continue
        seen.add(key)
        unique.append(e)
    return sorted(unique, key=lambda e: (e['date'], e['session'], e['code']))


def main():
    subjects = known_subjects()
    out = {}
    for label, (directory, filename, year, qual) in SERIES.items():
        path = sources.fetch(directory, filename)
        if not path:
            print(f'  ! {label}: could not download {filename}')
            continue
        exams = parse(path, year, subjects)
        if not exams:
            print(f'  ! {label}: no rows matched')
            continue
        out[label] = {'qualification': qual, 'exams': exams}
        span = f"{exams[0]['date']} to {exams[-1]['date']}"
        print(f'  {label:16s} {len(exams):4d} papers  {span}')

    dest = os.path.join(ROOT, 'data', 'timetables.json')
    with open(dest, 'w') as f:
        json.dump(out, f, separators=(',', ':'))
    print(f'wrote {dest} ({os.path.getsize(dest) // 1024} KB, {len(out)} series)')


if __name__ == '__main__':
    main()
