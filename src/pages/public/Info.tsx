import { Link } from 'react-router'
import { ArrowRight, BadgeCheck, Bell, CheckCircle2, Eye, EyeOff, FileText, Flag, GraduationCap, HeartHandshake, Home, Lock, MapPin, MessageSquare, ScanSearch, ShieldCheck, Users, Building2, UserX, Search, Handshake } from 'lucide-react'
import { btnClass, Card } from '../../components/ui'
import { PageHero, Section } from '../../components/public/bits'

function Cta({ title, body }: { title: string; body: string }) {
  return (
    <section className="bg-navy-900 py-16 text-center">
      <div className="mx-auto max-w-2xl px-6">
        <h2 className="text-3xl !text-white">{title}</h2>
        <p className="mt-3 text-blue-100">{body}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/signup" className={btnClass('primary', 'lg')}>Create free account</Link>
          <Link to="/find-tutor" className="inline-flex min-h-11 items-center rounded-input border border-white/40 px-6 py-3.5 font-semibold text-white hover:bg-white/10">Browse tutors</Link>
        </div>
      </div>
    </section>
  )
}

const FLOWS = [
  { role: 'Parent / Guardian', icon: Users, to: '/signup/parent', steps: ["Link your child's student account (your child approves)", 'Post a tuition or search verified tutors', 'Accept an application or a chat request', 'Book a demo class, then both sides confirm terms', 'Follow attendance, homework, diary and results'] },
  { role: 'Tutor', icon: GraduationCap, to: '/signup/tutor', steps: ['Upload a photo of your ID; our team reviews it by hand', 'Browse tuition posts and apply', 'Chat once a guardian accepts', 'Run the demo class and confirm terms', 'Teach from your classroom: schedule, attendance, homework, diary'] },
  { role: 'Student', icon: HeartHandshake, to: '/signup/student', steps: ['Create your student account', 'Approve your guardian, or search tutors yourself', 'Join your classroom once a tuition starts', 'Submit homework and see feedback', 'Track your attendance and results'] },
  { role: 'Coaching / Institute', icon: Building2, to: '/signup/coaching', steps: ['Upload your trade licence and owner ID for manual review', 'Add teachers, courses, students and batches', 'Run classes, attendance and homework', 'Enter marks, publish results, track fees', 'Be listed in the coaching directory'] },
]

export function HowItWorksPage() {
  return (
    <>
      <PageHero eyebrow="How it works" title="One loop, built so everyone knows who they are dealing with."
        lead="Every tuition on TuitionHub follows the same path: verify, find, agree, teach, review. The steps are the same for everyone, so parents never have to guess." />
      <Section title="The core loop" lead="Five stages, each with a clear check before moving on.">
        <ol className="grid gap-4 md:grid-cols-5">
          {[['Verify', 'Tutors and coaching centres are checked by hand from photos of their documents.', ShieldCheck], ['Find', 'Search with filters, or post a tuition and receive applications.', ScanSearch], ['Agree', 'Chat, a demo class, then both sides confirm the same terms.', Handshake], ['Teach', 'Schedule, attendance, homework, diary and guardian notifications.', Home], ['Review', 'Families with a confirmed tuition can review; anyone can report a problem.', BadgeCheck]].map(([t, b, I], i) => {
            const Icon = I as typeof ShieldCheck
            return (
              <li key={t as string} className="rounded-card border border-gray-200 bg-white p-6 shadow-card">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600"><Icon size={20} strokeWidth={1.5} aria-hidden /></span>
                <p className="mt-4 text-xs font-semibold text-gray-600">Step {i + 1}</p>
                <h3 className="text-lg">{t as string}</h3>
                <p className="mt-1 text-sm text-gray-600">{b as string}</p>
              </li>
            )
          })}
        </ol>
      </Section>
      <Section tint title="What it looks like for each role">
        <div className="grid gap-6 md:grid-cols-2">
          {FLOWS.map((f) => (
            <Card key={f.role} className="flex flex-col">
              <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-input bg-navy-900 text-white"><f.icon size={20} strokeWidth={1.5} aria-hidden /></span><h3 className="text-xl">{f.role}</h3></div>
              <ol className="mt-5 space-y-3">
                {f.steps.map((s, i) => <li key={s} className="flex gap-3 text-sm"><span className="tabular flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-navy-900">{i + 1}</span><span className="pt-0.5 text-charcoal-900">{s}</span></li>)}
              </ol>
              <Link to={f.to} className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:underline">Join as {f.role.split(' /')[0].toLowerCase()} <ArrowRight size={14} aria-hidden /></Link>
            </Card>
          ))}
        </div>
      </Section>
      <Section title="How search works" lead="No hidden ranking. You choose the filters; we list only verified tutors and centres.">
        <Card className="max-w-3xl">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
            {[['Filter by', 'Subject, class, area, mode, fee'], ['Listed only if', 'Verified and active'], ['Ordered by', 'Rating, then number of reviews']].map(([k, v]) => <div key={k}><dt className="text-gray-600">{k}</dt><dd className="font-medium text-navy-900">{v}</dd></div>)}
          </dl>
        </Card>
      </Section>
      <Cta title="Ready to start?" body="Create a free account for your role." />
    </>
  )
}

