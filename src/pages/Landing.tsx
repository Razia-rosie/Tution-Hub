import { useState } from 'react'
import { Link } from 'react-router'
import {
  ArrowRight, BadgeCheck, Baby, Bell, Building2, Check, CheckCircle2, ClipboardCheck, EyeOff, FlaskConical, GraduationCap,
  LineChart, MapPin, MessagesSquare, Minus, RefreshCcw, ShieldCheck, Sparkles, Star, Trophy, UserCheck, Users,
} from 'lucide-react'
import { btnClass, cx, ProgressRing } from '../components/ui'

const SW = 1.5

function Section({ id, tone = 'light', children, className }: { id?: string; tone?: 'light' | 'white'; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} className={cx('py-24', tone === 'white' ? 'border-y border-gray-200 bg-white' : '', className)}>
      <div className="mx-auto max-w-[1200px] px-6">{children}</div>
    </section>
  )
}
function Heading({ eyebrow, title, body, center }: { eyebrow: string; title: string; body?: string; center?: boolean }) {
  return (
    <div className={cx('max-w-2xl', center && 'mx-auto text-center')}>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-700">{eyebrow}</p>
      <h2 className="mt-3 text-[28px] leading-9 md:text-[32px] md:leading-10">{title}</h2>
      {body && <p className="mt-3 text-base text-gray-600">{body}</p>}
    </div>
  )
}
const lift = 'transition duration-200 hover:-translate-y-0.5 hover:shadow-popover'
const card = 'rounded-card border border-gray-200 bg-white shadow-card'

/* ---------- Hero ---------- */
// What the platform really does, shown as a product summary rather than a sample person.
const HERO_POINTS: [typeof ShieldCheck, string, string][] = [
  [BadgeCheck, 'Manually verified', 'Every tutor and coaching centre is checked by our team from photos of their documents.'],
  [MessagesSquare, 'Private until agreed', 'Chat inside TuitionHub; phone and address are shared only after both sides confirm.'],
  [ClipboardCheck, 'Managed after hiring', 'Classroom, schedule, attendance, homework, diary and fee tracking in one place.'],
]

function HeroPreview() {
  return (
    <div className="relative mx-auto w-full max-w-[520px] pb-10 pt-4 lg:mx-0 lg:ml-auto">
      <div aria-hidden className="absolute inset-x-6 top-0 h-full rounded-modal border border-white/10 bg-white/5" />
      <ul className="relative space-y-4 rounded-modal bg-white p-5 shadow-modal sm:p-6">
        {HERO_POINTS.map(([I, t, d]) => (
          <li key={t} className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success-100 text-teal-700"><I size={20} strokeWidth={SW} aria-hidden /></span>
            <div><p className="font-heading font-bold text-navy-900">{t}</p><p className="text-sm text-gray-600">{d}</p></div>
          </li>
        ))}
      </ul>
      <div className="absolute -bottom-0 right-2 flex max-w-[270px] items-start gap-3 rounded-card border border-gray-200 bg-white p-3 shadow-popover sm:-right-2">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success-100 text-emerald-600"><Bell size={18} strokeWidth={SW} aria-hidden /></span>
        <div><p className="text-sm font-semibold text-navy-900">Guardians stay informed</p><p className="text-xs text-gray-600">Absences, homework and class changes are notified.</p></div>
      </div>
    </div>
  )
}

function Hero() {
  return (
    <section className="relative overflow-hidden bg-navy-900 text-white" style={{ backgroundImage: 'linear-gradient(180deg, #0A1F44 0%, #0D2754 100%)' }}>
      <div className="mx-auto grid max-w-[1200px] items-center gap-12 px-6 py-16 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:py-24">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/20 px-3 py-1 text-xs font-semibold tracking-wide text-navy-200">
            <ShieldCheck size={14} strokeWidth={SW} aria-hidden /> Verified. Safety-first. Made for Bangladesh.
          </p>
          <h1 className="mt-6 text-[36px] leading-[44px] text-white sm:text-5xl sm:leading-[56px]">Find, fix and manage tuition in one verified, safety-first place.</h1>
          <p className="mt-5 max-w-xl text-lg text-navy-200">Every tutor, guardian and student is verified, and every tuition is managed from first match to final review.</p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link to="/find-tutor" className={btnClass('primary', 'lg')}>Find a Tutor</Link>
            <Link to="/signup/parent" className={cx(btnClass('secondary', 'lg'), '!border-white/40 !bg-transparent !text-white hover:!bg-white/10')}>Post a Tuition</Link>
          </div>
          <Link to="/find-tuition" className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-white underline-offset-4 hover:underline">
            Find Tuition <ArrowRight size={16} strokeWidth={SW} aria-hidden />
          </Link>
        </div>
        <HeroPreview />
      </div>
    </section>
  )
}

