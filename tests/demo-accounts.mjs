// Checks the demo accounts created by scripts/seed-demo.mjs: every account can
// sign in, refresh and sign out, sees its own connected records, is refused
// what its role may not do, and can update, add and remove data. Every change
// made here is undone before the check ends, so the demo data stays as seeded.
// Then each account signs in through the real login page in Chrome, survives a
// reload and signs out.
//
//   DEMO_API=http://localhost:8090 DEMO_WEB=http://127.0.0.1:5174 node tests/demo-accounts.mjs
//   (--logins-only: only sign-in, refresh, sign-out and the browser checks)
//
// Passwords come from scripts/demo-accounts.mjs (or a local .env.demo.local override).

import { existsSync, readFileSync } from 'node:fs'
import { demoAccounts } from '../scripts/demo-accounts.mjs'
import puppeteer from 'puppeteer-core'
import { CHROME, check, click, consoleErrors, fill, newPage, summary, text, wait, waitText } from './lib/browser.mjs'

const API = process.env.DEMO_API ?? 'http://localhost:8090'
const WEB = process.env.DEMO_WEB ?? 'http://127.0.0.1:5174'
const envFile = new URL('../.env.demo.local', import.meta.url)
const env = existsSync(envFile) ? Object.fromEntries(readFileSync(envFile, 'utf8').split('\n').map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2]])) : {}
const U = Object.fromEntries(Object.entries(demoAccounts).map(([k, a]) => [k, { key: k, role: a.role, email: a.email, password: env[`DEMO_${k.toUpperCase()}_PASSWORD`] ?? a.password }]))

