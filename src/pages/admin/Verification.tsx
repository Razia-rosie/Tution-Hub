import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { X } from 'lucide-react'
import { Button, Card, Chip, Field, Input, Select, StatusChip, Textarea } from '../../components/ui'
import { childStage, reviewStage } from '../../components/FamilyVerification'
import { interviewStage } from '../../components/InterviewCard'
import { fetchPrivateDocument, getAdminApplications, getAdminDocuments, getApplicationHistory, recordAdminInterviewOutcome, rescheduleAdminInterview, reviewAdminApplication, reviewStudentInvitation, scheduleAdminInterview, type AdminApplication, type AuditEntry, type StudentInvitation } from '../../lib/api'

const STATUS_FILTERS = [
  { value: '', label: 'All submitted' },
  { value: 'pending', label: 'Pending' },
  { value: 'under_review', label: 'Under review' },
  { value: 'resubmission_required', label: 'Correction requested' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
]
const ROLE_FILTERS = [{ value: '', label: 'All applicant types' }, { value: 'tutor', label: 'Private tutors' }, { value: 'coaching', label: 'Coaching centres' }, { value: 'parent', label: 'Parents / guardians' }, { value: 'student', label: 'Students' }]
const ROLE_NAME: Record<string, string> = { tutor: 'Private tutor', coaching: 'Coaching centre', parent: 'Parent / guardian', student: 'Student' }
const DECISIONS = [{ value: 'approved', label: 'Approve' }, { value: 'resubmission_required', label: 'Request corrections' }, { value: 'rejected', label: 'Reject' }]
const label = (value: string) => ({ value, label: value.charAt(0).toUpperCase() + value.slice(1).replaceAll('_', ' ') })
const when = (value?: string | null) => (value ? new Date(value).toLocaleString() : '—')
const ACTIONS: Record<string, string> = {
  document_uploaded: 'Uploaded a picture', document_viewed: 'Viewed a picture', verification_submitted: 'Submitted application', verification_resubmitted: 'Resubmitted application',
  verification_approved: 'Approved', verification_rejected: 'Rejected', verification_resubmission_required: 'Requested corrections',
  student_invitation_requested: 'Requested a student account', student_invitation_approved: 'Allowed student registration', student_invitation_rejected: 'Refused student registration', student_invitation_cancelled: 'Cancelled a student request', student_registered_from_invitation: 'Registered from a parent invitation',
  interview_scheduled: 'Scheduled interview', interview_completed: 'Completed interview', interview_cancelled: 'Cancelled interview', user_suspended: 'Suspended account', user_reactivated: 'Reactivated account',
}

type DocumentMeta = { id: string; document_type: string; original_name: string; mime_type: string; byte_size: number; uploaded_at: string }

/** Manual review queue. Every decision is made by an administrator looking at the pictures; nothing is decided automatically. */
export default function Verification({ fixedRole, title = 'Verification review' }: { fixedRole?: 'parent' | 'student'; title?: string } = {}) {
  const [status, setStatus] = useState('pending')
  const [role, setRole] = useState<string>(fixedRole ?? '')
  const [applications, setApplications] = useState<AdminApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<AdminApplication | null>(null)
  const [documents, setDocuments] = useState<DocumentMeta[]>([])
  const [images, setImages] = useState<Record<string, string>>({})
  const [enlarged, setEnlarged] = useState<DocumentMeta | null>(null)
  const [history, setHistory] = useState<AuditEntry[]>([])
  const [decision, setDecision] = useState<'approved' | 'rejected' | 'resubmission_required'>('approved')
  const [reason, setReason] = useState('')
  const [mode, setMode] = useState<'online' | 'in_person'>('online')
  const [scheduledAt, setScheduledAt] = useState('')
  const [location, setLocation] = useState('')
  const [outcomeNotes, setOutcomeNotes] = useState('')
  const [instructions, setInstructions] = useState('')
  const [moving, setMoving] = useState<string | null>(null)
  const [move, setMove] = useState({ mode: 'online' as 'online' | 'in_person', at: '', location: '', instructions: '' })
  const nav = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const imagesRef = useRef(images)
  imagesRef.current = images

  const load = () => getAdminApplications({ status, role }).then(({ applications: items }) => setApplications(items ?? [])).catch((e) => setError(e instanceof Error ? e.message : 'Could not load applications.')).finally(() => setLoading(false))
  useEffect(() => { setLoading(true); void load() }, [status, role])
  // Object URLs pin decoded images in memory until revoked.
  useEffect(() => () => Object.values(imagesRef.current).forEach((u) => URL.revokeObjectURL(u)), [])

  const loadDetail = async (application: AdminApplication) => {
    const [{ documents: docs }, { history: entries }] = await Promise.all([getAdminDocuments(application.id), getApplicationHistory(application.id)])
    setDocuments(docs); setHistory(entries)
    for (const doc of docs) {
      if (imagesRef.current[doc.id]) continue
      fetchPrivateDocument(doc.id).then((url) => setImages((m) => ({ ...m, [doc.id]: url }))).catch(() => setError('Could not load one of the pictures.'))
    }
  }

  const open = async (application: AdminApplication) => {
    // Reset the decision too: carrying the previous choice to another applicant invites mistakes.
    setSelected(application); setError(''); setMessage(''); setReason(''); setDecision('approved'); setOutcomeNotes(''); setDocuments([]); setHistory([])
    try { await loadDetail(application) } catch (e) { setError(e instanceof Error ? e.message : 'Could not load the application.') }
  }

  const reviewable = selected?.status === 'pending' || selected?.status === 'under_review'

  // Resolves to whether the operation succeeded, so callers only reset their inputs on success.
  const act = async (fn: () => Promise<unknown>, success: string): Promise<boolean> => {
    if (!selected) return false
    setBusy(true); setError(''); setMessage('')
    try {
      await fn()
      const { applications: items } = await getAdminApplications({ status, role })
      setApplications(items ?? [])
      // The decided application may leave the current filter; refetch it unfiltered so the detail stays open.
      const fresh = (await getAdminApplications({ role: selected.role })).applications?.find((a) => a.id === selected.id) ?? null
      setSelected(fresh)
      if (fresh) await loadDetail(fresh)
      setMessage(success)
      return true
    } catch (e) { setError(e instanceof Error ? e.message : 'The operation failed.'); return false }
    finally { setBusy(false) }
  }

  const reasonRequired = decision !== 'approved'
  // The final approval comes after the interview; the server refuses it while one is still scheduled.
  const openInterview = selected?.interviews?.find((i) => i.status === 'scheduled')
  const toLocalInput = (iso: string) => { const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) }
  return (
    <div className="space-y-6">
      <div><p className="text-sm text-gray-600">Administrator</p><h1 className="text-3xl">{title}</h1><p className="mt-1 text-sm text-gray-600">Review submitted pictures and details by hand. Approval, rejection and correction requests are manual decisions.</p></div>
      {error && <Card className="border-danger-600 bg-danger-50"><p role="alert" className="text-sm text-danger-700">{error}</p></Card>}
      {message && <Card className="border-emerald-600 bg-emerald-50"><p role="status" className="text-sm text-emerald-700">{message}</p></Card>}
      <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <Card>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <Field label="Status">{(id) => <Select id={id} value={status} onChange={(e) => setStatus(e.target.value)} options={STATUS_FILTERS} />}</Field>
            {!fixedRole && <Field label="Applicant type">{(id) => <Select id={id} value={role} onChange={(e) => setRole(e.target.value)} options={ROLE_FILTERS} />}</Field>}
          </div>
          <div className="mt-5 space-y-2" aria-live="polite">
            {loading && <p className="text-sm text-gray-600">Loading…</p>}
            {!loading && applications.length === 0 && <p className="text-sm text-gray-600">No applications match these filters.</p>}
            {applications.map((application) => (
              <button key={application.id} onClick={() => void open(application)} aria-current={selected?.id === application.id} className={`w-full rounded-input border p-3 text-left ${selected?.id === application.id ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-400'}`}>
                <span className="block font-semibold">{application.name}</span>
                <span className="block break-all text-xs text-gray-600">{ROLE_NAME[application.role] ?? application.role} · {application.email}</span>
                <span className="mt-1 block text-xs text-gray-600">Submitted {when(application.submitted_at)} · {application.document_count} picture{application.document_count === 1 ? '' : 's'}</span>
                <span className="mt-2 flex flex-wrap gap-1"><StatusChip state={application.status} />{application.submission_count > 1 && <Chip tone="blue">Resubmitted ×{application.submission_count - 1}</Chip>}</span>
              </button>
            ))}
          </div>
        </Card>
        {!selected ? <Card><p className="text-sm text-gray-600">Select an application to review its details, pictures and history.</p></Card> : (
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl">{selected.name}</h2><p className="break-all text-sm text-gray-600">{selected.email} · {ROLE_NAME[selected.role] ?? selected.role}</p></div><StatusChip state={selected.status} /></div>
            <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
              <div><dt className="text-gray-600">Submitted</dt><dd className="font-medium">{when(selected.submitted_at)}</dd></div>
              <div><dt className="text-gray-600">Last decision</dt><dd className="font-medium">{when(selected.reviewed_at)}</dd></div>
              <div><dt className="text-gray-600">Submissions</dt><dd className="font-medium">{selected.submission_count}</dd></div>
            </dl>
            <h3 className="mt-6 font-semibold">Submitted details</h3>
            <dl className="mt-2 grid gap-3 text-sm sm:grid-cols-2">{Object.entries(selected.profile ?? {}).filter(([, value]) => value !== null && value !== undefined).map(([key, value]) => <div key={key} className="min-w-0"><dt className="text-gray-600">{label(key).label}</dt><dd className="break-words font-medium">{Array.isArray(value) ? value.join(', ') : typeof value === 'object' ? JSON.stringify(value) : String(value)}</dd></div>)}</dl>
            {(selected.correction_request || selected.rejection_reason) && <div className="mt-4 rounded-input border border-warning-600 bg-warning-100 p-3 text-sm"><p className="font-semibold">{selected.rejection_reason ? 'Rejection reason' : 'Correction requested'}</p><p className="mt-1">{selected.rejection_reason ?? selected.correction_request}</p></div>}

            {selected.family && <FamilyPanel application={selected} act={act} busy={busy} />}

            <section className="mt-6 border-t border-gray-100 pt-5">
              <h3 className="font-semibold">Pictures</h3>
              {documents.length === 0 && <p className="mt-2 text-sm text-gray-600">No pictures submitted.</p>}
              <ul className="mt-3 grid gap-4 sm:grid-cols-2">
                {documents.map((doc) => (
                  <li key={doc.id} className="rounded-input border border-gray-200 p-3 text-sm">
                    <p className="font-semibold">{label(doc.document_type).label}</p>
                    <p className="text-xs text-gray-600">{doc.original_name} · {Math.ceil(doc.byte_size / 1024)} KB · uploaded {when(doc.uploaded_at)}</p>
                    <button type="button" className="mt-2 block w-full" onClick={() => setEnlarged(doc)} aria-label={`Enlarge ${label(doc.document_type).label}`}>
                      {images[doc.id] ? <img src={images[doc.id]} alt={`${label(doc.document_type).label} submitted by ${selected.name}`} className="h-48 w-full rounded-input border bg-gray-50 object-contain" /> : <span className="flex h-48 items-center justify-center rounded-input bg-gray-100 text-gray-600">Loading picture…</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            {reviewable ? (
              <section className="mt-6 border-t border-gray-100 pt-5">
                <h3 className="font-semibold">Decision</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field label="Decision">{(id) => <Select id={id} value={decision} onChange={(e) => setDecision(e.target.value as typeof decision)} options={DECISIONS} />}</Field>
                  <Field label="Reason shown to the applicant" hint={reasonRequired ? 'Required, at least 10 characters' : 'Optional'}>{(id) => <Textarea id={id} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
                </div>
                {decision === 'approved' && openInterview && <p className="mt-3 text-sm text-warning-600">An interview is still scheduled. Mark it completed (or cancel it) before the final approval.</p>}
                <Button className="mt-3" variant={decision === 'rejected' ? 'destructive' : 'primary'} loading={busy} disabled={(reasonRequired && reason.trim().length < 10) || (decision === 'approved' && !!openInterview)} onClick={() => void act(() => reviewAdminApplication(selected.id, decision, reason), 'Decision saved.').then((ok) => { if (ok) setReason('') })}>{DECISIONS.find((d) => d.value === decision)?.label}</Button>
              </section>
            ) : <p className="mt-6 border-t border-gray-100 pt-5 text-sm text-gray-600">{selected.status === 'resubmission_required' ? 'Corrections were requested. The application returns to the Pending queue when the applicant resubmits.' : `This application has been decided (${label(selected.status).label}). The decision is final.`}</p>}

            <section className="mt-6 border-t border-gray-100 pt-5">
              <h3 className="font-semibold">Interview (optional)</h3>
              {reviewable && !openInterview && <><div className="mt-3 grid gap-3 sm:grid-cols-2"><Field label="Mode">{(id) => <Select id={id} value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} options={['online', 'in_person'].map(label)} />}</Field><Field label="Date and time">{(id) => <Input id={id} type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />}</Field><Field label="Location or meeting link">{(id) => <Input id={id} value={location} onChange={(e) => setLocation(e.target.value)} />}</Field><Field label="Instructions for the applicant" hint="Optional; shown in their interview details and message">{(id) => <Textarea id={id} value={instructions} onChange={(e) => setInstructions(e.target.value)} maxLength={2000} />}</Field></div><Button className="mt-3" variant="secondary" loading={busy} disabled={!scheduledAt} onClick={() => void act(() => scheduleAdminInterview(selected.id, { mode, scheduled_at: new Date(scheduledAt).toISOString(), location_or_link: location, instructions }), 'Interview scheduled. The applicant was notified and messaged.').then((ok) => { if (ok) { setScheduledAt(''); setLocation(''); setInstructions('') } })}>Schedule interview</Button></>}
              {!selected.interviews?.length && <p className="mt-2 text-sm text-gray-600">No interviews.</p>}
              {selected.interviews?.map((interview) => {
                const scheduled = interview.status === 'scheduled'
                const stage = interview.status === 'cancelled' ? { label: 'Cancelled', tone: 'gray' as const } : interviewStage({ status: interview.status as 'scheduled' | 'completed', confirmed_at: interview.confirmed_at })
                return (
                  <div key={interview.id} className="mt-4 rounded-input border border-gray-200 p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">{label(interview.mode).label} · {when(interview.scheduled_at)}</p><Chip tone={stage.tone}>{stage.label === 'Scheduled, please confirm' ? 'Waiting for applicant confirmation' : stage.label}</Chip></div>
                    {interview.location_or_link && <p className="mt-1 break-all text-gray-600">{interview.location_or_link}</p>}
                    {interview.instructions && <p className="mt-1 whitespace-pre-wrap text-gray-600">Instructions: {interview.instructions}</p>}
                    {interview.confirmed_at && <p className="mt-1 text-teal-700">Applicant confirmed {when(interview.confirmed_at)}</p>}
                    {interview.updated_at && <p className="mt-1 text-xs text-gray-600">Rescheduled {when(interview.updated_at)}</p>}
                    {interview.conversation_id && <Button size="sm" variant="tertiary" className="mt-2" onClick={() => nav(`/app/admin/messages/${interview.conversation_id}`)}>Open conversation with the applicant</Button>}
                    {scheduled && moving === interview.id && (
                      <div className="mt-3 rounded-input bg-gray-50 p-3">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field label="New mode">{(id) => <Select id={id} value={move.mode} onChange={(e) => setMove({ ...move, mode: e.target.value as 'online' | 'in_person' })} options={['online', 'in_person'].map(label)} />}</Field>
                          <Field label="New date and time">{(id) => <Input id={id} type="datetime-local" value={move.at} onChange={(e) => setMove({ ...move, at: e.target.value })} />}</Field>
                          <Field label="New location or meeting link">{(id) => <Input id={id} value={move.location} onChange={(e) => setMove({ ...move, location: e.target.value })} />}</Field>
                          <Field label="New instructions">{(id) => <Textarea id={id} value={move.instructions} onChange={(e) => setMove({ ...move, instructions: e.target.value })} maxLength={2000} />}</Field>
                        </div>
                        <div className="mt-2 flex gap-2"><Button size="sm" loading={busy} disabled={!move.at} onClick={() => void act(() => rescheduleAdminInterview(selected.id, interview.id, { mode: move.mode, scheduled_at: new Date(move.at).toISOString(), location_or_link: move.location, instructions: move.instructions }), 'Interview rescheduled. The applicant was notified and must confirm again.').then((ok) => { if (ok) setMoving(null) })}>Save new schedule</Button><Button size="sm" variant="tertiary" onClick={() => setMoving(null)}>Keep current schedule</Button></div>
                      </div>
                    )}
                    {scheduled && <><Textarea className="mt-3" value={outcomeNotes} onChange={(e) => setOutcomeNotes(e.target.value)} placeholder="Outcome notes" aria-label="Interview outcome notes" /><div className="mt-2 flex flex-wrap gap-2"><Button size="sm" onClick={() => { if (window.confirm('Mark this interview as completed? This does not approve the application.')) void act(() => recordAdminInterviewOutcome(selected.id, interview.id, 'completed', outcomeNotes), 'Interview marked completed. Make the final decision above.') }}>Mark interview completed</Button>{moving !== interview.id && <Button size="sm" variant="secondary" onClick={() => { setMoving(interview.id); setMove({ mode: interview.mode as 'online' | 'in_person', at: toLocalInput(interview.scheduled_at), location: interview.location_or_link ?? '', instructions: interview.instructions ?? '' }) }}>Reschedule</Button>}<Button size="sm" variant="secondary" onClick={() => void act(() => recordAdminInterviewOutcome(selected.id, interview.id, 'cancelled', outcomeNotes), 'Interview cancelled.')}>Cancel interview</Button></div></>}
                  </div>
                )
              })}
            </section>

            <section className="mt-6 border-t border-gray-100 pt-5">
              <h3 className="font-semibold">History</h3>
              <ol className="mt-3 space-y-2 border-l border-gray-200 pl-4 text-sm">
                {history.map((h) => <li key={h.id}><p className="font-medium">{ACTIONS[h.action] ?? label(h.action).label}{h.metadata?.document_type ? ` (${label(String(h.metadata.document_type)).label})` : ''}</p><p className="text-xs text-gray-600">{when(h.created_at)} · {h.actor_name ?? 'System'}{h.actor_role === 'admin' ? ' (admin)' : ''}{h.metadata?.reason ? ` · “${String(h.metadata.reason)}”` : ''}</p></li>)}
                {history.length === 0 && <li className="text-gray-600">No history yet.</li>}
              </ol>
            </section>
          </Card>
        )}
      </div>
      {enlarged && images[enlarged.id] && (
        <div role="dialog" aria-modal="true" aria-label={`${label(enlarged.document_type).label} full size`} className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4" onClick={() => setEnlarged(null)} onKeyDown={(e) => { if (e.key === 'Escape') setEnlarged(null) }}>
          <button autoFocus className="absolute right-4 top-4 rounded-full bg-white p-2" aria-label="Close full-size picture" onClick={() => setEnlarged(null)}><X size={20} /></button>
          <img src={images[enlarged.id]} alt={`${label(enlarged.document_type).label} full size`} className="max-h-full max-w-full object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  )
}

/** The other side of a family review: a parent's child requests, or a student's inviting parent. */
/** Admin labels for a child's registration request; once the child has registered, the student's own review stage. */
function requestStage(inv: StudentInvitation) {
  if (inv.status === 'pending_approval') return { label: 'Waiting for admin permission', tone: 'amber' as const }
  if (inv.status === 'approved') return { label: 'Approved', tone: 'green' as const }
  if (inv.status === 'rejected') return { label: 'Rejected', tone: 'red' as const }
  return childStage(inv)
}

function FamilyPanel({ application, act, busy }: { application: AdminApplication; act: (fn: () => Promise<unknown>, success: string) => Promise<boolean>; busy: boolean }) {
  const family = application.family
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  if (application.role === 'parent') {
    const invitations = family?.invitations ?? []
    // Permission for the child is a separate decision, and only possible once the parent is approved.
    const parentApproved = application.status === 'approved' && application.account_status === 'active'
    const approve = (inv: StudentInvitation) => {
      if (!window.confirm(`Allow ${inv.child_email} to register a student account linked to ${application.name}?`)) return
      void act(() => reviewStudentInvitation(inv.id, 'approved', ''), `${inv.child_email} may now register as a student.`)
    }
    const reject = (inv: StudentInvitation) => {
      if (!window.confirm(`Reject the student registration request for ${inv.child_email}?`)) return
      void act(() => reviewStudentInvitation(inv.id, 'rejected', reason.trim()), `The request for ${inv.child_email} was rejected.`).then((ok) => { if (ok) { setRejecting(null); setReason('') } })
    }
    return (
      <section className="mt-6 border-t border-gray-100 pt-5">
        <h3 className="font-semibold">Child student accounts</h3>
        {invitations.length === 0 && <p className="mt-2 text-sm text-gray-600">This parent has not submitted a child email yet.</p>}
        <ul className="mt-2 space-y-2">{invitations.map((inv) => { const c = requestStage(inv); const pending = inv.status === 'pending_approval'; return (
          <li key={inv.id} className="rounded-input border border-gray-200 p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2"><span className="break-all font-semibold">{inv.child_email}{inv.child_name ? ` · ${inv.child_name}` : ''}</span>
              <span className="flex flex-wrap items-center gap-2"><Chip tone={c.tone}>{c.label}</Chip>
                {pending && <><Button size="sm" loading={busy} disabled={!parentApproved} onClick={() => approve(inv)}>Approve</Button><Button size="sm" variant="destructive" disabled={busy} onClick={() => { setRejecting(rejecting === inv.id ? null : inv.id); setReason('') }}>Reject</Button></>}
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-600">Requested {when(inv.created_at)} · {inv.relationship}{inv.student_name ? ` · registered as ${inv.student_name}` : ''}</p>
            {inv.status === 'rejected' && inv.rejection_reason && <p className="mt-1 text-xs text-danger-700">Reason: {inv.rejection_reason}</p>}
            {pending && !parentApproved && <p className="mt-1 text-xs text-warning-600">Approve this parent first; the child's request can be approved after that.</p>}
            {pending && rejecting === inv.id && (
              <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                <Field label="Reason shown to the parent" hint="Required, at least 10 characters">{(id) => <Textarea id={id} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
                <Button size="sm" variant="destructive" loading={busy} disabled={reason.trim().length < 10} onClick={() => reject(inv)}>Confirm rejection</Button>
              </div>
            )}
          </li>
        ) })}</ul>
      </section>
    )
  }
  const parent = family?.parent
  const ps = parent ? reviewStage('parent', parent.parent_account_status, parent.parent_verification_status) : null
  return (
    <section className="mt-6 border-t border-gray-100 pt-5">
      <h3 className="font-semibold">Linked parent / guardian</h3>
      {!parent ? <p className="mt-2 text-sm text-danger-700">This student has no inviting parent. A student can only be approved when linked to an approved parent.</p> : (
        <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
          <div><dt className="text-gray-600">Parent</dt><dd className="break-all font-medium">{parent.parent_name} · {parent.parent_email}</dd></div>
          <div><dt className="text-gray-600">Parent verification</dt><dd>{ps && <Chip tone={ps.tone}>{ps.label}</Chip>}</dd></div>
          <div><dt className="text-gray-600">Invited email</dt><dd className="break-all font-medium">{parent.invited_email}{parent.invited_email === application.email ? ' (matches)' : ' (does not match!)'}</dd></div>
          <div><dt className="text-gray-600">Relationship</dt><dd className="font-medium">{parent.relationship}</dd></div>
          <div><dt className="text-gray-600">Registered</dt><dd className="font-medium">{when(parent.registered_at)}</dd></div>
          <div><dt className="text-gray-600">Link</dt><dd><StatusChip state={parent.link_status ?? 'pending'} /></dd></div>
        </dl>
      )}
      {ps && ps.label !== 'Approved' && <p className="mt-2 text-sm text-warning-600">Approve the parent first; the student cannot be approved while the parent is not.</p>}
    </section>
  )
}
