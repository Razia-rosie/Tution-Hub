import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { AlertTriangle, CheckCircle2, Circle, Clock, PartyPopper, ShieldCheck, XCircle } from 'lucide-react'
import { useStore } from '../../lib/store'
import { DEMO_OTP_FIRST, maskPhone } from '../../lib/validate'
import { RELATIONS } from '../../lib/parent'
import { Button, Card, Chip, DemoTag, Field, Input, OtpInput, Select, StatusChip, cx } from '../../components/ui'
import { DocPlaceholder, Masked, PageHead } from '../../components/tutor/bits'
import { LinkChip, LinkForm } from './Children'

export const B = '/app/parent/settings/verification'
const STEPS = [
  { slug: 'details', id: 'PV-02', title: 'Your details', hint: 'Name, date of birth, relationship' },
  { slug: 'nid', id: 'PV-03', title: 'National ID (demo)', hint: 'Last 4 digits and a placeholder photo' },
  { slug: 'phone', id: 'PV-04', title: 'Phone number', hint: 'Confirm with a one-time code' },
  { slug: 'identity', id: 'PV-05', title: 'Identity check', hint: 'Placeholder selfie and consent' },
  { slug: 'guardian', id: 'PV-06', title: 'Guardian proof', hint: 'Shows you are the parent or guardian' },
  { slug: 'link', id: 'PV-07', title: 'Link your child', hint: 'Student ID and birth year' },
  { slug: 'confirm', id: 'PV-08', title: 'Relationship confirmation', hint: 'Your child confirms the link, then you submit' },
] as const
const DISTRICTS = ['Dhaka', 'Chattogram', 'Sylhet', 'Rajshahi', 'Khulna', 'Gazipur']

export default function Verification({ sub }: { sub: string }) {
  const a = sub.split('/').filter(Boolean)[0]
  if (!a) return <Overview />
  if (a === 'status') return <Status />
  return <Step slug={a} />
}

function useDone() {
  const s = useStore(); const pj = s.pj
  const done = (slug: string) => slug === 'phone' ? pj.phoneOk || s.signup.phoneVerified : slug === 'link' ? pj.kids.length > 0 : slug === 'confirm' ? pj.kids.some((k) => k.link === 'confirmed') : !!pj.pv[slug]
  return { s, done }
}

function Overview() {
  const { s, done } = useDone(); const vs = s.verification.parent
  const submitted = ['pending', 'under_review', 'verified', 'rejected', 'action_required'].includes(vs)
  const n = STEPS.filter((x) => done(x.slug)).length
  const next = STEPS.find((x) => !done(x.slug))
  return (
    <div>
      <PageHead title="Parent verification" tag="PV-01" crumb={{ to: '/app/parent/settings', label: 'Profile & Settings' }} sub="Verified parents can post tuition, send interest and chat. It protects your child and the tutors." actions={<StatusChip state={vs} />} />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card pad={false}>
          <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 p-5">
            <div><p className="font-heading text-lg font-bold text-navy-900">{submitted ? 'Submitted for review' : `${n} of ${STEPS.length} steps complete`}</p><p className="text-sm text-gray-600">{submitted ? 'Open the status page to follow the review.' : 'Save as you go. You can leave and come back.'}</p></div>
            <div className="ml-auto">{submitted ? <Link to={`${B}/status`} className="rounded-input bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">View status</Link>
              : <Link to={`${B}/${next ? next.slug : 'confirm'}`} className="rounded-input bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">{n === 0 ? 'Start verification' : next ? 'Continue' : 'Review and submit'}</Link>}</div>
          </div>
          <div className="px-5 pt-4"><div className="h-2 rounded-full bg-gray-100"><div className="h-2 rounded-full bg-teal-600 transition-all" style={{ width: `${submitted ? 100 : (n / STEPS.length) * 100}%` }} /></div></div>
          <ol className="divide-y divide-gray-100 p-2">
            {STEPS.map((x) => (
              <li key={x.slug}><Link to={`${B}/${x.slug}`} className="flex items-center gap-3 rounded-input px-3 py-3 hover:bg-gray-100">
                {done(x.slug) ? <CheckCircle2 size={20} className="text-emerald-600" aria-label="Done" /> : <Circle size={20} className="text-gray-400" aria-label="To do" />}
                <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-navy-900">{x.title}</span><span className="block text-xs text-gray-600">{x.hint}</span></span>
                <span className="tabular text-xs text-gray-400">{x.id}</span></Link></li>
            ))}
          </ol>
        </Card>
        <Card><h2 className="flex items-center gap-2 text-base"><ShieldCheck size={16} className="text-teal-700" aria-hidden /> What we protect</h2>
          <ul className="mt-3 space-y-2 text-sm text-gray-600"><li>Your NID is never shown. Only the last 4 digits are kept, masked.</li><li>Documents are seen by reviewers only.</li><li>Your child confirms the link before you see anything.</li><li>Tutors never see your exact address or full phone number.</li></ul>
          <p className="mt-3 flex items-center gap-2 text-xs text-gray-600"><DemoTag /> No real NID or government check happens in this prototype.</p></Card>
      </div>
    </div>
  )
}

