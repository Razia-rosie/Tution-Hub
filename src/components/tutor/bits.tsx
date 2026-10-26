import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { FileLock2, Lock, ChevronRight } from 'lucide-react'
import { Button, Card, Chip, DemoTag, cx } from '../ui'

export function PageHead({ title, sub, tag, actions, crumb }: { title: string; sub?: string; tag?: string; actions?: ReactNode; crumb?: { to: string; label: string } }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        {crumb && <Link to={crumb.to} className="mb-1 inline-block text-sm font-semibold text-blue-600 hover:underline">← {crumb.label}</Link>}
        <h1 className="flex flex-wrap items-center gap-2 text-2xl md:text-3xl">{title}{tag && <span className="font-body text-xs font-semibold text-gray-600"><Chip tone="gray">{tag}</Chip></span>}</h1>
        {sub && <p className="mt-1 max-w-2xl text-sm text-gray-600">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Masked({ value, className }: { value: string; className?: string }) {
  return <span className={cx('tabular font-mono text-charcoal-900', className)} aria-label="Masked value">{value}</span>
}

export function LockChip({ children = 'Hidden until agreement' }: { children?: ReactNode }) {
  return <Chip tone="gray" icon={<Lock size={12} aria-hidden />}>{children}</Chip>
}

export function DocPlaceholder({ label, file, uploaded, onToggle }: { label: string; file: string; uploaded: boolean; onToggle: () => void }) {
  return (
    <div className={cx('rounded-card border border-dashed p-4', uploaded ? 'border-teal-600 bg-success-100/60' : 'border-gray-400 bg-white')}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-input bg-gray-100 text-gray-600"><FileLock2 size={26} strokeWidth={1.5} aria-hidden /></span>
        <div className="min-w-[11rem] flex-1">
          <p className="text-sm font-semibold text-navy-900">{label}</p>
          {uploaded
            ? <p className="mt-0.5 text-xs text-gray-600"><span className="tabular font-mono">{file}</span> · ████████ · DEMO, no real document</p>
            : <p className="mt-0.5 text-xs text-gray-600">No file added. Nothing is uploaded or stored in this prototype.</p>}
        </div>
        <Button size="sm" variant={uploaded ? 'secondary' : 'primary'} onClick={onToggle}>{uploaded ? 'Remove placeholder' : 'Add placeholder file'}</Button>
      </div>
      <p className="mt-3 flex items-center gap-2 text-xs text-gray-600"><DemoTag /> <span>DEMO, no real document. In production this is an encrypted upload visible only to reviewers.</span></p>
    </div>
  )
}

export function StatLink({ to, label, value, sub, icon, tone = 'teal' }: { to: string; label: string; value: string; sub?: string; icon: ReactNode; tone?: 'teal' | 'blue' | 'amber' }) {
  return (
    <Link to={to} className="group block rounded-card border border-gray-200 bg-white p-6 shadow-card">
      <div className="flex items-start justify-between"><p className="text-sm text-gray-600">{label}</p><span className={tone === 'amber' ? 'text-warning-600' : tone === 'blue' ? 'text-navy-700' : 'text-teal-700'}>{icon}</span></div>
      <p className="mt-2 font-heading text-3xl font-bold text-navy-900 tabular">{value}</p>
      <p className="mt-1 flex items-center justify-between text-xs text-gray-600"><span>{sub}</span><ChevronRight size={14} className="text-gray-400 transition group-hover:translate-x-0.5" aria-hidden /></p>
    </Link>
  )
}

export function Locked({ what, children }: { what: string; children?: ReactNode }) {
  return (
    <Card className="flex flex-wrap items-center gap-3 bg-warning-100/50">
      <Lock size={20} className="text-warning-600" aria-hidden />
      <div className="min-w-0 flex-1"><p className="font-semibold text-navy-900">{what} is locked</p><p className="text-sm text-gray-600">Complete verification to unlock it. You can still browse in read-only mode.</p></div>
      {children ?? <Link to="/app/tutor/verification" className="text-sm font-semibold text-blue-600 hover:underline">Continue verification</Link>}
    </Card>
  )
}
