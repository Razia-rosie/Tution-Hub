import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Button, Card, Chip, Field, Input, Modal, Select, Textarea } from '../components/ui'
import { useStore } from '../lib/store'
import { platform, taka, fmtDate, fmtDateTime, type Engagement, type Payment } from '../lib/platform'
import { useAction, useLoad } from '../lib/useLoad'
import { Loaded, PageTitle, statusLabel } from './common'

type Tone = 'green' | 'blue' | 'amber' | 'red' | 'gray'
const TONE: Record<string, Tone> = { active: 'green', completed: 'blue', proposed: 'amber', agreed: 'amber', trial_requested: 'amber', trial_scheduled: 'blue', trial_declined: 'red', cancelled: 'gray' }
const LABEL: Record<string, string> = { trial_requested: 'Demo class requested', trial_scheduled: 'Demo class scheduled', trial_declined: 'Demo class declined', proposed: 'Terms proposed', agreed: 'Agreed', active: 'Active (started)', completed: 'Completed', cancelled: 'Cancelled' }
const thisMonth = () => new Date().toISOString().slice(0, 7)
export const monthName = (m: string) => new Date(`${m}-01T00:00:00`).toLocaleString('en-GB', { month: 'long', year: 'numeric' })
export const tuitionRef = (id: string) => `TH-${id.slice(0, 8).toUpperCase()}`
const clientLabel = (e: Engagement) => (e.guardian_id ? 'Guardian' : 'Student')

/**
 * Where a tuition stands on its way to starting. It starts only when both sides
 * agreed, the tutor created the classroom and every invitation was accepted.
 */
