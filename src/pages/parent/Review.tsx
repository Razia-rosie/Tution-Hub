import { useState } from 'react'
import { AlertTriangle, BadgeCheck, CalendarClock, CheckCircle2, Download, Lock, Share2, Star } from 'lucide-react'
import { Button, Card, Chip, DemoTag, Field, Modal, Textarea } from '../../components/ui'
import { attendanceStats, classesFor, dateOf, fmt, hwFor, kjOf, payState, testMarksFor, tutOf, monthLabel, type Kid } from '../../lib/parent'
import { money } from '../../lib/pmatch'
import { useStore } from '../../lib/store'
import { STUDENT } from '../../lib/student'
import { completeTuition } from './pj'

const kjFor = (s: ReturnType<typeof useStore>, id: string) => (id === STUDENT.id ? s.sj.kj : kjOf(s.pj, id))
export const lastAbsent = (kid: Kid, off: number) => classesFor(kid, off).filter((c) => c.mark === 'absent' && c.day >= off - 14).pop()

export function AbsenceCard({ kid }: { kid: Kid }) {
  const s = useStore(); const kj = kjFor(s, kid.id); const c = lastAbsent(kid, s.dayOffset); const [open, setOpen] = useState(false); const [slot, setSlot] = useState(0)
  if (!c) return null
  const T = tutOf(kid); const st = kj.resched[c.id]
  const days = Array.from({ length: 10 }, (_, i) => s.dayOffset + 1 + i).filter((d) => !T.weekdays.includes(dateOf(d).getDay())).slice(0, 3)
  const setR = (v: 'requested' | 'confirmed') => s.setKJ(kid.id, (k) => ({ resched: { ...k.resched, [c.id]: v } }))
  return (
    <Card className="mb-4 border-warning-600 bg-warning-100">
      <div className="flex flex-wrap items-start gap-3"><AlertTriangle size={20} className="mt-0.5 text-warning-600" aria-hidden />
        <div className="min-w-0 flex-1"><p className="font-semibold text-navy-900">{kid.short} was marked absent on {fmt(dateOf(c.day))}</p>
          <p className="text-sm text-charcoal-900">{st === 'confirmed' ? `Make-up class confirmed for ${fmt(dateOf(days[slot] ?? days[0]))}, ${T.time}.` : st === 'requested' ? `Make-up request sent to ${T.tutor}. Waiting for an answer.` : `Would you like to ask ${T.tutor} for a make-up class?`}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {!st && <Button size="sm" icon={<CalendarClock size={14} />} onClick={() => { setSlot(0); setOpen(true) }}>Ask for a make-up class</Button>}
            {st === 'requested' && <><Chip tone="amber">Requested</Chip><Button size="sm" variant="secondary" onClick={() => { setR('confirmed'); s.toast('Demo: the tutor confirmed the make-up class', 'success') }}>Simulate tutor confirming</Button><DemoTag /></>}
            {st === 'confirmed' && <Chip tone="green" icon={<CheckCircle2 size={12} aria-hidden />}>Make-up confirmed</Chip>}
          </div></div></div>
      <Modal open={open} onClose={() => setOpen(false)} title="Ask for a make-up class" footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={() => { setR('requested'); setOpen(false); s.toast('Make-up request sent', 'success') }}>Send request</Button></>}>
        <fieldset><legend className="mb-2 text-sm text-gray-600">Pick a day. The time stays {T.time}.</legend><div className="space-y-2">{days.map((d, i) => <label key={d} className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-input border px-3 text-sm font-semibold ${slot === i ? 'border-blue-600 bg-blue-100' : 'border-gray-300'}`}><input type="radio" name="mk" checked={slot === i} onChange={() => setSlot(i)} />{fmt(dateOf(d))}</label>)}</div></fieldset>
      </Modal>
    </Card>
  )
}

export function MonthlyReport({ kid }: { kid: Kid }) {
  const s = useStore(); const off = s.dayOffset; const kj = kjFor(s, kid.id); const [open, setOpen] = useState(false); const [share, setShare] = useState(false)
  const T = tutOf(kid); const at = attendanceStats(kid, off); const hw = hwFor(kid, off); const marks = testMarksFor(kid, off); const pay = payState(kid, off)
  const avg = marks.length ? Math.round(marks.reduce((a, b) => a + b, 0) / marks.length) : null
  const rows: [string, string][] = [
    ['Subject', `${T.subject} with ${T.tutor}`], ['Attendance', at.total ? `${at.pct}% (${at.present} of ${at.total} classes)` : 'No classes held yet'],
    ['Homework', `${hw.filter((h) => h.state !== 'assigned').length} of ${hw.length} done`], ['Tests', avg === null ? 'No tests yet' : `${marks.length} taken, average ${avg}%`],
    ...(kid.id === STUDENT.id ? [] : [['Fee', `${money(T.fee)}: ${pay.state === 'paid' ? 'paid' : pay.state === 'overdue' ? 'overdue' : 'not yet paid'} (${monthLabel(pay.month)})`] as [string, string]]),
  ]
  return (
    <Card className="mt-6">
      <div className="flex flex-wrap items-center gap-3"><div className="min-w-0 flex-1"><h2 className="text-lg">Monthly report</h2><p className="text-sm text-gray-600">{fmt(dateOf(off), { month: 'long', year: 'numeric' })} · one page, plain language.</p></div>
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>View report</Button></div>
      <Modal open={open} onClose={() => setOpen(false)} title={`Monthly report: ${kid.name}`} footer={<><Button variant="secondary" icon={<Share2 size={14} />} onClick={() => setShare(true)}>Share</Button><Button icon={<Download size={14} />} onClick={() => s.toast('Demo export: a real PDF would download here. No file was created.', 'info')}>Export PDF</Button></>}>
        <p className="mb-3 flex items-center gap-2 text-xs text-gray-600"><DemoTag /> Export and share are simulated. Nothing is saved or sent.</p>
        <dl className="divide-y divide-gray-100 text-sm">{rows.map(([l, v]) => <div key={l} className="grid grid-cols-[6rem_1fr] gap-3 py-2"><dt className="text-gray-600">{l}</dt><dd className="font-semibold text-navy-900">{v}</dd></div>)}</dl>
        <p className="mt-3 rounded-input bg-offwhite-50 p-3 text-sm text-gray-600">Tutor note: {kid.tut ? `${kid.short} is settling in well. Keep up the weekly practice sets.` : 'Steady improvement in comprehension. Needs more practice on tenses.'}</p>
        {kj.reportShared && <p className="mt-2 text-sm text-teal-700">Shared with a co-guardian (Demo).</p>}
      </Modal>
      <Modal open={share} onClose={() => setShare(false)} title="Share this report" footer={<Button variant="secondary" onClick={() => setShare(false)}>Close</Button>}>
        <p className="text-sm text-gray-600">Choose how to share. These are Demo actions: no message is sent.</p>
        <div className="mt-3 grid gap-2">{['WhatsApp', 'Email', 'Copy link'].map((m) => <Button key={m} variant="secondary" onClick={() => { s.setKJ(kid.id, () => ({ reportShared: true })); setShare(false); s.toast(`Demo: report shared by ${m}. Nothing was sent.`, 'success') }}>{m}</Button>)}</div>
      </Modal>
    </Card>
  )
}

export function ReviewSection({ kid }: { kid: Kid }) {
  const s = useStore(); const kj = kjFor(s, kid.id); const [stars, setStars] = useState(0); const [text, setText] = useState(''); const [err, setErr] = useState('')
  if (!kid.tut) return null
  const done = kj.stage === 'completed'
  if (kj.review) return (
    <Card className="mt-6 border-teal-600"><h2 className="text-lg">Your review</h2>
      <p className="mt-2 flex flex-wrap items-center gap-2 text-sm"><span aria-label={`${kj.review.stars} out of 5 stars`} className="inline-flex">{[1, 2, 3, 4, 5].map((i) => <Star key={i} size={14} className={i <= kj.review!.stars ? 'fill-warning-600 text-warning-600' : 'text-gray-300'} aria-hidden />)}</span><Chip tone="green" icon={<BadgeCheck size={12} aria-hidden />}>Verified Review</Chip></p>
      <p className="mt-2 text-sm">{kj.review.text}</p><p className="mt-2 text-xs text-gray-600">Submitted. {kid.tut.tutor} sees it on their Reviews page with a Verified Review chip. Reviews cannot be edited.</p></Card>
  )
  if (!done) return (
    <Card className="mt-6 bg-offwhite-50"><div className="flex flex-wrap items-center gap-3"><Lock size={20} className="text-gray-600" aria-hidden /><div className="min-w-0 flex-1"><h2 className="text-lg">Review {kid.tut.tutor}</h2><p className="text-sm text-gray-600">Reviews open when the tuition is complete, so every review comes from a real, finished tuition. Until then this form stays locked.</p></div>
      <div className="flex flex-wrap items-center gap-2"><Button size="sm" variant="secondary" onClick={() => { completeTuition(s, kid); s.toast('Demo: fast-forwarded to completion. The review is open.', 'success') }}>Fast-forward to completion</Button><DemoTag /></div></div></Card>
  )
  return (
    <Card className="mt-6"><h2 className="text-lg">Review {kid.tut.tutor}</h2><p className="text-sm text-gray-600">The tuition is complete. Your honest review helps other students and guardians.</p>
      <form noValidate onSubmit={(e) => { e.preventDefault(); if (!stars) { setErr('Choose a star rating.'); return } if (text.trim().length < 20) { setErr('Write at least a couple of sentences (20 characters).'); return } s.setKJ(kid.id, () => ({ review: { stars, text: text.trim() } })); s.toast('Review submitted', 'success') }} className="mt-3 space-y-3">
        <fieldset><legend className="mb-1 text-sm font-semibold text-navy-900">Rating</legend><div className="flex gap-1">{[1, 2, 3, 4, 5].map((i) => <button type="button" key={i} aria-label={`${i} star${i > 1 ? 's' : ''}`} aria-pressed={stars === i} onClick={() => { setStars(i); setErr('') }} className="grid h-11 w-11 place-items-center rounded-input hover:bg-gray-100 md:h-9 md:w-9"><Star size={24} className={i <= stars ? 'fill-warning-600 text-warning-600' : 'text-gray-400'} aria-hidden /></button>)}</div></fieldset>
        <Field label="Your review" hint="Be specific and fair. Do not include phone numbers.">{(i) => <Textarea id={i} value={text} onChange={(e) => { setText(e.target.value); setErr('') }} />}</Field>
        {err && <p role="alert" className="text-sm text-danger-600">{err}</p>}
        <Button type="submit">Submit review</Button></form></Card>
  )
}
