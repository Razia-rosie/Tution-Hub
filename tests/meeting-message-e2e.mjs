// An interview an administrator schedules must reach the applicant both as a
// notification and as a message in Messages, with the same details, only for
// that applicant, without duplicates, and consistently when it is cancelled.
//
//   E2E_API=http://localhost:8090 E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... node tests/meeting-message-e2e.mjs
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
const GET = (p, token) => call('GET', p, { token })
const POST = (p, token, body) => call('POST', p, { token, body })

const run = Math.random().toString(36).slice(2, 8)
const password = `Me3ting-${run}-pw`
const email = (l) => `mt-${l}-${run}@tuitionhub.test`
const PNG = readFileSync(new URL('./fixtures/id-card.png', import.meta.url))

async function tutor(label) {
  const r = await call('POST', '/api/v1/auth/register', { body: { name: `Meeting ${label} ${run}`, email: email(label), password, role: 'tutor' } })
  const t = { token: r.data.tokens.access_token, id: r.data.user.id }
  const f = new FormData(); f.append('document_type', 'identity'); f.append('document', new Blob([PNG], { type: 'image/png' }), 'id.png')
  await call('POST', '/api/v1/workflow/verification/documents', { token: t.token, form: f })
  await call('PUT', '/api/v1/workflow/profile', { token: t.token, body: { display_name: `Meeting ${label}`, education: 'BSc', subjects: ['Physics'], classes: ['HSC'], areas: ['Uttara'] } })
  t.application = (await POST('/api/v1/workflow/verification/submit', t.token)).data.verification.id
  return t
}
const notes = async (u) => (await GET('/api/v1/workflow/notifications', u.token)).data.notifications ?? []
const thread = async (u, id) => GET(`/api/v1/conversations/${id}/messages`, u.token)

