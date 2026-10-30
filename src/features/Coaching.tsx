import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Plus } from 'lucide-react'
import { Button, Card, Chip, Field, Input, Modal, Select, StatCard, Tabs, Textarea } from '../components/ui'
import { useStore } from '../lib/store'
import { platform, taka, fmtDate, type Batch, type Roster, type Teacher } from '../lib/platform'
import { useAction, useLoad } from '../lib/useLoad'
import { CLASSES, Loaded, PageTitle, Section, SUBJECTS, opts, statusLabel } from './common'

const C = platform.coaching
type Form = Record<string, string>

/** A small create/edit dialog driven by a field list. */
function EditDialog({ title, fields, initial, onSave, onClose }: { title: string; fields: { key: string; label: string; type?: string; options?: { value: string; label: string }[]; area?: boolean; hint?: string }[]; initial: Form; onSave: (f: Form) => Promise<unknown>; onClose: () => void }) {
  const { toast } = useStore()
  const [form, setForm] = useState<Form>(initial)
  const { busy, run } = useAction(toast)
  return (
    <Modal open onClose={onClose} title={title} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={() => void run(async () => { await onSave(form); onClose() }, 'Saved.')}>Save</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">{fields.map((f) => (
        <div key={f.key} className={f.area ? 'sm:col-span-2' : ''}><Field label={f.label} hint={f.hint}>{(id) => f.options ? <Select id={id} value={form[f.key] ?? ''} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} options={f.options} /> : f.area ? <Textarea id={id} value={form[f.key] ?? ''} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} /> : <Input id={id} type={f.type} value={form[f.key] ?? ''} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />}</Field></div>
      ))}</div>
    </Modal>
  )
}
const num = (v?: string) => (v === undefined || v === '' ? null : Number(v))
const clean = (f: Form) => Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v]))

export function Teachers() {
  const load = useLoad(() => C.teachers(), [])
  const [edit, setEdit] = useState<Teacher | 'new' | null>(null)
  return (
    <div className="space-y-4">
      <PageTitle title="Teachers" actions={<Button icon={<Plus size={16} />} onClick={() => setEdit('new')}>Add teacher</Button>} />
      <Loaded load={load} empty={(d) => d.teachers.length ? null : { title: 'No teachers yet', body: 'Add your teachers so you can assign them to batches.' }}>
        {(d) => <div className="grid gap-3 md:grid-cols-2">{d.teachers.map((t) => <Card key={t.id}><div className="flex justify-between gap-2"><div><p className="font-semibold">{t.name}</p><p className="text-sm text-gray-600">{[t.subject, t.qualification].filter(Boolean).join(' · ')}</p><p className="text-sm text-gray-600">{[t.phone, t.email].filter(Boolean).join(' · ')}</p><p className="text-sm">{t.batches} active batch{t.batches === 1 ? '' : 'es'}</p></div><div className="text-right"><Chip tone={t.status === 'active' ? 'green' : 'gray'}>{statusLabel(t.status)}</Chip><Button className="mt-2" size="sm" variant="secondary" onClick={() => setEdit(t)}>Edit</Button></div></div></Card>)}</div>}
      </Loaded>
      {edit && <EditDialog title={edit === 'new' ? 'Add teacher' : 'Edit teacher'} initial={edit === 'new' ? { status: 'active' } : { name: edit.name, subject: edit.subject ?? '', qualification: edit.qualification ?? '', phone: edit.phone ?? '', email: edit.email ?? '', status: edit.status }}
        fields={[{ key: 'name', label: 'Name' }, { key: 'subject', label: 'Subject', options: opts(SUBJECTS, 'Choose') }, { key: 'qualification', label: 'Qualification' }, { key: 'phone', label: 'Phone' }, { key: 'email', label: 'Email', type: 'email' }, { key: 'status', label: 'Status', options: opts(['active', 'invited', 'inactive']) }]}
        onSave={async (f) => { await C.saveTeacher(clean(f), edit === 'new' ? undefined : edit.id); await load.reload() }} onClose={() => setEdit(null)} />}
    </div>
  )
}

