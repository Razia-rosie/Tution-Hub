// End-to-end test of the TuitionHub API: authentication, manual picture-based
// verification for tutors and coaching centres, admin review, account
// management, notifications and role permissions.
//
// Run against an isolated database, never against data you care about: it
// registers new accounts (random emails) and records admin decisions.
//
//   E2E_API=http://localhost:8090 E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... node tests/verification-e2e.mjs
//
// The admin account must already exist (create it with cmd/bootstrap-admin).
// The API under test should run with SIGNUP_LIMIT_PER_IP raised (e.g. 1000) so
// repeated runs from one machine are not throttled; the login limit is tested
// at its production default of 5 failures per account.

import { readFileSync } from 'node:fs'

const API = process.env.E2E_API ?? 'http://localhost:8090'
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD are required')
  process.exit(2)
}

let pass = 0
let fail = 0
const failures = []
function check(name, ok, detail = '') {
  if (ok) { pass++; console.log('PASS', name) }
  else { fail++; failures.push(name); console.log('FAIL', name, detail) }
}

async function call(method, path, { token, body, form } = {}) {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  let payload
  if (form) payload = form
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body) }
  const res = await fetch(API + path, { method, headers, body: payload })
  const type = res.headers.get('content-type') ?? ''
  const data = type.includes('application/json') ? await res.json().catch(() => null) : Buffer.from(await res.arrayBuffer())
  return { status: res.status, data, type, headers: res.headers }
}

const run = Math.random().toString(36).slice(2, 8)
const password = `E2e-${Math.random().toString(36).slice(2)}-pw`
const email = (label) => `e2e-${label}-${run}@tuitionhub.test`

async function register(label, role) {
  const r = await call('POST', '/api/v1/auth/register', { body: { name: `E2E ${label}`, email: email(label), password, role } })
  return { ...r, token: r.data?.tokens?.access_token, refresh: r.data?.tokens?.refresh_token, user: r.data?.user }
}

const fixture = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url))
const PNG = fixture('id-card.png')
const JPEG = fixture('certificate.jpg')
const LARGE = fixture('large-photo.jpg')
const WEBP = fixture('tiny.webp')

const upload = (token, type, bytes, name, mime, applicationId) => {
  const form = new FormData()
  if (applicationId) form.append('application_id', applicationId)
  form.append('document_type', type)
  form.append('document', new Blob([bytes], { type: mime }), name)
  return call('POST', '/api/v1/workflow/verification/documents', { token, form })
}
const dashboard = (token) => call('GET', '/api/v1/workflow/dashboard', { token })
const submit = (token) => call('POST', '/api/v1/workflow/verification/submit', { token })
const saveProfile = (token, extra = {}) => call('PUT', '/api/v1/workflow/profile', { token, body: { display_name: 'E2E', education: 'BSc Physics, DU', subjects: ['Physics', 'Math'], classes: ['Class 9'], areas: ['Mirpur'], ...extra } })

