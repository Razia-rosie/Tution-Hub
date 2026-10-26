import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { AlertTriangle, BookOpen, CalendarClock, CheckCircle2, CheckSquare, Clock, Lock, MessageSquare, Plus, Search, Wallet, XCircle } from 'lucide-react'
import { PageHead } from '../../components/tutor/bits'
import { Avatar, Card, Chip, DemoTag, EmptyState, ErrorState, Select, Skeleton, StatusChip } from '../../components/ui'
import { tutOf, attendanceStats, classesFor, dateOf, dueDay, fmt, hwFor, monthLabel, payState, type Kid } from '../../lib/parent'
import { useKid } from './shared'
import { lastAbsent } from './Review'

const A = '/app/parent'
type Tone = 'green' | 'amber' | 'red' | 'blue' | 'gray'
const ic = { green: <CheckCircle2 size={12} aria-hidden />, amber: <Clock size={12} aria-hidden />, red: <XCircle size={12} aria-hidden />, blue: <CalendarClock size={12} aria-hidden />, gray: <Lock size={12} aria-hidden /> }
const money = (n: number) => `৳${n.toLocaleString('en-IN')}`

function Row({ icon, label, children, chip, tone, to }: { icon: ReactNode; label: string; children: ReactNode; chip: string; tone: Tone; to: string }) {
  return (
    <li><Link to={to} className="flex items-center gap-4 p-4 hover:bg-offwhite-50 focus-visible:outline-2">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-blue-100 text-navy-700">{icon}</span>
      <span className="min-w-0 flex-1"><span className="block text-xs font-semibold uppercase tracking-wide text-gray-600">{label}</span><span className="mt-0.5 block text-base font-semibold text-navy-900">{children}</span></span>
      <Chip tone={tone} icon={ic[tone]}>{chip}</Chip></Link></li>
  )
}

export function todaySummary(k: Kid, off: number) {
  const cls = classesFor(k, off); const today = cls.find((c) => c.day === off); const nextC = cls.find((c) => c.day > off)
  const at = attendanceStats(k, off); const hw = hwFor(k, off).filter((h) => h.state === 'assigned').sort((a, b) => a.due - b.due)
  return { today, nextC, at, hw, pay: payState(k, off) }
}

