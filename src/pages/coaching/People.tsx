import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { FileSpreadsheet, MessageSquare, Plus, Trash2, Upload, UserPlus } from 'lucide-react'
import { maskEmail, validEmail, validPhone } from '../../lib/validate'
import { CLASS_LEVELS, MONTH, SUBJECT_LIST, batchStudents, examRows, fmtDay, fmtMoney, linkedParents, linkedStudents, maskParentPhone, startMin, studentAttendance, addNotif, type CStudent, type CParent, type Teacher } from '../../lib/coaching'
import { Avatar, Button, Card, Chip, DemoTag, EmptyState, Field, Input, Modal, PhoneInput, Select, btnClass } from '../../components/ui'
import { LockChip, Masked, PageHead } from '../../components/tutor/bits'
import { A, AddBtn, CheckRow, ConfirmModal, DataTable, Gate, NotFound, ReadOnlyBar, useCo, useOpenThread } from './kit'

const ph = (v: string) => maskParentPhone(v)
const tChip = (t: Teacher) => <Chip tone={t.status === 'active' ? 'green' : 'amber'}>{t.status === 'active' ? 'Active' : 'Invite sent'}</Chip>
const sChip = (s: CStudent) => <Chip tone={s.status === 'active' ? 'green' : 'gray'}>{s.status === 'active' ? 'Active' : 'Paused'}</Chip>
const feeOf = (fees: { studentId: string; month: string; state: string; amount: number }[], id: string) => fees.find((f) => f.studentId === id && f.month === MONTH)
const feeChip = (st?: string) => (st ? <Chip tone={st === 'paid' ? 'green' : st === 'due' ? 'amber' : 'red'}>{st === 'paid' ? 'Paid' : st === 'due' ? 'Due' : 'Overdue'}</Chip> : <span className="text-gray-600">No record</span>)

/* ---------------- Teachers ---------------- */
export function Teachers({ sub }: { sub: string }) {
  const [a] = sub.split('/').filter(Boolean)
  if (a === 'new') return <AddTeacher />
  if (a) return <TeacherDetail id={a} />
  return <TeacherList />
}

function TeacherList() {
  const { cj, set, w, toast } = useCo(); const [rm, setRm] = useState<Teacher | null>(null)
  const taught = (t: Teacher) => cj.batches.filter((b) => b.teacherId === t.id)
  return (
    <div>
      <PageHead title="Teachers" tag="CO-01" sub="People who teach in your organization. Contact details stay masked." actions={<AddBtn to="teachers/new" label="Add teacher" icon={<Plus size={16} aria-hidden />} />} />
      <ReadOnlyBar what="Adding and removing teachers" />
      <DataTable label="teachers" rows={cj.teachers} rowId={(t) => t.id} rowLabel={(t) => t.name}
        search={{ placeholder: 'Search by name or subject', text: (t) => `${t.name} ${t.subject}` }}
        filters={[{ label: 'Subject', options: [...new Set(cj.teachers.map((t) => t.subject))], test: (t, v) => t.subject === v }, { label: 'Status', options: ['Active', 'Invite sent'], test: (t, v) => (v === 'Active') === (t.status === 'active') }]}
        initialSort={{ key: 'name', dir: 1 }}
        cols={[
          { key: 'name', label: 'Teacher', primary: true, sort: (t) => t.name, cell: (t) => <Link to={`${A}/teachers/${t.id}`} className="flex items-center gap-3 font-semibold text-navy-900 hover:underline"><Avatar name={t.name} size={32} />{t.name}</Link> },
          { key: 'subject', label: 'Subject', sort: (t) => t.subject, cell: (t) => t.subject },
          { key: 'batches', label: 'Batches', sort: (t) => taught(t).length, cell: (t) => taught(t).length },
          { key: 'contact', label: 'Contact', cell: (t) => <Masked value={ph(t.phone)} /> },
          { key: 'rating', label: 'Rating', sort: (t) => t.rating, cell: (t) => t.rating.toFixed(1) },
          { key: 'status', label: 'Status', sort: (t) => t.status, cell: tChip },
        ]}
        actions={(t) => <><Link to={`${A}/teachers/${t.id}`} className={btnClass('secondary', 'sm')}>View</Link><Button size="sm" variant="tertiary" disabled={!w} onClick={() => setRm(t)} aria-label={`Remove ${t.name}`} icon={<Trash2 size={14} aria-hidden />}>Remove</Button></>}
        empty={<EmptyState title="No teachers yet" body="Add your first teacher. They get an invite and can then be assigned to batches." action={<AddBtn to="teachers/new" label="Add teacher" />} />} />
      <RemoveTeacher t={rm} onClose={() => setRm(null)} onDone={(t) => { set((c) => ({ teachers: c.teachers.filter((x) => x.id !== t.id), threads: c.threads.filter((x) => x.withId !== t.id) })); toast(`${t.name} was removed from your teachers`, 'success') }} />
    </div>
  )
}

