import { useState } from 'react'
import { Link } from 'react-router'
import { CheckCircle2, Clock, XCircle, MinusCircle } from 'lucide-react'
import { Bar, Button, Card, Chip, EmptyState, ProgressRing, Tabs } from '../../components/ui'
import { PageHead } from '../../components/tutor/bits'
import { testMarksFor, tutOf, attendanceStats, classesFor, dateOf, fmt, hwFor, monthLabel, payState, type Kid } from '../../lib/parent'
import { Scoped } from './shared'
import { useStore } from '../../lib/store'
import { AbsenceCard, MonthlyReport, ReviewSection } from './Review'

const money = (n: number) => `৳${n.toLocaleString('en-IN')}`
const A = '/app/parent'

function NoTuition({ kid }: { kid: Kid }) {
  return <Card><EmptyState title={`${kid.short} has no active tuition`} body="This page fills in once a tuition starts." action={<Link to={`${A}/find-tutor`} className="text-sm font-semibold text-blue-600 hover:underline">Find a tutor</Link>} /></Card>
}
const Who = ({ kid }: { kid: Kid }) => <p className="mb-4 text-sm text-gray-600">Showing <b className="text-navy-900">{kid.name}</b>. Change child from the switcher at the top.</p>

export function Tuitions() {
  return <Scoped>{(kid) => (<div><PageHead title="Active tuitions" tag="ACT-P" sub={`Tuitions running for ${kid.short}.`} /><Who kid={kid} />
    {!kid.tuition ? <NoTuition kid={kid} /> : (
      <Card><div className="flex flex-wrap items-start gap-3"><div className="min-w-0 flex-1"><h2 className="text-xl">{tutOf(kid).subject}</h2><p className="text-sm text-gray-600">with {tutOf(kid).tutor} · {tutOf(kid).area}</p></div><Chip tone="green" icon={<CheckCircle2 size={12} aria-hidden />}>Active</Chip></div>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-4">{([['Days', tutOf(kid).days], ['Time', tutOf(kid).time], ['Monthly fee', money(tutOf(kid).fee)], ['Since', tutOf(kid).since]] as const).map(([l, v]) => <div key={l}><dt className="text-xs font-semibold uppercase tracking-wide text-gray-600">{l}</dt><dd className="font-semibold text-navy-900">{v}</dd></div>)}</dl>
        <div className="mt-4 flex flex-wrap gap-2 text-sm font-semibold"><Link to={`${A}/schedule`} className="rounded-input border border-gray-400 px-3 py-2 text-navy-900 hover:bg-gray-100">Schedule</Link><Link to={`${A}/attendance`} className="rounded-input border border-gray-400 px-3 py-2 text-navy-900 hover:bg-gray-100">Attendance</Link><Link to={`${A}/progress`} className="rounded-input border border-gray-400 px-3 py-2 text-navy-900 hover:bg-gray-100">Progress</Link></div></Card>)}
    {kid.tuition && <ReviewSection kid={kid} />}</div>)}</Scoped>
}

export function Schedule() {
  const { dayOffset: off } = useStore()
  return <Scoped>{(kid) => { const list = classesFor(kid, off).filter((c) => c.day >= off).slice(0, 6); return (<div><PageHead title="Schedule" tag="SCH-P" sub={`Upcoming classes for ${kid.short}.`} /><Who kid={kid} />
    {!kid.tuition ? <NoTuition kid={kid} /> : <ul className="grid gap-3 sm:grid-cols-2">{list.map((c) => <li key={c.id}><Card><p className="font-heading text-lg font-bold text-navy-900">{fmt(dateOf(c.day))}</p><p className="text-sm text-gray-600">{tutOf(kid).time} · {tutOf(kid).subject} with {tutOf(kid).tutor}</p>{c.day === off ? <Chip tone="blue" icon={<Clock size={12} aria-hidden />}>Today</Chip> : <Chip tone="gray">Upcoming</Chip>}</Card></li>)}</ul>}</div>) }}</Scoped>
}

