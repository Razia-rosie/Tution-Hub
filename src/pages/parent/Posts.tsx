import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { CheckCircle2, Eye, Lock, PauseCircle, Pencil, PlayCircle, Plus, Search, Trash2, Users } from 'lucide-react'
import { PageHead } from '../../components/tutor/bits'
import { Button, Card, Chip, DemoTag, EmptyState, Field, Input, Modal, Select, Textarea } from '../../components/ui'
import type { KPost, PostForm } from '../../lib/parent'
import { CLS, DAYS, HOME_AREAS, MEDIUMS, SUBJ, TIMES, formDefault, money, needOf, postToForm, rankTutors, toPost, validatePost } from '../../lib/pmatch'
import { NoChild } from './shared'
import InterestPanel from './Interest'
import { tutorSendsInterest, usePJ } from './pj'

const A = '/app/parent'
const statusChip = (p: KPost) => p.status === 'published' ? <Chip tone="green" icon={<CheckCircle2 size={12} aria-hidden />}>Published</Chip> : p.status === 'paused' ? <Chip tone="amber" icon={<PauseCircle size={12} aria-hidden />}>Paused</Chip> : <Chip tone="blue" icon={<CheckCircle2 size={12} aria-hidden />}>Filled</Chip>

function PostCard({ p, who, hideBy }: { p: KPost; who: string; hideBy?: boolean }) {
  return (
    <Card>
      <div className="flex flex-wrap items-start gap-3"><div className="min-w-0 flex-1"><h2 className="text-xl">{p.subject}, {p.cls}</h2><p className="text-sm text-gray-600">{p.medium} · {p.mode} · {p.area} area</p></div>{statusChip(p)}</div>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">{([['Days', p.days], ['Time', p.time], ['Budget', `${money(p.budget)} / month`]] as const).map(([l, v]) => <div key={l}><dt className="text-xs font-semibold uppercase tracking-wide text-gray-600">{l}</dt><dd className="font-semibold text-navy-900">{v}</dd></div>)}</dl>
      {p.requirements && <p className="mt-3 rounded-input bg-offwhite-50 p-3 text-sm text-gray-600">{p.requirements}</p>}
      {!hideBy && <p className="mt-3 text-xs text-gray-600">Shown to tutors as: <b>Verified Parent</b> posting for {who}. Only the area is visible, never the address.</p>}
    </Card>
  )
}

function ListPage() {
  const { kid, kj, verified, busy, why } = usePJ()
  if (!kid) return <div><PageHead title="My posts" tag="POST-P" /><NoChild /></div>
  const interested = Object.values(kj.incoming).filter((v) => v === 'received').length
  const matches = kj.post ? rankTutors(needOf(kj.post)).length : 0
  const newBtn = <Link to={`${A}/my-posts/new`} aria-disabled={!verified || busy || !!kj.post} className={`inline-flex min-h-11 items-center gap-2 rounded-input px-4 py-2 text-sm font-semibold md:min-h-0 ${!verified || busy || kj.post ? 'pointer-events-none bg-gray-200 text-gray-600' : 'bg-blue-600 text-white hover:bg-blue-700'}`}><Plus size={16} aria-hidden /> New post</Link>
  return (
    <div>
      <PageHead title="My posts" tag="POST-P" sub={`Tuition posts for ${kid.name}. Each child has their own posts.`} actions={newBtn} />
      {!verified && <Card className="mb-5 flex flex-wrap items-center gap-3 bg-warning-100"><Lock size={18} className="text-warning-600" aria-hidden /><p className="min-w-0 flex-1 text-sm text-charcoal-900">Posting is locked until your guardian verification is approved.</p><Link to={`${A}/settings/verification`} className="text-sm font-semibold text-blue-600 hover:underline">Verification</Link></Card>}
      {verified && busy && !kj.post && <Card className="mb-5 bg-blue-100/50"><p className="text-sm text-gray-600">{kid.short} already has an active tuition, so there is nothing to post for. {why}</p></Card>}
      {kj.post ? (
        <div className="space-y-4">
          <PostCard p={kj.post} who={kid.name} />
          <div className="grid gap-4 sm:grid-cols-3">
            <Card><p className="text-sm text-gray-600">Matching tutors</p><p className="font-heading text-3xl font-bold text-navy-900 tabular">{matches}</p></Card>
            <Card><p className="text-sm text-gray-600">Interest waiting</p><p className="font-heading text-3xl font-bold text-navy-900 tabular">{interested}</p></Card>
            <Card><p className="text-sm text-gray-600">Interest you sent</p><p className="font-heading text-3xl font-bold text-navy-900 tabular">{Object.keys(kj.sent).length}</p></Card>
          </div>
          <Link to={`${A}/my-posts/manage`} className="inline-flex min-h-11 items-center rounded-input bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 md:min-h-0">Manage this post</Link>
        </div>
      ) : kj.draft ? (
        <Card><div className="flex flex-wrap items-center gap-3"><div className="min-w-0 flex-1"><p className="font-semibold text-navy-900">Draft: {kj.draft.subject}, {kj.draft.cls}</p><p className="text-sm text-gray-600">Saved for {kid.short}. Not visible to tutors yet.</p></div><Chip tone="gray">Draft</Chip><Link to={`${A}/my-posts/new`} className="text-sm font-semibold text-blue-600 hover:underline">Continue</Link></div></Card>
      ) : (
        <Card><EmptyState title={`No post for ${kid.short} yet`} body="Describe the class, days and budget. Tutors who match can send interest, and you choose who to talk to." action={verified && !busy ? <Link to={`${A}/my-posts/new`} className="rounded-input bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">Post a tuition</Link> : <Link to={`${A}/find-tutor`} className="text-sm font-semibold text-blue-600 hover:underline">Browse tutors instead</Link>} /></Card>
      )}
    </div>
  )
}

