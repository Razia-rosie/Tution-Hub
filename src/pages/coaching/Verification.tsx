import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { AlertTriangle, CheckCircle2, Circle, Clock, PartyPopper, ShieldCheck, XCircle } from 'lucide-react'
import { useStore } from '../../lib/store'
import { DEMO_OTP_FIRST, DEMO_OTP_RESENT, maskEmail, maskPhone, normalizePhone, validEmail, validPhone } from '../../lib/validate'
import { AREAS, LEVELS, OWNER_ROLES, ORG, ORG_TYPES, REG_TYPES, STUDENT_BANDS, SUBJECT_LIST, type CForm } from '../../lib/coaching'
import { Button, Card, Chip, DemoTag, Field, Input, OtpInput, PhoneInput, Select, StatusChip, VerifyBadge, btnClass, cx } from '../../components/ui'
import { DocPlaceholder, Masked, PageHead } from '../../components/tutor/bits'
import RealVerification from '../../components/RealVerification'

export const B = '/app/coaching/verification'
const STEPS = [
  { slug: 'register', path: '', id: 'CV-01', title: 'Organization registration', hint: 'Name, owner and type' },
  { slug: 'organization', path: 'organization', id: 'CV-02', title: 'Organization information', hint: 'Area, size, levels and subjects' },
  { slug: 'institution', path: 'institution', id: 'CV-03', title: 'Institution information', hint: 'Registration type and last 4 digits' },
  { slug: 'documents', path: 'documents', id: 'CV-04', title: 'Verification documents', hint: 'Placeholder files only' },
  { slug: 'contact', path: 'contact', id: 'CV-05', title: 'Phone and email', hint: 'Confirm both with one-time codes' },
  { slug: 'review', path: 'review', id: 'CV-06', title: 'Review your details', hint: 'Check everything before you submit' },
] as const
const href = (p: string) => (p ? `${B}/${p}` : B)

export default function Verification({ sub }: { sub: string }) {
  const a = sub.split('/').filter(Boolean)[0]
  if (!a) return <RealVerification role="coaching" />
  if (a === 'status') return <Status />
  if (a === 'submit') return <Submit />
  return <Step slug={a} />
}

function useDone() {
  const s = useStore(); const cv = s.cv; const f = cv.form
  const done = (slug: string) => slug === 'documents' ? f.licenceFile && f.ownerIdFile : slug === 'contact' ? cv.emailOk && cv.phoneOk : !!cv.cv[slug]
  return { s, done }
}

function Checklist({ current }: { current: string }) {
  const { s, done } = useDone(); const vs = s.verification.coaching
  const n = STEPS.filter((x) => done(x.slug)).length
  const submitted = ['pending', 'under_review', 'verified', 'rejected', 'action_required'].includes(vs)
  return (
    <Card pad={false} className="h-fit">
      <div className="border-b border-gray-100 p-6"><p className="font-heading text-lg font-bold text-navy-900">{submitted ? 'Submitted for review' : `${n} of ${STEPS.length} steps complete`}</p>
        <div className="mt-3 h-2 rounded-full bg-gray-100"><div className="h-2 rounded-full bg-teal-600 transition-all" style={{ width: `${submitted ? 100 : (n / STEPS.length) * 100}%` }} /></div></div>
      <ol className="p-2">
        {STEPS.map((x) => (
          <li key={x.slug}><Link to={href(x.path)} aria-current={x.slug === current ? 'step' : undefined} className={cx('flex items-center gap-3 rounded-input px-3 py-3 hover:bg-gray-100', x.slug === current && 'bg-blue-100')}>
            {done(x.slug) ? <CheckCircle2 size={20} className="text-emerald-600" aria-label="Done" /> : <Circle size={20} className="text-gray-400" aria-label="To do" />}
            <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-navy-900">{x.title}</span><span className="block text-xs text-gray-600">{x.hint}</span></span>
            <span className="tabular text-xs text-gray-600">{x.id}</span></Link></li>
        ))}
        <li><Link to={`${B}/status`} className="flex items-center gap-3 rounded-input px-3 py-3 hover:bg-gray-100"><Clock size={20} className="text-gray-400" aria-hidden /><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-navy-900">Submit and status</span><span className="block text-xs text-gray-600">CV-07 to CV-11</span></span></Link></li>
      </ol>
    </Card>
  )
}