export function Attendance() {
  const { dayOffset: off } = useStore()
  return <Scoped perm="attendance" what="Attendance">{(kid) => { const st = attendanceStats(kid, off); const all = classesFor(kid, off).filter((c) => c.day < off).reverse(); return (<div><PageHead title="Attendance" tag="ATT-P" sub={`Class-by-class record for ${kid.short}.`} /><Who kid={kid} />
    {!kid.tuition ? <NoTuition kid={kid} /> : <>
      <AbsenceCard kid={kid} />
      <div className="mb-4 grid gap-4 sm:grid-cols-3"><Card><p className="text-sm text-gray-600">Last {st.total} classes</p><p className="mt-1 font-heading text-3xl font-bold text-navy-900 tabular">{st.pct}%</p><Bar value={st.pct} label={`Attendance ${st.pct}%`} tone={st.pct >= 85 ? 'teal' : 'blue'} /></Card><Card><p className="text-sm text-gray-600">Present or late</p><p className="mt-1 font-heading text-3xl font-bold tabular">{st.present}</p></Card><Card><p className="text-sm text-gray-600">Absent</p><p className="mt-1 font-heading text-3xl font-bold tabular">{st.absent}</p></Card></div>
      <Card pad={false}><ul className="divide-y divide-gray-100">{all.slice(0, 12).map((c) => <li key={c.id} className="flex items-center gap-3 p-3 text-sm"><span className="flex-1 font-medium text-navy-900">{fmt(dateOf(c.day))}</span>{c.mark === 'present' ? <Chip tone="green" icon={<CheckCircle2 size={12} aria-hidden />}>Present</Chip> : c.mark === 'late' ? <Chip tone="amber" icon={<Clock size={12} aria-hidden />}>Late</Chip> : <Chip tone="red" icon={<XCircle size={12} aria-hidden />}>Absent</Chip>}</li>)}{all.length === 0 && <li className="p-4 text-sm text-gray-600">No classes held yet.</li>}</ul></Card></>}</div>) }}</Scoped>
}

export function Homework() {
  const { dayOffset: off } = useStore(); const [tab, setTab] = useState('To do')
  return <Scoped>{(kid) => { const all = hwFor(kid, off); const shown = all.filter((h) => (tab === 'To do' ? h.state === 'assigned' : h.state !== 'assigned')); return (<div><PageHead title="Homework & assignments" tag="HW-P" sub={`Read-only for ${kid.short}. The tutor sets and reviews work.`} /><Who kid={kid} />
    {!kid.tuition ? <NoTuition kid={kid} /> : <><Tabs tabs={['To do', 'Done']} value={tab} onChange={setTab} />
      <ul className="mt-4 space-y-3">{shown.map((h) => <li key={h.id}><Card><div className="flex flex-wrap items-start gap-3"><div className="min-w-0 flex-1"><p className="font-semibold text-navy-900">{h.title}</p><p className="text-xs text-gray-600">{h.kind} · due {fmt(dateOf(h.due))}</p></div>{h.state === 'assigned' ? <Chip tone={h.due - off <= 1 ? 'amber' : 'blue'} icon={<Clock size={12} aria-hidden />}>{h.due - off <= 1 ? 'Due soon' : 'Assigned'}</Chip> : h.state === 'submitted' ? <Chip tone="blue" icon={<MinusCircle size={12} aria-hidden />}>Waiting for review</Chip> : <Chip tone="green" icon={<CheckCircle2 size={12} aria-hidden />}>Reviewed {h.score}</Chip>}</div>{h.feedback && <p className="mt-2 rounded-input bg-offwhite-50 p-3 text-sm text-gray-600">{h.feedback}</p>}</Card></li>)}
        {shown.length === 0 && <li><Card><p className="text-sm text-gray-600">Nothing here.</p></Card></li>}</ul></>}</div>) }}</Scoped>
}

