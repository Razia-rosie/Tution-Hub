import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Button, Card, Chip, Field, Input, Modal, Select, Textarea } from '../components/ui'
import { useStore } from '../lib/store'
import { platform, taka, fmtDate, fmtDateTime, type Engagement, type Payment } from '../lib/platform'
import { useAction, useLoad } from '../lib/useLoad'
import { Loaded, PageTitle, statusLabel } from './common'

const TONE: Record<string, 'green' | 'blue' | 'amber' | 'red' | 'gray'> = { active: 'green', completed: 'blue', proposed: 'amber', trial_requested: 'amber', trial_scheduled: 'blue', trial_declined: 'red', cancelled: 'gray' }
const LABEL: Record<string, string> = { trial_requested: 'Demo class requested', trial_scheduled: 'Demo class scheduled', trial_declined: 'Demo class declined', proposed: 'Terms proposed', active: 'Active', completed: 'Completed', cancelled: 'Cancelled' }
const thisMonth = () => new Date().toISOString().slice(0, 7)

type TermsForm = { days: string; time_slot: string; mode: string; location_note: string; monthly_fee: string; start_date: string }

/**
 * Tuition agreements for the signed-in user, from demo-class request to
 * completion. `filter` narrows to active/past for screens like My Students.
 */
export default function Tuitions({ title = 'Tuitions', sub, filter }: { title?: string; sub?: string; filter?: 'active' }) {
  const { user, toast } = useStore()
  const nav = useNavigate()
  const load = useLoad(() => platform.engagements(), [])
  const { busy, run } = useAction(toast)
  const [terms, setTerms] = useState<{ e: Engagement; form: TermsForm } | null>(null)
  const [cancel, setCancel] = useState<{ e: Engagement; reason: string } | null>(null)
  const [review, setReview] = useState<{ e: Engagement; stars: number; body: string } | null>(null)
  const [ledger, setLedger] = useState<Engagement | null>(null)
  const isTutor = user?.role === 'tutor'
  const act = (e: Engagement, body: Record<string, unknown>, msg: string) => run(async () => { await platform.actOnEngagement(e.id, body); await load.reload() }, msg)
  const confirmedByMe = (e: Engagement) => (isTutor ? !!e.tutor_confirmed_at : !!e.client_confirmed_at)

  return (
    <div className="space-y-4">
      <PageTitle title={title} sub={sub ?? 'Demo classes, agreed terms and active tuitions. Contact details are shared once both sides confirm.'} />
      <Loaded load={load} empty={(d) => d.engagements.filter((e) => !filter || e.status === 'active').length ? null : { title: filter ? 'No active tuitions yet' : 'No tuitions yet', body: isTutor ? 'Apply to tuition posts; guardians request demo classes from your conversations.' : 'Start a conversation with a tutor, then request a demo class from here or from Messages.' }}>
        {(d) => <div className="space-y-3">{d.engagements.filter((e) => !filter || e.status === 'active').map((e) => {
          const other = isTutor ? (e.guardian_name ?? e.student_name ?? 'Guardian') : e.tutor_name
          return (
            <Card key={e.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-heading text-lg font-bold text-navy-900">{e.subject} · {e.class_name}</p>
                  <p className="text-sm text-gray-600">With {other}{e.student_name && !isTutor ? ` · for ${e.student_name}` : e.student_name ? ` · student ${e.student_name}` : ''}</p>
                  <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                    {e.trial_at && <div><dt className="inline text-gray-600">Demo class: </dt><dd className="inline">{fmtDateTime(e.trial_at)}{e.trial_note ? ` (${e.trial_note})` : ''}</dd></div>}
                    {e.monthly_fee != null && <div><dt className="inline text-gray-600">Fee: </dt><dd className="inline">{taka(e.monthly_fee)} / month</dd></div>}
                    {(e.days || e.time_slot) && <div><dt className="inline text-gray-600">Schedule: </dt><dd className="inline">{[e.days, e.time_slot].filter(Boolean).join(' · ')}</dd></div>}
                    {e.start_date && <div><dt className="inline text-gray-600">Starts: </dt><dd className="inline">{fmtDate(e.start_date)}</dd></div>}
                    <div><dt className="inline text-gray-600">Mode: </dt><dd className="inline">{statusLabel(e.mode)}</dd></div>
                    {e.location_note && <div><dt className="inline text-gray-600">Location: </dt><dd className="inline">{e.location_note}</dd></div>}
                    {e.contact && <div className="sm:col-span-2"><dt className="inline text-gray-600">Contact: </dt><dd className="inline">{e.contact.email}{e.contact.phone ? ` · ${e.contact.phone}` : ''}</dd></div>}
                    {e.cancel_reason && <div className="sm:col-span-2"><dt className="inline text-gray-600">Cancelled: </dt><dd className="inline">{e.cancel_reason}</dd></div>}
                  </dl>
                  {e.status === 'proposed' && <p className="mt-2 text-sm">{confirmedByMe(e) ? 'You confirmed these terms. Waiting for the other side.' : 'Review the terms and confirm to start the tuition.'}</p>}
                </div>
                <Chip tone={TONE[e.status] ?? 'gray'}>{LABEL[e.status] ?? e.status}</Chip>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {isTutor && e.status === 'trial_requested' && <><Button size="sm" loading={busy} onClick={() => void act(e, { action: 'accept_trial' }, 'Demo class accepted.')}>Accept demo class</Button><Button size="sm" variant="secondary" loading={busy} onClick={() => void act(e, { action: 'decline_trial' }, 'Demo class declined.')}>Decline</Button></>}
                {(e.status === 'trial_scheduled' || e.status === 'proposed' || e.status === 'trial_declined') && <Button size="sm" variant={e.status === 'proposed' ? 'secondary' : 'primary'} onClick={() => setTerms({ e, form: { days: e.days ?? '', time_slot: e.time_slot ?? '', mode: e.mode, location_note: e.location_note ?? '', monthly_fee: e.monthly_fee != null ? String(e.monthly_fee) : '', start_date: e.start_date?.slice(0, 10) ?? '' } })}>{e.status === 'proposed' ? 'Change terms' : 'Propose terms'}</Button>}
                {e.status === 'proposed' && !confirmedByMe(e) && <Button size="sm" loading={busy} onClick={() => void act(e, { action: 'confirm' }, 'Confirmed.')}>Confirm terms</Button>}
                {e.classroom_id && <Button size="sm" variant="secondary" onClick={() => nav(`/app/${user?.role}/${user?.role === 'tutor' ? 'schedule' : user?.role === 'student' ? 'schedule' : 'schedule'}/${e.classroom_id}`)}>Open classroom</Button>}
                {e.conversation_id && <Button size="sm" variant="secondary" onClick={() => nav(`/app/${user?.role}/messages/${e.conversation_id}`)}>Message</Button>}
                {(e.status === 'active' || e.status === 'completed') && <Button size="sm" variant="secondary" onClick={() => setLedger(e)}>Payments</Button>}
                {!isTutor && (e.status === 'active' || e.status === 'completed') && <Button size="sm" variant="secondary" onClick={() => setReview({ e, stars: 5, body: '' })}>Review tutor</Button>}
                {e.status === 'active' && <Button size="sm" variant="secondary" loading={busy} onClick={() => { if (window.confirm('Mark this tuition as completed?')) void act(e, { action: 'complete' }, 'Tuition completed.') }}>Mark completed</Button>}
                {e.status !== 'completed' && e.status !== 'cancelled' && <Button size="sm" variant="tertiary" onClick={() => setCancel({ e, reason: '' })}>Cancel</Button>}
              </div>
            </Card>
          )
        })}</div>}
      </Loaded>

      <Modal open={!!terms} onClose={() => setTerms(null)} title="Tuition terms" footer={<><Button variant="secondary" onClick={() => setTerms(null)}>Cancel</Button><Button loading={busy} disabled={!terms?.form.monthly_fee || !terms?.form.start_date} onClick={() => terms && void act(terms.e, { action: 'propose', ...terms.form, monthly_fee: Number(terms.form.monthly_fee) }, 'Terms proposed.').then((ok) => ok && setTerms(null))}>Propose</Button></>}>
        {terms && <div className="grid gap-3 sm:grid-cols-2">
          {([['days', 'Days', 'Sun, Tue, Thu'], ['time_slot', 'Time', '6:30–7:30 PM'], ['location_note', 'Location', 'Area or online link']] as const).map(([k, label, ph]) => <Field key={k} label={label}>{(id) => <Input id={id} value={terms.form[k]} placeholder={ph} onChange={(ev) => setTerms({ ...terms, form: { ...terms.form, [k]: ev.target.value } })} />}</Field>)}
          <Field label="Mode">{(id) => <Select id={id} value={terms.form.mode} onChange={(ev) => setTerms({ ...terms, form: { ...terms.form, mode: ev.target.value } })} options={['offline', 'online']} />}</Field>
          <Field label="Monthly fee (৳)">{(id) => <Input id={id} type="number" min={0} value={terms.form.monthly_fee} onChange={(ev) => setTerms({ ...terms, form: { ...terms.form, monthly_fee: ev.target.value } })} />}</Field>
          <Field label="Start date">{(id) => <Input id={id} type="date" value={terms.form.start_date} onChange={(ev) => setTerms({ ...terms, form: { ...terms.form, start_date: ev.target.value } })} />}</Field>
          <p className="text-xs text-gray-600 sm:col-span-2">Proposing new terms resets the other side's confirmation.</p>
        </div>}
      </Modal>
      <Modal open={!!cancel} onClose={() => setCancel(null)} title="Cancel tuition" footer={<><Button variant="secondary" onClick={() => setCancel(null)}>Keep</Button><Button variant="destructive" loading={busy} disabled={(cancel?.reason.trim().length ?? 0) < 5} onClick={() => cancel && void act(cancel.e, { action: 'cancel', reason: cancel.reason }, 'Tuition cancelled.').then((ok) => ok && setCancel(null))}>Cancel tuition</Button></>}>
        {cancel && <Field label="Reason" hint="Shared with the other side.">{(id) => <Textarea id={id} value={cancel.reason} onChange={(ev) => setCancel({ ...cancel, reason: ev.target.value })} />}</Field>}
      </Modal>
      <Modal open={!!review} onClose={() => setReview(null)} title="Review your tutor" footer={<><Button variant="secondary" onClick={() => setReview(null)}>Cancel</Button><Button loading={busy} onClick={() => review && void run(async () => { await platform.review(review.e.id, review.stars, review.body); setReview(null) }, 'Thank you for your review.')}>Submit review</Button></>}>
        {review && <div className="space-y-3"><Field label="Rating">{(id) => <Select id={id} value={String(review.stars)} onChange={(ev) => setReview({ ...review, stars: Number(ev.target.value) })} options={[5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: `${n} star${n === 1 ? '' : 's'}` }))} />}</Field><Field label="Your review">{(id) => <Textarea id={id} value={review.body} maxLength={2000} onChange={(ev) => setReview({ ...review, body: ev.target.value })} />}</Field></div>}
      </Modal>
      {ledger && <Ledger e={ledger} onClose={() => setLedger(null)} />}
    </div>
  )
}

