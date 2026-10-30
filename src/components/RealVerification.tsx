import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock, ImageUp, ShieldCheck, XCircle } from 'lucide-react'
import { useStore, type VerifyState } from '../lib/store'
import { Button, Card, Field, Input, StatusChip } from './ui'
import { PageHead } from './tutor/bits'
import { ApiError, effectiveStatus, fetchPrivateDocument, getWorkflowDashboard, submitVerification, updateProfile, uploadVerificationDocument, type DocumentRequirement, type WorkflowDashboard } from '../lib/api'

type Role = 'tutor' | 'coaching'

// Per-role copy. Both roles store into the same role_profiles columns so the
// backend completion score (display_name, education, subjects, classes, areas) applies to each.
const COPY: Record<Role, { tag: string; heading: string; education: [string, string]; classes: [string, string]; institution?: [string, string] }> = {
  tutor: {
    tag: 'TV-01', heading: 'Tutor details',
    education: ['Education', 'Degree and institution'], classes: ['Classes', 'Class 9, SSC'],
  },
  coaching: {
    tag: 'CV-01', heading: 'Institute details',
    institution: ['Institute name', 'Registered name of the coaching centre'],
    education: ['Registration details', 'Trade licence or registration number'], classes: ['Levels taught', 'SSC, HSC, Admission'],
  },
}

const ACCEPT = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 10 * 1024 * 1024
const list = (value: string) => value.split(',').map((x) => x.trim()).filter(Boolean)
const joined = (value: unknown) => (Array.isArray(value) ? value.join(', ') : '')
const message = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback)
// The store's demo pages gate on 'verified'; the server calls the same state 'active'.
const toStore = (status: string): VerifyState => (status === 'active' ? 'verified' : status) as VerifyState

