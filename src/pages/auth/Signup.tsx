import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { Building2, Check, GraduationCap, HeartHandshake, Mail, UserPlus, Users } from 'lucide-react'
import { Button, Chip, Field, Input, cx } from '../../components/ui'
import { AuthCard, AuthHead, Notice } from './Layout'
import { PasswordInput } from './Login'
import { setCreatedAccount, createdAccount } from '../../lib/account'
import { useStore } from '../../lib/store'
import { ROLES, type Role } from '../../lib/nav'
import { maskEmail, strength, validEmail } from '../../lib/validate'
import { registerAccount, requestEmailVerification, verifyEmail } from '../../lib/api'

const PUBLIC_ROLES: Role[] = ['tutor', 'student', 'parent', 'coaching']
const ROLE_ICON = { tutor: GraduationCap, student: HeartHandshake, parent: Users, coaching: Building2 } as Record<string, typeof Users>
const ROLE_LABEL: Record<string, string> = { tutor: 'Tutor', student: 'Student', parent: 'Parent / Guardian', coaching: 'Coaching / Institute' }
const ROLE_BLURB: Record<string, string> = {
  tutor: 'Offer tuition, build a verified profile and grow your reputation.', student: 'Find a tutor, track homework and see your own progress.',
  parent: 'Find a trusted tutor and follow your child with plain-language updates.', coaching: 'Run batches, classes, exams and parent reports in one place.',
}

export function StrengthMeter({ pw }: { pw: string }) {
  const s = strength(pw)
  const tone = ['bg-gray-200', 'bg-danger-600', 'bg-warning-600', 'bg-blue-600', 'bg-emerald-600'][s.score]
  const rules = ['8 or more characters', 'Upper and lower case', 'A number', 'A symbol']
  return (
    <div aria-live="polite">
      <div className="flex gap-1" aria-hidden>{[1, 2, 3, 4].map((i) => <span key={i} className={cx('h-1.5 flex-1 rounded-full', i <= s.score ? tone : 'bg-gray-200')} />)}</div>
      <p className="mt-1.5 text-xs font-semibold text-navy-900">{pw ? s.label : 'Password strength'}</p>
      <ul className="mt-1 grid grid-cols-2 gap-x-3 text-xs text-gray-600">{rules.map((r, i) => <li key={r} className={cx('flex items-center gap-1', s.checks[i] && 'text-teal-700')}><Check size={12} className={s.checks[i] ? '' : 'opacity-30'} aria-hidden />{r}</li>)}</ul>
    </div>
  )
}

