import { type ReactNode } from 'react'
import { Link, Outlet } from 'react-router'
import { BadgeCheck, Lock, MapPin, ShieldCheck } from 'lucide-react'
import { Logo } from '../../components/public/PublicLayout'

export function AuthLayout() {
  return (
    <div className="flex min-h-screen overflow-x-clip bg-offwhite-50">
      <aside className="relative hidden w-[42%] max-w-[560px] flex-col justify-between bg-navy-900 p-10 text-white lg:flex">
        <Logo light />
        <div>
          <h2 className="font-heading text-3xl font-bold leading-tight !text-white">Everyone verified.<br />Every class accounted for.</h2>
          <ul className="mt-8 space-y-4 text-blue-100">
            {[[BadgeCheck, 'Tutors, students and guardians are all verified'], [MapPin, 'Only your approximate area is shown until you agree'], [Lock, 'NID and documents stay masked from the public']].map(([I, t]) => { const Icon = I as typeof Lock; return <li key={t as string} className="flex items-start gap-3 text-sm"><Icon size={18} strokeWidth={1.5} className="mt-0.5 shrink-0 text-teal-600" aria-hidden />{t as string}</li> })}
          </ul>
        </div>
        <p className="text-xs text-blue-100/80">Your documents are seen only by you and the TuitionHub review team.</p>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between px-6 py-5">
          <div className="lg:invisible"><Logo /></div>
        </header>
        <main id="content" className="flex flex-1 items-start justify-center px-6 pb-16 pt-4 sm:items-center">
          <div className="w-full max-w-md"><Outlet /></div>
        </main>
        <footer className="px-6 pb-6 text-center text-xs text-gray-600"><Link to="/safety" className="hover:underline">Safety</Link> · <Link to="/contact" className="hover:underline">Help</Link> · <Link to="/" className="hover:underline">Home</Link></footer>
      </div>
    </div>
  )
}

export function AuthHead({ icon, title, lead, tone = 'blue' }: { icon?: ReactNode; title: string; lead?: ReactNode; tone?: 'blue' | 'green' | 'red' | 'amber' }) {
  const t = { blue: 'bg-blue-100 text-blue-600', green: 'bg-success-100 text-teal-700', red: 'bg-danger-100 text-danger-600', amber: 'bg-warning-100 text-warning-600' }[tone]
  return (
    <div className="mb-6">
      {icon && <span className={`mb-4 flex h-12 w-12 items-center justify-center rounded-full ${t}`}>{icon}</span>}
      <h1 className="text-3xl">{title}</h1>
      {lead && <p className="mt-2 text-gray-600">{lead}</p>}
    </div>
  )
}
export function AuthCard({ children }: { children: ReactNode }) {
  return <div className="rounded-modal border border-gray-200 bg-white p-6 shadow-card sm:p-8">{children}</div>
}
export function Notice({ tone = 'red', children }: { tone?: 'red' | 'amber' | 'blue' | 'green'; children: ReactNode }) {
  const c = { red: 'bg-danger-100 text-danger-600', amber: 'bg-warning-100 text-warning-600', blue: 'bg-blue-100 text-navy-700', green: 'bg-success-100 text-teal-700' }[tone]
  return <div role={tone === 'red' ? 'alert' : 'status'} className={`flex items-start gap-2 rounded-input px-3 py-2.5 text-sm ${c}`}><ShieldCheck size={16} className="mt-0.5 shrink-0" aria-hidden /><div>{children}</div></div>
}
