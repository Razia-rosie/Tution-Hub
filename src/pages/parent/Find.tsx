import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { BadgeCheck, ChevronDown, Lock, MapPin, MessageSquare, Scale, Star, X } from 'lucide-react'
import { PageHead } from '../../components/tutor/bits'
import { RouteMap } from '../../components/tutor/RouteMap'
import { Avatar, Bar, Button, Card, Chip, DemoTag, EmptyState, Field, Input, ProgressRing, Select, VerifyBadge } from '../../components/ui'
import { REVIEWS, TUTORS, type Post, type Tutor } from '../../lib/data'
import { PARENT_NAME, CLS, HOME_AREAS, SUBJ, availOf, awardsOf, DAYS, formDefault, matchTutor, money, rankTutors, trustParts, type Need } from '../../lib/pmatch'
import { Breakdown } from '../tutor/Find'
import { NoChild } from './shared'
import { interestPatch, tutorBy, usePJ, withdrawPatch } from './pj'

const Stars = ({ n }: { n: number }) => <span className="inline-flex" aria-label={`${n} out of 5 stars`}>{[1, 2, 3, 4, 5].map((i) => <Star key={i} size={14} className={i <= Math.round(n) ? 'fill-warning-600 text-warning-600' : 'text-gray-300'} aria-hidden />)}</span>

export function BusyNote() {
  const { kid, busy, verified, base: A, me } = usePJ()
  if (!kid) return null
  if (!verified) return <Card className="mb-5 flex flex-wrap items-center gap-3 bg-warning-100"><Lock size={18} className="text-warning-600" aria-hidden /><p className="min-w-0 flex-1 text-sm text-charcoal-900">{me === 'student' ? "You can browse tutors now. Sending interest and chat unlock once your student verification is approved." : 'You can browse tutors now. Posting, sending interest and chat unlock once your guardian verification is approved.'}</p><Link to={me === 'student' ? `${A}/profile/verification` : `${A}/settings/verification`} className="text-sm font-semibold text-blue-600 hover:underline">Verification</Link></Card>
  if (busy && me === 'student') return <Card className="mb-5 bg-blue-100/50"><p className="text-sm text-gray-600"><b className="text-navy-900">You already have an active tuition</b>{kid.tut ? ` (${kid.tut.subject} with ${kid.tut.tutor})` : ''}. You can still browse and compare tutors. Sending interest is switched off while your tuition is active.</p></Card>
  if (busy) return <Card className="mb-5 bg-blue-100/50"><p className="text-sm text-gray-600"><b className="text-navy-900">{kid.short} already has an active tuition</b>{kid.tut ? ` (${kid.tut.subject} with ${kid.tut.tutor})` : ' (English)'}. You can still browse and compare tutors. Posting and sending interest are switched off for {kid.short} in this demo. Switch child from the header to see the other child&apos;s own search.</p></Card>
  return null
}