export function Students() {
  const { toast } = useStore()
  const load = useLoad(async () => ({ ...(await C.students()), ...(await C.batches()) }), [])
  const [edit, setEdit] = useState<Roster | 'new' | null>(null)
  const [enrol, setEnrol] = useState<Roster | null>(null)
  const { busy, run } = useAction(toast)
  const batchName = (id: string) => load.data?.batches.find((b) => b.id === id)?.name ?? 'Batch'
  return (
    <div className="space-y-4">
      <PageTitle title="Students" sub="Admit learners and enrol them in batches. Linking a student or guardian account lets them see classes and results." actions={<Button icon={<Plus size={16} />} onClick={() => setEdit('new')}>Admit student</Button>} />
      <Loaded load={load} empty={(d) => d.students.length ? null : { title: 'No students yet', body: 'Admit your first student.' }}>
        {(d) => <Card pad={false}><ul className="divide-y divide-gray-100">{d.students.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
            <div><p className="font-semibold">{s.name} {s.has_account && <Chip tone="blue">Account linked</Chip>}</p><p className="text-gray-600">{[s.class_name, s.guardian_name, s.guardian_phone].filter(Boolean).join(' · ')}{s.admitted_at ? ` · admitted ${fmtDate(s.admitted_at)}` : ''}</p><p>{s.batch_ids.length ? s.batch_ids.map(batchName).join(', ') : 'Not enrolled in a batch'}</p></div>
            <div className="flex items-center gap-2"><Chip tone={s.status === 'active' ? 'green' : 'gray'}>{statusLabel(s.status)}</Chip><Button size="sm" variant="secondary" onClick={() => setEnrol(s)}>Manage batches</Button><Button size="sm" variant="secondary" onClick={() => setEdit(s)}>Edit</Button></div>
          </li>))}</ul></Card>}
      </Loaded>
      {edit && <EditDialog title={edit === 'new' ? 'Admit student' : 'Edit student'} initial={edit === 'new' ? { status: 'active' } : { name: edit.name, class_name: edit.class_name ?? '', guardian_name: edit.guardian_name ?? '', guardian_phone: edit.guardian_phone ?? '', status: edit.status }}
        fields={[{ key: 'name', label: 'Student name' }, { key: 'class_name', label: 'Class', options: opts(CLASSES, 'Choose') }, { key: 'guardian_name', label: 'Guardian name' }, { key: 'guardian_phone', label: 'Guardian phone' }, { key: 'student_email', label: 'Student account email (optional)', type: 'email', hint: 'Links an existing student account' }, { key: 'guardian_email', label: 'Guardian account email (optional)', type: 'email', hint: 'Links an existing parent account' }, { key: 'status', label: 'Status', options: opts(['active', 'paused', 'left']) }]}
        onSave={async (f) => { await C.saveStudent(clean(f), edit === 'new' ? undefined : edit.id); await load.reload() }} onClose={() => setEdit(null)} />}
      {enrol && load.data && <Modal open onClose={() => setEnrol(null)} title={`Batches · ${enrol.name}`}>
        <ul className="divide-y divide-gray-100">{load.data.batches.filter((b) => b.status === 'active').map((b) => {
          const on = load.data!.students.find((s) => s.id === enrol.id)?.batch_ids.includes(b.id)
          return <li key={b.id} className="flex items-center justify-between py-2 text-sm"><span>{b.name} · {b.subject} ({b.enrolled}{b.capacity ? `/${b.capacity}` : ''})</span><Button size="sm" variant={on ? 'secondary' : 'primary'} loading={busy} onClick={() => void run(async () => { await C.enrol(b.id, enrol.id, !on); await load.reload() }, on ? 'Removed from batch.' : 'Enrolled.')}>{on ? 'Remove' : 'Enrol'}</Button></li>
        })}</ul>
        {load.data.batches.length === 0 && <p className="text-sm text-gray-600">Create a batch first.</p>}
      </Modal>}
    </div>
  )
}

