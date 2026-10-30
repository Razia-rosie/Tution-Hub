import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Chip } from '../ui'

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
