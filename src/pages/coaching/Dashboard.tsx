import { useState } from 'react'
import { Link } from 'react-router'
import { BarChart3, Baby, BookOpen, CheckSquare, ClipboardList, FileBarChart, GraduationCap, Layers, Plus, School, ShieldCheck, UserPlus, Users, Wallet } from 'lucide-react'
import { useStore } from '../../lib/store'
import { ORG, classesOn, counts } from '../../lib/coaching'
import { Card, Chip, DemoTag, EmptyState, ErrorState, Select, Skeleton, StatusChip, btnClass, cx } from '../../components/ui'
import { Locked, PageHead, StatLink } from '../../components/tutor/bits'

const A = '/app/coaching'
export default function Dashboard() {
  const s = useStore(); const cj = s.cj; const [view, setView] = useState('Normal')
  const off = s.dayOffset; const verified = s.isVerified; const vs = s.verification.coaching
  const empty = view.startsWith('Empty'); const c = counts(cj, off)
  const picker = <label className="flex items-center gap-2 text-xs text-gray-600"><DemoTag label="Demo view" /><Select aria-label="Dashboard view state" value={view} onChange={(e) => setView(e.target.value)} options={['Normal', 'Loading', 'Empty (new organization)', 'Error']} className="!w-auto !py-1.5" /></label>
  const head = <PageHead title="Dashboard" tag="DASH-C" sub={`${cj.profile.name}, ${cj.profile.area}. Today is ${s.demoDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}.`} actions={<><StatusChip state={vs} />{picker}</>} />
  const grid = 'grid grid-cols-2 gap-4 lg:grid-cols-4'
  if (view === 'Loading') return <div>{head}<div className={grid} aria-busy="true" aria-label="Loading dashboard">{Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div></div>
  if (view === 'Error') return <div>{head}<Card><ErrorState title="We could not load the dashboard" onRetry={() => setView('Normal')} /></Card></div>
  const n = (v: number) => (empty ? '0' : String(v))
  const cards = [
    { l: 'Teachers', v: n(c.teachers), sub: `${cj.teachers.filter((t) => t.status === 'invited').length && !empty ? cj.teachers.filter((t) => t.status === 'invited').length + ' invited' : 'Open Teachers'}`, to: 'teachers', i: <Users size={20} /> },
    { l: 'Students', v: n(c.students), sub: 'Open Students', to: 'students', i: <GraduationCap size={20} /> },
    { l: 'Batches', v: n(c.batches), sub: 'Open Batches', to: 'batches', i: <Layers size={20} /> },
    { l: 'Classes today', v: n(c.classesToday), sub: `${empty ? 0 : c.classesWeek} this week`, to: 'classes', i: <School size={20} /> },
    { l: 'Attendance', v: empty || c.attendance === null ? '—' : `${c.attendance}%`, sub: !empty && c.unmarked ? `${c.unmarked} to mark` : 'Open Attendance', to: 'attendance', i: <CheckSquare size={20} />, tone: !empty && c.unmarked ? 'amber' as const : undefined },
    { l: 'Homework', v: n(c.hwDue), sub: 'Due soon', to: 'homework', i: <BookOpen size={20} /> },
    { l: 'Exams', v: n(c.examsUp), sub: 'Upcoming or unpublished', to: 'exams', i: <ClipboardList size={20} /> },
    { l: 'Results', v: n(c.published), sub: 'Published', to: 'results', i: <BarChart3 size={20} />, tone: 'blue' as const },
    { l: 'Parents', v: n(c.parents), sub: 'Linked, contacts masked', to: 'parents', i: <Baby size={20} /> },
    { l: 'Reports', v: n(c.reportsSent), sub: !empty && c.reportsDraft ? `${c.reportsDraft} draft` : 'Parent reports sent', to: 'reports', i: <FileBarChart size={20} /> },
    { l: 'Payments', v: empty ? '৳0' : `৳${c.feesDue.toLocaleString('en-IN')}`, sub: empty ? 'Nothing due' : `Due from ${c.feesCount} students`, to: 'payments', i: <Wallet size={20} />, tone: !empty && c.feesDue ? 'amber' as const : undefined },
    { l: 'Verification', v: vs === 'verified' ? 'Verified' : vs.replace('_', ' ').replace(/^./, (x) => x.toUpperCase()), sub: vs === 'verified' ? 'Verified Organization' : 'Open Verification', to: 'verification', i: <ShieldCheck size={20} /> },
  ]
  const quick: [string, string, React.ReactNode][] = [['Add a student', 'students', <UserPlus size={18} key="a" />], ['Add a teacher', 'teachers', <Users size={18} key="b" />], ['Create a batch', 'batches', <Plus size={18} key="c" />], ['Mark attendance', 'attendance', <CheckSquare size={18} key="d" />]]
  const today = classesOn(cj, off)
  const pending = cj.exams.filter((e) => !e.published && e.day <= off)
  return (
    <div>
      {head}
      {!verified && (
        <div className="mb-6"><Card className="border-warning-600/40 bg-warning-100/60"><p className="font-heading text-lg font-bold text-navy-900">Limited dashboard, read-only</p>
          <p className="mt-1 text-sm text-gray-600">You can look around. Adding students and teachers, taking attendance and sending parent reports unlock when your organization is verified.</p>
          <Link to={`${A}/verification${vs === 'not_started' || vs === 'draft' ? '' : '/status'}`} className={cx(btnClass('primary'), 'mt-3')}>{vs === 'not_started' ? 'Start verification' : vs === 'draft' ? 'Continue verification' : 'View verification status'}</Link></Card></div>
      )}
      <div className={grid}>{cards.map((x) => <StatLink key={x.l} to={`${A}/${x.to}`} label={x.l} value={x.v} sub={x.sub} icon={x.i} tone={x.tone} />)}</div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card><h2 className="text-lg">{empty ? 'Get started' : 'Classes today'}</h2>
          {empty ? <div className="mt-3"><EmptyState title="Your organization is set up" body="Add a teacher, then a student and a batch. Classes, attendance and results appear here once you do." action={verified ? <Link to={`${A}/teachers`} className={btnClass('primary')}>Add your first teacher</Link> : <Link to={`${A}/verification`} className={btnClass('primary')}>Continue verification</Link>} /></div>
            : today.length === 0 ? <p className="mt-3 text-sm text-gray-600">No classes today. <Link to={`${A}/classes`} className="font-semibold text-blue-600 hover:underline">See the schedule</Link></p>
              : <ul className="mt-3 divide-y divide-gray-100">{today.map((k) => { const b = cj.batches.find((x) => x.id === k.batchId)!; const t = cj.teachers.find((x) => x.id === b.teacherId)
                return <li key={k.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"><span><b className="text-navy-900">{b.name}</b><span className="block text-gray-600">{t?.name} · {k.room}</span></span><span className="tabular text-gray-600">{k.time}</span></li> })}</ul>}
          {!empty && <div className="mt-4 border-t border-gray-100 pt-4"><h3 className="text-base">Quick actions</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">{quick.map(([l, to, ic], i) => verified
              ? <Link key={to} to={`${A}/${to}`} className={i === 0 ? 'flex min-h-11 items-center gap-3 rounded-input border border-blue-600 bg-blue-600 p-3 text-sm font-semibold text-white hover:bg-blue-700' : 'flex min-h-11 items-center gap-3 rounded-input border border-gray-200 p-3 text-sm font-semibold text-navy-900 hover:border-blue-600'}><span className={i === 0 ? 'text-white' : 'text-blue-600'}>{ic}</span>{l}</Link>
              : <span key={to} title={`${l} is locked until your organization is verified`} className="flex min-h-11 cursor-not-allowed items-center gap-3 rounded-input border border-gray-200 bg-gray-100 p-3 text-sm font-semibold text-gray-600"><span>{ic}</span>{l}<Chip tone="amber">Locked</Chip></span>)}</div></div>}
        </Card>
        <Card><h2 className="text-lg">What is next</h2>
          {empty ? <p className="mt-3 text-sm text-gray-600">Nothing yet. Your to-do list fills in as you add teachers, students and batches.</p> : (
            <ul className="mt-3 space-y-2 text-sm">
              {c.unmarked > 0 && <li>{c.unmarked} class{c.unmarked > 1 ? 'es' : ''} waiting for attendance. <Link to={`${A}/attendance`} className="font-semibold text-blue-600 hover:underline">Mark now</Link></li>}
              {pending.map((e) => <li key={e.id}>{e.title} has no published results. <Link to={`${A}/exams`} className="font-semibold text-blue-600 hover:underline">Enter marks</Link></li>)}
              {c.hwDue > 0 && <li>{c.hwDue} homework item{c.hwDue > 1 ? 's' : ''} due soon. <Link to={`${A}/homework`} className="font-semibold text-blue-600 hover:underline">Open homework</Link></li>}
              {c.feesCount > 0 && <li>৳{c.feesDue.toLocaleString('en-IN')} unpaid from {c.feesCount} students. <Link to={`${A}/payments`} className="font-semibold text-blue-600 hover:underline">Open payments</Link></li>}
              {c.reportsDraft > 0 && <li>{c.reportsDraft} parent report ready to send. <Link to={`${A}/reports`} className="font-semibold text-blue-600 hover:underline">Open reports</Link></li>}
              {cj.teachers.some((t) => t.status === 'invited') && <li>{cj.teachers.filter((t) => t.status === 'invited').length} teacher invite waiting. <Link to={`${A}/teachers`} className="font-semibold text-blue-600 hover:underline">Open teachers</Link></li>}
            </ul>)}
        </Card>
      </div>
      {!verified && <div className="mt-6"><Locked what="Adding people and sending reports"><Link to={`${A}/verification`} className="text-sm font-semibold text-blue-600 hover:underline">Continue verification</Link></Locked></div>}
      <p className="mt-6 text-xs text-gray-600"><DemoTag /> Names, classes and amounts are fictional. You only see your own teachers, students and batches. Fees are tracked, not collected.</p>
    </div>
  )
}