function RemoveTeacher({ t, onClose, onDone }: { t: Teacher | null; onClose: () => void; onDone: (t: Teacher) => void }) {
  const { cj } = useCo(); const batches = t ? cj.batches.filter((b) => b.teacherId === t.id) : []
  return (
    <ConfirmModal open={!!t} title={`Remove ${t?.name ?? 'teacher'}?`} confirm="Remove teacher" disabled={batches.length > 0} onClose={onClose} onConfirm={() => t && onDone(t)}>
      {batches.length > 0
        ? <p>{t?.name} still teaches {batches.map((b) => b.name).join(', ')}. Open each batch and choose another teacher first. Then you can remove them.</p>
        : <p>This removes {t?.name} from your organization and closes their message thread. Past classes keep their record. You cannot undo this in the prototype.</p>}
    </ConfirmModal>
  )
}

function AddTeacher() {
  const { cj, set, toast } = useCo(); const nav = useNavigate()
  const [f, setF] = useState({ name: '', subject: SUBJECT_LIST[0], qual: '', phone: '', email: '' }); const [touched, setTouched] = useState(false)
  const p = (k: keyof typeof f, v: string) => setF({ ...f, [k]: v })
  const dup = cj.teachers.some((t) => t.phone === `0${f.phone}`)
  const err = {
    name: f.name.trim().split(/\s+/).length < 2 ? 'Enter first and last name.' : '',
    qual: f.qual.trim().length < 3 ? 'Enter a qualification, such as MSc, Dhaka University.' : '',
    phone: !validPhone(f.phone) ? 'Enter a valid mobile number (for example 17XXXXXXXX).' : dup ? 'A teacher with this phone number is already in your list.' : '',
    email: !validEmail(f.email) ? 'Enter a valid email address.' : '',
  }
  const e = (k: keyof typeof err) => (touched ? err[k] : '')
  const save = () => {
    setTouched(true); if (Object.values(err).some(Boolean)) return
    const id = `T-${cj.seq}`
    set((c) => ({ teachers: [...c.teachers, { id, name: f.name.trim(), subject: f.subject, qual: f.qual.trim(), phone: `0${f.phone}`, email: f.email.trim(), status: 'invited', rating: 0 }], seq: c.seq + 1 }))
    toast(`Invite sent to ${f.name.trim()} (Demo, no real message)`, 'success'); nav(`${A}/teachers/${id}`)
  }
  return (
    <div>
      <PageHead title="Add teacher" tag="CO-02" crumb={{ to: `${A}/teachers`, label: 'Teachers' }} sub="They receive an invite and appear as Invite sent until they accept." />
      <Gate what="Adding teachers"><Card className="max-w-3xl">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" error={e('name')}>{(id) => <Input id={id} value={f.name} onChange={(x) => p('name', x.target.value)} placeholder="Sabrina Akter" aria-invalid={!!e('name')} />}</Field>
          <Field label="Subject">{(id) => <Select id={id} value={f.subject} onChange={(x) => p('subject', x.target.value)} options={SUBJECT_LIST} />}</Field>
          <Field label="Qualification" error={e('qual')}>{(id) => <Input id={id} value={f.qual} onChange={(x) => p('qual', x.target.value)} placeholder="MSc, Dhaka University" aria-invalid={!!e('qual')} />}</Field>
          <Field label="Mobile number" error={e('phone')} hint="Shown masked everywhere after you save.">{(id) => <PhoneInput id={id} value={f.phone} onChange={(v) => p('phone', v)} />}</Field>
          <div className="sm:col-span-2"><Field label="Email" error={e('email')}>{(id) => <Input id={id} type="email" value={f.email} onChange={(x) => p('email', x.target.value)} placeholder="name@example.com" aria-invalid={!!e('email')} />}</Field></div>
        </div>
        <p className="mt-4 flex items-center gap-2 text-xs text-gray-600"><DemoTag /> No SMS or email is sent. The invite is simulated.</p>
        <div className="mt-6 flex flex-wrap gap-2"><Button onClick={save}>Add teacher and send invite</Button><Link to={`${A}/teachers`} className={btnClass('secondary')}>Cancel</Link></div>
      </Card></Gate>
    </div>
  )
}

