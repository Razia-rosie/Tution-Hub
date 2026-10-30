import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ArrowLeft, MapPin } from 'lucide-react'
import { btnClass, Button, Card, Chip, EmptyState, ErrorState, Input, Select, Skeleton, VerifyBadge } from '../../components/ui'
import { PageHero, PrivacyNote, Section } from '../../components/public/bits'
import { useStore } from '../../lib/store'
import { platform, taka, fmtDate, type TutorCard } from '../../lib/platform'
import { useLoad } from '../../lib/useLoad'
import { AREAS, CLASSES, SUBJECTS, Stars, UserPhoto, opts, statusLabel } from '../../features/common'

// Public discovery pages. They list only accounts an administrator has verified
// and never show contact details; contacting someone requires signing in.

function Filters({ fields, onSearch }: { fields: { key: string; label: string; options: string[] }[]; onSearch: (v: Record<string, string>) => void }) {
  const [v, setV] = useState<Record<string, string>>({})
  return (
    <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end" onSubmit={(e) => { e.preventDefault(); onSearch(v) }}>
      {fields.map((f) => <label key={f.key} className="block text-xs font-medium text-gray-600">{f.label}<Select aria-label={f.label} className="mt-1" value={v[f.key] ?? ''} options={opts(f.options, 'All')} onChange={(e) => { const next = { ...v, [f.key]: e.target.value }; setV(next); onSearch(next) }} /></label>)}
      <label className="block text-xs font-medium text-gray-600">Search<Input aria-label="Search" className="mt-1" value={v.q ?? ''} onChange={(e) => setV({ ...v, q: e.target.value })} /></label>
      <Button type="submit">Search</Button>
    </form>
  )
}

function Results<T>({ load, render, empty }: { load: { data: T | null; error: string; loading: boolean; reload: () => void }; render: (d: T) => React.ReactNode; empty: (d: T) => boolean }) {
  if (load.error && !load.data) return <ErrorState title={load.error} onRetry={load.reload} />
  if (!load.data) return <div className="grid gap-4 md:grid-cols-2" role="status" aria-label="Loading">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-40" />)}</div>
  if (empty(load.data)) return <EmptyState title="Nothing matches yet" body="Try fewer filters. Only accounts verified by TuitionHub administrators are listed." />
  return <>{render(load.data)}</>
}

function TutorTile({ t }: { t: TutorCard }) {
  return (
    <Card>
      <div className="flex items-start gap-3">
        <UserPhoto id={t.id} name={t.name} has={t.has_photo} size={56} />
        <div className="min-w-0 flex-1">
          <Link to={`/tutors/${t.id}`} className="font-heading text-lg font-bold text-navy-900 hover:underline">{t.name}</Link>
          <p className="text-sm text-gray-600">{t.subjects.join(', ')}{t.classes.length ? ` · ${t.classes.join(', ')}` : ''}</p>
          <p className="flex items-center gap-1 text-sm text-gray-600"><MapPin size={14} aria-hidden />{t.areas.join(', ') || 'Area not set'}</p>
          <div className="mt-1 flex flex-wrap items-center gap-3"><Stars value={t.rating} count={t.review_count} /><span className="text-sm font-semibold">{taka(t.fee_expectation)}/month</span></div>
          <div className="mt-2 flex flex-wrap gap-1"><VerifyBadge kind="identity" />{t.education_verified && <VerifyBadge kind="education" />}</div>
        </div>
      </div>
    </Card>
  )
}

