import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { AlertTriangle, CheckCircle2, Circle, Clock, PartyPopper, ShieldCheck, XCircle } from 'lucide-react'
import { useStore } from '../../lib/store'
import { DEMO_OTP_FIRST, maskPhone } from '../../lib/validate'
import { BOARDS, GUARDIAN_RELATIONS, SCHOOLS, STUDENT, STUDENT_CLASSES, SV_STEPS, YEARS, ageOf, isMinor, maskGuardianPhone, sDone } from '../../lib/student'
import { Button, Card, Chip, DemoTag, Field, Input, OtpInput, Select, StatusChip, VerifyBadge, cx } from '../../components/ui'
import { DocPlaceholder, Masked, PageHead } from '../../components/tutor/bits'

export const B = '/app/student/profile/verification'
const DISTRICTS = ['Dhaka', 'Chattogram', 'Sylhet', 'Rajshahi', 'Khulna', 'Gazipur']
const linkBtn = 'rounded-input bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700'
const linkSec = 'rounded-input border border-gray-400 px-4 py-2.5 text-sm font-semibold text-navy-900 hover:bg-gray-100'

export default function StudentVerification({ sub }: { sub: string }) {
  const a = sub.split('/').filter(Boolean)[0]
  if (!a) return <Overview />
  if (a === 'status') return <Status />
  return <Step slug={a} />
}

function useDone() {
  const s = useStore(); const sj = s.sj
  return { s, sj, done: (slug: string) => sDone(sj, slug, s.signup.phoneVerified) }
}

function Overview() {
  const { s, done } = useDone(); const vs = s.verification.student
  const submitted = ['pending', 'under_review', 'verified', 'rejected', 'action_required'].includes(vs)
  const n = SV_STEPS.filter((x) => x.slug !== 'review' && done(x.slug)).length; const total = SV_STEPS.length - 1
  const next = SV_STEPS.find((x) => x.slug !== 'review' && !done(x.slug))
  return (
    <div>
      <PageHead title="Student verification" tag="SV-01" crumb={{ to: '/app/student/profile', label: 'Profile' }} sub="Verified students can send interest to tutors, chat and join a tuition. It keeps every learner on the platform a known person." actions={<StatusChip state={vs} />} />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card pad={false}>
          <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 p-5">
            <div><p className="font-heading text-lg font-bold text-navy-900">{submitted ? 'Submitted for review' : `${n} of ${total} steps complete`}</p><p className="text-sm text-gray-600">{submitted ? 'Open the status page to follow the review.' : 'Save as you go. You can leave and come back.'}</p></div>
            <div className="ml-auto">{submitted ? <Link to={`${B}/status`} className={linkBtn}>View status</Link> : <Link to={`${B}/${next ? next.slug : 'review'}`} className={linkBtn}>{n === 0 ? 'Start verification' : next ? 'Continue' : 'Review and submit'}</Link>}</div>
          </div>
          <div className="px-5 pt-4"><div className="h-2 rounded-full bg-gray-100"><div className="h-2 rounded-full bg-teal-600 transition-all" style={{ width: `${submitted ? 100 : (n / total) * 100}%` }} /></div></div>
          <ol className="divide-y divide-gray-100 p-2">
            {SV_STEPS.map((x) => { const d = x.slug !== 'review' && done(x.slug); return (
              <li key={x.slug}><Link to={`${B}/${x.slug}`} className="flex items-center gap-3 rounded-input px-3 py-3 hover:bg-gray-100">
                {d ? <CheckCircle2 size={20} className="text-emerald-600" aria-label="Done" /> : <Circle size={20} className="text-gray-400" aria-label="To do" />}
                <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-navy-900">{x.title}</span><span className="block text-xs text-gray-600">{x.hint}</span></span>
                <span className="tabular text-xs text-gray-400">{x.id}</span></Link></li>) })}
          </ol>
        </Card>
        <Card><h2 className="flex items-center gap-2 text-base"><ShieldCheck size={16} className="text-teal-700" aria-hidden /> What we protect</h2>
          <ul className="mt-3 space-y-2 text-sm text-gray-600"><li>Your student ID photo is seen by reviewers only, never by tutors.</li><li>Tutors see your first name and class, never your address or phone.</li><li>If you are under 18, a guardian must agree before you start a tuition.</li><li>You only ever see your own data.</li></ul>
          <p className="mt-3 flex items-center gap-2 text-xs text-gray-600"><DemoTag /> No real school or student ID check happens in this prototype.</p></Card>
      </div>
    </div>
  )
}

