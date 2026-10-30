import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { Button, Card, EmptyState } from './ui'
import { getNotifications, markNotificationsRead, type AppNotification } from '../lib/api'

/** The signed-in user's notifications from the backend (verification decisions, interviews, account changes). */
export default function RealNotifications() {
  const [items, setItems] = useState<AppNotification[] | null>(null)
  const [error, setError] = useState('')
  const load = () => getNotifications().then((r) => setItems(r.notifications ?? [])).catch((e) => setError(e instanceof Error ? e.message : 'Could not load notifications.'))
  useEffect(() => { void load() }, [])

  const markAll = async () => {
    try { await markNotificationsRead(); await load(); window.dispatchEvent(new Event('notifications:changed')) } catch (e) { setError(e instanceof Error ? e.message : 'Could not update notifications.') }
  }
  const markOne = async (id: string) => {
    try { await markNotificationsRead(id); await load(); window.dispatchEvent(new Event('notifications:changed')) } catch (e) { setError(e instanceof Error ? e.message : 'Could not update notifications.') }
  }
  const unread = items?.filter((n) => !n.read_at).length ?? 0

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-3xl">Notifications</h1><p className="mt-1 text-sm text-gray-600">{unread} unread</p></div>
        <Button variant="secondary" size="sm" disabled={unread === 0} onClick={() => void markAll()}>Mark all as read</Button>
      </div>
      {error && <Card className="border-danger-600 bg-danger-50"><p role="alert" className="text-sm text-danger-700">{error}</p></Card>}
      {items === null && !error && <p role="status" className="text-sm text-gray-600">Loading…</p>}
      {items?.length === 0 && <EmptyState title="No notifications yet" body="Verification decisions, interview invitations and account changes will appear here." />}
      {items && items.length > 0 && (
        <Card pad={false}>
          <ul className="divide-y divide-gray-100">
            {items.map((n) => (
              <li key={n.id} className={`flex items-start gap-3 p-4 ${n.read_at ? '' : 'bg-blue-50/60'}`}>
                <Bell size={18} className={`mt-0.5 shrink-0 ${n.read_at ? 'text-gray-400' : 'text-blue-600'}`} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-navy-900">{n.title}{!n.read_at && <span className="sr-only"> (unread)</span>}</p>
                  <p className="mt-0.5 break-words text-sm">{n.body}</p>
                  <p className="mt-1 text-xs text-gray-600">{new Date(n.created_at).toLocaleString()}</p>
                </div>
                {!n.read_at && <Button size="sm" variant="tertiary" onClick={() => void markOne(n.id)}>Mark read</Button>}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
