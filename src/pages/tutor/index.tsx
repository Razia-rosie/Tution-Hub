import type { ReactNode } from 'react'
import Dashboard from './Dashboard'
import Verification from './Verification'
import Find from './Find'
import Messages from './Tuition'
import Students from './Students'
import { Schedule, Attendance, Homework, Progress } from './Manage'
import { Reviews, Ranking, Awards, Payments } from './Standing'
import { MyPosts, Profile, Notifications, Safety } from './Misc'

const MAP: Record<string, (sub: string) => ReactNode> = {
  dashboard: () => <Dashboard />,
  verification: (sub) => <Verification sub={sub} />,
  'find-tuition': (sub) => <Find sub={sub} />,
  messages: (sub) => <Messages sub={sub} />,
  'my-students': (sub) => <Students sub={sub} />,
  'my-posts': () => <MyPosts />,
  schedule: () => <Schedule />,
  attendance: () => <Attendance />,
  homework: () => <Homework kind="Homework" />,
  assignments: () => <Homework kind="Assignment" />,
  progress: () => <Progress />,
  reviews: () => <Reviews />,
  ranking: () => <Ranking />,
  awards: (sub) => <Awards sub={sub} />,
  payments: () => <Payments />,
  profile: () => <Profile />,
  notifications: () => <Notifications />,
  safety: () => <Safety />,
}
const TutorPage = { has: (k: string) => k in MAP, render: (k: string, sub: string) => MAP[k](sub) }
export default TutorPage