/* ---------- Trust strip ---------- */
const TRUST = [
  { icon: UserCheck, t: 'Verified tutors and centres', d: 'Identity documents reviewed by hand before anyone is listed.' },
  { icon: Users, t: 'Students stay in control', d: "A guardian sees a child's classes only after the child approves the link." },
  { icon: EyeOff, t: 'Privacy-first', d: 'Exact address stays hidden until agreement.' },
  { icon: LineChart, t: 'Real reviews only', d: 'Only families with a confirmed tuition can leave a review.' },
]
function TrustStrip() {
  return (
    <section className="border-b border-gray-200 bg-white">
      <ul className="mx-auto grid max-w-[1200px] gap-8 px-6 py-12 sm:grid-cols-2 lg:grid-cols-4">
        {TRUST.map(({ icon: I, t, d }) => (
          <li key={t} className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-card bg-blue-100 text-navy-900"><I size={22} strokeWidth={SW} aria-hidden /></span>
            <div><h3 className="text-base">{t}</h3><p className="mt-1 text-sm text-gray-600">{d}</p></div>
          </li>
        ))}
      </ul>
    </section>
  )
}

/* ---------- How it works ---------- */
const STEPS = [
  { icon: ShieldCheck, t: 'Verify', d: 'Tutors and coaching centres upload document photos; our team reviews each one by hand.' },
  { icon: Sparkles, t: 'Find', d: 'Families search verified tutors or post a tuition; tutors apply to posts.' },
  { icon: MessagesSquare, t: 'Chat and agree', d: 'Chat opens when a request or application is accepted. A demo class, then both sides confirm terms.' },
  { icon: ClipboardCheck, t: 'Manage', d: 'Schedule, attendance, homework and payment tracking in one place.' },
  { icon: Trophy, t: 'Review', d: 'Reviews unlock once a tuition is confirmed and shape each tutor\'s rating.' },
]
function HowItWorks() {
  return (
    <Section id="how">
      <Heading eyebrow="How it works" title="From first match to final review, one connected flow" />
      <ol className="mt-14 grid gap-10 md:grid-cols-5 md:gap-6">
        {STEPS.map(({ icon: I, t, d }, i) => (
          <li key={t} className="relative min-w-0">
            {i < STEPS.length - 1 && <span aria-hidden className="absolute left-14 top-6 hidden h-px w-[calc(100%-2rem)] bg-gray-200 md:block" />}
            <div className="relative flex items-center gap-3 md:block">
              <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-navy-900 shadow-card"><I size={22} strokeWidth={SW} aria-hidden /></span>
              <p className="font-heading text-sm font-semibold text-gray-600 tabular md:mt-4">Step {i + 1}</p>
            </div>
            <h3 className="mt-1 text-lg md:mt-1">{t}</h3>
            <p className="mt-1.5 text-sm text-gray-600">{d}</p>
          </li>
        ))}
      </ol>
    </Section>
  )
}

/* ---------- Roles ---------- */
const ROLE_CARDS = [
  { icon: GraduationCap, t: 'Join as Tutor', to: '/signup/tutor', cta: 'Register as a tutor', b: ['Apply to tuition posts and answer chat requests', 'Earn Identity and Education Verified badges', 'Run classrooms, attendance, homework and fee tracking'] },
  { icon: Baby, t: 'Join as Parent', to: '/signup/parent', cta: 'Register as a parent', b: ['Search verified tutors and coaching centres', "Follow each child's attendance, homework and results", 'Get notified about absences, homework and class changes'] },
  { icon: Building2, t: 'Join as Coaching', to: '/signup/coaching', cta: 'Register your centre', b: ['Run batches, classes and exams in one place', 'Track student results and parent communication', 'Show a Verified Organization badge'] },
]
function Roles() {
  return (
    <Section tone="white">
      <Heading eyebrow="Who it is for" title="One platform, built for each side of tuition" />
      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {ROLE_CARDS.map(({ icon: I, t, to, cta, b }) => (
          <div key={t} className={cx(card, lift, 'flex min-w-0 flex-col p-6')}>
            <span className="flex h-11 w-11 items-center justify-center rounded-card bg-navy-900 text-white"><I size={22} strokeWidth={SW} aria-hidden /></span>
            <h3 className="mt-5 text-xl">{t}</h3>
            <ul className="mt-4 flex-1 space-y-3">
              {b.map((x) => <li key={x} className="flex items-start gap-2.5 text-sm text-charcoal-900"><Check size={16} strokeWidth={2} className="mt-0.5 shrink-0 text-navy-700" aria-hidden />{x}</li>)}
            </ul>
            <Link to={to} className={cx(btnClass('primary', 'md'), 'mt-6 w-full')}>{cta} <ArrowRight size={16} strokeWidth={SW} aria-hidden /></Link>
          </div>
        ))}
      </div>
    </Section>
  )
}

