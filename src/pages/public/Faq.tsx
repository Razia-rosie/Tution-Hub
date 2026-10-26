import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { ChevronDown, Search } from 'lucide-react'
import { FAQS } from '../../lib/data'
import { btnClass, cx, EmptyState, Input } from '../../components/ui'
import { PageHero, Section } from '../../components/public/bits'

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
