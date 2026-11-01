import { useEffect, useState } from 'react'
import { Button, Card, Chip, Field, Select, Tabs, Textarea } from '../../components/ui'
import { childStage, reviewStage } from '../../components/FamilyVerification'
import { getAdminStudentInvitations, reviewStudentInvitation, type AdminStudentInvitation } from '../../lib/api'
import Verification from './Verification'

const TABS = ['Parent verification', 'Student registration requests', 'Student verification']
const FILTERS = [
  { value: 'pending_approval', label: 'Waiting for permission' },
  { value: 'approved', label: 'Allowed to register' },
  { value: 'registered', label: 'Registered' },
  { value: 'rejected', label: 'Refused' },
  { value: 'expired', label: 'Expired' },
  { value: '', label: 'All' },
]
const when = (value?: string | null) => (value ? new Date(value).toLocaleString() : '—')

/**
 * Parent and student verification. Parents and students are reviewed
 * separately; between the two, an administrator decides whether the child
 * email a parent submitted may be used to register a student account.
 */
export default function Family({ sub }: { sub: string }) {
  const initial = sub === 'requests' ? TABS[1] : sub === 'students' ? TABS[2] : TABS[0]
  const [tab, setTab] = useState(initial)
  return (
    <div className="space-y-6">
      <div><p className="text-sm text-gray-600">Administrator</p><h1 className="text-3xl">Parent &amp; Student Verification</h1><p className="mt-1 text-sm text-gray-600">Parent signup → parent NID and child birth certificate → parent approved → student registration allowed → child registers with that email → student reviewed. Each account is approved on its own.</p></div>
      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      {tab === TABS[0] && <Verification key="parent" fixedRole="parent" title="Parent verification requests" />}
      {tab === TABS[1] && <InvitationQueue />}
      {tab === TABS[2] && <Verification key="student" fixedRole="student" title="Student verification requests" />}
    </div>
  )
}

function InvitationQueue() {
  const [status, setStatus] = useState('pending_approval')
  const [items, setItems] = useState<AdminStudentInvitation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)

  const load = () => getAdminStudentInvitations(status).then((r) => setItems(r.invitations ?? [])).catch((e) => setError(e instanceof Error ? e.message : 'Could not load requests.')).finally(() => setLoading(false))
  useEffect(() => { setLoading(true); setError(''); void load() }, [status]) // eslint-disable-line react-hooks/exhaustive-deps

  const decide = async (inv: AdminStudentInvitation, decision: 'approved' | 'rejected') => {
    setBusy(inv.id); setError(''); setMessage('')
    try {
      await reviewStudentInvitation(inv.id, decision, reasons[inv.id] ?? '')
      setMessage(decision === 'approved' ? `${inv.child_email} may now register as a student.` : `The request for ${inv.child_email} was refused.`)
      setReasons((r) => ({ ...r, [inv.id]: '' }))
      await load()
    } catch (e) { setError(e instanceof Error ? e.message : 'The decision could not be saved.') } finally { setBusy(null) }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl">Student registration requests</h2>
      <p className="text-sm text-gray-600">A parent submitted these child emails. Allowing one lets the child sign up as a Student with that exact email and their own password. Permission can only be granted once the parent is approved, and lasts 30 days.</p>
      {error && <Card className="border-danger-600 bg-danger-50"><p role="alert" className="text-sm text-danger-700">{error}</p></Card>}
      {message && <Card className="border-emerald-600 bg-emerald-50"><p role="status" className="text-sm text-emerald-700">{message}</p></Card>}
      <Card>
        <div className="max-w-xs"><Field label="Status">{(id) => <Select id={id} value={status} onChange={(e) => setStatus(e.target.value)} options={FILTERS} />}</Field></div>
        <div className="mt-4 space-y-3" aria-live="polite">
          {loading && <p className="text-sm text-gray-600">Loading…</p>}
          {!loading && items.length === 0 && <p className="text-sm text-gray-600">No requests match this filter.</p>}
          {items.map((inv) => {
            const parent = reviewStage('parent', inv.parent_account_status, inv.parent_verification_status)
            const child = childStage(inv)
            const reason = reasons[inv.id] ?? ''
            const decidable = inv.status === 'pending_approval' || inv.status === 'expired'
            return (
              <article key={inv.id} className="rounded-input border border-gray-200 p-4 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0"><p className="break-all font-semibold text-navy-900">Child email: {inv.child_email}</p><p className="text-xs text-gray-600">{inv.child_name ? `${inv.child_name} · ` : ''}Requested {when(inv.created_at)}</p></div>
                  <Chip tone={child.tone}>{child.label}</Chip>
                </div>
                <dl className="mt-3 grid gap-2 sm:grid-cols-3">
                  <div><dt className="text-gray-600">Parent</dt><dd className="break-all font-medium">{inv.parent_name} · {inv.parent_email}</dd></div>
                  <div><dt className="text-gray-600">Relationship</dt><dd className="font-medium">{inv.relationship}</dd></div>
                  <div><dt className="text-gray-600">Parent verification</dt><dd><Chip tone={parent.tone}>{parent.label}</Chip></dd></div>
                  {inv.student_id && <div><dt className="text-gray-600">Student account</dt><dd className="font-medium">{inv.student_name} · <span className="capitalize">{reviewStage('student', inv.student_account_status, inv.student_verification_status).label}</span></dd></div>}
                  {inv.expires_at && (inv.status === 'approved' || inv.status === 'expired') && <div><dt className="text-gray-600">Permission expires</dt><dd className="font-medium">{when(inv.expires_at)}</dd></div>}
                  {inv.rejection_reason && <div className="sm:col-span-3"><dt className="text-gray-600">Reason</dt><dd className="font-medium">{inv.rejection_reason}</dd></div>}
                </dl>
                {(decidable || inv.status === 'approved') && (
                  <div className="mt-3 grid gap-3 border-t border-gray-100 pt-3 sm:grid-cols-[1fr_auto]">
                    <Field label="Reason shown to the parent" hint="Required to refuse, at least 10 characters">{(id) => <Textarea id={id} value={reason} onChange={(e) => setReasons((r) => ({ ...r, [inv.id]: e.target.value }))} />}</Field>
                    <div className="flex flex-wrap items-end gap-2">
                      {decidable && <Button loading={busy === inv.id} disabled={parent.label !== 'Approved'} onClick={() => void decide(inv, 'approved')}>{inv.status === 'expired' ? 'Allow again' : 'Allow registration'}</Button>}
                      <Button variant="destructive" loading={busy === inv.id} disabled={reason.trim().length < 10} onClick={() => void decide(inv, 'rejected')}>{inv.status === 'approved' ? 'Withdraw permission' : 'Refuse'}</Button>
                    </div>
                    {decidable && parent.label !== 'Approved' && <p className="text-xs text-warning-600 sm:col-span-2">Approve the parent under Parent verification before allowing this child to register.</p>}
                  </div>
                )}
              </article>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
