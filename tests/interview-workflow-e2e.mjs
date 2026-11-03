// The interview workflow through the real API and database: the admin
// schedules with instructions; the applicant sees it, confirms (once) and
// discusses it with the admin in Messages; the admin reschedules (same record),
// marks it completed, and only then makes the final decision, which alone
// unlocks the applicant's own role features.
//
//   E2E_API=http://localhost:8090 E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... node tests/interview-workflow-e2e.mjs
//
// Run only against an isolated *_e2e database (see backend/README.md).

import { readFileSync } from 'node:fs'

const API = process.env.E2E_API ?? 'http://localhost:8090'
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) { console.error('E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD are required'); process.exit(2) }

let pass = 0
let fail = 0
const failures = []
function check(name, ok, detail = '') {
  if (ok) { pass++; console.log('PASS', name) } else { fail++; failures.push(name); console.log('FAIL', name, detail) }
}
async function call(method, path, { token, body, form } = {}) {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  let payload
  if (form) payload = form
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body) }
  const res = await fetch(API + path, { method, headers, body: payload })
  return { status: res.status, data: await res.json().catch(() => null) }
}
const GET = (p, t) => call('GET', p, { token: t })
const POST = (p, t, body) => call('POST', p, { token: t, body })
const PUT = (p, t, body) => call('PUT', p, { token: t, body })

const run = Math.random().toString(36).slice(2, 8)
const password = `Intv-${run}-Pw1`
const email = (l) => `iw-${l}-${run}@tuitionhub.test`
const PNG = readFileSync(new URL('./fixtures/id-card.png', import.meta.url))

async function register(label, role) {
  const r = await call('POST', '/api/v1/auth/register', { body: { name: `Interview ${label} ${run}`, email: email(label), password, role } })
  return { token: r.data.tokens.access_token, id: r.data.user.id }
}
async function upload(u, type) { const f = new FormData(); f.append('document_type', type); f.append('document', new Blob([PNG], { type: 'image/png' }), 'p.png'); return call('POST', '/api/v1/workflow/verification/documents', { token: u.token, form: f }) }
async function submittedTutor(label) {
  const t = await register(label, 'tutor')
  await upload(t, 'identity')
  await PUT('/api/v1/workflow/profile', t.token, { display_name: `Interview ${label}`, education: 'BSc', subjects: ['Physics'], classes: ['HSC'], areas: ['Uttara'] })
  t.application = (await POST('/api/v1/workflow/verification/submit', t.token)).data.verification.id
  return t
}
const dash = async (u) => (await GET('/api/v1/workflow/dashboard', u.token)).data
const notes = async (t) => (await GET('/api/v1/workflow/notifications', t)).data.notifications ?? []
const adminApp = async (admin, id) => (await GET('/api/v1/workflow/admin/verifications?role=tutor', admin)).data.applications.find((a) => a.id === id)