function Step({ slug }: { slug: string }) {
  const { s, sj, done } = useDone(); const nav = useNavigate(); const f = sj.form
  const idx = SV_STEPS.findIndex((x) => x.slug === slug)
  const [touched, setTouched] = useState(false); const [code, setCode] = useState(''); const [wrong, setWrong] = useState(false)
  if (idx < 0) return <Card className="text-center"><p className="font-semibold text-navy-900">That verification step does not exist.</p><Link to={B} className="mt-2 inline-block text-sm font-semibold text-blue-600 hover:underline">Back to the checklist</Link></Card>
  if (slug === 'review') return <Review />
  const cur = SV_STEPS[idx]; const minor = isMinor(f); const age = ageOf(f.dob)
  const patch = (p: Partial<typeof f>) => s.setSJ((x) => ({ form: { ...x.form, ...p } }))
  const err = ((): Record<string, string> => {
    if (slug === 'details') return { fullName: f.fullName.trim().split(/\s+/).length < 2 ? 'Enter your full name (first and last).' : '', dob: !f.dob ? 'Enter your date of birth.' : age === null || age < 10 || age > 25 ? 'Students on TuitionHub are between 10 and 25 years old.' : '' }
    if (slug === 'school') return { school: !f.school ? 'Choose your school or college.' : '' }
    if (slug === 'id') return { idLast4: !/^\d{4}$/.test(f.idLast4) ? 'Enter the last 4 digits of your student ID.' : '', idFile: !f.idFile ? 'Add the placeholder student ID photo to continue.' : '' }
    if (slug === 'class') return { cls: !f.cls ? 'Choose your class.' : '', year: !f.year ? 'Choose the academic year.' : '' }
    if (slug === 'phone') return { phone: done('phone') ? '' : 'Confirm your phone with the code.' }
    if (slug === 'consent') return { consent: minor && f.guardianName.trim().split(/\s+/).length < 2 && sj.consent === 'none' ? '' : '' }
    return {}
  })()
  const bad = Object.values(err).some(Boolean); const e = (k: string) => (touched ? err[k] : '')
  const mark = () => { s.setSJ((x) => ({ sv: { ...x.sv, [slug]: true } })); if (s.verification.student === 'not_started') s.setVerification('student', 'draft') }
  const go = () => { setTouched(true); if (bad) return; mark(); nav(`${B}/${SV_STEPS[idx + 1]?.slug ?? 'review'}`) }
  const phoneRaw = s.signup.phone || '1812345678'
  let body: ReactNode = null
  if (slug === 'details') body = <>
    <Field label="Full name" error={e('fullName')}>{(id) => <Input id={id} value={f.fullName} onChange={(x) => patch({ fullName: x.target.value })} placeholder="Nabila Chowdhury" aria-invalid={!!e('fullName')} />}</Field>
    <Field label="Date of birth" hint={`Demo: Nabila was born on 12 March 2010.${age !== null ? ` You are ${age}.` : ''}`} error={e('dob')}>{(id) => <Input id={id} type="date" value={f.dob} onChange={(x) => patch({ dob: x.target.value })} aria-invalid={!!e('dob')} />}</Field>
    <Field label="Gender (optional)">{(id) => <Select id={id} value={f.gender} onChange={(x) => patch({ gender: x.target.value })} options={['Female', 'Male', 'Prefer not to say']} />}</Field>
    <Field label="District" hint="Only the district is stored. Never your street address.">{(id) => <Select id={id} value={f.district} onChange={(x) => patch({ district: x.target.value })} options={DISTRICTS} />}</Field></>
  if (slug === 'school') body = <>
    <Field label="I study at a">{(id) => <Select id={id} value={f.schoolType} onChange={(x) => patch({ schoolType: x.target.value as 'School' | 'College', school: '' })} options={['School', 'College']} />}</Field>
    <Field label="Name of institution" error={e('school')}>{(id) => <Select id={id} value={f.school} onChange={(x) => patch({ school: x.target.value })} options={['', ...SCHOOLS[f.schoolType]]} aria-invalid={!!e('school')} />}</Field>
    <Field label="Education board or curriculum">{(id) => <Select id={id} value={f.board} onChange={(x) => patch({ board: x.target.value })} options={BOARDS} />}</Field></>
  if (slug === 'id') body = <>
    <Card className="bg-offwhite-50"><p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Masked preview</p><p className="mt-1 text-sm">Student ID: <Masked value={f.idLast4 ? `•••• ${f.idLast4}` : '•••• ••••'} /></p><p className="mt-1 text-xs text-gray-600">Only reviewers can see the photo. Tutors never see it.</p></Card>
    <Field label="Last 4 digits of your student ID" hint="We never ask you to type the full number here." error={e('idLast4')}>{(id) => <Input id={id} inputMode="numeric" maxLength={4} value={f.idLast4} onChange={(x) => patch({ idLast4: x.target.value.replace(/\D/g, '') })} aria-invalid={!!e('idLast4')} />}</Field>
    <DocPlaceholder label="Student ID card photo" file="student-id-demo.jpg" uploaded={f.idFile} onToggle={() => patch({ idFile: !f.idFile })} />{e('idFile') && <p role="alert" className="text-sm text-danger-600">{e('idFile')}</p>}
    <p className="text-xs text-gray-600"><DemoTag /> DEMO, no real document. Nothing is uploaded, stored or checked with a school.</p></>
  if (slug === 'class') body = <>
    <Field label="Class" error={e('cls')}>{(id) => <Select id={id} value={f.cls} onChange={(x) => patch({ cls: x.target.value })} options={STUDENT_CLASSES} />}</Field>
    <Field label="Academic year" error={e('year')}>{(id) => <Select id={id} value={f.year} onChange={(x) => patch({ year: x.target.value })} options={YEARS} />}</Field>
    <Field label="Section or group (optional)" hint="For example Science, Commerce or Section B.">{(id) => <Input id={id} value={f.section} onChange={(x) => patch({ section: x.target.value })} maxLength={20} />}</Field></>
  if (slug === 'phone') body = done('phone')
    ? <div className="flex flex-wrap items-center gap-3"><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-navy-900">Phone verified</p><p className="text-sm text-gray-600"><Masked value={maskPhone(phoneRaw)} /></p></div><Chip tone="green" icon={<CheckCircle2 size={12} aria-hidden />}>Verified</Chip></div>
    : <div className="space-y-4"><p className="text-sm text-gray-600">We will confirm <Masked value={maskPhone(phoneRaw)} />.</p>
      <OtpInput value={code} onChange={(v) => { setCode(v); setWrong(false) }} error={wrong} />{wrong && <p role="alert" className="text-sm text-danger-600">That code is not correct.</p>}
      <div className="flex flex-wrap items-center gap-3"><Button onClick={() => (code === DEMO_OTP_FIRST ? s.setSJ(() => ({ phoneOk: true })) : (setWrong(true), setCode('')))}>Verify code</Button><span className="flex items-center gap-2 text-xs"><DemoTag /> Demo code: <b className="tabular">{DEMO_OTP_FIRST}</b></span></div></div>
  if (slug === 'consent') body = <Consent />
  return (
    <div className="mx-auto max-w-2xl">
      <PageHead title={cur.title} tag={cur.id} crumb={{ to: B, label: 'Student verification' }} sub={cur.hint} />
      <p className="mb-2 text-xs font-semibold text-gray-600">Step {idx + 1} of {SV_STEPS.length}</p>
      <div className="mb-5 flex gap-1" aria-hidden>{SV_STEPS.map((x, i) => <span key={x.slug} className={cx('h-1.5 flex-1 rounded-full', x.slug !== 'review' && done(x.slug) ? 'bg-teal-600' : i === idx ? 'bg-blue-600' : 'bg-gray-200')} />)}</div>
      <Card className="space-y-5">{body}</Card>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Link to={idx > 0 ? `${B}/${SV_STEPS[idx - 1].slug}` : B} className={linkSec}>{idx > 0 ? 'Back' : 'Checklist'}</Link>
        {slug === 'consent' ? <Button className="ml-auto" disabled={!done('consent')} onClick={() => nav(`${B}/review`)}>Continue</Button> : <Button className="ml-auto" onClick={go}>Save and continue</Button>}
      </div>
      {slug === 'consent' && !done('consent') && <p className="mt-3 text-sm text-gray-600">Continue unlocks when your guardian has agreed.</p>}
      {touched && bad && <p role="alert" className="mt-3 text-sm text-danger-600">Fix the highlighted fields to continue.</p>}
    </div>
  )
}

