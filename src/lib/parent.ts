import type { Msg } from './journey'
export type Tut = { subject: string; tutor: string; tutorId: string; area: string; days: string; time: string; fee: number; since: string; startDay: number; weekdays: number[] }
export type Perm = { attendance: boolean; progress: boolean; payments: boolean; chat: boolean }
export type Kid = {
  id: string; name: string; short: string; cls: string; school: string
  relation: string; link: 'requested' | 'confirmed'; perms: Perm
  tuition: boolean; paid: string[]; tut?: Tut
}
export type Dir = { id: string; name: string; short: string; cls: string; school: string; year: string; family: 'islam' | 'hasan'; tuition: boolean }

export const DIRECTORY: Dir[] = [
  { id: 'ST-2041', name: 'Ayaan Islam', short: 'Ayaan', cls: 'HSC 1st year', school: 'Uttara Model College', year: '2008', family: 'islam', tuition: false },
  { id: 'ST-2042', name: 'Mim Islam', short: 'Mim', cls: 'Class 8', school: 'Uttara Girls High School', year: '2013', family: 'islam', tuition: true },
  { id: 'ST-3099', name: 'Rafi Hasan', short: 'Rafi', cls: 'Class 9', school: 'Mirpur Ideal School', year: '2011', family: 'hasan', tuition: false },
]
export const RELATIONS = ['Mother', 'Father', 'Legal guardian', 'Grandparent', 'Other relative']
export const NOT_LINKED_ID = 'ST-3099'
export const defaultPerms = (): Perm => ({ attendance: true, progress: true, payments: true, chat: true })

export type PForm = { fullName: string; dob: string; relation: string; district: string; nidLast4: string; nidFile: boolean; selfie: boolean; guardFile: boolean; consent: boolean; reason: string }
export type PostForm = { subject: string; cls: string; medium: string; area: string; days: string[]; time: string; budget: string; mode: 'Offline' | 'Online'; requirements: string }
export type KPost = { subject: string; cls: string; medium: string; area: string; days: string; time: string; budget: number; mode: 'Offline' | 'Online'; requirements: string; status: 'published' | 'paused' | 'filled'; posted: string }
export type Trial = 'requested' | 'accepted' | 'done'
export type KJ = {
  draft: PostForm | null
  post: KPost | null
  sent: Record<string, 'sent' | 'mutual'>
  incoming: Record<string, 'received' | 'accepted' | 'declined'>
  chat: Record<string, Msg[]>
  trial: Record<string, Trial>
  tutorId: string
  stage: 'none' | 'agreement' | 'active' | 'completed'
  agreeParent: boolean
  agreeTutor: boolean
  compare: string[]
  resched: Record<string, 'requested' | 'confirmed'>
  review: { stars: number; text: string } | null
  reportShared: boolean
  guardianOk: boolean
}
export const initialKJ = (): KJ => ({ draft: null, post: null, sent: {}, incoming: {}, chat: {}, trial: {}, tutorId: '', stage: 'none', agreeParent: false, agreeTutor: false, compare: [], resched: {}, review: null, reportShared: false, guardianOk: false })
export const kjOf = (pj: { kj: Record<string, KJ> }, id: string): KJ => ({ ...initialKJ(), ...(pj.kj[id] ?? {}) })

export type PJ = {
  pv: Record<string, boolean>
  form: PForm
  phoneOk: boolean
  kids: Kid[]
  log: string[]
  note: string
  submittedOnce: boolean
  kj: Record<string, KJ>
}
export const initialPJ = (): PJ => ({
  pv: {},
  form: { fullName: '', dob: '', relation: 'Mother', district: 'Dhaka', nidLast4: '', nidFile: false, selfie: false, guardFile: false, consent: false, reason: '' },
  phoneOk: false,
  kids: [],
  log: [],
  note: '',
  submittedOnce: false,
  kj: {},
})

export const confirmedKids = (pj: PJ) => pj.kids.filter((k) => k.link === 'confirmed')
export const pickKid = (pj: PJ, short: string) => { const c = confirmedKids(pj); return c.find((k) => k.short === short) ?? c[0] }

export type LinkResult = { ok: true; dir: Dir } | { ok: false; error: string }
export function lookup(idRaw: string, yearRaw: string, existing: Kid[]): LinkResult {
  const id = idRaw.trim().toUpperCase()
  if (!/^ST-\d{4}$/.test(id)) return { ok: false, error: 'Enter the student ID in the form ST-1234.' }
  if (!/^(19|20)\d\d$/.test(yearRaw)) return { ok: false, error: "Enter the student's birth year, four digits." }
  if (existing.some((k) => k.id === id)) return { ok: false, error: 'This student is already on your list.' }
  const d = DIRECTORY.find((x) => x.id === id)
  if (!d || d.year !== yearRaw) return { ok: false, error: 'We could not match these details. Check the ID and birth year with your child.' }
  if (d.family !== 'islam') return { ok: false, error: 'This student is registered with a different guardian. Ask them to invite you, or contact support.' }
  return { ok: true, dir: d }
}
export const kidFrom = (d: Dir, relation: string, link: Kid['link']): Kid => ({ id: d.id, name: d.name, short: d.short, cls: d.cls, school: d.school, relation, link, perms: defaultPerms(), tuition: d.tuition, paid: d.tuition ? ['2026-09'] : [] })

