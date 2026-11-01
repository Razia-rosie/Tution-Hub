import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { Camera } from 'lucide-react'
import { Button, Card, Chip, Field, Input, Select, StatCard, Textarea } from '../components/ui'
import { useStore } from '../lib/store'
import { FamilySummary } from '../components/FamilyVerification'
import { getWorkflowDashboard, updateProfile } from '../lib/api'
import { platform, errMsg, fmtDate, fmtDateTime, taka } from '../lib/platform'
import { useAction, useLoad } from '../lib/useLoad'
import { CLASSES, Loaded, MEDIUMS, PageTitle, Section, Stars, UserPhoto, opts, statusLabel } from './common'

const list = (v: string) => v.split(',').map((x) => x.trim()).filter(Boolean)
const joined = (v: unknown) => (Array.isArray(v) ? v.join(', ') : '')

// ---------- profile (all roles) ----------

/** Real profile editing backed by /workflow/profile, plus profile photo. */
export function Profile() {
  const { user, toast } = useStore()
  const role = user?.role
  const load = useLoad(() => getWorkflowDashboard(), [])
  const [form, setForm] = useState<Record<string, string>>({})
  const [listed, setListed] = useState(true)
  const { busy, run } = useAction(toast)
  const [photoKey, setPhotoKey] = useState(0)
  useEffect(() => {
    const p = load.data?.profile as Record<string, unknown> | null | undefined
    if (!p) return
    const s = (k: string) => (p[k] == null ? '' : Array.isArray(p[k]) ? joined(p[k]) : String(p[k]))
    setForm({ bio: s('bio'), institution: s('institution'), education: s('education'), current_study: s('current_study'), results: s('results'), subjects: s('subjects'), classes: s('classes'), areas: s('areas'), mediums: s('mediums'), teaching_modes: s('teaching_modes'), experience_years: s('experience_years'), fee_expectation: s('fee_expectation'), class_name: s('class_name'), opening_hours: s('opening_hours'), established: s('established'), address: s('address'), district: s('district'), gender: s('gender') })
    setListed(p.listed !== false && p.listed !== 0)
  }, [load.data])
  const set = (k: string) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value })
  const appStatus = load.data?.verification?.status
  // Fields an administrator is reviewing are locked while the application is pending.
  const locked = (role === 'tutor' || role === 'coaching') && (appStatus === 'pending' || appStatus === 'under_review')
  const save = () => run(async () => {
    const body: Record<string, unknown> = {}
    const text = ['bio', 'current_study', 'results', 'class_name', 'opening_hours', 'established', 'address', 'district', 'gender']
    const arrays = ['mediums', 'teaching_modes']
    const reviewed = ['institution', 'education', 'subjects', 'classes', 'areas']
    for (const k of text) if (form[k] !== undefined) body[k] = form[k].trim() || null
    for (const k of arrays) if (form[k] !== undefined) body[k] = list(form[k])
    if (form.experience_years) body.experience_years = Number(form.experience_years)
    if (form.fee_expectation) body.fee_expectation = Number(form.fee_expectation)
    if (!locked) for (const k of reviewed) if (form[k] !== undefined) body[k] = ['subjects', 'classes', 'areas'].includes(k) ? list(form[k]) : form[k].trim() || null
    if (role === 'tutor' || role === 'coaching') body.listed = listed
    await updateProfile(body)
    await load.reload()
  }, 'Profile saved.')
  const photo = async (file?: File) => {
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { toast('Choose a JPG, PNG or WebP picture.', 'danger'); return }
    try { await platform.setPhoto(file); setPhotoKey((k) => k + 1); toast('Photo updated.', 'success') } catch (e) { toast(errMsg(e), 'danger') }
  }
  const F = (k: string, label: string, opt: { ph?: string; area?: boolean; type?: string; hint?: string; lock?: boolean } = {}) => (
    <Field key={k} label={label} hint={opt.lock && locked ? 'Locked while your verification is under review' : opt.hint}>{(id) => opt.area ? <Textarea id={id} value={form[k] ?? ''} onChange={set(k)} placeholder={opt.ph} disabled={opt.lock && locked} /> : <Input id={id} type={opt.type} value={form[k] ?? ''} onChange={set(k)} placeholder={opt.ph} disabled={opt.lock && locked} />}</Field>
  )
  return (
    <div className="space-y-4">
      <PageTitle title="Profile" sub={role === 'tutor' || role === 'coaching' ? 'This is what guardians and students see once you are verified.' : 'Your account details.'} />
      <Loaded load={load}>{(d) => (
        <>
          <Card><div className="flex flex-wrap items-center gap-4">
            <UserPhoto key={photoKey} id={d.account.id} name={d.account.name} has={photoKey > 0 || !!(d.profile as Record<string, unknown> | null)?.has_photo} size={72} />
            <div><p className="font-heading text-xl font-bold text-navy-900">{user?.name}</p><p className="text-sm text-gray-600">{user?.email} · {statusLabel(role ?? '')}</p><p className="text-sm text-gray-600">Profile {d.account.profile_complete}% complete</p></div>
            <label className="ml-auto inline-flex cursor-pointer items-center gap-2 rounded-input border border-gray-400 px-3 py-2 text-sm font-semibold"><Camera size={16} aria-hidden />Change photo<input type="file" className="sr-only" accept="image/jpeg,image/png,image/webp" aria-label="Upload profile photo" onChange={(e) => { void photo(e.target.files?.[0]); e.target.value = '' }} /></label>
          </div></Card>
          <Card><div className="grid gap-3 md:grid-cols-2">
            {F('bio', role === 'coaching' ? 'About the centre' : 'About you', { area: true })}
            {role === 'tutor' && <>{F('institution', 'Educational institution', { lock: true })}{F('education', 'Academic background', { lock: true })}{F('current_study', 'Current class / year', { ph: 'e.g. 3rd year, BSc Physics' })}{F('results', 'Results and grades', { ph: 'SSC GPA 5, HSC GPA 5' })}{F('experience_years', 'Teaching experience (years)', { type: 'number' })}{F('fee_expectation', 'Expected monthly salary (৳)', { type: 'number' })}{F('subjects', 'Subjects', { lock: true, hint: 'Separate with commas' })}{F('classes', 'Classes', { lock: true })}{F('mediums', 'Curriculum / medium', { ph: MEDIUMS.join(', ') })}{F('areas', 'Preferred areas', { lock: true })}{F('teaching_modes', 'Teaching mode', { ph: 'offline, online' })}{F('gender', 'Gender (optional)')}</>}
            {role === 'coaching' && <>{F('institution', 'Institute name', { lock: true })}{F('education', 'Registration details', { lock: true })}{F('subjects', 'Subjects', { lock: true })}{F('classes', 'Levels', { lock: true })}{F('areas', 'Areas', { lock: true })}{F('opening_hours', 'Opening hours', { ph: 'Sat–Thu, 3–9 PM' })}{F('established', 'Established (year)')}{F('address', 'Address')}</>}
            {role === 'student' && <>{F('institution', 'School / college')}{F('class_name', 'Class', { ph: CLASSES.join(', ').slice(0, 40) })}{F('mediums', 'Medium')}{F('subjects', 'Subjects you study')}{F('areas', 'Area')}</>}
            {role === 'parent' && <>{F('district', 'District')}{F('areas', 'Area')}{F('address', 'Address (never shown publicly)')}</>}
          </div>
          {(role === 'tutor' || role === 'coaching') && <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={listed} onChange={(e) => setListed(e.target.checked)} /> Show my profile in search (while verified)</label>}
          <Button className="mt-4" loading={busy} onClick={() => void save()}>Save profile</Button></Card>
          {role === 'student' && <LinkRequests />}
        </>
      )}</Loaded>
    </div>
  )
}