function Consent() {
  const { s, sj } = useDone(); const f = sj.form; const minor = isMinor(f); const age = ageOf(f.dob)
  const [touched, setTouched] = useState(false)
  const patch = (p: Partial<typeof f>) => s.setSJ((x) => ({ form: { ...x.form, ...p } }))
  if (!f.dob) return <p className="text-sm text-gray-600">Add your date of birth first so we know whether guardian consent is needed. <Link to={`${B}/details`} className="font-semibold text-blue-600 hover:underline">Open your details</Link></p>
  if (!minor) return <div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 text-emerald-600" size={20} aria-hidden /><p className="text-sm text-gray-600"><b className="text-navy-900">Not needed.</b> You are {age}, so you can agree to a tuition yourself. This step is complete.</p></div>
  const nameErr = touched && f.guardianName.trim().split(/\s+/).length < 2 ? 'Enter your guardian\'s full name.' : ''
  const phoneErr = touched && f.guardianPhone.replace(/\D/g, '').length !== 11 ? 'Enter an 11 digit mobile number, for example 01712345678.' : ''
  const send = () => { setTouched(true); if (f.guardianName.trim().split(/\s+/).length < 2 || f.guardianPhone.replace(/\D/g, '').length !== 11) return; s.setSJ(() => ({ consent: 'requested' })); s.toast('Consent request sent to your guardian (Demo)', 'success') }
  const st = sj.consent
  return (
    <div className="space-y-4">
      <p className="flex items-start gap-2 text-sm text-gray-600"><ShieldCheck size={18} className="mt-0.5 shrink-0 text-teal-700" aria-hidden /> You are {age}. A parent or guardian must agree before you can send interest or start a tuition. They never get access to your chats.</p>
      {st === 'none' && <>
        <Field label="Guardian full name" error={nameErr}>{(id) => <Input id={id} value={f.guardianName} onChange={(x) => patch({ guardianName: x.target.value })} placeholder={STUDENT.guardian} aria-invalid={!!nameErr} />}</Field>
        <Field label="Relationship">{(id) => <Select id={id} value={f.guardianRelation} onChange={(x) => patch({ guardianRelation: x.target.value })} options={GUARDIAN_RELATIONS} />}</Field>
        <Field label="Guardian mobile number" hint="Used once to send the consent request. It is shown masked afterwards." error={phoneErr}>{(id) => <Input id={id} inputMode="numeric" maxLength={11} value={f.guardianPhone} onChange={(x) => patch({ guardianPhone: x.target.value.replace(/\D/g, '') })} aria-invalid={!!phoneErr} />}</Field>
        <Button onClick={send}>Send consent request</Button></>}
      {st !== 'none' && <div className="rounded-input border border-gray-200 p-4 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2"><span><b className="text-navy-900">{f.guardianName}</b> · {f.guardianRelation} · <Masked value={maskGuardianPhone(f.guardianPhone)} /></span>
          {st === 'requested' && <Chip tone="amber" icon={<Clock size={12} aria-hidden />}>Waiting for guardian</Chip>}{st === 'given' && <Chip tone="green" icon={<CheckCircle2 size={12} aria-hidden />}>Guardian agreed</Chip>}{st === 'declined' && <Chip tone="red" icon={<XCircle size={12} aria-hidden />}>Guardian declined</Chip>}</div>
        {st === 'requested' && <div className="mt-3 flex flex-wrap items-center gap-2"><DemoTag label="Demo" /><Button size="sm" variant="secondary" onClick={() => { s.setSJ(() => ({ consent: 'given' })); s.toast('Demo: your guardian agreed', 'success') }}>Simulate: guardian agrees</Button><Button size="sm" variant="tertiary" onClick={() => { s.setSJ(() => ({ consent: 'declined' })); s.toast('Demo: your guardian declined', 'warning') }}>Simulate: guardian declines</Button></div>}
        {st === 'declined' && <div className="mt-3"><p className="text-gray-600">Talk to your guardian, then send the request again. You cannot continue without their agreement.</p><div className="mt-2 flex flex-wrap gap-2"><Button size="sm" onClick={() => { s.setSJ(() => ({ consent: 'requested' })); s.toast('Consent request sent again (Demo)', 'success') }}>Send again</Button><Button size="sm" variant="secondary" onClick={() => s.setSJ(() => ({ consent: 'none' }))}>Change guardian</Button></div></div>}
        {st === 'given' && <p className="mt-2 text-gray-600">Your guardian agreed to your verification and to tuitions you agree on this platform.</p>}</div>}
      <p className="text-xs text-gray-600"><DemoTag /> No message is sent. A real guardian would get an SMS link to review and agree.</p>
    </div>
  )
}

