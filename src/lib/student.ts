import { TUTORS } from './data'
import { defaultPerms, initialKJ, type KJ, type Kid, type Tut } from './parent'
import type { Need } from './pmatch'

export const STUDENT = { id: 'ST-5001', name: 'Nabila Chowdhury', short: 'Nabila', guardian: 'Mr. Rafiq Chowdhury' }
export const DEMO_NOW = new Date('2026-10-13T09:00:00')
export const SCHOOLS: Record<string, string[]> = {
  School: ['Dhanmondi Girls Academy', 'Uttara Model High School', 'Mirpur Ideal School', 'Banani Public School'],
  College: ['Uttara Model College', 'Dhaka Central College', 'Mohakhali Commerce College'],
}
export const BOARDS = ['Dhaka Board', 'Chattogram Board', 'Cambridge (O Level)', 'Edexcel']
export const STUDENT_CLASSES = ['Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10', 'HSC 1st year', 'HSC 2nd year']
export const YEARS = ['2026', '2027']
export const GUARDIAN_RELATIONS = ['Mother', 'Father', 'Legal guardian', 'Grandparent', 'Other relative']

export type SForm = {
  fullName: string; dob: string; gender: string; district: string
  schoolType: 'School' | 'College'; school: string; board: string
  idLast4: string; idFile: boolean
  cls: string; year: string; section: string
  guardianName: string; guardianRelation: string; guardianPhone: string
  confirm: boolean
}
export type Consent = 'none' | 'requested' | 'given' | 'declined'
export type SJ = {
  sv: Record<string, boolean>
  form: SForm
  phoneOk: boolean
  consent: Consent
  note: string
  tut: Tut | null
  kj: KJ
  subs: Record<string, Sub>
  read: string[]
}
export type Sub = { file: string; note: string; n: number; reviewed: boolean }
export const initialSJ = (): SJ => ({
  sv: {},
  form: { fullName: '', dob: '', gender: 'Female', district: 'Dhaka', schoolType: 'School', school: '', board: 'Dhaka Board', idLast4: '', idFile: false, cls: 'Class 10', year: '2026', section: '', guardianName: '', guardianRelation: 'Father', guardianPhone: '', confirm: false },
  phoneOk: false,
  consent: 'none',
  note: '',
  tut: null,
  kj: initialKJ(),
  subs: {},
  read: [],
})

export const ageOf = (dob: string): number | null => {
  if (!dob) return null
  const d = new Date(dob); if (Number.isNaN(d.getTime())) return null
  let a = DEMO_NOW.getFullYear() - d.getFullYear()
  if (DEMO_NOW.getMonth() < d.getMonth() || (DEMO_NOW.getMonth() === d.getMonth() && DEMO_NOW.getDate() < d.getDate())) a--
  return a
}
export const isMinor = (f: SForm) => { const a = ageOf(f.dob); return a === null ? true : a < 18 }

export const maskGuardianPhone = (v: string) => (v.replace(/\D/g, '').length >= 10 ? `01${v.replace(/\D/g, '').slice(-9, -8)}•• ••• ${v.replace(/\D/g, '').slice(-3)}` : '01••• •••• •••')

export const SV_STEPS = [
  { slug: 'details', id: 'SV-02', title: 'Your details', hint: 'Name, date of birth, district' },
  { slug: 'school', id: 'SV-03', title: 'School or college', hint: 'Where you study' },
  { slug: 'id', id: 'SV-04', title: 'Student ID (demo)', hint: 'Last 4 digits and a placeholder photo' },
  { slug: 'class', id: 'SV-05', title: 'Class and academic year', hint: 'What you study this year' },
  { slug: 'phone', id: 'SV-06', title: 'Phone verification', hint: 'Confirm with a one-time code' },
  { slug: 'consent', id: 'SV-07', title: 'Guardian consent', hint: 'Needed when you are under 18' },
  { slug: 'review', id: 'SV-08', title: 'Review and submit', hint: 'Check everything, then send for review' },
] as const

export function sDone(sj: SJ, slug: string, signupPhone = false): boolean {
  if (slug === 'phone') return sj.phoneOk || signupPhone
  if (slug === 'consent') return !isMinor(sj.form) ? !!sj.form.dob : sj.consent === 'given'
  return !!sj.sv[slug]
}

export const studentKid = (sj: SJ): Kid => ({
  id: STUDENT.id, name: STUDENT.name, short: STUDENT.short, cls: sj.form.cls || 'Class 10', school: sj.form.school || 'Dhanmondi Girls Academy',
  relation: 'Self', link: 'confirmed', perms: defaultPerms(), tuition: !!sj.tut, paid: [], ...(sj.tut ? { tut: sj.tut } : {}),
} as Kid)

export const SAMPLE_TUT: Tut = {
  subject: 'Mathematics', tutor: 'Tanvir Ahmed Rahman', tutorId: 'tanvir-ahmed-rahman', area: 'Uttara', days: 'Sun, Tue, Thu', time: '5:00–6:00 PM',
  fee: 6000, since: '29 Sep 2026', startDay: -14, weekdays: [0, 2, 4],
}
export const tutorOfId = (id: string) => TUTORS.find((t) => t.id === id)

export const studentNeed = (k: Kid): Need => ({ subject: k.cls.startsWith('HSC') ? 'Physics' : 'Mathematics', cls: k.cls.startsWith('HSC') ? 'HSC' : k.cls, area: 'Uttara', budget: 6000, days: 'Sun, Tue, Thu', time: '5:00–6:00 PM', mode: 'Offline' })
export const SCHOOL_MARKS = [64, 61, 66, 63]
