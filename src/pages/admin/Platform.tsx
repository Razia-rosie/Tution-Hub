import { useEffect, useState } from 'react'
import { Button, Card, Chip, Field, Input, Modal, Select, StatCard, Textarea } from '../../components/ui'
import { useStore } from '../../lib/store'
import { getAdminUsers } from '../../lib/api'
import { platform, taka, fmtDate, fmtDateTime, type Ticket } from '../../lib/platform'
import { useAction, useLoad } from '../../lib/useLoad'
import { Loaded, PageTitle, Section, statusLabel } from '../../features/common'

const A = platform.admin

export function TuitionPosts() {
  const { toast } = useStore()
  const [status, setStatus] = useState('open')
  const [q, setQ] = useState('')
  const [search, setSearch] = useState('')
  const load = useLoad(() => A.posts({ status, q: search }), [status, search])
  const { busy, run } = useAction(toast)
  return (
    <div className="space-y-4">
      <PageTitle title="Tuition posts" sub="Moderate posts. Closing a post is final and audited." />
      <Card><form className="grid gap-3 sm:grid-cols-[200px_1fr_auto] sm:items-end" onSubmit={(e) => { e.preventDefault(); setSearch(q) }}>
        <Field label="Status">{(id) => <Select id={id} value={status} onChange={(e) => setStatus(e.target.value)} options={[{ value: '', label: 'All' }, ...['open', 'paused', 'filled', 'closed'].map((v) => ({ value: v, label: statusLabel(v) }))]} />}</Field>
        <Field label="Search subject, area or poster">{(id) => <Input id={id} value={q} onChange={(e) => setQ(e.target.value)} />}</Field><Button type="submit">Search</Button></form></Card>
      <Loaded load={load} empty={(d) => d.posts.length ? null : { title: 'No posts', body: 'Nothing matches these filters.' }}>
        {(d) => <Card pad={false}><ul className="divide-y divide-gray-100">{d.posts.map((p) => <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm"><span><strong>{p.subject} · {p.class_name}</strong> · {p.area} · {taka(p.budget)} · by {p.owner_name} · {fmtDate(p.created_at)} · {p.applicants} applicants</span><span className="flex items-center gap-2"><Chip>{statusLabel(p.status)}</Chip>{p.status !== 'closed' && <Button size="sm" variant="destructive" loading={busy} onClick={() => { const reason = window.prompt('Reason for closing (recorded in the audit log)'); if (reason) void run(async () => { await A.setPost(p.id, 'closed', reason); await load.reload() }, 'Post closed.') }}>Close</Button>}</span></li>)}</ul></Card>}
      </Loaded>
    </div>
  )
}

export function Matches() {
  const [status, setStatus] = useState('')
  const load = useLoad(() => A.engagements({ status }), [status])
  return (
    <div className="space-y-4">
      <PageTitle title="Matches" sub="Tuitions between tutors and families, from demo-class request to completion." />
      <div className="max-w-xs"><Field label="Status">{(id) => <Select id={id} value={status} onChange={(e) => setStatus(e.target.value)} options={[{ value: '', label: 'All' }, ...['trial_requested', 'trial_scheduled', 'proposed', 'active', 'completed', 'cancelled'].map((v) => ({ value: v, label: statusLabel(v) }))]} />}</Field></div>
      <Loaded load={load} empty={(d) => d.engagements.length ? null : { title: 'No tuitions', body: 'Nothing matches.' }}>
        {(d) => <Card pad={false}><ul className="divide-y divide-gray-100">{d.engagements.map((e) => <li key={e.id} className="flex flex-wrap justify-between gap-2 p-3 text-sm"><span><strong>{e.subject} · {e.class_name}</strong> · tutor {e.tutor_name} · {e.guardian_name ?? e.student_name ?? '—'} · {taka(e.monthly_fee)} · {fmtDate(e.created_at)}</span><Chip>{statusLabel(e.status)}</Chip></li>)}</ul></Card>}
      </Loaded>
    </div>
  )
}

/** Support queue filtered to the categories a nav entry covers. */
export function Tickets({ title, sub, categories }: { title: string; sub: string; categories: string[] }) {
  const { toast } = useStore()
  const [status, setStatus] = useState('open')
  const [category, setCategory] = useState(categories.length === 1 ? categories[0] : '')
  const load = useLoad(async () => {
    const r = await A.tickets({ status, category })
    return r.tickets.filter((t) => categories.includes(t.category))
  }, [status, category])
  const [open, setOpen] = useState<Ticket | null>(null)
  const [form, setForm] = useState({ status: 'in_progress', resolution: '' })
  const { busy, run } = useAction(toast)
  return (
    <div className="space-y-4">
      <PageTitle title={title} sub={sub} />
      <div className="grid max-w-lg gap-3 sm:grid-cols-2">
        <Field label="Status">{(id) => <Select id={id} value={status} onChange={(e) => setStatus(e.target.value)} options={[{ value: '', label: 'All' }, ...['open', 'in_progress', 'resolved', 'closed'].map((v) => ({ value: v, label: statusLabel(v) }))]} />}</Field>
        {categories.length > 1 && <Field label="Type">{(id) => <Select id={id} value={category} onChange={(e) => setCategory(e.target.value)} options={[{ value: '', label: 'All' }, ...categories.map((v) => ({ value: v, label: statusLabel(v) }))]} />}</Field>}
      </div>
      <Loaded load={load} empty={(d) => d.length ? null : { title: 'Nothing here', body: 'No requests match these filters.' }}>
        {(d) => <div className="space-y-3">{d.map((t) => <Card key={t.id}><div className="flex flex-wrap justify-between gap-2"><div><p className="font-semibold">{t.title}</p><p className="text-xs text-gray-600">{statusLabel(t.category)} · from {t.reporter_name ?? 'deleted user'}{t.subject_name ? ` · about ${t.subject_name}` : ''} · {fmtDateTime(t.created_at)}</p><p className="mt-1 whitespace-pre-wrap text-sm">{t.body}</p>{t.resolution && <p className="mt-1 text-sm text-gray-600">Resolution: {t.resolution}</p>}</div><div className="text-right"><Chip tone={t.status === 'open' ? 'amber' : t.status === 'in_progress' ? 'blue' : 'green'}>{statusLabel(t.status)}</Chip><Button className="mt-2" size="sm" variant="secondary" onClick={() => { setOpen(t); setForm({ status: t.status === 'open' ? 'in_progress' : t.status, resolution: t.resolution ?? '' }) }}>Update</Button></div></div></Card>)}</div>}
      </Loaded>
      <Modal open={!!open} onClose={() => setOpen(null)} title="Update request" footer={<><Button variant="secondary" onClick={() => setOpen(null)}>Cancel</Button><Button loading={busy} onClick={() => open && void run(async () => { await A.updateTicket(open.id, form.status, form.resolution); setOpen(null); await load.reload() }, 'Updated. The reporter was notified.')}>Save</Button></>}>
        <div className="grid gap-3"><Field label="Status">{(id) => <Select id={id} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} options={['open', 'in_progress', 'resolved', 'closed'].map((v) => ({ value: v, label: statusLabel(v) }))} />}</Field><Field label="Response to the reporter" hint="Required to resolve or close">{(id) => <Textarea id={id} value={form.resolution} onChange={(e) => setForm({ ...form, resolution: e.target.value })} />}</Field></div>
      </Modal>
    </div>
  )
}

export function Safety() {
  const sus = useLoad(() => A.suspicious(), [])
  return (
    <div className="space-y-6">
      <Tickets title="Safety" sub="Safety concerns and reports about users and posts." categories={['safety', 'report_user', 'report_post']} />
      <Section title="Suspicious activity">
        <p className="mb-2 text-sm text-gray-600">Accounts with 5+ failed sign-ins in 7 days or 2+ reports in 30 days.</p>
        <Loaded load={sus} empty={(d) => d.accounts.length ? null : { title: 'Nothing flagged', body: 'No accounts meet the thresholds right now.' }}>
          {(d) => <ul className="divide-y divide-gray-100">{d.accounts.map((a) => <li key={a.id} className="flex flex-wrap justify-between gap-2 py-2 text-sm"><span>{a.name} · {a.email} · {a.role} · {statusLabel(a.account_status)}</span><span>{a.failed_logins} failed sign-ins · {a.reports} reports</span></li>)}</ul>}
        </Loaded>
      </Section>
    </div>
  )
}

export function Reviews() {
  const load = useLoad(() => A.reviews(), [])
  return (
    <div className="space-y-4">
      <PageTitle title="Reviews" sub="Every review left after a tuition. Report abusive reviews through Complaints." />
      <Loaded load={load} empty={(d) => d.reviews.length ? null : { title: 'No reviews yet', body: 'Reviews appear after tuitions.' }}>
        {(d) => <Card pad={false}><ul className="divide-y divide-gray-100">{d.reviews.map((r) => <li key={r.id} className="p-3 text-sm"><p><span className="text-warning-600">{'★'.repeat(r.stars)}</span> · {r.by} → {r.subject_name} · {r.subject} · {fmtDate(r.created_at)}</p>{r.body && <p className="mt-1">{r.body}</p>}{r.reply && <p className="mt-1 text-gray-600">Reply: {r.reply}</p>}</li>)}</ul></Card>}
      </Loaded>
    </div>
  )
}

export function Payments() {
  const [status, setStatus] = useState('disputed')
  const load = useLoad(() => A.payments({ status }), [status])
  return (
    <div className="space-y-4">
      <PageTitle title="Payments" sub="Fees recorded between tutors and families. TuitionHub does not hold money; disputes go through Complaints." />
      <div className="max-w-xs"><Field label="Status">{(id) => <Select id={id} value={status} onChange={(e) => setStatus(e.target.value)} options={[{ value: '', label: 'All' }, ...['due', 'marked_paid', 'confirmed', 'disputed'].map((v) => ({ value: v, label: statusLabel(v) }))]} />}</Field></div>
      <Loaded load={load} empty={(d) => d.payments.length ? null : { title: 'No payments', body: 'Nothing matches.' }}>
        {(d) => <Card pad={false}><ul className="divide-y divide-gray-100">{d.payments.map((p) => <li key={p.id} className="flex flex-wrap justify-between gap-2 p-3 text-sm"><span>{p.month} · {p.subject} · tutor {p.tutor_name} · {p.client_name ?? '—'} · {taka(p.amount)}{p.note ? ` · “${p.note}”` : ''}</span><Chip tone={p.status === 'disputed' ? 'red' : p.status === 'confirmed' ? 'green' : 'amber'}>{statusLabel(p.status)}</Chip></li>)}</ul></Card>}
      </Loaded>
    </div>
  )
}

export function Awards() {
  const { toast } = useStore()
  const [q, setQ] = useState('')
  const [found, setFound] = useState<{ id: string; name: string; email: string; role: string }[]>([])
  const [target, setTarget] = useState<{ id: string; name: string } | null>(null)
  const [form, setForm] = useState({ title: '', description: '' })
  const { busy, run } = useAction(toast)
  return (
    <div className="space-y-4">
      <PageTitle title="Awards" sub="Recognise tutors and coaching centres. Awards show on their public profile." />
      <Card><form className="flex flex-wrap items-end gap-2" onSubmit={async (e) => { e.preventDefault(); const r = await getAdminUsers({ q, limit: 20 }); setFound(r.users.filter((u) => u.role === 'tutor' || u.role === 'coaching')) }}><Field label="Find a tutor or centre">{(id) => <Input id={id} value={q} onChange={(e) => setQ(e.target.value)} />}</Field><Button type="submit">Search</Button></form>
        <ul className="mt-3 divide-y divide-gray-100">{found.map((u) => <li key={u.id} className="flex items-center justify-between py-2 text-sm"><span>{u.name} · {u.email} · {u.role}</span><Button size="sm" onClick={() => setTarget(u)}>Grant award</Button></li>)}</ul></Card>
      <Modal open={!!target} onClose={() => setTarget(null)} title={`Award for ${target?.name ?? ''}`} footer={<><Button variant="secondary" onClick={() => setTarget(null)}>Cancel</Button><Button loading={busy} disabled={!form.title.trim()} onClick={() => target && void run(async () => { await A.award({ user_id: target.id, ...form }); setTarget(null); setForm({ title: '', description: '' }) }, 'Award granted.')}>Grant</Button></>}>
        <div className="grid gap-3"><Field label="Title">{(id) => <Input id={id} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Top Physics Tutor 2026" />}</Field><Field label="Description">{(id) => <Input id={id} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />}</Field></div>
      </Modal>
    </div>
  )
}

export function Reports({ title = 'Reports' }: { title?: string }) {
  const today = new Date().toISOString().slice(0, 10)
  const [from, setFrom] = useState(new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10))
  const [to, setTo] = useState(today)
  const load = useLoad(() => A.report(from, to), [from, to])
  const sum = (o: unknown) => Object.values((o ?? {}) as Record<string, number>).reduce((a, b) => a + b, 0)
  const download = (d: Record<string, unknown>) => {
    const rows = Object.entries(d).flatMap(([k, v]) => (v && typeof v === 'object' && !(typeof v === 'string') ? Object.entries(v as Record<string, number>).map(([kk, vv]) => `${k},${kk},${vv}`) : [`${k},,${v}`]))
    const url = URL.createObjectURL(new Blob([`metric,group,value\n${rows.join('\n')}`], { type: 'text/csv' }))
    const a = document.createElement('a'); a.href = url; a.download = `tuitionhub-report-${from}-${to}.csv`; a.click(); URL.revokeObjectURL(url)
  }
  return (
    <div className="space-y-4">
      <PageTitle title={title} sub="Platform activity for the chosen period, computed from the database." />
      <Card><div className="flex flex-wrap items-end gap-3"><Field label="From">{(id) => <Input id={id} type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />}</Field><Field label="To">{(id) => <Input id={id} type="date" value={to} max={today} onChange={(e) => setTo(e.target.value)} />}</Field>{load.data && <Button variant="secondary" onClick={() => download(load.data!)}>Download CSV</Button>}</div></Card>
      <Loaded load={load}>{(d) => (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Sign-ups" value={String(sum(d.signups))} /><StatCard label="Tuition posts" value={String(sum(d.tuition_posts))} /><StatCard label="Applications" value={String(sum(d.applications))} /><StatCard label="Tuitions started" value={String(sum(d.tuitions))} />
            <StatCard label="Verification decisions" value={String(sum(d.verification_decided))} /><StatCard label="Support requests" value={String(sum(d.tickets))} /><StatCard label="Messages" value={String(d.messages ?? 0)} /><StatCard label="Classes held" value={String(d.classes_held ?? 0)} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">{(['signups', 'tuitions', 'applications', 'verification_decided', 'tickets', 'tuition_posts'] as const).map((k) => <Section key={k} title={statusLabel(k)}><dl className="divide-y divide-gray-100 text-sm">{Object.entries((d[k] ?? {}) as Record<string, number>).map(([kk, v]) => <div key={kk} className="flex justify-between py-1.5"><dt className="text-gray-600">{statusLabel(kk)}</dt><dd className="font-semibold">{v}</dd></div>)}{Object.keys((d[k] ?? {}) as object).length === 0 && <p className="text-gray-600">None in this period.</p>}</dl></Section>)}</div>
        </>
      )}</Loaded>
    </div>
  )
}

export function Settings() {
  const { toast } = useStore()
  const load = useLoad(() => A.settings(), [])
  const [form, setForm] = useState<Record<string, string | number | boolean>>({})
  const [ann, setAnn] = useState({ role: '', title: '', body: '' })
  const { busy, run } = useAction(toast)
  useEffect(() => { if (load.data) setForm(load.data.settings) }, [load.data])
  const LABELS: Record<string, string> = { registrations_open: 'Allow new registrations', tutor_applications_open: 'Allow tutor applications', max_applications_per_day: 'Max applications per tutor per day', support_email: 'Support email shown to users', maintenance_banner: 'Maintenance banner text' }
  return (
    <div className="space-y-4">
      <PageTitle title="Settings" sub="Platform-wide settings. Every change is audited." />
      <Loaded load={load}>{() => (
        <Card><div className="grid gap-3 sm:grid-cols-2">{Object.entries(form).map(([k, v]) => typeof v === 'boolean'
          ? <label key={k} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={v} onChange={(e) => setForm({ ...form, [k]: e.target.checked })} />{LABELS[k] ?? k}</label>
          : <Field key={k} label={LABELS[k] ?? k}>{(id) => <Input id={id} type={typeof v === 'number' ? 'number' : 'text'} value={String(v)} onChange={(e) => setForm({ ...form, [k]: typeof v === 'number' ? Number(e.target.value) : e.target.value })} />}</Field>)}</div>
          <Button className="mt-4" loading={busy} onClick={() => void run(async () => { await A.saveSettings(form); await load.reload() }, 'Settings saved.')}>Save settings</Button></Card>
      )}</Loaded>
      <Section title="Send an announcement">
        <div className="grid gap-3 sm:grid-cols-2"><Field label="To">{(id) => <Select id={id} value={ann.role} onChange={(e) => setAnn({ ...ann, role: e.target.value })} options={[{ value: '', label: 'Everyone' }, { value: 'tutor', label: 'Tutors' }, { value: 'coaching', label: 'Coaching centres' }, { value: 'parent', label: 'Parents' }, { value: 'student', label: 'Students' }]} />}</Field><Field label="Title">{(id) => <Input id={id} value={ann.title} maxLength={180} onChange={(e) => setAnn({ ...ann, title: e.target.value })} />}</Field>
          <div className="sm:col-span-2"><Field label="Message">{(id) => <Textarea id={id} value={ann.body} onChange={(e) => setAnn({ ...ann, body: e.target.value })} />}</Field></div></div>
        <Button className="mt-3" loading={busy} disabled={!ann.title.trim() || !ann.body.trim()} onClick={() => { if (window.confirm('Send this announcement as a notification?')) void run(async () => { const r = await A.announce(ann); toast(`Sent to ${r.recipients} account${r.recipients === 1 ? '' : 's'}.`, 'success'); setAnn({ role: '', title: '', body: '' }) }) }}>Send</Button>
      </Section>
    </div>
  )
}

/** Admin view of one account's activity. */
export function UserDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const load = useLoad(() => A.user(id), [id])
  return (
    <Modal open onClose={onClose} title="Account details">
      <Loaded load={load}>{(d) => (
        <div className="space-y-3 text-sm">
          <dl className="grid gap-2 sm:grid-cols-2">{Object.entries(d.user).filter(([k]) => k !== 'id').map(([k, v]) => <div key={k}><dt className="text-gray-600">{statusLabel(k)}</dt><dd className="font-medium break-all">{k === 'created_at' ? fmtDate(String(v)) : String(v ?? '—')}</dd></div>)}</dl>
          <h3 className="font-semibold">Activity</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{Object.entries(d.activity).map(([k, v]) => <StatCard key={k} label={statusLabel(k)} value={String(v)} />)}</div>
          {d.profile && <><h3 className="font-semibold">Profile</h3><dl className="grid gap-2 sm:grid-cols-2">{Object.entries(d.profile).filter(([, v]) => v !== null && v !== '').map(([k, v]) => <div key={k}><dt className="text-gray-600">{statusLabel(k)}</dt><dd className="break-words">{Array.isArray(v) ? v.join(', ') : String(v)}</dd></div>)}</dl></>}
        </div>
      )}</Loaded>
    </Modal>
  )
}
