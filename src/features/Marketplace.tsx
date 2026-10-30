import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Bookmark, BookmarkCheck, GraduationCap, MapPin, Plus } from 'lucide-react'
import { Button, Card, Chip, Field, Input, Modal, Select, Tabs, Textarea, VerifyBadge } from '../components/ui'
import { useStore } from '../lib/store'
import { platform, taka, fmtDate, errMsg, type Post, type PostInput, type TutorCard } from '../lib/platform'
import { useAction, useLoad } from '../lib/useLoad'
import { AREAS, CLASSES, Loaded, MEDIUMS, PageTitle, Stars, SUBJECTS, UserPhoto, opts, statusLabel } from './common'
import { ReportButton } from './Messages'

type Filters = { subject: string; class: string; area: string; mode: string; q: string }
const noFilters: Filters = { subject: '', class: '', area: '', mode: '', q: '' }

function FilterBar({ value, onChange, modes = ['offline', 'online', 'both'], extra }: { value: Filters; onChange: (f: Filters) => void; modes?: string[]; extra?: React.ReactNode }) {
  const [q, setQ] = useState(value.q)
  return (
    <Card>
      <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:items-end xl:grid-cols-6" onSubmit={(e) => { e.preventDefault(); onChange({ ...value, q: q.trim() }) }}>
        <Field label="Subject">{(id) => <Select id={id} value={value.subject} onChange={(e) => onChange({ ...value, subject: e.target.value })} options={opts(SUBJECTS, 'Any subject')} />}</Field>
        <Field label="Class">{(id) => <Select id={id} value={value.class} onChange={(e) => onChange({ ...value, class: e.target.value })} options={opts(CLASSES, 'Any class')} />}</Field>
        <Field label="Area">{(id) => <Select id={id} value={value.area} onChange={(e) => onChange({ ...value, area: e.target.value })} options={opts(AREAS, 'Any area')} />}</Field>
        <Field label="Mode">{(id) => <Select id={id} value={value.mode} onChange={(e) => onChange({ ...value, mode: e.target.value })} options={opts(modes, 'Any mode')} />}</Field>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-2 xl:col-span-2"><Input aria-label="Search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, subject or keyword" /><Button type="submit">Search</Button></div>
      </form>
      {extra}
    </Card>
  )
}

function PostCard({ p, actions }: { p: Post; actions?: React.ReactNode }) {
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-heading text-lg font-bold text-navy-900">{p.subject} · {p.class_name}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-600"><span className="inline-flex items-center gap-1"><MapPin size={14} aria-hidden />{p.area}</span><span>{statusLabel(p.mode)}</span>{p.medium && <span>{p.medium}</span>}{p.days && <span>{p.days}</span>}{p.time_slot && <span>{p.time_slot}</span>}</p>
          {p.requirements && <p className="mt-2 text-sm">{p.requirements}</p>}
          <p className="mt-2 text-xs text-gray-600">Posted {fmtDate(p.created_at)} by {p.owner_name} ({p.owner_role}) · {p.applicants} applicant{p.applicants === 1 ? '' : 's'}</p>
        </div>
        <div className="text-right"><p className="font-heading text-xl font-bold text-navy-900">{taka(p.budget)}</p><p className="text-xs text-gray-600">per month</p>{p.status !== 'open' && <Chip>{statusLabel(p.status)}</Chip>}</div>
      </div>
      {actions && <div className="mt-3 flex flex-wrap gap-2">{actions}</div>}
    </Card>
  )
}

