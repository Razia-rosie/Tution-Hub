import { useEffect, useState } from 'react'
import { api } from '../lib/api'

/** Shows the administrator's maintenance message, if one is set in Settings. */
export default function MaintenanceBanner() {
  const [text, setText] = useState('')
  useEffect(() => {
    api.get<{ maintenance_banner?: string }>('/api/v1/public/info').then((r) => setText(r.maintenance_banner ?? '')).catch(() => {})
  }, [])
  if (!text) return null
  return <div role="status" className="bg-warning-100 px-4 py-2 text-center text-sm text-charcoal-900">{text}</div>
}
