import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { AlertTriangle, CheckCircle2, Clock, ImageUp, ShieldCheck, UserPlus, XCircle } from 'lucide-react'
import { useStore, type VerifyState } from '../lib/store'
import { Button, Card, Chip, Field, Input, Select } from './ui'
import { PageHead } from './tutor/bits'
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB } from '../lib/uploads'
import { validEmail } from '../lib/validate'
import {
  ApiError, cancelStudentInvitation, createStudentInvitation, effectiveStatus, fetchPrivateDocument, getFamily, getWorkflowDashboard, submitVerification, updateProfile, uploadVerificationDocument,
  type DocumentRequirement, type ParentLink, type StudentInvitation, type WorkflowDashboard,
} from '../lib/api'

type Role = 'parent' | 'student'
type Tone = 'gray' | 'amber' | 'blue' | 'green' | 'red' | 'orange'

const ACCEPT = ['image/jpeg', 'image/png', 'image/webp']
const RELATIONSHIPS = ['Mother', 'Father', 'Legal guardian', 'Grandparent', 'Sibling', 'Other relative'].map((r) => ({ value: r.toLowerCase(), label: r }))
const message = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback)
const day = (value?: string | null) => (value ? new Date(value).toLocaleDateString() : '')
const toStore = (status: string): VerifyState => (status === 'active' ? 'verified' : status) as VerifyState

/** The review stage of one account, in the words the parent and student see. */
export function reviewStage(role: Role, accountStatus: string | null | undefined, applicationStatus: string | null | undefined): { label: string; tone: Tone } {
  if (accountStatus === 'suspended') return { label: 'Suspended', tone: 'red' }
  if (applicationStatus === 'approved' && accountStatus === 'active') return { label: 'Approved', tone: 'green' }
  if (applicationStatus === 'pending' || applicationStatus === 'under_review') return { label: role === 'parent' ? 'Pending Admin Review' : 'Pending Student Verification', tone: 'amber' }
  if (applicationStatus === 'resubmission_required') return { label: 'Corrections requested', tone: 'orange' }
  if (applicationStatus === 'rejected' || accountStatus === 'rejected') return { label: 'Rejected', tone: 'red' }
  return { label: 'Not submitted', tone: 'gray' }
}

/** Where a child's student account stands, from the parent's side. */
export function childStage(inv: StudentInvitation): { label: string; tone: Tone; detail: string } {
  switch (inv.status) {
    case 'pending_approval': return { label: 'Waiting for admin permission', tone: 'amber', detail: 'An administrator must allow this email to register. Your own verification must be approved first.' }
    case 'approved': return { label: 'Child may register', tone: 'blue', detail: `Ask your child to sign up as a Student with ${inv.child_email} and their own password${inv.expires_at ? ` before ${day(inv.expires_at)}` : ''}.` }
    case 'expired': return { label: 'Permission expired', tone: 'gray', detail: 'The sign-up window ended. Request the student account again.' }
    case 'rejected': return { label: 'Registration refused', tone: 'red', detail: inv.rejection_reason ?? 'An administrator refused this request.' }
    case 'cancelled': return { label: 'Cancelled', tone: 'gray', detail: 'You cancelled this request.' }
  }
  const st = reviewStage('student', inv.student_account_status, inv.student_verification_status)
  if (st.label === 'Approved') return { label: 'Student approved', tone: 'green', detail: `${inv.student_name ?? 'Your child'}'s account is approved and linked to you.` }
  if (st.label === 'Rejected') return { label: 'Student rejected', tone: 'red', detail: inv.student_rejection_reason ?? 'An administrator rejected the student account. Your own approval is not affected.' }
  if (st.label === 'Corrections requested') return { label: 'Student corrections requested', tone: 'orange', detail: inv.student_correction_request ?? 'Your child must correct their details and resubmit.' }
  if (st.tone === 'amber') return { label: 'Student pending review', tone: 'amber', detail: `${inv.student_name ?? 'Your child'} submitted their details. An administrator will review them separately.` }
  return { label: 'Child signed up', tone: 'blue', detail: `${inv.student_name ?? 'Your child'} created an account and still needs to upload their birth certificate and submit it.` }
}

