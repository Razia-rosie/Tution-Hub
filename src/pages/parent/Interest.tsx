import { Link } from 'react-router'
import { Check, MessageSquare, X } from 'lucide-react'
import { Avatar, Button, Card, Chip, DemoTag, EmptyState } from '../../components/ui'
import { money } from '../../lib/pmatch'
import { declinePatch, interestPatch, tutorAcceptsPatch, tutorBy, usePJ } from './pj'


function Who({ id }: { id: string }) {
  const { base: A } = usePJ()
  const t = tutorBy(id)
  if (!t) return null
  return <div className="flex min-w-0 flex-1 items-center gap-3"><Avatar name={t.name} size={40} /><div className="min-w-0"><Link to={`${A}/find-tutor/${t.id}`} className="font-semibold text-navy-900 hover:underline">{t.name}</Link><p className="text-xs text-gray-600">{t.subjects.join(', ')} · {t.area} · {money(t.fee)}/month · Trust {t.trust}</p></div></div>
}

export default function InterestPanel() {
  const { s, kid, kj, set, canAct, why, base: A, me } = usePJ()
  const inc = Object.entries(kj.incoming); const out = Object.entries(kj.sent)
  if (!kid) return null
  return (
    <div className="space-y-6">
      <section aria-labelledby="inc-h"><h2 id="inc-h" className="mb-2 text-lg">Tutors who sent interest <span className="text-sm font-normal text-gray-600">({inc.filter(([, v]) => v === 'received').length} waiting)</span></h2>
        {inc.length === 0 ? <Card><EmptyState title="No tutor interest yet" body={me === 'student' ? 'When a tutor sends you interest it appears here with Accept and Decline.' : kj.post ? `Tutors who like ${kid.short}'s post will appear here with Accept and Decline.` : `Publish a post for ${kid.short} and interested tutors will appear here.`} /></Card> : (
          <Card pad={false}><ul className="divide-y divide-gray-100">{inc.map(([id, v]) => (
            <li key={id} className="flex flex-wrap items-center gap-3 p-4"><Who id={id} />
              {v === 'received' ? <div className="flex gap-2"><Button size="sm" disabled={!canAct} title={canAct ? undefined : why} icon={<Check size={14} />} onClick={() => { set((k) => interestPatch(k, id)); s.toast('Accepted. Chat is open.', 'success') }}>Accept</Button><Button size="sm" variant="secondary" icon={<X size={14} />} onClick={() => { set((k) => declinePatch(k, id)); s.toast('Declined. The tutor is told politely.', 'info') }}>Decline</Button></div>
                : v === 'accepted' ? <Link to={`${A}/messages/${id}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:underline"><MessageSquare size={14} aria-hidden /> Open chat</Link> : <Chip tone="gray">Declined</Chip>}</li>))}</ul></Card>)}
      </section>
      <section aria-labelledby="out-h"><h2 id="out-h" className="mb-2 text-lg">Interest you sent</h2>
        {out.length === 0 ? <Card><EmptyState title="You have not sent interest yet" body="Open Find Tutor and choose Send interest on a tutor you like." action={<Link to={`${A}/find-tutor`} className="text-sm font-semibold text-blue-600 hover:underline">Find a tutor</Link>} /></Card> : (
          <Card pad={false}><ul className="divide-y divide-gray-100">{out.map(([id, v]) => (
            <li key={id} className="flex flex-wrap items-center gap-3 p-4"><Who id={id} />
              {v === 'mutual' ? <Link to={`${A}/messages/${id}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:underline"><MessageSquare size={14} aria-hidden /> Mutual. Open chat</Link>
                : <div className="flex flex-wrap items-center gap-2"><Chip tone="amber">Waiting for the tutor</Chip><Button size="sm" variant="secondary" onClick={() => { set((k) => tutorAcceptsPatch(k, id)); s.toast('Demo: the tutor accepted. Chat is open.', 'success') }}>Simulate tutor accepting</Button><DemoTag /></div>}</li>))}</ul></Card>)}
      </section>
    </div>
  )
}