const SAFETY = [
  { icon: BadgeCheck, t: 'Teachers are verified by hand', b: 'Tutors and coaching centres upload photos of their ID or licence; a TuitionHub administrator reviews each one before they are listed.' },
  { icon: MapPin, t: 'Area only, until you agree', b: 'Searches show the area. Phone numbers and email are shared only after both sides confirm a tuition.' },
  { icon: Bell, t: 'Guardians are kept informed', b: 'Absences, class changes, new homework, grades and diary entries reach linked guardians as notifications.' },
  { icon: MessageSquare, t: 'No cold messages', b: 'Chat opens only when a tutor accepts your request or you accept their application.' },
  { icon: Flag, t: 'Report and block', b: 'Conversations have Report and Block, and posts can be reported. Reports go to the TuitionHub team.' },
  { icon: EyeOff, t: 'Documents stay private', b: 'Verification photos are visible only to their owner and administrators, and every administrator view is logged.' },
]

export function SafetyPage() {
  return (
    <>
      <PageHero eyebrow="Safety Center" title="Safety is the product, not a feature." lead="Tuition happens in homes and neighbourhoods. TuitionHub is designed around the worries parents actually have.">
        <div className="flex flex-wrap gap-3"><Link to="/signup/parent" className={btnClass('primary', 'lg')}>Join as a parent</Link><Link to="/contact" className={btnClass('secondary', 'lg')}>Report a concern</Link></div>
      </PageHero>
      <Section title="Six protections on every tuition">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SAFETY.map((s) => (
            <Card key={s.t}><span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600"><s.icon size={20} strokeWidth={1.5} aria-hidden /></span><h3 className="mt-4 text-lg">{s.t}</h3><p className="mt-1 text-sm text-gray-600">{s.b}</p></Card>
          ))}
        </div>
      </Section>
      <Section tint title="What guardians hear about" lead="Notifications go to every guardian linked to the student.">
        <ol className="grid gap-4 md:grid-cols-4">
          {['A class is scheduled, moved or cancelled', 'Attendance is marked; absences alert you', 'Homework is set and graded', 'The day\'s diary is posted'].map((s, i) => (
            <li key={s} className="relative rounded-card border border-gray-200 bg-offwhite-50 p-6"><span className="tabular flex h-8 w-8 items-center justify-center rounded-full bg-navy-900 text-sm font-bold text-white">{i + 1}</span><p className="mt-3 font-medium text-navy-900">{s}</p></li>
          ))}
        </ol>
      </Section>
      <Section title="What we never show publicly">
        <Card className="max-w-3xl"><ul className="grid gap-3 text-sm sm:grid-cols-2">
          {['National ID number', 'Full phone numbers', 'Exact home address', 'Uploaded documents', 'Children\'s full names or photos', 'Payment details'].map((x) => <li key={x} className="flex items-center gap-2 text-charcoal-900"><UserX size={16} className="text-danger-600" aria-hidden /> {x}</li>)}
        </ul></Card>
      </Section>
      <Cta title="Questions about safety?" body="Read the FAQ or contact the trust and safety team." />
    </>
  )
}

export function AboutPage() {
  return (
    <>
      <PageHero eyebrow="About TuitionHub" title="A calmer, safer way to find a tutor in Bangladesh." lead="TuitionHub is a safety-first tutoring marketplace. It starts from trust, then adds search, scheduling and progress on top." />
      <Section title="What we believe">
        <div className="grid gap-4 md:grid-cols-3">
          {[['Trust before convenience', 'A tutor in your home should be someone you can verify, not just someone you can message.', ShieldCheck], ['Plain language for parents', 'Every dashboard begins with what happened today, in words, one child at a time.', Users], ['Honest ratings', 'Only families with a confirmed tuition can review, and tutors can reply publicly.', FileText]].map(([t, b, I]) => {
            const Icon = I as typeof Users
            return <Card key={t as string}><Icon className="text-blue-600" strokeWidth={1.5} aria-hidden /><h3 className="mt-4 text-lg">{t as string}</h3><p className="mt-1 text-sm text-gray-600">{b as string}</p></Card>
          })}
        </div>
      </Section>
      <Section tint title="What TuitionHub does not do">
        <div className="space-y-3 text-gray-600">
          <p>TuitionHub does not move money. Fees are agreed and paid directly between families and tutors; the platform only records them so both sides have the same history.</p>
          <p>Verification is done by people, not software: there is no automated document scanning or face matching.</p>
        </div>
      </Section>
      <Cta title="Join TuitionHub" body="Create a free account for your role." />
    </>
  )
}

export { Cta, Eye, Lock, CheckCircle2, Search }