/** Students approve or refuse guardian links. */
function LinkRequests() {
  const { toast } = useStore()
  const load = useLoad(() => platform.links(), [])
  const { busy, run } = useAction(toast)
  return (
    <Section title="Guardians">
      <Loaded load={load} empty={(d) => d.links.length ? null : { title: 'No guardians linked', body: 'When a parent asks to link to your account, approve it here.' }}>
        {(d) => <ul className="divide-y divide-gray-100">{d.links.map((l) => (
          <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"><span>{l.guardian_name} ({l.relationship})</span><span className="flex items-center gap-2"><Chip tone={l.status === 'approved' ? 'green' : l.status === 'pending' ? 'amber' : 'gray'}>{statusLabel(l.status)}</Chip>
            {l.status === 'pending' && <><Button size="sm" loading={busy} onClick={() => void run(async () => { await platform.respondLink(l.id, true); await load.reload() }, 'Guardian approved.')}>Approve</Button><Button size="sm" variant="secondary" loading={busy} onClick={() => void run(async () => { await platform.respondLink(l.id, false); await load.reload() }, 'Refused.')}>Refuse</Button></>}
            {l.status === 'approved' && <Button size="sm" variant="tertiary" onClick={() => { if (window.confirm(`Remove ${l.guardian_name}'s access to your classes?`)) void run(async () => { await platform.respondLink(l.id, false); await load.reload() }, 'Guardian removed.') }}>Remove</Button>}
          </span></li>))}</ul>}
      </Loaded>
    </Section>
  )
}

