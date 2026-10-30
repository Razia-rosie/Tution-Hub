import { useEffect, useState } from 'react'
import { useStore, type VerifyState } from '../lib/store'
import { Button, Card, Field, Input, StatusChip } from './ui'
import { PageHead } from './tutor/bits'
import { effectiveStatus, getWorkflowDashboard, submitVerification, updateProfile, uploadVerificationDocument, type WorkflowDashboard } from '../lib/api'

type Role = 'tutor' | 'coaching'

// Per-role copy. Both roles store into the same role_profiles columns so the
// backend completion score (display_name, education, subjects, classes, areas) applies to each.
const COPY: Record<Role, { tag: string; heading: string; education: [string, string]; classes: [string, string]; institution?: [string, string]; docType: string; docLabel: string }> = {
  tutor: {
    tag: 'TV-01', heading: 'Tutor profile and verification',
    education: ['Education', 'Degree and institution'], classes: ['Classes', 'Class 9, SSC'],
    docType: 'identity', docLabel: 'Identity document image',
  },
  coaching: {
    tag: 'CV-01', heading: 'Institute profile and verification',
    institution: ['Institute name', 'Registered name of the coaching centre'],
    education: ['Registration details', 'Trade licence or registration number'], classes: ['Levels taught', 'SSC, HSC, Admission'],
    docType: 'trade_license', docLabel: 'Trade licence or registration certificate image',
  },
}

const list = (value: string) => value.split(',').map((x) => x.trim()).filter(Boolean)
const joined = (value: unknown) => (Array.isArray(value) ? value.join(', ') : '')

export default function RealVerification({ role }: { role: Role }) {
  const copy = COPY[role]
  const { user, toast, setVerification } = useStore()
  const [dashboard, setDashboard] = useState<WorkflowDashboard | null>(null)
  const [institution, setInstitution] = useState('')
  const [education, setEducation] = useState('')
  const [subjects, setSubjects] = useState('')
  const [classes, setClasses] = useState('')
  const [areas, setAreas] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [fileKey, setFileKey] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = async (prefill = false) => {
    try {
      const next = await getWorkflowDashboard()
      setDashboard(next)
      setVerification(role, effectiveStatus(next) as VerifyState)
      const p = next.profile
      // Prefill once so a resubmission does not require retyping everything.
      if (prefill && p) {
        setInstitution(p.institution ?? ''); setEducation(p.education ?? '')
        setSubjects(joined(p.subjects)); setClasses(joined(p.classes)); setAreas(joined(p.areas))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load verification status.')
    }
  }
  // setVerification changes identity on every store update, so it must not be a dependency.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load(true) }, [])

  const clearFile = () => { setFile(null); setFileKey((k) => k + 1) }

  const saveAndSubmit = async () => {
    if ((copy.institution && !institution.trim()) || !education.trim() || !list(subjects).length || !list(classes).length || !list(areas).length) {
      setError(`${[copy.institution?.[0], copy.education[0], 'subjects', copy.classes[0].toLowerCase(), 'areas'].filter(Boolean).join(', ')} are required.`)
      return
    }
    setBusy(true); setError('')
    try {
      await updateProfile({
        display_name: user?.name ?? '',
        ...(copy.institution ? { institution: institution.trim() } : {}),
        education: education.trim(),
        subjects: list(subjects), classes: list(classes), areas: list(areas),
      })
      const { verification } = await submitVerification()
      await load()
      if (file && verification?.id) {
        try { await uploadVerificationDocument(verification.id, copy.docType, file); clearFile() }
        catch (e) {
          // The application already exists at this point; keep it and let the user retry the upload alone.
          setError(`Your application was submitted, but the document upload failed: ${e instanceof Error ? e.message : 'unknown error'} Choose the file again and use "Upload document".`)
          return
        }
      }
      toast('Your verification application was submitted.', 'success')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit verification.')
    } finally { setBusy(false) }
  }

  const uploadOnly = async () => {
    if (!file || !dashboard?.verification) return
    setBusy(true); setError('')
    try { await uploadVerificationDocument(dashboard.verification.id, copy.docType, file); clearFile(); toast('Document uploaded.', 'success') }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not upload the document.') }
    finally { setBusy(false) }
  }

  const status = dashboard ? effectiveStatus(dashboard) : 'not_started'
  const submitted = !!dashboard?.verification && status !== 'resubmission_required'
  // Mirrors the backend rule in SaveDocument: documents can change only before review.
  const canUpload = dashboard?.verification?.status === 'pending' || dashboard?.verification?.status === 'resubmission_required'
  const locked = submitted
  return (
    <div className="space-y-6">
      <PageHead title="Verification Center" tag={copy.tag} sub="Submit your real profile for administrator review." actions={<StatusChip state={status} />} />
      {error && <Card className="border-danger-600 bg-danger-50"><p role="alert" className="text-sm text-danger-700">{error}</p></Card>}
      {dashboard?.verification?.correction_request && status === 'resubmission_required' && (
        <Card className="border-warning-600 bg-warning-100"><p className="text-sm font-semibold">Corrections requested</p><p className="mt-1 text-sm">{dashboard.verification.correction_request}</p></Card>
      )}
      <Card>
        <h2 className="text-lg">{copy.heading}</h2>
        <p className="mt-1 text-sm text-gray-600">These details are saved to your account and reviewed by an administrator. Do not upload documents you are not authorized to share.</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {copy.institution && <Field label={copy.institution[0]}>{(id) => <Input id={id} value={institution} disabled={locked} onChange={(e) => setInstitution(e.target.value)} placeholder={copy.institution![1]} />}</Field>}
          <Field label={copy.education[0]}>{(id) => <Input id={id} value={education} disabled={locked} onChange={(e) => setEducation(e.target.value)} placeholder={copy.education[1]} />}</Field>
          <Field label="Subjects" hint="Separate with commas">{(id) => <Input id={id} value={subjects} disabled={locked} onChange={(e) => setSubjects(e.target.value)} placeholder="Mathematics, Physics" />}</Field>
          <Field label={copy.classes[0]} hint="Separate with commas">{(id) => <Input id={id} value={classes} disabled={locked} onChange={(e) => setClasses(e.target.value)} placeholder={copy.classes[1]} />}</Field>
          <Field label="Areas" hint="Separate with commas">{(id) => <Input id={id} value={areas} disabled={locked} onChange={(e) => setAreas(e.target.value)} placeholder="Mirpur, Uttara" />}</Field>
          <Field label={copy.docLabel} hint="JPEG, PNG, or WebP; maximum 10 MB">{(id) => <Input key={fileKey} id={id} type="file" accept="image/jpeg,image/png,image/webp" disabled={!!dashboard?.verification && !canUpload} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />}</Field>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button onClick={() => void saveAndSubmit()} loading={busy} disabled={submitted}>{submitted ? 'Submitted for review' : status === 'resubmission_required' ? 'Save and resubmit' : 'Save and submit for review'}</Button>
          {submitted && canUpload && <Button variant="secondary" onClick={() => void uploadOnly()} loading={busy} disabled={!file}>Upload document</Button>}
          {dashboard && <span className="text-sm text-gray-600">Profile completion: {dashboard.account.profile_complete}%</span>}
        </div>
      </Card>
      {dashboard?.verification && (
        <Card>
          <h2 className="text-lg">Application status</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-gray-600">Status</dt><dd><StatusChip state={status} /></dd></div>
            {dashboard.verification.rejection_reason && <div><dt className="text-gray-600">Reason</dt><dd className="mt-1">{dashboard.verification.rejection_reason}</dd></div>}
          </dl>
        </Card>
      )}
    </div>
  )
}
