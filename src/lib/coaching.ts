export const ORG = { id: 'ORG-2201', name: 'Scholars Point Coaching', area: 'Mohakhali', district: 'Dhaka', owner: 'Mr. Imran Hossain' }
export const ORG_TYPES = ['Coaching centre', 'Institute', 'Training centre', 'Learning hub']
export const AREAS = ['Mohakhali', 'Banani', 'Gulshan', 'Uttara', 'Dhanmondi', 'Mirpur', 'Farmgate']
export const OWNER_ROLES = ['Owner', 'Director', 'Principal', 'Managing partner']
export const STUDENT_BANDS = ['Under 50', '50 to 150', '150 to 400', 'Over 400']
export const LEVELS = ['Primary', 'Secondary (6 to 10)', 'HSC', 'Admission test', 'Language']
export const SUBJECT_LIST = ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English', 'ICT', 'Accounting']
export const REG_TYPES = ['Trade licence', 'Company registration', 'Society registration']

export type CForm = {
  orgName: string; ownerName: string; ownerRole: string; orgType: string
  area: string; district: string; established: string; band: string
  levels: string[]; subjects: string[]
  regType: string; regLast4: string; tin: string; branches: string
  licenceFile: boolean; ownerIdFile: boolean; premisesFile: boolean
  email: string; phone: string; consent: boolean; declare: boolean
}
export type CV = { cv: Record<string, boolean>; form: CForm; phoneOk: boolean; emailOk: boolean; note: string; submittedOnce: boolean }
export const initialCV = (): CV => ({
  cv: {}, phoneOk: false, emailOk: false, note: '', submittedOnce: false,
  form: { orgName: '', ownerName: '', ownerRole: 'Owner', orgType: 'Coaching centre', area: 'Mohakhali', district: 'Dhaka', established: '', band: '50 to 150', levels: [], subjects: [], regType: 'Trade licence', regLast4: '', tin: '', branches: '1', licenceFile: false, ownerIdFile: false, premisesFile: false, email: '', phone: '', consent: false, declare: false },
})

export type Teacher = { id: string; name: string; subject: string; qual: string; status: 'active' | 'invited'; phone: string; email: string; rating: number }
export type CStudent = { id: string; name: string; cls: string; batchIds: string[]; parentId: string; joined: string; status: 'active' | 'paused' }
export type Batch = { id: string; name: string; subject: string; cls: string; teacherId: string; days: number[]; time: string; room: string; cap: number }
export type CClass = { id: string; batchId: string; day: number; time: string; room: string; cancelled?: boolean; reason?: string }
export type CParent = { id: string; name: string; phone: string; email: string }
export type Homework = { id: string; batchId: string; title: string; desc: string; due: number; sub: Record<string, 'submitted' | 'reviewed'> }
export type Exam = { id: string; batchId: string; title: string; day: number; total: number; marks: Record<string, number | null>; published: boolean }
export type Report = { id: string; batchId: string; month: string; sent: boolean; remark: string; sentDay: number | null }
export type Fee = { id: string; studentId: string; month: string; amount: number; state: 'paid' | 'due' | 'overdue'; reminded: number | null }

export type CJ = {
  teachers: Teacher[]; students: CStudent[]; batches: Batch[]; classes: CClass[]; parents: CParent[]
  marks: Record<string, Record<string, 'present' | 'absent' | 'late'>>
  homework: Homework[]; exams: Exam[]; reports: Report[]; fees: Fee[]
  threads: Thread[]; notifs: Notif[]; profile: Profile
  seq: number
}
export type Msg = { from: 'me' | 'them'; text: string; day: number }
export type Thread = { id: string; withId: string; withName: string; kind: 'Parent' | 'Teacher' | 'Support'; msgs: Msg[]; unread: number }
export type Notif = { id: string; text: string; to: string; day: number; read: boolean }
export type Profile = { name: string; area: string; about: string; hours: string; levels: string[]; subjects: string[]; established: string; listed: boolean }