/** Manual, picture-based verification for tutors and coaching centres. Pictures are only shown to an administrator; nothing is checked automatically. */
export default function RealVerification({ role }: { role: Role }) {
  const copy = COPY[role]
  const { user, toast, setVerification } = useStore()
  const [dashboard, setDashboard] = useState<WorkflowDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [institution, setInstitution] = useState('')
  const [education, setEducation] = useState('')
  const [subjects, setSubjects] = useState('')
  const [classes, setClasses] = useState('')
  const [areas, setAreas] = useState('')
  const [uploading, setUploading] = useState<string | null>(null)
  const [previews, setPreviews] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [missing, setMissing] = useState<string[]>([])
  const previewsRef = useRef(previews)
  previewsRef.current = previews

  const load = async (prefill = false) => {
    try {
      const next = await getWorkflowDashboard()
      setDashboard(next)
      setVerification(role, toStore(effectiveStatus(next)))
      const p = next.profile
      // Prefill once so a correction does not require retyping everything.
      if (prefill && p) {
        setInstitution(p.institution ?? ''); setEducation(p.education ?? '')
        setSubjects(joined(p.subjects)); setClasses(joined(p.classes)); setAreas(joined(p.areas))
      }
      // Thumbnails of the applicant's own pictures, fetched through the authenticated endpoint.
      for (const doc of next.documents ?? []) {
        const key = `${doc.document_type}:${doc.id}`
        if (previewsRef.current[key]) continue
        fetchPrivateDocument(doc.id).then((url) => setPreviews((p) => ({ ...Object.fromEntries(Object.entries(p).filter(([k]) => !k.startsWith(doc.document_type + ':'))), [key]: url }))).catch(() => {})
      }
    } catch (e) {
      setError(message(e, 'Could not load verification status.'))
    } finally { setLoading(false) }
  }
  // setVerification changes identity on every store update, so it must not be a dependency.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load(true) }, [])
  useEffect(() => () => { Object.values(previewsRef.current).forEach((u) => URL.revokeObjectURL(u)) }, [])

  const status = dashboard ? effectiveStatus(dashboard) : 'not_started'
  const appStatus = dashboard?.verification?.status
  const editable = !appStatus || appStatus === 'draft' || appStatus === 'resubmission_required'
  const requirements: DocumentRequirement[] = dashboard?.requirements ?? []
  const uploaded = new Map((dashboard?.documents ?? []).map((d) => [d.document_type, d]))

  const upload = async (req: DocumentRequirement, file: File | undefined) => {
    if (!file) return
    setError('')
    if (!ACCEPT.includes(file.type)) { setError('Please choose a JPG, PNG or WebP picture. PDF and Word files are not accepted.'); return }
    if (file.size > MAX_BYTES) { setError('Pictures must be 10 MB or smaller.'); return }
    setUploading(req.type)
    try {
      await uploadVerificationDocument(req.type, file)
      await load()
      toast(`${req.label} uploaded.`, 'success')
    } catch (e) {
      setError(message(e, 'Could not upload the picture.'))
    } finally { setUploading(null) }
  }

  const submit = async () => {
    setBusy(true); setError(''); setMissing([])
    try {
      await updateProfile({
        display_name: user?.name ?? dashboard?.account.name ?? '',
        ...(copy.institution ? { institution: institution.trim() } : {}),
        education: education.trim(),
        subjects: list(subjects), classes: list(classes), areas: list(areas),
      })
      await submitVerification()
      await load()
      toast('Your application was submitted for manual review.', 'success')
    } catch (e) {
      if (e instanceof ApiError && Array.isArray(e.details.missing)) setMissing(e.details.missing as string[])
      setError(message(e, 'Could not submit your application.'))
      await load()
    } finally { setBusy(false) }
  }

  if (loading) return <div role="status" className="p-6 text-sm text-gray-600">Loading your verification…</div>

  return (
    <div className="space-y-6">
      <PageHead title="Verification Center" tag={copy.tag} sub="An administrator reviews your details and pictures by hand. Nothing is approved automatically." actions={<StatusChip state={status} />} />
      <StatusPanel status={status} dashboard={dashboard} />
      {error && (
        <Card className="border-danger-600 bg-danger-50">
          <p role="alert" className="text-sm text-danger-700">{error}</p>
          {missing.length > 0 && <ul className="mt-2 list-disc pl-5 text-sm text-danger-700">{missing.map((m) => <li key={m}>{m}</li>)}</ul>}
        </Card>
      )}

      <Card>
        <h2 className="text-lg">1. {copy.heading}</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {copy.institution && <Field label={copy.institution[0]}>{(id) => <Input id={id} value={institution} disabled={!editable} onChange={(e) => setInstitution(e.target.value)} placeholder={copy.institution![1]} />}</Field>}
          <Field label={copy.education[0]}>{(id) => <Input id={id} value={education} disabled={!editable} onChange={(e) => setEducation(e.target.value)} placeholder={copy.education[1]} />}</Field>
          <Field label="Subjects" hint="Separate with commas">{(id) => <Input id={id} value={subjects} disabled={!editable} onChange={(e) => setSubjects(e.target.value)} placeholder="Mathematics, Physics" />}</Field>
          <Field label={copy.classes[0]} hint="Separate with commas">{(id) => <Input id={id} value={classes} disabled={!editable} onChange={(e) => setClasses(e.target.value)} placeholder={copy.classes[1]} />}</Field>
          <Field label="Areas" hint="Separate with commas">{(id) => <Input id={id} value={areas} disabled={!editable} onChange={(e) => setAreas(e.target.value)} placeholder="Mirpur, Uttara" />}</Field>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg">2. Verification pictures</h2>
        <p className="mt-1 text-sm text-gray-600">Take clear photos of the original documents. JPG, PNG or WebP, up to 10 MB each. Only you and TuitionHub administrators can see them.</p>
        <ul className="mt-4 grid gap-4 md:grid-cols-2">
          {requirements.map((req) => {
            const doc = uploaded.get(req.type)
            const preview = doc ? previews[`${req.type}:${doc.id}`] : undefined
            return (
              <li key={req.type} className="rounded-card border border-gray-200 p-4">
                <p className="font-semibold text-navy-900">{req.label} {req.required ? <span className="text-xs font-normal text-danger-600">(required)</span> : <span className="text-xs font-normal text-gray-600">(optional)</span>}</p>
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
    </div>
  )
}

function StatusPanel({ status, dashboard }: { status: string; dashboard: WorkflowDashboard | null }) {
  const v = dashboard?.verification
  const submitted = v?.submitted_at ? new Date(v.submitted_at).toLocaleString() : null
  if (status === 'pending' || status === 'under_review' || status.startsWith('interview')) {
    return <Banner tone="blue" icon={<Clock size={18} aria-hidden />} title={status.startsWith('interview') ? 'Interview stage' : 'Under review'} body={`Submitted ${submitted ?? ''}. An administrator will review your pictures and details. You will get a notification when a decision is made.`} />
  }
  if (status === 'resubmission_required') {
    return <Banner tone="amber" icon={<AlertTriangle size={18} aria-hidden />} title="Corrections requested" body={v?.correction_request ?? 'Please update your details or pictures and resubmit.'} />
  }
  if (status === 'rejected') {
    return <Banner tone="red" icon={<XCircle size={18} aria-hidden />} title="Application rejected" body={`${v?.rejection_reason ?? 'Your application was rejected.'} Rejections are final; contact support if you believe this is a mistake.`} />
  }
  if (status === 'active' || status === 'profile_incomplete' || status === 'approved') {
    return <Banner tone="green" icon={<ShieldCheck size={18} aria-hidden />} title="Verified" body="An administrator approved your application. Restricted features are now available." />
  }
  if (status === 'suspended') {
    return <Banner tone="red" icon={<XCircle size={18} aria-hidden />} title="Account suspended" body="Your account is suspended. Contact support for help." />
  }
  return <Banner tone="blue" icon={<ShieldCheck size={18} aria-hidden />} title="Get verified" body="Fill in your details, upload the required pictures, then submit. Until you are verified, your dashboard is read-only." />
}

function Banner({ tone, icon, title, body }: { tone: 'blue' | 'amber' | 'red' | 'green'; icon: React.ReactNode; title: string; body: string }) {
  const cls = { blue: 'border-blue-600 bg-blue-50', amber: 'border-warning-600 bg-warning-100', red: 'border-danger-600 bg-danger-50', green: 'border-emerald-600 bg-emerald-50' }[tone]
  return <Card className={cls}><div className="flex items-start gap-3">{icon}<div><p className="font-semibold text-navy-900">{title}</p><p className="mt-1 text-sm">{body}</p></div></div></Card>
}
