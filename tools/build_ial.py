import json, os, sys, urllib.request
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))
from parse_ial import parse
BASE = "https://qualifications.pearson.com/content/dam/pdf/Support/Grade-boundaries/International-A-level/"
SESSIONS = {
  "Jun 2023": "2306-ial-subject-grade-boundaries.pdf",
  "Jan 2024": "2401-ial-subject-grade-boundaries.pdf",
  "Jun 2024": "grade-boundaries-june-2024-international-advanced-level.pdf",
  "Oct 2024": "2410-ial-subject-grade-boundaries.pdf",
  "Jan 2025": "2501-ial-subject-grade-boundaries.pdf",
  "Jun 2025": "grade-boundaries-june-2025-international-advanced-level.pdf",
  "Jan 2026": "2601-ial-subject-grade-boundaries.pdf",
}
CACHE = os.path.join(os.path.dirname(__file__), "..", ".cache")
out = {}
for label, fn in SESSIONS.items():
    dst = os.path.join(CACHE, fn)
    if not os.path.exists(dst):
        try:
            urllib.request.urlretrieve(BASE + fn, dst)
        except Exception as e:
            print(f"  ! {label}: download failed ({e})"); continue
    try:
        subs = parse(dst)
        out[label] = subs
        u = sum(len(v['units']) for v in subs.values()); c = sum(len(v['cashins']) for v in subs.values())
        print(f"  {label}: {len(subs)} subjects, {u} units, {c} cash-ins")
    except Exception as e:
        print(f"  ! {label}: parse failed ({e})")
os.makedirs(os.path.join(os.path.dirname(__file__), "..", "public", "data"), exist_ok=True)
with open(os.path.join(os.path.dirname(__file__), "..", "public", "data", "ial.json"), "w") as f:
    json.dump({"qualification": "IAL", "sessions": out}, f)
print("sessions parsed:", len(out), "| wrote public/data/ial.json",
      f"({os.path.getsize(os.path.join(os.path.dirname(__file__),'..','public','data','ial.json'))//1024} KB)")
