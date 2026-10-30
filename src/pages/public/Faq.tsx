import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { ChevronDown, Search } from 'lucide-react'
import { btnClass, cx, EmptyState, Input } from '../../components/ui'
import { PageHero, Section } from '../../components/public/bits'

const FAQS: { cat: string; q: string; a: string }[] = [
  { cat: 'Getting started', q: 'How do I join TuitionHub?', a: 'Choose Sign up and pick your role: Tutor, Student, Parent / Guardian or Coaching / Institute. Tutors and coaching centres then upload photos of their documents for review; students and parents can start straight away.' },
  { cat: 'Getting started', q: 'Is TuitionHub free to browse?', a: 'Yes. Anyone can search verified tutors, coaching centres and open tuition posts. Contacting someone needs an account.' },
  { cat: 'Verification', q: 'How are tutors and coaching centres verified?', a: 'A TuitionHub administrator looks at the photos they upload (an ID for tutors; a trade licence and the owner\'s ID for centres) together with their details, then approves, rejects or asks for corrections. No automated scanning is used.' },
  { cat: 'Verification', q: 'What does "Education Verified" mean?', a: 'The tutor also uploaded an academic certificate or student ID, and it was part of the application an administrator approved.' },
  { cat: 'Verification', q: 'Who can see my uploaded documents?', a: 'Only you and TuitionHub administrators. Every time an administrator opens a document it is recorded in an audit log.' },
  { cat: 'Hiring', q: 'How do I find a tutor?', a: 'Search verified tutors by subject, class, area, mode and fee and send a chat request, or post your tuition need and accept an application from a tutor.' },
  { cat: 'Hiring', q: 'What is a demo class?', a: 'A trial class you request from a conversation with a tutor. After it, either side proposes terms (days, time, fee, start date) and the tuition starts when both confirm.' },
  { cat: 'Safety and privacy', q: 'Is my phone number or address shared?', a: 'No. Searches show only the area. Phone and email are shared between the tutor and the guardian only after both confirm a tuition.' },
  { cat: 'Safety and privacy', q: 'How do I link my child?', a: "Your child signs up as a Student. You send a link request with their account email under Children, and your child approves it from their profile. You then see only their classes, homework, attendance and results." },
  { cat: 'Safety and privacy', q: 'How do I report someone?', a: 'Use Report in a conversation, report a tuition post, or open Safety and support in your dashboard. Reports go to the TuitionHub team.' },
  { cat: 'Payments', q: 'Does TuitionHub process payments?', a: 'No. Fees are paid directly between you. The tutor records each month as due, the guardian marks it paid, and the tutor confirms, so both sides have the same record.' },
  { cat: 'Payments', q: 'Can I leave a review?', a: 'Guardians and students can review a tutor once their tuition is active or completed. Tutors can reply publicly.' },
  { cat: 'Account', q: 'I forgot my password. What now?', a: 'Use Forgot password on the log-in page. If you cannot reach your email, use Account recovery and the support team will contact you.' },
]

export default function Faq() {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<string | null>(FAQS[0].q)
  const list = useMemo(() => FAQS.filter((f) => (f.q + f.a + f.cat).toLowerCase().includes(q.trim().toLowerCase())), [q])
  const cats = [...new Set(list.map((f) => f.cat))]
  return (
    <>
      <PageHero eyebrow="FAQ" title="Answers, in plain language." lead="Search below or browse by topic. Can't find it? Contact the team.">
        <div className="relative max-w-lg">
          <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden />
          <Input aria-label="Search FAQ" placeholder="Search questions, e.g. address, payment" value={q} onChange={(e) => setQ(e.target.value)} className="pl-10" />
        </div>
      </PageHero>
      <Section>
        <div className="mx-auto max-w-3xl">
          <p className="mb-4 text-sm text-gray-600" aria-live="polite">{list.length} {list.length === 1 ? 'answer' : 'answers'}{q && ` for "${q}"`}</p>
          {list.length === 0 && <EmptyState title="No matching question" body="Try a shorter word, or ask us directly." action={<Link to="/contact" className={btnClass('primary')}>Contact us</Link>} />}
          {cats.map((c) => (
            <div key={c} className="mb-8">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-teal-700">{c}</h2>
              <div className="divide-y divide-gray-200 rounded-card border border-gray-200 bg-white shadow-card">
                {list.filter((f) => f.cat === c).map((f) => {
                  const isOpen = open === f.q
                  return (
                    <div key={f.q}>
                      <h3><button aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : f.q)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-heading text-base font-semibold text-navy-900 hover:bg-gray-100">
                        {f.q}<ChevronDown size={18} aria-hidden className={cx('shrink-0 transition-transform', isOpen && 'rotate-180')} />
                      </button></h3>
                      {isOpen && <p className="px-5 pb-5 text-sm leading-6 text-gray-600">{f.a}</p>}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </Section>
    </>
  )
}