const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

function Step({ slug }: { slug: string }) {
  const { s, done } = useDone(); const nav = useNavigate(); const cv = s.cv; const f = cv.form
  const idx = STEPS.findIndex((x) => x.slug === slug)
  const [touched, setTouched] = useState(false)
  const [code, setCode] = useState(''); const [wrong, setWrong] = useState(false)
  const [ecode, setEcode] = useState(''); const [ewrong, setEwrong] = useState(false)
  const [sent, setSent] = useState(false)
  if (idx < 0) return <Card className="text-center"><p className="font-semibold text-navy-900">That verification step does not exist.</p><Link to={B} className="mt-2 inline-block text-sm font-semibold text-blue-600 hover:underline">Back to the checklist</Link></Card>
  const cur = STEPS[idx]
  const patch = (p: Partial<CForm>) => s.setCV((x) => ({ form: { ...x.form, ...p } }))
  const year = Number(f.established)
  const err = ((): Record<string, string> => {
    if (slug === 'register') return {
      orgName: f.orgName.trim().length < 3 ? 'Enter the organization name (at least 3 characters).' : '',
      ownerName: f.ownerName.trim().split(/\s+/).length < 2 ? 'Enter the owner full name (first and last).' : '',
    }
    if (slug === 'organization') return {
      established: !/^\d{4}$/.test(f.established) ? 'Enter a four-digit year.' : year < 1980 || year > 2026 ? 'Year must be between 1980 and 2026.' : '',
      levels: f.levels.length ? '' : 'Choose at least one level.', subjects: f.subjects.length ? '' : 'Choose at least one subject.',
    }
    if (slug === 'institution') return { regLast4: !/^\d{4}$/.test(f.regLast4) ? 'Enter the last 4 digits only.' : '' }
    if (slug === 'documents') return { licenceFile: f.licenceFile ? '' : 'Add the placeholder licence to continue.', ownerIdFile: f.ownerIdFile ? '' : 'Add the placeholder owner ID to continue.' }
    if (slug === 'contact') return { email: cv.emailOk ? '' : 'Confirm your email with the code.', phone: cv.phoneOk ? '' : 'Confirm your phone with the code.' }
    return {}
  })()
  const bad = Object.values(err).some(Boolean)
  const e = (k: string) => (touched ? err[k] : '')
  const mark = () => { s.setCV((x) => ({ cv: { ...x.cv, [slug]: true } })); if (s.verification.coaching === 'not_started') s.setVerification('coaching', 'draft') }
  const next = STEPS[idx + 1]
  const go = () => { setTouched(true); if (bad) return; mark(); nav(next ? href(next.path) : `${B}/submit`) }
  const emailRaw = f.email || s.signup.email || 'scholars@demo.tuitionhub.test'
  const phoneRaw = normalizePhone(f.phone || s.signup.phone || '01712345678')
  const fillDemo = () => { patch({ orgName: ORG.name, ownerName: ORG.owner, ownerRole: 'Owner', orgType: 'Coaching centre', area: 'Mohakhali', established: '2016', band: '150 to 400', levels: ['Secondary (6 to 10)', 'HSC'], subjects: ['Mathematics', 'Physics', 'Chemistry', 'English'], regLast4: '4821', email: 'scholars@demo.tuitionhub.test', phone: '01712345678' }); s.toast('Demo: details filled in for Scholars Point Coaching', 'info') }

  let body: ReactNode = null
  if (slug === 'register') body = <>
    <div className="flex flex-wrap items-center gap-2 rounded-input bg-offwhite-50 p-3 text-sm text-gray-600"><DemoTag /> Skip the typing:<Button size="sm" variant="secondary" onClick={fillDemo}>Use Scholars Point demo details</Button></div>
    <Field label="Organization name" error={e('orgName')}>{(id) => <Input id={id} value={f.orgName} onChange={(x) => patch({ orgName: x.target.value })} placeholder="Scholars Point Coaching" aria-invalid={!!e('orgName')} />}</Field>
    <Field label="Owner full name" hint="The person who answers for this organization." error={e('ownerName')}>{(id) => <Input id={id} value={f.ownerName} onChange={(x) => patch({ ownerName: x.target.value })} placeholder="Imran Hossain" aria-invalid={!!e('ownerName')} />}</Field>
    <Field label="Your role">{(id) => <Select id={id} value={f.ownerRole} onChange={(x) => patch({ ownerRole: x.target.value })} options={OWNER_ROLES} />}</Field>
    <Field label="Organization type">{(id) => <Select id={id} value={f.orgType} onChange={(x) => patch({ orgType: x.target.value })} options={ORG_TYPES} />}</Field></>
  if (slug === 'organization') body = <>
    <Field label="Area" hint="Only the area is shown publicly. Never the street address.">{(id) => <Select id={id} value={f.area} onChange={(x) => patch({ area: x.target.value })} options={AREAS} />}</Field>
    <Field label="Year established" error={e('established')}>{(id) => <Input id={id} inputMode="numeric" maxLength={4} value={f.established} onChange={(x) => patch({ established: x.target.value.replace(/\D/g, '') })} placeholder="2016" aria-invalid={!!e('established')} />}</Field>
    <Field label="Approximate number of students">{(id) => <Select id={id} value={f.band} onChange={(x) => patch({ band: x.target.value })} options={STUDENT_BANDS} />}</Field>
    <fieldset><legend className="mb-2 text-sm font-semibold text-navy-900">Levels you teach</legend><div className="flex flex-wrap gap-2">{LEVELS.map((l) => <label key={l} className={cx('inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-input border px-3 text-sm', f.levels.includes(l) ? 'border-blue-600 bg-blue-100 text-navy-900' : 'border-gray-200 text-gray-600')}><input type="checkbox" className="h-4 w-4" checked={f.levels.includes(l)} onChange={() => patch({ levels: toggle(f.levels, l) })} />{l}</label>)}</div>{e('levels') && <p role="alert" className="mt-2 text-sm text-danger-600">{e('levels')}</p>}</fieldset>
    <fieldset><legend className="mb-2 text-sm font-semibold text-navy-900">Subjects</legend><div className="flex flex-wrap gap-2">{SUBJECT_LIST.map((l) => <label key={l} className={cx('inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-input border px-3 text-sm', f.subjects.includes(l) ? 'border-blue-600 bg-blue-100 text-navy-900' : 'border-gray-200 text-gray-600')}><input type="checkbox" className="h-4 w-4" checked={f.subjects.includes(l)} onChange={() => patch({ subjects: toggle(f.subjects, l) })} />{l}</label>)}</div>{e('subjects') && <p role="alert" className="mt-2 text-sm text-danger-600">{e('subjects')}</p>}</fieldset></>
  if (slug === 'institution') body = <>
    <Field label="Registration type">{(id) => <Select id={id} value={f.regType} onChange={(x) => patch({ regType: x.target.value })} options={REG_TYPES} />}</Field>
    <Card className="bg-offwhite-50"><p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Masked preview</p><p className="mt-1 text-sm">{f.regType}: <Masked value={f.regLast4 ? `•••••• ${f.regLast4}` : '•••••• ••••'} /></p></Card>
    <Field label="Last 4 digits of the registration number" hint="We never ask for the full number here." error={e('regLast4')}>{(id) => <Input id={id} inputMode="numeric" maxLength={4} value={f.regLast4} onChange={(x) => patch({ regLast4: x.target.value.replace(/\D/g, '') })} aria-invalid={!!e('regLast4')} />}</Field>
    <Field label="Number of branches">{(id) => <Select id={id} value={f.branches} onChange={(x) => patch({ branches: x.target.value })} options={['1', '2', '3 or more']} />}</Field>
    <p className="text-xs text-gray-600"><DemoTag /> No registry or licence check is performed. Real validation needs a government-data integration.</p></>
  if (slug === 'documents') body = <>
    <p className="text-sm text-gray-600">Reviewers need proof that the organization exists and that you represent it. The premises photo is optional.</p>
    <DocPlaceholder label="Trade licence or registration certificate" file="licence-demo.pdf" uploaded={f.licenceFile} onToggle={() => patch({ licenceFile: !f.licenceFile })} />{e('licenceFile') && <p role="alert" className="text-sm text-danger-600">{e('licenceFile')}</p>}
    <DocPlaceholder label="Owner ID (front)" file="owner-id-demo.jpg" uploaded={f.ownerIdFile} onToggle={() => patch({ ownerIdFile: !f.ownerIdFile })} />{e('ownerIdFile') && <p role="alert" className="text-sm text-danger-600">{e('ownerIdFile')}</p>}
    <DocPlaceholder label="Premises photo (optional)" file="premises-demo.jpg" uploaded={f.premisesFile} onToggle={() => patch({ premisesFile: !f.premisesFile })} /></>
  if (slug === 'contact') body = <>
    <section className="space-y-3"><h2 className="text-base">Email</h2>{e('email') && <p role="alert" className="text-sm text-danger-600">{e('email')}</p>}
      {cv.emailOk ? <div className="flex flex-wrap items-center gap-3"><p className="min-w-0 flex-1 text-sm"><Masked value={maskEmail(emailRaw)} /></p><Chip tone="green" icon={<CheckCircle2 size={12} aria-hidden />}>Verified</Chip></div> : <>
        <Field label="Organization email" error={touched && !validEmail(emailRaw) ? 'Enter a valid email.' : ''}>{(id) => <Input id={id} type="email" value={f.email || s.signup.email} onChange={(x) => patch({ email: x.target.value })} placeholder="office@yourcentre.com" />}</Field>
        <OtpInput value={ecode} onChange={(v) => { setEcode(v); setEwrong(false) }} error={ewrong} />{ewrong && <p role="alert" className="text-sm text-danger-600">That code is not correct.</p>}
        <div className="flex flex-wrap items-center gap-3"><Button onClick={() => (!validEmail(emailRaw) ? setTouched(true) : ecode === DEMO_OTP_RESENT ? s.setCV(() => ({ emailOk: true })) : (setEwrong(true), setEcode('')))}>Verify email code</Button><span className="flex items-center gap-2 text-xs"><DemoTag /> Demo code: <b className="tabular">{DEMO_OTP_RESENT}</b></span></div></>}</section>
    <section className="space-y-3 border-t border-gray-100 pt-5"><h2 className="text-base">Phone</h2>{e('phone') && <p role="alert" className="text-sm text-danger-600">{e('phone')}</p>}
      {cv.phoneOk ? <div className="flex flex-wrap items-center gap-3"><p className="min-w-0 flex-1 text-sm"><Masked value={maskPhone(phoneRaw)} /></p><Chip tone="green" icon={<CheckCircle2 size={12} aria-hidden />}>Verified</Chip></div> : <>
        <Field label="Organization phone" error={touched && !validPhone(phoneRaw) ? 'Enter a valid Bangladesh mobile number.' : ''}>{(id) => <PhoneInput id={id} value={f.phone || s.signup.phone} onChange={(v) => patch({ phone: v })} />}</Field>
        {!sent ? <Button variant="secondary" onClick={() => (validPhone(phoneRaw) ? setSent(true) : setTouched(true))}>Send code</Button> : <>
          <p className="text-sm text-gray-600">We will confirm <Masked value={maskPhone(phoneRaw)} />.</p>
          <OtpInput value={code} onChange={(v) => { setCode(v); setWrong(false) }} error={wrong} />{wrong && <p role="alert" className="text-sm text-danger-600">That code is not correct.</p>}
          <div className="flex flex-wrap items-center gap-3"><Button onClick={() => (code === DEMO_OTP_FIRST ? s.setCV(() => ({ phoneOk: true })) : (setWrong(true), setCode('')))}>Verify phone code</Button><span className="flex items-center gap-2 text-xs"><DemoTag /> Demo code: <b className="tabular">{DEMO_OTP_FIRST}</b></span></div></>}</>}</section>
    <p className="text-xs text-gray-600"><DemoTag /> No SMS or email is sent. These codes stand in for a real OTP service.</p></>
  if (slug === 'review') return <Review />

  return (
    <div>
      <PageHead title={cur.title} tag={cur.id} sub={cur.hint} crumb={idx > 0 ? { to: href(STEPS[idx - 1].path), label: STEPS[idx - 1].title } : undefined} actions={<StatusChip state={s.verification.coaching} />} />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          <p className="mb-2 text-xs font-semibold text-gray-600">Step {idx + 1} of {STEPS.length}</p>
          <div className="mb-5 flex gap-1" aria-hidden>{STEPS.map((x, i) => <span key={x.slug} className={cx('h-1.5 flex-1 rounded-full', done(x.slug) ? 'bg-teal-600' : i === idx ? 'bg-blue-600' : 'bg-gray-200')} />)}</div>
          <Card className="space-y-5">{body}</Card>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {idx > 0 && <Link to={href(STEPS[idx - 1].path)} className={btnClass('secondary')}>Back</Link>}
            <Button className="ml-auto" onClick={go}>Save and continue</Button>
          </div>
          {touched && bad && <p role="alert" className="mt-3 text-sm text-danger-600">Fix the highlighted fields to continue.</p>}
        </div>
        <Checklist current={slug} />
      </div>
    </div>
  )
}