export default function Dashboard() {
  const { s, kids, kid } = useKid(); const [view, setView] = useState('Normal'); const off = s.dayOffset
  const picker = <label className="flex items-center gap-2 text-xs text-gray-600"><DemoTag label="Demo view" /><Select aria-label="Dashboard view state" value={view} onChange={(e) => setView(e.target.value)} options={['Normal', 'Loading', 'Empty (no child)', 'Error']} className="!w-auto !py-1.5" /></label>
  const head = <PageHead title="Dashboard" tag="DASH-P" sub={`Today is ${s.demoDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}.`} actions={<><StatusChip state={s.verification.parent} />{picker}</>} />
  if (view === 'Loading') return <div>{head}<div className="space-y-4" aria-busy="true" aria-label="Loading dashboard"><Skeleton className="h-20" /><Skeleton className="h-64" /><Skeleton className="h-32" /></div></div>
  if (view === 'Error') return <div>{head}<Card><ErrorState title="We could not load your dashboard" onRetry={() => setView('Normal')} /></Card></div>
  if (view.startsWith('Empty') || !kid) return (
    <div>{head}
      <Card><EmptyState title="Let's get you started" body="Two quick steps: confirm who you are, then link your child. After that, today's class, attendance, homework and fees show up right here." action={<div className="flex flex-wrap justify-center gap-2"><Link to={`${A}/settings/verification`} className="rounded-input bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">{s.verification.parent === 'verified' ? 'Verification done' : 'Verify my account'}</Link><Link to={`${A}/children/add`} className="rounded-input border border-gray-400 px-4 py-2.5 text-sm font-semibold text-navy-900 hover:bg-gray-100">Link a child</Link></div>} /></Card>
      {kids.length === 0 && s.pj.kids.length > 0 && <p className="mt-4 text-sm text-gray-600">{s.pj.kids.length} link request waiting for your child to confirm.</p>}
    </div>
  )
  const t = todaySummary(kid, off); const verified = s.verification.parent === 'verified'
  const pa = kid.perms.attendance; const pp = kid.perms.payments
  const dueLabel = fmt(dateOf(dueDay), { day: 'numeric', month: 'short' })
  return (
    <div>
      {head}
      {kids.length > 1 && <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Choose child">{kids.map((k) => <button key={k.id} onClick={() => s.setChild(k.short)} aria-pressed={k.id === kid.id} className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold md:min-h-0 ${k.id === kid.id ? 'border-blue-600 bg-blue-100 text-navy-900' : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-100'}`}><Avatar name={k.name} size={24} />{k.short}</button>)}</div>}
      <Card pad={false}>
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 p-5"><Avatar name={kid.name} size={48} />
          <div className="min-w-0 flex-1"><h2 className="text-xl">Today for {kid.short}</h2><p className="text-sm text-gray-600">{kid.cls} · {kid.school}</p></div></div>
        {!kid.tuition ? (
          <div className="p-5"><EmptyState title={`${kid.short} has no tuition yet`} body={`Find a verified tutor or post what ${kid.short} needs. Class, attendance and fees will appear here once a tuition starts.`} action={<div className="flex flex-wrap justify-center gap-2"><Link to={`${A}/find-tutor`} className="rounded-input bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">Find a tutor</Link><Link to={`${A}/my-posts`} className="rounded-input border border-gray-400 px-4 py-2.5 text-sm font-semibold text-navy-900 hover:bg-gray-100">Post a tuition</Link></div>} /></div>
        ) : (
          <ul className="divide-y divide-gray-100">
            <Row icon={<CalendarClock size={22} aria-hidden />} label="Class" to={`${A}/schedule`} tone={t.today ? 'blue' : 'gray'} chip={t.today ? 'Today' : 'No class today'}>
              {t.today ? `${tutOf(kid).subject} at ${tutOf(kid).time} with ${tutOf(kid).tutor}` : t.nextC ? `Next: ${fmt(dateOf(t.nextC.day))}, ${tutOf(kid).time}` : 'No class scheduled'}</Row>
            {pa ? <Row icon={<CheckSquare size={22} aria-hidden />} label="Attendance" to={`${A}/attendance`} tone={t.at.pct >= 85 ? 'green' : t.at.pct >= 70 ? 'amber' : 'red'} chip={t.at.pct >= 85 ? 'On track' : t.at.pct >= 70 ? 'Watch' : 'Low'}>
              {t.at.total ? `Present in ${t.at.present} of the last ${t.at.total} classes` : 'No classes held yet'}</Row>
              : <Row icon={<CheckSquare size={22} aria-hidden />} label="Attendance" to={`${A}/children/${kid.id}/permissions`} tone="gray" chip="Turned off">Hidden by your permission settings</Row>}
            <Row icon={<BookOpen size={22} aria-hidden />} label="Due soon" to={`${A}/homework`} tone={t.hw.length ? (t.hw[0].due - off <= 1 ? 'amber' : 'blue') : 'green'} chip={t.hw.length ? (t.hw[0].due - off <= 1 ? 'Due soon' : 'Upcoming') : 'All done'}>
              {t.hw.length ? `${t.hw[0].title}, due ${t.hw[0].due === off ? 'today' : t.hw[0].due - off === 1 ? 'tomorrow' : fmt(dateOf(t.hw[0].due))}` : 'Nothing is due'}</Row>
            {pp ? <Row icon={<Wallet size={22} aria-hidden />} label="Fee" to={`${A}/payments`} tone={t.pay.state === 'paid' ? 'green' : t.pay.state === 'overdue' ? 'red' : t.pay.state === 'due' ? 'amber' : 'blue'} chip={t.pay.state === 'paid' ? 'Paid' : t.pay.state === 'overdue' ? 'Overdue' : t.pay.state === 'due' ? 'Due soon' : 'Upcoming'}>
              {t.pay.state === 'paid' ? `${monthLabel(t.pay.month)}: ${money(tutOf(kid).fee)} paid` : t.pay.state === 'overdue' ? `${money(tutOf(kid).fee)} was due on ${dueLabel}, ${-t.pay.days} day${-t.pay.days > 1 ? 's' : ''} ago` : `${money(tutOf(kid).fee)} due on ${dueLabel}${t.pay.days === 0 ? ' (today)' : `, in ${t.pay.days} day${t.pay.days > 1 ? 's' : ''}`}`}</Row>
              : <Row icon={<Wallet size={22} aria-hidden />} label="Fee" to={`${A}/children/${kid.id}/permissions`} tone="gray" chip="Turned off">Hidden by your permission settings</Row>}
          </ul>
        )}
        {kid.tuition && <p className="border-t border-gray-100 p-4 text-xs text-gray-600"><AlertTriangle size={12} className="mr-1 inline text-warning-600" aria-hidden />Payments are tracked here. TuitionHub does not move money. <DemoTag /></p>}
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card><h2 className="text-lg">Quick actions</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">{([['Find a tutor', 'find-tutor', <Search size={18} key="a" />], ['Post a tuition', 'my-posts', <Plus size={18} key="b" />], ['Messages', 'messages', <MessageSquare size={18} key="c" />], ['Progress & reports', 'progress', <CheckSquare size={18} key="d" />]] as const).map(([l, to, i], n) => <Link key={to} to={`${A}/${to}`} className={n === 0 && !!kid.tuition ? "flex min-h-11 items-center gap-3 rounded-input border border-blue-600 bg-blue-600 p-3 text-sm font-semibold text-white hover:bg-blue-700" : "flex min-h-11 items-center gap-3 rounded-input border border-gray-200 p-3 text-sm font-semibold text-navy-900 hover:border-blue-600"}><span className={n === 0 && !!kid.tuition ? "text-white" : "text-blue-600"}>{i}</span>{l}</Link>)}</div></Card>
        <Card><h2 className="text-lg">What is next</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {!verified && <li>Finish your verification to post and chat. <Link to={`${A}/settings/verification`} className="font-semibold text-blue-600 hover:underline">Open</Link></li>}
            {kids.some((k) => !k.tuition) && <li>{kids.filter((k) => !k.tuition).map((k) => k.short).join(', ')} {kids.filter((k) => !k.tuition).length > 1 ? 'have' : 'has'} no tuition yet. <Link to={`${A}/find-tutor`} className="font-semibold text-blue-600 hover:underline">Find a tutor</Link></li>}
            {kid.tuition && t.pay.state !== 'paid' && pp && <li>Record the {monthLabel(t.pay.month).split(' ')[0]} fee once you pay. <Link to={`${A}/payments`} className="font-semibold text-blue-600 hover:underline">Open payments</Link></li>}
            {kid.tuition && lastAbsent(kid, off) && !s.pj.kj[kid.id]?.resched[lastAbsent(kid, off)!.id] && <li>{kid.short} missed a class on {fmt(dateOf(lastAbsent(kid, off)!.day))}. <Link to={`${A}/attendance`} className="font-semibold text-blue-600 hover:underline">Ask for a make-up class</Link></li>}
            {Object.values(s.pj.kj[kid.id]?.incoming ?? {}).includes('received') && <li>A tutor sent interest for {kid.short}. <Link to={`${A}/messages`} className="font-semibold text-blue-600 hover:underline">Respond</Link></li>}
            {s.pj.kids.some((k) => k.link === 'requested') && <li>A link request is waiting for your child. <Link to={`${A}/children`} className="font-semibold text-blue-600 hover:underline">View</Link></li>}
            {verified && kids.every((k) => k.tuition) && <li>Everything is up to date.</li>}
          </ul></Card>
      </div>
      <p className="mt-6 text-xs text-gray-600"><DemoTag /> All names, classes and amounts are fictional. You only ever see children linked to you.</p>
    </div>
  )
}
