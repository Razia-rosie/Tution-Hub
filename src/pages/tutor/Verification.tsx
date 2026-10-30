import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { AlertTriangle, Check, CheckCircle2, Circle, Clock, FileSearch, ShieldAlert, ShieldCheck, Sparkles, Timer, CalendarClock, Mail, Smartphone } from 'lucide-react'
import { useStore } from '../../lib/store'
import { Button, Card, Chip, DemoTag, Field, Input, OtpInput, StatusChip, Textarea, VerifyBadge, cx } from '../../components/ui'
import { DocPlaceholder, Masked, PageHead } from '../../components/tutor/bits'
import { maskEmail, maskPhone, validEmail, DEMO_OTP_FIRST } from '../../lib/validate'
import RealVerification from '../../components/RealVerification'

const B = '/app/tutor/verification'
type Step = { slug: string; id: string; title: string; hint: string; cond?: boolean }
const steps = (expYears: number): Step[] => [
  { slug: 'identity', id: 'TV-02', title: 'Identity', hint: 'Your name and date of birth' },
  { slug: 'nid', id: 'TV-03', title: 'National ID (demo)', hint: 'Masked preview and placeholder upload' },
  { slug: 'phone', id: 'TV-04', title: 'Phone', hint: 'Confirm your +880 number' },
  { slug: 'email', id: 'TV-05', title: 'Email', hint: 'Confirm your email address' },
  { slug: 'education', id: 'TV-06', title: 'Education', hint: 'Degree, subject and year' },
  { slug: 'student-id', id: 'TV-07', title: 'Student / university ID', hint: 'Current or last ID card' },
  { slug: 'certificate', id: 'TV-08', title: 'Educational certificate', hint: 'Highest completed qualification' },
  { slug: 'institution', id: 'TV-09', title: 'Institution', hint: 'Where you study or studied' },
  { slug: 'experience', id: 'TV-10', title: 'Teaching experience', hint: 'Years and subjects taught' },
  { slug: 'experience-certificate', id: 'TV-11', title: 'Experience certificate', hint: expYears > 0 ? 'Needed because you reported experience' : 'Skipped, no experience reported', cond: expYears > 0 },
  { slug: 'review', id: 'TV-12', title: 'Review information', hint: 'Check everything before sending' },
  { slug: 'submit', id: 'TV-13', title: 'Submit', hint: 'Consent and send for review' },
]
const COLLECT = ['identity', 'nid', 'phone', 'email', 'education', 'student-id', 'certificate', 'institution', 'experience', 'experience-certificate']

export default function Verification({ sub }: { sub: string }) {
  const parts = sub.split('/').filter(Boolean)
  const [a, b] = parts
  if (!a) return <RealVerification role="tutor" />
  if (a === 'status') return <Status />
  if (a === 'skill-test') return b === 'run' ? <SkillRun /> : b === 'result' ? <SkillResult /> : <SkillIntro />
  if (a === 'interview') return <Interview />
  return <Wizard slug={a} />
}

