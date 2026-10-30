// Browser end-to-end test: drives the real UI against a real API and database.
//
// Start the API on an isolated *_e2e database and point Vite at it, e.g.
//   API_PROXY_TARGET=http://localhost:8090 PORT=5174 pnpm dev
// then run
//   E2E_WEB=http://127.0.0.1:5174 E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... node tests/browser-e2e.mjs
//
// CHROME_PATH overrides the browser (defaults to Google Chrome on macOS).
// The test creates new accounts with random emails and records admin decisions.

import puppeteer from 'puppeteer-core'
import { fileURLToPath } from 'node:url'

const WEB = process.env.E2E_WEB ?? 'http://127.0.0.1:5174'
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) { console.error('E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD are required'); process.exit(2) }

const fixture = (name) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url))
const run = Math.random().toString(36).slice(2, 8)
const password = `Br0wser-${run}-Pass!`
const email = (label) => `ui-${label}-${run}@tuitionhub.test`
// Names carry the run id so leftovers from earlier runs in the queue are never clicked by mistake.
const TUTOR = `Browser Tutor ${run}`
const SCHOLARS = `Browser Scholars ${run}`

let pass = 0
let fail = 0
const failures = []
function check(name, ok, detail = '') {
  if (ok) { pass++; console.log('PASS', name) } else { fail++; failures.push(name); console.log('FAIL', name, detail) }
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

// Expected HTTP failures (validation, auth checks) appear as console resource errors; real script errors do not match this.
const EXPECTED = /Failed to load resource: the server responded with a status of (401|403|404|409|422|429)/
const consoleErrors = []

async function newPage(browser, width = 1280, height = 900) {
  const ctx = await browser.createBrowserContext()
  const page = await ctx.newPage()
  await page.setViewport({ width, height })
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => { if (m.type() === 'error' && !EXPECTED.test(m.text())) consoleErrors.push(m.text()) })
  return page
}

const text = (page) => page.evaluate(() => document.body.innerText)
const path = (page) => page.evaluate(() => location.pathname)
async function waitText(page, needle, timeout = 8000) {
  try { await page.waitForFunction((n) => document.body.innerText.includes(n), { timeout }, needle); return true } catch { return false }
}
async function waitPath(page, prefix, timeout = 8000) {
  try { await page.waitForFunction((p) => location.pathname.startsWith(p), { timeout }, prefix); return true } catch { return false }
}

/** Sets a labelled input's value the way React expects (native setter + input event). */
async function fill(page, label, value) {
  const ok = await page.evaluate((l, v) => {
    const lb = [...document.querySelectorAll('label')].find((x) => x.innerText.trim().toLowerCase().startsWith(l.toLowerCase()))
    const el = (lb && (document.getElementById(lb.htmlFor) || lb.querySelector('input,textarea,select'))) || document.querySelector(`[aria-label="${l}"],[placeholder="${l}"]`)
    if (!el) return false
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement : el.tagName === 'SELECT' ? HTMLSelectElement : HTMLInputElement
    Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, v)
    el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }))
    return true
  }, label, value)
  if (!ok) throw new Error(`field not found: ${label}`)
}

/** Clicks the first visible, enabled button/link whose text (or aria-label) matches. */
async function click(page, label, { exact = false } = {}) {
  const ok = await page.evaluate((t, ex) => {
    const el = [...document.querySelectorAll('button,a,[role=button],label')].find((x) => {
      const s = (x.innerText.trim() || x.getAttribute('aria-label') || '').toLowerCase()
      return !x.disabled && x.offsetParent !== null && (ex ? s === t.toLowerCase() : s.includes(t.toLowerCase()))
    })
    if (el) el.click()
    return !!el
  }, label, exact)
  if (!ok) throw new Error(`clickable not found: ${label}`)
  await wait(150)
}

async function uploadPicture(page, ariaLabelStart, file) {
  await page.waitForFunction((l) => [...document.querySelectorAll('input[type=file]')].some((i) => (i.getAttribute('aria-label') ?? '').startsWith(l) && !i.disabled), { timeout: 10000 }, ariaLabelStart).catch(() => {})
  const handle = await page.evaluateHandle((l) => [...document.querySelectorAll('input[type=file]')].find((i) => (i.getAttribute('aria-label') ?? '').startsWith(l)), ariaLabelStart)
  const input = handle.asElement()
  if (!input) throw new Error(`file input not found: ${ariaLabelStart}`)
  await input.uploadFile(file)
}