function TeacherDetail({ id }: { id: string }) {
  const { cj, set, w, off, toast } = useCo(); const nav = useNavigate(); const open = useOpenThread()
  const t = cj.teachers.find((x) => x.id === id); const [rm, setRm] = useState(false)
  if (!t) return <NotFound what="Teacher" to="teachers" label="Back to teachers" />
  const batches = cj.batches.filter((b) => b.teacherId === t.id)
  const students = new Set(batches.flatMap((b) => batchStudents(cj, b.id).map((s) => s.id))).size
  const week = cj.classes.filter((c) => !c.cancelled && batches.some((b) => b.id === c.batchId) && c.day >= off && c.day < off + 7).length
  const upd = (p: Partial<Teacher>) => set((c) => ({ teachers: c.teachers.map((x) => (x.id === t.id ? { ...x, ...p } : x)) }))
  return (
    <div>
      <PageHead title={t.name} tag="CO-03" crumb={{ to: `${A}/teachers`, label: 'Teachers' }} sub={`${t.subject} · ${t.qual}`} actions={<>{tChip(t)}<Button variant="secondary" size="sm" disabled={!w} onClick={() => open(t.id, t.name, 'Teacher')} icon={<MessageSquare size={14} aria-hidden />}>Message</Button><Button variant="destructive" size="sm" disabled={!w} onClick={() => setRm(true)} icon={<Trash2 size={14} aria-hidden />}>Remove teacher</Button></>} />
      <ReadOnlyBar what="Changing teachers" />
      {t.status === 'invited' && (
        <Card className="mb-6 flex flex-wrap items-center gap-3 border-warning-600/40 bg-warning-100/50"><p className="min-w-0 flex-1 text-sm text-gray-600"><b className="text-navy-900">Invite sent, waiting for {t.name.split(' ')[0]}.</b> They cannot take classes until they accept.</p>
          <Button size="sm" variant="secondary" disabled={!w} onClick={() => toast(`Invite sent again to ${ph(t.phone)} (Demo, no real message)`, 'info')}>Resend invite</Button>
          <span className="inline-flex items-center gap-2"><DemoTag /><Button size="sm" disabled={!w} onClick={() => { upd({ status: 'active', rating: 4.5 }); set((c) => ({ notifs: addNotif(c, `${t.name} accepted the teacher invite.`, `teachers/${t.id}`, off) })); toast(`${t.name} accepted the invite`, 'success') }}>Simulate: invite accepted</Button></span></Card>)}
      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <Card>
          <div className="flex items-center gap-3"><Avatar name={t.name} size={56} /><div className="min-w-0"><p className="font-heading text-lg font-bold text-navy-900">{t.name}</p><p className="text-sm text-gray-600">{t.subject} teacher</p></div></div>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-gray-600">Qualification</dt><dd className="text-right text-charcoal-900">{t.qual}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-gray-600">Phone</dt><dd><Masked value={ph(t.phone)} /></dd></div>
            <div className="flex justify-between gap-3"><dt className="text-gray-600">Email</dt><dd className="min-w-0 break-all text-right"><Masked value={maskEmail(t.email)} /></dd></div>
            <div className="flex justify-between gap-3"><dt className="text-gray-600">Rating</dt><dd className="text-charcoal-900">{t.rating ? t.rating.toFixed(1) : 'Not rated yet'}</dd></div>
          </dl>
          <div className="mt-3"><LockChip>Full contact hidden</LockChip></div>
        </Card>
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-3 text-center">
            {[['Batches', batches.length], ['Students', students], ['Classes this week', week]].map(([l, v]) => <Card key={l as string} className="!p-4"><p className="font-heading text-2xl font-bold text-navy-900 tabular">{v}</p><p className="text-xs text-gray-600">{l}</p></Card>)}
          </div>
          <Card><h2 className="text-lg">Batches taught</h2>
            {batches.length === 0 ? <p className="mt-2 text-sm text-gray-600">Not teaching any batch yet. <Link to={`${A}/batches/new`} className="font-semibold text-blue-600 hover:underline">Create a batch</Link></p> : (
              <ul className="mt-2 divide-y divide-gray-100">{batches.map((b) => <li key={b.id}><Link to={`${A}/batches/${b.id}`} className="flex min-h-11 flex-wrap items-center justify-between gap-2 py-2 text-sm hover:underline"><b className="text-navy-900">{b.name}</b><span className="text-gray-600">{batchStudents(cj, b.id).length}/{b.cap} students · {b.room}</span></Link></li>)}</ul>)}
          </Card>
        </div>
      </div>
      <RemoveTeacher t={rm ? t : null} onClose={() => setRm(false)} onDone={() => { set((c) => ({ teachers: c.teachers.filter((x) => x.id !== t.id), threads: c.threads.filter((x) => x.withId !== t.id) })); toast(`${t.name} was removed from your teachers`, 'success'); nav(`${A}/teachers`) }} />
    </div>
  )
}

/* ---------------- Students ---------------- */
export function Students({ sub }: { sub: string }) {
  const [a] = sub.split('/').filter(Boolean)
  if (a === 'new') return <AddStudent />
  if (a === 'import') return <ImportStudents />
  if (a) return <StudentDetail id={a} />
  return <StudentList />
}

