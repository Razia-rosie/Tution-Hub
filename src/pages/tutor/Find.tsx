import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { CheckCircle2, CircleDot, XCircle, Search, Bookmark, EyeOff, Clock, MapPin, Shield, Undo2 } from 'lucide-react'
import { POSTS, SUBJECTS, CLASSES, AREAS, type Post } from '../../lib/data'
import { MATCHES, JOURNEY_POST, GUARDIAN, ME, type Match } from '../../lib/journey'
import { useStore } from '../../lib/store'
import { Button, Card, Chip, DemoTag, EmptyState, ErrorState, Field, Input, Modal, Select, Skeleton, Textarea, Bar, Tabs, VerifiedGate } from '../../components/ui'
import { PageHead, Locked, LockChip } from '../../components/tutor/bits'
import { RouteMap, routeOptions, BASE_DEFAULT } from '../../components/tutor/RouteMap'
import { RevealModal } from './Tuition'

const A = '/app/tutor/find-tuition'
const money = (n: number) => `৳${n.toLocaleString('en-IN')}`
const lvlIcon = { full: <CheckCircle2 size={16} className="text-teal-700" aria-label="Full match" />, partial: <CircleDot size={16} className="text-warning-600" aria-label="Partial match" />, miss: <XCircle size={16} className="text-danger-600" aria-label="No match" /> }

export function Breakdown({ m }: { m: Match }) {
  return (
    <ul className="divide-y divide-gray-200">
      {m.factors.map((f) => (
        <li key={f.key} className="grid grid-cols-[1.25rem_1fr_auto] items-start gap-x-3 gap-y-1 py-2.5">
          <span className="mt-0.5">{lvlIcon[f.level]}</span>
          <div className="min-w-0"><p className="text-sm font-semibold text-navy-900">{f.label}</p><p className="text-xs text-gray-600">{f.why}</p></div>
          <span className="tabular text-sm font-semibold text-navy-900">{f.score}/{f.weight}</span>
        </li>
      ))}
      <li className="grid grid-cols-[1fr_auto] pt-3 text-sm font-bold text-navy-900"><span>Match score <span className="font-normal text-gray-600">(points out of demo weights, total 100)</span></span><span className="tabular">{m.total}%</span></li>
    </ul>
  )
}
const matchTone = (t: number) => (t >= 85 ? 'green' : t >= 70 ? 'blue' : 'amber') as 'green' | 'blue' | 'amber'

function useLoad() {
  const [st, set] = useState('Normal')
  return [st, set] as const
}

export default function Find({ sub }: { sub: string }) {
  const parts = sub.split('/').filter(Boolean)
  if (parts[0] === 'compare') return <Compare />
  if (parts[0] === 'interests') return <Interests />
  if (parts[0] && parts[1] === 'route') return <RoutePage id={parts[0]} />
  if (parts[0] && parts[1] === 'sent') return <Sent id={parts[0]} />
  if (parts[0] && parts[1] === 'why') return <Why id={parts[0]} />
  if (parts[0]) return <Detail id={parts[0]} />
  return <List />
}

