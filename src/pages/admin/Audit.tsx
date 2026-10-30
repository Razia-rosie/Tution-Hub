import { useEffect, useState } from 'react'
import { Button, Card, Field, Select } from '../../components/ui'
import { getAuditLog, type AuditEntry } from '../../lib/api'

const ACTIONS = ['', 'verification_submitted', 'verification_resubmitted', 'verification_approved', 'verification_rejected', 'verification_resubmission_required', 'document_uploaded', 'document_viewed', 'interview_scheduled', 'interview_completed', 'interview_cancelled', 'user_suspended', 'user_reactivated']
const PAGE = 50

/** Read-only view of the append-only audit trail. */
export default function Audit() {
  const [action, setAction] = useState('')
  const [offset, setOffset] = useState(0)
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    setLoading(true)
    getAuditLog({ action, limit: PAGE, offset }).then((r) => { setEntries(r.entries ?? []); setError('') }).catch((e) => setError(e instanceof Error ? e.message : 'Could not load the audit log.')).finally(() => setLoading(false))
  }, [action, offset])

  return (
    <div className="space-y-6">
      <div><p className="text-sm text-gray-600">Administrator</p><h1 className="text-3xl">Audit log</h1><p className="mt-1 text-sm text-gray-600">Every verification decision, picture upload and view, interview and account suspension.</p></div>
      <Card><div className="max-w-xs"><Field label="Action">{(id) => <Select id={id} value={action} onChange={(e) => { setAction(e.target.value); setOffset(0) }} options={ACTIONS.map((a) => ({ value: a, label: a ? a.replaceAll('_', ' ') : 'All actions' }))} />}</Field></div></Card>
      {error && <Card className="border-danger-600 bg-danger-50"><p role="alert" className="text-sm text-danger-700">{error}</p></Card>}
      <Card pad={false}>
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-gray-200 text-xs uppercase text-gray-600"><tr><th className="p-3">When</th><th className="p-3">Action</th><th className="p-3">By</th><th className="p-3">Subject</th><th className="p-3">Details</th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {entries.map((e) => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap p-3 text-gray-600">{new Date(e.created_at).toLocaleString()}</td>
                  <td className="p-3 font-medium">{e.action.replaceAll('_', ' ')}</td>
                  <td className="p-3">{e.actor_name ?? '—'}{e.actor_role ? <span className="text-xs text-gray-600"> ({e.actor_role})</span> : null}</td>
                  <td className="p-3">{e.subject_name ?? '—'}</td>
                  <td className="max-w-xs break-words p-3 text-xs text-gray-600">{Object.entries(e.metadata ?? {}).filter(([k, v]) => v !== '' && v !== null && !k.endsWith('_id')).map(([k, v]) => `${k.replaceAll('_', ' ')}: ${String(v)}`).join(' · ')}</td>
                </tr>
              ))}
              {!loading && entries.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-gray-600">No entries.</td></tr>}
              {loading && <tr><td colSpan={5} className="p-6 text-center text-gray-600" role="status">Loading…</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-100 p-3"><Button size="sm" variant="secondary" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>Newer</Button><Button size="sm" variant="secondary" disabled={entries.length < PAGE} onClick={() => setOffset(offset + PAGE)}>Older</Button></div>
      </Card>
    </div>
  )
}
