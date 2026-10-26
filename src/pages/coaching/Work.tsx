import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { BookPlus, ClipboardPlus, FilePlus2, Send, Trash2 } from 'lucide-react'
import { maskParentPhone, REPORT_MONTHS, addNotif, batchStudents, examRows, fmtDay, gradeOf, hwStats, studentAttendance, type CJ, type Exam, type Homework, type Report } from '../../lib/coaching'
import { Bar, Button, Card, Chip, DemoTag, EmptyState, Field, Input, Select, Tabs, Textarea, btnClass, cx } from '../../components/ui'
import { Masked, PageHead } from '../../components/tutor/bits'
import { A, AddBtn, ConfirmModal, DataTable, DaySelect, Gate, NotFound, ReadOnlyBar, useCo } from './kit'

const bOf = (cj: CJ, id: string) => cj.batches.find((b) => b.id === id)
const bName = (cj: CJ, id: string) => bOf(cj, id)?.name ?? 'Deleted batch'
const first = (p: string) => p.split('/').filter(Boolean)[0]

/* ---------------- Homework ---------------- */
export function HomeworkPage({ sub }: { sub: string }) {
  const a = first(sub)
  if (a === 'new') return <CreateHomework />
  if (a) return <HomeworkDetail id={a} />
  return <HomeworkList />
}

const hwState = (cj: CJ, h: Homework, off: number) => { const s = hwStats(cj, h); return s.total > 0 && s.rev === s.total ? 'Reviewed' : h.due < off && s.sub < s.total ? 'Overdue' : 'Open' }

function HomeworkList() {
  const { cj, off } = useCo()
  return (
    <div>
      <PageHead title="Homework" tag="CO-18" sub="Assign work to a batch and track who has handed it in." actions={<AddBtn to="homework/new" label="Create homework" icon={<BookPlus size={16} aria-hidden />} />} />
      <ReadOnlyBar what="Creating homework and marking submissions" />
      <DataTable label="homework" rows={cj.homework} rowId={(h) => h.id} rowLabel={(h) => h.title} initialSort={{ key: 'due', dir: 1 }}
        search={{ placeholder: 'Search homework', text: (h) => `${h.title} ${bName(cj, h.batchId)}` }}
        filters={[{ label: 'Batch', options: cj.batches.map((b) => b.name), test: (h, v) => bName(cj, h.batchId) === v }, { label: 'Status', options: ['Open', 'Overdue', 'Reviewed'], test: (h, v) => hwState(cj, h, off) === v }]}
        cols={[
          { key: 'title', label: 'Homework', primary: true, sort: (h) => h.title, cell: (h) => <Link to={`${A}/homework/${h.id}`} className="font-semibold text-navy-900 hover:underline">{h.title}</Link> },
          { key: 'batch', label: 'Batch', sort: (h) => bName(cj, h.batchId), cell: (h) => bName(cj, h.batchId) },
          { key: 'due', label: 'Due', sort: (h) => h.due, cell: (h) => fmtDay(h.due) },
          { key: 'sub', label: 'Handed in', sort: (h) => hwStats(cj, h).sub, cell: (h) => { const s = hwStats(cj, h); return `${s.sub}/${s.total}` } },
          { key: 'st', label: 'Status', sort: (h) => hwState(cj, h, off), cell: (h) => { const st = hwState(cj, h, off); return <Chip tone={st === 'Reviewed' ? 'green' : st === 'Overdue' ? 'red' : 'blue'}>{st}</Chip> } },
        ]}
        actions={(h) => <Link to={`${A}/homework/${h.id}`} className={btnClass('secondary', 'sm')}>Track</Link>}
        empty={<EmptyState title="No homework yet" body="Create homework for a batch. You can then track who has handed it in." action={<AddBtn to="homework/new" label="Create homework" />} />} />
    </div>
  )
}

function CreateHomework() {
  const { cj, set, off, toast } = useCo(); const nav = useNavigate(); const [qs] = useSearchParams()
  const [f, setF] = useState({ batchId: cj.batches.find((b) => b.id === qs.get('batch'))?.id ?? cj.batches[0]?.id ?? '', title: '', desc: '', due: off + 3 }); const [touched, setTouched] = useState(false)
  const err = { batch: f.batchId ? '' : 'Create a batch first.', title: f.title.trim().length < 3 ? 'Enter a title (at least 3 characters).' : '', desc: f.desc.trim().length < 10 ? 'Describe the work in at least 10 characters.' : '' }
  const e = (k: keyof typeof err) => (touched ? err[k] : '')
  const save = () => {
    setTouched(true); if (Object.values(err).some(Boolean)) return
    const id = `H-${cj.seq}`; const n = batchStudents(cj, f.batchId).length
    set((c) => ({ homework: [...c.homework, { id, batchId: f.batchId, title: f.title.trim(), desc: f.desc.trim(), due: f.due, sub: {} }], seq: c.seq + 1, notifs: addNotif(c, `Homework "${f.title.trim()}" assigned to ${bName(c, f.batchId)}.`, `homework/${id}`, off) }))
    toast(`Homework assigned to ${bName(cj, f.batchId)} (${n} students)`, 'success'); nav(`${A}/homework/${id}`)
  }
  return (
    <div>
      <PageHead title="Create homework" tag="CO-19" crumb={{ to: `${A}/homework`, label: 'Homework' }} sub="Choose the batch it is for. Every student in the batch gets it." />
      <Gate what="Creating homework"><Card className="max-w-3xl">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Assign to batch" error={e('batch')}>{(id) => <Select id={id} value={bName(cj, f.batchId)} onChange={(x) => setF({ ...f, batchId: cj.batches.find((b) => b.name === x.target.value)?.id ?? '' })} options={cj.batches.map((b) => b.name)} />}</Field>
          <Field label="Due date">{(id) => <DaySelect id={id} value={f.due} onChange={(d) => setF({ ...f, due: d })} from={off} to={off + 21} />}</Field>
          <div className="sm:col-span-2"><Field label="Title" error={e('title')}>{(id) => <Input id={id} value={f.title} onChange={(x) => setF({ ...f, title: x.target.value })} placeholder="Algebra worksheet 5" aria-invalid={!!e('title')} />}</Field></div>
          <div className="sm:col-span-2"><Field label="Instructions" error={e('desc')}>{(id) => <Textarea id={id} value={f.desc} onChange={(x) => setF({ ...f, desc: x.target.value })} aria-invalid={!!e('desc')} />}</Field></div>
        </div>
        <p className="mt-4 flex items-center gap-2 text-xs text-gray-600"><DemoTag /> Students and parents are told in the app. No SMS is sent. Files are not uploaded in this prototype.</p>
        <div className="mt-6 flex flex-wrap gap-2"><Button onClick={save}>Assign homework</Button><Link to={`${A}/homework`} className={btnClass('secondary')}>Cancel</Link></div>
      </Card></Gate>
    </div>
  )
}