export function InterestButton({ t, size = 'sm' }: { t: Tutor; size?: 'sm' | 'md' }) {
  const { s, kj, set, canAct, why, kid, base: A, me } = usePJ()
  const st = kj.sent[t.id]; const inc = kj.incoming[t.id]
  if (st === 'mutual') return <Link to={`${A}/messages/${t.id}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-input bg-teal-600 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-700 md:min-h-0"><MessageSquare size={14} aria-hidden /> Open chat</Link>
  if (st === 'sent') return <Button size={size} variant="secondary" onClick={() => { set((k) => withdrawPatch(k, t.id)); s.toast('Interest withdrawn', 'info') }}>Interest sent. Withdraw</Button>
  if (inc === 'declined') return <Chip tone="gray">You declined</Chip>
  return <Button size={size} disabled={!canAct} title={canAct ? undefined : why} onClick={() => { set((k) => interestPatch(k, t.id)); s.toast(inc === 'received' ? `Mutual interest with ${t.short}. Chat is open.` : me === 'student' ? `Interest sent to ${t.short}. You will see it in Messages.` : `Interest sent to ${t.short}`, 'success') }}>{inc === 'received' ? 'Accept their interest' : me === 'student' ? "I'm Interested" : `Send interest for ${kid?.short ?? 'child'}`}</Button>
}

function TutorCard({ t, m, checked, onCheck, max }: { t: Tutor; m: ReturnType<typeof matchTutor>; checked: boolean; onCheck: () => void; max: boolean }) {
  const [open, setOpen] = useState(false)
  const { kj, base: A, me } = usePJ()
  return (
    <Card pad={false}>
      <div className="flex flex-wrap items-start gap-4 p-5">
        <Avatar name={t.name} size={52} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><Link to={`${A}/find-tutor/${t.id}`} className="font-heading text-lg font-bold text-navy-900 hover:underline">{t.name}</Link>{kj.incoming[t.id] === 'received' && <Chip tone="blue">Sent you interest</Chip>}</div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-600"><span className="inline-flex items-center gap-1"><Stars n={t.rating} /> {t.rating} ({t.reviews})</span><span>Trust {t.trust}</span><span className="inline-flex items-center gap-1"><MapPin size={13} aria-hidden /> {t.area} area</span><span>{t.mode}</span></p>
          <p className="mt-1 text-sm text-gray-600">{t.subjects.join(', ')} · {t.classes} · <b className="tabular text-navy-900">{money(t.fee)}</b> / month</p>
          <div className="mt-2 flex flex-wrap gap-1.5">{t.badges.map((b) => <VerifyBadge key={b} kind={b} />)}</div>
        </div>
        <div className="text-right"><p className="font-heading text-3xl font-bold text-navy-900 tabular">{m.total}%</p><p className="text-xs text-gray-600">match</p></div>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 px-5 py-3">
        <InterestButton t={t} />
        <Link to={`${A}/find-tutor/${t.id}`} className="inline-flex min-h-11 items-center rounded-input border border-gray-400 px-3 py-2 text-sm font-semibold text-navy-900 hover:bg-gray-100 md:min-h-0">View profile</Link>
        <label className={`inline-flex min-h-11 items-center gap-2 text-sm md:min-h-0 ${!checked && max ? 'text-gray-400' : 'text-navy-900'}`}><input type="checkbox" className="h-4 w-4" checked={checked} disabled={!checked && max} onChange={onCheck} /> Compare{!checked && max ? ' (3 max)' : ''}</label>
        <button onClick={() => setOpen(!open)} aria-expanded={open} className="ml-auto inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-blue-600 hover:underline md:min-h-0">Why this match <ChevronDown size={14} className={open ? 'rotate-180' : ''} aria-hidden /></button>
      </div>
      {open && <div className="border-t border-gray-100 bg-gray-100/60 px-5 py-2"><Breakdown m={m} /></div>}
    </Card>
  )
}

function List() {
  const { s, kid, kj, need: base, set, canAct, base: A, me } = usePJ(); const nav = useNavigate()
  const [crit, setCrit] = useState<Need | null>(null); const [budget, setBudget] = useState('')
  if (!kid || !base) return <div><PageHead title="Find a tutor" tag="FIND-P" /><NoChild /></div>
  const n = crit ?? base
  const upd = (p: Partial<Need>) => setCrit({ ...n, ...p })
  const ranked = rankTutors(n); const hidden = TUTORS.length - ranked.length
  const toggle = (id: string) => set((k) => ({ compare: k.compare.includes(id) ? k.compare.filter((x) => x !== id) : k.compare.length < 3 ? [...k.compare, id] : k.compare }))
  return (
    <div>
      <PageHead title="Find a tutor" tag="FIND-P" sub={`${me === 'student' ? `Matches for you (${kid.cls})` : `Matches for ${kid.name} (${kid.cls})`}. Scores use transparent demo weights, not machine learning.`} actions={<DemoTag label="Demo weights" />} />
      <BusyNote />
      <Card className="mb-5">
        <h2 className="text-lg">{me === 'student' ? 'What do you need?' : `What does ${kid.short} need?`}</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Subject">{(i) => <Select id={i} value={n.subject} onChange={(e) => upd({ subject: e.target.value })} options={SUBJ} />}</Field>
          <Field label="Class">{(i) => <Select id={i} value={n.cls} onChange={(e) => upd({ cls: e.target.value })} options={CLS} />}</Field>
          <Field label="Your area">{(i) => <Select id={i} value={n.area} onChange={(e) => upd({ area: e.target.value })} options={HOME_AREAS} />}</Field>
          <Field label="Budget per month (৳)">{(i) => <Input id={i} inputMode="numeric" value={budget || String(n.budget)} onChange={(e) => { setBudget(e.target.value); const v = Number(e.target.value.replace(/\D/g, '')); upd({ budget: v || 0 }) }} />}</Field>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {me === 'parent' && <Button size="sm" variant="secondary" onClick={() => { set(() => ({ draft: formDefault(n, n.area) })); nav(`${A}/my-posts/new`) }} disabled={!canAct && !!kid.tuition}>Post this need instead</Button>}
          {crit && <Button size="sm" variant="tertiary" onClick={() => { setCrit(null); setBudget('') }}>Reset to {kj.post ? 'my post' : 'default'}</Button>}
          <span className="text-xs text-gray-600">{me === 'student' ? 'Starting from your class and area.' : kj.post ? 'Starting from your published post.' : 'Starting from a suggestion for ' + kid.short + '.'} Areas only, never addresses.</span>
        </div>
      </Card>
      {kj.compare.length > 0 && (
        <div className="sticky top-2 z-10 mb-4 flex flex-wrap items-center gap-2 rounded-card border border-blue-600 bg-white p-3 shadow-card" role="region" aria-label="Compare tray">
          <Scale size={16} className="text-blue-600" aria-hidden /><span className="text-sm font-semibold text-navy-900">Compare ({kj.compare.length} of 3)</span>
          {kj.compare.map((id) => <span key={id} className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-navy-900">{tutorBy(id)?.short}<button aria-label={`Remove ${tutorBy(id)?.short} from compare`} onClick={() => toggle(id)} className="rounded-full p-0.5 hover:bg-white"><X size={12} /></button></span>)}
          <Link to={`${A}/find-tutor/compare`} aria-disabled={kj.compare.length < 2} className={`ml-auto rounded-input px-3 py-2 text-sm font-semibold ${kj.compare.length < 2 ? 'pointer-events-none bg-gray-200 text-gray-600' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>{kj.compare.length < 2 ? 'Pick one more' : 'Compare now'}</Link>
        </div>
      )}
      {ranked.length === 0 ? <Card><EmptyState title="No tutor teaches this subject" body="Try another subject or class." /></Card> : (
        <ul className="space-y-4">{ranked.map(({ t, m }) => <li key={t.id}><TutorCard t={t} m={m} checked={kj.compare.includes(t.id)} onCheck={() => toggle(t.id)} max={kj.compare.length >= 3} /></li>)}</ul>
      )}
      {hidden > 0 && <p className="mt-4 text-xs text-gray-600">{hidden} tutors are hidden because they do not teach {n.subject}. A subject mismatch always excludes a tutor.</p>}
      <p className="mt-2 text-xs text-gray-600"><DemoTag /> Tutors are fictional.{me === 'student' ? 'You only see your own search here.' : `You only see ${kid.short}'s own search here.`}</p>
    </div>
  )
}

