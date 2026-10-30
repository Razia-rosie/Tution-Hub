import { useEffect, useState, type ReactNode } from 'react'
import { Card, EmptyState, ErrorState, Skeleton } from '../components/ui'
import { platform } from '../lib/platform'

export function PageTitle({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0"><h1 className="text-3xl">{title}</h1>{sub && <p className="mt-1 text-sm text-gray-600">{sub}</p>}</div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

/** Standard loading / error / empty handling around a loaded value. */
export function Loaded<T>({ load, empty, children }: { load: { data: T | null; error: string; loading: boolean; reload: () => void }; empty?: (d: T) => { title: string; body: string; action?: ReactNode } | null; children: (d: T) => ReactNode }) {
  if (load.error && !load.data) return <ErrorState title={load.error} onRetry={() => load.reload()} />
  if (!load.data) return <div className="space-y-3" role="status" aria-label="Loading"><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
  const e = empty?.(load.data)
  if (e) return <EmptyState title={e.title} body={e.body} action={e.action} />
  return <>{children(load.data)}</>
}

export function Section({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg">{title}</h2>{actions}</div>
      {children}
    </Card>
  )
}

/** Shows a user's profile photo if they have one, otherwise initials. */
export function UserPhoto({ id, name, has, size = 48 }: { id: string; name: string; has: boolean; size?: number }) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    if (!has) return
    let u = ''
    platform.photoUrl(id).then((x) => { u = x; setUrl(x) }).catch(() => {})
    return () => { if (u) URL.revokeObjectURL(u) }
  }, [id, has])
  const initials = name.split(' ').map((w) => w[0]).slice(0, 2).join('')
  if (url) return <img src={url} alt="" style={{ width: size, height: size }} className="shrink-0 rounded-full object-cover" />
  return <span aria-hidden style={{ width: size, height: size, fontSize: size * 0.38 }} className="inline-flex shrink-0 items-center justify-center rounded-full bg-blue-100 font-heading font-bold text-navy-700">{initials}</span>
}

export function Stars({ value, count }: { value: number; count?: number }) {
  if (!count) return <span className="text-sm text-gray-600">No reviews yet</span>
  return <span className="text-sm"><span aria-hidden className="text-warning-600">★</span> <strong>{value.toFixed(1)}</strong> <span className="text-gray-600">({count})</span></span>
}

export const statusLabel = (s: string) => s.replaceAll('_', ' ').replace(/^\w/, (c) => c.toUpperCase())

export const SUBJECTS = ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'ICT', 'English', 'Bangla', 'Accounting', 'Economics', 'Higher Math']
export const CLASSES = ['Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10', 'SSC', 'HSC', 'Admission', 'O Level', 'A Level']
export const AREAS = ['Dhanmondi', 'Mirpur', 'Uttara', 'Mohakhali', 'Banani', 'Gulshan', 'Bashundhara', 'Mohammadpur', 'Badda', 'Rampura', 'Motijheel', 'Khilgaon', 'Old Dhaka', 'Chattogram', 'Sylhet', 'Rajshahi', 'Khulna']
export const MEDIUMS = ['Bangla Medium', 'English Version', 'English Medium', 'Madrasa']
export const opts = (values: string[], any?: string) => [...(any !== undefined ? [{ value: '', label: any }] : []), ...values.map((v) => ({ value: v, label: v }))]
