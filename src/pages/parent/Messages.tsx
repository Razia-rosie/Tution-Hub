import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { CalendarClock, CheckCircle2, FileSignature, Lock, Send } from 'lucide-react'
import { PageHead } from '../../components/tutor/bits'
import { Avatar, Button, Card, Chip, DemoTag, EmptyState, Input, Modal, Tabs, VerifyBadge } from '../../components/ui'
import { TUTOR_REPLIES, WEEKDAY, maskedEmail, maskedPhone, money } from '../../lib/pmatch'
import { dateOf, fmt } from '../../lib/parent'
import { NoChild, PermOff } from './shared'
import { isMinor, maskGuardianPhone } from '../../lib/student'
import { Masked } from '../../components/tutor/bits'
import InterestPanel from './Interest'
import { agreementOf, tutorBy, tutorConfirms, usePJ } from './pj'

const UNSAFE = /(\+?8801|01)[\d\s-]{8,}|\d{9,}|@|https?:\/\//i

function Inbox() {
  const { kid, kj, verified, base: A, me } = usePJ(); const [tab, setTab] = useState('Chats')
  if (!kid) return <div><PageHead title="Messages" tag="MSG-P" /><NoChild /></div>
  if (!kid.perms.chat) return <div><PageHead title="Messages" tag="MSG-P" /><PermOff kid={kid} what="Chat" perm="chat" /></div>
  const threads = Object.keys(kj.sent).filter((id) => kj.sent[id] === 'mutual')
  const waiting = Object.values(kj.incoming).filter((v) => v === 'received').length
  return (
    <div>
      <PageHead title="Messages" tag="MSG-P" sub={`${me === 'student' ? 'Your chats with tutors' : `Chats about ${kid.name}`}. A chat opens only when both sides show interest.`} />
      {!verified && <Card className="mb-5 flex flex-wrap items-center gap-3 bg-warning-100"><Lock size={18} className="text-warning-600" aria-hidden /><p className="min-w-0 flex-1 text-sm text-charcoal-900">{me === 'student' ? 'Chat is locked until your student verification is approved.' : 'Chat is locked until your guardian verification is approved.'}</p><Link to={me === 'student' ? `${A}/profile/verification` : `${A}/settings/verification`} className="text-sm font-semibold text-blue-600 hover:underline">Verification</Link></Card>}
      <Tabs tabs={['Chats', waiting ? `Interest (${waiting})` : 'Interest']} value={tab.startsWith('Interest') ? (waiting ? `Interest (${waiting})` : 'Interest') : 'Chats'} onChange={setTab} />
      <div className="mt-4">
        {tab.startsWith('Interest') ? <InterestPanel /> : threads.length === 0 ? (
          <Card><EmptyState title="No chats yet" body={`When a tutor and you both show interest, the chat opens here. Contact details stay masked.`} action={<div className="flex flex-wrap justify-center gap-3 text-sm font-semibold"><Link to={`${A}/find-tutor`} className="text-blue-600 hover:underline">Find a tutor</Link><button onClick={() => setTab('Interest')} className="text-blue-600 hover:underline">See interest</button></div>} /></Card>
        ) : (
          <Card pad={false}><ul className="divide-y divide-gray-100">{threads.map((id) => { const t = tutorBy(id)!; const th = kj.chat[id] ?? []; const last = th[th.length - 1]
            return <li key={id}><Link to={`${A}/messages/${id}`} className="flex items-center gap-3 p-4 hover:bg-offwhite-50"><Avatar name={t.name} size={44} /><span className="min-w-0 flex-1"><span className="block font-semibold text-navy-900">{t.name}</span><span className="block truncate text-sm text-gray-600">{last?.text}</span></span>
              {kj.tutorId === id && kj.stage === 'active' && <Chip tone="green">Tuition active</Chip>}{kj.tutorId === id && kj.stage === 'agreement' && <Chip tone="amber">Agreement pending</Chip>}{kj.trial[id] && <Chip tone="blue">Trial {kj.trial[id]}</Chip>}</Link></li> })}</ul></Card>
        )}
      </div>
    </div>
  )
}