function Compare() {
  const { kid, kj, need, set, base: A, me } = usePJ()
  if (!kid || !need) return <NoChild />
  const ts = kj.compare.map(tutorBy).filter(Boolean) as Tutor[]
  const ms = ts.map((t) => matchTutor(need, t)); const best = Math.max(...ms.map((m) => m.total))
  const rows: [string, (t: Tutor, i: number) => string][] = [
    ['Match', (_, i) => (ms[i].excluded ? 'Subject mismatch' : `${ms[i].total}%`)], ['Rating', (t) => `${t.rating} (${t.reviews} reviews)`], ['Trust Score', (t) => `${t.trust} / 100`], ['Monthly fee', (t) => money(t.fee)],
    ['Subjects', (t) => t.subjects.join(', ')], ['Classes', (t) => t.classes], ['Area', (t) => `${t.area} (area only)`], ['Mode', (t) => t.mode], ['Experience', (t) => `${t.years} years`],
    ['Verification', (t) => `${t.badges.length} of 4 badges`], ['Available', (t) => { const a = availOf(t); return `${[...a.days].sort((x, y) => DAYS.indexOf(x) - DAYS.indexOf(y)).join(', ')}, ${a.from - 12}–${a.to - 12} PM` }],
  ]
  return (
    <div>
      <PageHead title="Compare tutors" tag="FIND-P" crumb={{ to: `${A}/find-tutor`, label: 'Back to matches' }} sub={`Side by side for ${me === 'student' ? 'you' : kid.short}. Up to three tutors.`} />
      {ts.length < 2 ? <Card><EmptyState title="Pick at least two tutors" body="Tick Compare on two or three tutors in the match list." action={<Link to={`${A}/find-tutor`} className="text-sm font-semibold text-blue-600 hover:underline">Back to matches</Link>} /></Card> : (
        <><div className="space-y-4 md:hidden">{ts.map((t, i) => <Card key={t.id}><div className="flex items-center gap-3"><Avatar name={t.name} size={40} /><Link to={`${A}/find-tutor/${t.id}`} className="min-w-0 flex-1 font-heading font-bold text-navy-900 hover:underline">{t.name}</Link><button onClick={() => set((k) => ({ compare: k.compare.filter((x) => x !== t.id) }))} className="min-h-11 px-2 text-sm font-semibold text-blue-600 hover:underline">Remove</button></div><dl className="mt-3 divide-y divide-gray-100 text-sm">{rows.map(([l, f]) => <div key={l} className="grid grid-cols-[6.5rem_1fr] gap-3 py-2"><dt className="text-gray-600">{l}</dt><dd className={`font-semibold ${l === 'Match' && ms[i].total === best && !ms[i].excluded ? 'text-teal-700' : 'text-navy-900'}`}>{f(t, i)}{l === 'Match' && ms[i].total === best && !ms[i].excluded && <span className="ml-1 text-xs">Best</span>}</dd></div>)}</dl><div className="mt-3"><InterestButton t={t} /></div></Card>)}</div>
        <Card pad={false} className="hidden md:block"><div className="overflow-x-auto"><table className="w-full min-w-[34rem] text-sm">
          <caption className="sr-only">Tutor comparison</caption>
          <thead><tr className="border-b border-gray-200"><th scope="col" className="w-32 p-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Tutor</th>{ts.map((t) => <th scope="col" key={t.id} className="p-3 text-left align-top"><div className="flex items-center gap-2"><Avatar name={t.name} size={32} /><div><Link to={`${A}/find-tutor/${t.id}`} className="font-heading font-bold text-navy-900 hover:underline">{t.name}</Link><button onClick={() => set((k) => ({ compare: k.compare.filter((x) => x !== t.id) }))} className="block text-xs font-semibold text-blue-600 hover:underline">Remove</button></div></div></th>)}</tr></thead>
          <tbody>{rows.map(([l, f]) => <tr key={l} className="border-b border-gray-100"><th scope="row" className="p-3 text-left text-xs font-semibold text-gray-600">{l}</th>{ts.map((t, i) => <td key={t.id} className={`p-3 ${l === 'Match' && ms[i].total === best && !ms[i].excluded ? 'font-bold text-teal-700' : 'text-navy-900'}`}>{f(t, i)}{l === 'Match' && ms[i].total === best && !ms[i].excluded && <span className="ml-1 text-xs">Best</span>}</td>)}</tr>)}
            <tr><th scope="row" className="p-3 text-left text-xs font-semibold text-gray-600">Action</th>{ts.map((t) => <td key={t.id} className="p-3"><InterestButton t={t} /></td>)}</tr></tbody>
        </table></div></Card></>
      )}
    </div>
  )
}

