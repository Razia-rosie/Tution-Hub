import { useState } from 'react'
import { Link } from 'react-router'
import { Award, BadgeCheck, Lock, Star } from 'lucide-react'
import { OLD_REVIEWS, REVIEW_NEW, stats, type Pay } from '../../lib/journey'
import { useStore } from '../../lib/store'
import { Bar, Button, Card, Chip, DemoTag, EmptyState, Field, Modal, Textarea, Select } from '../../components/ui'
import { PageHead } from '../../components/tutor/bits'

const A = '/app/tutor'
const Stars = ({ n }: { n: number }) => <span className="inline-flex" aria-label={`${n} out of 5 stars`}>{[1, 2, 3, 4, 5].map((i) => <Star key={i} size={14} className={i <= n ? 'fill-warning-600 text-warning-600' : 'text-gray-300'} aria-hidden />)}</span>

export function Reviews() {
  const s = useStore(); const j = s.journey; const [rep, setRep] = useState<string | null>(null); const [txt, setTxt] = useState(''); const [err, setErr] = useState('')
  const pr = Object.values(s.pj.kj).find((k) => k.review && k.tutorId === 'tanvir-ahmed-rahman')
  const fromParent = pr?.review ? { by: 'Mrs. Farzana Islam (guardian)', stars: pr.review.stars, subject: 'Physics, HSC', duration: '2 months', text: pr.review.text } : null
  const list = [...(j.reviewReceived || fromParent ? [{ id: 'new', ...(fromParent ?? REVIEW_NEW), reply: j.replies.new ?? '', isNew: true }] : []), ...OLD_REVIEWS.map((r) => ({ ...r, reply: r.reply || j.replies[r.id] || '', isNew: false }))]
  const save = () => { if (txt.trim().length < 5) { setErr('Write at least a short sentence.'); return } s.setJourney((x) => ({ replies: { ...x.replies, [rep!]: txt.trim() } })); setRep(null); setTxt(''); setErr(''); s.toast('Response published. It cannot be edited.', 'success') }
  return (
    <div>
      <PageHead title="Reviews" tag="REV-03" sub="Reviews come only from guardians and students of completed tuitions. You can respond once to each." actions={<Chip tone="green">{31 + (j.reviewReceived || fromParent ? 1 : 0)} verified reviews · 4.9</Chip>} />
      {!j.reviewReceived && !fromParent && <Card className="mb-5 bg-blue-100/50"><p className="text-sm text-gray-600">Your Physics, HSC tuition with Ayaan is not complete yet. Its review arrives after completion (REV-01, REV-02). <Link to={`${A}/my-students`} className="font-semibold text-blue-600 hover:underline">My Students</Link></p></Card>}
      <div className="space-y-4">{list.length === 0 ? <Card><EmptyState title="No reviews yet" body="Complete a tuition to receive your first verified review." /></Card> : list.map((r) => (
        <Card key={r.id} className={r.isNew ? 'border-teal-600' : ''}>
          <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold text-navy-900">{r.by}</p><span className="flex items-center gap-2"><Stars n={r.stars} /><Chip tone="green" icon={<BadgeCheck size={12} aria-hidden />}>Verified Review</Chip>{r.isNew && <Chip tone="blue">New</Chip>}</span></div>
          <p className="mt-0.5 text-xs text-gray-600">{r.subject} · {r.duration}</p><p className="mt-2 text-sm">{r.text}</p>
          {r.reply ? <p className="mt-3 rounded-input bg-gray-100 p-3 text-sm"><b className="text-navy-900">Your response:</b> {r.reply}</p> : <div className="mt-3"><Button size="sm" variant="secondary" onClick={() => { setRep(r.id); setTxt('') }}>Respond</Button></div>}
        </Card>))}</div>
      <Modal open={!!rep} onClose={() => setRep(null)} title="Respond to this review (REV-04)" footer={<><Button variant="secondary" onClick={() => setRep(null)}>Cancel</Button><Button onClick={save}>Publish response</Button></>}><Field label="Your response" hint="One response only. It becomes public." error={err}>{(i) => <Textarea id={i} value={txt} onChange={(e) => setTxt(e.target.value)} />}</Field></Modal>
    </div>
  )
}