function StudentList() {
  const { cj, set, w, toast } = useCo(); const [rm, setRm] = useState<string[]>([])
  const pName = (id: string) => cj.parents.find((p) => p.id === id)?.name ?? ''
  const attPct = (s: CStudent) => studentAttendance(cj, s.id).pct
  const removeNow = (ids: string[]) => { set((c) => ({ students: c.students.filter((s) => !ids.includes(s.id)), fees: c.fees.filter((f) => !ids.includes(f.studentId)), homework: c.homework.map((h) => ({ ...h, sub: Object.fromEntries(Object.entries(h.sub).filter(([k]) => !ids.includes(k))) })) })); toast(`${ids.length} student${ids.length > 1 ? 's' : ''} removed`, 'success') }
  return (
    <div>
      <PageHead title="Students" tag="CO-04" sub="Everyone enrolled in your batches. Parent contact details are masked." actions={<><Link to={`${A}/students/import`} className={btnClass('secondary')}><Upload size={16} aria-hidden /> Bulk import</Link><AddBtn to="students/new" label="Add student" icon={<UserPlus size={16} aria-hidden />} /></>} />
      <ReadOnlyBar what="Adding, pausing and removing students" />
      <DataTable label="students" rows={cj.students} rowId={(s) => s.id} rowLabel={(s) => s.name} selectable pageSize={8}
        search={{ placeholder: 'Search by name or ID', text: (s) => `${s.name} ${s.id}` }}
        filters={[{ label: 'Class', options: CLASS_LEVELS, test: (s, v) => s.cls === v }, { label: 'Batch', options: cj.batches.map((b) => b.name), test: (s, v) => s.batchIds.some((b) => cj.batches.find((x) => x.id === b)?.name === v) }, { label: 'Status', options: ['Active', 'Paused'], test: (s, v) => (v === 'Active') === (s.status === 'active') }]}
        initialSort={{ key: 'name', dir: 1 }}
        cols={[
          { key: 'name', label: 'Student', primary: true, sort: (s) => s.name, cell: (s) => <Link to={`${A}/students/${s.id}`} className="flex items-center gap-3 font-semibold text-navy-900 hover:underline"><Avatar name={s.name} size={32} /><span className="min-w-0"><span className="block">{s.name}</span><span className="block text-xs font-normal text-gray-600">{s.id}</span></span></Link> },
          { key: 'cls', label: 'Class', sort: (s) => s.cls, cell: (s) => s.cls },
          { key: 'batches', label: 'Batches', sort: (s) => s.batchIds.length, cell: (s) => s.batchIds.length === 0 ? 'None' : `${cj.batches.find((b) => b.id === s.batchIds[0])?.name ?? ''}${s.batchIds.length > 1 ? ` +${s.batchIds.length - 1}` : ''}` },
          { key: 'parent', label: 'Parent', sort: (s) => pName(s.parentId), cell: (s) => pName(s.parentId) },
          { key: 'att', label: 'Attendance', sort: (s) => attPct(s) ?? -1, cell: (s) => (attPct(s) === null ? '—' : `${attPct(s)}%`) },
          { key: 'status', label: 'Status', sort: (s) => s.status, cell: sChip },
        ]}
        bulk={(ids, clear) => <>
          <Button size="sm" variant="secondary" disabled={!w} onClick={() => { set((c) => ({ students: c.students.map((s) => (ids.includes(s.id) ? { ...s, status: 'paused' as const } : s)) })); toast(`${ids.length} paused`, 'success'); clear() }}>Pause</Button>
          <Button size="sm" variant="secondary" disabled={!w} onClick={() => { set((c) => ({ students: c.students.map((s) => (ids.includes(s.id) ? { ...s, status: 'active' as const } : s)) })); toast(`${ids.length} set to active`, 'success'); clear() }}>Set active</Button>
          <Button size="sm" variant="destructive" disabled={!w} onClick={() => setRm(ids)}>Remove</Button></>}
        actions={(s) => <Link to={`${A}/students/${s.id}`} className={btnClass('secondary', 'sm')}>View</Link>}
        empty={<EmptyState title="No students yet" body="Add students one by one, or import a list. Each student is linked to a parent." action={<div className="flex flex-wrap justify-center gap-2"><AddBtn to="students/new" label="Add student" /><Link to={`${A}/students/import`} className={btnClass('secondary')}>Bulk import</Link></div>} />} />
      <ConfirmModal open={rm.length > 0} title={`Remove ${rm.length} student${rm.length > 1 ? 's' : ''}?`} confirm="Remove" onClose={() => setRm([])} onConfirm={() => removeNow(rm)}>
        <p>Their batch places, homework status and fee records are removed. A parent with no other child here leaves your directory. You cannot undo this in the prototype.</p>
      </ConfirmModal>
    </div>
  )
}