async function main() {
  // ---------- Authentication ----------
  const tutor = await register('tutor', 'tutor')
  check('auth: tutor registers as pending', tutor.status === 201 && tutor.user?.role === 'tutor' && tutor.user.account_status === 'pending', JSON.stringify(tutor.data))
  const parentEarly = await register('parent0', 'parent')
  check('auth: parents start active (no verification)', parentEarly.user?.account_status === 'active')
  check('auth: duplicate email rejected', (await call('POST', '/api/v1/auth/register', { body: { name: 'Dup', email: email('tutor'), password, role: 'tutor' } })).status === 409)
  check('auth: cannot self-register as admin', (await call('POST', '/api/v1/auth/register', { body: { name: 'Evil', email: email('evil'), password, role: 'admin' } })).status === 400)
  check('auth: short password rejected', (await call('POST', '/api/v1/auth/register', { body: { name: 'Weak', email: email('weak'), password: 'short', role: 'tutor' } })).status === 400)
  check('auth: wrong password rejected', (await call('POST', '/api/v1/auth/login', { body: { email: email('tutor'), password: 'wrong-password-123' } })).status === 401)
  check('auth: unknown email gives the same 401', (await call('POST', '/api/v1/auth/login', { body: { email: email('nobody'), password: 'wrong-password-123' } })).status === 401)
  check('auth: /me without token is 401', (await call('GET', '/api/v1/auth/me')).status === 401)
  check('auth: /me with garbage token is 401', (await call('GET', '/api/v1/auth/me', { token: 'not.a.jwt' })).status === 401)
  check('auth: workflow without token is 401', (await call('GET', '/api/v1/workflow/dashboard')).status === 401)
  const refreshed = await call('POST', '/api/v1/auth/refresh', { body: { refresh_token: tutor.refresh } })
  check('auth: refresh rotates tokens', refreshed.status === 200 && refreshed.data?.tokens?.refresh_token !== tutor.refresh)
  tutor.token = refreshed.data.tokens.access_token
  tutor.refresh = refreshed.data.tokens.refresh_token

  const victim = await register('ratelimit', 'student')
  const codes = []
  for (let i = 0; i < 6; i++) codes.push((await call('POST', '/api/v1/auth/login', { body: { email: email('ratelimit'), password: 'wrong-password-x' } })).status)
  check('auth: 6th failed login for one account is 429', codes.slice(0, 5).every((c) => c === 401) && codes[5] === 429, JSON.stringify(codes))
  const locked = await call('POST', '/api/v1/auth/login', { body: { email: email('ratelimit'), password } })
  check('auth: correct password refused during lockout', locked.status === 429 && locked.headers.get('retry-after'), `status ${locked.status}`)
  check('auth: lockout is per account, not global', (await call('POST', '/api/v1/auth/login', { body: { email: email('tutor'), password } })).status === 200)
  void victim

  // ---------- Tutor: before submission ----------
  let dash = await dashboard(tutor.token)
  check('tutor: dashboard before anything', dash.status === 200 && dash.data.verification === null && dash.data.profile === null && dash.data.documents.length === 0, JSON.stringify(dash.data))
  check('tutor: requirements list identity (required) and education (optional)', dash.data.requirements?.find((r) => r.type === 'identity')?.required === true && dash.data.requirements.find((r) => r.type === 'education')?.required === false)
  let sub = await submit(tutor.token)
  check('tutor: empty submit is 422 with what is missing', sub.status === 422 && sub.data.missing?.length === 2, JSON.stringify(sub.data))
  check('tutor: tuition blocked until verified', (await call('GET', '/api/v1/workflow/tuition', { token: tutor.token })).status === 403)
  check('tutor: admin endpoints forbidden', (await call('GET', '/api/v1/workflow/admin/verifications', { token: tutor.token })).status === 403 && (await call('GET', '/api/v1/workflow/admin/users', { token: tutor.token })).status === 403 && (await call('GET', '/api/v1/workflow/admin/audit-logs', { token: tutor.token })).status === 403)
  check('tutor: unknown profile field rejected', (await call('PUT', '/api/v1/workflow/profile', { token: tutor.token, body: { role: 'admin' } })).status === 400)

  // ---------- Pictures ----------
  let up = await upload(tutor.token, 'identity', PNG, 'nid.png', 'image/png')
  check('pictures: PNG accepted and draft created', up.status === 201 && up.data.document?.mime_type === 'image/png', JSON.stringify(up.data))
  const tutorApp = up.data.document.application_id
  dash = await dashboard(tutor.token)
  check('pictures: application is a draft with 1 picture', dash.data.verification?.status === 'draft' && dash.data.documents.length === 1)
  check('pictures: WebP accepted', (await upload(tutor.token, 'education', WEBP, 'cert.webp', 'image/webp')).status === 201)
  const bad = {
    'text named .png': [Buffer.from('hello, not an image at all'), 'fake.png', 'image/png'],
    'SVG': [Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), 'x.svg', 'image/svg+xml'],
    'PDF': [Buffer.from('%PDF-1.4\n%%EOF'), 'x.pdf', 'application/pdf'],
    'Word document': [Buffer.from('PK\x03\x04word/document.xml'), 'x.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    'GIF': [Buffer.from('GIF89a\x01\x00\x01\x00\x00\x00\x00;'), 'x.gif', 'image/gif'],
    'WebP header with no image': [Buffer.concat([Buffer.from('RIFF'), Buffer.from([0x1a, 0, 0, 0]), Buffer.from('WEBPVP8 '), Buffer.alloc(16)]), 'x.webp', 'image/webp'],
    'truncated PNG': [PNG.subarray(0, Math.floor(PNG.length / 2)), 'cut.png', 'image/png'],
    'JPEG header + junk': [Buffer.concat([JPEG.subarray(0, 20), Buffer.alloc(300)]), 'junk.jpg', 'image/jpeg'],
  }
  for (const [name, [bytes, file, mime]] of Object.entries(bad)) {
    check(`pictures: ${name} rejected`, (await upload(tutor.token, 'identity', bytes, file, mime)).status === 400)
  }
  const big = await upload(tutor.token, 'identity', Buffer.concat([PNG, Buffer.alloc(11 * 1024 * 1024)]), 'big.png', 'image/png')
  check('pictures: file over 10 MB rejected', big.status === 400 || big.status === 413, `status ${big.status}`)
  check('pictures: document type of another role rejected', (await upload(tutor.token, 'trade_license', PNG, 'x.png', 'image/png')).status === 400)
  check('pictures: large 3000x2000 photo accepted', (await upload(tutor.token, 'identity', LARGE, 'nid-photo.jpg', 'image/jpeg')).status === 201)
  check('pictures: replacing a picture keeps one per type', (await upload(tutor.token, 'identity', JPEG, 'nid.jpg', 'image/jpeg')).status === 201 && (await dashboard(tutor.token)).data.documents.length === 2)

  // ---------- Submit and freeze ----------
  sub = await submit(tutor.token)
  check('tutor: submit without profile is 422 naming the profile', sub.status === 422 && sub.data.missing?.length === 1, JSON.stringify(sub.data))
  check('tutor: profile saved', (await saveProfile(tutor.token)).status === 204)
  dash = await dashboard(tutor.token)
  check('tutor: profile returned for prefill', dash.data.profile?.education === 'BSc Physics, DU' && dash.data.account.profile_complete === 100)
  sub = await submit(tutor.token)
  check('tutor: submit accepted -> pending', sub.status === 202 && sub.data.verification.status === 'pending' && sub.data.verification.submitted_at, JSON.stringify(sub.data))
  check('tutor: pictures frozen while pending', (await upload(tutor.token, 'identity', PNG, 'x.png', 'image/png')).status === 409)
  check('tutor: profile frozen while pending', (await saveProfile(tutor.token, { education: 'changed' })).status === 409)
  check('tutor: cannot submit twice', (await submit(tutor.token)).status === 409)

  // ---------- Coaching ----------
  const coaching = await register('coaching', 'coaching')
  check('coaching: registers as pending', coaching.status === 201 && coaching.user.account_status === 'pending')
  check('coaching: tutor document type rejected', (await upload(coaching.token, 'identity', PNG, 'x.png', 'image/png')).status === 400)
  check('coaching: trade licence accepted', (await upload(coaching.token, 'trade_license', JPEG, 'licence.jpg', 'image/jpeg')).status === 201)
  await saveProfile(coaching.token, { institution: 'E2E Coaching Centre' })
  sub = await submit(coaching.token)
  check('coaching: submit without owner ID is 422', sub.status === 422 && sub.data.missing?.some((m) => /owner/i.test(m)), JSON.stringify(sub.data))
  check('coaching: owner ID accepted', (await upload(coaching.token, 'owner_identity', PNG, 'owner.png', 'image/png')).status === 201)
  sub = await submit(coaching.token)
  check('coaching: submit accepted', sub.status === 202)
  const coachingApp = sub.data.verification.id
  check('pictures: cannot upload into another user\'s application', (await upload(coaching.token, 'trade_license', PNG, 'x.png', 'image/png', tutorApp)).status === 403)

  // ---------- Students and parents are not verified ----------
  const student = await register('student', 'student')
  check('student: starts active', student.user.account_status === 'active')
  check('student: cannot upload verification pictures', (await upload(student.token, 'identity', PNG, 'x.png', 'image/png')).status === 403)
  check('student: cannot submit verification', (await submit(student.token)).status === 403)
  check('parent: cannot submit verification', (await submit(parentEarly.token)).status === 403)

  // A draft that was never submitted must not reach the review queue.
  const drafter = await register('drafter', 'tutor')
  await upload(drafter.token, 'identity', PNG, 'x.png', 'image/png')

  // ---------- Admin ----------
  const adminLogin = await call('POST', '/api/v1/auth/login', { body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } })
  check('admin: login', adminLogin.status === 200 && adminLogin.data.user?.role === 'admin')
  const admin = adminLogin.data.tokens.access_token

  let list = await call('GET', '/api/v1/workflow/admin/verifications?status=pending', { token: admin })
  const ids = (list.data?.applications ?? []).map((a) => a.id)
  check('admin: pending queue has tutor and coaching', ids.includes(tutorApp) && ids.includes(coachingApp))
  list = await call('GET', '/api/v1/workflow/admin/verifications', { token: admin })
  check('admin: unsubmitted drafts are not listed', !(list.data.applications ?? []).some((a) => a.email === email('drafter')))
  const row = list.data.applications.find((a) => a.id === tutorApp)
  check('admin: row has profile, counts and dates', row?.profile?.education === 'BSc Physics, DU' && row.submission_count === 1 && row.document_count === 2 && row.submitted_at, JSON.stringify(row))
  list = await call('GET', '/api/v1/workflow/admin/verifications?role=coaching', { token: admin })
  check('admin: role filter', list.data.applications.every((a) => a.role === 'coaching') && list.data.applications.some((a) => a.id === coachingApp))

  const docs = await call('GET', `/api/v1/workflow/admin/verifications/${tutorApp}/documents`, { token: admin })
  const identity = docs.data.documents.find((d) => d.document_type === 'identity')
  check('admin: latest identity picture listed', docs.data.documents.length === 2 && identity?.original_name === 'nid.jpg' && !('storage_key' in identity))
  const dl = await call('GET', `/api/v1/workflow/verification/documents/${identity.id}`, { token: admin })
  check('documents: admin preview returns the exact bytes', dl.status === 200 && dl.type.startsWith('image/jpeg') && Buffer.compare(dl.data, JPEG) === 0)
  check('documents: served private, no-store, nosniff, sandboxed', /no-store/.test(dl.headers.get('cache-control') ?? '') && dl.headers.get('x-content-type-options') === 'nosniff' && /sandbox/.test(dl.headers.get('content-security-policy') ?? ''))
  check('documents: owner can view own picture', (await call('GET', `/api/v1/workflow/verification/documents/${identity.id}`, { token: tutor.token })).status === 200)
  check('documents: other users get 404', (await call('GET', `/api/v1/workflow/verification/documents/${identity.id}`, { token: coaching.token })).status === 404)
  check('documents: anonymous gets 401', (await call('GET', `/api/v1/workflow/verification/documents/${identity.id}`)).status === 401)

  const decide = (app, decision, reason) => call('POST', `/api/v1/workflow/admin/verifications/${app}/decision`, { token: admin, body: { decision, reason } })
  check('review: reject without a real reason is 400', (await decide(coachingApp, 'rejected', 'no')).status === 400)
  check('review: unknown decision is 400', (await decide(coachingApp, 'maybe', 'a long enough reason')).status === 400)
  check('review: unknown application is 404', (await decide('00000000-0000-0000-0000-000000000000', 'approved', '')).status === 404)
  check('review: tutors cannot decide', (await call('POST', `/api/v1/workflow/admin/verifications/${coachingApp}/decision`, { token: tutor.token, body: { decision: 'approved' } })).status === 403)

  // Reject coaching
  check('review: reject coaching', (await decide(coachingApp, 'rejected', 'Trade licence could not be verified.')).status === 204)
  check('review: decided application cannot be decided again', (await decide(coachingApp, 'approved', '')).status === 409)
  dash = await dashboard(coaching.token)
  check('coaching: sees rejection and reason', dash.data.account.status === 'rejected' && dash.data.verification.rejection_reason === 'Trade licence could not be verified.')
  check('coaching: rejection is final (no resubmit)', (await submit(coaching.token)).status === 409)
  check('coaching: no picture changes after rejection', (await upload(coaching.token, 'trade_license', PNG, 'x.png', 'image/png')).status === 409)
  let notes = await call('GET', '/api/v1/workflow/notifications', { token: coaching.token })
  check('coaching: rejection notification', notes.data.notifications?.some((n) => n.title === 'Verification rejected'))

  // Corrections for tutor
  check('review: request corrections from tutor', (await decide(tutorApp, 'resubmission_required', 'Please upload a clearer NID photo.')).status === 204)
  dash = await dashboard(tutor.token)
  check('tutor: sees correction request', dash.data.account.status === 'resubmission_required' && dash.data.verification.correction_request === 'Please upload a clearer NID photo.')
  check('tutor: can replace pictures during corrections', (await upload(tutor.token, 'identity', PNG, 'nid-clear.png', 'image/png')).status === 201)
  check('tutor: can edit details during corrections', (await saveProfile(tutor.token, { education: 'BSc Physics, University of Dhaka' })).status === 204)
  const resub = await submit(tutor.token)
  check('tutor: resubmits -> pending again', resub.status === 202 && resub.data.verification.status === 'pending' && !resub.data.verification.correction_request)
  list = await call('GET', '/api/v1/workflow/admin/verifications?status=pending', { token: admin })
  check('admin: resubmission visible with count 2', list.data.applications.find((a) => a.id === tutorApp)?.submission_count === 2)

  // Interviews (optional manual step)
  const schedule = (app, at, mode = 'online') => call('POST', `/api/v1/workflow/admin/verifications/${app}/interviews`, { token: admin, body: { mode, scheduled_at: at, location_or_link: 'https://meet.example.test/e2e' } })
  const future = new Date(Date.now() + 86400000).toISOString()
  check('interview: past date rejected', (await schedule(tutorApp, new Date(Date.now() - 86400000).toISOString())).status === 400)
  check('interview: cannot schedule on rejected application', (await schedule(coachingApp, future)).status === 409)
  check('interview: scheduled', (await schedule(tutorApp, future)).status === 201)
  list = await call('GET', '/api/v1/workflow/admin/verifications?role=tutor&status=pending', { token: admin })
  const iv = list.data.applications.find((a) => a.id === tutorApp)?.interviews ?? []
  check('interview: listed with ISO date', iv.length === 1 && iv[0].scheduled_at.endsWith('Z'))
  check('interview: completed', (await call('POST', `/api/v1/workflow/admin/verifications/${tutorApp}/interviews/${iv[0].id}/outcome`, { token: admin, body: { status: 'completed', notes: 'ok' } })).status === 204)

  // Approve tutor
  check('review: approve tutor', (await decide(tutorApp, 'approved', '')).status === 204)
  dash = await dashboard(tutor.token)
  check('tutor: approved -> active', dash.data.account.status === 'active' && dash.data.verification.status === 'approved')
  check('tutor: restricted feature unlocked', (await call('GET', '/api/v1/workflow/tuition', { token: tutor.token })).status === 200)
  check('tutor: approved cannot resubmit', (await submit(tutor.token)).status === 409)
  check('tutor: pictures locked after approval', (await upload(tutor.token, 'identity', PNG, 'x.png', 'image/png')).status === 409)

  // History and audit
  const hist = await call('GET', `/api/v1/workflow/admin/verifications/${tutorApp}/history`, { token: admin })
  const actions = (hist.data.history ?? []).map((h) => h.action)
  check('history: full trail in order', ['document_uploaded', 'verification_submitted', 'verification_resubmission_required', 'verification_resubmitted', 'interview_scheduled', 'interview_completed', 'verification_approved'].every((a) => actions.includes(a)) && actions.indexOf('verification_submitted') < actions.indexOf('verification_approved'), JSON.stringify(actions))
  check('history: admin picture views are audited', actions.includes('document_viewed'))
  const audit = await call('GET', '/api/v1/workflow/admin/audit-logs?action=verification_rejected', { token: admin })
  check('audit: decisions listed with actor and subject', audit.data.entries?.some((e) => e.subject_name === 'E2E coaching' && e.actor_role === 'admin' && e.metadata?.reason))

  // Notifications
  notes = await call('GET', '/api/v1/workflow/notifications', { token: tutor.token })
  const titles = (notes.data.notifications ?? []).map((n) => n.title)
  check('notifications: corrections, interview, approval', ['Corrections requested', 'Interview scheduled', 'Verification approved'].every((t) => titles.includes(t)), JSON.stringify(titles))
  const first = notes.data.notifications[0]
  check('notifications: mark one read', (await call('POST', '/api/v1/workflow/notifications/read', { token: tutor.token, body: { id: first.id } })).status === 204)
  check('notifications: cannot mark someone else\'s', (await call('POST', '/api/v1/workflow/notifications/read', { token: coaching.token, body: { id: first.id } })).status === 404)
  await call('POST', '/api/v1/workflow/notifications/read', { token: tutor.token, body: {} })
  notes = await call('GET', '/api/v1/workflow/notifications', { token: tutor.token })
  check('notifications: mark all read', notes.data.notifications.every((n) => n.read_at))

  // Admin: stats, users, suspension
  const stats = await call('GET', '/api/v1/workflow/admin/stats', { token: admin })
  check('admin: stats', stats.status === 200 && stats.data.users_by_role.tutor >= 2 && typeof stats.data.applications_by_status === 'object')
  const users = await call('GET', `/api/v1/workflow/admin/users?q=${encodeURIComponent(run)}&role=tutor`, { token: admin })
  check('admin: user search by run id and role', users.status === 200 && users.data.total === 2 && users.data.users.every((u) => u.role === 'tutor'), JSON.stringify(users.data).slice(0, 200))
  const target = student.user.id
  check('admin: suspension needs a reason', (await call('POST', `/api/v1/workflow/admin/users/${target}/suspend`, { token: admin, body: { reason: 'x' } })).status === 400)
  check('admin: suspend student', (await call('POST', `/api/v1/workflow/admin/users/${target}/suspend`, { token: admin, body: { reason: 'Reported for abusive messages' } })).status === 204)
  check('suspended: existing token blocked at once', (await dashboard(student.token)).status === 403)
  check('suspended: refresh blocked', (await call('POST', '/api/v1/auth/refresh', { body: { refresh_token: student.refresh } })).status !== 200)
  check('suspended: login refused with 403', (await call('POST', '/api/v1/auth/login', { body: { email: email('student'), password } })).status === 403)
  check('admin: reactivate student', (await call('POST', `/api/v1/workflow/admin/users/${target}/reactivate`, { token: admin })).status === 204)
  const back = await call('POST', '/api/v1/auth/login', { body: { email: email('student'), password } })
  check('reactivated: can sign in, status restored', back.status === 200 && back.data.user.account_status === 'active')
  const adminId = adminLogin.data.user.id
  check('admin: cannot suspend an administrator', (await call('POST', `/api/v1/workflow/admin/users/${adminId}/suspend`, { token: admin, body: { reason: 'Trying to lock myself out' } })).status === 403)

  // Relationships
  const parent = await register('parent', 'parent')
  check('relationship: parent links student', (await call('POST', '/api/v1/workflow/relationships', { token: parent.token, body: { student_id: student.user.id, relationship: 'mother' } })).status === 201)
  check('relationship: tutor cannot link student', (await call('POST', '/api/v1/workflow/relationships', { token: tutor.token, body: { student_id: student.user.id, relationship: 'tutor' } })).status === 403)

  // Logout and token reuse
  const out = await call('POST', '/api/v1/auth/login', { body: { email: email('parent'), password } })
  check('auth: logout', (await call('POST', '/api/v1/auth/logout', { body: { refresh_token: out.data.tokens.refresh_token } })).status < 300)
  check('auth: refresh after logout is 401', (await call('POST', '/api/v1/auth/refresh', { body: { refresh_token: out.data.tokens.refresh_token } })).status === 401)
  const r1 = await call('POST', '/api/v1/auth/refresh', { body: { refresh_token: tutor.refresh } })
  await call('POST', '/api/v1/auth/refresh', { body: { refresh_token: tutor.refresh } })
  check('auth: replaying a rotated refresh token revokes the newer one too', (await call('POST', '/api/v1/auth/refresh', { body: { refresh_token: r1.data.tokens.refresh_token } })).status === 401)

  console.log(`\nrun ${run}: ${pass} pass, ${fail} fail`)
  if (fail) { console.log('Failed:', failures.join('; ')); process.exit(1) }
}

main().catch((e) => { console.error(e); process.exit(1) })
