import { useParams } from 'react-router'
import TutorPage from './tutor'
import ParentPage from './parent'
import StudentPage from './student'
import CoachingPage from './coaching'
import { NAV, ROLES, type Role } from '../lib/nav'
import { Card, Chip, EmptyState } from '../components/ui'
import { Construction } from 'lucide-react'

export default function RolePage() {
  const { role, page, '*': sub = '' } = useParams()
  if (role === 'tutor' && TutorPage.has(page ?? '')) return TutorPage.render(page ?? '', sub)
  if (role === 'parent' && ParentPage.has(page ?? '')) return ParentPage.render(page ?? '', sub)
  if (role === 'student' && StudentPage.has(page ?? '')) return StudentPage.render(page ?? '', sub)
  if (role === 'coaching' && CoachingPage.has(page ?? '')) return CoachingPage.render(page ?? '', sub)
  const item = NAV[role as Role]?.find((i) => i.slug === page)
  const meta = ROLES.find((r) => r.id === role)
  if (!item || !meta) return <EmptyState title="Screen not found" body="This route is not part of the role navigation." />
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-gray-600">{meta.label}</p>
        <h1 className="text-3xl">{item.label}</h1>
      </div>
      <Card className="flex items-start gap-3">
        <Construction className="mt-0.5 text-warning-600" aria-hidden />
        <div>
          <p className="font-semibold text-navy-900">Not built yet <Chip tone="amber">Planned</Chip></p>
          <p className="mt-1 text-sm text-gray-600">The navigation, shell and states are live. This screen's content is scheduled in a later build step.</p>
        </div>
      </Card>
    </div>
  )
}