export function Progress() {
  const { dayOffset: off } = useStore()
  return <Scoped perm="progress" what="Progress and reports">{(kid) => { const TEST_MARKS = testMarksFor(kid, off); const avg = TEST_MARKS.length ? Math.round(TEST_MARKS.reduce((a, b) => a + b, 0) / TEST_MARKS.length) : 0; return (<div><PageHead title="Progress & reports" tag="PRG-P" sub={`How ${kid.short} is doing in ${tutOf(kid).subject}.`} /><Who kid={kid} />
    {!kid.tuition ? <NoTuition kid={kid} /> : <><div className="grid gap-6 md:grid-cols-[auto_1fr]"><Card className="flex flex-col items-center"><ProgressRing value={avg} label={`Average ${avg}%`} /><p className="mt-2 text-sm text-gray-600">Average of {TEST_MARKS.length} tests</p></Card>
      <Card><h2 className="text-lg">Test marks</h2><ul className="mt-3 space-y-2">{TEST_MARKS.map((m, i) => <li key={i} className="grid grid-cols-[4.5rem_1fr_3rem] items-center gap-3 text-sm"><span className="text-gray-600">Test {i + 1}</span><Bar value={m} label={`Test ${i + 1}: ${m}%`} tone="teal" /><span className="tabular font-semibold text-navy-900">{m}%</span></li>)}{TEST_MARKS.length === 0 && <li className="text-sm text-gray-600">No tests yet. The first model test comes about ten days after the start.</li>}</ul><p className="mt-4 rounded-input bg-offwhite-50 p-3 text-sm text-gray-600">Tutor note: {kid.tut ? `${kid.short} is settling in well. Keep up the weekly practice sets.` : 'steady improvement in comprehension. Needs more practice on tenses.'}</p></Card></div><MonthlyReport kid={kid} /></>}</div>) }}</Scoped>
}

export function Payments() {
  const s = useStore()
  return <Scoped perm="payments" what="Payments">{(kid) => { const p = payState(kid, s.dayOffset); return (<div><PageHead title="Payments" tag="PAY-P" sub="A record of fees. TuitionHub does not take or move money." /><Who kid={kid} />
    {!kid.tuition ? <NoTuition kid={kid} /> : <><Card><div className="flex flex-wrap items-center gap-3"><div className="min-w-0 flex-1"><p className="text-sm text-gray-600">{monthLabel(p.month)}</p><p className="font-heading text-2xl font-bold text-navy-900 tabular">{money(tutOf(kid).fee)}</p></div>
      <Chip tone={p.state === 'paid' ? 'green' : p.state === 'overdue' ? 'red' : p.state === 'due' ? 'amber' : 'blue'}>{p.state === 'paid' ? 'Paid' : p.state === 'overdue' ? 'Overdue' : p.state === 'due' ? 'Due soon' : 'Upcoming'}</Chip>
      {p.state !== 'paid' && <Button variant="secondary" onClick={() => { s.setPJ((x) => ({ kids: x.kids.map((k) => (k.id === kid.id ? { ...k, paid: [...k.paid, p.month] } : k)) })); s.toast(`Recorded: ${monthLabel(p.month)} fee paid`, 'success') }}>Mark as paid</Button>}</div>
      <p className="mt-3 text-xs text-gray-600">Marking as paid only updates this record. Pay your tutor directly, for example by bKash or cash.</p></Card>
      <h2 className="mt-6 text-lg">History</h2><Card pad={false} className="mt-2"><ul className="divide-y divide-gray-100">{kid.paid.filter((m) => m !== p.month).map((m) => <li key={m} className="flex items-center gap-3 p-3 text-sm"><span className="flex-1 font-medium text-navy-900">{monthLabel(m)}</span><span className="tabular">{money(tutOf(kid).fee)}</span><Chip tone="green" icon={<CheckCircle2 size={12} aria-hidden />}>Paid</Chip></li>)}{kid.paid.filter((m) => m !== p.month).length === 0 && <li className="p-4 text-sm text-gray-600">No earlier payments.</li>}</ul></Card></>}</div>) }}</Scoped>
}
