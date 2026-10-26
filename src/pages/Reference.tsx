import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { ArrowLeft, ChevronDown, Search } from 'lucide-react'
import { PLANNED, SCREENS } from '../lib/screens'
import { Requirements, Permissions, Machines } from './RefTabs'
import { Chip, EmptyState, Input, Tabs, cx } from '../components/ui'

const TABS = ['Screen inventory', 'Requirements register', 'Permission matrix', 'State machines']
const FIELDS: [string, keyof (typeof SCREENS)[number]][] = [['1 Screen ID', 'id'], ['2 Screen name', 'name'], ['3 User role', 'role'], ['4 Purpose', 'purpose'], ['5 Entry point', 'entry'], ['6 Main components', 'components'], ['7 Primary action', 'primary'], ['8 Secondary actions', 'secondary'], ['9 Success state', 'success'], ['10 Error or empty state', 'error'], ['11 Next destination', 'next'], ['12 Related screens', 'related']]

export default function Reference() {
  const [tab, setTab] = useState(TABS[0]); const [q, setQ] = useState(''); const [open, setOpen] = useState<string | null>(null)
  const list = useMemo(() => SCREENS.filter((s) => (Object.values(s).join(' ')).toLowerCase().includes(q.toLowerCase())), [q])
  return (
    <div className="min-h-screen bg-offwhite-50">
      <main id="main" className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6">
        <Link to="/" className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:underline"><ArrowLeft size={14} aria-hidden /> Back to site</Link>
        <h1 className="mt-4 text-3xl md:text-4xl">Reference</h1>
        <p className="mt-2 max-w-2xl text-gray-600">Requirements and architecture for the TuitionHub prototype. The inventory grows with each build step.</p>
        <div className="mt-6 overflow-x-auto"><Tabs tabs={TABS} value={tab} onChange={setTab} /></div>
        {tab === 'Screen inventory' ? (
          <div className="mt-6">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-full max-w-sm"><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden /><Input aria-label="Filter screens" placeholder="Filter by ID, name, role" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" /></div>
              <p className="text-sm text-gray-600">{list.length} of {SCREENS.length} built screens · all 12 fields per screen</p>
            </div>
            {list.length === 0 ? <div className="mt-6"><EmptyState title="No screens match" body="Clear the filter to see all screens." /></div> : (
              <ul className="mt-4 divide-y divide-gray-200 rounded-card border border-gray-200 bg-white shadow-card">
                {list.map((s) => { const o = open === s.id; return (
                  <li key={s.id}>
                    <button aria-expanded={o} onClick={() => setOpen(o ? null : s.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-100">
                      <span className="tabular w-16 shrink-0 text-xs font-bold text-navy-700">{s.id}</span>
                      <span className="min-w-0 flex-1 truncate font-medium text-navy-900">{s.name}</span>
                      <span className="hidden text-xs text-gray-600 sm:block">{s.role}</span>
                      <Chip tone="blue">{s.tier}</Chip><Chip tone="green">{s.status}</Chip>
                      <span className="tabular hidden text-xs text-gray-600 md:block">#{s.order}</span>
                      <ChevronDown size={16} aria-hidden className={cx('shrink-0 transition-transform', o && 'rotate-180')} />
                    </button>
                    {o && (
                      <div className="border-t border-gray-100 bg-offwhite-50 px-4 py-4">
                        <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                          {FIELDS.map(([l, k]) => <div key={l}><dt className="text-xs font-semibold uppercase tracking-wide text-gray-600">{l}</dt><dd className="text-charcoal-900">{String(s[k])}</dd></div>)}
                        </dl>
                        <p className="mt-4 text-sm"><span className="text-gray-600">Route: </span><Link to={s.route.startsWith('/') && !s.route.includes(' ') && !s.route.startsWith('Modal') ? s.route : '/find-tutor'} className="font-semibold text-blue-600 hover:underline">{s.route}</Link> · Implementation order {s.order}</p>
                      </div>
                    )}
                  </li>) })}
              </ul>
            )}
            <h2 className="mt-12 text-xl">Planned, not built yet</h2>
            <div className="mt-3 overflow-x-auto rounded-card border border-gray-200 bg-white shadow-card">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-gray-100 text-xs uppercase tracking-wide text-gray-600"><tr><th className="px-4 py-3">Group</th><th className="px-4 py-3">Screens</th><th className="px-4 py-3">Tier</th><th className="px-4 py-3">Build step</th></tr></thead>
                <tbody className="divide-y divide-gray-100">{PLANNED.map((p) => <tr key={p.group}><td className="px-4 py-3 font-medium text-navy-900">{p.group}</td><td className="px-4 py-3 text-gray-600">{p.ids}</td><td className="px-4 py-3">{p.tier}</td><td className="px-4 py-3">{p.step}</td></tr>)}</tbody>
              </table>
            </div>
          </div>
        ) : tab === 'Requirements register' ? <Requirements /> : tab === 'Permission matrix' ? <Permissions /> : <Machines />}
      </main>
    </div>
  )
}