// ---------- parent: children ----------

export function Children() {
  const { toast } = useStore()
  const nav = useNavigate()
  const load = useLoad(() => platform.links(), [])
  const [form, setForm] = useState({ email: '', relationship: 'mother' })
  const { busy, run } = useAction(toast)
  const kids = load.data?.links ?? []
  return (
    <div className="space-y-4">
      <PageTitle title="Children" sub="Link your child's student account. Your child approves the link from their profile, so only you can see their classes." />
      <Card><h2 className="text-lg">Link a child</h2><div className="mt-3 grid gap-3 sm:grid-cols-[1fr_200px_auto] sm:items-end">
        <Field label="Child's student account email" hint="Your child signs up as a Student first.">{(id) => <Input id={id} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />}</Field>
        <Field label="You are their">{(id) => <Select id={id} value={form.relationship} onChange={(e) => setForm({ ...form, relationship: e.target.value })} options={opts(['mother', 'father', 'guardian', 'sibling', 'relative'])} />}</Field>
        <Button loading={busy} disabled={!form.email.includes('@')} onClick={() => void run(async () => { await platform.requestLink(form.email.trim(), form.relationship); setForm({ ...form, email: '' }); await load.reload() }, 'Link requested. Ask your child to approve it.')}>Send request</Button>
      </div></Card>
      <Loaded load={load} empty={() => kids.length ? null : { title: 'No children linked yet', body: 'Send a link request above.' }}>
        {() => <div className="grid gap-3 md:grid-cols-2">{kids.map((k) => <ChildCard key={k.id} link={k} onOpen={() => nav('/app/parent/progress')} onRemove={() => void run(async () => { await platform.respondLink(k.id, false); await load.reload() }, 'Link removed.')} />)}</div>}
      </Loaded>
    </div>
  )
}

function ChildCard({ link, onOpen, onRemove }: { link: { id: string; student_id: string; student_name: string; class_name?: string | null; institution?: string | null; status: string; relationship: string }; onOpen: () => void; onRemove: () => void }) {
  const progress = useLoad(() => (link.status === 'approved' ? platform.progress(link.student_id) : Promise.resolve(null)), [link.student_id, link.status])
  return (
    <Card>
      <div className="flex items-start justify-between gap-2"><div><p className="font-heading text-lg font-bold text-navy-900">{link.student_name}</p><p className="text-sm text-gray-600">{[link.class_name, link.institution].filter(Boolean).join(' · ') || 'Class not set'}</p></div><Chip tone={link.status === 'approved' ? 'green' : link.status === 'pending' ? 'amber' : 'gray'}>{link.status === 'pending' ? 'Waiting for approval' : statusLabel(link.status)}</Chip></div>
      {link.status === 'approved' && progress.data && <p className="mt-2 text-sm">Attendance {progress.data.attendance_percent != null ? `${Math.round(progress.data.attendance_percent)}%` : '—'} · Average {progress.data.average_score_percent != null ? `${Math.round(progress.data.average_score_percent)}%` : '—'} · {progress.data.submitted}/{progress.data.assigned} work submitted</p>}
      <div className="mt-3 flex gap-2">{link.status === 'approved' && <><Button size="sm" onClick={onOpen}>View progress</Button><Button size="sm" variant="tertiary" onClick={() => { if (window.confirm('Remove this link? You will lose access to their classes.')) onRemove() }}>Remove</Button></>}</div>
    </Card>
  )
}

// ---------- progress (parent / student) and results ----------