const T = (id: string, name: string, subject: string, qual: string, phone: string, rating: number, status: Teacher['status'] = 'active'): Teacher => ({ id, name, subject, qual, phone, rating, status, email: `${name.split(' ')[0].toLowerCase()}@scholarspoint.demo` })
export const SEED_TEACHERS: Teacher[] = [
  T('T-1', 'Sabrina Akter', 'Mathematics', 'MSc, Dhaka University', '01712345678', 4.8),
  T('T-2', 'Rakibul Hasan', 'Physics', 'BSc Eng, BUET', '01812345621', 4.7),
  T('T-3', 'Nusrat Jahan', 'Chemistry', 'MSc, Jahangirnagar University', '01911223344', 4.6),
  T('T-4', 'Tahmid Karim', 'English', 'MA, Dhaka University', '01611987654', 4.9),
  T('T-5', 'Farhana Yasmin', 'Biology', 'MBBS (student), DMC', '01512345090', 4.5),
  T('T-6', 'Arman Chowdhury', 'ICT', 'BSc CSE, NSU', '01711002233', 4.4, 'invited'),
]
const P = (id: string, name: string, phone: string): CParent => ({ id, name, phone, email: `${name.split(' ').pop()!.toLowerCase()}.${id.toLowerCase()}@mail.demo` })
export const SEED_PARENTS: CParent[] = [
  P('PR-1', 'Mrs. Shirin Sultana', '01711000101'), P('PR-2', 'Mr. Kamal Uddin', '01811000202'), P('PR-3', 'Mrs. Rehana Parvin', '01911000303'),
  P('PR-4', 'Mr. Jahangir Alam', '01611000404'), P('PR-5', 'Mrs. Mahmuda Begum', '01511000505'), P('PR-6', 'Mr. Selim Reza', '01711000606'),
  P('PR-7', 'Mrs. Taslima Nasrin', '01811000707'), P('PR-8', 'Mr. Anwar Hossain', '01911000808'),
]
const B = (id: string, name: string, subject: string, cls: string, teacherId: string, days: number[], time: string, room: string, cap: number): Batch => ({ id, name, subject, cls, teacherId, days, time, room, cap })
export const SEED_BATCHES: Batch[] = [
  B('B-1', 'HSC Physics, Morning', 'Physics', 'HSC 1st year', 'T-2', [0, 2], '8:00-9:30 AM', 'Room 2', 24),
  B('B-2', 'Class 10 Maths, Evening', 'Mathematics', 'Class 10', 'T-1', [1, 3], '5:00-6:30 PM', 'Room 1', 30),
  B('B-3', 'HSC Chemistry, Evening', 'Chemistry', 'HSC 1st year', 'T-3', [2, 4], '6:30-8:00 PM', 'Room 3', 24),
  B('B-4', 'Class 9 English', 'English', 'Class 9', 'T-4', [0, 3], '4:00-5:00 PM', 'Room 1', 28),
  B('B-5', 'SSC Biology', 'Biology', 'Class 10', 'T-5', [1, 4], '3:30-5:00 PM', 'Room 2', 24),
]
const NAMES = ['Ayaan Rahman', 'Mim Akter', 'Nabil Hasan', 'Tasnia Islam', 'Rafi Ahmed', 'Sumaiya Khan', 'Imtiaz Karim', 'Labiba Noor', 'Shafin Alam', 'Anika Tabassum', 'Fahim Reza', 'Zarin Sultana', 'Mahir Chowdhury', 'Nafisa Rahman', 'Arifin Hossain', 'Tahsin Jahan', 'Rayhan Uddin', 'Mehzabin Ali', 'Sadman Sakib', 'Ishrat Jahan', 'Raihan Kabir', 'Samia Parvin', 'Tanvir Mahmud', 'Orpita Das']
export const SEED_STUDENTS: CStudent[] = NAMES.map((name, i) => {
  const b = SEED_BATCHES[i % SEED_BATCHES.length]
  return { id: `CS-${100 + i}`, name, cls: b.cls, batchIds: i % 4 === 0 ? [b.id, SEED_BATCHES[(i + 1) % 5].id] : [b.id], parentId: SEED_PARENTS[i % SEED_PARENTS.length].id, joined: `2026-0${6 + (i % 4)}-1${i % 9}`, status: 'active' as const }
})

