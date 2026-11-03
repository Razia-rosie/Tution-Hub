// The interview workflow through the real UI: the admin schedules with
// instructions; the applicant sees the interview box, confirms and messages
// the admin; the admin sees the confirmation, replies from Messages,
// reschedules, marks the interview completed and only then approves.
//
//   E2E_WEB=http://127.0.0.1:5174 E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... node tests/interview-browser.mjs

import { readFileSync } from 'node:fs'
import puppeteer from 'puppeteer-core'
import { CHROME, WEB, check, click, consoleErrors, fill, fixture, newPage, signIn, summary, text, wait, waitPath, waitText } from './lib/browser.mjs'

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) { console.error('E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD are required'); process.exit(2) }
const run = Math.random().toString(36).slice(2, 8)
const password = `Ivb-${run}-Pw1!`
const NAME = `Interview Tutor ${run}`

async function api(method, route, token, body, form) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {}
  if (body) headers['Content-Type'] = 'application/json'
  const r = await fetch(WEB + route, { method, headers, body: form ?? (body ? JSON.stringify(body) : undefined) })
  return { status: r.status, data: await r.json().catch(() => null) }
}
const localInput = (iso) => { const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) }
async function openApplicant(A) {
  await A.goto(`${WEB}/app/admin/verification`, { waitUntil: 'networkidle0' })
  await A.waitForFunction((n) => [...document.querySelectorAll('button')].some((b) => b.innerText.includes(n)), { timeout: 10000 }, NAME)
  await A.evaluate((n) => [...document.querySelectorAll('button')].find((b) => b.innerText.includes(n)).click(), NAME)
  await waitText(A, 'Interview (optional)')
}

