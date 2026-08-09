# Edexcel Grade Calculator

A calculator for Pearson Edexcel **International A Level** and **International GCSE (9-1)**:

- **UMS to grade, and back to the raw mark.** Enter the UMS from your results slip and see your grade
  plus the raw mark behind it, for any published session. A toggle switches to raw mark entry.
- **The A\* rule**, which is not a published boundary: an A overall *plus* 90% of the UMS available
  at A2 (270/300 on a six-unit A Level, 180/200 on a four-unit one), with Mathematics' P3 + P4
  substitution handled separately.
- **A next session boundary forecast** with the full history charted behind it.
- **A retake planner.** Enter the marks you already hold, pick a target grade, and it works out
  which papers to re-sit and the lowest raw mark you need in each, leaning on the units you find
  easiest and escalating to the harder ones only when the easy ones cannot cover the gap.

Unofficial. Check anything that matters against your statement of results.

## Architecture

The boundary dataset and every calculation live on the server. `data/*.json` is bundled into the
serverless functions in `api/`, so it is never a URL a visitor can fetch, and the browser bundle
contains no boundaries, no award rules, no planner and no forecast model. The client posts what the
student typed and renders what comes back.

```
data/          parsed boundaries, server only, never served as a static file
server/lib/    engine, planner, forecast model, and the view builders the API returns
api-src/       handler sources
api/           generated: each handler bundled into one self-contained file
src/           the browser app, UI only
tools/         the PDF ingestion pipeline
```

`api/` is generated because Vercel's Node runtime only transpiles handlers, leaving relative
imports extensionless, which Node's ESM loader rejects in a `"type": "module"` package. Bundling
first removes relative imports entirely.

## Data

Generated from Pearson's own grade-boundary PDFs.

```bash
python3 -m pip install pdfplumber
python3 tools/build.py        # downloads (cached in .cache/) and rebuilds both JSON files
```

- `tools/sources.py`: the catalogue of every published PDF. Pearson soft-404s to HTML without a
  browser User-Agent, and has unpublished older sessions, so downloads fall back to the Wayback
  Machine.
- `tools/parse_ial.py`: IAL units and cash-ins. Grade labels come from each section header and
  values are right-aligned, because the published grade sets differ session to session; also copes
  with wrapped unit titles and the June 2017 PDF's doubled text layer.
- `tools/parse_igcse.py`: International GCSE (9-1), including Foundation/Higher tiers and Science
  (Double Award)'s paired grades. Legacy A\* to G International GCSE (pre-2018) is out of scope.

## Develop

```bash
npm install
npm run dev          # UI only; the API needs `vercel dev`
npm run build        # bundles the api functions, then the client
python3 scripts/make_og.py   # regenerate the social card
```