/* ---------- Differentiators ---------- */
function MiniBars({ rows }: { rows: [string, number][] }) {
  return <div className="space-y-2">{rows.map(([l, v]) => (
    <div key={l}><div className="flex justify-between text-xs"><span className="text-gray-600">{l}</span><span className="font-semibold text-navy-900 tabular">{v}</span></div><div className="mt-1 h-1.5 rounded-full bg-gray-100"><div className="h-1.5 rounded-full bg-navy-700" style={{ width: `${v}%` }} /></div></div>))}</div>
}
function Snippet({ children }: { children: React.ReactNode }) { return <div className="mt-5 rounded-input border border-gray-200 bg-offwhite-50 p-4">{children}</div> }

function ChildSwitch() {
  const [c, setC] = useState<'Ayaan' | 'Mim'>('Ayaan')
  const d = { Ayaan: ['Class 8', 'Mathematics', '94% attendance'], Mim: ['Class 10', 'Physics', '88% attendance'] }[c]
  return (
    <Snippet>
      <div role="tablist" aria-label="Child" className="inline-flex rounded-input bg-gray-100 p-0.5">
        {(['Ayaan', 'Mim'] as const).map((n) => <button key={n} role="tab" aria-selected={c === n} onClick={() => setC(n)} className={cx('rounded-[6px] px-3 py-1 text-xs font-semibold', c === n ? 'bg-white text-navy-900 shadow-card' : 'text-gray-600')}>{n}</button>)}
      </div>
      <p className="mt-3 text-sm font-semibold text-navy-900">{d[0]} · {d[1]}</p><p className="text-xs text-gray-600">{d[2]}</p>
    </Snippet>
  )
}

const DIFFS: { icon: typeof Sparkles; t: string; d: string; snippet: React.ReactNode }[] = [
  { icon: Sparkles, t: 'Focused search', d: 'Filter verified tutors by subject, class, area, mode and fee; filter tuition posts the same way.', snippet: <Snippet><ul className="space-y-1.5 text-sm"><li className="flex justify-between"><span className="text-gray-600">Subject</span><span className="font-semibold">Physics</span></li><li className="flex justify-between"><span className="text-gray-600">Area</span><span className="font-semibold">Uttara</span></li><li className="flex justify-between"><span className="text-gray-600">Mode</span><span className="font-semibold">Offline</span></li></ul></Snippet> },
  { icon: ShieldCheck, t: 'Human verification', d: 'No automated checks: an administrator looks at every ID and licence photo, then approves, rejects or asks for corrections.', snippet: <Snippet><div className="flex items-center gap-3"><ProgressRing value={100} size={48} label="Reviewed" /><p className="text-sm text-navy-900">Pending → Reviewed by our team → Verified</p></div></Snippet> },
  { icon: ClipboardCheck, t: 'Complete tuition management', d: 'Schedule, attendance, homework and payment tracking after you hire.', snippet: <Snippet><ul className="space-y-2 text-sm"><li className="flex justify-between"><span className="text-gray-600">Attendance</span><span className="font-semibold tabular">92%</span></li><li className="flex justify-between"><span className="text-gray-600">Homework</span><span className="font-semibold tabular">18/20</span></li><li className="flex items-center justify-between"><span className="text-gray-600">Oct fee ৳6,000</span><span className="rounded-input bg-warning-100 px-2 py-0.5 text-xs font-semibold text-warning-600">Pending</span></li></ul></Snippet> },
  { icon: LineChart, t: 'Progress at a glance', d: 'Attendance, graded homework and published exam results for each child.', snippet: <Snippet><svg viewBox="0 0 200 64" className="h-16 w-full" role="img" aria-label="Tuition marks rising from 62 to 82, school marks rising from 60 to 70"><polyline fill="none" stroke="#9AA5B1" strokeWidth="2" strokeDasharray="4 3" points="8,44 56,42 104,38 152,35 192,30" /><polyline fill="none" stroke="#12336B" strokeWidth="2.5" strokeLinecap="round" points="8,46 56,38 104,30 152,20 192,10" /></svg><div className="mt-1 flex gap-4 text-xs text-gray-600"><span className="flex items-center gap-1"><i className="inline-block h-0.5 w-4 bg-navy-700" />Tuition tests</span><span className="flex items-center gap-1"><i className="inline-block h-0.5 w-4 bg-gray-400" />School exams</span></div></Snippet> },
  { icon: RefreshCcw, t: 'Messages that stay', d: 'Chat requests, conversations and history are saved, with unread counts and blocking.', snippet: <Snippet><p className="text-xs font-semibold text-blue-600">2 unread</p><p className="mt-1 text-sm text-navy-900">“Sunday at 6:30 works for us.”</p><p className="mt-1 text-xs text-gray-600">Phone shared after the tuition is confirmed</p></Snippet> },
  { icon: Users, t: 'Multi-child support', d: "One guardian account linked to each child's student account, with separate classrooms and reports.", snippet: <ChildSwitch /> },
]
function Differentiators() {
  return (
    <Section>
      <Heading eyebrow="What sets it apart" title="Built for what happens after you find a tutor" body="Matching is the start. TuitionHub also handles trust, management, progress and continuity." />
      <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {DIFFS.map(({ icon: I, t, d, snippet }) => (
          <article key={t} className={cx(card, lift, 'min-w-0 p-6')}>
            <span className="flex h-10 w-10 items-center justify-center rounded-card bg-blue-100 text-navy-900"><I size={20} strokeWidth={SW} aria-hidden /></span>
            <h3 className="mt-4 text-lg">{t}</h3><p className="mt-1.5 text-sm text-gray-600">{d}</p>
            {snippet}
          </article>
        ))}
      </div>
    </Section>
  )
}

