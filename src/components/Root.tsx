import { Outlet } from 'react-router'
import { ToastHost } from './ui'
export default function Root() {
  return <><Outlet /><ToastHost /></>
}
