import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { Role } from './nav'
import { setCreatedAccount } from './account'
import { initialPJ, initialKJ, DIRECTORY, kidFrom, kjOf, type KJ, type PJ } from './parent'
import { initialSJ, STUDENT, type SJ } from './student'
import { initialCJ, initialCV, type CJ, type CV } from './coaching'
import { initialJourney, activeSeed, allClasses, SYS_MSG, REPLIES, type Journey } from './journey'

export type VerifyState = 'not_started' | 'draft' | 'pending' | 'under_review' | 'verified' | 'rejected' | 'action_required'
export type Toast = { id: number; text: string; tone: 'info' | 'success' | 'warning' | 'danger' }

export type Signup = { role: Role | null; name: string; email: string; phone: string; phoneVerified: boolean; emailVerified: boolean }
const emptySignup: Signup = { role: null, name: '', email: '', phone: '', phoneVerified: false, emailVerified: false }

export const STATE_VERSION = 11

type State = {
  version: number
  signup: Signup
  role: Role
  signedIn: boolean
  accessToken: string | null
  refreshToken: string | null
  verification: Record<Role, VerifyState>
  dayOffset: number
  child: string
  toasts: Toast[]
  drawerOpen: boolean
  journey: Journey
  pj: PJ
  sj: SJ
  cj: CJ
  cv: CV
}

const initial = (): State => ({
  version: STATE_VERSION,
  signup: emptySignup,
  role: 'tutor',
  signedIn: false,
  accessToken: null,
  refreshToken: null,
  verification: { tutor: 'not_started', student: 'not_started', parent: 'not_started', coaching: 'not_started', admin: 'verified' },
  dayOffset: 0,
  child: 'Ayaan',
  toasts: [],
  drawerOpen: false,
  journey: initialJourney(),
  pj: initialPJ(),
  sj: initialSJ(),
  cj: initialCJ(),
  cv: initialCV(),
})

const pickKnown = <T extends object>(base: T, saved: unknown): T => {
  if (!saved || typeof saved !== 'object') return base
  const out = { ...base }
  for (const k of Object.keys(base) as (keyof T)[]) {
    const v = (saved as Partial<T>)[k]
    if (v !== undefined && v !== null && typeof v === typeof base[k] && Array.isArray(v) === Array.isArray(base[k])) out[k] = v as T[keyof T]
  }
  return out
}

/** Merge any older, partial or malformed state onto the current defaults. */
export function hydrate(saved?: unknown): State {
  const d = initial()
  if (!saved || typeof saved !== 'object') return d
  const sv = saved as Partial<State>
  const merged = pickKnown(d, sv)
  merged.signup = pickKnown(d.signup, sv.signup)
  merged.verification = pickKnown(d.verification, sv.verification)
  const j0 = d.journey; const jv = (sv.journey ?? {}) as Partial<Journey>
  const j = pickKnown(j0, jv)
  j.agree = pickKnown(j0.agree, jv.agree); j.profile = pickKnown(j0.profile, jv.profile); j.tvForm = pickKnown(j0.tvForm, jv.tvForm)
  j.requests = { ...j0.requests, ...(typeof jv.requests === 'object' && jv.requests ? jv.requests : {}) }
  merged.journey = j
  const p0 = d.pj; const pv = (sv.pj ?? {}) as Partial<PJ>
  const pj = pickKnown(p0, pv)
  pj.form = pickKnown(p0.form, pv.form); pj.pv = { ...p0.pv, ...(typeof pv.pv === 'object' && pv.pv ? pv.pv : {}) }
  pj.kj = Object.fromEntries(Object.entries(typeof pv.kj === 'object' && pv.kj ? pv.kj : {}).map(([k]) => [k, kjOf({ kj: pv.kj as Record<string, KJ> }, k)]))
  merged.pj = pj
  const sv0 = d.sj; const ssv = (sv.sj ?? {}) as Partial<SJ>
  const sj = pickKnown(sv0, ssv)
  sj.form = pickKnown(sv0.form, ssv.form); sj.sv = { ...sv0.sv, ...(typeof ssv.sv === 'object' && ssv.sv ? ssv.sv : {}) }
  sj.tut = ssv.tut && typeof ssv.tut === 'object' ? ssv.tut : null
  sj.kj = { ...initialKJ(), ...(ssv.kj && typeof ssv.kj === 'object' ? ssv.kj : {}) }
  sj.subs = ssv.subs && typeof ssv.subs === 'object' ? ssv.subs : {}
  sj.read = Array.isArray(ssv.read) ? ssv.read : []
  merged.sj = sj
  const c0 = d.cj; const cjv = (sv.cj ?? {}) as Partial<CJ>
  const cj = pickKnown(c0, cjv)
  cj.marks = cjv.marks && typeof cjv.marks === 'object' ? cjv.marks : c0.marks
  merged.cj = cj
  const v0 = d.cv; const cvv = (sv.cv ?? {}) as Partial<CV>
  const cv = pickKnown(v0, cvv)
  cv.form = pickKnown(v0.form, cvv.form); cv.cv = { ...v0.cv, ...(typeof cvv.cv === 'object' && cvv.cv ? cvv.cv : {}) }
  merged.cv = cv
  merged.toasts = Array.isArray(sv.toasts) ? sv.toasts : d.toasts
  merged.version = STATE_VERSION
  return merged
}

