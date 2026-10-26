import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Lock } from 'lucide-react'
import { useStore } from '../../lib/store'
import { confirmedKids, pickKid, type Kid, type Perm } from '../../lib/parent'
import { Card, EmptyState } from '../../components/ui'

export function useKid() {
  const s = useStore(); const kids = confirmedKids(s.pj); const kid = pickKid(s.pj, s.child)
  return { s, kids, kid }
}

export function NoChild() {
  return <Card><EmptyState title="No linked child yet" body="Link a child and wait for their confirmation. Every screen here shows one linked child at a time." action={<Link to="/app/parent/children/add" className="text-sm font-semibold text-blue-600 hover:underline">Link a child</Link>} /></Card>
}

export function PermOff({ kid, what, perm }: { kid: Kid; what: string; perm: keyof Perm }) {
  return (
    <Card className="flex flex-wrap items-center gap-3 bg-offwhite-50"><Lock size={20} className="text-gray-600" aria-hidden />
      <div className="min-w-0 flex-1"><p className="font-semibold text-navy-900">{what} is turned off for {kid.short}</p><p className="text-sm text-gray-600">You switched this off under permissions ({perm}). Nothing is hidden from {kid.short}.</p></div>
      <Link to={`/app/parent/children/${kid.id}/permissions`} className="text-sm font-semibold text-blue-600 hover:underline">Change permissions</Link></Card>
  )
}

export function Scoped({ perm, what, children }: { perm?: keyof Perm; what?: string; children: (kid: Kid) => ReactNode }) {
  const { kid } = useKid()
  if (!kid) return <NoChild />
  if (perm && !kid.perms[perm]) return <PermOff kid={kid} what={what ?? 'This view'} perm={perm} />
  return <>{children(kid)}</>
}
