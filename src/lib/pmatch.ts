import { TUTORS, type Post, type Tutor } from './data'
import { AREA_XY, AVAIL, type Factor, type Match } from './journey'
import type { Kid, KPost, PostForm } from './parent'

export const DAYS = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri']
export const WEEKDAY: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
export const TIMES = ['4:00–5:00 PM', '5:00–6:00 PM', '6:30–7:30 PM', '7:00–8:00 PM']
export const MEDIUMS = ['Bangla Medium', 'English Medium', 'English Version']
export const SUBJ = ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'ICT', 'English', 'Bangla', 'Accounting']
export const CLS = ['Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10', 'SSC', 'HSC']
export const HOME_AREAS = ['Uttara', 'Dhanmondi', 'Mirpur', 'Mohakhali', 'Banani', 'Gulshan', 'Bashundhara', 'Mohammadpur', 'Badda', 'Rampura']
export const money = (n: number) => `৳${n.toLocaleString('en-IN')}`

const clsNum = (c: string) => (c === 'HSC' ? 12 : c === 'SSC' ? 10 : Number(c.replace(/\D/g, '')))
const hash = (s: string) => [...s].reduce((a, c) => a + c.charCodeAt(0), 0)
const level = (s: number, w: number): Factor['level'] => (s >= w ? 'full' : s > 0 ? 'partial' : 'miss')

export type Need = { subject: string; cls: string; area: string; budget: number; days: string; time: string; mode: 'Offline' | 'Online' }
export const defaultNeed = (k: Kid): Need => k.cls.startsWith('HSC')
  ? { subject: 'Physics', cls: 'HSC', area: 'Uttara', budget: 7000, days: 'Sun, Tue, Thu', time: '6:30–7:30 PM', mode: 'Offline' }
  : { subject: 'Mathematics', cls: 'Class 8', area: 'Uttara', budget: 4500, days: 'Sat, Mon, Wed', time: '5:00–6:00 PM', mode: 'Offline' }
export const needOf = (p: KPost): Need => ({ subject: p.subject, cls: p.cls, area: p.area, budget: p.budget, days: p.days, time: p.time, mode: p.mode })

export function availOf(t: Tutor) {
  if (t.id === 'tanvir-ahmed-rahman') return { days: AVAIL.days, from: AVAIL.from, to: AVAIL.to }
  const n = hash(t.id); const start = n % 7
  const days = [0, 1, 2, 3, 4].filter((i) => i !== (n % 5)).slice(0, 4).map((i) => DAYS[(start + i) % 7])
  return { days, from: 16 + (n % 2), to: 20 + (n % 2) }
}
const range = (t: Tutor): [number, number] => {
  if (t.classes === 'HSC') return [11, 12]
  const m = t.classes.match(/(\d+)–(\d+)/)
  return m ? [Number(m[1]), Number(m[2])] : [6, 10]
}
const hr = (s: string) => { const h = Number(s.split(':')[0]); return h < 8 ? h + 12 : h }

export function matchTutor(n: Need, t: Tutor): Match {
  const post = { id: 'need', subject: n.subject, cls: n.cls, medium: '', area: n.area, days: n.days, time: n.time, budget: n.budget, mode: n.mode, posted: '', travel: '', km: '', requirements: '', by: '' } as Post
  if (!t.subjects.includes(n.subject)) return { post, total: 0, factors: [], excluded: `Subject mismatch: ${t.short} teaches ${t.subjects.join(' and ')}, not ${n.subject}.` }
  const f: Factor[] = []
  const add = (key: string, label: string, weight: number, score: number, why: string) => f.push({ key, label, weight, score, level: level(score, weight), why })
  add('subject', 'Subject', 25, 25, `${n.subject} is one of ${t.short}'s verified subjects.`)
  const c = clsNum(n.cls); const [lo, hi] = range(t); const inR = c >= lo && c <= hi; const near = c === lo - 1 || c === hi + 1
  add('class', 'Class', 15, inR ? 15 : near ? 8 : 0, inR ? `${n.cls} is inside ${t.classes}.` : near ? `${n.cls} is one class outside ${t.classes}.` : `${n.cls} is outside ${t.classes}.`)
  const av = availOf(t); const days = n.days.split(', ').map((d) => d.slice(0, 3)); const hit = days.filter((d) => av.days.includes(d)).length
  const [a, b] = n.time.split('–'); const sH = hr(a); const eH = hr(b.replace(/ ?[AP]M/, ''))
  const fit = sH >= av.from && eH <= av.to ? 1 : sH < av.to && eH > av.from ? 0.8 : 0.3
  add('schedule', 'Schedule', 15, Math.round(15 * (hit / days.length) * fit), `${hit} of ${days.length} class days fit the tutor's weekly availability${fit < 1 ? '; the time only partly overlaps' : ''}.`)
  const [x1, y1] = AREA_XY[t.area] ?? [0, 0]; const [x2, y2] = AREA_XY[n.area] ?? [0, 0]; const d = Math.hypot(x1 - x2, y1 - y2)
  const loc = n.mode === 'Online' ? (t.mode === 'Offline' ? 0 : 15) : t.mode === 'Online' ? 4 : d < 5 ? 15 : d <= 70 ? 13 : d <= 140 ? 10 : 6
  add('location', 'Location / travel', 15, loc, n.mode === 'Online' ? (t.mode === 'Offline' ? 'This tutor teaches offline only.' : 'Online, no travel needed.') : d < 5 ? `Both in ${t.area}, a short trip.` : `${t.short} is based in ${t.area}; your area is ${n.area} (areas only, no addresses).`)
  const ratio = n.budget / t.fee
  add('budget', 'Budget', 15, ratio >= 1 ? 15 : Math.round(15 * Math.max(0, ratio)), ratio >= 1 ? `${money(n.budget)} covers the ${money(t.fee)} monthly fee.` : `${money(n.budget)} is ${Math.round((1 - ratio) * 100)}% below the ${money(t.fee)} fee.`)
  const vs = Math.min(5, t.badges.length + 1)
  add('verification', 'Verification', 5, vs, `${t.badges.length} of 4 verification badges earned.`)
  const ex = t.years >= 5 ? 5 : t.years >= 3 ? 4 : 2
  add('experience', 'Experience', 5, ex, `${t.years} years of teaching experience.`)
  const pr = t.rating >= 4.8 ? 5 : t.rating >= 4.6 ? 4 : 3
  add('prefs', 'Preferences', 5, pr, `Rated ${t.rating} by ${t.reviews} reviewers; teaching mode ${t.mode}.`)
  return { post, total: f.reduce((s, x) => s + x.score, 0), factors: f }
}
export const rankTutors = (n: Need) => TUTORS.map((t) => ({ t, m: matchTutor(n, t) })).filter((x) => !x.m.excluded).sort((a, b) => b.m.total - a.m.total)

