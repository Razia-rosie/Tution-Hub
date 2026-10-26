import { POSTS, TUTORS, type Post } from './data'

export const ME = TUTORS[0]
export const JOURNEY_POST = 'p-2'
export const AVAIL = { days: ['Sun', 'Tue', 'Wed', 'Thu'], from: 17, to: 19, label: 'Sun, Tue, Wed, Thu · 5:00–7:00 PM' }

export type Interest = 'sent' | 'mutual' | 'declined' | 'withdrawn'
export type TuitionState = 'none' | 'agreement_draft' | 'awaiting' | 'active' | 'completed' | 'cancelled'
export type Mark = 'present' | 'absent' | 'cancelled' | 'rescheduled'
export type HwState = 'pending' | 'submitted' | 'reviewed' | 'revision'
export type PayState = 'due' | 'reminder' | 'marked' | 'confirmed' | 'disputed'
export type Hw = { id: string; title: string; kind: 'Homework' | 'Assignment'; dueDay: number; state: HwState; late: boolean; score?: number; feedback?: string }
export type Pay = { id: string; month: string; amount: number; state: PayState }
export type Msg = { from: 'me' | 'them' | 'system'; text: string }

export type Journey = {
  interests: Record<string, Interest>
  requests: Record<string, 'received' | 'accepted' | 'declined'>
  notInterested: string[]
  saved: string[]
  tuition: TuitionState
  trial: 'none' | 'requested' | 'done'
  agree: { tutor: boolean; parent: boolean; change: string }
  addressRevealed: boolean
  accessLog: string[]
  chat: Record<string, Msg[]>
  marks: Record<string, Mark>
  rescheduled: Record<string, string>
  hw: Hw[]
  testMarks: number[]
  pay: Pay[]
  reviewReceived: boolean
  reviewReply: string
  skill: 'intro' | 'running' | 'passed' | 'failed'
  skillAnswers: Record<string, number>
  interview: 'none' | 'scheduled' | 'passed'
  tv: Record<string, boolean>
  tvForm: { fullName: string; dob: string; nidLast4: string; institution: string; degree: string; year: string; expYears: string; expPlace: string; subjects: string; consent: boolean; studentIdFile: boolean; certFile: boolean; expFile: boolean; nidFile: boolean }
  rejectReasons: string[]
  moreInfo: string
  notifRead: string[]
  availability: 'published' | 'paused' | 'draft' | 'deleted'
  blocked: string[]
  reported: string[]
  paused: boolean
  replies: Record<string, string>
  extra: ClassItem[]
  profile: { bio: string; fee: number; mode: string; note: string }
  disputes: Record<string, string>
  cancelReason: string
}

export const initialJourney = (): Journey => ({
  interests: {}, requests: { 'r-1': 'received', 'r-2': 'received' }, notInterested: [], saved: [],
  tuition: 'none', trial: 'none', agree: { tutor: false, parent: false, change: '' }, addressRevealed: false, accessLog: [],
  chat: {},
  marks: {}, rescheduled: {}, hw: [], testMarks: [], pay: [], reviewReceived: false, reviewReply: '',
  skill: 'intro', skillAnswers: {}, interview: 'none', tv: {},
  tvForm: { fullName: '', dob: '', nidLast4: '', institution: '', degree: '', year: '', expYears: '', expPlace: '', subjects: '', consent: false, studentIdFile: false, certFile: false, expFile: false, nidFile: false },
  rejectReasons: ['The NID photo is blurred, so the name cannot be read.', 'The certificate year does not match the education year entered.'],
  moreInfo: 'Please add the name of the institution where you taught, as printed on your experience certificate.',
  notifRead: [], availability: 'published',
  blocked: [], reported: [], paused: false, replies: {}, extra: [], profile: { bio: ME.bio, fee: ME.fee, mode: ME.mode, note: 'Sun, Tue, Wed, Thu evenings. Home tuition within 7 km of Uttara, or online.' }, disputes: {}, cancelReason: '',
})

export const REQUESTS = [
  { id: 'r-1', from: 'Mrs. Farzana Haque', area: 'Mirpur', subject: 'Mathematics', cls: 'Class 10', budget: 4500, note: 'Looking for a patient tutor before the SSC test exam.' },
  { id: 'r-2', from: 'Mr. Nasir Uddin', area: 'Uttara', subject: 'Physics', cls: 'Class 9', budget: 5000, note: 'Weekend or evening batch, offline preferred.' },
]

