import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { ArrowRight, CheckCircle2, KeyRound, LifeBuoy, LockKeyhole, LogOut, Mail, ShieldCheck, ShieldAlert, Clock, FileSearch, AlertTriangle, Loader2 } from 'lucide-react'
import { Button, btnClass, Card, Chip, Field, Input, StatusChip, Textarea, cx } from '../../components/ui'
import { AuthCard, AuthHead, Notice } from './Layout'
import { PasswordInput } from './Login'
import { StrengthMeter } from './Signup'
import { useStore, type VerifyState } from '../../lib/store'
import { maskEmail, strength, validEmail } from '../../lib/validate'
import { verifyPath, ROLES, type Role } from '../../lib/nav'
import { api, effectiveStatus, getWorkflowDashboard, loginAccount, logoutAccount, revokeRefreshToken } from '../../lib/api'
import { errMsg } from '../../lib/platform'

export function Forgot() {
  const nav = useNavigate(); const [email, setEmail] = useState(''); const [touched, setTouched] = useState(false); const [busy, setBusy] = useState(false); const [failure, setFailure] = useState('')
  const err = !email ? 'Enter the email you signed up with.' : !validEmail(email) ? 'This email looks incomplete. Use a format like name@example.com.' : ''
  return (
    <AuthCard>
      <AuthHead icon={<KeyRound size={22} strokeWidth={1.5} aria-hidden />} title="Forgot your password?" lead="Enter your email and we will send a reset link." />
      <form noValidate className="space-y-5" onSubmit={(e) => { e.preventDefault(); setTouched(true); if (err) return; setBusy(true); setFailure('')
        // The response is identical whether or not the account exists; a development server also returns the token.
        api.post<{ development_token?: string }>('/api/v1/auth/forgot-password', { email: email.trim() })
          .then((r) => nav('/forgot/sent', { state: { email, token: r?.development_token } }))
          .catch((e2) => { setFailure(errMsg(e2)); setBusy(false) }) }}>
        {failure && <Notice tone="amber">{failure}</Notice>}
        <Field label="Email" error={touched ? err : ''}>{(id) => <Input id={id} type="email" autoComplete="email" aria-invalid={touched && !!err} value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
        <Button type="submit" loading={busy} className="w-full">{busy ? 'Sending…' : 'Send reset link'}</Button>
      </form>
      <p className="mt-6 text-center text-sm"><Link to="/login" className="font-semibold text-blue-600 hover:underline">Back to log in</Link> · <Link to="/recover" className="font-semibold text-blue-600 hover:underline">Lost phone or email?</Link></p>
    </AuthCard>
  )
}

export function ForgotSent() {
  const { state } = useLocation() as { state?: { email?: string; token?: string } }; const nav = useNavigate(); const [resent, setResent] = useState(false)
  if (!state?.email) return <Navigate to="/forgot" replace />
  return (
    <AuthCard>
      <AuthHead tone="green" icon={<Mail size={22} strokeWidth={1.5} aria-hidden />} title="Check your email" lead={<>If an account exists for <strong className="text-navy-900">{maskEmail(state.email)}</strong>, a reset link is created. It expires in 1 hour.</>} />
      {resent && <div className="mb-4"><Notice tone="green">Another link was sent.</Notice></div>}
      {state.token ? (
        <div className="rounded-card border border-dashed border-warning-600 bg-warning-100 p-3">
          <p className="text-xs text-gray-600"><strong>Development server:</strong> email delivery is not configured, so the reset link is shown here instead of being emailed.</p>
          <Button size="sm" className="mt-3" onClick={() => nav(`/reset?token=${encodeURIComponent(state.token!)}`)}>Open reset link <ArrowRight size={14} aria-hidden /></Button>
        </div>
      ) : <Notice tone="amber">Didn't get an email? Email delivery may not be set up on this server yet. Use <Link to="/recover" className="font-semibold underline">account recovery</Link> to reach the support team.</Notice>}
      <Button variant="secondary" className="mt-4 w-full" onClick={() => { void api.post('/api/v1/auth/forgot-password', { email: state.email }).then(() => setResent(true)).catch(() => setResent(true)) }}>Send again</Button>
      <p className="mt-4 text-center text-sm"><Link to="/login" className="font-semibold text-blue-600 hover:underline">Back to log in</Link></p>
    </AuthCard>
  )
}

export function Reset() {
  const nav = useNavigate(); const [pw, setPw] = useState(''); const [pw2, setPw2] = useState(''); const [touched, setTouched] = useState(false); const [busy, setBusy] = useState(false); const [failure, setFailure] = useState('')
  const token = new URLSearchParams(useLocation().search).get('token') ?? ''
  const e1 = strength(pw).score < 3 ? 'Choose a stronger password: 8+ characters with upper and lower case, plus a number or symbol.' : ''
  const e2 = pw2 !== pw ? 'The two passwords do not match.' : ''
  return (
    <AuthCard>
      <AuthHead icon={<LockKeyhole size={22} strokeWidth={1.5} aria-hidden />} title="Set a new password" lead="Pick something you have not used before." />
      {!token && <Notice tone="amber">This page needs the link from your reset email. <Link to="/forgot" className="font-semibold underline">Request a new link</Link>.</Notice>}
      {failure && <Notice tone="amber">{failure} <Link to="/forgot" className="font-semibold underline">Request a new link</Link>.</Notice>}
      <form noValidate className="space-y-4" onSubmit={(e) => { e.preventDefault(); setTouched(true); if (e1 || e2 || !token) return; setBusy(true); setFailure('')
        api.post('/api/v1/auth/reset-password', { token, new_password: pw }).then(() => nav('/reset/done')).catch((e3) => { setFailure(errMsg(e3)); setBusy(false) }) }}>
        <Field label="New password" error={touched ? e1 : ''}>{(id) => <PasswordInput id={id} auto="new-password" value={pw} onChange={setPw} invalid={touched && !!e1} />}</Field>
        <StrengthMeter pw={pw} />
        <Field label="Confirm new password" error={touched || pw2 ? e2 : ''}>{(id) => <PasswordInput id={id} auto="new-password" value={pw2} onChange={setPw2} invalid={!!(touched || pw2) && !!e2} />}</Field>
        <Button type="submit" loading={busy} className="w-full">{busy ? 'Saving…' : 'Reset password'}</Button>
      </form>
    </AuthCard>
  )
}

export function ResetDone() {
  return (
    <AuthCard>
      <AuthHead tone="green" icon={<CheckCircle2 size={24} aria-hidden />} title="Password updated" lead="You can now log in with your new password. Other devices were signed out." />
      <Link to="/login" className={btnClass('primary') + ' w-full'}>Log in</Link>
    </AuthCard>
  )
}

const PROBLEMS = [['phone', 'I lost access to my phone number'], ['email', 'I lost access to my email'], ['both', 'I lost access to both']]
export function Recover() {
  const [kind, setKind] = useState('phone'); const [name, setName] = useState(''); const [contact, setContact] = useState(''); const [note, setNote] = useState('')
  const [touched, setTouched] = useState(false); const [busy, setBusy] = useState(false); const [ref, setRef] = useState(''); const [refError, setRefError] = useState('')
  const err = { name: name.trim().length < 2 ? 'Enter the name on the account.' : '', contact: !validEmail(contact) ? 'Enter a contact email we can reach you on (not the lost one).' : '', note: note.trim().length < 15 ? `Tell us a little more (${note.trim().length}/15).` : '' }
  if (ref) return (
    <AuthCard>
      <AuthHead tone="green" icon={<LifeBuoy size={24} aria-hidden />} title="Request received" lead="A support reviewer will contact you within two working days." />
      <p className="text-sm text-gray-600">We will reply to the contact email you gave us.</p>
      <Link to="/" className={btnClass('secondary') + ' mt-5 w-full'}>Back to home</Link>
    </AuthCard>
  )
  return (
    <AuthCard>
      <AuthHead icon={<LifeBuoy size={22} strokeWidth={1.5} aria-hidden />} title="Account recovery" lead="Locked out of your phone or email? Tell us what happened and a person will help." />
      <form noValidate className="space-y-4" onSubmit={(e) => { e.preventDefault(); setTouched(true); if (Object.values(err).some(Boolean)) return; setBusy(true)
        api.post('/api/v1/public/contact', { name, email: contact, category: 'support', subject: `Account recovery: ${PROBLEMS.find(([v]) => v === kind)?.[1] ?? kind}`, body: note })
          .then(() => setRef('sent')).catch((e2) => { setBusy(false); setRefError(errMsg(e2)) }) }}>
        {refError && <Notice tone="amber">{refError}</Notice>}
        <fieldset><legend className="mb-2 text-sm font-medium text-charcoal-900">What happened?</legend>
          <div className="space-y-2">{PROBLEMS.map(([v, l]) => <label key={v} className={cx('flex cursor-pointer items-center gap-3 rounded-input border p-3 text-sm', kind === v ? 'border-blue-600 bg-blue-100' : 'border-gray-200')}><input type="radio" name="kind" checked={kind === v} onChange={() => setKind(v)} className="accent-blue-600" />{l}</label>)}</div></fieldset>
        <Field label="Name on the account" error={touched ? err.name : ''}>{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
        <Field label="Contact email" error={touched ? err.contact : ''} hint="We will reply here.">{(id) => <Input id={id} type="email" value={contact} onChange={(e) => setContact(e.target.value)} />}</Field>
        <Field label="Details" error={touched ? err.note : ''}>{(id) => <Textarea id={id} rows={3} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
        <Button type="submit" loading={busy} className="w-full">{busy ? 'Submitting…' : 'Submit request'}</Button>
      </form>
      <p className="mt-5 text-center text-sm"><Link to="/login" className="font-semibold text-blue-600 hover:underline">Back to log in</Link></p>
    </AuthCard>
  )
}

export function Logout() {
  const { signedIn, signOut, toast } = useStore(); const [done, setDone] = useState(!signedIn); const [busy, setBusy] = useState(false)
  if (done) return (
    <AuthCard>
      <AuthHead tone="green" icon={<LogOut size={22} aria-hidden />} title="You're signed out" lead="Your session has ended on this device." />
      <div className="space-y-3"><Link to="/login" className={btnClass('primary') + ' w-full'}>Log in again</Link><Link to="/" className={btnClass('secondary') + ' w-full'}>Back to home</Link></div>
    </AuthCard>
  )
  return (
    <AuthCard>
      <AuthHead icon={<LogOut size={22} strokeWidth={1.5} aria-hidden />} title="Log out of TuitionHub?" lead="Unsaved drafts stay saved. You can log back in any time." />
      <div className="flex gap-3">
        <Button variant="secondary" className="flex-1" onClick={() => history.back()}>Stay signed in</Button>
        <Button className="flex-1" loading={busy} onClick={async () => {
          setBusy(true)
          try {
            await logoutAccount()
            toast('Signed out', 'success')
          } catch {
            // logoutAccount already cleared the stored tokens; the refresh token expires on its own.
            toast('Signed out on this device. The server session could not be ended and will expire on its own.', 'warning')
          } finally {
            signOut()
            setDone(true)
            setBusy(false)
          }
        }}>Log out</Button>
      </div>
    </AuthCard>
  )
}

const GATE: Record<string, { tone: 'green' | 'amber' | 'red' | 'blue'; title: string; body: string; cta: string }> = {
  not_started: { tone: 'blue', title: 'Complete your verification', body: 'You can look around with a limited, read-only dashboard. Posting, interest and chat unlock after verification.', cta: 'Start verification' },
  draft: { tone: 'blue', title: 'Finish your verification', body: 'You have a saved draft. Pick up where you left off.', cta: 'Continue verification' },
  pending: { tone: 'amber', title: 'Verification submitted', body: 'We have your details. A reviewer will look at them shortly.', cta: 'View status' },
  under_review: { tone: 'amber', title: 'Your verification is under review', body: 'Reviews usually take one to two working days. You will be notified.', cta: 'View status' },
  rejected: { tone: 'red', title: 'Verification was not approved', body: 'Review the reasons and resubmit with corrected details.', cta: 'See reasons and resubmit' },
  action_required: { tone: 'amber', title: 'We need more information', body: 'The reviewer asked for an additional detail before they can approve you.', cta: 'Provide information' },
  resubmission_required: { tone: 'amber', title: 'Corrections are required', body: 'Review the administrator feedback and submit the corrected information.', cta: 'Update verification' },
  interview_pending: { tone: 'amber', title: 'Interview required', body: 'Your verification requires an interview before a decision can be made.', cta: 'View status' },
  interview_scheduled: { tone: 'amber', title: 'Interview scheduled', body: 'Your verification interview has been scheduled.', cta: 'View status' },
  interview_completed: { tone: 'amber', title: 'Interview completed', body: 'Your interview is complete and your application is awaiting a final decision.', cta: 'View status' },
  approved: { tone: 'blue', title: 'Complete your profile', body: 'Your verification was approved. Complete the required profile fields to activate your account.', cta: 'Complete profile' },
  profile_incomplete: { tone: 'blue', title: 'Complete your profile', body: 'Complete the required profile fields before using restricted platform features.', cta: 'Complete profile' },
  active: { tone: 'green', title: "You're active", body: 'Your account and profile are active.', cta: 'Go to dashboard' },
  suspended: { tone: 'red', title: 'Account suspended', body: 'Your account is currently suspended. Contact support for assistance.', cta: 'Contact support' },
  verified: { tone: 'green', title: "You're verified", body: 'Everything is unlocked for your role.', cta: 'Go to dashboard' },
}
export function Gate() {
  const { signedIn, role, verification, setVerification } = useStore(); const nav = useNavigate()
  const [serverState, setServerState] = useState<string | null>(null)
  const st = (serverState ?? verification[role]) as keyof typeof GATE
  const g = GATE[st] ?? GATE.pending
  const [checking, setChecking] = useState(true)
  useEffect(() => {
    getWorkflowDashboard()
      .then((dashboard) => {
        const next = effectiveStatus(dashboard)
        setServerState(next)
        if (next in GATE) setVerification(role, next as VerifyState)
      })
      .catch(() => setServerState(null))
      .finally(() => setChecking(false))
    // setVerification is recreated on every store update, so it is deliberately not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role])
  if (!signedIn) return <Navigate to="/login" replace />
  const label = ROLES.find((r) => r.id === role)?.label ?? role
  if (checking) return <AuthCard><div className="flex flex-col items-center py-10 text-center" role="status"><Loader2 className="animate-spin text-blue-600" aria-hidden /><p className="mt-4 font-heading font-bold text-navy-900">Checking your account…</p><p className="text-sm text-gray-600">Looking up your role and verification status.</p></div></AuthCard>
  const verified = st === 'verified' || st === 'active'
  return (
    <AuthCard>
      <AuthHead tone={g.tone} icon={verified ? <ShieldCheck size={24} aria-hidden /> : st === 'rejected' ? <ShieldAlert size={24} aria-hidden /> : st === 'under_review' || st === 'pending' ? <Clock size={24} aria-hidden /> : st === 'action_required' ? <AlertTriangle size={24} aria-hidden /> : <FileSearch size={24} aria-hidden />} title={g.title} lead={g.body} />
      <dl className="mb-6 divide-y divide-gray-100 rounded-card border border-gray-200 text-sm">
        <div className="flex items-center justify-between px-4 py-3"><dt className="text-gray-600">Signed in as</dt><dd className="font-semibold text-navy-900">{label}</dd></div>
        <div className="flex items-center justify-between px-4 py-3"><dt className="text-gray-600">Verification</dt><dd><StatusChip state={st} /></dd></div>
        <div className="flex items-center justify-between px-4 py-3"><dt className="text-gray-600">Access</dt><dd className="font-semibold text-navy-900">{verified ? 'Full' : 'Limited, read-only'}</dd></div>
      </dl>
      <div className="space-y-3">
        <Button className="w-full" onClick={() => nav(verified ? `/app/${role}` : verifyPath(role))}>{g.cta} <ArrowRight size={14} aria-hidden /></Button>
        {!verified && <Button variant="secondary" className="w-full" onClick={() => nav(`/app/${role}`)}>Explore limited dashboard</Button>}
      </div>
    </AuthCard>
  )
}

export function AdminLogin() {
  const { setSession, setAuthenticatedUser, toast } = useStore(); const nav = useNavigate()
  const [email, setEmail] = useState(''); const [pw, setPw] = useState(''); const [touched, setTouched] = useState(false); const [busy, setBusy] = useState(false); const [bad, setBad] = useState('')
  const eErr = touched && !validEmail(email) ? 'Enter your admin email.' : ''; const pErr = touched && !pw ? 'Enter your password.' : ''
  return (
    <AuthCard>
      <AuthHead icon={<ShieldCheck size={22} strokeWidth={1.5} aria-hidden />} title="Admin sign-in" lead="Staff access only. All sign-ins are logged." />
      <form noValidate className="space-y-5" onSubmit={async (e) => {
        e.preventDefault(); setTouched(true); setBad('')
        if (!validEmail(email) || !pw) return
        setBusy(true)
        try {
          const { user, tokens } = await loginAccount(email.trim(), pw)
          if (user.role !== 'admin') {
            // Login already issued a session for this non-admin account; revoke it rather than leave it orphaned.
            await revokeRefreshToken().catch(() => {})
            throw new Error('This account is not authorized for administrator access.')
          }
          setSession(tokens.access_token, tokens.refresh_token); setAuthenticatedUser(user); toast('Administrator session started.', 'success'); nav('/app/admin/verification')
        } catch (error) {
          setBad(error instanceof Error ? error.message : 'Administrator sign-in failed.')
        } finally { setBusy(false) }
      }}>
        {bad && <Notice>{bad}</Notice>}
        <Field label="Admin email" error={eErr}>{(id) => <Input id={id} type="email" aria-invalid={!!eErr} value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
        <Field label="Password" error={pErr}>{(id) => <PasswordInput id={id} value={pw} onChange={setPw} invalid={!!pErr} />}</Field>
        <Button type="submit" loading={busy} className="w-full">Sign in</Button>
      </form>
    </AuthCard>
  )
}