async function signUp(page, role, name, label) {
  await page.goto(`${WEB}/signup/${role}`, { waitUntil: 'networkidle0' })
  await fill(page, 'Full name', name)
  await fill(page, 'Email', email(label))
  await fill(page, 'Password', password)
  await fill(page, 'Confirm password', password)
  await page.evaluate(() => document.querySelector('input[type=checkbox]').click())
  await click(page, 'Continue', { exact: true })
}

async function signIn(page, who, pw, admin = false) {
  await page.goto(`${WEB}/${admin ? 'admin/login' : 'login'}`, { waitUntil: 'networkidle0' })
  await fill(page, admin ? 'Admin email' : 'Email', who)
  await fill(page, 'Password', pw)
  await page.evaluate(() => document.querySelector('form button[type=submit]').click())
}

async function main() {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] })
  try {
    // ---------- Tutor registration and verification ----------
    const tutor = await newPage(browser)
    await signUp(tutor, 'tutor', TUTOR, 'tutor')
    check('tutor: registration continues into verification', await waitPath(tutor, '/app/tutor/verification'))
    check('tutor: shows "Get verified" and read-only banner', await waitText(tutor, 'Get verified') && (await text(tutor)).includes('read-only'))
    check('tutor: real page has no sample-data notice', !(await text(tutor)).includes('Preview with sample data'))
    await click(tutor, 'Submit for review')
    check('tutor: submitting empty lists what is missing', await waitText(tutor, 'National ID') && (await text(tutor)).includes('Complete profile details'))

    await uploadPicture(tutor, 'Upload National ID', fixture('id-card.png'))
    check('tutor: picture uploads and thumbnail renders', await waitText(tutor, 'Uploaded') && await tutor.waitForFunction(() => [...document.images].some((i) => i.alt.startsWith('Your uploaded') && i.naturalWidth > 0), { timeout: 8000 }).then(() => true, () => false))
    // The accept attribute is only a hint; a script or file manager can still pass a PDF.
    await uploadPicture(tutor, 'Upload Latest academic', fixture('../verification-e2e.mjs'))
    check('tutor: non-image rejected in the browser', await waitText(tutor, 'PDF and Word files are not accepted'))

    await fill(tutor, 'Education', 'BSc Mathematics, University of Dhaka')
    await fill(tutor, 'Subjects', 'Mathematics, Physics')
    await fill(tutor, 'Classes', 'Class 9, SSC')
    await fill(tutor, 'Areas', 'Mirpur, Uttara')
    await click(tutor, 'Submit for review')
    check('tutor: submitted -> Under review', await waitText(tutor, 'Under review'))
    check('tutor: fields and pictures locked', await tutor.evaluate(() => [...document.querySelectorAll('main input:not([type=file])')].every((i) => i.disabled) && !document.querySelector('main input[type=file]')))
    await tutor.reload({ waitUntil: 'networkidle0' })
    check('session: no token is readable by page scripts', await tutor.evaluate(() => !Object.keys(localStorage).some((k) => /token/i.test(k)) && !Object.values(localStorage).some((v) => /^eyJ|^[0-9a-f]{64}$/.test(v)) && !document.cookie.includes('th_refresh')))
    check('tutor: session and status survive reload', (await path(tutor)) === '/app/tutor/verification' && await waitText(tutor, 'Under review'))
    await tutor.goto(`${WEB}/app/admin/verification`, { waitUntil: 'networkidle0' })
    check('tutor: cannot open admin pages', (await path(tutor)).startsWith('/app/tutor'))
    await tutor.goto(`${WEB}/app/tutor/dashboard`, { waitUntil: 'networkidle0' })
    check('tutor: dashboard shows real figures, no sample data', await waitText(tutor, 'Active tuitions') && !(await text(tutor)).includes('sample data'))

    // ---------- Coaching registration and verification ----------
    const coaching = await newPage(browser)
    await signUp(coaching, 'coaching', SCHOLARS, 'coaching')
    check('coaching: registration continues into verification', await waitPath(coaching, '/app/coaching/verification'))
    await uploadPicture(coaching, 'Upload Trade licence', fixture('certificate.jpg'))
    await waitText(coaching, 'Uploaded')
    await uploadPicture(coaching, 'Upload Owner', fixture('large-photo.jpg'))
    check('coaching: both pictures uploaded (incl. 3000x2000 photo)', await coaching.waitForFunction(() => document.body.innerText.split('Uploaded').length - 1 >= 2, { timeout: 10000 }).then(() => true, () => false))
    await fill(coaching, 'Institute name', 'Browser Scholars Point')
    await fill(coaching, 'Registration details', 'TRAD/DNCC/0042/2025')
    await fill(coaching, 'Subjects', 'Mathematics, English')
    await fill(coaching, 'Levels taught', 'SSC, HSC')
    await fill(coaching, 'Areas', 'Uttara')
    await click(coaching, 'Submit for review')
    check('coaching: submitted -> Under review', await waitText(coaching, 'Under review'))

    // ---------- Admin review ----------
    const admin = await newPage(browser)
    await signIn(admin, ADMIN_EMAIL, ADMIN_PASSWORD, true)
    check('admin: lands on the review queue', await waitPath(admin, '/app/admin/verification'))
    check('admin: tutor and coaching in Pending', await waitText(admin, TUTOR) && (await text(admin)).includes(SCHOLARS))
    await click(admin, TUTOR)
    check('admin: submitted details shown', await waitText(admin, 'BSc Mathematics, University of Dhaka'))
    check('admin: picture preview loads', await admin.waitForFunction(() => [...document.images].some((i) => i.alt.includes('submitted by Browser Tutor') && i.naturalWidth === 420), { timeout: 8000 }).then(() => true, () => false))
    await click(admin, 'Enlarge')
    check('admin: full-size viewer opens', await admin.waitForSelector('[role=dialog] img', { timeout: 5000 }).then(() => true, () => false))
    await admin.keyboard.press('Escape')
    check('admin: viewer closes with Escape', await admin.waitForFunction(() => !document.querySelector('[role=dialog]'), { timeout: 3000 }).then(() => true, () => false))
    check('admin: history shows the submission', (await text(admin)).includes('Submitted application'))

    await fill(admin, 'Decision', 'resubmission_required')
    await fill(admin, 'Reason shown to the applicant', 'short')
    check('admin: short reason keeps the button disabled', await admin.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.innerText === 'Request corrections')?.disabled === true))
    await fill(admin, 'Reason shown to the applicant', 'The NID photo is blurred; please retake it in daylight.')
    await click(admin, 'Request corrections', { exact: true })
    check('admin: correction requested', await waitText(admin, 'Decision saved') && (await text(admin)).includes('Corrections were requested'))

    await fill(admin, 'Status', 'pending')
    await waitText(admin, SCHOLARS)
    await click(admin, SCHOLARS)
    await waitText(admin, 'Browser Scholars Point')
    check('admin: coaching pictures both load', await admin.waitForFunction((n) => [...document.images].filter((i) => i.alt.includes(n) && i.naturalWidth > 0).length === 2, { timeout: 10000 }, SCHOLARS).then(() => true, () => false))
    await click(admin, 'Approve', { exact: true })
    check('admin: coaching approved', await waitText(admin, 'The decision is final'))

    // ---------- Tutor corrects and resubmits ----------
    await tutor.goto(`${WEB}/app/tutor/verification`, { waitUntil: 'networkidle0' })
    check('tutor: sees the correction reason', await waitText(tutor, 'The NID photo is blurred'))
    check('tutor: details prefilled for correction', await tutor.evaluate(() => [...document.querySelectorAll('main input')].some((i) => i.value === 'BSc Mathematics, University of Dhaka')))
    await uploadPicture(tutor, 'Replace National ID', fixture('certificate.jpg'))
    await waitText(tutor, 'uploaded.')
    await click(tutor, 'Resubmit for review')
    check('tutor: resubmitted -> Under review', await waitText(tutor, 'Under review'))

    // ---------- Admin approves the resubmission ----------
    await admin.reload({ waitUntil: 'networkidle0' })
    await waitText(admin, TUTOR)
    check('admin: resubmission flagged', (await text(admin)).includes('Resubmitted ×1'))
    await click(admin, TUTOR)
    await waitText(admin, 'Resubmitted application')
    await click(admin, 'Approve', { exact: true })
    check('admin: tutor approved', await waitText(admin, 'The decision is final'))

    // ---------- Tutor verified ----------
    await tutor.goto(`${WEB}/app/tutor/verification`, { waitUntil: 'networkidle0' })
    check('tutor: shows Verified', await waitText(tutor, 'An administrator approved your application'))
    check('tutor: read-only banner gone', !(await text(tutor)).includes('Limited, read-only dashboard'))
    check('tutor: unread badge on the bell', await tutor.evaluate(() => /Notifications, \d+ unread/.test(document.querySelector('header button[aria-label^="Notifications"]')?.getAttribute('aria-label') ?? '')))
    await tutor.goto(`${WEB}/app/tutor/notifications`, { waitUntil: 'networkidle0' })
    check('tutor: notifications list the decisions', await waitText(tutor, 'Verification approved') && (await text(tutor)).includes('Corrections requested'))
    await click(tutor, 'Mark all as read')
    check('tutor: mark all read clears the badge', await tutor.waitForFunction(() => document.querySelector('header button[aria-label^="Notifications"]')?.getAttribute('aria-label') === 'Notifications', { timeout: 5000 }).then(() => true, () => false))

    // ---------- Admin management ----------
    await admin.goto(`${WEB}/app/admin/overview`, { waitUntil: 'networkidle0' })
    check('admin: overview shows live figures', await waitText(admin, 'Awaiting review') && (await text(admin)).includes('Accounts by role'))
    await admin.goto(`${WEB}/app/admin/users`, { waitUntil: 'networkidle0' })
    await fill(admin, 'Search name or email', email('tutor'))
    await click(admin, 'Search', { exact: true })
    check('admin: user search finds the tutor', await waitText(admin, email('tutor')) && (await text(admin)).includes('1–1 of 1'))
    await click(admin, 'Suspend', { exact: true })
    await fill(admin, 'Reason', 'Browser test suspension check')
    await click(admin, 'Suspend account')
    check('admin: tutor suspended', await waitText(admin, 'suspended. Their sessions were ended'))
    await tutor.goto(`${WEB}/app/tutor/verification`, { waitUntil: 'networkidle0' })
    check('suspended tutor is signed out', await waitPath(tutor, '/login', 10000))
    await signIn(tutor, email('tutor'), password)
    check('suspended tutor sees why sign-in fails', await waitText(tutor, 'suspended'))
    await click(admin, 'Reactivate')
    check('admin: tutor reactivated', await waitText(admin, 'reactivated'))
    await admin.goto(`${WEB}/app/admin/audit-log`, { waitUntil: 'networkidle0' })
    check('admin: audit log lists suspension and decisions', await waitText(admin, 'user suspended') && (await text(admin)).includes('verification approved'))

    // ---------- Sign-out ----------
    await coaching.goto(`${WEB}/app/coaching/dashboard`, { waitUntil: 'networkidle0' })
    await click(coaching, 'Sign out')
    await click(coaching, 'Log out', { exact: true })
    await coaching.goto(`${WEB}/app/coaching/dashboard`, { waitUntil: 'networkidle0' })
    check('sign-out ends the session', (await path(coaching)) === '/login' && await coaching.evaluate(() => localStorage.getItem('tuitionhub.session') === null))

    // ---------- Every role's screens at three widths ----------
    const sweepRoles = { tutor: [email('tutor'), password], coaching: [email('coaching'), password], admin: [ADMIN_EMAIL, ADMIN_PASSWORD] }
    for (const role of ['student', 'parent']) {
      const p = await newPage(browser)
      await signUp(p, role, `Browser ${role}`, role)
      await waitPath(p, '/auth/gate')
      sweepRoles[role] = [email(role), password]
      await p.browserContext().close()
    }
    for (const [role, [who, pw]] of Object.entries(sweepRoles)) {
      for (const [w, h, label] of [[375, 812, 'mobile'], [768, 1024, 'tablet'], [1280, 900, 'desktop']]) {
        const p = await newPage(browser, w, h)
        await signIn(p, who, pw, role === 'admin')
        // Regular sign-in lands on /auth/gate first; continue into the role area once the session exists.
        await p.waitForFunction(() => localStorage.getItem('tuitionhub.session'), { timeout: 10000 })
        await p.goto(`${WEB}/app/${role}`, { waitUntil: 'networkidle0' })
        await waitPath(p, `/app/${role}/`, 10000)
        const links = await p.evaluate((r) => [...new Set([...document.querySelectorAll('a[href^="/app/"]')].map((a) => a.getAttribute('href')).filter((h) => h.startsWith(`/app/${r}/`)))], role)
        const problems = []
        for (const href of links) {
          await p.goto(WEB + href, { waitUntil: 'networkidle0' })
          const info = await p.evaluate(() => ({ t: document.body.innerText, overflow: document.documentElement.scrollWidth - window.innerWidth }))
          if (/Something went wrong|Unexpected Application Error|Screen not found/.test(info.t)) problems.push(`${href}: crashed`)
          if (info.overflow > 1) problems.push(`${href}: ${info.overflow}px horizontal overflow`)
        }
        check(`sweep: ${role} ${label} (${links.length} screens) render without crashes or overflow`, links.length > 0 && problems.length === 0, problems.join('; '))
        await p.browserContext().close()
      }
    }

    check('no unexpected browser console errors', consoleErrors.length === 0, consoleErrors.slice(0, 5).join(' | '))
  } finally {
    await browser.close()
  }
  console.log(`\nrun ${run}: ${pass} pass, ${fail} fail`)
  if (fail) { console.log('Failed:', failures.join('; ')); process.exit(1) }
}

main().catch((e) => { console.error(e); process.exit(1) })