const RANK = [['Verified reviews', 20, 17], ['Completed tuitions', 15, 11], ['Attendance', 15, 14], ['Student progress', 15, 12], ['Parent satisfaction', 15, 14], ['Cancellation rate', 10, 9], ['Experience', 10, 8]] as const
const TRUST = [['Verification', 20, 20], ['Reviews', 20, 18], ['Attendance', 20, 18], ['Qualifications', 15, 13], ['Experience', 10, 8], ['Performance', 10, 7], ['Response', 5, 3]] as const
export function Ranking() {
  const s = useStore(); const j = s.journey; const [tab, setTab] = useState<'rank' | 'trust'>('rank')
  const rows = tab === 'rank' ? RANK : TRUST; const bonus = j.tuition === 'completed' && tab === 'rank'
  return (
    <div>
      <PageHead title="Ranking" tag="RNK-01..03" sub="Transparent weighted scores. Refreshed weekly; this demo does not recalculate live." actions={<DemoTag label="Demo data" />} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">{[['Overall', '#12', 'of 148 verified tutors'], ['Mathematics', '#4', 'in Dhaka'], ['Uttara', '#2', 'in your area']].map(([l, v, sub]) => <Card key={l}><p className="text-sm text-gray-600">{l}</p><p className="font-heading text-4xl font-bold text-navy-900 tabular">{v}</p><p className="text-xs text-gray-600">{sub}</p></Card>)}</div>
      <div className="mb-4 inline-flex rounded-input border border-gray-300 bg-white p-1" role="tablist">{(['rank', 'trust'] as const).map((k) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`min-h-11 rounded-input px-4 py-1.5 text-sm font-semibold md:min-h-0 ${tab === k ? 'bg-navy-900 text-white' : 'text-gray-600'}`}>{k === 'rank' ? 'Rank score' : 'Trust Score (87)'}</button>)}</div>
      <Card><div className="space-y-4">{rows.map(([l, w, v]) => <Bar key={l} value={Math.round(((bonus && l === 'Completed tuitions' ? v + 2 : v) / w) * 100)} label={`${l}: ${bonus && l === 'Completed tuitions' ? v + 2 : v}/${w}`} tone="teal" />)}</div>
        <p className="mt-4 text-xs text-gray-600">{tab === 'rank' ? 'Weights: reviews 20, completed tuitions 15, attendance 15, progress 15, satisfaction 15, cancellations 10, experience 10.' : 'Weights: verification 20, reviews 20, attendance 20, qualifications 15, experience 10, performance 10, response 5.'}{bonus ? ' Completed tuitions increased after your latest completion.' : ''}</p></Card>
      <p className="mt-4 text-sm text-gray-600">Earn awards from the same activity. <Link to={`${A}/awards`} className="font-semibold text-blue-600 hover:underline">See awards</Link></p>
    </div>
  )
}

type Aw = { id: string; name: string; how: string; need: string; pct: number; earned: boolean }
function awards(j: ReturnType<typeof useStore>['journey'], day: number): Aw[] {
  const st = stats(j, day); const done = j.tuition === 'completed'
  return [
    { id: 'verified-trusted', name: 'Verified & Trusted', how: 'Complete identity, education and experience verification.', need: 'Verification approved', pct: 100, earned: true },
    { id: 'top-rated', name: 'Top Rated', how: 'Keep a 4.8+ rating over 20 verified reviews.', need: '31 reviews at 4.9', pct: 100, earned: true },
    { id: 'first-tuition', name: 'First Tuition Completed', how: 'Complete a tuition from agreement to review on TuitionHub.', need: 'Complete one tuition', pct: done ? 100 : j.tuition === 'active' ? 50 : 0, earned: done },
    { id: 'perfect-attendance', name: 'Perfect Attendance', how: 'Mark 8 classes with no absence or cancellation by you.', need: '8 classes held, 100% present', pct: Math.min(100, Math.round((st.present / 8) * 100) * (st.present === st.counted ? 1 : 0)), earned: st.present >= 8 && st.present === st.counted },
    { id: 'homework-hero', name: 'Homework Hero', how: 'Review 5 homework items with feedback.', need: '5 reviewed items', pct: Math.min(100, (j.hw.filter((h) => h.state === 'reviewed').length / 5) * 100), earned: j.hw.filter((h) => h.state === 'reviewed').length >= 5 },
  ]
}
export function Awards({ sub }: { sub: string }) {
  const s = useStore(); const list = awards(s.journey, s.dayOffset); const one = list.find((a) => a.id === sub)
  if (sub && !one) return <div><PageHead title="Award" tag="AWD-02" crumb={{ to: `${A}/awards`, label: 'Awards' }} /><Card><EmptyState title="Award not found" body="Pick one from the list." /></Card></div>
  if (one) return (
    <div><PageHead title={one.name} tag={one.earned ? 'AWD-02' : 'AWD-03'} crumb={{ to: `${A}/awards`, label: 'Awards' }} />
      <Card className="max-w-2xl"><div className="flex items-center gap-4"><span className={`grid h-16 w-16 place-items-center rounded-full ${one.earned ? 'bg-success-100 text-teal-700' : 'bg-gray-100 text-gray-600'}`}>{one.earned ? <Award size={30} aria-hidden /> : <Lock size={26} aria-hidden />}</span><div><Chip tone={one.earned ? 'green' : 'amber'}>{one.earned ? 'Earned' : 'In progress, locked'}</Chip><p className="mt-1 text-sm text-gray-600">{one.how}</p></div></div>
        <div className="mt-5"><Bar value={one.pct} label={`Progress: ${Math.round(one.pct)}%`} tone="teal" /></div><p className="mt-3 text-sm text-gray-600"><b className="text-navy-900">Requirement:</b> {one.need}</p>
        {one.earned && <p className="mt-2 text-sm text-gray-600">Shown on your public profile with the date earned.</p>}</Card></div>
  )
  return (
    <div><PageHead title="Awards" tag="AWD-01" sub="Earned by real activity. Locked awards show exactly how to earn them." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{list.map((a) => <Link key={a.id} to={`${A}/awards/${a.id}`} className="block rounded-card border border-gray-200 bg-white p-6 shadow-card hover:border-blue-600"><span className={`grid h-12 w-12 place-items-center rounded-full ${a.earned ? 'bg-success-100 text-teal-700' : 'bg-gray-100 text-gray-600'}`}>{a.earned ? <Award size={22} aria-hidden /> : <Lock size={20} aria-hidden />}</span><p className="mt-3 font-heading text-lg font-bold text-navy-900">{a.name}</p><p className="mt-1 text-xs text-gray-600">{a.earned ? 'Earned' : `${Math.round(a.pct)}% · locked`}</p></Link>)}</div></div>
  )
}

