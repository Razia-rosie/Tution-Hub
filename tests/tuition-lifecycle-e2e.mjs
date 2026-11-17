// Tuition lifecycle through the real API and database: a custom area on a
// tuition post; demo class -> both sides agree -> tutor creates the classroom
// -> guardian and student accept -> tuition starts; monthly completion with a
// single payment reminder; payment instructions in Messages; the payer's
// payment submission and the tutor's confirmation or dispute — plus the
// permission checks on every step.
//
//   E2E_API=http://localhost:8091 E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... node tests/tuition-lifecycle-e2e.mjs
//
// Run only against an isolated *_e2e database (see backend/README.md).

import { readFileSync } from 'node:fs'

const API = process.env.E2E_API ?? 'http://localhost:8091'
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
  const type = res.headers.get('content-type') ?? ''
  const data = type.includes('application/json') ? await res.json().catch(() => null) : null
  return { status: res.status, data }
}
const GET = (p, token) => call('GET', p, { token })
const POST = (p, token, body) => call('POST', p, { token, body })
const PUT = (p, token, body) => call('PUT', p, { token, body })

const run = Math.random().toString(36).slice(2, 8)
const password = `L1fecycle-${run}-pw`
const email = (label) => `tl-${label}-${run}@tuitionhub.test`
const PNG = readFileSync(new URL('./fixtures/id-card.png', import.meta.url))
const future = (days) => new Date(Date.now() + days * 86400000).toISOString()
const today = new Date().toISOString().slice(0, 10)
const month = today.slice(0, 7)
const monthAfter = (m, n) => { const d = new Date(`${m}-01T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 7) }
const monthName = (m) => new Date(`${m}-01T00:00:00Z`).toLocaleString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })

async function register(label, role, name) {
  const r = await call('POST', '/api/v1/auth/register', { body: { name: name ?? `TL ${label} ${run}`, email: email(label), password, role } })
  if (r.status !== 201) throw new Error(`register ${label}: ${r.status} ${JSON.stringify(r.data)}`)
  return { token: r.data.tokens.access_token, id: r.data.user.id, email: email(label), name: name ?? `TL ${label} ${run}` }
}
const upload = (token, path, field, bytes, name, mime, extra = {}) => {
  const form = new FormData()
  for (const [k, v] of Object.entries(extra)) form.append(k, v)
  form.append(field, new Blob([bytes], { type: mime }), name)
  return call('POST', path, { token, form })
}
const relogin = async (u) => { const r = await POST('/api/v1/auth/login', undefined, { email: u.email, password }); u.token = r.data.tokens.access_token }

async function verify(admin, user, docs, profile) {
  for (const [type, bytes] of docs) await upload(user.token, '/api/v1/workflow/verification/documents', 'document', bytes, `${type}.png`, 'image/png', { document_type: type })
  await PUT('/api/v1/workflow/profile', user.token, profile)
  const sub = await POST('/api/v1/workflow/verification/submit', user.token)
  const d = await POST(`/api/v1/workflow/admin/verifications/${sub.data?.verification?.id}/decision`, admin, { decision: 'approved' })
  await relogin(user)
  return sub.status === 202 && d.status === 204
}
const verifyParent = (admin, p) => verify(admin, p, [['parent_nid', PNG], ['child_birth_certificate', PNG]], { display_name: p.name, address: 'House 1, Road 2, Mirpur, Dhaka' })
async function invitedStudent(admin, inviter, label, name) {
  const inv = await POST('/api/v1/workflow/family/invitations', inviter.token, { child_email: email(label), relationship: 'mother' })
  await POST(`/api/v1/workflow/admin/student-invitations/${inv.data?.invitation?.id}/decision`, admin, { decision: 'approved' })
  const student = await register(label, 'student', name)
  const ok = await verify(admin, student, [['birth_certificate', PNG]], { display_name: name, birth_date: '2010-01-01', class_name: 'HSC', institution: 'Dhaka College' })
  check(`${label}: invited, registered and verified`, inv.status === 201 && ok)
  return student
}
const notifications = async (u) => (await GET('/api/v1/workflow/notifications', u.token)).data.notifications ?? []

async function main() {
  const admin = (await POST('/api/v1/auth/login', undefined, { email: ADMIN_EMAIL, password: ADMIN_PASSWORD })).data.tokens.access_token

  // ---------- accounts ----------
  const tutor = await register('tutor', 'tutor', `Tutor ${run}`)
  const parent = await register('parent', 'parent', `Parent ${run}`)
  const outsider = await register('outsider', 'parent', `Outsider ${run}`)
  check('tutor: verified', await verify(admin, tutor, [['identity', PNG]], { display_name: tutor.name, education: 'BSc Physics', subjects: ['Physics'], classes: ['HSC'], areas: ['Savar'] }))
  check('parent: verified', await verifyParent(admin, parent))
  check('outsider: verified', await verifyParent(admin, outsider))
  const student = await invitedStudent(admin, parent, 'student', `Student ${run}`)
  let links = (await GET('/api/v1/links', parent.token)).data.links
  if (!links.some((l) => l.student_id === student.id && l.status === 'approved')) {
    await POST('/api/v1/links', parent.token, { student_email: student.email, relationship: 'mother' })
    const l = (await GET('/api/v1/links', student.token)).data.links.find((x) => x.guardian_id === parent.id)
    await POST(`/api/v1/links/${l.id}/respond`, student.token, { accept: true })
    links = (await GET('/api/v1/links', parent.token)).data.links
  }
  check('parent: approved link to the student', links.some((l) => l.student_id === student.id && l.status === 'approved'))

  // ---------- 1. custom area on a tuition post ----------
  const area = `Savar Bazar ${run}`
  const base = { subject: 'Physics', class_name: 'HSC', mode: 'offline', budget: 7000, requirements: `Lifecycle ${run}`, student_id: student.id }
  check('area: empty custom area rejected', (await POST('/api/v1/tuition-posts', parent.token, { ...base, area: '' })).status === 400)
  check('area: whitespace-only custom area rejected', (await POST('/api/v1/tuition-posts', parent.token, { ...base, area: '   ' })).status === 400)
  check('area: over-long custom area rejected', (await POST('/api/v1/tuition-posts', parent.token, { ...base, area: 'x'.repeat(121) })).status === 400)
  const listed = await POST('/api/v1/tuition-posts', parent.token, { ...base, area: 'Uttara', requirements: `Listed area ${run}` })
  check('area: listed area still accepted', listed.status === 201)
  let res = await POST('/api/v1/tuition-posts', parent.token, { ...base, area: `  ${area}  ` })
  check('area: custom area post created', res.status === 201)
  const postId = res.data.id
  check('area: saved trimmed in My posts', (await GET('/api/v1/tuition-posts/mine', parent.token)).data.posts.find((p) => p.id === postId)?.area === area)
  check('area: shown on the public post', (await GET(`/api/v1/public/tuition/${postId}`)).data?.post?.area === area || (await GET(`/api/v1/public/tuition/${postId}`)).data?.area === area)
  check('area: found by keyword search', (await GET(`/api/v1/tuition-posts?q=${encodeURIComponent(area)}`, tutor.token)).data.posts.some((p) => p.id === postId && p.area === area))
  check('area: found by area filter', (await GET(`/api/v1/tuition-posts?area=${encodeURIComponent(area)}`, tutor.token)).data.posts.some((p) => p.id === postId))
  check('area: listed-area filter excludes it', !(await GET(`/api/v1/tuition-posts?area=Uttara&q=${run}`, tutor.token)).data.posts.some((p) => p.id === postId))
  check('area: shown in admin post list', (await GET(`/api/v1/admin/tuition-posts?q=${encodeURIComponent(area)}`, admin)).data.posts?.some((p) => p.id === postId && p.area === area))
  check('area: editing keeps validation', (await PUT(`/api/v1/tuition-posts/${postId}`, parent.token, { ...base, area: ' ' })).status === 400)
  check('area: edited to another custom area', (await PUT(`/api/v1/tuition-posts/${postId}`, parent.token, { ...base, area: `${area} East` })).status === 204
    && (await GET('/api/v1/tuition-posts/mine', parent.token)).data.posts.find((p) => p.id === postId)?.area === `${area} East`)
  await PUT(`/api/v1/tuition-posts/${postId}`, parent.token, { ...base, area })

  // ---------- 2. demo class -> agreement -> classroom -> start ----------
  check('apply: tutor applies', (await POST(`/api/v1/tuition-posts/${postId}/apply`, tutor.token, { note: 'Ready' })).status === 201)
  const app = (await GET(`/api/v1/tuition-posts/${postId}/applications`, parent.token)).data.applications[0]
  check('apply: parent accepts (conversation opens)', (await POST(`/api/v1/applications/${app.id}/status`, parent.token, { status: 'accepted' })).status === 200)
  res = await POST('/api/v1/engagements', parent.token, { tutor_id: tutor.id, student_id: student.id, listing_id: postId, subject: 'Physics', class_name: 'HSC', mode: 'offline', trial_at: future(1) })
  check('demo: parent requests a demo class', res.status === 201)
  const eng = res.data.id
  const act = (u, body) => POST(`/api/v1/engagements/${eng}/actions`, u.token, body)
  const get = async (u = parent) => (await GET('/api/v1/engagements', u.token)).data.engagements.find((e) => e.id === eng)
  check('demo: tutor accepts', (await act(tutor, { action: 'accept_trial' })).status === 200)
  let e = await get()
  check('demo: scheduled demo is not an agreement', e.status === 'trial_scheduled' && !e.tutor_confirmed_at && !e.client_confirmed_at)
  check('classroom: cannot be created before agreement', (await act(tutor, { action: 'create_classroom' })).status === 409)
  check('agree: tutor proposes terms', (await act(tutor, { action: 'propose', days: 'Sun, Tue', time_slot: '6-7 PM', mode: 'offline', monthly_fee: 7000, start_date: today })).status === 200)
  e = await get()
  check('agree: tutor agreed, guardian not yet', e.status === 'proposed' && !!e.tutor_confirmed_at && !e.client_confirmed_at)
  check('agree: student cannot agree for the guardian', (await act(student, { action: 'confirm' })).status === 403)
  check('agree: outsider cannot act', (await act(outsider, { action: 'confirm' })).status === 404)
  res = await act(parent, { action: 'confirm' })
  check('agree: both agreed -> agreed, no classroom yet', res.status === 200 && res.data.status === 'agreed' && !res.data.classroom_id)
  e = await get()
  check('agree: both agreements shown, not started', e.status === 'agreed' && !!e.tutor_confirmed_at && !!e.client_confirmed_at && !e.classroom_id && e.contact === undefined)
  check('agree: post not filled before start', (await GET('/api/v1/tuition-posts/mine', parent.token)).data.posts.find((p) => p.id === postId)?.status === 'open')
  check('agree: confirming again is rejected', (await act(parent, { action: 'confirm' })).status === 409)
  check('agree: both sides notified', (await notifications(tutor)).some((n) => n.title === 'Both sides agreed') && (await notifications(parent)).some((n) => n.title === 'Both sides agreed'))
  check('months: not tracked before start', (await POST(`/api/v1/engagements/${eng}/payments`, tutor.token, { action: 'complete_month', month })).status === 409)
  check('join: nothing to accept before the classroom exists', (await act(parent, { action: 'accept_classroom' })).status === 409)
  check('classroom: parent cannot create it', (await act(parent, { action: 'create_classroom' })).status === 403)
  check('classroom: student cannot create it', (await act(student, { action: 'create_classroom' })).status === 403)
  res = await act(tutor, { action: 'create_classroom' })
  check('classroom: tutor creates it', res.status === 200 && !!res.data.classroom_id)
  const room = res.data.classroom_id
  check('classroom: only one per tuition', (await act(tutor, { action: 'create_classroom' })).status === 409)
  e = await get()
  const reqs = e.classroom_requests ?? []
  check('join: requests for guardian and student, both pending', e.classroom_id === room && reqs.length === 2 && reqs.every((r) => r.status === 'pending') && reqs.some((r) => r.user_id === parent.id && r.participant === 'guardian') && reqs.some((r) => r.user_id === student.id && r.participant === 'student'), JSON.stringify(reqs))
  check('join: still agreed, not started', e.status === 'agreed')
  check('join: guardian and student notified', (await notifications(parent)).some((n) => n.title === 'Classroom invitation') && (await notifications(student)).some((n) => n.title === 'Classroom invitation'))
  check('access: pending student cannot open the classroom', (await GET(`/api/v1/classrooms/${room}`, student.token)).status === 404)
  check('access: pending guardian cannot open the classroom', (await GET(`/api/v1/classrooms/${room}`, parent.token)).status === 404)
  check('access: pending classroom not listed for the student', !(await GET('/api/v1/classrooms', student.token)).data.classrooms.some((c) => c.id === room))
  const emptyRoom = (await GET(`/api/v1/classrooms/${room}`, tutor.token)).data
  check('classroom: empty member list is [] before anyone joins (not null)', Array.isArray(emptyRoom.members) && emptyRoom.members.length === 0, JSON.stringify(emptyRoom.members))
  check('access: tutor sees pending invitations in the classroom', (await GET(`/api/v1/classrooms/${room}`, tutor.token)).data.join_requests?.filter((r) => r.status === 'pending').length === 2)
  check('join: tutor cannot accept for them', (await act(tutor, { action: 'accept_classroom' })).status === 403)
  check('join: outsider cannot accept', (await act(outsider, { action: 'accept_classroom' })).status === 404)
  check('join: student declines', (await act(student, { action: 'decline_classroom' })).status === 200)
  check('join: declining twice is rejected', (await act(student, { action: 'decline_classroom' })).status === 409)
  check('join: tutor told about the decline', (await notifications(tutor)).some((n) => n.title === 'Classroom invitation declined'))
  res = await act(parent, { action: 'accept_classroom' })
  check('join: guardian accepts, still not started (student declined)', res.status === 200 && res.data.status === 'agreed')
  check('access: accepted guardian can open the classroom (view only)', (await GET(`/api/v1/classrooms/${room}`, parent.token)).data?.access === 'viewer')
  check('access: accepted guardian sees it listed with the child', (await GET('/api/v1/classrooms', parent.token)).data.classrooms.filter((c) => c.id === room).length === 1)
  check('access: declined student still cannot open it', (await GET(`/api/v1/classrooms/${room}`, student.token)).status === 404)
  check('access: unrelated parent cannot open it', (await GET(`/api/v1/classrooms/${room}`, outsider.token)).status === 404)
  check('join: guardian cannot accept twice', (await act(parent, { action: 'accept_classroom' })).status === 409)
  check('start: still pending', (await get()).status === 'agreed')
  res = await act(student, { action: 'accept_classroom' })
  check('start: student accepts -> tuition active', res.status === 200 && res.data.status === 'active')
  e = await get()
  check('start: active with contact shared', e.status === 'active' && e.contact?.email === tutor.email)
  check('start: post marked filled', (await GET('/api/v1/tuition-posts/mine', parent.token)).data.posts.find((p) => p.id === postId)?.status === 'filled')
  check('start: classroom shows both accepted', (await GET(`/api/v1/classrooms/${room}`, tutor.token)).data.join_requests?.every((r) => r.status === 'accepted'))
  check('start: student is a member', (await GET(`/api/v1/classrooms/${room}`, student.token)).data?.access === 'member')
  check('start: everyone notified', (await notifications(tutor)).some((n) => n.title === 'Tuition started') && (await notifications(parent)).some((n) => n.title === 'Tuition started') && (await notifications(student)).some((n) => n.title === 'Tuition started'))
  check('start: student sees it as active', (await get(student))?.status === 'active')

  // ---------- 3. monthly completion and reminder ----------
  const pay = (u, body) => POST(`/api/v1/engagements/${eng}/payments`, u.token, body)
  const ledger = async (u = parent) => (await GET(`/api/v1/engagements/${eng}/payments`, u.token)).data.payments
  check('months: bad month rejected', (await pay(tutor, { action: 'complete_month', month: '2026-13' })).status === 400)
  check('months: future month rejected', (await pay(tutor, { action: 'complete_month', month: monthAfter(month, 1) })).status === 400)
  check('months: month before the start rejected', (await pay(tutor, { action: 'complete_month', month: monthAfter(month, -1) })).status === 400)
  check('months: parent cannot mark completed', (await pay(parent, { action: 'complete_month', month })).status === 403)
  check('months: student cannot mark completed', (await pay(student, { action: 'complete_month', month })).status === 403)
  check('months: outsider cannot mark completed', (await pay(outsider, { action: 'complete_month', month })).status === 404)
  check('months: tutor marks this month completed', (await pay(tutor, { action: 'complete_month', month })).status === 204)
  let rec = (await ledger()).find((p) => p.month === month)
  check('months: record at the agreed fee, payment due', rec?.amount === 7000 && rec.completion_status === 'month_completed' && rec.payment_status === 'payment_due' && !!rec.reminder_sent_at, JSON.stringify(rec))
  check('months: one record per month (complete again)', (await pay(tutor, { action: 'complete_month', month })).status === 409)
  check('months: one record per month (record due again)', (await pay(tutor, { action: 'due', month })).status === 409)
  check('months: still one record', (await ledger()).filter((p) => p.month === month).length === 1)
  const reminders = (await notifications(parent)).filter((n) => n.kind === 'payment_reminder')
  const ref = `TH-${eng.slice(0, 8).toUpperCase()}`
  check('reminder: exactly one for the month', reminders.length === 1, String(reminders.length))
  check('reminder: names the tuition, month and amount', reminders[0]?.body.includes(ref) && reminders[0].body.includes(monthName(month)) && reminders[0].body.includes('৳7,000'), reminders[0]?.body)
  check('reminder: links to the message', !!reminders[0]?.conversation_id)
  let msgs = (await GET(`/api/v1/conversations/${reminders[0]?.conversation_id}/messages`, parent.token)).data?.messages ?? []
  check('reminder: posted in the tuition conversation', msgs.some((m) => m.id === reminders[0].id && m.body.includes('Payment reminder') && m.body.includes(ref)))
  check('reminder: tutor sees it in the same chat', ((await GET(`/api/v1/conversations/${reminders[0]?.conversation_id}/messages`, tutor.token)).data?.messages ?? []).some((m) => m.id === reminders[0].id))
  check('reminder: student is not reminded', !(await notifications(student)).some((n) => n.kind === 'payment_reminder'))

  // ---------- 4. payment instructions and two-party confirmation ----------
  const howTo = (u, body) => POST(`/api/v1/engagements/${eng}/payment-instructions`, u.token, body)
  check('how to pay: parent cannot send', (await howTo(parent, { body: 'Please pay me in cash.' })).status === 403)
  check('how to pay: outsider cannot send', (await howTo(outsider, { body: 'Please pay me in cash.' })).status === 404)
  check('how to pay: too short rejected', (await howTo(tutor, { body: 'cash' })).status === 400)
  check('how to pay: bad month rejected', (await howTo(tutor, { body: 'Cash at the first class.', month: 'soon' })).status === 400)
  const instructions = `Pay in cash at the first class of each month, ${run}.`
  res = await howTo(tutor, { body: instructions, month })
  check('how to pay: tutor sends through Messages', res.status === 201 && !!res.data.message_id)
  const howN = (await notifications(parent)).find((n) => n.kind === 'payment_instructions')
  check('how to pay: parent notified with a link to the message', howN?.id === res.data.message_id && !!howN.conversation_id)
  msgs = (await GET(`/api/v1/conversations/${howN?.conversation_id}/messages`, parent.token)).data?.messages ?? []
  check('how to pay: message carries the instructions from the tutor', msgs.some((m) => m.id === res.data.message_id && m.sender_id === tutor.id && m.body.includes(instructions) && m.body.includes(ref)))

  const submit = { action: 'mark_paid', month, amount_paid: 7000, method: 'Cash', reference: `R-${run}` }
  check('submit: student cannot submit for the guardian', (await pay(student, submit)).status === 403)
  check('submit: tutor cannot submit', (await pay(tutor, submit)).status === 403)
  check('submit: outsider cannot submit', (await pay(outsider, submit)).status === 404)
  check('submit: amount required', (await pay(parent, { ...submit, amount_paid: undefined })).status === 400)
  check('submit: method or reference required', (await pay(parent, { ...submit, method: '', reference: ' ' })).status === 400)
  check('submit: zero amount rejected', (await pay(parent, { ...submit, amount_paid: 0 })).status === 400)
  check('submit: another month without a record rejected', (await pay(parent, { ...submit, month: monthAfter(month, -2) })).status === 409)
  check('submit: parent submits for this month', (await pay(parent, submit)).status === 204)
  rec = (await ledger()).find((p) => p.month === month)
  check('submit: recorded as submitted, not paid', rec.payment_status === 'payment_submitted' && rec.amount_paid === 7000 && rec.pay_method === 'Cash' && rec.pay_reference === `R-${run}` && !rec.confirmed_at)
  check('submit: duplicate submission rejected', (await pay(parent, submit)).status === 409)
  check('submit: tutor notified', (await notifications(tutor)).some((n) => n.title === 'Payment submitted' && n.body.includes(monthName(month))))
  check('confirm: parent cannot confirm', (await pay(parent, { action: 'confirm', month })).status === 403)
  check('confirm: student cannot confirm', (await pay(student, { action: 'confirm', month })).status === 403)
  check('dispute: reason required', (await pay(tutor, { action: 'dispute', month, note: 'no' })).status === 400)
  check('dispute: tutor disputes', (await pay(tutor, { action: 'dispute', month, note: `Only received 5000 ${run}` })).status === 204)
  rec = (await ledger()).find((p) => p.month === month)
  check('dispute: stays disputed', rec.payment_status === 'disputed' && !rec.confirmed_at)
  check('dispute: cannot confirm a disputed payment', (await pay(tutor, { action: 'confirm', month })).status === 409)
  const disN = (await notifications(parent)).find((n) => n.kind === 'payment_disputed')
  check('dispute: parent notified with a link to the chat', !!disN?.conversation_id)
  msgs = (await GET(`/api/v1/conversations/${disN?.conversation_id}/messages`, parent.token)).data?.messages ?? []
  check('dispute: reason posted in the chat', msgs.some((m) => m.id === disN.id && m.body.includes(`Only received 5000 ${run}`)))
  check('dispute: parent replies in chat', (await POST(`/api/v1/conversations/${disN.conversation_id}/messages`, parent.token, { body: 'I will send the rest tomorrow.' })).status === 201)
  check('submit: parent resubmits after the dispute', (await pay(parent, { ...submit, reference: `R2-${run}` })).status === 204)
  check('confirm: tutor confirms', (await pay(tutor, { action: 'confirm', month })).status === 204)
  rec = (await ledger()).find((p) => p.month === month)
  check('confirm: confirmed paid', rec.payment_status === 'confirmed_paid' && !!rec.confirmed_at && rec.pay_reference === `R2-${run}`)
  check('confirm: parent notified', (await notifications(parent)).some((n) => n.title === 'Payment confirmed'))
  check('confirm: cannot confirm twice', (await pay(tutor, { action: 'confirm', month })).status === 409)
  check('confirm: cannot dispute after confirmation', (await pay(tutor, { action: 'dispute', month, note: 'changed my mind' })).status === 409)
  check('confirm: cannot resubmit after confirmation', (await pay(parent, submit)).status === 409)
  check('reminder: still exactly one for the month', (await notifications(parent)).filter((n) => n.kind === 'payment_reminder').length === 1)
  check('ledger: outsider cannot read it', (await GET(`/api/v1/engagements/${eng}/payments`, outsider.token)).status === 404)

  console.log(`\nrun ${run}: ${pass} pass, ${fail} fail`)
  if (fail) { console.log('Failed:', failures.join('; ')); process.exit(1) }
}

main().catch((err) => { console.error(err); process.exit(1) })