function HomeworkDetail({ id }: { id: string }) {
  const { cj, set, w, off, toast } = useCo(); const nav = useNavigate(); const [rm, setRm] = useState(false)
  const h = cj.homework.find((x) => x.id === id)
  if (!h) return <NotFound what="Homework" to="homework" label="Back to homework" />
  const st = batchStudents(cj, h.batchId); const s = hwStats(cj, h); const rows = st.map((x) => ({ x, state: (h.sub[x.id] ?? 'pending') as 'pending' | 'submitted' | 'reviewed' }))
  const setSub = (ids: string[], v: 'submitted' | 'reviewed' | null) => set((c) => ({ homework: c.homework.map((k) => (k.id === h.id ? { ...k, sub: Object.fromEntries([...Object.entries(k.sub).filter(([i]) => !ids.includes(i)), ...(v ? ids.map((i) => [i, v] as const) : [])]) } : k)) }))
  const pending = rows.filter((r) => r.state === 'pending')
  const chip = (r: (typeof rows)[number]) => <Chip tone={r.state === 'reviewed' ? 'green' : r.state === 'submitted' ? 'blue' : h.due < off ? 'red' : 'amber'}>{r.state === 'reviewed' ? 'Reviewed' : r.state === 'submitted' ? 'Handed in' : h.due < off ? 'Overdue' : 'Pending'}</Chip>
  return (
    <div>
      <PageHead title={h.title} tag="CO-20" crumb={{ to: `${A}/homework`, label: 'Homework' }} sub={`${bName(cj, h.batchId)} · Due ${fmtDay(h.due, true)}`} actions={<>
        <Button size="sm" variant="secondary" disabled={!w || pending.length === 0} onClick={() => toast(`Reminder sent to ${pending.length} parents (Demo, no real message)`, 'info')}>Remind {pending.length} pending</Button>
        <Button size="sm" variant="destructive" disabled={!w} onClick={() => setRm(true)} icon={<Trash2 size={14} aria-hidden />}>Delete</Button></>} />
      <ReadOnlyBar what="Marking submissions" />
      <div className="mb-6 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card><h2 className="text-lg">Instructions</h2><p className="mt-2 text-sm text-gray-600">{h.desc}</p></Card>
        <Card><h2 className="text-lg">Progress</h2><div className="mt-3 space-y-3"><Bar value={s.total ? Math.round((s.sub / s.total) * 100) : 0} label={`Handed in, ${s.sub} of ${s.total}`} tone="teal" /><Bar value={s.total ? Math.round((s.rev / s.total) * 100) : 0} label={`Reviewed, ${s.rev} of ${s.total}`} /></div></Card>
      </div>
      <h2 className="mb-3 text-lg">Submissions</h2>
      <DataTable label="submissions" rows={rows} rowId={(r) => r.x.id} rowLabel={(r) => r.x.name} selectable pageSize={10}
        search={{ placeholder: 'Search students', text: (r) => r.x.name }} filters={[{ label: 'Submission status', options: ['Pending', 'Handed in', 'Reviewed'], test: (r, v) => (v === 'Pending' ? r.state === 'pending' : v === 'Handed in' ? r.state === 'submitted' : r.state === 'reviewed') }]}
        cols={[{ key: 'n', label: 'Student', primary: true, sort: (r) => r.x.name, cell: (r) => <Link to={`${A}/students/${r.x.id}`} className="font-semibold text-navy-900 hover:underline">{r.x.name}</Link> }, { key: 'st', label: 'Status', sort: (r) => r.state, cell: chip }]}
        bulk={(ids, clear) => <><Button size="sm" variant="secondary" disabled={!w} onClick={() => { setSub(ids, 'submitted'); toast(`${ids.length} marked as handed in`, 'success'); clear() }}>Mark handed in</Button><Button size="sm" variant="secondary" disabled={!w} onClick={() => { setSub(ids, 'reviewed'); toast(`${ids.length} marked as reviewed`, 'success'); clear() }}>Mark reviewed</Button></>}
        actions={(r) => r.state === 'pending' ? <Button size="sm" disabled={!w} onClick={() => setSub([r.x.id], 'submitted')} aria-label={`Mark ${r.x.name} handed in`}>Mark handed in</Button>
          : r.state === 'submitted' ? <><Button size="sm" disabled={!w} onClick={() => setSub([r.x.id], 'reviewed')} aria-label={`Mark ${r.x.name} reviewed`}>Mark reviewed</Button><Button size="sm" variant="tertiary" disabled={!w} onClick={() => setSub([r.x.id], null)} aria-label={`Undo ${r.x.name}`}>Undo</Button></>
          : <Button size="sm" variant="tertiary" disabled={!w} onClick={() => setSub([r.x.id], 'submitted')} aria-label={`Reopen ${r.x.name}`}>Reopen</Button>}
        empty={<EmptyState title="No students in this batch" body="Add students to the batch to track submissions." />} />
      <ConfirmModal open={rm} title="Delete this homework?" confirm="Delete homework" onClose={() => setRm(false)} onConfirm={() => { set((c) => ({ homework: c.homework.filter((k) => k.id !== h.id) })); toast('Homework deleted', 'success'); nav(`${A}/homework`) }}>
        <p>"{h.title}" and its submission record are deleted for the whole batch. You cannot undo this in the prototype.</p>
      </ConfirmModal>
    </div>
  )
}

