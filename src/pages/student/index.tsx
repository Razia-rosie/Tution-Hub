import type { ReactNode } from 'react'
import Dashboard from './Dashboard'
import Profile from './Profile'
import Verification from './Verification'
import { Attendance, MyTuition, Progress, Schedule, TutorPage } from './Tuition'
import { Work } from './Work'
import { Notifications, NotForStudents, Safety } from './Misc'
import FindTutor from '../parent/Find'
import Messages from '../parent/Messages'

const MAP: Record<string, (sub: string) => ReactNode> = {
  home: () => <Dashboard />,
  profile: (sub) => (sub.startsWith('verification') ? <Verification sub={sub.replace(/^verification\/?/, '')} /> : <Profile />),
  'my-tuition': () => <MyTuition />,
  schedule: () => <Schedule />,
  attendance: (sub) => (sub ? <NotForStudents what="Only your tutor can mark attendance." /> : <Attendance />),
  homework: () => <Work kind="Homework" />,
  assignments: () => <Work kind="Assignment" />,
  progress: () => <Progress />,
  tutor: () => <TutorPage />,
  messages: (sub) => <Messages sub={sub} />,
  'find-tutor': (sub) => <FindTutor sub={sub} />,
  notifications: () => <Notifications />,
  safety: () => <Safety />,
  students: () => <NotForStudents what="You cannot view other students." />,
  children: () => <NotForStudents what="You cannot view other students." />,
  'my-students': () => <NotForStudents what="You cannot view other students." />,
  payments: () => <NotForStudents what="Payments are handled and recorded by your guardian." />,
}
const StudentPage = { has: (k: string) => k in MAP, render: (k: string, sub: string) => MAP[k](sub) }
export default StudentPage
