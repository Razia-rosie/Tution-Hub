export type ApiUser = {
  id: string
  name: string
  email: string
  phone?: string | null
  role: 'tutor' | 'student' | 'parent' | 'coaching' | 'admin'
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
const ACCESS_TOKEN_KEY = 'tuitionhub.access_token'
const REFRESH_TOKEN_KEY = 'tuitionhub.refresh_token'

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

export function saveTokens(tokens: Tokens) {
  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.access_token)
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token)
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

export function getStoredTokens(): Tokens | null {
  const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY)
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY)
  if (!accessToken || !refreshToken) return null
  return { access_token: accessToken, refresh_token: refreshToken, token_type: 'Bearer', expires_in: 0 }
}

export function getCurrentUser() {
  return authenticatedRequest<{ user: ApiUser }>('/api/v1/auth/me', { method: 'GET' })
}

// Access tokens are short-lived (15 minutes by default). Concurrent 401s share
// one refresh call because the backend rotates the refresh token on every use.
let refreshing: Promise<boolean> | null = null

function refreshSession(): Promise<boolean> {
  refreshing ??= (async () => {
    const tokens = getStoredTokens()
    if (!tokens) return false
    try {
      const { tokens: next } = await request<AuthResponse>('/api/v1/auth/refresh', { method: 'POST', body: JSON.stringify({ refresh_token: tokens.refresh_token }) })
      saveTokens(next)
      return true
    } catch {
      clearTokens()
      return false
    }
  })().finally(() => { refreshing = null })
  return refreshing
}

async function authorizedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const send = () => {
    const tokens = getStoredTokens()
    if (!tokens) throw new Error('No active session')
    return fetch(path, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${tokens.access_token}` } })
  }
  const response = await send()
  if (response.status !== 401 || !(await refreshSession())) return response
  return send()
}

export function revokeRefreshToken(refreshToken: string) {
  return request<void>('/api/v1/auth/logout', { method: 'POST', body: JSON.stringify({ refresh_token: refreshToken }) })
}

export async function logoutAccount() {
  const tokens = getStoredTokens()
  if (!tokens) return
  try {
    await request<void>('/api/v1/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: tokens.refresh_token }),
    })
  } finally {
    clearTokens()
  }
}

export type WorkflowProfile = {
  display_name?: string | null
  institution?: string | null
  education?: string | null
  subjects?: string[] | null
  classes?: string[] | null
  areas?: string[] | null
  completion_percent: number
}

export type WorkflowDashboard = {
  account: { id: string; role: ApiUser['role']; status: string; profile_complete: number }
  verification?: { id: string; user_id: string; status: string; submitted_at?: string | null; reviewed_at?: string | null; rejection_reason?: string | null; correction_request?: string | null } | null
  profile?: WorkflowProfile | null
}

async function authenticatedRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await authorizedFetch(path, { ...init, headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) } })
  const body = (await response.json().catch(() => ({}))) as { error?: string }
  if (!response.ok) throw new Error(body.error ?? 'The request could not be completed.')
  return body as T
}

// The account status tracks the whole lifecycle; the application status only
// covers the review step. Before anything is submitted, report not_started.
export function effectiveStatus(dashboard: WorkflowDashboard): string {
  const account = dashboard.account.status
  if (!dashboard.verification) return account === 'active' || account === 'suspended' ? account : 'not_started'
  if (account === 'pending') return dashboard.verification.status
  return account
}

export function getWorkflowDashboard() {
    return authenticatedRequest<WorkflowDashboard>('/api/v1/workflow/dashboard')
  }

export function updateProfile(input: Record<string, unknown>) {
    return authenticatedRequest<void>('/api/v1/workflow/profile', { method: 'PUT', body: JSON.stringify(input) })
  }

export function submitVerification() {
    return authenticatedRequest<{ verification: WorkflowDashboard['verification'] }>('/api/v1/workflow/verification/submit', { method: 'POST' })
  }

export async function uploadVerificationDocument(applicationId: string, documentType: string, file: File) {
    const body = new FormData()
    body.append('application_id', applicationId)
    body.append('document_type', documentType)
    body.append('document', file)
    const response = await authorizedFetch('/api/v1/workflow/verification/documents', { method: 'POST', body })
    const result = (await response.json().catch(() => ({}))) as { error?: string }
    if (!response.ok) throw new Error(result.error ?? 'The document could not be uploaded.')
  }

export function getNotifications() {
    return authenticatedRequest<{ notifications: Array<{ id: string; title: string; body: string; read_at?: string | null; created_at: string }> }>('/api/v1/workflow/notifications')
  }

export function getTuitionListings(filters: { subject?: string; class?: string; area?: string } = {}) {
    const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value))
    return authenticatedRequest<{ listings: Array<Record<string, unknown>> }>(`/api/v1/workflow/tuition${query.size ? `?${query}` : ''}`)
}

export type AdminApplication = {
  id: string
  user_id: string
  status: string
  submitted_at?: string | null
  reviewed_at?: string | null
  rejection_reason?: string | null
  correction_request?: string | null
  name: string
  email: string
  role: string
  account_status: string
  profile: Record<string, unknown>
  interviews: Array<{ id: string; mode: string; scheduled_at: string; location_or_link?: string | null; status: string; notes?: string | null }>
}

export function getAdminApplications(filters: { status?: string; role?: string } = {}) {
  const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value))
  return authenticatedRequest<{ applications: AdminApplication[] }>(`/api/v1/workflow/admin/verifications${query.size ? `?${query}` : ''}`)
}

export function getAdminDocuments(applicationId: string) {
  return authenticatedRequest<{ documents: Array<{ id: string; document_type: string; original_name: string; mime_type: string; byte_size: number; uploaded_at: string }> }>(`/api/v1/workflow/admin/verifications/${applicationId}/documents`)
}

export function reviewAdminApplication(applicationId: string, decision: 'approved' | 'rejected' | 'resubmission_required', reason: string) {
  return authenticatedRequest<void>(`/api/v1/workflow/admin/verifications/${applicationId}/decision`, { method: 'POST', body: JSON.stringify({ decision, reason }) })
}

export function scheduleAdminInterview(applicationId: string, input: { mode: 'online' | 'in_person'; scheduled_at: string; location_or_link?: string }) {
  return authenticatedRequest<void>(`/api/v1/workflow/admin/verifications/${applicationId}/interviews`, { method: 'POST', body: JSON.stringify(input) })
}

export function recordAdminInterviewOutcome(applicationId: string, interviewId: string, status: 'completed' | 'cancelled', notes: string) {
  return authenticatedRequest<void>(`/api/v1/workflow/admin/verifications/${applicationId}/interviews/${interviewId}/outcome`, { method: 'POST', body: JSON.stringify({ status, notes }) })
}

export async function fetchPrivateDocument(documentId: string) {
  const response = await authorizedFetch(`/api/v1/workflow/verification/documents/${documentId}`)
  if (!response.ok) throw new Error('The document could not be retrieved.')
  return URL.createObjectURL(await response.blob())
}
