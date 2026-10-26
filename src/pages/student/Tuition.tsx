import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { CheckCircle2, Clock, FileSignature, Lock, MessageSquare, XCircle } from 'lucide-react'
import { PageHead, Masked } from '../../components/tutor/bits'
import { Avatar, Bar, Card, Chip, DemoTag, EmptyState, ProgressRing, Tabs, VerifyBadge } from '../../components/ui'
import { attendanceStats, classesFor, dateOf, fmt, testMarksFor, tutOf, type Kid } from '../../lib/parent'
import { maskedEmail, maskedPhone, money } from '../../lib/pmatch'
import { TUTORS } from '../../lib/data'
import { STUDENT, SCHOOL_MARKS, isMinor, studentKid } from '../../lib/student'
import { useStore } from '../../lib/store'
import { MonthlyReport, ReviewSection } from '../parent/Review'

const A = '/app/student'
const lnk = 'rounded-input border border-gray-400 px-3 py-2 text-sm font-semibold text-navy-900 hover:bg-gray-100'

function useMe() { const s = useStore(); return { s, kid: studentKid(s.sj), off: s.dayOffset } }

function NoTuition({ what }: { what: string }) {
  return <Card><EmptyState title="No active tuition yet" body={`${what} fills in once a tuition starts. Find a verified tutor and show interest to begin.`} action={<div className="flex flex-wrap justify-center gap-3 text-sm font-semibold"><Link to={`${A}/find-tutor`} className="text-blue-600 hover:underline">Find a tutor</Link><Link to={`${A}/messages`} className="text-blue-600 hover:underline">My messages</Link></div>} /></Card>
}
function Page({ title, tag, sub, children }: { title: string; tag: string; sub: string; children: (kid: Kid) => ReactNode }) {
  const { kid } = useMe()
  return <div><PageHead title={title} tag={tag} sub={sub} />{kid.tuition ? children(kid) : <NoTuition what={title} />}</div>
}

export function MyTuition() {
  const { s, kid } = useMe(); const kj = s.sj.kj; const f = s.sj.form
  return (
    <Page title="My Tuition" tag="ACT-S" sub="Your running tuition, agreement and review in one place.">{(k) => { const T = tutOf(k); return (<>
      <Card><div className="flex flex-wrap items-start gap-3"><div className="min-w-0 flex-1"><h2 className="text-xl">{T.subject}</h2><p className="text-sm text-gray-600">with {T.tutor} · {T.area} area</p></div>{kj.stage === 'completed' ? <Chip tone="blue" icon={<CheckCircle2 size={12} aria-hidden />}>Completed</Chip> : <Chip tone="green" icon={<CheckCircle2 size={12} aria-hidden />}>Tuition Active</Chip>}</div>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-4">{([['Days', T.days], ['Time', T.time], ['Monthly fee', money(T.fee)], ['Since', T.since]] as const).map(([l, v]) => <div key={l}><dt className="text-xs font-semibold uppercase tracking-wide text-gray-600">{l}</dt><dd className="font-semibold text-navy-900">{v}</dd></div>)}</dl>
        <p className="mt-3 text-xs text-gray-600">Fees are paid and recorded by your guardian. You cannot mark payments.</p>
        <div className="mt-4 flex flex-wrap gap-2"><Link to={`${A}/schedule`} className={lnk}>Schedule</Link><Link to={`${A}/homework`} className={lnk}>Homework</Link><Link to={`${A}/progress`} className={lnk}>Progress</Link><Link to={`${A}/tutor`} className={lnk}>Tutor</Link></div></Card>
      <Card className="mt-6"><h2 className="flex items-center gap-2 text-lg"><FileSignature size={18} aria-hidden /> Agreement</h2>
        <ul className="mt-3 space-y-2 text-sm"><li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-600" aria-hidden /> You confirmed</li><li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-600" aria-hidden /> {T.tutor} confirmed</li>
          <li className="flex items-center gap-2">{isMinor(f) ? (kj.guardianOk ? <CheckCircle2 size={16} className="text-emerald-600" aria-hidden /> : <Clock size={16} className="text-gray-400" aria-hidden />) : <CheckCircle2 size={16} className="text-emerald-600" aria-hidden />} {isMinor(f) ? (kj.guardianOk ? `Guardian ${f.guardianName || ''} agreed (Demo)`.replace('  ', ' ') : 'Guardian consent not recorded (sample tuition)') : 'Guardian consent not needed (18 or older)'}</li></ul>
        <p className="mt-3 text-xs text-gray-600">Exact address is shared only with the tutor and is logged. TuitionHub does not process payments.</p></Card>
      <ReviewSection kid={k} /></>) }}</Page>
  )
}