export function StudentProgressPage({ mode }: { mode: 'parent' | 'student' }) {
  const { user } = useStore()
  const links = useLoad(() => (mode === 'parent' ? platform.links() : Promise.resolve({ links: [] })), [mode])
  const kids = (links.data?.links ?? []).filter((l) => l.status === 'approved')
  const [child, setChild] = useState('')
  const studentId = mode === 'student' ? user?.id ?? '' : child || kids[0]?.student_id || ''
  const progress = useLoad(() => (studentId ? platform.progress(studentId) : Promise.resolve(null)), [studentId])
  const results = useLoad(() => platform.results(), [])
  const childName = kids.find((k) => k.student_id === studentId)?.student_name
  return (
    <div className="space-y-4">
      <PageTitle title="Progress and results" sub={mode === 'parent' ? 'Attendance, graded work and published exam results for your linked children.' : 'Your attendance, graded work and exam results.'} />
      {mode === 'parent' && kids.length > 1 && <div className="max-w-xs"><Field label="Child">{(id) => <Select id={id} value={studentId} onChange={(e) => setChild(e.target.value)} options={kids.map((k) => ({ value: k.student_id, label: k.student_name }))} />}</Field></div>}
      {mode === 'parent' && links.data && kids.length === 0 ? <Card><p className="text-sm">Link a child under Children to see their progress.</p></Card> : (
        <Loaded load={progress}>{(p) => p && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label={`Attendance${childName ? ` · ${childName}` : ''}`} value={p.attendance_percent != null ? `${Math.round(p.attendance_percent)}%` : '—'} delta={`${p.present} present · ${p.late} late · ${p.absent} absent`} />
            <StatCard label="Average score" value={p.average_score_percent != null ? `${Math.round(p.average_score_percent)}%` : '—'} delta={`${p.reviewed} graded`} />
            <StatCard label="Work submitted" value={`${p.submitted} / ${p.assigned}`} />
            <StatCard label="Missing work" value={String(Math.max(0, p.assigned - p.submitted))} />
          </div>
        )}</Loaded>
      )}
      <Section title="Exam results">
        <Loaded load={results} empty={(d) => d.results.length ? null : { title: 'No published results', body: 'Coaching centres publish exam results here.' }}>
          {(d) => <ul className="divide-y divide-gray-100">{d.results.map((r, i) => <li key={i} className="flex flex-wrap justify-between gap-2 py-2 text-sm"><span>{r.title} · {r.batch} · {r.centre}{mode === 'parent' ? ` · ${r.student}` : ''}</span><span className="font-semibold">{r.marks ?? '—'} / {r.total_marks} <span className="font-normal text-gray-600">({fmtDate(r.exam_date)})</span></span></li>)}</ul>}
        </Loaded>
      </Section>
    </div>
  )
}

// ---------- tutor standing: reviews, ranking, awards ----------

export function Reviews() {
  const { user, toast } = useStore()
  const load = useLoad(() => platform.reviewsFor(user!.id), [user?.id])
  const [replies, setReplies] = useState<Record<string, string>>({})
  const { busy, run } = useAction(toast)
  const avg = load.data?.reviews.length ? load.data.reviews.reduce((a, r) => a + r.stars, 0) / load.data.reviews.length : 0
  return (
    <div className="space-y-4">
      <PageTitle title="Reviews" sub="Guardians and students review you after a tuition is active." />
      <Loaded load={load} empty={(d) => d.reviews.length ? null : { title: 'No reviews yet', body: 'Reviews appear after your first confirmed tuition.' }}>
        {(d) => <><Card><Stars value={avg} count={d.reviews.length} /></Card>{d.reviews.map((r) => (
          <Card key={r.id}><p><span className="text-warning-600">{'★'.repeat(r.stars)}</span> · {r.by} ({r.by_role}) · {r.subject} · {fmtDate(r.created_at)}</p>{r.body && <p className="mt-1 text-sm">{r.body}</p>}
            {r.reply ? <p className="mt-2 rounded-input bg-gray-50 p-2 text-sm">Your reply: {r.reply}</p> : <div className="mt-2 flex gap-2"><Input aria-label="Reply" value={replies[r.id] ?? ''} onChange={(e) => setReplies({ ...replies, [r.id]: e.target.value })} placeholder="Reply publicly" /><Button size="sm" loading={busy} disabled={!replies[r.id]?.trim()} onClick={() => void run(async () => { await platform.replyReview(r.id, replies[r.id]); await load.reload() }, 'Reply posted.')}>Reply</Button></div>}</Card>))}</>}
      </Loaded>
    </div>
  )
}

