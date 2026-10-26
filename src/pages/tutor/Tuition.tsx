import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Ban, Flag, MessageSquare, Send, ShieldCheck, CalendarPlus, FileSignature } from 'lucide-react'
import { POSTS } from '../../lib/data'
import { AGREEMENT, GUARDIAN, JOURNEY_POST, REPLIES, REQUESTS, SYS_MSG, type Msg } from '../../lib/journey'
import { useStore } from '../../lib/store'
import { Button, Card, Chip, DemoTag, EmptyState, Field, Modal, Select, Textarea } from '../../components/ui'
import { LockChip, Masked, PageHead } from '../../components/tutor/bits'

const M = '/app/tutor/messages'
const money = (n: number) => `৳${n.toLocaleString('en-IN')}`

export function threadInfo(id: string) {
  const r = REQUESTS.find((x) => x.id === id)
  if (r) return { who: r.from, title: `${r.subject}, ${r.cls}`, area: r.area, budget: r.budget, days: 'To be agreed', time: 'To be agreed', post: false }
  const p = POSTS.find((x) => x.id === id)!
  return { who: GUARDIAN[id] ?? 'Guardian', title: `${p.subject}, ${p.cls}`, area: p.area, budget: p.budget, days: p.days, time: p.time, post: true }
}

export function RevealModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useStore()
  const confirm = () => {
    s.setJourney((x) => ({ addressRevealed: true, accessLog: [...x.accessLog, `${s.demoDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}, ${s.demoDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} · Tanvir viewed the exact address (Demo)`] }))
    onClose(); s.toast('Exact address revealed and logged', 'success')
  }
  return (
    <Modal open={open} onClose={onClose} title="Reveal exact address (MAP-06)" footer={<><Button variant="secondary" onClick={onClose}>Not now</Button><Button onClick={confirm}>Reveal and log</Button></>}>
      <p className="text-sm text-gray-600">Only you can see the address, and only because the agreement is confirmed. This view is written to your access log, and the guardian can see that it happened. Do not share it with anyone.</p>
    </Modal>
  )
}

export default function Messages({ sub }: { sub: string }) {
  const parts = sub.split('/').filter(Boolean)
  if (parts[0] && parts[1] === 'agreement') return <Agreement id={parts[0]} />
  if (parts[0]) return <Conversation id={parts[0]} />
  return <Threads />
}

function Threads() {
  const s = useStore(); const j = s.journey; const ids = Object.keys(j.chat)
  return (
    <div>
      <PageHead title="Messages" tag="CHAT-01" sub="Chat opens only after both sides show interest. Phone and email stay masked until the agreement." />
      {ids.length === 0 ? (
        <Card><EmptyState title="Chat is locked for now" body="You will see a conversation here as soon as a guardian and you both show interest. Browse matches and send interest." action={<Link to="/app/tutor/find-tuition" className="text-sm font-semibold text-blue-600 hover:underline">Find tuition</Link>} /><p className="mt-2 text-center text-xs text-gray-600">CHAT-07</p></Card>
      ) : <ul className="space-y-3">{ids.map((id) => { const t = threadInfo(id); const msgs = j.chat[id]; const last = [...msgs].reverse().find((m) => m.from !== 'system'); const blocked = j.blocked.includes(id)
        return <li key={id}><Link to={`${M}/${id}`} className="flex items-center gap-4 rounded-card border border-gray-200 bg-white p-4 shadow-card hover:border-blue-600">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-blue-100 text-blue-600"><MessageSquare size={20} aria-hidden /></span>
          <span className="min-w-0 flex-1"><span className="block font-semibold text-navy-900">{t.who} <span className="font-normal text-gray-600">· {t.title}</span></span><span className="block truncate text-sm text-gray-600">{blocked ? 'You blocked this contact' : last?.text ?? 'Say hello'}</span></span>
          {blocked ? <Chip>Blocked</Chip> : id === JOURNEY_POST && j.tuition === 'active' ? <Chip tone="green">Active tuition</Chip> : <Chip tone="blue">Mutual interest</Chip>}
        </Link></li> })}</ul>}
    </div>
  )
}