export function Batches() {
  const nav = useNavigate()
  const [tab, setTab] = useState('Batches')
  const load = useLoad(async () => ({ ...(await C.batches()), ...(await C.teachers()), ...(await C.courses()), ...(await C.branches()) }), [])
  const [edit, setEdit] = useState<{ kind: 'batch' | 'course' | 'branch'; item: Batch | Record<string, unknown> | 'new' } | null>(null)
  const d = load.data
  return (
    <div className="space-y-4">
      <PageTitle title="Batches and courses" actions={<Button icon={<Plus size={16} />} onClick={() => setEdit({ kind: tab === 'Courses' ? 'course' : tab === 'Branches' ? 'branch' : 'batch', item: 'new' })}>Add {tab === 'Courses' ? 'course' : tab === 'Branches' ? 'branch' : 'batch'}</Button>} />
      <Tabs tabs={['Batches', 'Courses', 'Branches']} value={tab} onChange={setTab} />
      <Loaded load={load}>{(d) => (
        tab === 'Batches' ? (d.batches.length === 0 ? <Card><p className="text-sm text-gray-600">No batches yet. A batch is a group of students taught together; each gets its own classroom.</p></Card> : <div className="grid gap-3 md:grid-cols-2">{d.batches.map((b) => (
          <Card key={b.id}><div className="flex justify-between gap-2"><div><p className="font-semibold">{b.name}</p><p className="text-sm text-gray-600">{b.subject}{b.class_name ? ` · ${b.class_name}` : ''} · {b.teacher_name ?? 'No teacher'}</p><p className="text-sm">{[b.days, b.time_slot, b.room ? `Room ${b.room}` : ''].filter(Boolean).join(' · ')}</p><p className="text-sm">{b.enrolled}{b.capacity ? ` / ${b.capacity}` : ''} students · {taka(b.monthly_fee)}/month</p></div><Chip tone={b.status === 'active' ? 'green' : 'gray'}>{statusLabel(b.status)}</Chip></div>
            <div className="mt-2 flex gap-2"><Button size="sm" variant="secondary" onClick={() => setEdit({ kind: 'batch', item: b })}>Edit</Button>{b.classroom_id && <Button size="sm" variant="secondary" onClick={() => nav(`/app/coaching/classes/${b.classroom_id}`)}>Open classroom</Button>}</div></Card>))}</div>)
        : tab === 'Courses' ? (d.courses.length === 0 ? <Card><p className="text-sm text-gray-600">No courses yet.</p></Card> : <div className="grid gap-3 md:grid-cols-2">{d.courses.map((c) => <Card key={c.id}><p className="font-semibold">{c.name}</p><p className="text-sm text-gray-600">{c.subjects.join(', ')} · {taka(c.monthly_fee)}/month · {c.batches} batches</p>{c.description && <p className="text-sm">{c.description}</p>}<Button className="mt-2" size="sm" variant="secondary" onClick={() => setEdit({ kind: 'course', item: c })}>Edit</Button></Card>)}</div>)
        : (d.branches.length === 0 ? <Card><p className="text-sm text-gray-600">No branches. Add one if you teach at more than one location.</p></Card> : <div className="grid gap-3 md:grid-cols-2">{d.branches.map((b) => <Card key={b.id}><p className="font-semibold">{b.name}</p><p className="text-sm text-gray-600">{b.address}</p><Button className="mt-2" size="sm" variant="secondary" onClick={() => setEdit({ kind: 'branch', item: b })}>Edit</Button></Card>)}</div>)
      )}</Loaded>
      {edit && d && edit.kind === 'batch' && (() => { const b = edit.item === 'new' ? null : (edit.item as Batch)
        return <EditDialog title={b ? 'Edit batch' : 'Add batch'} initial={b ? { name: b.name, subject: b.subject, class_name: b.class_name ?? '', teacher_id: b.teacher_id ?? '', course_id: b.course_id ?? '', branch_id: b.branch_id ?? '', days: b.days ?? '', time_slot: b.time_slot ?? '', room: b.room ?? '', capacity: b.capacity ? String(b.capacity) : '', monthly_fee: b.monthly_fee != null ? String(b.monthly_fee) : '', status: b.status } : { status: 'active' }}
          fields={[{ key: 'name', label: 'Name' }, { key: 'subject', label: 'Subject', options: opts(SUBJECTS, 'Choose') }, { key: 'class_name', label: 'Class', options: opts(CLASSES, 'Choose') }, { key: 'teacher_id', label: 'Teacher', options: [{ value: '', label: 'None' }, ...d.teachers.map((t) => ({ value: t.id, label: t.name }))] }, { key: 'course_id', label: 'Course', options: [{ value: '', label: 'None' }, ...d.courses.map((c) => ({ value: c.id, label: c.name }))] }, { key: 'branch_id', label: 'Branch', options: [{ value: '', label: 'None' }, ...d.branches.map((c) => ({ value: c.id, label: c.name }))] }, { key: 'days', label: 'Days' }, { key: 'time_slot', label: 'Time' }, { key: 'room', label: 'Room' }, { key: 'capacity', label: 'Capacity', type: 'number' }, { key: 'monthly_fee', label: 'Monthly fee (৳)', type: 'number' }, { key: 'status', label: 'Status', options: opts(['active', 'closed']) }]}
          onSave={async (f) => { await C.saveBatch({ ...f, capacity: num(f.capacity), monthly_fee: num(f.monthly_fee) }, b?.id); await load.reload() }} onClose={() => setEdit(null)} /> })()}
      {edit && edit.kind === 'course' && (() => { const c = edit.item === 'new' ? null : (edit.item as { id: string; name: string; description?: string | null; subjects: string[]; monthly_fee?: number | null })
        return <EditDialog title={c ? 'Edit course' : 'Add course'} initial={c ? { name: c.name, description: c.description ?? '', subjects: c.subjects.join(', '), monthly_fee: c.monthly_fee != null ? String(c.monthly_fee) : '' } : {}} fields={[{ key: 'name', label: 'Name' }, { key: 'subjects', label: 'Subjects', hint: 'Separate with commas' }, { key: 'monthly_fee', label: 'Monthly fee (৳)', type: 'number' }, { key: 'description', label: 'Description', area: true }]}
          onSave={async (f) => { await C.saveCourse({ name: f.name, description: f.description, subjects: (f.subjects ?? '').split(',').map((x) => x.trim()).filter(Boolean), monthly_fee: num(f.monthly_fee) }, c?.id); await load.reload() }} onClose={() => setEdit(null)} /> })()}
      {edit && edit.kind === 'branch' && (() => { const b = edit.item === 'new' ? null : (edit.item as { id: string; name: string; address?: string | null })
        return <EditDialog title={b ? 'Edit branch' : 'Add branch'} initial={b ? { name: b.name, address: b.address ?? '' } : {}} fields={[{ key: 'name', label: 'Name' }, { key: 'address', label: 'Address' }]} onSave={async (f) => { await C.saveBranch(f, b?.id); await load.reload() }} onClose={() => setEdit(null)} /> })()}
    </div>
  )
}