/* ---------- TV-01 ---------- */
function Overview() {
  const { verification, journey: j } = useStore(); const vs = verification.tutor
  const list = steps(Number(j.tvForm.expYears) || 0)
  const required = list.filter((x) => x.cond !== false && !['review', 'submit'].includes(x.slug))
  const done = required.filter((x) => j.tv[x.slug]).length
  const submitted = ['pending', 'under_review', 'verified', 'rejected', 'action_required'].includes(vs)
  const next = list.find((x) => x.cond !== false && !j.tv[x.slug] && !['review', 'submit'].includes(x.slug))
  return (
    <div>
      <PageHead title="Verification Center" tag="TV-01" sub="Verified tutors get more trust, better matches and the right to send interest and chat." actions={<StatusChip state={vs} />} />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card pad={false}>
          <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 p-5">
            <div><p className="font-heading text-lg font-bold text-navy-900">{submitted ? 'Submitted for review' : `${done} of ${required.length} sections complete`}</p>
              <p className="text-sm text-gray-600">{vs === 'verified' ? 'All sections reviewed and approved.' : submitted ? 'Open the status page to follow the review.' : 'Save as you go. You can leave and come back.'}</p></div>
            <div className="ml-auto flex gap-2">
              {submitted ? <Link to={`${B}/status`} className="rounded-input bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">View status</Link>
                : <Link to={`${B}/${next ? next.slug : 'review'}`} className="rounded-input bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">{done === 0 ? 'Start verification' : next ? 'Continue' : 'Review and submit'}</Link>}
            </div>
          </div>
          <div className="px-5 pt-4"><div className="h-2 rounded-full bg-gray-100"><div className="h-2 rounded-full bg-teal-600 transition-all" style={{ width: `${submitted ? 100 : (done / required.length) * 100}%` }} /></div></div>
          <ol className="divide-y divide-gray-100 p-2">
            {list.filter((x) => !['review', 'submit'].includes(x.slug)).map((x) => {
              const skipped = x.cond === false; const ok = j.tv[x.slug]
              return (
                <li key={x.slug}><Link to={`${B}/${x.slug}`} className="flex items-center gap-3 rounded-input px-3 py-3 hover:bg-gray-100">
                  {ok ? <CheckCircle2 size={20} className="text-emerald-600" aria-label="Done" /> : <Circle size={20} className="text-gray-400" aria-label={skipped ? 'Skipped' : 'To do'} />}
                  <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-navy-900">{x.title}</span><span className="block text-xs text-gray-600">{x.hint}</span></span>
                  <span className="tabular text-xs text-gray-400">{x.id}</span>
                </Link></li>
              )
            })}
          </ol>
        </Card>
        <div className="space-y-4">
          <Card><h2 className="text-base">Your badges</h2>
            <div className="mt-3 flex flex-wrap gap-2"><VerifyBadge kind="identity" active={vs === 'verified'} /><VerifyBadge kind="education" active={vs === 'verified'} /><VerifyBadge kind="experience" active={vs === 'verified'} /><VerifyBadge kind="skill" active={j.skill === 'passed'} /></div>
            <p className="mt-3 text-xs text-gray-600">Identity, Education and Experience come from the review. Skill Verified comes from the optional subject test.</p></Card>
          <Card><h2 className="flex items-center gap-2 text-base"><Sparkles size={16} className="text-teal-700" aria-hidden /> Optional: stand out <Chip tone="blue">REC</Chip></h2>
            <div className="mt-3 space-y-2"><Link to={`${B}/skill-test`} className="flex items-center justify-between rounded-input border border-gray-200 p-3 text-sm font-semibold text-navy-900 hover:border-blue-600">Subject-skill test <span className="text-xs font-normal text-gray-600">{j.skill === 'passed' ? 'Passed' : j.skill === 'failed' ? 'Retake' : 'Not taken'}</span></Link>
              <Link to={`${B}/interview`} className="flex items-center justify-between rounded-input border border-gray-200 p-3 text-sm font-semibold text-navy-900 hover:border-blue-600">Verification interview <span className="text-xs font-normal text-gray-600">{j.interview === 'none' ? 'Not booked' : j.interview === 'scheduled' ? 'Booked' : 'Passed'}</span></Link></div></Card>
        </div>
      </div>
    </div>
  )
}