function List() {
  const s = useStore(); const j = s.journey; const nav = useNavigate()
  const [q, setQ] = useState(''); const [subj, setSubj] = useState('All'); const [cls, setCls] = useState('All'); const [mode, setMode] = useState('All'); const [area, setArea] = useState('All')
  const [sel, setSel] = useState<string[]>([]); const [ni, setNi] = useState<string | null>(null); const [reason, setReason] = useState('Not my subject focus'); const [view, setView] = useLoad(); const [showHidden, setShowHidden] = useState(false)
  const pass = (p: Post) => (subj === 'All' || p.subject === subj) && (cls === 'All' || p.cls === cls) && (mode === 'All' || p.mode === mode) && (area === 'All' || p.area === area) && (!q || `${p.subject} ${p.area} ${p.cls}`.toLowerCase().includes(q.toLowerCase()))
  const all = MATCHES.filter((m) => pass(m.post))
  const ok = all.filter((m) => !m.excluded && (showHidden || !j.notInterested.includes(m.post.id))).sort((a, b) => b.total - a.total)
  const excluded = all.filter((m) => m.excluded)
  const hidden = j.notInterested.length
  const toggle = (id: string) => setSel((x) => (x.includes(id) ? x.filter((i) => i !== id) : x.length >= 3 ? (s.toast('You can compare up to 3 tuitions', 'warning'), x) : [...x, id]))
  const clear = () => { setQ(''); setSubj('All'); setCls('All'); setMode('All'); setArea('All') }
  return (
    <div>
      <PageHead title="Find Tuition" tag="MAT-01" sub="Open requests ranked by how well they fit your subjects, class range, schedule, location and fee. Scores use fixed, visible rules, not AI."
        actions={<><Link to={`${A}/interests`} className="rounded-input border border-gray-400 bg-white px-3 py-2 text-sm font-semibold text-navy-900 hover:bg-blue-100">My interests ({Object.keys(j.interests).length})</Link>
          <label className="flex items-center gap-2 text-xs text-gray-600"><DemoTag label="Demo view" /><Select aria-label="List view state" value={view} onChange={(e) => setView(e.target.value)} options={['Normal', 'Loading', 'Error']} className="!w-auto !py-1.5" /></label></>} />
      {!s.isVerified && <div className="mb-5"><Locked what="Sending interest" /></div>}
      <Card className="mb-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="sm:col-span-2 lg:col-span-1"><Field label="Search">{(id) => <div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden /><Input id={id} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Subject or area" className="pl-9" /></div>}</Field></div>
          <Field label="Subject">{(id) => <Select id={id} value={subj} onChange={(e) => setSubj(e.target.value)} options={['All', ...SUBJECTS]} />}</Field>
          <Field label="Class">{(id) => <Select id={id} value={cls} onChange={(e) => setCls(e.target.value)} options={['All', ...CLASSES]} />}</Field>
          <Field label="Area">{(id) => <Select id={id} value={area} onChange={(e) => setArea(e.target.value)} options={['All', ...AREAS]} />}</Field>
          <Field label="Mode">{(id) => <Select id={id} value={mode} onChange={(e) => setMode(e.target.value)} options={['All', 'Offline', 'Online']} />}</Field>
        </div>
      </Card>
      {sel.length > 0 && (
        <div className="sticky top-16 z-10 mb-4 flex flex-wrap items-center justify-between gap-2 rounded-card border border-blue-600 bg-blue-100 px-4 py-2.5 text-sm">
          <span className="font-semibold text-navy-900">{sel.length} selected for comparison</span>
          <span className="flex gap-2"><Button size="sm" variant="tertiary" onClick={() => setSel([])}>Clear</Button><Button size="sm" disabled={sel.length < 2} onClick={() => nav(`${A}/compare?ids=${sel.join(',')}`)}>{sel.length < 2 ? 'Pick one more' : 'Compare'}</Button></span>
        </div>
      )}
      {view === 'Loading' ? <div className="grid gap-4 lg:grid-cols-2" aria-busy="true">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-56" />)}</div>
        : view === 'Error' ? <Card><ErrorState title="We could not load matches" onRetry={() => setView('Normal')} /></Card>
        : ok.length === 0 ? <Card><EmptyState title="No tuition matches these filters" body="Try a different subject, class or area." action={<Button variant="secondary" onClick={clear}>Clear filters</Button>} /></Card>
        : <div className="grid gap-4 lg:grid-cols-2">{ok.map((m) => <MatchCard key={m.post.id} m={m} checked={sel.includes(m.post.id)} onToggle={() => toggle(m.post.id)} onNo={() => setNi(m.post.id)} />)}</div>}
      {hidden > 0 && <p className="mt-4 text-sm text-gray-600">{hidden} hidden as not interested. <button className="font-semibold text-blue-600 hover:underline" onClick={() => setShowHidden(!showHidden)}>{showHidden ? 'Hide them again' : 'Show them'}</button></p>}
      {excluded.length > 0 && (
        <details className="mt-6 rounded-card border border-gray-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-semibold text-navy-900">Not shown as matches ({excluded.length}) · subject is outside your verified subjects</summary>
          <ul className="mt-3 space-y-2 text-sm text-gray-600">{excluded.map((m) => <li key={m.post.id} className="flex flex-wrap gap-x-3"><b className="text-navy-900">{m.post.subject}, {m.post.cls}, {m.post.area}</b><span>{m.excluded}</span></li>)}</ul>
        </details>
      )}
      <Modal open={!!ni} onClose={() => setNi(null)} title="Not interested (MAT-05)" footer={<><Button variant="secondary" onClick={() => setNi(null)}>Cancel</Button><Button onClick={() => { s.setJourney((x) => ({ notInterested: [...x.notInterested, ni!] })); setNi(null); s.toast('Hidden from your matches. Undo from the list footer.', 'info') }}>Hide this tuition</Button></>}>
        <Field label="Reason (helps improve your matches)">{(id) => <Select id={id} value={reason} onChange={(e) => setReason(e.target.value)} options={['Not my subject focus', 'Too far', 'Budget too low', 'Schedule does not fit', 'Other']} />}</Field>
      </Modal>
    </div>
  )
}