export function TutorProfile({ tid }: { tid: string }) {
  const { kid, kj, need, base: A, me } = usePJ(); const t = tutorBy(tid)
  if (!t) return <Card><EmptyState title="Tutor not found" body="This tutor is not on your list." action={<Link to={`${A}/find-tutor`} className="text-sm font-semibold text-blue-600 hover:underline">Back to matches</Link>} /></Card>
  const n = need ?? { subject: t.subjects[0], cls: 'HSC', area: 'Uttara', budget: t.fee, days: 'Sun, Tue', time: '5:00–6:00 PM', mode: 'Offline' as const }
  const m = matchTutor(n, t); const av = availOf(t); const parts = trustParts(t)
  const asPost = { id: 'need', subject: n.subject, cls: n.cls, medium: '', area: n.area, days: n.days, time: n.time, budget: n.budget, mode: n.mode, posted: '', travel: '', km: '', requirements: '', by: '' } as Post
  const mine = kj.review && kj.tutorId === t.id
  const ALLB = ['identity', 'education', 'experience', 'skill'] as const
  return (
    <div>
      <PageHead title={t.name} tag="TUT-P" crumb={{ to: `${A}/find-tutor`, label: 'Back to matches' }} sub={`The profile as ${me === 'student' ? 'a student' : 'a guardian'} sees it. Documents are checked by TuitionHub reviewers and never shown.`} actions={<InterestButton t={t} size="md" />} />
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Card>
            <div className="flex flex-wrap items-start gap-4"><Avatar name={t.name} size={64} />
              <div className="min-w-0 flex-1"><p className="flex flex-wrap items-center gap-x-3 text-sm text-gray-600"><span className="inline-flex items-center gap-1"><Stars n={t.rating} /> {t.rating} ({t.reviews} reviews)</span><span>{t.years} years teaching</span></p>
                <p className="mt-1 text-sm text-gray-600">{t.subjects.join(', ')} · {t.classes} · {t.mode}</p><p className="mt-1 font-heading text-xl font-bold text-navy-900 tabular">{money(t.fee)} <span className="text-sm font-normal text-gray-600">per month</span></p></div></div>
            <p className="mt-4 text-sm">{t.bio}</p>
            <div className="mt-4 flex flex-wrap gap-1.5">{ALLB.map((b) => <VerifyBadge key={b} kind={b} active={t.badges.includes(b)} />)}</div>
            {t.rank && <p className="mt-3 text-sm text-gray-600">Leaderboard: {t.rank}</p>}
          </Card>
          <Card>
            <h2 className="text-lg">Trust Score</h2><p className="text-sm text-gray-600">Separate from the star rating. Built from seven parts.</p>
            <div className="mt-4 grid gap-5 sm:grid-cols-[auto_1fr]"><div className="flex flex-col items-center"><ProgressRing value={t.trust} label={`Trust ${t.trust} of 100`} /><p className="mt-1 text-sm font-semibold text-navy-900">{t.trust} / 100</p></div>
              <ul className="space-y-2.5">{parts.map(([l, w, sc]) => <li key={l} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 text-sm sm:grid-cols-[7.5rem_1fr_3rem]"><span className="text-gray-600">{l}</span><span className="tabular text-right font-semibold text-navy-900 sm:order-3">{sc}/{w}</span><div role="progressbar" aria-label={`${l}: ${sc} of ${w}`} aria-valuenow={sc} aria-valuemin={0} aria-valuemax={w} className="col-span-2 h-2 rounded-full bg-gray-100 sm:col-span-1 sm:order-2"><div className="h-2 rounded-full bg-teal-600" style={{ width: `${Math.round((sc / w) * 100)}%` }} /></div></li>)}</ul></div>
          </Card>
          <Card>
            <h2 className="text-lg">Reviews</h2><p className="text-sm text-gray-600">From guardians and students of completed tuitions only.</p>
            <ul className="mt-3 space-y-3">{mine && <li className="rounded-input border border-teal-600 p-3"><p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-navy-900">{me === 'student' ? 'Nabila C. (you)' : PARENT_NAME + ' (you)'}<Stars n={kj.review!.stars} /><Chip tone="green" icon={<BadgeCheck size={12} aria-hidden />}>Verified Review</Chip></p><p className="mt-1 text-sm">{kj.review!.text}</p></li>}
              {REVIEWS.map((r, i) => <li key={i} className="rounded-input border border-gray-200 p-3"><p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-navy-900">{r.who}<Stars n={r.stars} /><Chip tone="green" icon={<BadgeCheck size={12} aria-hidden />}>Verified Review</Chip></p><p className="mt-1 text-sm">{r.text}</p><p className="mt-1 text-xs text-gray-600">{r.when}</p></li>)}</ul>
          </Card>
        </div>
        <div className="space-y-6">
          <Card><h2 className="text-lg">{me === 'student' ? 'Match for you' : `Match for ${kid?.short ?? 'your child'}`}</h2>{m.excluded ? <p className="mt-2 text-sm text-gray-600">{m.excluded}</p> : <><p className="font-heading text-3xl font-bold text-navy-900 tabular">{m.total}%</p><div className="mt-2"><Breakdown m={m} /></div></>}<p className="mt-2 text-xs text-gray-600"><DemoTag label="Demo weights" /></p></Card>
          <Card><h2 className="text-lg">Awards</h2><div className="mt-3 flex flex-wrap gap-2">{awardsOf(t).length ? awardsOf(t).map((a) => <Chip key={a} tone="amber" icon={<Star size={12} aria-hidden />}>{a}</Chip>) : <p className="text-sm text-gray-600">No awards yet.</p>}</div></Card>
          <Card><h2 className="text-lg">Weekly availability</h2>
            <ul className="mt-3 grid grid-cols-7 gap-1 text-center text-xs" aria-label="Days available">{DAYS.map((d) => <li key={d} className={`rounded-input py-2 font-semibold ${av.days.includes(d) ? 'bg-success-100 text-teal-700' : 'bg-gray-100 text-gray-400'}`}>{d}</li>)}</ul>
            <p className="mt-2 text-sm text-gray-600">{av.from - 12}:00–{av.to - 12}:00 PM on the green days.</p></Card>
          <Card><h2 className="text-lg">Route</h2><p className="mb-3 text-sm text-gray-600">Approximate areas only. The exact address is never shown to anyone before agreement.</p><RouteMap post={asPost} base={t.area} baseLabel="Tutor base" /></Card>
          <Card className="bg-offwhite-50"><h2 className="flex items-center gap-2 text-lg"><Lock size={16} aria-hidden /> Kept private</h2><ul className="mt-2 space-y-1.5 text-sm text-gray-600"><li>NID and certificates: reviewed by TuitionHub only.</li><li>Exact address: hidden.</li><li>Phone and email: masked until agreement, and even then shown masked.</li></ul></Card>
        </div>
      </div>
    </div>
  )
}

export default function FindTutor({ sub }: { sub: string }) {
  if (sub === 'compare') return <Compare />
  if (sub) return <TutorProfile tid={sub.split('/')[0]} />
  return <List />
}
