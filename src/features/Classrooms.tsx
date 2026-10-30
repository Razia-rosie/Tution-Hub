import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { FileText, Link as LinkIcon, Plus } from 'lucide-react'
import { Button, Card, Chip, Field, Input, Modal, Select, Tabs, Textarea } from '../components/ui'
import { useStore } from '../lib/store'
import { platform, errMsg, fmtDate, fmtDateTime, type Assignment, type ClassroomDetail, type Mark } from '../lib/platform'
import { useAction, useLoad } from '../lib/useLoad'
import { Loaded, PageTitle, statusLabel } from './common'

export type ClassroomTab = 'Schedule' | 'Attendance' | 'Homework' | 'Materials' | 'Diary' | 'Students' | 'Progress'
const TABS: ClassroomTab[] = ['Schedule', 'Attendance', 'Homework', 'Materials', 'Diary', 'Students', 'Progress']
const toISO = (local: string) => new Date(local).toISOString()

/**
 * Classrooms the user teaches, attends or (as a guardian) monitors. The nav
 * slug picks the opening tab; `sub` is the open classroom's id.
 */
export default function Classrooms({ tab: initial, sub, basePath, title }: { tab: ClassroomTab; sub: string; basePath: string; title: string }) {
  const { user, toast } = useStore()
  const nav = useNavigate()
  const list = useLoad(() => platform.classrooms(), [])
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: '', subject: '' })
  const { busy, run } = useAction(toast)
  const openId = sub.split('/')[0]
  const canCreate = user?.role === 'tutor'
  // With a single classroom, open it directly.
  useEffect(() => {
    if (!openId && list.data?.classrooms.length === 1) nav(`${basePath}/${list.data.classrooms[0].id}`, { replace: true })
  }, [openId, list.data, basePath, nav])
  if (openId) return <Classroom id={openId} initial={initial} onBack={() => nav(basePath)} />
  return (
    <div className="space-y-4">
      <PageTitle title={title} sub={user?.role === 'parent' ? "Your linked children's classrooms." : 'Choose a classroom.'} actions={canCreate ? <Button icon={<Plus size={16} />} onClick={() => setCreating(true)}>New classroom</Button> : undefined} />
      <Loaded load={list} empty={(d) => d.classrooms.length ? null : { title: 'No classrooms yet', body: user?.role === 'tutor' ? 'A classroom is created when a tuition is confirmed, or create one yourself.' : user?.role === 'parent' ? 'Classrooms appear here once your linked child joins one.' : user?.role === 'coaching' ? 'Each batch has a classroom. Create a batch first.' : 'Your classrooms appear once a tuition is confirmed or a centre enrols you.' }}>
        {(d) => <div className="grid gap-3 md:grid-cols-2">{d.classrooms.map((c) => (
          <button key={`${c.id}-${c.child_name ?? ''}`} onClick={() => nav(`${basePath}/${c.id}`)} className="text-left"><Card>
            <p className="font-heading text-lg font-bold text-navy-900">{c.name}</p>
            <p className="text-sm text-gray-600">{c.owner_role === 'coaching' ? 'Centre' : 'Tutor'}: {c.owner_name}{c.child_name ? ` · ${c.child_name}` : ''}</p>
            <p className="mt-1 text-sm">{c.members} student{c.members === 1 ? '' : 's'} · {c.open_assignments} open assignment{c.open_assignments === 1 ? '' : 's'}</p>
            <p className="text-sm text-gray-600">Next class: {c.next_session ? fmtDateTime(c.next_session) : 'not scheduled'}</p>
            {c.archived && <Chip>Archived</Chip>}
          </Card></button>))}</div>}
      </Loaded>
      <Modal open={creating} onClose={() => setCreating(false)} title="New classroom" footer={<><Button variant="secondary" onClick={() => setCreating(false)}>Cancel</Button><Button loading={busy} disabled={!form.name.trim()} onClick={() => void run(async () => { const { id } = await platform.createClassroom(form); setCreating(false); nav(`${basePath}/${id}`) }, 'Classroom created.')}>Create</Button></>}>
        <div className="grid gap-3"><Field label="Name">{(id) => <Input id={id} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="HSC Physics evening group" />}</Field><Field label="Subject">{(id) => <Input id={id} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />}</Field></div>
      </Modal>
    </div>
  )
}

