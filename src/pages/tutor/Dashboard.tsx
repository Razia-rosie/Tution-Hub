import { useState } from 'react'
import { Link } from 'react-router'
import { BookOpenCheck, CalendarClock, CheckSquare, Inbox, Search, Star, Trophy, Users, Wallet, FileText, MessageSquare, Plus } from 'lucide-react'
import { useStore } from '../../lib/store'
import { stats } from '../../lib/journey'
import { Card, Chip, DemoTag, EmptyState, ErrorState, Select, Skeleton, StatusChip } from '../../components/ui'
import { Locked, PageHead, StatLink } from '../../components/tutor/bits'

const A = '/app/tutor'
export default function Dashboard() {
  const s = useStore(); const j = s.journey; const [view, setView] = useState('Normal')
  const st = stats(j, s.dayOffset); const verified = s.isVerified
  const quick: [string, string, React.ReactNode][] = [['Find tuition', 'find-tuition', <Search size={18} key="a" />], ['Post availability', 'my-posts', <Plus size={18} key="b" />], ['Messages', 'messages', <MessageSquare size={18} key="c" />], ['Add homework', 'homework', <FileText size={18} key="d" />]]
  const picker = <label className="flex items-center gap-2 text-xs text-gray-600"><DemoTag label="Demo view" /><Select aria-label="Dashboard view state" value={view} onChange={(e) => setView(e.target.value)} options={['Normal', 'Loading', 'Empty (new account)', 'Error']} className="!w-auto !py-1.5" /></label>
  const head = <PageHead title="Dashboard" tag="DASH-T" sub={`Welcome back, Tanvir. Today is ${s.demoDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}.`} actions={<><StatusChip state={s.verification.tutor} />{picker}</>} />
  if (view === 'Loading') return <div>{head}<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true" aria-label="Loading dashboard">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div></div>
  if (view === 'Error') return <div>{head}<Card><ErrorState title="We could not load your dashboard" onRetry={() => setView('Normal')} /></Card></div>
  const empty = view.startsWith('Empty')
  const cards = [
    { l: 'Active Tuitions', v: empty ? '0' : String(st.active && j.tuition === 'active' ? 1 : 0), sub: 'Open My Students', to: 'my-students', i: <BookOpenCheck size={20} /> },
    { l: 'Pending Requests', v: empty ? '0' : String(st.requests), sub: 'Open requests', to: 'my-posts', i: <Inbox size={20} />, tone: 'amber' as const },
    { l: 'Upcoming Classes', v: empty ? '0' : String(st.upcoming), sub: 'Open Schedule', to: 'schedule', i: <CalendarClock size={20} /> },
    { l: 'Students', v: empty ? '0' : String(st.active ? 1 : 0), sub: 'Open My Students', to: 'my-students', i: <Users size={20} /> },
    { l: 'Attendance', v: empty || !st.counted ? '—' : `${st.attendancePct}%`, sub: st.unmarked ? `${st.unmarked} to mark` : 'Open Attendance', to: 'attendance', i: <CheckSquare size={20} /> },
    { l: 'Rating', v: empty ? '—' : '4.9', sub: empty ? 'No reviews yet' : `${31 + (j.reviewReceived || Object.values(s.pj.kj).some((k) => k.review && k.tutorId === 'tanvir-ahmed-rahman') ? 1 : 0)} verified reviews`, to: 'reviews', i: <Star size={20} />, tone: 'blue' as const },
    { l: 'Rank', v: empty ? '—' : '#12', sub: 'Overall · #4 Maths', to: 'ranking', i: <Trophy size={20} />, tone: 'blue' as const },
    { l: 'Earnings', v: empty ? '৳0' : `৳${st.earned.toLocaleString('en-IN')}`, sub: 'Confirmed payments, tracked', to: 'payments', i: <Wallet size={20} /> },
  ]
  return (
    <div>
      {head}
      {!verified && (
        <div className="mb-6 space-y-3"><Card className="border-warning-600/40 bg-warning-100/60"><p className="font-heading text-lg font-bold text-navy-900">Limited dashboard, read-only</p>
          <p className="mt-1 text-sm text-gray-600">You can browse tuition and see how matching works. Sending interest, chat and posting unlock when verification is approved.</p>
          <Link to={`${A}/verification`} className="mt-3 inline-block rounded-input bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">{s.verification.tutor === 'not_started' ? 'Start verification' : 'Open Verification Center'}</Link></Card></div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{cards.map((c) => <StatLink key={c.l} to={`${A}/${c.to}`} label={c.l} value={c.v} sub={c.sub} icon={c.i} tone={c.tone} />)}</div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card><h2 className="text-lg">Quick actions</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">{quick.map(([l, to, ic], n) => verified || to === 'find-tuition'
            ? <Link key={to} to={`${A}/${to}`} className={n === 0 && !empty && verified ? "flex min-h-11 items-center gap-3 rounded-input border border-blue-600 bg-blue-600 p-3 text-sm font-semibold text-white hover:bg-blue-700" : "flex min-h-11 items-center gap-3 rounded-input border border-gray-200 p-3 text-sm font-semibold text-navy-900 hover:border-blue-600"}><span className={n === 0 && !empty && verified ? "text-white" : "text-blue-600"}>{ic}</span>{l}</Link>
            : <span key={to} title={`${l} is locked until you are verified`} className="flex cursor-not-allowed items-center gap-3 rounded-input border border-gray-200 bg-gray-100 p-3 text-sm font-semibold text-gray-600"><span>{ic}</span>{l}<Chip tone="amber">Locked</Chip></span>)}</div></Card>
        <Card><h2 className="text-lg">What is next</h2>
          {empty ? <EmptyState title="Nothing here yet" body="Find a tuition that fits your subjects and send interest to begin." action={<Link to={`${A}/find-tuition`} className="inline-flex min-h-11 items-center rounded-input bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">Find tuition</Link>} /> : (
            <ul className="mt-3 space-y-2 text-sm">
              {j.tuition === 'none' && <li>Review your top match, <b>92% Physics, HSC, Uttara</b>. <Link to={`${A}/find-tuition`} className="font-semibold text-blue-600 hover:underline">Open matches</Link></li>}
              {j.interests['p-2'] === 'sent' && <li>Interest sent for Physics, HSC. Waiting for the guardian. <Link to={`${A}/find-tuition`} className="font-semibold text-blue-600 hover:underline">View</Link></li>}
              {j.interests['p-2'] === 'mutual' && j.tuition !== 'active' && j.tuition !== 'completed' && <li>Mutual interest! Chat and draft the agreement. <Link to={`${A}/messages`} className="font-semibold text-blue-600 hover:underline">Open chat</Link></li>}
              {st.unmarked > 0 && <li>{st.unmarked} class{st.unmarked > 1 ? 'es' : ''} waiting for attendance. <Link to={`${A}/attendance`} className="font-semibold text-blue-600 hover:underline">Mark now</Link></li>}
              {st.requests > 0 && <li>{st.requests} guardian request{st.requests > 1 ? 's' : ''} to answer. <Link to={`${A}/my-posts`} className="font-semibold text-blue-600 hover:underline">Respond</Link></li>}
              {j.tuition === 'active' && <li>Tuition active: Physics, HSC with Ayaan. <Link to={`${A}/my-students`} className="font-semibold text-blue-600 hover:underline">Open</Link></li>}
            </ul>)}
        </Card>
      </div>
      {!verified && <div className="mt-6"><Locked what="Interest, chat and posting" /></div>}
      <p className="mt-6 text-xs text-gray-600"><DemoTag /> Earnings are confirmed payment records only. TuitionHub does not move money.</p>
    </div>
  )
}