/** Monthly fee tracking for one tuition. TuitionHub records payments; it does not move money. */
function Ledger({ e, onClose }: { e: Engagement; onClose: () => void }) {
  const { user, toast } = useStore()
  const load = useLoad(() => platform.payments(e.id), [e.id])
  const { busy, run } = useAction(toast)
  const [month, setMonth] = useState(thisMonth())
  const isTutor = user?.id === e.tutor_id
  const doIt = (p: Payment | null, action: string, m: string, msg: string) => {
    let note = ''
    if (action === 'dispute') { note = window.prompt('What is wrong with this payment?') ?? ''; if (note.trim().length < 5) return }
    if (action === 'mark_paid') note = window.prompt('Payment method or reference (optional)') ?? ''
    void run(async () => { await platform.paymentAction(e.id, action, p?.month ?? m, note); await load.reload() }, msg)
  }
  return (
    <Modal open onClose={onClose} title={`Payments · ${e.subject}`}>
      <p className="text-sm text-gray-600">TuitionHub records payments; money is paid directly between you. Fee: {taka(e.monthly_fee)} / month.</p>
      {isTutor && <div className="mt-3 flex items-end gap-2"><Field label="Month">{(id) => <Input id={id} type="month" value={month} onChange={(ev) => setMonth(ev.target.value)} />}</Field><Button loading={busy} onClick={() => doIt(null, 'due', month, 'Month recorded as due.')}>Record due</Button></div>}
      <Loaded load={load} empty={(d) => d.payments.length ? null : { title: 'No payments recorded', body: isTutor ? 'Record a month as due above.' : 'Your tutor records each month as due.' }}>
        {(d) => <ul className="mt-3 space-y-2">{d.payments.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-input border border-gray-200 p-3 text-sm">
            <span><strong>{p.month}</strong> · {taka(p.amount)}{p.note ? ` · ${p.note}` : ''}</span>
            <span className="flex flex-wrap items-center gap-2"><Chip tone={p.status === 'confirmed' ? 'green' : p.status === 'disputed' ? 'red' : 'amber'}>{statusLabel(p.status)}</Chip>
              {!isTutor && (p.status === 'due' || p.status === 'disputed') && <Button size="sm" loading={busy} onClick={() => doIt(p, 'mark_paid', p.month, 'Marked as paid.')}>Mark paid</Button>}
              {isTutor && p.status === 'marked_paid' && <Button size="sm" loading={busy} onClick={() => doIt(p, 'confirm', p.month, 'Receipt confirmed.')}>Confirm received</Button>}
              {(p.status === 'marked_paid' || p.status === 'due') && <Button size="sm" variant="tertiary" onClick={() => doIt(p, 'dispute', p.month, 'Dispute recorded.')}>Dispute</Button>}
            </span>
          </li>))}</ul>}
      </Loaded>
    </Modal>
  )
}

