// End-to-end journeys across all five roles, through the real API and database:
// tutor marketplace, guardian links, chat requests and messaging, demo class and
// tuition agreement, classroom (materials, assignments, submissions, attendance,
// diary, progress), payments tracking, reviews, coaching management, support
// tickets and platform administration — plus the permission checks between them.
//
//   E2E_API=http://localhost:8090 E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... node tests/platform-e2e.mjs
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
  const type = res.headers.get('content-type') ?? ''
  const data = type.includes('application/json') ? await res.json().catch(() => null) : Buffer.from(await res.arrayBuffer())
  return { status: res.status, data, type }
}
const GET = (p, token) => call('GET', p, { token })
const POST = (p, token, body) => call('POST', p, { token, body })
const PUT = (p, token, body) => call('PUT', p, { token, body })

const run = Math.random().toString(36).slice(2, 8)
const password = `Pl4tform-${run}-pw`
const email = (label) => `pf-${label}-${run}@tuitionhub.test`
const fixture = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url))
const PNG = fixture('id-card.png')
const JPEG = fixture('certificate.jpg')
const PDF = Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n')
const future = (days) => new Date(Date.now() + days * 86400000).toISOString()
const month = new Date().toISOString().slice(0, 7)

async function register(label, role, name) {
  const r = await call('POST', '/api/v1/auth/register', { body: { name: name ?? `PF ${label} ${run}`, email: email(label), password, role } })
  if (r.status !== 201) throw new Error(`register ${label}: ${r.status} ${JSON.stringify(r.data)}`)
  return { token: r.data.tokens.access_token, id: r.data.user.id, email: email(label) }
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
  const app = sub.data?.verification?.id
  const d = await POST(`/api/v1/workflow/admin/verifications/${app}/decision`, admin, { decision: 'approved' })
  await relogin(user) // the token carries no status, but re-login proves the account is usable
  return sub.status === 202 && d.status === 204
}

