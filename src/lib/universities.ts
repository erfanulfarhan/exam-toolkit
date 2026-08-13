/**
 * Which universities your grades open, and which they do not.
 *
 * A pass here means you clear a published minimum. It is not an offer. Almost
 * every university in Bangladesh runs an admission test as well, public
 * universities generally want a UGC equivalence certificate first, and popular
 * departments fill up well above their stated minimum.
 *
 * Rules are expressed as small independent checks so a refusal can say exactly
 * what was short, rather than a bare "not eligible".
 */
import { Entry, asLetter, best } from './gpa'

export type Category =
  | 'Engineering' | 'Science' | 'Business' | 'Arts' | 'Law'
  | 'Pharmacy' | 'Architecture' | 'Social Science' | 'Medical' | 'General'

export type Rule =
  /** A named subject (or any one of several) at a level, at or above a grade. */
  | { kind: 'subject'; anyOf: string[]; level: 'o' | 'a'; minGrade: string }
  /** At least N counted subjects across both levels at or above a grade. */
  | { kind: 'countAtGrade'; count: number; minGrade: string }
  /** No counted subject may fall below a grade. */
  | { kind: 'floor'; minGrade: string }
  /** At least N A Level subjects sat. */
  | { kind: 'aLevelCount'; count: number }
  /** Average of the counted subjects at a level. */
  | { kind: 'average'; level: 'o' | 'a'; min: number }

export type Department = {
  name: string
  category: Category
  rules: Rule[]
  notes?: string
}

export type University = {
  id: string
  name: string
  short: string
  type: 'public' | 'private'
  source?: string
  admissionTest: boolean
  equivalenceRequired: boolean
  /** Applied to every department on top of its own rules. */
  general: Rule[]
  note?: string
  departments: Department[]
}

const ORDER = ['A*', 'A', 'B', 'C', 'D', 'E', 'U']
export function atLeast(grade: string, min: string): boolean {
  const g = ORDER.indexOf(grade)
  const m = ORDER.indexOf(min)
  return g >= 0 && m >= 0 && g <= m
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '')

function gradeIn(entries: Entry[], names: string[]): string | null {
  const wanted = names.map(norm)
  const hits = entries
    .filter((e) => e.grade && wanted.some((w) => norm(e.subject).includes(w)))
    .map(asLetter)
  if (!hits.length) return null
  return hits.sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b))[0]
}

export type Verdict = { eligible: boolean; reasons: string[] }

function check(rule: Rule, o: Entry[], a: Entry[]): string | null {
  const countedO = best(o, 'o').counting
  const countedA = best(a, 'a').counting
  const counted = [...countedO, ...countedA]

  switch (rule.kind) {
    case 'subject': {
      const pool = rule.level === 'o' ? o : a
      const label = rule.anyOf.join(' or ')
      const level = rule.level === 'o' ? 'O Level' : 'A Level'
      const held = gradeIn(pool, rule.anyOf)
      if (!held) return `Missing required subject: ${label} at ${level}`
      if (!atLeast(held, rule.minGrade)) {
        return `${label} at ${level} is ${held}; minimum required is ${rule.minGrade}`
      }
      return null
    }
    case 'countAtGrade': {
      const ok = counted.filter((e) => atLeast(asLetter(e), rule.minGrade)).length
      if (ok < rule.count) {
        return `${ok} of your ${counted.length} counted subjects are grade ${rule.minGrade} or above; at least ${rule.count} are needed`
      }
      return null
    }
    case 'floor': {
      const below = counted.filter((e) => !atLeast(asLetter(e), rule.minGrade))
      if (below.length) {
        return `${below.length} of your ${counted.length} counted subjects are below grade ${rule.minGrade}, which this department does not accept`
      }
      return null
    }
    case 'aLevelCount': {
      const n = a.filter((e) => e.grade).length
      if (n < rule.count) return `You have ${n} A Level subject${n === 1 ? '' : 's'}; at least ${rule.count} are needed`
      return null
    }
    case 'average': {
      const gpa = rule.level === 'o' ? best(o, 'o').gpa : best(a, 'a').gpa
      const label = rule.level === 'o' ? 'O Level' : 'A Level'
      if (gpa < rule.min) return `${label} GPA is ${gpa.toFixed(2)}; ${rule.min.toFixed(2)} is required`
      return null
    }
  }
}

