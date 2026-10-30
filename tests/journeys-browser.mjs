// Cross-role journeys driven through the real UI in Chrome:
// parent links a child, posts tuition; tutor applies; parent accepts and chats;
// demo class, terms and confirmation; tutor runs the classroom (schedule,
// attendance, homework); student submits; tutor grades; parent monitors;
// coaching centre manages teachers, batches, students and fees.
//
// Accounts are created and verified through the API for speed (verification
// itself is covered by browser-e2e.mjs); every step after that uses the UI.
//
//   E2E_WEB=http://127.0.0.1:5174 E2E_API=http://localhost:8090 E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... node tests/journeys-browser.mjs

import { readFileSync } from 'node:fs'
import puppeteer from 'puppeteer-core'
import { CHROME, WEB, check, click, consoleErrors, fill, fixture, newPage, summary, text, wait, waitPath, waitText } from './lib/browser.mjs'

const API = process.env.E2E_API ?? 'http://localhost:8090'
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) { console.error('E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD are required'); process.exit(2) }
const run = Math.random().toString(36).slice(2, 8)
const password = `J0urney-${run}-Pw!`
const email = (l) => `jr-${l}-${run}@tuitionhub.test`

async function api(method, path, token, body, form) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {}
  if (body) headers['Content-Type'] = 'application/json'
  const r = await fetch(API + path, { method, headers, body: form ?? (body ? JSON.stringify(body) : undefined) })
  return { status: r.status, data: await r.json().catch(() => null) }
}
async function register(label, role, name) {
  const r = await api('POST', '/api/v1/auth/register', null, { name, email: email(label), password, role })
  if (r.status !== 201) throw new Error(`register ${label}: ${r.status}`)
  return { id: r.data.user.id, token: r.data.tokens.access_token, email: email(label), name }
}
async function verify(admin, u, docs, profile) {
  for (const [type, file] of docs) {
    const f = new FormData(); f.append('document_type', type); f.append('document', new Blob([readFileSync(fixture(file))], { type: 'image/png' }), file)
    await api('POST', '/api/v1/workflow/verification/documents', u.token, null, f)
  }
  await api('PUT', '/api/v1/workflow/profile', u.token, profile)
  const sub = await api('POST', '/api/v1/workflow/verification/submit', u.token)
  await api('POST', `/api/v1/workflow/admin/verifications/${sub.data.verification.id}/decision`, admin, { decision: 'approved' })
}

/** Signs in through the login form and lands in the role area. */
async function login(browser, u, role) {
  const p = await newPage(browser)
  await p.goto(`${WEB}/login`, { waitUntil: 'networkidle0' })
  await fill(p, 'Email', u.email)
  await fill(p, 'Password', password)
  await p.evaluate(() => document.querySelector('form button[type=submit]').click())
  await p.waitForFunction(() => localStorage.getItem('tuitionhub.session'), { timeout: 10000 })
  await p.goto(`${WEB}/app/${role}`, { waitUntil: 'networkidle0' })
  return p
}
const go = (p, route) => p.goto(`${WEB}${route}`, { waitUntil: 'networkidle0' })
const localDateTime = (days, hour = 17) => { const d = new Date(Date.now() + days * 86400000); d.setHours(hour, 0, 0, 0); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) }

