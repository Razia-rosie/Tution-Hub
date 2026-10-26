import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { AlertTriangle, CheckCircle2, Clock, Lock, ShieldOff, Trash2, UserPlus, Eye, SlidersHorizontal } from 'lucide-react'
import { useStore } from '../../lib/store'
import { NOT_LINKED_ID, RELATIONS, tutOf, kidFrom, lookup, confirmedKids, type Kid, type Perm } from '../../lib/parent'
import { Avatar, Button, Card, Chip, DemoTag, EmptyState, Field, Input, Modal, Select, Toggle } from '../../components/ui'
import { PageHead } from '../../components/tutor/bits'

const C = '/app/parent/children'

export function LinkForm({ onDone, submitLabel = 'Send link request' }: { onDone?: (k: Kid) => void; submitLabel?: string }) {
  const s = useStore(); const pj = s.pj
  const [id, setId] = useState(''); const [year, setYear] = useState(''); const [rel, setRel] = useState(pj.form.relation)
  const [consent, setConsent] = useState(false); const [touched, setTouched] = useState(false); const [err, setErr] = useState('')
  const missing = touched && !consent
  const submit = () => {
    setTouched(true); setErr('')
    if (!consent) return
    const r = lookup(id, year, pj.kids)
    if (!r.ok) { setErr(r.error); return }
    const kid = kidFrom(r.dir, rel, 'requested')
    s.setPJ((p) => ({ kids: [...p.kids, kid], pv: { ...p.pv, link: true } }))
    s.setPJ((p) => ({ log: [...p.log, `Link requested for ${kid.short}`] }))
    s.toast(`Link request sent for ${kid.short}. Waiting for confirmation.`, 'success')
    setId(''); setYear(''); setConsent(false); setTouched(false)
    onDone?.(kid)
  }
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); submit() }} noValidate>
      <Field label="Student ID" hint="Your child finds this under Profile in their TuitionHub account. Demo IDs: ST-2041, ST-2042." error={err.includes('ID in the form') ? err : ''}>{(i) => <Input id={i} value={id} onChange={(e) => setId(e.target.value)} placeholder="ST-2041" maxLength={7} autoComplete="off" />}</Field>
      <Field label="Student's birth year" hint="Demo: Ayaan 2008, Mim 2013." error={err.includes('birth year') ? err : ''}>{(i) => <Input id={i} inputMode="numeric" maxLength={4} value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, ''))} />}</Field>
      <Field label="Your relationship">{(i) => <Select id={i} value={rel} onChange={(e) => setRel(e.target.value)} options={RELATIONS} />}</Field>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-4 w-4" /><span>I am this student's parent or legal guardian and I agree that TuitionHub may ask them to confirm.</span></label>
      {missing && <p role="alert" className="text-sm text-danger-600">Please tick the confirmation to continue.</p>}
      {err && !err.includes('ID in the form') && !err.includes('birth year') && <p role="alert" className="flex items-start gap-2 rounded-input bg-danger-100 p-3 text-sm text-danger-600"><AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />{err}</p>}
      <div className="flex flex-wrap items-center gap-3"><Button type="submit" icon={<UserPlus size={16} />}>{submitLabel}</Button><span className="flex items-center gap-2 text-xs text-gray-600"><DemoTag /> Matches the fictional student directory only.</span></div>
    </form>
  )
}

export function LinkChip({ k }: { k: Kid }) {
  return k.link === 'confirmed' ? <Chip tone="green" icon={<CheckCircle2 size={12} aria-hidden />}>Linked</Chip> : <Chip tone="amber" icon={<Clock size={12} aria-hidden />}>Waiting for confirmation</Chip>
}

export default function Children({ sub }: { sub: string }) {
  const [a, b] = sub.split('/').filter(Boolean)
  if (!a) return <List />
  if (a === 'add') return <Add />
  if (a === 'denied') return <Denied id={b ?? ''} />
  if (b === 'permissions') return <Permissions id={a} />
  return <View id={a} />
}

function useKids() { const s = useStore(); return { s, kids: s.pj.kids } }