/* ---------- wizard ---------- */
function Wizard({ slug }: { slug: string }) {
  const s = useStore(); const nav = useNavigate(); const { journey: j, signup } = s
  const f = j.tvForm; const list = steps(Number(f.expYears) || 0); const idx = list.findIndex((x) => x.slug === slug)
  const [touched, setTouched] = useState(false); const [saved, setSaved] = useState(false)
  if (idx < 0) return <Card className="text-center"><p className="font-semibold text-navy-900">That verification step does not exist.</p><Link to={B} className="mt-2 inline-block text-sm font-semibold text-blue-600 hover:underline">Back to the checklist</Link></Card>
  const cur = list[idx]
  const patch = (p: Partial<typeof f>) => { s.setJourney((x) => ({ tvForm: { ...x.tvForm, ...p } })); setSaved(false) }
  const nextSlug = () => { for (let i = idx + 1; i < list.length; i++) if (list[i].cond !== false) return list[i].slug; return 'review' }
  const prevSlug = () => { for (let i = idx - 1; i >= 0; i--) if (list[i].cond !== false) return list[i].slug; return '' }
  const err = (() => {
    if (slug === 'identity') return { fullName: f.fullName.trim().split(/\s+/).length < 2 ? 'Enter your full name as on your ID (first and last).' : '', dob: !f.dob ? 'Enter your date of birth.' : new Date(f.dob) > new Date('2008-10-13') ? 'Tutors must be at least 18 years old.' : '' }
    if (slug === 'nid') return { nidLast4: !/^\d{4}$/.test(f.nidLast4) ? 'Enter the last 4 digits only.' : '', nidFile: !f.nidFile ? 'Add the placeholder ID photo to continue.' : '' }
    if (slug === 'phone') return { phone: !signup.phoneVerified && !j.tv.phoneCode ? 'Confirm your phone with the code.' : '' }
    if (slug === 'email') return { email: !signup.emailVerified && !j.tv.emailOk ? 'Confirm your email first.' : '' }
    if (slug === 'education') return { degree: f.degree.trim().length < 3 ? 'Enter your degree or programme, for example B.Sc. in Physics.' : '', year: !/^(19|20)\d\d$/.test(f.year) ? 'Enter a 4-digit year.' : '' }
    if (slug === 'student-id') return { studentIdFile: !f.studentIdFile ? 'Add the placeholder ID card to continue.' : '' }
    if (slug === 'certificate') return { certFile: !f.certFile ? 'Add the placeholder certificate to continue.' : '' }
    if (slug === 'institution') return { institution: f.institution.trim().length < 3 ? 'Enter the institution name.' : '' }
    if (slug === 'experience') return { expYears: !/^\d{1,2}$/.test(f.expYears) ? 'Enter whole years, 0 if none.' : '', subjects: f.subjects.trim().length < 3 ? 'List the subjects you teach.' : '' }
    if (slug === 'experience-certificate') return { expFile: !f.expFile ? 'Add the placeholder certificate to continue.' : '' }
    return {}
  })() as Record<string, string>
  const bad = Object.values(err).some(Boolean)
  const persist = () => { s.setJourney((x) => ({ tv: { ...x.tv, [slug]: true } })); if (s.verification.tutor === 'not_started') s.setVerification('tutor', 'draft') }
  const go = () => { setTouched(true); if (bad) return; persist(); nav(`${B}/${nextSlug()}`) }
  const e = (k: string) => (touched ? err[k] : '')
  let body: ReactNode = null
  if (slug === 'identity') body = <>
    <Field label="Full name (as on your ID)" error={e('fullName')}>{(id) => <Input id={id} value={f.fullName} onChange={(x) => patch({ fullName: x.target.value })} placeholder="Tanvir Ahmed Rahman" aria-invalid={!!e('fullName')} />}</Field>
    <Field label="Date of birth" error={e('dob')}>{(id) => <Input id={id} type="date" value={f.dob} onChange={(x) => patch({ dob: x.target.value })} aria-invalid={!!e('dob')} />}</Field></>
  if (slug === 'nid') body = <>
    <Card className="bg-offwhite-50"><p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Masked preview</p><p className="mt-1 text-sm">NID number: <Masked value={f.nidLast4 ? `•••• ••• ••• ${f.nidLast4}` : '•••• ••• ••• ••••'} /></p><p className="mt-1 text-xs text-gray-600">Only reviewers can see the document. It is never public, and every reveal is logged.</p></Card>
    <Field label="Last 4 digits of your NID" hint="We never ask you to type the full number here." error={e('nidLast4')}>{(id) => <Input id={id} inputMode="numeric" maxLength={4} value={f.nidLast4} onChange={(x) => patch({ nidLast4: x.target.value.replace(/\D/g, '') })} aria-invalid={!!e('nidLast4')} />}</Field>
    <DocPlaceholder label="NID photo (front)" file="nid-front-demo.jpg" uploaded={f.nidFile} onToggle={() => patch({ nidFile: !f.nidFile })} />{e('nidFile') && <p role="alert" className="text-sm text-danger-600">{e('nidFile')}</p>}
    <p className="text-xs text-gray-600"><DemoTag /> No NID check is performed. Real validation needs a government-data integration.</p></>
  if (slug === 'phone') body = <ContactStep kind="phone" />
  if (slug === 'email') body = <ContactStep kind="email" />
  if (slug === 'education') body = <>
    <Field label="Degree or programme" error={e('degree')}>{(id) => <Input id={id} value={f.degree} onChange={(x) => patch({ degree: x.target.value })} placeholder="B.Sc. in Physics" aria-invalid={!!e('degree')} />}</Field>
    <Field label="Year (expected or completed)" error={e('year')}>{(id) => <Input id={id} inputMode="numeric" maxLength={4} value={f.year} onChange={(x) => patch({ year: x.target.value.replace(/\D/g, '') })} placeholder="2027" aria-invalid={!!e('year')} />}</Field></>
  if (slug === 'student-id') body = <><p className="text-sm text-gray-600">Use your current student ID or the one from your last semester.</p><DocPlaceholder label="Student / university ID card" file="student-id-demo.jpg" uploaded={f.studentIdFile} onToggle={() => patch({ studentIdFile: !f.studentIdFile })} />{e('studentIdFile') && <p role="alert" className="text-sm text-danger-600">{e('studentIdFile')}</p>}</>
  if (slug === 'certificate') body = <><p className="text-sm text-gray-600">Upload your highest completed certificate, for example HSC or a bachelor transcript.</p><DocPlaceholder label="Educational certificate" file="certificate-demo.pdf" uploaded={f.certFile} onToggle={() => patch({ certFile: !f.certFile })} />{e('certFile') && <p role="alert" className="text-sm text-danger-600">{e('certFile')}</p>}</>
  if (slug === 'institution') body = <Field label="Institution name" hint="Fictional example: Eastern Metropolitan University" error={e('institution')}>{(id) => <Input id={id} value={f.institution} onChange={(x) => patch({ institution: x.target.value })} aria-invalid={!!e('institution')} />}</Field>
  if (slug === 'experience') body = <>
    <Field label="Years of teaching experience" error={e('expYears')}>{(id) => <Input id={id} inputMode="numeric" maxLength={2} value={f.expYears} onChange={(x) => patch({ expYears: x.target.value.replace(/\D/g, '') })} aria-invalid={!!e('expYears')} />}</Field>
    <Field label="Where you taught (optional)">{(id) => <Input id={id} value={f.expPlace} onChange={(x) => patch({ expPlace: x.target.value })} />}</Field>
    <Field label="Subjects you teach" error={e('subjects')}>{(id) => <Input id={id} value={f.subjects} onChange={(x) => patch({ subjects: x.target.value })} placeholder="Mathematics, Physics" aria-invalid={!!e('subjects')} />}</Field></>
  if (slug === 'experience-certificate') body = <><Chip tone="blue">Conditional</Chip><DocPlaceholder label="Experience certificate" file="experience-demo.pdf" uploaded={f.expFile} onToggle={() => patch({ expFile: !f.expFile })} />{e('expFile') && <p role="alert" className="text-sm text-danger-600">{e('expFile')}</p>}</>
  if (slug === 'review') body = <ReviewStep />
  if (slug === 'submit') return <Submit idx={idx} cur={cur} list={list} />
  const isCollect = COLLECT.includes(slug)
  return (
    <div className="mx-auto max-w-2xl">
      <PageHead title={cur.title} tag={cur.id} crumb={{ to: B, label: 'Verification Center' }} sub={cur.hint} />
      <p className="mb-2 text-xs font-semibold text-gray-600">Step {idx + 1} of {list.length}</p>
      <div className="mb-5 flex gap-1" aria-hidden>{list.map((x, i) => <span key={x.slug} className={cx('h-1.5 flex-1 rounded-full', x.cond === false ? 'bg-gray-100' : i < idx || j.tv[x.slug] ? 'bg-teal-600' : i === idx ? 'bg-blue-600' : 'bg-gray-200')} />)}</div>
      <Card className="space-y-5">{body}</Card>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        {prevSlug() ? <Link to={`${B}/${prevSlug()}`} className="rounded-input border border-gray-400 px-4 py-2 text-sm font-semibold text-navy-900 hover:bg-gray-100">Back</Link> : <Link to={B} className="rounded-input border border-gray-400 px-4 py-2 text-sm font-semibold text-navy-900 hover:bg-gray-100">Checklist</Link>}
        {isCollect && <Button variant="tertiary" onClick={() => { setSaved(true); if (s.verification.tutor === 'not_started') s.setVerification('tutor', 'draft'); s.toast('Draft saved', 'success') }}>{saved ? 'Draft saved' : 'Save draft'}</Button>}
        <Button className="ml-auto" onClick={slug === 'review' ? () => nav(`${B}/submit`) : go}>{slug === 'review' ? 'Looks right, continue' : 'Save and continue'}</Button>
      </div>
      {touched && bad && <p role="alert" className="mt-3 text-sm text-danger-600">Fix the highlighted fields to continue.</p>}
    </div>
  )
}

