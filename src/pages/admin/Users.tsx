import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Button, Card, Field, Input, Select, StatusChip, Textarea } from '../../components/ui'
import { getAdminUsers, setUserSuspended, type AdminUser } from '../../lib/api'
import { useStore } from '../../lib/store'
import { UserDetail } from './Platform'

const ROLE_TITLES: Record<string, string> = { '': 'All users', tutor: 'Private tutors', coaching: 'Coaching centres', parent: 'Parents and guardians', student: 'Students' }
const STATUSES = ['', 'pending', 'resubmission_required', 'interview_scheduled', 'profile_incomplete', 'active', 'rejected', 'suspended']
const PAGE = 25

/** Account management backed by the admin users API. `role` pre-filters the list for the per-role nav entries. */
export default function Users({ role = '' }: { role?: string }) {
  const { toast } = useStore()
  const [roleFilter, setRoleFilter] = useState(role)
  const [status, setStatus] = useState('')
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [suspending, setSuspending] = useState<AdminUser | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [detail, setDetail] = useState<string | null>(null)

  useEffect(() => { setRoleFilter(role); setOffset(0) }, [role])
  const load = () => {
    setLoading(true)
    return getAdminUsers({ role: roleFilter, status, q: search, limit: PAGE, offset })
      .then((r) => { setUsers(r.users ?? []); setTotal(r.total); setError('') })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load users.'))
      .finally(() => setLoading(false))
  }
  useEffect(() => { void load() }, [roleFilter, status, search, offset])

  const toggle = async (user: AdminUser, suspend: boolean) => {
    setBusy(true)
    try {
      await setUserSuspended(user.id, suspend, reason)
      toast(suspend ? `${user.name} suspended. Their sessions were ended.` : `${user.name} reactivated.`, 'success')
      setSuspending(null); setReason('')
      await load()
    } catch (e) { toast(e instanceof Error ? e.message : 'Could not update the account.', 'danger') }
    finally { setBusy(false) }
  }

  return (
    <div className="space-y-6">
      <div><p className="text-sm text-gray-600">Administrator</p><h1 className="text-3xl">{ROLE_TITLES[roleFilter] ?? 'Users'}</h1></div>
      <Card>
        <form className="grid gap-3 sm:grid-cols-2 sm:items-end xl:grid-cols-[1fr_200px_200px_auto]" onSubmit={(e) => { e.preventDefault(); setOffset(0); setSearch(query.trim()) }}>
          <Field label="Search name or email">{(id) => <Input id={id} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. rahman or @gmail.com" />}</Field>
          <Field label="Role">{(id) => <Select id={id} value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setOffset(0) }} options={Object.entries(ROLE_TITLES).map(([value, l]) => ({ value, label: l }))} />}</Field>
          <Field label="Account status">{(id) => <Select id={id} value={status} onChange={(e) => { setStatus(e.target.value); setOffset(0) }} options={STATUSES.map((v) => ({ value: v, label: v ? v.replaceAll('_', ' ') : 'Any status' }))} />}</Field>
          <Button type="submit">Search</Button>
        </form>
      </Card>
      {error && <Card className="border-danger-600 bg-danger-50"><p role="alert" className="text-sm text-danger-700">{error}</p></Card>}
      <Card pad={false}>
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-gray-200 text-xs uppercase text-gray-600"><tr><th className="p-3">Name</th><th className="p-3">Role</th><th className="p-3">Account</th><th className="p-3">Verification</th><th className="p-3">Joined</th><th className="p-3"><span className="sr-only">Actions</span></th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="p-3"><button className="font-semibold text-blue-600 hover:underline" onClick={() => setDetail(u.id)}>{u.name}</button><p className="break-all text-xs text-gray-600">{u.email}</p></td>
                  <td className="p-3 capitalize">{u.role}</td>
                  <td className="p-3"><StatusChip state={u.account_status} /></td>
                  <td className="p-3">{u.verification_status ? <Link className="text-blue-600 hover:underline" to="/app/admin/verification">{u.verification_status.replaceAll('_', ' ')}</Link> : <span className="text-gray-600">—</span>}</td>
                  <td className="p-3 text-gray-600">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="p-3 text-right">{u.role === 'admin' ? null : u.account_status === 'suspended'
                    ? <Button size="sm" variant="secondary" loading={busy} onClick={() => void toggle(u, false)}>Reactivate</Button>
                    : <Button size="sm" variant="destructive" onClick={() => { setSuspending(u); setReason('') }}>Suspend</Button>}</td>
                </tr>
              ))}
              {!loading && users.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-gray-600">No users match.</td></tr>}
              {loading && <tr><td colSpan={6} className="p-6 text-center text-gray-600" role="status">Loading…</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-gray-100 p-3 text-sm">
          <span className="text-gray-600">{total === 0 ? '0 users' : `${offset + 1}–${Math.min(offset + PAGE, total)} of ${total}`}</span>
          <div className="flex gap-2"><Button size="sm" variant="secondary" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>Previous</Button><Button size="sm" variant="secondary" disabled={offset + PAGE >= total} onClick={() => setOffset(offset + PAGE)}>Next</Button></div>
        </div>
      </Card>
      {suspending && (
        <div role="dialog" aria-modal="true" aria-labelledby="suspend-title" className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md">
            <h2 id="suspend-title" className="text-lg">Suspend {suspending.name}?</h2>
            <p className="mt-1 text-sm text-gray-600">They are signed out everywhere and cannot sign in until reactivated. The reason is shown to them and kept in the audit log.</p>
            <div className="mt-4"><Field label="Reason" hint="At least 10 characters">{(id) => <Textarea id={id} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />}</Field></div>
            <div className="mt-4 flex justify-end gap-2"><Button variant="secondary" onClick={() => setSuspending(null)}>Cancel</Button><Button variant="destructive" loading={busy} disabled={reason.trim().length < 10} onClick={() => void toggle(suspending, true)}>Suspend account</Button></div>
          </Card>
        </div>
      )}
      {detail && <UserDetail id={detail} onClose={() => setDetail(null)} />}
    </div>
  )
}
