import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { AlertTriangle, Bell, BookOpen, CalendarClock, CheckSquare, ClipboardList, LineChart, MessageSquare, Search, ShieldCheck, Star, User } from 'lucide-react'
import { PageHead } from '../../components/tutor/bits'
import { Avatar, Card, DemoTag, EmptyState, ErrorState, Select, Skeleton, StatusChip, VerifyBadge, Chip } from '../../components/ui'
import { attendanceStats, classesFor, dateOf, fmt, hwFor, testMarksFor } from '../../lib/parent'
import { studentKid, STUDENT } from '../../lib/student'
import { useStore } from '../../lib/store'

const A = '/app/student'
const btn = 'rounded-input bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700'
const btn2 = 'rounded-input border border-gray-400 px-4 py-2.5 text-sm font-semibold text-navy-900 hover:bg-gray-100'

function Sec({ icon, title, to, link, children }: { icon: ReactNode; title: string; to: string; link: string; children: ReactNode }) {
  return (
    <Card><div className="flex items-center gap-2"><span className="text-blue-600">{icon}</span><h2 className="text-lg">{title}</h2><Link to={`${A}/${to}`} className="ml-auto text-sm font-semibold text-blue-600 hover:underline">{link}</Link></div><div className="mt-3 text-sm">{children}</div></Card>
  )
}
const day = (n: number, off: number) => (n === off ? 'today' : n - off === 1 ? 'tomorrow' : fmt(dateOf(n)))