async function main() {
  const admin = (await POST('/api/v1/auth/login', undefined, { email: ADMIN_EMAIL, password: ADMIN_PASSWORD })).data.tokens.access_token
  const applicant = await tutor('applicant')
  const bystander = await tutor('bystander')

  // A failed attempt (time in the past) must leave nothing behind.
  const past = await POST(`/api/v1/workflow/admin/verifications/${applicant.application}/interviews`, admin, { mode: 'online', scheduled_at: new Date(Date.now() - 3600e3).toISOString(), location_or_link: 'https://meet.example.test/x' })
  check('a rejected scheduling attempt is refused', past.status === 400)
  check('a refused attempt creates no notification', !(await notes(applicant)).some((n) => n.kind === 'interview_scheduled'))

  // 5 Dec 2030 09:30 UTC = 3:30 PM Bangladesh time
  const link = `https://meet.example.test/${run}`
  const r = await POST(`/api/v1/workflow/admin/verifications/${applicant.application}/interviews`, admin, { mode: 'online', scheduled_at: '2030-12-05T09:30:00Z', location_or_link: link })
  check('admin schedules the interview', r.status === 201, JSON.stringify(r.data))

  const scheduled = (await notes(applicant)).filter((n) => n.kind === 'interview_scheduled')
  check('exactly one interview notification', scheduled.length === 1, JSON.stringify(scheduled))
  const n = scheduled[0]
  check('notification carries date and time and points to Messages', /Thursday, 5 December 2030 at 3:30 PM/.test(n?.body) && /Messages/.test(n?.body), n?.body)
  check('notification links to a conversation', typeof n?.conversation_id === 'string' && n.conversation_id.length === 36)

  const msgs = await thread(applicant, n.conversation_id)
  const meeting = msgs.data.messages?.find((m) => m.id === n.id)
  check('the linked message is the same event as the notification (same id)', !!meeting)
  for (const want of ['Verification interview scheduled', 'Purpose:', 'Date: Thursday, 5 December 2030', 'Time: 3:30 PM (Bangladesh time)', 'Mode: Online', `Meeting link: ${link}`]) {
    check(`message includes "${want}"`, meeting?.body.includes(want), meeting?.body)
  }
  check('message is from the scheduling administrator', !!meeting?.sender_id && meeting.sender_name)

  const convs = (await GET('/api/v1/conversations', applicant.token)).data.conversations
  const conv = convs.find((c) => c.id === n.conversation_id)
  check('the conversation appears directly in Messages', !!conv && conv.other_role === 'admin' && /interview scheduled/i.test(conv.last_message ?? ''), JSON.stringify(conv))
  check('it counts as unread for the applicant', conv?.unread >= 1)

  check('another user cannot read the meeting conversation', (await thread(bystander, n.conversation_id)).status === 404)
  check('another user gets no meeting notification', !(await notes(bystander)).some((x) => x.kind.startsWith('interview_')))
  check('another user does not see the conversation', !(await GET('/api/v1/conversations', bystander.token)).data.conversations.some((c) => c.id === n.conversation_id))

  // Cancelling keeps notification and message consistent, in the same conversation.
  const app = (await GET('/api/v1/workflow/admin/verifications?role=tutor', admin)).data.applications.find((a) => a.id === applicant.application)
  const interview = app.interviews[0]
  check('admin cancels the interview', (await POST(`/api/v1/workflow/admin/verifications/${applicant.application}/interviews/${interview.id}/outcome`, admin, { status: 'cancelled', notes: 'Reviewer unavailable' })).status === 204)
  check('cancelling twice is refused (no duplicate)', (await POST(`/api/v1/workflow/admin/verifications/${applicant.application}/interviews/${interview.id}/outcome`, admin, { status: 'cancelled' })).status === 409)
  const cancelled = (await notes(applicant)).filter((x) => x.kind === 'interview_cancelled')
  check('exactly one cancellation notification', cancelled.length === 1)
  check('cancellation uses the same conversation', cancelled[0]?.conversation_id === n.conversation_id)
  const after = (await thread(applicant, n.conversation_id)).data.messages
  check('cancellation message is in the thread with the date', after.some((m) => m.id === cancelled[0]?.id && /cancelled/.test(m.body) && /5 December 2030/.test(m.body)))
  check('the thread holds exactly the two meeting messages', after.length === 2, String(after.length))

  // A new interview reuses the conversation instead of opening another one.
  await POST(`/api/v1/workflow/admin/verifications/${applicant.application}/interviews`, admin, { mode: 'in_person', scheduled_at: '2030-12-07T05:00:00Z', location_or_link: 'TuitionHub office, Mirpur' })
  const second = (await notes(applicant)).filter((x) => x.kind === 'interview_scheduled')
  const latest = second.find((x) => x.id !== n.id)
  const latestMsg = (await thread(applicant, latest.conversation_id)).data.messages.find((m) => m.id === latest.id)
  check('a second interview reuses the same conversation', second.length === 2 && latest.conversation_id === n.conversation_id)
  check('in-person meeting shows the location', /Mode: In person/.test(latestMsg?.body) && /Location: TuitionHub office, Mirpur/.test(latestMsg?.body) && /11:00 AM/.test(latestMsg?.body), latestMsg?.body)
  check('completing an interview adds the completion message to the same thread', (await POST(`/api/v1/workflow/admin/verifications/${applicant.application}/interviews/${(await GET('/api/v1/workflow/admin/verifications?role=tutor', admin)).data.applications.find((a) => a.id === applicant.application).interviews.find((i) => i.status === 'scheduled').id}/outcome`, admin, { status: 'completed' })).status === 204 && (await thread(applicant, n.conversation_id)).data.messages.length === 4 && /completed/.test((await thread(applicant, n.conversation_id)).data.messages.at(-1).body))
  check('non-admins cannot schedule interviews', (await POST(`/api/v1/workflow/admin/verifications/${bystander.application}/interviews`, applicant.token, { mode: 'online', scheduled_at: '2030-12-05T09:30:00Z' })).status === 403)

  console.log(`\n${pass} passed, ${fail} failed`)
  if (fail) { console.log('Failures:\n - ' + failures.join('\n - ')); process.exit(1) }
}

main().catch((e) => { console.error(e); process.exit(1) })
