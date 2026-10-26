import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ArrowLeft, Bookmark, Calendar, Clock, MapPin, Share2, Star, Flag, Users, X, WifiOff, Route, Building2, ShieldCheck, BadgeCheck, Briefcase } from 'lucide-react'
import { AREAS, CENTRES, CLASSES, POSTS, REVIEWS, SUBJECTS, TUTORS } from '../../lib/data'
import { Avatar, btnClass, Button, Card, Chip, EmptyState, Input, ProgressRing, Select, Skeleton, VerifyBadge, cx, DemoTag } from '../../components/ui'
import { PageHero, PrivacyNote, Section, Stars, TutorCard, useGate } from '../../components/public/bits'
import { useStore } from '../../lib/store'

const ALL = 'All'
function useLoading(dep: unknown) {
  const [l, setL] = useState(true)
  useEffect(() => { setL(true); const t = setTimeout(() => setL(false), 350); return () => clearTimeout(t) }, [dep])
  return l
}
function FilterChips({ items, clear }: { items: [string, () => void][]; clear: () => void }) {
  if (!items.length) return null
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Applied filters">
      {items.map(([l, rm]) => <button key={l} onClick={rm} className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-navy-700 hover:bg-gray-200">{l}<X size={12} aria-label={`Remove ${l}`} /></button>)}
      <button onClick={clear} className="text-xs font-semibold text-blue-600 hover:underline">Clear all</button>
    </div>
  )
}
const sel = (label: string, v: string, set: (v: string) => void, opts: string[]) => (
  <label className="block text-xs font-medium text-gray-600">{label}
    <Select aria-label={label} options={[ALL, ...opts]} value={v} onChange={(e) => set(e.target.value)} className="mt-1" />
  </label>
)

export function FindTutor() {
  const [subject, setSubject] = useState(ALL); const [area, setArea] = useState(ALL); const [mode, setMode] = useState(ALL)
  const [budget, setBudget] = useState(ALL); const [sort, setSort] = useState('Trust score'); const [shown, setShown] = useState(6)
  const [q, setQ] = useState('')
  const key = [subject, area, mode, budget, sort, q].join()
  const loading = useLoading(key)
  const gate = useGate()
  const rows = useMemo(() => {
    const max = budget === ALL ? Infinity : Number(budget.replace(/\D/g, ''))
    const r = TUTORS.filter((t) => (subject === ALL || t.subjects.includes(subject)) && (area === ALL || t.area === area) && (mode === ALL || t.mode === mode || t.mode === 'Both') && t.fee <= max && (!q || (t.short + t.subjects.join()).toLowerCase().includes(q.toLowerCase())))
    return [...r].sort((a, b) => sort === 'Rating' ? b.rating - a.rating : sort === 'Fee: low to high' ? a.fee - b.fee : b.trust - a.trust)
  }, [subject, area, mode, budget, sort, q])
  const chips: [string, () => void][] = [
    ...(subject !== ALL ? [[subject, () => setSubject(ALL)] as [string, () => void]] : []), ...(area !== ALL ? [[area, () => setArea(ALL)] as [string, () => void]] : []),
    ...(mode !== ALL ? [[mode, () => setMode(ALL)] as [string, () => void]] : []), ...(budget !== ALL ? [[budget, () => setBudget(ALL)] as [string, () => void]] : []),
  ]
  const clear = () => { setSubject(ALL); setArea(ALL); setMode(ALL); setBudget(ALL); setQ('') }
  return (
    <>
      <PageHero eyebrow="Find Tutor" title="Search verified tutors across Dhaka." lead="Browse limited public profiles. Sign in to see match scores, send interest or message.">
        <PrivacyNote />
      </PageHero>
      <Section>
        <Card className="mb-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <label className="block text-xs font-medium text-gray-600 sm:col-span-2 lg:col-span-1">Search name or subject<Input aria-label="Search name or subject" className="mt-1" placeholder="e.g. Physics" value={q} onChange={(e) => setQ(e.target.value)} /></label>
            {sel('Subject', subject, setSubject, SUBJECTS)}{sel('Area', area, setArea, AREAS)}
            {sel('Mode', mode, setMode, ['Offline', 'Online'])}{sel('Max fee / month', budget, setBudget, ['৳4,000', '৳5,000', '৳6,000', '৳8,000'])}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <FilterChips items={chips} clear={clear} />
            <div className="ml-auto flex items-center gap-3 text-sm">
              <button onClick={() => gate('save this search and get alerts')} className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:underline"><Bookmark size={14} aria-hidden /> Save search</button>
              <label className="flex items-center gap-2 text-gray-600">Sort<Select aria-label="Sort" options={['Trust score', 'Rating', 'Fee: low to high']} value={sort} onChange={(e) => setSort(e.target.value)} /></label>
            </div>
          </div>
        </Card>
        <p className="mb-4 text-sm text-gray-600" aria-live="polite">{loading ? 'Searching…' : `${rows.length} verified ${rows.length === 1 ? 'tutor' : 'tutors'}`}</p>
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-60" />)}</div>
        ) : rows.length === 0 ? (
          <EmptyState title="No tutors match these filters" body="Try removing the fee limit, choosing another area, or switching to Online. Subject is the most restrictive filter." action={<Button onClick={clear}>Clear filters</Button>} />
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{rows.slice(0, shown).map((t) => <TutorCard key={t.id} t={t} />)}</div>
            {shown < rows.length && <div className="mt-8 text-center"><Button variant="secondary" onClick={() => setShown(shown + 6)}>Load more ({rows.length - shown} left)</Button></div>}
          </>
        )}
      </Section>
    </>
  )
}

