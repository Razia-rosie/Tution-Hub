export type ApiUser = {
  id: string
  name: string
  email: string
  phone?: string | null
  role: 'tutor' | 'student' | 'parent' | 'coaching'
  email_verified_at?: string | null
  created_at: string
}

export type Tokens = {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
}

type AuthResponse = { user: ApiUser; tokens: Tokens }

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  })
  const body = (await response.json().catch(() => ({}))) as { error?: string }
  if (!response.ok) throw new Error(body.error ?? 'The request could not be completed.')
  return body as T
}

export function registerAccount(input: { name: string; email: string; password: string; role: ApiUser['role'] }) {
  return request<AuthResponse>('/api/v1/auth/register', { method: 'POST', body: JSON.stringify(input) })
}

export function loginAccount(email: string, password: string) {
  return request<AuthResponse>('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
}

export function requestEmailVerification(email: string) {
  return request<{ message: string; development_token?: string }>('/api/v1/auth/verify-email/request', { method: 'POST', body: JSON.stringify({ email }) })
}

export function verifyEmail(token: string) {
  return request<{ message: string }>('/api/v1/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) })
}
