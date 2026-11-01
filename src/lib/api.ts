export type ApiUser = {
  id: string
  name: string
  email: string
  phone?: string | null
  role: 'tutor' | 'student' | 'parent' | 'coaching' | 'admin'
  account_status?: string
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

// Session model: the refresh token lives in an httpOnly cookie the browser
// script cannot read; the short-lived access token is kept only in memory.
// SESSION_FLAG merely remembers that a cookie session may exist, so a reload
// knows to try a silent refresh. LEGACY_* keys are from the earlier
// localStorage scheme and are migrated once, then deleted.
const SESSION_FLAG = 'tuitionhub.session'
const LEGACY_ACCESS = 'tuitionhub.access_token'
const LEGACY_REFRESH = 'tuitionhub.refresh_token'
const COOKIE_MODE = { 'X-Session-Mode': 'cookie' }
let accessToken: string | null = null

const storage = {
  get: (k: string) => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* private mode */ } },
  del: (k: string) => { try { localStorage.removeItem(k) } catch { /* private mode */ } },
}

/** An API failure with the HTTP status and any extra fields the server sent (e.g. `missing`). */
export class ApiError extends Error {
  status: number
  details: Record<string, unknown>
  constructor(status: number, body: Record<string, unknown>) {
    super(typeof body.error === 'string' ? body.error : status === 429 ? 'Too many attempts. Please wait and try again.' : 'The request could not be completed.')
    this.status = status
    this.details = body
  }
}

async function parse<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>
  if (!response.ok) throw new ApiError(response.status, body)
  return body as T
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  })
  return parse<T>(response)
}

export function registerAccount(input: { name: string; email: string; password: string; role: ApiUser['role'] }) {
  return request<AuthResponse>('/api/v1/auth/register', { method: 'POST', headers: COOKIE_MODE, body: JSON.stringify(input) })
}

export function loginAccount(email: string, password: string) {
  return request<AuthResponse>('/api/v1/auth/login', { method: 'POST', headers: COOKIE_MODE, body: JSON.stringify({ email, password }) })
}

export function requestEmailVerification(email: string) {
  return request<{ message: string; development_token?: string }>('/api/v1/auth/verify-email/request', { method: 'POST', body: JSON.stringify({ email }) })
}