async function main() {
  const login = (await POST('/api/v1/auth/login', undefined, { email: ADMIN_EMAIL, password: ADMIN_PASSWORD })).data
  const admin = login.tokens.access_token
  const tutor = await submittedTutor('tutor')
  const other = await submittedTutor('other')

  // ---- 1. schedule with instructions ----
  const base = `/api/v1/workflow/admin/verifications/${tutor.application}/interviews`
  let r = await POST(base, admin, { mode: 'online', scheduled_at: '2030-12-05T09:30:00Z', location_or_link: 'https://meet.example.test/one', instructions: 'Bring your original NID and certificates.' })
  check('1. admin schedules with instructions', r.status === 201, JSON.stringify(r.data))
  check('1. a second interview cannot be scheduled while one is scheduled', (await POST(base, admin, { mode: 'online', scheduled_at: '2030-12-06T09:30:00Z' })).status === 409)
  check('1. non-admins cannot schedule', (await POST(base, tutor.token, { mode: 'online', scheduled_at: '2030-12-06T09:30:00Z' })).status === 403)
  let app = await adminApp(admin, tutor.application)
  check('1. interview linked to the application with instructions', app.interviews.length === 1 && app.interviews[0].instructions === 'Bring your original NID and certificates.' && !!app.interviews[0].conversation_id)
  check('1. account is in the interview stage, not approved', (await dash(tutor)).account.status === 'interview_scheduled')

  // ---- 2/3. notification + interview box data ----
  const scheduled = (await notes(tutor.token)).find((n) => n.kind === 'interview_scheduled')
  check('2. notification states the date and time', /5 December 2030 at 3:30 PM/.test(scheduled?.body ?? ''), scheduled?.body)
  let iv = (await dash(tutor)).interview
  check('3. dashboard carries the interview for the box', iv && iv.status === 'scheduled' && iv.mode === 'online' && iv.location_or_link === 'https://meet.example.test/one' && iv.instructions.includes('original NID') && !iv.confirmed_at && iv.scheduled_at.startsWith('2030-12-05T09:30'), JSON.stringify(iv))
  check('3. box shows the latest admin message', /Verification interview scheduled/.test(iv?.latest_admin_message ?? '') && /Instructions: Bring your original NID/.test(iv.latest_admin_message))
  check('3. other applicants do not see this interview', (await dash(other)).interview === null)
  check('3. other applicants cannot read the conversation', (await GET(`/api/v1/conversations/${iv.conversation_id}/messages`, other.token)).status === 404)

  // ---- 4. confirm (once) ----
  check('4. other applicant has nothing to confirm', (await POST('/api/v1/workflow/interview/confirm', other.token)).status === 404)
  r = await POST('/api/v1/workflow/interview/confirm', tutor.token)
  check('4. applicant confirms', r.status === 200 && r.data.confirmed && !r.data.already_confirmed)
  r = await POST('/api/v1/workflow/interview/confirm', tutor.token)
  check('4. repeated confirmation changes nothing', r.status === 200 && r.data.already_confirmed)
  const adminConfirm = (await notes(admin)).filter((n) => n.kind === 'interview_confirmed' && n.conversation_id === iv.conversation_id)
  check('4. admin notified exactly once, linked to the conversation', adminConfirm.length === 1 && adminConfirm[0].body.includes(`Interview tutor ${run}`), JSON.stringify(adminConfirm))
  iv = (await dash(tutor)).interview
  check('4. confirmation persisted', !!iv.confirmed_at)
  check('4. admin sees the confirmation', !!(await adminApp(admin, tutor.application)).interviews[0].confirmed_at)
  check('4. confirming does not approve', (await dash(tutor)).account.status === 'interview_scheduled')

  // ---- 4. discuss in Messages (both directions, notifications both ways) ----
  r = await POST(`/api/v1/conversations/${iv.conversation_id}/messages`, tutor.token, { body: 'Could we move it to the next day? I have an exam.' })
  check('4. applicant messages the admin', r.status === 201)
  const toAdmin = (await notes(admin)).find((n) => n.id === r.data.message.id)
  check('4. admin gets a notification for the message, linked to it', toAdmin?.kind === 'admin_message' && toAdmin.conversation_id === iv.conversation_id && /exam/.test(toAdmin.body))
  check('4. admin sees the message in Messages', (await GET(`/api/v1/conversations/${iv.conversation_id}/messages`, admin)).data.messages.some((m) => /next day/.test(m.body)))
  check('4. admin conversation list shows the applicant', (await GET('/api/v1/conversations', admin)).data.conversations.some((c) => c.id === iv.conversation_id && c.other_id === tutor.id))
  check('4. a message does not reschedule anything', (await dash(tutor)).interview.scheduled_at.startsWith('2030-12-05T09:30'))
  r = await POST(`/api/v1/conversations/${iv.conversation_id}/messages`, admin, { body: 'Yes, I will move it to 6 December.' })
  const toApplicant = (await notes(tutor.token)).find((n) => n.id === r.data.message.id)
  check('4. admin replies and the applicant is notified', r.status === 201 && toApplicant?.kind === 'admin_message' && toApplicant.conversation_id === iv.conversation_id)
  check('4. both sides see the whole history', (await GET(`/api/v1/conversations/${iv.conversation_id}/messages`, tutor.token)).data.messages.filter((m) => /next day|6 December/.test(m.body)).length === 2)
  check('3. box shows the admin reply as the latest admin message', /6 December/.test((await dash(tutor)).interview.latest_admin_message))

  // ---- 5. reschedule in place ----
  const ivId = app.interviews[0].id
  r = await PUT(`${base}/${ivId}`, admin, { mode: 'in_person', scheduled_at: '2030-12-06T05:00:00Z', location_or_link: 'TuitionHub office, Mirpur', instructions: 'Ask for the verification desk.' })
  check('5. admin reschedules', r.status === 204, JSON.stringify(r.data))
  check('5. non-admins cannot reschedule', (await PUT(`${base}/${ivId}`, tutor.token, { mode: 'online', scheduled_at: '2030-12-06T05:00:00Z' })).status === 403)
  check('5. past time refused', (await PUT(`${base}/${ivId}`, admin, { mode: 'online', scheduled_at: '2020-01-01T00:00:00Z' })).status === 400)
  app = await adminApp(admin, tutor.application)
  check('5. same interview record updated (no duplicate)', app.interviews.length === 1 && app.interviews[0].id === ivId && app.interviews[0].mode === 'in_person' && !!app.interviews[0].updated_at)
  iv = (await dash(tutor)).interview
  check('5. box shows the new schedule and asks to confirm again', iv.scheduled_at.startsWith('2030-12-06T05:00') && iv.location_or_link === 'TuitionHub office, Mirpur' && iv.instructions === 'Ask for the verification desk.' && !iv.confirmed_at)
  const moved = (await notes(tutor.token)).filter((n) => n.kind === 'interview_rescheduled')
  check('5. applicant notified once of the new schedule, in the same conversation', moved.length === 1 && /6 December 2030 at 11:00 AM/.test(moved[0].body) && moved[0].conversation_id === iv.conversation_id)
  check('5. the reschedule message has the new details', /rescheduled/.test(iv.latest_admin_message) && /Location: TuitionHub office, Mirpur/.test(iv.latest_admin_message))
  check('4. applicant confirms the new time', (await POST('/api/v1/workflow/interview/confirm', tutor.token)).data?.already_confirmed === false)

  // ---- 7 before 6: approval waits for the interview ----
  check('7. final approval refused while the interview is scheduled', (await POST(`/api/v1/workflow/admin/verifications/${tutor.application}/decision`, admin, { decision: 'approved' })).status === 409)

  // ---- 6. completed ----
  check('6. non-admins cannot mark completed', (await POST(`${base}/${ivId}/outcome`, tutor.token, { status: 'completed' })).status === 403)
  check('6. admin marks the interview completed', (await POST(`${base}/${ivId}/outcome`, admin, { status: 'completed', notes: 'Went well' })).status === 204)
  check('6. completing twice is refused', (await POST(`${base}/${ivId}/outcome`, admin, { status: 'completed' })).status === 409)
  let d = await dash(tutor)
  check('6. applicant sees Completed', d.interview?.status === 'completed' && d.account.status === 'interview_completed')
  check('6. applicant notified of completion', (await notes(tutor.token)).filter((n) => n.kind === 'interview_completed').length === 1)
  check('6. completion does not approve', d.verification.status === 'pending' && d.account.status !== 'active')
  check('6. still locked: completed-but-unapproved tutor cannot apply to posts', (await POST('/api/v1/tuition-posts/00000000-0000-0000-0000-000000000000/apply', tutor.token, { note: 'x' })).status === 403)
  check('6. no new interview record, no duplicate box', (await adminApp(admin, tutor.application)).interviews.length === 1)

  // ---- 7. final approval unlocks only the applicant's own role ----
  check('7. admin approves', (await POST(`/api/v1/workflow/admin/verifications/${tutor.application}/decision`, admin, { decision: 'approved' })).status === 204)
  d = await dash(tutor)
  check('7. verification approved and account active', d.verification.status === 'approved' && d.account.status === 'active')
  check('7. approval notified', (await notes(tutor.token)).some((n) => n.kind === 'verification_approved'))
  check('7. tutor features unlocked (classroom creation)', (await POST('/api/v1/classrooms', tutor.token, { name: `Class ${run}`, subject: 'Physics' })).status === 201)
  check('7. no other role access (tutor cannot post tuition)', (await POST('/api/v1/tuition-posts', tutor.token, { subject: 'Physics', class_name: 'HSC', area: 'Uttara', mode: 'offline' })).status === 403)
  check('7. no admin access', (await GET('/api/v1/workflow/admin/verifications', tutor.token)).status === 403)

  // ---- 7. rejection path keeps features locked ----
  const ob = `/api/v1/workflow/admin/verifications/${other.application}/interviews`
  await POST(ob, admin, { mode: 'online', scheduled_at: '2030-12-08T09:30:00Z', location_or_link: 'https://meet.example.test/two' })
  const oiv = (await adminApp(admin, other.application)).interviews[0]
  await POST(`${ob}/${oiv.id}/outcome`, admin, { status: 'completed' })
  check('7. admin rejects after the interview', (await POST(`/api/v1/workflow/admin/verifications/${other.application}/decision`, admin, { decision: 'rejected', reason: 'Documents did not match at the interview.' })).status === 204)
  d = await dash(other)
  check('7. rejection persisted and notified', d.account.status === 'rejected' && (await notes(other.token)).some((n) => n.kind === 'verification_rejected'))
  check('7. rejected applicant stays locked', (await POST('/api/v1/classrooms', other.token, { name: 'x', subject: 'y' })).status === 403)

  // ---- parents and students can also discuss interviews while under review ----
  const parent = await register('parent', 'parent')
  await upload(parent, 'parent_nid'); await upload(parent, 'child_birth_certificate')
  await PUT('/api/v1/workflow/profile', parent.token, { display_name: `Interview parent ${run}`, address: 'Mirpur' })
  const papp = (await POST('/api/v1/workflow/verification/submit', parent.token)).data.verification.id
  await POST(`/api/v1/workflow/admin/verifications/${papp}/interviews`, admin, { mode: 'online', scheduled_at: '2030-12-09T09:30:00Z', location_or_link: 'https://meet.example.test/p' })
  const piv = (await dash(parent)).interview
  check('pending parent sees the interview and can confirm', !!piv && (await POST('/api/v1/workflow/interview/confirm', parent.token)).status === 200)
  check('pending parent can message the admin about it', (await POST(`/api/v1/conversations/${piv.conversation_id}/messages`, parent.token, { body: 'Thanks, I will attend.' })).status === 201)
  check('pending parent still cannot post tuition (rest stays locked)', (await POST('/api/v1/tuition-posts', parent.token, { subject: 'Physics', class_name: 'HSC', area: 'Uttara', mode: 'offline' })).status === 403)
  check('parent approval still waits for the interview', (await POST(`/api/v1/workflow/admin/verifications/${papp}/decision`, admin, { decision: 'approved' })).status === 409)

  console.log(`\n${pass} passed, ${fail} failed`)
  if (fail) { console.log('Failures:\n - ' + failures.join('\n - ')); process.exit(1) }
}

main().catch((e) => { console.error(e); process.exit(1) })