// ---- match scoring (demo weights, transparent rules) ----
export type Factor = { key: string; label: string; weight: number; score: number; level: 'full' | 'partial' | 'miss'; why: string }
export type Match = { post: Post; total: number; factors: Factor[]; excluded?: string }
const clsNum = (c: string) => (c === 'HSC' ? 12 : c === 'SSC' ? 10 : Number(c.replace(/\D/g, '')))
const level = (s: number, w: number): Factor['level'] => (s >= w ? 'full' : s > 0 ? 'partial' : 'miss')
const PREFS: Record<string, number> = { 'p-1': 2, 'p-2': 4, 'p-10': 1 }

export function matchPost(p: Post): Match {
  if (!ME.subjects.includes(p.subject)) return { post: p, total: 0, factors: [], excluded: `Subject mismatch: you teach ${ME.subjects.join(' and ')}, this needs ${p.subject}.` }
  const f: Factor[] = []
  const add = (key: string, label: string, weight: number, score: number, why: string) => f.push({ key, label, weight, score, level: level(score, weight), why })
  add('subject', 'Subject', 25, 25, `${p.subject} is one of your verified subjects.`)
  const c = clsNum(p.cls); const inRange = c >= 9 && c <= 12; const near = c === 8
  add('class', 'Class', 15, inRange ? 15 : near ? 8 : 0, inRange ? `${p.cls} is inside your Classes 9–12 range.` : near ? `${p.cls} is one class below your range.` : `${p.cls} is outside your Classes 9–12 range.`)
  const days = p.days.split(', ').map((d) => d.slice(0, 3)); const hit = days.filter((d) => AVAIL.days.includes(d)).length
  const startH = Number(p.time.split(':')[0]) + (/PM/.test(p.time.split('–')[0]) || p.time.startsWith('7') ? 12 : 0)
  const endMatch = p.time.split('–')[1]; const endH = Number(endMatch.split(':')[0]) + 12
  const timeFit = startH >= AVAIL.from && endH <= AVAIL.to ? 1 : startH < AVAIL.to && endH > AVAIL.from ? 0.8 : 0.3
  const sch = Math.round(15 * (hit / days.length) * timeFit)
  add('schedule', 'Schedule', 15, sch, `${hit} of ${days.length} class days fit your availability${timeFit < 1 ? '; the time only partly overlaps' : ''}.`)
  const km = p.km === 'Online' ? 0 : parseFloat(p.km)
  const loc = p.mode === 'Online' ? 15 : km <= 3 ? 15 : km <= 5 ? 13 : km <= 7 ? 11 : 8
  add('location', 'Location / travel', 15, loc, p.mode === 'Online' ? 'Online, no travel needed.' : `${p.area}, about ${p.km} and ${p.travel} away.`)
  const ratio = p.budget / ME.fee
  add('budget', 'Budget', 15, ratio >= 1 ? 15 : Math.round(15 * Math.max(0, ratio)), ratio >= 1 ? `৳${p.budget.toLocaleString('en-IN')} meets your ৳${ME.fee.toLocaleString('en-IN')} fee.` : `৳${p.budget.toLocaleString('en-IN')} is ${Math.round((1 - ratio) * 100)}% below your usual fee.`)
  add('verification', 'Verification', 5, 5, 'Your identity, education and experience are verified.')
  add('experience', 'Experience', 5, 5, `${ME.years} years of teaching experience.`)
  const pr = PREFS[p.id] ?? 4
  add('prefs', 'Preferences', 5, pr, pr >= 5 ? 'All stated preferences are met.' : 'Some requirements, like gender or materials, are only partly met.')
  return { post: p, total: f.reduce((a, x) => a + x.score, 0), factors: f }
}
export const MATCHES = POSTS.map(matchPost)

// ---- class schedule generated when tuition becomes active ----
export type ClassItem = { id: string; day: number; label: string; time: string }
const D0 = new Date('2026-10-15T00:00:00')
export const CLASS_DAYS = [0, 3, 5, 7, 10, 12, 14, 17, 19, 21, 24, 26]
export const CLASSES_ACTIVE: ClassItem[] = CLASS_DAYS.map((d, i) => {
  const dt = new Date(D0.getTime() + d * 86400000)
  return { id: `c-${i + 1}`, day: Math.round((dt.getTime() - new Date('2026-10-13T00:00:00').getTime()) / 86400000), label: dt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }), time: '6:30–7:30 PM' }
})
export const allClasses = (j: Journey): ClassItem[] => [...CLASSES_ACTIVE, ...j.extra].sort((a, b) => a.day - b.day)
export const dayLabel = (offset: number) => new Date(new Date('2026-10-13T00:00:00').getTime() + offset * 86400000).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