function MatchCard({ m, checked, onToggle, onNo }: { m: Match; checked: boolean; onToggle: () => void; onNo: () => void }) {
  const s = useStore(); const j = s.journey; const p = m.post; const [open, setOpen] = useState(p.id === JOURNEY_POST)
  const st = j.interests[p.id]; const saved = j.saved.includes(p.id); const hid = j.notInterested.includes(p.id)
  return (
    <Card className={hid ? 'opacity-60' : ''}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg"><Link to={`${A}/${p.id}`} className="hover:text-blue-600">{p.subject}, {p.cls}</Link></h2>
          <p className="mt-0.5 text-sm text-gray-600">{p.area} · {p.mode} · {p.days} · {p.time}</p>
        </div>
        <div className="text-right"><p className={`font-heading text-3xl font-bold tabular ${m.total >= 85 ? 'text-teal-700' : 'text-navy-900'}`}>{m.total}%</p><p className="text-xs text-gray-600">match</p></div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <Chip tone={matchTone(m.total)}>{m.total >= 85 ? 'Strong match' : m.total >= 70 ? 'Good match' : 'Partial match'}</Chip>
        <span className="font-semibold text-navy-900 tabular">{money(p.budget)}/mo</span>
        <span className="flex items-center gap-1 text-gray-600"><Clock size={13} aria-hidden /> {p.travel}</span>
        {st && <Chip tone={st === 'mutual' ? 'green' : st === 'sent' ? 'blue' : 'gray'}>{st === 'mutual' ? 'Mutual interest' : st === 'sent' ? 'Interest sent' : st === 'declined' ? 'Declined' : 'Withdrawn'}</Chip>}
        {hid && <Chip>Hidden</Chip>}
      </div>
      <button className="mt-3 text-sm font-semibold text-blue-600 hover:underline" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Hide match breakdown' : 'Show match breakdown'}</button>
      {open && <div className="mt-2 rounded-input bg-gray-100 px-4 py-2"><Breakdown m={m} /></div>}
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-200 pt-3">
        <Link to={`${A}/${p.id}`} className="rounded-input bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-navy-700">View details</Link>
        <label className="flex min-h-11 items-center gap-1.5 px-2 text-sm text-gray-600 md:min-h-0"><input type="checkbox" checked={checked} onChange={onToggle} className="h-4 w-4" /> Compare</label>
        <Button size="sm" variant="tertiary" icon={<Bookmark size={14} fill={saved ? 'currentColor' : 'none'} />} aria-pressed={saved} onClick={() => s.setJourney((x) => ({ saved: saved ? x.saved.filter((i) => i !== p.id) : [...x.saved, p.id] }))}>{saved ? 'Saved' : 'Save'}</Button>
        {hid ? <Button size="sm" variant="tertiary" icon={<Undo2 size={14} />} onClick={() => s.setJourney((x) => ({ notInterested: x.notInterested.filter((i) => i !== p.id) }))}>Undo hide</Button>
          : <Button size="sm" variant="tertiary" icon={<EyeOff size={14} />} onClick={onNo}>Not interested</Button>}
      </div>
    </Card>
  )
}