export function Schedule() {
  const { off } = useMe()
  return <Page title="Schedule" tag="SCH-S" sub="Your upcoming classes. Your tutor sets the timetable.">{(kid) => { const list = classesFor(kid, off).filter((c) => c.day >= off).slice(0, 8); const T = tutOf(kid); return list.length ? (
    <ul className="grid gap-3 sm:grid-cols-2">{list.map((c) => <li key={c.id}><Card><p className="font-heading text-lg font-bold text-navy-900">{fmt(dateOf(c.day))}</p><p className="text-sm text-gray-600">{T.time} · {T.subject} with {T.tutor}</p><div className="mt-2">{c.day === off ? <Chip tone="blue" icon={<Clock size={12} aria-hidden />}>Today</Chip> : <Chip tone="gray">Upcoming</Chip>}</div></Card></li>)}</ul>
  ) : <Card><EmptyState title="No upcoming classes" body="Your tutor has not scheduled any more classes." /></Card> }}</Page>
}

export function Attendance() {
  const { off } = useMe()
  return <Page title="Attendance" tag="ATT-S" sub="Your class-by-class record. Your tutor marks attendance.">{(kid) => { const st = attendanceStats(kid, off); const all = classesFor(kid, off).filter((c) => c.day < off).reverse(); return (<>
    <Card className="mb-4 flex items-center gap-3 bg-offwhite-50"><Lock size={18} className="text-gray-600" aria-hidden /><p className="text-sm text-gray-600"><b className="text-navy-900">Read-only.</b> Only your tutor can mark attendance. If a mark looks wrong, tell your tutor in chat.</p></Card>
    <div className="mb-4 grid gap-4 sm:grid-cols-3"><Card><p className="text-sm text-gray-600">Last {st.total} classes</p><p className="mt-1 font-heading text-3xl font-bold text-navy-900 tabular">{st.pct}%</p><Bar value={st.pct} label={`Attendance ${st.pct}%`} tone={st.pct >= 85 ? 'teal' : 'blue'} /></Card><Card><p className="text-sm text-gray-600">Present or late</p><p className="mt-1 font-heading text-3xl font-bold tabular">{st.present}</p></Card><Card><p className="text-sm text-gray-600">Absent</p><p className="mt-1 font-heading text-3xl font-bold tabular">{st.absent}</p></Card></div>
    <Card pad={false}><ul className="divide-y divide-gray-100">{all.slice(0, 12).map((c) => <li key={c.id} className="flex items-center gap-3 p-3 text-sm"><span className="flex-1 font-medium text-navy-900">{fmt(dateOf(c.day))}</span>{c.mark === 'present' ? <Chip tone="green" icon={<CheckCircle2 size={12} aria-hidden />}>Present</Chip> : c.mark === 'late' ? <Chip tone="amber" icon={<Clock size={12} aria-hidden />}>Late</Chip> : <Chip tone="red" icon={<XCircle size={12} aria-hidden />}>Absent</Chip>}</li>)}{all.length === 0 && <li className="p-4 text-sm text-gray-600">No classes held yet. Use Demo controls to fast-forward.</li>}</ul></Card></>) }}</Page>
}