async function main() {
  const adminLogin = await POST('/api/v1/auth/login', undefined, { email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
  const admin = adminLogin.data.tokens.access_token

  // ---------- accounts ----------
  const tutor = await register('tutor', 'tutor', `Tutor ${run}`)
  const tutor2 = await register('tutor2', 'tutor')
  const coaching = await register('coaching', 'coaching', `Centre ${run}`)
  const coaching2 = await register('coaching2', 'coaching')
  const parent = await register('parent', 'parent', `Parent ${run}`)
  const parent2 = await register('parent2', 'parent')
  const student = await register('student', 'student', `Student ${run}`)
  const student2 = await register('student2', 'student', `Learner ${run}`)

  // ---------- Journey 1a: tutor verification and profile ----------
  check('tutor: verified by admin', await verify(admin, tutor, [['identity', PNG]], { display_name: `Tutor ${run}`, education: 'BSc Physics, DU', subjects: ['Physics', 'Mathematics'], classes: ['HSC', 'Class 10'], areas: ['Uttara', 'Mirpur'] }))
  const prof = await PUT('/api/v1/workflow/profile', tutor.token, { bio: 'Concept-first physics.', fee_expectation: 7000, experience_years: 4, teaching_modes: ['offline', 'online'], mediums: ['Bangla Medium'], current_study: 'MSc, DU', results: 'CGPA 3.8', availability: { days: ['Sun', 'Tue'], time: 'Evening' } })
  check('tutor: rich profile saved after approval', prof.status === 204, JSON.stringify(prof.data))
  check('tutor: profile photo upload', (await upload(tutor.token, '/api/v1/profile/photo', 'photo', JPEG, 'me.jpg', 'image/jpeg')).status === 204)
  check('tutor: PDF rejected as profile photo', (await upload(tutor.token, '/api/v1/profile/photo', 'photo', PDF, 'me.pdf', 'application/pdf')).status === 400)

  // ---------- public discovery ----------
  let res = await GET(`/api/v1/public/tutors?subject=Physics&q=${encodeURIComponent(run)}`)
  const card = res.data.tutors?.find((t) => t.id === tutor.id)
  check('discovery: verified tutor is listed with profile', res.status === 200 && card?.fee_expectation === 7000 && card.has_photo && !('email' in card), JSON.stringify(res.data).slice(0, 300))
  check('discovery: unverified tutor is not listed', !(await GET(`/api/v1/public/tutors?q=${encodeURIComponent(run)}`)).data.tutors.some((t) => t.id === tutor2.id))
  check('discovery: subject filter excludes', !(await GET(`/api/v1/public/tutors?subject=Biology&q=${encodeURIComponent(run)}`)).data.tutors.some((t) => t.id === tutor.id))
  check('discovery: tutor profile page', (await GET(`/api/v1/public/tutors/${tutor.id}`)).status === 200)
  check('discovery: unverified tutor profile is 404', (await GET(`/api/v1/public/tutors/${tutor2.id}`)).status === 404)
  check('discovery: public photo of listed tutor', (await GET(`/api/v1/public/users/${tutor.id}/photo`)).status === 200)
  check('discovery: private photo of a parent is hidden', (await GET(`/api/v1/public/users/${parent.id}/photo`)).status === 404)

  // ---------- Journey 3a: guardian links ----------
  check('link: unknown student email is 404', (await POST('/api/v1/links', parent.token, { student_email: email('nobody'), relationship: 'mother' })).status === 404)
  check('link: tutor email is not a student', (await POST('/api/v1/links', parent.token, { student_email: tutor.email, relationship: 'mother' })).status === 404)
  check('link: parent requests student', (await POST('/api/v1/links', parent.token, { student_email: student.email, relationship: 'mother' })).status === 201)
  check('link: students cannot request links', (await POST('/api/v1/links', student.token, { student_email: student2.email, relationship: 'x' })).status === 403)
  let links = await GET('/api/v1/links', student.token)
  const link = links.data.links.find((l) => l.guardian_id === parent.id)
  check('link: parent cannot approve their own request', (await POST(`/api/v1/links/${link.id}/respond`, parent.token, { accept: true })).status === 409)
  check('link: student approves', (await POST(`/api/v1/links/${link.id}/respond`, student.token, { accept: true })).status === 204)
  check('progress: guardian can view', (await GET(`/api/v1/students/${student.id}/progress`, parent.token)).status === 200)
  check('progress: unrelated parent gets 404', (await GET(`/api/v1/students/${student.id}/progress`, parent2.token)).status === 404)

  // ---------- Journey 1b/3b: tuition post and applications ----------
  check('post: cannot post for an unlinked child', (await POST('/api/v1/tuition-posts', parent2.token, { subject: 'Physics', class_name: 'HSC', area: 'Uttara', mode: 'offline', student_id: student.id })).status === 403)
  check('post: tutors cannot post tuition', (await POST('/api/v1/tuition-posts', tutor.token, { subject: 'Physics', class_name: 'HSC', area: 'Uttara', mode: 'offline' })).status === 403)
  check('post: validation names the bad field', /mode/.test((await POST('/api/v1/tuition-posts', parent.token, { subject: 'Physics', class_name: 'HSC', area: 'Uttara', mode: 'teleport' })).data?.error ?? ''))
  res = await POST('/api/v1/tuition-posts', parent.token, { subject: 'Physics', class_name: 'HSC', medium: 'Bangla Medium', area: 'Uttara', mode: 'offline', days: 'Sun, Tue, Thu', time_slot: '6:30-7:30 PM', budget: 7000, requirements: `Board question practice ${run}`, student_id: student.id })
  check('post: parent posts for linked child', res.status === 201)
  const postId = res.data.id
  res = await GET(`/api/v1/tuition-posts?subject=Physics&q=${encodeURIComponent(run)}`, tutor.token)
  check('marketplace: tutor finds the post with filters', res.data.posts.some((p) => p.id === postId && p.budget === 7000))
  check('marketplace: public listing hides nothing sensitive', (await GET(`/api/v1/public/tuition/${postId}`)).data.post?.owner_name === `Parent ${run}`)
  check('apply: unverified tutor is refused', (await POST(`/api/v1/tuition-posts/${postId}/apply`, tutor2.token, { note: 'hi' })).status === 403)
  check('apply: verified tutor applies', (await POST(`/api/v1/tuition-posts/${postId}/apply`, tutor.token, { note: 'Experienced with HSC physics.' })).status === 201)
  check('apply: duplicate is 409', (await POST(`/api/v1/tuition-posts/${postId}/apply`, tutor.token, { note: 'again' })).status === 409)
  check('save: tutor saves post', (await POST(`/api/v1/tuition-posts/${postId}/save`, tutor.token)).status === 204 && (await GET('/api/v1/tuition-posts?saved=1', tutor.token)).data.posts.some((p) => p.id === postId))
  let mine = await GET('/api/v1/applications/mine', tutor.token)
  const appId = mine.data.applications.find((a) => a.listing_id === postId)?.id
  check('apply: tutor tracks application', !!appId && mine.data.applications[0].status === 'applied')
  check('apply: others cannot list applicants', (await GET(`/api/v1/tuition-posts/${postId}/applications`, parent2.token)).status === 403)
  check('apply: poster lists applicants', (await GET(`/api/v1/tuition-posts/${postId}/applications`, parent.token)).data.applications.length === 1)
  check('apply: tutor cannot accept own application', (await POST(`/api/v1/applications/${appId}/status`, tutor.token, { status: 'accepted' })).status === 400)
  check('apply: poster shortlists', (await POST(`/api/v1/applications/${appId}/status`, parent.token, { status: 'shortlisted' })).status === 200)
  res = await POST(`/api/v1/applications/${appId}/status`, parent.token, { status: 'accepted' })
  check('apply: poster accepts and a conversation opens', res.status === 200 && res.data.conversation_id)
  const conv = res.data.conversation_id
  check('apply: accepted cannot be withdrawn', (await POST(`/api/v1/applications/${appId}/status`, tutor.token, { status: 'withdrawn' })).status === 409)

  // ---------- chat requests ----------
  check('chat: tutors cannot send chat requests', (await POST('/api/v1/chat-requests', tutor.token, { to_id: parent.id })).status === 403)
  check('chat: cannot request an unverified tutor', (await POST('/api/v1/chat-requests', parent2.token, { to_id: tutor2.id })).status === 400)
  res = await POST('/api/v1/chat-requests', parent2.token, { to_id: tutor.id, message: 'Can you teach my son?' })
  check('chat: parent requests a tutor', res.status === 201)
  const reqId = res.data.id
  check('chat: duplicate pending is 409', (await POST('/api/v1/chat-requests', parent2.token, { to_id: tutor.id })).status === 409)
  check('chat: requester cannot accept', (await POST(`/api/v1/chat-requests/${reqId}/accept`, parent2.token)).status === 403)
  res = await POST(`/api/v1/chat-requests/${reqId}/accept`, tutor.token)
  check('chat: tutor accepts', res.status === 200 && res.data.conversation_id)
  const conv2 = res.data.conversation_id
  check('chat: answered request is final', (await POST(`/api/v1/chat-requests/${reqId}/decline`, tutor.token)).status === 409)

  // ---------- messaging ----------
  check('messages: system message opens the thread', (await GET(`/api/v1/conversations/${conv}/messages`, parent.token)).data.messages[0]?.sender_id === null)
  check('messages: parent sends', (await POST(`/api/v1/conversations/${conv}/messages`, parent.token, { body: 'Hello! When can you start?' })).status === 201)
  check('messages: empty message rejected', (await POST(`/api/v1/conversations/${conv}/messages`, parent.token, { body: '   ' })).status === 400)
  check('messages: tutor has unread', (await GET('/api/v1/conversations/unread', tutor.token)).data.unread >= 2)
  check('messages: outsider cannot read', (await GET(`/api/v1/conversations/${conv}/messages`, parent2.token)).status === 404)
  check('messages: outsider cannot post', (await POST(`/api/v1/conversations/${conv}/messages`, parent2.token, { body: 'hi' })).status === 404)
  await POST(`/api/v1/conversations/${conv}/read`, tutor.token)
  await POST(`/api/v1/conversations/${conv2}/read`, tutor.token)
  check('messages: read clears unread', (await GET('/api/v1/conversations/unread', tutor.token)).data.unread === 0)
  const convList = await GET('/api/v1/conversations', tutor.token)
  check('messages: conversation list names the other side', convList.data.conversations.some((c) => c.id === conv && c.other_name === `Parent ${run}`))
  check('block: tutor blocks parent2', (await POST(`/api/v1/users/${parent2.id}/block`, tutor.token)).status === 204)
  check('block: blocked user cannot message', (await POST(`/api/v1/conversations/${conv2}/messages`, parent2.token, { body: 'hello?' })).status === 403)

  // ---------- Journey 1c/3c: demo class and tuition agreement ----------
  check('tuition: cannot start without a conversation', (await POST('/api/v1/engagements', parent.token, { tutor_id: tutor2.id, subject: 'Physics', class_name: 'HSC', mode: 'offline' })).status === 403)
  check('tuition: past demo-class time rejected', (await POST('/api/v1/engagements', parent.token, { tutor_id: tutor.id, student_id: student.id, subject: 'Physics', class_name: 'HSC', mode: 'offline', trial_at: new Date(Date.now() - 3600e3).toISOString() })).status === 400)
  res = await POST('/api/v1/engagements', parent.token, { tutor_id: tutor.id, student_id: student.id, listing_id: postId, subject: 'Physics', class_name: 'HSC', mode: 'offline', trial_at: future(2), trial_note: 'Trial at home' })
  check('tuition: demo class requested', res.status === 201)
  const eng = res.data.id
  const act = (token, body) => POST(`/api/v1/engagements/${eng}/actions`, token, body)
  check('tuition: guardian cannot accept own demo request', (await act(parent.token, { action: 'accept_trial' })).status === 409)
  check('tuition: tutor accepts demo class', (await act(tutor.token, { action: 'accept_trial' })).status === 200)
  check('tuition: terms need fee, mode and start', (await act(tutor.token, { action: 'propose' })).status === 400)
  check('tuition: tutor proposes terms', (await act(tutor.token, { action: 'propose', days: 'Sun, Tue, Thu', time_slot: '6:30-7:30 PM', mode: 'offline', monthly_fee: 7000, start_date: future(5).slice(0, 10), location_note: 'Uttara Sector 7' })).status === 200)
  check('tuition: proposer cannot confirm twice', (await act(tutor.token, { action: 'confirm' })).status === 409)
  let list = await GET('/api/v1/engagements', parent.token)
  check('tuition: contact hidden before confirmation', list.data.engagements.find((e) => e.id === eng)?.contact === undefined)
  res = await act(parent.token, { action: 'confirm' })
  check('tuition: guardian confirms -> active with classroom', res.status === 200 && res.data.status === 'active' && res.data.classroom_id)
  const room = res.data.classroom_id
  list = await GET('/api/v1/engagements', parent.token)
  check('tuition: contact shared once active', list.data.engagements.find((e) => e.id === eng)?.contact?.email === tutor.email)
  check('tuition: post marked filled', (await GET('/api/v1/tuition-posts/mine', parent.token)).data.posts.find((p) => p.id === postId)?.status === 'filled')
  check('tuition: outsiders cannot act', (await act(parent2.token, { action: 'cancel', reason: 'nope nope' })).status === 404)

  // ---------- Journey 1d/4: classroom ----------
  check('classroom: student sees it', (await GET('/api/v1/classrooms', student.token)).data.classrooms.some((c) => c.id === room))
  check('classroom: guardian sees it with child name', (await GET('/api/v1/classrooms', parent.token)).data.classrooms.some((c) => c.id === room && c.child_name === `Student ${run}`))
  check('classroom: outsider gets 404', (await GET(`/api/v1/classrooms/${room}`, parent2.token)).status === 404)
  check('material: student cannot add', (await upload(student.token, `/api/v1/classrooms/${room}/materials`, 'file', PDF, 'x.pdf', 'application/pdf', { title: 'x' })).status === 403)
  check('material: tutor adds PDF notes', (await upload(tutor.token, `/api/v1/classrooms/${room}/materials`, 'file', PDF, 'vectors.pdf', 'application/pdf', { title: 'Vectors notes', body: 'Read before class', link_url: 'https://example.com/vectors' })).status === 204)
  check('material: bad link rejected', (await upload(tutor.token, `/api/v1/classrooms/${room}/materials`, 'file', PNG, 'a.png', 'image/png', { title: 'x', link_url: 'javascript:alert(1)' })).status === 400)
  check('material: script file rejected', (await upload(tutor.token, `/api/v1/classrooms/${room}/materials`, 'file', Buffer.from('<script>alert(1)</script>'), 'x.html', 'text/html', { title: 'x' })).status === 400)
  let detail = await GET(`/api/v1/classrooms/${room}`, student.token)
  const material = detail.data.materials?.[0]
  check('material: student sees it and can download', material?.title === 'Vectors notes' && (await GET(`/api/v1/materials/${material.id}/file`, student.token)).status === 200)
  check('material: outsider download is 404', (await GET(`/api/v1/materials/${material.id}/file`, parent2.token)).status === 404)

  check('assignment: needs a due date', (await POST(`/api/v1/classrooms/${room}/assignments`, tutor.token, { kind: 'homework', title: 'x' })).status === 400)
  check('assignment: tutor creates', (await POST(`/api/v1/classrooms/${room}/assignments`, tutor.token, { kind: 'assignment', title: 'Model test 1', instructions: 'Answer all', due_at: future(3), max_score: 20 })).status === 204)
  detail = await GET(`/api/v1/classrooms/${room}`, student.token)
  const asg = detail.data.assignments[0]
  check('assignment: student sees it', asg?.title === 'Model test 1' && asg.my_status === null)
  check('submit: empty submission rejected', (await call('POST', `/api/v1/assignments/${asg.id}/submit`, { token: student.token, form: new FormData() })).status === 400)
  check('submit: student submits a picture', (await upload(student.token, `/api/v1/assignments/${asg.id}/submit`, 'file', PNG, 'answers.png', 'image/png', { note: 'Done' })).status === 201)
  check('submit: guardian cannot submit', (await upload(parent.token, `/api/v1/assignments/${asg.id}/submit`, 'file', PNG, 'a.png', 'image/png')).status === 403)
  let subs = await GET(`/api/v1/assignments/${asg.id}/submissions`, tutor.token)
  const subId = subs.data.submissions[0]?.id
  check('submit: tutor sees the submission', subs.data.submissions.length === 1 && subs.data.submissions[0].file_name === 'answers.png')
  check('submit: guardian may open the file', (await GET(`/api/v1/submissions/${subId}/file`, parent.token)).status === 200)
  check('submit: outsider may not open the file', (await GET(`/api/v1/submissions/${subId}/file`, parent2.token)).status === 404)
  check('review: score above max rejected', (await POST(`/api/v1/submissions/${subId}/review`, tutor.token, { score: 25, status: 'reviewed' })).status === 400)
  check('review: student cannot grade', (await POST(`/api/v1/submissions/${subId}/review`, student.token, { score: 20, status: 'reviewed' })).status === 403)
  check('review: tutor grades with feedback', (await POST(`/api/v1/submissions/${subId}/review`, tutor.token, { score: 18, feedback: 'Great work', status: 'reviewed' })).status === 204)
  detail = await GET(`/api/v1/classrooms/${room}`, student.token)
  check('review: student sees score and feedback', detail.data.assignments[0].my_score === 18 && detail.data.assignments[0].my_feedback === 'Great work')
  check('submit: reviewed work is locked', (await upload(student.token, `/api/v1/assignments/${asg.id}/submit`, 'file', PNG, 'b.png', 'image/png')).status === 409)

  check('schedule: tutor schedules weekly classes', (await POST(`/api/v1/classrooms/${room}/sessions`, tutor.token, { starts_at: future(1), ends_at: new Date(Date.now() + 86400000 + 3600e3).toISOString(), repeat_weeks: 3 })).status === 204)
  detail = await GET(`/api/v1/classrooms/${room}`, tutor.token)
  check('schedule: 4 sessions created', detail.data.sessions.length === 4)
  const sess = detail.data.sessions[detail.data.sessions.length - 1].id
  check('attendance: non-member rejected', (await POST(`/api/v1/sessions/${sess}/attendance`, tutor.token, { marks: [{ learner_kind: 'user', learner_id: student2.id, mark: 'present' }] })).status === 400)
  check('attendance: student cannot mark', (await POST(`/api/v1/sessions/${sess}/attendance`, student.token, { marks: [{ learner_kind: 'user', learner_id: student.id, mark: 'present' }] })).status === 403)
  check('attendance: tutor marks absent', (await POST(`/api/v1/sessions/${sess}/attendance`, tutor.token, { marks: [{ learner_kind: 'user', learner_id: student.id, mark: 'absent' }] })).status === 204)
  check('attendance: guardian notified of absence', (await GET('/api/v1/workflow/notifications', parent.token)).data.notifications.some((n) => n.title === 'Absence recorded'))
  check('schedule: reschedule needs a new time', (await POST(`/api/v1/sessions/${detail.data.sessions[0].id}/status`, tutor.token, { status: 'rescheduled' })).status === 400)
  check('schedule: cancel a class', (await POST(`/api/v1/sessions/${detail.data.sessions[0].id}/status`, tutor.token, { status: 'cancelled', note: 'Exam week' })).status === 204)
  check('diary: tutor writes today', (await POST(`/api/v1/classrooms/${room}/diary`, tutor.token, { entry_date: new Date().toISOString().slice(0, 10), topics: 'Vectors: dot product', homework: 'Ex 3.2' })).status === 204)
  detail = await GET(`/api/v1/classrooms/${room}`, parent.token)
  check('diary: guardian reads it', detail.data.diary[0]?.topics === 'Vectors: dot product' && detail.data.access === 'viewer')
  const progress = await GET(`/api/v1/students/${student.id}/progress`, parent.token)
  check('progress: attendance and grades computed', progress.data.absent === 1 && progress.data.reviewed === 1 && Math.round(progress.data.average_score_percent) === 90, JSON.stringify(progress.data))

  // ---------- payments and reviews ----------
  check('payment: guardian cannot raise a due', (await POST(`/api/v1/engagements/${eng}/payments`, parent.token, { action: 'due', month })).status === 403)
  check('payment: tutor records month due', (await POST(`/api/v1/engagements/${eng}/payments`, tutor.token, { action: 'due', month })).status === 204)
  check('payment: guardian marks paid', (await POST(`/api/v1/engagements/${eng}/payments`, parent.token, { action: 'mark_paid', month, note: 'bKash' })).status === 204)
  check('payment: tutor confirms receipt', (await POST(`/api/v1/engagements/${eng}/payments`, tutor.token, { action: 'confirm', month })).status === 204)
  check('payment: confirmed cannot be disputed', (await POST(`/api/v1/engagements/${eng}/payments`, parent.token, { action: 'dispute', month, note: 'wrong amount' })).status === 409)
  check('payment: ledger shows confirmed', (await GET(`/api/v1/engagements/${eng}/payments`, parent.token)).data.payments[0]?.status === 'confirmed')
  check('review: tutor cannot review self', (await POST(`/api/v1/engagements/${eng}/review`, tutor.token, { stars: 5 })).status === 403)
  check('review: guardian reviews', (await POST(`/api/v1/engagements/${eng}/review`, parent.token, { stars: 5, body: 'Excellent and punctual.' })).status === 204)
  const pub = await GET(`/api/v1/public/tutors/${tutor.id}`)
  check('review: public rating updated', pub.data.tutor.rating === 5 && pub.data.tutor.review_count === 1 && pub.data.reviews[0].body === 'Excellent and punctual.')
  check('review: tutor replies', (await POST(`/api/v1/reviews/${pub.data.reviews[0].id}/reply`, tutor.token, { reply: 'Thank you!' })).status === 204)
  check('tuition: complete', (await act(tutor.token, { action: 'complete' })).status === 200)

  // ---------- Journey 2: coaching ----------
  check('coaching: verified with licence and owner ID', await verify(admin, coaching, [['trade_license', JPEG], ['owner_identity', PNG]], { display_name: `Centre ${run}`, institution: `Centre ${run} Academy`, education: 'TRAD/0001', subjects: ['Mathematics', 'Physics'], classes: ['SSC'], areas: ['Mohakhali'] }))
  check('coaching: tutors cannot use coaching APIs', (await GET('/api/v1/coaching/teachers', tutor.token)).status === 403)
  res = await POST('/api/v1/coaching/teachers', coaching.token, { name: 'Anwar Hossain', subject: 'Mathematics', qualification: 'MSc Math', phone: '01700000000' })
  check('coaching: add teacher', res.status === 201)
  const teacher = res.data.id
  const otherTeacher = (await POST('/api/v1/coaching/teachers', coaching2.token, { name: 'Other' })).data.id
  check('coaching: cannot edit another centre\'s teacher', (await PUT(`/api/v1/coaching/teachers/${otherTeacher}`, coaching.token, { name: 'Hijack' })).status === 404)
  const course = (await POST('/api/v1/coaching/courses', coaching.token, { name: 'SSC Science', subjects: ['Mathematics', 'Physics'], monthly_fee: 3000 })).data.id
  check('coaching: add course', !!course)
  const branch = (await POST('/api/v1/coaching/branches', coaching.token, { name: 'Mohakhali', address: 'Road 5' })).data.id
  check('coaching: add branch', !!branch)
  check('coaching: batch cannot use another centre\'s teacher', (await POST('/api/v1/coaching/batches', coaching.token, { name: 'X', subject: 'Math', teacher_id: otherTeacher })).status === 400)
  res = await POST('/api/v1/coaching/batches', coaching.token, { name: 'SSC Maths A', subject: 'Mathematics', class_name: 'SSC', course_id: course, branch_id: branch, teacher_id: teacher, days: 'Sat, Mon, Wed', time_slot: '4:00 PM', room: '201', capacity: 2, monthly_fee: 3000 })
  check('coaching: create batch', res.status === 201)
  const batch = res.data.id
  check('coaching: student link needs a real student account', (await POST('/api/v1/coaching/students', coaching.token, { name: 'X', student_email: parent.email })).status === 404)
  const rosterA = (await POST('/api/v1/coaching/students', coaching.token, { name: `Learner ${run}`, class_name: 'SSC', guardian_name: 'Guardian', guardian_phone: '01800000000', student_email: student2.email, guardian_email: parent2.email })).data.id
  const rosterB = (await POST('/api/v1/coaching/students', coaching.token, { name: 'Walk-in Student', class_name: 'SSC' })).data.id
  const rosterC = (await POST('/api/v1/coaching/students', coaching.token, { name: 'Third Student', class_name: 'SSC' })).data.id
  check('coaching: admit students (with and without accounts)', !!rosterA && !!rosterB && !!rosterC)
  check('coaching: enrol A', (await POST(`/api/v1/coaching/batches/${batch}/enrollments/${rosterA}`, coaching.token)).status === 204)
  check('coaching: enrol B', (await POST(`/api/v1/coaching/batches/${batch}/enrollments/${rosterB}`, coaching.token)).status === 204)
  check('coaching: capacity enforced', (await POST(`/api/v1/coaching/batches/${batch}/enrollments/${rosterC}`, coaching.token)).status === 409)
  const batches = (await GET('/api/v1/coaching/batches', coaching.token)).data.batches
  const batchRoom = batches.find((b) => b.id === batch)?.classroom_id
  check('coaching: batch has a classroom and 2 enrolled', !!batchRoom && batches.find((b) => b.id === batch).enrolled === 2)
  check('coaching: linked student sees the batch classroom', (await GET('/api/v1/classrooms', student2.token)).data.classrooms.some((c) => c.id === batchRoom))
  await POST(`/api/v1/classrooms/${batchRoom}/sessions`, coaching.token, { starts_at: future(1) })
  const bsess = (await GET(`/api/v1/classrooms/${batchRoom}`, coaching.token)).data.sessions[0].id
  check('coaching: roster attendance', (await POST(`/api/v1/sessions/${bsess}/attendance`, coaching.token, { marks: [{ learner_kind: 'roster', learner_id: rosterA, mark: 'present' }, { learner_kind: 'roster', learner_id: rosterB, mark: 'late' }] })).status === 204)
  check('coaching: roster outside the batch rejected', (await POST(`/api/v1/sessions/${bsess}/attendance`, coaching.token, { marks: [{ learner_kind: 'roster', learner_id: rosterC, mark: 'present' }] })).status === 400)
  check('coaching: batch assignment', (await POST(`/api/v1/classrooms/${batchRoom}/assignments`, coaching.token, { kind: 'homework', title: 'Algebra set 1', due_at: future(4), max_score: 10 })).status === 204)
  const exam = (await POST('/api/v1/coaching/exams', coaching.token, { batch_id: batch, title: 'Monthly test', exam_date: new Date().toISOString().slice(0, 10), total_marks: 50 })).data.id
  check('coaching: create exam', !!exam)
  check('coaching: marks above total rejected', (await POST(`/api/v1/coaching/exams/${exam}/marks`, coaching.token, { marks: { [rosterA]: 60 } })).status === 400)
  check('coaching: enter and publish marks', (await POST(`/api/v1/coaching/exams/${exam}/marks`, coaching.token, { marks: { [rosterA]: 45, [rosterB]: 30 }, publish: true })).status === 204)
  check('coaching: published marks are locked', (await POST(`/api/v1/coaching/exams/${exam}/marks`, coaching.token, { marks: { [rosterA]: 50 } })).status === 409)
  check('coaching: student sees published result', (await GET('/api/v1/results', student2.token)).data.results.some((r) => r.marks === 45 && r.total_marks === 50))
  check('coaching: linked guardian sees result', (await GET('/api/v1/results', parent2.token)).data.results.some((r) => r.marks === 45))
  res = await POST('/api/v1/coaching/fees/generate', coaching.token, { month })
  check('coaching: fees generated for enrolled students', res.status === 200 && res.data.created === 2)
  check('coaching: generating again creates none', (await POST('/api/v1/coaching/fees/generate', coaching.token, { month })).data.created === 0)
  const fees = (await GET(`/api/v1/coaching/fees?month=${month}`, coaching.token)).data.fees
  const feeA = fees.find((f) => f.student_id === rosterA)
  const feeB = fees.find((f) => f.student_id === rosterB)
  check('coaching: remind guardian with account', (await POST(`/api/v1/coaching/fees/${feeA.id}/remind`, coaching.token)).status === 204)
  check('coaching: remind without guardian account is refused', (await POST(`/api/v1/coaching/fees/${feeB.id}/remind`, coaching.token)).status === 409)
  check('coaching: mark fee paid', (await POST(`/api/v1/coaching/fees/${feeB.id}/paid`, coaching.token)).status === 204)
  const report = (await GET('/api/v1/coaching/report', coaching.token)).data
  check('coaching: report from real data', report.students === 3 && report.batches === 1 && report.attendance_percent === 100 && report.fees_paid === 3000 && report.exams_published === 1, JSON.stringify(report))
  const centre = (await GET(`/api/v1/public/coaching/${coaching.id}`)).data.centre
  check('coaching: public profile counts', centre?.teachers === 1 && centre.batch_list.length === 1)

  // ---------- Journey 5: admin platform ----------
  check('admin: non-admin blocked', (await GET('/api/v1/admin/tickets', tutor.token)).status === 403)
  res = await POST('/api/v1/support-tickets', parent2.token, { category: 'report_user', title: 'Rude messages', body: 'The tutor blocked me after one message.', subject_user_id: tutor.id })
  check('support: user files a report', res.status === 201)
  const ticket = res.data.id
  check('support: admin sees it', (await GET('/api/v1/admin/tickets?status=open', admin)).data.tickets.some((t) => t.id === ticket))
  check('support: resolution required', (await POST(`/api/v1/admin/tickets/${ticket}`, admin, { status: 'resolved' })).status === 400)
  check('support: admin resolves', (await POST(`/api/v1/admin/tickets/${ticket}`, admin, { status: 'resolved', resolution: 'Reviewed messages; no violation.' })).status === 204)
  check('support: reporter notified and sees status', (await GET('/api/v1/support-tickets/mine', parent2.token)).data.tickets.find((t) => t.id === ticket)?.status === 'resolved')
  check('settings: invalid type rejected', (await PUT('/api/v1/admin/settings', admin, { registrations_open: 'nope' })).status === 400)
  check('settings: unknown key rejected', (await PUT('/api/v1/admin/settings', admin, { hack: true })).status === 400)
  check('settings: close registrations', (await PUT('/api/v1/admin/settings', admin, { registrations_open: false })).status === 204)
  check('settings: registration refused while closed', (await call('POST', '/api/v1/auth/register', { body: { name: 'Late', email: email('late'), password, role: 'parent' } })).status === 403)
  check('settings: pause tutor applications', (await PUT('/api/v1/admin/settings', admin, { tutor_applications_open: false })).status === 204)
  const p3 = (await POST('/api/v1/tuition-posts', parent.token, { subject: 'Biology', class_name: 'SSC', area: 'Mirpur', mode: 'offline' })).data.id
  check('settings: applications refused while paused', (await POST(`/api/v1/tuition-posts/${p3}/apply`, tutor.token, { note: 'x' })).status === 403)
  await PUT('/api/v1/admin/settings', admin, { tutor_applications_open: true, maintenance_banner: `Maintenance ${run}` })
  check('settings: maintenance banner is public', (await GET('/api/v1/public/info')).data.maintenance_banner === `Maintenance ${run}`)
  await PUT('/api/v1/admin/settings', admin, { maintenance_banner: '' })
  check('contact: anonymous request reaches the support queue', (await call('POST', '/api/v1/public/contact', { body: { name: 'Visitor', email: email('visitor'), subject: `Question ${run}`, body: 'How do I register my coaching centre?' } })).status === 201 && (await GET('/api/v1/admin/tickets?category=support', admin)).data.tickets.some((t) => t.title === `Question ${run}`))
  check('contact: validation', (await call('POST', '/api/v1/public/contact', { body: { name: 'V', email: 'not-an-email', subject: 'x', body: 'short' } })).status === 400)
  check('settings: reopen registrations', (await PUT('/api/v1/admin/settings', admin, { registrations_open: true })).status === 204 && (await GET('/api/v1/admin/settings', admin)).data.settings.registrations_open === true)
  res = await POST('/api/v1/admin/announcements', admin, { role: 'tutor', title: `Notice ${run}`, body: 'Profile review week.' })
  check('announce: sent to tutors', res.status === 200 && res.data.recipients >= 2)
  check('announce: tutor received, parent did not', (await GET('/api/v1/workflow/notifications', tutor.token)).data.notifications.some((n) => n.title === `Notice ${run}`) && !(await GET('/api/v1/workflow/notifications', parent.token)).data.notifications.some((n) => n.title === `Notice ${run}`))
  check('awards: grant to tutor', (await POST('/api/v1/admin/awards', admin, { user_id: tutor.id, title: 'Top Physics Tutor' })).status === 204)
  check('awards: shown on public profile', (await GET(`/api/v1/public/tutors/${tutor.id}`)).data.awards.some((a) => a.title === 'Top Physics Tutor'))
  check('awards: not for parents', (await POST('/api/v1/admin/awards', admin, { user_id: parent.id, title: 'x' })).status === 400)
  const posts = await GET(`/api/v1/admin/tuition-posts?q=${encodeURIComponent('Uttara')}`, admin)
  check('admin: tuition posts listed', posts.status === 200 && posts.data.total >= 1)
  const p2 = (await POST('/api/v1/tuition-posts', student2.token, { subject: 'ICT', class_name: 'SSC', area: 'Badda', mode: 'online' })).data.id
  check('admin: close a post', (await POST(`/api/v1/admin/tuition-posts/${p2}/status`, admin, { status: 'closed', reason: 'Spam' })).status === 204)
  check('admin: closed post cannot be reopened by owner', (await POST(`/api/v1/tuition-posts/${p2}/status`, student2.token, { status: 'open' })).status === 409)
  const detailU = await GET(`/api/v1/admin/users/${tutor.id}`, admin)
  check('admin: user activity detail', detailU.status === 200 && detailU.data.activity.applications === 1 && detailU.data.activity.tuitions === 1)
  const rep = await GET('/api/v1/admin/reports', admin)
  check('admin: platform report from real data', rep.status === 200 && rep.data.signups.tutor >= 2 && rep.data.messages >= 1)
  for (let i = 0; i < 5; i++) await POST('/api/v1/auth/login', undefined, { email: student.email, password: 'wrong-password-x' })
  check('admin: repeated failed logins flagged', (await GET('/api/v1/admin/suspicious', admin)).data.accounts.some((a) => a.id === student.id))

  console.log(`\nrun ${run}: ${pass} pass, ${fail} fail`)
  if (fail) { console.log('Failed:', failures.join('; ')); process.exit(1) }
}

main().catch((e) => { console.error(e); process.exit(1) })