/* ---------------- Exams ---------------- */
export function Exams({ sub }: { sub: string }) {
  const a = first(sub)
  if (a === 'new') return <CreateExam />
  if (a) return <ExamDetail id={a} />
  return <ExamList />
}
const examState = (cj: CJ, e: Exam, off: number) => { const r = examRows(cj, e); return e.published ? 'Published' : e.day > off ? 'Upcoming' : r.total > 0 && r.entered === r.total ? 'Ready to publish' : 'Marks pending' }

function ExamList() {
  const { cj, off } = useCo()
  return (
    <div>
      <PageHead title="Exams" tag="CO-21" sub="Create an exam for a batch, enter marks on the exam day, then publish results." actions={<AddBtn to="exams/new" label="Create exam" icon={<ClipboardPlus size={16} aria-hidden />} />} />
      <ReadOnlyBar what="Creating exams and entering marks" />
      <DataTable label="exams" rows={cj.exams} rowId={(e) => e.id} rowLabel={(e) => e.title} initialSort={{ key: 'day', dir: -1 }}
        search={{ placeholder: 'Search exams', text: (e) => `${e.title} ${bName(cj, e.batchId)}` }}
        filters={[{ label: 'Batch', options: cj.batches.map((b) => b.name), test: (e, v) => bName(cj, e.batchId) === v }, { label: 'Status', options: ['Upcoming', 'Marks pending', 'Ready to publish', 'Published'], test: (e, v) => examState(cj, e, off) === v }]}
        cols={[
          { key: 'title', label: 'Exam', primary: true, sort: (e) => e.title, cell: (e) => <Link to={`${A}/exams/${e.id}`} className="font-semibold text-navy-900 hover:underline">{e.title}</Link> },
          { key: 'batch', label: 'Batch', sort: (e) => bName(cj, e.batchId), cell: (e) => bName(cj, e.batchId) },
          { key: 'day', label: 'Date', sort: (e) => e.day, cell: (e) => fmtDay(e.day) },
          { key: 'total', label: 'Total marks', sort: (e) => e.total, cell: (e) => e.total },
          { key: 'entered', label: 'Marks entered', sort: (e) => examRows(cj, e).entered, cell: (e) => { const r = examRows(cj, e); return `${r.entered}/${r.total}` } },
          { key: 'st', label: 'Status', sort: (e) => examState(cj, e, off), cell: (e) => { const s = examState(cj, e, off); return <Chip tone={s === 'Published' ? 'green' : s === 'Ready to publish' ? 'blue' : s === 'Marks pending' ? 'amber' : 'gray'}>{s}</Chip> } },
        ]}
        actions={(e) => <Link to={`${A}/exams/${e.id}`} className={btnClass(e.published ? 'secondary' : 'primary', 'sm')}>{e.published ? 'View marks' : e.day > off ? 'Open' : 'Enter marks'}<span className="sr-only"> for {e.title}</span></Link>}
        empty={<EmptyState title="No exams yet" body="Create an exam for a batch. Marks open on the exam day." action={<AddBtn to="exams/new" label="Create exam" />} />} />
    </div>
  )
}

