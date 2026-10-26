import type { ReactNode } from 'react'
import Dashboard from './Dashboard'
import Verification from './Verification'
import { Teachers, Students, Parents } from './People'
import { Batches, Classes, Attendance } from './Academics'
import { HomeworkPage, Exams, Results, Reports } from './Work'
import { Payments, ProfilePage, Messages, Notifications } from './Ops'

const MAP: Record<string, (sub: string) => ReactNode> = {
  dashboard: () => <Dashboard />,
  verification: (sub) => <Verification sub={sub} />,
  teachers: (sub) => <Teachers sub={sub} />,
  students: (sub) => <Students sub={sub} />,
  parents: (sub) => <Parents sub={sub} />,
  batches: (sub) => <Batches sub={sub} />,
  classes: (sub) => <Classes sub={sub} />,
  attendance: (sub) => <Attendance sub={sub} />,
  homework: (sub) => <HomeworkPage sub={sub} />,
  exams: (sub) => <Exams sub={sub} />,
  results: () => <Results />,
  reports: (sub) => <Reports sub={sub} />,
  payments: () => <Payments />,
  profile: () => <ProfilePage />,
  messages: (sub) => <Messages sub={sub} />,
  notifications: () => <Notifications />,
}
const CoachingPage = { has: (k: string) => k in MAP, render: (k: string, sub: string) => MAP[k](sub) }
export default CoachingPage