/** Where the tutor stands among verified tutors in each of their subjects, by rating. */
export function Ranking() {
  const { user } = useStore()
  const me = useLoad(() => platform.tutor(user!.id).catch(() => null), [user?.id])
  const ranks = useLoad(async () => {
    const t = me.data?.tutor
    if (!t) return []
    return Promise.all(t.subjects.map(async (subject) => {
      const all = (await platform.tutors({ subject })).tutors
      return { subject, position: all.findIndex((x) => x.id === t.id) + 1, of: all.length }
    }))
  }, [me.data])
  return (
    <div className="space-y-4">
      <PageTitle title="Ranking" sub="Your position among verified tutors in each subject, ordered by rating and number of reviews." />
      {me.data === null && !me.loading ? <Card><p className="text-sm">Rankings appear once you are verified and your profile is listed.</p></Card> : (
        <Loaded load={ranks} empty={(d) => d.length ? null : { title: 'No subjects', body: 'Add subjects to your profile.' }}>
          {(d) => <div className="grid gap-3 sm:grid-cols-2">{d.map((r) => <StatCard key={r.subject} label={r.subject} value={r.position ? `#${r.position}` : '—'} delta={`of ${r.of} verified tutors`} />)}</div>}
        </Loaded>
      )}
    </div>
  )
}

export function Awards() {
  const { user } = useStore()
  const load = useLoad(() => platform.awards(user!.id), [user?.id])
  return (
    <div className="space-y-4">
      <PageTitle title="Awards" sub="Recognition granted by TuitionHub administrators." />
      <Loaded load={load} empty={(d) => d.awards.length ? null : { title: 'No awards yet', body: 'Consistent, well-reviewed teaching is recognised by the TuitionHub team.' }}>
        {(d) => <div className="grid gap-3 sm:grid-cols-2">{d.awards.map((a) => <Card key={a.id}><p className="font-heading text-lg font-bold text-navy-900">{a.title}</p>{a.description && <p className="text-sm">{a.description}</p>}<p className="text-xs text-gray-600">{fmtDate(a.awarded_at)}</p></Card>)}</div>}
      </Loaded>
    </div>
  )
}

// ---------- safety / support ----------

export function Safety() {
  const { toast } = useStore()
  const load = useLoad(() => platform.myTickets(), [])
  const [form, setForm] = useState({ category: 'support', title: '', body: '' })
  const { busy, run } = useAction(toast)
  return (
    <div className="space-y-4">
      <PageTitle title="Safety and support" sub="Report a problem or ask for help. The TuitionHub team reviews every request." />
      <Card className="border-danger-600 bg-danger-50"><p className="text-sm"><strong>In an emergency</strong> call 999 (Bangladesh national emergency service) first.</p></Card>
      <Card><h2 className="text-lg">New request</h2><div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Type">{(id) => <Select id={id} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} options={[{ value: 'support', label: 'Help with my account' }, { value: 'safety', label: 'Safety concern' }, { value: 'complaint', label: 'Complaint' }, { value: 'payment', label: 'Payment problem' }, { value: 'appeal', label: 'Appeal a decision' }]} />}</Field>
        <Field label="Subject">{(id) => <Input id={id} value={form.title} maxLength={200} onChange={(e) => setForm({ ...form, title: e.target.value })} />}</Field>
        <div className="sm:col-span-2"><Field label="Details" hint="At least 10 characters">{(id) => <Textarea id={id} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />}</Field></div>
      </div><Button className="mt-3" loading={busy} disabled={!form.title.trim() || form.body.trim().length < 10} onClick={() => void run(async () => { await platform.createTicket(form); setForm({ category: 'support', title: '', body: '' }); await load.reload() }, 'Request sent. You will be notified of updates.')}>Send</Button></Card>
      <Section title="My requests">
        <Loaded load={load} empty={(d) => d.tickets.length ? null : { title: 'No requests', body: 'Requests you send appear here with their status.' }}>
          {(d) => <ul className="divide-y divide-gray-100">{d.tickets.map((t) => <li key={t.id} className="py-2 text-sm"><div className="flex flex-wrap justify-between gap-2"><span className="font-medium">{t.title}</span><Chip tone={t.status === 'resolved' || t.status === 'closed' ? 'green' : 'amber'}>{statusLabel(t.status)}</Chip></div><p className="text-xs text-gray-600">{statusLabel(t.category)} · {fmtDateTime(t.created_at)}</p>{t.resolution && <p className="mt-1">Response: {t.resolution}</p>}</li>)}</ul>}
        </Loaded>
      </Section>
    </div>
  )
}

// ---------- dashboards ----------

