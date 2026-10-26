import { useState } from 'react'
import { BadgeCheck, CheckCircle2, Clock, FileText, MinusCircle, Paperclip } from 'lucide-react'
import { PageHead } from '../../components/tutor/bits'
import { Button, Card, Chip, DemoTag, EmptyState, Field, Modal, Tabs, Textarea } from '../../components/ui'
import { dateOf, fmt, hwFor, type Hw } from '../../lib/parent'
import { studentKid } from '../../lib/student'
import { useStore } from '../../lib/store'
import { Link } from 'react-router'

type Eff = Hw & { eff: 'assigned' | 'submitted' | 'reviewed'; mine: boolean }
const FILE = (h: Hw) => `${h.id}-${h.kind.toLowerCase()}-nabila.pdf`

export function Work({ kind }: { kind: 'Homework' | 'Assignment' }) {
  const s = useStore(); const off = s.dayOffset; const kid = studentKid(s.sj); const subs = s.sj.subs
  const [tab, setTab] = useState('To do'); const [open, setOpen] = useState<Hw | null>(null); const [file, setFile] = useState(false); const [note, setNote] = useState(''); const [err, setErr] = useState('')
  const plural = kind === 'Homework' ? 'Homework' : 'Assignments'
  const head = <PageHead title={plural} tag={kind === 'Homework' ? 'HW-S' : 'ASG-S'} sub={kind === 'Homework' ? 'Work from your tutor. Submit it here and read the feedback.' : 'Larger pieces of work. Submit, resubmit before it is reviewed, and read feedback.'} />
  if (!kid.tuition) return <div>{head}<Card><EmptyState title="No active tuition yet" body={`Your ${plural.toLowerCase()} appear once a tutor starts working with you.`} action={<Link to="/app/student/find-tutor" className="text-sm font-semibold text-blue-600 hover:underline">Find a tutor</Link>} /></Card></div>
  const all: Eff[] = hwFor(kid, off).filter((h) => h.kind === kind).map((h) => { const sb = subs[h.id]; const eff = sb ? (sb.reviewed ? 'reviewed' : 'submitted') : h.state; return { ...h, eff, mine: !!sb, ...(sb?.reviewed ? { score: '9/10', feedback: 'Good improvement. Your working is clear. Next time show the units in every step.' } : {}) } })
  const tabs = ['To do', 'Submitted', 'Reviewed']; const want = tab === 'To do' ? 'assigned' : tab === 'Submitted' ? 'submitted' : 'reviewed'
  const shown = all.filter((h) => h.eff === want)
  const begin = (h: Eff) => { const sb = subs[h.id]; setOpen(h); setFile(!!sb); setNote(sb?.note ?? ''); setErr('') }
  const submit = () => {
    if (!open) return
    if (!file && note.trim().length < 5) { setErr('Attach the sample file or write a short note (5 characters).'); return }
    const first = !subs[open.id]
    s.setSJ((p) => ({ subs: { ...p.subs, [open.id]: { file: file ? FILE(open) : '', note: note.trim(), n: (p.subs[open.id]?.n ?? 0) + 1, reviewed: false } } }))
    s.toast(first ? `${kind} submitted (Demo, nothing uploaded)` : `${kind} resubmitted (Demo, nothing uploaded)`, 'success'); setOpen(null)
  }
  return (
    <div>{head}
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      <ul className="mt-4 space-y-3">{shown.map((h) => { const sb = subs[h.id]; return (
        <li key={h.id}><Card><div className="flex flex-wrap items-start gap-3"><div className="min-w-0 flex-1"><p className="font-semibold text-navy-900">{h.title}</p><p className="text-xs text-gray-600">{h.kind} · due {fmt(dateOf(h.due))}</p></div>
          {h.eff === 'assigned' ? <Chip tone={h.due - off <= 1 ? 'amber' : 'blue'} icon={<Clock size={12} aria-hidden />}>{h.due - off <= 1 ? 'Due soon' : 'Assigned'}</Chip> : h.eff === 'submitted' ? <Chip tone="blue" icon={<MinusCircle size={12} aria-hidden />}>{sb && sb.n > 1 ? 'Resubmitted. Waiting for review' : 'Waiting for review'}</Chip> : <Chip tone="green" icon={<CheckCircle2 size={12} aria-hidden />}>Reviewed {h.score}</Chip>}</div>
          {sb && <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-600"><Paperclip size={14} aria-hidden />{sb.file ? <>{sb.file} <DemoTag label="Demo file" /></> : 'Note only'}{sb.note && <span>· "{sb.note}"</span>}</p>}
          {h.feedback && <div className="mt-2 rounded-input bg-offwhite-50 p-3 text-sm text-gray-600"><p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-teal-700"><BadgeCheck size={13} aria-hidden /> Tutor feedback</p>{h.feedback}</div>}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {h.eff === 'assigned' && <Button size="sm" icon={<FileText size={14} />} onClick={() => begin(h)}>Submit {kind.toLowerCase()}</Button>}
            {h.eff === 'submitted' && sb && <><Button size="sm" variant="secondary" onClick={() => begin(h)}>Resubmit</Button><Button size="sm" variant="tertiary" onClick={() => { s.setSJ((p) => ({ subs: { ...p.subs, [h.id]: { ...p.subs[h.id], reviewed: true } } })); s.toast('Demo: your tutor reviewed it', 'success') }}>Simulate tutor review</Button><DemoTag /></>}</div></Card></li>) })}
        {shown.length === 0 && <li><Card><p className="text-sm text-gray-600">{tab === 'To do' ? `Nothing to do. All ${plural.toLowerCase()} are submitted.` : tab === 'Submitted' ? 'Nothing is waiting for review.' : 'No reviewed work yet.'}</p></Card></li>}</ul>
      <Modal open={!!open} onClose={() => setOpen(null)} title={open ? `${subs[open.id] ? 'Resubmit' : 'Submit'}: ${open.title}` : ''} footer={<><Button variant="secondary" onClick={() => setOpen(null)}>Cancel</Button><Button onClick={submit}>{open && subs[open.id] ? 'Resubmit' : 'Submit'}</Button></>}>
        <div className="space-y-4"><p className="flex items-center gap-2 text-xs text-gray-600"><DemoTag /> Attaching is simulated. No file is uploaded or stored.</p>
          <div className="flex flex-wrap items-center gap-3 rounded-input border border-dashed border-gray-400 p-3 text-sm">{file && open ? <><Paperclip size={16} aria-hidden /><span className="font-semibold text-navy-900">{FILE(open)}</span><Button size="sm" variant="tertiary" onClick={() => setFile(false)}>Remove</Button></> : <><span className="text-gray-600">No file attached</span><Button size="sm" variant="secondary" icon={<Paperclip size={14} />} onClick={() => { setFile(true); setErr('') }}>Attach sample file</Button></>}</div>
          <Field label="Note for your tutor (optional)" error={err}>{(id) => <Textarea id={id} value={note} onChange={(e) => { setNote(e.target.value); setErr('') }} />}</Field></div>
      </Modal>
    </div>
  )
}