function CreateExam() {
  const { cj, set, off, toast } = useCo(); const nav = useNavigate()
  const [f, setF] = useState({ batchId: cj.batches[0]?.id ?? '', title: '', day: off, total: '50' }); const [touched, setTouched] = useState(false)
  const err = { batch: f.batchId ? '' : 'Create a batch first.', title: f.title.trim().length < 3 ? 'Enter an exam title (at least 3 characters).' : '' }
  const e = (k: keyof typeof err) => (touched ? err[k] : '')
  const save = () => {
    setTouched(true); if (Object.values(err).some(Boolean)) return
    const id = `E-${cj.seq}`
    set((c) => ({ exams: [...c.exams, { id, batchId: f.batchId, title: f.title.trim(), day: f.day, total: +f.total, marks: {}, published: false }], seq: c.seq + 1, notifs: addNotif(c, `Exam "${f.title.trim()}" created for ${bName(c, f.batchId)}.`, `exams/${id}`, off) }))
    toast('Exam created. Students and parents see the date (Demo).', 'success'); nav(`${A}/exams/${id}`)
  }
  return (
    <div>
      <PageHead title="Create exam" tag="CO-22" crumb={{ to: `${A}/exams`, label: 'Exams' }} sub="Pick the batch, date and total marks." />
      <Gate what="Creating exams"><Card className="max-w-3xl">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Batch" error={e('batch')}>{(id) => <Select id={id} value={bName(cj, f.batchId)} onChange={(x) => setF({ ...f, batchId: cj.batches.find((b) => b.name === x.target.value)?.id ?? '' })} options={cj.batches.map((b) => b.name)} />}</Field>
          <Field label="Exam date">{(id) => <DaySelect id={id} value={f.day} onChange={(d) => setF({ ...f, day: d })} from={off - 14} to={off + 28} />}</Field>
          <div className="sm:col-span-2"><Field label="Exam title" error={e('title')}>{(id) => <Input id={id} value={f.title} onChange={(x) => setF({ ...f, title: x.target.value })} placeholder="Monthly test, Mechanics" aria-invalid={!!e('title')} />}</Field></div>
          <Field label="Total marks">{(id) => <Select id={id} value={f.total} onChange={(x) => setF({ ...f, total: x.target.value })} options={['20', '25', '30', '50', '100']} />}</Field>
        </div>
        <div className="mt-6 flex flex-wrap gap-2"><Button onClick={save}>Create exam</Button><Link to={`${A}/exams`} className={btnClass('secondary')}>Cancel</Link></div>
      </Card></Gate>
    </div>
  )
}

type Draft = Record<string, { v: string; absent: boolean }>
function ExamDetail({ id }: { id: string }) {
  const { cj, set, w, off, toast } = useCo(); const nav = useNavigate(); const e = cj.exams.find((x) => x.id === id)
  const st = e ? batchStudents(cj, e.batchId).filter((s) => s.status === 'active') : []
  const [d, setD] = useState<Draft>(() => Object.fromEntries(st.map((s) => { const m = e?.marks[s.id]; return [s.id, { v: typeof m === 'number' ? String(m) : '', absent: m === null }] })))
  const [touched, setTouched] = useState(false); const [pub, setPub] = useState(false); const [unpub, setUnpub] = useState(false); const [del, setDel] = useState(false)
  if (!e) return <NotFound what="Exam" to="exams" label="Back to exams" />
  const rowErr = (sid: string) => { const x = d[sid]; if (!x || x.absent || x.v.trim() === '') return ''; if (!/^\d+(\.\d)?$/.test(x.v.trim())) return 'Enter a number.'; return +x.v > e.total ? `Out of ${e.total} marks.` : '' }
  const filled = st.filter((s) => d[s.id]?.absent || d[s.id]?.v.trim() !== ''); const bad = st.some((s) => rowErr(s.id))
  const complete = st.length > 0 && filled.length === st.length && !bad
  const toMarks = (): Exam['marks'] => Object.fromEntries(filled.filter((s) => !rowErr(s.id)).map((s) => [s.id, d[s.id].absent ? null : +d[s.id].v]))
  const closed = e.day > off
  const save = () => { setTouched(true); if (bad) return false; set((c) => ({ exams: c.exams.map((x) => (x.id === e.id ? { ...x, marks: toMarks() } : x)) })); toast(`Marks saved for ${filled.length} of ${st.length} students`, 'success'); return true }
  const publish = () => { set((c) => ({ exams: c.exams.map((x) => (x.id === e.id ? { ...x, marks: toMarks(), published: true } : x)), notifs: addNotif(c, `Results published for ${e.title}.`, 'results', off) })); toast('Results published. Students and parents can see them (Demo).', 'success') }
  const view = examRows(cj, e)
  return (
    <div>
      <PageHead title={e.title} tag="CO-23" crumb={{ to: `${A}/exams`, label: 'Exams' }} sub={`${bName(cj, e.batchId)} · ${fmtDay(e.day, true)} · ${e.total} marks`} actions={<>
        <Chip tone={e.published ? 'green' : 'gray'}>{examState(cj, e, off)}</Chip>
        {e.published ? <Button size="sm" variant="secondary" disabled={!w} onClick={() => setUnpub(true)}>Unpublish</Button> : <Button size="sm" variant="destructive" disabled={!w} onClick={() => setDel(true)} icon={<Trash2 size={14} aria-hidden />}>Delete exam</Button>}</>} />
      <ReadOnlyBar what="Entering marks and publishing results" />
      {closed && !e.published ? <EmptyState title="Marks are not open yet" body={`This exam is on ${fmtDay(e.day, true)}. You can enter marks from the exam day. Use Demo controls to move the date forward.`} action={<Link to={`${A}/exams`} className={btnClass('secondary')}>Back to exams</Link>} />
        : st.length === 0 ? <EmptyState title="No active students in this batch" body="Add students to the batch to enter marks." action={<Link to={`${A}/batches/${e.batchId}`} className={btnClass('secondary')}>Open batch</Link>} /> : e.published ? (
          <div className="space-y-4">
            <Card className="flex flex-wrap items-center gap-3 bg-success-100/50"><p className="min-w-0 flex-1 text-sm text-gray-600"><b className="text-navy-900">Published.</b> Average {view.avg ?? '—'}%, highest {view.high ?? '—'}/{e.total}, pass rate {view.passRate ?? '—'}%.</p><Link to={`${A}/results`} className={btnClass('secondary', 'sm')}>View results</Link></Card>
            <DataTable label="marks" rows={view.rows} rowId={(r) => r.s.id} rowLabel={(r) => r.s.name} pageSize={10}
              cols={[{ key: 'n', label: 'Student', primary: true, sort: (r) => r.s.name, cell: (r) => r.s.name }, { key: 'm', label: 'Marks', sort: (r) => (typeof r.mark === 'number' ? r.mark : -1), cell: (r) => (typeof r.mark === 'number' ? `${r.mark}/${e.total}` : r.mark === null ? 'Absent' : '—') }]} empty={<span />} />
          </div>
        ) : (
          <Card pad={false}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 p-4"><p className="text-sm text-gray-600" role="status"><b className="text-navy-900">{filled.length}</b> of {st.length} students have a mark or are marked absent</p><Bar value={Math.round((filled.length / st.length) * 100)} label="" tone="teal" /></div>
            <ul className="divide-y divide-gray-100">{st.map((s) => { const er = touched ? rowErr(s.id) : ''; const x = d[s.id] ?? { v: '', absent: false }
              return <li key={s.id} className="flex flex-wrap items-start gap-3 p-4"><span className="min-w-[8rem] flex-1 pt-2.5 text-sm font-semibold text-navy-900">{s.name}</span>
                <div className="w-28"><Input aria-label={`Marks for ${s.name}`} inputMode="decimal" value={x.absent ? '' : x.v} disabled={!w || x.absent} placeholder={`/ ${e.total}`} aria-invalid={!!er} onChange={(ev) => setD({ ...d, [s.id]: { v: ev.target.value, absent: false } })} />{er && <p role="alert" className="mt-1 text-xs text-danger-600">{er}</p>}</div>
                <label className="flex min-h-11 items-center gap-2 text-sm text-gray-600 md:min-h-0 md:pt-2.5"><input type="checkbox" className="h-5 w-5 accent-blue-600" disabled={!w} checked={x.absent} onChange={(ev) => setD({ ...d, [s.id]: { v: '', absent: ev.target.checked } })} /> Absent<span className="sr-only"> {s.name}</span></label></li> })}</ul>
            <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 p-4">
              <Button variant="secondary" disabled={!w} onClick={save}>Save marks</Button>
              <Button disabled={!w || !complete} onClick={() => { setTouched(true); if (complete) setPub(true) }}>Publish results</Button>
              {!complete && <span className="text-xs text-gray-600">Enter a mark or Absent for every student to publish.</span>}
            </div>
          </Card>)}
      <ConfirmModal open={pub} title="Publish these results?" danger={false} confirm="Publish results" onClose={() => setPub(false)} onConfirm={() => { publish(); nav(`${A}/results`) }}>
        <p>{e.title}: students and parents can see marks, grades and rank for {bName(cj, e.batchId)}. You can unpublish later. No message is sent in this prototype (Demo).</p>
      </ConfirmModal>
      <ConfirmModal open={unpub} title="Unpublish results?" confirm="Unpublish" onClose={() => setUnpub(false)} onConfirm={() => { set((c) => ({ exams: c.exams.map((x) => (x.id === e.id ? { ...x, published: false } : x)) })); toast('Results are hidden again', 'success') }}>
        <p>Students and parents will no longer see these results. Marks stay saved so you can publish again.</p>
      </ConfirmModal>
      <ConfirmModal open={del} title="Delete this exam?" confirm="Delete exam" onClose={() => setDel(false)} onConfirm={() => { set((c) => ({ exams: c.exams.filter((x) => x.id !== e.id) })); toast('Exam deleted', 'success'); nav(`${A}/exams`) }}>
        <p>"{e.title}" and any marks entered are deleted. You cannot undo this in the prototype.</p>
      </ConfirmModal>
    </div>
  )
}

