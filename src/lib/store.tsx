import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Role } from './nav'
import { clearTokens, getCurrentUser, hasSession, saveTokens, type ApiUser } from './api'

// Client state is limited to the session, the sign-up draft, the verification
// banner and toasts. Everything else lives in the backend and is fetched per screen.

export type VerifyState = 'not_started' | 'draft' | 'pending' | 'under_review' | 'verified' | 'rejected' | 'action_required' | 'resubmission_required' | 'interview_pending' | 'interview_scheduled' | 'interview_completed' | 'approved' | 'profile_incomplete' | 'active' | 'suspended'
export type Toast = { id: number; text: string; tone: 'info' | 'success' | 'warning' | 'danger' }

export type Signup = { role: Role | null; name: string; email: string; phone: string; phoneVerified: boolean; emailVerified: boolean }
const emptySignup: Signup = { role: null, name: '', email: '', phone: '', phoneVerified: false, emailVerified: false }

type State = {
  signup: Signup
  role: Role
  signedIn: boolean
  user: ApiUser | null
  verification: Record<Role, VerifyState>
  toasts: Toast[]
}

const initial = (): State => ({
  signup: emptySignup,
  role: 'tutor',
  signedIn: hasSession(),
  user: null,
  verification: { tutor: 'not_started', student: 'not_started', parent: 'not_started', coaching: 'not_started', admin: 'verified' },
  toasts: [],
})

type Store = State & {
  setRole: (r: Role) => void
  patchSignup: (p: Partial<Signup>) => void
  signIn: (r?: Role) => void
  setSession: (accessToken: string, refreshToken: string) => void
  setAuthenticatedUser: (user: ApiUser) => void
  signOut: () => void
  setVerification: (r: Role, v: VerifyState) => void
  toast: (text: string, tone?: Toast['tone']) => void
  dismissToast: (id: number) => void
  /** Whether the signed-in role's account is verified (or does not need verification). */
  isVerified: boolean
  /** True while a stored session is being checked against the backend on page load. */
  restoring: boolean
}

// Kept on globalThis so hot reloads in development reuse one context.
const g = globalThis as unknown as { __tuitionhubCtx?: React.Context<Store | null> }
const Ctx = (g.__tuitionhubCtx ??= createContext<Store | null>(null))
let tid = 1

export function StoreProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<State>(initial)
  const [restoring, setRestoring] = useState(() => hasSession())

  useEffect(() => {
    if (!restoring) return
    getCurrentUser()
      .then(({ user }) => setS((p) => ({ ...p, user, role: user.role, signedIn: true })))
      // An expired or revoked session is already cleared by the API client's
      // refresh step; a network failure keeps the tokens for the next load.
      .catch(() => setS((p) => ({ ...p, user: null, signedIn: false })))
      .finally(() => setRestoring(false))
  }, [restoring])

  const toast = useCallback((text: string, tone: Toast['tone'] = 'info') => {
    const id = tid++
    setS((p) => ({ ...p, toasts: [...p.toasts, { id, text, tone }] }))
    setTimeout(() => setS((p) => ({ ...p, toasts: p.toasts.filter((t) => t.id !== id) })), 4000)
  }, [])

  const value = useMemo<Store>(() => ({
    ...s,
    isVerified: s.verification[s.role] === 'verified',
    restoring,
    setRole: (role) => setS((p) => ({ ...p, role })),
    patchSignup: (patch) => setS((p) => ({ ...p, signup: { ...p.signup, ...patch } })),
    signIn: (role) => setS((p) => ({ ...p, signedIn: true, role: role ?? p.role })),
    // refreshToken is empty in cookie mode; the browser holds it in an httpOnly cookie.
    setSession: (accessToken, _refreshToken) => {
      saveTokens({ access_token: accessToken })
      setS((p) => ({ ...p, signedIn: true }))
    },
    setAuthenticatedUser: (user) => setS((p) => ({ ...p, user, role: user.role, signedIn: true })),
    signOut: () => {
      clearTokens()
      setS((p) => ({ ...p, user: null, signedIn: false }))
    },
    setVerification: (r, v) => setS((p) => (p.verification[r] === v ? p : { ...p, verification: { ...p.verification, [r]: v } })),
    toast,
    dismissToast: (id) => setS((p) => ({ ...p, toasts: p.toasts.filter((t) => t.id !== id) })),
  }), [s, toast, restoring])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore() {
  const c = useContext(Ctx)
  if (!c) throw new Error('StoreProvider missing')
  return c
}