export function SignUp() {
  const { role: preset } = useParams()
  const { signup, patchSignup, setSession, setAuthenticatedUser, signIn } = useStore()
  const nav = useNavigate()
  const validPreset = PUBLIC_ROLES.includes(preset as Role) ? (preset as Role) : null
  useEffect(() => { if (validPreset) patchSignup({ role: validPreset }) }, [validPreset]) // eslint-disable-line
  const [name, setName] = useState(signup?.name ?? ''); const [email, setEmail] = useState(signup?.email ?? ''); const [pw, setPw] = useState(''); const [pw2, setPw2] = useState('')
  const [terms, setTerms] = useState(false); const [touched, setTouched] = useState(false); const [busy, setBusy] = useState(false); const [taken, setTaken] = useState(false)
  if (preset && !validPreset) return <Navigate to="/signup" replace />
  const role = validPreset ?? signup.role
  const err = {
    name: name.trim().split(/\s+/).filter(Boolean).length < 2 ? 'Enter your first and last name.' : '',
    email: !email ? 'Enter your email address.' : !validEmail(email) ? 'This email looks incomplete. Use a format like name@example.com.' : '',
    pw: strength(pw).score < 3 ? 'Choose a stronger password: 8+ characters with upper and lower case, plus a number or symbol.' : '',
    pw2: pw2 !== pw ? 'The two passwords do not match.' : '',
    terms: !terms ? 'Please accept the terms to continue.' : '',
  }
  const s = (k: keyof typeof err) => (touched ? err[k] : '')
  const submit = (e: React.FormEvent) => {
    e.preventDefault(); setTouched(true); setTaken(false)
    if (Object.values(err).some(Boolean)) return
    setBusy(true)
    if (!role) {
      patchSignup({ name: name.trim(), email: email.trim(), emailVerified: false })
      setCreatedAccount({ email: email.trim(), password: pw, role: 'parent' })
      setBusy(false)
      nav('/signup/role')
      return
    }
    registerAccount({ name: name.trim(), email: email.trim(), password: pw, role })
      .then(({ user, tokens }) => {
        patchSignup({ name: user.name, email: user.email, role: user.role, emailVerified: !!user.email_verified_at })
        setSession(tokens.access_token, tokens.refresh_token)
        setAuthenticatedUser(user)
        signIn(user.role)
        nav('/auth/gate')
      })
      .catch((error) => setTaken(error instanceof Error && error.message.includes('already exists')))
      .finally(() => setBusy(false))
  }
  return (
    <AuthCard>
      <AuthHead icon={<UserPlus size={22} strokeWidth={1.5} aria-hidden />} title="Create your account" lead={role ? <>Joining as <Chip tone="blue">{ROLE_LABEL[role]}</Chip> <Link to="/signup/role" className="ml-1 text-sm font-semibold text-blue-600 hover:underline">Change</Link></> : 'It takes about two minutes. You choose your role next.'} />
      <form onSubmit={submit} noValidate className="space-y-4">
        {taken && <Notice>That email already belongs to an account. <Link to="/login" className="font-semibold underline">Log in instead</Link>, or use a different email.</Notice>}
        <Field label="Full name" error={s('name')}>{(id) => <Input id={id} autoComplete="name" aria-invalid={!!s('name')} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
        <Field label="Email" error={s('email')}>{(id) => <Input id={id} type="email" autoComplete="email" aria-invalid={!!s('email')} value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
        <Field label="Password" error={s('pw')}>{(id) => <PasswordInput id={id} auto="new-password" value={pw} onChange={setPw} invalid={!!s('pw')} />}</Field>
        <StrengthMeter pw={pw} />
        <Field label="Confirm password" error={s('pw2')}>{(id) => <PasswordInput id={id} auto="new-password" value={pw2} onChange={setPw2} invalid={!!s('pw2')} />}</Field>
        <div>
          <label className="flex items-start gap-2 text-sm text-charcoal-900"><input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-1 h-4 w-4 accent-blue-600" />I agree to the Terms and Privacy Policy.</label>
          {s('terms') && <p className="mt-1 text-xs text-danger-600">{s('terms')}</p>}
        </div>
        <Button type="submit" loading={busy} className="w-full">{busy ? 'Creating account…' : 'Continue'}</Button>
      </form>
      <p className="mt-6 text-center text-sm text-gray-600">Already have an account? <Link to="/login" className="font-semibold text-blue-600 hover:underline">Log in</Link></p>
    </AuthCard>
  )
}

export function RoleSelect() {
  const { signup, patchSignup, setSession, setAuthenticatedUser, signIn } = useStore()
  const nav = useNavigate()
  const [pick, setPick] = useState<Role | null>(signup.role)
  const [err, setErr] = useState(false)
  const [busy, setBusy] = useState(false)
  return (
    <AuthCard>
      <AuthHead title="How will you use TuitionHub?" lead="Each role has its own verification and its own dashboard. You can add another role later." />
      <div role="radiogroup" aria-label="Choose your role" className="space-y-3">
        {PUBLIC_ROLES.map((r) => { const I = ROLE_ICON[r]; const on = pick === r
          return (
            <button key={r} role="radio" aria-checked={on} onClick={() => { setPick(r); setErr(false) }} className={cx('flex w-full items-start gap-4 rounded-card border p-4 text-left transition-colors', on ? 'border-blue-600 bg-blue-100' : 'border-gray-200 bg-white hover:border-gray-400')}>
              <span className={cx('flex h-10 w-10 shrink-0 items-center justify-center rounded-input', on ? 'bg-blue-600 text-white' : 'bg-gray-100 text-navy-900')}><I size={20} strokeWidth={1.5} aria-hidden /></span>
              <span className="flex-1"><span className="block font-heading font-bold text-navy-900">{ROLE_LABEL[r]}</span><span className="text-sm text-gray-600">{ROLE_BLURB[r]}</span></span>
              <span className={cx('mt-1 flex h-5 w-5 items-center justify-center rounded-full border', on ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-400')}>{on && <Check size={12} aria-hidden />}</span>
            </button>)
        })}
      </div>
      {err && <p role="alert" className="mt-3 text-sm text-danger-600">Choose a role to continue.</p>}
      <Button className="mt-6 w-full" loading={busy} onClick={() => {
        if (!pick) return setErr(true)
        patchSignup({ role: pick })
        if (!signup.email || !createdAccount) return nav(`/signup/${pick}`)
        setBusy(true)
        registerAccount({ name: signup.name, email: createdAccount.email, password: createdAccount.password, role: pick })
          .then(({ user, tokens }) => {
            patchSignup({ name: user.name, email: user.email, role: user.role })
            setSession(tokens.access_token, tokens.refresh_token)
            setAuthenticatedUser(user)
            signIn(user.role)
            nav('/auth/gate')
          })
          .catch(() => setErr(true))
          .finally(() => setBusy(false))
      }}>Continue as {pick ? ROLE_LABEL[pick] : '…'}</Button>
      <p className="mt-4 text-center text-xs text-gray-600">Looking at the platform first? <Link to="/how-it-works" className="font-semibold text-blue-600 hover:underline">See how it works</Link></p>
    </AuthCard>
  )
}

export function EmailVerify() {
  const { signup, patchSignup, signIn } = useStore(); const nav = useNavigate()
  const [st, setSt] = useState<'sent' | 'verified' | 'expired'>('sent'); const [resent, setResent] = useState(false)
  const [token, setToken] = useState('')
  const [error, setError] = useState('')
  useEffect(() => { if (signup.email) requestEmailVerification(signup.email).then((response) => setToken(response.development_token ?? '')).catch((e) => setError(e instanceof Error ? e.message : 'Could not send verification email.')) }, [signup.email])
  if (!signup.email) return <Navigate to="/signup" replace />
  const done = () => { signIn(signup.role ?? 'parent'); nav('/auth/gate') }
  if (st === 'verified') return (
    <AuthCard><AuthHead tone="green" icon={<Check size={24} aria-hidden />} title="Email verified" lead="Your email is confirmed. Next, you will finish verification for your role." />
      <Button className="w-full" onClick={done}>Continue</Button></AuthCard>
  )
  return (
    <AuthCard>
      <AuthHead tone={st === 'expired' ? 'amber' : 'blue'} icon={<Mail size={22} strokeWidth={1.5} aria-hidden />} title={st === 'expired' ? 'This link has expired' : 'Check your email'} lead={st === 'expired' ? 'Verification links last 24 hours. Send a new one below.' : <>We sent a verification link to <strong className="text-navy-900">{maskEmail(signup.email)}</strong>.</>} />
      <div className="space-y-4">
        {error && <Notice tone="amber">{error}</Notice>}
        {resent && <Notice tone="green">A new link was sent.</Notice>}
        <div className="rounded-card border border-dashed border-warning-600 bg-warning-100 p-3 text-sm">
          <p className="text-xs text-gray-600">Check your inbox for the verification link.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => { if (!token) return; verifyEmail(token).then(() => { patchSignup({ emailVerified: true }); setSt('verified') }).catch((e) => setError(e instanceof Error ? e.message : 'Verification failed.')) }} disabled={st === 'expired' || !token}>Verify email</Button>
          </div>
        </div>
        <Button variant="secondary" className="w-full" onClick={() => { setSt('sent'); setResent(true); requestEmailVerification(signup.email).then((response) => setToken(response.development_token ?? '')).catch((e) => setError(e instanceof Error ? e.message : 'Could not resend verification email.')) }}>Resend email</Button>
        <p className="text-center text-xs text-gray-600">Wrong address? <Link to="/signup" className="font-semibold text-blue-600 hover:underline">Start again</Link></p>
      </div>
    </AuthCard>
  )
}