export const dayOfClass = (offset: number) => (2 + offset + 700) % 7
export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export const DAY_SHORT = DAY_NAMES.map((d) => d.slice(0, 3))
export const dateOf = (day: number) => new Date(2026, 9, 13 + day)
export const fmtDay = (day: number, long = false) => dateOf(day).toLocaleDateString('en-GB', long ? { weekday: 'long', day: 'numeric', month: 'long' } : { weekday: 'short', day: 'numeric', month: 'short' })
export const TIME_SLOTS = ['8:00-9:30 AM', '9:30-11:00 AM', '11:00 AM-12:30 PM', '3:30-5:00 PM', '4:00-5:00 PM', '5:00-6:30 PM', '6:30-8:00 PM']
export const startMin = (t: string) => {
  const m = /^(\d+):(\d+)\s*(AM|PM)?/.exec(t); if (!m) return 0
  const end = /(AM|PM)$/.exec(t)?.[1]; const per = m[3] ?? end ?? 'AM'
  let h = +m[1] % 12; if (per === 'PM') h += 12
  return h * 60 + +m[2]
}
export const fmtMoney = (n: number) => `৳${n.toLocaleString('en-IN')}`
export function seedClasses(batches: Batch[]): CClass[] {
  const out: CClass[] = []
  for (let d = -7; d <= 13; d++) batches.forEach((b) => { if (b.days.includes(dayOfClass(d))) out.push({ id: `C-${b.id}-${d}`, batchId: b.id, day: d, time: b.time, room: b.room }) })
  return out
}
function seedMarks(classes: CClass[], students: CStudent[]) {
  const m: CJ['marks'] = {}
  classes.filter((c) => c.day < 0).forEach((c) => {
    const row: Record<string, 'present' | 'absent' | 'late'> = {}
    students.filter((s) => s.batchIds.includes(c.batchId)).forEach((s, i) => { const h = (i * 7 + Math.abs(c.day) * 3) % 11; row[s.id] = h === 0 ? 'absent' : h === 5 ? 'late' : 'present' })
    m[c.id] = row
  })
  return m
}
export const MONTH = 'October 2026'
export const REPORT_MONTHS = ['September 2026', 'October 2026']
export const initialCJ = (): CJ => {
  const classes = seedClasses(SEED_BATCHES)
  return {
    teachers: SEED_TEACHERS, students: SEED_STUDENTS, batches: SEED_BATCHES, classes, parents: SEED_PARENTS,
    marks: seedMarks(classes, SEED_STUDENTS),
    homework: [
      { id: 'H-1', batchId: 'B-2', title: 'Algebra worksheet 4', desc: 'Solve questions 1 to 15. Show every step.', due: 2, sub: { 'CS-101': 'submitted', 'CS-105': 'reviewed', 'CS-109': 'submitted' } },
      { id: 'H-2', batchId: 'B-1', title: 'Motion in one dimension, problems 1 to 12', desc: 'Use the equations of motion. Draw a diagram for each problem.', due: 3, sub: { 'CS-100': 'submitted' } },
      { id: 'H-3', batchId: 'B-4', title: 'Essay: A rainy day in Dhaka', desc: 'About 200 words. Focus on describing, not listing.', due: 5, sub: {} },
    ],
    exams: [
      { id: 'E-1', batchId: 'B-2', title: 'Monthly test, Algebra', day: -5, total: 50, marks: {}, published: false },
      { id: 'E-2', batchId: 'B-3', title: 'Chapter test, Organic basics', day: 6, total: 30, marks: {}, published: false },
    ],
    reports: [{ id: 'R-1', batchId: 'B-2', month: 'September 2026', sent: true, remark: 'Steady progress. Please keep up the weekly practice sets.', sentDay: -12 }],
    fees: SEED_STUDENTS.slice(0, 12).map((s, i) => ({ id: `F-${i}`, studentId: s.id, month: MONTH, amount: 1500, state: i < 8 ? 'paid' as const : i < 11 ? 'due' as const : 'overdue' as const, reminded: null })),
    threads: [
      { id: 'M-1', withId: 'PR-1', withName: 'Mrs. Shirin Sultana', kind: 'Parent', unread: 1, msgs: [{ from: 'them', text: 'Assalamu alaikum. Could Ayaan get extra practice problems for Physics before the test?', day: -1 }] },
      { id: 'M-2', withId: 'T-2', withName: 'Rakibul Hasan', kind: 'Teacher', unread: 0, msgs: [{ from: 'me', text: 'Please share the Physics homework plan for next week.', day: -2 }, { from: 'them', text: 'Sure. I will add it to Homework by Thursday.', day: -2 }] },
      { id: 'M-3', withId: 'PR-2', withName: 'Mr. Kamal Uddin', kind: 'Parent', unread: 0, msgs: [{ from: 'them', text: 'Thank you for the monthly report.', day: -12 }, { from: 'me', text: 'You are welcome. Mim is doing well.', day: -12 }] },
      { id: 'M-4', withId: 'SUP', withName: 'TuitionHub Support', kind: 'Support', unread: 0, msgs: [{ from: 'them', text: 'Welcome to TuitionHub. Your organization tools are ready once you are verified.', day: -20 }] },
    ],
    notifs: [
      { id: 'N-1', text: 'Mrs. Shirin Sultana sent you a message.', to: 'messages/M-1', day: -1, read: false },
      { id: 'N-2', text: 'Monthly test, Algebra has no published results yet.', to: 'exams/E-1', day: -1, read: false },
      { id: 'N-3', text: '3 students have fees overdue or due this month.', to: 'payments', day: 0, read: false },
      { id: 'N-4', text: 'Arman Chowdhury has not accepted the teacher invite yet.', to: 'teachers/T-6', day: -3, read: true },
      { id: 'N-5', text: 'September parent report for Class 10 Maths was sent.', to: 'reports/R-1', day: -12, read: true },
    ],
    profile: { name: ORG.name, area: ORG.area, about: 'A friendly coaching centre in Mohakhali for Class 6 to HSC. Small batches, weekly tests and monthly parent reports.', hours: 'Sun to Thu, 8:00 AM to 8:00 PM', levels: ['Secondary (6 to 10)', 'HSC'], subjects: ['Mathematics', 'Physics', 'Chemistry', 'English', 'Biology'], established: '2016', listed: false },
    seq: 1000,
  }
}