function ContactStep({ kind }: { kind: 'phone' | 'email' }) {
  const s = useStore(); const { signup, journey: j } = s
  const [code, setCode] = useState(''); const [wrong, setWrong] = useState(false)
  const val = kind === 'phone' ? signup.phone || '1712345642' : signup.email || 'tanvir.rahman@example.com'
  const verified = kind === 'phone' ? signup.phoneVerified || j.tv.phoneCode : signup.emailVerified || j.tv.emailOk
  const masked = kind === 'phone' ? maskPhone(val) : validEmail(val) ? maskEmail(val) : val
  const Icon = kind === 'phone' ? Smartphone : Mail
  if (verified) return <div className="flex items-center gap-3"><Icon className="text-teal-700" aria-hidden /><div><p className="text-sm font-semibold text-navy-900">{kind === 'phone' ? 'Phone' : 'Email'} verified</p><p className="text-sm text-gray-600"><Masked value={masked} /> was confirmed during sign-up.</p></div><Chip tone="green" icon={<Check size={12} aria-hidden />}>Verified</Chip></div>
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">We will confirm <Masked value={masked} />.</p>
      {kind === 'phone' ? <>
        <OtpInput value={code} onChange={(v) => { setCode(v); setWrong(false) }} error={wrong} />
        {wrong && <p role="alert" className="text-sm text-danger-600">That code is not correct.</p>}
        <div className="flex flex-wrap items-center gap-3"><Button onClick={() => (code === DEMO_OTP_FIRST ? s.setJourney((x) => ({ tv: { ...x.tv, phoneCode: true } })) : (setWrong(true), setCode('')))}>Verify code</Button><span className="flex items-center gap-2 text-xs"><DemoTag /> Demo code: <b className="tabular">{DEMO_OTP_FIRST}</b></span></div></>
        : <div className="flex flex-wrap items-center gap-3"><Button onClick={() => s.setJourney((x) => ({ tv: { ...x.tv, emailOk: true } }))}>Open verification link</Button><DemoTag label="Demo link" /><span className="text-xs text-gray-600">No email is sent.</span></div>}
    </div>
  )
}

