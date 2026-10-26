import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode, type InputHTMLAttributes } from 'react'
import {
  AlertTriangle, BadgeCheck, CheckCircle2, Clock, Eye, FlaskConical, Loader2, Lock, X, XCircle, Info,
  GraduationCap, Briefcase, ShieldCheck, Sparkles, Building2, Users, Circle, ArrowUpDown,
} from 'lucide-react'
import { useStore, type VerifyState } from '../lib/store'

export const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(' ')

/* Demo tag */
export function DemoTag({ label = 'Demo', title }: { label?: string; title?: string }) {
  return (
    <span title={title ?? 'Simulated behaviour. Production needs a real backend.'} className="inline-flex items-center gap-1 rounded-full border border-dashed border-warning-600/50 bg-warning-100/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-warning-600">
      <FlaskConical size={11} aria-hidden /> {label}
    </span>
  )
}

/* Button */
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'tertiary' | 'destructive'
  size?: 'sm' | 'md'
  loading?: boolean
  icon?: ReactNode
}
const btnBase = 'inline-flex items-center justify-center gap-2 rounded-input font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 min-h-11 duration-150 md:min-h-0'
const btnVar = {
  primary: 'bg-blue-600 text-white shadow-sm hover:bg-navy-700 active:bg-navy-900',
  secondary: 'border border-gray-400 bg-white text-navy-900 hover:border-navy-700 hover:bg-gray-100',
  tertiary: 'text-blue-600 hover:bg-blue-100',
  destructive: 'bg-danger-600 text-white hover:bg-danger-700',
}
export const btnClass = (variant: keyof typeof btnVar = 'primary', size: 'sm' | 'md' | 'lg' = 'md') =>
  cx(btnBase, btnVar[variant], size === 'sm' ? 'px-3 py-1.5 text-sm' : size === 'lg' ? 'px-6 py-3.5 text-base' : 'px-4 py-2.5 text-sm')
