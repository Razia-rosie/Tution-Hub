import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Card } from '../../components/ui'
import { getAdminStats, type AdminStats } from '../../lib/api'

const ROLE_LABELS: Record<string, string> = { tutor: 'Private tutors', coaching: 'Coaching centres', parent: 'Parents', student: 'Students', admin: 'Administrators' }

/** Live platform figures computed by the backend from the database. */
export default function Overview() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { getAdminStats().then(setStats).catch((e) => setError(e instanceof Error ? e.message : 'Could not load statistics.')) }, [])

  const apps = stats?.applications_by_status ?? {}
  const waiting = (apps.pending ?? 0) + (apps.under_review ?? 0)
  const oldestDays = stats?.oldest_pending_at ? Math.floor((Date.now() - Date.parse(stats.oldest_pending_at)) / 86_400_000) : null
  return (
    <div className="space-y-6">
      <div><p className="text-sm text-gray-600">Administrator</p><h1 className="text-3xl">Overview</h1></div>
      {error && <Card className="border-danger-600 bg-danger-50"><p role="alert" className="text-sm text-danger-700">{error}</p></Card>}
      {!stats && !error && <p role="status" className="text-sm text-gray-600">Loading…</p>}
      {stats && <>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Awaiting review" value={waiting} note={oldestDays === null ? 'Queue is empty' : `Oldest waiting ${oldestDays} day${oldestDays === 1 ? '' : 's'}`} href="/app/admin/verification" />
          <Stat label="Corrections requested" value={apps.resubmission_required ?? 0} note="Waiting on applicants" />
          <Stat label="Sign-ups (7 days)" value={stats.signups_last_7_days} />
          <Stat label="Decisions (7 days)" value={stats.decisions_last_7_days} />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card><h2 className="text-lg">Accounts by role</h2><Table rows={Object.entries(stats.users_by_role).map(([k, v]) => [ROLE_LABELS[k] ?? k, v])} /></Card>
          <Card><h2 className="text-lg">Verification applications</h2><Table rows={['draft', 'pending', 'under_review', 'resubmission_required', 'approved', 'rejected'].map((k) => [k === 'resubmission_required' ? 'Correction requested' : k.replace('_', ' '), apps[k] ?? 0])} /></Card>
          <Card><h2 className="text-lg">Accounts by status</h2><p className="text-xs text-gray-600">Excludes administrators.</p><Table rows={Object.entries(stats.users_by_status).map(([k, v]) => [k.replaceAll('_', ' '), v])} /></Card>
        </div>
      </>}
    </div>
  )
}

function Stat({ label, value, note, href }: { label: string; value: number; note?: string; href?: string }) {
  const body = <Card><p className="text-sm text-gray-600">{label}</p><p className="mt-1 font-heading text-3xl font-bold text-navy-900">{value}</p>{note && <p className="mt-1 text-xs text-gray-600">{note}</p>}</Card>
  return href ? <Link to={href} className="block hover:opacity-90">{body}</Link> : body
}

function Table({ rows }: { rows: [string, number][] }) {
  return <dl className="mt-3 divide-y divide-gray-100 text-sm">{rows.map(([k, v]) => <div key={k} className="flex justify-between py-2 capitalize"><dt className="text-gray-600">{k}</dt><dd className="font-semibold">{v}</dd></div>)}</dl>
}
