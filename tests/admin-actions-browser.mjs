// Two admin features through the real UI:
//  1. Approve / Reject child student registration requests from the parent's
//     review in Admin → Verification, and what that allows at sign-up.
//  2. An interview the admin schedules appears in Notifications and opens the
//     matching message in Messages.
//
//   E2E_WEB=http://127.0.0.1:5174 E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... node tests/admin-actions-browser.mjs

import { readFileSync } from 'node:fs'
import puppeteer from 'puppeteer-core'
import { CHROME, WEB, check, click, consoleErrors, fill, fixture, newPage, signIn, summary, text, wait, waitPath, waitText } from './lib/browser.mjs'

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) { console.error('E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD are required'); process.exit(2) }
const run = Math.random().toString(36).slice(2, 8)
const password = `Adm1n-${run}-Pw!`
const email = (l) => `aa-${l}-${run}@tuitionhub.test`

async function api(method, route, token, body, form) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {}
  if (body) headers['Content-Type'] = 'application/json'
  const r = await fetch(WEB + route, { method, headers, body: form ?? (body ? JSON.stringify(body) : undefined) })
  return { status: r.status, data: await r.json().catch(() => null) }
}
const upload = (token, type) => { const f = new FormData(); f.append('document_type', type); f.append('document', new Blob([readFileSync(fixture('id-card.png'))], { type: 'image/png' }), 'pic.png'); return api('POST', '/api/v1/workflow/verification/documents', token, null, f) }
async function account(label, role, name) {
  const r = await api('POST', '/api/v1/auth/register', null, { name, email: email(label), password, role })
  if (r.status !== 201) throw new Error(`register ${label}: ${r.status} ${JSON.stringify(r.data)}`)
  return { token: r.data.tokens.access_token, id: r.data.user.id, email: email(label), name }
}
async function submittedParent(label, name) {
  const p = await account(label, 'parent', name)
  await upload(p.token, 'parent_nid'); await upload(p.token, 'child_birth_certificate')
  await api('PUT', '/api/v1/workflow/profile', p.token, { display_name: name, address: 'Mirpur, Dhaka' })
  p.application = (await api('POST', '/api/v1/workflow/verification/submit', p.token)).data.verification.id
  return p
}
/** Clicks a button inside the list item whose text contains `needle`. */
async function clickIn(page, needle, label) {
  const ok = await page.evaluate((n, l) => {
    const li = [...document.querySelectorAll('li')].find((x) => x.innerText.includes(n) && [...x.querySelectorAll('button')].some((b) => b.innerText.trim() === l))
    const b = li && [...li.querySelectorAll('button')].find((x) => x.innerText.trim() === l)
    if (b && !b.disabled) b.click()
    return b ? (b.disabled ? 'disabled' : 'clicked') : 'missing'
  }, needle, label)
  await wait(200)
  return ok
}
const itemText = (page, needle) => page.evaluate((n) => [...document.querySelectorAll('li')].find((x) => x.innerText.includes(n))?.innerText ?? '', needle)
async function openParent(page, name, status) {
  await page.goto(`${WEB}/app/admin/verification`, { waitUntil: 'networkidle0' })
  await fill(page, 'Status', status)
  await fill(page, 'Applicant type', 'parent')
  await page.waitForFunction((n) => [...document.querySelectorAll('button')].some((b) => b.innerText.includes(n)), { timeout: 10000 }, name)
  await page.evaluate((n) => [...document.querySelectorAll('button')].find((b) => b.innerText.includes(n)).click(), name)
  await waitText(page, 'Child student accounts')
}