function Step({ slug }: { slug: string }) {
  const { s, done } = useDone(); const nav = useNavigate(); const pj = s.pj; const f = pj.form
  const idx = STEPS.findIndex((x) => x.slug === slug)
  const [touched, setTouched] = useState(false)
  const [code, setCode] = useState(''); const [wrong, setWrong] = useState(false)
  if (idx < 0) return <Card className="text-center"><p className="font-semibold text-navy-900">That verification step does not exist.</p><Link to={B} className="mt-2 inline-block text-sm font-semibold text-blue-600 hover:underline">Back to the checklist</Link></Card>
  const cur = STEPS[idx]
  const patch = (p: Partial<typeof f>) => s.setPJ((x) => ({ form: { ...x.form, ...p } }))
  const err = ((): Record<string, string> => {
    if (slug === 'details') return { fullName: f.fullName.trim().split(/\s+/).length < 2 ? 'Enter your full name as on your ID (first and last).' : '', dob: !f.dob ? 'Enter your date of birth.' : new Date(f.dob) > new Date('2005-10-13') ? 'Guardians must be at least 21 years old.' : '' }
    if (slug === 'nid') return { nidLast4: !/^\d{4}$/.test(f.nidLast4) ? 'Enter the last 4 digits only.' : '', nidFile: !f.nidFile ? 'Add the placeholder ID photo to continue.' : '' }
    if (slug === 'phone') return { phone: done('phone') ? '' : 'Confirm your phone with the code.' }
    if (slug === 'identity') return { selfie: !f.selfie ? 'Add the placeholder selfie to continue.' : '', consent: !f.consent ? 'Please give your consent to continue.' : '' }
    if (slug === 'guardian') return { guardFile: !f.guardFile ? 'Add the placeholder proof to continue.' : '' }
    return {}
  })()
  const bad = Object.values(err).some(Boolean)
  const e = (k: string) => (touched ? err[k] : '')
  const mark = () => { s.setPJ((x) => ({ pv: { ...x.pv, [slug]: true } })); if (s.verification.parent === 'not_started') s.setVerification('parent', 'draft') }
  const go = () => { setTouched(true); if (bad) return; mark(); nav(`${B}/${STEPS[idx + 1]?.slug ?? 'confirm'}`) }
  const phoneRaw = s.signup.phone || '1712345678'
  let body: ReactNode = null
  if (slug === 'details') body = <>
    <Field label="Full name (as on your ID)" error={e('fullName')}>{(id) => <Input id={id} value={f.fullName} onChange={(x) => patch({ fullName: x.target.value })} placeholder="Farzana Islam" aria-invalid={!!e('fullName')} />}</Field>
    <Field label="Date of birth" error={e('dob')}>{(id) => <Input id={id} type="date" value={f.dob} onChange={(x) => patch({ dob: x.target.value })} aria-invalid={!!e('dob')} />}</Field>
    <Field label="Relationship to your child">{(id) => <Select id={id} value={f.relation} onChange={(x) => patch({ relation: x.target.value })} options={RELATIONS} />}</Field>
    <Field label="District" hint="Only the district is stored. Never your street address.">{(id) => <Select id={id} value={f.district} onChange={(x) => patch({ district: x.target.value })} options={DISTRICTS} />}</Field></>
  if (slug === 'nid') body = <>
    <Card className="bg-offwhite-50"><p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Masked preview</p><p className="mt-1 text-sm">NID number: <Masked value={f.nidLast4 ? `•••• ••• ••• ${f.nidLast4}` : '•••• ••• ••• ••••'} /></p><p className="mt-1 text-xs text-gray-600">Only reviewers can see the document. It is never public.</p></Card>
    <Field label="Last 4 digits of your NID" hint="We never ask you to type the full number here." error={e('nidLast4')}>{(id) => <Input id={id} inputMode="numeric" maxLength={4} value={f.nidLast4} onChange={(x) => patch({ nidLast4: x.target.value.replace(/\D/g, '') })} aria-invalid={!!e('nidLast4')} />}</Field>
    <DocPlaceholder label="NID photo (front)" file="nid-front-demo.jpg" uploaded={f.nidFile} onToggle={() => patch({ nidFile: !f.nidFile })} />{e('nidFile') && <p role="alert" className="text-sm text-danger-600">{e('nidFile')}</p>}
    <p className="text-xs text-gray-600"><DemoTag /> No NID check is performed. Real validation needs a government-data integration.</p></>
  if (slug === 'phone') body = done('phone')
    ? <div className="flex flex-wrap items-center gap-3"><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-navy-900">Phone verified</p><p className="text-sm text-gray-600"><Masked value={maskPhone(phoneRaw)} /></p></div><Chip tone="green" icon={<CheckCircle2 size={12} aria-hidden />}>Verified</Chip></div>
    : <div className="space-y-4"><p className="text-sm text-gray-600">We will confirm <Masked value={maskPhone(phoneRaw)} />.</p>
      <OtpInput value={code} onChange={(v) => { setCode(v); setWrong(false) }} error={wrong} />{wrong && <p role="alert" className="text-sm text-danger-600">That code is not correct.</p>}
      <div className="flex flex-wrap items-center gap-3"><Button onClick={() => (code === DEMO_OTP_FIRST ? s.setPJ(() => ({ phoneOk: true })) : (setWrong(true), setCode('')))}>Verify code</Button><span className="flex items-center gap-2 text-xs"><DemoTag /> Demo code: <b className="tabular">{DEMO_OTP_FIRST}</b></span></div></div>
  if (slug === 'identity') body = <>
    <p className="text-sm text-gray-600">A reviewer compares a selfie with your ID photo. Nothing is stored in this prototype.</p>
    <DocPlaceholder label="Selfie" file="selfie-demo.jpg" uploaded={f.selfie} onToggle={() => patch({ selfie: !f.selfie })} />{e('selfie') && <p role="alert" className="text-sm text-danger-600">{e('selfie')}</p>}
    <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={f.consent} onChange={(x) => patch({ consent: x.target.checked })} className="mt-1 h-4 w-4" /><span>I agree that TuitionHub reviewers may compare my selfie and ID for verification only.</span></label>{e('consent') && <p role="alert" className="text-sm text-danger-600">{e('consent')}</p>}</>
  if (slug === 'guardian') body = <>
    <p className="text-sm text-gray-600">Add one document that links you to your child, for example a birth certificate or a school admission form listing you as guardian.</p>
    <DocPlaceholder label="Guardian proof" file="guardian-proof-demo.pdf" uploaded={f.guardFile} onToggle={() => patch({ guardFile: !f.guardFile })} />{e('guardFile') && <p role="alert" className="text-sm text-danger-600">{e('guardFile')}</p>}</>
  if (slug === 'link') body = <>
    <p className="text-sm text-gray-600">Link at least one child. You can add more later from Children.</p>
    {pj.kids.length > 0 && <ul className="space-y-2">{pj.kids.map((k) => <li key={k.id} className="flex items-center justify-between gap-2 rounded-input bg-offwhite-50 p-3 text-sm"><span><b className="text-navy-900">{k.name}</b> · {k.cls}</span><LinkChip k={k} /></li>)}</ul>}
    <LinkForm /></>
  if (slug === 'confirm') return <Confirm />
  return (
    <div className="mx-auto max-w-2xl">
      <PageHead title={cur.title} tag={cur.id} crumb={{ to: B, label: 'Parent verification' }} sub={cur.hint} />
      <p className="mb-2 text-xs font-semibold text-gray-600">Step {idx + 1} of {STEPS.length}</p>
      <div className="mb-5 flex gap-1" aria-hidden>{STEPS.map((x, i) => <span key={x.slug} className={cx('h-1.5 flex-1 rounded-full', done(x.slug) ? 'bg-teal-600' : i === idx ? 'bg-blue-600' : 'bg-gray-200')} />)}</div>
      <Card className="space-y-5">{body}</Card>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Link to={idx > 0 ? `${B}/${STEPS[idx - 1].slug}` : B} className="rounded-input border border-gray-400 px-4 py-2.5 text-sm font-semibold text-navy-900 hover:bg-gray-100">{idx > 0 ? 'Back' : 'Checklist'}</Link>
        {slug === 'link' ? <Button className="ml-auto" onClick={() => (pj.kids.length ? nav(`${B}/confirm`) : setTouched(true))}>Continue</Button> : <Button className="ml-auto" onClick={go}>Save and continue</Button>}
      </div>
      {slug === 'link' && touched && !pj.kids.length && <p role="alert" className="mt-3 text-sm text-danger-600">Link at least one child to continue.</p>}
      {touched && bad && <p role="alert" className="mt-3 text-sm text-danger-600">Fix the highlighted fields to continue.</p>}
    </div>
  )
}