function Preview({ f, kid }: { f: PostForm; kid: string }) {
  return <PostCard p={{ ...toPost(f), status: 'published' }} who={kid} />
}

function NewPage({ editing }: { editing: boolean }) {
  const { s, kid, kj, set, verified, busy, need } = usePJ(); const nav = useNavigate()
  const [f, setF] = useState<PostForm | null>(null); const [step, setStep] = useState<'form' | 'preview'>('form'); const [errs, setErrs] = useState<ReturnType<typeof validatePost>>({}); const [budgetText, setBudgetText] = useState<string | null>(null)
  if (!kid || !need) return <NoChild />
  if (!verified) return <div><PageHead title="Post a tuition" tag="POST-P" /><Card><EmptyState title="Posting is locked" body="Your guardian verification must be approved first. This keeps every post tied to a known parent." action={<Link to={`${A}/settings/verification`} className="text-sm font-semibold text-blue-600 hover:underline">Open verification</Link>} /></Card></div>
  if (busy) return <div><PageHead title="Post a tuition" tag="POST-P" /><Card><EmptyState title={`${kid.short} already has a tuition`} body="Posting is switched off while a tuition is active." action={<Link to={`${A}/my-posts`} className="text-sm font-semibold text-blue-600 hover:underline">Back to posts</Link>} /></Card></div>
  const form = f ?? (editing && kj.post ? postToForm(kj.post) : kj.draft ?? formDefault(need, 'Uttara'))
  const up = (p: Partial<PostForm>) => { setF({ ...form, ...p }); setErrs({}) }
  const toggleDay = (d: string) => up({ days: form.days.includes(d) ? form.days.filter((x) => x !== d) : [...form.days, d] })
  const next = () => { const e = validatePost(form); setErrs(e); if (Object.keys(e).length) { s.toast('Please fix the highlighted fields', 'warning'); return } setStep('preview') }
  const publish = () => {
    const post = toPost(form, editing && kj.post ? kj.post.status : 'published')
    set(() => ({ post, draft: null }))
    if (!editing) tutorSendsInterest(s, kid.id, 1)
    s.toast(editing ? 'Post updated' : 'Post published', 'success'); nav(`${A}/my-posts/${editing ? 'manage' : 'published'}`)
  }
  return (
    <div>
      <PageHead title={editing ? 'Edit post' : 'Post a tuition'} tag="POST-P" crumb={{ to: `${A}/my-posts`, label: 'My posts' }} sub={`For ${kid.name}. Step ${step === 'form' ? '1' : '2'} of 2: ${step === 'form' ? 'details' : 'preview'}.`} />
      {step === 'form' ? (
        <Card>
          <form noValidate onSubmit={(e) => { e.preventDefault(); next() }} className="grid gap-4 sm:grid-cols-2">
            <Field label="Subject" error={errs.subject}>{(i) => <Select id={i} value={form.subject} onChange={(e) => up({ subject: e.target.value })} options={SUBJ} />}</Field>
            <Field label="Class" error={errs.cls}>{(i) => <Select id={i} value={form.cls} onChange={(e) => up({ cls: e.target.value })} options={CLS} />}</Field>
            <Field label="Medium">{(i) => <Select id={i} value={form.medium} onChange={(e) => up({ medium: e.target.value })} options={MEDIUMS} />}</Field>
            <Field label="Mode">{(i) => <Select id={i} value={form.mode} onChange={(e) => up({ mode: e.target.value as 'Offline' | 'Online' })} options={['Offline', 'Online']} />}</Field>
            <Field label="Your area" hint="Only the area is shown to tutors." error={errs.area}>{(i) => <Select id={i} value={form.area} onChange={(e) => up({ area: e.target.value })} options={HOME_AREAS} />}</Field>
            <Field label="Time" >{(i) => <Select id={i} value={form.time} onChange={(e) => up({ time: e.target.value })} options={TIMES} />}</Field>
            <fieldset className="sm:col-span-2"><legend className="mb-1 text-sm font-semibold text-navy-900">Class days</legend>
              <div className="flex flex-wrap gap-2">{DAYS.map((d) => <label key={d} className={`inline-flex min-h-11 cursor-pointer items-center rounded-full border px-4 text-sm font-semibold md:min-h-0 md:py-1.5 ${form.days.includes(d) ? 'border-blue-600 bg-blue-100 text-navy-900' : 'border-gray-300 text-gray-600 hover:bg-gray-100'}`}><input type="checkbox" className="sr-only" checked={form.days.includes(d)} onChange={() => toggleDay(d)} />{d}</label>)}</div>
              {errs.days && <p role="alert" className="mt-1 text-sm text-danger-600">{errs.days}</p>}</fieldset>
            <Field label="Budget per month (৳)" error={errs.budget}>{(i) => <Input id={i} inputMode="numeric" value={budgetText ?? form.budget} onChange={(e) => { setBudgetText(e.target.value); up({ budget: e.target.value }) }} aria-invalid={!!errs.budget} />}</Field>
            <div className="sm:col-span-2"><Field label="Requirements (optional)" hint="For example, weekly tests or a female tutor. Do not add phone numbers or addresses." error={errs.requirements}>{(i) => <Textarea id={i} value={form.requirements} onChange={(e) => up({ requirements: e.target.value })} aria-invalid={!!errs.requirements} />}</Field></div>
            <div className="flex flex-wrap gap-2 sm:col-span-2"><Button type="submit">Preview post</Button>{!editing && <Button type="button" variant="secondary" onClick={() => { set(() => ({ draft: form })); s.toast('Draft saved', 'success'); nav(`${A}/my-posts`) }}>Save draft</Button>}<Button type="button" variant="tertiary" onClick={() => nav(`${A}/my-posts`)}>Cancel</Button></div>
          </form>
        </Card>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">This is how tutors will see the post.</p>
          <Preview f={form} kid={kid.name} />
          <div className="flex flex-wrap gap-2"><Button onClick={publish}>{editing ? 'Save changes' : 'Publish post'}</Button><Button variant="secondary" onClick={() => setStep('form')}>Edit details</Button></div>
        </div>
      )}
    </div>
  )
}