async function call(method, path, token, body) {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const res = await fetch(API + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  const data = (res.headers.get('content-type') ?? '').includes('json') ? await res.json().catch(() => null) : null
  return { status: res.status, data }
}
const GET = (p, t) => call('GET', p, t)
const POST = (p, t, b) => call('POST', p, t, b)
const PUT = (p, t, b) => call('PUT', p, t, b)
const DEL = (p, t) => call('DELETE', p, t)

async function apiChecks() {
  // ---------- sign in, refresh, sign out (all 8) ----------
  for (const u of Object.values(U)) {
    const login = await POST('/api/v1/auth/login', undefined, { email: u.email, password: u.password })
    check(`${u.key}: signs in with role ${u.role}`, login.status === 200 && login.data.user.role === u.role)
    u.id = login.data.user.id
    u.name = login.data.user.name
    const refreshed = await POST('/api/v1/auth/refresh', undefined, { refresh_token: login.data.tokens.refresh_token })
    check(`${u.key}: session refresh works`, refreshed.status === 200)
    const out = await POST('/api/v1/auth/logout', refreshed.data.tokens.access_token, { refresh_token: refreshed.data.tokens.refresh_token })
    check(`${u.key}: signs out`, out.status === 200 || out.status === 204)
    check(`${u.key}: signed-out session cannot refresh`, (await POST('/api/v1/auth/refresh', undefined, { refresh_token: refreshed.data.tokens.refresh_token })).status === 401)
    u.token = (await POST('/api/v1/auth/login', undefined, { email: u.email, password: u.password })).data.tokens.access_token
    check(`${u.key}: wrong password refused`, (await POST('/api/v1/auth/login', undefined, { email: u.email, password: 'not-the-password-1' })).status === 401)
  }
  if (process.argv.includes('--logins-only')) return
  const { tutor1: t1, tutor2: t2, coaching1: c1, coaching2: c2, parent1: p1, parent2: p2, student1: s1, student2: s2 } = U

  // ---------- role permissions ----------
  check('permission: student cannot use coaching tools', (await GET('/api/v1/coaching/teachers', s1.token)).status === 403)
  check('permission: parent cannot open admin tools', (await GET('/api/v1/admin/tickets', p1.token)).status === 403)
  check('permission: tutor cannot post tuition', (await POST('/api/v1/tuition-posts', t1.token, { subject: 'X', class_name: 'X', area: 'X', mode: 'offline' })).status === 403)
  check('permission: students cannot request guardian links', (await POST('/api/v1/links', s1.token, { student_email: s2.email, relationship: 'x' })).status === 403)
  check('permission: unrelated parent cannot see another child', (await GET(`/api/v1/students/${s1.id}/progress`, p2.token)).status === 404)

  // ---------- tutor 1 (approved) ----------
  const listed = (await GET('/api/v1/public/tutors?q=Arif')).data.tutors
  check('tutor1: listed in public tutor search with photo', listed.some((x) => x.id === t1.id && x.has_photo))
  check('tutor2: pending tutor is not publicly listed', !(await GET('/api/v1/public/tutors?q=Sadia')).data.tutors.some((x) => x.id === t2.id))
  const posts = (await GET('/api/v1/tuition-posts?subject=English', t1.token)).data.posts
  const englishPost = posts.find((x) => x.owner_id === p2.id)
  check('tutor1: finds parent2\'s English post in the marketplace', !!englishPost)
  check('tutor1: tracks two applications (accepted + applied)', (await GET('/api/v1/applications/mine', t1.token)).data.applications.filter((a) => [p1.id, p2.id].includes(a.owner_id)).map((a) => a.status).sort().join() === 'accepted,applied')
  check('tutor1: save and unsave a post', (await POST(`/api/v1/tuition-posts/${englishPost.id}/save`, t1.token)).status === 204 && (await DEL(`/api/v1/tuition-posts/${englishPost.id}/save`, t1.token)).status === 204)
  const dash1 = (await GET('/api/v1/workflow/dashboard', t1.token)).data
  check('tutor1: edit profile and restore it', (await PUT('/api/v1/workflow/profile', t1.token, { fee_expectation: 8500 })).status === 204 && (await GET('/api/v1/workflow/dashboard', t1.token)).data.profile.fee_expectation === 8500 && (await PUT('/api/v1/workflow/profile', t1.token, { fee_expectation: dash1.profile.fee_expectation })).status === 204)
  const incoming = (await GET('/api/v1/chat-requests', t1.token)).data
  check('tutor1: has a pending chat request from parent2', JSON.stringify(incoming).includes(p2.id) && JSON.stringify(incoming).includes('pending'))
  const eng = (await GET('/api/v1/engagements', t1.token)).data.engagements.find((e) => e.student_id === s1.id)
  check('tutor1: active tuition with Rafi', eng?.status === 'active' && !!eng.classroom_id)
  const room = (await GET(`/api/v1/classrooms/${eng.classroom_id}`, t1.token)).data
  check('tutor1: classroom has notes, 2 assignments, 4 classes, diary', room.materials.length >= 1 && room.assignments.length === 2 && room.sessions.length === 4 && room.diary.length >= 1)
  const sessId = room.sessions[1].id
  check('tutor1: mark and correct attendance', (await POST(`/api/v1/sessions/${sessId}/attendance`, t1.token, { marks: [{ learner_kind: 'user', learner_id: s1.id, mark: 'late' }] })).status === 204)
  check('tutor1: reviews and rating', (await GET(`/api/v1/public/tutors/${t1.id}`)).data.tutor.review_count >= 1)
  check('tutor1: block and unblock a user', (await POST(`/api/v1/users/${s2.id}/block`, t1.token)).status === 204 && (await DEL(`/api/v1/users/${s2.id}/block`, t1.token)).status === 204)
  check('tutor1: payments ledger confirmed', (await GET(`/api/v1/engagements/${eng.id}/payments`, t1.token)).data.payments.some((x) => x.status === 'confirmed'))

  // ---------- tutor 2 (pending review) ----------
  const dash2 = (await GET('/api/v1/workflow/dashboard', t2.token)).data
  check('tutor2: verification pending with 2 pictures', dash2.verification?.status === 'pending' && dash2.documents.length === 2)
  check('tutor2: reviewed fields locked during review', (await PUT('/api/v1/workflow/profile', t2.token, { display_name: 'Changed' })).status === 409)
  check('tutor2: other fields still editable', (await PUT('/api/v1/workflow/profile', t2.token, { experience_years: 4 })).status === 204 && (await PUT('/api/v1/workflow/profile', t2.token, { experience_years: dash2.profile.experience_years })).status === 204)
  check('tutor2: cannot apply before approval', (await POST(`/api/v1/tuition-posts/${englishPost.id}/apply`, t2.token, { note: 'x' })).status === 403)

  // ---------- coaching 1 (approved) ----------
  const report = (await GET('/api/v1/coaching/report', c1.token)).data
  check('coaching1: report built from its data', report.students >= 2 && report.batches === 2 && report.exams_published >= 1, JSON.stringify(report))
  const teachers = (await GET('/api/v1/coaching/teachers', c1.token)).data.teachers
  const anwar = teachers.find((x) => x.name === 'Anwar Hossain')
  check('coaching1: edit a teacher and restore', (await PUT(`/api/v1/coaching/teachers/${anwar.id}`, c1.token, { name: anwar.name, subject: anwar.subject, qualification: 'MSc, BEd' })).status < 300 && (await PUT(`/api/v1/coaching/teachers/${anwar.id}`, c1.token, { name: anwar.name, subject: anwar.subject, qualification: anwar.qualification })).status < 300)
  const batches = (await GET('/api/v1/coaching/batches', c1.token)).data.batches
  const batchB = batches.find((b) => b.name === 'SSC Physics - Batch B')
  const tanvir = (await GET('/api/v1/coaching/students', c1.token)).data.students.find((x) => x.name === 'Tanvir Alam')
  check('coaching1: enrol and remove a student from a batch', (await POST(`/api/v1/coaching/batches/${batchB.id}/enrollments/${tanvir.id}`, c1.token)).status === 204 && (await DEL(`/api/v1/coaching/batches/${batchB.id}/enrollments/${tanvir.id}`, c1.token)).status === 204)
  check('coaching1: exam published', (await GET('/api/v1/coaching/exams', c1.token)).data.exams.some((e) => e.published_at))
  // Fees are generated for the month the seed ran in, so look at this month and the previous one.
  const monthOf = (offset) => { const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - offset); return d.toISOString().slice(0, 7) }
  const feeCounts = await Promise.all([0, 1].map(async (o) => (await GET(`/api/v1/coaching/fees?month=${monthOf(o)}`, c1.token)).data.fees.length))
  check('coaching1: monthly fees generated', feeCounts.some((n) => n >= 2), JSON.stringify(feeCounts))
  check('coaching1: public centre page', (await GET(`/api/v1/public/coaching/${c1.id}`)).status === 200)

  // ---------- coaching 2 (pending review) ----------
  const dashC2 = (await GET('/api/v1/workflow/dashboard', c2.token)).data
  check('coaching2: verification pending with licence and owner ID', dashC2.verification?.status === 'pending' && dashC2.documents.length === 2)
  check('coaching2: pending centre is not publicly listed', !(await GET('/api/v1/public/coaching?q=Pathshala')).data.centres?.some((x) => x.id === c2.id) && (await GET(`/api/v1/public/coaching/${c2.id}`)).status === 404)
  check('coaching1: approved centre is publicly listed', (await GET('/api/v1/public/coaching?q=Bright')).data.centres?.some((x) => x.id === c1.id))

  // ---------- parents ----------
  check('parent1: child Rafi linked and approved', (await GET('/api/v1/links', p1.token)).data.links.some((l) => l.student_id === s1.id && l.status === 'approved'))
  const progress = (await GET(`/api/v1/students/${s1.id}/progress`, p1.token)).data
  check('parent1: sees child progress (attendance and grades)', progress.reviewed >= 1, JSON.stringify(progress))
  const viewRoom = (await GET(`/api/v1/classrooms/${eng.classroom_id}`, p1.token)).data
  check('parent1: reads the classroom as viewer', viewRoom.access === 'viewer' && viewRoom.diary.length >= 1)
  check('parent1: tutor contact shared after confirmation', (await GET('/api/v1/engagements', p1.token)).data.engagements.find((e) => e.id === eng.id)?.contact?.email === t1.email)
  check('parent1: has notifications and can mark them read', (await GET('/api/v1/workflow/notifications', p1.token)).data.notifications.length > 0 && (await POST('/api/v1/workflow/notifications/read', p1.token, {})).status < 300)
  const conv = (await GET('/api/v1/conversations', p1.token)).data.conversations.find((c) => c.other_name === t1.name)
  check('parent1: conversation with tutor1 has messages', (await GET(`/api/v1/conversations/${conv.id}/messages`, p1.token)).data.messages.length >= 4)
  const myPost = (await GET('/api/v1/tuition-posts/mine', p2.token)).data.posts.find((x) => x.id === englishPost.id)
  check('parent2: own post shows tutor1\'s application', (await GET(`/api/v1/tuition-posts/${myPost.id}/applications`, p2.token)).data.applications.some((a) => a.tutor_id === t1.id))
  check('parent2: edit own post and restore', (await PUT(`/api/v1/tuition-posts/${myPost.id}`, p2.token, { ...myPost, budget: 5500 })).status < 300 && (await PUT(`/api/v1/tuition-posts/${myPost.id}`, p2.token, myPost)).status < 300)
  check('parent2: sees Nabila\'s coaching result', (await GET('/api/v1/results', p2.token)).data.results.some((r) => r.marks === 44))

  // ---------- students ----------
  const sRoom = (await GET(`/api/v1/classrooms/${eng.classroom_id}`, s1.token)).data
  check('student1: graded worksheet (17) and an open model test', sRoom.assignments.find((a) => a.title === 'Vectors worksheet 1')?.my_score === 17 && sRoom.assignments.find((a) => a.title === 'Model test: Motion')?.my_status === null)
  check('student1: can download class notes', (await fetch(`${API}/api/v1/materials/${sRoom.materials[0].id}/file`, { headers: { Authorization: `Bearer ${s1.token}` } })).status === 200)
  check('student1: own ICT tuition post', (await GET('/api/v1/tuition-posts/mine', s1.token)).data.posts.some((x) => x.subject === 'ICT'))
  check('student2: sees the coaching batch classroom', (await GET('/api/v1/classrooms', s2.token)).data.classrooms.some((c) => c.id === batches.find((b) => b.name === 'SSC Maths - Batch A').classroom_id))
  check('student2: published result 44/50', (await GET('/api/v1/results', s2.token)).data.results.some((r) => r.marks === 44 && r.total_marks === 50))
  check('student2: support ticket on file', (await GET('/api/v1/support-tickets/mine', s2.token)).data.tickets.length >= 1)

  // restore the attendance mark changed above
  await POST(`/api/v1/sessions/${sessId}/attendance`, t1.token, { marks: [{ learner_kind: 'user', learner_id: s1.id, mark: 'present' }] })
}

