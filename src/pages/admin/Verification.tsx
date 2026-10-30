import { useEffect, useState } from 'react'
import { Button, Card, Field, Input, Select, StatusChip, Textarea } from '../../components/ui'
import { fetchPrivateDocument, getAdminApplications, getAdminDocuments, recordAdminInterviewOutcome, reviewAdminApplication, scheduleAdminInterview, type AdminApplication } from '../../lib/api'

type DocumentMeta = { id: string; document_type: string; original_name: string; mime_type: string; byte_size: number; uploaded_at: string }

export default function Verification() {
  const [status, setStatus] = useState('')
  const [role, setRole] = useState('')
  const [applications, setApplications] = useState<AdminApplication[]>([])
  const [selected, setSelected] = useState<AdminApplication | null>(null)
  const [documents, setDocuments] = useState<DocumentMeta[]>([])
  const [documentUrl, setDocumentUrl] = useState('')
  const [decision, setDecision] = useState<'approved' | 'rejected' | 'resubmission_required'>('approved')
  const [reason, setReason] = useState('')
  const [mode, setMode] = useState<'online' | 'in_person'>('online')
  const [scheduledAt, setScheduledAt] = useState('')
  const [location, setLocation] = useState('')
  const [outcomeNotes, setOutcomeNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const load = () => getAdminApplications({ status, role }).then(({ applications: items }) => setApplications(items)).catch((e) => setError(e instanceof Error ? e.message : 'Could not load applications.'))
  useEffect(() => { void load() }, [status, role])
  // Object URLs pin the decrypted image in memory until revoked.
  useEffect(() => () => { if (documentUrl) URL.revokeObjectURL(documentUrl) }, [documentUrl])

  const open = async (application: AdminApplication) => {
    setSelected(application); setError(''); setMessage(''); setDocumentUrl('')
    try { setDocuments((await getAdminDocuments(application.id)).documents) } catch (e) { setError(e instanceof Error ? e.message : 'Could not load document metadata.') }
  }

  const act = async (fn: () => Promise<unknown>, success: string) => {
    setBusy(true); setError(''); setMessage('')
    try { await fn(); await load(); if (selected) { const next = (await getAdminApplications({ status, role })).applications.find((item) => item.id === selected.id) ?? null; setSelected(next) }; setMessage(success) }
    catch (e) { setError(e instanceof Error ? e.message : 'The operation failed.') }
    finally { setBusy(false) }
  }

  return (
    <div className="space-y-6">
      <div><p className="text-sm text-gray-600">Administrator</p><h1 className="text-3xl">Verification review</h1><p className="mt-1 text-sm text-gray-600">Review only applications and documents returned by the backend.</p></div>
      {error && <Card className="border-danger-600 bg-danger-50"><p role="alert" className="text-sm text-danger-700">{error}</p></Card>}
      {message && <Card className="border-emerald-600 bg-emerald-50"><p role="status" className="text-sm text-emerald-700">{message}</p></Card>}
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <Field label="Status">{(id) => <Select id={id} value={status} onChange={(e) => setStatus(e.target.value)} options={['', 'pending', 'under_review', 'resubmission_required', 'approved', 'rejected']} />}</Field>
            <Field label="Role">{(id) => <Select id={id} value={role} onChange={(e) => setRole(e.target.value)} options={['', 'tutor', 'student', 'parent', 'coaching']} />}</Field>
          </div>
          <div className="mt-5 space-y-2">
            {applications.length === 0 && <p className="text-sm text-gray-600">No applications match these filters.</p>}
            {applications.map((application) => <button key={application.id} onClick={() => void open(application)} className={`w-full rounded-input border p-3 text-left ${selected?.id === application.id ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-400'}`}><span className="block font-semibold">{application.name}</span><span className="block text-xs text-gray-600">{application.role} · {application.email}</span><span className="mt-2 block"><StatusChip state={application.status} /></span></button>)}
          </div>
        </Card>
        {!selected ? <Card><p className="text-sm text-gray-600">Select an application to inspect its profile, documents, and interview history.</p></Card> : (
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl">{selected.name}</h2><p className="text-sm text-gray-600">{selected.email} · {selected.role}</p></div><StatusChip state={selected.status} /></div>
            <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">{Object.entries(selected.profile ?? {}).filter(([, value]) => value !== null && value !== undefined).map(([key, value]) => <div key={key}><dt className="text-gray-600">{key.replaceAll('_', ' ')}</dt><dd className="font-medium">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</dd></div>)}</dl>
            <section className="mt-6 border-t border-gray-100 pt-5"><h3 className="font-semibold">Documents</h3><div className="mt-2 space-y-2">{documents.length === 0 && <p className="text-sm text-gray-600">No documents submitted.</p>}{documents.map((document) => <div key={document.id} className="flex flex-wrap items-center justify-between gap-2 rounded-input border border-gray-200 p-3 text-sm"><span>{document.document_type} · {document.original_name} · {Math.ceil(document.byte_size / 1024)} KB</span><Button size="sm" variant="secondary" onClick={async () => { try { setDocumentUrl(await fetchPrivateDocument(document.id)) } catch (e) { setError(e instanceof Error ? e.message : 'Could not retrieve document.') } }}>View securely</Button></div>)}</div>{documentUrl && <img src={documentUrl} alt="Private verification document" className="mt-4 max-h-80 rounded-input border object-contain" />}</section>
            <section className="mt-6 border-t border-gray-100 pt-5"><h3 className="font-semibold">Decision</h3><div className="mt-3 grid gap-3 sm:grid-cols-2"><Field label="Decision">{(id) => <Select id={id} value={decision} onChange={(e) => setDecision(e.target.value as typeof decision)} options={['approved', 'resubmission_required', 'rejected']} />}</Field><Field label="Reason" hint={decision === 'approved' ? 'Optional' : 'Required for rejection or correction'}>{(id) => <Textarea id={id} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field></div><Button className="mt-3" loading={busy} disabled={decision !== 'approved' && reason.trim().length < 10} onClick={() => void act(() => reviewAdminApplication(selected.id, decision, reason), 'Decision saved by the server.')}>Save decision</Button></section>
            <section className="mt-6 border-t border-gray-100 pt-5"><h3 className="font-semibold">Interview</h3><div className="mt-3 grid gap-3 sm:grid-cols-2"><Field label="Mode">{(id) => <Select id={id} value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} options={['online', 'in_person']} />}</Field><Field label="Date and time">{(id) => <Input id={id} type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />}</Field><Field label="Location or meeting link">{(id) => <Input id={id} value={location} onChange={(e) => setLocation(e.target.value)} />}</Field></div><Button className="mt-3" variant="secondary" loading={busy} disabled={!scheduledAt} onClick={() => void act(() => scheduleAdminInterview(selected.id, { mode, scheduled_at: new Date(scheduledAt).toISOString(), location_or_link: location }), 'Interview scheduled and persisted.')}>Schedule interview</Button>{selected.interviews?.map((interview) => <div key={interview.id} className="mt-4 rounded-input border border-gray-200 p-3 text-sm"><p className="font-semibold">{interview.mode} · {new Date(interview.scheduled_at).toLocaleString()} · {interview.status}</p>{interview.location_or_link && <p className="mt-1 text-gray-600">{interview.location_or_link}</p>}{interview.status === 'scheduled' && <><Textarea className="mt-3" value={outcomeNotes} onChange={(e) => setOutcomeNotes(e.target.value)} placeholder="Outcome notes" /><div className="mt-2 flex gap-2"><Button size="sm" onClick={() => void act(() => recordAdminInterviewOutcome(selected.id, interview.id, 'completed', outcomeNotes), 'Interview marked completed.')}>Record completed</Button><Button size="sm" variant="secondary" onClick={() => void act(() => recordAdminInterviewOutcome(selected.id, interview.id, 'cancelled', outcomeNotes), 'Interview cancelled.')}>Cancel interview</Button></div></>}</div>)}</section>
          </Card>
        )}
      </div>
    </div>
  )
}