export function verifyEmail(token: string) {
  return request<{ message: string }>('/api/v1/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) })
}

/** Keeps the access token in memory; the refresh token is already in the httpOnly cookie. */
export function saveTokens(tokens: Pick<Tokens, 'access_token'>) {
  accessToken = tokens.access_token
  storage.set(SESSION_FLAG, '1')
  storage.del(LEGACY_ACCESS)
  storage.del(LEGACY_REFRESH)
}

export function clearTokens() {
  accessToken = null
  storage.del(SESSION_FLAG)
  storage.del(LEGACY_ACCESS)
  storage.del(LEGACY_REFRESH)
}

/** Whether a session may exist (signed in now, or a cookie session to restore). */
export function hasSession() {
  return !!accessToken || storage.get(SESSION_FLAG) === '1' || !!storage.get(LEGACY_REFRESH)
}

export function getCurrentUser() {
  return authenticatedRequest<{ user: ApiUser }>('/api/v1/auth/me', { method: 'GET' })
}

// Access tokens are short-lived (15 minutes by default). Concurrent 401s share
// one refresh call because the backend rotates the refresh token on every use.
let refreshing: Promise<boolean> | null = null

function refreshSession(): Promise<boolean> {
  refreshing ??= (async () => {
    if (!hasSession()) return false
    // A legacy token from the old scheme is sent once in the body; the response sets the cookie.
    const legacy = storage.get(LEGACY_REFRESH)
    try {
      const { tokens } = await request<AuthResponse>('/api/v1/auth/refresh', { method: 'POST', headers: COOKIE_MODE, body: JSON.stringify(legacy ? { refresh_token: legacy } : {}) })
      saveTokens(tokens)
      return true
    } catch {
      clearTokens()
      return false
    }
  })().finally(() => { refreshing = null })
  return refreshing
}

async function authorizedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  if (!accessToken && !(await refreshSession())) throw new ApiError(401, { error: 'Please sign in again.' })
  const send = () => fetch(path, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${accessToken}` } })
  const response = await send()
  if (response.status === 403) {
    // A suspended account is blocked on every request; end the local session instead of showing broken screens.
    const body = (await response.clone().json().catch(() => ({}))) as { error?: string }
    if (body.error?.includes('suspended')) {
      clearTokens()
      window.location.assign('/login')
    }
    return response
  }
  if (response.status !== 401 || !(await refreshSession())) return response
  return send()
}

/** Ends the session that the cookie identifies (e.g. a non-admin who used the admin sign-in). */
export function revokeRefreshToken() {
  return request<void>('/api/v1/auth/logout', { method: 'POST', headers: COOKIE_MODE, body: '{}' })
}

export async function logoutAccount() {
  try {
    await request<void>('/api/v1/auth/logout', { method: 'POST', headers: COOKIE_MODE, body: JSON.stringify(storage.get(LEGACY_REFRESH) ? { refresh_token: storage.get(LEGACY_REFRESH) } : {}) })
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

export type VerificationDocument = { id: string; application_id: string; document_type: string; original_name: string; mime_type: string; byte_size: number; uploaded_at: string }
export type DocumentRequirement = { type: string; label: string; required: boolean }

export type WorkflowDashboard = {
  account: { id: string; name: string; role: ApiUser['role']; status: string; profile_complete: number }
  documents?: VerificationDocument[]
  requirements?: DocumentRequirement[] | null
  verification?: { id: string; user_id: string; status: string; submitted_at?: string | null; reviewed_at?: string | null; rejection_reason?: string | null; correction_request?: string | null } | null
  profile?: WorkflowProfile | null
}

async function authenticatedRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await authorizedFetch(path, { ...init, headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) } })
  return parse<T>(response)
}

// The account status tracks the whole lifecycle; the application status only
// covers the review step. Before anything is submitted, report not_started.
export function effectiveStatus(dashboard: WorkflowDashboard): string {
  const account = dashboard.account.status
  // Every public role is verified by hand. Parents and students who joined
  // before family verification are already active and stay so.
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

/** Uploads one verification picture. The server creates a draft application on the first upload. */
export async function uploadVerificationDocument(documentType: string, file: File) {
  const body = new FormData()
  body.append('document_type', documentType)
  body.append('document', file)
  const response = await authorizedFetch('/api/v1/workflow/verification/documents', { method: 'POST', body })
  return parse<{ document: VerificationDocument }>(response)
}

export type AppNotification = { id: string; kind: string; title: string; body: string; read_at?: string | null; created_at: string }

export function getNotifications() {
  return authenticatedRequest<{ notifications: AppNotification[] | null }>('/api/v1/workflow/notifications')
}

export function markNotificationsRead(id?: string) {
  return authenticatedRequest<void>('/api/v1/workflow/notifications/read', { method: 'POST', body: JSON.stringify(id ? { id } : {}) })
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
  submission_count: number
  document_count: number
  interviews: Array<{ id: string; mode: string; scheduled_at: string; location_or_link?: string | null; status: string; notes?: string | null }>
  /** Parent applications carry their child invitations; student applications the inviting parent. */
  family?: { invitations?: StudentInvitation[]; parent?: ParentLink | null }
}

/** A parent's request for a student account for their child. `expired` is computed by the server. */
export type StudentInvitation = {
  id: string
  parent_id: string
  child_email: string
  child_name?: string | null
  relationship: string
  status: 'pending_approval' | 'approved' | 'expired' | 'rejected' | 'registered' | 'cancelled'
  rejection_reason?: string | null
  reviewed_at?: string | null
  expires_at?: string | null
  registered_at?: string | null
  created_at: string
  student_id?: string | null
  student_name?: string | null
  student_account_status?: string | null
  student_verification_id?: string | null
  student_verification_status?: string | null
  student_rejection_reason?: string | null
  student_correction_request?: string | null
  student_submitted_at?: string | null
  link_status?: string | null
}

export type AdminStudentInvitation = StudentInvitation & {
  parent_name: string
  parent_email: string
  parent_account_status: string
  parent_verification_id?: string | null
  parent_verification_status?: string | null
}

export type ParentLink = {
  invitation_id: string
  invited_email: string
  relationship: string
  parent_id: string
  parent_name: string
  parent_email?: string
  parent_account_status: string
  parent_verification_status?: string | null
  link_status?: string | null
  registered_at?: string | null
}

export function getFamily() {
  return authenticatedRequest<{ invitations?: StudentInvitation[]; parent?: ParentLink | null }>('/api/v1/workflow/family')
}

export function createStudentInvitation(input: { child_email: string; child_name?: string; relationship: string }) {
  return authenticatedRequest<{ invitation: StudentInvitation }>('/api/v1/workflow/family/invitations', { method: 'POST', body: JSON.stringify(input) })
}

export function cancelStudentInvitation(id: string) {
  return authenticatedRequest<void>(`/api/v1/workflow/family/invitations/${id}/cancel`, { method: 'POST' })
}

/** Whether an email may be used to register a student. The email is sent in the body, not the URL. */
export function checkStudentInvitation(email: string) {
  return request<{ allowed: boolean; code?: string; message?: string }>('/api/v1/auth/student-invitation/check', { method: 'POST', body: JSON.stringify({ email }) })
}

export function getAdminStudentInvitations(status = '') {
  return authenticatedRequest<{ invitations: AdminStudentInvitation[] }>(`/api/v1/workflow/admin/student-invitations${status ? `?status=${encodeURIComponent(status)}` : ''}`)
}

export function reviewStudentInvitation(id: string, decision: 'approved' | 'rejected', reason: string) {
  return authenticatedRequest<void>(`/api/v1/workflow/admin/student-invitations/${id}/decision`, { method: 'POST', body: JSON.stringify({ decision, reason }) })
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

export type AuditEntry = { id: string; action: string; metadata: Record<string, unknown>; created_at: string; actor_id?: string | null; actor_name?: string | null; actor_role?: string | null; subject_id?: string | null; subject_name?: string | null }

export function getApplicationHistory(applicationId: string) {
  return authenticatedRequest<{ history: AuditEntry[] }>(`/api/v1/workflow/admin/verifications/${applicationId}/history`)
}

export type AdminStats = { users_by_role: Record<string, number>; users_by_status: Record<string, number>; applications_by_status: Record<string, number>; oldest_pending_at?: string | null; signups_last_7_days: number; decisions_last_7_days: number }

export function getAdminStats() {
  return authenticatedRequest<AdminStats>('/api/v1/workflow/admin/stats')
}

export type AdminUser = { id: string; name: string; email: string; phone?: string | null; role: ApiUser['role']; account_status: string; email_verified_at?: string | null; created_at: string; verification_status?: string | null }

export function getAdminUsers(filters: { role?: string; status?: string; q?: string; limit?: number; offset?: number }) {
  const query = new URLSearchParams(Object.entries(filters).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)]))
  return authenticatedRequest<{ users: AdminUser[]; total: number }>(`/api/v1/workflow/admin/users?${query}`)
}

export function setUserSuspended(userId: string, suspend: boolean, reason = '') {
  return authenticatedRequest<void>(`/api/v1/workflow/admin/users/${userId}/${suspend ? 'suspend' : 'reactivate'}`, { method: 'POST', body: JSON.stringify({ reason }) })
}

export function getAuditLog(filters: { action?: string; limit?: number; offset?: number } = {}) {
  const query = new URLSearchParams(Object.entries(filters).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)]))
  return authenticatedRequest<{ entries: AuditEntry[] }>(`/api/v1/workflow/admin/audit-logs?${query}`)
}

/**
 * Generic access to the platform API, sharing the token refresh above.
 * Public endpoints work signed out; when signed in they personalise results.
 */
export const api = {
  get: <T,>(path: string) => (hasSession() ? authenticatedRequest<T>(path) : request<T>(path, { method: 'GET' })),
  // Signed-out callers (forgot password, contact, recovery) post without a token.
  post: <T = void,>(path: string, body?: unknown) => {
    const init = { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }
    return hasSession() ? authenticatedRequest<T>(path, init) : request<T>(path, init)
  },
  put: <T = void,>(path: string, body: unknown) => authenticatedRequest<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  del: <T = void,>(path: string) => authenticatedRequest<T>(path, { method: 'DELETE' }),
  /** Multipart upload (no JSON content type, so the browser sets the boundary). */
  form: async <T = void,>(path: string, form: FormData) => parse<T>(await authorizedFetch(path, { method: 'POST', body: form })),
  /** Fetches a private file and returns an object URL; the caller revokes it. */
  blobUrl: async (path: string) => {
    const response = await authorizedFetch(path)
    if (!response.ok) throw new ApiError(response.status, {})
    return URL.createObjectURL(await response.blob())
  },
}
