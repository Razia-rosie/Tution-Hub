import { Outlet } from 'react-router'
import { ToastHost } from './ui'
import DemoDrawer from './DemoDrawer'
export default function Root() {
  return <><Outlet /><DemoDrawer /><ToastHost /></>
}