/**
 * Parent and student verification. A parent uploads their own NID and their
 * child's birth certificate, then asks for a student account for the child's
 * email. A student, invited that way, uploads their own birth certificate.
 * Every decision is made by an administrator; nothing is approved automatically.
 */
export default function FamilyVerification({ role }: { role: Role }) {
  const { user, toast, setVerification } = useStore()
  const [dashboard, setDashboard] = useState<WorkflowDashboard | null>(null)
  const [invitations, setInvitations] = useState<StudentInvitation[]>([])
  const [parent, setParent] = useState<ParentLink | null>(null)
  const [loading, setLoading] = useState(true)
  const [fields, setFields] = useState<Record<string, string>>({})
  const [uploading, setUploading] = useState<string | null>(null)
  const [previews, setPreviews] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [missing, setMissing] = useState<string[]>([])
  const previewsRef = useRef(previews)
  previewsRef.current = previews

  const load = async (prefill = false) => {
    try {
      const [next, family] = await Promise.all([getWorkflowDashboard(), getFamily()])
      setDashboard(next); setInvitations(family.invitations ?? []); setParent(family.parent ?? null)
      setVerification(role, toStore(effectiveStatus(next)))
      if (prefill) {
        const p = (next.profile ?? {}) as Record<string, unknown>
        const text = (k: string) => (typeof p[k] === 'string' ? (p[k] as string) : '')
        setFields({ display_name: text('display_name') || (user?.name ?? next.account.name), address: text('address'), birth_date: text('birth_date').slice(0, 10), class_name: text('class_name'), institution: text('institution') })
      }
      for (const doc of next.documents ?? []) {
        const key = `${doc.document_type}:${doc.id}`
        if (previewsRef.current[key]) continue
        fetchPrivateDocument(doc.id).then((url) => setPreviews((p) => ({ ...Object.fromEntries(Object.entries(p).filter(([k]) => !k.startsWith(doc.document_type + ':'))), [key]: url }))).catch(() => {})
      }
    } catch (e) {
      setError(message(e, 'Could not load your verification status.'))
    } finally { setLoading(false) }
  }
  // setVerification changes identity on every store update, so it must not be a dependency.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load(true) }, [])
  useEffect(() => () => { Object.values(previewsRef.current).forEach((u) => URL.revokeObjectURL(u)) }, [])

  if (loading) return <div role="status" className="p-6 text-sm text-gray-600">Loading your verification…</div>

  const appStatus = dashboard?.verification?.status
  const accountStatus = dashboard?.account.status
  const editable = !appStatus || appStatus === 'draft' || appStatus === 'resubmission_required'
  const requirements: DocumentRequirement[] = dashboard?.requirements ?? []
  const uploaded = new Map((dashboard?.documents ?? []).map((d) => [d.document_type, d]))
  const stage = reviewStage(role, accountStatus, appStatus)
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setFields((f) => ({ ...f, [k]: e.target.value }))
  const profileKeys = role === 'parent' ? ['display_name', 'address'] : ['display_name', 'birth_date', 'class_name', 'institution']

  const upload = async (req: DocumentRequirement, file: File | undefined) => {
    if (!file) return
    setError('')
    if (!ACCEPT.includes(file.type)) { setError('Please choose a JPG, PNG or WebP picture. PDF and Word files are not accepted.'); return }
    if (file.size > MAX_UPLOAD_BYTES) { setError(`Pictures must be ${MAX_UPLOAD_MB} MB or smaller.`); return }
    setUploading(req.type)
    try {
      await uploadVerificationDocument(req.type, file)
      await load()
      toast(`${req.label} uploaded.`, 'success')
    } catch (e) { setError(message(e, 'Could not upload the picture.')) } finally { setUploading(null) }
  }

  const submit = async () => {
    setBusy(true); setError(''); setMissing([])
    try {
      await updateProfile(Object.fromEntries(profileKeys.map((k) => [k, (fields[k] ?? '').trim() || null])))
      await submitVerification()
      await load()
      toast(role === 'parent' ? 'Your verification was sent to an administrator.' : 'Your student account was sent for review.', 'success')
    } catch (e) {
      if (e instanceof ApiError && Array.isArray(e.details.missing)) setMissing(e.details.missing as string[])
      setError(message(e, 'Could not submit your verification.'))
      await load()
    } finally { setBusy(false) }
  }

  const docStatus = (type: string) => {
    if (!uploaded.has(type)) return { label: 'Not uploaded', tone: 'gray' as Tone }
    if (!appStatus || appStatus === 'draft') return { label: 'Uploaded, not submitted', tone: 'blue' as Tone }
    if (appStatus === 'approved') return { label: 'Verified', tone: 'green' as Tone }
    if (appStatus === 'rejected') return { label: 'Rejected', tone: 'red' as Tone }
    if (appStatus === 'resubmission_required') return { label: 'Corrections requested', tone: 'orange' as Tone }
    return { label: 'Under review', tone: 'amber' as Tone }
  }
  const nidType = role === 'parent' ? 'parent_nid' : 'birth_certificate'

  return (
    <div className="space-y-6">
      <PageHead title={role === 'parent' ? 'Parent verification' : 'Student verification'} tag={role === 'parent' ? 'PV-01' : 'SV-01'} sub="An administrator reviews your details and pictures by hand. Parent and student accounts are approved separately." actions={<Chip tone={stage.tone}>{stage.label}</Chip>} />
      <StatusBanner role={role} stage={stage.label} dashboard={dashboard} parent={parent} />

      <Card>
        <h2 className="text-lg">Where things stand</h2>
        <dl className="mt-3 divide-y divide-gray-100 text-sm">
          {role === 'parent' ? <>
            <Row label="Parent verification"><Chip tone={stage.tone}>{stage.label}</Chip></Row>
            <Row label="Your NID"><Chip tone={docStatus('parent_nid').tone}>{docStatus('parent_nid').label}</Chip></Row>
            <Row label="Child's birth certificate"><Chip tone={docStatus('child_birth_certificate').tone}>{docStatus('child_birth_certificate').label}</Chip></Row>
            {invitations.length === 0 && <Row label="Child's student account"><span className="text-gray-600">No email submitted yet</span></Row>}
            {invitations.map((inv) => { const c = childStage(inv); return (
              <Row key={inv.id} label={`Child account · ${inv.child_email}`}><Chip tone={c.tone}>{c.label}</Chip></Row>
            ) })}
          </> : <>
            <Row label="Student account"><Chip tone={stage.tone}>{stage.label}</Chip></Row>
            <Row label="Parent account link">{parent ? <Chip tone={parent.link_status === 'approved' ? 'green' : parent.link_status === 'rejected' ? 'red' : 'amber'}>{parent.link_status === 'approved' ? `Linked to ${parent.parent_name}` : parent.link_status === 'rejected' ? 'Link rejected' : `Pending with ${parent.parent_name}`}</Chip> : <Chip>No parent link</Chip>}</Row>
            {parent && <Row label="Parent verification"><Chip tone={reviewStage('parent', parent.parent_account_status, parent.parent_verification_status).tone}>{reviewStage('parent', parent.parent_account_status, parent.parent_verification_status).label}</Chip></Row>}
            <Row label="Your birth certificate"><Chip tone={docStatus(nidType).tone}>{docStatus(nidType).label}</Chip></Row>
            <Row label="Admin review"><span>{appStatus === 'approved' ? `Approved ${day(dashboard?.verification?.reviewed_at)}` : appStatus === 'pending' || appStatus === 'under_review' ? `Submitted ${day(dashboard?.verification?.submitted_at)}, waiting for a decision` : appStatus === 'rejected' || appStatus === 'resubmission_required' ? `Decided ${day(dashboard?.verification?.reviewed_at)}` : 'Not submitted yet'}</span></Row>
          </>}
          {(dashboard?.verification?.rejection_reason || dashboard?.verification?.correction_request) && <Row label={dashboard.verification.rejection_reason ? 'Rejection reason' : 'Corrections requested'}><span className="text-danger-700">{dashboard.verification.rejection_reason ?? dashboard.verification.correction_request}</span></Row>}
        </dl>
      </Card>

      {error && (
        <Card className="border-danger-600 bg-danger-50">
          <p role="alert" className="text-sm text-danger-700">{error}</p>
          {missing.length > 0 && <ul className="mt-2 list-disc pl-5 text-sm text-danger-700">{missing.map((m) => <li key={m}>{m}</li>)}</ul>}
        </Card>
      )}

      <>
        <Card>
          <h2 className="text-lg">1. Your details</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="Full name">{(id) => <Input id={id} value={fields.display_name ?? ''} disabled={!editable} onChange={set('display_name')} />}</Field>
            {role === 'parent'
              ? <Field label="Address">{(id) => <Input id={id} value={fields.address ?? ''} disabled={!editable} onChange={set('address')} placeholder="House, road, area, district" />}</Field>
              : <>
                <Field label="Date of birth">{(id) => <Input id={id} type="date" value={fields.birth_date ?? ''} disabled={!editable} onChange={set('birth_date')} />}</Field>
                <Field label="Class">{(id) => <Input id={id} value={fields.class_name ?? ''} disabled={!editable} onChange={set('class_name')} placeholder="Class 8" />}</Field>
                <Field label="School or college">{(id) => <Input id={id} value={fields.institution ?? ''} disabled={!editable} onChange={set('institution')} />}</Field>
              </>}
          </div>
        </Card>

        <Card>
          <h2 className="text-lg">2. Verification pictures</h2>
          <p className="mt-1 text-sm text-gray-600">Take clear photos of the original documents. JPG, PNG or WebP, up to {MAX_UPLOAD_MB} MB each. Only you and TuitionHub administrators can see them; they never appear in any public listing.</p>
          <ul className="mt-4 grid gap-4 md:grid-cols-2">
            {requirements.map((req) => {
              const doc = uploaded.get(req.type)
              const preview = doc ? previews[`${req.type}:${doc.id}`] : undefined
              return (
                <li key={req.type} className="rounded-card border border-gray-200 p-4">
                  <p className="font-semibold text-navy-900">{req.label} {req.required && <span className="text-xs font-normal text-danger-600">(required)</span>}</p>
                  {doc ? (
                    <div className="mt-3 flex items-center gap-3">
                      {preview ? <img src={preview} alt={`Your uploaded ${req.label}`} className="h-20 w-28 rounded-input border object-cover" /> : <div className="h-20 w-28 rounded-input bg-gray-100" />}
                      <div className="min-w-0 text-sm"><p className="flex items-center gap-1 text-teal-700"><CheckCircle2 size={14} aria-hidden /> Uploaded</p><p className="truncate text-gray-600">{doc.original_name}</p></div>
                    </div>
                  ) : <p className="mt-2 text-sm text-gray-600">Not uploaded yet.</p>}
                  {editable && (
                    <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-input border border-gray-400 px-3 py-2 text-sm font-semibold text-navy-900 hover:border-navy-700">
                      <ImageUp size={16} aria-hidden />{uploading === req.type ? 'Uploading…' : doc ? 'Replace picture' : 'Choose picture'}
                      <input type="file" className="sr-only" accept={ACCEPT.join(',')} disabled={uploading !== null} aria-label={`${doc ? 'Replace' : 'Upload'} ${req.label}`} onChange={(e) => { void upload(req, e.target.files?.[0]); e.target.value = '' }} />
                    </label>
                  )}
                </li>
              )
            })}
          </ul>
        </Card>

        {editable && (
          <Card>
            <h2 className="text-lg">3. Submit for review</h2>
            <p className="mt-1 text-sm text-gray-600">After you submit, your details and pictures are locked until an administrator decides.</p>
            <Button className="mt-4" onClick={() => void submit()} loading={busy} disabled={uploading !== null}>{appStatus === 'resubmission_required' ? 'Resubmit for review' : 'Submit for review'}</Button>
          </Card>
        )}
      </>

      {role === 'parent' && <ChildAccounts invitations={invitations} appStatus={appStatus} accountStatus={accountStatus} onChange={() => load()} />}
    </div>
  )
}