export const AGREEMENT = {
  tutor: ME.name, student: 'Ayaan Rahman', parent: 'Mrs. Shabnam Rahman', subject: 'Physics', cls: 'HSC', days: 'Sun, Tue, Thu', time: '6:30–7:30 PM',
  salary: 7000, start: '15 Oct 2026', type: 'Offline (home tuition)', location: 'Uttara, exact address hidden until you confirm', terms: 'Paid monthly, tracked on TuitionHub. TuitionHub does not process payments.',
}

export const activeSeed = (): Pick<Journey, 'hw' | 'testMarks' | 'pay'> => ({
  hw: [
    { id: 'h-1', title: 'Newton’s laws: 10 numerical problems', kind: 'Homework', dueDay: 4, state: 'pending', late: false },
    { id: 'h-2', title: 'Chapter 3 worksheet, vectors', kind: 'Homework', dueDay: 9, state: 'pending', late: false },
    { id: 'a-1', title: 'Model test 1: Mechanics (45 marks)', kind: 'Assignment', dueDay: 12, state: 'pending', late: false },
  ],
  testMarks: [62, 68, 71],
  pay: [{ id: 'pay-1', month: 'October 2026', amount: 7000, state: 'due' }],
})

export const REVIEW_NEW = { by: 'Mrs. Shabnam Rahman (guardian)', stars: 5, subject: 'Physics, HSC', duration: '2 months', text: 'Ayaan’s model-test marks rose from 62 to 78. Sir is punctual, explains from first principles, and sends a clear weekly note.' }
export const OLD_REVIEWS = [
  { id: 'rv-1', by: 'Mr. Kamal Hossain (guardian)', stars: 5, subject: 'Mathematics, Class 10', duration: '8 months', text: 'Never missed a class. Test scores improved steadily.', reply: 'Thank you. Rafi worked very hard.' },
  { id: 'rv-2', by: 'Sadia Islam (student)', stars: 5, subject: 'Physics, HSC', duration: '1 year', text: 'Complex numericals finally make sense.', reply: '' },
  { id: 'rv-3', by: 'Mrs. Rehana Begum (guardian)', stars: 4, subject: 'Mathematics, Class 9', duration: '5 months', text: 'Good teacher. A little more homework feedback would help.', reply: '' },
]

export function stats(j: Journey, dayOffset: number) {
  const active = j.tuition === 'active' || j.tuition === 'completed'
  const held = allClasses(j).filter((c) => c.day <= dayOffset || j.marks[c.id])
  const marked = held.filter((c) => j.marks[c.id])
  const present = marked.filter((c) => j.marks[c.id] === 'present').length
  const counted = marked.filter((c) => j.marks[c.id] !== 'cancelled' && j.marks[c.id] !== 'rescheduled').length
  const unmarked = held.length - marked.length
  const upcoming = active && j.tuition === 'active' ? allClasses(j).filter((c) => c.day > dayOffset && !j.marks[c.id]).length : 0
  const earned = j.pay.filter((p) => p.state === 'confirmed').reduce((a, p) => a + p.amount, 0)
  return { active, present, counted, attendancePct: counted ? Math.round((present / counted) * 100) : active ? 0 : 0, unmarked, upcoming, earned, requests: Object.values(j.requests).filter((r) => r === 'received').length + Object.values(j.interests).filter((r) => r === 'mutual').length * 0 }
}

export const SYS_MSG: Msg = { from: 'system', text: 'Mutual interest confirmed. Phone and email stay masked until the agreement is confirmed.' }
export const AREA_XY: Record<string, [number, number]> = { Uttara: [330, 40], Bashundhara: [300, 95], Badda: [270, 130], Gulshan: [235, 105], Banani: [210, 85], Mohakhali: [195, 115], Mirpur: [95, 85], Mohammadpur: [100, 160], Dhanmondi: [150, 175], Rampura: [260, 175] }
export const GUARDIAN: Record<string, string> = { 'p-1': 'Mrs. Farzana H.', 'p-2': 'Mrs. Shabnam R.', 'p-3': 'Mr. Imtiaz K.', 'p-4': 'Mrs. Lubna A.', 'p-5': 'Mr. Habibur R.', 'p-6': 'Mrs. Nargis S.', 'p-7': 'Mr. Tariq M.', 'p-8': 'Mrs. Ayesha B.', 'p-9': 'Mr. Jahid H.', 'p-10': 'Mrs. Mitu D.' }
export const REPLIES = ['Thank you for your interest. Ayaan studies in HSC first year. Can we start this week?', 'Sunday, Tuesday and Thursday at 6:30 PM works for us.', 'We would like a short trial class first, if that is fine.']