export function Progress() {
  const { off } = useMe(); const [tab, setTab] = useState('Tuition')
  return <Page title="Progress" tag="PRG-S" sub="How you are doing in tuition, and how it compares with school.">{(kid) => { const m = testMarksFor(kid, off); const avg = m.length ? Math.round(m.reduce((a, b) => a + b, 0) / m.length) : 0; const sAvg = Math.round(SCHOOL_MARKS.reduce((a, b) => a + b, 0) / SCHOOL_MARKS.length); return (<>
    <Tabs tabs={['Tuition', 'School vs tuition']} value={tab} onChange={setTab} />
    <div className="mt-4">{tab === 'Tuition' ? (<>
      <div className="grid gap-6 md:grid-cols-[auto_1fr]"><Card className="flex flex-col items-center"><ProgressRing value={avg} label={`Average ${avg}%`} /><p className="mt-2 text-sm text-gray-600">Average of {m.length} {m.length === 1 ? 'test' : 'tests'}</p></Card>
        <Card><h2 className="text-lg">Tuition test marks</h2><ul className="mt-3 space-y-2">{m.map((v, i) => <li key={i}><Bar value={v} label={`Test ${i + 1}`} tone="teal" /></li>)}{m.length === 0 && <li className="text-sm text-gray-600">No tests yet. The first model test comes about ten days after the start.</li>}</ul><p className="mt-4 rounded-input bg-offwhite-50 p-3 text-sm text-gray-600">Tutor note: you are settling in well. Keep up the weekly practice sets.</p></Card></div>
      <MonthlyReport kid={kid} /></>) : (
      <Card><h2 className="text-lg">School vs tuition</h2><p className="text-sm text-gray-600">Your school term tests next to your tuition model tests, in the same subject.</p>
        <div className="mt-4 grid gap-6 sm:grid-cols-2"><div><p className="mb-2 flex items-center gap-2 text-sm font-semibold text-navy-900">School <DemoTag label="Demo marks" /></p><ul className="space-y-2">{SCHOOL_MARKS.map((v, i) => <li key={i}><Bar value={v} label={`Term test ${i + 1}`} tone="blue" /></li>)}</ul><p className="mt-2 text-sm text-gray-600">Average <b className="tabular text-navy-900">{sAvg}%</b></p></div>
          <div><p className="mb-2 text-sm font-semibold text-navy-900">Tuition</p><ul className="space-y-2">{m.map((v, i) => <li key={i}><Bar value={v} label={`Model test ${i + 1}`} tone="teal" /></li>)}{m.length === 0 && <li className="text-sm text-gray-600">No tuition tests yet.</li>}</ul>{m.length > 0 && <p className="mt-2 text-sm text-gray-600">Average <b className="tabular text-navy-900">{avg}%</b></p>}</div></div>
        <p className="mt-4 rounded-input bg-offwhite-50 p-3 text-sm text-gray-600">{m.length === 0 ? 'Once your first tuition test is marked you will see how it compares with school.' : avg >= sAvg ? `Your tuition average is ${avg - sAvg} points above your school average. Keep it up.` : `Your tuition average is ${sAvg - avg} points below your school average. Early tests are often lower; the trend matters more.`}</p></Card>)}</div></>) }}</Page>
}

export function TutorPage() {
  const { s, kid } = useMe(); const T = kid.tuition ? tutOf(kid) : null; const t = T ? TUTORS.find((x) => x.id === T.tutorId) : null
  return (
    <div><PageHead title="My tutor" tag="TUT-S" sub="Your tutor's verified profile. Contact stays inside TuitionHub chat." />
      {!T || !t ? <NoTuition what="My tutor" /> : (
        <Card><div className="flex flex-wrap items-start gap-4"><Avatar name={t.name} size={64} /><div className="min-w-0 flex-1"><h2 className="text-xl">{t.name}</h2><p className="text-sm text-gray-600">{T.subject} · {T.days} · {T.time}</p><div className="mt-2 flex flex-wrap gap-1.5">{t.badges.map((b) => <VerifyBadge key={b} kind={b} />)}</div></div></div>
          <dl className="mt-4 space-y-2 text-sm"><div className="flex justify-between gap-3"><dt className="text-gray-600">Phone</dt><dd><Masked value={maskedPhone(t)} /></dd></div><div className="flex justify-between gap-3"><dt className="text-gray-600">Email</dt><dd><Masked value={maskedEmail(t)} /></dd></div><div className="flex justify-between gap-3"><dt className="text-gray-600">Area</dt><dd className="font-semibold text-navy-900">{T.area} (area only)</dd></div></dl>
          <div className="mt-4 flex flex-wrap gap-2"><Link to={`${A}/messages/${t.id}`} className="inline-flex items-center gap-1.5 rounded-input bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"><MessageSquare size={14} aria-hidden /> Message</Link><Link to={`${A}/find-tutor/${t.id}`} className={lnk}>Full profile</Link></div>
          <p className="mt-3 text-xs text-gray-600">{s.sj.kj.review ? 'You reviewed this tutor.' : 'You can review your tutor once the tuition is complete, under My Tuition.'} <DemoTag /> Demo tutor, fictional data.</p></Card>)}
    </div>
  )
}
export { STUDENT }
