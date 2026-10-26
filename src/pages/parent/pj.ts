import { useParams } from 'react-router'
import { STUDENT, studentKid, studentNeed } from '../../lib/student'
import { SYS_MSG } from '../../lib/journey'
import { TUTORS } from '../../lib/data'
import { initialKJ, kjOf, type KJ, type KPost, type Kid, type Tut } from '../../lib/parent'
import { PARENT_NAME, TUTOR_REPLIES, WEEKDAY, defaultNeed, needOf, rankTutors, money, type Need } from '../../lib/pmatch'
import { useStore } from '../../lib/store'
import { useKid } from './shared'
import type { SJ } from '../../lib/student'

export const tutorBy = (id: string) => TUTORS.find((t) => t.id === id)

export function usePJ() {
  const { s, kids, kid: pkid } = useKid()
  const me: 'parent' | 'student' = useParams().role === 'student' ? 'student' : 'parent'
  const base = `/app/${me}`
  if (me === 'student') {
    const kid = studentKid(s.sj); const raw = s.sj.kj
    const need = raw.post ? needOf(raw.post) : studentNeed(kid)
    const verified = s.verification.student === 'verified'; const busy = !!s.sj.tut
    const kj: KJ = raw
    const set = (fn: (k: KJ) => Partial<KJ>) => s.setKJ(STUDENT.id, (k) => { const p = fn(k); return k.post || p.post ? p : { ...p, post: studentPost(need) } })
    return { s, kids: [kid], kid, kj, verified, busy, need, set, canAct: verified && !busy, why: !verified ? 'Verify your student account to unlock this.' : 'You already have an active tuition.', me, base }
  }
  const kid = pkid
  const kj: KJ = kid ? kjOf(s.pj, kid.id) : initialKJ()
  const verified = s.verification.parent === 'verified'
  const busy = !!kid?.tuition
  const need = kid ? (kj.post ? needOf(kj.post) : defaultNeed(kid)) : null
  const set = (fn: (k: KJ) => Partial<KJ>) => { if (kid) s.setKJ(kid.id, fn) }
  const canAct = verified && !busy
  const why = !verified ? 'Verify your account to unlock this.' : busy ? `${kid?.short} already has an active tuition.` : ''
  return { s, kids, kid, kj, verified, busy, need, set, canAct, why, me, base }
}

export const studentPost = (n: Need): KPost => ({ subject: n.subject, cls: n.cls, medium: 'Bangla', area: n.area, days: n.days, time: n.time, budget: n.budget, mode: n.mode, requirements: '', status: 'published', posted: '13 Oct 2026' })

export function openThread(kj: KJ, tid: string): Partial<KJ> {
  const t = tutorBy(tid)
  const th = kj.chat[tid]?.length ? kj.chat[tid] : [SYS_MSG, { from: 'them' as const, text: `Hello, this is ${t?.name.split(' ')[0] ?? 'the tutor'}. ${TUTOR_REPLIES[0]}` }]
  return { chat: { ...kj.chat, [tid]: th } }
}

export function activate(kids: Kid[], kidId: string, kj: KJ, off: number): { kids: Kid[]; patch: Partial<KJ> } | null {
  const t = tutorBy(kj.tutorId); const p = kj.post
  if (!t || !p) return null
  const wd = p.days.split(', ').map((d) => WEEKDAY[d.slice(0, 3)])
  const tut: Tut = { subject: p.subject, tutor: t.name, tutorId: t.id, area: p.area, days: p.days, time: p.time, fee: Math.min(t.fee, p.budget), since: new Date(new Date('2026-10-13T09:00:00').getTime() + off * 86400000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }), startDay: off, weekdays: wd }
  return { kids: kids.map((k) => (k.id === kidId ? { ...k, tuition: true, tut, paid: [] } : k)), patch: { stage: 'active', agreeParent: true, agreeTutor: true, post: { ...p, status: 'filled' } } }
}