export function TutorProfile() {
  const { id } = useParams(); const t = TUTORS.find((x) => x.id === id); const gate = useGate(); const { toast } = useStore()
  if (!t) return <NotFound what="tutor" />
  return (
    <>
      <section className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-[1200px] px-6 py-10">
          <Link to="/find-tutor" className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:underline"><ArrowLeft size={14} aria-hidden /> All tutors</Link>
          <div className="mt-6 flex flex-col gap-6 md:flex-row md:items-center">
            <Avatar name={t.name} size={88} />
            <div className="min-w-0 flex-1">
              <h1 className="text-3xl md:text-4xl">{t.short}</h1>
              <p className="mt-1 text-gray-600">{t.subjects.join(' · ')} · {t.classes}</p>
              <p className="mt-1 flex items-center gap-1 text-sm text-gray-600"><MapPin size={14} aria-hidden /> {t.area}, Dhaka (approximate area)</p>
              <div className="mt-3 flex flex-wrap gap-1.5">{t.badges.map((b) => <VerifyBadge key={b} kind={b} />)}</div>
            </div>
            <div className="flex flex-wrap gap-2 md:flex-col">
              <Button onClick={() => gate('send interest to this tutor')}>Send interest</Button>
              <Button variant="secondary" onClick={() => gate('message this tutor')}>Message</Button>
            </div>
          </div>
        </div>
      </section>
      <Section>
        <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
          <div className="space-y-6">
            <Card><h2 className="text-xl">About</h2><p className="mt-2 text-gray-600">{t.bio}</p>
              <dl className="mt-5 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                {[['Experience', `${t.years} years`], ['Mode', t.mode], ['Expected fee', `৳${t.fee.toLocaleString('en-US')} / month`], ['Travel radius', '8 km']].map(([k, v]) => <div key={k}><dt className="text-gray-600">{k}</dt><dd className="tabular font-semibold text-navy-900">{v}</dd></div>)}
              </dl></Card>
            <Card><div className="flex items-center justify-between"><h2 className="text-xl">Verified reviews</h2><Chip tone="green" icon={<BadgeCheck size={12} aria-hidden />}>Verified Review</Chip></div>
              <ul className="mt-4 divide-y divide-gray-100">
                {REVIEWS.map((r) => <li key={r.text} className="py-4 first:pt-0 last:pb-0"><div className="flex items-center gap-3"><Stars value={r.stars} /><span className="text-xs text-gray-600">{r.who} · {r.when}</span></div><p className="mt-2 text-sm text-charcoal-900">{r.text}</p></li>)}
              </ul></Card>
            <Card><h2 className="text-xl">Availability</h2>
              <div className="mt-3 flex flex-wrap gap-2">{['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((d, i) => <span key={d} className={cx('rounded-input px-3 py-1.5 text-sm font-medium', i === 6 ? 'bg-gray-100 text-gray-600 line-through' : 'bg-blue-100 text-navy-700')}>{d}</span>)}</div>
              <p className="mt-3 text-sm text-gray-600">Evenings, 4:00 PM to 9:00 PM. Exact slots shown after sign-in.</p></Card>
          </div>
          <aside className="space-y-4">
            <Card><div className="flex items-center gap-4"><ProgressRing value={t.trust} size={80} /><div><p className="font-heading text-lg font-bold text-navy-900">Trust Score</p><p className="text-sm text-gray-600">Verification, reviews, attendance, qualifications and more.</p></div></div></Card>
            <Card><dl className="space-y-3 text-sm">
              <div className="flex justify-between"><dt className="text-gray-600">Rating</dt><dd className="flex items-center gap-1 font-semibold text-navy-900"><Star size={14} className="fill-warning-600 text-warning-600" aria-hidden />{t.rating} ({t.reviews})</dd></div>
              <div className="flex justify-between"><dt className="text-gray-600">Verified tuitions</dt><dd className="tabular font-semibold text-navy-900">{t.verified}</dd></div>
              {t.rank && <div className="flex justify-between gap-4"><dt className="text-gray-600">Rank</dt><dd className="text-right font-semibold text-navy-900">{t.rank}</dd></div>}
              <div className="flex justify-between"><dt className="text-gray-600">Response rate</dt><dd className="tabular font-semibold text-navy-900">96%</dd></div>
            </dl></Card>
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" icon={<Share2 size={14} aria-hidden />} onClick={() => { navigator.clipboard?.writeText(location.href).catch(() => {}); toast('Profile link copied') }}>Share</Button>
              <Button variant="secondary" className="flex-1" icon={<Flag size={14} aria-hidden />} onClick={() => gate('report this tutor')}>Report</Button>
            </div>
            <PrivacyNote>Phone, NID, exact address and documents are hidden. Verified users can request contact after mutual interest.</PrivacyNote>
          </aside>
        </div>
      </Section>
    </>
  )
}

export function FindTuition() {
  const [subject, setSubject] = useState(ALL); const [cls, setCls] = useState(ALL); const [area, setArea] = useState(ALL); const [mode, setMode] = useState(ALL)
  const loading = useLoading([subject, cls, area, mode].join())
  const gate = useGate()
  const rows = POSTS.filter((p) => (subject === ALL || p.subject === subject) && (cls === ALL || p.cls === cls || (cls === 'SSC' && p.cls === 'SSC') ) && (area === ALL || p.area === area) && (mode === ALL || p.mode === mode))
  const clear = () => { setSubject(ALL); setCls(ALL); setArea(ALL); setMode(ALL) }
  return (
    <>
      <PageHero eyebrow="Find Tuition" title="Open tuition posts from verified families." lead="See what students need. Sign in as a verified tutor to show interest."><PrivacyNote>Only the approximate area is shown. Names, phone numbers and exact addresses are hidden.</PrivacyNote></PageHero>
      <Section>
        <Card className="mb-6"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {sel('Subject', subject, setSubject, SUBJECTS)}{sel('Class', cls, setCls, CLASSES)}{sel('Area', area, setArea, AREAS)}{sel('Mode', mode, setMode, ['Offline', 'Online'])}
        </div>
          {mode === 'Online' && <p className="mt-3 text-xs text-gray-600">Distance and travel time are not applicable for online tuition.</p>}
        </Card>
        <p className="mb-4 text-sm text-gray-600" aria-live="polite">{loading ? 'Searching…' : `${rows.length} open ${rows.length === 1 ? 'post' : 'posts'}`}</p>
        {loading ? <div className="grid gap-4 md:grid-cols-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-44" />)}</div>
          : rows.length === 0 ? <EmptyState title="No open posts match" body="Try another subject or area, or clear the filters to see all open posts." action={<Button onClick={clear}>Clear filters</Button>} />
          : <div className="grid gap-4 md:grid-cols-2">{rows.map((p) => (
            <Card key={p.id} className="flex flex-col">
              <div className="flex items-start justify-between gap-3"><div><h3 className="text-lg">{p.subject}, {p.cls}</h3><p className="text-sm text-gray-600">{p.medium}</p></div><Chip tone="blue">{p.mode}</Chip></div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-gray-600">Area</dt><dd className="font-medium text-navy-900">{p.area}</dd></div>
                <div><dt className="text-gray-600">Budget</dt><dd className="tabular font-semibold text-navy-900">৳{p.budget.toLocaleString('en-US')}/mo</dd></div>
                <div><dt className="text-gray-600">Days</dt><dd className="font-medium text-navy-900">{p.days}</dd></div>
                <div><dt className="text-gray-600">Posted</dt><dd className="font-medium text-navy-900">{p.posted}</dd></div>
              </dl>
              <div className="mt-5 flex gap-2 border-t border-gray-100 pt-4"><Link to={`/tuition/${p.id}`} className={cx(btnClass('secondary', 'sm'), 'flex-1')}>View details</Link><button onClick={() => gate("show interest as a tutor")} className={cx(btnClass('primary', 'sm'), 'flex-1')}>I'm interested</button></div>
            </Card>))}</div>}
      </Section>
    </>
  )
}