export function Button({ variant = 'primary', size = 'md', loading, icon, children, className, disabled, ...p }: BtnProps) {
  return (
    <button {...p} disabled={disabled || loading} aria-busy={loading || undefined}
      className={cx(btnBase, btnVar[variant], size === 'sm' ? 'px-3 py-1.5 text-sm' : 'px-4 py-2.5 text-sm', className)}>
      {loading ? <Loader2 size={16} className="animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  )
}
export function IconButton({ label, children, className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button {...p} aria-label={label} title={label}
      className={cx('inline-flex h-11 w-11 items-center justify-center rounded-input text-gray-600 transition-colors hover:bg-gray-100 hover:text-navy-900 md:h-9 md:w-9', className)}>
      {children}
    </button>
  )
}

/* Form */
export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: (id: string) => ReactNode }) {
  const id = useId()
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-charcoal-900">{label}</label>
      {children(id)}
      {error ? <p className="flex items-center gap-1 text-xs text-danger-600"><AlertTriangle size={12} aria-hidden />{error}</p>
        : hint ? <p className="text-xs text-gray-600">{hint}</p> : null}
    </div>
  )
}
const inputCls = 'min-h-11 w-full rounded-input border border-gray-400 bg-white px-3 py-2.5 text-sm md:min-h-0 text-charcoal-900 placeholder:text-gray-400 hover:border-navy-700 focus:border-blue-600 disabled:bg-gray-100 aria-[invalid=true]:border-danger-600'
export function Input(p: InputHTMLAttributes<HTMLInputElement>) { return <input {...p} className={cx(inputCls, p.className)} /> }
export function Select({ options, ...p }: { options: string[] } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...p} className={cx(inputCls, p.className)}>{options.map((o) => <option key={o}>{o}</option>)}</select>
}
export function Textarea(p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) { return <textarea {...p} className={cx(inputCls, 'min-h-24', p.className)} /> }
export function PhoneInput({ id, value, onChange }: { id?: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex">
      <span className="inline-flex items-center rounded-l-input border border-r-0 border-gray-400 bg-gray-100 px-3 text-sm text-gray-600">+880</span>
      <input id={id} inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value.replace(/\D/g, '').replace(/^0/, '').slice(0, 10))} placeholder="1XXXXXXXXX"
        className={cx(inputCls, 'rounded-l-none')} />
    </div>
  )
}
export function OtpInput({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: boolean }) {
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const digits = value.padEnd(6, ' ').split('')
  return (
    <div className="flex gap-2" role="group" aria-label="6 digit code">
      {digits.map((d, i) => (
        <input key={i} ref={(el) => { refs.current[i] = el }} inputMode="numeric" maxLength={1} value={d.trim()} aria-label={`Digit ${i + 1}`} aria-invalid={error}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '')
            const arr = digits.map((x) => x.trim()); arr[i] = v
            onChange(arr.join('').slice(0, 6))
            if (v && i < 5) refs.current[i + 1]?.focus()
          }}
          onKeyDown={(e) => { if (e.key === 'Backspace' && !digits[i].trim() && i > 0) refs.current[i - 1]?.focus() }}
          className={cx('h-12 w-11 rounded-input border bg-white text-center font-heading text-lg font-semibold tabular', error ? 'border-danger-600' : 'border-gray-400')} />
      ))}
    </div>
  )
}
export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className={cx('relative h-6 w-11 shrink-0 rounded-full transition-colors before:absolute before:-inset-2.5 before:content-[""]', checked ? 'bg-teal-700' : 'bg-gray-400')}>
      <span className={cx('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', checked ? 'left-[22px]' : 'left-0.5')} />
    </button>
  )
}
export function Stepper({ value, onChange, min = 0, max = 99, label }: { value: number; onChange: (v: number) => void; min?: number; max?: number; label: string }) {
  return (
    <div className="inline-flex items-center rounded-input border border-gray-400 bg-white" role="group" aria-label={label}>
      <button type="button" aria-label="Decrease" disabled={value <= min} onClick={() => onChange(value - 1)} className="h-11 w-11 text-lg disabled:opacity-40 md:h-10 md:w-10">−</button>
      <span className="w-10 text-center text-sm font-semibold tabular">{value}</span>
      <button type="button" aria-label="Increase" disabled={value >= max} onClick={() => onChange(value + 1)} className="h-11 w-11 text-lg disabled:opacity-40 md:h-10 md:w-10">+</button>
    </div>
  )
}

/* Cards */
export function Card({ children, className, pad = true }: { children: ReactNode; className?: string; pad?: boolean }) {
  return <div className={cx('rounded-card border border-gray-200 bg-white shadow-card', pad && 'p-6', className)}>{children}</div>
}
export function StatCard({ label, value, delta, icon }: { label: string; value: string; delta?: string; icon?: ReactNode }) {
  return (
    <Card>
      <div className="flex items-start justify-between">
        <p className="text-sm text-gray-600">{label}</p>
        <span className="text-teal-700">{icon}</span>
      </div>
      <p className="mt-2 font-heading text-3xl font-bold text-navy-900 tabular">{value}</p>
      {delta && <p className="mt-1 text-xs font-medium text-teal-700">{delta}</p>}
    </Card>
  )
}
export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const ini = name.split(' ').map((w) => w[0]).slice(0, 2).join('')
  return (
    <span style={{ width: size, height: size, fontSize: size * 0.38 }} aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-blue-100 font-heading font-bold text-navy-700">{ini}</span>
  )
}

