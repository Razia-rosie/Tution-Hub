// Parent and student verification driven through the real UI in Chrome:
// the parent signs up, uploads their NID and the child's birth certificate,
// submits and gives the child's email; the administrator approves the parent
// and allows the child to register; the child signs up with that exact email
// and their own password, uploads their birth certificate and submits; the
// administrator approves the student; both dashboards show separate statuses.
//
//   E2E_WEB=http://127.0.0.1:5174 E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... node tests/family-browser.mjs

import puppeteer from 'puppeteer-core'
import { CHROME, WEB, check, click, consoleErrors, fill, fixture, newPage, path, signIn, signUp, summary, text, uploadPicture, wait, waitPath, waitText } from './lib/browser.mjs'

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) { console.error('E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD are required'); process.exit(2) }
const run = Math.random().toString(36).slice(2, 8)
const parentPassword = `Par3nt-${run}-Pw!`
const childPassword = `Ch1ld-${run}-Own!`
const email = (l) => `fb-${l}-${run}@tuitionhub.test`
const PARENT = `Salma Guardian ${run}`
const CHILD = `Ayaan Learner ${run}`

/** Clicks a button inside the card or list item whose text contains `needle`. */
async function clickWithin(page, needle, label) {
  const ok = await page.evaluate((n, l) => {
    const box = [...document.querySelectorAll('article,li,button')].find((x) => x.innerText.includes(n) && [...x.querySelectorAll('button')].some((b) => b.innerText.trim() === l && !b.disabled))
    const btn = box && [...box.querySelectorAll('button')].find((b) => b.innerText.trim() === l && !b.disabled)
    if (btn) btn.click()
    return !!btn
  }, needle, label)
  if (!ok) throw new Error(`button "${label}" near "${needle}" not found`)
  await wait(200)
}
async function openApplication(page, name) {
  await page.waitForFunction((n) => [...document.querySelectorAll('button')].some((b) => b.innerText.includes(n)), { timeout: 10000 }, name)
  await page.evaluate((n) => [...document.querySelectorAll('button')].find((b) => b.innerText.includes(n)).click(), name)
  await waitText(page, 'Decision')
}