/** All payment records across the user's tuitions. */
export function PaymentsOverview() {
  const load = useLoad(async () => {
    const { engagements } = await platform.engagements()
    const withPay = engagements.filter((e) => e.status === 'active' || e.status === 'completed')
    const rows = await Promise.all(withPay.map(async (e) => ({ e, payments: (await platform.payments(e.id)).payments })))
    return rows
  }, [])
  const [ledger, setLedger] = useState<Engagement | null>(null)
  return (
    <div className="space-y-4">
      <PageTitle title="Payments" sub="Monthly fees tracked for your tuitions. TuitionHub does not process money." />
      <Loaded load={load} empty={(d) => d.length ? null : { title: 'No active tuitions', body: 'Payments appear once a tuition is confirmed.' }}>
        {(d) => <div className="space-y-3">{d.map(({ e, payments }) => {
          const confirmed = payments.filter((p) => p.status === 'confirmed').reduce((a, p) => a + p.amount, 0)
          const open = payments.filter((p) => p.status !== 'confirmed').length
          return <Card key={e.id}><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-semibold">{e.subject} · {e.class_name}</p><p className="text-sm text-gray-600">{taka(confirmed)} confirmed · {open} open month{open === 1 ? '' : 's'}</p></div><Button size="sm" variant="secondary" onClick={() => setLedger(e)}>Open ledger</Button></div></Card>
        })}</div>}
      </Loaded>
      {ledger && <Ledger e={ledger} onClose={() => { setLedger(null); void load.reload() }} />}
    </div>
  )
}

