import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { FlaskConical, Menu, ShieldCheck, X } from 'lucide-react'
import { btnClass, cx, IconButton } from '../ui'
import { GateProvider } from './bits'

export const PUBLIC_NAV = [
  { to: '/how-it-works', label: 'How It Works' }, { to: '/find-tutor', label: 'Find Tutor' }, { to: '/find-tuition', label: 'Find Tuition' },
  { to: '/coaching', label: 'Coaching' }, { to: '/safety', label: 'Safety' }, { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' }, { to: '/faq', label: 'FAQ' },
]

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link to="/" className={cx('inline-flex items-center gap-2 font-heading text-xl font-bold', light ? 'text-white' : 'text-navy-900')}>
      <span className="flex h-8 w-8 items-center justify-center rounded-input bg-navy-900 text-white"><ShieldCheck size={18} strokeWidth={1.5} aria-hidden /></span>
      TuitionHub
    </Link>
  )
}

export default function PublicLayout() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  useEffect(() => { setOpen(false); window.scrollTo(0, 0) }, [pathname])

  return (
    <div className="flex min-h-screen flex-col overflow-x-clip bg-offwhite-50">
      <a href="#content" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[70] focus:rounded focus:bg-white focus:p-2">Skip to content</a>
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-4 px-6 xl:gap-6">
          <Logo />
          <nav aria-label="Main" className="ml-2 xl:ml-4 hidden items-center lg:flex lg:gap-0 xl:gap-1">
            {PUBLIC_NAV.map((n) => (
              <NavLink key={n.to} to={n.to} className={({ isActive }) => cx('rounded-input px-2 py-2 text-sm font-medium transition-colors xl:px-2.5', isActive ? 'text-blue-600' : 'text-charcoal-900 hover:text-blue-600')}>{n.label}</NavLink>
            ))}
          </nav>
          <div className="ml-auto hidden items-center gap-2 sm:flex">
            <Link to="/login" className={btnClass('secondary')}>Log in</Link>
            <Link to="/signup" className={btnClass('primary')}>Sign up</Link>
          </div>
          <IconButton label="Open menu" className="ml-auto sm:ml-0 lg:hidden" onClick={() => setOpen(true)}><Menu size={22} strokeWidth={1.5} /></IconButton>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 bg-navy-900/50 lg:hidden" onClick={() => setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label="Menu" onClick={(e) => e.stopPropagation()} className="absolute right-0 top-0 flex h-full w-80 max-w-[88vw] flex-col bg-white p-5 shadow-modal">
            <div className="flex items-center justify-between"><Logo /><IconButton label="Close menu" onClick={() => setOpen(false)}><X size={22} strokeWidth={1.5} /></IconButton></div>
            <nav aria-label="Mobile" className="mt-6 flex flex-col">
              {PUBLIC_NAV.map((n) => <Link key={n.to} to={n.to} className="border-b border-gray-100 py-3.5 text-base font-medium text-charcoal-900">{n.label}</Link>)}
            </nav>
            <div className="mt-auto grid gap-2 pt-6">
              <Link to="/login" className={btnClass('secondary', 'lg')}>Log in</Link>
              <Link to="/signup" className={btnClass('primary', 'lg')}>Sign up</Link>
            </div>
          </div>
        </div>
      )}

      <main id="content" className="flex-1 pb-4"><GateProvider><Outlet /></GateProvider></main>

      <footer className="bg-navy-900 text-white">
        <div className="mx-auto max-w-[1200px] px-6 py-16">
          <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
            <div>
              <Logo light />
              <p className="mt-4 max-w-xs text-sm text-navy-200">A verified, safety-first marketplace for finding, fixing and managing tuition in Bangladesh.</p>
            </div>
            {[
              ['Find', [['Find Tutor', '/find-tutor'], ['Find Tuition', '/find-tuition'], ['Coaching', '/coaching'], ['How It Works', '/how-it-works']]],
              ['Join', [['As a Tutor', '/signup/tutor'], ['As a Parent', '/signup/parent'], ['As a Coaching centre', '/signup/coaching'], ['Log in', '/login']]],
              ['Company', [['Safety', '/safety'], ['About', '/about'], ['Contact', '/contact'], ['FAQ', '/faq'], ['Admin login', '/admin/login']]],
            ].map(([h, links]) => (
              <div key={h as string}>
                <h2 className="font-heading text-sm font-semibold uppercase tracking-wider text-white">{h as string}</h2>
                <ul className="mt-4 space-y-2.5 text-sm">
                  {(links as string[][]).map(([l, to]) => <li key={to}><Link to={to} className="text-navy-200 hover:text-white hover:underline">{l}</Link></li>)}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-12 flex flex-col gap-4 border-t border-white/15 pt-6 text-sm text-navy-200 md:flex-row md:items-center md:justify-between">
            <p className="flex items-start gap-2"><FlaskConical size={16} strokeWidth={1.5} className="mt-0.5 shrink-0" aria-hidden />
              <span><strong className="text-white">Demo data — fictional.</strong> This is a clickable prototype. All people, scores, reviews and payments are invented. No real OTP, payments, GPS, AI or database.</span></p>
            <p className="shrink-0">© 2026 TuitionHub (prototype)</p>
          </div>
        </div>
      </footer>

    </div>
  )
}