function Review() {
  const { s, sj, done } = useDone(); const nav = useNavigate(); const f = sj.form
  const [touched, setTouched] = useState(false)
  const missing = SV_STEPS.filter((x) => x.slug !== 'review' && !done(x.slug))
  const ready = missing.length === 0 && f.confirm
  const submit = () => { setTouched(true); if (!ready) return; s.setVerification('student', 'pending'); s.toast('Submitted for review', 'success'); nav(`${B}/status`) }
  const rows: [string, string][] = [['Name', f.fullName || '—'], ['Date of birth', f.dob || '—'], ['District', f.district], ['Institution', f.school ? `${f.school} (${f.schoolType})` : '—'], ['Board', f.board], ['Class', `${f.cls}, ${f.year}${f.section ? `, ${f.section}` : ''}`], ['Student ID', f.idLast4 ? `•••• ${f.idLast4}` : '—'], ['Guardian', isMinor(f) ? (f.guardianName ? `${f.guardianName} (${f.guardianRelation})` : '—') : 'Not needed (18 or older)']]
  return (
    <div className="mx-auto max-w-2xl">
      <PageHead title="Review and submit" tag="SV-08" crumb={{ to: B, label: 'Student verification' }} sub="Check your details. Reviewers see your documents. Tutors never do." />
      <Card className="space-y-4">
        <dl className="divide-y divide-gray-100 text-sm">{rows.map(([l, v]) => <div key={l} className="grid grid-cols-[7rem_1fr] gap-3 py-2"><dt className="text-gray-600">{l}</dt><dd className="font-semibold text-navy-900">{v}</dd></div>)}</dl>
        <div className="border-t border-gray-100 pt-4"><p className="text-sm font-semibold text-navy-900">Before you submit</p>
          <ul className="mt-2 space-y-1 text-sm">{SV_STEPS.filter((x) => x.slug !== 'review').map((x) => <li key={x.slug} className="flex items-center gap-2">{done(x.slug) ? <CheckCircle2 size={16} className="text-emerald-600" aria-label="Done" /> : <AlertTriangle size={16} className="text-warning-600" aria-label="Missing" />}<span className={done(x.slug) ? 'text-gray-600' : 'text-navy-900'}>{x.title}</span>{!done(x.slug) && <Link to={`${B}/${x.slug}`} className="ml-auto font-semibold text-blue-600 hover:underline">Complete</Link>}</li>)}</ul></div>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={f.confirm} onChange={(x) => s.setSJ((p) => ({ form: { ...p.form, confirm: x.target.checked } }))} className="mt-1 h-4 w-4" /><span>I confirm these details are true and that reviewers may check them for verification only.</span></label>
      </Card>
      <div className="mt-5 flex flex-wrap items-center gap-3"><Link to={`${B}/consent`} className={linkSec}>Back</Link><Button className="ml-auto" onClick={submit}>Submit for review</Button></div>
      {touched && !ready && <p role="alert" className="mt-3 text-sm text-danger-600">{missing.length ? 'Complete every step first.' : 'Tick the confirmation box to submit.'}</p>}
    </div>
  )
}

