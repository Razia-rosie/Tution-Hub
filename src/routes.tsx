import { createBrowserRouter } from 'react-router'
import Root from './components/Root'
import AppShell, { RoleRedirect } from './components/AppShell'
import PublicLayout from './components/public/PublicLayout'
import Landing from './pages/Landing'
import { HowItWorksPage, SafetyPage, AboutPage } from './pages/public/Info'
import Faq from './pages/public/Faq'
import Contact from './pages/public/Contact'
import { FindTutor, TutorProfile, FindTuition, TuitionDetail, CoachingDirectory, CoachingProfile, NotFound } from './pages/public/Search'
import { AuthLayout } from './pages/auth/Layout'
import Login from './pages/auth/Login'
import { SignUp, RoleSelect, EmailVerify } from './pages/auth/Signup'
import { Forgot, ForgotSent, Reset, ResetDone, Recover, Logout, Gate, AdminLogin } from './pages/auth/Recovery'
import DesignSystem from './pages/DesignSystem'
import Reference from './pages/Reference'
import RolePage from './pages/RolePage'
import RouteError from './components/RouteError'

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Root,
    ErrorBoundary: RouteError,
    children: [
      {
        Component: PublicLayout,
        children: [
          { index: true, Component: Landing },
          { path: 'how-it-works', Component: HowItWorksPage },
          { path: 'find-tutor', Component: FindTutor },
          { path: 'tutors/:id', Component: TutorProfile },
          { path: 'find-tuition', Component: FindTuition },
          { path: 'tuition/:id', Component: TuitionDetail },
          { path: 'coaching', Component: CoachingDirectory },
          { path: 'coaching/:id', Component: CoachingProfile },
          { path: 'safety', Component: SafetyPage },
          { path: 'about', Component: AboutPage },
          { path: 'contact', Component: Contact },
          { path: 'faq', Component: Faq },
          { path: '*', Component: NotFound },
        ],
      },
      {
        Component: AuthLayout,
        children: [
          { path: 'login', Component: Login },
          { path: 'signup', Component: SignUp },
          { path: 'signup/role', Component: RoleSelect },
          { path: 'signup/:role', Component: SignUp },
          { path: 'verify/email', Component: EmailVerify },
          { path: 'forgot', Component: Forgot },
          { path: 'forgot/sent', Component: ForgotSent },
          { path: 'reset', Component: Reset },
          { path: 'reset/done', Component: ResetDone },
          { path: 'recover', Component: Recover },
          { path: 'logout', Component: Logout },
          { path: 'auth/gate', Component: Gate },
          { path: 'admin/login', Component: AdminLogin },
        ],
      },
      { path: 'design-system', Component: DesignSystem },
      { path: 'reference', Component: Reference },
      { path: 'app/:role', Component: RoleRedirect },
      { path: 'app/:role', Component: AppShell, children: [{ path: ':page/*', Component: RolePage }] },
    ],
  },
])