function Classroom({ id, initial, onBack }: { id: string; initial: ClassroomTab; onBack: () => void }) {
  const load = useLoad(() => platform.classroom(id), [id])
  const [tab, setTab] = useState<ClassroomTab>(initial)
  return (
    <div className="space-y-4">
      <button className="text-sm text-blue-600 hover:underline" onClick={onBack}>← All classrooms</button>
      <Loaded load={load}>{(c) => (
        <>
          <PageTitle title={c.name} sub={`${c.owner_role === 'coaching' ? 'Centre' : 'Tutor'}: ${c.owner_name} · ${c.members.length} student${c.members.length === 1 ? '' : 's'}${c.access === 'viewer' ? ' · view only' : ''}`} />
          <Tabs tabs={TABS} value={tab} onChange={(t) => setTab(t as ClassroomTab)} />
          <div className="mt-4">
            {tab === 'Schedule' && <ScheduleTab c={c} reload={load.reload} />}
            {tab === 'Attendance' && <AttendanceTab c={c} reload={load.reload} />}
            {tab === 'Homework' && <HomeworkTab c={c} reload={load.reload} />}
            {tab === 'Materials' && <MaterialsTab c={c} reload={load.reload} />}
            {tab === 'Diary' && <DiaryTab c={c} reload={load.reload} />}
            {tab === 'Students' && <StudentsTab c={c} reload={load.reload} />}
            {tab === 'Progress' && <ProgressTab c={c} />}
          </div>
        </>
      )}</Loaded>
    </div>
  )
}

type TabProps = { c: ClassroomDetail; reload: () => Promise<void> | void }