function Thread({ tid }: { tid: string }) {
  const { s, kid, kj, set, verified, base: A, me } = usePJ(); const t = tutorBy(tid)
  const [text, setText] = useState(''); const [err, setErr] = useState(''); const [trialOpen, setTrialOpen] = useState(false); const [agreeOpen, setAgreeOpen] = useState(false); const [ok, setOk] = useState(false); const [slot, setSlot] = useState(0)
  const end = useRef<HTMLDivElement>(null)
  const th = kj.chat[tid] ?? []
  useEffect(() => { end.current?.scrollIntoView?.({ block: 'nearest' }) }, [th.length])
  if (!kid) return <NoChild />
  if (!kid.perms.chat) return <PermOff kid={kid} what="Chat" perm="chat" />
  if (!t || kj.sent[tid] !== 'mutual') return <div><PageHead title="Chat" tag="MSG-P" crumb={{ to: `${A}/messages`, label: 'Messages' }} /><Card><EmptyState title="This chat is not open" body="A chat opens only after you and the tutor both show interest." action={<Link to={`${A}/find-tutor`} className="text-sm font-semibold text-blue-600 hover:underline">Find a tutor</Link>} /></Card></div>
  const mine = kj.tutorId === tid; const other = !!kj.tutorId && !mine && kj.stage !== 'none'
  const post = kj.post
  const slots = post ? Array.from({ length: 14 }, (_, i) => s.dayOffset + 1 + i).filter((d) => post.days.split(', ').some((x) => WEEKDAY[x.slice(0, 3)] === dateOf(d).getDay())).slice(0, 3) : []
  const add = (more: { from: 'me' | 'them' | 'system'; text: string }[]) => set((k) => ({ chat: { ...k.chat, [tid]: [...(k.chat[tid] ?? []), ...more] } }))
  const send = () => {
    const v = text.trim(); if (!v) { setErr('Write a message first.'); return }
    if (UNSAFE.test(v)) { setErr('For safety, phone numbers, emails and links cannot be shared in chat. Contact stays masked.'); return }
    const n = th.filter((m) => m.from === 'them').length
    add([{ from: 'me', text: v }, { from: 'them', text: TUTOR_REPLIES[Math.min(n, TUTOR_REPLIES.length - 1)] }]); setText(''); setErr('')
  }
  const minor = me === 'student' && isMinor(s.sj.form); const f = s.sj.form
  const tr = kj.trial[tid]; const ag = agreementOf(kid, { ...kj, tutorId: tid }, me === 'student' ? (minor ? f.guardianName || 'Guardian' : 'Not needed (18 or older)') : undefined)
  const needG = minor && !kj.guardianOk
  const sysTrial = (txt: string, next: 'requested' | 'accepted' | 'done') => set((k) => ({ trial: { ...k.trial, [tid]: next }, chat: { ...k.chat, [tid]: [...(k.chat[tid] ?? []), { from: 'system', text: txt }] } }))
  return (
    <div>
      <PageHead title={t.name} tag="MSG-P" crumb={{ to: `${A}/messages`, label: 'Messages' }} sub={me === 'student' ? 'Your chat. Contact details stay masked.' : `Chat about ${kid.name}.`} actions={<Link to={`${A}/find-tutor/${t.id}`} className="text-sm font-semibold text-blue-600 hover:underline">View profile</Link>} />
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card pad={false} className="flex min-h-[26rem] flex-col">
          <div role="log" aria-label={`Chat with ${t.name}`} className="flex-1 space-y-3 overflow-y-auto p-4" style={{ maxHeight: '28rem' }}>
            {th.map((m, i) => m.from === 'system' ? <p key={i} className="mx-auto max-w-md rounded-input bg-gray-100 px-3 py-2 text-center text-xs text-gray-600">{m.text}</p> : (
              <div key={i} className={`flex ${m.from === 'me' ? 'justify-end' : 'justify-start'}`}><p className={`max-w-[85%] rounded-card px-3.5 py-2 text-sm ${m.from === 'me' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-charcoal-900'}`}>{m.text}</p></div>))}
            <div ref={end} />
          </div>
          <p className="border-t border-gray-100 bg-offwhite-50 px-4 py-1.5 text-xs text-gray-600"><DemoTag /> Demo: simulated tutor reply. No real person is typing.</p>
          <form onSubmit={(e) => { e.preventDefault(); send() }} className="border-t border-gray-100 p-3">
            {!verified ? <p className="text-sm text-gray-600">Verify your account to send messages.</p> : (
              <div className="flex gap-2"><div className="min-w-0 flex-1"><Input aria-label="Message" value={text} onChange={(e) => { setText(e.target.value); setErr('') }} placeholder="Write a message" aria-invalid={!!err} /></div><Button type="submit" icon={<Send size={16} />}>Send</Button></div>)}
            {err && <p role="alert" className="mt-1.5 text-sm text-danger-600">{err}</p>}
          </form>
        </Card>
        <div className="space-y-4">
          <Card><h2 className="text-lg">Contact</h2>
            <dl className="mt-2 space-y-1.5 text-sm"><div className="flex justify-between gap-3"><dt className="text-gray-600">Phone</dt><dd className="tabular font-mono">{maskedPhone(t)}</dd></div><div className="flex justify-between gap-3"><dt className="text-gray-600">Email</dt><dd className="min-w-0 truncate font-mono">{maskedEmail(t)}</dd></div></dl>
            <p className="mt-2 flex items-start gap-1.5 text-xs text-gray-600"><Lock size={12} className="mt-0.5 shrink-0" aria-hidden /> Masked for your safety. {me === 'student' ? 'Nobody sees full numbers here; use this chat.' : 'Guardians never see full numbers; use this chat.'}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">{t.badges.slice(0, 2).map((b) => <VerifyBadge key={b} kind={b} />)}</div></Card>

          <Card><h2 className="flex items-center gap-2 text-lg"><CalendarClock size={18} aria-hidden /> Trial class <span className="text-xs font-normal text-gray-600">(optional)</span></h2>
            {!tr ? <><p className="mt-1 text-sm text-gray-600">Try one class before you agree. You can skip this.</p><Button size="sm" className="mt-3" disabled={!verified || !!kid.tuition || !slots.length} onClick={() => { setSlot(0); setTrialOpen(true) }}>Request a trial class</Button></>
              : tr === 'requested' ? <><p className="mt-1 text-sm text-gray-600">Requested. Waiting for {t.short} to answer.</p><div className="mt-3 flex flex-wrap items-center gap-2"><Chip tone="amber">Requested</Chip><Button size="sm" variant="secondary" onClick={() => sysTrial(`${t.short} accepted the trial class.`, 'accepted')}>Simulate tutor accepting</Button><DemoTag /></div></>
                : tr === 'accepted' ? <><p className="mt-1 text-sm text-gray-600">Accepted. The trial class is booked.</p><div className="mt-3 flex flex-wrap items-center gap-2"><Chip tone="green">Accepted</Chip><Button size="sm" variant="secondary" onClick={() => sysTrial('The trial class was held. You can now agree or walk away.', 'done')}>Simulate trial held</Button><DemoTag /></div></>
                  : <div className="mt-2"><Chip tone="green" icon={<CheckCircle2 size={12} aria-hidden />}>Trial class held</Chip></div>}</Card>

          <Card><h2 className="flex items-center gap-2 text-lg"><FileSignature size={18} aria-hidden /> Agreement</h2>
            {mine && kj.stage === 'active' || mine && kj.stage === 'completed' ? <><p className="mt-1 text-sm text-gray-600">Both sides confirmed.</p><div className="mt-2"><Chip tone="green" icon={<CheckCircle2 size={12} aria-hidden />}>Tuition Active</Chip></div><Link to={me === 'student' ? `${A}/my-tuition` : `${A}/tuitions`} className="mt-3 inline-block text-sm font-semibold text-blue-600 hover:underline">{me === 'student' ? 'Open My Tuition' : 'Open Active tuitions'}</Link></>
              : mine && kj.stage === 'agreement' ? <><p className="mt-1 text-sm text-gray-600">You confirmed. Waiting for {t.short} to confirm.</p><div className="mt-3 flex flex-wrap items-center gap-2"><Chip tone="amber">Waiting for tutor</Chip><Button size="sm" variant="secondary" onClick={() => { tutorConfirms(s, kid.id); s.toast('Demo: tutor confirmed. Tuition is active.', 'success') }}>Simulate tutor confirming</Button><DemoTag /></div></>
                : other ? <p className="mt-1 text-sm text-gray-600">You are already confirming with another tutor.</p>
                  : kid.tuition ? <p className="mt-1 text-sm text-gray-600">{me === 'student' ? 'You already have an active tuition.' : `${kid.short} already has an active tuition.`}</p>
                    : !post ? <><p className="mt-1 text-sm text-gray-600">An agreement needs a post to take its days, time and budget from.</p><Link to={`${A}/my-posts/new`} className="mt-2 inline-block text-sm font-semibold text-blue-600 hover:underline">Post a tuition</Link></>
                      : <><p className="mt-1 text-sm text-gray-600">Ready when you are. Review the terms, then confirm. Both sides must confirm.</p><Button size="sm" className="mt-3" disabled={!verified} onClick={() => { setOk(false); setAgreeOpen(true) }}>Review agreement</Button></>}</Card>
        </div>
      </div>

      <Modal open={trialOpen} onClose={() => setTrialOpen(false)} title="Request a trial class" footer={<><Button variant="secondary" onClick={() => setTrialOpen(false)}>Cancel</Button><Button onClick={() => { sysTrial(`Trial class requested for ${fmt(dateOf(slots[slot]))}, ${post?.time}.`, 'requested'); setTrialOpen(false); s.toast('Trial class requested', 'success') }}>Send request</Button></>}>
        <fieldset><legend className="mb-2 text-sm text-gray-600">Pick a day. The time follows your post ({post?.time}).</legend>
          <div className="space-y-2">{slots.map((d, i) => <label key={d} className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-input border px-3 text-sm font-semibold ${slot === i ? 'border-blue-600 bg-blue-100' : 'border-gray-300'}`}><input type="radio" name="slot" checked={slot === i} onChange={() => setSlot(i)} />{fmt(dateOf(d))}</label>)}</div></fieldset>
      </Modal>
      <Modal open={agreeOpen} onClose={() => setAgreeOpen(false)} title="Tuition agreement" footer={<><Button variant="secondary" onClick={() => setAgreeOpen(false)}>Not yet</Button><Button disabled={!ok || needG} onClick={() => { set(() => ({ tutorId: tid, stage: 'agreement', agreeParent: true })); setAgreeOpen(false); s.toast('You confirmed. Waiting for the tutor.', 'success') }}>Confirm agreement</Button></>}>
        {ag && <><dl className="grid gap-2 text-sm sm:grid-cols-2">{([['Tutor', ag.tutor], ['Student', ag.student], [me === 'student' ? 'Guardian' : 'Guardian', ag.parent], ['Subject', `${ag.subject}, ${ag.cls}`], ['Days', ag.days], ['Time', ag.time], ['Monthly fee', money(ag.salary)], ['Type', ag.type]] as const).map(([l, v]) => <div key={l}><dt className="text-xs font-semibold uppercase tracking-wide text-gray-600">{l}</dt><dd className="font-semibold text-navy-900">{v}</dd></div>)}</dl>
          <p className="mt-3 text-sm text-gray-600">{ag.location}</p><p className="mt-1 text-sm text-gray-600">{ag.terms}</p>
          {minor && <div className="mt-4 rounded-input border border-gray-200 bg-offwhite-50 p-3 text-sm"><p className="font-semibold text-navy-900">Guardian consent is required</p><p className="mt-1 text-gray-600">You are under 18. {f.guardianName || 'Your guardian'} (<Masked value={maskGuardianPhone(f.guardianPhone)} />) must agree before you can confirm.</p>{kj.guardianOk ? <p className="mt-2 flex items-center gap-1.5 font-semibold text-teal-700"><CheckCircle2 size={14} aria-hidden /> Guardian agreed</p> : <div className="mt-2 flex flex-wrap items-center gap-2"><Button size="sm" variant="secondary" onClick={() => { set(() => ({ guardianOk: true })); s.toast('Demo: your guardian agreed to this tuition', 'success') }}>Simulate: guardian agrees</Button><DemoTag /></div>}</div>}
          <label className="mt-4 flex min-h-11 items-start gap-2 text-sm"><input type="checkbox" className="mt-1 h-4 w-4" checked={ok} onChange={(e) => setOk(e.target.checked)} /> {me === 'student' ? 'I have read the terms and I agree.' : `I have read the terms and I agree on behalf of ${kid.short}.`}</label></>}
      </Modal>
    </div>
  )
}

export default function Messages({ sub }: { sub: string }) {
  return sub ? <Thread tid={sub.split('/')[0]} /> : <Inbox />
}