export function tuitionStage(e: Engagement): { label: string; tone: Tone } {
  if (e.status === 'agreed') {
    if (!e.classroom_id) return { label: 'Agreed · waiting for the classroom', tone: 'amber' }
    const pending = (e.classroom_requests ?? []).filter((r) => r.status !== 'accepted').length
    return { label: `Agreed · ${pending} classroom invitation${pending === 1 ? '' : 's'} pending`, tone: 'amber' }
  }
  return { label: LABEL[e.status] ?? e.status, tone: TONE[e.status] ?? 'gray' }
}

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
  const agreementShown = (e: Engagement) => ['trial_scheduled', 'proposed', 'agreed', 'active', 'completed'].includes(e.status)

  return (
    <div className="space-y-4">
      <PageTitle title={title} sub={sub ?? 'Demo classes, agreed terms and active tuitions. A tuition starts once both sides agree and everyone joins its classroom; contact details are shared then.'} />
      <Loaded load={load} empty={(d) => d.engagements.filter((e) => !filter || e.status === 'active').length ? null : { title: filter ? 'No active tuitions yet' : 'No tuitions yet', body: isTutor ? 'Apply to tuition posts; guardians request demo classes from your conversations.' : 'Start a conversation with a tutor, then request a demo class from here or from Messages.' }}>
        {(d) => <div className="space-y-3">{d.engagements.filter((e) => !filter || e.status === 'active').map((e) => {
          const other = isTutor ? (e.guardian_name ?? e.student_name ?? 'Guardian') : e.tutor_name
          const stage = tuitionStage(e)
          const requests = e.classroom_requests ?? []
          const mine = requests.find((r) => r.user_id === user?.id)
          const canOpenRoom = !!e.classroom_id && (isTutor || requests.length === 0 || mine?.status === 'accepted')
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
                  {e.status === 'proposed' && <p className="mt-2 text-sm">{confirmedByMe(e) ? 'You agreed to continue on these terms. Waiting for the other side.' : 'Review the terms and agree to continue if they suit you.'}</p>}
                  {agreementShown(e) && <div className="mt-2 text-sm" aria-label="Agreement to continue"><span className="text-gray-600">Agreement to continue: </span>
                    <span>Tutor <Chip tone={e.tutor_confirmed_at ? 'green' : 'amber'}>{e.tutor_confirmed_at ? 'Agreed' : 'Not yet'}</Chip></span>{' '}
                    <span>{clientLabel(e)} <Chip tone={e.client_confirmed_at ? 'green' : 'amber'}>{e.client_confirmed_at ? 'Agreed' : 'Not yet'}</Chip></span>
                    {e.status === 'trial_scheduled' && <p className="mt-1 text-xs text-gray-600">After the demo class, propose terms; both sides then agree to continue. Completing the demo class is not an agreement.</p>}
                  </div>}
                  {e.status === 'agreed' && !e.classroom_id && <p className="mt-2 text-sm">{isTutor ? 'Both sides agreed. Create the classroom to invite the family; the tuition starts when they accept.' : 'Both sides agreed. The tutor will create the classroom and invite you.'}</p>}
                  {requests.length > 0 && <div className="mt-2 text-sm"><span className="text-gray-600">Classroom invitations: </span>{requests.map((r) => <span key={r.id} className="mr-2">{r.name} ({r.participant}) <Chip tone={r.status === 'accepted' ? 'green' : r.status === 'rejected' ? 'red' : 'amber'}>{r.status === 'accepted' ? 'Accepted' : r.status === 'rejected' ? 'Declined' : 'Pending'}</Chip></span>)}</div>}
                </div>
                <Chip tone={stage.tone}>{stage.label}</Chip>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {isTutor && e.status === 'trial_requested' && <><Button size="sm" loading={busy} onClick={() => void act(e, { action: 'accept_trial' }, 'Demo class accepted.')}>Accept demo class</Button><Button size="sm" variant="secondary" loading={busy} onClick={() => void act(e, { action: 'decline_trial' }, 'Demo class declined.')}>Decline</Button></>}
                {(e.status === 'trial_scheduled' || e.status === 'proposed' || e.status === 'trial_declined') && <Button size="sm" variant={e.status === 'proposed' ? 'secondary' : 'primary'} onClick={() => setTerms({ e, form: { days: e.days ?? '', time_slot: e.time_slot ?? '', mode: e.mode, location_note: e.location_note ?? '', monthly_fee: e.monthly_fee != null ? String(e.monthly_fee) : '', start_date: e.start_date?.slice(0, 10) ?? '' } })}>{e.status === 'proposed' ? 'Change terms' : 'Propose terms'}</Button>}
                {e.status === 'proposed' && !confirmedByMe(e) && (isTutor || user?.id === (e.guardian_id ?? e.student_id)) && <Button size="sm" loading={busy} onClick={() => void act(e, { action: 'confirm' }, 'You agreed to continue.')}>Agree to continue</Button>}
                {isTutor && e.status === 'agreed' && !e.classroom_id && <Button size="sm" loading={busy} onClick={() => void act(e, { action: 'create_classroom' }, 'Classroom created. Invitations sent.')}>Create classroom</Button>}
                {mine && mine.status !== 'accepted' && (e.status === 'agreed' || e.status === 'active') && <Button size="sm" loading={busy} onClick={() => void act(e, { action: 'accept_classroom' }, 'You joined the classroom.')}>Accept classroom invitation</Button>}
                {mine?.status === 'pending' && <Button size="sm" variant="secondary" loading={busy} onClick={() => void act(e, { action: 'decline_classroom' }, 'Invitation declined.')}>Decline invitation</Button>}
                {canOpenRoom && <Button size="sm" variant="secondary" onClick={() => nav(`/app/${user?.role}/${user?.role === 'tutor' ? 'schedule' : user?.role === 'student' ? 'schedule' : 'schedule'}/${e.classroom_id}`)}>Open classroom</Button>}
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

const COMPLETION: Record<string, string> = { not_started: 'Not started', in_progress: 'In progress', month_completed: 'Month completed' }
const PAYMENT: Record<string, string> = { payment_due: 'Payment due', payment_submitted: 'Payment submitted', confirmed_paid: 'Confirmed paid', disputed: 'Disputed' }
const PAYMENT_TONE: Record<string, Tone> = { payment_due: 'amber', payment_submitted: 'blue', confirmed_paid: 'green', disputed: 'red' }

/**
 * Monthly completion and fee tracking for one tuition. The tutor marks a month
 * completed, the payer submits a payment confirmation and the tutor confirms or
 * disputes it. TuitionHub records payments; it does not move money.
 */
function Ledger({ e, onClose }: { e: Engagement; onClose: () => void }) {
  const { user, toast } = useStore()
  const load = useLoad(() => platform.payments(e.id), [e.id])
  const { busy, run } = useAction(toast)
  const [month, setMonth] = useState(thisMonth())
  const [pay, setPay] = useState<{ p: Payment; amount: string; method: string; reference: string } | null>(null)
  const [dispute, setDispute] = useState<{ p: Payment; reason: string } | null>(null)
  const [howTo, setHowTo] = useState<{ body: string; month: string } | null>(null)
  const isTutor = user?.id === e.tutor_id
  const isPayer = user?.id === (e.guardian_id ?? e.student_id)
  const doIt = (action: string, m: string, msg: string, note = '', extra = {}) => run(async () => { await platform.paymentAction(e.id, action, m, note, extra); await load.reload() }, msg)
  const current = thisMonth()
  const currentStatus = e.start_date && e.start_date.slice(0, 7) > current ? 'not_started' : 'in_progress'
  return (
    <Modal open onClose={onClose} title={`Payments · ${e.subject} · ${tuitionRef(e.id)}`}>
      <p className="text-sm text-gray-600">TuitionHub records payments; money is paid directly between you. Agreed fee: {e.monthly_fee != null ? `${taka(e.monthly_fee)} / month` : 'not set'}.</p>
      {isTutor && e.status === 'active' && <div className="mt-3 flex flex-wrap items-end gap-2">
        <Field label="Month">{(id) => <Input id={id} type="month" value={month} max={current} onChange={(ev) => setMonth(ev.target.value)} />}</Field>
        <Button loading={busy} disabled={!month} onClick={() => void doIt('complete_month', month, 'Month marked completed. A payment reminder was sent.')}>Mark month completed</Button>
        <Button variant="secondary" onClick={() => setHowTo({ body: '', month: '' })}>How to pay</Button>
      </div>}
      {isTutor && e.status === 'completed' && <div className="mt-3"><Button variant="secondary" onClick={() => setHowTo({ body: '', month: '' })}>How to pay</Button></div>}
      <Loaded load={load}>
        {(d) => <ul className="mt-3 space-y-2">
          {e.status === 'active' && !d.payments.some((p) => p.month === current) && <li className="flex flex-wrap items-center justify-between gap-2 rounded-input border border-dashed border-gray-300 p-3 text-sm"><span><strong>{monthName(current)}</strong> · this month</span><Chip tone="gray">{COMPLETION[currentStatus]}</Chip></li>}
          {d.payments.length === 0 && <li className="text-sm text-gray-600">{isTutor ? 'Mark a month completed to record its fee and remind the family.' : 'Your tutor marks each month completed; you then submit your payment here.'}</li>}
          {d.payments.map((p) => {
            const ps = p.payment_status ?? 'payment_due'
            return (
              <li key={p.id} className="rounded-input border border-gray-200 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span><strong>{monthName(p.month)}</strong> · due {taka(p.amount)}{p.amount_paid != null ? ` · paid ${taka(p.amount_paid)}` : ''}</span>
                  <span className="flex flex-wrap items-center gap-2"><Chip tone={p.completion_status === 'month_completed' ? 'blue' : 'gray'}>{COMPLETION[p.completion_status ?? 'in_progress']}</Chip><Chip tone={PAYMENT_TONE[ps]}>{PAYMENT[ps]}</Chip></span>
                </div>
                {(p.pay_method || p.pay_reference) && <p className="mt-1 text-gray-600">{[p.pay_method && `Method: ${p.pay_method}`, p.pay_reference && `Reference: ${p.pay_reference}`].filter(Boolean).join(' · ')}</p>}
                {p.note && <p className="mt-1 text-gray-600">{p.status === 'disputed' ? 'Dispute: ' : 'Note: '}{p.note}</p>}
                <div className="mt-2 flex flex-wrap gap-2">
                  {isPayer && (p.status === 'due' || p.status === 'disputed') && <Button size="sm" loading={busy} onClick={() => setPay({ p, amount: '', method: '', reference: '' })}>Submit payment</Button>}
                  {isTutor && p.status === 'marked_paid' && <Button size="sm" loading={busy} onClick={() => void doIt('confirm', p.month, 'Payment confirmed.')}>Confirm paid</Button>}
                  {((isTutor && (p.status === 'marked_paid' || p.status === 'due')) || (isPayer && p.status === 'due')) && <Button size="sm" variant="tertiary" onClick={() => setDispute({ p, reason: '' })}>Dispute</Button>}
                  {isTutor && p.status === 'disputed' && e.conversation_id && <span className="text-xs text-gray-600">Discuss the dispute in Messages.</span>}
                </div>
              </li>
            )
          })}
        </ul>}
      </Loaded>
      <Modal open={!!pay} onClose={() => setPay(null)} title={pay ? `Submit payment · ${monthName(pay.p.month)}` : ''} footer={<><Button variant="secondary" onClick={() => setPay(null)}>Cancel</Button><Button loading={busy} disabled={!pay || !(Number(pay.amount) > 0) || !(pay.method.trim() || pay.reference.trim())} onClick={() => pay && void doIt('mark_paid', pay.p.month, 'Payment submitted. Your tutor will confirm it.', '', { amount_paid: Number(pay.amount), method: pay.method.trim(), reference: pay.reference.trim() }).then((ok) => ok && setPay(null))}>Submit</Button></>}>
        {pay && <div className="grid gap-3 sm:grid-cols-2">
          <p className="text-sm text-gray-600 sm:col-span-2">Amount due for {monthName(pay.p.month)}: {taka(pay.p.amount)}. Submitting does not mark the month paid; your tutor confirms receipt.</p>
          <Field label="Amount paid (৳)">{(id) => <Input id={id} type="number" min={0} value={pay.amount} onChange={(ev) => setPay({ ...pay, amount: ev.target.value })} />}</Field>
          <Field label="Payment method">{(id) => <Input id={id} value={pay.method} maxLength={60} placeholder="Cash, mobile banking…" onChange={(ev) => setPay({ ...pay, method: ev.target.value })} />}</Field>
          <div className="sm:col-span-2"><Field label="Reference" hint="Transaction ID or receipt number. Enter a method, a reference or both.">{(id) => <Input id={id} value={pay.reference} maxLength={120} onChange={(ev) => setPay({ ...pay, reference: ev.target.value })} />}</Field></div>
        </div>}
      </Modal>
      <Modal open={!!dispute} onClose={() => setDispute(null)} title={dispute ? `Dispute · ${monthName(dispute.p.month)}` : ''} footer={<><Button variant="secondary" onClick={() => setDispute(null)}>Cancel</Button><Button variant="destructive" loading={busy} disabled={(dispute?.reason.trim().length ?? 0) < 5} onClick={() => dispute && void doIt('dispute', dispute.p.month, 'Dispute recorded. Discuss it in Messages.', dispute.reason.trim()).then((ok) => ok && setDispute(null))}>Record dispute</Button></>}>
        {dispute && <Field label="What is wrong with this payment?" hint="Shared with the other side in Messages.">{(id) => <Textarea id={id} value={dispute.reason} maxLength={255} onChange={(ev) => setDispute({ ...dispute, reason: ev.target.value })} />}</Field>}
      </Modal>
      <Modal open={!!howTo} onClose={() => setHowTo(null)} title="How to pay" footer={<><Button variant="secondary" onClick={() => setHowTo(null)}>Cancel</Button><Button loading={busy} disabled={(howTo?.body.trim().length ?? 0) < 10} onClick={() => howTo && void run(async () => { await platform.paymentInstructions(e.id, howTo.body.trim(), howTo.month); setHowTo(null) }, 'Payment instructions sent in Messages.')}>Send in Messages</Button></>}>
        {howTo && <div className="space-y-3">
          <p className="text-sm text-gray-600">Tell the family how you would like to be paid. The message goes to your conversation with them; TuitionHub does not store or process payment details.</p>
          <Field label="For month (optional)">{(id) => <Input id={id} type="month" value={howTo.month} onChange={(ev) => setHowTo({ ...howTo, month: ev.target.value })} />}</Field>
          <Field label="Payment instructions">{(id) => <Textarea id={id} value={howTo.body} maxLength={2000} onChange={(ev) => setHowTo({ ...howTo, body: ev.target.value })} />}</Field>
        </div>}
      </Modal>
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
          const confirmed = payments.filter((p) => p.status === 'confirmed').reduce((a, p) => a + (p.amount_paid ?? p.amount), 0)
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
