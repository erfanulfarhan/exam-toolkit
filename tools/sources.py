"""Catalogue of every Pearson Edexcel grade-boundary PDF we ingest.

Discovered by probing qualifications.pearson.com (needs a browser User-Agent,
since Pearson soft-404s to HTML otherwise) and by listing the Grade-boundaries
directory through the Wayback CDX API for files Pearson has since unpublished.

`fetch()` tries the live Pearson URL first and falls back to the Internet
Archive, so unpublished older sessions keep working.
"""
import os
import subprocess

BASE = "https://qualifications.pearson.com/content/dam/pdf/Support/Grade-boundaries"
IAL_DIR = f"{BASE}/International-A-level"
IGCSE_DIR = f"{BASE}/International-GCSE"

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")

# label -> filename, oldest first. "live" means still served by Pearson today;
# the rest resolve through the Wayback Machine.
IAL_SESSIONS = [
    ("Jan 2014", "1401-IAL-grade-boundaries-v6.pdf"),
    ("Jun 2014", "1406_IAL_Grade_Boundaries_v2.pdf"),
    ("Jan 2015", "1501-IAL-Grade-Boundaries_v2.pdf"),
    ("Jun 2015", "1506-IAL-Grade-Boundaries.pdf"),
    ("Jan 2016", "1601-IAL-Grade-Boundaries.pdf"),
    ("Jun 2016", "1606_IAL_Grade_Boundaries_Final.pdf"),
    ("Oct 2016", "1610-IAL-Grade-Boundaries.pdf"),
    ("Jan 2017", "ial-grade-bouundaries-1701.pdf"),
    ("Jun 2017", "1706-ial-grade-boundaries-v2.pdf"),
    ("Oct 2017", "1710-ial-grade-boundaries.pdf"),
    ("Jun 2018", "1806-ial-grade-boundaries1.pdf"),
    ("Oct 2018", "1810-IAL-Subject-Grade-Boundaries.pdf"),
    ("Jan 2019", "1901-ial-grade-boundaries.pdf"),
    ("Jun 2019", "1906-ial-grade-boundaries-v3.pdf"),
    ("Oct 2019", "1910-ial-grade-boundaries.pdf"),
    ("Jan 2020", "2001-ial-grade-boundaries.pdf"),
    ("Nov 2020", "grade-boundaries-november-2020-ial.pdf"),
    ("Jan 2021", "grade-boundaries-january-2021-ial.pdf"),
    ("Oct 2021", "2110_IAL_Subject_Grade_Boundaries.pdf"),
    ("Jan 2022", "2201_IAL_Subject_Grade_Boundaries_complete_v3.pdf"),
    ("Jun 2022", "2206-ial-subject-grade-boundaries.pdf"),
    ("Oct 2022", "2210-ial-subject-grade-boundaries-v1.pdf"),
    ("Jan 2023", "2301-ial-subject-grade-boundaries-v1.pdf"),
    ("Jun 2023", "2306-ial-subject-grade-boundaries.pdf"),
    ("Oct 2023", "2310-ial-subject-grade-boundaries.pdf"),
    ("Jan 2024", "2401-ial-subject-grade-boundaries.pdf"),
    ("Jun 2024", "grade-boundaries-june-2024-international-advanced-level.pdf"),
    ("Oct 2024", "2410-ial-subject-grade-boundaries.pdf"),
    ("Jan 2025", "2501-ial-subject-grade-boundaries.pdf"),
    ("Jun 2025", "grade-boundaries-june-2025-international-advanced-level.pdf"),
    ("Oct 2025", "2510-ial-subject-grade-boundaries.pdf"),
    ("Jan 2026", "2601-ial-subject-grade-boundaries.pdf"),
]

# International GCSE (9-1). Legacy A*-G sessions (pre-2018) use an incompatible
# layout and grade set, so they are deliberately out of scope.
IGCSE_SESSIONS = [
    ("Jun 2018", "1806-ig-9-1-subject-grade-boundaries.pdf"),
    ("Jan 2019", "1901-ig-9-1-subject-grade-boundaries.pdf"),
    ("Jun 2019", "1906-ig-9-1-subject-grade-boundaries.pdf"),
    ("Nov 2020", "grade-boundaries-november-2020-international-gcse-9-1.pdf"),
    ("Jan 2021", "grade-boundaries-january-2021-int-gcse-9-1.pdf"),
    ("Nov 2021", "2111_intGCSE_(9-1)_Subject_Grade_Boundaries_V2.pdf"),
    ("Jan 2022", "2201_intGCSE_(9-1)_Subject_Grade_Boundaries_V1.pdf"),
    ("Jun 2022", "2206-intgcse-9-1-subject-grade-boundaries.pdf"),
    ("Jan 2023", "2301-intgcse-9-1-subject-grade-boundaries-v1.pdf"),
    ("Jun 2023", "2306-intgcse-9-1-subject-grade-boundaries.pdf"),
    ("Nov 2023", "2311-intgcse-9-1-subject-grade-boundaries.pdf"),
    ("Jun 2024", "grade-boundaries-june-2024-int-gcse.pdf"),
    ("Nov 2024", "grade-boundaries-november-2024-int-gcse.pdf"),
    ("Jun 2025", "grade-boundaries-june-2025-int-gcse.pdf"),
    ("Nov 2025", "2511-international-gcse-subject-grade-boundaries.pdf"),
]

CACHE = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", ".cache"))


def _curl(url, dst):
    """Download with a browser UA. Returns True only for a real PDF.

    Python's ssl module is broken in this environment, hence curl.
    """
    r = subprocess.run(
        ["curl", "-sL", "-A", UA, "--max-time", "120", "-o", dst, "-w", "%{content_type}", url],
        capture_output=True, text=True)
    if "pdf" not in (r.stdout or "").lower():
        if os.path.exists(dst):
            os.remove(dst)
        return False
    return os.path.getsize(dst) > 4096


def fetch(directory, filename):
    """Return a local path to the PDF, downloading it if needed."""
    os.makedirs(CACHE, exist_ok=True)
    dst = os.path.join(CACHE, filename)
    if os.path.exists(dst) and os.path.getsize(dst) > 4096:
        return dst
    live = f"{directory}/{filename}"
    if _curl(live, dst):
        return dst
    # `2id_` asks the Wayback Machine for the unmodified original bytes.
    if _curl(f"https://web.archive.org/web/2id_/{live}", dst):
        return dst
    return None


def ial_pdfs():
    for label, fn in IAL_SESSIONS:
        yield label, fetch(IAL_DIR, fn), fn


def igcse_pdfs():
    for label, fn in IGCSE_SESSIONS:
        yield label, fetch(IGCSE_DIR, fn), fn