function Review() {
  const { s, done } = useDone(); const nav = useNavigate(); const f = s.cv.form
  const [touched, setTouched] = useState(false)
  const missing = STEPS.filter((x) => x.slug !== 'review' && !done(x.slug))
  const row = (l: string, v: ReactNode, to: string) => <div className="flex flex-wrap items-start justify-between gap-2 py-3 text-sm"><dt className="text-gray-600">{l}</dt><dd className="flex items-center gap-3 text-right font-semibold text-navy-900">{v}<Link to={href(to)} className="text-xs font-semibold text-blue-600 hover:underline">Edit</Link></dd></div>
  const go = () => { setTouched(true); if (missing.length || !f.consent) return; s.setCV((x) => ({ cv: { ...x.cv, review: true } })); nav(`${B}/submit`) }
  return (
    <div>
      <PageHead title="Review your details" tag="CV-06" sub="Check everything before you submit. Sensitive values stay masked." crumb={{ to: href('contact'), label: 'Phone and email' }} actions={<StatusChip state={s.verification.coaching} />} />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <Card><dl className="divide-y divide-gray-100">
            {row('Organization', f.orgName || 'Not entered', '')}{row('Owner', `${f.ownerName || 'Not entered'} · ${f.ownerRole}`, '')}{row('Type', f.orgType, '')}
            {row('Area', `${f.area}, ${f.district}`, 'organization')}{row('Established', f.established || 'Not entered', 'organization')}{row('Students', f.band, 'organization')}
            {row('Subjects', f.subjects.join(', ') || 'None', 'organization')}
            {row(f.regType, <Masked value={f.regLast4 ? `•••••• ${f.regLast4}` : '•••••• ••••'} />, 'institution')}
            {row('Documents', <span>{[f.licenceFile && 'Licence', f.ownerIdFile && 'Owner ID', f.premisesFile && 'Premises'].filter(Boolean).join(', ') || 'None'} <DemoTag label="Placeholder" /></span>, 'documents')}
            {row('Email', <Masked value={maskEmail(f.email || 'scholars@demo.tuitionhub.test')} />, 'contact')}{row('Phone', <Masked value={maskPhone(normalizePhone(f.phone || '01712345678'))} />, 'contact')}
          </dl></Card>
          <Card><p className="text-sm font-semibold text-navy-900">Before you continue</p>
            <ul className="mt-2 space-y-1 text-sm">{STEPS.filter((x) => x.slug !== 'review').map((x) => <li key={x.slug} className="flex items-center gap-2">{done(x.slug) ? <CheckCircle2 size={16} className="text-emerald-600" aria-label="Done" /> : <AlertTriangle size={16} className="text-warning-600" aria-label="Missing" />}<Link to={href(x.path)} className={done(x.slug) ? 'text-gray-600' : 'font-semibold text-navy-900 hover:underline'}>{x.title}</Link></li>)}</ul>
            <label className="mt-4 flex items-start gap-2 text-sm"><input type="checkbox" checked={f.consent} onChange={(x) => s.setCV((p) => ({ form: { ...p.form, consent: x.target.checked } }))} className="mt-1 h-4 w-4" /><span>I confirm these details describe my organization and I may represent it.</span></label>
            {touched && !f.consent && <p role="alert" className="mt-2 text-sm text-danger-600">Please confirm to continue.</p>}
            {touched && missing.length > 0 && <p role="alert" className="mt-2 text-sm text-danger-600">Complete every step first: {missing.map((m) => m.title).join(', ')}.</p>}</Card>
          <div className="flex flex-wrap items-center gap-3"><Link to={href('contact')} className={btnClass('secondary')}>Back</Link><Button className="ml-auto" onClick={go}>Continue to submit</Button></div>
        </div>
        <Checklist current="review" />
      </div>
    </div>
  )
}

