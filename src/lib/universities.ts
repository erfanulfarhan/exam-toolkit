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
    note: 'Five O Levels averaging 2.50 and two A Levels averaging 2.00, and only one E grade is accepted across both levels combined. An SAT of 1150, IELTS 7.0 or TOEFL 85 waives the test, though not for Pharmacy or Law, and the architecture drawing test is never waived.',
    departments: [
      ...engineering(['Computer Science & Engineering (CSE)', 'Electrical & Electronic Engineering (EEE)', 'Civil & Environmental Engineering (CEE)'],
        [subj(['Mathematics', 'Physics'], 'a', 'C')]),
      dept('Architecture (B.Arch)', 'Architecture', [subj(['Mathematics', 'Physics'], 'a', 'C')],
        'A 30 minute drawing test is added and cannot be waived.'),
      dept('Pharmacy (B.Pharm)', 'Pharmacy',
        [subj('Chemistry', 'a', 'B'), subj('Biology', 'a', 'B'), subj('Physics', 'a', 'C'), subj('Mathematics', 'a', 'C')],
        'Must be your first choice, is offered in Spring and Summer only, admits on the test alone with no waiver, and A Levels must be within three years.'),
      dept('Biochemistry', 'Science', [subj('Biology', 'o', 'U'), subj('Chemistry', 'o', 'U')],
        'Biology and Chemistry must have been taken, at either level, with no minimum grade published.'),
      dept('Microbiology', 'Science', [subj('Biology', 'o', 'U'), subj('Chemistry', 'o', 'U')]),
      dept('Public Health (BPH)', 'Medical', [],
        'Needs any two of Physics, Chemistry, Biology and Mathematics at each level.'),
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
    source: 'https://iub.ac.bd/admissions/undergraduate-admissions',
    admissionTest: true,
    equivalenceRequired: false,
    general: [{ kind: 'average', level: 'o', min: 2.5 }, { kind: 'average', level: 'a', min: 2.0 }],
    note: 'Five O Levels at 2.50 and two A Levels at 2.00. The test is set per programme and can be waived on an SAT of 1000 with IELTS 5.5 or TOEFL 80. O and A Level certificates carry a 3,000 taka verification fee.',
    departments: [
      ...engineering(['Computer Science & Engineering (CSE)', 'Electrical & Electronic Engineering (EEE)', 'Electronics & Telecommunication Engineering (ETE)', 'Computer Engineering'],
        [subj('Mathematics', 'o', 'U'), subj('Physics', 'o', 'U')]),
      dept('Microbiology', 'Science', [subj('Biology', 'o', 'B')]),
      dept('Biochemistry & Biotechnology', 'Science', [subj('Biology', 'o', 'B')],
        'An extra 30 minute biology paper is added to the test.'),
      dept('Environmental Science & Management', 'Science', [],
        'Chemistry or Physics is preferred rather than required.'),
      dept('Pharmacy (B.Pharm)', 'Pharmacy',
        [subj('Chemistry', 'a', 'B'), subj('Biology', 'a', 'B'), subj('Mathematics', 'a', 'C'), subj('Physics', 'a', 'C')],
        'Without Mathematics you can still be admitted, but must clear an extra maths course.'),
      dept('Business Administration (BBA)', 'Business'),
      dept('Law (LL.B Hons)', 'Law'),
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
    general: [{ kind: 'average', level: 'o', min: 2.5 }, { kind: 'average', level: 'a', min: 2.0 }],
    note: '2.50 across your best five O Levels with nothing below a D, and 2.00 across two A Levels. Only one E is accepted across the seven, and not in Maths or Physics for the science programmes. An SAT of 1106 waives the written exam.',
    departments: [
      ...engineering(['Computer Science & Engineering (CSE)', 'Electrical & Electronic Engineering (EEE)', 'Industrial & Production Engineering (IPE)'],
        [subj('Mathematics', 'a', 'D'), subj('Physics', 'a', 'D')]),
      dept('Computer Engineering (COE)', 'Engineering',
        [subj('Mathematics', 'a', 'D'), subj(['Physics', 'Computer', 'Information Technology'], 'a', 'D')],
        'The one relaxation: Computer Studies or IT is accepted in place of Physics.'),
      dept('Data Science (DS)', 'Science', [subj('Mathematics', 'a', 'D'), subj('Physics', 'a', 'D')]),
      dept('Architecture', 'Architecture', [subj('Mathematics', 'a', 'D'), subj('Physics', 'a', 'D')]),
      dept('Pharmacy (B.Pharm)', 'Pharmacy',
        [subj('Physics', 'a', 'C'), subj('Mathematics', 'a', 'C')],
        'Physics and Maths at C are required; B grades in Chemistry and Biology are recommended rather than mandatory. Needs 8.00 out of 10 overall, and A Level within the last two years.'),
      dept('Biochemistry & Molecular Biology (BSc)', 'Science',
        [subj('Physics', 'a', 'C'), subj('Chemistry', 'a', 'C'), subj('Biology', 'a', 'C')],
        'Without Mathematics you can still be admitted, but must clear an extra maths course.'),
      dept('Business Administration (BBA)', 'Business'),
      dept('Economics (BSS)', 'Social Science', [], 'Mathematics is not required.'),
      dept('English (BA)', 'Arts'),
      dept('Media & Mass Communication (MMC)', 'Arts'),
      dept('Law (LL.B)', 'Law'),
    ],
  },
  {
    id: 'aust',
    name: 'Ahsanullah University of Science & Technology',
    short: 'AUST',
    type: 'private',
    source: 'https://admission.aust.edu/ug-admission/',
    admissionTest: true,
    equivalenceRequired: false,
    note: 'Business asks for 7.00 across the two levels combined, engineering and architecture for 8.00. Certificates must come from Cambridge or Pearson themselves; school-issued papers and AS Level results are not accepted.',
    general: [],
    departments: [
      ...engineering(['Computer Science & Engineering (CSE)', 'Electrical & Electronic Engineering (EEE)', 'Mechanical Engineering (ME)', 'Civil Engineering (CE)', 'Industrial & Production Engineering (IPE)', 'Textile Engineering (TE)'],
        [subj('Mathematics', 'o', 'U'), subj('Physics', 'o', 'U'), subj('Chemistry', 'o', 'U'), subj('English', 'o', 'U'),
         subj('Mathematics', 'a', 'U'), subj('Physics', 'a', 'U'), subj('Chemistry', 'a', 'U')]),
      dept('Architecture (B.Arch)', 'Architecture',
        [subj('Mathematics', 'o', 'U'), subj('Physics', 'o', 'U'), subj('Chemistry', 'o', 'U'), subj('English', 'o', 'U'),
         subj('Mathematics', 'a', 'U'), subj('Physics', 'a', 'U'), subj('Chemistry', 'a', 'U')],
        'Same subjects as engineering, plus a 320 mark drawing paper. Needs 8.00 combined and 3.50 across the three A Level sciences.'),
      dept('Business Administration (BBA)', 'Business', [],
        'No subject requirement. Needs 7.00 across both levels combined, with at least 3.00 at a level.'),
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
    source: 'https://www.buet.ac.bd/web/#/ugAdmission/1',
    admissionTest: true,
    equivalenceRequired: false,
    general: [
      subj('Mathematics', 'o', 'B'), subj('Physics', 'o', 'B'), subj('Chemistry', 'o', 'B'), subj('English', 'o', 'B'),
      subj('Mathematics', 'a', 'B'), subj('Physics', 'a', 'B'), subj('Chemistry', 'a', 'B'),
    ],
    note: 'No GPA at all: BUET sets grades directly. Five O Levels including Maths, Physics, Chemistry and English at B or better, then at A Level two of Maths, Physics and Chemistry at A with the third at B. Only the top 300 eligible GCE applicants are even called to the test, ranked on A Level Maths then Physics, for 1,305 seats. Departments are allotted by test rank, not chosen.',
    departments: [
      ...engineering(['Computer Science & Engineering', 'Electrical & Electronic Engineering', 'Mechanical Engineering', 'Civil Engineering', 'Chemical Engineering', 'Industrial & Production Engineering', 'Materials & Metallurgical Engineering', 'Nanomaterials & Ceramic Engineering', 'Water Resource Engineering', 'Naval Architecture & Marine Engineering'], []),
      dept('Biomedical Engineering', 'Engineering', [subj('Biology', 'a', 'B')],
        'The only department with an extra rule: Biology at A Level, minimum B.'),
      dept('Architecture', 'Architecture', [],
        'Sits an extra 400 mark freehand drawing and spatial reasoning paper, needing 160 to qualify.'),
      dept('Urban & Regional Planning', 'Architecture', [], 'Admitted with the engineering group.'),
    ],
  },
  {
    id: 'mist',
    name: 'Military Institute of Science & Technology',
    short: 'MIST',
    type: 'public',
    source: 'https://admission.mist.ac.bd',
    admissionTest: true,
    equivalenceRequired: false,
    general: [
      subj('Mathematics', 'o', 'B'), subj('Physics', 'o', 'B'), subj('Chemistry', 'o', 'B'), subj('English', 'o', 'B'),
      subj('Mathematics', 'a', 'B'), subj('Physics', 'a', 'B'), subj('Chemistry', 'a', 'B'),
    ],
    note: 'A B in five O Levels including Maths, Physics, Chemistry and English, and a B in Maths, Physics and Chemistry at A Level. Open to Bangladeshi science-group applicants, and the department is allotted after the test rather than chosen when you apply.',
    departments: [
      ...engineering(['Computer Science & Engineering (CSE)', 'Electrical, Electronic & Communication Engineering (EECE)', 'Mechanical Engineering (ME)', 'Civil Engineering (CE)'], []),
      dept('Biomedical Engineering (BME)', 'Engineering', [subj('Biology', 'a', 'C')],
        'The one department with an extra rule: Biology at A Level, minimum C.'),
      dept('Architecture (B.Arch)', 'Architecture', [],
        'No extra subject, but you sit a second 200 mark freehand drawing paper and must reach 40 per cent in both units.'),
      dept('Mathematics & Data Science (BSc)', 'Science', [],
        'Admitted through a separate science unit with its own circular and test.'),
      dept('Chemistry & Nanoscience (BSc)', 'Science', [],
        'Admitted through the same separate science unit.'),
    ],
  },
  {
    id: 'iut',
    name: 'Islamic University of Technology',
    short: 'IUT',
    type: 'public',
    source: 'https://admission.iutoic-dhaka.edu/information/entry-requirements',
    admissionTest: true,
    equivalenceRequired: false,
    general: [
      subj('English', 'o', 'B'),
      subj('Mathematics', 'a', 'A'), subj('Physics', 'a', 'A'), subj('Chemistry', 'a', 'A'),
    ],
    note: 'One requirement covers every programme: A grades in Maths, Physics and Chemistry at A Level, with two of those three at B and the third at C at O Level, plus a B in O Level English. Undergraduate admission is open only to Muslim applicants from OIC member countries.',
    departments: [
      ...engineering(['Computer Science & Engineering (CSE)', 'Software Engineering (SWE)', 'Electrical & Electronic Engineering (EEE)', 'Mechanical Engineering (ME)', 'Civil Engineering (CE)', 'Industrial & Production Engineering (IPE)'], []),
      dept('Business Administration in Technology Management (BBA)', 'Business', [],
        'Held to the same science grades as the engineering programmes.'),
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
    source: 'https://bachelor.ju-admission.com',
    admissionTest: true,
    equivalenceRequired: false,
    general: [
      { kind: 'countAtGrade', count: 4, minGrade: 'B' },
      { kind: 'countAtGrade', count: 3, minGrade: 'C' },
    ],
    note: 'Admitted through Jahangirnagar\'s central circular rather than its own. Five O Levels from 2020 onwards and two A Levels from 2024 or 2025, and across those seven, four at B and three at C. Merit scores A at 5, B at 4, C at 3.5 and D at 3. Fifty seats.',
    departments: [
      dept('Business Administration (BBA)', 'Business', [],
        'No subject requirement is published for O and A Level applicants. The test is 80 MCQ marks, mostly English and mathematical aptitude, needing 45 per cent to pass.'),
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
    note: 'One national test for all 37 government medical colleges. O Level must be in the science group and A Level must include Biology, Physics and Chemistry, with at least 3.50 in Biology. The two levels together need 8.50 out of 10, and neither may fall below 4.00. A Level must be from 2024 or 2025, and O Level no earlier than 2022. A DGME equivalence certificate is compulsory before you can even apply.',
    departments: [
      dept('Medicine & Surgery (MBBS)', 'Medical',
        [subj('Biology', 'a', 'U'), subj('Chemistry', 'a', 'U'), subj('Physics', 'a', 'U')],
        '5,100 seats. Minimums are set in Bangladeshi GPA points after DGME converts your grades, so no letter grade is published to check against here.'),
      dept('Dental Surgery (BDS)', 'Medical',
        [subj('Biology', 'a', 'U'), subj('Chemistry', 'a', 'U'), subj('Physics', 'a', 'U')],
        '545 seats, same test and same eligibility as MBBS.'),
    ],
  },
]