export function FindTutor() {
  const [f, setF] = useState<Record<string, string>>({})
  const load = useLoad(() => platform.tutors({ subject: f.subject, class: f.class, area: f.area, mode: f.mode, q: f.q }), [f.subject, f.class, f.area, f.mode, f.q])
  return (
    <>
      <PageHero eyebrow="Find a tutor" title="Verified tutors near you" lead="Every tutor listed here passed a manual identity check by the TuitionHub team." />
      <Section>
        <Card><Filters fields={[{ key: 'subject', label: 'Subject', options: SUBJECTS }, { key: 'class', label: 'Class', options: CLASSES }, { key: 'area', label: 'Area', options: AREAS }, { key: 'mode', label: 'Mode', options: ['offline', 'online'] }]} onSearch={setF} /></Card>
        <div className="mt-6"><Results load={load} empty={(d) => d.tutors.length === 0} render={(d) => <><p className="mb-3 text-sm text-gray-600">{d.total} verified tutor{d.total === 1 ? '' : 's'}</p><div className="grid gap-4 md:grid-cols-2">{d.tutors.map((t) => <TutorTile key={t.id} t={t} />)}</div></>} /></div>
        <PrivacyNote />
      </Section>
    </>
  )
}

export function TutorProfile() {
  const { id = '' } = useParams()
  const { user } = useStore()
  const load = useLoad(() => platform.tutor(id), [id])
  if (load.error && !load.data) return <NotFound what="tutor" />
  return (
    <Section>
      <Link to="/find-tutor" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"><ArrowLeft size={14} aria-hidden />All tutors</Link>
      {!load.data ? <Skeleton className="mt-4 h-64" /> : (() => {
        const { tutor: t, reviews, awards } = load.data
        return (
          <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-4">
              <Card><div className="flex items-start gap-4"><UserPhoto id={t.id} name={t.name} has={t.has_photo} size={80} /><div><h1 className="text-3xl">{t.name}</h1><Stars value={t.rating} count={t.review_count} /><div className="mt-2 flex flex-wrap gap-1"><VerifyBadge kind="identity" />{t.education_verified && <VerifyBadge kind="education" />}</div></div></div>{t.bio && <p className="mt-4">{t.bio}</p>}</Card>
              <Card><dl className="grid gap-3 text-sm sm:grid-cols-2">{[['Subjects', t.subjects.join(', ')], ['Classes', t.classes.join(', ')], ['Areas', t.areas.join(', ')], ['Teaching mode', t.teaching_modes.join(', ')], ['Medium', t.mediums.join(', ')], ['Education', t.education], ['Institution', t.institution], ['Experience', t.experience_years ? `${t.experience_years} years` : ''], ['Tuitions on TuitionHub', String(t.tuitions_done)], ['Member since', fmtDate(t.member_since)]].filter(([, v]) => v).map(([k, v]) => <div key={k}><dt className="text-gray-600">{k}</dt><dd className="font-medium">{v}</dd></div>)}</dl></Card>
              {awards.length > 0 && <Card><h2 className="text-lg">Awards</h2><ul className="mt-2 list-disc pl-5 text-sm">{awards.map((a) => <li key={a.id}>{a.title}</li>)}</ul></Card>}
              <Card><h2 className="text-lg">Reviews</h2>{reviews.length === 0 ? <p className="mt-2 text-sm text-gray-600">No reviews yet. Reviews come only from families who had a confirmed tuition.</p> : <ul className="mt-2 space-y-3">{reviews.map((r) => <li key={r.id} className="text-sm"><p><span className="text-warning-600">{'★'.repeat(r.stars)}</span> · {r.by_role === 'parent' ? 'Guardian' : 'Student'} · {r.subject} · {fmtDate(r.created_at)}</p>{r.body && <p className="mt-1">{r.body}</p>}{r.reply && <p className="mt-1 text-gray-600">Tutor's reply: {r.reply}</p>}</li>)}</ul>}</Card>
            </div>
            <Card className="h-fit"><p className="font-heading text-2xl font-bold text-navy-900">{taka(t.fee_expectation)}<span className="text-sm font-normal text-gray-600"> / month</span></p>
              <p className="mt-2 text-sm text-gray-600">Contact details stay private until a tuition is confirmed.</p>
              {user ? <Link to={`/app/${user.role}/${user.role === 'parent' || user.role === 'student' ? 'find-tutor' : 'dashboard'}`} className={`${btnClass('primary')} mt-4 w-full`}>Contact from your dashboard</Link>
                : <Link to="/signup/role" className={`${btnClass('primary')} mt-4 w-full`}>Sign up to contact</Link>}
            </Card>
          </div>
        )
      })()}
    </Section>
  )
}

export function FindTuition() {
  const [f, setF] = useState<Record<string, string>>({})
  const load = useLoad(() => platform.publicPosts({ subject: f.subject, class: f.class, area: f.area, mode: f.mode, q: f.q }), [f.subject, f.class, f.area, f.mode, f.q])
  return (
    <>
      <PageHero eyebrow="Find tuition" title="Open tuition posts" lead="Posted by guardians and students. Verified tutors apply from their dashboard." />
      <Section>
        <Card><Filters fields={[{ key: 'subject', label: 'Subject', options: SUBJECTS }, { key: 'class', label: 'Class', options: CLASSES }, { key: 'area', label: 'Area', options: AREAS }, { key: 'mode', label: 'Mode', options: ['offline', 'online'] }]} onSearch={setF} /></Card>
        <div className="mt-6"><Results load={load} empty={(d) => d.posts.length === 0} render={(d) => <div className="space-y-3">{d.posts.map((p) => (
          <Card key={p.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><Link to={`/tuition/${p.id}`} className="font-heading text-lg font-bold text-navy-900 hover:underline">{p.subject} · {p.class_name}</Link><p className="text-sm text-gray-600">{p.area} · {statusLabel(p.mode)}{p.days ? ` · ${p.days}` : ''}{p.time_slot ? ` · ${p.time_slot}` : ''}</p><p className="text-xs text-gray-600">Posted {fmtDate(p.created_at)}</p></div><p className="font-heading text-xl font-bold text-navy-900">{taka(p.budget)}</p></div></Card>))}</div>} /></div>
      </Section>
    </>
  )
}

export function TuitionDetail() {
  const { id = '' } = useParams()
  const { user } = useStore()
  const load = useLoad(() => platform.publicPost(id), [id])
  if (load.error && !load.data) return <NotFound what="tuition post" />
  const p = load.data?.post
  return (
    <Section>
      <Link to="/find-tuition" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"><ArrowLeft size={14} aria-hidden />All tuition posts</Link>
      {!p ? <Skeleton className="mt-4 h-48" /> : (
        <Card className="mt-4"><h1 className="text-3xl">{p.subject} · {p.class_name}</h1>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">{[['Area', p.area], ['Mode', statusLabel(p.mode)], ['Medium', p.medium], ['Days', p.days], ['Time', p.time_slot], ['Budget', `${taka(p.budget)} / month`], ['Posted', fmtDate(p.created_at)], ['Applicants', String(p.applicants)]].filter(([, v]) => v).map(([k, v]) => <div key={k}><dt className="text-gray-600">{k}</dt><dd className="font-medium">{v}</dd></div>)}</dl>
          {p.requirements && <p className="mt-4">{p.requirements}</p>}
          {user?.role === 'tutor' ? <Link to="/app/tutor/find-tuition" className={`${btnClass('primary')} mt-4`}>Apply from your dashboard</Link> : !user ? <Link to="/signup/tutor" className={`${btnClass('primary')} mt-4`}>Sign up as a tutor to apply</Link> : null}
          {p.status !== 'open' && <Chip>{statusLabel(p.status)}</Chip>}
        </Card>
      )}
    </Section>
  )
}

export function CoachingDirectory() {
  const [f, setF] = useState<Record<string, string>>({})
  const load = useLoad(() => platform.centres({ subject: f.subject, area: f.area, q: f.q }), [f.subject, f.area, f.q])
  return (
    <>
      <PageHero eyebrow="Coaching centres" title="Verified coaching centres" lead="Centres whose trade licence and owner identity were checked by the TuitionHub team." />
      <Section>
        <Card><Filters fields={[{ key: 'subject', label: 'Subject', options: SUBJECTS }, { key: 'area', label: 'Area', options: AREAS }]} onSearch={setF} /></Card>
        <div className="mt-6"><Results load={load} empty={(d) => d.centres.length === 0} render={(d) => <div className="grid gap-4 md:grid-cols-2">{d.centres.map((c) => (
          <Card key={c.id}><div className="flex items-start gap-3"><UserPhoto id={c.id} name={c.name} has={c.has_photo} size={56} /><div><Link to={`/coaching/${c.id}`} className="font-heading text-lg font-bold text-navy-900 hover:underline">{c.institution || c.name}</Link><p className="text-sm text-gray-600">{c.areas.join(', ')} · {c.subjects.join(', ')}</p><p className="text-sm">{c.teachers} teachers · {c.batches} batches</p><Stars value={c.rating} count={c.review_count} /></div></div></Card>))}</div>} /></div>
      </Section>
    </>
  )
}

export function CoachingProfile() {
  const { id = '' } = useParams()
  const load = useLoad(() => platform.centre(id), [id])
  if (load.error && !load.data) return <NotFound what="coaching centre" />
  const c = load.data?.centre
  return (
    <Section>
      <Link to="/coaching" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"><ArrowLeft size={14} aria-hidden />All coaching centres</Link>
      {!c ? <Skeleton className="mt-4 h-48" /> : (
        <div className="mt-4 space-y-4">
          <Card><div className="flex items-start gap-4"><UserPhoto id={c.id} name={c.name} has={c.has_photo} size={72} /><div><h1 className="text-3xl">{c.institution || c.name}</h1><Stars value={c.rating} count={c.review_count} /><p className="text-sm text-gray-600">{c.areas.join(', ')}{c.opening_hours ? ` · ${c.opening_hours}` : ''}{c.established ? ` · Est. ${c.established}` : ''}</p></div></div>{c.about && <p className="mt-4">{c.about}</p>}</Card>
          {c.batch_list && c.batch_list.length > 0 && <Card><h2 className="text-lg">Batches</h2><ul className="mt-2 divide-y divide-gray-100 text-sm">{c.batch_list.map((b) => <li key={b.name} className="flex flex-wrap justify-between gap-2 py-2"><span>{b.name} · {b.subject}{b.class_name ? ` · ${b.class_name}` : ''}</span><span>{[b.days, b.time_slot].filter(Boolean).join(' · ')} · {taka(b.monthly_fee)}/month</span></li>)}</ul></Card>}
          {c.teacher_list && c.teacher_list.length > 0 && <Card><h2 className="text-lg">Teachers</h2><p className="mt-2 text-sm">{c.teacher_list.map((t) => `${t.name}${t.subject ? ` (${t.subject})` : ''}`).join(', ')}</p></Card>}
          <Link to="/signup/role" className={btnClass('primary')}>Sign up to ask about admission</Link>
        </div>
      )}
    </Section>
  )
}

export function NotFound({ what }: { what?: string }) {
  const nav = useNavigate()
  return (
    <section className="mx-auto max-w-[1200px] px-6 py-24 text-center">
      <p className="font-heading text-7xl font-bold text-blue-100" style={{ WebkitTextStroke: '2px #1f5fbf' }} aria-hidden>404</p>
      <h1 className="mt-4 text-3xl">{what ? `We couldn't find that ${what}` : "This page doesn't exist"}</h1>
      <p className="mx-auto mt-3 max-w-md text-gray-600">The link may be old, or the page may have moved.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3"><Link to="/" className={btnClass('primary')}>Go home</Link><Link to="/find-tutor" className={btnClass('secondary')}>Find a tutor</Link><button onClick={() => nav(-1)} className={btnClass('tertiary')}>Go back</button></div>
    </section>
  )
}