/* ---------------- Results ---------------- */
export function Results() {
  const { cj } = useCo(); const [tab, setTab] = useState('By batch')
  const pubs = cj.exams.filter((e) => e.published); const ready = cj.exams.filter((e) => !e.published && examRows(cj, e).total > 0 && examRows(cj, e).entered === examRows(cj, e).total)
  const [bid, setBid] = useState(''); const batchId = bid || pubs[0]?.batchId || cj.batches[0]?.id || ''
  const exs = pubs.filter((e) => e.batchId === batchId); const [eid, setEid] = useState(''); const ex = exs.find((e) => e.id === eid) ?? exs[0]
  const [sid, setSid] = useState(''); const stu = cj.students.find((s) => s.id === sid) ?? cj.students.find((s) => pubs.some((e) => e.batchId && s.batchIds.includes(e.batchId))) ?? cj.students[0]
  const view = ex ? examRows(cj, ex) : null
  return (
    <div>
      <PageHead title="Results" tag="CO-24" sub="Published exam results, by batch or by student." />
      {ready.length > 0 && <Card className="mb-6 flex flex-wrap items-center gap-3 border-blue-600/30 bg-blue-100/50"><p className="min-w-0 flex-1 text-sm text-gray-600"><b className="text-navy-900">{ready.length} exam{ready.length > 1 ? 's' : ''} ready to publish:</b> {ready.map((e) => e.title).join(', ')}</p><Link to={`${A}/exams/${ready[0].id}`} className={btnClass('primary', 'sm')}>Review and publish</Link></Card>}
      {pubs.length === 0 ? <EmptyState title="No results published yet" body="Enter marks for an exam, then publish it. Published results appear here by batch and by student." action={<Link to={`${A}/exams`} className={btnClass('primary')}>Go to exams</Link>} /> : (<>
        <Tabs tabs={['By batch', 'By student']} value={tab} onChange={setTab} />
        <div className="mt-4" role="tabpanel">
          {tab === 'By batch' ? (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-3"><div className="min-w-[12rem] flex-1 sm:max-w-xs"><Field label="Batch">{(i) => <Select id={i} value={cj.batches.find((b) => b.id === batchId)?.name ?? ''} onChange={(x) => { setBid(cj.batches.find((b) => b.name === x.target.value)?.id ?? ''); setEid('') }} options={cj.batches.map((b) => b.name)} />}</Field></div>
                {exs.length > 0 && <div className="min-w-[12rem] flex-1 sm:max-w-xs"><Field label="Exam">{(i) => <Select id={i} value={ex?.title ?? ''} onChange={(x) => setEid(exs.find((e) => e.title === x.target.value)?.id ?? '')} options={exs.map((e) => e.title)} />}</Field></div>}</div>
              {!ex || !view ? <EmptyState title="No published results for this batch" body="Publish an exam for this batch to see its results." action={<Link to={`${A}/exams`} className={btnClass('secondary')}>Go to exams</Link>} /> : (<>
                <div className="grid grid-cols-3 gap-3 text-center">{[['Average', view.avg === null ? '—' : `${view.avg}%`], ['Highest', view.high === null ? '—' : `${view.high}/${ex.total}`], ['Pass rate', view.passRate === null ? '—' : `${view.passRate}%`]].map(([l, v]) => <Card key={l} className="!p-4"><p className="font-heading text-2xl font-bold text-navy-900 tabular">{v}</p><p className="text-xs text-gray-600">{l}</p></Card>)}</div>
                <DataTable label="results" rows={view.rows} rowId={(r) => r.s.id} rowLabel={(r) => r.s.name} initialSort={{ key: 'rank', dir: 1 }} pageSize={10}
                  search={{ placeholder: 'Search students', text: (r) => r.s.name }}
                  cols={[
                    { key: 'rank', label: 'Rank', sort: (r) => r.rank ?? 999, cell: (r) => r.rank ?? '—' },
                    { key: 'n', label: 'Student', primary: true, sort: (r) => r.s.name, cell: (r) => <Link to={`${A}/students/${r.s.id}`} className="font-semibold text-navy-900 hover:underline">{r.s.name}</Link> },
                    { key: 'm', label: 'Marks', sort: (r) => (typeof r.mark === 'number' ? r.mark : -1), cell: (r) => (typeof r.mark === 'number' ? `${r.mark}/${ex.total}` : 'Absent') },
                    { key: 'p', label: 'Percent', sort: (r) => r.pct ?? -1, cell: (r) => (r.pct === null ? '—' : `${r.pct}%`) },
                    { key: 'g', label: 'Grade', sort: (r) => r.pct ?? -1, cell: (r) => (r.pct === null ? '—' : <Chip tone={r.pct >= 33 ? 'green' : 'red'}>{gradeOf(r.pct)}</Chip>) },
                  ]} empty={<EmptyState title="No students in this batch" body="Add students to the batch." />} /></>)}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="min-w-[12rem] sm:max-w-xs"><Field label="Student">{(i) => <Select id={i} value={stu?.name ?? ''} onChange={(x) => setSid(cj.students.find((s) => s.name === x.target.value)?.id ?? '')} options={cj.students.map((s) => s.name)} />}</Field></div>
              {stu && (() => { const rows = pubs.filter((e) => stu.batchIds.includes(e.batchId)).map((e) => ({ e, r: examRows(cj, e) })).map(({ e, r }) => ({ e, row: r.rows.find((x) => x.s.id === stu.id), avg: r.avg }))
                return <DataTable label="student results" rows={rows} rowId={(r) => r.e.id} rowLabel={(r) => r.e.title}
                  cols={[
                    { key: 'e', label: 'Exam', primary: true, sort: (r) => r.e.title, cell: (r) => r.e.title },
                    { key: 'b', label: 'Batch', cell: (r) => bName(cj, r.e.batchId) },
                    { key: 'm', label: 'Marks', sort: (r) => (typeof r.row?.mark === 'number' ? r.row.mark : -1), cell: (r) => (typeof r.row?.mark === 'number' ? `${r.row.mark}/${r.e.total}` : 'Absent') },
                    { key: 'g', label: 'Grade', cell: (r) => (r.row?.pct == null ? '—' : <Chip tone={r.row.pct >= 33 ? 'green' : 'red'}>{gradeOf(r.row.pct)}</Chip>) },
                    { key: 'a', label: 'Class average', sort: (r) => r.avg ?? -1, cell: (r) => (r.avg === null ? '—' : `${r.avg}%`) },
                  ]} empty={<EmptyState title={`No published results for ${stu.name}`} body="Results appear once an exam for their batch is published." />} /> })()}
            </div>)}
        </div></>)}
    </div>
  )
}