function ChildAccounts({ invitations, appStatus, accountStatus, onChange }: { invitations: StudentInvitation[]; appStatus?: string; accountStatus?: string; onChange: () => Promise<void> }) {
  const { toast } = useStore()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [relationship, setRelationship] = useState('mother')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const submitted = appStatus === 'pending' || appStatus === 'under_review' || appStatus === 'approved'
  const blocked = accountStatus === 'rejected' || accountStatus === 'suspended'
  const canRequest = submitted && !blocked

  const request = async (e: React.FormEvent) => {
    e.preventDefault(); setError('')
    if (!validEmail(email.trim())) { setError('Enter a valid email address for your child.'); return }
    setBusy(true)
    try {
      await createStudentInvitation({ child_email: email.trim(), child_name: name.trim(), relationship })
      setEmail(''); setName('')
      await onChange()
      toast('Student account request sent to an administrator.', 'success')
    } catch (err) { setError(message(err, 'Could not send the request.')) } finally { setBusy(false) }
  }
  const cancel = async (id: string) => {
    try { await cancelStudentInvitation(id); await onChange(); toast('Request cancelled.', 'success') } catch (err) { setError(message(err, 'Could not cancel the request.')) }
  }

  return (
    <Card>
      <h2 className="flex items-center gap-2 text-lg"><UserPlus size={18} aria-hidden /> Your child's student account</h2>
      <p className="mt-1 text-sm text-gray-600">Give a separate email for your child. After an administrator approves you and allows this email, your child signs up as a Student with that exact email and chooses their own password. You never set or see their password.</p>
      {!canRequest && <p className="mt-3 rounded-input border border-warning-600 bg-warning-100 p-3 text-sm">{blocked ? 'Your verification was rejected, so a student account cannot be requested.' : 'Submit your own verification above first. You can then request your child’s student account.'}</p>}
      {canRequest && (
        <form onSubmit={request} noValidate className="mt-4 grid gap-4 md:grid-cols-3">
          <Field label="Child's email">{(id) => <Input id={id} type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="child@example.com" />}</Field>
          <Field label="Child's name" hint="Optional">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
          <Field label="You are their">{(id) => <Select id={id} value={relationship} onChange={(e) => setRelationship(e.target.value)} options={RELATIONSHIPS} />}</Field>
          <div className="md:col-span-3"><Button type="submit" loading={busy}>Request student account</Button></div>
        </form>
      )}
      {error && <p role="alert" className="mt-3 text-sm text-danger-700">{error}</p>}
      {invitations.length > 0 && (
        <ul className="mt-5 divide-y divide-gray-100 rounded-card border border-gray-200">
          {invitations.map((inv) => { const c = childStage(inv); return (
            <li key={inv.id} className="flex flex-wrap items-start justify-between gap-3 p-4 text-sm">
              <div className="min-w-0">
                <p className="break-all font-semibold text-navy-900">{inv.child_email}{inv.child_name ? ` · ${inv.child_name}` : ''}</p>
                <p className="text-xs text-gray-600">Requested {day(inv.created_at)} · you are their {inv.relationship}</p>
                <p className="mt-1">{c.detail}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Chip tone={c.tone}>{c.label}</Chip>
                {(inv.status === 'pending_approval' || inv.status === 'approved') && <Button size="sm" variant="tertiary" onClick={() => void cancel(inv.id)}>Cancel request</Button>}
              </div>
            </li>
          ) })}
        </ul>
      )}
    </Card>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center justify-between gap-2 py-2"><dt className="break-all text-gray-600">{label}</dt><dd>{children}</dd></div>
}

function StatusBanner({ role, stage, dashboard, parent }: { role: Role; stage: string; dashboard: WorkflowDashboard | null; parent: ParentLink | null }) {
  const v = dashboard?.verification
  if (stage === 'Approved') return <Banner tone="green" icon={<ShieldCheck size={18} aria-hidden />} title={role === 'parent' ? 'Parent verified' : 'Student account approved'} body={role === 'parent' ? 'An administrator approved your verification. Your child’s student account is reviewed separately below.' : 'An administrator approved your account. All student features are available.'} />
  if (stage.startsWith('Pending')) return <Banner tone="blue" icon={<Clock size={18} aria-hidden />} title={stage} body={`Submitted ${v?.submitted_at ? new Date(v.submitted_at).toLocaleString() : ''}. Until a decision, your account is limited to viewing.${role === 'student' && parent?.parent_verification_status !== 'approved' ? ' Your parent must also be approved before you can be.' : ''}`} />
  if (stage === 'Corrections requested') return <Banner tone="amber" icon={<AlertTriangle size={18} aria-hidden />} title="Corrections requested" body={v?.correction_request ?? 'Please update your details or pictures and resubmit.'} />
  if (stage === 'Rejected') return <Banner tone="red" icon={<XCircle size={18} aria-hidden />} title="Verification rejected" body={`${v?.rejection_reason ?? 'Your verification was rejected.'} Contact support if you believe this is a mistake.`} />
  if (stage === 'Suspended') return <Banner tone="red" icon={<XCircle size={18} aria-hidden />} title="Account suspended" body="Your account is suspended. Contact support for help." />
  return <Banner tone="blue" icon={<ShieldCheck size={18} aria-hidden />} title="Get verified" body={role === 'parent' ? 'Add your details, upload your NID and your child’s birth certificate, then submit. Until you are approved, your account is limited to viewing.' : 'Add your details, upload your birth certificate, then submit. Until you are approved, your account is limited to viewing.'} />
}

function Banner({ tone, icon, title, body }: { tone: 'blue' | 'amber' | 'red' | 'green'; icon: React.ReactNode; title: string; body: string }) {
  const cls = { blue: 'border-blue-600 bg-blue-50', amber: 'border-warning-600 bg-warning-100', red: 'border-danger-600 bg-danger-50', green: 'border-emerald-600 bg-emerald-50' }[tone]
  return <Card className={cls}><div className="flex items-start gap-3">{icon}<div><p className="font-semibold text-navy-900">{title}</p><p className="mt-1 text-sm">{body}</p></div></div></Card>
}

/** Compact verification summary for the parent and student dashboards. */
export function FamilySummary({ role }: { role: Role }) {
  const [state, setState] = useState<{ dashboard: WorkflowDashboard; invitations: StudentInvitation[]; parent: ParentLink | null } | null>(null)
  useEffect(() => {
    Promise.all([getWorkflowDashboard(), getFamily()]).then(([dashboard, family]) => setState({ dashboard, invitations: family.invitations ?? [], parent: family.parent ?? null })).catch(() => setState(null))
  }, [])
  if (!state) return null
  const v = state.dashboard.verification
  const stage = reviewStage(role, state.dashboard.account.status, v?.status)
  const reason = v?.rejection_reason ?? v?.correction_request
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg">{role === 'parent' ? 'Verification and child account' : 'Your verification'}</h2>
        <Link to={`/app/${role}/verification`} className="text-sm font-semibold text-blue-600 hover:underline">Open verification</Link>
      </div>
      <dl className="mt-2 divide-y divide-gray-100 text-sm">
        <Row label={role === 'parent' ? 'Parent verification' : 'Student account'}><Chip tone={stage.tone}>{stage.label}</Chip></Row>
        {role === 'parent' && state.invitations.length === 0 && <Row label="Child's student account"><span className="text-gray-600">No child email submitted</span></Row>}
        {role === 'parent' && state.invitations.map((inv) => { const c = childStage(inv); return <Row key={inv.id} label={inv.child_email}><Chip tone={c.tone}>{c.label}</Chip></Row> })}
        {role === 'student' && <Row label="Parent link">{state.parent ? <Chip tone={state.parent.link_status === 'approved' ? 'green' : state.parent.link_status === 'rejected' ? 'red' : 'amber'}>{state.parent.parent_name} · {state.parent.link_status ?? 'pending'}</Chip> : <Chip>None</Chip>}</Row>}
        {reason && <Row label={v?.rejection_reason ? 'Rejection reason' : 'Corrections requested'}><span className="text-danger-700">{reason}</span></Row>}
      </dl>
    </Card>
  )
}