function Compare() {
  const [sp] = useSearchParams(); const ids = (sp.get('ids') ?? '').split(',').filter(Boolean).slice(0, 3)
  const ms = ids.map((i) => MATCHES.find((m) => m.post.id === i)).filter((m): m is Match => !!m)
  if (ms.length < 2) return <div><PageHead title="Compare tuitions" tag="MAT-04" crumb={{ to: A, label: 'Find Tuition' }} /><Card><EmptyState title="Pick at least two tuitions" body="Tick Compare on two or three match cards, then choose Compare." action={<Link to={A} className="text-sm font-semibold text-blue-600 hover:underline">Back to matches</Link>} /></Card></div>
  const rows: [string, (m: Match) => string][] = [['Match score', (m) => `${m.total}%`], ['Class', (m) => m.post.cls], ['Area', (m) => m.post.area], ['Mode', (m) => m.post.mode], ['Days', (m) => m.post.days], ['Time', (m) => m.post.time], ['Monthly budget', (m) => money(m.post.budget)], ['Travel', (m) => m.post.travel], ['Distance', (m) => m.post.km], ...['Subject', 'Class', 'Schedule', 'Location / travel', 'Budget', 'Preferences'].map((l): [string, (m: Match) => string] => [`${l} fit`, (m) => { const f = m.factors.find((x) => x.label === l); return f ? `${f.score}/${f.weight}` : '—' }])]
  const best = Math.max(...ms.map((m) => m.total))
  return (
    <div>
      <PageHead title="Compare tuitions" tag="MAT-04" crumb={{ to: A, label: 'Find Tuition' }} sub="Side by side, up to three. The highest score is marked." />
      <Card pad={false} className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-left text-sm">
          <thead><tr className="border-b border-gray-200 bg-gray-100"><th className="p-3 font-semibold text-gray-600" scope="col">Factor</th>{ms.map((m) => <th key={m.post.id} scope="col" className="p-3 font-heading text-navy-900"><Link to={`${A}/${m.post.id}`} className="hover:text-blue-600">{m.post.subject}, {m.post.cls}</Link>{m.total === best && <div className="mt-1"><Chip tone="green">Best fit</Chip></div>}</th>)}</tr></thead>
          <tbody>{rows.map(([l, f]) => <tr key={l} className="border-b border-gray-200 last:border-0"><th scope="row" className="p-3 font-medium text-gray-600">{l}</th>{ms.map((m) => <td key={m.post.id} className="tabular p-3 text-navy-900">{f(m)}</td>)}</tr>)}</tbody>
        </table>
      </Card>
    </div>
  )
}

function Why({ id }: { id: string }) {
  const m = MATCHES.find((x) => x.post.id === id)
  if (!m) return <div><PageHead title="Why this match" tag="MAT-03" crumb={{ to: A, label: 'Find Tuition' }} /><Card><EmptyState title="Tuition not found" body="It may have been closed." /></Card></div>
  return (
    <div>
      <PageHead title="Why this match" tag="MAT-03" crumb={{ to: `${A}/${id}`, label: 'Tuition details' }} sub={`${m.post.subject}, ${m.post.cls} in ${m.post.area}`} />
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>{m.excluded ? <p className="text-sm text-gray-600">{m.excluded}</p> : <Breakdown m={m} />}</Card>
        <Card><h2 className="text-lg">How scoring works <DemoTag label="Demo weights" /></h2><p className="mt-2 text-sm text-gray-600">Demo weights: eight factors add up to 100. Subject 25, Class 15, Schedule 15, Location 15, Budget 15, Verification 5, Experience 5, Preferences 5. A subject mismatch removes the tuition from your matches. Nothing here is AI; the rules are fixed and shown.</p></Card>
      </div>
    </div>
  )
}

