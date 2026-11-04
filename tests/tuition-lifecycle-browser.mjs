// Tuition lifecycle through the real UI in Chrome: a custom area on a new
// tuition post; both sides agree after the demo class; the tutor creates the
// classroom; the student declines then accepts, the guardian accepts and the
// tuition starts; dashboards show the status; the tutor marks the month
// completed and sends "How to pay"; the guardian submits a payment; the tutor
// disputes it, the guardian resubmits and the tutor confirms it.
//
// Accounts, the application and the demo class are set up through the API for
// speed (tuition-lifecycle-e2e.mjs covers them and every permission check);
// every step this suite asserts uses the UI.
//
//   E2E_WEB=http://127.0.0.1:5175 E2E_API=http://localhost:8091 E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... node tests/tuition-lifecycle-browser.mjs

import { readFileSync } from 'node:fs'
import puppeteer from 'puppeteer-core'
import { CHROME, WEB, check, click, consoleErrors, fill, fixture, newPage, summary, text, wait, waitText } from './lib/browser.mjs'

const API = process.env.E2E_API ?? 'http://localhost:8091'
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) { console.error('E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD are required'); process.exit(2) }
const run = Math.random().toString(36).slice(2, 8)
const password = `L1feBrowser-${run}-Pw!`
const email = (l) => `tlb-${l}-${run}@tuitionhub.test`
const today = new Date().toISOString().slice(0, 10)
const monthName = new Date(`${today.slice(0, 7)}-01T00:00:00`).toLocaleString('en-GB', { month: 'long', year: 'numeric' })

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
  u.token = (await api('POST', '/api/v1/auth/login', null, { email: u.email, password })).data.tokens.access_token
}

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
const isDisabled = (p, label) => p.evaluate((t) => [...document.querySelectorAll('button')].find((b) => b.innerText.trim() === t && b.offsetParent !== null)?.disabled ?? null, label)

