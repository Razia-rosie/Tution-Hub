import { Eye, Home, MapPin } from 'lucide-react'
import { AREA_XY, ME } from '../../lib/journey'
import type { Post } from '../../lib/data'
import { DemoTag } from '../ui'

export type RouteOpt = { id: string; label: string; km: string; time: string; note: string; bend: number }
export function routeOptions(p: Post): RouteOpt[] {
  if (p.mode === 'Online') return [{ id: 'online', label: 'Online, no travel', km: '0 km', time: '0 min', note: 'Join from home with a stable connection.', bend: 0 }]
  const km = parseFloat(p.km)
  const [lo, hi] = p.travel.replace(' min', '').split('–').map(Number)
  return [
    { id: 'fast', label: 'Fastest by road', km: `${km.toFixed(1)} km`, time: `${lo + 3}–${hi}`.replace(/^(\d+)–(\d+)$/, '$1–$2 min'), note: 'Main road, usual evening traffic.', bend: 28 },
    { id: 'short', label: 'Shortest distance', km: `${(km - 0.6).toFixed(1)} km`, time: `${lo + 6}–${hi + 5} min`, note: 'Smaller lanes, slower at junctions.', bend: -30 },
    { id: 'bus', label: 'Bus plus short walk', km: `${(km + 0.4).toFixed(1)} km`, time: `${lo + 14}–${hi + 15} min`, note: 'Lower cost, one change.', bend: 55 },
  ]
}

const AREA_LABELS = Object.keys(AREA_XY)
export function RouteMap({ post, base, exact, opt, baseLabel = "Your base" }: { post: Post; base: string; exact?: boolean; opt?: RouteOpt; baseLabel?: string }) {
  const [bx, by] = AREA_XY[base] ?? AREA_XY.Uttara
  let [dx, dy] = AREA_XY[post.area] ?? AREA_XY.Uttara
  const same = base === post.area
  const sx = same ? bx - 28 : bx; const sy = same ? by + 22 : by
  if (same) { dx += 24; dy -= 8 }
  const mx = (sx + dx) / 2; const my = (sy + dy) / 2 + (opt?.bend ?? 28)
  const online = post.mode === 'Online'
  return (
    <div className="relative overflow-hidden rounded-card border border-gray-200 bg-blue-100/60">
      <svg viewBox="0 0 400 220" className="block h-auto w-full" role="img" aria-label={online ? 'Online tuition, no route' : `Schematic route from ${base} to ${post.area}. ${exact ? 'Exact address shown' : 'Approximate area only'}`}>
        <rect width="400" height="220" fill="#EEF3F8" />
        <path d="M0 150 C80 120 140 190 230 150 S360 110 400 130 L400 220 L0 220Z" fill="#DCE8F2" />
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <line key={i} x1={i * 58} y1="0" x2={i * 58 - 40} y2="220" stroke="#fff" strokeWidth="5" opacity=".8" />)}
        {[0, 1, 2, 3].map((i) => <line key={i} x1="0" y1={30 + i * 55} x2="400" y2={55 + i * 48} stroke="#fff" strokeWidth="4" opacity=".8" />)}
        {AREA_LABELS.map((a) => <text key={a} x={AREA_XY[a][0]} y={AREA_XY[a][1] + 26} textAnchor="middle" fontSize="9" fill="#64748b">{a}</text>)}
        {!online && <path d={`M${sx} ${sy} Q${mx} ${my} ${dx} ${dy}`} fill="none" stroke="#1F6FEB" strokeWidth="4" strokeLinecap="round" strokeDasharray="1 8" />}
        {!online && (exact
          ? <circle cx={dx} cy={dy} r="7" fill="#0F9D8A" stroke="#fff" strokeWidth="2.5" />
          : <circle cx={dx} cy={dy} r="28" fill="#1F6FEB" opacity=".15" stroke="#1F6FEB" strokeDasharray="4 3" />)}
        {!online && <circle cx={sx} cy={sy} r="6" fill="#0B1F3A" stroke="#fff" strokeWidth="2.5" />}
      </svg>
      <div className="absolute left-3 top-3"><DemoTag label="Demo map" title="Schematic map. Not live GPS, no real routing." /></div>
      <div className="absolute bottom-2 left-3 flex flex-wrap gap-3 rounded-input bg-white/90 px-2.5 py-1.5 text-[11px] text-gray-600">
        <span className="flex items-center gap-1"><Home size={12} aria-hidden /> {baseLabel}: {base}</span>
        <span className="flex items-center gap-1">{exact ? <MapPin size={12} aria-hidden /> : <Eye size={12} aria-hidden />} {exact ? 'Exact address (logged)' : `${post.area} area, approximate`}</span>
      </div>
    </div>
  )
}
export const BASE_DEFAULT = ME.area