function Detail({ id }: { id: string }) {
  const s = useStore(); const j = s.journey; const nav = useNavigate()
  const m = MATCHES.find((x) => x.post.id === id); const [ask, setAsk] = useState(false); const [msg, setMsg] = useState(''); const [wd, setWd] = useState(false)
  if (!m) return <div><PageHead title="Tuition details" crumb={{ to: A, label: 'Find Tuition' }} /><Card><EmptyState title="Tuition not found" body="It may have been closed by the guardian." action={<Link to={A} className="text-sm font-semibold text-blue-600 hover:underline">Back to matches</Link>} /></Card></div>
  const p = m.post; const st = j.interests[id]; const r = routeOptions(p)[0]
  const send = () => { s.setJourney((x) => ({ interests: { ...x.interests, [id]: 'sent' } })); setAsk(false); s.toast('Interest sent to the guardian', 'success'); nav(`${A}/${id}/sent`) }
  return (
    <div>
      <PageHead title={`${p.subject}, ${p.cls}`} tag="TD-01" crumb={{ to: A, label: 'Find Tuition' }} sub={`${p.area} · posted ${p.posted} · by ${GUARDIAN[id]} (${p.by})`}
        actions={m.excluded ? <Chip>Outside your subjects</Chip> : <Chip tone={matchTone(m.total)}>{m.total}% match</Chip>} />
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Card><h2 className="text-lg">Requirement</h2>
            <dl className="mt-3 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">{([['Subject', p.subject], ['Class', p.cls], ['Medium', p.medium], ['Mode', p.mode], ['Days', p.days], ['Time', p.time], ['Monthly budget', money(p.budget)], ['Area', p.area]] as const).map(([k, v]) => <div key={k}><dt className="text-gray-600">{k}</dt><dd className="font-semibold text-navy-900">{v}</dd></div>)}</dl>
            <p className="mt-4 rounded-input bg-gray-100 p-3 text-sm text-gray-600"><b className="text-navy-900">Guardian note:</b> {p.requirements}</p>
          </Card>
          <Card><div className="flex items-center justify-between gap-2"><h2 className="text-lg">Route preview</h2><DemoTag label="Demo map" /></div>
            <div className="mt-3"><RouteMap post={p} base={BASE_DEFAULT} /></div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm"><span className="text-gray-600"><b className="text-navy-900">{r.km}</b> · about <b className="text-navy-900">{p.mode === 'Online' ? 'no travel' : r.time}</b> · approximate area only</span><Link to={`${A}/${id}/route`} className="font-semibold text-blue-600 hover:underline">Open route options</Link></div>
          </Card>
        </div>
        <div className="space-y-6">
          {!m.excluded && <Card><div className="flex items-center justify-between"><h2 className="text-lg">Match breakdown</h2><Link to={`${A}/${id}/why`} className="text-sm font-semibold text-blue-600 hover:underline">Why?</Link></div><div className="mt-2"><Breakdown m={m} /></div></Card>}
          <Card>
            <h2 className="text-lg">Your interest</h2>
            {m.excluded ? <p className="mt-2 text-sm text-gray-600">{m.excluded} Interest is disabled for this tuition.</p>
              : !st || st === 'withdrawn' || st === 'declined' ? (<>
                <p className="mt-2 text-sm text-gray-600">{st === 'withdrawn' ? 'You withdrew earlier. You can send interest again.' : st === 'declined' ? 'The guardian declined this time.' : 'Sending interest shares your public profile and match score with the guardian. Contact details stay hidden.'}</p>
                <div className="mt-4"><VerifiedGate what="Sending interest"><Button className="w-full" disabled={st === 'declined'} onClick={() => setAsk(true)}>I'm Interested</Button></VerifiedGate></div>
                {!s.isVerified && <p className="mt-3 text-xs text-gray-600"><LockChip>Locked until verified</LockChip> <Link to="/app/tutor/verification" className="font-semibold text-blue-600 hover:underline">Continue verification</Link></p>}
              </>) : (<>
                <p className="mt-2"><Chip tone={st === 'mutual' ? 'green' : 'blue'}>{st === 'mutual' ? 'Mutual interest' : 'Interest sent'}</Chip></p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link to={st === 'mutual' ? `/app/tutor/messages/${id}` : `${A}/${id}/sent`} className="rounded-input bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-navy-700">{st === 'mutual' ? 'Open chat' : 'View status'}</Link>
                  {st === 'sent' && <Button variant="secondary" onClick={() => setWd(true)}>Withdraw</Button>}
                </div></>)}
          </Card>
        </div>
      </div>
      <Modal open={ask} onClose={() => setAsk(false)} title="Send interest" footer={<><Button variant="secondary" onClick={() => setAsk(false)}>Cancel</Button><Button onClick={send}>Send interest</Button></>}>
        <p className="text-sm text-gray-600">The guardian sees your verified badges, rating and a {m.total}% match. They can accept or decline. If both of you are interested, chat opens.</p>
        <div className="mt-3"><Field label="Short note (optional)">{(i) => <Textarea id={i} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Introduce your teaching style in a sentence" maxLength={200} />}</Field></div>
      </Modal>
      <WithdrawModal open={wd} onClose={() => setWd(false)} id={id} />
    </div>
  )
}

export function WithdrawModal({ open, onClose, id }: { open: boolean; onClose: () => void; id: string }) {
  const s = useStore(); const [why, setWhy] = useState('Schedule changed')
  return (
    <Modal open={open} onClose={onClose} title="Withdraw interest (INT-06)" footer={<><Button variant="secondary" onClick={onClose}>Keep interest</Button><Button variant="destructive" onClick={() => { s.setJourney((x) => ({ interests: { ...x.interests, [id]: 'withdrawn' } })); onClose(); s.toast('Interest withdrawn', 'info') }}>Withdraw</Button></>}>
      <p className="text-sm text-gray-600">The guardian will be told that you are no longer available. You can send interest again later.</p>
      <div className="mt-3"><Field label="Reason">{(i) => <Select id={i} value={why} onChange={(e) => setWhy(e.target.value)} options={['Schedule changed', 'Found another tuition', 'Too far', 'Other']} />}</Field></div>
    </Modal>
  )
}

function Sent({ id }: { id: string }) {
  const s = useStore(); const j = s.journey; const st = j.interests[id]; const [wd, setWd] = useState(false)
  const p = POSTS.find((x) => x.id === id)
  if (!p || !st) return <div><PageHead title="Interest sent" tag="INT-01" crumb={{ to: A, label: 'Find Tuition' }} /><Card><EmptyState title="No interest sent for this tuition" body="Open the tuition and choose I'm Interested." action={<Link to={`${A}/${id}`} className="text-sm font-semibold text-blue-600 hover:underline">Open tuition</Link>} /></Card></div>
  const featured = id === JOURNEY_POST
  return (
    <div>
      <PageHead title={st === 'mutual' ? 'Mutual interest' : st === 'sent' ? 'Interest sent' : st === 'declined' ? 'Interest closed' : 'Interest withdrawn'} tag={st === 'mutual' ? 'INT-04' : st === 'sent' ? 'INT-01' : 'INT-05'} crumb={{ to: `${A}/interests`, label: 'My interests' }} sub={`${p.subject}, ${p.cls} in ${p.area}`} />
      <Card className="max-w-2xl">
        {st === 'sent' && <><p className="font-heading text-xl font-bold text-navy-900">Waiting for {GUARDIAN[id]}</p><p className="mt-1 text-sm text-gray-600">They have your profile and a match score. Most guardians reply within two days. You will be notified here and in Notifications.</p></>}
        {st === 'mutual' && <><p className="font-heading text-xl font-bold text-teal-700">Both of you are interested</p><p className="mt-1 text-sm text-gray-600">Chat is now open. Phone and email stay masked until the agreement is confirmed.</p></>}
        {st === 'withdrawn' && <p className="text-sm text-gray-600">You withdrew your interest. The guardian was informed.</p>}
        {st === 'declined' && <p className="text-sm text-gray-600">The guardian chose another option. Similar matches are in your list.</p>}
        <div className="mt-5 flex flex-wrap gap-2">
          {st === 'mutual' && <Link to={`/app/tutor/messages/${id}`} className="rounded-input bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-700">Open chat</Link>}
          {st === 'sent' && featured && <Button variant="secondary" icon={<DemoTag label="Demo" />} onClick={() => { s.parentAccepts(id); s.toast('Demo: guardian accepted', 'success') }}>Parent accepts</Button>}
          {st === 'sent' && <Button variant="secondary" onClick={() => setWd(true)}>Withdraw interest</Button>}
          <Link to={A} className="rounded-input px-4 py-2.5 text-sm font-semibold text-blue-600 hover:bg-blue-100">Back to matches</Link>
        </div>
        {st === 'sent' && !featured && <p className="mt-4 text-xs text-gray-600">Demo note: only the featured Physics, HSC request has a simulated guardian reply.</p>}
      </Card>
      <WithdrawModal open={wd} onClose={() => setWd(false)} id={id} />
    </div>
  )
}

function Interests() {
  const s = useStore(); const j = s.journey; const [tab, setTab] = useState('Sent')
  const sent = Object.entries(j.interests)
  const recv = Object.entries(j.requests)
  return (
    <div>
      <PageHead title="My interests" tag="INT-01 · INT-02" crumb={{ to: A, label: 'Find Tuition' }} sub="Interest you sent, and requests guardians sent you." />
      <Tabs tabs={['Sent', 'Received']} value={tab} onChange={setTab} />
      <div className="mt-4 space-y-3">
        {tab === 'Sent' ? (sent.length === 0 ? <Card><EmptyState title="No interest sent yet" body="Open a match and choose I'm Interested." action={<Link to={A} className="text-sm font-semibold text-blue-600 hover:underline">Find tuition</Link>} /></Card>
          : sent.map(([id, st]) => { const p = POSTS.find((x) => x.id === id)!; return <Card key={id} className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold text-navy-900">{p.subject}, {p.cls} · {p.area}</p><p className="text-sm text-gray-600">{money(p.budget)}/mo · {GUARDIAN[id]}</p></div><div className="flex items-center gap-3"><Chip tone={st === 'mutual' ? 'green' : st === 'sent' ? 'blue' : 'gray'}>{st === 'mutual' ? 'Mutual' : st === 'sent' ? 'Sent' : st === 'declined' ? 'Closed' : 'Withdrawn'}</Chip><Link to={`${A}/${id}/sent`} className="text-sm font-semibold text-blue-600 hover:underline">Open</Link></div></Card> }))
          : <><p className="text-sm text-gray-600">Answer these from <Link to="/app/tutor/my-posts" className="font-semibold text-blue-600 hover:underline">My Posts</Link>.</p>{recv.map(([id, st]) => <Card key={id} className="flex flex-wrap items-center justify-between gap-3"><span className="text-sm font-semibold text-navy-900">Request {id.toUpperCase()}</span><Chip tone={st === 'accepted' ? 'green' : st === 'declined' ? 'gray' : 'amber'}>{st === 'received' ? 'Awaiting you' : st}</Chip></Card>)}</>}
      </div>
    </div>
  )
}

function RoutePage({ id }: { id: string }) {
  const s = useStore(); const j = s.journey; const p = POSTS.find((x) => x.id === id)
  const [base, setBase] = useState(BASE_DEFAULT); const [pick, setPick] = useState('fast'); const [why, setWhy] = useState(false); const [reveal, setReveal] = useState(false)
  if (!p) return <div><PageHead title="Route" tag="MAP-01" crumb={{ to: A, label: 'Find Tuition' }} /><Card><EmptyState title="Tuition not found" body="Pick one from your matches." /></Card></div>
  const opts = routeOptions(p).map((o) => (base === BASE_DEFAULT ? o : { ...o, km: `${(parseFloat(o.km) + (AREAS.indexOf(base) % 4) + 1.5).toFixed(1)} km`, time: o.time })); const cur = opts.find((o) => o.id === pick) ?? opts[0]
  const unlocked = id === JOURNEY_POST && j.agree.tutor && j.agree.parent
  return (
    <div>
      <PageHead title="Route to the tuition" tag="MAP-01" crumb={{ to: `${A}/${id}`, label: 'Tuition details' }} sub={`${p.subject}, ${p.cls} · ${p.area}`} actions={<DemoTag label="Demo map, not live GPS" />} />
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-4">
          <RouteMap post={p} base={base} exact={unlocked && j.addressRevealed} opt={cur} />
          <Card><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm text-gray-600">{cur.label}</p><p className="font-heading text-2xl font-bold text-navy-900 tabular">{cur.km} · {p.mode === 'Online' ? 'no travel' : cur.time.includes('min') ? cur.time : `${cur.time} min`}</p></div>
            <Field label="Start from (MAP-02)">{(i) => <Select id={i} value={base} onChange={(e) => setBase(e.target.value)} options={AREAS} />}</Field></div></Card>
        </div>
        <div className="space-y-4">
          <Card><h2 className="text-lg">Alternatives (MAP-03)</h2>
            <div role="radiogroup" aria-label="Route alternatives" className="mt-3 space-y-2">{opts.map((o) => <button key={o.id} role="radio" aria-checked={o.id === pick} onClick={() => setPick(o.id)} className={`w-full rounded-input border p-3 text-left text-sm ${o.id === pick ? 'border-blue-600 bg-blue-100' : 'border-gray-200 hover:border-gray-400'}`}><span className="flex justify-between font-semibold text-navy-900"><span>{o.label}</span><span className="tabular">{o.km}</span></span><span className="block text-gray-600">{o.time.includes('min') ? o.time : `${o.time} min`} · {o.note}</span></button>)}</div>
          </Card>
          <Card><h2 className="flex items-center gap-2 text-lg"><Shield size={18} className="text-teal-700" aria-hidden /> Location privacy</h2>
            <p className="mt-2 text-sm text-gray-600">You see the area centre only, never the house. The exact address unlocks after the agreement is confirmed, only for you, and each view is logged.</p>
            <div className="mt-3 flex flex-wrap gap-2"><Button variant="secondary" size="sm" onClick={() => setWhy(true)}>Why approximate? (MAP-05)</Button>
              {unlocked ? <Button size="sm" icon={<MapPin size={14} />} onClick={() => (j.addressRevealed ? s.toast('Address already revealed. See the access log in Safety.', 'info') : setReveal(true))}>{j.addressRevealed ? 'Address revealed' : 'Reveal exact address'}</Button> : <LockChip>Exact address after agreement</LockChip>}</div>
            {unlocked && j.addressRevealed && <p className="mt-3 rounded-input bg-gray-100 p-3 text-sm"><b className="text-navy-900">House 14, Road 7, Sector 11, Uttara, Dhaka</b><br /><span className="text-xs text-gray-600">DEMO address. Logged in your access log.</span></p>}
          </Card>
        </div>
      </div>
      <Modal open={why} onClose={() => setWhy(false)} title="Why the map is approximate (MAP-05)" footer={<Button onClick={() => setWhy(false)}>Got it</Button>}><p className="text-sm text-gray-600">Before a tuition is agreed, guardians and students are strangers. Showing an area centre protects families. After both sides confirm the agreement, you can reveal the exact address once you need to travel, and the guardian can see that you did.</p></Modal>
      <RevealModal open={reveal} onClose={() => setReveal(false)} />
    </div>
  )
}
