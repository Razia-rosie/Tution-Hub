import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Bell, Plus, Send } from 'lucide-react'
import { MONTH, ORG, AREAS, LEVELS, SUBJECT_LIST, fmtDay, fmtMoney, maskParentPhone, type CJ } from '../../lib/coaching'
import { maskEmail } from '../../lib/validate'
import { Avatar, Button, Card, Chip, DemoTag, EmptyState, Field, Input, Select, Tabs, Textarea, Toggle, VerifyBadge, btnClass, cx } from '../../components/ui'
import { Masked, PageHead } from '../../components/tutor/bits'
import { A, CheckRow, ConfirmModal, DataTable, ReadOnlyBar, useCo } from './kit'

const sName = (cj: CJ, id: string) => cj.students.find((s) => s.id === id)?.name ?? 'Removed student'

/* ---------------- Payments ---------------- */
export function Payments() {
  const { cj, set, w, off, toast } = useCo()
  const [paying, setPaying] = useState<string | null>(null); const [add, setAdd] = useState(false)
  const fee = cj.fees.find((f) => f.id === paying)
  const sum = (st: string) => cj.fees.filter((f) => f.state === st).reduce((a, f) => a + f.amount, 0)
  const missing = cj.students.filter((s) => s.status === 'active' && !cj.fees.some((f) => f.studentId === s.id && f.month === MONTH))
  const remind = (ids: string[]) => { set((c) => ({ fees: c.fees.map((f) => (ids.includes(f.id) && f.state !== 'paid' ? { ...f, reminded: off } : f)) })); toast(`Reminder sent for ${ids.length} fee${ids.length > 1 ? 's' : ''} (Demo, no real message)`, 'info') }
  return (
    <div>
      <PageHead title="Payments" tag="CO-28" sub="Track monthly fees you collect from students. TuitionHub does not process these payments." actions={<Button variant="secondary" disabled={!w || missing.length === 0} onClick={() => setAdd(true)} icon={<Plus size={16} aria-hidden />}>Add monthly fees</Button>} />
      <ReadOnlyBar what="Marking fees paid and sending reminders" />
      <p className="mb-4 flex items-center gap-2 text-xs text-gray-600"><DemoTag /> Fee tracking only. No money moves through this screen.</p>
      <div className="mb-6 grid grid-cols-3 gap-3">
        {[['Collected', sum('paid'), 'text-teal-700'], ['Due', sum('due'), 'text-navy-900'], ['Overdue', sum('overdue'), 'text-danger-600']].map(([l, v, c]) => <Card key={l as string} className="!p-4"><p className={cx('font-heading text-xl font-bold tabular sm:text-2xl', c as string)}>{fmtMoney(v as number)}</p><p className="text-xs text-gray-600">{l}</p></Card>)}
      </div>
      <DataTable label="fees" rows={cj.fees} rowId={(f) => f.id} rowLabel={(f) => `${sName(cj, f.studentId)} ${f.month}`} selectable pageSize={8} initialSort={{ key: 'state', dir: -1 }}
        search={{ placeholder: 'Search students', text: (f) => sName(cj, f.studentId) }}
        filters={[{ label: 'Status', options: ['Paid', 'Due', 'Overdue'], test: (f, v) => f.state === v.toLowerCase() }, { label: 'Month', options: [...new Set(cj.fees.map((f) => f.month))], test: (f, v) => f.month === v }]}
        cols={[
          { key: 'n', label: 'Student', primary: true, sort: (f) => sName(cj, f.studentId), cell: (f) => sName(cj, f.studentId) },
          { key: 'm', label: 'Month', sort: (f) => f.month, cell: (f) => f.month },
          { key: 'a', label: 'Amount', right: true, sort: (f) => f.amount, cell: (f) => fmtMoney(f.amount) },
          { key: 'state', label: 'Status', sort: (f) => ['paid', 'due', 'overdue'].indexOf(f.state), cell: (f) => <Chip tone={f.state === 'paid' ? 'green' : f.state === 'due' ? 'amber' : 'red'}>{f.state === 'paid' ? 'Paid' : f.state === 'due' ? 'Due' : 'Overdue'}</Chip> },
          { key: 'r', label: 'Reminder', sort: (f) => f.reminded ?? -99, cell: (f) => (f.state === 'paid' ? '—' : f.reminded === null ? 'Not sent' : `Sent ${fmtDay(f.reminded)}`) },
        ]}
        bulk={(ids, clear) => <Button size="sm" variant="secondary" disabled={!w} icon={<Bell size={14} aria-hidden />} onClick={() => { remind(ids); clear() }}>Send reminder (Demo)</Button>}
        actions={(f) => f.state === 'paid' ? <span className="text-xs text-gray-600">Paid</span> : <><Button size="sm" disabled={!w} onClick={() => setPaying(f.id)} aria-label={`Mark ${sName(cj, f.studentId)} paid`}>Mark paid</Button><Button size="sm" variant="tertiary" disabled={!w} onClick={() => remind([f.id])} aria-label={`Remind ${sName(cj, f.studentId)}`}>Remind</Button></>}
        empty={<EmptyState title="No fee records" body="Add monthly fees for your active students to start tracking." />} />
      <ConfirmModal open={!!fee} danger={false} title="Mark this fee as paid?" confirm="Mark paid" onClose={() => setPaying(null)} onConfirm={() => { set((c) => ({ fees: c.fees.map((f) => (f.id === paying ? { ...f, state: 'paid' as const } : f)) })); toast('Fee marked as paid', 'success') }}>
        {fee && <p>{sName(cj, fee.studentId)}, {fee.month}, {fmtMoney(fee.amount)}. This only updates your tracking record.</p>}
      </ConfirmModal>
      <ConfirmModal open={add} danger={false} title={`Add ${MONTH} fees?`} confirm={`Add ${missing.length} fees`} onClose={() => setAdd(false)} onConfirm={() => { set((c) => ({ fees: [...c.fees, ...missing.map((s, i) => ({ id: `F-${c.seq}-${i}`, studentId: s.id, month: MONTH, amount: 1500, state: 'due' as const, reminded: null }))], seq: c.seq + 1 })); toast(`${missing.length} fee records added`, 'success') }}>
        <p>Adds a ৳1,500 due record for {missing.length} active student{missing.length > 1 ? 's' : ''} without a {MONTH} fee.</p>
      </ConfirmModal>
    </div>
  )
}