async function main() {
  // A submitted tutor application (set up through the API for speed).
  const reg = await api('POST', '/api/v1/auth/register', null, { name: NAME, email: `ib-tutor-${run}@tuitionhub.test`, password, role: 'tutor' })
  const tutor = { token: reg.data.tokens.access_token, email: `ib-tutor-${run}@tuitionhub.test` }
  const f = new FormData(); f.append('document_type', 'identity'); f.append('document', new Blob([readFileSync(fixture('id-card.png'))], { type: 'image/png' }), 'id.png')
  await api('POST', '/api/v1/workflow/verification/documents', tutor.token, null, f)
  await api('PUT', '/api/v1/workflow/profile', tutor.token, { display_name: NAME, education: 'BSc', subjects: ['Physics'], classes: ['HSC'], areas: ['Uttara'] })
  await api('POST', '/api/v1/workflow/verification/submit', tutor.token)

  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] })
  try {
    // Separate browser contexts: the admin and the applicant are different people.
    const A = await newPage(browser, 1400, 1000)
    A.on('dialog', (d) => void d.accept())
    await signIn(A, ADMIN_EMAIL, ADMIN_PASSWORD, true)
    await waitPath(A, '/app/admin')

    // ---- schedule with instructions ----
    await openApplicant(A)
    await fill(A, 'Mode', 'online')
    await fill(A, 'Date and time', localInput('2030-12-05T09:30:00Z'))
    await fill(A, 'Location or meeting link', `https://meet.example.test/${run}`)
    await fill(A, 'Instructions for the applicant', 'Bring your original NID.')
    await click(A, 'Schedule interview', { exact: true })
    check('admin: interview scheduled', await waitText(A, 'Interview scheduled. The applicant was notified and messaged.'))
    check('admin: waiting for applicant confirmation, schedule form hidden', (await text(A)).includes('Waiting for applicant confirmation') && !(await text(A)).includes('Schedule interview'))

    // ---- applicant: notification, interview box, confirm, message admin ----
    const T = await newPage(browser)
    await signIn(T, tutor.email, password)
    await T.waitForFunction(() => localStorage.getItem('tuitionhub.session'), { timeout: 10000 })
    await T.goto(`${WEB}/app/tutor/notifications`, { waitUntil: 'networkidle0' })
    check('applicant: interview notification', await waitText(T, 'Interview scheduled'))
    await click(T, 'View interview', { exact: true })
    check('applicant: View interview opens the verification page', await waitPath(T, '/app/tutor/verification'))
    check('applicant: interview box with details and instructions', await waitText(T, 'Your verification interview') && (await text(T)).includes(`https://meet.example.test/${run}`) && (await text(T)).includes('Bring your original NID.') && (await text(T)).includes('Scheduled, please confirm'))
    await click(T, 'Okay, confirm interview', { exact: true })
    check('applicant: confirmed', await waitText(T, 'Interview confirmed. The administrator has been told.') && await waitText(T, 'You confirmed on'))
    await fill(T, 'Message the administrator', 'Could the interview start 30 minutes later?')
    await click(T, 'Message admin', { exact: true })
    check('applicant: message sent, schedule unchanged', await waitText(T, 'Message sent to the administrator') && (await text(T)).includes('Confirmed'))

    // ---- admin: sees confirmation and message, replies ----
    await openApplicant(A)
    check('admin: sees the confirmation', (await text(A)).includes('Applicant confirmed'))
    await click(A, 'Open conversation with the applicant', { exact: true })
    check('admin: conversation opens in admin Messages', await waitPath(A, '/app/admin/messages/') && await waitText(A, '30 minutes later'))
    await fill(A, 'Message', 'Yes, I will move it. Watch for the new time.')
    await click(A, 'Send', { exact: true })
    check('admin: reply sent', await waitText(A, 'Watch for the new time.'))
    await A.goto(`${WEB}/app/admin/notifications`, { waitUntil: 'networkidle0' })
    check('admin: notifications show the confirmation and the message', await waitText(A, 'Interview confirmed') && (await text(A)).includes(`New message from ${NAME}`))

    // ---- admin: approval is blocked until the interview is completed ----
    await openApplicant(A)
    check('admin: approve disabled while the interview is scheduled', (await text(A)).includes('An interview is still scheduled') && await A.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.innerText.trim() === 'Approve')?.disabled === true))

    // ---- admin: reschedule ----
    await click(A, 'Reschedule', { exact: true })
    await fill(A, 'New mode', 'in_person')
    await fill(A, 'New date and time', localInput('2030-12-06T05:00:00Z'))
    await fill(A, 'New location or meeting link', 'TuitionHub office, Mirpur')
    await click(A, 'Save new schedule', { exact: true })
    check('admin: rescheduled; confirmation reset', await waitText(A, 'Interview rescheduled.') && (await text(A)).includes('Waiting for applicant confirmation') && (await text(A)).includes('TuitionHub office, Mirpur'))

    await T.reload({ waitUntil: 'networkidle0' })
    check('applicant: box shows the new schedule and asks to confirm again', await waitText(T, 'TuitionHub office, Mirpur') && (await text(T)).includes('In person') && (await text(T)).includes('Scheduled, please confirm') && (await text(T)).includes('Verification interview rescheduled'))

    // ---- admin: complete, then approve ----
    await openApplicant(A)
    await click(A, 'Mark interview completed', { exact: true })
    check('admin: interview completed', await waitText(A, 'Interview marked completed. Make the final decision above.') && (await text(A)).includes('Completed'))
    check('admin: approve enabled after completion', await A.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.innerText.trim() === 'Approve')?.disabled === false))
    await T.reload({ waitUntil: 'networkidle0' })
    check('applicant: sees Completed, not yet approved', await waitText(T, 'The interview is complete') && !(await text(T)).includes('Verified'))
    await click(A, 'Approve', { exact: true })
    check('admin: final approval saved', await waitText(A, 'Decision saved.'))

    await T.reload({ waitUntil: 'networkidle0' })
    check('applicant: verified after the final approval', await waitText(T, 'Verified') && !(await text(T)).includes('Limited, read-only dashboard'))
    check('no unexpected browser console errors', consoleErrors.length === 0, consoleErrors.join(' | '))
  } finally {
    await browser.close()
  }
  summary(run)
}

main().catch((e) => { console.error(e); process.exit(1) })