function AddStudent() {
  const { cj, set, off, toast } = useCo(); const nav = useNavigate()
  const [f, setF] = useState({ name: '', cls: CLASS_LEVELS[4], parentName: '', parentPhone: '', parentEmail: '' }); const [bs, setBs] = useState<string[]>([]); const [touched, setTouched] = useState(false)
  const existing = validPhone(f.parentPhone) ? cj.parents.find((p) => p.phone === `0${f.parentPhone}`) : undefined
  const err = {
    name: f.name.trim().split(/\s+/).length < 2 ? 'Enter first and last name.' : '',
    batches: bs.length ? '' : 'Choose at least one batch.',
    parentName: existing || f.parentName.trim().split(/\s+/).length >= 2 ? '' : 'Enter the parent or guardian full name.',
    parentPhone: validPhone(f.parentPhone) ? '' : 'Enter a valid mobile number (for example 17XXXXXXXX).',
    parentEmail: !f.parentEmail || validEmail(f.parentEmail) ? '' : 'Enter a valid email or leave it empty.',
  }
  const e = (k: keyof typeof err) => (touched ? err[k] : '')
  const save = () => {
    setTouched(true); if (Object.values(err).some(Boolean)) return
    const sid = `CS-${cj.seq}`; const pid = existing ? existing.id : `PR-${cj.seq}`
    set((c) => ({
      parents: existing ? c.parents : [...c.parents, { id: pid, name: f.parentName.trim(), phone: `0${f.parentPhone}`, email: f.parentEmail.trim() }],
      students: [...c.students, { id: sid, name: f.name.trim(), cls: f.cls, batchIds: bs, parentId: pid, joined: '2026-10-13', status: 'active' }],
      fees: [...c.fees, { id: `F-${c.seq}`, studentId: sid, month: MONTH, amount: 1500, state: 'due', reminded: null }],
      notifs: addNotif(c, `${f.name.trim()} was added to ${bs.length} batch${bs.length > 1 ? 'es' : ''}.`, `students/${sid}`, off), seq: c.seq + 1,
    }))
    toast(`${f.name.trim()} was added${existing ? ` and linked to ${existing.name}` : ''}`, 'success'); nav(`${A}/students/${sid}`)
  }
  return (
    <div>
      <PageHead title="Add student" tag="CO-05" crumb={{ to: `${A}/students`, label: 'Students' }} sub="Every student is linked to a parent or guardian. Their contact is masked after you save." />
      <Gate what="Adding students"><Card className="max-w-3xl">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Student full name" error={e('name')}>{(id) => <Input id={id} value={f.name} onChange={(x) => setF({ ...f, name: x.target.value })} placeholder="Ayaan Rahman" aria-invalid={!!e('name')} />}</Field>
          <Field label="Class">{(id) => <Select id={id} value={f.cls} onChange={(x) => setF({ ...f, cls: x.target.value })} options={CLASS_LEVELS} />}</Field>
        </div>
        <fieldset className="mt-4"><legend className="mb-1.5 text-sm font-medium text-charcoal-900">Batches</legend>
          <div className="grid gap-2 sm:grid-cols-2">{cj.batches.map((b) => { const n = batchStudents(cj, b.id).length; const full = n >= b.cap
            return <CheckRow key={b.id} label={b.name} hint={full ? 'Full' : `${n}/${b.cap}`} disabled={full} checked={bs.includes(b.id)} onChange={(v) => setBs(v ? [...bs, b.id] : bs.filter((x) => x !== b.id))} /> })}</div>
          {e('batches') && <p role="alert" className="mt-1.5 text-xs text-danger-600">{e('batches')}</p>}
          {cj.batches.length === 0 && <p className="mt-1.5 text-sm text-gray-600">No batches yet. <Link to={`${A}/batches/new`} className="font-semibold text-blue-600 hover:underline">Create a batch first</Link>.</p>}
        </fieldset>
        <h2 className="mt-6 text-lg">Parent or guardian</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field label="Parent mobile number" error={e('parentPhone')} hint="We link to an existing parent when the number matches.">{(id) => <PhoneInput id={id} value={f.parentPhone} onChange={(v) => setF({ ...f, parentPhone: v })} />}</Field>
          {existing
            ? <div className="rounded-input border border-teal-600/30 bg-success-100/60 p-3 text-sm"><p className="font-semibold text-navy-900">Linked to {existing.name}</p><p className="text-gray-600">Already in your directory: <Masked value={ph(existing.phone)} /></p></div>
            : <Field label="Parent full name" error={e('parentName')}>{(id) => <Input id={id} value={f.parentName} onChange={(x) => setF({ ...f, parentName: x.target.value })} placeholder="Mrs. Shirin Sultana" aria-invalid={!!e('parentName')} />}</Field>}
          {!existing && <div className="sm:col-span-2"><Field label="Parent email (optional)" error={e('parentEmail')}>{(id) => <Input id={id} type="email" value={f.parentEmail} onChange={(x) => setF({ ...f, parentEmail: x.target.value })} aria-invalid={!!e('parentEmail')} />}</Field></div>}
        </div>
        <p className="mt-4 flex items-center gap-2 text-xs text-gray-600"><DemoTag /> No invite is sent to the parent in this prototype. A first fee of {fmtMoney(1500)} is tracked as due.</p>
        <div className="mt-6 flex flex-wrap gap-2"><Button onClick={save}>Add student</Button><Link to={`${A}/students`} className={btnClass('secondary')}>Cancel</Link></div>
      </Card></Gate>
    </div>
  )
}

const SAMPLE = [
  { name: 'Tahsin Ahmed', cls: 'Class 10', batch: 'Class 10 Maths, Evening', pName: 'Mrs. Nilufa Yasmin', pPhone: '01711220011' },
  { name: 'Rumana Akter', cls: 'Class 10', batch: 'SSC Biology', pName: 'Mr. Habib Rahman', pPhone: '01811220022' },
  { name: 'Sakib Hasan', cls: 'HSC 1st year', batch: 'HSC Physics, Morning', pName: 'Mrs. Shirin Sultana', pPhone: '01711000101' },
  { name: 'Mitu Das', cls: 'Class 9', batch: 'Class 9 English', pName: 'Mrs. Rina Das', pPhone: '01911220044' },
  { name: 'Nayeem Islam', cls: 'Class 9', batch: 'Evening Art Club', pName: 'Mr. Alamgir Hossain', pPhone: '01611220055' },
  { name: 'Farin Jahan', cls: 'Class 10', batch: 'Class 10 Maths, Evening', pName: 'Mrs. Roksana Begum', pPhone: '017112200' },
]

