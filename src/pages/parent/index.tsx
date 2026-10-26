import type { ReactNode } from 'react'
import Dashboard from './Dashboard'
import Children from './Children'
import { Tuitions, Schedule, Attendance, Homework, Progress, Payments } from './Monitor'
import FindTutor from './Find'
import Posts from './Posts'
import Messages from './Messages'
import { Notifications, Safety, Settings } from './Misc'

const MAP: Record<string, (sub: string) => ReactNode> = {
  dashboard: () => <Dashboard />,
  children: (sub) => <Children sub={sub} />,
  'find-tutor': (sub) => <FindTutor sub={sub} />,
  'my-posts': (sub) => <Posts sub={sub} />,
  messages: (sub) => <Messages sub={sub} />,
  tuitions: () => <Tuitions />,
  schedule: () => <Schedule />,
  attendance: () => <Attendance />,
  homework: () => <Homework />,
  progress: () => <Progress />,
  payments: () => <Payments />,
  notifications: () => <Notifications />,
  safety: () => <Safety />,
  settings: (sub) => <Settings sub={sub} />,
}
const ParentPage = { has: (k: string) => k in MAP, render: (k: string, sub: string) => MAP[k](sub) }
export default ParentPage
