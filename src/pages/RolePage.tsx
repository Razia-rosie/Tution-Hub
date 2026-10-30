import { lazy, Suspense, type ReactNode } from 'react'
import { useParams } from 'react-router'
import { NAV, type Role } from '../lib/nav'
import { EmptyState } from '../components/ui'
import RealNotifications from '../components/RealNotifications'
import type { ClassroomTab } from '../features/Classrooms'

// Feature modules load on demand so each user downloads only what they open.
const Messages = lazy(() => import('../features/Messages'))
const Classrooms = lazy(() => import('../features/Classrooms'))
const Tuitions = lazy(() => import('../features/Tuitions'))
const RealVerification = lazy(() => import('../components/RealVerification'))
const AdminRoutes = lazy(async () => {
  const mod = (await import('./admin')).default
  return { default: ({ page, sub }: { page: string; sub: string }) => (mod.has(page) ? <>{mod.render(page, sub)}</> : <NotFound />) }
})
const named = <K extends string>(load: () => Promise<Record<K, React.ComponentType<never>>>, key: K) =>
  lazy(async () => ({ default: (await load())[key] as React.ComponentType<Record<string, unknown>> }))
const mk = () => import('../features/Marketplace')
const pp = () => import('../features/People')
const co = () => import('../features/Coaching')
const tu = () => import('../features/Tuitions')
const FindTuition = named(mk, 'FindTuition')
const MyApplications = named(mk, 'MyApplications')
const MyPosts = named(mk, 'MyPosts')
const FindTutors = named(mk, 'FindTutors')
const PaymentsOverview = named(tu, 'PaymentsOverview')
const Dashboard = named(pp, 'Dashboard')
const Profile = named(pp, 'Profile')
const Children = named(pp, 'Children')
const Progress = named(pp, 'StudentProgressPage')
const Reviews = named(pp, 'Reviews')
const Ranking = named(pp, 'Ranking')
const Awards = named(pp, 'Awards')
const Safety = named(pp, 'Safety')
const Teachers = named(co, 'Teachers')
const CStudents = named(co, 'Students')
const Batches = named(co, 'Batches')
const Exams = named(co, 'Exams')
const Fees = named(co, 'Fees')
const Parents = named(co, 'Parents')
const CReports = named(co, 'Reports')

type Render = (sub: string, base: string) => ReactNode
const room = (tab: ClassroomTab, title: string): Render => (sub, base) => <Classrooms tab={tab} sub={sub} basePath={base} title={title} />
const messages: Render = (sub, base) => <Messages sub={sub} basePath={base} />

// Every navigation item of every role maps to a screen backed by the API.
const ROUTES: Record<Exclude<Role, 'admin'>, Record<string, Render>> = {
  tutor: {
    dashboard: () => <Dashboard />, 'find-tuition': () => <FindTuition />, 'my-posts': () => <MyApplications />,
    'my-students': () => <Tuitions title="My students" sub="Your tuitions: demo-class requests, terms to confirm and active students." />,
    schedule: room('Schedule', 'Schedule'), attendance: room('Attendance', 'Attendance'), homework: room('Homework', 'Homework'), assignments: room('Homework', 'Assignments'), progress: room('Progress', 'Progress'),
    reviews: () => <Reviews />, ranking: () => <Ranking />, awards: () => <Awards />, payments: () => <PaymentsOverview />,
    verification: () => <RealVerification role="tutor" />, profile: () => <Profile />, messages, notifications: () => <RealNotifications />, safety: () => <Safety />,
  },
  student: {
    home: () => <Dashboard />, 'my-tuition': () => <Tuitions title="My tuition" />,
    schedule: room('Schedule', 'Schedule'), attendance: room('Attendance', 'Attendance'), homework: room('Homework', 'Homework'), assignments: room('Homework', 'Assignments'),
    progress: () => <Progress mode="student" />, tutor: () => <Tuitions title="My tutors" sub="Tutors you study with." filter="active" />, messages,
    profile: () => <Profile />, 'find-tutor': () => <FindTutors role="student" />, notifications: () => <RealNotifications />, safety: () => <Safety />,
  },
  parent: {
    dashboard: () => <Dashboard />, children: () => <Children />, 'find-tutor': () => <FindTutors role="parent" />, 'my-posts': () => <MyPosts role="parent" />,
    tuitions: () => <Tuitions title="Tuitions" />, schedule: room('Schedule', 'Schedule'), attendance: room('Attendance', 'Attendance'), homework: room('Homework', 'Homework and assignments'),
    progress: () => <Progress mode="parent" />, payments: () => <PaymentsOverview />, messages, notifications: () => <RealNotifications />, safety: () => <Safety />, settings: () => <Profile />,
  },
  coaching: {
    dashboard: () => <Dashboard />, teachers: () => <Teachers />, students: () => <CStudents />, batches: () => <Batches />,
    classes: room('Schedule', 'Classes'), attendance: room('Attendance', 'Attendance'), homework: room('Homework', 'Homework'),
    exams: () => <Exams />, results: () => <Exams />, parents: () => <Parents />, reports: () => <CReports />, payments: () => <Fees />,
    verification: () => <RealVerification role="coaching" />, profile: () => <Profile />, messages, notifications: () => <RealNotifications />,
  },
}

function NotFound() {
  return <EmptyState title="Screen not found" body="This route is not part of your navigation." />
}

export default function RolePage() {
  const { role, page = '', '*': sub = '' } = useParams()
  if (!role || !(role in NAV)) return <NotFound />
  const r = role as Role
  const render = r === 'admin' ? () => <AdminRoutes page={page} sub={sub} /> : ROUTES[r][page]
  return (
    <Suspense fallback={<p role="status" className="p-6 text-sm text-gray-600">Loading…</p>}>
      {render ? render(sub, `/app/${r}/${page}`) : <NotFound />}
    </Suspense>
  )
}