/* ---------- child-scoped demo tuition (seeded for a child who already has one) ---------- */
export const TUITION = { subject: 'English', tutor: 'Ms. Rumana Akter', area: 'Uttara Sector 7', days: 'Sun, Tue', time: '5:00–6:00 PM', fee: 3000, since: '1 Sep 2026', tutorBadges: ['identity', 'education'] as const }
const MONTH_LABEL: Record<string, string> = { '2026-09': 'September 2026', '2026-10': 'October 2026', '2026-11': 'November 2026' }
export const monthLabel = (m: string) => MONTH_LABEL[m] ?? m

export type Cls = { id: string; day: number; mark: 'present' | 'absent' | 'late' | 'upcoming' | 'today' }
const markFor = (day: number): 'present' | 'absent' | 'late' => { const r = (((day + 60) * 37) % 10); return r === 0 ? 'absent' : r === 1 ? 'late' : 'present' }
export const tutOf = (k: Kid): Tut => k.tut ?? { subject: TUITION.subject, tutor: TUITION.tutor, tutorId: 'rumana', area: TUITION.area, days: TUITION.days, time: TUITION.time, fee: TUITION.fee, since: TUITION.since, startDay: -42, weekdays: [0, 2] }
export function classesFor(k: Kid, off: number): Cls[] {
  if (!k.tuition) return []
  if (k.tut) {
    const out: Cls[] = []; let i = 0
    for (let d = k.tut.startDay; d <= Math.min(Math.max(off, k.tut.startDay) + 21, k.tut.startDay + 60); d++) {
      const wd = new Date(new Date('2026-10-13T09:00:00').getTime() + d * 86400000).getDay()
      if (!k.tut.weekdays.includes(wd)) continue
      out.push({ id: `${k.id}-${d}`, day: d, mark: d < off ? (i % 4 === 3 ? 'absent' : i % 5 === 4 ? 'late' : 'present') : d === off ? 'today' : 'upcoming' }); i++
    }
    return out
  }
  const out: Cls[] = []
  for (let d = -42; d <= off + 21; d++) {
    const wd = new Date(new Date('2026-10-13T09:00:00').getTime() + d * 86400000).getDay()
    if (wd !== 0 && wd !== 2) continue
    out.push({ id: `${k.id}-${d}`, day: d, mark: d < off ? markFor(d) : d === off ? 'today' : 'upcoming' })
  }
  return out
}
export const dateOf = (day: number) => new Date(new Date('2026-10-13T09:00:00').getTime() + day * 86400000)
export const fmt = (d: Date, o: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }) => d.toLocaleDateString('en-GB', o)

export type Hw = { id: string; title: string; due: number; kind: 'Homework' | 'Assignment'; state: 'assigned' | 'submitted' | 'reviewed'; score?: string; feedback?: string }
export function hwFor(k: Kid, off: number): Hw[] {
  if (!k.tuition) return []
  if (k.tut) {
    const st = k.tut.startDay; const sub = k.tut.subject
    const b: Omit<Hw, 'state'>[] = [
      { id: 'h1', title: `${sub}: chapter 1 practice set`, due: st + 3, kind: 'Homework' },
      { id: 'h2', title: `${sub}: model test 1 preparation`, due: st + 8, kind: 'Assignment' },
      { id: 'h3', title: `${sub}: chapter 2 numericals and notes`, due: st + 13, kind: 'Homework' },
      { id: 'h4', title: `${sub}: mixed revision sheet`, due: st + 20, kind: 'Homework' },
    ]
    return b.map((x) => ({ ...x, state: x.due < off - 2 ? 'reviewed' : x.due < off ? 'submitted' : 'assigned', ...(x.due < off - 2 ? { score: '8/10', feedback: 'Good working. Show the units in every step.' } : {}) }))
  }
  const base: Omit<Hw, 'state'>[] = [
    { id: 'h1', title: 'Reading comprehension: Passage 4', due: -4, kind: 'Homework' },
    { id: 'h2', title: 'Short essay: My village in monsoon', due: 1, kind: 'Assignment' },
    { id: 'h3', title: 'Grammar worksheet: Tenses', due: 4, kind: 'Homework' },
    { id: 'h4', title: 'Unit test revision sheet', due: 9, kind: 'Homework' },
  ]
  return base.map((b) => ({ ...b, state: b.due < off - 2 ? 'reviewed' : b.due < off ? 'submitted' : 'assigned', ...(b.due < off - 2 ? { score: '8/10', feedback: 'Good effort. Watch your tense changes in the second paragraph.' } : {}) }))
}
export const TEST_MARKS = [62, 68, 71, 75]
export const testMarksFor = (k: Kid, off: number): number[] => k.tut ? [58, 64, 70, 74, 78].slice(0, Math.min(5, Math.max(0, Math.floor((off - k.tut.startDay) / 10)))) : TEST_MARKS
export const dueDay = 2
export function payState(k: Kid, off: number): { month: string; state: 'paid' | 'due' | 'overdue' | 'upcoming'; days: number } {
  const month = '2026-10'
  if (k.paid.includes(month)) return { month, state: 'paid', days: 0 }
  const days = (k.tut ? k.tut.startDay + 30 : dueDay) - off
  return { month, state: days < 0 ? 'overdue' : days <= 3 ? 'due' : 'upcoming', days }
}
export const attendanceStats = (k: Kid, off: number) => {
  const done = classesFor(k, off).filter((c) => c.day < off)
  const last = done.slice(-8)
  const present = last.filter((c) => c.mark === 'present' || c.mark === 'late').length
  return { last, present, total: last.length, pct: last.length ? Math.round((present / last.length) * 100) : 0, absent: last.filter((c) => c.mark === 'absent').length }
}