function Published() {
  const { kid, kj } = usePJ()
  if (!kid || !kj.post) return <NoChild />
  const waiting = Object.values(kj.incoming).filter((v) => v === 'received').length
  return (
    <div>
      <PageHead title="Post published" tag="POST-P" />
      <Card className="border-teal-600"><div className="flex items-start gap-3"><CheckCircle2 size={28} className="mt-0.5 text-emerald-600" aria-hidden /><div><h2 className="text-xl">{kj.post.subject} for {kid.short} is live</h2><p className="mt-1 text-sm text-gray-600">{rankTutors(needOf(kj.post)).length} tutors match. {waiting > 0 ? `${waiting} tutor has already sent interest.` : 'Interest will appear under Manage.'}</p><div className="mt-4 flex flex-wrap gap-2"><Link to={`${A}/find-tutor`} className="rounded-input bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">View matches</Link><Link to={`${A}/my-posts/manage`} className="rounded-input border border-gray-400 px-4 py-2.5 text-sm font-semibold text-navy-900 hover:bg-gray-100">Manage post</Link></div></div></div></Card>
    </div>
  )
}

function Manage() {
  const { s, kid, kj, set, verified } = usePJ(); const nav = useNavigate(); const [del, setDel] = useState(false)
  if (!kid) return <NoChild />
  const p = kj.post
  if (!p) return <div><PageHead title="Manage post" tag="POST-P" crumb={{ to: `${A}/my-posts`, label: 'My posts' }} /><Card><EmptyState title={`No post for ${kid.short}`} body="Create a post to manage it here." action={<Link to={`${A}/my-posts/new`} className="text-sm font-semibold text-blue-600 hover:underline">Post a tuition</Link>} /></Card></div>
  const filled = p.status === 'filled'
  const remove = () => {
    set((k) => ({ post: null, draft: null, sent: Object.fromEntries(Object.entries(k.sent).filter(([, v]) => v === 'mutual')), incoming: Object.fromEntries(Object.entries(k.incoming).filter(([, v]) => v !== 'received')) }))
    setDel(false); s.toast('Post deleted. Waiting interest was withdrawn.', 'success'); nav(`${A}/my-posts`)
  }
  return (
    <div>
      <PageHead title="Manage post" tag="POST-P" crumb={{ to: `${A}/my-posts`, label: 'My posts' }} sub={`For ${kid.name}.`} />
      <PostCard p={p} who={kid.name} hideBy />
      <div className="mt-4 flex flex-wrap gap-2">
        {!filled && <Link to={`${A}/my-posts/edit`} className="inline-flex min-h-11 items-center gap-2 rounded-input border border-gray-400 px-4 py-2 text-sm font-semibold text-navy-900 hover:bg-gray-100 md:min-h-0"><Pencil size={14} aria-hidden /> Edit</Link>}
        {p.status === 'published' && <Button variant="secondary" icon={<PauseCircle size={16} />} onClick={() => { set(() => ({ post: { ...p, status: 'paused' } })); s.toast('Post paused. Tutors can no longer see it.', 'info') }}>Pause</Button>}
        {p.status === 'paused' && <Button icon={<PlayCircle size={16} />} onClick={() => { set(() => ({ post: { ...p, status: 'published' } })); s.toast('Post resumed', 'success') }}>Resume</Button>}
        <Link to={`${A}/find-tutor`} className="inline-flex min-h-11 items-center gap-2 rounded-input border border-gray-400 px-4 py-2 text-sm font-semibold text-navy-900 hover:bg-gray-100 md:min-h-0"><Search size={14} aria-hidden /> View matches</Link>
        {!filled && <Button variant="destructive" icon={<Trash2 size={16} />} onClick={() => setDel(true)}>Delete</Button>}
      </div>
      {p.status === 'paused' && <p className="mt-3 flex items-center gap-2 text-sm text-gray-600"><Eye size={14} aria-hidden /> Paused posts are hidden from tutors. Existing chats continue.</p>}
      {filled && <p className="mt-3 text-sm text-gray-600">This post is filled: {kid.short} started a tuition with {kid.tut?.tutor}. It can no longer be edited or deleted.</p>}
      <h2 className="mb-3 mt-8 flex items-center gap-2 text-xl"><Users size={20} aria-hidden /> Interested tutors</h2>
      {!verified && <p className="mb-3 text-sm text-gray-600">Accepting interest needs a verified account.</p>}
      <InterestPanel />
      <p className="mt-6 text-xs text-gray-600"><DemoTag /> Tutor interest is simulated.</p>
      <Modal open={del} onClose={() => setDel(false)} title="Delete this post?" footer={<><Button variant="secondary" onClick={() => setDel(false)}>Keep post</Button><Button variant="destructive" onClick={remove}>Delete post</Button></>}>
        <p className="text-sm">Deleting removes the {p.subject} post for {kid.short} and withdraws interest that has not become a chat. Existing chats stay. This cannot be undone.</p>
      </Modal>
    </div>
  )
}

export default function Posts({ sub }: { sub: string }) {
  if (sub === 'new') return <NewPage editing={false} />
  if (sub === 'edit') return <NewPage editing />
  if (sub === 'published') return <Published />
  if (sub === 'manage') return <Manage />
  return <ListPage />
}
