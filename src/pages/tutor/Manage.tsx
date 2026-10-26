import { useState } from 'react'
import { Link } from 'react-router'
import { CheckCircle2, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { AGREEMENT, allClasses, dayLabel, stats, type ClassItem, type Hw, type Mark } from '../../lib/journey'
import { useStore } from '../../lib/store'
import { Bar, Button, Card, Chip, DemoTag, EmptyState, Field, Input, Modal, ProgressRing, Select, Tabs, Textarea } from '../../components/ui'
import { PageHead } from '../../components/tutor/bits'

const A = '/app/tutor'
function useActive() {
  const s = useStore(); const j = s.journey; const live = j.tuition === 'active' || j.tuition === 'completed'
  return { s, j, live }
}
function NoTuition({ title, tag }: { title: string; tag: string }) {
  return <div><PageHead title={title} tag={tag} /><Card><EmptyState title="Nothing here until a tuition is active" body="Once you and a guardian confirm an agreement, classes, attendance and homework appear here." action={<Link to={`${A}/find-tuition`} className="text-sm font-semibold text-blue-600 hover:underline">Find tuition</Link>} /></Card></div>
}
const markTone = { present: 'green', absent: 'red', cancelled: 'gray', rescheduled: 'amber' } as const

/* ---------------- Schedule ---------------- */
export function Schedule() {
  const { s, j, live } = useActive(); const [tab, setTab] = useState('Calendar'); const [sel, setSel] = useState<ClassItem | null>(null); const [add, setAdd] = useState(false); const [month, setMonth] = useState(0)
  const [nd, setNd] = useState('Fri, 16 Oct 2026'); const [rs, setRs] = useState('Sat, 17 Oct 2026'); const [cwhy, setCwhy] = useState('Tutor unwell'); const [mode, setMode] = useState<'detail' | 'resched' | 'cancel'>('detail')
  if (!live && j.tuition !== 'cancelled') return <div><PageHead title="Schedule" tag="SCH-01" sub="Your classes, once a tuition is active." /><Card><EmptyState title="No classes scheduled" body="Your availability is Sun, Tue, Wed, Thu, 5:00–7:00 PM. Classes appear after an agreement." action={<Link to={`${A}/find-tuition`} className="text-sm font-semibold text-blue-600 hover:underline">Find tuition</Link>} /></Card><Routine /></div>
  const all = allClasses(j); const status = (c: ClassItem) => j.marks[c.id] ?? (c.day < s.dayOffset ? 'unmarked' : 'upcoming')
  const list = (f: (c: ClassItem) => boolean) => all.filter(f)
  const tabs: Record<string, ClassItem[]> = { Upcoming: list((c) => !j.marks[c.id] && c.day >= s.dayOffset), Completed: list((c) => j.marks[c.id] === 'present'), Cancelled: list((c) => j.marks[c.id] === 'cancelled' || j.marks[c.id] === 'absent'), Rescheduled: list((c) => j.marks[c.id] === 'rescheduled') }
  const base = new Date('2026-10-13T00:00:00'); const first = new Date(2026, 9 + month, 1); const dim = new Date(2026, 10 + month, 0).getDate(); const pad = (first.getDay() + 6) % 7
  const dayOf = (d: number) => Math.round((new Date(2026, 9 + month, d).getTime() - base.getTime()) / 86400000)
  const close = () => { setSel(null); setMode('detail') }
  const cmark = (c: ClassItem, m: Mark, extra?: Partial<{ rescheduled: Record<string, string> }>) => s.setJourney((x) => ({ marks: { ...x.marks, [c.id]: m }, ...(extra ?? {}) }))
  return (
    <div>
      <PageHead title="Schedule" tag="SCH-01..14" sub={`${AGREEMENT.subject}, ${AGREEMENT.cls} with Ayaan · ${AGREEMENT.days}, ${AGREEMENT.time}`} actions={<Button icon={<Plus size={16} />} disabled={j.tuition !== 'active'} onClick={() => setAdd(true)}>Add extra class</Button>} />
      <Tabs tabs={['Calendar', 'Upcoming', 'Completed', 'Cancelled', 'Rescheduled', 'Routine']} value={tab} onChange={setTab} />
      <div className="mt-5">
        {tab === 'Calendar' && <Card>
          <div className="mb-3 flex items-center justify-between"><h2 className="text-lg">{first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</h2><div className="flex gap-1"><Button size="sm" variant="secondary" aria-label="Previous month" disabled={month === 0} onClick={() => setMonth(0)}><ChevronLeft size={16} /></Button><Button size="sm" variant="secondary" aria-label="Next month" disabled={month === 1} onClick={() => setMonth(1)}><ChevronRight size={16} /></Button></div></div>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-gray-600">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d}>{d}</div>)}</div>
          <div className="mt-1 grid grid-cols-7 gap-1">{Array.from({ length: pad }).map((_, i) => <div key={`p${i}`} />)}{Array.from({ length: dim }).map((_, i) => { const d = i + 1; const off = dayOf(d); const c = all.find((x) => x.day === off); const today = off === s.dayOffset
            return c ? <button key={d} onClick={() => setSel(c)} aria-label={`${d}, class, ${status(c)}`} className={`aspect-square min-h-11 rounded-input border p-1 text-xs font-semibold ${j.marks[c.id] === 'present' ? 'border-teal-600 bg-success-100 text-teal-700' : j.marks[c.id] ? 'border-gray-300 bg-gray-100 text-gray-600' : 'border-blue-600 bg-blue-100 text-blue-600'} ${today ? 'ring-2 ring-navy-900' : ''}`}>{d}</button>
              : <div key={d} className={`grid aspect-square min-h-11 place-items-center rounded-input text-xs text-gray-600 ${today ? 'ring-2 ring-navy-900' : ''}`}>{d}</div> })}</div>
          <p className="mt-3 text-xs text-gray-600">Blue: upcoming · green: held · grey: cancelled or absent · ring: demo today ({dayLabel(s.dayOffset)})</p>
        </Card>}
        {['Upcoming', 'Completed', 'Cancelled', 'Rescheduled'].includes(tab) && (tabs[tab].length === 0 ? <Card><EmptyState title={`No ${tab.toLowerCase()} classes`} body={tab === 'Upcoming' ? 'Fast-forward time or add an extra class.' : 'Classes you mark will show here.'} /></Card>
          : <div className="space-y-2">{tabs[tab].map((c) => <button key={c.id} onClick={() => setSel(c)} className="flex w-full flex-wrap items-center justify-between gap-2 rounded-card border border-gray-200 bg-white p-4 text-left shadow-card hover:border-blue-600"><span><span className="block font-semibold text-navy-900">{c.label}</span><span className="text-sm text-gray-600">{c.time}{j.rescheduled[c.id] ? ` → ${j.rescheduled[c.id]}` : ''}</span></span><Chip tone={j.marks[c.id] ? markTone[j.marks[c.id]] : 'blue'}>{j.marks[c.id] ?? 'upcoming'}</Chip></button>)}</div>)}
        {tab === 'Routine' && <Routine />}
      </div>
      <Modal open={!!sel} onClose={close} title={mode === 'resched' ? 'Propose a new time (SCH-11)' : mode === 'cancel' ? 'Cancel this class (SCH-12)' : `Class details (SCH-13)`}
        footer={sel && (mode === 'detail' ? <>{!j.marks[sel.id] && sel.day <= s.dayOffset && <Button onClick={() => { cmark(sel, 'present'); s.toast('Class marked complete', 'success'); close() }}>Mark complete</Button>}{!j.marks[sel.id] && j.tuition === 'active' && <><Button variant="secondary" onClick={() => setMode('resched')}>Reschedule</Button><Button variant="tertiary" onClick={() => setMode('cancel')}>Cancel class</Button></>}<Button variant="secondary" onClick={close}>Close</Button></>
          : mode === 'resched' ? <><Button variant="secondary" onClick={() => setMode('detail')}>Back</Button><Button onClick={() => { cmark(sel, 'rescheduled', { rescheduled: { ...j.rescheduled, [sel.id]: rs } }); s.toast(`Proposed ${rs}. Demo: guardian accepted.`, 'success'); close() }}>Send proposal</Button></>
          : <><Button variant="secondary" onClick={() => setMode('detail')}>Back</Button><Button variant="destructive" onClick={() => { cmark(sel, 'cancelled'); s.toast('Class cancelled. Guardian notified.', 'info'); close() }}>Cancel class</Button></>)}>
        {sel && mode === 'detail' && <dl className="space-y-2 text-sm">{[['Date', sel.label], ['Time', sel.time], ['Subject', AGREEMENT.subject], ['Student', 'Ayaan Rahman'], ['Status', j.marks[sel.id] ?? (sel.day < s.dayOffset ? 'Waiting for attendance' : 'Upcoming')]].map(([k, v]) => <div key={k} className="flex justify-between gap-3"><dt className="text-gray-600">{k}</dt><dd className="font-semibold text-navy-900">{v}</dd></div>)}</dl>}
        {sel && mode === 'resched' && <><Field label="New day">{(i) => <Select id={i} value={rs} onChange={(e) => setRs(e.target.value)} options={['Sat, 17 Oct 2026', 'Mon, 19 Oct 2026', 'Fri, 23 Oct 2026']} />}</Field><p className="mt-2 text-xs text-gray-600"><DemoTag /> The guardian's acceptance is simulated.</p></>}
        {sel && mode === 'cancel' && <Field label="Reason">{(i) => <Select id={i} value={cwhy} onChange={(e) => setCwhy(e.target.value)} options={['Tutor unwell', 'Student unwell', 'Public holiday', 'Other']} />}</Field>}
      </Modal>
      <Modal open={add} onClose={() => setAdd(false)} title="Add an extra class (SCH-09)" footer={<><Button variant="secondary" onClick={() => setAdd(false)}>Cancel</Button><Button onClick={() => { const day = ['Fri, 16 Oct 2026', 'Sat, 17 Oct 2026', 'Mon, 19 Oct 2026'].indexOf(nd) + 3; s.setJourney((x) => ({ extra: [...x.extra, { id: `x-${x.extra.length + 1}`, day, label: dayLabel(day), time: '5:00–6:00 PM' }] })); setAdd(false); s.toast('Extra class added', 'success') }}>Add class</Button></>}>
        <Field label="Day">{(i) => <Select id={i} value={nd} onChange={(e) => setNd(e.target.value)} options={['Fri, 16 Oct 2026', 'Sat, 17 Oct 2026', 'Mon, 19 Oct 2026']} />}</Field><p className="mt-2 text-xs text-gray-600">Extra classes use 5:00–6:00 PM and need the guardian's notice.</p>
      </Modal>
    </div>
  )
}
function Routine() {
  const rows = [['Sun', '6:30–7:30 PM', 'Physics, Ayaan'], ['Mon', 'School hours 8:00 AM–2:00 PM', 'Student at school'], ['Tue', '6:30–7:30 PM', 'Physics, Ayaan'], ['Wed', '5:00–7:00 PM', 'Open availability'], ['Thu', '6:30–7:30 PM', 'Physics, Ayaan']]
  return <Card className="mt-5"><h2 className="text-lg">Weekly routine (SCH-04)</h2><ul className="mt-3 divide-y divide-gray-200 text-sm">{rows.map(([d, t, n]) => <li key={d} className="flex flex-wrap justify-between gap-2 py-2.5"><b className="w-12 text-navy-900">{d}</b><span className="flex-1 text-gray-600">{t}</span><span className="text-navy-900">{n}</span></li>)}</ul><p className="mt-3 text-xs text-gray-600">School hours are shown so classes never overlap them.</p></Card>
}

/* ---------------- Attendance ---------------- */
export function Attendance() {
  const { s, j, live } = useActive(); const st = stats(j, s.dayOffset)
  if (!live) return <NoTuition title="Attendance" tag="ATT-01" />
  const held = allClasses(j).filter((c) => c.day <= s.dayOffset || j.marks[c.id])
  const mark = (id: string, m: Mark) => { s.setJourney((x) => ({ marks: { ...x.marks, [id]: m } })); s.toast(m === 'absent' ? 'Marked absent. Guardian notified (Demo, ATT-04).' : `Marked ${m}`, m === 'absent' ? 'warning' : 'success') }
  return (
    <div>
      <PageHead title="Attendance" tag="ATT-01 · ATT-04" sub="Mark each class that has happened. Absences notify the guardian." />
      <div className="mb-5 grid gap-4 sm:grid-cols-3"><Card className="flex items-center gap-4"><ProgressRing value={st.attendancePct} label="Attendance" /><div><p className="text-sm text-gray-600">Present {st.present} of {st.counted}</p></div></Card><Card><p className="text-sm text-gray-600">Waiting for you</p><p className="font-heading text-3xl font-bold text-navy-900 tabular">{st.unmarked}</p></Card><Card><p className="text-sm text-gray-600">Upcoming</p><p className="font-heading text-3xl font-bold text-navy-900 tabular">{st.upcoming}</p></Card></div>
      {held.length === 0 ? <Card><EmptyState title="No classes to mark yet" body="The first class is on 15 Oct. Use the Demo controls to fast-forward." /></Card>
        : <div className="space-y-2">{[...held].reverse().map((c) => <Card key={c.id} className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold text-navy-900">{c.label}</p><p className="text-sm text-gray-600">{c.time}</p></div>
          {j.marks[c.id] ? <div className="flex items-center gap-2"><Chip tone={markTone[j.marks[c.id]]}>{j.marks[c.id]}</Chip><Button size="sm" variant="tertiary" onClick={() => s.setJourney((x) => { const m = { ...x.marks }; delete m[c.id]; return { marks: m } })}>Change</Button></div>
            : <div className="flex flex-wrap gap-2" role="group" aria-label={`Mark ${c.label}`}>{(['present', 'absent', 'cancelled', 'rescheduled'] as Mark[]).map((m) => <Button key={m} size="sm" variant={m === 'present' ? 'primary' : 'secondary'} onClick={() => mark(c.id, m)}>{m[0].toUpperCase() + m.slice(1)}</Button>)}</div>}</Card>)}</div>}
    </div>
  )
}

/* ---------------- Homework / Assignments ---------------- */
function hwStatus(h: Hw, day: number) { return h.state === 'pending' && h.dueDay < day ? 'overdue' : h.state }
const hwTone = { pending: 'amber', submitted: 'blue', reviewed: 'green', revision: 'orange', overdue: 'red' } as const
export function Homework({ kind }: { kind: 'Homework' | 'Assignment' }) {
  const { s, j, live } = useActive(); const tag = kind === 'Homework' ? 'HW-01..08' : 'ASG-01..06'
  const [tab, setTab] = useState('All'); const [add, setAdd] = useState(false); const [t, setT] = useState(''); const [due, setDue] = useState('3'); const [err, setErr] = useState(''); const [rv, setRv] = useState<Hw | null>(null); const [sc, setSc] = useState('8'); const [fb, setFb] = useState('')
  if (!live) return <NoTuition title={kind === 'Homework' ? 'Homework' : 'Assignments'} tag={tag} />
  const items = j.hw.filter((h) => h.kind === kind); const shown = items.filter((h) => tab === 'All' || hwStatus(h, s.dayOffset) === tab.toLowerCase())
  const patch = (id: string, p: Partial<Hw>) => s.setJourney((x) => ({ hw: x.hw.map((h) => (h.id === id ? { ...h, ...p } : h)) }))
  return (
    <div>
      <PageHead title={kind === 'Homework' ? 'Homework' : 'Assignments'} tag={tag} sub={`${kind === 'Homework' ? 'Daily practice' : 'Longer pieces and model tests'} for Ayaan. Review, score and give feedback.`} actions={<Button icon={<Plus size={16} />} disabled={j.tuition !== 'active'} onClick={() => setAdd(true)}>Add {kind.toLowerCase()}</Button>} />
      <Tabs tabs={['All', 'Pending', 'Submitted', 'Reviewed', 'Revision', 'Overdue']} value={tab} onChange={setTab} />
      <div className="mt-5 space-y-3">{shown.length === 0 ? <Card><EmptyState title={`No ${tab === 'All' ? kind.toLowerCase() : tab.toLowerCase()} items`} body="Add one for Ayaan, or switch tabs." /></Card>
        : shown.map((h) => { const st = hwStatus(h, s.dayOffset); return <Card key={h.id}><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="font-semibold text-navy-900">{h.title}</p><p className="text-sm text-gray-600">Due {dayLabel(h.dueDay)}{h.late ? ' · submitted late' : ''}</p></div><Chip tone={hwTone[st]}>{st[0].toUpperCase() + st.slice(1)}</Chip></div>
          {h.state === 'reviewed' && <p className="mt-2 rounded-input bg-gray-100 p-3 text-sm"><b className="text-navy-900">{h.score}/10</b> · {h.feedback}</p>}
          {h.state === 'revision' && <p className="mt-2 rounded-input bg-warning-100 p-3 text-sm">Revision requested: {h.feedback}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {(h.state === 'pending' || h.state === 'revision') && <Button size="sm" variant="secondary" icon={<DemoTag label="Demo" />} onClick={() => { patch(h.id, { state: 'submitted', late: s.dayOffset > h.dueDay }); s.toast('Demo: student submitted', 'info') }}>Student submits</Button>}
            {h.state === 'submitted' && <Button size="sm" onClick={() => { setRv(h); setSc('8'); setFb('') }}>Review</Button>}
          </div></Card> })}</div>
      <Modal open={add} onClose={() => setAdd(false)} title={`Add ${kind.toLowerCase()}`} footer={<><Button variant="secondary" onClick={() => setAdd(false)}>Cancel</Button><Button onClick={() => { if (t.trim().length < 4) { setErr('Add a short title.'); return } s.setJourney((x) => ({ hw: [...x.hw, { id: `n-${x.hw.length + 1}`, title: t.trim(), kind, dueDay: s.dayOffset + Number(due), state: 'pending', late: false }] })); setAdd(false); setT(''); setErr(''); s.toast(`${kind} added. Student notified.`, 'success') }}>Add</Button></>}>
        <div className="space-y-3"><Field label="Title" error={err}>{(i) => <Input id={i} value={t} onChange={(e) => setT(e.target.value)} />}</Field><Field label="Due in">{(i) => <Select id={i} value={due} onChange={(e) => setDue(e.target.value)} options={['1', '3', '7']} />}</Field></div><p className="mt-2 text-xs text-gray-600">Due in days from demo today.</p>
      </Modal>
      <Modal open={!!rv} onClose={() => setRv(null)} title={`Review: ${rv?.title ?? ''}`} footer={rv && <><Button variant="secondary" onClick={() => { patch(rv.id, { state: 'revision', feedback: fb.trim() || 'Please redo the final two problems with working shown.' }); setRv(null); s.toast('Revision requested', 'info') }}>Request revision</Button><Button onClick={() => { patch(rv.id, { state: 'reviewed', score: Number(sc), feedback: fb.trim() || 'Good work.' }); setRv(null); s.toast('Review saved', 'success') }}>Save review</Button></>}>
        <div className="space-y-3"><Field label="Score out of 10">{(i) => <Select id={i} value={sc} onChange={(e) => setSc(e.target.value)} options={['10', '9', '8', '7', '6', '5', '4']} />}</Field><Field label="Feedback">{(i) => <Textarea id={i} value={fb} onChange={(e) => setFb(e.target.value)} />}</Field></div>
      </Modal>
    </div>
  )
}

/* ---------------- Progress ---------------- */
export function Progress() {
  const { s, j, live } = useActive(); const [tab, setTab] = useState('Tuition'); const st = stats(j, s.dayOffset)
  if (!live) return <NoTuition title="Progress" tag="PRG-01" />
  const rev = j.hw.filter((h) => h.state === 'reviewed'); const hwDone = rev.length; const avg = j.testMarks.length ? Math.round(j.testMarks.reduce((a, b) => a + b, 0) / j.testMarks.length) : 0
  const trend = j.testMarks.length < 2 ? 'Not enough data' : j.testMarks[j.testMarks.length - 1] > j.testMarks[0] ? 'Improving' : 'Steady'
  const school = [58, 61, 66]
  const marks = tab === 'Tuition' ? j.testMarks : school
  return (
    <div>
      <PageHead title="Progress" tag="PRG-01 · RPT-01" sub="Ayaan's attendance, homework and test results, with a school comparison." actions={<><Button variant="secondary" size="sm" icon={<DemoTag label="Demo" />} onClick={() => s.toast('Demo: report PDF is not generated in this prototype', 'info')}>Download report</Button><Button variant="secondary" size="sm" icon={<DemoTag label="Demo" />} onClick={() => s.toast('Demo: sharing is simulated', 'info')}>Share</Button></>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><p className="text-sm text-gray-600">Attendance</p><p className="font-heading text-3xl font-bold text-navy-900 tabular">{st.counted ? `${st.attendancePct}%` : '—'}</p></Card>
        <Card><p className="text-sm text-gray-600">Homework reviewed</p><p className="font-heading text-3xl font-bold text-navy-900 tabular">{hwDone}/{j.hw.length}</p></Card>
        <Card><p className="text-sm text-gray-600">Test average</p><p className="font-heading text-3xl font-bold text-navy-900 tabular">{avg ? `${avg}%` : '—'}</p></Card>
        <Card><p className="text-sm text-gray-600">Trend</p><p className={`font-heading text-3xl font-bold ${trend === 'Improving' ? 'text-teal-700' : 'text-navy-900'}`}>{trend}</p></Card>
      </div>
      <Card className="mt-6"><Tabs tabs={['Tuition', 'School']} value={tab} onChange={setTab} />
        <h2 className="mt-4 text-lg">{tab === 'Tuition' ? 'Tuition model tests' : 'School exams (entered by guardian, Demo)'}</h2>
        <div className="mt-3 space-y-3">{marks.map((m, i) => <Bar key={i} value={m} label={`Test ${i + 1}: ${m}%`} tone={tab === 'Tuition' ? 'teal' : 'blue'} />)}</div>
        <p className="mt-3 text-xs text-gray-600">Comparison: tuition tests {j.testMarks[j.testMarks.length - 1] ?? '—'}% vs school {school[2]}% latest.</p>
      </Card>
      {j.tuition === 'active' && <p className="mt-4 text-sm text-gray-600">Reviewed homework adds to this page. <Link to={`${A}/homework`} className="font-semibold text-blue-600 hover:underline">Open Homework</Link></p>}
      {j.tuition === 'completed' && <p className="mt-4 flex items-center gap-2 text-sm text-teal-700"><CheckCircle2 size={16} aria-hidden /> Tuition completed. Final report ready (Demo).</p>}
    </div>
  )
}
