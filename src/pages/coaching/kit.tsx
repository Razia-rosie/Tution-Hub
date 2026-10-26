import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Lock, Search } from 'lucide-react'
import { useStore } from '../../lib/store'
import { dateOf, fmtDay, type CJ } from '../../lib/coaching'
import { Button, Card, EmptyState, Input, Modal, Select, btnClass, cx } from '../../components/ui'

export const A = '/app/coaching'

export function useCo() {
  const s = useStore()
  return { s, cj: s.cj, set: s.setCJ, w: s.isVerified, off: s.dayOffset, toast: s.toast }
}

export function useMedia(q: string) {
  const [m, setM] = useState(() => (typeof window === 'undefined' ? true : window.matchMedia(q).matches))
  useEffect(() => {
    const mq = window.matchMedia(q); const f = () => setM(mq.matches)
    f(); mq.addEventListener('change', f); return () => mq.removeEventListener('change', f)
  }, [q])
  return m
}

export function ReadOnlyBar({ what }: { what: string }) {
  const { w } = useCo()
  if (w) return null
  return (
    <Card className="mb-6 flex flex-wrap items-center gap-3 border-warning-600/40 bg-warning-100/60">
      <Lock size={20} className="shrink-0 text-warning-600" aria-hidden />
      <p className="min-w-0 flex-1 text-sm text-gray-600"><b className="text-navy-900">Read-only until verified.</b> {what} unlock when your organization is verified.</p>
      <Link to={`${A}/verification`} className="inline-flex min-h-11 items-center text-sm font-semibold text-blue-600 hover:underline">Continue verification</Link>
    </Card>
  )
}

export function Gate({ children, what }: { children: ReactNode; what: string }) {
  const { w } = useCo()
  if (w) return <>{children}</>
  return <ReadOnlyBar what={what} />
}