async function main() {
  const admin = (await api('POST', '/api/v1/auth/login', null, { email: ADMIN_EMAIL, password: ADMIN_PASSWORD })).data.tokens.access_token

  // ---- Feature 1 setup: an approved parent with two child requests, a pending parent with one ----
  const parent = await submittedParent('parent', `Approved Parent ${run}`)
  const okChild = email('child-ok'); const noChild = email('child-no')
  await api('POST', '/api/v1/workflow/family/invitations', parent.token, { child_email: okChild, child_name: 'Rafi', relationship: 'mother' })
  await api('POST', '/api/v1/workflow/family/invitations', parent.token, { child_email: noChild, child_name: 'Mim', relationship: 'mother' })
  await api('POST', `/api/v1/workflow/admin/verifications/${parent.application}/decision`, admin, { decision: 'approved' })
  const pendingParent = await submittedParent('pending', `Pending Parent ${run}`)
  const waitChild = email('child-wait')
  await api('POST', '/api/v1/workflow/family/invitations', pendingParent.token, { child_email: waitChild, relationship: 'father' })

  // ---- Feature 2 setup: a tutor with a scheduled interview ----
  const tutor = await account('tutor', 'tutor', `Interview Tutor ${run}`)
  await upload(tutor.token, 'identity')
  await api('PUT', '/api/v1/workflow/profile', tutor.token, { display_name: tutor.name, education: 'BSc', subjects: ['Physics'], classes: ['HSC'], areas: ['Uttara'] })
  const tApp = (await api('POST', '/api/v1/workflow/verification/submit', tutor.token)).data.verification.id
  const link = `https://meet.example.test/${run}`
  await api('POST', `/api/v1/workflow/admin/verifications/${tApp}/interviews`, admin, { mode: 'online', scheduled_at: '2030-12-05T09:30:00Z', location_or_link: link })

  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] })
  try {
    const A = await newPage(browser, 1400, 1000)
    const dialogs = []
    A.on('dialog', (d) => { dialogs.push(d.message()); void d.accept() })
    await signIn(A, ADMIN_EMAIL, ADMIN_PASSWORD, true)
    await waitPath(A, '/app/admin')

    // Pending parent: actions shown but approval blocked until the parent is approved.
    await openParent(A, pendingParent.name, 'pending')
    check('1. pending request shows Waiting for admin permission', (await itemText(A, waitChild)).includes('Waiting for admin permission'))
    check('1. Approve is disabled while the parent is not approved', (await clickIn(A, waitChild, 'Approve')) === 'disabled' && (await text(A)).includes('Approve this parent first'))

    // Approved parent: parent approval alone did not approve the children.
    await openParent(A, parent.name, 'approved')
    check('1. parent approval alone leaves both child requests waiting', (await itemText(A, okChild)).includes('Waiting for admin permission') && (await itemText(A, noChild)).includes('Waiting for admin permission'))
    check('1. Approve and Reject are shown beside each pending request', (await A.evaluate((a, b) => [a, b].every((n) => { const li = [...document.querySelectorAll('li')].find((x) => x.innerText.includes(n)); const labels = li ? [...li.querySelectorAll('button')].map((x) => x.innerText.trim()) : []; return labels.includes('Approve') && labels.includes('Reject') }), okChild, noChild)))

    check('1. admin approves one request', (await clickIn(A, okChild, 'Approve')) === 'clicked' && await waitText(A, `${okChild} may now register as a student.`))
    check('1. approval asked for confirmation', dialogs.some((m) => m.includes(okChild)))
    check('1. approved request shows Approved, actions gone', /Approved/.test(await itemText(A, okChild)) && !(await itemText(A, okChild)).includes('Waiting') && (await clickIn(A, okChild, 'Approve')) === 'missing')

    await clickIn(A, noChild, 'Reject')
    check('1. rejecting needs a reason first', await A.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.innerText.trim() === 'Confirm rejection')?.disabled === true))
    await fill(A, 'Reason shown to the parent', 'Please use the child’s own email address.')
    await click(A, 'Confirm rejection', { exact: true })
    check('1. admin rejects the other request', await waitText(A, `The request for ${noChild} was rejected.`))
    check('1. rejected request shows Rejected with the reason', /Rejected/.test(await itemText(A, noChild)) && (await itemText(A, noChild)).includes('child’s own email'))

    // What the decisions allow at sign-up (persisted, enforced by the server).
    let r = await api('POST', '/api/v1/auth/register', null, { name: `Mim ${run}`, email: noChild, password, role: 'student' })
    check('1. rejected request cannot register', r.status === 403 && r.data?.code === 'invitation_not_authorized', JSON.stringify(r.data))
    r = await api('POST', '/api/v1/auth/register', null, { name: `Wait ${run}`, email: waitChild, password, role: 'student' })
    check('1. unapproved request cannot register', r.status === 403 && r.data?.code === 'invitation_pending_approval', JSON.stringify(r.data))
    r = await api('POST', '/api/v1/auth/register', null, { name: `Rafi ${run}`, email: okChild, password, role: 'student' })
    check('1. approved request can register', r.status === 201 && r.data.user.role === 'student', JSON.stringify(r.data))
    const fam = (await api('GET', '/api/v1/workflow/family', r.data.tokens.access_token)).data
    check('1. the child is linked to the correct parent', fam.parent?.parent_id === parent.id && fam.parent.invited_email === okChild)
    const inv = (await api('GET', '/api/v1/workflow/family', parent.token)).data.invitations.find((i) => i.child_email === waitChild) ?? (await api('GET', '/api/v1/workflow/family', pendingParent.token)).data.invitations[0]
    check('1. non-admins cannot approve or reject', (await api('POST', `/api/v1/workflow/admin/student-invitations/${inv.id}/decision`, parent.token, { decision: 'approved' })).status === 403 && (await api('POST', `/api/v1/workflow/admin/student-invitations/${inv.id}/decision`, pendingParent.token, { decision: 'rejected', reason: 'Trying to decide my own request' })).status === 403)
    check('1. a decided request cannot be approved again', (await api('POST', `/api/v1/workflow/admin/student-invitations/${(await api('GET', '/api/v1/workflow/family', parent.token)).data.invitations.find((i) => i.child_email === noChild).id}/decision`, admin, { decision: 'approved' })).status === 409)

    // ---- Feature 2 in the UI ----
    const T = await newPage(browser)
    await signIn(T, tutor.email, password)
    await T.waitForFunction(() => localStorage.getItem('tuitionhub.session'), { timeout: 10000 })
    await T.goto(`${WEB}/app/tutor/notifications`, { waitUntil: 'networkidle0' })
    check('2. notification shows the interview date and time', await waitText(T, 'Interview scheduled') && (await text(T)).includes('Thursday, 5 December 2030 at 3:30 PM'))
    await click(T, 'Open message', { exact: true })
    check('2. Open message goes to the conversation', await waitPath(T, '/app/tutor/messages/'))
    check('2. the conversation shows the meeting details', await waitText(T, `Meeting link: ${link}`) && (await text(T)).includes('Date: Thursday, 5 December 2030') && (await text(T)).includes('Time: 3:30 PM (Bangladesh time)'))
    await T.goto(`${WEB}/app/tutor/messages`, { waitUntil: 'networkidle0' })
    check('2. Messages lists the conversation directly', await waitText(T, 'Verification interview scheduled'))
    check('no unexpected browser console errors', consoleErrors.length === 0, consoleErrors.join(' | '))
  } finally {
    await browser.close()
  }
  summary(run)
}

main().catch((e) => { console.error(e); process.exit(1) })