export function TuitionDetail() {
  const { id } = useParams(); const p = POSTS.find((x) => x.id === id); const gate = useGate(); const { toast } = useStore()
  if (!p) return <NotFound what="tuition post" />
  return (
    <>
      <section className="border-b border-gray-200 bg-white"><div className="mx-auto max-w-[1200px] px-6 py-10">
        <Link to="/find-tuition" className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:underline"><ArrowLeft size={14} aria-hidden /> All tuition posts</Link>
        <div className="mt-5 flex flex-wrap items-center gap-2"><Chip tone="green" icon={<ShieldCheck size={12} aria-hidden />}>{p.by}</Chip><Chip tone="blue">{p.mode}</Chip></div>
        <h1 className="mt-3 text-3xl md:text-4xl">{p.subject} tutor needed, {p.cls}</h1>
        <p className="mt-1 text-gray-600">{p.medium} · {p.area}, Dhaka · Posted {p.posted}</p>
      </div></section>
      <Section>
        <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
          <Card><h2 className="text-xl">Requirement</h2>
            <dl className="mt-4 grid grid-cols-2 gap-5 text-sm sm:grid-cols-3">
              {[['Subject', p.subject, Briefcase], ['Class', p.cls, Users], ['Days', p.days, Calendar], ['Time', p.time, Clock], ['Budget', `৳${p.budget.toLocaleString('en-US')} / month`, Star], ['Approximate area', p.area, MapPin]].map(([k, v, I]) => { const Icon = I as typeof Clock; return <div key={k as string}><dt className="flex items-center gap-1 text-gray-600"><Icon size={14} aria-hidden />{k as string}</dt><dd className="mt-0.5 font-semibold text-navy-900">{v as string}</dd></div> })}
            </dl>
            <h3 className="mt-6 text-base">Additional requirements</h3><p className="mt-1 text-gray-600">{p.requirements}</p>
            <div className="mt-6 rounded-card border border-dashed border-gray-400 bg-gray-100 p-6">
              <div className="flex items-center justify-between"><h3 className="flex items-center gap-2 text-base"><Route size={16} aria-hidden /> Route preview</h3><DemoTag label="Demo" title="Static illustration, not live GPS." /></div>
              <p className="mt-2 text-sm text-gray-600">{p.mode === 'Online' ? 'Online tuition. No travel needed.' : `Approx. ${p.km} · ${p.travel} by road. Sign in as a verified tutor to see the route from your area.`}</p>
            </div>
          </Card>
          <aside className="space-y-4">
            <Card><Button className="w-full" onClick={() => gate("show interest in this tuition")}>I'm interested</Button>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <Button variant="secondary" size="sm" onClick={() => gate('save this tuition')} aria-label="Save"><Bookmark size={14} aria-hidden /></Button>
                <Button variant="secondary" size="sm" aria-label="Share" onClick={() => { navigator.clipboard?.writeText(location.href).catch(() => {}); toast('Link copied') }}><Share2 size={14} aria-hidden /></Button>
                <Button variant="secondary" size="sm" aria-label="Report" onClick={() => gate('report this post')}><Flag size={14} aria-hidden /></Button>
              </div></Card>
            <PrivacyNote>The family's name, phone and exact address are not shown. They are shared only after both sides agree.</PrivacyNote>
          </aside>
        </div>
      </Section>
    </>
  )
}