async function main() {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] })
  try {
    // ---- parent signs up and is taken to verification ----
    const P = await newPage(browser)
    await signUp(P, 'parent', PARENT, email('parent'), parentPassword)
    check('parent: sign-up continues into parent verification', await waitPath(P, '/app/parent/verification') && await waitText(P, 'Parent verification'))
    check('parent: status shows Not submitted and read-only banner', await waitText(P, 'Not submitted') && (await text(P)).includes('Limited, read-only dashboard'))
    check('parent: child request is locked until verification is submitted', (await text(P)).includes('Submit your own verification above first'))

    // ---- uploads NID and child's birth certificate, submits ----
    await fill(P, 'Address', 'House 7, Road 3, Mirpur, Dhaka')
    await uploadPicture(P, 'Upload Your national ID', fixture('id-card.png'))
    check('parent: NID uploaded', await waitText(P, 'Your national ID (NID) uploaded'))
    await click(P, 'Submit for review', { exact: true })
    check('parent: missing birth certificate is listed', await waitText(P, "Your child's birth certificate"))
    await uploadPicture(P, "Upload Your child's birth certificate", fixture('certificate.jpg'))
    await waitText(P, "Your child's birth certificate uploaded")
    await click(P, 'Submit for review', { exact: true })
    check('parent: status is Pending Admin Review', await waitText(P, 'Pending Admin Review', 10000))

    // ---- gives the child's email ----
    await fill(P, "Child's email", email('child'))
    await fill(P, "Child's name", 'Ayaan')
    await click(P, 'Request student account', { exact: true })
    check('parent: child email recorded, waiting for admin permission', await waitText(P, 'Waiting for admin permission'))

    // ---- child cannot sign up yet; unrelated email refused ----
    const C = await newPage(browser)
    await signUp(C, 'student', CHILD, email('stranger'), childPassword)
    check('child: unrelated email refused with a clear message', await waitText(C, 'has not been invited') && (await path(C)) === '/signup/student')
    await signUp(C, 'student', CHILD, email('child'), childPassword)
    check('child: invited email refused while permission is pending', await waitText(C, 'still waiting for an administrator'))

    // ---- admin approves the parent, then allows the child ----
    const A = await newPage(browser, 1400, 1000)
    await signIn(A, ADMIN_EMAIL, ADMIN_PASSWORD, true)
    await waitPath(A, '/app/admin')
    await A.goto(`${WEB}/app/admin/family`, { waitUntil: 'networkidle0' })
    check('admin: parent & student verification section', await waitText(A, 'Parent & Student Verification') && await waitText(A, 'Parent verification requests'))
    await openApplication(A, PARENT)
    check('admin: parent request shows the child email and both pictures', await waitText(A, email('child')) && await waitText(A, 'Parent nid') && (await text(A)).includes('Child birth certificate'))
    await A.waitForFunction(() => [...document.querySelectorAll('img')].filter((i) => i.alt.includes('submitted by')).length === 2 && [...document.querySelectorAll('img')].every((i) => i.complete), { timeout: 10000 }).catch(() => {})
    check('admin: both document images load privately', await A.evaluate(() => [...document.querySelectorAll('img')].filter((i) => i.alt.includes('submitted by') && i.src.startsWith('blob:') && i.naturalWidth > 0).length === 2))
    await click(A, 'Approve', { exact: true })
    check('admin: parent approved', await waitText(A, 'Decision saved.'))

    await click(A, 'Student registration requests', { exact: true })
    await waitText(A, email('child'))
    await clickWithin(A, email('child'), 'Allow registration')
    check('admin: child allowed to register', await waitText(A, `${email('child')} may now register as a student.`))

    await P.reload({ waitUntil: 'networkidle0' })
    check('parent: sees approval and that the child may register', await waitText(P, 'Parent verified') && await waitText(P, 'Child may register'))

    // ---- child registers with the exact email and own password ----
    await signUp(C, 'student', CHILD, email('child'), childPassword)
    check('child: sign-up continues into student verification', await waitPath(C, '/app/student/verification', 10000) && await waitText(C, 'Student verification'))
    check('child: linked to the parent, pending', await waitText(C, `Pending with ${PARENT}`))
    await fill(C, 'Date of birth', '2012-05-14')
    await fill(C, 'Class', 'Class 8')
    await fill(C, 'School or college', 'Mirpur Model School')
    await uploadPicture(C, 'Upload Your birth certificate', fixture('certificate.jpg'))
    await waitText(C, 'Your birth certificate uploaded')
    await click(C, 'Submit for review', { exact: true })
    check('child: status is Pending Student Verification', await waitText(C, 'Pending Student Verification', 10000))

    await P.reload({ waitUntil: 'networkidle0' })
    check('parent: sees child pending review separately', await waitText(P, 'Student pending review') && (await text(P)).includes('Parent verified'))

    // ---- admin approves the student ----
    await click(A, 'Student verification', { exact: true })
    await openApplication(A, CHILD)
    check('admin: student request shows linked approved parent and matching invited email', await waitText(A, 'Linked parent / guardian') && (await text(A)).includes(PARENT) && (await text(A)).includes('(matches)'))
    await click(A, 'Approve', { exact: true })
    check('admin: student approved', await waitText(A, 'Decision saved.'))

    // ---- both accounts approved separately ----
    await C.reload({ waitUntil: 'networkidle0' })
    check('child: student account approved and linked', await waitText(C, 'Student account approved') && await waitText(C, `Linked to ${PARENT}`))
    check('child: read-only banner gone', !(await text(C)).includes('Limited, read-only dashboard'))
    await C.goto(`${WEB}/app/student/home`, { waitUntil: 'networkidle0' })
    check('child: dashboard shows own verification summary', await waitText(C, 'Your verification') && (await text(C)).includes('Approved'))
    await P.goto(`${WEB}/app/parent/dashboard`, { waitUntil: 'networkidle0' })
    check('parent: dashboard shows parent and child approved', await waitText(P, 'Verification and child account') && (await text(P)).includes('Student approved'))

    check('no unexpected browser console errors', consoleErrors.length === 0, consoleErrors.join(' | '))
  } finally {
    await browser.close()
  }
  summary(run)
}

main().catch((e) => { console.error(e); process.exit(1) })