function Status() {
  const s = useStore(); const nav = useNavigate(); const vs = s.verification.student; const sj = s.sj
  const set = (v: Parameters<typeof s.setVerification>[1], note = '') => { s.setVerification('student', v); s.setSJ(() => ({ note })); s.toast(`Demo: ${v.replace('_', ' ')}`, 'info') }
  if (vs === 'not_started' || vs === 'draft') return (
    <div className="mx-auto max-w-lg"><PageHead title="Verification status" tag="SV-09" crumb={{ to: B, label: 'Student verification' }} actions={<StatusChip state={vs} />} />
      <Card className="text-center"><Clock className="mx-auto text-gray-400" aria-hidden /><h2 className="mt-3 text-xl">Nothing submitted yet</h2><p className="mt-1 text-sm text-gray-600">Finish the checklist and submit to start the review.</p><Link to={B} className={`mt-4 inline-block ${linkBtn}`}>Open checklist</Link></Card></div>
  )
  const tag = vs === 'verified' ? 'SV-10' : vs === 'rejected' ? 'SV-11' : vs === 'action_required' ? 'SV-12' : 'SV-09'
  return (
    <div className="mx-auto max-w-2xl">
      <PageHead title={vs === 'verified' ? 'Student Status: Verified' : vs === 'rejected' ? 'Verification was not approved' : vs === 'action_required' ? 'We need one more thing' : 'Verification status'} tag={tag} crumb={{ to: B, label: 'Student verification' }} actions={<StatusChip state={vs} />} />
      {(vs === 'pending' || vs === 'under_review') && <Card>
        <ol className="space-y-4">{[['Submitted', true], ['Documents checked', vs === 'under_review'], ['Decision', false]].map(([l, d], i) => <li key={String(l)} className="flex items-center gap-3 text-sm">{d ? <CheckCircle2 size={20} className="text-emerald-600" aria-label="Done" /> : <Clock size={20} className={i === 1 || (i === 2 && vs === 'under_review') ? 'text-blue-600' : 'text-gray-400'} aria-label="Waiting" />}<span className={d ? 'font-semibold text-navy-900' : 'text-gray-600'}>{String(l)}</span></li>)}</ol>
        <p className="mt-4 text-sm text-gray-600">Reviews usually take 1 to 2 working days. You can browse tutors meanwhile. Sending interest and chat unlock after approval.</p></Card>}
      {vs === 'verified' && <Card className="text-center"><PartyPopper size={36} className="mx-auto text-teal-700" aria-hidden /><h2 className="mt-3 text-xl">Welcome, {sj.form.fullName.split(' ')[0] || 'Nabila'}</h2>
        <div className="mt-3 flex justify-center"><VerifyBadge kind="student" /></div><p className="mx-auto mt-3 max-w-sm text-sm text-gray-600">You can now find a tutor, send interest and chat. Tutors will see the Student Verified badge on your requests.</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2"><Link to="/app/student/home" className={linkBtn}>Go to home</Link><Link to="/app/student/find-tutor" className={linkSec}>Find a tutor</Link></div></Card>}
      {vs === 'rejected' && <Card><p className="flex items-start gap-2 text-sm"><XCircle size={18} className="mt-0.5 shrink-0 text-danger-600" aria-hidden /><span><b className="text-navy-900">Reason:</b> {sj.note || 'The student ID photo did not match the name you entered.'}</span></p>
        <p className="mt-3 text-sm text-gray-600">Nothing is lost. Correct the details and send them again. You can resubmit as many times as you need.</p>
        <div className="mt-4 flex flex-wrap gap-2"><Button onClick={() => nav(`${B}/details`)}>Fix details</Button><Button variant="secondary" onClick={() => { s.setVerification('student', 'pending'); s.toast('Resubmitted for review', 'success') }}>Resubmit as is</Button></div></Card>}
      {vs === 'action_required' && <Card><p className="flex items-start gap-2 text-sm"><AlertTriangle size={18} className="mt-0.5 shrink-0 text-warning-600" aria-hidden /><span><b className="text-navy-900">Needed:</b> {sj.note || 'The student ID photo is hard to read. Please add a clearer copy.'}</span></p>
        <div className="mt-4 flex flex-wrap gap-2"><Button onClick={() => nav(`${B}/id`)}>Replace student ID</Button><Button variant="secondary" onClick={() => { s.setVerification('student', 'pending'); s.toast('Sent back for review', 'success') }}>Send back for review</Button></div></Card>}
      <Card className="mt-6 border-dashed bg-offwhite-50"><h2 className="flex items-center gap-2 text-base"><DemoTag label="Demo reviewer" /> Simulate the reviewer</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" disabled={vs !== 'pending'} onClick={() => set('under_review')}>Start review</Button>
          <Button size="sm" disabled={vs === 'verified'} onClick={() => set('verified')}>Simulate approval</Button>
          <Button size="sm" variant="destructive" disabled={vs === 'rejected'} onClick={() => set('rejected', 'The student ID photo did not match the name you entered.')}>Simulate rejection</Button>
          <Button size="sm" variant="secondary" disabled={vs === 'action_required'} onClick={() => set('action_required', 'The student ID photo is hard to read. Please add a clearer copy.')}>Simulate: action required</Button></div>
        <p className="mt-2 text-xs text-gray-600">No real reviewer exists. These buttons stand in for the decision.</p></Card>
    </div>
  )
}