export function departmentVerdict(uni: University, dept: Department, o: Entry[], a: Entry[]): Verdict {
  const reasons: string[] = []
  for (const rule of [...uni.general, ...dept.rules]) {
    const problem = check(rule, o, a)
    if (problem && !reasons.includes(problem)) reasons.push(problem)
  }
  return { eligible: reasons.length === 0, reasons }
}

// ---- Shorthand for the data below ----
const subj = (names: string | string[], level: 'o' | 'a', minGrade: string): Rule =>
  ({ kind: 'subject', anyOf: Array.isArray(names) ? names : [names], level, minGrade })
const mathsPhysics = (minGrade: string): Rule[] => [
  subj('Mathematics', 'a', minGrade), subj('Physics', 'a', minGrade),
]
const dept = (name: string, category: Category, rules: Rule[] = [], notes?: string): Department =>
  ({ name, category, rules, notes })

/** Engineering departments that share one rule, named in bulk. */
const engineering = (names: string[], rules: Rule[]): Department[] =>
  names.map((n) => dept(n, 'Engineering', rules))

export const UNIVERSITIES: University[] = [
  {
    id: 'nsu',
    name: 'North South University',
    short: 'NSU',
    type: 'private',
    source: 'https://admissions.northsouth.edu/undergraduate_requirement',
    admissionTest: true,
    equivalenceRequired: false,
    general: [{ kind: 'average', level: 'o', min: 2.5 }, { kind: 'average', level: 'a', min: 2.0 }],
    note: 'Five O Levels averaging 2.5 and two A Levels averaging 2.0, on A = 5, B = 4, C = 3, D = 2, E = 1.',
    departments: [
      ...engineering(
        ['Computer Science & Engineering (CSE)', 'Electrical & Electronic Engineering (EEE)', 'Civil & Environmental Engineering (CEE)'],
        [subj('Mathematics', 'o', 'C'), subj('Physics', 'o', 'C'), subj(['Mathematics', 'Physics'], 'a', 'C')],
      ),
      dept('Architecture (B.Arch)', 'Architecture', [subj(['Mathematics', 'Physics'], 'a', 'C')]),
      dept('Pharmacy (B.Pharm)', 'Pharmacy', [subj('Chemistry', 'a', 'B'), subj('Biology', 'a', 'B')]),
      dept('Biochemistry & Microbiology (BMB)', 'Science', [subj('Biology', 'o', 'E'), subj('Chemistry', 'o', 'E')]),
      dept('Business Administration (BBA)', 'Business'),
      dept('Economics (BS)', 'Business'),
    ],
  },
  {
    id: 'brac',
    name: 'BRAC University',
    short: 'BRAC',
    type: 'private',
    source: 'https://www.bracu.ac.bd/admissions/undergraduate',
    admissionTest: true,
    equivalenceRequired: false,
    general: [{ kind: 'average', level: 'o', min: 2.5 }, { kind: 'average', level: 'a', min: 2.5 }],
    note: '2.50 at each level. An E is discarded at O Level but scores a point at A Level. A break in study of up to three years is accepted, one year for Pharmacy. Everyone sits a written test, then an interview.',
    departments: [
      ...engineering(['Computer Science & Engineering (CSE)', 'Electrical & Electronic Engineering (EEE)', 'Electronic & Communication Engineering (ECE)'],
        [subj('Physics', 'a', 'C'), subj('Mathematics', 'a', 'C')]),
      dept('Applied Physics & Electronics (APE)', 'Science', [subj('Physics', 'a', 'C'), subj('Mathematics', 'a', 'C')]),
      dept('Physics (BSc)', 'Science', [subj('Physics', 'a', 'C'), subj('Mathematics', 'a', 'C')]),
      dept('Computer Science (BSc)', 'Science', [subj('Mathematics', 'a', 'C')]),
      dept('Mathematics (BSc)', 'Science', [subj('Mathematics', 'a', 'C')]),
      dept('Biotechnology (BSc)', 'Science', [subj('Biology', 'a', 'C'), subj('Chemistry', 'a', 'C')],
        'Without Mathematics at A Level you can still be admitted, but must clear a remedial maths course.'),
      dept('Microbiology (BSc)', 'Science', [subj('Biology', 'a', 'C'), subj('Chemistry', 'a', 'C')],
        'Without Mathematics at A Level you can still be admitted, but must clear a remedial maths course.'),
      dept('Pharmacy (B.Pharm)', 'Pharmacy',
        [subj('Chemistry', 'a', 'B'), subj('Biology', 'a', 'B'), subj('Mathematics', 'a', 'C'), subj('Physics', 'a', 'C')],
        'Governed by the national B.Pharm accreditation guideline, not the general BRAC minimum. A Level must be from the current or previous year, and foreign certificates need Pharmacy Council equivalence before admission.'),
      dept('Architecture (B.Arch)', 'Architecture', [], 'No named subject requirement. The test includes a drawing paper.'),
      dept('Business Administration (BBA)', 'Business'),
      dept('Economics (BSS)', 'Social Science'),
      dept('Anthropology (BSS)', 'Social Science'),
      dept('English (BA)', 'Arts'),
      dept('Law (LL.B)', 'Law'),
    ],
  },
  {
    id: 'iub',
    name: 'Independent University, Bangladesh',
    short: 'IUB',
    type: 'private',
    source: 'https://www.iub.edu.bd/admissions',
    admissionTest: true,
    equivalenceRequired: false,
    general: [],
    departments: [
      ...engineering(['Computer Science & Engineering (CSE)', 'Electrical & Electronic Engineering (EEE)', 'Electronics & Telecommunication Engineering (ETE)'],
        [subj('Mathematics', 'a', 'C'), subj('Physics', 'a', 'C')]),
      dept('Pharmacy (B.Pharm)', 'Pharmacy', [subj('Biology', 'o', 'C'), subj('Chemistry', 'a', 'C')]),
      dept('Environmental Science (ES)', 'Science'),
      dept('Business Administration (BBA)', 'Business'),
    ],
  },
  {
    id: 'aiub',
    name: 'American International University-Bangladesh',
    short: 'AIUB',
    type: 'private',
    source: 'https://www.aiub.edu/admission',
    admissionTest: true,
    equivalenceRequired: false,
    general: [],
    departments: [
      ...engineering(['Computer Science & Engineering (CSE)', 'Electrical & Electronic Engineering (EEE)', 'Industrial & Production Engineering (IPE)', 'Computer Engineering (COE)'],
        [subj('Mathematics', 'a', 'C')]),
      dept('Architecture (B.Arch)', 'Architecture', [subj(['Mathematics', 'Physics'], 'a', 'C')]),
      dept('Pharmacy (B.Pharm)', 'Pharmacy', [subj('Chemistry', 'a', 'B'), subj('Biology', 'a', 'B')]),
      dept('Business Administration (BBA)', 'Business'),
    ],
  },
  {
    id: 'aust',
    name: 'Ahsanullah University of Science & Technology',
    short: 'AUST',
    type: 'private',
    source: 'https://www.aust.edu/admission',
    admissionTest: true,
    equivalenceRequired: false,
    general: [],
    note: 'AUST engineering looks at the O and A Level GPAs added together, asking for 7.00 or above.',
    departments: [
      ...engineering(['Computer Science & Engineering (CSE)', 'Electrical & Electronic Engineering (EEE)', 'Mechanical Engineering (ME)', 'Civil Engineering (CE)', 'Industrial & Production Engineering (IPE)', 'Textile Engineering (TE)'],
        [...mathsPhysics('C')]),
      dept('Architecture (B.Arch)', 'Architecture', [subj(['Mathematics', 'Physics'], 'a', 'C')]),
      dept('Business Administration (BBA)', 'Business'),
    ],
  },
  {
    id: 'uiu',
    name: 'United International University',
    short: 'UIU',
    type: 'private',
    source: 'https://www.uiu.ac.bd/admission/admission-requirements/',
    admissionTest: true,
    equivalenceRequired: false,
    general: [{ kind: 'average', level: 'o', min: 2.5 }, { kind: 'average', level: 'a', min: 2.0 }],
    note: 'Five O Levels averaging 2.50 and two A Levels averaging 2.00. Four A grades at O Level replaces the written test with an interview.',
    departments: [
      ...engineering(['Computer Science & Engineering (CSE)', 'Electrical & Electronic Engineering (BSEEE)', 'Civil Engineering (CE)'],
        [subj('Physics', 'a', 'E'), subj('Mathematics', 'a', 'E')]),
      dept('Data Science (BSDS)', 'Science', [subj('Physics', 'a', 'E'), subj('Mathematics', 'a', 'E')],
        'Physics and Mathematics must have been passed at A Level; UIU names no minimum grade.'),
      dept('Pharmacy (B.Pharm)', 'Pharmacy',
        [subj('Chemistry', 'a', 'B'), subj('Biology', 'a', 'B'), subj('Physics', 'a', 'C'), subj('Mathematics', 'a', 'C')],
        'Also needs an aggregate 8.00 out of 10 across both levels. Without Mathematics you may still be admitted, but must clear an extra maths course.'),
      dept('Biotechnology & Genetic Engineering (BSBGE)', 'Science',
        [subj('Biology', 'o', 'C'), subj('Chemistry', 'o', 'C')]),
      dept('Business Administration (BBA)', 'Business'),
    ],
  },
  {
    id: 'diu',
    name: 'Daffodil International University',
    short: 'DIU',
    type: 'private',
    source: 'https://daffodilvarsity.edu.bd/department/cse/admission-eligibility',
    admissionTest: true,
    equivalenceRequired: false,
    general: [
      { kind: 'countAtGrade', count: 7, minGrade: 'C' },
      { kind: 'countAtGrade', count: 4, minGrade: 'B' },
    ],
    note: 'Five O Levels and at least two A Levels. Across those seven, DIU asks for four grades at B and three at C, which makes C the floor in every subject. A study gap of at most two years is accepted.',
    departments: [
      ...engineering(['Computer Science & Engineering (CSE)', 'Software Engineering (SWE)', 'Electrical & Electronic Engineering (EEE)'],
        [subj('Physics', 'o', 'E'), subj('Mathematics', 'o', 'E'), subj('Physics', 'a', 'E'), subj('Mathematics', 'a', 'E')]),
      dept('English (BA Hons)', 'Arts', [subj('English', 'a', 'B')],
        'English must be at least a B at A Level.'),
      dept('Business Administration (BBA)', 'Business'),
      dept('Law (LL.B Hons)', 'Law'),
    ],
  },
  {
    id: 'ulab',
    name: 'University of Liberal Arts Bangladesh',
    short: 'ULAB',
    type: 'private',
    source: 'https://ulab.edu.bd/undergraduate-programs/admissions-requirements',
    admissionTest: true,
    equivalenceRequired: false,
    general: [{ kind: 'average', level: 'o', min: 2.5 }, { kind: 'average', level: 'a', min: 2.0 }],
    note: 'Five O Levels averaging 2.50 and two A Levels averaging 2.00. ULAB names no subject requirement for any programme, only that science and engineering programmes need a science background. An SAT of 1100 waives the written test.',
    departments: [
      dept('Computer Science & Engineering (CSE)', 'Engineering', [], 'Science background required; no individual subject is named.'),
      dept('Electrical & Electronic Engineering (EEE)', 'Engineering', [], 'Science background required; no individual subject is named.'),
      dept('Environmental Science & Sustainability (ESS)', 'Science', [], 'Science background required; no individual subject is named.'),
      dept('Business Administration (BBA)', 'Business'),
      dept('English & Humanities (BA)', 'Arts'),
      dept('Media Studies & Journalism (BSS)', 'Social Science'),
    ],
  },
  {
    id: 'buet',
    name: 'Bangladesh University of Engineering & Technology',
    short: 'BUET',
    type: 'public',
    source: 'https://ugadmission.buet.ac.bd',
    admissionTest: true,
    equivalenceRequired: true,
    general: [],
    note: 'Admission is by written test. O and A Level applicants need a UGC equivalence certificate first.',
    departments: [
      ...engineering(['Computer Science & Engineering (CSE)', 'Electrical & Electronic Engineering (EEE)', 'Mechanical Engineering (ME)', 'Civil Engineering (CE)', 'Chemical Engineering (ChE)', 'Industrial & Production Engineering (IPE)', 'Materials & Metallurgical Engineering (MME)', 'Water Resources Engineering (WRE)', 'Naval Architecture & Marine Engineering (NAME)', 'Biomedical Engineering (BME)', 'Nanomaterials & Ceramic Engineering (NCE)', 'Urban & Regional Planning (URP)'],
        [subj('Physics', 'a', 'B'), subj('Chemistry', 'a', 'B'), subj('Mathematics', 'a', 'B')]),
      dept('Architecture (B.Arch)', 'Architecture', [subj('Physics', 'a', 'B'), subj('Mathematics', 'a', 'B')]),
    ],
  },
  {
    id: 'mist',
    name: 'Military Institute of Science & Technology',
    short: 'MIST',
    type: 'public',
    source: 'https://www.mist.ac.bd/admission',
    admissionTest: true,
    equivalenceRequired: true,
    general: [],
    departments: [
      ...engineering(['Computer Science & Engineering (CSE)', 'Electrical, Electronic & Communication Engineering (EECE)', 'Mechanical Engineering (ME)', 'Civil Engineering (CE)', 'Aeronautical Engineering (AE)', 'Nuclear Science & Engineering (NSE)'],
        [subj('Physics', 'a', 'B'), subj('Chemistry', 'a', 'B'), subj('Mathematics', 'a', 'B')]),
      dept('Biomedical Engineering (BME)', 'Engineering',
        [{ kind: 'aLevelCount', count: 4 }, subj('Physics', 'a', 'B'), subj('Biology', 'a', 'B')]),
      dept('Architecture (B.Arch)', 'Architecture', [subj('Physics', 'a', 'B'), subj('Mathematics', 'a', 'B')]),
    ],
  },
  {
    id: 'iut',
    name: 'Islamic University of Technology',
    short: 'IUT',
    type: 'public',
    source: 'https://www.iutoic-dhaka.edu/admission',
    admissionTest: true,
    equivalenceRequired: false,
    general: [],
    departments: [
      dept('All BSc Engineering and BBA programmes', 'Engineering',
        [subj('Physics', 'a', 'A'), subj('Chemistry', 'a', 'A'), subj('Mathematics', 'a', 'A')],
        'IUT asks for high A Level grades across the science subjects.'),
    ],
  },
  {
    id: 'bup',
    name: 'Bangladesh University of Professionals',
    short: 'BUP',
    type: 'public',
    source: 'https://bup.edu.bd/academics/academics_admission_details/510',
    admissionTest: true,
    equivalenceRequired: false,
    general: [],
    note: 'Five O Levels and two A Levels totalling at least 26.5 points, on BUP\'s own scale where a C is 3.5 and anything below D scores nothing. O and A Level holders are exempt from the equivalence certificate. BUP publishes no minimum grade in any individual subject; the threshold is on the total alone.',
    departments: [
      dept('Business Administration (BBA)', 'Business', [], 'MCQ test: maths and analytical ability, English, general knowledge.'),
      dept('BBA in Management Studies', 'Business', [], 'Open to any background.'),
      dept('BBA in Accounting & Information Systems', 'Business'),
      dept('Computer Science & Engineering (CSE)', 'Engineering', [],
        'BUP asks for a science background with Mathematics, but states it for HSC rather than for A Level, so no GCE subject rule is applied here. The test covers maths, physics, chemistry, biology and English.'),
      dept('Law (LL.B Hons)', 'Law', [], 'At least 40 per cent in the English section is needed to qualify.'),
      dept('English (BA Hons)', 'Arts', [],
        'BUP asks for an A minus in English, but publishes it only in the SSC and HSC grade system with no GCE equivalent.'),
      dept('Mass Communication & Journalism (BSS)', 'Social Science', [], 'At least 40 per cent in the English section is needed.'),
      dept('Peace, Conflict & Human Rights Studies (BSS)', 'Social Science'),
    ],
  },
  {
    id: 'du',
    name: 'University of Dhaka',
    short: 'DU',
    type: 'public',
    source: 'https://admission.eis.du.ac.bd',
    admissionTest: true,
    equivalenceRequired: true,
    general: [],
    note: "Each unit sets its own bar, so the rules live on the departments below rather than across DU as a whole. Grades score A = 5, B = 4, C = 3.5 and D = nothing. Foreign certificates must clear DU's own equivalence process before you may sit the test, and every unit tests. Year windows apply and shift each cycle.",
    departments: [
      dept('Science Unit', 'Science',
        [{ kind: 'countAtGrade', count: 2, minGrade: 'A' }, { kind: 'countAtGrade', count: 5, minGrade: 'B' }, { kind: 'floor', minGrade: 'C' }],
        'The strictest unit: of the seven subjects, two at A, three at B and two at C, and a D is not accepted in any of them. Departments then set their own minimum grades, with Physics and Maths at A for CSE, EEE and Physics.'),
      dept('Arts, Law & Social Science Unit', 'Arts',
        [{ kind: 'countAtGrade', count: 4, minGrade: 'B' }, { kind: 'floor', minGrade: 'C' }],
        'Four at B and three at C, with no D in any of the seven. English asks for at least a C in O Level English, and Economics for a B in O Level maths plus maths or economics at A Level.'),
      dept('Business Studies Unit', 'Business',
        [{ kind: 'countAtGrade', count: 4, minGrade: 'B' }, { kind: 'countAtGrade', count: 3, minGrade: 'C' },
         subj(['Business', 'Accounting', 'Economics', 'Mathematics'], 'a', 'E')],
        'Your A Levels must include Business Studies, Accounting, Economics or Mathematics, and each level needs a grade point of 3.0 on its own.'),
      dept('Fine Arts Unit (Charukala)', 'Arts',
        [{ kind: 'countAtGrade', count: 4, minGrade: 'B' }, { kind: 'countAtGrade', count: 3, minGrade: 'C' }],
        'Open to any stream and the lowest bar at DU. The test is general knowledge plus a drawing paper.'),
      dept('Institute of Business Administration (IBA)', 'Business',
        [subj('Mathematics', 'o', 'E'), { kind: 'countAtGrade', count: 2, minGrade: 'A' }],
        'A separate unit with its own exam. Mathematics is compulsory at O Level, at least two of the seven subjects must be grade A, and each level needs 3.5 on its own.'),
    ],
  },
  {
    id: 'ibaju',
    name: 'Institute of Business Administration, Jahangirnagar University',
    short: 'IBA-JU',
    type: 'public',
    source: 'https://juniv.edu',
    admissionTest: true,
    equivalenceRequired: true,
    general: [],
    departments: [
      dept('Business Administration (BBA)', 'Business', [{ kind: 'countAtGrade', count: 7, minGrade: 'C' }]),
    ],
  },
  {
    id: 'dghs',
    name: 'Government Medical Colleges (DGHS)',
    short: 'Govt Medical',
    type: 'public',
    source: 'https://dgme.gov.bd',
    admissionTest: true,
    equivalenceRequired: true,
    general: [],
    note: 'Entry is by the national MBBS/BDS admission test, and only Physics, Chemistry and Biology count towards the A Level score.',
    departments: [
      dept('Bachelor of Medicine & Bachelor of Surgery (MBBS)', 'Medical',
        [subj('Biology', 'a', 'C'), subj('Chemistry', 'a', 'C'), subj('Physics', 'a', 'C')]),
      dept('Bachelor of Dental Surgery (BDS)', 'Medical',
        [subj('Biology', 'a', 'C'), subj('Chemistry', 'a', 'C'), subj('Physics', 'a', 'C')]),
    ],
  },
]