function ReviewStep() {
  const { journey: j, signup } = useStore(); const f = j.tvForm
  const rows: [string, string, string, ReactNode][] = [
    ['identity', 'Identity', 'identity', <>{f.fullName || 'Not entered'} · {f.dob || 'No date'}</>],
    ['nid', 'National ID', 'nid', <><Masked value={`•••• ••• ••• ${f.nidLast4 || '••••'}`} /> · {f.nidFile ? 'placeholder added' : 'no file'}</>],
    ['phone', 'Phone', 'phone', <Masked value={maskPhone(signup.phone || '1712345642')} />],
    ['email', 'Email', 'email', <Masked value={validEmail(signup.email) ? maskEmail(signup.email) : 't•••@example.com'} />],
    ['education', 'Education', 'education', <>{f.degree || 'Not entered'} · {f.year || 'no year'}</>],
    ['student-id', 'Student ID', 'student-id', f.studentIdFile ? 'Placeholder added' : 'No file'],
    ['certificate', 'Certificate', 'certificate', f.certFile ? 'Placeholder added' : 'No file'],
    ['institution', 'Institution', 'institution', f.institution || 'Not entered'],
    ['experience', 'Experience', 'experience', <>{f.expYears || '—'} years · {f.subjects || 'no subjects'}</>],
  ]
  return (
    <div className="divide-y divide-gray-100">
      {rows.map(([k, l, to, v]) => (
        <div key={k} className="flex flex-wrap items-center gap-3 py-3 text-sm">
          {j.tv[k] ? <CheckCircle2 size={18} className="text-emerald-600" aria-label="Complete" /> : <AlertTriangle size={18} className="text-warning-600" aria-label="Incomplete" />}
          <span className="w-32 font-semibold text-navy-900">{l}</span><span className="min-w-0 flex-1 text-gray-600">{v}</span>
          <Link to={`${B}/${to}`} className="font-semibold text-blue-600 hover:underline">Edit</Link>
        </div>
      ))}
    </div>
  )
}

function Submit({ idx, cur, list }: { idx: number; cur: Step; list: Step[] }) {
  const s = useStore(); const nav = useNavigate(); const f = s.journey.tvForm; const [touched, setTouched] = useState(false); const [busy, setBusy] = useState(false)
  const missing = list.filter((x) => x.cond !== false && COLLECT.includes(x.slug) && !s.journey.tv[x.slug])
  const consentErr = touched && !f.consent ? 'You must agree before submitting.' : ''
  return (
    <div className="mx-auto max-w-2xl">
      <PageHead title={cur.title} tag={cur.id} crumb={{ to: `${B}/review`, label: 'Review information' }} sub="Last step. A reviewer checks your details, usually within one to two working days." />
      <p className="mb-2 text-xs font-semibold text-gray-600">Step {idx + 1} of {list.length}</p>
      {missing.length > 0 && <Card className="mb-4 border-warning-600/40 bg-warning-100/50"><p className="flex items-center gap-2 text-sm font-semibold text-navy-900"><AlertTriangle size={16} className="text-warning-600" aria-hidden /> {missing.length} section{missing.length > 1 ? 's' : ''} still incomplete</p>
        <p className="mt-1 text-sm text-gray-600">{missing.map((m) => m.title).join(', ')}. <Link to={`${B}/${missing[0].slug}`} className="font-semibold text-blue-600 hover:underline">Complete {missing[0].title}</Link></p></Card>}
      <Card className="space-y-4">
        <label className="flex cursor-pointer items-start gap-3 text-sm"><input type="checkbox" checked={f.consent} onChange={(e) => s.setJourney((x) => ({ tvForm: { ...x.tvForm, consent: e.target.checked } }))} className="mt-1 h-4 w-4 accent-blue-600" aria-invalid={!!consentErr} />
          <span>I confirm that the information is mine and accurate. I consent to TuitionHub reviewers checking my documents. I understand my documents are never shown publicly.</span></label>
        {consentErr && <p role="alert" className="text-sm text-danger-600">{consentErr}</p>}
        <p className="text-xs text-gray-600"><DemoTag /> Submitting sends nothing anywhere. It starts a simulated review.</p>
      </Card>
      <div className="mt-5 flex gap-3"><Link to={`${B}/review`} className="rounded-input border border-gray-400 px-4 py-2 text-sm font-semibold text-navy-900 hover:bg-gray-100">Back</Link>
        <Button className="ml-auto" loading={busy} disabled={missing.length > 0} onClick={() => { setTouched(true); if (!f.consent) return; setBusy(true); setTimeout(() => { s.setVerification('tutor', 'pending'); s.toast('Submitted for review', 'success'); nav(`${B}/status`) }, 700) }}>{busy ? 'Submitting…' : 'Submit for review'}</Button></div>
    </div>
  )
}