export function NotFound({ what, to, label }: { what: string; to: string; label: string }) {
  return <EmptyState title={`${what} not found`} body="It may have been removed, or it belongs to another organization. You only see your own records." action={<Link to={`${A}/${to}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-blue-600 hover:underline">{label}</Link>} />
}

export function ConfirmModal({ open, title, children, confirm, danger = true, disabled, onConfirm, onClose }: { open: boolean; title: string; children: ReactNode; confirm: string; danger?: boolean; disabled?: boolean; onConfirm: () => void; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title={title}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant={danger ? 'destructive' : 'primary'} disabled={disabled} onClick={() => { onConfirm(); onClose() }}>{confirm}</Button></>}>
      {children}
    </Modal>
  )
}

export function CheckRow({ checked, onChange, label, disabled, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean; hint?: string }) {
  return (
    <label className={cx('flex min-h-11 cursor-pointer items-center gap-3 rounded-input border px-3 py-2 text-sm', checked ? 'border-blue-600 bg-blue-100/50' : 'border-gray-300 bg-white', disabled && 'cursor-not-allowed opacity-50')}>
      <input type="checkbox" className="h-5 w-5 shrink-0 accent-blue-600" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="min-w-0 flex-1 text-charcoal-900">{label}</span>{hint && <span className="shrink-0 text-xs text-gray-600">{hint}</span>}
    </label>
  )
}

export function DaySelect({ id, value, onChange, from, to, label }: { id?: string; value: number; onChange: (d: number) => void; from: number; to: number; label?: string }) {
  const days = Array.from({ length: to - from + 1 }, (_, i) => from + i)
  return (
    <select id={id} aria-label={label} value={value} onChange={(e) => onChange(+e.target.value)}
      className="min-h-11 w-full rounded-input border border-gray-400 bg-white px-3 py-2.5 text-sm text-charcoal-900 hover:border-navy-700 focus:border-blue-600 md:min-h-0">
      {days.map((d) => <option key={d} value={d}>{fmtDay(d)}{d === 0 ? ' (today)' : ''}</option>)}
    </select>
  )
}

export const idFor = (cj: CJ, p: string) => `${p}-${cj.seq}`
export const isoLike = (d: number) => dateOf(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

export type Col<T> = { key: string; label: string; cell: (r: T) => ReactNode; sort?: (r: T) => string | number; primary?: boolean; right?: boolean }
type Filter<T> = { label: string; options: string[]; test: (r: T, v: string) => boolean }
type Props<T> = {
  label: string; rows: T[]; cols: Col<T>[]; rowId: (r: T) => string; rowLabel: (r: T) => string
  search?: { placeholder: string; text: (r: T) => string }
  filters?: Filter<T>[]; pageSize?: number
  selectable?: boolean; bulk?: (ids: string[], clear: () => void) => ReactNode
  actions?: (r: T) => ReactNode; empty: ReactNode; initialSort?: { key: string; dir: 1 | -1 }
}

export function DataTable<T>({ label, rows, cols, rowId, rowLabel, search, filters = [], pageSize = 8, selectable, bulk, actions, empty, initialSort }: Props<T>) {
  const desktop = useMedia('(min-width: 768px)')
  const [q, setQ] = useState(''); const [fv, setFv] = useState<string[]>(() => filters.map(() => 'All'))
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(initialSort ?? null)
  const [page, setPage] = useState(1); const [sel, setSel] = useState<string[]>([])
  const reset = () => setPage(1)
  let data = rows.filter((r) => (!search || !q.trim() || search.text(r).toLowerCase().includes(q.trim().toLowerCase())) && filters.every((f, i) => fv[i] === 'All' || f.test(r, fv[i])))
  const sc = sort && cols.find((c) => c.key === sort.key)?.sort
  if (sort && sc) data = [...data].sort((a, b) => { const x = sc(a), y = sc(b); return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * sort.dir })
  const pages = Math.max(1, Math.ceil(data.length / pageSize)); const cur = Math.min(page, pages)
  const view = data.slice((cur - 1) * pageSize, cur * pageSize)
  const ids = view.map(rowId); const allSel = ids.length > 0 && ids.every((i) => sel.includes(i))
  const selHere = sel.filter((i) => rows.some((r) => rowId(r) === i))
  const flip = (key: string) => setSort(sort?.key === key ? { key, dir: sort.dir === 1 ? -1 : 1 } : { key, dir: 1 })
  const clear = () => { setQ(''); setFv(filters.map(() => 'All')); reset() }
  const filtered = q.trim() !== '' || fv.some((v) => v !== 'All')
  if (rows.length === 0) return <>{empty}</>
  const sortable = cols.filter((c) => c.sort)

  return (
    <div className="space-y-3">
      {(search || filters.length > 0) && (
        <div className="flex flex-wrap items-end gap-2">
          {search && (
            <div className="relative min-w-[12rem] flex-1 sm:max-w-xs">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden />
              <Input aria-label={`Search ${label}`} placeholder={search.placeholder} value={q} onChange={(e) => { setQ(e.target.value); reset() }} className="pl-9" />
            </div>)}
          {filters.map((f, i) => (
            <div key={f.label} className="flex min-w-[8rem] flex-1 flex-col gap-1 sm:flex-none"><span aria-hidden className="text-xs font-semibold text-gray-600 md:hidden">{f.label}</span>
              <Select aria-label={f.label} value={fv[i]} onChange={(e) => { setFv(fv.map((v, j) => (j === i ? e.target.value : v))); reset() }} options={['All', ...f.options]} className="w-full max-w-[14rem] sm:w-auto" /></div>))}
        </div>)}
      {!desktop && sortable.length > 0 && (
        <MobileSort cols={sortable} sort={sort} setSort={setSort} label={label} />)}
      {selectable && selHere.length > 0 && bulk && (
        <div className="flex flex-wrap items-center gap-2 rounded-input border border-blue-600/30 bg-blue-100/60 px-3 py-2 text-sm" role="region" aria-label="Bulk actions">
          <b className="text-navy-900">{selHere.length} selected</b>{bulk(selHere, () => setSel([]))}
          <button className="ml-auto inline-flex min-h-11 items-center px-2 text-sm font-semibold text-blue-600 hover:underline md:min-h-0" onClick={() => setSel([])}>Clear selection</button>
        </div>)}
      {data.length === 0 ? (
        <EmptyState title={`No ${label} match`} body="Try a different search or clear the filters." action={filtered ? <Button variant="secondary" size="sm" onClick={clear}>Clear search and filters</Button> : undefined} />
      ) : desktop ? (
        <div className="overflow-x-auto rounded-card border border-gray-200 bg-white shadow-card">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{label}</caption>
            <thead className="bg-gray-100 text-xs uppercase tracking-wide text-gray-600">
              <tr>
                {selectable && <th className="w-12 px-4 py-3"><input type="checkbox" className="h-4 w-4 accent-blue-600" aria-label={`Select all ${label} on this page`} checked={allSel} onChange={(e) => setSel(e.target.checked ? [...new Set([...sel, ...ids])] : sel.filter((i) => !ids.includes(i)))} /></th>}
                {cols.map((c) => (
                  <th key={c.key} scope="col" className={cx('px-4 py-3 font-semibold', c.right && 'text-right')} aria-sort={sort?.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}>
                    {c.sort ? <button className="inline-flex items-center gap-1 uppercase tracking-wide hover:text-navy-900" onClick={() => flip(c.key)}>{c.label}{sort?.key === c.key ? (sort.dir === 1 ? <ArrowUp size={12} aria-hidden /> : <ArrowDown size={12} aria-hidden />) : <ArrowUpDown size={12} aria-hidden />}</button> : c.label}
                  </th>))}
                {actions && <th scope="col" className="px-4 py-3 text-right font-semibold">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {view.map((r) => (
                <tr key={rowId(r)} className={cx('border-t border-gray-200 hover:bg-gray-100/60', sel.includes(rowId(r)) && 'bg-blue-100/40')}>
                  {selectable && <td className="px-4 py-3"><input type="checkbox" className="h-4 w-4 accent-blue-600" aria-label={`Select ${rowLabel(r)}`} checked={sel.includes(rowId(r))} onChange={(e) => setSel(e.target.checked ? [...sel, rowId(r)] : sel.filter((i) => i !== rowId(r)))} /></td>}
                  {cols.map((c) => <td key={c.key} className={cx('px-4 py-3 align-middle', c.right && 'text-right tabular')}>{c.cell(r)}</td>)}
                  {actions && <td className="px-4 py-3 text-right"><div className="flex justify-end gap-1">{actions(r)}</div></td>}
                </tr>))}
            </tbody>
          </table>
        </div>
      ) : (
        <ul className="space-y-3">
          {selectable && <li><label className="flex min-h-11 items-center gap-3 text-sm text-gray-600"><input type="checkbox" className="h-5 w-5 accent-blue-600" checked={allSel} onChange={(e) => setSel(e.target.checked ? [...new Set([...sel, ...ids])] : sel.filter((i) => !ids.includes(i)))} /> Select all on this page</label></li>}
          {view.map((r) => {
            const primary = cols.find((c) => c.primary) ?? cols[0]; const rest = cols.filter((c) => c !== primary)
            return (
              <li key={rowId(r)} className={cx('rounded-card border bg-white p-4 shadow-card', sel.includes(rowId(r)) ? 'border-blue-600' : 'border-gray-200')}>
                <div className="flex items-start gap-3">
                  {selectable && <label className="-m-2 flex h-11 w-11 shrink-0 items-center justify-center"><input type="checkbox" className="h-5 w-5 accent-blue-600" aria-label={`Select ${rowLabel(r)}`} checked={sel.includes(rowId(r))} onChange={(e) => setSel(e.target.checked ? [...sel, rowId(r)] : sel.filter((i) => i !== rowId(r)))} /></label>}
                  <div className="min-w-0 flex-1 font-semibold text-navy-900">{primary.cell(r)}</div>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                  {rest.map((c) => <div key={c.key} className="min-w-0"><dt className="text-xs text-gray-600">{c.label}</dt><dd className="break-words text-charcoal-900">{c.cell(r)}</dd></div>)}
                </dl>
                {actions && <div className="mt-3 flex flex-wrap gap-2 border-t border-gray-100 pt-3">{actions(r)}</div>}
              </li>)
          })}
        </ul>)}
      {data.length > 0 && (
        <nav className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600" aria-label={`${label} pages`}>
          <p aria-live="polite">Showing {(cur - 1) * pageSize + 1} to {Math.min(cur * pageSize, data.length)} of {data.length}{filtered && data.length !== rows.length ? ` (filtered from ${rows.length})` : ''}</p>
          {pages > 1 && (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" disabled={cur <= 1} onClick={() => setPage(cur - 1)} icon={<ChevronLeft size={16} aria-hidden />}>Previous</Button>
              <span className="tabular" aria-current="page">Page {cur} of {pages}</span>
              <Button size="sm" variant="secondary" disabled={cur >= pages} onClick={() => setPage(cur + 1)}>Next<ChevronRight size={16} aria-hidden /></Button>
            </div>)}
        </nav>)}
    </div>
  )
}

function MobileSort<T>({ cols, sort, setSort, label }: { cols: Col<T>[]; sort: { key: string; dir: 1 | -1 } | null; setSort: (s: { key: string; dir: 1 | -1 } | null) => void; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <label htmlFor={`sort-${label}`} className="text-gray-600">Sort by</label>
      <select id={`sort-${label}`} value={sort?.key ?? ''} onChange={(e) => setSort(e.target.value ? { key: e.target.value, dir: sort?.dir ?? 1 } : null)} className="min-h-11 flex-1 rounded-input border border-gray-400 bg-white px-3 text-sm">
        <option value="">Default order</option>{cols.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
      </select>
      <button className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-input border border-gray-400 bg-white" aria-label={sort?.dir === -1 ? 'Sorted descending, switch to ascending' : 'Sorted ascending, switch to descending'} disabled={!sort} onClick={() => sort && setSort({ ...sort, dir: sort.dir === 1 ? -1 : 1 })}>
        {sort?.dir === -1 ? <ArrowDown size={16} aria-hidden /> : <ArrowUp size={16} aria-hidden />}
      </button>
    </div>
  )
}

export function AddBtn({ to, label, icon }: { to: string; label: string; icon?: ReactNode }) {
  const { w } = useCo()
  if (!w) return <Button disabled title={`${label} is locked until your organization is verified`} icon={<Lock size={16} aria-hidden />}>{label}</Button>
  return <Link to={`${A}/${to}`} className={btnClass('primary')}>{icon}{label}</Link>
}

export function useOpenThread() {
  const { cj, set } = useCo(); const nav = useNavigate()
  return (withId: string, withName: string, kind: 'Parent' | 'Teacher') => {
    const ex = cj.threads.find((t) => t.withId === withId)
    if (ex) { nav(`${A}/messages/${ex.id}`); return }
    const id = `M-${cj.seq}`
    set((c) => ({ threads: [...c.threads, { id, withId, withName, kind, msgs: [], unread: 0 }], seq: c.seq + 1 }))
    nav(`${A}/messages/${id}`)
  }
}