/* Status chips */
const chipTone = {
  amber: 'bg-warning-100 text-warning-600', blue: 'bg-blue-100 text-navy-700', green: 'bg-success-100 text-teal-700',
  red: 'bg-danger-100 text-danger-600', orange: 'bg-warning-100 text-warning-600 ring-1 ring-inset ring-warning-600/30', gray: 'bg-gray-100 text-gray-600',
}
export function Chip({ tone = 'gray', icon, children }: { tone?: keyof typeof chipTone; icon?: ReactNode; children: ReactNode }) {
  return <span className={cx('inline-flex items-center gap-1 rounded-input px-2 py-0.5 text-xs font-semibold', chipTone[tone])}>{icon}{children}</span>
}
const VMAP: Record<VerifyState, { label: string; tone: keyof typeof chipTone; icon: ReactNode }> = {
  not_started: { label: 'Not started', tone: 'gray', icon: <Circle size={12} aria-hidden /> },
  draft: { label: 'Draft', tone: 'gray', icon: <Clock size={12} aria-hidden /> },
  pending: { label: 'Pending', tone: 'amber', icon: <Clock size={12} aria-hidden /> },
  under_review: { label: 'Under review', tone: 'blue', icon: <Eye size={12} aria-hidden /> },
  verified: { label: 'Verified', tone: 'green', icon: <CheckCircle2 size={12} aria-hidden /> },
  rejected: { label: 'Rejected', tone: 'red', icon: <XCircle size={12} aria-hidden /> },
  action_required: { label: 'Action required', tone: 'orange', icon: <AlertTriangle size={12} aria-hidden /> },
}
export function StatusChip({ state }: { state: VerifyState }) {
  const v = VMAP[state]
  return <Chip tone={v.tone} icon={v.icon}>{v.label}</Chip>
}
const BADGES = {
  identity: { label: 'Identity Verified', icon: BadgeCheck }, education: { label: 'Education Verified', icon: GraduationCap },
  experience: { label: 'Experience Verified', icon: Briefcase }, skill: { label: 'Skill Verified', icon: Sparkles },
  student: { label: 'Student Verified', icon: ShieldCheck }, parent: { label: 'Verified Parent/Guardian', icon: Users },
  organization: { label: 'Verified Organization', icon: Building2 },
}
export function VerifyBadge({ kind, active = true }: { kind: keyof typeof BADGES; active?: boolean }) {
  const { label, icon: I } = BADGES[kind]
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold', active ? 'border-emerald-600/25 bg-gradient-to-b from-white to-success-100 text-teal-700 shadow-[inset_0_1px_0_rgb(255,255,255,0.8)]' : 'border-dashed border-gray-400 bg-white text-gray-600')}>
      <I size={14} strokeWidth={2.25} aria-hidden /> {label}{!active && ' (not yet)'}
    </span>
  )
}

