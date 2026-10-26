import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import { ArrowRight, Lock, MapPin, Star } from 'lucide-react'
import { Avatar, btnClass, Card, Chip, Modal, VerifyBadge, cx } from '../ui'
import type { Tutor } from '../../lib/data'

const GateCtx = createContext<(what: string) => void>(() => {})
export const useGate = () => useContext(GateCtx)

export function GateProvider({ children }: { children: ReactNode }) {
  const [what, setWhat] = useState<string | null>(null)
  const { pathname } = useLocation()
  const open = useCallback((w: string) => setWhat(w), [])
  return (
    <GateCtx.Provider value={open}>
      {children}
      <Modal open={!!what} onClose={() => setWhat(null)} title="Sign in to continue"
        footer={<>
          <Link to="/signup" state={{ from: pathname }} onClick={() => setWhat(null)} className={btnClass('secondary')}>Create account</Link>
          <Link to="/login" state={{ from: pathname }} onClick={() => setWhat(null)} className={btnClass('primary')}>Log in</Link>
        </>}>
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600"><Lock size={18} strokeWidth={1.5} aria-hidden /></span>
          <p>To <strong className="text-navy-900">{what}</strong>, you need a verified TuitionHub account. This keeps every tutor, student and guardian on the platform a known person.</p>
        </div>
        <p className="mt-3 text-xs">Public search shows limited details only. Phone numbers, exact addresses and documents are never shown here.</p>
      </Modal>
    </GateCtx.Provider>
  )
}

export function PageHero({ eyebrow, title, lead, children }: { eyebrow: string; title: string; lead: string; children?: ReactNode }) {
  return (
    <section className="border-b border-gray-200 bg-white">
      <div className="mx-auto max-w-[1200px] px-6 py-16 md:py-20">
        <p className="text-xs font-semibold uppercase tracking-widest text-teal-700">{eyebrow}</p>
        <h1 className="mt-3 max-w-3xl text-4xl leading-tight md:text-5xl md:leading-[1.1]">{title}</h1>
        <p className="mt-4 max-w-2xl text-lg text-gray-600">{lead}</p>
        {children && <div className="mt-8">{children}</div>}
      </div>
    </section>
  )
}

export function Section({ title, lead, children, tint, id }: { title?: string; lead?: string; children: ReactNode; tint?: boolean; id?: string }) {
  return (
    <section id={id} className={cx('py-16 md:py-20', tint && 'bg-white')}>
      <div className="mx-auto max-w-[1200px] px-6">
        {title && <h2 className="max-w-2xl text-3xl">{title}</h2>}
        {lead && <p className="mt-3 max-w-2xl text-gray-600">{lead}</p>}
        <div className={title ? 'mt-10' : ''}>{children}</div>
      </div>
    </section>
  )
}

export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => <Star key={i} size={size} strokeWidth={1.5} className={i <= Math.round(value) ? 'fill-navy-700 text-navy-700' : 'fill-gray-100 text-gray-200'} aria-hidden />)}
    </span>
  )
}

export function TutorCard({ t }: { t: Tutor }) {
  const gate = useGate()
  return (
    <Card className="flex flex-col" pad={false}>
      <div className="flex gap-4 p-5">
        <Avatar name={t.name} size={52} />
        <div className="min-w-0">
          <Link to={`/tutors/${t.id}`} className="font-heading text-lg font-bold text-navy-900 hover:text-blue-600">{t.short}</Link>
          <p className="text-sm text-gray-600">{t.subjects.join(' · ')}</p>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-600"><MapPin size={12} aria-hidden /> {t.area} · {t.classes}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-gray-100 px-5 py-3 text-sm">
        <span className="inline-flex items-center gap-1 font-semibold text-navy-900"><Star size={14} className="fill-warning-600 text-warning-600" aria-hidden /> {t.rating}<span className="font-normal text-gray-600">({t.reviews})</span></span>
        <span className="text-gray-600">{t.verified} verified tuitions</span>
        <span className="tabular ml-auto font-semibold text-navy-900">৳{t.fee.toLocaleString('en-US')}<span className="font-normal text-gray-600">/mo</span></span>
      </div>
      <div className="flex flex-wrap gap-1.5 px-5 pb-4">
        {t.badges.slice(0, 3).map((b) => <VerifyBadge key={b} kind={b} />)}
        <Chip tone="blue">{t.mode}</Chip>
      </div>
      <div className="mt-auto flex gap-2 border-t border-gray-100 p-4">
        <Link to={`/tutors/${t.id}`} className={cx(btnClass('secondary', 'sm'), 'flex-1')}>View profile</Link>
        <button onClick={() => gate('send interest or message this tutor')} className={cx(btnClass('primary', 'sm'), 'flex-1')}>Contact <ArrowRight size={14} aria-hidden /></button>
      </div>
    </Card>
  )
}

export function PrivacyNote({ children }: { children?: ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-input bg-blue-100 px-3 py-2 text-xs text-navy-700">
      <Lock size={14} className="mt-0.5 shrink-0" aria-hidden />
      {children ?? 'Public view shows limited details only. No phone numbers, NID, exact address or documents.'}
    </p>
  )
}
