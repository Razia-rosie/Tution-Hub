import type { ReactNode } from 'react'
import Verification from './Verification'
import Family from './Family'
import Overview from './Overview'
import Users from './Users'
import Audit from './Audit'
import { Awards, Matches, Payments, Reports, Reviews, Safety, Settings, Tickets, TuitionPosts } from './Platform'

const MAP: Record<string, (sub: string) => ReactNode> = {
  overview: () => <Overview />,
  verification: () => <Verification />,
  family: (sub) => <Family sub={sub} />,
  users: () => <Users />,
  tutors: () => <Users role="tutor" />,
  coaching: () => <Users role="coaching" />,
  parents: () => <Users role="parent" />,
  students: () => <Users role="student" />,
  'tuition-posts': () => <TuitionPosts />,
  matches: () => <Matches />,
  reports: () => <Reports />,
  analytics: () => <Reports title="Analytics" />,
  complaints: () => <Tickets title="Complaints and support" sub="Complaints, payment problems and help requests from users." categories={['complaint', 'support', 'payment']} />,
  appeals: () => <Tickets title="Appeals" sub="Users appealing a verification decision or suspension." categories={['appeal']} />,
  safety: () => <Safety />,
  reviews: () => <Reviews />,
  awards: () => <Awards />,
  payments: () => <Payments />,
  settings: () => <Settings />,
  'audit-log': () => <Audit />,
}

const AdminPage = { has: (key: string) => key in MAP, render: (key: string, sub: string) => MAP[key](sub) }
export default AdminPage