export function Dashboard() {
  const { user, verification } = useStore()
  const nav = useNavigate()
  const role = user?.role ?? 'student'
  const base = `/app/${role}`
  const load = useLoad(async () => {
    const [classrooms, engagements, unread, apps, posts, links] = await Promise.all([
      platform.classrooms(), platform.engagements(), platform.unreadMessages(),
      role === 'tutor' ? platform.myApplications() : Promise.resolve({ applications: [] }),
      role === 'parent' || role === 'student' ? platform.myPosts() : Promise.resolve({ posts: [] }),
      role === 'parent' || role === 'student' ? platform.links() : Promise.resolve({ links: [] }),
    ])
    const report = role === 'coaching' ? await platform.coaching.report().catch(() => null) : null
    return { classrooms: classrooms.classrooms, engagements: engagements.engagements, unread: unread.unread, apps: apps.applications, posts: posts.posts, links: links.links, report }
  }, [role])
  return (
    <div className="space-y-4">
      <PageTitle title={`Welcome, ${user?.name.split(' ')[0] ?? ''}`} sub={role === 'tutor' || role === 'coaching' ? (verification[role] === 'verified' ? 'Your account is verified.' : 'Finish verification to unlock applying, classrooms and listing.') : 'Here is what is happening.'} />
      {(role === 'parent' || role === 'student') && <FamilySummary role={role} />}
      <Loaded load={load}>{(d) => {
        const active = d.engagements.filter((e) => e.status === 'active')
        const waiting = d.engagements.filter((e) => (e.status === 'trial_requested' && role === 'tutor') || (e.status === 'proposed' && !(role === 'tutor' ? e.tutor_confirmed_at : e.client_confirmed_at)))
        const next = d.classrooms.filter((c) => c.next_session).sort((a, b) => Date.parse(a.next_session!) - Date.parse(b.next_session!))[0]
        const stats: [string, string, string][] = role === 'coaching' && d.report ? [
          ['Students', String(d.report.students), `${base}/students`], ['Batches', String(d.report.batches), `${base}/batches`], ['Attendance', d.report.attendance_percent != null ? `${Math.round(d.report.attendance_percent)}%` : '—', `${base}/attendance`], ['Fees due', taka(d.report.fees_due), `${base}/payments`],
        ] : [
          ['Active tuitions', String(active.length), `${base}/${role === 'tutor' ? 'my-students' : role === 'parent' ? 'tuitions' : 'my-tuition'}`],
          ['Unread messages', String(d.unread), `${base}/messages`],
          role === 'tutor' ? ['Open applications', String(d.apps.filter((a) => a.status === 'applied' || a.status === 'shortlisted').length), `${base}/my-posts`] : ['Tuition posts', String(d.posts.filter((p) => p.status === 'open').length), role === 'parent' ? `${base}/my-posts` : `${base}/find-tutor`],
          ['Open homework', String(d.classrooms.reduce((a, c) => a + c.open_assignments, 0)), `${base}/homework`],
        ]
        return (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{stats.map(([label, value, to]) => <button key={label} className="text-left" onClick={() => nav(to)}><StatCard label={label} value={value} /></button>)}</div>
            {waiting.length > 0 && <Section title="Needs your attention"><ul className="divide-y divide-gray-100">{waiting.map((e) => <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"><span>{e.subject} · {e.status === 'trial_requested' ? 'demo class request' : 'terms to confirm'}</span><Button size="sm" onClick={() => nav(`${base}/${role === 'tutor' ? 'my-students' : role === 'parent' ? 'tuitions' : 'my-tuition'}`)}>Review</Button></li>)}</ul></Section>}
            <Section title="Next class">{next ? <p className="text-sm">{fmtDateTime(next.next_session)} · {next.name}{next.child_name ? ` · ${next.child_name}` : ''} <Button size="sm" variant="tertiary" onClick={() => nav(`${base}/schedule/${next.id}`)}>Open</Button></p> : <p className="text-sm text-gray-600">No upcoming classes scheduled.</p>}</Section>
            {role === 'parent' && d.links.filter((l) => l.status === 'approved').length === 0 && <Section title="Get started"><p className="text-sm">Get verified, then request a student account for your child with their own email.</p><Button className="mt-2" size="sm" onClick={() => nav(`${base}/verification`)}>Open verification</Button></Section>}
            {role === 'student' && verification.student === 'verified' && d.links.some((l) => l.status === 'pending') && <Section title="Guardian request"><p className="text-sm">A guardian asked to link to your account.</p><Button className="mt-2" size="sm" onClick={() => nav(`${base}/profile`)}>Review</Button></Section>}
          </>
        )
      }}</Loaded>
    </div>
  )
}