type Store = State & {
  setRole: (r: Role) => void
  patchSignup: (p: Partial<Signup>) => void
  signIn: (r?: Role) => void
  setSession: (accessToken: string, refreshToken: string) => void
  signOut: () => void
  setVerification: (r: Role, v: VerifyState) => void
  advanceVerification: () => void
  fastForward: (days: number) => void
  setChild: (c: string) => void
  setPJ: (fn: (p: PJ) => Partial<PJ>) => void
  setKJ: (id: string, fn: (k: KJ) => Partial<KJ>) => void
  setSJ: (fn: (p: SJ) => Partial<SJ>) => void
  setCJ: (fn: (p: CJ) => Partial<CJ>) => void
  setCV: (fn: (p: CV) => Partial<CV>) => void
  seedChildren: () => void
  toast: (text: string, tone?: Toast['tone']) => void
  dismissToast: (id: number) => void
  setDrawer: (o: boolean) => void
  setJourney: (fn: (j: Journey) => Partial<Journey>) => void
  startTuition: () => void
  completeTuition: () => void
  parentAccepts: (id: string) => void
  parentConfirms: () => void
  reset: () => void
  demoDate: Date
  isVerified: boolean
}

const g = globalThis as unknown as { __tuitionhubCtx?: React.Context<Store | null> }
const Ctx = (g.__tuitionhubCtx ??= createContext<Store | null>(null))
const BASE = new Date('2026-10-13T09:00:00')
let tid = 1

export const VERIFY_FLOW: VerifyState[] = ['not_started', 'draft', 'pending', 'under_review', 'verified']