/* ---------------- Reports ---------------- */
export function Reports({ sub }: { sub: string }) {
  const a = first(sub)
  if (a === 'new') return <GenerateReport />
  if (a) return <ReportDetail id={a} />
  return <ReportList />
}

function ReportList() {
  const { cj } = useCo()
  return (
    <div>
      <PageHead title="Reports" tag="CO-25" sub="Monthly progress reports for parents: attendance, results and homework in one page." actions={<AddBtn to="reports/new" label="Generate report" icon={<FilePlus2 size={16} aria-hidden />} />} />
      <ReadOnlyBar what="Generating and sending reports" />
      <DataTable label="reports" rows={cj.reports} rowId={(r) => r.id} rowLabel={(r) => `${bName(cj, r.batchId)} ${r.month}`} initialSort={{ key: 'status', dir: 1 }}
        filters={[{ label: 'Status', options: ['Draft', 'Sent'], test: (r, v) => (v === 'Sent') === r.sent }, { label: 'Month', options: REPORT_MONTHS, test: (r, v) => r.month === v }]}
        cols={[
          { key: 'b', label: 'Report', primary: true, sort: (r) => bName(cj, r.batchId), cell: (r) => <Link to={`${A}/reports/${r.id}`} className="font-semibold text-navy-900 hover:underline">{bName(cj, r.batchId)}</Link> },
          { key: 'm', label: 'Month', sort: (r) => r.month, cell: (r) => r.month },
          { key: 'n', label: 'Students', cell: (r) => batchStudents(cj, r.batchId).length },
          { key: 'status', label: 'Status', sort: (r) => (r.sent ? 1 : 0), cell: (r) => (r.sent ? <Chip tone="green">Sent {r.sentDay !== null ? fmtDay(r.sentDay) : ''}</Chip> : <Chip tone="amber">Draft</Chip>) },
        ]}
        actions={(r) => <Link to={`${A}/reports/${r.id}`} className={btnClass(r.sent ? 'secondary' : 'primary', 'sm')}>{r.sent ? 'View' : 'Preview and send'}<span className="sr-only"> {bName(cj, r.batchId)} {r.month}</span></Link>}
        empty={<EmptyState title="No reports yet" body="Generate a monthly report for a batch, preview it, then send it to parents." action={<AddBtn to="reports/new" label="Generate report" />} />} />
    </div>
  )
}