function Submit() {
  const { s, done } = useDone(); const nav = useNavigate(); const f = s.cv.form; const vs = s.verification.coaching
  const [touched, setTouched] = useState(false)
  const ready = STEPS.every((x) => x.slug === 'review' ? s.cv.cv.review : done(x.slug))
  const already = ['pending', 'under_review', 'verified'].includes(vs)
  const submit = () => {
    setTouched(true); if (!ready || !f.declare) return
    s.setVerification('coaching', 'pending'); s.setCV(() => ({ submittedOnce: true })); s.toast('Submitted for review', 'success'); nav(`${B}/status`)
  }
  return (
    <div className="mx-auto max-w-2xl">
      <PageHead title="Submit for review" tag="CV-07" crumb={{ to: href('review'), label: 'Review your details' }} sub="A reviewer checks your documents, usually within 2 working days." actions={<StatusChip state={vs} />} />
      {already ? <Card className="text-center"><p className="font-semibold text-navy-900">Already submitted.</p><Link to={`${B}/status`} className={cx(btnClass('primary'), 'mt-4')}>View status</Link></Card> : (
        <Card className="space-y-4">
          {!ready && <p role="alert" className="flex items-start gap-2 rounded-input bg-warning-100 p-3 text-sm"><AlertTriangle size={18} className="mt-0.5 shrink-0 text-warning-600" aria-hidden />Finish and review every step first. <Link to={B} className="inline-flex min-h-11 items-center font-semibold text-blue-600 hover:underline">Open the checklist</Link></p>}
          <ul className="space-y-2 text-sm text-gray-600"><li>Your registration number stays masked. Only reviewers see documents.</li><li>While under review you can browse, but adding students and sending reports stay locked.</li><li>Parents only see linked students. Contact details stay masked.</li></ul>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={f.declare} onChange={(x) => s.setCV((p) => ({ form: { ...p.form, declare: x.target.checked } }))} className="mt-1 h-4 w-4" /><span>I declare the information is true and I accept the TuitionHub organization policy.</span></label>
          {touched && !f.declare && <p role="alert" className="text-sm text-danger-600">Please accept the declaration to submit.</p>}
          <p className="flex items-center gap-2 text-xs text-gray-600"><DemoTag /> Nothing leaves this browser. Review is simulated.</p>
          <div className="flex flex-wrap items-center gap-3"><Link to={href('review')} className={btnClass('secondary')}>Back</Link><Button className="ml-auto" onClick={submit}>Submit for review</Button></div>
        </Card>)}
    </div>
  )
}