function RemoveModal({ kid, open, onClose, onDone }: { kid: Kid; open: boolean; onClose: () => void; onDone: () => void }) {
  const s = useStore()
  return (
    <Modal open={open} onClose={onClose} title={`Remove ${kid.short}?`}
      footer={<><Button variant="secondary" onClick={onClose}>Keep {kid.short}</Button>
        <Button variant="destructive" onClick={() => {
          s.setPJ((p) => ({ kids: p.kids.filter((x) => x.id !== kid.id), log: [...p.log, `${kid.short} removed`] }))
          s.toast(`${kid.short} removed from your account`, 'success'); onClose(); onDone()
        }}>Remove {kid.short}</Button></>}>
      <div className="space-y-3 text-sm">
        {kid.tuition && <p role="alert" className="flex items-start gap-2 rounded-input bg-warning-100 p-3 text-charcoal-900"><AlertTriangle size={18} className="mt-0.5 shrink-0 text-warning-600" aria-hidden /><span><b>{kid.short} has 1 active tuition</b> ({tutOf(kid).subject} with {tutOf(kid).tutor}). If you remove {kid.short}, you can no longer see attendance, homework, progress or payments for it. The tutor keeps the class record.</span></p>}
        <p>You will stop seeing {kid.short}'s information. {kid.short}'s own account is not deleted. You can link {kid.short} again later with the student ID.</p>
      </div>
    </Modal>
  )
}