export const CATEGORIES: Category[] = [
  'Engineering', 'Science', 'Business', 'Arts', 'Law',
  'Pharmacy', 'Architecture', 'Social Science', 'Medical', 'General',
]

// ---- Awards ----
export type Award = {
  name: string
  body: string
  criteria: string[]
  /** Marks-based awards cannot be judged from grades, so they are shown as notes. */
  infoOnly?: boolean
  needs?: { level: 'o' | 'a'; count: number; minGrade: string }[]
  link?: string
}

export const AWARDS: Award[] = [
  {
    name: 'The Daily Star O & A Level Awards',
    body: 'The Daily Star',
    criteria: [
      'Six A grades or above at O Level, across up to two consecutive sessions',
      'Three A grades or above at A Level, across up to two consecutive sessions',
    ],
    needs: [{ level: 'o', count: 6, minGrade: 'A' }, { level: 'a', count: 3, minGrade: 'A' }],
  },
  {
    name: "British Council Scholars' Award",
    body: 'British Council Bangladesh',
    criteria: ['Nine A grades or above at O Level in a single session'],
    needs: [{ level: 'o', count: 9, minGrade: 'A' }],
  },
  {
    name: 'Outstanding Pearson Learner Awards (OPLA)',
    body: 'Pearson Edexcel',
    criteria: ['Awarded on exam marks, country-topper style, so it cannot be judged from grades alone'],
    infoOnly: true,
  },
  {
    name: 'Cambridge Outstanding Learner Awards',
    body: 'Cambridge International',
    criteria: ['Awarded on exam marks, country-topper style, so it cannot be judged from grades alone'],
    infoOnly: true,
  },
]

/** How many subjects reach a grade, used for the award checks. */
export function countAtLeast(entries: Entry[], minGrade: string): number {
  return entries.filter((e) => e.grade && atLeast(asLetter(e), minGrade)).length
}
