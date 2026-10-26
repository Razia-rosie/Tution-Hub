import { useState } from 'react'
import { Link } from 'react-router'
import { Bell, ShieldAlert } from 'lucide-react'
import { ME, REQUESTS, OLD_REVIEWS } from '../../lib/journey'
import { useStore } from '../../lib/store'
import { Avatar, Button, Card, Chip, DemoTag, EmptyState, Field, Input, Modal, Select, Tabs, Textarea, VerifiedGate, VerifyBadge } from '../../components/ui'
import { Locked, PageHead } from '../../components/tutor/bits'
import { WithdrawModal } from './Find'
import { threadInfo } from './Tuition'

const A = '/app/tutor'
const money = (n: number) => `৳${n.toLocaleString('en-IN')}`

export function MyPosts() {
  const s = useStore(); const j = s.journey; const [ed, setEd] = useState(false); const [del, setDel] = useState(false); const [note, setNote] = useState(j.profile.note); const [fee, setFee] = useState(String(j.profile.fee)); const [dr, setDr] = useState<string | null>(null); const [wd, setWd] = useState<string | null>(null)
  const av = j.availability
  const set = (a: typeof av, msg: string) => { s.setJourney(() => ({ availability: a })); s.toast(msg, 'success') }
  const sentList = Object.entries(j.interests).filter(([, v]) => v === 'sent')
  return (
    <div>
      <PageHead title="My Posts" tag="POST-06..09 · INT-02" sub="Your availability post, and the requests guardians sent you." />
      {!s.isVerified && <div className="mb-5"><Locked what="Posting availability" /></div>}
      {av === 'deleted' ? <Card><EmptyState title="Availability post deleted" body="Guardians can no longer find you in tutor search." action={<VerifiedGate what="Posting"><Button onClick={() => set('published', 'Availability published')}>Publish a new post</Button></VerifiedGate>} /></Card> : (
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg">Mathematics and Physics, Classes 9–12</h2><p className="text-sm text-gray-600">{j.profile.note}</p><p className="mt-1 text-sm font-semibold text-navy-900 tabular">{money(j.profile.fee)}/month · {j.profile.mode}</p></div>
            <Chip tone={av === 'published' ? 'green' : av === 'paused' ? 'amber' : 'gray'}>{av === 'published' ? 'Published' : av === 'paused' ? 'Paused' : 'Draft'}</Chip></div>
          <div className="mt-4 flex flex-wrap gap-2"><VerifiedGate what="Editing your post">
            {av === 'draft' && <Button size="sm" onClick={() => set('published', 'Availability published (POST-06)')}>Publish</Button>}
            {av === 'published' && <Button size="sm" variant="secondary" onClick={() => set('paused', 'Post paused. You are hidden from search (POST-08)')}>Pause</Button>}
            {av === 'paused' && <Button size="sm" onClick={() => set('published', 'Post resumed (POST-08)')}>Resume</Button>}
            <Button size="sm" variant="secondary" onClick={() => { setNote(j.profile.note); setFee(String(j.profile.fee)); setEd(true) }}>Edit</Button>
            <Button size="sm" variant="tertiary" onClick={() => setDel(true)}>Delete</Button></VerifiedGate></div>
        </Card>)}
      <h2 className="mb-3 mt-8 text-xl">Requests from guardians (INT-02)</h2>
      <div className="space-y-3">{REQUESTS.map((r) => { const st = j.requests[r.id]; return (
        <Card key={r.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-navy-900">{r.from}</p><p className="text-sm text-gray-600">{r.subject}, {r.cls} · {r.area} · {money(r.budget)}/mo</p><p className="mt-1 text-sm">{r.note}</p></div><Chip tone={st === 'received' ? 'amber' : st === 'accepted' ? 'green' : 'gray'}>{st === 'received' ? 'Awaiting you' : st === 'accepted' ? 'Accepted' : 'Declined'}</Chip></div>
          {st === 'received' && <div className="mt-3 flex flex-wrap gap-2"><VerifiedGate what="Accepting"><Button size="sm" onClick={() => { s.parentAccepts(r.id); s.toast('Accepted. Chat is open.', 'success') }}>Accept</Button></VerifiedGate><Button size="sm" variant="secondary" onClick={() => setDr(r.id)}>Decline</Button></div>}
          {st === 'accepted' && <Link to={`${A}/messages/${r.id}`} className="mt-3 inline-block text-sm font-semibold text-blue-600 hover:underline">Open chat</Link>}</Card>) })}</div>
      {sentList.length > 0 && <><h2 className="mb-3 mt-8 text-xl">Interest you sent</h2><div className="space-y-2">{sentList.map(([id]) => <Card key={id} className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-semibold text-navy-900">{threadInfo(id).title} · {threadInfo(id).area}</span><span className="flex gap-2"><Link to={`${A}/find-tuition/${id}/sent`} className="text-sm font-semibold text-blue-600 hover:underline">Status</Link><button className="text-sm font-semibold text-danger-600 hover:underline" onClick={() => setWd(id)}>Withdraw</button></span></Card>)}</div></>}
      <Modal open={ed} onClose={() => setEd(false)} title="Edit availability (POST-07)" footer={<><Button variant="secondary" onClick={() => setEd(false)}>Cancel</Button><Button disabled={!(Number(fee) >= 1000)} onClick={() => { s.setJourney((x) => ({ profile: { ...x.profile, note: note.trim() || x.profile.note, fee: Number(fee) } })); setEd(false); s.toast('Post updated', 'success') }}>Save</Button></>}>
        <div className="space-y-3"><Field label="Availability note">{(i) => <Textarea id={i} value={note} onChange={(e) => setNote(e.target.value)} />}</Field><Field label="Monthly fee (৳)" error={Number(fee) >= 1000 ? undefined : 'Enter at least ৳1,000.'}>{(i) => <Input id={i} inputMode="numeric" value={fee} onChange={(e) => setFee(e.target.value.replace(/\D/g, ''))} />}</Field></div>
      </Modal>
      <Modal open={del} onClose={() => setDel(false)} title="Delete this availability post? (POST-09)" footer={<><Button variant="secondary" onClick={() => setDel(false)}>Keep it</Button><Button variant="destructive" onClick={() => { set('deleted', 'Post deleted'); setDel(false) }}>Delete</Button></>}><p className="text-sm text-gray-600">Guardians will no longer find you in search. Interests already sent stay open.</p></Modal>
      <Modal open={!!dr} onClose={() => setDr(null)} title="Decline this request?" footer={<><Button variant="secondary" onClick={() => setDr(null)}>Cancel</Button><Button onClick={() => { s.setJourney((x) => ({ requests: { ...x.requests, [dr!]: 'declined' } })); setDr(null); s.toast('Request declined (INT-05)', 'info') }}>Decline</Button></>}><p className="text-sm text-gray-600">The guardian is told you are unavailable.</p></Modal>
      {wd && <WithdrawModal open onClose={() => setWd(null)} id={wd} />}
    </div>
  )
}

export function Profile() {
  const s = useStore(); const j = s.journey; const [ed, setEd] = useState(false); const [bio, setBio] = useState(j.profile.bio); const [mode, setMode] = useState(j.profile.mode)
  return (
    <div>
      <PageHead title="Profile" tag="PRO-T1" sub="What guardians see on your public profile." actions={<><Link to={`/tutors/${ME.id}`} className="rounded-input border border-gray-400 bg-white px-3 py-2 text-sm font-semibold text-navy-900 hover:bg-blue-100">View public profile</Link><Button onClick={() => { setBio(j.profile.bio); setMode(j.profile.mode); setEd(true) }}>Edit</Button></>} />
      <Card><div className="flex flex-wrap items-center gap-4"><Avatar name={ME.name} size={64} /><div><h2 className="text-xl">{ME.name}</h2><p className="text-sm text-gray-600">{ME.subjects.join(', ')} · {ME.classes} · {ME.area}</p></div></div>
        <div className="mt-4 flex flex-wrap gap-2">{(['identity', 'education', 'experience', 'skill'] as const).map((k) => <VerifyBadge key={k} kind={k} active={s.isVerified && (k !== 'skill' || ME.badges.includes('skill'))} />)}</div>
        <p className="mt-4 text-sm">{j.profile.bio}</p>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">{[['Fee', `${money(j.profile.fee)}/mo`], ['Mode', j.profile.mode], ['Experience', `${ME.years} years`]].map(([k, v]) => <div key={k}><dt className="text-gray-600">{k}</dt><dd className="font-semibold text-navy-900">{v}</dd></div>)}</dl>
        {!s.isVerified && <p className="mt-4 text-sm text-gray-600">Badges appear after verification. <Link to={`${A}/verification`} className="font-semibold text-blue-600 hover:underline">Open Verification Center</Link></p>}</Card>
      <Modal open={ed} onClose={() => setEd(false)} title="Edit profile" footer={<><Button variant="secondary" onClick={() => setEd(false)}>Cancel</Button><Button disabled={bio.trim().length < 20} onClick={() => { s.setJourney((x) => ({ profile: { ...x.profile, bio: bio.trim(), mode } })); setEd(false); s.toast('Profile saved', 'success') }}>Save</Button></>}>
        <div className="space-y-3"><Field label="About you" error={bio.trim().length < 20 ? 'At least 20 characters.' : undefined}>{(i) => <Textarea id={i} value={bio} onChange={(e) => setBio(e.target.value)} />}</Field><Field label="Teaching mode">{(i) => <Select id={i} value={mode} onChange={(e) => setMode(e.target.value)} options={['Offline', 'Online', 'Both']} />}</Field></div>
        <p className="mt-3 text-xs text-gray-600">Name, subjects and badges change only through verification.</p>
      </Modal>
      {OLD_REVIEWS.length > 0 && <p className="mt-4 text-sm text-gray-600">Your reviews are on the <Link to={`${A}/reviews`} className="font-semibold text-blue-600 hover:underline">Reviews</Link> page.</p>}
    </div>
  )
}

export function Notifications() {
  const s = useStore(); const j = s.journey; const [tab, setTab] = useState('All')
  const items: { id: string; text: string; to: string; show: boolean }[] = [
    { id: 'n-ver', text: `Verification: ${s.verification.tutor.replace('_', ' ')}`, to: 'verification', show: s.verification.tutor !== 'not_started' },
    { id: 'n-int', text: 'Interest sent for Physics, HSC', to: 'find-tuition/p-2/sent', show: !!j.interests['p-2'] },
    { id: 'n-mut', text: 'Mutual interest with Mrs. Shabnam. Chat is open.', to: 'messages/p-2', show: j.interests['p-2'] === 'mutual' },
    { id: 'n-act', text: 'Tuition active: Physics, HSC with Ayaan', to: 'my-students', show: j.tuition === 'active' || j.tuition === 'completed' },
    { id: 'n-hw', text: 'Ayaan submitted homework', to: 'homework', show: j.hw.some((h) => h.state === 'submitted') },
    { id: 'n-rev', text: 'New verified review from a guardian', to: 'reviews', show: j.reviewReceived || Object.values(s.pj.kj).some((k) => k.review && k.tutorId === 'tanvir-ahmed-rahman') },
    { id: 'n-r1', text: 'Mrs. Farzana Haque sent you a tuition request', to: 'my-posts', show: j.requests['r-1'] === 'received' },
    { id: 'n-r2', text: 'Mr. Nasir Uddin sent you a tuition request', to: 'my-posts', show: j.requests['r-2'] === 'received' },
    { id: 'n-sys', text: 'Welcome to TuitionHub. Complete verification to unlock interest and chat.', to: 'verification', show: true },
  ]
  const shown = items.filter((i) => i.show && (tab === 'All' || !j.notifRead.includes(i.id)))
  const unread = items.filter((i) => i.show && !j.notifRead.includes(i.id)).length
  return (
    <div>
      <PageHead title="Notifications" tag="NOT-01" sub={`${unread} unread`} actions={<Button variant="secondary" size="sm" disabled={!unread} onClick={() => s.setJourney((x) => ({ notifRead: items.map((i) => i.id) }))}>Mark all read</Button>} />
      <Tabs tabs={['All', 'Unread']} value={tab} onChange={setTab} />
      <div className="mt-4 space-y-2">{shown.length === 0 ? <Card><EmptyState title={tab === 'Unread' ? 'You are all caught up' : 'No notifications'} body="New activity shows up here." /></Card>
        : shown.map((n) => { const read = j.notifRead.includes(n.id); return <Card key={n.id} className="flex flex-wrap items-center gap-3"><Bell size={18} className={read ? 'text-gray-400' : 'text-blue-600'} aria-hidden /><Link to={`${A}/${n.to}`} onClick={() => s.setJourney((x) => ({ notifRead: [...new Set([...x.notifRead, n.id])] }))} className={`min-w-0 flex-1 text-sm hover:text-blue-600 ${read ? 'text-gray-600' : 'font-semibold text-navy-900'}`}>{n.text}</Link>{!read && <Chip tone="blue">New</Chip>}</Card> })}</div>
    </div>
  )
}

export function Safety() {
  const s = useStore(); const j = s.journey; const [tab, setTab] = useState('Overview'); const [rp, setRp] = useState(false); const [why, setWhy] = useState('Suspicious request'); const [det, setDet] = useState('')
  return (
    <div>
      <PageHead title="Safety" tag="SAF-01..10" sub="Your safety tools, in one place." actions={<Button variant="secondary" icon={<ShieldAlert size={16} />} onClick={() => setRp(true)}>Report a problem</Button>} />
      <Tabs tabs={['Overview', 'Reports', 'Blocked', 'Access log']} value={tab} onChange={setTab} />
      <div className="mt-5">
        {tab === 'Overview' && <div className="grid gap-4 md:grid-cols-2">{[['Meet only at the agreed place', 'Use the exact address only after the agreement. Tell someone you trust where you are going.'], ['Keep contact on the platform', 'Phone and email stay masked until agreement. Report anyone asking for payment or contact outside TuitionHub.'], ['Trial classes are short', 'Request a trial class in chat before committing to a full month.'], ['Emergency', 'In an emergency, call 999 (Bangladesh national emergency line). This prototype cannot call or send alerts.']].map(([t, b]) => <Card key={t}><h2 className="text-base">{t}</h2><p className="mt-1 text-sm text-gray-600">{b}</p></Card>)}</div>}
        {tab === 'Reports' && (j.reported.length === 0 ? <Card><EmptyState title="No reports filed" body="Reports you send from chat or here appear in this list." /></Card> : <div className="space-y-2">{j.reported.map((r, i) => <Card key={i} className="flex flex-wrap justify-between gap-2"><span className="text-sm text-navy-900">{r.split('|')[1]}</span><Chip tone="amber">Under review (Demo)</Chip></Card>)}</div>)}
        {tab === 'Blocked' && (j.blocked.length === 0 ? <Card><EmptyState title="No blocked contacts" body="Block someone from a chat if you feel uncomfortable." /></Card> : <div className="space-y-2">{j.blocked.map((b) => <Card key={b} className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm text-navy-900">{threadInfo(b).who}</span><Button size="sm" variant="secondary" onClick={() => s.setJourney((x) => ({ blocked: x.blocked.filter((i) => i !== b) }))}>Unblock</Button></Card>)}</div>)}
        {tab === 'Access log' && <Card><h2 className="text-lg">Exact-address access log</h2>{j.accessLog.length === 0 ? <p className="mt-2 text-sm text-gray-600">You have not viewed any exact address. <DemoTag /></p> : <ul className="mt-3 space-y-2 text-sm">{j.accessLog.map((l, i) => <li key={i} className="rounded-input bg-gray-100 px-3 py-2">{l}</li>)}</ul>}</Card>}
      </div>
      <Modal open={rp} onClose={() => setRp(false)} title="Report a problem" footer={<><Button variant="secondary" onClick={() => setRp(false)}>Cancel</Button><Button disabled={det.trim().length < 5} onClick={() => { s.setJourney((x) => ({ reported: [...x.reported, `general|${why}`] })); setRp(false); setDet(''); s.toast('Report sent (Demo)', 'success') }}>Send report</Button></>}>
        <div className="space-y-3"><Field label="Type">{(i) => <Select id={i} value={why} onChange={(e) => setWhy(e.target.value)} options={['Suspicious request', 'Safety concern', 'Fake profile', 'Other']} />}</Field><Field label="Details" hint="At least 5 characters">{(i) => <Textarea id={i} value={det} onChange={(e) => setDet(e.target.value)} />}</Field></div>
      </Modal>
    </div>
  )
}