/** Request a demo class with a tutor the user is already talking to. */
export function RequestDemoClass({ tutorId, tutorName, onDone }: { tutorId: string; tutorName: string; onDone: () => void }) {
  const { user, toast } = useStore()
  const links = useLoad(() => (user?.role === 'parent' ? platform.links() : Promise.resolve({ links: [] })), [user?.role])
  const [form, setForm] = useState({ subject: '', class_name: '', mode: 'offline', trial_at: '', trial_note: '', student_id: '' })
  const { busy, run } = useAction(toast)
  const children = links.data?.links.filter((l) => l.status === 'approved') ?? []
  return (
    <Modal open onClose={onDone} title={`Request a demo class with ${tutorName}`} footer={<><Button variant="secondary" onClick={onDone}>Cancel</Button><Button loading={busy} disabled={!form.subject || !form.class_name || !form.trial_at} onClick={() => void run(async () => { await platform.createEngagement({ tutor_id: tutorId, ...form, trial_at: new Date(form.trial_at).toISOString(), student_id: form.student_id || undefined }); onDone() }, 'Demo class requested.')}>Request</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        {user?.role === 'parent' && <Field label="For which child">{(id) => <Select id={id} value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })} options={[{ value: '', label: 'Not specified' }, ...children.map((c) => ({ value: c.student_id, label: c.student_name }))]} />}</Field>}
        <Field label="Subject">{(id) => <Input id={id} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />}</Field>
        <Field label="Class">{(id) => <Input id={id} value={form.class_name} onChange={(e) => setForm({ ...form, class_name: e.target.value })} />}</Field>
        <Field label="Mode">{(id) => <Select id={id} value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })} options={['offline', 'online']} />}</Field>
        <Field label="Demo class date and time">{(id) => <Input id={id} type="datetime-local" value={form.trial_at} onChange={(e) => setForm({ ...form, trial_at: e.target.value })} />}</Field>
        <div className="sm:col-span-2"><Field label="Note">{(id) => <Input id={id} value={form.trial_note} onChange={(e) => setForm({ ...form, trial_note: e.target.value })} />}</Field></div>
      </div>
    </Modal>
  )
}