export default function Dashboard() {
  const s = useStore(); const sj = s.sj; const [view, setView] = useState('Live'); const off = s.dayOffset
  const vs = s.verification.student; const first = (sj.form.fullName || STUDENT.name).split(' ')[0]
  const picker = <label className="flex items-center gap-2 text-xs text-gray-600"><DemoTag label="Demo view" /><Select aria-label="Dashboard view state" value={view} onChange={(e) => setView(e.target.value)} options={['Live', 'Loading', 'Empty', 'Error']} className="!w-auto !py-1.5" /></label>
  const head = <PageHead title={`Hello, ${first}`} tag="DASH-S" sub={`Today is ${s.demoDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}.`} actions={<><StatusChip state={vs} />{picker}</>} />
  if (view === 'Loading') return <div>{head}<div className="space-y-4" aria-busy="true" aria-label="Loading dashboard"><Skeleton className="h-28" /><Skeleton className="h-56" /><Skeleton className="h-32" /></div></div>
  if (view === 'Error') return <div>{head}<Card><ErrorState title="We could not load your dashboard" onRetry={() => setView('Live')} /></Card></div>
  const banner = null
  const kid = studentKid(sj)
  if (view === 'Empty' || !sj.tut) return (
    <div>{head}{banner}
      <Card><EmptyState title="No tuition yet" body="Find a verified tutor and send interest. Your classes, homework, attendance and progress will show up here once a tuition starts." action={<div className="flex flex-wrap justify-center gap-2"><Link to={`${A}/find-tutor`} className={btn}>Find a tutor</Link><Link to={`${A}/profile`} className={btn2}>My profile</Link></div>} /></Card>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Sec icon={<MessageSquare size={18} aria-hidden />} title="Messages" to="messages" link="Open"><p className="text-gray-600">No conversations yet. Chat opens after a tutor and you both show interest.</p></Sec>
        <Sec icon={<Bell size={18} aria-hidden />} title="Notifications" to="notifications" link="View all"><ul className="space-y-2"><li>Welcome to TuitionHub, {first}.</li>{vs !== 'verified' && <li>Finish verification to send interest.</li>}</ul></Sec>
      </div>
      <p className="mt-6 text-xs text-gray-600"><DemoTag /> Names, classes and amounts are fictional. You only ever see your own data.</p>
    </div>
  )
  const t = sj.tut; const cls = classesFor(kid, off); const today = cls.find((c) => c.day === off); const upcoming = cls.filter((c) => c.day > off).slice(0, 3)
  const hw = hwFor(kid, off); const due = hw.filter((h) => h.state === 'assigned' && h.kind === 'Homework').sort((a, b) => a.due - b.due); const asg = hw.filter((h) => h.kind === 'Assignment')
  const at = attendanceStats(kid, off); const marks = testMarksFor(kid, off); const fb = hw.filter((h) => h.feedback)
  const tutorId = t.tutorId
  return (
    <div>{head}{banner}
      <Card pad={false} className="overflow-hidden">
        <div className="flex flex-col gap-4 bg-navy-900 p-5 text-white sm:flex-row sm:items-center">
          <span className="hidden h-14 w-14 shrink-0 place-items-center rounded-full bg-white/10 sm:grid"><CalendarClock aria-hidden /></span>
          <div className="min-w-0 flex-1"><p className="text-xs font-semibold uppercase tracking-wide text-blue-100">Today's class</p>
            <p className="font-heading text-xl font-bold">{today ? `${t.subject} at ${t.time}` : 'No class today'}</p>
            <p className="text-sm text-blue-100">{today ? `with ${t.tutor} · ${t.area}` : upcoming[0] ? `Next: ${fmt(dateOf(upcoming[0].day))}, ${t.time}` : 'Nothing scheduled'}</p></div>
          <Link to={`${A}/schedule`} className="rounded-input bg-white px-4 py-2.5 text-center text-sm font-semibold text-navy-900 hover:bg-blue-100">Open schedule</Link>
        </div>
      </Card>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Sec icon={<CalendarClock size={18} aria-hidden />} title="Upcoming classes" to="schedule" link="Schedule">
          {upcoming.length ? <ul className="divide-y divide-gray-100">{upcoming.map((c) => <li key={c.id} className="flex items-center justify-between py-2"><span className="font-semibold text-navy-900">{fmt(dateOf(c.day))}</span><span className="text-gray-600">{t.time}</span></li>)}</ul> : <p className="text-gray-600">No upcoming classes.</p>}</Sec>
        <Sec icon={<User size={18} aria-hidden />} title="Current tutor" to="tutor" link="Profile">
          <div className="flex items-center gap-3"><Avatar name={t.tutor} size={44} /><div className="min-w-0"><p className="font-semibold text-navy-900">{t.tutor}</p><p className="text-gray-600">{t.subject} · {t.days}</p></div></div>
          <div className="mt-3 flex flex-wrap gap-2"><VerifyBadge kind="identity" /><VerifyBadge kind="education" /></div>
          <p className="mt-2 text-xs text-gray-600">Tutor since {t.since}. Contact stays inside TuitionHub chat.</p></Sec>
        <Sec icon={<BookOpen size={18} aria-hidden />} title="Homework" to="homework" link="All homework">
          {due.length ? <ul className="space-y-2">{due.slice(0, 3).map((h) => <li key={h.id} className="flex items-center justify-between gap-2"><span className="min-w-0 truncate text-navy-900">{h.title}</span><Chip tone={h.due - off <= 1 ? 'amber' : 'blue'}>Due {day(h.due, off)}</Chip></li>)}</ul> : <p className="text-gray-600">All homework is done.</p>}</Sec>
        <Sec icon={<ClipboardList size={18} aria-hidden />} title="Assignments" to="assignments" link="Open">
          {asg.length ? <ul className="space-y-2">{asg.map((h) => <li key={h.id} className="flex items-center justify-between gap-2"><span className="min-w-0 truncate text-navy-900">{h.title}</span><Chip tone={h.state === 'reviewed' ? 'green' : h.state === 'submitted' ? 'blue' : 'amber'}>{h.state === 'assigned' ? `Due ${day(h.due, off)}` : h.state === 'submitted' ? 'Submitted' : 'Reviewed'}</Chip></li>)}</ul> : <p className="text-gray-600">No assignments.</p>}</Sec>
        <Sec icon={<CheckSquare size={18} aria-hidden />} title="Attendance" to="attendance" link="Details">
          {at.total ? <><p className="text-2xl font-bold text-navy-900 tabular">{at.pct}%</p><p className="text-gray-600">Present in {at.present} of the last {at.total} classes.</p><p className="mt-1 text-xs text-gray-600">Your tutor marks attendance. You can view it but not change it.</p></> : <p className="text-gray-600">No classes held yet.</p>}</Sec>
        <Sec icon={<LineChart size={18} aria-hidden />} title="Progress" to="progress" link="See progress">
          {marks.length ? <><p className="text-gray-600">Latest test mark</p><p className="text-2xl font-bold text-navy-900 tabular">{marks[marks.length - 1]}%</p><div className="mt-2 flex h-10 items-end gap-1" aria-hidden>{marks.map((m, i) => <span key={i} className="flex-1 rounded-t bg-teal-600/80" style={{ height: `${m}%` }} />)}</div></> : <p className="text-gray-600">Your first test result will appear here.</p>}</Sec>
        <Sec icon={<Star size={18} aria-hidden />} title="Feedback" to="assignments" link="Read all">
          {fb.length ? <blockquote className="border-l-2 border-teal-600 pl-3 text-gray-600">"{fb[fb.length - 1].feedback}"<footer className="mt-1 text-xs">{t.tutor} on {fb[fb.length - 1].title.split(':')[0]}, {fb[fb.length - 1].score}</footer></blockquote> : <p className="text-gray-600">Tutor feedback will show here after your first review.</p>}</Sec>
        <Sec icon={<MessageSquare size={18} aria-hidden />} title="Messages" to="messages" link="Open chat"><p className="text-gray-600">{t.tutor}: "See you at {t.time.split('–')[0]} on {t.days.split(',')[0]}."</p></Sec>
        <Sec icon={<Bell size={18} aria-hidden />} title="Notifications" to="notifications" link="View all"><ul className="space-y-2">{due[0] && <li>Homework due {day(due[0].due, off)}: {due[0].title}.</li>}{today && <li>Class today at {t.time.split('–')[0]}.</li>}<li>{t.tutor} is your tutor since {t.since}.</li></ul></Sec>
        <Card><h2 className="text-lg">Quick actions</h2><div className="mt-3 grid gap-2 sm:grid-cols-2">{([['Find a tutor', 'find-tutor', <Search size={18} key="a" />], ['Homework', 'homework', <BookOpen size={18} key="b" />], ['Messages', 'messages', <MessageSquare size={18} key="c" />], ['Safety', 'safety', <AlertTriangle size={18} key="d" />]] as const).map(([l, to, i], n) => <Link key={to} to={`${A}/${to}`} className={"flex min-h-11 items-center gap-3 rounded-input border border-gray-200 p-3 text-sm font-semibold text-navy-900 hover:border-blue-600"}><span className="text-blue-600">{i}</span>{l}</Link>)}</div></Card>
      </div>
      <p className="mt-6 text-xs text-gray-600" data-tutor={tutorId}><DemoTag /> Names, classes and amounts are fictional. You only ever see your own data. Fees and payments are managed by your guardian.</p>
    </div>
  )
}