async function main() {
  const admin = (await api('POST', '/api/v1/auth/login', null, { email: ADMIN_EMAIL, password: ADMIN_PASSWORD })).data.tokens.access_token
  const tutor = await register('tutor', 'tutor', `Rahim Tutor ${run}`)
  const parent = await register('parent', 'parent', `Salma Parent ${run}`)
  const student = await register('student', 'student', `Ayaan Student ${run}`)
  const coaching = await register('coaching', 'coaching', `Bright Centre ${run}`)
  await verify(admin, tutor, [['identity', 'id-card.png']], { display_name: tutor.name, education: 'BSc Physics', subjects: ['Physics'], classes: ['HSC'], areas: ['Uttara'] })
  await verify(admin, coaching, [['trade_license', 'id-card.png'], ['owner_identity', 'id-card.png']], { display_name: coaching.name, institution: `Bright ${run} Academy`, education: 'TRAD/1', subjects: ['Mathematics'], classes: ['SSC'], areas: ['Mirpur'] })

  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] })
  try {
    const P = await login(browser, parent, 'parent')
    const S = await login(browser, student, 'student')
    const T = await login(browser, tutor, 'tutor')

    // ---- Parent links child; student approves ----
    await go(P, '/app/parent/children')
    await fill(P, "Child's student account email", student.email)
    await click(P, 'Send request', { exact: true })
    check('parent: link request sent', await waitText(P, 'Waiting for approval'))
    await go(S, '/app/student/profile')
    await waitText(S, 'Guardians')
    await click(S, 'Approve', { exact: true })
    check('student: approves guardian', await waitText(S, 'Approved'))
    await go(P, '/app/parent/children')
    check('parent: child linked', await waitText(P, 'View progress'))

    // ---- Parent posts tuition ----
    await go(P, '/app/parent/my-posts')
    await click(P, 'New post', { exact: true })
    await waitText(P, 'For which child')
    await fill(P, 'For which child', student.id)
    await fill(P, 'Subject', 'Physics'); await fill(P, 'Class', 'HSC'); await fill(P, 'Area', 'Uttara')
    await fill(P, 'Monthly budget', '7000'); await fill(P, 'Requirements', `Board prep ${run}`)
    await click(P, 'Publish', { exact: true })
    check('parent: tuition post published', await waitText(P, 'Tuition post published') && (await text(P)).includes(`Board prep ${run}`))

    // ---- Tutor finds and applies ----
    await go(T, '/app/tutor/find-tuition')
    await fill(T, 'Search', run)
    await click(T, 'Search', { exact: true })
    await waitText(T, `Board prep ${run}`)
    await click(T, 'Apply', { exact: true })
    await waitText(T, 'Note to the guardian')
    await fill(T, 'Note to the guardian', 'Five years of HSC physics.')
    await click(T, 'Send application', { exact: true })
    check('tutor: applied from Find Tuition', await waitText(T, 'Application: Applied'))
    await go(T, '/app/tutor/my-posts')
    check('tutor: application tracked', await waitText(T, 'Applied'))

    // ---- Parent accepts; conversation ----
    await go(P, '/app/parent/my-posts')
    await click(P, 'Applicants (1)')
    await waitText(P, tutor.name)
    await click(P, 'Accept and message')
    check('parent: accepting opens Messages', await waitPath(P, '/app/parent/messages'))
    await waitText(P, tutor.name)
    await click(P, tutor.name)
    await waitText(P, 'Application accepted')
    await fill(P, 'Message', 'Hello! Could you start next week?')
    await click(P, 'Send', { exact: true })
    check('parent: message sent', await waitText(P, 'Could you start next week?'))
    await go(T, '/app/tutor/messages')
    check('tutor: sees unread conversation', await waitText(T, '1 new') || await waitText(T, 'new'))
    await click(T, parent.name)
    await waitText(T, 'Could you start next week?')
    await fill(T, 'Message', 'Yes, Sunday works.')
    await click(T, 'Send', { exact: true })
    check('tutor: reply appears for parent (polling)', await waitText(P, 'Yes, Sunday works.', 12000))

    // ---- Demo class, terms, confirmation ----
    await click(P, 'Request demo class')
    await waitText(P, 'Demo class date and time')
    await fill(P, 'For which child', student.id)
    await fill(P, 'Subject', 'Physics'); await fill(P, 'Class', 'HSC')
    await fill(P, 'Demo class date and time', localDateTime(2))
    await click(P, 'Request', { exact: true })
    check('parent: demo class requested', await waitText(P, 'Demo class requested'))
    await go(T, '/app/tutor/my-students')
    await click(T, 'Accept demo class')
    check('tutor: demo class accepted', await waitText(T, 'Demo class scheduled'))
    await click(T, 'Propose terms')
    await waitText(T, 'Monthly fee')
    await fill(T, 'Days', 'Sun, Tue, Thu'); await fill(T, 'Time', '6:30-7:30 PM')
    await fill(T, 'Monthly fee', '7000'); await fill(T, 'Start date', localDateTime(5).slice(0, 10))
    await click(T, 'Propose', { exact: true })
    check('tutor: terms proposed', await waitText(T, 'Waiting for the other side'))
    await go(P, '/app/parent/tuitions')
    await click(P, 'Confirm terms')
    check('parent: tuition active with contact shared', await waitText(P, 'Active') && await waitText(P, tutor.email))

    // ---- Tutor runs the classroom ----
    await go(T, '/app/tutor/schedule')
    await waitText(T, 'Schedule classes')
    await fill(T, 'Starts', localDateTime(-1, 16))
    await fill(T, 'Repeat weekly for', '3')
    await click(T, 'Add', { exact: true })
    check('tutor: classes scheduled', await waitText(T, 'Classes scheduled'))
    await click(T, 'Attendance', { exact: true })
    await waitText(T, 'Mark attendance')
    const sessionId = await T.evaluate(() => [...document.querySelectorAll('select option')].find((o) => o.value && o.textContent)?.value)
    await fill(T, 'Class', sessionId)
    await waitText(T, student.name)
    await click(T, 'Absent', { exact: true })
    await click(T, 'Save attendance')
    check('tutor: attendance saved', await waitText(T, 'Attendance saved'))
    await click(T, 'Homework', { exact: true })
    await click(T, 'New homework or assignment')
    await waitText(T, 'Out of (optional)')
    await fill(T, 'Title', `Vectors set ${run}`); await fill(T, 'Due', localDateTime(3)); await fill(T, 'Out of (optional)', '10')
    await click(T, 'Publish', { exact: true })
    check('tutor: homework published', await waitText(T, `Vectors set ${run}`))
    await click(T, 'Materials', { exact: true })
    await fill(T, 'Title', 'Vector notes'); await fill(T, 'Notes', 'Read chapter 3.')
    await click(T, 'Share', { exact: true })
    check('tutor: material shared', await waitText(T, 'Material shared'))
    await click(T, 'Diary', { exact: true })
    await fill(T, 'Topics covered', 'Vectors: dot product')
    await click(T, 'Save entry')
    check('tutor: diary saved', await waitText(T, 'Diary saved'))

    // ---- Student submits ----
    await go(S, '/app/student/homework')
    await waitText(S, `Vectors set ${run}`)
    await fill(S, 'Your answer', 'Solutions attached')
    const input = await S.$('input[type=file]')
    await input.uploadFile(fixture('id-card.png'))
    await click(S, 'Submit', { exact: true })
    check('student: homework submitted', await waitText(S, 'Submitted'))
    await click(S, 'Materials', { exact: true })
    check('student: sees shared material', await waitText(S, 'Vector notes'))

    // ---- Tutor grades ----
    await go(T, '/app/tutor/homework')
    await click(T, 'Review submissions')
    await waitText(T, 'Solutions attached')
    await fill(T, `Score for ${student.name}`, '9'); await fill(T, `Feedback for ${student.name}`, 'Well done')
    await click(T, 'Save grade')
    check('tutor: graded', await waitText(T, 'Graded'))

    // ---- Student and parent see the results ----
    await go(S, '/app/student/homework')
    check('student: sees grade and feedback', await waitText(S, 'Well done') && (await text(S)).includes('9 / 10'))
    await go(P, '/app/parent/progress')
    check('parent: progress shows grade and absence', await waitText(P, '90%') && (await text(P)).includes('1 absent'))
    await go(P, '/app/parent/notifications')
    check('parent: absence notification', await waitText(P, 'Absence recorded'))
    await go(P, '/app/parent/attendance')
    check('parent: views child attendance (read-only)', await waitText(P, 'Attendance record') && !(await text(P)).includes('Mark attendance'))

    // ---- Payments ----
    await go(T, '/app/tutor/payments')
    await click(T, 'Open ledger')
    await click(T, 'Record due')
    check('tutor: month recorded due', await waitText(T, 'Month recorded as due'))

    // ---- Coaching centre ----
    const C = await login(browser, coaching, 'coaching')
    await go(C, '/app/coaching/teachers')
    await click(C, 'Add teacher')
    await fill(C, 'Name', 'Anwar Hossain'); await fill(C, 'Subject', 'Mathematics')
    await click(C, 'Save', { exact: true })
    check('coaching: teacher added', await waitText(C, 'Anwar Hossain'))
    await go(C, '/app/coaching/batches')
    await click(C, 'Add batch')
    await waitText(C, 'Monthly fee')
    await fill(C, 'Name', 'SSC Maths A'); await fill(C, 'Subject', 'Mathematics'); await fill(C, 'Monthly fee', '3000')
    const teacherId = await C.evaluate(() => [...document.querySelectorAll('select option')].find((o) => o.textContent === 'Anwar Hossain')?.value)
    await fill(C, 'Teacher', teacherId)
    await click(C, 'Save', { exact: true })
    check('coaching: batch created with teacher', await waitText(C, 'SSC Maths A') && await waitText(C, 'Anwar Hossain'))
    await go(C, '/app/coaching/students')
    await click(C, 'Admit student')
    await fill(C, 'Student name', 'Walk-in Learner'); await fill(C, 'Guardian name', 'Mr. Karim')
    await click(C, 'Save', { exact: true })
    await waitText(C, 'Walk-in Learner')
    await click(C, 'Manage batches', { exact: true })
    await click(C, 'Enrol', { exact: true })
    check('coaching: student enrolled', await waitText(C, 'Enrolled'))
    await go(C, '/app/coaching/payments')
    await click(C, 'Generate fees')
    check('coaching: fees generated', await waitText(C, '1 fee record created'))
    await click(C, 'Mark paid')
    check('coaching: fee marked paid', await waitText(C, 'Marked paid'))
    await go(C, '/app/coaching/reports')
    check('coaching: report reflects data', await waitText(C, 'Fees collected') && (await text(C)).includes('৳3,000'))

    check('no unexpected browser console errors', consoleErrors.length === 0, consoleErrors.slice(0, 5).join(' | '))
  } finally {
    await browser.close()
  }
  summary(run)
}

main().catch((e) => { console.error(e); process.exit(1) })