/* ---------------- Profile ---------------- */
export function ProfilePage() {
  const { cj, set, w, s, toast } = useCo(); const p = cj.profile
  const [f, setF] = useState(p); const [touched, setTouched] = useState(false)
  const dirty = JSON.stringify(f) !== JSON.stringify(p)
  const tg = (k: 'levels' | 'subjects', v: string) => setF({ ...f, [k]: f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v] })
  const err = { name: f.name.trim().length < 3 ? 'Enter your organization name.' : '', about: f.about.trim().length < 20 ? 'Write at least 20 characters about your coaching.' : '', levels: f.levels.length ? '' : 'Choose at least one level.', subjects: f.subjects.length ? '' : 'Choose at least one subject.', est: /^(19|20)\d{2}$/.test(f.established) ? '' : 'Enter a year such as 2018.' }
  const save = () => { setTouched(true); if (Object.values(err).some(Boolean)) return; set(() => ({ profile: { ...f, name: f.name.trim(), about: f.about.trim() } })); toast('Profile saved', 'success') }
  const e = (k: keyof typeof err) => (touched ? err[k] : '')
  return (
    <div>
      <PageHead title="Profile" tag="CO-29" sub="What students and parents see when they find your coaching." actions={<VerifyBadge kind="organization" active={w} />} />
      <ReadOnlyBar what="Editing your profile and listing" />
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <fieldset disabled={!w} className="space-y-4">
            <legend className="sr-only">Organization profile</legend>
            <Field label="Organization name" error={e('name')}>{(i) => <Input id={i} value={f.name} onChange={(x) => setF({ ...f, name: x.target.value })} aria-invalid={!!e('name')} />}</Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Area">{(i) => <Select id={i} value={f.area} onChange={(x) => setF({ ...f, area: x.target.value })} options={AREAS} />}</Field>
              <Field label="Established" error={e('est')}>{(i) => <Input id={i} inputMode="numeric" maxLength={4} value={f.established} onChange={(x) => setF({ ...f, established: x.target.value })} aria-invalid={!!e('est')} />}</Field>
            </div>
            <Field label="Opening hours">{(i) => <Input id={i} value={f.hours} onChange={(x) => setF({ ...f, hours: x.target.value })} />}</Field>
            <Field label="About" error={e('about')}>{(i) => <Textarea id={i} value={f.about} onChange={(x) => setF({ ...f, about: x.target.value })} aria-invalid={!!e('about')} />}</Field>
            <div><p className="mb-1 text-sm font-semibold text-navy-900">Levels taught</p>{LEVELS.map((l) => <CheckRow key={l} label={l} checked={f.levels.includes(l)} onChange={() => tg('levels', l)} />)}{e('levels') && <p role="alert" className="text-xs text-danger-600">{e('levels')}</p>}</div>
            <div><p className="mb-1 text-sm font-semibold text-navy-900">Subjects</p><div className="grid sm:grid-cols-2">{SUBJECT_LIST.map((l) => <CheckRow key={l} label={l} checked={f.subjects.includes(l)} onChange={() => tg('subjects', l)} />)}</div>{e('subjects') && <p role="alert" className="text-xs text-danger-600">{e('subjects')}</p>}</div>
          </fieldset>
          <div className="mt-6 flex flex-wrap gap-2"><Button disabled={!w || !dirty} onClick={save}>Save changes</Button><Button variant="secondary" disabled={!dirty} onClick={() => { setF(p); setTouched(false) }}>Discard</Button></div>
        </Card>
        <div className="space-y-6">
          <Card>
            <div className="flex items-center justify-between gap-3"><div><h2 className="text-lg">Listed in directory</h2><p className="text-sm text-gray-600">{w ? 'Students and parents can find you in search.' : 'Available after verification.'}</p></div>
              <Toggle label="Listed in directory" checked={w && f.listed} onChange={(v) => w && setF({ ...f, listed: v })} /></div>
          </Card>
          <Card>
            <h2 className="text-lg">Contact (private)</h2>
            <dl className="mt-3 space-y-2 text-sm"><div className="flex justify-between gap-3"><dt className="text-gray-600">Owner</dt><dd className="font-semibold text-navy-900">{ORG.owner}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-gray-600">Phone</dt><dd><Masked value="017•• ••• 678" /></dd></div>
              <div className="flex justify-between gap-3"><dt className="text-gray-600">Email</dt><dd><Masked value={maskEmail('office@scholarspoint.demo')} /></dd></div></dl>
            <p className="mt-3 text-xs text-gray-600">Contact details are never shown on your public profile. {s.isVerified ? '' : 'Complete verification to be listed.'}</p>
          </Card>
        </div>
      </div>
    </div>
  )
}