function ScheduleTab({ c, reload }: TabProps) {
  const { toast } = useStore()
  const { busy, run } = useAction(toast)
  const [form, setForm] = useState({ starts: '', ends: '', repeat: '0' })
  const now = Date.now()
  const upcoming = c.sessions.filter((s) => Date.parse(s.starts_at) >= now).sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))
  const past = c.sessions.filter((s) => Date.parse(s.starts_at) < now)
  const owner = c.access === 'owner'
  const status = (sid: string, s: string) => {
    let note = ''
    let next = ''
    if (s === 'cancelled') note = window.prompt('Reason (shown to students and guardians)') ?? ''
    if (s === 'rescheduled') { next = window.prompt('New date and time (YYYY-MM-DD HH:MM)') ?? ''; if (!next) return; next = new Date(next.replace(' ', 'T')).toISOString() }
    void run(async () => { await platform.setSession(sid, { status: s, note, new_starts_at: next || undefined }); await reload() }, `Class ${s}.`)
  }
  return (
    <div className="space-y-4">
      {owner && <Card><h2 className="text-lg">Schedule classes</h2><div className="mt-3 grid gap-3 sm:grid-cols-4 sm:items-end">
        <Field label="Starts">{(fid) => <Input id={fid} type="datetime-local" value={form.starts} onChange={(e) => setForm({ ...form, starts: e.target.value })} />}</Field>
        <Field label="Ends">{(fid) => <Input id={fid} type="datetime-local" value={form.ends} onChange={(e) => setForm({ ...form, ends: e.target.value })} />}</Field>
        <Field label="Repeat weekly for">{(fid) => <Select id={fid} value={form.repeat} onChange={(e) => setForm({ ...form, repeat: e.target.value })} options={[0, 3, 7, 11, 15, 25].map((n) => ({ value: String(n), label: n ? `${n} more weeks` : 'No repeat' }))} />}</Field>
        <Button loading={busy} disabled={!form.starts} onClick={() => void run(async () => { await platform.createSessions(c.id, { starts_at: toISO(form.starts), ends_at: form.ends ? toISO(form.ends) : undefined, repeat_weeks: Number(form.repeat) }); setForm({ starts: '', ends: '', repeat: '0' }); await reload() }, 'Classes scheduled. Students and guardians were notified.')}>Add</Button>
      </div></Card>}
      <Card><h2 className="text-lg">Upcoming</h2>{upcoming.length === 0 ? <p className="mt-2 text-sm text-gray-600">No upcoming classes.</p> : <ul className="mt-2 divide-y divide-gray-100">{upcoming.map((s) => (
        <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"><span>{fmtDateTime(s.starts_at)}{s.note ? ` · ${s.note}` : ''}</span><span className="flex items-center gap-2"><Chip tone={s.status === 'scheduled' ? 'blue' : 'gray'}>{statusLabel(s.status)}</Chip>{owner && s.status === 'scheduled' && <><Button size="sm" variant="tertiary" onClick={() => status(s.id, 'rescheduled')}>Reschedule</Button><Button size="sm" variant="tertiary" onClick={() => status(s.id, 'cancelled')}>Cancel</Button></>}</span></li>))}</ul>}</Card>
      {past.length > 0 && <Card><h2 className="text-lg">Past classes</h2><ul className="mt-2 divide-y divide-gray-100">{past.slice(0, 30).map((s) => <li key={s.id} className="flex justify-between py-2 text-sm"><span>{fmtDateTime(s.starts_at)}</span><Chip>{statusLabel(s.status)}</Chip></li>)}</ul></Card>}
    </div>
  )
}

function AttendanceTab({ c, reload }: TabProps) {
  const { toast } = useStore()
  const { busy, run } = useAction(toast)
  const owner = c.access === 'owner'
  const [sessionId, setSessionId] = useState(c.sessions.find((s) => s.status !== 'cancelled' && Date.parse(s.starts_at) <= Date.now() + 3600e3)?.id ?? '')
  // Batch classrooms take attendance against the coaching roster; tutor classrooms against members.
  const learners = useLoad(async () => {
    if (!owner) return []
    const batches = c.owner_role === 'coaching' ? (await platform.coaching.batches()).batches : []
    const batch = batches.find((b) => b.classroom_id === c.id)
    if (batch) return (await platform.coaching.learners(batch.id)).learners.map((l) => ({ kind: 'roster' as const, id: l.learner_id, name: l.name }))
    return c.members.map((m) => ({ kind: 'user' as const, id: m.id, name: m.name }))
  }, [c.id, owner])
  const session = c.sessions.find((s) => s.id === sessionId)
  const [marks, setMarks] = useState<Record<string, Mark['mark']>>({})
  useEffect(() => { setMarks(Object.fromEntries((session?.marks ?? []).map((m) => [m.learner_id, m.mark]))) }, [session])
  const counts = { present: 0, absent: 0, late: 0, excused: 0 }
  c.sessions.forEach((s) => s.marks.forEach((m) => { counts[m.mark]++ }))
  const total = counts.present + counts.absent + counts.late + counts.excused
  return (
    <div className="space-y-4">
      <Card><h2 className="text-lg">{owner ? 'Summary' : 'Attendance record'}</h2>
        <p className="mt-2 text-sm">{total ? `${Math.round(((counts.present + counts.late) / total) * 100)}% attended · ${counts.present} present · ${counts.late} late · ${counts.absent} absent · ${counts.excused} excused` : 'No attendance has been marked yet.'}</p>
        {!owner && <ul className="mt-3 divide-y divide-gray-100">{c.sessions.filter((s) => s.marks.length).map((s) => <li key={s.id} className="flex justify-between py-2 text-sm"><span>{fmtDateTime(s.starts_at)}</span><span>{s.marks.map((m) => <Chip key={m.learner_id} tone={m.mark === 'present' ? 'green' : m.mark === 'absent' ? 'red' : 'amber'}>{statusLabel(m.mark)}</Chip>)}</span></li>)}</ul>}
      </Card>
      {owner && <Card><h2 className="text-lg">Mark attendance</h2>
        {c.sessions.length === 0 ? <p className="mt-2 text-sm text-gray-600">Schedule a class first.</p> : <>
          <div className="mt-3 max-w-sm"><Field label="Class">{(fid) => <Select id={fid} value={sessionId} onChange={(e) => setSessionId(e.target.value)} options={[{ value: '', label: 'Choose a class' }, ...c.sessions.filter((s) => s.status !== 'cancelled').map((s) => ({ value: s.id, label: fmtDateTime(s.starts_at) }))]} />}</Field></div>
          {session && <Loaded load={learners} empty={(d) => d.length ? null : { title: 'No students in this class', body: 'Add students first.' }}>{(d) => (
            <><ul className="mt-3 divide-y divide-gray-100">{d.map((l) => <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><span className="font-medium">{l.name}</span><span className="flex gap-1">{(['present', 'late', 'absent', 'excused'] as const).map((m) => <button key={m} onClick={() => setMarks({ ...marks, [l.id]: m })} aria-pressed={marks[l.id] === m} className={`rounded-input border px-2 py-1 text-xs ${marks[l.id] === m ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300'}`}>{statusLabel(m)}</button>)}</span></li>)}</ul>
              <Button className="mt-3" loading={busy} disabled={!Object.keys(marks).length} onClick={() => void run(async () => { await platform.attendance(session.id, d.filter((l) => marks[l.id]).map((l) => ({ learner_kind: l.kind, learner_id: l.id, mark: marks[l.id] }))); await reload() }, 'Attendance saved. Guardians of absent students were notified.')}>Save attendance</Button></>
          )}</Loaded>}
        </>}
      </Card>}
    </div>
  )
}

function HomeworkTab({ c, reload }: TabProps) {
  const { toast } = useStore()
  const { busy, run } = useAction(toast)
  const owner = c.access === 'owner'
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ kind: 'homework', title: '', instructions: '', due: '', max: '' })
  const [open, setOpen] = useState<Assignment | null>(null)
  return (
    <div className="space-y-3">
      {owner && <Button icon={<Plus size={16} />} onClick={() => setCreating(true)}>New homework or assignment</Button>}
      {c.assignments.length === 0 && <Card><p className="text-sm text-gray-600">No homework yet.</p></Card>}
      {c.assignments.map((a) => {
        const overdue = Date.parse(a.due_at) < Date.now()
        return (
          <Card key={a.id}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><p className="font-semibold">{a.title} <Chip>{statusLabel(a.kind)}</Chip></p><p className="text-sm text-gray-600">Due {fmtDateTime(a.due_at)}{a.max_score ? ` · out of ${a.max_score}` : ''}</p>{a.instructions && <p className="mt-1 whitespace-pre-wrap text-sm">{a.instructions}</p>}</div>
              <div className="text-right text-sm">{c.access === 'member' ? (a.my_status ? <><Chip tone={a.my_status === 'reviewed' ? 'green' : a.my_status === 'revision' ? 'amber' : 'blue'}>{statusLabel(a.my_status)}</Chip>{a.my_score != null && <p className="mt-1 font-semibold">{a.my_score}{a.max_score ? ` / ${a.max_score}` : ''}</p>}</> : <Chip tone={overdue ? 'red' : 'amber'}>{overdue ? 'Missing' : 'Not submitted'}</Chip>) : <span>{a.submitted_count} submitted</span>}</div>
            </div>
            {c.access === 'member' && a.my_feedback && <p className="mt-2 rounded-input bg-gray-50 p-2 text-sm">Feedback: {a.my_feedback}</p>}
            <div className="mt-2">
              {c.access === 'member' && a.my_status !== 'reviewed' && <SubmitForm assignment={a} onDone={reload} />}
              {(owner || c.access === 'viewer') && <Button size="sm" variant="secondary" onClick={() => setOpen(a)}>{owner ? 'Review submissions' : 'View submissions'}</Button>}
            </div>
          </Card>
        )
      })}
      <Modal open={creating} onClose={() => setCreating(false)} title="New homework or assignment" footer={<><Button variant="secondary" onClick={() => setCreating(false)}>Cancel</Button><Button loading={busy} disabled={!form.title.trim() || !form.due} onClick={() => void run(async () => { await platform.createAssignment(c.id, { kind: form.kind, title: form.title, instructions: form.instructions, due_at: toISO(form.due), max_score: form.max ? Number(form.max) : null }); setCreating(false); setForm({ kind: 'homework', title: '', instructions: '', due: '', max: '' }); await reload() }, 'Published. Students and guardians were notified.')}>Publish</Button></>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Type">{(id) => <Select id={id} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} options={[{ value: 'homework', label: 'Homework' }, { value: 'assignment', label: 'Assignment' }]} />}</Field>
          <Field label="Title">{(id) => <Input id={id} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />}</Field>
          <Field label="Due">{(id) => <Input id={id} type="datetime-local" value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} />}</Field>
          <Field label="Out of (optional)">{(id) => <Input id={id} type="number" min={1} value={form.max} onChange={(e) => setForm({ ...form, max: e.target.value })} />}</Field>
          <div className="sm:col-span-2"><Field label="Instructions">{(id) => <Textarea id={id} value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} />}</Field></div>
        </div>
      </Modal>
      {open && <SubmissionsModal assignment={open} owner={owner} onClose={() => { setOpen(null); void reload() }} />}
    </div>
  )
}