export function CoachingDirectory() {
  const [subject, setSubject] = useState(ALL); const [area, setArea] = useState(ALL)
  const rows = CENTRES.filter((c) => (subject === ALL || c.subjects.includes(subject)) && (area === ALL || c.area === area))
  return (
    <>
      <PageHero eyebrow="Coaching directory" title="Verified coaching centres and institutes." lead="Organizations are verified separately, so you know the centre behind the classes is real." />
      <Section>
        <Card className="mb-6"><div className="grid gap-4 sm:grid-cols-2">{sel('Subject', subject, setSubject, SUBJECTS)}{sel('Area', area, setArea, AREAS)}</div></Card>
        {rows.length === 0 ? <EmptyState title="No centres match" body="Try another subject or area." action={<Button onClick={() => { setSubject(ALL); setArea(ALL) }}>Clear filters</Button>} /> :
          <div className="grid gap-4 md:grid-cols-2">{rows.map((c) => (
            <Card key={c.id} className="flex flex-col">
              <div className="flex gap-4"><span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-card bg-navy-900 text-white"><Building2 size={24} strokeWidth={1.5} aria-hidden /></span>
                <div><Link to={`/coaching/${c.id}`} className="font-heading text-lg font-bold text-navy-900 hover:text-blue-600">{c.name}</Link><p className="flex items-center gap-1 text-sm text-gray-600"><MapPin size={12} aria-hidden /> {c.area} · {c.classes}</p></div></div>
              <div className="mt-4 flex flex-wrap gap-1.5"><VerifyBadge kind="organization" />{c.subjects.slice(0, 3).map((s) => <Chip key={s}>{s}</Chip>)}</div>
              <div className="mt-4 flex items-center gap-4 text-sm text-gray-600"><span className="flex items-center gap-1 font-semibold text-navy-900"><Star size={14} className="fill-warning-600 text-warning-600" aria-hidden />{c.rating}<span className="font-normal text-gray-600">({c.reviews})</span></span><span>{c.teachers} teachers</span><span>{c.batches} batches</span></div>
              <Link to={`/coaching/${c.id}`} className={cx(btnClass('secondary', 'sm'), 'mt-5 self-start')}>View centre</Link>
            </Card>))}</div>}
      </Section>
    </>
  )
}

