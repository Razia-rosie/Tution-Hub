import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { CalendarPlus, ChevronLeft, ChevronRight, Plus, Trash2, UserPlus } from 'lucide-react'
import {
  AREAS, CLASS_LEVELS, DAY_SHORT, SUBJECT_LIST, TIME_SLOTS, addNotif, batchAttendance, batchStudents, dateOf, dayOfClass, fmtDay, overlaps, startMin, studentAttendance, seedClasses,
  type Batch, type CClass, type CJ,
} from '../../lib/coaching'
import { Avatar, Bar, Button, Card, Chip, EmptyState, Field, Input, Modal, Select, Stepper, Tabs, btnClass, cx } from '../../components/ui'
import { Masked, PageHead, StatLink } from '../../components/tutor/bits'
import { A, AddBtn, CheckRow, ConfirmModal, DataTable, DaySelect, Gate, NotFound, ReadOnlyBar, useCo, useMedia } from './kit'
import { counts } from '../../lib/coaching'

void AREAS
const tOf = (cj: CJ, b?: Batch) => cj.teachers.find((t) => t.id === b?.teacherId)
const bOf = (cj: CJ, id: string) => cj.batches.find((b) => b.id === id)
const sched = (b: Batch) => `${b.days.map((d) => DAY_SHORT[d]).join(', ')} · ${b.time}`

/* ---------------- Batches ---------------- */
export function Batches({ sub }: { sub: string }) {
  const [a] = sub.split('/').filter(Boolean)
  if (a === 'new') return <CreateBatch />
  if (a) return <BatchDetail id={a} />
  return <BatchList />
}

export const removeBatchPatch = (c: CJ, id: string): Partial<CJ> => {
  const cls = c.classes.filter((x) => x.batchId === id).map((x) => x.id)
  return {
    batches: c.batches.filter((b) => b.id !== id), classes: c.classes.filter((x) => x.batchId !== id),
    students: c.students.map((s) => ({ ...s, batchIds: s.batchIds.filter((b) => b !== id) })),
    homework: c.homework.filter((h) => h.batchId !== id), exams: c.exams.filter((e) => e.batchId !== id), reports: c.reports.filter((r) => r.batchId !== id),
    marks: Object.fromEntries(Object.entries(c.marks).filter(([k]) => !cls.includes(k))),
  }
}

function BatchList() {
  const { cj, set, w, toast } = useCo(); const [rm, setRm] = useState<Batch | null>(null)
  return (
    <div>
      <PageHead title="Batches" tag="CO-10" sub="Groups of students who learn one subject together with one teacher." actions={<AddBtn to="batches/new" label="Create batch" icon={<Plus size={16} aria-hidden />} />} />
      <ReadOnlyBar what="Creating and deleting batches" />
      <DataTable label="batches" rows={cj.batches} rowId={(b) => b.id} rowLabel={(b) => b.name}
        search={{ placeholder: 'Search by batch name', text: (b) => `${b.name} ${b.subject}` }}
        filters={[{ label: 'Subject', options: [...new Set(cj.batches.map((b) => b.subject))], test: (b, v) => b.subject === v }, { label: 'Teacher', options: [...new Set(cj.batches.map((b) => tOf(cj, b)?.name ?? ''))].filter(Boolean), test: (b, v) => tOf(cj, b)?.name === v }]}
        initialSort={{ key: 'name', dir: 1 }}
        cols={[
          { key: 'name', label: 'Batch', primary: true, sort: (b) => b.name, cell: (b) => <Link to={`${A}/batches/${b.id}`} className="font-semibold text-navy-900 hover:underline">{b.name}</Link> },
          { key: 'subject', label: 'Subject', sort: (b) => b.subject, cell: (b) => b.subject },
          { key: 'teacher', label: 'Teacher', sort: (b) => tOf(cj, b)?.name ?? '', cell: (b) => tOf(cj, b)?.name ?? 'Unassigned' },
          { key: 'when', label: 'Schedule', cell: (b) => sched(b) },
          { key: 'n', label: 'Students', sort: (b) => batchStudents(cj, b.id).length, cell: (b) => `${batchStudents(cj, b.id).length}/${b.cap}` },
        ]}
        actions={(b) => <><Link to={`${A}/batches/${b.id}`} className={btnClass('secondary', 'sm')}>View</Link><Button size="sm" variant="tertiary" disabled={!w} onClick={() => setRm(b)} aria-label={`Delete ${b.name}`} icon={<Trash2 size={14} aria-hidden />}>Delete</Button></>}
        empty={<EmptyState title="No batches yet" body="Create a batch, add students to it, then schedule its classes." action={<AddBtn to="batches/new" label="Create batch" />} />} />
      <DeleteBatch b={rm} onClose={() => setRm(null)} onDone={(b) => { set((c) => removeBatchPatch(c, b.id)); toast(`${b.name} was deleted`, 'success') }} />
    </div>
  )
}

function DeleteBatch({ b, onClose, onDone }: { b: Batch | null; onClose: () => void; onDone: (b: Batch) => void }) {
  const { cj } = useCo(); const n = b ? batchStudents(cj, b.id).length : 0
  return (
    <ConfirmModal open={!!b} title={`Delete ${b?.name ?? 'batch'}?`} confirm="Delete batch" onClose={onClose} onConfirm={() => b && onDone(b)}>
      <p>This deletes the batch, its scheduled classes, homework, exams and reports. {n} student{n === 1 ? '' : 's'} stay in your organization but leave this batch. You cannot undo this in the prototype.</p>
    </ConfirmModal>
  )
}

