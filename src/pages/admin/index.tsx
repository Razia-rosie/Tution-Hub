import type { ReactNode } from 'react'
import Verification from './Verification'
import Overview from './Overview'
import Users from './Users'
import Audit from './Audit'

const MAP: Record<string, (sub: string) => ReactNode> = {
  overview: () => <Overview />,
  verification: () => <Verification />,
  users: () => <Users />,
  tutors: () => <Users role="tutor" />,
  coaching: () => <Users role="coaching" />,
  parents: () => <Users role="parent" />,
  students: () => <Users role="student" />,
  'audit-log': () => <Audit />,
}

const AdminPage = { has: (key: string) => key in MAP, render: (key: string, sub: string) => MAP[key](sub) }
export default AdminPage
