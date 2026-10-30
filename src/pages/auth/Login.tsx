import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { Eye, EyeOff, LogIn, ShieldAlert } from 'lucide-react'
import { Button, Field, Input, btnClass } from '../../components/ui'
import { AuthCard, AuthHead, Notice } from './Layout'
import { useStore } from '../../lib/store'
import { validEmail } from '../../lib/validate'
import { loginAccount, ApiError } from '../../lib/api'

export function PasswordInput({ id, value, onChange, invalid, auto = 'current-password' }: { id: string; value: string; onChange: (v: string) => void; invalid?: boolean; auto?: string }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <Input id={id} type={show ? 'text' : 'password'} autoComplete={auto} aria-invalid={invalid} value={value} onChange={(e) => onChange(e.target.value)} className="pr-11" />
      <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-input text-gray-600 hover:text-navy-900">
        {show ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
      </button>
    </div>
  )
}

export default function Login() {
  const { signIn, setSession, setAuthenticatedUser, toast, patchSignup } = useStore()
  const nav = useNavigate()
  const { state } = useLocation() as { state?: { from?: string } }
  const [email, setEmail] = useState(''); const [pw, setPw] = useState('')
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [fail, setFail] = useState<'' | 'unknown' | 'wrong'>('')
  const [failMessage, setFailMessage] = useState('')
  const [locked, setLocked] = useState(false)
  const eErr = touched ? (!email ? 'Enter your email address.' : !validEmail(email) ? 'This email looks incomplete. Use a format like name@example.com.' : '') : ''
  const pErr = touched && !pw ? 'Enter your password.' : ''

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setTouched(true); setFail('')
    if (!validEmail(email) || !pw) return
    setBusy(true)
    try {
      const { user, tokens } = await loginAccount(email.trim(), pw)
      patchSignup({ role: user.role, name: user.name, email: user.email })
      setSession(tokens.access_token, tokens.refresh_token); setAuthenticatedUser(user); signIn(user.role); toast('Signed in successfully', 'success')
      nav('/auth/gate', { state })
    } catch (error) {
      // 401 is deliberately the same for unknown emails and wrong passwords; other errors (rate limit, suspension) carry their own message.
      const status = error instanceof ApiError ? error.status : 0
      setFail(status === 401 ? 'wrong' : 'unknown')
      setFailMessage(status && status !== 401 && error instanceof Error ? error.message : 'We could not sign you in right now. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  if (locked) return (
    <AuthCard>
      <AuthHead tone="red" icon={<ShieldAlert size={24} aria-hidden />} title="Account temporarily locked" lead="Too many unsuccessful attempts. For your safety, sign-in is paused for 15 minutes." />
      <Notice tone="amber">You can reset your password now to unlock sooner, or recover access if you no longer have your phone or email.</Notice>
      <div className="mt-5 space-y-3">
        <Link to="/forgot" className={btnClass('primary') + ' w-full'}>Reset password</Link>
        <Link to="/recover" className={btnClass('secondary') + ' w-full'}>Can't access phone or email?</Link>
        <p className="text-xs text-gray-600">Reset your password to restore access.</p>
      </div>
    </AuthCard>
  )

  return (
    <>
      <AuthCard>
        <AuthHead icon={<LogIn size={22} strokeWidth={1.5} aria-hidden />} title="Welcome back" lead="Log in to continue your tuition journey." />
        <form onSubmit={submit} noValidate className="space-y-5">
          {fail === 'unknown' && <Notice>{failMessage}</Notice>}
          {fail === 'wrong' && <Notice>That email or password is not correct.</Notice>}
          <Field label="Email" error={eErr}>{(id) => <Input id={id} type="email" autoComplete="email" aria-invalid={!!eErr} value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
          <Field label="Password" error={pErr}>{(id) => <PasswordInput id={id} value={pw} onChange={setPw} invalid={!!pErr} />}</Field>
          <div className="flex justify-end"><Link to="/forgot" className="text-sm font-semibold text-blue-600 hover:underline">Forgot password?</Link></div>
          <Button type="submit" loading={busy} className="w-full">{busy ? 'Logging in…' : 'Log in'}</Button>
        </form>
        <p className="mt-6 text-center text-sm text-gray-600">New to TuitionHub? <Link to="/signup" className="font-semibold text-blue-600 hover:underline">Create an account</Link></p>
        <p className="mt-2 text-center text-xs text-gray-600"><Link to="/admin/login" className="hover:underline">Admin sign-in</Link></p>
      </AuthCard>
    </>
  )
}