function GenerateReport() {
  const { cj, set, toast } = useCo(); const nav = useNavigate()
  const [bid, setBid] = useState(cj.batches[0]?.id ?? ''); const [month, setMonth] = useState(REPORT_MONTHS[1])
  const dup = cj.reports.find((r) => r.batchId === bid && r.month === month)
  const go = () => {
    if (dup) { nav(`${A}/reports/${dup.id}`); return }
    const id = `R-${cj.seq}`; set((c) => ({ reports: [...c.reports, { id, batchId: bid, month, sent: false, remark: '', sentDay: null }], seq: c.seq + 1 })); toast('Report generated as a draft. Preview it before sending.', 'success'); nav(`${A}/reports/${id}`)
  }
  return (
    <div>
      <PageHead title="Generate report" tag="CO-26" crumb={{ to: `${A}/reports`, label: 'Reports' }} sub="Pick a batch and a month. The report is built from your attendance, results and homework." />
      <Gate what="Generating reports"><Card className="max-w-2xl">
        {cj.batches.length === 0 ? <EmptyState title="No batches yet" body="Create a batch before generating a report." action={<AddBtn to="batches/new" label="Create batch" />} /> : (<>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Batch">{(i) => <Select id={i} value={bName(cj, bid)} onChange={(x) => setBid(cj.batches.find((b) => b.name === x.target.value)?.id ?? '')} options={cj.batches.map((b) => b.name)} />}</Field>
            <Field label="Month">{(i) => <Select id={i} value={month} onChange={(x) => setMonth(x.target.value)} options={REPORT_MONTHS} />}</Field>
          </div>
          {dup && <p className="mt-4 rounded-input bg-blue-100 p-3 text-sm text-navy-700">A report for this batch and month already exists ({dup.sent ? 'sent' : 'draft'}). Open it instead of creating a duplicate.</p>}
          <div className="mt-6 flex flex-wrap gap-2"><Button onClick={go}>{dup ? 'Open existing report' : 'Generate report'}</Button><Link to={`${A}/reports`} className={btnClass('secondary')}>Cancel</Link></div></>)}
      </Card></Gate>
    </div>
  )
}