/* ---------- Safety ---------- */
const TIMELINE = [
  { icon: MapPin, t: 'Class scheduled', d: 'The tutor adds the class to the shared schedule; changes and cancellations are notified.', time: 'Before' },
  { icon: CheckCircle2, t: 'Attendance marked', d: 'Present, late or absent is recorded for each student.', time: 'In class', ok: true },
  { icon: Bell, t: 'Absence alert', d: 'If a student is marked absent, their linked guardian is notified straight away.', time: 'In class' },
  { icon: Bell, t: 'Diary and homework', d: "The day's topics and homework are posted; graded work is visible to the student and guardian.", time: 'After' },
]
function Safety() {
  return (
    <Section tone="white" id="safety">
      <div className="grid items-start gap-12 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <Heading eyebrow="Safety" title="Parents stay informed at every class" body="Attendance, absences, class changes and homework reach linked guardians as notifications, so nobody is guessing." />
          <Link to="/safety" className={cx(btnClass('secondary'), 'mt-6')}>Read about safety <ArrowRight size={16} strokeWidth={SW} aria-hidden /></Link>
        </div>
        <ol className={cx(card, 'p-6 sm:p-8')} aria-label="Safety timeline">
          {TIMELINE.map(({ icon: I, t, d, time, ok }, i) => (
            <li key={i} className="relative flex gap-4 pb-8 last:pb-0">
              {i < TIMELINE.length - 1 && <span aria-hidden className="absolute left-5 top-11 h-[calc(100%-2.75rem)] w-px bg-gray-200" />}
              <span className={cx('relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full', ok ? 'bg-success-100 text-emerald-600' : 'bg-blue-100 text-navy-900')}><I size={20} strokeWidth={SW} aria-hidden /></span>
              <div className="min-w-0 flex-1 pt-1"><div className="flex items-baseline justify-between gap-3"><h3 className="text-base">{t}</h3><span className="text-xs text-gray-600 tabular">{time}</span></div><p className="mt-1 text-sm text-gray-600">{d}</p></div>
            </li>
          ))}
        </ol>
      </div>
    </Section>
  )
}

function Closing() {
  return (
    <Section>
      <div className="flex flex-col items-start justify-between gap-6 rounded-modal bg-navy-900 p-8 sm:p-12 md:flex-row md:items-center">
        <div><h2 className="max-w-xl text-2xl text-white md:text-[32px] md:leading-10">Start with a verified profile.</h2><p className="mt-2 text-navy-200">Create an account in minutes and see your role dashboard.</p></div>
        <div className="flex flex-wrap gap-3"><Link to="/signup" className={btnClass('primary', 'lg')}>Sign up</Link><Link to="/login" className={cx(btnClass('secondary', 'lg'), '!border-white/40 !bg-transparent !text-white hover:!bg-white/10')}>Log in</Link></div>
      </div>
    </Section>
  )
}

export default function Landing() {
  return (
    <>
      <Hero />
      <TrustStrip />
      <HowItWorks />
      <Roles />
      <Differentiators />
      <Safety />
      <Closing />
    </>
  )
}
