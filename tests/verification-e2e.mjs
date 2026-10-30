// End-to-end test of the verification workflow API.
//
// Run against an isolated database, never against data you care about: it
// registers new accounts (random emails) and records admin decisions.
//
//   E2E_API=http://localhost:8090 E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... node tests/verification-e2e.mjs
//
// The admin account must already exist (create it with cmd/bootstrap-admin).

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
  return { status: res.status, data, type }
}

const run = Math.random().toString(36).slice(2, 8)
const password = `E2e-${Math.random().toString(36).slice(2)}-pw`
const email = (label) => `e2e-${label}-${run}@tuitionhub.test`

async function register(label, role) {
  const r = await call('POST', '/api/v1/auth/register', { body: { name: `E2E ${label}`, email: email(label), password, role } })
  return { ...r, token: r.data?.tokens?.access_token, refresh: r.data?.tokens?.refresh_token, user: r.data?.user }
}

// Minimal valid images, identified by content sniffing on the server.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]), Buffer.alloc(64), Buffer.from([0xff, 0xd9])])
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0x1a, 0, 0, 0]), Buffer.from('WEBPVP8 '), Buffer.alloc(16)])

function docForm(applicationId, type, bytes, filename, mime) {
  const form = new FormData()
  form.append('application_id', applicationId)
  form.append('document_type', type)
  form.append('document', new Blob([bytes], { type: mime }), filename)
  return form
}