/** Tutor: browse open tuition posts, apply, save. */
export function FindTuition() {
  const { toast, verification } = useStore()
  const [f, setF] = useState<Filters>(noFilters)
  const [saved, setSaved] = useState(false)
  const [applying, setApplying] = useState<Post | null>(null)
  const [note, setNote] = useState('')
  const load = useLoad(() => platform.posts({ ...f, saved }), [f.subject, f.class, f.area, f.mode, f.q, saved])
  const { busy, run } = useAction(toast)
  const verified = verification.tutor === 'verified'
  return (
    <div className="space-y-4">
      <PageTitle title="Find tuition" sub="Open tuition posts from guardians and students." />
      {!verified && <Card className="border-warning-600 bg-warning-100"><p className="text-sm">You can browse posts now. Applying unlocks once an administrator approves your verification.</p></Card>}
      <FilterBar value={f} onChange={setF} modes={['offline', 'online']} extra={<label className="mt-3 inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} /> Saved posts only</label>} />
      <Loaded load={load} empty={(d) => d.posts.length ? null : { title: 'No matching tuition posts', body: 'Try fewer filters, or check back later.' }}>
        {(d) => <><p className="text-sm text-gray-600">{d.total} post{d.total === 1 ? '' : 's'}</p><div className="space-y-3">{d.posts.map((p) => (
          <PostCard key={p.id} p={p} actions={<>
            {p.my_application ? <Chip tone={p.my_application === 'accepted' ? 'green' : p.my_application === 'declined' ? 'red' : 'blue'}>Application: {statusLabel(p.my_application)}</Chip>
              : <Button size="sm" disabled={!verified} onClick={() => { setApplying(p); setNote('') }}>Apply</Button>}
            <Button size="sm" variant="secondary" loading={busy} icon={p.saved ? <BookmarkCheck size={14} /> : <Bookmark size={14} />} onClick={() => void run(async () => { await platform.save(p.id, !p.saved); await load.reload() })}>{p.saved ? 'Saved' : 'Save'}</Button>
            <ReportButton name={`${p.subject} post`} listingId={p.id} userId={p.owner_id} />
          </>} />))}</div></>}
      </Loaded>
      <Modal open={!!applying} onClose={() => setApplying(null)} title={applying ? `Apply: ${applying.subject} · ${applying.class_name}` : ''} footer={<><Button variant="secondary" onClick={() => setApplying(null)}>Cancel</Button><Button loading={busy} onClick={() => applying && void run(async () => { await platform.apply(applying.id, note); setApplying(null); await load.reload() }, 'Application sent.')}>Send application</Button></>}>
        <Field label="Note to the guardian" hint="Your experience with this subject and when you can start.">{(id) => <Textarea id={id} value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} />}</Field>
      </Modal>
    </div>
  )
}