function ImportStudents() {
  const { cj, set, off, toast } = useCo(); const nav = useNavigate(); const [loaded, setLoaded] = useState(false); const [done, setDone] = useState(false)
  const rows = SAMPLE.map((r, i) => {
    const b = cj.batches.find((x) => x.name === r.batch); const ok10 = /^01[3-9]\d{8}$/.test(r.pPhone)
    const dup = cj.students.some((s) => s.name === r.name)
    const full = b && batchStudents(cj, b.id).length >= b.cap
    const error = !b ? `Batch not found: ${r.batch}` : !ok10 ? 'Parent phone is not a valid mobile number' : dup ? 'Already in your students' : full ? 'Batch is full' : ''
    return { ...r, id: `row-${i}`, batchId: b?.id ?? '', error }
  })
  const valid = rows.filter((r) => !r.error)
  const run = () => {
    set((c) => {
      let seq = c.seq; const parents = [...c.parents]; const students = [...c.students]; const fees = [...c.fees]
      valid.forEach((r) => {
        let p = parents.find((x) => x.phone === r.pPhone)
        if (!p) { p = { id: `PR-${seq++}`, name: r.pName, phone: r.pPhone, email: '' }; parents.push(p) }
        const sid = `CS-${seq++}`; students.push({ id: sid, name: r.name, cls: r.cls, batchIds: [r.batchId], parentId: p.id, joined: '2026-10-13', status: 'active' })
        fees.push({ id: `F-${seq++}`, studentId: sid, month: MONTH, amount: 1500, state: 'due', reminded: null })
      })
      return { parents, students, fees, seq, notifs: addNotif(c, `${valid.length} students imported from a sample file (Demo).`, 'students', off) }
    })
    setDone(true); toast(`${valid.length} students imported (Demo file)`, 'success')
  }
  return (
    <div>
      <PageHead title="Bulk import students" tag="CO-06" crumb={{ to: `${A}/students`, label: 'Students' }} sub="Add many students at once from a spreadsheet. In this prototype you use a sample file." actions={<DemoTag label="Demo import" />} />
      <Gate what="Importing students"><div className="space-y-6">
        <Card>
          <div className="flex flex-wrap items-center gap-3">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-input bg-gray-100 text-gray-600"><FileSpreadsheet size={26} strokeWidth={1.5} aria-hidden /></span>
            <div className="min-w-[11rem] flex-1"><p className="text-sm font-semibold text-navy-900">{loaded ? 'sample-students.csv' : 'No file chosen'}</p>
              <p className="text-xs text-gray-600">{loaded ? `${rows.length} rows read · DEMO, no real file` : 'Columns: name, class, batch, parent name, parent phone. Nothing is uploaded.'}</p></div>
            {!done && <Button variant={loaded ? 'secondary' : 'primary'} onClick={() => setLoaded(!loaded)}>{loaded ? 'Remove sample file' : 'Use sample file'}</Button>}
          </div>
        </Card>
        {loaded && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600" role="status"><b className="text-navy-900">{valid.length} ready</b> to import, {rows.length - valid.length} with problems. Rows with problems are skipped.</p>
            <DataTable label="import rows" rows={rows} rowId={(r) => r.id} rowLabel={(r) => r.name} pageSize={10}
              filters={[{ label: 'Row status', options: ['Ready', 'Has a problem'], test: (r, v) => (v === 'Ready') === !r.error }]}
              cols={[
                { key: 'name', label: 'Student', primary: true, sort: (r) => r.name, cell: (r) => r.name },
                { key: 'cls', label: 'Class', cell: (r) => r.cls },
                { key: 'batch', label: 'Batch', cell: (r) => r.batch },
                { key: 'parent', label: 'Parent', cell: (r) => `${r.pName}` },
                { key: 'phone', label: 'Parent phone', cell: (r) => <Masked value={/^\d{11}$/.test(r.pPhone) ? ph(r.pPhone) : '•••• ••• •••'} /> },
                { key: 'st', label: 'Check', sort: (r) => (r.error ? 1 : 0), cell: (r) => (r.error ? <Chip tone="red">{r.error}</Chip> : <Chip tone="green">Ready</Chip>) },
              ]}
              empty={<EmptyState title="The file is empty" body="Choose a file with at least one row." />} />
            <div className="flex flex-wrap items-center gap-2">
              {done ? <><Link to={`${A}/students`} className={btnClass('primary')}>View students</Link><span className="text-sm text-gray-600">Import complete.</span></>
                : <><Button disabled={valid.length === 0} onClick={run}>Import {valid.length} valid row{valid.length === 1 ? '' : 's'}</Button><Button variant="secondary" onClick={() => nav(`${A}/students`)}>Cancel</Button></>}
            </div>
          </div>)}
      </div></Gate>
    </div>
  )
}