function CreateBatch() {
  const { cj, set, toast } = useCo(); const nav = useNavigate(); const active = cj.teachers.filter((t) => t.status === 'active')
  const [f, setF] = useState({ name: '', subject: SUBJECT_LIST[0], cls: CLASS_LEVELS[4], teacher: active[0]?.name ?? '', time: TIME_SLOTS[5], room: '', cap: 24 })
  const [days, setDays] = useState<number[]>([]); const [auto, setAuto] = useState(false); const [touched, setTouched] = useState(false)
  const err = {
    name: f.name.trim().length < 3 ? 'Enter a batch name (at least 3 characters).' : cj.batches.some((b) => b.name.toLowerCase() === f.name.trim().toLowerCase()) ? 'You already have a batch with this name.' : '',
    teacher: f.teacher ? '' : 'Choose an active teacher. Invited teachers can be assigned after they accept.',
    days: days.length ? '' : 'Choose at least one class day.',
    room: f.room.trim() ? '' : 'Enter a room, for example Room 2.',
  }
  const e = (k: keyof typeof err) => (touched ? err[k] : '')
  const save = () => {
    setTouched(true); if (Object.values(err).some(Boolean)) return
    const id = `B-${cj.seq}`; const t = active.find((x) => x.name === f.teacher)!
    const b: Batch = { id, name: f.name.trim(), subject: f.subject, cls: f.cls, teacherId: t.id, days: [...days].sort(), time: f.time, room: f.room.trim(), cap: f.cap }
    set((c) => ({ batches: [...c.batches, b], seq: c.seq + 1, classes: auto ? [...c.classes, ...seedClasses([b]).filter((x) => x.day >= 0).map((x) => ({ ...x, id: `${x.id}-${c.seq}` }))] : c.classes }))
    toast(`${b.name} was created${auto ? ' with 3 weeks of classes' : ''}`, 'success'); nav(`${A}/batches/${id}`)
  }
  return (
    <div>
      <PageHead title="Create batch" tag="CO-11" crumb={{ to: `${A}/batches`, label: 'Batches' }} sub="Set the subject, teacher, days and time. Add students after you save." />
      <Gate what="Creating batches"><Card className="max-w-3xl">
        {active.length === 0 && <p className="mb-4 rounded-input bg-warning-100 p-3 text-sm text-warning-600">No active teacher yet. <Link to={`${A}/teachers/new`} className="font-semibold underline">Add a teacher</Link> and have them accept the invite first.</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field label="Batch name" error={e('name')}>{(id) => <Input id={id} value={f.name} onChange={(x) => setF({ ...f, name: x.target.value })} placeholder="Class 8 Science, Morning" aria-invalid={!!e('name')} />}</Field></div>
          <Field label="Subject">{(id) => <Select id={id} value={f.subject} onChange={(x) => setF({ ...f, subject: x.target.value })} options={SUBJECT_LIST} />}</Field>
          <Field label="Class level">{(id) => <Select id={id} value={f.cls} onChange={(x) => setF({ ...f, cls: x.target.value })} options={CLASS_LEVELS} />}</Field>
          <Field label="Teacher" error={e('teacher')}>{(id) => <Select id={id} value={f.teacher} onChange={(x) => setF({ ...f, teacher: x.target.value })} options={active.map((t) => t.name)} />}</Field>
          <Field label="Time">{(id) => <Select id={id} value={f.time} onChange={(x) => setF({ ...f, time: x.target.value })} options={TIME_SLOTS} />}</Field>
          <Field label="Room" error={e('room')}>{(id) => <Input id={id} value={f.room} onChange={(x) => setF({ ...f, room: x.target.value })} placeholder="Room 2" aria-invalid={!!e('room')} />}</Field>
          <div><span className="mb-1.5 block text-sm font-medium text-charcoal-900">Capacity</span><Stepper label="Capacity" value={f.cap} min={5} max={60} onChange={(v) => setF({ ...f, cap: v })} /></div>
        </div>
        <fieldset className="mt-4"><legend className="mb-1.5 text-sm font-medium text-charcoal-900">Class days</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{DAY_SHORT.map((d, i) => <CheckRow key={d} label={d} checked={days.includes(i)} onChange={(v) => setDays(v ? [...days, i] : days.filter((x) => x !== i))} />)}</div>
          {e('days') && <p role="alert" className="mt-1.5 text-xs text-danger-600">{e('days')}</p>}
        </fieldset>
        <div className="mt-4"><CheckRow label="Also schedule the next 3 weeks of classes" checked={auto} onChange={setAuto} /></div>
        <div className="mt-6 flex flex-wrap gap-2"><Button onClick={save}>Create batch</Button><Link to={`${A}/batches`} className={btnClass('secondary')}>Cancel</Link></div>
      </Card></Gate>
    </div>
  )
}

function BatchDetail({ id }: { id: string }) {
  const { cj, set, w, off, toast } = useCo(); const nav = useNavigate()
  const b = bOf(cj, id); const [rm, setRm] = useState(false); const [add, setAdd] = useState(false); const [pick, setPick] = useState<string[]>([]); const [out, setOut] = useState<string | null>(null); const [tn, setTn] = useState('')
  if (!b) return <NotFound what="Batch" to="batches" label="Back to batches" />
  const t = tOf(cj, b); const st = batchStudents(cj, b.id); const free = b.cap - st.length
  const cands = cj.students.filter((s) => !s.batchIds.includes(b.id)); const att = batchAttendance(cj, b.id)
  const up = cj.classes.filter((c) => c.batchId === b.id && c.day >= off).sort((x, y) => x.day - y.day).slice(0, 4)
  const active = cj.teachers.filter((x) => x.status === 'active')
  return (
    <div>
      <PageHead title={b.name} tag="CO-12" crumb={{ to: `${A}/batches`, label: 'Batches' }} sub={`${b.subject} · ${b.cls} · ${sched(b)} · ${b.room}`} actions={<>
        <Link to={`${A}/classes/new?batch=${b.id}`} className={w ? btnClass('secondary', 'sm') : 'hidden'}><CalendarPlus size={14} aria-hidden /> Schedule class</Link>
        <Button size="sm" variant="destructive" disabled={!w} onClick={() => setRm(true)} icon={<Trash2 size={14} aria-hidden />}>Delete batch</Button></>} />
      <ReadOnlyBar what="Changing batches" />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[['Students', `${st.length}/${b.cap}`], ['Open places', String(free)], ['Classes held', String(att.held)], ['Attendance', att.pct === null ? '—' : `${att.pct}%`]].map(([l, v]) => <Card key={l} className="!p-4"><p className="font-heading text-2xl font-bold text-navy-900 tabular">{v}</p><p className="text-xs text-gray-600">{l}</p></Card>)}
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg">Students</h2><Button size="sm" disabled={!w || free <= 0} onClick={() => { setPick([]); setAdd(true) }} icon={<UserPlus size={14} aria-hidden />}>{free <= 0 ? 'Batch is full' : 'Add students'}</Button></div>
          {st.length === 0 ? <div className="mt-3"><EmptyState title="No students in this batch" body="Add existing students, or add a new student and choose this batch." /></div> : (
            <ul className="mt-2 divide-y divide-gray-100">{st.map((s) => <li key={s.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
              <Avatar name={s.name} size={32} /><Link to={`${A}/students/${s.id}`} className="min-w-0 flex-1 font-semibold text-navy-900 hover:underline">{s.name}<span className="block text-xs font-normal text-gray-600">{s.cls}{s.status === 'paused' ? ' · Paused' : ''}</span></Link>
              <Button size="sm" variant="tertiary" disabled={!w} onClick={() => setOut(s.id)} aria-label={`Remove ${s.name} from batch`}>Remove</Button></li>)}</ul>)}
        </Card>
        <div className="space-y-6">
          <Card><h2 className="text-lg">Teacher</h2>
            {t ? <div className="mt-3 flex items-center gap-3"><Avatar name={t.name} size={40} /><div className="min-w-0 flex-1"><Link to={`${A}/teachers/${t.id}`} className="font-semibold text-navy-900 hover:underline">{t.name}</Link><p className="text-xs text-gray-600">{t.subject} · <Masked value="Contact masked" /></p></div></div> : <p className="mt-3 text-sm text-gray-600">No teacher assigned.</p>}
            <div className="mt-4 flex flex-wrap items-end gap-2"><div className="min-w-[10rem] flex-1"><Field label="Change teacher">{(i) => <Select id={i} value={tn || t?.name || ''} onChange={(x) => setTn(x.target.value)} options={active.map((x) => x.name)} disabled={!w} />}</Field></div>
              <Button variant="secondary" disabled={!w || !tn || tn === t?.name} onClick={() => { const nt = active.find((x) => x.name === tn); if (!nt) return; set((c) => ({ batches: c.batches.map((x) => (x.id === b.id ? { ...x, teacherId: nt.id } : x)) })); toast(`${nt.name} now teaches ${b.name}`, 'success'); setTn('') }}>Save teacher</Button></div>
          </Card>
          <Card><h2 className="text-lg">Upcoming classes</h2>
            {up.length === 0 ? <p className="mt-3 text-sm text-gray-600">No upcoming classes. <Link to={`${A}/classes/new?batch=${b.id}`} className="font-semibold text-blue-600 hover:underline">Schedule one</Link></p> : (
              <ul className="mt-2 divide-y divide-gray-100">{up.map((c) => <li key={c.id}><Link to={`${A}/classes/${c.id}`} className="flex min-h-11 flex-wrap items-center justify-between gap-2 py-2 text-sm hover:underline"><span className={cx(c.cancelled && 'line-through')}>{fmtDay(c.day)}</span><span className="text-gray-600">{c.time} {c.cancelled && <Chip tone="red">Cancelled</Chip>}</span></Link></li>)}</ul>)}
          </Card>
        </div>
      </div>
      <Modal open={add} onClose={() => setAdd(false)} title="Add students to this batch" footer={<><Button variant="secondary" onClick={() => setAdd(false)}>Cancel</Button><Button disabled={pick.length === 0} onClick={() => { set((c) => ({ students: c.students.map((s) => (pick.includes(s.id) ? { ...s, batchIds: [...s.batchIds, b.id] } : s)) })); setAdd(false); toast(`${pick.length} student${pick.length > 1 ? 's' : ''} added to ${b.name}`, 'success') }}>Add {pick.length || ''} selected</Button></>}>
        {cands.length === 0 ? <p>Every student is already in this batch.</p> : <div className="max-h-64 space-y-2 overflow-y-auto">
          <p className="text-xs">{free} place{free === 1 ? '' : 's'} open.</p>
          {cands.map((s) => <CheckRow key={s.id} label={s.name} hint={s.cls} checked={pick.includes(s.id)} disabled={!pick.includes(s.id) && pick.length >= free} onChange={(v) => setPick(v ? [...pick, s.id] : pick.filter((x) => x !== s.id))} />)}</div>}
      </Modal>
      <ConfirmModal open={!!out} title="Remove from batch?" confirm="Remove from batch" onClose={() => setOut(null)} onConfirm={() => { set((c) => ({ students: c.students.map((s) => (s.id === out ? { ...s, batchIds: s.batchIds.filter((x) => x !== b.id) } : s)) })); toast('Student removed from the batch', 'success') }}>
        <p>{cj.students.find((s) => s.id === out)?.name} stays in your organization but will no longer appear in this batch's classes, homework or exams.</p>
      </ConfirmModal>
      <DeleteBatch b={rm ? b : null} onClose={() => setRm(false)} onDone={() => { set((c) => removeBatchPatch(c, b.id)); toast(`${b.name} was deleted`, 'success'); nav(`${A}/batches`) }} />
    </div>
  )
}

/* ---------------- Classes ---------------- */
const conflict = (cj: CJ, c: { batchId: string; day: number; time: string; room: string }, selfId?: string) => {
  const b = bOf(cj, c.batchId)
  for (const o of cj.classes) {
    if (o.id === selfId || o.cancelled || o.day !== c.day || !overlaps(o.time, c.time)) continue
    const ob = bOf(cj, o.batchId)
    if (ob && b && ob.teacherId === b.teacherId) return `${tOf(cj, b)?.name ?? 'The teacher'} already teaches ${ob.name} at this time (${fmtDay(c.day)}).`
    if (o.room.toLowerCase() === c.room.toLowerCase()) return `${c.room} is already used by ${ob?.name ?? 'another batch'} at this time (${fmtDay(c.day)}).`
  }
  return ''
}

export function Classes({ sub }: { sub: string }) {
  const [a] = sub.split('/').filter(Boolean)
  if (a === 'new') return <ScheduleClass />
  if (a) return <ClassDetail id={a} />
  return <Calendar />
}

function Calendar() {
  const { cj, off } = useCo(); const [wk, setWk] = useState(0); const [bf, setBf] = useState('All batches'); const wide = useMedia('(min-width: 1024px)')
  const start = off - dayOfClass(off) + wk * 7; const days = Array.from({ length: 7 }, (_, i) => start + i)
  const list = (d: number) => cj.classes.filter((c) => c.day === d && (bf === 'All batches' || bOf(cj, c.batchId)?.name === bf)).sort((a, b) => startMin(a.time) - startMin(b.time))
  const total = days.reduce((n, d) => n + list(d).filter((c) => !c.cancelled).length, 0)
  const range = `${dateOf(start).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} to ${dateOf(start + 6).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
  const card = (c: CClass) => { const b = bOf(cj, c.batchId); return (
    <Link key={c.id} to={`${A}/classes/${c.id}`} className={cx('block rounded-input border p-2 text-xs transition hover:shadow-card', c.cancelled ? 'border-danger-600/30 bg-danger-100/60' : c.day < off ? 'border-gray-200 bg-gray-100' : 'border-blue-600/30 bg-blue-100/60')}>
      <b className={cx('block text-navy-900', c.cancelled && 'line-through')}>{b?.name}</b><span className="block text-gray-600">{c.time}</span><span className="block text-gray-600">{c.room}{c.cancelled ? ' · Cancelled' : cj.marks[c.id] ? ' · Marked' : ''}</span>
    </Link>) }
  return (
    <div>
      <PageHead title="Classes" tag="CO-13" sub="The weekly schedule for every batch. Select a class to edit, reschedule or cancel it." actions={<AddBtn to="classes/new" label="Schedule class" icon={<CalendarPlus size={16} aria-hidden />} />} />
      <ReadOnlyBar what="Scheduling, rescheduling and cancelling classes" />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" onClick={() => setWk(wk - 1)} aria-label="Previous week" icon={<ChevronLeft size={16} aria-hidden />}>Previous</Button>
        <Button size="sm" variant="secondary" onClick={() => setWk(0)} disabled={wk === 0}>This week</Button>
        <Button size="sm" variant="secondary" onClick={() => setWk(wk + 1)} aria-label="Next week">Next<ChevronRight size={16} aria-hidden /></Button>
        <h2 className="ml-1 text-base" aria-live="polite">{range} <span className="font-body text-sm font-normal text-gray-600">· {total} class{total === 1 ? '' : 'es'}</span></h2>
        <div className="ml-auto"><Select aria-label="Filter by batch" value={bf} onChange={(e) => setBf(e.target.value)} options={['All batches', ...cj.batches.map((b) => b.name)]} className="w-auto max-w-[14rem]" /></div>
      </div>
      {cj.batches.length === 0 ? <EmptyState title="No batches to schedule" body="Create a batch first, then schedule its classes." action={<AddBtn to="batches/new" label="Create batch" />} /> : wide ? (
        <div className="grid grid-cols-7 gap-2">{days.map((d) => <div key={d} className={cx('min-w-0 rounded-card border bg-white p-2', d === off ? 'border-blue-600' : 'border-gray-200')}>
          <p className={cx('mb-2 text-xs font-semibold', d === off ? 'text-blue-600' : 'text-gray-600')}>{DAY_SHORT[dayOfClass(d)]} {dateOf(d).getDate()}{d === off ? ' · Today' : ''}</p>
          <div className="space-y-2">{list(d).length ? list(d).map(card) : <p className="text-xs text-gray-400">No classes</p>}</div></div>)}</div>
      ) : (
        <div className="space-y-3">{days.map((d) => <Card key={d} className={cx('!p-4', d === off && 'border-blue-600')}><h3 className="text-sm">{fmtDay(d)}{d === off && <span className="ml-2 text-blue-600">Today</span>}</h3>
          <div className="mt-2 space-y-2">{list(d).length ? list(d).map(card) : <p className="text-sm text-gray-600">No classes</p>}</div></Card>)}</div>)}
    </div>
  )
}

function ScheduleClass() {
  const { cj, set, off, toast } = useCo(); const nav = useNavigate(); const [qs] = useSearchParams()
  const first = cj.batches.find((b) => b.id === qs.get('batch')) ?? cj.batches[0]
  const [f, setF] = useState({ batchId: first?.id ?? '', day: off, time: first?.time ?? TIME_SLOTS[0], room: first?.room ?? '' }); const [rep, setRep] = useState(1); const [touched, setTouched] = useState(false)
  const picks = Array.from({ length: rep }, (_, i) => ({ ...f, day: f.day + i * 7 }))
  const c1 = picks.map((p) => conflict(cj, p)).find(Boolean) ?? ''
  const err = { room: f.room.trim() ? '' : 'Enter a room.', conflict: c1, batch: f.batchId ? '' : 'Create a batch first.' }
  const save = () => {
    setTouched(true); if (Object.values(err).some(Boolean)) return
    const ids = picks.map((_, i) => `C-${cj.seq}-${i}`)
    set((c) => ({ classes: [...c.classes, ...picks.map((p, i) => ({ id: ids[i], batchId: p.batchId, day: p.day, time: p.time, room: p.room.trim() }))], seq: c.seq + 1, notifs: addNotif(c, `${rep} class${rep > 1 ? 'es' : ''} scheduled for ${bOf(c, f.batchId)?.name}.`, 'classes', off) }))
    toast(`${rep} class${rep > 1 ? 'es' : ''} scheduled for ${bOf(cj, f.batchId)?.name}`, 'success'); nav(`${A}/classes/${ids[0]}`)
  }
  return (
    <div>
      <PageHead title="Schedule class" tag="CO-14" crumb={{ to: `${A}/classes`, label: 'Classes' }} sub="Pick a batch, a day and a time. Repeat weekly to add several at once." />
      <Gate what="Scheduling classes"><Card className="max-w-3xl">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Batch" error={touched ? err.batch : ''}>{(id) => <Select id={id} value={bOf(cj, f.batchId)?.name ?? ''} onChange={(x) => { const b = cj.batches.find((y) => y.name === x.target.value); if (b) setF({ ...f, batchId: b.id, time: b.time, room: b.room }) }} options={cj.batches.map((b) => b.name)} />}</Field>
          <Field label="Date">{(id) => <DaySelect id={id} value={f.day} onChange={(d) => setF({ ...f, day: d })} from={off} to={off + 27} />}</Field>
          <Field label="Time">{(id) => <Select id={id} value={f.time} onChange={(x) => setF({ ...f, time: x.target.value })} options={TIME_SLOTS} />}</Field>
          <Field label="Room" error={touched ? err.room : ''}>{(id) => <Input id={id} value={f.room} onChange={(x) => setF({ ...f, room: x.target.value })} aria-invalid={touched && !!err.room} />}</Field>
          <div><span className="mb-1.5 block text-sm font-medium text-charcoal-900">Repeat weekly</span><Stepper label="Number of weekly classes" value={rep} min={1} max={8} onChange={setRep} /><p className="mt-1 text-xs text-gray-600">{rep === 1 ? 'One class only' : `${rep} classes, one a week from ${fmtDay(f.day)}`}</p></div>
        </div>
        {touched && err.conflict && <p role="alert" className="mt-4 rounded-input bg-danger-100 p-3 text-sm text-danger-600">{err.conflict} Choose another time or room.</p>}
        <div className="mt-6 flex flex-wrap gap-2"><Button onClick={save}>Schedule {rep > 1 ? `${rep} classes` : 'class'}</Button><Link to={`${A}/classes`} className={btnClass('secondary')}>Cancel</Link></div>
      </Card></Gate>
    </div>
  )
}

const REASONS = ['Teacher unavailable', 'Public holiday', 'Low enrolment', 'Other']
function ClassDetail({ id }: { id: string }) {
  const { cj, set, w, off, toast } = useCo(); const c = cj.classes.find((x) => x.id === id)
  const [f, setF] = useState({ day: c?.day ?? 0, time: c?.time ?? '', room: c?.room ?? '' }); const [touched, setTouched] = useState(false); const [cancel, setCancel] = useState(false); const [reason, setReason] = useState(REASONS[0])
  if (!c) return <NotFound what="Class" to="classes" label="Back to the calendar" />
  const b = bOf(cj, c.batchId); const past = c.day < off; const m = cj.marks[c.id]; const cnt = m ? Object.values(m) : []
  const cf = conflict(cj, { batchId: c.batchId, ...f }, c.id); const changed = f.day !== c.day || f.time !== c.time || f.room !== c.room
  const save = () => {
    setTouched(true); if (cf || !f.room.trim() || !changed) return
    set((x) => ({ classes: x.classes.map((k) => (k.id === c.id ? { ...k, day: f.day, time: f.time, room: f.room.trim() } : k)), notifs: addNotif(x, `${b?.name} moved to ${fmtDay(f.day)}, ${f.time}.`, `classes/${c.id}`, off) }))
    toast(`Class rescheduled to ${fmtDay(f.day)}, ${f.time} (parents notified, Demo)`, 'success'); setTouched(false)
  }
  return (
    <div>
      <PageHead title={b?.name ?? 'Class'} tag="CO-15" crumb={{ to: `${A}/classes`, label: 'Classes' }} sub={`${fmtDay(c.day, true)} · ${c.time} · ${c.room}`} actions={<>{c.cancelled ? <Chip tone="red">Cancelled</Chip> : past ? <Chip tone="gray">Held</Chip> : <Chip tone="blue">Scheduled</Chip>}
        {!c.cancelled && c.day <= off && <Link to={`${A}/attendance/${c.id}`} className={w ? btnClass('primary', 'sm') : 'hidden'}>{m ? 'Edit attendance' : 'Mark attendance'}</Link>}</>} />
      <ReadOnlyBar what="Editing and cancelling classes" />
      {c.cancelled && <Card className="mb-6 flex flex-wrap items-center gap-3 border-danger-600/30 bg-danger-100/60"><p className="min-w-0 flex-1 text-sm text-gray-600"><b className="text-navy-900">This class is cancelled.</b> Reason: {c.reason}. Parents were told (Demo).</p>
        {!past && <Button size="sm" variant="secondary" disabled={!w} onClick={() => { set((x) => ({ classes: x.classes.map((k) => (k.id === c.id ? { ...k, cancelled: false, reason: undefined } : k)) })); toast('Class restored', 'success') }}>Restore class</Button>}</Card>}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card><h2 className="text-lg">Reschedule</h2>
          {past || c.cancelled ? <p className="mt-3 text-sm text-gray-600">{c.cancelled ? 'Restore the class to change its time.' : 'Past classes cannot be moved. You can still edit attendance.'}</p> : (
            <div className="mt-3 space-y-4">
              <Field label="Date">{(i) => <DaySelect id={i} value={f.day} onChange={(d) => setF({ ...f, day: d })} from={off} to={off + 27} />}</Field>
              <Field label="Time">{(i) => <Select id={i} value={f.time} onChange={(x) => setF({ ...f, time: x.target.value })} options={TIME_SLOTS.includes(f.time) ? TIME_SLOTS : [f.time, ...TIME_SLOTS]} />}</Field>
              <Field label="Room" error={touched && !f.room.trim() ? 'Enter a room.' : ''}>{(i) => <Input id={i} value={f.room} onChange={(x) => setF({ ...f, room: x.target.value })} />}</Field>
              {touched && cf && <p role="alert" className="rounded-input bg-danger-100 p-3 text-sm text-danger-600">{cf} Choose another time or room.</p>}
              <div className="flex flex-wrap gap-2"><Button disabled={!w || !changed} onClick={save}>Save changes</Button><Button variant="destructive" disabled={!w} onClick={() => setCancel(true)}>Cancel class</Button></div>
            </div>)}
        </Card>
        <Card><h2 className="text-lg">Details</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-gray-600">Batch</dt><dd><Link to={`${A}/batches/${c.batchId}`} className="font-semibold text-blue-600 hover:underline">{b?.name}</Link></dd></div>
            <div className="flex justify-between gap-3"><dt className="text-gray-600">Teacher</dt><dd>{tOf(cj, b)?.name ?? 'Unassigned'}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-gray-600">Students</dt><dd>{b ? batchStudents(cj, b.id).length : 0}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-gray-600">Attendance</dt><dd>{m ? `${cnt.filter((v) => v !== 'absent').length} present, ${cnt.filter((v) => v === 'absent').length} absent` : c.cancelled ? 'Not needed' : c.day <= off ? 'Not marked yet' : 'After the class'}</dd></div>
          </dl>
        </Card>
      </div>
      <Modal open={cancel} onClose={() => setCancel(false)} title="Cancel this class?" footer={<><Button variant="secondary" onClick={() => setCancel(false)}>Keep class</Button><Button variant="destructive" onClick={() => { set((x) => ({ classes: x.classes.map((k) => (k.id === c.id ? { ...k, cancelled: true, reason } : k)), notifs: addNotif(x, `${b?.name} on ${fmtDay(c.day)} was cancelled.`, `classes/${c.id}`, off) })); setCancel(false); toast('Class cancelled. Parents were told (Demo, no real message).', 'success') }}>Cancel class</Button></>}>
        <p>{b?.name}, {fmtDay(c.day, true)}. Parents see the change in their schedule. No SMS is sent in this prototype.</p>
        <div className="mt-4"><Field label="Reason">{(i) => <Select id={i} value={reason} onChange={(x) => setReason(x.target.value)} options={REASONS} />}</Field></div>
      </Modal>
    </div>
  )
}

/* ---------------- Attendance ---------------- */
export function Attendance({ sub }: { sub: string }) {
  const [a] = sub.split('/').filter(Boolean)
  return a ? <MarkAttendance id={a} /> : <AttendanceHome />
}

function AttendanceHome() {
  const { cj, off } = useCo(); const [tab, setTab] = useState('Mark attendance'); const c = counts(cj, off)
  const due = cj.classes.filter((k) => !k.cancelled && k.day <= off && k.day >= off - 7)
  const rows = due.map((k) => ({ ...k, b: bOf(cj, k.batchId) })).sort((a, b) => b.day - a.day || startMin(a.time) - startMin(b.time))
  const sRows = cj.students.map((s) => ({ s, ...studentAttendance(cj, s.id) }))
  const bRows = cj.batches.map((b) => ({ b, ...batchAttendance(cj, b.id), n: batchStudents(cj, b.id).length }))
  return (
    <div>
      <PageHead title="Attendance" tag="CO-16" sub="Mark each class by batch, then read the summaries." />
      <ReadOnlyBar what="Marking attendance" />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatLink to={`${A}/attendance`} label="Overall attendance" value={c.attendance === null ? '—' : `${c.attendance}%`} sub="All marked classes" icon={<span />} />
        <StatLink to={`${A}/attendance`} label="Classes to mark" value={String(c.unmarked)} sub="Last 3 days" icon={<span />} tone={c.unmarked ? 'amber' : 'teal'} />
        <StatLink to={`${A}/classes`} label="Classes today" value={String(c.classesToday)} sub="Open the calendar" icon={<span />} />
      </div>
      <Tabs tabs={['Mark attendance', 'Summary by batch', 'Summary by student']} value={tab} onChange={setTab} />
      <div className="mt-4" role="tabpanel">
        {tab === 'Mark attendance' && <DataTable label="classes to mark" rows={rows} rowId={(r) => r.id} rowLabel={(r) => `${r.b?.name} ${fmtDay(r.day)}`}
          filters={[{ label: 'Batch', options: cj.batches.map((b) => b.name), test: (r, v) => r.b?.name === v }, { label: 'Marking status', options: ['To mark', 'Marked'], test: (r, v) => (v === 'Marked') === !!cj.marks[r.id] }]}
          cols={[
            { key: 'day', label: 'Date', primary: true, sort: (r) => r.day, cell: (r) => <span className="font-semibold text-navy-900">{fmtDay(r.day)}{r.day === off && ' (today)'}</span> },
            { key: 'time', label: 'Time', sort: (r) => startMin(r.time), cell: (r) => r.time },
            { key: 'batch', label: 'Batch', sort: (r) => r.b?.name ?? '', cell: (r) => r.b?.name },
            { key: 'n', label: 'Students', cell: (r) => (r.b ? batchStudents(cj, r.b.id).length : 0) },
            { key: 'st', label: 'Status', sort: (r) => (cj.marks[r.id] ? 1 : 0), cell: (r) => (cj.marks[r.id] ? <Chip tone="green">Marked</Chip> : <Chip tone="amber">To mark</Chip>) },
          ]}
          actions={(r) => <Link to={`${A}/attendance/${r.id}`} className={btnClass(cj.marks[r.id] ? 'secondary' : 'primary', 'sm')}>{cj.marks[r.id] ? 'Edit' : 'Mark'}<span className="sr-only"> {r.b?.name} {fmtDay(r.day)}</span></Link>}
          empty={<EmptyState title="No classes to mark" body="Classes appear here on the day they are held. Schedule a class for today to try it." action={<AddBtn to="classes/new" label="Schedule class" />} />} />}
        {tab === 'Summary by batch' && <DataTable label="batch attendance" rows={bRows} rowId={(r) => r.b.id} rowLabel={(r) => r.b.name} initialSort={{ key: 'pct', dir: 1 }}
          cols={[
            { key: 'batch', label: 'Batch', primary: true, sort: (r) => r.b.name, cell: (r) => <Link to={`${A}/batches/${r.b.id}`} className="font-semibold text-navy-900 hover:underline">{r.b.name}</Link> },
            { key: 'n', label: 'Students', sort: (r) => r.n, cell: (r) => r.n },
            { key: 'held', label: 'Classes held', sort: (r) => r.held, cell: (r) => r.held },
            { key: 'abs', label: 'Absences', sort: (r) => r.absences, cell: (r) => r.absences },
            { key: 'pct', label: 'Attendance', sort: (r) => r.pct ?? -1, cell: (r) => (r.pct === null ? '—' : <div className="min-w-[8rem]"><Bar value={r.pct} label="" tone="teal" /></div>) },
          ]} empty={<EmptyState title="No batches yet" body="Create a batch to see attendance." />} />}
        {tab === 'Summary by student' && <DataTable label="student attendance" rows={sRows} rowId={(r) => r.s.id} rowLabel={(r) => r.s.name} initialSort={{ key: 'pct', dir: 1 }}
          search={{ placeholder: 'Search students', text: (r) => r.s.name }}
          filters={[{ label: 'Batch', options: cj.batches.map((b) => b.name), test: (r, v) => r.s.batchIds.some((x) => bOf(cj, x)?.name === v) }, { label: 'Flag', options: ['Low attendance (under 75%)'], test: (r) => r.pct !== null && r.pct < 75 }]}
          cols={[
            { key: 's', label: 'Student', primary: true, sort: (r) => r.s.name, cell: (r) => <Link to={`${A}/students/${r.s.id}`} className="font-semibold text-navy-900 hover:underline">{r.s.name}</Link> },
            { key: 'present', label: 'Present', sort: (r) => r.present, cell: (r) => r.present },
            { key: 'late', label: 'Late', sort: (r) => r.late, cell: (r) => r.late },
            { key: 'absent', label: 'Absent', sort: (r) => r.absent, cell: (r) => r.absent },
            { key: 'pct', label: 'Attendance', sort: (r) => r.pct ?? -1, cell: (r) => (r.pct === null ? '—' : <span className="inline-flex items-center gap-2">{r.pct}%{r.pct < 75 && <Chip tone="amber">Low</Chip>}</span>) },
          ]} empty={<EmptyState title="No students yet" body="Add students to see attendance." action={<AddBtn to="students/new" label="Add student" />} />} />}
      </div>
    </div>
  )
}

type Mk = 'present' | 'absent' | 'late'
function MarkAttendance({ id }: { id: string }) {
  const { cj, set, w, off, toast } = useCo(); const nav = useNavigate(); const c = cj.classes.find((x) => x.id === id)
  const b = c ? bOf(cj, c.batchId) : undefined; const st = c ? batchStudents(cj, c.batchId).filter((s) => s.status === 'active') : []
  const [draft, setDraft] = useState<Record<string, Mk>>(() => ({ ...Object.fromEntries(st.map((s) => [s.id, 'present' as Mk])), ...(c ? cj.marks[c.id] ?? {} : {}) }))
  if (!c || !b) return <NotFound what="Class" to="attendance" label="Back to attendance" />
  const vals = st.map((s) => draft[s.id] ?? 'present'); const n = (k: Mk) => vals.filter((v) => v === k).length
  const blocked = c.cancelled ? 'This class was cancelled, so there is nothing to mark.' : c.day > off ? `This class is on ${fmtDay(c.day, true)}. You can mark attendance on the class day.` : ''
  const save = () => { set((x) => ({ marks: { ...x.marks, [c.id]: Object.fromEntries(st.map((s) => [s.id, draft[s.id] ?? 'present'])) } })); toast(`Attendance saved: ${n('present')} present, ${n('late')} late, ${n('absent')} absent`, 'success'); nav(`${A}/attendance`) }
  return (
    <div>
      <PageHead title={`Mark attendance`} tag="CO-17" crumb={{ to: `${A}/attendance`, label: 'Attendance' }} sub={`${b.name} · ${fmtDay(c.day, true)} · ${c.time}`} />
      <ReadOnlyBar what="Marking attendance" />
      {blocked ? <EmptyState title="Attendance is not open" body={blocked} action={<Link to={`${A}/attendance`} className={btnClass('secondary')}>Back to attendance</Link>} /> : st.length === 0 ? <EmptyState title="No active students in this batch" body="Add students to the batch to mark attendance." action={<Link to={`${A}/batches/${b.id}`} className={btnClass('secondary')}>Open batch</Link>} /> : (
        <Card pad={false}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 p-4">
            <p className="text-sm text-gray-600" role="status"><b className="text-navy-900">{n('present')}</b> present · <b className="text-navy-900">{n('late')}</b> late · <b className="text-navy-900">{n('absent')}</b> absent</p>
            <Button size="sm" variant="secondary" disabled={!w} onClick={() => setDraft(Object.fromEntries(st.map((s) => [s.id, 'present'])))}>Mark all present</Button>
          </div>
          <ul className="divide-y divide-gray-100">{st.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 p-4"><Avatar name={s.name} size={32} /><span className="min-w-[8rem] flex-1 text-sm font-semibold text-navy-900">{s.name}</span>
              <div role="radiogroup" aria-label={`${s.name} attendance`} className="inline-flex overflow-hidden rounded-input border border-gray-400">
                {(['present', 'late', 'absent'] as Mk[]).map((k) => { const on = (draft[s.id] ?? 'present') === k
                  return <button key={k} type="button" role="radio" aria-checked={on} disabled={!w} onClick={() => setDraft({ ...draft, [s.id]: k })} className={cx('min-h-11 min-w-[4.5rem] px-3 text-sm font-semibold capitalize md:min-h-9', on ? (k === 'absent' ? 'bg-danger-600 text-white' : k === 'late' ? 'bg-warning-600 text-white' : 'bg-teal-700 text-white') : 'bg-white text-gray-600 hover:bg-gray-100')}>{k}</button> })}
              </div></li>))}</ul>
          <div className="flex flex-wrap gap-2 border-t border-gray-100 p-4"><Button disabled={!w} onClick={save}>Save attendance</Button><Link to={`${A}/attendance`} className={btnClass('secondary')}>Cancel</Link></div>
        </Card>)}
    </div>
  )
}