export function agreementOf(kid: Kid, kj: KJ, guardian = PARENT_NAME) {
  const t = tutorBy(kj.tutorId); const p = kj.post
  if (!t || !p) return null
  return { tutor: t.name, student: kid.name, parent: guardian, subject: p.subject, cls: p.cls, days: p.days, time: p.time, salary: Math.min(t.fee, p.budget), type: p.mode === 'Online' ? 'Online' : 'Offline (home tuition)', location: `${p.area}. The exact address is shared only with the tutor, after both confirm, and is logged.`, terms: `Paid monthly and tracked on TuitionHub. TuitionHub does not process payments. Fee ${money(Math.min(t.fee, p.budget))} per month.` }
}


type PJSetter = { setSJ: (fn: (p: SJ) => Partial<SJ>) => void; sj: SJ; setKJ: (id: string, fn: (k: KJ) => Partial<KJ>) => void; setPJ: (fn: (p: import('../../lib/parent').PJ) => Partial<import('../../lib/parent').PJ>) => void; dayOffset: number; fastForward: (d: number) => void }
export function tutorConfirms(s: PJSetter, kidId: string) {
  if (kidId === STUDENT.id) {
    s.setSJ((p) => { const a = activate([studentKid(p)], STUDENT.id, p.kj, s.dayOffset); const k = a?.kids[0]; if (!a || !k?.tut) return {}; return { tut: k.tut, kj: { ...p.kj, ...a.patch } } })
    return
  }
  s.setPJ((p) => { const kj = kjOf(p, kidId); const a = activate(p.kids, kidId, kj, s.dayOffset); if (!a) return {}; return { kids: a.kids, kj: { ...p.kj, [kidId]: { ...kj, ...a.patch } } } })
}
export function completeTuition(s: PJSetter, kid: Kid) {
  if (!kid.tut) return
  s.fastForward(Math.max(0, kid.tut.startDay + 60 - s.dayOffset))
  if (kid.id === STUDENT.id) { s.setKJ(kid.id, () => ({ stage: 'completed' })); return }
  s.setPJ((p) => ({ kj: { ...p.kj, [kid.id]: { ...kjOf(p, kid.id), stage: 'completed' as const } } }))
}
export function tutorSendsInterest(s: PJSetter, kidId: string, nth = 0) {
  if (kidId === STUDENT.id) {
    s.setSJ((p) => {
      const kj = p.kj; const post = kj.post ?? studentPost(studentNeed(studentKid(p)))
      const cand = rankTutors(needOf(post)).filter((x) => !kj.sent[x.t.id] && !kj.incoming[x.t.id]); const next = cand[nth] ?? cand[0]
      return next ? { kj: { ...kj, post, incoming: { ...kj.incoming, [next.t.id]: 'received' as const } } } : {}
    })
    return
  }
  s.setPJ((p) => {
    const kj = kjOf(p, kidId); const kid = p.kids.find((k) => k.id === kidId); if (!kid || !kj.post || kj.post.status !== 'published') return {}
    const cand = rankTutors(needOf(kj.post)).filter((x) => !kj.sent[x.t.id] && !kj.incoming[x.t.id]); const next = cand[nth] ?? cand[0]
    if (!next) return {}
    return { kj: { ...p.kj, [kidId]: { ...kj, incoming: { ...kj.incoming, [next.t.id]: 'received' as const } } } }
  })
}

export const interestPatch = (kj: KJ, tid: string): Partial<KJ> => kj.incoming[tid] === 'received'
  ? { incoming: { ...kj.incoming, [tid]: 'accepted' }, sent: { ...kj.sent, [tid]: 'mutual' }, ...openThread(kj, tid) }
  : { sent: { ...kj.sent, [tid]: 'sent' } }
export const tutorAcceptsPatch = (kj: KJ, tid: string): Partial<KJ> => ({ sent: { ...kj.sent, [tid]: 'mutual' }, ...openThread(kj, tid) })
export const declinePatch = (kj: KJ, tid: string): Partial<KJ> => ({ incoming: { ...kj.incoming, [tid]: 'declined' } })
export const withdrawPatch = (kj: KJ, tid: string): Partial<KJ> => { const { [tid]: _x, ...rest } = kj.sent; return { sent: rest } }