function StudentDetail({ id }: { id: string }) {
  const { cj, set, w, off, toast } = useCo(); const nav = useNavigate()
  const s = cj.students.find((x) => x.id === id); const [rm, setRm] = useState(false); const [ed, setEd] = useState(false); const [bs, setBs] = useState<string[]>([])
  if (!s) return <NotFound what="Student" to="students" label="Back to students" />
  const parent = cj.parents.find((p) => p.id === s.parentId); const att = studentAttendance(cj, s.id); const fee = feeOf(cj.fees, s.id)
  const results = cj.exams.filter((e) => e.published && e.batchId && s.batchIds.includes(e.batchId))
  const hw = cj.homework.filter((h) => s.batchIds.includes(h.batchId))
  const upd = (p: Partial<CStudent>) => set((c) => ({ students: c.students.map((x) => (x.id === s.id ? { ...x, ...p } : x)) }))
  return (
    <div>
      <PageHead title={s.name} tag="CO-07" crumb={{ to: `${A}/students`, label: 'Students' }} sub={`${s.id} · ${s.cls}`} actions={<>{sChip(s)}
        <Button size="sm" variant="secondary" disabled={!w} onClick={() => { setBs(s.batchIds); setEd(true) }}>Change batches</Button>
        <Button size="sm" variant="secondary" disabled={!w} onClick={() => { upd({ status: s.status === 'active' ? 'paused' : 'active' }); toast(s.status === 'active' ? `${s.name} paused` : `${s.name} is active again`, 'success') }}>{s.status === 'active' ? 'Pause student' : 'Resume student'}</Button>
        <Button size="sm" variant="destructive" disabled={!w} onClick={() => setRm(true)} icon={<Trash2 size={14} aria-hidden />}>Remove student</Button></>} />
      <ReadOnlyBar what="Changing students" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card><h2 className="text-lg">Enrolment</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-gray-600">Joined</dt><dd>{s.joined}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-gray-600">Batches</dt><dd className="flex flex-wrap justify-end gap-1">{s.batchIds.length ? s.batchIds.map((b) => <Link key={b} to={`${A}/batches/${b}`} className="rounded-input bg-blue-100 px-2 py-0.5 text-xs font-semibold text-navy-700 hover:underline">{cj.batches.find((x) => x.id === b)?.name}</Link>) : 'None'}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-gray-600">Fee, {MONTH}</dt><dd className="flex items-center gap-2">{fee ? fmtMoney(fee.amount) : ''} {feeChip(fee?.state)}</dd></div>
          </dl>
        </Card>
        <Card><h2 className="text-lg">Parent or guardian</h2>
          {parent ? <div className="mt-3 text-sm"><Link to={`${A}/parents/${parent.id}`} className="font-semibold text-navy-900 hover:underline">{parent.name}</Link>
            <p className="mt-1 text-gray-600"><Masked value={ph(parent.phone)} /> · <Masked value={parent.email ? maskEmail(parent.email) : 'No email'} /></p><div className="mt-2"><LockChip>Full contact hidden</LockChip></div></div> : <p className="mt-3 text-sm text-gray-600">No parent linked.</p>}
        </Card>
        <Card><h2 className="text-lg">Attendance</h2>
          {att.pct === null ? <p className="mt-3 text-sm text-gray-600">No classes marked yet.</p> : <>
            <p className="mt-2 font-heading text-3xl font-bold text-navy-900 tabular">{att.pct}%</p>
            <p className="text-sm text-gray-600">{att.present} present ({att.late} late), {att.absent} absent of {att.held} classes</p>
            {att.pct < 75 && <p className="mt-2"><Chip tone="amber">Low attendance</Chip></p>}</>}
        </Card>
        <Card><h2 className="text-lg">Published results</h2>
          {results.length === 0 ? <p className="mt-3 text-sm text-gray-600">No results published for this student's batches yet.</p> : (
            <ul className="mt-3 divide-y divide-gray-100 text-sm">{results.map((e) => { const r = examRows(cj, e).rows.find((x) => x.s.id === s.id); const m = r?.mark
              return <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><span>{e.title}</span><b className="tabular text-navy-900">{typeof m === 'number' ? `${m}/${e.total}` : 'Absent'}</b></li> })}</ul>)}
        </Card>
        <Card className="lg:col-span-2"><h2 className="text-lg">Homework</h2>
          {hw.length === 0 ? <p className="mt-3 text-sm text-gray-600">No homework for this student's batches.</p> : (
            <ul className="mt-3 divide-y divide-gray-100 text-sm">{hw.map((h) => <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><Link to={`${A}/homework/${h.id}`} className="hover:underline">{h.title}</Link><Chip tone={h.sub[s.id] === 'reviewed' ? 'green' : h.sub[s.id] ? 'blue' : h.due < off ? 'red' : 'amber'}>{h.sub[s.id] === 'reviewed' ? 'Reviewed' : h.sub[s.id] ? 'Submitted' : h.due < off ? 'Overdue' : `Due ${fmtDay(h.due)}`}</Chip></li>)}</ul>)}
        </Card>
      </div>
      <Modal open={ed} onClose={() => setEd(false)} title="Change batches" footer={<><Button variant="secondary" onClick={() => setEd(false)}>Cancel</Button><Button disabled={bs.length === 0} onClick={() => { upd({ batchIds: bs }); setEd(false); toast('Batches updated', 'success') }}>Save batches</Button></>}>
        <div className="space-y-2">{[...cj.batches].sort((a, b) => startMin(a.time) - startMin(b.time)).map((b) => { const n = batchStudents(cj, b.id).filter((x) => x.id !== s.id).length
          return <CheckRow key={b.id} label={b.name} hint={`${n}/${b.cap}`} disabled={n >= b.cap && !bs.includes(b.id)} checked={bs.includes(b.id)} onChange={(v) => setBs(v ? [...bs, b.id] : bs.filter((x) => x !== b.id))} /> })}
          {bs.length === 0 && <p role="alert" className="text-xs text-danger-600">Choose at least one batch.</p>}</div>
      </Modal>
      <ConfirmModal open={rm} title={`Remove ${s.name}?`} confirm="Remove student" onClose={() => setRm(false)} onConfirm={() => { set((c) => ({ students: c.students.filter((x) => x.id !== s.id), fees: c.fees.filter((f) => f.studentId !== s.id) })); toast(`${s.name} was removed`, 'success'); nav(`${A}/students`) }}>
        <p>This removes {s.name} from their batches and deletes their fee records. {parent && linkedStudents(cj, parent.id).length === 1 ? `${parent.name} will leave your parent directory because no other child is linked. ` : ''}You cannot undo this in the prototype.</p>
      </ConfirmModal>
    </div>
  )
}