function Confirm() {
  const { s, done } = useDone(); const nav = useNavigate(); const pj = s.pj
  const [touched, setTouched] = useState(false)
  const missing = STEPS.filter((x) => x.slug !== 'confirm' && !done(x.slug))
  const ready = missing.length === 0 && done('confirm')
  const submit = () => {
    setTouched(true); if (!ready) return
    s.setVerification('parent', 'pending'); s.setPJ((p) => ({ submittedOnce: true, pv: { ...p.pv, confirm: true } })); s.toast('Submitted for review', 'success'); nav(`${B}/status`)
  }
  return (
    <div className="mx-auto max-w-2xl">
      <PageHead title="Relationship confirmation" tag="PV-08" crumb={{ to: B, label: 'Parent verification' }} sub="Your child confirms they know you. Then you can send everything for review." />
      <Card className="space-y-4">
        {pj.kids.length === 0 ? <p className="text-sm text-gray-600">No child linked yet. <Link to={`${B}/link`} className="font-semibold text-blue-600 hover:underline">Link your child</Link></p> : (
          <ul className="space-y-3">{pj.kids.map((k) => (
            <li key={k.id} className="rounded-input border border-gray-200 p-3 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><span><b className="text-navy-900">{k.name}</b> · {k.cls}</span><LinkChip k={k} /></div>
              {k.link === 'requested' && <div className="mt-2 flex flex-wrap items-center gap-2 text-gray-600"><span>We asked {k.short} to confirm.</span><DemoTag label="Demo" /><Button size="sm" variant="secondary" onClick={() => { s.setPJ((p) => ({ kids: p.kids.map((x) => (x.id === k.id ? { ...x, link: 'confirmed' } : x)), log: [...p.log, `${k.short} confirmed the link`] })); s.toast(`Demo: ${k.short} confirmed the link`, 'success') }}>Simulate: child confirms</Button></div>}</li>
          ))}</ul>)}
        <div className="border-t border-gray-100 pt-4"><p className="text-sm font-semibold text-navy-900">Before you submit</p>
          <ul className="mt-2 space-y-1 text-sm">{STEPS.filter((x) => x.slug !== 'confirm').map((x) => <li key={x.slug} className="flex items-center gap-2">{done(x.slug) ? <CheckCircle2 size={16} className="text-emerald-600" aria-label="Done" /> : <AlertTriangle size={16} className="text-warning-600" aria-label="Missing" />}<span className={done(x.slug) ? 'text-gray-600' : 'text-navy-900'}>{x.title}</span>{!done(x.slug) && <Link to={`${B}/${x.slug}`} className="ml-auto font-semibold text-blue-600 hover:underline">Complete</Link>}</li>)}
            <li className="flex items-center gap-2">{done('confirm') ? <CheckCircle2 size={16} className="text-emerald-600" aria-label="Done" /> : <AlertTriangle size={16} className="text-warning-600" aria-label="Missing" />}<span className={done('confirm') ? 'text-gray-600' : 'text-navy-900'}>At least one child has confirmed</span></li></ul></div>
      </Card>
      <div className="mt-5 flex flex-wrap items-center gap-3"><Link to={`${B}/link`} className="rounded-input border border-gray-400 px-4 py-2.5 text-sm font-semibold text-navy-900 hover:bg-gray-100">Back</Link><Button className="ml-auto" onClick={submit}>Submit for review</Button></div>
      {touched && !ready && <p role="alert" className="mt-3 text-sm text-danger-600">Complete every step and get one child confirmed first.</p>}
    </div>
  )
}

