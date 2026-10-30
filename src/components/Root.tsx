import { Outlet } from 'react-router'
import { ToastHost } from './ui'
import MaintenanceBanner from './MaintenanceBanner'
export default function Root() {
  return <><MaintenanceBanner /><Outlet /><ToastHost /></>
}