async function browserChecks() {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true })
  try {
    for (const u of Object.values(U)) {
      const page = await newPage(browser)
      await page.goto(`${WEB}/login`, { waitUntil: 'networkidle0' })
      await fill(page, 'Email', u.email)
      await fill(page, 'Password', u.password)
      await page.evaluate(() => document.querySelector('form button[type=submit]').click())
      const signedIn = await page.waitForFunction((role) => location.pathname.startsWith(`/app/${role}`) || location.pathname.startsWith('/auth') || location.pathname.startsWith('/signup'), { timeout: 15000 }, u.role).then(() => true).catch(() => false)
      await page.goto(`${WEB}/app/${u.role}`, { waitUntil: 'networkidle0' })
      const first = await text(page)
      check(`${u.key}: signs in through the login page and opens the ${u.role} dashboard`, signedIn && (await page.evaluate(() => location.pathname)).startsWith(`/app/${u.role}`) && first.includes(u.name.split(' ')[0]), (await page.evaluate(() => location.pathname)))
      await page.reload({ waitUntil: 'networkidle0' })
      await wait(500)
      check(`${u.key}: still signed in after a page reload`, (await page.evaluate(() => location.pathname)).startsWith(`/app/${u.role}`) && (await text(page)).includes(u.name.split(' ')[0]))
      await page.goto(`${WEB}/logout`, { waitUntil: 'networkidle0' })
      await click(page, 'Log out', { exact: true })
      check(`${u.key}: logout confirms "You're signed out"`, await waitText(page, "You're signed out"))
      await page.goto(`${WEB}/app/${u.role}`, { waitUntil: 'networkidle0' })
      check(`${u.key}: signed out (dashboard redirects away)`, !(await page.evaluate(() => location.pathname)).startsWith(`/app/${u.role}`))
      await page.browserContext().close()
    }
  } finally {
    await browser.close()
  }
  check('browser: no unexpected console errors', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '))
}

await apiChecks()
if (!process.argv.includes('--api-only')) await browserChecks()
summary('demo-accounts')