const TRUST_W: [string, number][] = [['Verification', 20], ['Reviews', 20], ['Attendance', 20], ['Qualifications', 15], ['Experience', 10], ['Performance', 10], ['Response', 5]]
export function trustParts(t: Tutor): [string, number, number][] {
  const sc = TRUST_W.map(([, w]) => Math.floor((w * t.trust) / 100))
  let rest = t.trust - sc.reduce((a, b) => a + b, 0)
  for (let i = 0; rest > 0; i = (i + 1) % sc.length, rest--) sc[i] += sc[i] < TRUST_W[i][1] ? 1 : 0
  return TRUST_W.map(([l, w], i) => [l, w, sc[i]])
}
export const awardsOf = (t: Tutor) => [
  ...(t.rank ? [t.rank.split(' · ')[0] + ' on the leaderboard'] : []),
  ...(t.rating >= 4.8 ? ['Top rated 4.8+'] : []),
  ...(t.reviews >= 20 ? ['20+ verified reviews'] : []),
  ...(t.years >= 6 ? ['6+ years teaching'] : []),
  ...(t.badges.includes('skill') ? ['Skill test passed'] : []),
]
export const maskedPhone = (t: Tutor) => `01${(hash(t.id) % 6) + 3}•• ••• •${String(hash(t.name) % 100).padStart(2, '0')}`
export const maskedEmail = (t: Tutor) => `${t.name[0].toLowerCase()}•••••@${['gmail', 'outlook', 'yahoo'][hash(t.id) % 3]}.com`

export const formDefault = (n: Need, area: string): PostForm => ({ subject: n.subject, cls: n.cls, medium: 'Bangla Medium', area, days: n.days.split(', '), time: n.time, budget: String(n.budget), mode: n.mode, requirements: '' })
export const postToForm = (p: KPost): PostForm => ({ subject: p.subject, cls: p.cls, medium: p.medium, area: p.area, days: p.days.split(', '), time: p.time, budget: String(p.budget), mode: p.mode, requirements: p.requirements })
export function validatePost(f: PostForm): Partial<Record<keyof PostForm, string>> {
  const e: Partial<Record<keyof PostForm, string>> = {}
  if (!f.subject) e.subject = 'Choose a subject.'
  if (!f.cls) e.cls = 'Choose a class.'
  if (!f.area) e.area = 'Choose an area. Only the area is shown, never your address.'
  if (f.days.length < 2) e.days = 'Pick at least two class days.'
  if (f.days.length > 6) e.days = 'Pick six days or fewer.'
  const b = Number(f.budget.replace(/,/g, ''))
  if (!f.budget.trim()) e.budget = 'Enter a monthly budget in ৳.'
  else if (!Number.isFinite(b) || b < 1000 || b > 30000) e.budget = 'Enter a budget between ৳1,000 and ৳30,000.'
  if (f.requirements.length > 280) e.requirements = 'Keep requirements under 280 characters.'
  if (/\d{8,}|@/.test(f.requirements)) e.requirements = 'Remove phone numbers or emails. Contact stays masked until agreement.'
  return e
}
export const sortDays = (d: string[]) => [...d].sort((a, b) => DAYS.indexOf(a) - DAYS.indexOf(b)).join(', ')
export const toPost = (f: PostForm, status: KPost['status'] = 'published'): KPost => ({ subject: f.subject, cls: f.cls, medium: f.medium, area: f.area, days: sortDays(f.days), time: f.time, budget: Number(f.budget.replace(/,/g, '')), mode: f.mode, requirements: f.requirements.trim(), status, posted: '13 Oct 2026' })

export const PARENT_NAME = 'Mrs. Farzana Islam'
export const TUTOR_REPLIES = ['Thank you for reaching out. I can start this week and would like to learn about the syllabus covered so far.', 'Sunday, Tuesday and Thursday evenings work for me. Shall we confirm a short trial class first?', 'Understood. I will send a one-page plan after the trial class.']