async function main() {
  const admin = (await api('POST', '/api/v1/auth/login', null, { email: ADMIN_EMAIL, password: ADMIN_PASSWORD })).data.tokens.access_token
  const tutor = await register('tutor', 'tutor', `Karim Tutor ${run}`)
  const parent = await register('parent', 'parent', `Nasrin Parent ${run}`)
  await verify(admin, parent, [['parent_nid', 'id-card.png'], ['child_birth_certificate', 'id-card.png']], { display_name: parent.name, address: 'Savar, Dhaka' })
  const inv = await api('POST', '/api/v1/workflow/family/invitations', parent.token, { child_email: email('student'), relationship: 'mother' })
  await api('POST', `/api/v1/workflow/admin/student-invitations/${inv.data.invitation.id}/decision`, admin, { decision: 'approved' })
  const student = await register('student', 'student', `Tania Student ${run}`)
  await verify(admin, student, [['birth_certificate', 'id-card.png']], { display_name: student.name, birth_date: '2010-06-01', class_name: 'HSC', institution: 'Savar College' })
  await verify(admin, tutor, [['identity', 'id-card.png']], { display_name: tutor.name, education: 'BSc Physics', subjects: ['Physics'], classes: ['HSC'], areas: ['Savar'] })
  if (!(await api('GET', '/api/v1/links', parent.token)).data.links.some((l) => l.student_id === student.id && l.status === 'approved')) {
    await api('POST', '/api/v1/links', parent.token, { student_email: student.email, relationship: 'mother' })
    const l = (await api('GET', '/api/v1/links', student.token)).data.links.find((x) => x.guardian_id === parent.id)
    await api('POST', `/api/v1/links/${l.id}/respond`, student.token, { accept: true })
  }

  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] })
  try {
    const P = await login(browser, parent, 'parent')
    const T = await login(browser, tutor, 'tutor')
    const S = await login(browser, student, 'student')

    // ---- 1. custom area on the New tuition post form ----
    const area = `Savar Bazar ${run}`
    await go(P, '/app/parent/my-posts')
    await click(P, 'New post', { exact: true })
    await waitText(P, 'For which child')
    const areaOptions = await P.evaluate(() => [...[...document.querySelectorAll('label')].find((l) => l.innerText.trim() === 'Area').parentElement.querySelectorAll('option')].map((o) => o.textContent))
    check('area: existing options kept, Other added', ['Dhanmondi', 'Mirpur', 'Uttara', 'Khulna'].every((a) => areaOptions.includes(a)) && areaOptions.includes('Other / Enter manually'), areaOptions.join(','))
    await fill(P, 'For which child', student.id)
    await fill(P, 'Subject', 'Physics'); await fill(P, 'Class', 'HSC')
    await fill(P, 'Area', '__other__')
    check('area: Other reveals a text input with validation', await waitText(P, 'Enter your area') && await waitText(P, 'Enter the area, for example'))
    check('area: publish disabled while the custom area is empty', (await isDisabled(P, 'Publish')) === true)
    await fill(P, 'Enter your area', '   ')
    check('area: whitespace does not count', (await isDisabled(P, 'Publish')) === true)
    await fill(P, 'Enter your area', area)
    await fill(P, 'Monthly budget', '6000'); await fill(P, 'Requirements', `Lifecycle UI ${run}`)
    check('area: publish enabled once entered', (await isDisabled(P, 'Publish')) === false)
    await click(P, 'Publish', { exact: true })
    check('area: post published showing the custom area', await waitText(P, 'Tuition post published') && (await text(P)).includes(area))
    await click(P, 'Edit', { exact: true })
    check('area: editing shows Other with the saved text', await waitText(P, 'Enter your area') && await P.evaluate((a) => [...document.querySelectorAll('input')].some((i) => i.value === a), area))
    await click(P, 'Cancel', { exact: true })
    await go(T, '/app/tutor/find-tuition')
    await fill(T, 'Search', area)
    await click(T, 'Search', { exact: true })
    check('area: tutor finds the post by its custom area', await waitText(T, `Lifecycle UI ${run}`) && (await text(T)).includes(area))

    // ---- set up through the API: application, conversation, demo class, terms ----
    const post = (await api('GET', '/api/v1/tuition-posts/mine', parent.token)).data.posts.find((p) => p.area === area)
    await api('POST', `/api/v1/tuition-posts/${post.id}/apply`, tutor.token, { note: 'Ready' })
    const app = (await api('GET', `/api/v1/tuition-posts/${post.id}/applications`, parent.token)).data.applications[0]
    await api('POST', `/api/v1/applications/${app.id}/status`, parent.token, { status: 'accepted' })
    const eng = (await api('POST', '/api/v1/engagements', parent.token, { tutor_id: tutor.id, student_id: student.id, listing_id: post.id, subject: 'Physics', class_name: 'HSC', mode: 'offline', trial_at: new Date(Date.now() + 86400000).toISOString() })).data.id
    await api('POST', `/api/v1/engagements/${eng}/actions`, tutor.token, { action: 'accept_trial' })

    // ---- 2. agreement, classroom, join requests, start ----
    await go(P, '/app/parent/tuitions')
    check('demo: agreement shown as not yet for both after the demo', await waitText(P, 'Completing the demo class is not an agreement') && (await text(P)).match(/Not yet/g)?.length === 2)
    await api('POST', `/api/v1/engagements/${eng}/actions`, tutor.token, { action: 'propose', days: 'Sun, Tue', time_slot: '6-7 PM', mode: 'offline', monthly_fee: 6000, start_date: today })
    await go(P, '/app/parent/tuitions')
    check('agree: tutor agreed, guardian not yet', await waitText(P, 'Agree to continue') && (await text(P)).match(/Not yet/g)?.length === 1)
    await click(P, 'Agree to continue')
    check('agree: both agreed, waiting for the classroom', await waitText(P, 'Agreed · waiting for the classroom') && !(await text(P)).includes('Not yet'))
    check('agree: no classroom or contact yet', !(await text(P)).includes('Open classroom') && !(await text(P)).includes(tutor.email))
    await go(T, '/app/tutor/my-students')
    await click(T, 'Create classroom')
    check('classroom: created, both invitations pending', await waitText(T, '2 classroom invitations pending') && (await text(T)).match(/Pending/g)?.length >= 2)
    check('classroom: create button gone (one per tuition)', !(await text(T)).includes('Create classroom'))
    // Before anyone accepts, the classroom has no students; every tab must still render.
    await click(T, 'Open classroom')
    check('classroom: tutor opens it before anyone joins', await waitText(T, 'Classroom invitations') && !(await text(T)).includes('failed to render'))
    for (const tab of ['Schedule', 'Attendance', 'Homework', 'Materials', 'Diary', 'Students', 'Progress']) {
      await click(T, tab, { exact: true })
      await wait(300)
      check(`classroom: ${tab} tab renders with no students yet`, !(await text(T)).includes('failed to render'))
    }
    await go(S, '/app/student/my-tuition')
    check('join: student sees the invitation', await waitText(S, 'Accept classroom invitation'))
    check('join: student cannot open the classroom yet', !(await text(S)).includes('Open classroom'))
    await click(S, 'Decline invitation')
    check('join: student declined', await waitText(S, 'Declined'))
    await go(P, '/app/parent/dashboard')
    check('dashboard: parent sees the invitation and pending status', await waitText(P, 'Tuition status') && (await text(P)).includes('classroom invitation') && (await text(P)).includes('2 classroom invitations pending'))
    await go(P, '/app/parent/tuitions')
    await click(P, 'Accept classroom invitation')
    check('join: guardian accepted, still pending on the student', await waitText(P, '1 classroom invitation pending') && (await text(P)).includes('Accepted'))
    await go(S, '/app/student/home')
    check('dashboard: student sees it pending', await waitText(S, '1 classroom invitation pending'))
    await go(S, '/app/student/my-tuition')
    await click(S, 'Accept classroom invitation')
    check('start: student joined and the tuition started', await waitText(S, 'Active (started)') && (await text(S)).includes('Open classroom'))
    await go(T, '/app/tutor/dashboard')
    check('dashboard: tutor sees it started', await waitText(T, 'Tuition status') && (await text(T)).includes('Active (started)'))
    await go(P, '/app/parent/tuitions')
    check('start: guardian sees it started with contact shared', await waitText(P, 'Active (started)') && (await text(P)).includes(tutor.email))
    await click(P, 'Open classroom')
    check('classroom: shows who accepted', await waitText(P, 'Classroom invitations') && (await text(P)).match(/Accepted/g)?.length >= 2)

    // ---- 3 and 4. month completion, how to pay, payment confirmation ----
    await go(T, '/app/tutor/payments')
    await click(T, 'Open ledger')
    await click(T, 'Mark month completed')
    check('month: marked completed, payment due', await waitText(T, 'Month marked completed') && await waitText(T, 'Payment due') && (await text(T)).includes(monthName))
    await click(T, 'How to pay', { exact: true })
    await waitText(T, 'Payment instructions')
    check('how to pay: send disabled until written', (await isDisabled(T, 'Send in Messages')) === true)
    await fill(T, 'Payment instructions', `Cash at the first class of the month ${run}`)
    await click(T, 'Send in Messages')
    check('how to pay: sent', await waitText(T, 'Payment instructions sent in Messages'))
    await go(P, '/app/parent/notifications')
    check('notify: parent has the reminder and the instructions', await waitText(P, 'Payment reminder') && (await text(P)).includes('How to pay') && (await text(P)).includes('৳6,000'))
    const conv = (await api('GET', '/api/v1/engagements', parent.token)).data.engagements.find((e) => e.id === eng).conversation_id
    await go(P, `/app/parent/messages/${conv}`)
    check('messages: reminder and instructions in the chat', await waitText(P, `Cash at the first class of the month ${run}`) && (await text(P)).includes('Payment reminder'))
    await go(P, '/app/parent/payments')
    await click(P, 'Open ledger')
    await click(P, 'Submit payment')
    await waitText(P, 'Amount paid')
    check('submit: needs amount and method or reference', (await isDisabled(P, 'Submit')) === true)
    await fill(P, 'Amount paid', '6000'); await fill(P, 'Payment method', 'Cash'); await fill(P, 'Reference', `RCPT-${run}`)
    await click(P, 'Submit', { exact: true })
    check('submit: recorded as submitted, not paid', await waitText(P, 'Payment submitted. Your tutor will confirm it.') && await waitText(P, `RCPT-${run}`) && !(await text(P)).includes('Confirmed paid'))
    await go(T, '/app/tutor/payments')
    await click(T, 'Open ledger')
    await waitText(T, 'Payment submitted')
    await click(T, 'Dispute', { exact: true })
    await fill(T, 'What is wrong', `Received only part ${run}`)
    await click(T, 'Record dispute')
    check('dispute: recorded and stays disputed', await waitText(T, 'Dispute recorded') && await waitText(T, `Received only part ${run}`) && (await text(T)).includes('Disputed'))
    await go(P, `/app/parent/messages/${conv}`)
    check('dispute: reason in the chat for the guardian', await waitText(P, `Received only part ${run}`))
    await go(P, '/app/parent/payments')
    await click(P, 'Open ledger')
    await click(P, 'Submit payment')
    await fill(P, 'Amount paid', '6000'); await fill(P, 'Reference', `RCPT2-${run}`)
    await click(P, 'Submit', { exact: true })
    check('submit: resubmitted after the dispute', await waitText(P, 'Payment submitted. Your tutor will confirm it.'))
    await go(T, '/app/tutor/payments')
    await click(T, 'Open ledger')
    await click(T, 'Confirm paid')
    check('confirm: tutor confirms paid', await waitText(T, 'Payment confirmed.') && await waitText(T, 'Confirmed paid'))
    await go(P, '/app/parent/payments')
    await click(P, 'Open ledger')
    check('confirm: guardian sees confirmed paid', await waitText(P, 'Confirmed paid') && !(await text(P)).includes('Submit payment'))
    await wait(200)
    check('no unexpected browser console errors', consoleErrors.length === 0, consoleErrors.slice(0, 5).join(' | '))
  } finally {
    await browser.close()
  }
  summary(run)
}

main().catch((e) => { console.error(e); process.exit(1) })
