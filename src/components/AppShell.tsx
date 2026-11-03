import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate, useParams, Navigate, Link } from 'react-router'
import { Bell, ShieldCheck, X, MoreHorizontal, LogOut, Monitor } from 'lucide-react'
import { NAV, ROLES, verifyPath, type Role } from '../lib/nav'
import { useStore, type VerifyState } from '../lib/store'
import { effectiveStatus, getNotifications, getWorkflowDashboard } from '../lib/api'
import { Avatar, IconButton, Select, StatusChip, cx } from './ui'

const isRole = (r?: string): r is Role => !!r && r in NAV

export function RoleRedirect() {
  const { role } = useParams()
  if (!isRole(role)) return <Navigate to="/" replace />
  return <Navigate to={`/app/${role}/${NAV[role][0].slug}`} replace />
}

export default function AppShell() {
  const { role: r } = useParams()
  const nav = useNavigate()
  const s = useStore()
  const [more, setMore] = useState(false)
  const role = isRole(r) ? r : 'tutor'
  const userRole = s.user?.role
  // Sync the banner with the server; local verification state is not persisted across reloads.
  useEffect(() => {
    if (!userRole || userRole === 'admin') return
    // The store's preview screens gate on 'verified'; the server calls the same state 'active'.
    getWorkflowDashboard().then((d) => { const st = effectiveStatus(d); s.setVerification(userRole, (st === 'active' ? 'verified' : st) as VerifyState) }).catch(() => {})
    // s.setVerification changes identity on every store update; re-run only when the user changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userRole])
  const [unread, setUnread] = useState(0)
  useEffect(() => {
    if (!userRole || userRole === 'admin') return
    const refresh = () => getNotifications().then((r) => setUnread((r.notifications ?? []).filter((n) => !n.read_at).length)).catch(() => {})
    void refresh()
    window.addEventListener('notifications:changed', refresh)
    return () => window.removeEventListener('notifications:changed', refresh)
  }, [userRole])
  if (s.restoring) return <div role="status" className="flex min-h-screen items-center justify-center bg-offwhite-50 text-sm text-gray-600">Restoring your session…</div>
  if (!s.signedIn || !s.user) return <Navigate to="/login" replace />
  if (role !== s.user.role) return <Navigate to={`/app/${s.user.role}`} replace />
  const meta = ROLES.find((x) => x.id === role)!
  const items = NAV[role]

  const vstate = s.verification[role]
  // Every public role is verified by hand before it gets full access.
  const needsVerify = role !== 'admin' && vstate !== 'verified' && vstate !== 'active'
  const verifyHref = verifyPath(role)

  return (
    <div className="min-h-screen bg-offwhite-50 md:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[70] focus:rounded focus:bg-white focus:p-2">Skip to content</a>

      {/* sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col bg-navy-900 text-white md:sticky md:top-0 md:flex md:h-screen">
        <Link to="/" className="flex items-center gap-2 px-5 py-5 font-heading text-lg font-bold">
          <ShieldCheck className="text-teal-300" aria-hidden /> TuitionHub
        </Link>
        <p className="px-5 pb-2 text-[11px] font-semibold uppercase tracking-wider text-navy-200">{meta.label}</p>
        <nav aria-label="Primary" className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
          {items.map((it) => (
            <NavLink key={it.slug} to={`/app/${role}/${it.slug}`}
              className={({ isActive }) => cx('flex items-center gap-3 rounded-input px-3 py-2 text-sm font-medium transition-colors', isActive ? 'bg-navy-700 text-white' : 'text-blue-100/80 hover:bg-navy-700/60')}>
              <it.icon size={18} aria-hidden /> {it.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-white/10 p-4">
          <p className="text-xs text-navy-200">Signed in as</p>
          <p className="truncate text-sm font-semibold">{s.user.name}</p>
          <button onClick={() => nav('/logout')} className="mt-2 inline-flex items-center gap-1.5 text-xs text-blue-100 hover:underline"><LogOut size={14} aria-hidden /> Sign out</button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col pb-16 md:pb-0">
        <header className="sticky top-0 z-30 flex flex-wrap items-center gap-3 border-b border-gray-200 bg-white px-4 py-2.5 md:px-8">
          <Link to="/" className="font-heading font-bold text-navy-900 md:hidden">TuitionHub</Link>
          <div className="ml-auto flex items-center gap-2">
            {role !== 'admin' && <span className="relative"><IconButton label={unread ? `Notifications, ${unread} unread` : 'Notifications'} onClick={() => nav(`/app/${role}/notifications`)}><Bell size={20} /></IconButton>{unread > 0 && <span aria-hidden className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-danger-600 px-1 text-center text-[10px] font-bold leading-4 text-white">{unread > 9 ? '9+' : unread}</span>}</span>}
            <Avatar name={s.user.name} size={32} />
          </div>
        </header>

        {needsVerify && (
          <div role="status" className="flex flex-wrap items-center gap-3 border-b border-warning-600/30 bg-warning-100 px-4 py-2.5 text-sm md:px-8">
            <StatusChip state={vstate} />
            <span className="text-charcoal-900">Limited, read-only dashboard. Posting, sending interest and chat are locked until you are verified.</span>
            <Link to={verifyHref} className="ml-auto font-semibold text-blue-600 hover:underline">Continue verification</Link>
          </div>
        )}

        {role === 'admin' && (
          <p className="flex items-center gap-2 bg-blue-100 px-4 py-2 text-xs text-navy-900 md:hidden"><Monitor size={14} aria-hidden /> Admin is desktop-first. Mobile shows a read-only summary. Open on desktop for full tools.</p>
        )}

        {role === 'coaching' && (
          <p className="flex items-center gap-2 bg-blue-100 px-4 py-2 text-xs text-navy-900 md:hidden"><Monitor size={14} aria-hidden /> Coaching tools work best on a tablet or desktop. Mobile shows a summary.</p>
        )}

        <main id="main" className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-6 md:px-8 md:py-8"><Outlet /></main>
      </div>

      {/* mobile tabs */}
      {role !== 'admin' && (
        <nav aria-label="Primary mobile" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-gray-200 bg-white md:hidden">
          {items.filter((i) => i.mobile).slice(0, 4).map((it) => (
            <NavLink key={it.slug} to={`/app/${role}/${it.slug}`} className={({ isActive }) => cx('flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium', isActive ? 'text-blue-600' : 'text-gray-600')}>
              <it.icon size={20} aria-hidden /> {it.label.split(' ')[0]}
            </NavLink>
          ))}
          <button onClick={() => setMore(true)} className="flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium text-gray-600"><MoreHorizontal size={20} aria-hidden /> More</button>
        </nav>
      )}
      {more && (
        <div className="fixed inset-0 z-50 bg-navy-900/50 md:hidden" onClick={() => setMore(false)}>
          <div role="dialog" aria-label="More" onClick={(e) => e.stopPropagation()} className="absolute inset-x-0 bottom-0 max-h-[75vh] overflow-y-auto rounded-t-modal bg-white p-4">
            <div className="mb-2 flex items-center justify-between"><h2 className="text-lg">More</h2><IconButton label="Close" onClick={() => setMore(false)}><X size={20} /></IconButton></div>
            <div className="grid grid-cols-3 gap-2">
              {items.filter((i) => !i.mobile).map((it) => (
                <NavLink key={it.slug} to={`/app/${role}/${it.slug}`} onClick={() => setMore(false)} className="flex min-h-20 flex-col items-center justify-center gap-1 rounded-card border border-gray-200 p-2 text-center text-xs font-medium text-navy-900">
                  <it.icon size={20} aria-hidden /> {it.label}
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
