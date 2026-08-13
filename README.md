# Exam Toolkit

Free revision tools for Edexcel International A Level and International GCSE
students. No account, no ads, nothing to install.

**Live:** https://edexcel-grade-calc.vercel.app

## What it does

**Grade calculator.** Put in your UMS and see the grade it earns against the
real published boundaries, the raw mark behind it, and which units are the
cheapest to re-sit. Every session from January 2014 onwards.

**Past paper practice.** Open a question paper beside its mark scheme. The
scheme stays locked question by question until you have attempted the question,
so revision is practice rather than reading the answers. Includes a mock exam
timer and a self-marking tool that converts your raw total to a grade using the
boundaries for that exact session.

**Practice log.** Records the papers you have marked, how your scores are
moving, and the units worth another go.

**Exam timetable.** Tick your subjects and get only your papers, in order, with
dates, durations, a countdown and any clashes flagged.

**Study routine builder.** Give it your subjects and the hours you actually
have, and it builds a day by day plan weighted towards the units you rate
hardest, saving the last stretch for revision and timed papers.

## How the grade conversion works

Pearson publishes, for every session, the raw mark and the UMS for each grade of
each unit. Those pairs are the anchors. Any mark in between is piecewise linear
interpolation between the two surrounding boundaries, with (0, 0) and
(max raw, max UMS) closing the ends, which is how the UMS scale is defined.

`tools/refresh.py` fetches and parses each new boundary PDF. A scheduled action
runs it several times a day, so a session published on results morning appears
on the site without anyone touching it.

## Built with

Vite, React, TypeScript and Tailwind on the front end. Vercel serverless
functions for the boundary engine. pdf.js renders papers entirely in the
browser.

```bash
npm install
npm run dev      # local dev server
npm run build    # refresh boundaries, bundle the API, build the site
```

## Unofficial

Not affiliated with or endorsed by Pearson Edexcel or Cambridge Assessment.
Grade boundary data is Pearson's, read from their published documents. Check
anything that matters against your statement of results.

Copyright (c) 2026. All rights reserved. See [LICENSE](LICENSE).