export const batchStudents = (cj: CJ, batchId: string) => cj.students.filter((s) => s.batchIds.includes(batchId))
export const attendancePct = (cj: CJ, upTo = 0) => {
  let p = 0, n = 0
  cj.classes.filter((c) => c.day < upTo && !c.cancelled).forEach((c) => Object.values(cj.marks[c.id] ?? {}).forEach((v) => { n++; if (v !== 'absent') p++ }))
  return n ? Math.round((p / n) * 100) : null
}
export const maskParentPhone = (v: string) => `01${v.slice(2, 3)}•• ••• ${v.slice(-3)}`
export const classesOn = (cj: CJ, day: number, withCancelled = false) => cj.classes.filter((c) => c.day === day && (withCancelled || !c.cancelled)).sort((a, b) => startMin(a.time) - startMin(b.time))

export function studentAttendance(cj: CJ, studentId: string) {
  let held = 0, present = 0, late = 0, absent = 0
  cj.classes.filter((c) => !c.cancelled).forEach((c) => { const v = cj.marks[c.id]?.[studentId]; if (!v) return; held++; if (v === 'absent') absent++; else { present++; if (v === 'late') late++ } })
  return { held, present, late, absent, pct: held ? Math.round((present / held) * 100) : null }
}
export function batchAttendance(cj: CJ, batchId: string) {
  let n = 0, p = 0, held = 0
  cj.classes.filter((c) => c.batchId === batchId && !c.cancelled && cj.marks[c.id]).forEach((c) => { held++; Object.values(cj.marks[c.id]).forEach((v) => { n++; if (v !== 'absent') p++ }) })
  return { held, pct: n ? Math.round((p / n) * 100) : null, absences: n - p }
}
export const gradeOf = (pct: number) => (pct >= 80 ? 'A+' : pct >= 70 ? 'A' : pct >= 60 ? 'A-' : pct >= 50 ? 'B' : pct >= 40 ? 'C' : pct >= 33 ? 'D' : 'F')
export function examRows(cj: CJ, e: Exam) {
  const rows = batchStudents(cj, e.batchId).map((s) => { const m = e.marks[s.id]; return { s, mark: m === undefined ? undefined : m, pct: typeof m === 'number' ? Math.round((m / e.total) * 100) : null } })
  const scored = rows.filter((r) => typeof r.mark === 'number').sort((a, b) => (b.mark as number) - (a.mark as number))
  const ranked = rows.map((r) => ({ ...r, rank: r.pct === null ? null : scored.findIndex((x) => x.s.id === r.s.id) + 1 }))
  const vals = scored.map((r) => r.mark as number)
  return { rows: ranked, entered: rows.filter((r) => r.mark !== undefined).length, total: rows.length, avg: vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length / e.total) * 100) : null, high: vals.length ? Math.max(...vals) : null, passRate: vals.length ? Math.round((vals.filter((v) => (v / e.total) * 100 >= 33).length / vals.length) * 100) : null }
}
export const linkedStudents = (cj: CJ, parentId: string) => cj.students.filter((s) => s.parentId === parentId)
export const linkedParents = (cj: CJ) => cj.parents.filter((p) => cj.students.some((s) => s.parentId === p.id))
export const hwStats = (cj: CJ, h: Homework) => { const st = batchStudents(cj, h.batchId); const sub = st.filter((s) => h.sub[s.id]).length; return { total: st.length, sub, rev: st.filter((s) => h.sub[s.id] === 'reviewed').length } }
export const addNotif = (cj: CJ, text: string, to: string, day = 0): Notif[] => [{ id: `N-${cj.seq}-${cj.notifs.length}`, text, to, day, read: false }, ...cj.notifs]