function Conversation({ id }: { id: string }) {
  const s = useStore(); const j = s.journey; const nav = useNavigate()
  const th = j.chat[id]; const [text, setText] = useState(''); const [rep, setRep] = useState(false); const [blk, setBlk] = useState(false); const [trial, setTrial] = useState(false)
  const [why, setWhy] = useState('Asked for personal contact outside the platform'); const [det, setDet] = useState(''); const [tday, setTday] = useState('Sun, 18 Oct 2026')
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }) }, [th?.length])
  if (!th) return <div><PageHead title="Conversation" tag="CHAT-07" crumb={{ to: M, label: 'Messages' }} /><Card><EmptyState title="This chat is locked" body="Chat opens after the guardian and you both show interest." action={<Link to="/app/tutor/find-tuition" className="text-sm font-semibold text-blue-600 hover:underline">Find tuition</Link>} /></Card></div>
  const t = threadInfo(id); const blocked = j.blocked.includes(id); const featured = id === JOURNEY_POST
  const agreed = featured && j.tuition === 'active'
  const push = (m: Msg) => s.setJourney((x) => ({ chat: { ...x.chat, [id]: [...(x.chat[id] ?? []), m] } }))
  const send = () => {
    const v = text.trim(); if (!v || blocked) return
    push({ from: 'me', text: v }); setText('')
    const n = th.filter((m) => m.from === 'them').length
    if (n < REPLIES.length) setTimeout(() => s.setJourney((x) => ({ chat: { ...x.chat, [id]: [...(x.chat[id] ?? []), { from: 'them', text: REPLIES[n] }] } })), 1200)
  }
  return (
    <div>
      <PageHead title={t.who} tag="CHAT-02" crumb={{ to: M, label: 'Messages' }} sub={`${t.title} · ${t.area}`} actions={<><Button size="sm" variant="secondary" icon={<Flag size={14} />} onClick={() => setRep(true)}>Report</Button><Button size="sm" variant="secondary" icon={<Ban size={14} />} onClick={() => (blocked ? (s.setJourney((x) => ({ blocked: x.blocked.filter((b) => b !== id) })), s.toast('Unblocked', 'info')) : setBlk(true))}>{blocked ? 'Unblock' : 'Block'}</Button></>} />
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card pad={false} className="flex h-[32rem] max-h-[70vh] flex-col">
          <div className="flex-1 space-y-3 overflow-y-auto p-4" role="log" aria-label="Conversation" aria-live="polite">
            {th.map((m, i) => m.from === 'system'
              ? <p key={i} className="mx-auto max-w-md rounded-input bg-gray-100 px-3 py-2 text-center text-xs text-gray-600">{m.text}</p>
              : <div key={i} className={`flex ${m.from === 'me' ? 'justify-end' : ''}`}><p className={`max-w-[80%] rounded-card px-3.5 py-2 text-sm ${m.from === 'me' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-charcoal-900'}`}>{m.text}</p></div>)}
            <div ref={end} />
          </div>
          <p className="border-t border-gray-100 bg-offwhite-50 px-4 py-1.5 text-xs text-gray-600"><DemoTag /> Demo: simulated guardian reply. No real person is typing.</p>
          {blocked ? <p className="border-t border-gray-200 p-4 text-sm text-gray-600">CHAT-05 · You blocked this contact. They cannot message you. Unblock to continue.</p>
            : <form className="flex gap-2 border-t border-gray-200 p-3" onSubmit={(e) => { e.preventDefault(); send() }}>
              <label className="sr-only" htmlFor="chat-in">Message</label>
              <input id="chat-in" value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a message" className="min-h-11 flex-1 rounded-input border border-gray-300 px-3 text-sm md:min-h-0 md:py-2" maxLength={400} />
              <Button type="submit" disabled={!text.trim()} icon={<Send size={16} />}>Send</Button>
            </form>}
        </Card>
        <div className="space-y-4">
          <Card><h2 className="text-lg">Tuition summary</h2>
            <dl className="mt-3 space-y-2 text-sm">{([['Subject', t.title], ['Area', t.area], ['Days', t.days], ['Time', t.time], ['Budget', `${money(t.budget)}/mo`]] as const).map(([k, v]) => <div key={k} className="flex justify-between gap-3"><dt className="text-gray-600">{k}</dt><dd className="text-right font-semibold text-navy-900">{v}</dd></div>)}</dl>
            <div className="mt-4 space-y-2 border-t border-gray-200 pt-3 text-sm">
              <div className="flex items-center justify-between gap-2"><span className="text-gray-600">Phone</span>{agreed ? <span className="tabular font-mono">+880 1712 000 000</span> : <Masked value="+880 1•• ••• ••42" />}</div>
              <div className="flex items-center justify-between gap-2"><span className="text-gray-600">Email</span>{agreed ? <span className="font-mono">shabnam.r@example.bd</span> : <Masked value="s••••••@e•••••.bd" />}</div>
              {agreed ? <p className="text-xs text-gray-600"><ShieldCheck size={12} className="mr-1 inline text-teal-700" aria-hidden />Shared with the guardian's consent after the agreement. DEMO data.</p> : <LockChip>Hidden until agreement and consent</LockChip>}
            </div>
          </Card>
          <Card><h2 className="text-lg">Next steps</h2>
            <div className="mt-3 flex flex-col gap-2">
              {featured ? <Link to={`${M}/${id}/agreement`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-input bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-700 md:min-h-0"><FileSignature size={16} aria-hidden />{j.tuition === 'active' ? 'View agreement' : j.tuition === 'awaiting' ? 'Agreement awaiting guardian' : 'Agree to Tuition'}</Link>
                : <p className="rounded-input bg-gray-100 p-3 text-xs text-gray-600">Demo note: the full agreement and active-tuition journey is built for the Physics, HSC thread with Mrs. Shabnam.</p>}
              {featured && j.tuition === 'none' && <Button variant="secondary" icon={<CalendarPlus size={16} />} disabled={j.trial !== 'none' || blocked} onClick={() => setTrial(true)}>{j.trial === 'none' ? 'Request a trial class' : 'Trial class agreed'}</Button>}
              {j.tuition === 'active' && <Link to="/app/tutor/schedule" className="text-center text-sm font-semibold text-blue-600 hover:underline">Open schedule</Link>}
            </div>
          </Card>
        </div>
      </div>
      <Modal open={rep} onClose={() => setRep(false)} title="Report this conversation (CHAT-03)" footer={<><Button variant="secondary" onClick={() => setRep(false)}>Cancel</Button><Button disabled={det.trim().length < 5} onClick={() => { s.setJourney((x) => ({ reported: [...x.reported, `${id}|${why}`] })); setRep(false); setDet(''); s.toast('Report sent to the safety team (Demo)', 'success') }}>Send report</Button></>}>
        <div className="space-y-3"><Field label="Reason">{(i) => <Select id={i} value={why} onChange={(e) => setWhy(e.target.value)} options={['Asked for personal contact outside the platform', 'Abusive or inappropriate language', 'Asked for payment outside the platform', 'Suspicious or fake request', 'Other']} />}</Field>
          <Field label="What happened?" hint="At least 5 characters">{(i) => <Textarea id={i} value={det} onChange={(e) => setDet(e.target.value)} />}</Field></div>
      </Modal>
      <Modal open={blk} onClose={() => setBlk(false)} title="Block this contact? (CHAT-04)" footer={<><Button variant="secondary" onClick={() => setBlk(false)}>Cancel</Button><Button variant="destructive" onClick={() => { s.setJourney((x) => ({ blocked: [...x.blocked, id] })); setBlk(false); s.toast('Contact blocked', 'info'); nav(M) }}>Block</Button></>}><p className="text-sm text-gray-600">They will not be able to message you. You can unblock from the thread or from Safety.</p></Modal>
      <Modal open={trial} onClose={() => setTrial(false)} title="Request a trial class (CHAT-06)" footer={<><Button variant="secondary" onClick={() => setTrial(false)}>Cancel</Button><Button onClick={() => { push({ from: 'system', text: `Trial class requested for ${tday}, 6:30 PM.` }); s.setJourney(() => ({ trial: 'done' })); setTrial(false); setTimeout(() => s.setJourney((x) => ({ chat: { ...x.chat, [id]: [...(x.chat[id] ?? []), { from: 'them', text: `${tday} works for the trial class.` }] } })), 1000) }}>Send request</Button></>}>
        <Field label="Preferred day">{(i) => <Select id={i} value={tday} onChange={(e) => setTday(e.target.value)} options={['Sun, 18 Oct 2026', 'Tue, 20 Oct 2026', 'Thu, 22 Oct 2026']} />}</Field>
        <p className="mt-3 text-xs text-gray-600">Trial classes are free and short. Meet only at the agreed place.</p>
      </Modal>
    </div>
  )
}

function Agreement({ id }: { id: string }) {
  const s = useStore(); const j = s.journey; const st = j.tuition
  const [chg, setChg] = useState(false); const [cn, setCn] = useState(false); const [txt, setTxt] = useState(''); const [why, setWhy] = useState('Schedule no longer works'); const [err, setErr] = useState('')
  const back = { to: `${M}/${id}`, label: 'Conversation' }
  if (id !== JOURNEY_POST || j.interests[id] !== 'mutual') return <div><PageHead title="Agreement" tag="AGR-01" crumb={{ to: M, label: 'Messages' }} /><Card><EmptyState title="Agreement is not available yet" body="An agreement can be drafted after mutual interest on the featured Physics, HSC tuition." /></Card></div>
  const rows: [string, string][] = [['Tutor', AGREEMENT.tutor], ['Student', AGREEMENT.student], ['Guardian', AGREEMENT.parent], ['Subject and class', `${AGREEMENT.subject}, ${AGREEMENT.cls}`], ['Days', AGREEMENT.days], ['Time', AGREEMENT.time], ['Monthly fee', money(AGREEMENT.salary)], ['Start date', AGREEMENT.start], ['Type', AGREEMENT.type], ['Location', AGREEMENT.location], ['Payment', AGREEMENT.terms]]
  const title = st === 'active' ? 'Tuition active' : st === 'awaiting' ? 'Waiting for the guardian' : st === 'cancelled' ? 'Agreement cancelled' : 'Digital agreement'
  const tag = st === 'active' ? 'AGR-05' : st === 'awaiting' ? 'AGR-02' : 'AGR-01'
  const confirmTutor = () => { s.setJourney((x) => ({ agree: { ...x.agree, tutor: true }, tuition: 'awaiting' })); s.toast('You confirmed. Waiting for the guardian.', 'success') }
  return (
    <div>
      <PageHead title={title} tag={tag} crumb={back} sub="Demonstration agreement, not legally binding." actions={<DemoTag label="Demo agreement" />} />
      {st === 'active' && <Card className="mb-5 border-emerald-600/40 bg-success-100"><p className="font-heading text-xl font-bold text-teal-700">TUITION ACTIVE</p><p className="mt-1 text-sm text-charcoal-900">Both sides confirmed. Classes start {AGREEMENT.start}. The schedule, attendance and homework are ready.</p><div className="mt-3 flex flex-wrap gap-2"><Link to="/app/tutor/schedule" className="rounded-input bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-700">Open schedule</Link><Link to="/app/tutor/my-students" className="rounded-input border border-gray-400 bg-white px-4 py-2 text-sm font-semibold text-navy-900 hover:bg-blue-100">My Students</Link></div></Card>}
      {st === 'cancelled' && <Card className="mb-5"><p className="text-sm text-gray-600">This agreement was cancelled{j.cancelReason ? `: ${j.cancelReason}` : ''}. You can return to chat.</p></Card>}
      {st === 'awaiting' && <Card className="mb-5 border-blue-600/40 bg-blue-100/60"><p className="font-semibold text-navy-900">You confirmed. The guardian has not confirmed yet.</p><p className="mt-1 text-sm text-gray-600">The agreement becomes active only when both sides confirm.</p><div className="mt-3"><Button variant="secondary" icon={<DemoTag label="Demo" />} onClick={() => { s.parentConfirms(); s.toast('Demo: guardian confirmed. Tuition is active.', 'success') }}>Parent confirms</Button></div></Card>}
      {j.agree.change && st !== 'active' && <Card className="mb-5 bg-warning-100/60"><p className="text-sm"><b className="text-navy-900">Change requested (AGR-03):</b> {j.agree.change}</p></Card>}
      <Card><dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">{rows.map(([k, v]) => <div key={k}><dt className="text-gray-600">{k}</dt><dd className="font-semibold text-navy-900">{v}</dd></div>)}</dl></Card>
      {(st === 'none' || st === 'agreement_draft' || st === 'awaiting') && (
        <div className="mt-5 flex flex-wrap gap-2">
          {st !== 'awaiting' && <Button onClick={confirmTutor}>Confirm agreement</Button>}
          <Button variant="secondary" onClick={() => setChg(true)}>Request change</Button>
          <Button variant="tertiary" onClick={() => setCn(true)}>Cancel agreement</Button>
        </div>
      )}
      <Modal open={chg} onClose={() => setChg(false)} title="Request a change (AGR-03)" footer={<><Button variant="secondary" onClick={() => setChg(false)}>Cancel</Button><Button onClick={() => { if (txt.trim().length < 5) { setErr('Describe the change in a few words.'); return } s.setJourney((x) => ({ agree: { ...x.agree, change: txt.trim() } })); setChg(false); setTxt(''); setErr(''); s.toast('Change request sent to the guardian', 'success') }}>Send request</Button></>}>
        <Field label="What would you like to change?" error={err}>{(i) => <Textarea id={i} value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="For example: move the class to 7:00 PM" />}</Field>
      </Modal>
      <Modal open={cn} onClose={() => setCn(false)} title="Cancel the agreement? (AGR-04)" footer={<><Button variant="secondary" onClick={() => setCn(false)}>Keep agreement</Button><Button variant="destructive" onClick={() => { s.setJourney(() => ({ tuition: 'cancelled', agree: { tutor: false, parent: false, change: '' }, cancelReason: why })); setCn(false); s.toast('Agreement cancelled', 'info') }}>Cancel agreement</Button></>}>
        <Field label="Reason">{(i) => <Select id={i} value={why} onChange={(e) => setWhy(e.target.value)} options={['Schedule no longer works', 'Fee not agreed', 'Found another tuition', 'Other']} />}</Field>
      </Modal>
    </div>
  )
}