function SubmitForm({ assignment, onDone }: { assignment: Assignment; onDone: () => Promise<void> | void }) {
  const { toast } = useStore()
  const [note, setNote] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    if (file && file.size > 10 * 1024 * 1024) { toast('Files must be 10 MB or smaller.', 'danger'); return }
    const form = new FormData()
    form.append('note', note)
    if (file) form.append('file', file)
    setBusy(true)
    try { await platform.submit(assignment.id, form); toast('Submitted.', 'success'); setNote(''); setFile(null); await onDone() } catch (e) { toast(errMsg(e), 'danger') } finally { setBusy(false) }
  }
  return (
    <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-end">
      <Field label={assignment.my_status ? 'Update your answer' : 'Your answer'}>{(id) => <Input id={id} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note for your teacher" />}</Field>
      <Field label="Attachment (picture or PDF)">{(id) => <Input id={id} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />}</Field>
      <Button loading={busy} disabled={!note.trim() && !file} onClick={() => void submit()}>Submit</Button>
    </div>
  )
}

function SubmissionsModal({ assignment, owner, onClose }: { assignment: Assignment; owner: boolean; onClose: () => void }) {
  const { toast } = useStore()
  const load = useLoad(() => platform.submissions(assignment.id), [assignment.id])
  const { busy, run } = useAction(toast)
  const [grades, setGrades] = useState<Record<string, { score: string; feedback: string }>>({})
  const openFile = async (id: string) => { try { const url = await platform.submissionUrl(id); window.open(url, '_blank', 'noopener'); setTimeout(() => URL.revokeObjectURL(url), 60_000) } catch (e) { toast(errMsg(e), 'danger') } }
  return (
    <Modal open onClose={onClose} title={`Submissions · ${assignment.title}`}>
      <Loaded load={load} empty={(d) => d.submissions.length ? null : { title: 'No submissions yet', body: 'Submissions appear here as students hand in work.' }}>
        {(d) => <ul className="space-y-3">{d.submissions.map((s) => {
          const g = grades[s.id] ?? { score: s.score != null ? String(s.score) : '', feedback: s.feedback ?? '' }
          return (
            <li key={s.id} className="rounded-input border border-gray-200 p-3 text-sm">
              <div className="flex flex-wrap justify-between gap-2"><p className="font-semibold">{s.student_name}</p><span className="flex gap-1">{s.late && <Chip tone="amber">Late</Chip>}<Chip tone={s.status === 'reviewed' ? 'green' : s.status === 'revision' ? 'amber' : 'blue'}>{statusLabel(s.status)}</Chip></span></div>
              <p className="text-xs text-gray-600">Submitted {fmtDateTime(s.submitted_at)}</p>
              {s.note && <p className="mt-1">{s.note}</p>}
              {s.file_name && <Button size="sm" variant="tertiary" icon={<FileText size={14} />} onClick={() => void openFile(s.id)}>{s.file_name}</Button>}
              {!owner && s.score != null && <p className="mt-1 font-semibold">Score: {s.score}{assignment.max_score ? ` / ${assignment.max_score}` : ''}</p>}
              {!owner && s.feedback && <p className="mt-1">Feedback: {s.feedback}</p>}
              {owner && <div className="mt-2 grid gap-2 sm:grid-cols-[120px_1fr]">
                <Input aria-label={`Score for ${s.student_name}`} type="number" min={0} max={assignment.max_score ?? undefined} value={g.score} onChange={(e) => setGrades({ ...grades, [s.id]: { ...g, score: e.target.value } })} placeholder="Score" />
                <Input aria-label={`Feedback for ${s.student_name}`} value={g.feedback} onChange={(e) => setGrades({ ...grades, [s.id]: { ...g, feedback: e.target.value } })} placeholder="Feedback" />
                <div className="flex gap-2 sm:col-span-2"><Button size="sm" loading={busy} onClick={() => void run(async () => { await platform.reviewSubmission(s.id, { score: g.score === '' ? null : Number(g.score), feedback: g.feedback, status: 'reviewed' }); await load.reload() }, 'Graded.')}>Save grade</Button><Button size="sm" variant="secondary" loading={busy} onClick={() => void run(async () => { await platform.reviewSubmission(s.id, { feedback: g.feedback, status: 'revision' }); await load.reload() }, 'Revision requested.')}>Ask for revision</Button></div>
              </div>}
            </li>
          )
        })}</ul>}
      </Loaded>
    </Modal>
  )
}

