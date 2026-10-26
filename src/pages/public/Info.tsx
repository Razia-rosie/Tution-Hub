import { Link } from 'react-router'
import { ArrowRight, BadgeCheck, Bell, CheckCircle2, Eye, EyeOff, FileText, Flag, GraduationCap, HeartHandshake, Home, Lock, MapPin, MessageSquare, ScanSearch, ShieldCheck, Users, Building2, UserX, Search, Handshake } from 'lucide-react'
import { btnClass, Card, Chip, DemoTag } from '../../components/ui'
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
  { role: 'Parent / Guardian', icon: Users, to: '/signup/parent', steps: ['Verify yourself and link your child', 'Post a tuition or search tutors', 'Review matches and accept an interest', 'Chat, agree on terms, start the tuition', 'Follow attendance, homework and monthly reports'] },
  { role: 'Tutor', icon: GraduationCap, to: '/signup/tutor', steps: ['Complete identity, education and experience checks', 'Post availability or browse tuition posts', 'Send interest and chat after a mutual match', 'Confirm the agreement and start teaching', 'Build trust through reviews, attendance and progress'] },
  { role: 'Student', icon: HeartHandshake, to: '/signup/student', steps: ['Verify your student status', 'Post what you need or find a tutor', 'Compare matches with plain-language reasons', 'Study with a clear schedule and homework list', 'See your own progress improve'] },
  { role: 'Coaching / Institute', icon: Building2, to: '/signup/coaching', steps: ['Register and verify your organization', 'Add teachers, students and batches', 'Run classes, attendance and exams', 'Publish results and parent reports', 'Be discoverable in the coaching directory'] },
]

export function HowItWorksPage() {
  return (
    <>
      <PageHero eyebrow="How it works" title="One loop, built so everyone knows who they are dealing with."
        lead="Every tuition on TuitionHub follows the same path: verify, match, agree, teach, review. The steps are the same for everyone, so parents never have to guess." />
      <Section title="The core loop" lead="Five stages, each with a clear check before moving on.">
        <ol className="grid gap-4 md:grid-cols-5">
          {[['Verify', 'Identity, education and student or guardian status.', ShieldCheck], ['Match', 'Transparent score across subject, class, schedule, location and budget.', ScanSearch], ['Agree', 'Mutual interest, chat, then a digital agreement.', Handshake], ['Teach', 'Schedule, attendance, homework and safety notifications.', Home], ['Review', 'Verified reviews and reports after completion.', BadgeCheck]].map(([t, b, I], i) => {
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
      <Section title="How matching decides" lead="Matching is a transparent rule-based score, not a black box. This is a demo weighting, shown so you can see why a tutor appears.">
        <Card className="max-w-3xl">
          <div className="mb-3 flex items-center gap-2"><Chip tone="blue">Demo weights</Chip><DemoTag label="Demo" title="Illustrative weights. Not machine learning." /></div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
            {[['Subject', 25], ['Class', 15], ['Schedule', 15], ['Location', 15], ['Budget', 15], ['Verification', 5], ['Experience', 5], ['Preferences', 5]].map(([k, v]) => <div key={k as string}><dt className="text-gray-600">{k}</dt><dd className="tabular font-heading text-xl font-bold text-navy-900">{v}</dd></div>)}
          </dl>
          <p className="mt-4 text-sm text-gray-600">A tutor who does not teach the requested subject is excluded, whatever the other scores.</p>
        </Card>
      </Section>
      <Cta title="Ready to see it in action?" body="Create a free account and explore a fully demo-data prototype." />
    </>
  )
}

const SAFETY = [
  { icon: BadgeCheck, t: 'Everyone is verified', b: 'Tutors, students and guardians each pass a role-specific check before they can contact anyone.' },
  { icon: MapPin, t: 'Approximate location first', b: 'Only the area is shown until both sides agree. The exact address is revealed to the tutor only, on request, and logged.' },
  { icon: Bell, t: 'Parents are told in real time', b: 'Arrival and completion notifications go to the guardian for every class.' },
  { icon: MessageSquare, t: 'Chat opens after mutual interest', b: 'No cold messages. Both sides must agree to connect first.' },
  { icon: Flag, t: 'Report and block, always', b: 'Every profile, post and conversation has Report and Block. Reports go to trained reviewers.' },
  { icon: EyeOff, t: 'Documents stay masked', b: 'NID and certificates are masked for everyone except authorised reviewers, and each reveal is audited.' },
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
      <Section tint title="Class safety timeline" lead="Every class follows the same four notifications, so a guardian is never left wondering.">
        <ol className="grid gap-4 md:grid-cols-4">
          {['Tutor arrives at the tuition', 'Parent is notified', 'Class is completed', 'Parent is notified again'].map((s, i) => (
            <li key={s} className="relative rounded-card border border-gray-200 bg-offwhite-50 p-6"><span className="tabular flex h-8 w-8 items-center justify-center rounded-full bg-navy-900 text-sm font-bold text-white">{i + 1}</span><p className="mt-3 font-medium text-navy-900">{s}</p></li>
          ))}
        </ol>
        <p className="mt-4 flex items-center gap-2 text-sm text-gray-600"><DemoTag label="Demo" /> Check-ins are simulated by a button. There is no GPS verification in this prototype.</p>
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
      <PageHero eyebrow="About TuitionHub" title="A calmer, safer way to find a tutor in Bangladesh." lead="TuitionHub is a prototype for a safety-first tutoring marketplace. It starts from trust, then adds matching, scheduling and progress on top." />
      <Section title="What we believe">
        <div className="grid gap-4 md:grid-cols-3">
          {[['Trust before convenience', 'A tutor in your home should be someone you can verify, not just someone you can message.', ShieldCheck], ['Plain language for parents', 'Every dashboard begins with what happened today, in words, one child at a time.', Users], ['Honest scoring', 'Ratings come from verified reviews only. Trust Score and rank are separate, and we show how they are built.', FileText]].map(([t, b, I]) => {
            const Icon = I as typeof Users
            return <Card key={t as string}><Icon className="text-blue-600" strokeWidth={1.5} aria-hidden /><h3 className="mt-4 text-lg">{t as string}</h3><p className="mt-1 text-sm text-gray-600">{b as string}</p></Card>
          })}
        </div>
      </Section>
      <Section tint title="About this prototype">
        <div className="grid items-start gap-8 md:grid-cols-2">
          <div className="space-y-3 text-gray-600">
            <p>This is a clickable demonstration. Every person, tuition, review, score and fee in it is fictional.</p>
            <p>There is no real OTP, payment processing, GPS, AI or database. Simulated behaviour carries a <DemoTag /> tag, and the Demo controls drawer lets you switch role, simulate verification and fast-forward time.</p>
          </div>
          <Card><h3 className="text-lg">Explore the prototype</h3><ul className="mt-3 space-y-2 text-sm">
            <li><Link to="/reference" className="font-semibold text-blue-600 hover:underline">Reference: screen inventory</Link></li>
            <li><Link to="/design-system" className="font-semibold text-blue-600 hover:underline">Design system</Link></li>
            <li><Link to="/login" className="font-semibold text-blue-600 hover:underline">Log in with a demo account</Link></li>
          </ul></Card>
        </div>
      </Section>
      <Cta title="Be part of the pilot story" body="Create a demo account and walk through each role." />
    </>
  )
}

export { Cta, Eye, Lock, CheckCircle2, Search }