/* ---------- TV-14..17 ---------- */
function Status() {
  const s = useStore(); const nav = useNavigate(); const vs = s.verification.tutor; const j = s.journey; const [reply, setReply] = useState(''); const [touched, setTouched] = useState(false)
  if (vs === 'not_started' || vs === 'draft') return <div className="mx-auto max-w-xl"><PageHead title="Verification status" tag="TV-14" /><Card className="text-center"><FileSearch className="mx-auto text-gray-400" size={32} aria-hidden /><p className="mt-2 font-heading text-lg font-bold text-navy-900">Nothing submitted yet</p><p className="mt-1 text-sm text-gray-600">Finish your checklist and submit for review first.</p><Link to={B} className="mt-4 inline-block rounded-input bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Open checklist</Link></Card></div>
  const demo = (
    <Card className="mt-5 border-dashed border-warning-600 bg-warning-100/60"><DemoTag label="Demo: reviewer controls" />
      <p className="mt-2 text-xs text-gray-600">In production an admin decides. Use these to see each outcome.</p>
      <div className="mt-3 flex flex-wrap gap-2"><Button size="sm" onClick={() => { s.advanceVerification(); s.toast('Demo: reviewer advanced the case', 'success') }}>Simulate approval</Button>
        <Button size="sm" variant="secondary" onClick={() => s.setVerification('tutor', 'rejected')}>Simulate rejection</Button>
        <Button size="sm" variant="secondary" onClick={() => s.setVerification('tutor', 'action_required')}>Simulate request for more information</Button></div></Card>
  )
  const timeline = (
    <ol className="mt-5 space-y-3 text-sm">{[['Submitted', true], ['Under review', vs !== 'pending'], ['Decision', vs === 'verified' || vs === 'rejected' || vs === 'action_required']].map(([l, ok]) => (
      <li key={String(l)} className="flex items-center gap-3">{ok ? <CheckCircle2 size={18} className="text-emerald-600" aria-hidden /> : <Clock size={18} className="text-gray-400" aria-hidden />}<span className={ok ? 'font-semibold text-navy-900' : 'text-gray-600'}>{l}</span></li>))}</ol>
  )
  if (vs === 'pending' || vs === 'under_review') return (
    <div className="mx-auto max-w-xl"><PageHead title={vs === 'pending' ? 'Submitted' : 'Under review'} tag="TV-14" crumb={{ to: B, label: 'Verification Center' }} />
      <Card><div className="flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-full bg-warning-100 text-warning-600"><Clock aria-hidden /></span><div><StatusChip state={vs} /><p className="mt-1 text-sm text-gray-600">Reviews usually take one to two working days. You will be notified.</p></div></div>{timeline}
        <p className="mt-4 rounded-input bg-offwhite-50 p-3 text-xs text-gray-600">While you wait you can browse tuition in read-only mode. Interest, chat and posting unlock after approval.</p></Card>{demo}</div>
  )
  if (vs === 'verified') return (
    <div className="mx-auto max-w-xl"><PageHead title="You are verified" tag="TV-15" crumb={{ to: B, label: 'Verification Center' }} />
      <Card className="text-center"><span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-success-100 text-emerald-600"><ShieldCheck size={28} aria-hidden /></span>
        <p className="mt-3 font-heading text-xl font-bold text-navy-900">Verification approved</p><p className="mt-1 text-sm text-gray-600">Your badges are now visible on your profile and in match results.</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2"><VerifyBadge kind="identity" /><VerifyBadge kind="education" /><VerifyBadge kind="experience" /><VerifyBadge kind="skill" active={j.skill === 'passed'} /></div>
        <div className="mt-6 flex flex-wrap justify-center gap-3"><Button onClick={() => nav('/app/tutor/dashboard')}>Go to dashboard</Button><Link to={`${B}/skill-test`} className="rounded-input border border-gray-400 px-4 py-2 text-sm font-semibold text-navy-900 hover:bg-gray-100">Take the skill test (optional)</Link></div></Card>{demo}</div>
  )
  if (vs === 'rejected') return (
    <div className="mx-auto max-w-xl"><PageHead title="Not approved" tag="TV-16" crumb={{ to: B, label: 'Verification Center' }} />
      <Card><div className="flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-full bg-danger-100 text-danger-600"><ShieldAlert aria-hidden /></span><div><StatusChip state="rejected" /><p className="mt-1 text-sm text-gray-600">Review the reasons, fix them and resubmit. Nothing is lost.</p></div></div>
        <h2 className="mt-5 text-base">Reasons</h2><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{j.rejectReasons.map((r) => <li key={r}>{r}</li>)}</ul>
        <div className="mt-5 flex flex-wrap gap-3"><Button onClick={() => { s.setVerification('tutor', 'draft'); nav(`${B}/nid`) }}>Edit and resubmit</Button><Link to="/safety" className="rounded-input border border-gray-400 px-4 py-2 text-sm font-semibold text-navy-900 hover:bg-gray-100">Contact support</Link></div></Card>{demo}</div>
  )
  return (
    <div className="mx-auto max-w-xl"><PageHead title="More information needed" tag="TV-17" crumb={{ to: B, label: 'Verification Center' }} />
      <Card><div className="flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-full bg-warning-100 text-warning-600"><AlertTriangle aria-hidden /></span><div><StatusChip state="action_required" /><p className="mt-1 text-sm text-gray-600">The reviewer asked for one more detail.</p></div></div>
        <blockquote className="mt-4 rounded-input border-l-4 border-warning-600 bg-offwhite-50 p-3 text-sm">{j.moreInfo}</blockquote>
        <div className="mt-4"><Field label="Your response" error={touched && reply.trim().length < 10 ? 'Add at least a short sentence.' : ''}>{(id) => <Textarea id={id} rows={3} value={reply} onChange={(e) => setReply(e.target.value)} />}</Field></div>
        <Button className="mt-4" onClick={() => { setTouched(true); if (reply.trim().length < 10) return; s.setVerification('tutor', 'pending'); s.toast('Information sent. Back in the queue.', 'success') }}>Send information</Button></Card>{demo}</div>
  )
}