function MaterialsTab({ c, reload }: TabProps) {
  const { toast } = useStore()
  const owner = c.access === 'owner'
  const [form, setForm] = useState({ title: '', body: '', link: '' })
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const add = async () => {
    const f = new FormData()
    f.append('title', form.title); f.append('body', form.body); f.append('link_url', form.link)
    if (file) f.append('file', file)
    setBusy(true)
    try { await platform.addMaterial(c.id, f); toast('Material shared.', 'success'); setForm({ title: '', body: '', link: '' }); setFile(null); await reload() } catch (e) { toast(errMsg(e), 'danger') } finally { setBusy(false) }
  }
  const openFile = async (id: string) => { try { const url = await platform.materialUrl(id); window.open(url, '_blank', 'noopener'); setTimeout(() => URL.revokeObjectURL(url), 60_000) } catch (e) { toast(errMsg(e), 'danger') } }
  return (
    <div className="space-y-3">
      {owner && <Card><h2 className="text-lg">Share study material</h2><div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Title">{(id) => <Input id={id} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />}</Field>
        <Field label="Link (optional)">{(id) => <Input id={id} value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="https://" />}</Field>
        <Field label="Notes">{(id) => <Textarea id={id} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />}</Field>
        <Field label="File (picture or PDF, up to 10 MB)">{(id) => <Input id={id} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />}</Field>
      </div><Button className="mt-3" loading={busy} disabled={!form.title.trim()} onClick={() => void add()}>Share</Button></Card>}
      {c.materials.length === 0 ? <Card><p className="text-sm text-gray-600">No materials shared yet.</p></Card> : c.materials.map((m) => (
        <Card key={m.id}><p className="font-semibold">{m.title}</p><p className="text-xs text-gray-600">{fmtDate(m.created_at)}</p>{m.body && <p className="mt-1 whitespace-pre-wrap text-sm">{m.body}</p>}
          <div className="mt-2 flex flex-wrap gap-2">{m.link_url && <a className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline" href={m.link_url} target="_blank" rel="noopener noreferrer"><LinkIcon size={14} aria-hidden />Open link</a>}{m.file_name && <Button size="sm" variant="tertiary" icon={<FileText size={14} />} onClick={() => void openFile(m.id)}>{m.file_name}</Button>}</div></Card>))}
    </div>
  )
}

function DiaryTab({ c, reload }: TabProps) {
  const { toast } = useStore()
  const { busy, run } = useAction(toast)
  const owner = c.access === 'owner'
  const today = new Date().toISOString().slice(0, 10)
  const existing = c.diary.find((d) => d.entry_date.slice(0, 10) === today)
  const [form, setForm] = useState({ entry_date: today, topics: existing?.topics ?? '', homework: existing?.homework ?? '', note: existing?.note ?? '' })
  return (
    <div className="space-y-3">
      {owner && <Card><h2 className="text-lg">Daily diary</h2><div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Date">{(id) => <Input id={id} type="date" value={form.entry_date} onChange={(e) => { const d = c.diary.find((x) => x.entry_date.slice(0, 10) === e.target.value); setForm({ entry_date: e.target.value, topics: d?.topics ?? '', homework: d?.homework ?? '', note: d?.note ?? '' }) }} />}</Field>
        <Field label="Topics covered">{(id) => <Textarea id={id} value={form.topics} onChange={(e) => setForm({ ...form, topics: e.target.value })} />}</Field>
        <Field label="Homework given">{(id) => <Input id={id} value={form.homework} onChange={(e) => setForm({ ...form, homework: e.target.value })} />}</Field>
        <Field label="Note for guardians">{(id) => <Input id={id} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />}</Field>
      </div><Button className="mt-3" loading={busy} disabled={!form.topics.trim()} onClick={() => void run(async () => { await platform.diary(c.id, form); await reload() }, 'Diary saved.')}>Save entry</Button></Card>}
      {c.diary.length === 0 ? <Card><p className="text-sm text-gray-600">No diary entries yet.</p></Card> : c.diary.map((d) => (
        <Card key={d.id}><p className="font-semibold">{fmtDate(d.entry_date)}</p><p className="mt-1 whitespace-pre-wrap text-sm">{d.topics}</p>{d.homework && <p className="mt-1 text-sm"><span className="text-gray-600">Homework:</span> {d.homework}</p>}{d.note && <p className="mt-1 text-sm"><span className="text-gray-600">Note:</span> {d.note}</p>}</Card>))}
    </div>
  )
}

function StudentsTab({ c, reload }: TabProps) {
  const { toast } = useStore()
  const { busy, run } = useAction(toast)
  const [email, setEmail] = useState('')
  const owner = c.access === 'owner' && c.owner_role === 'tutor'
  return (
    <Card>
      <h2 className="text-lg">Students</h2>
      {c.members.length === 0 ? <p className="mt-2 text-sm text-gray-600">No students yet.</p> : <ul className="mt-2 divide-y divide-gray-100">{c.members.map((m) => <li key={m.id} className="flex items-center justify-between py-2 text-sm"><span>{m.name}{m.class_name ? ` · ${m.class_name}` : ''}</span>{owner && !c.engagement_id && <Button size="sm" variant="tertiary" onClick={() => { if (window.confirm(`Remove ${m.name} from this classroom?`)) void run(async () => { await platform.removeMember(c.id, m.id); await reload() }, 'Removed.') }}>Remove</Button>}</li>)}</ul>}
      {owner && <div className="mt-3 flex flex-wrap items-end gap-2"><Field label="Add a student by account email">{(id) => <Input id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />}</Field><Button loading={busy} disabled={!email.includes('@')} onClick={() => void run(async () => { await platform.addMember(c.id, email); setEmail(''); await reload() }, 'Student added.')}>Add</Button></div>}
      {c.owner_role === 'coaching' && c.access === 'owner' && <p className="mt-3 text-sm text-gray-600">Manage this batch's students from Students and Batches.</p>}
    </Card>
  )
}

function ProgressTab({ c }: { c: ClassroomDetail }) {
  const graded = c.assignments.filter((a) => a.max_score)
  if (c.access === 'member') {
    const mine = graded.filter((a) => a.my_score != null)
    const avg = mine.length ? Math.round(mine.reduce((s, a) => s + (a.my_score! / a.max_score!) * 100, 0) / mine.length) : null
    const marks = c.sessions.flatMap((s) => s.marks)
    const att = marks.length ? Math.round((marks.filter((m) => m.mark === 'present' || m.mark === 'late').length / marks.length) * 100) : null
    return <Card><h2 className="text-lg">Your progress</h2><dl className="mt-3 grid gap-3 sm:grid-cols-3 text-sm"><div><dt className="text-gray-600">Average score</dt><dd className="text-2xl font-bold">{avg != null ? `${avg}%` : '—'}</dd></div><div><dt className="text-gray-600">Attendance</dt><dd className="text-2xl font-bold">{att != null ? `${att}%` : '—'}</dd></div><div><dt className="text-gray-600">Work submitted</dt><dd className="text-2xl font-bold">{c.assignments.filter((a) => a.my_status).length} / {c.assignments.length}</dd></div></dl>
      <ul className="mt-4 divide-y divide-gray-100">{mine.map((a) => <li key={a.id} className="flex justify-between py-2 text-sm"><span>{a.title}</span><span className="font-semibold">{a.my_score} / {a.max_score}</span></li>)}</ul></Card>
  }
  return <MemberProgress c={c} />
}

function MemberProgress({ c }: { c: ClassroomDetail }) {
  const load = useLoad(() => Promise.all(c.members.map(async (m) => ({ m, p: await platform.progress(m.id).catch(() => null) }))), [c.id])
  return (
    <Card><h2 className="text-lg">Student progress</h2>
      <p className="text-xs text-gray-600">Across all of the student's classrooms.</p>
      <Loaded load={load} empty={(d) => d.length ? null : { title: 'No students', body: 'Progress appears once students join.' }}>
        {(d) => <ul className="mt-3 divide-y divide-gray-100">{d.map(({ m, p }) => <li key={m.id} className="flex flex-wrap justify-between gap-2 py-2 text-sm"><span className="font-medium">{m.name}</span>{p ? <span>Attendance {p.attendance_percent != null ? `${Math.round(p.attendance_percent)}%` : '—'} · Average {p.average_score_percent != null ? `${Math.round(p.average_score_percent)}%` : '—'} · {p.submitted}/{p.assigned} submitted</span> : <span className="text-gray-600">Visible to the student and their guardians</span>}</li>)}</ul>}
      </Loaded>
    </Card>
  )
}