/** Tutor: applications they have made. */
export function MyApplications() {
  const { toast } = useStore()
  const nav = useNavigate()
  const load = useLoad(() => platform.myApplications(), [])
  const { busy, run } = useAction(toast)
  return (
    <div className="space-y-4">
      <PageTitle title="My applications" sub="Tuition posts you have applied to." actions={<Button variant="secondary" onClick={() => nav('/app/tutor/find-tuition')}>Find tuition</Button>} />
      <Loaded load={load} empty={(d) => d.applications.length ? null : { title: 'No applications yet', body: 'Apply to tuition posts from Find Tuition.' }}>
        {(d) => <div className="space-y-3">{d.applications.map((a) => (
          <Card key={a.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{a.subject} · {a.class_name} · {a.area}</p><p className="text-sm text-gray-600">Posted by {a.owner_name} · {taka(a.budget)} / month · applied {fmtDate(a.created_at)}</p>{a.note && <p className="mt-1 text-sm">“{a.note}”</p>}</div>
            <div className="flex flex-wrap items-center gap-2"><Chip tone={a.status === 'accepted' ? 'green' : a.status === 'declined' ? 'red' : a.status === 'shortlisted' ? 'blue' : 'gray'}>{statusLabel(a.status)}</Chip>
              {a.status === 'accepted' && <Button size="sm" onClick={() => nav('/app/tutor/messages')}>Open messages</Button>}
              {(a.status === 'applied' || a.status === 'shortlisted') && <Button size="sm" variant="secondary" loading={busy} onClick={() => { if (window.confirm('Withdraw this application?')) void run(async () => { await platform.setApplication(a.id, 'withdrawn'); await load.reload() }, 'Application withdrawn.') }}>Withdraw</Button>}
            </div></div></Card>))}</div>}
      </Loaded>
    </div>
  )
}

const emptyPost: PostInput = { subject: '', class_name: '', medium: '', area: '', mode: 'offline', days: '', time_slot: '', budget: null, requirements: '', student_id: '' }

/** Parent / student: create and manage tuition posts, review applicants. */
export function MyPosts({ role }: { role: 'parent' | 'student' }) {
  const { toast } = useStore()
  const nav = useNavigate()
  const load = useLoad(() => platform.myPosts(), [])
  const links = useLoad(() => (role === 'parent' ? platform.links() : Promise.resolve({ links: [] })), [role])
  const [editing, setEditing] = useState<{ id?: string; form: PostInput } | null>(null)
  const [viewing, setViewing] = useState<Post | null>(null)
  const { busy, run } = useAction(toast)
  const children = links.data?.links.filter((l) => l.status === 'approved' && l.student_id) ?? []
  const set = (k: keyof PostInput, v: string | number | null) => setEditing((e) => (e ? { ...e, form: { ...e.form, [k]: v } } : e))
  const save = () => editing && run(async () => {
    const body = { ...editing.form, budget: editing.form.budget ? Number(editing.form.budget) : null, student_id: editing.form.student_id || undefined }
    if (editing.id) await platform.updatePost(editing.id, body)
    else await platform.createPost(body)
    setEditing(null)
    await load.reload()
  }, editing.id ? 'Post updated.' : 'Tuition post published.')
  const valid = editing && editing.form.subject && editing.form.class_name && editing.form.area
  return (
    <div className="space-y-4">
      <PageTitle title="My tuition posts" sub="Describe what you need; verified tutors apply and you choose." actions={<Button icon={<Plus size={16} />} onClick={() => setEditing({ form: { ...emptyPost } })}>New post</Button>} />
      <Loaded load={load} empty={(d) => d.posts.length ? null : { title: 'No posts yet', body: 'Publish a tuition post to receive applications from verified tutors.', action: <Button onClick={() => setEditing({ form: { ...emptyPost } })}>Create a post</Button> }}>
        {(d) => <div className="space-y-3">{d.posts.map((p) => (
          <PostCard key={p.id} p={p} actions={<>
            <Button size="sm" onClick={() => setViewing(p)}>Applicants ({p.applicants})</Button>
            {(p.status === 'open' || p.status === 'paused') && <Button size="sm" variant="secondary" onClick={() => setEditing({ id: p.id, form: { subject: p.subject, class_name: p.class_name, medium: p.medium ?? '', area: p.area, mode: p.mode, days: p.days ?? '', time_slot: p.time_slot ?? '', budget: p.budget ?? null, requirements: p.requirements ?? '' } })}>Edit</Button>}
            {p.status === 'open' && <Button size="sm" variant="secondary" loading={busy} onClick={() => void run(async () => { await platform.setPostStatus(p.id, 'paused'); await load.reload() }, 'Post paused.')}>Pause</Button>}
            {p.status === 'paused' && <Button size="sm" variant="secondary" loading={busy} onClick={() => void run(async () => { await platform.setPostStatus(p.id, 'open'); await load.reload() }, 'Post reopened.')}>Reopen</Button>}
            {p.status !== 'closed' && <Button size="sm" variant="destructive" loading={busy} onClick={() => { if (window.confirm('Close this post? It cannot be reopened.')) void run(async () => { await platform.setPostStatus(p.id, 'closed'); await load.reload() }, 'Post closed.') }}>Close</Button>}
          </>} />))}</div>}
      </Loaded>
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit tuition post' : 'New tuition post'} footer={<><Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button><Button loading={busy} disabled={!valid} onClick={() => void save()}>{editing?.id ? 'Save' : 'Publish'}</Button></>}>
        {editing && <div className="grid gap-3 sm:grid-cols-2">
          {role === 'parent' && !editing.id && <Field label="For which child" hint={children.length ? undefined : 'Link a child under Children to attach them.'}>{(id) => <Select id={id} value={editing.form.student_id ?? ''} onChange={(e) => set('student_id', e.target.value)} options={[{ value: '', label: 'Not specified' }, ...children.map((c) => ({ value: c.student_id, label: c.student_name }))]} />}</Field>}
          <Field label="Subject">{(id) => <Select id={id} value={editing.form.subject} onChange={(e) => set('subject', e.target.value)} options={opts(SUBJECTS, 'Choose')} />}</Field>
          <Field label="Class">{(id) => <Select id={id} value={editing.form.class_name} onChange={(e) => set('class_name', e.target.value)} options={opts(CLASSES, 'Choose')} />}</Field>
          <Field label="Medium">{(id) => <Select id={id} value={editing.form.medium ?? ''} onChange={(e) => set('medium', e.target.value)} options={opts(MEDIUMS, 'Any')} />}</Field>
          <Field label="Area">{(id) => <Select id={id} value={editing.form.area} onChange={(e) => set('area', e.target.value)} options={opts(AREAS, 'Choose')} />}</Field>
          <Field label="Mode">{(id) => <Select id={id} value={editing.form.mode} onChange={(e) => set('mode', e.target.value)} options={opts(['offline', 'online', 'both'])} />}</Field>
          <Field label="Days">{(id) => <Input id={id} value={editing.form.days ?? ''} onChange={(e) => set('days', e.target.value)} placeholder="Sun, Tue, Thu" />}</Field>
          <Field label="Time">{(id) => <Input id={id} value={editing.form.time_slot ?? ''} onChange={(e) => set('time_slot', e.target.value)} placeholder="6:30–7:30 PM" />}</Field>
          <Field label="Monthly budget (৳)">{(id) => <Input id={id} type="number" min={0} value={editing.form.budget ?? ''} onChange={(e) => set('budget', e.target.value === '' ? null : Number(e.target.value))} />}</Field>
          <div className="sm:col-span-2"><Field label="Requirements">{(id) => <Textarea id={id} value={editing.form.requirements ?? ''} maxLength={2000} onChange={(e) => set('requirements', e.target.value)} />}</Field></div>
        </div>}
      </Modal>
      {viewing && <Applicants post={viewing} onClose={() => { setViewing(null); void load.reload() }} onAccepted={() => nav(`/app/${role}/messages`)} />}
    </div>
  )
}

function Applicants({ post, onClose, onAccepted }: { post: Post; onClose: () => void; onAccepted: () => void }) {
  const { toast } = useStore()
  const load = useLoad(() => platform.postApplications(post.id), [post.id])
  const { busy, run } = useAction(toast)
  const [profile, setProfile] = useState<string | null>(null)
  return (
    <Modal open onClose={onClose} title={`Applicants: ${post.subject} · ${post.class_name}`}>
      <Loaded load={load} empty={(d) => d.applications.length ? null : { title: 'No applicants yet', body: 'Verified tutors who apply will appear here.' }}>
        {(d) => <ul className="space-y-3">{d.applications.map((a) => (
          <li key={a.id} className="rounded-input border border-gray-200 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2"><div><button className="font-semibold text-blue-600 hover:underline" onClick={() => setProfile(a.tutor_id)}>{a.tutor_name}</button> <Stars value={a.tutor_rating} count={a.tutor_rating ? 1 : 0} />{a.note && <p className="mt-1 text-sm">“{a.note}”</p>}<p className="text-xs text-gray-600">Applied {fmtDate(a.created_at)}</p></div><Chip tone={a.status === 'accepted' ? 'green' : a.status === 'declined' ? 'red' : 'blue'}>{statusLabel(a.status)}</Chip></div>
            {(a.status === 'applied' || a.status === 'shortlisted') && <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" loading={busy} onClick={() => void run(async () => { await platform.setApplication(a.id, 'accepted'); onAccepted() }, 'Accepted. A conversation is open in Messages.')}>Accept and message</Button>
              {a.status === 'applied' && <Button size="sm" variant="secondary" loading={busy} onClick={() => void run(async () => { await platform.setApplication(a.id, 'shortlisted'); await load.reload() }, 'Shortlisted.')}>Shortlist</Button>}
              <Button size="sm" variant="secondary" loading={busy} onClick={() => void run(async () => { await platform.setApplication(a.id, 'declined'); await load.reload() }, 'Declined.')}>Decline</Button>
            </div>}
          </li>))}</ul>}
      </Loaded>
      {profile && <TutorProfileModal id={profile} onClose={() => setProfile(null)} />}
    </Modal>
  )
}

/** Parent / student: find verified tutors and coaching centres. */
export function FindTutors({ role }: { role: 'parent' | 'student' }) {
  const [tab, setTab] = useState('Tutors')
  const [f, setF] = useState<Filters>(noFilters)
  const [maxFee, setMaxFee] = useState('')
  const tutors = useLoad(() => (tab === 'Tutors' ? platform.tutors({ subject: f.subject, class: f.class, area: f.area, mode: f.mode, q: f.q, max_fee: maxFee ? Number(maxFee) : undefined }) : Promise.resolve(null)), [tab, f.subject, f.class, f.area, f.mode, f.q, maxFee])
  const centres = useLoad(() => (tab === 'Coaching centres' ? platform.centres({ subject: f.subject, area: f.area, q: f.q }) : Promise.resolve(null)), [tab, f.subject, f.area, f.q])
  const [profile, setProfile] = useState<string | null>(null)
  const [centre, setCentre] = useState<string | null>(null)
  return (
    <div className="space-y-4">
      <PageTitle title="Find a tutor" sub="Only tutors and centres verified by TuitionHub administrators are listed." />
      <Tabs tabs={['Tutors', 'Coaching centres']} value={tab} onChange={setTab} />
      <FilterBar value={f} onChange={setF} modes={['offline', 'online']} extra={tab === 'Tutors' ? <div className="mt-3 max-w-xs"><Field label="Maximum monthly fee (৳)">{(id) => <Input id={id} type="number" min={0} value={maxFee} onChange={(e) => setMaxFee(e.target.value)} />}</Field></div> : null} />
      {tab === 'Tutors' ? (
        <Loaded load={tutors} empty={(d) => d && d.tutors.length ? null : { title: 'No tutors match', body: 'Try fewer filters. Only verified tutors appear.' }}>
          {(d) => <div className="grid gap-3 md:grid-cols-2">{d!.tutors.map((t) => <TutorTile key={t.id} t={t} onOpen={() => setProfile(t.id)} />)}</div>}
        </Loaded>
      ) : (
        <Loaded load={centres} empty={(d) => d && d.centres.length ? null : { title: 'No coaching centres match', body: 'Try fewer filters.' }}>
          {(d) => <div className="grid gap-3 md:grid-cols-2">{d!.centres.map((c) => (
            <Card key={c.id}><div className="flex items-start gap-3"><UserPhoto id={c.id} name={c.name} has={c.has_photo} /><div className="min-w-0"><button className="font-heading text-lg font-bold text-navy-900 hover:underline" onClick={() => setCentre(c.id)}>{c.institution || c.name}</button><p className="text-sm text-gray-600">{c.areas.join(', ')} · {c.subjects.join(', ')}</p><p className="mt-1 text-sm">{c.teachers} teachers · {c.batches} batches · {c.students} students</p><Stars value={c.rating} count={c.review_count} /></div></div></Card>))}</div>}
        </Loaded>
      )}
      {profile && <TutorProfileModal id={profile} onClose={() => setProfile(null)} canRequest={role === 'parent' || role === 'student'} />}
      {centre && <CentreModal id={centre} onClose={() => setCentre(null)} />}
    </div>
  )
}

function TutorTile({ t, onOpen }: { t: TutorCard; onOpen: () => void }) {
  return (
    <Card>
      <div className="flex items-start gap-3">
        <UserPhoto id={t.id} name={t.name} has={t.has_photo} />
        <div className="min-w-0 flex-1">
          <button className="font-heading text-lg font-bold text-navy-900 hover:underline" onClick={onOpen}>{t.name}</button>
          <p className="text-sm text-gray-600">{t.subjects.join(', ')} · {t.classes.join(', ')}</p>
          <p className="text-sm text-gray-600">{t.areas.join(', ')}{t.experience_years ? ` · ${t.experience_years} yrs experience` : ''}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2"><Stars value={t.rating} count={t.review_count} /><span className="text-sm font-semibold">{taka(t.fee_expectation)}/month</span></div>
          <div className="mt-2 flex flex-wrap gap-1"><VerifyBadge kind="identity" />{t.education_verified && <VerifyBadge kind="education" />}</div>
        </div>
      </div>
    </Card>
  )
}

/** A verified tutor's public profile with reviews, and a chat request for parents and students. */
export function TutorProfileModal({ id, onClose, canRequest }: { id: string; onClose: () => void; canRequest?: boolean }) {
  const { toast, user } = useStore()
  const load = useLoad(() => platform.tutor(id), [id])
  const links = useLoad(() => (user?.role === 'parent' ? platform.links() : Promise.resolve({ links: [] })), [user?.role])
  const [message, setMessage] = useState('')
  const [student, setStudent] = useState('')
  const { busy, run } = useAction(toast)
  const children = links.data?.links.filter((l) => l.status === 'approved') ?? []
  return (
    <Modal open onClose={onClose} title="Tutor profile">
      <Loaded load={load}>{(d) => {
        const t = d.tutor
        return (
          <div className="space-y-4">
            <div className="flex items-start gap-3"><UserPhoto id={t.id} name={t.name} has={t.has_photo} size={64} /><div><p className="font-heading text-xl font-bold text-navy-900">{t.name}</p><Stars value={t.rating} count={t.review_count} /><div className="mt-1 flex flex-wrap gap-1"><VerifyBadge kind="identity" />{t.education_verified && <VerifyBadge kind="education" />}</div></div></div>
            {t.bio && <p className="text-sm">{t.bio}</p>}
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              {[['Subjects', t.subjects.join(', ')], ['Classes', t.classes.join(', ')], ['Areas', t.areas.join(', ')], ['Teaching', t.teaching_modes.join(', ')], ['Medium', t.mediums.join(', ')], ['Education', t.education], ['Institution', t.institution], ['Currently', t.current_study], ['Results', t.results], ['Experience', t.experience_years ? `${t.experience_years} years` : ''], ['Expected fee', taka(t.fee_expectation) + ' / month'], ['Tuitions on TuitionHub', String(t.tuitions_done)]]
                .filter(([, v]) => v).map(([k, v]) => <div key={k}><dt className="text-gray-600">{k}</dt><dd className="font-medium">{v}</dd></div>)}
            </dl>
            {d.awards.length > 0 && <div><h3 className="font-semibold">Awards</h3><ul className="mt-1 list-disc pl-5 text-sm">{d.awards.map((a) => <li key={a.id}>{a.title}</li>)}</ul></div>}
            <div><h3 className="font-semibold"><GraduationCap size={16} className="mr-1 inline" aria-hidden />Reviews</h3>
              {d.reviews.length === 0 ? <p className="text-sm text-gray-600">No reviews yet.</p> : <ul className="mt-2 space-y-2">{d.reviews.map((r) => <li key={r.id} className="rounded-input border border-gray-200 p-3 text-sm"><p><span className="text-warning-600">{'★'.repeat(r.stars)}</span> · {r.by} ({r.by_role}) · {r.subject}</p>{r.body && <p className="mt-1">{r.body}</p>}{r.reply && <p className="mt-1 text-gray-600">Reply: {r.reply}</p>}</li>)}</ul>}
            </div>
            {canRequest && user && <div className="rounded-input border border-gray-200 p-3">
              <h3 className="font-semibold">Send a chat request</h3>
              {user.role === 'parent' && children.length > 0 && <div className="mt-2"><Field label="For which child">{(fid) => <Select id={fid} value={student} onChange={(e) => setStudent(e.target.value)} options={[{ value: '', label: 'Not specified' }, ...children.map((c) => ({ value: c.student_id, label: c.student_name }))]} />}</Field></div>}
              <Textarea className="mt-2" aria-label="Message to the tutor" value={message} maxLength={2000} onChange={(e) => setMessage(e.target.value)} placeholder="Introduce yourself and what you need." />
              <Button className="mt-2" loading={busy} onClick={() => void run(async () => { await platform.requestChat({ to_id: t.id, student_id: student || undefined, message }); onClose() }, 'Chat request sent. You will be notified when the tutor answers.')}>Send request</Button>
            </div>}
          </div>
        )
      }}</Loaded>
    </Modal>
  )
}

function CentreModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { toast, user } = useStore()
  const load = useLoad(() => platform.centre(id), [id])
  const [message, setMessage] = useState('')
  const { busy, run } = useAction(toast)
  return (
    <Modal open onClose={onClose} title="Coaching centre">
      <Loaded load={load}>{(d) => (
        <div className="space-y-3">
          <p className="font-heading text-xl font-bold text-navy-900">{d.centre.institution || d.centre.name}</p>
          <Stars value={d.centre.rating} count={d.centre.review_count} />
          {d.centre.about && <p className="text-sm">{d.centre.about}</p>}
          <p className="text-sm text-gray-600">{d.centre.areas.join(', ')}{d.centre.opening_hours ? ` · ${d.centre.opening_hours}` : ''}{d.centre.established ? ` · Est. ${d.centre.established}` : ''}</p>
          {d.centre.batch_list && d.centre.batch_list.length > 0 && <div><h3 className="font-semibold">Batches</h3><ul className="mt-1 space-y-1 text-sm">{d.centre.batch_list.map((b) => <li key={b.name}>{b.name} · {b.subject}{b.days ? ` · ${b.days}` : ''}{b.time_slot ? ` ${b.time_slot}` : ''} · {taka(b.monthly_fee)}/month</li>)}</ul></div>}
          {d.centre.teacher_list && d.centre.teacher_list.length > 0 && <div><h3 className="font-semibold">Teachers</h3><p className="text-sm">{d.centre.teacher_list.map((t) => `${t.name}${t.subject ? ` (${t.subject})` : ''}`).join(', ')}</p></div>}
          {user && (user.role === 'parent' || user.role === 'student') && <div className="rounded-input border border-gray-200 p-3"><h3 className="font-semibold">Ask about admission</h3><Textarea className="mt-2" aria-label="Message to the centre" value={message} onChange={(e) => setMessage(e.target.value)} /><Button className="mt-2" loading={busy} onClick={() => void run(async () => { await platform.requestChat({ to_id: id, message }); onClose() }, 'Request sent to the centre.')}>Send request</Button></div>}
        </div>
      )}</Loaded>
    </Modal>
  )
}

export { errMsg }