/* ---------------- Messages ---------------- */
const PHONE_LIKE = /(\+?88)?0?1[3-9][\d\s-]{8,}|\d{9,}/
export function Messages({ sub }: { sub: string }) {
  const { cj, set, w, off, toast } = useCo(); const nav = useNavigate(); const id = sub.split('/').filter(Boolean)[0]
  const t = cj.threads.find((x) => x.id === id); const [text, setText] = useState(''); const [err, setErr] = useState(''); const end = useRef<HTMLDivElement>(null)
  useEffect(() => { if (t && t.unread) set((c) => ({ threads: c.threads.map((x) => (x.id === t.id ? { ...x, unread: 0 } : x)) })) }, [t?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { end.current?.scrollIntoView?.({ block: 'nearest' }) }, [t?.msgs.length])
  const send = () => {
    if (!t) return; const v = text.trim()
    if (!v) { setErr('Write a message first.'); return }
    if (PHONE_LIKE.test(v)) { setErr('Phone numbers cannot be shared in messages. Keep contact details inside TuitionHub.'); return }
    set((c) => ({ threads: c.threads.map((x) => (x.id === t.id ? { ...x, msgs: [...x.msgs, { from: 'me' as const, text: v, day: off }] } : x)) })); setText(''); setErr(''); toast('Message sent (Demo, no real delivery)', 'success')
  }
  const list = (
    <Card pad={false} className={cx('overflow-hidden', id && 'hidden lg:block')}>
      <h2 className="border-b border-gray-100 p-4 text-lg">Conversations</h2>
      {cj.threads.length === 0 ? <EmptyState title="No conversations" body="Start one from a teacher or parent page." /> : (
        <ul>{cj.threads.map((x) => { const last = x.msgs[x.msgs.length - 1]
          return <li key={x.id}><Link to={`${A}/messages/${x.id}`} aria-current={x.id === id ? 'page' : undefined} className={cx('flex min-h-14 items-center gap-3 border-b border-gray-100 p-4 hover:bg-offwhite-50', x.id === id && 'bg-blue-100/60')}>
            <Avatar name={x.withName} /><span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className="truncate font-semibold text-navy-900">{x.withName}</span><Chip tone="gray">{x.kind}</Chip></span><span className="block truncate text-sm text-gray-600">{last ? last.text : 'No messages yet'}</span></span>
            {x.unread > 0 && <span className="rounded-full bg-blue-600 px-2 py-0.5 text-xs font-bold text-white"><span className="sr-only">Unread: </span>{x.unread}</span>}</Link></li> })}</ul>)}
    </Card>)
  return (
    <div>
      <PageHead title="Messages" tag="CO-30" sub="Talk to parents and teachers inside TuitionHub. Phone numbers cannot be shared." actions={<DemoTag label="Demo inbox" />} />
      <ReadOnlyBar what="Sending messages" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_1fr]">
        {list}
        {id && !t ? <EmptyState title="Conversation not found" body="It may belong to another organization." action={<Link to={`${A}/messages`} className={btnClass('secondary')}>Back to conversations</Link>} />
          : t ? (
            <Card pad={false} className="flex min-h-[28rem] flex-col">
              <div className="flex items-center gap-3 border-b border-gray-100 p-4"><button type="button" onClick={() => nav(`${A}/messages`)} className="min-h-11 min-w-11 text-sm font-semibold text-blue-600 lg:hidden">Back</button><Avatar name={t.withName} /><div><h2 className="text-lg">{t.withName}</h2><p className="text-xs text-gray-600">{t.kind}</p></div></div>
              <div className="flex-1 space-y-3 overflow-y-auto p-4" role="log" aria-label={`Messages with ${t.withName}`}>
                {t.msgs.length === 0 && <p className="text-sm text-gray-600">No messages yet. Say hello.</p>}
                {t.msgs.map((m, i) => <div key={i} className={cx('flex', m.from === 'me' && 'justify-end')}><div className={cx('max-w-[85%] rounded-card px-3 py-2 text-sm', m.from === 'me' ? 'bg-navy-900 text-white' : 'bg-gray-100 text-navy-900')}><p>{m.text}</p><p className={cx('mt-1 text-xs', m.from === 'me' ? 'text-white/70' : 'text-gray-600')}>{fmtDay(m.day)}</p></div></div>)}
                <div ref={end} />
              </div>
              <div className="border-t border-gray-100 p-4">
                <Field label="Write a message" error={err}>{(i) => <Textarea id={i} value={text} disabled={!w} rows={2} onChange={(x) => { setText(x.target.value); setErr('') }} aria-invalid={!!err} />}</Field>
                <Button className="mt-2" disabled={!w} onClick={send} icon={<Send size={14} aria-hidden />}>Send</Button>
              </div>
            </Card>
          ) : <Card className="hidden lg:block"><EmptyState title="Select a conversation" body="Choose a conversation on the left to read and reply." /></Card>}
      </div>
    </div>
  )
}