function Status() {
  const s = useStore(); const nav = useNavigate(); const vs = s.verification.coaching; const cv = s.cv
  const set = (v: Parameters<typeof s.setVerification>[1], note = '') => { s.setVerification('coaching', v); s.setCV(() => ({ note })); s.toast(`Demo: ${v.replace('_', ' ')}`, 'info') }
  if (vs === 'not_started' || vs === 'draft') return (
    <div className="mx-auto max-w-lg"><PageHead title="Verification status" tag="CV-08" crumb={{ to: B, label: 'Organization registration' }} actions={<StatusChip state={vs} />} />
      <Card className="text-center"><Clock className="mx-auto text-gray-400" aria-hidden /><h2 className="mt-3 text-xl">Nothing submitted yet</h2><p className="mt-1 text-sm text-gray-600">Finish the checklist and submit to start the review.</p><Link to={B} className={cx(btnClass('primary'), 'mt-4')}>Continue verification</Link></Card></div>
  )
  const tag = vs === 'verified' ? 'CV-09' : vs === 'rejected' ? 'CV-10' : vs === 'action_required' ? 'CV-11' : 'CV-08'
  return (
    <div className="mx-auto max-w-2xl">
      <PageHead title={vs === 'verified' ? 'Verified Organization' : vs === 'rejected' ? 'Verification was not approved' : vs === 'action_required' ? 'We need one more thing' : 'Verification status'} tag={tag} crumb={{ to: B, label: 'Organization registration' }} actions={<StatusChip state={vs} />} />
      {(vs === 'pending' || vs === 'under_review') && <Card>
        <ol className="space-y-4">{[['Submitted', true], ['Documents checked', vs === 'under_review'], ['Decision', false]].map(([l, d], i) => <li key={String(l)} className="flex items-center gap-3 text-sm">{d ? <CheckCircle2 size={20} className="text-emerald-600" aria-label="Done" /> : <Clock size={20} className={i === 1 || (i === 2 && vs === 'under_review') ? 'text-navy-700' : 'text-gray-400'} aria-label="Waiting" />}<span className={d ? 'text-navy-900' : 'text-gray-600'}>{String(l)}</span></li>)}</ol>
        <p className="mt-4 text-sm text-gray-600">Reviews usually take 1 to 2 working days. You can look around meanwhile. Adding students and sending parent reports unlock after approval.</p>
        <Link to="/app/coaching/dashboard" className="mt-3 inline-block text-sm font-semibold text-blue-600 hover:underline">Open the dashboard</Link></Card>}
      {vs === 'verified' && <Card className="text-center"><PartyPopper size={36} className="mx-auto text-teal-700" aria-hidden /><div className="mt-3 flex justify-center"><VerifyBadge kind="organization" /></div><h2 className="mt-3 text-xl">{cv.form.orgName || ORG.name} is verified</h2><p className="mx-auto mt-1 max-w-sm text-sm text-gray-600">Your public profile shows the Verified Organization badge. You can add teachers, students and batches and send parent reports.</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2"><Link to="/app/coaching/dashboard" className={btnClass('primary')}>Go to dashboard</Link><Link to="/app/coaching/profile" className={btnClass('secondary')}>View profile</Link></div></Card>}
      {vs === 'rejected' && <Card><p className="flex items-start gap-2 text-sm"><XCircle size={18} className="mt-0.5 shrink-0 text-danger-600" aria-hidden /><span><b className="text-navy-900">Reason:</b> {cv.note || 'The trade licence photo did not match the organization name you entered.'}</span></p>
        <p className="mt-3 text-sm text-gray-600">Nothing is lost. Correct the details and send them again. You can resubmit as many times as you need.</p>
        <div className="mt-4 flex flex-wrap gap-2"><Button onClick={() => nav(href('institution'))}>Fix details</Button><Button variant="secondary" onClick={() => { s.setVerification('coaching', 'pending'); s.toast('Resubmitted for review', 'success') }}>Resubmit as is</Button></div></Card>}
      {vs === 'action_required' && <Card><p className="flex items-start gap-2 text-sm"><AlertTriangle size={18} className="mt-0.5 shrink-0 text-warning-600" aria-hidden /><span><b className="text-navy-900">Needed:</b> {cv.note || 'The licence copy is hard to read. Please add a clearer copy.'}</span></p>
        <div className="mt-4 flex flex-wrap gap-2"><Button onClick={() => nav(href('documents'))}>Replace documents</Button><Button variant="secondary" onClick={() => { s.setVerification('coaching', 'pending'); s.toast('Sent back for review', 'success') }}>Send back for review</Button></div></Card>}
      <Card className="mt-6 border-dashed bg-offwhite-50"><h2 className="flex items-center gap-2 text-base"><DemoTag label="Demo reviewer" /> Simulate the reviewer</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" disabled={vs !== 'pending'} onClick={() => set('under_review')}>Start review</Button>
          <Button size="sm" disabled={vs === 'verified'} onClick={() => set('verified')}>Simulate approval</Button>
          <Button size="sm" variant="destructive" disabled={vs === 'rejected'} onClick={() => set('rejected', 'The trade licence photo did not match the organization name you entered.')}>Simulate rejection</Button>
          <Button size="sm" variant="secondary" disabled={vs === 'action_required'} onClick={() => set('action_required', 'The licence copy is hard to read. Please add a clearer copy.')}>Simulate: action required</Button></div>
        <p className="mt-2 flex items-center gap-2 text-xs text-gray-600"><ShieldCheck size={14} aria-hidden /> No real reviewer exists. These buttons stand in for the decision.</p></Card>
    </div>
  )
}
