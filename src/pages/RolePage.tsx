import { lazy, Suspense, type ComponentType, type ReactNode } from 'react'
import { useParams } from 'react-router'
import { FlaskConical } from 'lucide-react'
import { NAV, type Role } from '../lib/nav'
import { EmptyState } from '../components/ui'
import RealNotifications from '../components/RealNotifications'

type RoleModule = { has: (key: string) => boolean; render: (key: string, sub: string) => ReactNode }
type RoleProps = { page: string; sub: string }

// Each role's screens are loaded on demand so a user only downloads their own area.
const roleModule = (load: () => Promise<{ default: RoleModule }>) =>
  lazy(async () => {
    const mod = (await load()).default
    const Component: ComponentType<RoleProps> = ({ page, sub }) => (mod.has(page) ? <>{mod.render(page, sub)}</> : <NotFound />)
    return { default: Component }
  })

const MODULES: Record<Role, ComponentType<RoleProps>> = {
  tutor: roleModule(() => import('./tutor')),
  parent: roleModule(() => import('./parent')),
  student: roleModule(() => import('./student')),
  coaching: roleModule(() => import('./coaching')),
  admin: roleModule(() => import('./admin')),
}

/**
 * Screens wired to the backend. Everything else in the role areas is an interactive
 * preview built on sample data held in the browser: it is not saved and is not the
 * user's real data, so it carries a visible notice.
 */
const isConnected = (role: Role, page: string, sub: string) =>
  role === 'admin' || page === 'notifications' || (page === 'verification' && sub === '' && (role === 'tutor' || role === 'coaching'))

function NotFound() {
  return <EmptyState title="Screen not found" body="This route is not part of your navigation." />
}

function SampleDataNotice() {
  return (
    <div role="note" className="mb-4 flex items-start gap-2 rounded-input border border-dashed border-warning-600 bg-warning-100 px-3 py-2 text-sm text-charcoal-900">
      <FlaskConical size={16} className="mt-0.5 shrink-0 text-warning-600" aria-hidden />
      <p><strong>Preview with sample data.</strong> This section is not connected to your account yet. Names and figures are examples, and changes are not saved.</p>
    </div>
  )
}

export default function RolePage() {
  const { role, page = '', '*': sub = '' } = useParams()
  if (!role || !(role in NAV)) return <NotFound />
  const r = role as Role
  if (page === 'notifications' && r !== 'admin') return <RealNotifications />
  const Module = MODULES[r]
  return (
    <>
      {!isConnected(r, page, sub) && <SampleDataNotice />}
      <Suspense fallback={<p role="status" className="p-6 text-sm text-gray-600">Loading…</p>}>
        <Module page={page} sub={sub} />
      </Suspense>
    </>
  )
}