function List() {
  const { s, kids } = useKids(); const nav = useNavigate()
  const [rm, setRm] = useState<Kid | null>(null); const [q, setQ] = useState(''); const [qErr, setQErr] = useState('')
  const open = () => {
    const id = q.trim().toUpperCase()
    if (!/^ST-\d{4}$/.test(id)) { setQErr('Enter an ID like ST-2041.'); return }
    setQErr('')
    const k = kids.find((x) => x.id === id && x.link === 'confirmed')
    nav(k ? `${C}/${id}` : `${C}/denied/${id}`)
  }
  return (
    <div>
      <PageHead title="Children" tag="CH-01" sub="Only children you have linked and who confirmed appear anywhere in your account." actions={<Link to={`${C}/add`} className="inline-flex items-center gap-2 rounded-input bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"><UserPlus size={16} aria-hidden />Add a child</Link>} />
      {kids.length === 0 ? (
        <Card><EmptyState title="No children linked yet" body="Add a child with their student ID. Your child confirms the link before anything is shared." action={<Link to={`${C}/add`} className="text-sm font-semibold text-blue-600 hover:underline">Add your first child</Link>} /></Card>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {kids.map((k) => (
            <li key={k.id}><Card className="h-full">
              <div className="flex items-start gap-3"><Avatar name={k.name} size={48} />
                <div className="min-w-0 flex-1"><h2 className="text-lg">{k.name}</h2><p className="text-sm text-gray-600">{k.cls} · {k.school}</p><p className="mt-1 text-xs text-gray-600"><span className="tabular font-mono">{k.id}</span> · {k.relation}</p></div>
                <LinkChip k={k} />
              </div>
              {k.link === 'confirmed' ? <p className="mt-3 text-sm text-gray-600">{k.tuition ? `1 active tuition: ${tutOf(k).subject}` : 'No active tuition yet'}</p>
                : <div className="mt-3 rounded-input bg-offwhite-50 p-3 text-sm text-gray-600">Waiting for {k.short} to confirm. Nothing about {k.short} is visible until then.
                  <div className="mt-2 flex flex-wrap items-center gap-2"><DemoTag label="Demo" /><Button size="sm" variant="secondary" onClick={() => { s.setPJ((p) => ({ kids: p.kids.map((x) => (x.id === k.id ? { ...x, link: 'confirmed' } : x)), pv: { ...p.pv, confirm: true }, log: [...p.log, `${k.short} confirmed the link`] })); s.toast(`Demo: ${k.short} confirmed the link`, 'success') }}>Simulate: child confirms</Button>
                    <Button size="sm" variant="tertiary" onClick={() => { s.setPJ((p) => ({ kids: p.kids.filter((x) => x.id !== k.id) })); s.toast(`Demo: ${k.short} declined the link`, 'warning') }}>Simulate: child declines</Button></div></div>}
              <div className="mt-4 flex flex-wrap gap-2">
                {k.link === 'confirmed' && <><Link to={`${C}/${k.id}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-input border border-gray-400 px-3 py-2 text-sm font-semibold text-navy-900 hover:bg-gray-100 md:min-h-0"><Eye size={15} aria-hidden />View</Link>
                  <Link to={`${C}/${k.id}/permissions`} className="inline-flex min-h-11 items-center gap-1.5 rounded-input border border-gray-400 px-3 py-2 text-sm font-semibold text-navy-900 hover:bg-gray-100 md:min-h-0"><SlidersHorizontal size={15} aria-hidden />Permissions</Link></>}
                <Button variant="tertiary" icon={<Trash2 size={15} />} onClick={() => setRm(k)}>Remove</Button>
              </div>
            </Card></li>
          ))}
        </ul>
      )}
      <Card className="mt-6"><h2 className="text-lg">Open a student by ID</h2>
        <p className="mt-1 text-sm text-gray-600">You can only open students who are linked to you. Try the demo student <span className="tabular font-mono">{NOT_LINKED_ID}</span> to see what happens when you are not linked.</p>
        <form className="mt-3 flex flex-wrap items-start gap-2" onSubmit={(e) => { e.preventDefault(); open() }}>
          <div className="min-w-[10rem] flex-1"><label className="sr-only" htmlFor="open-id">Student ID</label><Input id="open-id" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ST-2041" maxLength={7} aria-invalid={!!qErr} />{qErr && <p role="alert" className="mt-1 text-sm text-danger-600">{qErr}</p>}</div>
          <Button type="submit" variant="secondary">Open student</Button>
        </form></Card>
      {rm && <RemoveModal kid={rm} open onClose={() => setRm(null)} onDone={() => { if (s.child === rm.short) s.setChild('') }} />}
    </div>
  )
}

function Add() {
  const nav = useNavigate()
  return (
    <div className="mx-auto max-w-xl">
      <PageHead title="Add a child" tag="CH-02" crumb={{ to: C, label: 'Children' }} sub="Link your child with their student ID. They confirm before you see anything." />
      <Card><LinkForm onDone={() => nav(C)} /></Card>
    </div>
  )
}

function View({ id }: { id: string }) {
  const { s, kids } = useKids(); const nav = useNavigate(); const [rm, setRm] = useState(false)
  const k = kids.find((x) => x.id === id)
  if (!k || k.link !== 'confirmed') return <Denied id={id} />
  const sc = (kid: Kid) => { s.setChild(kid.short); nav('/app/parent/dashboard') }
  return (
    <div>
      <PageHead title={k.name} tag="CH-03" crumb={{ to: C, label: 'Children' }} actions={<LinkChip k={k} />} />
      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Card><div className="flex items-center gap-4"><Avatar name={k.name} size={64} /><div><p className="font-heading text-xl font-bold text-navy-900">{k.name}</p><p className="text-sm text-gray-600">{k.cls}</p></div></div>
          <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
            {([['School', k.school], ['Student ID', k.id], ['Your relationship', k.relation], ['Active tuition', k.tuition ? `${tutOf(k).subject} with ${tutOf(k).tutor}` : 'None yet']] as const).map(([l, v]) => <div key={l}><dt className="text-xs font-semibold uppercase tracking-wide text-gray-600">{l}</dt><dd className="text-charcoal-900">{v}</dd></div>)}
          </dl>
          <p className="mt-4 flex items-start gap-2 text-xs text-gray-600"><Lock size={13} className="mt-0.5 shrink-0" aria-hidden />Home address, phone numbers and ID numbers of your child are never shown here.</p></Card>
        <Card><h2 className="text-lg">Actions</h2>
          <div className="mt-3 flex flex-col gap-2">
            <Button onClick={() => sc(k)}>Show {k.short} on my dashboard</Button>
            <Link to={`${C}/${k.id}/permissions`} className="rounded-input border border-gray-400 px-4 py-2.5 text-center text-sm font-semibold text-navy-900 hover:bg-gray-100">Manage permissions</Link>
            <Button variant="destructive" icon={<Trash2 size={15} />} onClick={() => setRm(true)}>Remove {k.short}</Button>
          </div></Card>
      </div>
      <RemoveModal kid={k} open={rm} onClose={() => setRm(false)} onDone={() => nav(C)} />
    </div>
  )
}

const PERMS: [keyof Perm, string, string][] = [
  ['attendance', 'See attendance', 'Class-by-class presence, absences and lateness.'],
  ['progress', 'See progress and reports', 'Test marks, tutor notes and the monthly report.'],
  ['payments', 'Track payments', 'Fee amounts, due dates and your payment records.'],
  ['chat', 'Message tutors for this child', 'Start and read chats with their tutors.'],
]
function Permissions({ id }: { id: string }) {
  const { s, kids } = useKids(); const k = kids.find((x) => x.id === id)
  if (!k || k.link !== 'confirmed') return <Denied id={id} />
  const set = (key: keyof Perm, v: boolean) => {
    s.setPJ((p) => ({ kids: p.kids.map((x) => (x.id === id ? { ...x, perms: { ...x.perms, [key]: v } } : x)), log: [...p.log, `${k.short}: ${key} ${v ? 'on' : 'off'}`] }))
    s.toast(`${PERMS.find((x) => x[0] === key)?.[1]} turned ${v ? 'on' : 'off'} for ${k.short}`, 'success')
  }
  const mine = s.pj.log.filter((l) => l.startsWith(`${k.short}:`)).slice(-4).reverse()
  return (
    <div className="mx-auto max-w-2xl">
      <PageHead title={`${k.short}'s permissions`} tag="CH-04" crumb={{ to: `${C}/${id}`, label: k.name }} sub="Choose what you can see and do for this child. The screens in your account change straight away." />
      <Card pad={false}><ul className="divide-y divide-gray-100">
        {PERMS.map(([key, label, desc]) => (
          <li key={key} className="flex items-center gap-4 p-4"><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-navy-900">{label}</p><p className="text-xs text-gray-600">{desc}</p></div>
            <span className="text-xs font-semibold text-gray-600">{k.perms[key] ? 'On' : 'Off'}</span><Toggle checked={k.perms[key]} onChange={(v) => set(key, v)} label={`${label} for ${k.short}`} /></li>
        ))}</ul></Card>
      <Card className="mt-4"><h2 className="text-base">Recent changes</h2>{mine.length ? <ul className="mt-2 space-y-1 text-sm text-gray-600">{mine.map((l, i) => <li key={i}>{l}</li>)}</ul> : <p className="mt-2 text-sm text-gray-600">No changes yet.</p>}</Card>
    </div>
  )
}

export function Denied({ id }: { id: string }) {
  return (
    <div className="mx-auto max-w-lg">
      <PageHead title="You cannot open this student" tag="CH-07" crumb={{ to: C, label: 'Children' }} />
      <Card className="text-center"><ShieldOff size={36} className="mx-auto text-danger-600" aria-hidden />
        <h2 className="mt-3 text-xl">This student is not linked to your account</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-gray-600">For the safety of every child, parents can only see students who are linked to them and have confirmed. We do not show any detail about students who are not linked.</p>
        <p className="mt-2 text-xs text-gray-600">Reference <span className="tabular font-mono">{id.toUpperCase() || 'unknown'}</span></p>
        <div className="mt-5 flex flex-wrap justify-center gap-2"><Link to={`${C}/add`} className="rounded-input bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">Link a child</Link><Link to={C} className="rounded-input border border-gray-400 px-4 py-2.5 text-sm font-semibold text-navy-900 hover:bg-gray-100">Back to my children</Link></div></Card>
    </div>
  )
}

export { confirmedKids }