async function main() {
  // ---------- Authentication ----------
  const tutor = await register('tutor', 'tutor')
  check('auth: tutor registers', tutor.status === 201 && tutor.user?.role === 'tutor', JSON.stringify(tutor.data))
  check('auth: duplicate email rejected', (await call('POST', '/api/v1/auth/register', { body: { name: 'Dup', email: email('tutor'), password, role: 'tutor' } })).status === 409)
  check('auth: cannot self-register as admin', (await call('POST', '/api/v1/auth/register', { body: { name: 'Evil', email: email('evil'), password, role: 'admin' } })).status === 400)
  check('auth: short password rejected', (await call('POST', '/api/v1/auth/register', { body: { name: 'Weak', email: email('weak'), password: 'short', role: 'tutor' } })).status === 400)
  check('auth: wrong password rejected', (await call('POST', '/api/v1/auth/login', { body: { email: email('tutor'), password: 'wrong-password-123' } })).status === 401)
  check('auth: /me without token is 401', (await call('GET', '/api/v1/auth/me')).status === 401)
  check('auth: /me with garbage token is 401', (await call('GET', '/api/v1/auth/me', { token: 'not.a.jwt' })).status === 401)
  check('auth: workflow without token is 401', (await call('GET', '/api/v1/workflow/dashboard')).status === 401)

  const refreshed = await call('POST', '/api/v1/auth/refresh', { body: { refresh_token: tutor.refresh } })
  check('auth: refresh issues new tokens', refreshed.status === 200 && refreshed.data?.tokens?.refresh_token && refreshed.data.tokens.refresh_token !== tutor.refresh)
  check('auth: reused refresh token is rejected', (await call('POST', '/api/v1/auth/refresh', { body: { refresh_token: tutor.refresh } })).status === 401)
  tutor.token = refreshed.data.tokens.access_token

  // ---------- Tutor: before submission ----------
  let dash = await call('GET', '/api/v1/workflow/dashboard', { token: tutor.token })
  check('tutor: dashboard before submit', dash.status === 200 && dash.data.verification === null && dash.data.account.status === 'pending', JSON.stringify(dash.data))
  check('tutor: dashboard profile is null before any save', dash.data.profile === null, JSON.stringify(dash.data.profile))
  check('tutor: tuition blocked until active', (await call('GET', '/api/v1/workflow/tuition', { token: tutor.token })).status === 403)
  check('tutor: admin list forbidden', (await call('GET', '/api/v1/workflow/admin/verifications', { token: tutor.token })).status === 403)
  check('tutor: admin decision forbidden', (await call('POST', '/api/v1/workflow/admin/verifications/x/decision', { token: tutor.token, body: { decision: 'approved' } })).status === 403)
  check('tutor: unknown profile field rejected', (await call('PUT', '/api/v1/workflow/profile', { token: tutor.token, body: { role: 'admin' } })).status === 400)
  check('tutor: profile saved', (await call('PUT', '/api/v1/workflow/profile', { token: tutor.token, body: { display_name: 'E2E Tutor', education: 'BSc Physics, DU', subjects: ['Physics', 'Math'], classes: ['Class 9'], areas: ['Mirpur'] } })).status === 204)
  dash = await call('GET', '/api/v1/workflow/dashboard', { token: tutor.token })
  check('tutor: profile completion is 100', dash.data.account.profile_complete === 100, JSON.stringify(dash.data.account))
  check('tutor: dashboard returns saved profile for prefill', dash.data.profile?.education === 'BSc Physics, DU' && dash.data.profile.subjects?.join(',') === 'Physics,Math', JSON.stringify(dash.data.profile))

  // ---------- Tutor: submit and documents ----------
  const sub = await call('POST', '/api/v1/workflow/verification/submit', { token: tutor.token })
  check('tutor: submit accepted', sub.status === 202 && sub.data.verification?.status === 'pending', JSON.stringify(sub.data))
  const tutorApp = sub.data.verification.id

  const up = (token, app, bytes, name, mime, type = 'identity') => call('POST', '/api/v1/workflow/verification/documents', { token, form: docForm(app, type, bytes, name, mime) })
  check('docs: PNG accepted', (await up(tutor.token, tutorApp, PNG, 'nid.png', 'image/png')).status === 201)
  check('docs: WebP accepted', (await up(tutor.token, tutorApp, WEBP, 'cert.webp', 'image/webp', 'education')).status === 201)
  check('docs: text spoofed as PNG rejected', (await up(tutor.token, tutorApp, Buffer.from('hello, not an image at all'), 'fake.png', 'image/png')).status === 400)
  check('docs: SVG rejected', (await up(tutor.token, tutorApp, Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), 'x.svg', 'image/svg+xml')).status === 400)
  check('docs: PDF rejected', (await up(tutor.token, tutorApp, Buffer.from('%PDF-1.4\n%%EOF'), 'x.pdf', 'application/pdf')).status === 400)
  const big = Buffer.concat([PNG, Buffer.alloc(11 * 1024 * 1024)])
  const bigRes = await up(tutor.token, tutorApp, big, 'big.png', 'image/png')
  check('docs: file over 10 MB rejected', bigRes.status === 400 || bigRes.status === 413, `status ${bigRes.status}`)
  check('docs: missing application id rejected', (await call('POST', '/api/v1/workflow/verification/documents', { token: tutor.token, form: docForm('', 'identity', PNG, 'a.png', 'image/png') })).status === 400)
  check('docs: re-upload of same type replaces', (await up(tutor.token, tutorApp, JPEG, 'nid.jpg', 'image/jpeg')).status === 201)

  // ---------- Coaching ----------
  const coaching = await register('coaching', 'coaching')
  check('coaching: registers', coaching.status === 201 && coaching.user?.role === 'coaching')
  check('coaching: profile saved', (await call('PUT', '/api/v1/workflow/profile', { token: coaching.token, body: { display_name: 'E2E Scholars', institution: 'E2E Coaching Centre', education: 'Registered institute', subjects: ['Math'], classes: ['SSC'], areas: ['Uttara'] } })).status === 204)
  const csub = await call('POST', '/api/v1/workflow/verification/submit', { token: coaching.token })
  check('coaching: submit accepted', csub.status === 202)
  const coachingApp = csub.data.verification.id
  check('coaching: trade licence JPEG accepted', (await up(coaching.token, coachingApp, JPEG, 'licence.jpg', 'image/jpeg', 'trade_license')).status === 201)
  check('docs: cannot upload to another user\'s application', (await up(coaching.token, tutorApp, PNG, 'x.png', 'image/png')).status === 403)

  // ---------- Admin ----------
  const adminLogin = await call('POST', '/api/v1/auth/login', { body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } })
  check('admin: login', adminLogin.status === 200 && adminLogin.data.user?.role === 'admin')
  const admin = adminLogin.data.tokens.access_token

  let list = await call('GET', '/api/v1/workflow/admin/verifications?status=pending', { token: admin })
  const ids = (list.data?.applications ?? []).map((a) => a.id)
  check('admin: pending list includes tutor and coaching', list.status === 200 && ids.includes(tutorApp) && ids.includes(coachingApp), JSON.stringify(list.data).slice(0, 300))
  const tutorRow = list.data.applications.find((a) => a.id === tutorApp)
  check('admin: list carries profile JSON', tutorRow?.profile?.education === 'BSc Physics, DU' && Array.isArray(tutorRow.profile.subjects), JSON.stringify(tutorRow?.profile))
  check('admin: list carries interviews array', Array.isArray(tutorRow?.interviews))
  list = await call('GET', '/api/v1/workflow/admin/verifications?role=coaching', { token: admin })
  check('admin: role filter', list.status === 200 && list.data.applications.every((a) => a.role === 'coaching') && list.data.applications.some((a) => a.id === coachingApp))

  const docs = await call('GET', `/api/v1/workflow/admin/verifications/${tutorApp}/documents`, { token: admin })
  check('admin: document metadata lists 2 docs (replacement did not duplicate)', docs.status === 200 && docs.data.documents.length === 2, JSON.stringify(docs.data))
  const identity = docs.data.documents.find((d) => d.document_type === 'identity')
  check('admin: replaced document is the JPEG', identity?.mime_type === 'image/jpeg' && identity.original_name === 'nid.jpg', JSON.stringify(identity))
  check('admin: metadata hides storage key', identity && !('storage_key' in identity))

  const dl = await call('GET', `/api/v1/workflow/verification/documents/${identity.id}`, { token: admin })
  check('docs: admin downloads document', dl.status === 200 && dl.type.startsWith('image/jpeg') && Buffer.compare(dl.data, JPEG) === 0, `status ${dl.status} type ${dl.type}`)
  const own = await call('GET', `/api/v1/workflow/verification/documents/${identity.id}`, { token: tutor.token })
  check('docs: owner downloads own document', own.status === 200)
  check('docs: other user cannot download', (await call('GET', `/api/v1/workflow/verification/documents/${identity.id}`, { token: coaching.token })).status === 403)
  check('docs: unknown document is 404', (await call('GET', '/api/v1/workflow/verification/documents/00000000-0000-0000-0000-000000000000', { token: admin })).status === 404)

  // Reject coaching
  const decide = (app, decision, reason) => call('POST', `/api/v1/workflow/admin/verifications/${app}/decision`, { token: admin, body: { decision, reason } })
  check('review: reject without reason is 400', (await decide(coachingApp, 'rejected', 'no')).status === 400)
  check('review: unknown decision is 400', (await decide(coachingApp, 'maybe', 'a long enough reason')).status === 400)
  check('review: unknown application is 404', (await decide('00000000-0000-0000-0000-000000000000', 'approved', '')).status === 404)
  check('review: reject coaching', (await decide(coachingApp, 'rejected', 'Trade licence could not be verified.')).status === 204)
  check('review: second decision is 409', (await decide(coachingApp, 'approved', '')).status === 409)
  dash = await call('GET', '/api/v1/workflow/dashboard', { token: coaching.token })
  check('coaching: sees rejection and reason', dash.data.account.status === 'rejected' && dash.data.verification.status === 'rejected' && dash.data.verification.rejection_reason === 'Trade licence could not be verified.', JSON.stringify(dash.data))
  check('coaching: cannot resubmit after rejection', (await call('POST', '/api/v1/workflow/verification/submit', { token: coaching.token })).status === 409)
  check('coaching: cannot upload after rejection', (await up(coaching.token, coachingApp, PNG, 'x.png', 'image/png', 'trade_license')).status === 409)
  let notes = await call('GET', '/api/v1/workflow/notifications', { token: coaching.token })
  check('coaching: rejection notification', notes.data.notifications?.some((n) => n.title === 'Verification rejected'), JSON.stringify(notes.data))

  // Request corrections from tutor
  check('review: request corrections from tutor', (await decide(tutorApp, 'resubmission_required', 'Please upload a clearer NID photo.')).status === 204)
  dash = await call('GET', '/api/v1/workflow/dashboard', { token: tutor.token })
  check('tutor: sees correction request', dash.data.account.status === 'resubmission_required' && dash.data.verification.correction_request === 'Please upload a clearer NID photo.' && !dash.data.verification.rejection_reason, JSON.stringify(dash.data))
  check('tutor: can re-upload while corrections requested', (await up(tutor.token, tutorApp, PNG, 'nid-clear.png', 'image/png')).status === 201)
  const resub = await call('POST', '/api/v1/workflow/verification/submit', { token: tutor.token })
  check('tutor: resubmits', resub.status === 202 && resub.data.verification.status === 'pending' && resub.data.verification.id === tutorApp && !resub.data.verification.correction_request, JSON.stringify(resub.data))

  // Interviews
  const schedule = (app, at, mode = 'online') => call('POST', `/api/v1/workflow/admin/verifications/${app}/interviews`, { token: admin, body: { mode, scheduled_at: at, location_or_link: 'https://meet.example.test/e2e' } })
  const future = new Date(Date.now() + 86400000).toISOString()
  check('interview: past date rejected', (await schedule(tutorApp, new Date(Date.now() - 86400000).toISOString())).status === 400)
  check('interview: bad mode rejected', (await schedule(tutorApp, future, 'phone')).status === 400)
  check('interview: unknown application is 404', (await schedule('00000000-0000-0000-0000-000000000000', future)).status === 404)
  check('interview: cannot schedule on rejected application', (await schedule(coachingApp, future)).status === 409)
  check('interview: scheduled', (await schedule(tutorApp, future)).status === 201)
  dash = await call('GET', '/api/v1/workflow/dashboard', { token: tutor.token })
  check('tutor: account interview_scheduled', dash.data.account.status === 'interview_scheduled')
  check('tutor: cannot resubmit during interview', (await call('POST', '/api/v1/workflow/verification/submit', { token: tutor.token })).status === 409)
  list = await call('GET', '/api/v1/workflow/admin/verifications?role=tutor&status=pending', { token: admin })
  let iv = list.data.applications.find((a) => a.id === tutorApp)?.interviews ?? []
  check('interview: listed with ISO date', iv.length === 1 && !Number.isNaN(Date.parse(iv[0].scheduled_at)) && iv[0].scheduled_at.endsWith('Z'), JSON.stringify(iv))
  const outcome = (id, status) => call('POST', `/api/v1/workflow/admin/verifications/${tutorApp}/interviews/${id}/outcome`, { token: admin, body: { status, notes: 'e2e' } })
  check('interview: invalid outcome is 400', (await outcome(iv[0].id, 'maybe')).status === 400)
  check('interview: cancel', (await outcome(iv[0].id, 'cancelled')).status === 204)
  dash = await call('GET', '/api/v1/workflow/dashboard', { token: tutor.token })
  check('tutor: cancelled interview returns account to pending', dash.data.account.status === 'pending', dash.data.account.status)
  check('interview: outcome twice is 409', (await outcome(iv[0].id, 'completed')).status === 409)
  await schedule(tutorApp, future)
  list = await call('GET', '/api/v1/workflow/admin/verifications?role=tutor&status=pending', { token: admin })
  iv = list.data.applications.find((a) => a.id === tutorApp)?.interviews ?? []
  const second = iv.find((i) => i.status === 'scheduled')
  check('interview: complete', second && (await outcome(second.id, 'completed')).status === 204)
  dash = await call('GET', '/api/v1/workflow/dashboard', { token: tutor.token })
  check('tutor: account interview_completed', dash.data.account.status === 'interview_completed', dash.data.account.status)

  // Approve tutor (profile already complete -> active)
  check('review: approve tutor', (await decide(tutorApp, 'approved', '')).status === 204)
  dash = await call('GET', '/api/v1/workflow/dashboard', { token: tutor.token })
  check('tutor: approved with complete profile becomes active', dash.data.account.status === 'active' && dash.data.verification.status === 'approved', JSON.stringify(dash.data))
  check('tutor: tuition allowed once active', (await call('GET', '/api/v1/workflow/tuition', { token: tutor.token })).status === 200)
  check('tutor: approved cannot resubmit', (await call('POST', '/api/v1/workflow/verification/submit', { token: tutor.token })).status === 409)
  check('tutor: cannot change documents after approval', (await up(tutor.token, tutorApp, PNG, 'x.png', 'image/png')).status === 409)
  notes = await call('GET', '/api/v1/workflow/notifications', { token: tutor.token })
  const titles = (notes.data.notifications ?? []).map((n) => n.title)
  check('tutor: notifications for corrections, interview, approval', ['Corrections requested', 'Interview scheduled', 'Verification approved'].every((t) => titles.includes(t)), JSON.stringify(titles))

  // Approve with incomplete profile -> profile_incomplete -> active after completing profile
  const tutor2 = await register('tutor2', 'tutor')
  await call('PUT', '/api/v1/workflow/profile', { token: tutor2.token, body: { display_name: 'E2E Tutor Two' } })
  const t2 = await call('POST', '/api/v1/workflow/verification/submit', { token: tutor2.token })
  check('review: approve incomplete profile', (await decide(t2.data.verification.id, 'approved', '')).status === 204)
  dash = await call('GET', '/api/v1/workflow/dashboard', { token: tutor2.token })
  check('tutor2: approved with incomplete profile is profile_incomplete', dash.data.account.status === 'profile_incomplete', dash.data.account.status)
  await call('PUT', '/api/v1/workflow/profile', { token: tutor2.token, body: { education: 'MSc', subjects: ['Chemistry'], classes: ['HSC'], areas: ['Dhanmondi'] } })
  dash = await call('GET', '/api/v1/workflow/dashboard', { token: tutor2.token })
  check('tutor2: completing profile activates account', dash.data.account.status === 'active' && dash.data.account.profile_complete === 100, JSON.stringify(dash.data.account))

  // Relationships (role permissions)
  const parent = await register('parent', 'parent')
  const student = await register('student', 'student')
  check('relationship: parent links student', (await call('POST', '/api/v1/workflow/relationships', { token: parent.token, body: { student_id: student.user.id, relationship: 'mother' } })).status === 201)
  check('relationship: tutor cannot link student', (await call('POST', '/api/v1/workflow/relationships', { token: tutor.token, body: { student_id: student.user.id, relationship: 'tutor' } })).status === 403)
  const rel = await call('GET', '/api/v1/workflow/relationships', { token: student.token })
  check('relationship: student sees pending link', rel.status === 200 && rel.data.relationships?.length === 1 && rel.data.relationships[0].status === 'pending', JSON.stringify(rel.data))

  // Logout revokes the refresh token
  check('auth: logout', (await call('POST', '/api/v1/auth/logout', { body: { refresh_token: student.refresh } })).status < 300)
  check('auth: refresh after logout is 401', (await call('POST', '/api/v1/auth/refresh', { body: { refresh_token: student.refresh } })).status === 401)

  console.log(`\nrun ${run}: ${pass} pass, ${fail} fail`)
  if (fail) { console.log('Failed:', failures.join('; ')); process.exit(1) }
}

main().catch((e) => { console.error(e); process.exit(1) })