export function StoreProvider({ children }: { children: ReactNode }) {
  const [raw, setRaw] = useState<State>(initial)
  const s = useMemo(() => (raw.version === STATE_VERSION ? raw : hydrate(raw)), [raw])
  const setS = useCallback((fn: (p: State) => State) => setRaw((p) => hydrate(fn(hydrate(p)))), [])

  const toast = useCallback((text: string, tone: Toast['tone'] = 'info') => {
    const id = tid++
    setS((p) => ({ ...p, toasts: [...p.toasts, { id, text, tone }] }))
    setTimeout(() => setS((p) => ({ ...p, toasts: p.toasts.filter((t) => t.id !== id) })), 4000)
  }, [])

  const value = useMemo<Store>(() => {
    const demoDate = new Date(BASE.getTime() + s.dayOffset * 86400000)
    return {
      ...s,
      demoDate,
      isVerified: s.verification[s.role] === 'verified',
      setRole: (role) => setS((p) => ({ ...p, role })),
      patchSignup: (patch) => setS((p) => ({ ...p, signup: { ...p.signup, ...patch } })),
      signIn: (role) => setS((p) => ({ ...p, signedIn: true, role: role ?? p.role })),
      setSession: (accessToken, refreshToken) => setS((p) => ({ ...p, signedIn: true, accessToken, refreshToken })),
      signOut: () => setS((p) => ({ ...p, signedIn: false, accessToken: null, refreshToken: null })),
      setVerification: (r, v) => setS((p) => ({ ...p, verification: { ...p.verification, [r]: v } })),
      advanceVerification: () =>
        setS((p) => {
          const cur = p.verification[p.role]
          const i = VERIFY_FLOW.indexOf(cur)
          const next = i >= 0 && i < VERIFY_FLOW.length - 1 ? VERIFY_FLOW[i + 1] : cur === 'rejected' || cur === 'action_required' ? 'pending' : cur
          return { ...p, verification: { ...p.verification, [p.role]: next } }
        }),
      fastForward: (d) => setS((p) => ({ ...p, dayOffset: p.dayOffset + d })),
      setChild: (child) => setS((p) => ({ ...p, child })),
      setPJ: (fn) => setS((p) => ({ ...p, pj: { ...p.pj, ...fn(p.pj) } })),
      setKJ: (id, fn) => setS((p) => { if (id === STUDENT.id) return { ...p, sj: { ...p.sj, kj: { ...p.sj.kj, ...fn(p.sj.kj) } } }; const cur = kjOf(p.pj, id); return { ...p, pj: { ...p.pj, kj: { ...p.pj.kj, [id]: { ...cur, ...fn(cur) } } } } }),
      setSJ: (fn) => setS((p) => ({ ...p, sj: { ...p.sj, ...fn(p.sj) } })),
      setCJ: (fn) => setS((p) => ({ ...p, cj: { ...p.cj, ...fn(p.cj) } })),
      setCV: (fn) => setS((p) => ({ ...p, cv: { ...p.cv, ...fn(p.cv) } })),
      seedChildren: () => setS((p) => ({ ...p, pj: { ...p.pj, kids: DIRECTORY.filter((d) => d.family === 'islam').map((d) => kidFrom(d, p.pj.form.relation, 'confirmed')) } })),
      toast,
      dismissToast: (id) => setS((p) => ({ ...p, toasts: p.toasts.filter((t) => t.id !== id) })),
      setDrawer: (drawerOpen) => setS((p) => ({ ...p, drawerOpen })),
      setJourney: (fn) => setS((p) => ({ ...p, journey: { ...p.journey, ...fn(p.journey) } })),
      startTuition: () => setS((p) => ({ ...p, journey: { ...p.journey, tuition: 'active', ...activeSeed() } })),
      completeTuition: () => setS((p) => {
        const marks = { ...p.journey.marks }
        allClasses(p.journey).forEach((c) => { if (!marks[c.id]) marks[c.id] = 'present' })
        return { ...p, dayOffset: Math.max(p.dayOffset, 60), journey: { ...p.journey, tuition: 'completed', marks, reviewReceived: true, testMarks: [...p.journey.testMarks, 74, 78], hw: p.journey.hw.map((h) => (h.state === 'reviewed' ? h : { ...h, state: 'reviewed' as const, score: 8, feedback: 'Good work.' })), pay: p.journey.pay.map((x) => ({ ...x, state: 'confirmed' as const })) } }
      }),
      parentAccepts: (id) => setS((p) => {
        const j = p.journey; const th = j.chat[id] ?? []
        return { ...p, journey: { ...j, interests: { ...j.interests, [id]: 'mutual' }, requests: { ...j.requests, ...(id.startsWith('r-') ? { [id]: 'accepted' as const } : {}) }, chat: { ...j.chat, [id]: th.length ? th : [SYS_MSG, { from: 'them', text: REPLIES[0] }] } } }
      }),
      parentConfirms: () => setS((p) => ({ ...p, journey: { ...p.journey, agree: { ...p.journey.agree, parent: true }, tuition: 'active', ...activeSeed() } })),
      reset: () => { setCreatedAccount(null); setRaw(initial()) },
    }
  }, [s, toast])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore() {
  const c = useContext(Ctx)
  if (!c) throw new Error('StoreProvider missing')
  return c
}
