import { AMBIGUITIES, CONFLICTS, DEPENDENCIES, MACHINES, PERMS, REQS, SCORING, UNREALISTIC, VISIBILITY } from '../lib/refdata'
import { ArrowRight } from 'lucide-react'

const th = 'px-4 py-3'
function Wrap({ children, min = 640 }: { children: React.ReactNode; min?: number }) {
  return <div className="overflow-x-auto rounded-card border border-gray-200 bg-white shadow-card"><table className="w-full text-left text-sm" style={{ minWidth: min }}>{children}</table></div>
}
function Head({ cols }: { cols: string[] }) {
  return <thead className="bg-gray-100 text-xs uppercase tracking-wide text-gray-600"><tr>{cols.map((c) => <th key={c} className={th}>{c}</th>)}</tr></thead>
}

export function Requirements() {
  return (
    <div className="mt-6 space-y-10">
      <section><h2 className="text-xl">Requirements only in the comparison PDF</h2>
        <div className="mt-3"><Wrap><Head cols={['#', 'Requirement', 'Where found', 'Resolution']} />
          <tbody className="divide-y divide-gray-100">{REQS.map((r) => <tr key={r[0]}><td className="tabular px-4 py-3 font-bold text-navy-700">{r[0]}</td><td className="px-4 py-3 font-medium text-navy-900">{r[1]}</td><td className="px-4 py-3 text-gray-600">{r[2]}</td><td className="px-4 py-3">{r[3]}</td></tr>)}</tbody></Wrap></div></section>
      <section><h2 className="text-xl">Conflicts and resolutions</h2>
        <div className="mt-3"><Wrap min={720}><Head cols={['#', 'Conflict', 'Resolution']} />
          <tbody className="divide-y divide-gray-100">{CONFLICTS.map((r) => <tr key={r[0]}><td className="tabular px-4 py-3 font-bold text-navy-700">{r[0]}</td><td className="px-4 py-3 text-navy-900">{r[1]}</td><td className="px-4 py-3">{r[2]}</td></tr>)}</tbody></Wrap></div></section>
      <section><h2 className="text-xl">Ambiguities and chosen defaults</h2>
        <div className="mt-3"><Wrap min={720}><Head cols={['#', 'Gap', 'Default chosen']} />
          <tbody className="divide-y divide-gray-100">{AMBIGUITIES.map((r) => <tr key={r[0]}><td className="tabular px-4 py-3 font-bold text-navy-700">{r[0]}</td><td className="px-4 py-3 text-navy-900">{r[1]}</td><td className="px-4 py-3">{r[2]}</td></tr>)}</tbody></Wrap></div></section>
      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-card border border-gray-200 bg-white p-6 shadow-card"><h2 className="text-lg">Key dependencies</h2><p className="mt-2 text-sm text-gray-600">{DEPENDENCIES}</p></div>
        <div className="rounded-card border border-gray-200 bg-white p-6 shadow-card"><h2 className="text-lg">Unrealistic assumptions, handled</h2><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-600">{UNREALISTIC.map((u) => <li key={u}>{u}</li>)}</ul></div>
      </section>
      <p className="text-sm text-gray-600">Items marked [REC] are additions not in the source documents, for the owner to accept or reject.</p>
    </div>
  )
}

const ROLE_COLS = ['Tutor', 'Student', 'Parent', 'Coaching', 'Admin']
function cell(v: string) {
  const c = v === 'Y' ? 'text-emerald-600 font-bold' : v === '—' ? 'text-gray-400' : v.startsWith('Y') ? 'text-emerald-600' : 'text-navy-700'
  return <td className={'px-4 py-3 ' + c}>{v === 'O' ? 'O · own only' : v === 'L' ? 'L · linked only' : v}</td>
}
export function Permissions() {
  return (
    <div className="mt-6 space-y-10">
      <section><h2 className="text-xl">Permission matrix</h2>
        <p className="mt-1 text-sm text-gray-600">Y = yes, O = own records only, L = linked records only, — = no.</p>
        <div className="mt-3"><Wrap min={860}><Head cols={['Action', ...ROLE_COLS]} />
          <tbody className="divide-y divide-gray-100">{PERMS.map((r) => <tr key={r[0]}><td className="px-4 py-3 font-medium text-navy-900">{r[0]}</td>{r.slice(1).map((v, i) => <Cell key={i} v={v} />)}</tr>)}</tbody></Wrap></div></section>
      <section><h2 className="text-xl">Data-visibility matrix</h2>
        <p className="mt-1 text-sm text-gray-600">Sensitive data is never public. Documents are never shown in the prototype; placeholders are labelled DEMO.</p>
        <div className="mt-3"><Wrap min={1040}><Head cols={['Data', 'Public visitor', 'Logged in, before mutual', 'After mutual interest', 'After agreement', 'Linked parent', 'Admin']} />
          <tbody className="divide-y divide-gray-100">{VISIBILITY.map((r) => <tr key={r[0]}><td className="px-4 py-3 font-medium text-navy-900">{r[0]}</td>{r.slice(1).map((v, i) => <td key={i} className={'px-4 py-3 ' + (v === 'Never' ? 'font-semibold text-danger-600' : v === 'Y' ? 'text-emerald-600' : 'text-charcoal-900')}>{v}</td>)}</tr>)}</tbody></Wrap></div></section>
    </div>
  )
}
function Cell({ v }: { v: string }) { return cell(v) }

export function Machines() {
  return (
    <div className="mt-6 space-y-8">
      <p className="text-sm text-gray-600">Canonical state machines. Each state is used with a chip colour and icon across the app.</p>
      <ul className="grid gap-4 lg:grid-cols-2">
        {MACHINES.map((m) => (
          <li key={m.name} className="rounded-card border border-gray-200 bg-white p-6 shadow-card">
            <h2 className="text-lg">{m.name}</h2>
            <ol className="mt-3 flex flex-wrap items-center gap-1.5">
              {m.steps.map((s, i) => <li key={s} className="flex items-center gap-1.5"><span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-navy-700">{s}</span>{i < m.steps.length - 1 && <ArrowRight size={12} className="text-gray-400" aria-hidden />}</li>)}
            </ol>
            {m.branch && <p className="mt-3 rounded-input bg-offwhite-50 px-3 py-2 text-sm"><span className="font-semibold text-navy-900">Branch: </span>{m.branch}</p>}
            {m.note && <p className="mt-2 text-sm text-gray-600">{m.note}</p>}
          </li>
        ))}
      </ul>
      <section><h2 className="text-xl">Scoring (demo weights)</h2>
        <p className="mt-1 text-sm text-gray-600">Rating = average of verified reviews only. Three other concepts below are distinct from it.</p>
        <div className="mt-3 grid gap-4 lg:grid-cols-3">
          {SCORING.map((s) => (
            <div key={s.name} className="rounded-card border border-gray-200 bg-white p-6 shadow-card">
              <h3 className="text-base">{s.name}</h3><p className="mt-1 text-xs text-gray-600">{s.note}</p>
              <ul className="mt-3 space-y-1.5 text-sm">{s.parts.map(([n, w]) => <li key={n} className="flex items-center gap-2"><span className="w-36 shrink-0 text-charcoal-900">{n}</span><span className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100"><span className="block h-full bg-blue-600" style={{ width: `${w * 4}%` }} /></span><span className="tabular w-8 text-right text-gray-600">{w}</span></li>)}</ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