/* Tabs */
export function Tabs({ tabs, value, onChange }: { tabs: string[]; value: string; onChange: (t: string) => void }) {
  return (
    <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-gray-200">
      {tabs.map((t) => (
        <button key={t} role="tab" aria-selected={value === t} onClick={() => onChange(t)}
          className={cx('whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors', value === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-navy-900')}>
          {t}
        </button>
      ))}
    </div>
  )
}

/* Modal */
export function Modal({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-900/50 p-4 sm:items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-modal bg-white p-6 shadow-modal">
        <div className="mb-3 flex items-start justify-between gap-4">
          <h2 className="text-xl">{title}</h2>
          <IconButton label="Close" onClick={onClose}><X size={20} /></IconButton>
        </div>
        <div className="text-sm text-gray-600">{children}</div>
        {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  )
}

/* Charts: progress ring, bar */
export function ProgressRing({ value, size = 88, label }: { value: number; size?: number; label?: string }) {
  const r = 36, c = 2 * Math.PI * r
  return (
    <div className="relative inline-flex" style={{ width: size, height: size }} role="img" aria-label={`${label ?? 'Progress'} ${value}%`}>
      <svg viewBox="0 0 88 88" width={size} height={size} className="-rotate-90">
        <circle cx="44" cy="44" r={r} fill="none" stroke="var(--color-gray-200)" strokeWidth="8" />
        <circle cx="44" cy="44" r={r} fill="none" stroke="var(--color-teal-600)" strokeWidth="8" strokeLinecap="round" className="transition-[stroke-dashoffset] duration-200" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-heading text-lg font-bold text-navy-900 tabular">{value}</span>
    </div>
  )
}
export function Bar({ value, label, tone = 'blue' }: { value: number; label: string; tone?: 'blue' | 'teal' }) {
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-xs"><span className="text-gray-600">{label}</span><span className="font-semibold tabular text-navy-900">{value}%</span></div>
      <div className="h-2 overflow-hidden rounded-full bg-gray-100"><div className={cx('h-2 rounded-full', tone === 'blue' ? 'bg-navy-700' : 'bg-teal-600', 'transition-[width] duration-200')} style={{ width: `${value}%` }} /></div>
    </div>
  )
}

/* Table (sortable) */
export function Table<T extends Record<string, ReactNode | string | number>>({ cols, rows }: { cols: { key: keyof T & string; label: string; sortable?: boolean }[]; rows: T[] }) {
  const [sort, setSort] = useState<{ k: string; dir: 1 | -1 } | null>(null)
  const data = sort ? [...rows].sort((a, b) => (String(a[sort.k]) > String(b[sort.k]) ? 1 : -1) * sort.dir) : rows
  return (
    <div className="overflow-x-auto rounded-card border border-gray-200 bg-white shadow-card">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-100 text-xs uppercase tracking-wide text-gray-600">
          <tr>{cols.map((c) => (
            <th key={c.key} className="px-6 py-3 font-semibold" aria-sort={sort?.k === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}>
              {c.sortable ? <button className="inline-flex items-center gap-1" onClick={() => setSort({ k: c.key, dir: sort?.k === c.key && sort.dir === 1 ? -1 : 1 })}>{c.label}<ArrowUpDown size={12} aria-hidden /></button> : c.label}
            </th>))}</tr>
        </thead>
        <tbody>{data.map((r, i) => (
          <tr key={i} className="border-t border-gray-200 hover:bg-gray-100/70">{cols.map((c) => <td key={c.key} className="px-6 py-4 tabular">{r[c.key]}</td>)}</tr>))}</tbody>
      </table>
    </div>
  )
}

/* States */
export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="rounded-card border border-dashed border-gray-400 bg-white p-8 text-center">
      <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-gray-100 text-gray-600"><Info size={20} aria-hidden /></span>
      <h3 className="mt-3 text-lg">{title}</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-gray-600">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
export function Skeleton({ className }: { className?: string }) { return <div className={cx('animate-pulse rounded-input bg-gray-200', className)} aria-hidden /> }
export function ErrorState({ title = 'Something went wrong', onRetry }: { title?: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-card border border-danger-600/30 bg-danger-100 p-8 text-center">
      <AlertTriangle className="mx-auto text-danger-600" aria-hidden />
      <p className="mt-2 font-semibold text-danger-600">{title}</p>
      {onRetry && <Button variant="secondary" size="sm" className="mt-3" onClick={onRetry}>Try again</Button>}
    </div>
  )
}

/* Lock tooltip wrapper: actions locked until verified */
export function VerifiedGate({ children, what = 'This action' }: { children: ReactNode; what?: string }) {
  const { isVerified } = useStore()
  if (isVerified) return <>{children}</>
  return (
    <span className="group relative inline-flex" title={`${what} is locked until you are verified`}>
      <span className="pointer-events-none opacity-50" aria-disabled>{children}</span>
      <Lock size={14} className="absolute -right-1 -top-1 rounded-full bg-white p-0.5 text-warning-600" aria-label="Locked until verified" />
    </span>
  )
}

/* Toasts */
export function ToastHost() {
  const { toasts, dismissToast } = useStore()
  return (
    <div className="fixed bottom-20 right-4 z-[60] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2 md:bottom-4" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="flex items-start gap-2 rounded-card border border-gray-200 bg-white p-3 text-sm shadow-popover">
          <span className={t.tone === 'success' ? 'text-emerald-600' : t.tone === 'danger' ? 'text-danger-600' : t.tone === 'warning' ? 'text-warning-600' : 'text-navy-700'}>
            {t.tone === 'success' ? <CheckCircle2 size={18} aria-hidden /> : t.tone === 'danger' ? <XCircle size={18} aria-hidden /> : t.tone === 'warning' ? <AlertTriangle size={18} aria-hidden /> : <Info size={18} aria-hidden />}
          </span>
          <p className="flex-1">{t.text}</p>
          <button aria-label="Dismiss" onClick={() => dismissToast(t.id)} className="text-gray-400 hover:text-navy-900 md:p-0 p-2"><X size={16} /></button>
        </div>
      ))}
    </div>
  )
}