const payTone = { due: 'amber', reminder: 'blue', marked: 'blue', confirmed: 'green', disputed: 'red' } as const
const payLabel = { due: 'Due', reminder: 'Reminder sent', marked: 'Guardian marked paid', confirmed: 'Confirmed', disputed: 'Disputed' } as const
export function Payments() {
  const s = useStore(); const j = s.journey; const st = stats(j, s.dayOffset); const [dp, setDp] = useState<Pay | null>(null); const [why, setWhy] = useState('I did not receive the payment')
  const set = (id: string, state: Pay['state']) => s.setJourney((x) => ({ pay: x.pay.map((p) => (p.id === id ? { ...p, state } : p)) }))
  const live = j.tuition === 'active' || j.tuition === 'completed'
  return (
    <div>
      <PageHead title="Payments" tag="PAY-01" sub="Tracking only. Guardians pay you directly; TuitionHub never holds or moves money." actions={<DemoTag label="Tracking only" />} />
      <div className="mb-5 grid gap-4 sm:grid-cols-2"><Card><p className="text-sm text-gray-600">Confirmed earnings</p><p className="font-heading text-3xl font-bold text-navy-900 tabular">৳{st.earned.toLocaleString('en-IN')}</p></Card><Card><p className="text-sm text-gray-600">Awaiting confirmation or payment</p><p className="font-heading text-3xl font-bold text-navy-900 tabular">৳{j.pay.filter((p) => p.state !== 'confirmed').reduce((a, p) => a + p.amount, 0).toLocaleString('en-IN')}</p></Card></div>
      {!live || j.pay.length === 0 ? <Card><EmptyState title="No payment records" body="A monthly record is created when a tuition becomes active." /></Card>
        : <div className="space-y-3">{j.pay.map((p) => <Card key={p.id}><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold text-navy-900">{p.month} · Ayaan Rahman</p><p className="tabular text-sm text-gray-600">৳{p.amount.toLocaleString('en-IN')}</p></div><Chip tone={payTone[p.state]}>{payLabel[p.state]}</Chip></div>
          {j.disputes[p.id] && <p className="mt-2 text-sm text-danger-600">Dispute: {j.disputes[p.id]}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {p.state === 'due' && <Button size="sm" variant="secondary" onClick={() => { set(p.id, 'reminder'); s.toast('Reminder sent to the guardian', 'success') }}>Send reminder</Button>}
            {(p.state === 'due' || p.state === 'reminder') && <Button size="sm" variant="secondary" icon={<DemoTag label="Demo" />} onClick={() => set(p.id, 'marked')}>Guardian marks paid</Button>}
            {p.state === 'marked' && <><Button size="sm" onClick={() => { set(p.id, 'confirmed'); s.toast('Payment confirmed', 'success') }}>Confirm received</Button><Button size="sm" variant="tertiary" onClick={() => setDp(p)}>Dispute</Button></>}
          </div></Card>)}
          {j.tuition === 'active' && j.pay.every((p) => p.state === 'confirmed') && <Button variant="secondary" onClick={() => s.setJourney((x) => ({ pay: [...x.pay, { id: `pay-${x.pay.length + 1}`, month: 'November 2026', amount: 7000, state: 'due' }] }))}>Add November 2026 record</Button>}</div>}
      <Modal open={!!dp} onClose={() => setDp(null)} title="Dispute this payment" footer={<><Button variant="secondary" onClick={() => setDp(null)}>Cancel</Button><Button variant="destructive" onClick={() => { set(dp!.id, 'disputed'); s.setJourney((x) => ({ disputes: { ...x.disputes, [dp!.id]: why } })); setDp(null); s.toast('Dispute logged. Support will reach out (Demo).', 'warning') }}>Raise dispute</Button></>}><Field label="Reason">{(i) => <Select id={i} value={why} onChange={(e) => setWhy(e.target.value)} options={['I did not receive the payment', 'Amount is different', 'Other']} />}</Field></Modal>
    </div>
  )
}
