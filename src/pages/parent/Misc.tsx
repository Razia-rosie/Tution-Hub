import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Bell, CheckCircle2, Flag, ShieldCheck } from 'lucide-react'
import { useStore } from '../../lib/store'
import { confirmedKids, dateOf, fmt } from '../../lib/parent'
import { lastAbsent } from './Review'
import { maskPhone } from '../../lib/validate'
import { Avatar, Button, Card, Chip, DemoTag, EmptyState, Field, Select, StatusChip, Textarea, Toggle } from '../../components/ui'
import { Masked, PageHead } from '../../components/tutor/bits'
import Verification from './Verification'

const A = '/app/parent'

export function Notifications() {
  const s = useStore(); const kids = confirmedKids(s.pj); const [read, setRead] = useState<string[]>([])
  const items = [
    ...(s.verification.parent !== 'verified' ? [{ id: 'v', t: 'Finish verifying your account to post a tuition.', to: `${A}/settings/verification` }] : [{ id: 'v2', t: 'You are verified. You can post a tuition and chat.', to: `${A}/find-tutor` }]),
    ...kids.flatMap((k) => k.tuition ? [{ id: `a-${k.id}`, t: `${k.short}: attendance was updated after the last class.`, to: `${A}/attendance` }, { id: `h-${k.id}`, t: `${k.short}: a new assignment was set by the tutor.`, to: `${A}/homework` }] : [{ id: `n-${k.id}`, t: `${k.short} has no tuition yet. Find a tutor.`, to: `${A}/find-tutor` }]),
    ...kids.flatMap((k) => { const kj = s.pj.kj[k.id]; const out: { id: string; t: string; to: string }[] = []
      if (kj && Object.values(kj.incoming).includes('received')) out.push({ id: `i-${k.id}`, t: `${k.short}: a tutor sent interest. Accept or decline.`, to: `${A}/messages` })
      const ab = k.tuition ? lastAbsent(k, s.dayOffset) : undefined
      if (ab) out.push({ id: `ab-${k.id}-${ab.id}`, t: `${k.short} was marked absent on ${fmt(dateOf(ab.day))}. You can ask for a make-up class.`, to: `${A}/attendance` })
      if (kj && kj.stage === 'completed' && !kj.review) out.push({ id: `rv-${k.id}`, t: `${k.short}'s tuition is complete. Leave a review for the tutor.`, to: `${A}/tuitions` })
      return out }),
  ]
  return (
    <div><PageHead title="Notifications" tag="NOT-P" sub="Only about children linked to you." actions={<Button variant="secondary" size="sm" disabled={read.length === items.length} onClick={() => setRead(items.map((i) => i.id))}>Mark all read</Button>} />
      {items.length === 0 ? <Card><EmptyState title="All caught up" body="New updates will appear here." /></Card> : (
        <Card pad={false}><ul className="divide-y divide-gray-100">{items.map((i) => <li key={i.id}><Link to={i.to} onClick={() => setRead((r) => [...r, i.id])} className="flex items-center gap-3 p-4 text-sm hover:bg-offwhite-50"><Bell size={18} className={read.includes(i.id) ? 'text-gray-400' : 'text-blue-600'} aria-hidden /><span className={read.includes(i.id) ? 'flex-1 text-gray-600' : 'flex-1 font-semibold text-navy-900'}>{i.t}</span>{!read.includes(i.id) && <Chip tone="blue">New</Chip>}</Link></li>)}</ul></Card>)}
    </div>
  )
}