export function Exams() {
  const { toast } = useStore()
  const load = useLoad(async () => ({ ...(await C.exams()), ...(await C.batches()) }), [])
  const [creating, setCreating] = useState(false)
  const [marking, setMarking] = useState<string | null>(null)
  return (
    <div className="space-y-4">
      <PageTitle title="Exams and results" sub="Enter marks, then publish. Students and guardians with linked accounts are notified; published results are locked." actions={<Button icon={<Plus size={16} />} onClick={() => setCreating(true)}>New exam</Button>} />
      <Loaded load={load} empty={(d) => d.exams.length ? null : { title: 'No exams yet', body: 'Create an exam for a batch.' }}>
        {(d) => <div className="space-y-3">{d.exams.map((x) => <Card key={x.id}><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-semibold">{x.title} · {x.batch_name}</p><p className="text-sm text-gray-600">{fmtDate(x.exam_date)} · out of {x.total_marks} · {x.marks_entered} marked{x.average != null ? ` · average ${Math.round(x.average * 10) / 10}` : ''}</p></div><div className="flex items-center gap-2">{x.published_at ? <Chip tone="green">Published</Chip> : <Chip tone="amber">Draft</Chip>}<Button size="sm" variant="secondary" onClick={() => setMarking(x.id)}>{x.published_at ? 'View marks' : 'Enter marks'}</Button></div></div></Card>)}</div>}
      </Loaded>
      {creating && load.data && <EditDialog title="New exam" initial={{ exam_date: new Date().toISOString().slice(0, 10) }} fields={[{ key: 'batch_id', label: 'Batch', options: [{ value: '', label: 'Choose' }, ...load.data.batches.map((b) => ({ value: b.id, label: b.name }))] }, { key: 'title', label: 'Title' }, { key: 'exam_date', label: 'Date', type: 'date' }, { key: 'total_marks', label: 'Total marks', type: 'number' }]}
        onSave={async (f) => { await C.createExam({ batch_id: f.batch_id, title: f.title, exam_date: f.exam_date, total_marks: Number(f.total_marks) }); await load.reload() }} onClose={() => setCreating(false)} />}
      {marking && <MarksDialog id={marking} published={!!load.data?.exams.find((x) => x.id === marking)?.published_at} total={load.data?.exams.find((x) => x.id === marking)?.total_marks ?? 0} onClose={() => { setMarking(null); void load.reload() }} toast={toast} />}
    </div>
  )
}

function MarksDialog({ id, published, total, onClose, toast }: { id: string; published: boolean; total: number; onClose: () => void; toast: (t: string, tone?: 'info' | 'success' | 'warning' | 'danger') => void }) {
  const load = useLoad(() => C.examMarks(id), [id])
  const [marks, setMarks] = useState<Record<string, string>>({})
  const { busy, run } = useAction(toast)
  const value = (sid: string, m?: number | null) => marks[sid] ?? (m != null ? String(m) : '')
  const save = (publish: boolean) => run(async () => { await C.saveMarks(id, Object.fromEntries(Object.entries(marks).map(([k, v]) => [k, v === '' ? null : Number(v)])), publish); onClose() }, publish ? 'Results published.' : 'Marks saved.')
  return (
    <Modal open onClose={onClose} title="Marks" footer={published ? <Button onClick={onClose}>Close</Button> : <><Button variant="secondary" loading={busy} onClick={() => void save(false)}>Save draft</Button><Button loading={busy} onClick={() => { if (window.confirm('Publish results? They cannot be changed afterwards.')) void save(true) }}>Publish</Button></>}>
      <Loaded load={load} empty={(d) => d.marks.length ? null : { title: 'No students in this batch', body: 'Enrol students first.' }}>
        {(d) => <ul className="divide-y divide-gray-100">{d.marks.map((m) => <li key={m.student_id} className="flex items-center justify-between gap-2 py-2 text-sm"><span>{m.name}</span>{published ? <strong>{m.marks ?? '—'} / {total}</strong> : <Input aria-label={`Marks for ${m.name}`} className="!w-24" type="number" min={0} max={total} value={value(m.student_id, m.marks)} onChange={(e) => setMarks({ ...marks, [m.student_id]: e.target.value })} />}</li>)}</ul>}
      </Loaded>
    </Modal>
  )
}

export function Fees() {
  const { toast } = useStore()
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const load = useLoad(() => C.fees(month), [month])
  const { busy, run } = useAction(toast)
  const due = load.data?.fees.filter((f) => f.status === 'due').reduce((a, f) => a + f.amount, 0) ?? 0
  const paid = load.data?.fees.filter((f) => f.status === 'paid').reduce((a, f) => a + f.amount, 0) ?? 0
  return (
    <div className="space-y-4">
      <PageTitle title="Fees" sub="Generate each month's fees from batch fees, then record payments. TuitionHub does not collect money." />
      <Card><div className="flex flex-wrap items-end gap-3"><Field label="Month">{(id) => <Input id={id} type="month" value={month} onChange={(e) => setMonth(e.target.value)} />}</Field><Button loading={busy} onClick={() => void run(async () => { const r = await C.generateFees(month); toast(`${r.created} fee record${r.created === 1 ? '' : 's'} created.`, 'success'); await load.reload() })}>Generate fees for {month}</Button></div></Card>
      <div className="grid gap-3 sm:grid-cols-2"><StatCard label="Collected" value={taka(paid)} /><StatCard label="Outstanding" value={taka(due)} /></div>
      <Loaded load={load} empty={(d) => d.fees.length ? null : { title: 'No fees for this month', body: 'Generate fees once students are enrolled in batches with a monthly fee.' }}>
        {(d) => <Card pad={false}><ul className="divide-y divide-gray-100">{d.fees.map((f) => <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm"><span>{f.student_name} · {taka(f.amount)}{f.reminded_at ? ` · reminded ${fmtDate(f.reminded_at)}` : ''}</span><span className="flex items-center gap-2"><Chip tone={f.status === 'paid' ? 'green' : f.status === 'waived' ? 'gray' : 'amber'}>{statusLabel(f.status)}</Chip>{f.status === 'due' && <><Button size="sm" loading={busy} onClick={() => void run(async () => { await C.feeAction(f.id, 'paid'); await load.reload() }, 'Marked paid.')}>Mark paid</Button><Button size="sm" variant="secondary" loading={busy} onClick={() => void run(async () => { await C.feeAction(f.id, 'remind'); await load.reload() }, 'Reminder sent to the guardian.')}>Remind</Button><Button size="sm" variant="tertiary" loading={busy} onClick={() => void run(async () => { await C.feeAction(f.id, 'waive'); await load.reload() }, 'Waived.')}>Waive</Button></>}</span></li>)}</ul></Card>}
      </Loaded>
    </div>
  )
}

export function Parents() {
  const load = useLoad(() => C.students(), [])
  return (
    <div className="space-y-4">
      <PageTitle title="Parents" sub="Guardian contacts from your student roster." />
      <Loaded load={load} empty={(d) => d.students.some((s) => s.guardian_name || s.guardian_phone) ? null : { title: 'No guardian details yet', body: 'Add guardian names and phones when admitting students.' }}>
        {(d) => <Card pad={false}><ul className="divide-y divide-gray-100">{d.students.filter((s) => s.guardian_name || s.guardian_phone).map((s) => <li key={s.id} className="flex flex-wrap justify-between gap-2 p-3 text-sm"><span className="font-medium">{s.guardian_name ?? 'Guardian'}</span><span>{s.guardian_phone ?? ''} · parent of {s.name}</span></li>)}</ul></Card>}
      </Loaded>
    </div>
  )
}

export function Reports() {
  const load = useLoad(() => C.report(), [])
  return (
    <div className="space-y-4">
      <PageTitle title="Reports" sub="Computed from your students, batches, attendance, exams and fees." />
      <Loaded load={load}>{(r) => (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Active students" value={String(r.students)} /><StatCard label="Teachers" value={String(r.teachers)} /><StatCard label="Active batches" value={String(r.batches)} />
            <StatCard label="Attendance" value={r.attendance_percent != null ? `${Math.round(r.attendance_percent)}%` : '—'} delta={`${r.attendance_marks} marks`} />
            <StatCard label="Fees collected" value={taka(r.fees_paid)} /><StatCard label="Fees outstanding" value={taka(r.fees_due)} />
            <StatCard label="Exams published" value={String(r.exams_published)} /><StatCard label="Average exam score" value={r.average_exam_percent != null ? `${Math.round(r.average_exam_percent)}%` : '—'} />
          </div>
          <Section title="Export"><Button variant="secondary" onClick={() => { const csv = Object.entries(r).map(([k, v]) => `${k},${v ?? ''}`).join('\n'); const url = URL.createObjectURL(new Blob([`metric,value\n${csv}`], { type: 'text/csv' })); const a = document.createElement('a'); a.href = url; a.download = 'coaching-report.csv'; a.click(); URL.revokeObjectURL(url) }}>Download CSV</Button></Section>
        </>
      )}</Loaded>
    </div>
  )
}