/* ---------------- Parents ---------------- */
export function Parents({ sub }: { sub: string }) {
  const [a] = sub.split('/').filter(Boolean)
  return a ? <ParentDetail id={a} /> : <ParentList />
}

function ParentList() {
  const { cj, w } = useCo(); const open = useOpenThread(); const rows = linkedParents(cj)
  const kids = (p: CParent) => linkedStudents(cj, p.id)
  return (
    <div>
      <PageHead title="Parents" tag="CO-08" sub="Parents appear only with the students linked to your organization. Contact details are masked." />
      <DataTable label="parents" rows={rows} rowId={(p) => p.id} rowLabel={(p) => p.name}
        search={{ placeholder: 'Search by parent or student name', text: (p) => `${p.name} ${kids(p).map((k) => k.name).join(' ')}` }}
        filters={[{ label: 'Batch', options: cj.batches.map((b) => b.name), test: (p, v) => kids(p).some((k) => k.batchIds.some((b) => cj.batches.find((x) => x.id === b)?.name === v)) }]}
        initialSort={{ key: 'name', dir: 1 }}
        cols={[
          { key: 'name', label: 'Parent', primary: true, sort: (p) => p.name, cell: (p) => <Link to={`${A}/parents/${p.id}`} className="font-semibold text-navy-900 hover:underline">{p.name}</Link> },
          { key: 'kids', label: 'Linked students', sort: (p) => kids(p).length, cell: (p) => kids(p).map((k) => k.name).join(', ') },
          { key: 'phone', label: 'Phone', cell: (p) => <Masked value={ph(p.phone)} /> },
          { key: 'email', label: 'Email', cell: (p) => <Masked value={p.email ? maskEmail(p.email) : 'Not provided'} /> },
        ]}
        actions={(p) => <><Link to={`${A}/parents/${p.id}`} className={btnClass('secondary', 'sm')}>View</Link><Button size="sm" variant="tertiary" disabled={!w} onClick={() => open(p.id, p.name, 'Parent')} aria-label={`Message ${p.name}`}>Message</Button></>}
        empty={<EmptyState title="No parents yet" body="Parents appear here once you add a student and link a parent or guardian." action={<AddBtn to="students/new" label="Add student" />} />} />
      <p className="mt-4 flex items-center gap-2 text-xs text-gray-600"><DemoTag /> Full phone numbers and emails are never shown. Messages stay on TuitionHub.</p>
    </div>
  )
}

function ParentDetail({ id }: { id: string }) {
  const { cj, w, off } = useCo(); const open = useOpenThread()
  const p = cj.parents.find((x) => x.id === id); const kids = p ? linkedStudents(cj, p.id) : []
  if (!p || kids.length === 0) return <NotFound what="Parent" to="parents" label="Back to parents" />
  return (
    <div>
      <PageHead title={p.name} tag="CO-09" crumb={{ to: `${A}/parents`, label: 'Parents' }} sub="Parent or guardian of students in your organization" actions={<Button size="sm" disabled={!w} onClick={() => open(p.id, p.name, 'Parent')} icon={<MessageSquare size={14} aria-hidden />}>Send message</Button>} />
      <ReadOnlyBar what="Messaging parents" />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <Card><h2 className="text-lg">Contact</h2>
          <dl className="mt-3 space-y-2 text-sm"><div className="flex justify-between gap-3"><dt className="text-gray-600">Phone</dt><dd><Masked value={ph(p.phone)} /></dd></div>
            <div className="flex justify-between gap-3"><dt className="text-gray-600">Email</dt><dd className="min-w-0 break-all text-right"><Masked value={p.email ? maskEmail(p.email) : 'Not provided'} /></dd></div></dl>
          <div className="mt-3"><LockChip>Full contact hidden</LockChip></div>
          <p className="mt-3 text-xs text-gray-600">Use Messages to reach this parent. Phone numbers are not shared.</p>
        </Card>
        <Card><h2 className="text-lg">Linked students</h2>
          <ul className="mt-2 divide-y divide-gray-100">{kids.map((k) => { const a = studentAttendance(cj, k.id); const fee = feeOf(cj.fees, k.id)
            return <li key={k.id}><Link to={`${A}/students/${k.id}`} className="flex min-h-11 flex-wrap items-center gap-3 py-3 text-sm hover:bg-gray-100/60"><Avatar name={k.name} size={32} /><span className="min-w-0 flex-1"><b className="block text-navy-900">{k.name}</b><span className="text-gray-600">{k.cls} · {k.batchIds.map((b) => cj.batches.find((x) => x.id === b)?.name).join(', ')}</span></span>
              <span className="text-right text-xs text-gray-600">{a.pct === null ? 'No attendance yet' : `${a.pct}% attendance`}<span className="mt-1 block">{feeChip(fee?.state)}</span></span></Link></li> })}</ul>
          <p className="mt-2 text-xs text-gray-600">Today is {fmtDay(off, true)}. Only students linked to your organization are listed.</p>
        </Card>
      </div>
    </div>
  )
}