export function counts(cj: CJ, off: number) {
  const live = cj.classes.filter((c) => !c.cancelled)
  const unmarked = live.filter((c) => c.day <= off && c.day >= off - 2 && !cj.marks[c.id]).length
  return {
    teachers: cj.teachers.length, students: cj.students.length, batches: cj.batches.length,
    classesToday: classesOn(cj, off).length, classesWeek: live.filter((c) => c.day >= off && c.day < off + 7).length,
    attendance: attendancePct(cj, off + 1), unmarked,
    hwDue: cj.homework.filter((h) => h.due >= off).length,
    examsUp: cj.exams.filter((e) => e.day >= off || !e.published).length,
    published: cj.exams.filter((e) => e.published).length,
    parents: linkedParents(cj).length,
    reportsSent: cj.reports.filter((r) => r.sent).length, reportsDraft: cj.reports.filter((r) => !r.sent).length,
    feesDue: cj.fees.filter((f) => f.state !== 'paid').reduce((a, f) => a + f.amount, 0),
    feesCount: cj.fees.filter((f) => f.state !== 'paid').length,
    unreadNotifs: cj.notifs.filter((n) => !n.read).length,
  }
}
export const CLASS_LEVELS = ['Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10', 'HSC 1st year', 'HSC 2nd year']
export const endMin = (t: string) => { const m = /-\s*(\d+):(\d+)\s*(AM|PM)/.exec(t); if (!m) return startMin(t) + 60; return ((+m[1] % 12) + (m[3] === 'PM' ? 12 : 0)) * 60 + +m[2] }
export const overlaps = (a: string, b: string) => startMin(a) < endMin(b) && startMin(b) < endMin(a)
