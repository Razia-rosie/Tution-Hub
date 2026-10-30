import type { ReactNode } from 'react'
import Verification from './Verification'

const MAP: Record<string, (sub: string) => ReactNode> = {
  verification: () => <Verification />,
}

const AdminPage = { has: (key: string) => key in MAP, render: (key: string, sub: string) => MAP[key](sub) }
export default AdminPage