function Status() {
  const s = useStore(); const nav = useNavigate(); const vs = s.verification.parent; const pj = s.pj
  const set = (v: Parameters<typeof s.setVerification>[1], note = '') => { s.setVerification('parent', v); s.setPJ(() => ({ note })); s.toast(`Demo: ${v.replace('_', ' ')}`, 'info') }
  if (vs === 'not_started' || vs === 'draft') return (
    <div className="mx-auto max-w-lg"><PageHead title="Verification status" tag="PV-09" crumb={{ to: B, label: 'Parent verification' }} actions={<StatusChip state={vs} />} />
      <Card className="text-center"><Clock className="mx-auto text-gray-400" aria-hidden /><h2 className="mt-3 text-xl">Nothing submitted yet</h2><p className="mt-1 text-sm text-gray-600">Finish the checklist and submit to start the review.</p><Link to={B} className="mt-4 inline-block rounded-input bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">Open checklist</Link></Card></div>
  )
  const tag = vs === 'verified' ? 'PV-10' : vs === 'rejected' || vs === 'action_required' ? 'PV-11' : 'PV-09'
  return (
    <div className="mx-auto max-w-2xl">
      <PageHead title={vs === 'verified' ? 'You are verified' : vs === 'rejected' ? 'Verification was not approved' : vs === 'action_required' ? 'We need one more thing' : 'Verification status'} tag={tag} crumb={{ to: B, label: 'Parent verification' }} actions={<StatusChip state={vs} />} />
      {(vs === 'pending' || vs === 'under_review') && <Card>
        <ol className="space-y-4">{[['Submitted', true], ['Documents checked', vs === 'under_review'], ['Decision', false]].map(([l, d], i) => <li key={String(l)} className="flex items-center gap-3 text-sm">{d ? <CheckCircle2 size={20} className="text-emerald-600" aria-label="Done" /> : <Clock size={20} className={i === 1 || (i === 2 && vs === 'under_review') ? 'text-blue-600' : 'text-gray-400'} aria-label="Waiting" />}<span className={d ? 'font-semibold text-navy-900' : 'text-gray-600'}>{String(l)}</span></li>)}</ol>
        <p className="mt-4 text-sm text-gray-600">Reviews usually take 1 to 2 working days. You can browse tutors meanwhile. Posting and chat unlock after approval.</p></Card>}
      {vs === 'verified' && <Card className="text-center"><PartyPopper size={36} className="mx-auto text-teal-700" aria-hidden /><h2 className="mt-3 text-xl">Welcome, {pj.form.fullName.split(' ')[0] || 'Farzana'}</h2><p className="mx-auto mt-1 max-w-sm text-sm text-gray-600">You can now post a tuition, send interest and chat with tutors.</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2"><Link to="/app/parent/dashboard" className="rounded-input bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">Go to dashboard</Link><Link to="/app/parent/children" className="rounded-input border border-gray-400 px-4 py-2.5 text-sm font-semibold text-navy-900 hover:bg-gray-100">My children</Link></div></Card>}
      {vs === 'rejected' && <Card><p className="flex items-start gap-2 text-sm"><XCircle size={18} className="mt-0.5 shrink-0 text-danger-600" aria-hidden /><span><b className="text-navy-900">Reason:</b> {pj.note || 'The name on the ID photo did not match the name you entered.'}</span></p>
        <p className="mt-3 text-sm text-gray-600">Nothing is lost. Correct the details and send them again. You can resubmit as many times as you need.</p>
        <div className="mt-4 flex flex-wrap gap-2"><Button onClick={() => nav(`${B}/details`)}>Fix details</Button><Button variant="secondary" onClick={() => { s.setVerification('parent', 'pending'); s.toast('Resubmitted for review', 'success') }}>Resubmit as is</Button></div></Card>}
      {vs === 'action_required' && <Card><p className="flex items-start gap-2 text-sm"><AlertTriangle size={18} className="mt-0.5 shrink-0 text-warning-600" aria-hidden /><span><b className="text-navy-900">Needed:</b> {pj.note || 'The guardian proof is hard to read. Please add a clearer copy.'}</span></p>
        <div className="mt-4 flex flex-wrap gap-2"><Button onClick={() => nav(`${B}/guardian`)}>Replace guardian proof</Button><Button variant="secondary" onClick={() => { s.setVerification('parent', 'pending'); s.toast('Sent back for review', 'success') }}>Send back for review</Button></div></Card>}
      <Card className="mt-6 border-dashed bg-offwhite-50"><h2 className="flex items-center gap-2 text-base"><DemoTag label="Demo reviewer" /> Simulate the reviewer</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" disabled={vs !== 'pending'} onClick={() => set('under_review')}>Start review</Button>
          <Button size="sm" disabled={vs === 'verified'} onClick={() => set('verified')}>Simulate approval</Button>
          <Button size="sm" variant="destructive" disabled={vs === 'rejected'} onClick={() => set('rejected', 'The name on the ID photo did not match the name you entered.')}>Simulate rejection</Button>
          <Button size="sm" variant="secondary" disabled={vs === 'action_required'} onClick={() => set('action_required', 'The guardian proof is hard to read. Please add a clearer copy.')}>Simulate: action required</Button></div>
        <p className="mt-2 text-xs text-gray-600">No real reviewer exists. These buttons stand in for the decision.</p></Card>
    </div>
  )
}