function ReportDetail({ id }: { id: string }) {
  const { cj, set, w, off, toast } = useCo(); const nav = useNavigate(); const r = cj.reports.find((x) => x.id === id)
  const [remark, setRemark] = useState(r?.remark ?? ''); const [who, setWho] = useState(''); const [send, setSend] = useState(false); const [del, setDel] = useState(false)
  if (!r) return <NotFound what="Report" to="reports" label="Back to reports" />
  const b = bOf(cj, r.batchId); const st = batchStudents(cj, r.batchId)
  const pubs = cj.exams.filter((e) => e.published && e.batchId === r.batchId); const hws = cj.homework.filter((h) => h.batchId === r.batchId)
  const rows = st.map((s) => {
    const a = studentAttendance(cj, s.id)
    const ps = pubs.map((e) => examRows(cj, e).rows.find((x) => x.s.id === s.id)?.pct).filter((x): x is number => typeof x === 'number')
    return { s, att: a.pct, exam: ps.length ? Math.round(ps.reduce((x, y) => x + y, 0) / ps.length) : null, hw: hws.filter((h) => h.sub[s.id]).length, hwTotal: hws.length, parent: cj.parents.find((p) => p.id === s.parentId) }
  })
  const parents = new Set(rows.map((x) => x.parent?.id).filter(Boolean)).size
  const pick = rows.find((x) => x.s.name === who) ?? rows[0]
  const locked = r.sent
  return (
    <div>
      <PageHead title={`${b?.name ?? 'Batch'} report`} tag="CO-27" crumb={{ to: `${A}/reports`, label: 'Reports' }} sub={`${r.month} · ${st.length} students · ${parents} parents`} actions={<>
        {r.sent ? <Chip tone="green">Sent {r.sentDay !== null ? fmtDay(r.sentDay) : ''}</Chip> : <Chip tone="amber">Draft</Chip>}
        {!r.sent && <Button size="sm" variant="destructive" disabled={!w} onClick={() => setDel(true)} icon={<Trash2 size={14} aria-hidden />}>Delete draft</Button>}
        {!r.sent && <Button size="sm" disabled={!w || rows.length === 0} onClick={() => setSend(true)} icon={<Send size={14} aria-hidden />}>Send to {parents} parents</Button>}</>} />
      <ReadOnlyBar what="Sending reports" />
      {r.sent && <Card className="mb-6 bg-success-100/50"><p className="text-sm text-gray-600"><b className="text-navy-900">Sent to {parents} parents.</b> <DemoTag label="Demo send" /> No SMS or email was really sent. In production this goes through the parent's TuitionHub inbox.</p></Card>}
      {rows.length === 0 ? <EmptyState title="No students in this batch" body="A report needs at least one student." action={<Link to={`${A}/batches/${r.batchId}`} className={btnClass('secondary')}>Open batch</Link>} /> : (
        <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <div className="space-y-6">
            <Card><Field label="Teacher remark for parents" hint={locked ? 'This report was sent, so the remark is locked.' : 'Shown on every parent report. Keep it short and kind.'}>{(i) => <Textarea id={i} value={remark} disabled={locked || !w} onChange={(x) => setRemark(x.target.value)} />}</Field>
              {!locked && <Button className="mt-3" size="sm" variant="secondary" disabled={!w || remark === r.remark} onClick={() => { set((c) => ({ reports: c.reports.map((x) => (x.id === r.id ? { ...x, remark } : x)) })); toast('Remark saved', 'success') }}>Save remark</Button>}</Card>
            <DataTable label="report rows" rows={rows} rowId={(x) => x.s.id} rowLabel={(x) => x.s.name} pageSize={8} search={{ placeholder: 'Search students', text: (x) => x.s.name }}
              cols={[
                { key: 'n', label: 'Student', primary: true, sort: (x) => x.s.name, cell: (x) => x.s.name },
                { key: 'att', label: 'Attendance', sort: (x) => x.att ?? -1, cell: (x) => (x.att === null ? '—' : `${x.att}%`) },
                { key: 'exam', label: 'Exam average', sort: (x) => x.exam ?? -1, cell: (x) => (x.exam === null ? 'No result yet' : `${x.exam}%`) },
                { key: 'hw', label: 'Homework', sort: (x) => x.hw, cell: (x) => (x.hwTotal ? `${x.hw}/${x.hwTotal}` : '—') },
              ]} empty={<span />} />
          </div>
          <Card className="h-fit"><div className="flex items-center justify-between gap-2"><h2 className="text-lg">Parent preview</h2><DemoTag label="Preview" /></div>
            <div className="mt-3"><Field label="Preview for">{(i) => <Select id={i} value={pick?.s.name ?? ''} onChange={(x) => setWho(x.target.value)} options={rows.map((x) => x.s.name)} />}</Field></div>
            {pick && (
              <div className="mt-4 rounded-card border border-gray-200 bg-offwhite-50 p-4 text-sm">
                <p className="text-xs uppercase tracking-wide text-gray-600">Monthly progress report · {r.month}</p>
                <p className="mt-1 font-heading text-lg font-bold text-navy-900">{pick.s.name}</p>
                <p className="text-gray-600">{b?.name} · {pick.s.cls}</p>
                <p className="mt-2 text-xs text-gray-600">To: {pick.parent?.name ?? 'Parent'} · <Masked value={pick.parent ? maskParentPhone(pick.parent.phone) : '—'} /></p>
                <dl className="mt-3 space-y-2"><div className="flex justify-between"><dt className="text-gray-600">Attendance</dt><dd className="font-semibold tabular text-navy-900">{pick.att === null ? '—' : `${pick.att}%`}</dd></div>
                  <div className="flex justify-between"><dt className="text-gray-600">Exam average</dt><dd className="font-semibold tabular text-navy-900">{pick.exam === null ? 'No published result' : `${pick.exam}% (${gradeOf(pick.exam)})`}</dd></div>
                  <div className="flex justify-between"><dt className="text-gray-600">Homework handed in</dt><dd className="font-semibold tabular text-navy-900">{pick.hwTotal ? `${pick.hw} of ${pick.hwTotal}` : 'None set'}</dd></div></dl>
                <p className={cx('mt-3 border-t border-gray-200 pt-3', !remark && 'text-gray-600')}>{remark || 'No remark added yet.'}</p>
              </div>)}
          </Card>
        </div>)}
      <ConfirmModal open={send} danger={false} title={`Send report to ${parents} parents?`} confirm="Send report (Demo)" onClose={() => setSend(false)} onConfirm={() => { set((c) => ({ reports: c.reports.map((x) => (x.id === r.id ? { ...x, sent: true, remark, sentDay: off } : x)), notifs: addNotif(c, `${b?.name} report for ${r.month} sent to ${parents} parents.`, `reports/${r.id}`, off) })); toast(`Report sent to ${parents} parents (Demo, no real SMS or email)`, 'success') }}>
        <p>Each parent sees only their own child's page. After sending, the report and remark are locked. <b>Demo:</b> nothing is really sent.</p>
      </ConfirmModal>
      <ConfirmModal open={del} title="Delete this draft?" confirm="Delete draft" onClose={() => setDel(false)} onConfirm={() => { set((c) => ({ reports: c.reports.filter((x) => x.id !== r.id) })); toast('Draft deleted', 'success'); nav(`${A}/reports`) }}>
        <p>The draft for {b?.name}, {r.month} is deleted. You can generate it again any time.</p>
      </ConfirmModal>
    </div>
  )
}
export type { Report }