/* ---------- TV-18..21 ---------- */
export const QUESTIONS = [
  { q: 'A 2 kg block accelerates at 3 m/s². What net force acts on it?', o: ['1.5 N', '5 N', '6 N', '9 N'], a: 2 },
  { q: 'Which quantity is a vector?', o: ['Speed', 'Mass', 'Displacement', 'Time'], a: 2 },
  { q: 'If f(x) = 3x² − 2x, what is f′(2)?', o: ['8', '10', '12', '4'], a: 1 },
  { q: 'The SI unit of electric potential difference is…', o: ['Ampere', 'Volt', 'Ohm', 'Coulomb'], a: 1 },
  { q: 'Solve: 2x + 7 = 19. What is x?', o: ['5', '6', '7', '13'], a: 1 },
]
function SkillIntro() {
  const s = useStore(); const nav = useNavigate()
  return (
    <div className="mx-auto max-w-xl"><PageHead title="Subject-skill test" tag="TV-18 · REC" crumb={{ to: B, label: 'Verification Center' }} sub="An optional short test that can add a Skill Verified badge to your profile." />
      <Card><ul className="space-y-2 text-sm"><li className="flex gap-2"><Timer size={16} className="mt-0.5 text-teal-700" aria-hidden /> 5 questions, about 5 minutes</li><li className="flex gap-2"><Check size={16} className="mt-0.5 text-teal-700" aria-hidden /> Pass mark: 4 of 5</li><li className="flex gap-2"><Check size={16} className="mt-0.5 text-teal-700" aria-hidden /> You can retake it. It does not affect your other badges.</li></ul>
        <p className="mt-4 flex items-center gap-2 text-xs text-gray-600"><DemoTag /> Sample questions with an answer key in the app. No proctoring.</p>
        {s.journey.skill === 'passed' && <p className="mt-3 text-sm font-semibold text-emerald-600">You already passed. You can still retake it.</p>}
        <Button className="mt-5" onClick={() => { s.setJourney(() => ({ skill: 'running', skillAnswers: {} })); nav(`${B}/skill-test/run`) }}>Start the test</Button></Card></div>
  )
}
function SkillRun() {
  const s = useStore(); const nav = useNavigate(); const ans = s.journey.skillAnswers; const [i, setI] = useState(0); const q = QUESTIONS[i]
  const pick = (k: number) => s.setJourney((x) => ({ skillAnswers: { ...x.skillAnswers, [i]: k } }))
  const finish = () => { const score = QUESTIONS.filter((x, k) => ans[k] === x.a).length; s.setJourney(() => ({ skill: score >= 4 ? 'passed' : 'failed' })); nav(`${B}/skill-test/result`) }
  return (
    <div className="mx-auto max-w-xl"><PageHead title="Skill test in progress" tag="TV-19 · REC" />
      <Card><div className="flex items-center justify-between text-xs font-semibold text-gray-600"><span>Question {i + 1} of {QUESTIONS.length}</span><span className="flex items-center gap-1"><DemoTag label="Demo" /> No timer</span></div>
        <div className="mt-2 h-1.5 rounded-full bg-gray-100"><div className="h-1.5 rounded-full bg-blue-600" style={{ width: `${((i + 1) / QUESTIONS.length) * 100}%` }} /></div>
        <fieldset className="mt-5"><legend className="font-heading text-lg font-bold text-navy-900">{q.q}</legend>
          <div className="mt-3 space-y-2">{q.o.map((o, k) => <label key={o} className={cx('flex cursor-pointer items-center gap-3 rounded-input border p-3 text-sm', ans[i] === k ? 'border-blue-600 bg-blue-100' : 'border-gray-200 hover:bg-gray-100')}><input type="radio" name="q" checked={ans[i] === k} onChange={() => pick(k)} className="accent-blue-600" />{o}</label>)}</div></fieldset>
        <div className="mt-5 flex gap-3"><Button variant="secondary" disabled={i === 0} onClick={() => setI(i - 1)}>Previous</Button>
          {i < QUESTIONS.length - 1 ? <Button className="ml-auto" disabled={ans[i] === undefined} onClick={() => setI(i + 1)}>Next</Button> : <Button className="ml-auto" disabled={Object.keys(ans).length < QUESTIONS.length} onClick={finish}>Finish test</Button>}</div></Card></div>
  )
}
function SkillResult() {
  const s = useStore(); const nav = useNavigate(); const ans = s.journey.skillAnswers; const score = QUESTIONS.filter((x, k) => ans[k] === x.a).length; const pass = s.journey.skill === 'passed'
  if (Object.keys(ans).length === 0) return <div className="mx-auto max-w-xl"><PageHead title="Test result" tag="TV-20 · REC" /><Card className="text-center"><p className="text-sm text-gray-600">No test taken yet.</p><Link to={`${B}/skill-test`} className="mt-2 inline-block text-sm font-semibold text-blue-600 hover:underline">Open the test</Link></Card></div>
  return (
    <div className="mx-auto max-w-xl"><PageHead title="Test result" tag="TV-20 · REC" />
      <Card className="text-center"><p className="font-heading text-4xl font-bold text-navy-900 tabular">{score}/{QUESTIONS.length}</p><p className={cx('mt-1 font-semibold', pass ? 'text-emerald-600' : 'text-danger-600')}>{pass ? 'Passed' : 'Not passed this time'}</p>
        {pass ? <div className="mt-3 flex justify-center"><VerifyBadge kind="skill" /></div> : <p className="mt-2 text-sm text-gray-600">You need 4 of 5. Review the topics and try again.</p>}
        <ul className="mt-5 space-y-2 text-left text-sm">{QUESTIONS.map((x, k) => <li key={k} className="flex gap-2">{ans[k] === x.a ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" aria-label="Correct" /> : <AlertTriangle size={16} className="mt-0.5 shrink-0 text-danger-600" aria-label="Wrong" />}<span>{x.q} <span className="text-gray-600">Answer: {x.o[x.a]}</span></span></li>)}</ul>
        <div className="mt-6 flex flex-wrap justify-center gap-3"><Button variant="secondary" onClick={() => nav(`${B}/skill-test`)}>Retake</Button><Button onClick={() => nav(B)}>Back to checklist</Button></div></Card></div>
  )
}
function Interview() {
  const s = useStore(); const j = s.journey; const slots = ['Sat 17 Oct, 11:00 AM', 'Sun 18 Oct, 4:00 PM', 'Mon 19 Oct, 7:30 PM']; const [slot, setSlot] = useState(''); const [touched, setTouched] = useState(false)
  return (
    <div className="mx-auto max-w-xl"><PageHead title="Verification interview" tag="TV-21 · REC" crumb={{ to: B, label: 'Verification Center' }} sub="A 15-minute video call with a reviewer. Optional, and helps build trust." />
      {j.interview === 'none' && <Card><fieldset><legend className="text-sm font-semibold text-navy-900">Pick a slot</legend><div className="mt-3 space-y-2">{slots.map((x) => <label key={x} className={cx('flex cursor-pointer items-center gap-3 rounded-input border p-3 text-sm', slot === x ? 'border-blue-600 bg-blue-100' : 'border-gray-200 hover:bg-gray-100')}><input type="radio" name="slot" checked={slot === x} onChange={() => setSlot(x)} className="accent-blue-600" /><CalendarClock size={16} aria-hidden />{x}</label>)}</div></fieldset>
        {touched && !slot && <p role="alert" className="mt-2 text-sm text-danger-600">Choose a time slot.</p>}<p className="mt-3 text-xs text-gray-600"><DemoTag /> No video call is created.</p>
        <Button className="mt-4" onClick={() => { setTouched(true); if (!slot) return; s.setJourney(() => ({ interview: 'scheduled' })); s.toast(`Interview booked: ${slot}`, 'success') }}>Book interview</Button></Card>}
      {j.interview === 'scheduled' && <Card><p className="flex items-center gap-2 font-semibold text-navy-900"><CalendarClock size={18} className="text-blue-600" aria-hidden /> Interview booked</p><p className="mt-1 text-sm text-gray-600">{slot || 'Your chosen slot'} · Video call link appears here 15 minutes before.</p>
        <div className="mt-4 flex flex-wrap gap-2 rounded-input border border-dashed border-warning-600 bg-warning-100/60 p-3"><DemoTag label="Demo" /><Button size="sm" onClick={() => s.setJourney(() => ({ interview: 'passed' }))}>Simulate interview result: passed</Button><Button size="sm" variant="secondary" onClick={() => s.setJourney(() => ({ interview: 'none' }))}>Cancel booking</Button></div></Card>}
      {j.interview === 'passed' && <Card className="text-center"><CheckCircle2 size={32} className="mx-auto text-emerald-600" aria-hidden /><p className="mt-2 font-heading text-lg font-bold text-navy-900">Interview passed</p><p className="mt-1 text-sm text-gray-600">Your profile shows an Interviewed note. Thank you.</p><Button className="mt-4" variant="secondary" onClick={() => s.setJourney(() => ({ interview: 'none' }))}>Reset interview (demo)</Button></Card>}
    </div>
  )
}