export function CoachingProfile() {
  const { id } = useParams(); const c = CENTRES.find((x) => x.id === id); const gate = useGate()
  if (!c) return <NotFound what="coaching centre" />
  return (
    <>
      <section className="border-b border-gray-200 bg-white"><div className="mx-auto max-w-[1200px] px-6 py-10">
        <Link to="/coaching" className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:underline"><ArrowLeft size={14} aria-hidden /> All centres</Link>
        <div className="mt-6 flex flex-col gap-5 md:flex-row md:items-center">
          <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-card bg-navy-900 text-white"><Building2 size={36} strokeWidth={1.5} aria-hidden /></span>
          <div className="flex-1"><h1 className="text-3xl md:text-4xl">{c.name}</h1><p className="mt-1 flex items-center gap-1 text-gray-600"><MapPin size={14} aria-hidden /> {c.area}, Dhaka · Est. {c.est}</p><div className="mt-3 flex flex-wrap gap-1.5"><VerifyBadge kind="organization" /></div></div>
          <Button onClick={() => gate('contact this coaching centre')}>Contact centre</Button>
        </div>
      </div></section>
      <Section>
        <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
          <div className="space-y-6">
            <Card><h2 className="text-xl">About</h2><p className="mt-2 text-gray-600">{c.about}</p>
              <dl className="mt-5 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">{[['Teachers', c.teachers], ['Students', c.students], ['Batches', c.batches], ['Classes', c.classes]].map(([k, v]) => <div key={k as string}><dt className="text-gray-600">{k}</dt><dd className="tabular font-heading text-lg font-bold text-navy-900">{v}</dd></div>)}</dl></Card>
            <Card><h2 className="text-xl">Teachers</h2><ul className="mt-4 divide-y divide-gray-100">{c.teacherList.map(([n, s]) => <li key={n} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"><Avatar name={n.replace(/^M[rs]\. /, '')} /><div><p className="font-medium text-navy-900">{n}</p><p className="text-sm text-gray-600">{s}</p></div></li>)}</ul></Card>
            <Card><h2 className="text-xl">Batches</h2><ul className="mt-4 divide-y divide-gray-100">{c.batchList.map(([n, w, f]) => <li key={n} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0"><div><p className="font-medium text-navy-900">{n}</p><p className="text-sm text-gray-600">{w}</p></div><span className="tabular text-sm font-semibold text-navy-900">{f}</span></li>)}</ul></Card>
          </div>
          <aside className="space-y-4"><Card><div className="flex items-center justify-between"><span className="text-gray-600">Rating</span><span className="flex items-center gap-1 font-semibold text-navy-900"><Star size={14} className="fill-warning-600 text-warning-600" aria-hidden />{c.rating} ({c.reviews})</span></div>
            <div className="mt-4 flex flex-wrap gap-1.5">{c.subjects.map((s) => <Chip key={s}>{s}</Chip>)}</div></Card>
            <PrivacyNote>Contact details are shared after sign-in. Student lists and results are never public.</PrivacyNote></aside>
        </div>
      </Section>
    </>
  )
}

export function NotFound({ what }: { what?: string }) {
  const [offline, setOffline] = useState(false)
  const nav = useNavigate()
  return (
    <section className="mx-auto max-w-[1200px] px-6 py-24 text-center">
      {offline ? <WifiOff size={48} strokeWidth={1.5} className="mx-auto text-gray-600" aria-hidden /> : <p className="font-heading text-7xl font-bold text-blue-100" style={{ WebkitTextStroke: '2px #1f5fbf' }} aria-hidden>404</p>}
      <h1 className="mt-4 text-3xl">{offline ? "You're offline" : what ? `We couldn't find that ${what}` : "This page doesn't exist"}</h1>
      <p className="mx-auto mt-3 max-w-md text-gray-600">{offline ? 'Check your connection. Your drafts are safe and will sync when you are back online.' : 'The link may be old, or the page may have moved. Try one of these instead.'}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {offline ? <Button onClick={() => setOffline(false)}>Try again</Button> : <><Link to="/" className={btnClass('primary')}>Go home</Link><Link to="/find-tutor" className={btnClass('secondary')}>Find a tutor</Link><button onClick={() => nav(-1)} className={btnClass('tertiary')}>Go back</button></>}
      </div>
      <button onClick={() => setOffline(!offline)} className="mt-10 inline-flex items-center gap-2 text-xs text-gray-600 hover:underline"><DemoTag label="Demo" /> {offline ? 'Show 404' : 'Preview offline state'}</button>
    </section>
  )
}