export function Safety() {
  const s = useStore(); const [open, setOpen] = useState(false); const [txt, setTxt] = useState(''); const [t, setT] = useState(false); const [sent, setSent] = useState(false)
  const bad = txt.trim().length < 10
  return (
    <div><PageHead title="Safety" tag="SAF-P" sub="How TuitionHub protects your child, and what to do if something feels wrong." />
      <div className="grid gap-4 md:grid-cols-2">
        {[['Verified tutors only', 'Only verified tutors can contact you. Look for the Identity Verified badge.'], ['No personal details early', 'Phone, email and your address stay hidden until you both agree and you consent.'], ['Meet in public or online first', 'For the first class, choose a trusted place and stay at home if you can.'], ['You control what is shared', 'Turn off attendance, progress or payment views per child under Children.']].map(([h, b]) => <Card key={h}><h2 className="flex items-center gap-2 text-base"><ShieldCheck size={16} className="text-teal-700" aria-hidden />{h}</h2><p className="mt-1 text-sm text-gray-600">{b}</p></Card>)}
      </div>
      <Card className="mt-6"><h2 className="text-lg">Report a concern</h2>
        {sent ? <p className="mt-2 flex items-center gap-2 text-sm text-navy-900"><CheckCircle2 size={18} className="text-emerald-600" aria-hidden />Report received. A safety reviewer will look at it. <DemoTag /></p> : open ? (
          <form className="mt-3 space-y-3" onSubmit={(e) => { e.preventDefault(); setT(true); if (!bad) { setSent(true); s.toast('Report sent (demo)', 'success') } }} noValidate>
            <Field label="What happened?" error={t && bad ? 'Please write at least 10 characters.' : ''}>{(id) => <Textarea id={id} value={txt} onChange={(e) => setTxt(e.target.value)} />}</Field>
            <div className="flex gap-2"><Button type="submit">Send report</Button><Button variant="tertiary" onClick={() => setOpen(false)}>Cancel</Button></div></form>
        ) : <Button className="mt-3" variant="secondary" icon={<Flag size={15} />} onClick={() => setOpen(true)}>Report a concern</Button>}
        <p className="mt-3 text-xs text-gray-600">In an emergency call 999. This prototype has no live safety team.</p></Card>
    </div>
  )
}

export function Settings({ sub }: { sub: string }) {
  const s = useStore(); const nav = useNavigate()
  const [prefs, setPrefs] = useState({ push: true, sms: false, weekly: true })
  if (sub.startsWith('verification')) return <Verification sub={sub.replace(/^verification\/?/, '')} />
  const f = s.pj.form
  return (
    <div><PageHead title="Profile & settings" tag="PRO-P" />
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Card><div className="flex items-center gap-3"><Avatar name="Farzana Islam" size={56} /><div><p className="font-heading text-lg font-bold text-navy-900">Farzana Islam</p><p className="text-sm text-gray-600">{f.relation} · {f.district}</p></div></div>
          <dl className="mt-4 space-y-2 text-sm"><div className="flex justify-between gap-3"><dt className="text-gray-600">Phone</dt><dd><Masked value={maskPhone(s.signup.phone || '1712345678')} /></dd></div><div className="flex justify-between gap-3"><dt className="text-gray-600">NID</dt><dd><Masked value={`•••• ••• ••• ${f.nidLast4 || '••••'}`} /></dd></div><div className="flex justify-between gap-3"><dt className="text-gray-600">Linked children</dt><dd className="font-semibold text-navy-900">{confirmedKids(s.pj).length}</dd></div></dl></Card>
        <Card><h2 className="text-lg">Verification</h2><div className="mt-2"><StatusChip state={s.verification.parent} /></div><p className="mt-2 text-sm text-gray-600">{s.verification.parent === 'verified' ? 'You can post, send interest and chat.' : 'Posting, interest and chat unlock after approval.'}</p><Link to={`${A}/settings/verification`} className="mt-3 inline-block rounded-input bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">{s.verification.parent === 'not_started' ? 'Start verification' : 'Open verification'}</Link></Card>
        <Card><h2 className="text-lg">Notifications</h2><ul className="mt-3 space-y-3 text-sm">{([['push', 'Push notifications'], ['sms', 'SMS alerts'], ['weekly', 'Weekly summary']] as const).map(([k, l]) => <li key={k} className="flex items-center justify-between gap-3"><span>{l}</span><Toggle checked={prefs[k]} onChange={(v) => setPrefs({ ...prefs, [k]: v })} label={l} /></li>)}</ul><p className="mt-3 text-xs text-gray-600"><DemoTag /> Nothing is sent in this prototype.</p></Card>
        <Card><h2 className="text-lg">Language</h2><Field label="Display language">{(id) => <Select id={id} options={['English', 'বাংলা (demo label only)']} onChange={() => s.toast('Demo: only English is built', 'info')} />}</Field><Button className="mt-4" variant="secondary" onClick={() => nav('/logout')}>Sign out</Button></Card>
      </div>
    </div>
  )
}