/* ---------------- Notifications ---------------- */
export function Notifications() {
  const { cj, set, toast } = useCo(); const nav = useNavigate(); const [tab, setTab] = useState('All')
  const unread = cj.notifs.filter((n) => !n.read).length
  const rows = tab === 'Unread' ? cj.notifs.filter((n) => !n.read) : cj.notifs
  return (
    <div>
      <PageHead title="Notifications" tag="CO-31" sub="Updates about your classes, students and verification." actions={<Button variant="secondary" size="sm" disabled={unread === 0} onClick={() => { set((c) => ({ notifs: c.notifs.map((n) => ({ ...n, read: true })) })); toast('All notifications marked as read', 'success') }}>Mark all read</Button>} />
      <Tabs tabs={['All', `Unread`]} value={tab} onChange={setTab} />
      <div className="mt-4" role="tabpanel">
        {rows.length === 0 ? <EmptyState title={tab === 'Unread' ? 'You are all caught up' : 'No notifications yet'} body={tab === 'Unread' ? 'There is nothing unread.' : 'Updates appear here as things happen.'} />
          : <Card pad={false}><ul>{rows.map((n) => <li key={n.id} className="flex items-start gap-3 border-b border-gray-100 p-4 last:border-0">
            <span className={cx('mt-2 h-2 w-2 shrink-0 rounded-full', n.read ? 'bg-gray-300' : 'bg-blue-600')} aria-hidden />
            <div className="min-w-0 flex-1"><p className={cx('text-sm', n.read ? 'text-gray-600' : 'font-semibold text-navy-900')}>{!n.read && <span className="sr-only">Unread: </span>}{n.text}</p><p className="text-xs text-gray-600">{fmtDay(n.day)}</p></div>
            <div className="flex shrink-0 flex-wrap gap-1">
              <Button size="sm" variant="secondary" onClick={() => { set((c) => ({ notifs: c.notifs.map((x) => (x.id === n.id ? { ...x, read: true } : x)) })); if (n.to) nav(`${A}/${n.to}`) }}>Open</Button>
              {!n.read && <Button size="sm" variant="tertiary" onClick={() => set((c) => ({ notifs: c.notifs.map((x) => (x.id === n.id ? { ...x, read: true } : x)) }))} aria-label="Mark as read">Mark read</Button>}
            </div></li>)}</ul></Card>}
      </div>
    </div>
  )
}
void maskParentPhone
