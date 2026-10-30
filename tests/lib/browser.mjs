// Shared puppeteer helpers for the browser end-to-end suites.
import { fileURLToPath } from 'node:url'

export const WEB = process.env.E2E_WEB ?? 'http://127.0.0.1:5174'
export const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
export const fixture = (name) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url))

let pass = 0
let fail = 0
const failures = []
export function check(name, ok, detail = '') {
  if (ok) { pass++; console.log('PASS', name) } else { fail++; failures.push(name); console.log('FAIL', name, detail) }
}
export function summary(run) {
  console.log(`\nrun ${run}: ${pass} pass, ${fail} fail`)
  if (fail) { console.log('Failed:', failures.join('; ')); process.exit(1) }
}

export const wait = (ms) => new Promise((r) => setTimeout(r, ms))

// Expected HTTP failures (validation, auth checks) appear as console resource errors; real script errors do not match this.
export const EXPECTED = /Failed to load resource: the server responded with a status of (401|403|404|409|422|429)/
export const consoleErrors = []

export async function newPage(browser, width = 1280, height = 900) {
  const ctx = await browser.createBrowserContext()
  const page = await ctx.newPage()
  await page.setViewport({ width, height })
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => { if (m.type() === 'error' && !EXPECTED.test(m.text())) consoleErrors.push(m.text()) })
  return page
}

export const text = (page) => page.evaluate(() => document.body.innerText)
export const path = (page) => page.evaluate(() => location.pathname)
export async function waitText(page, needle, timeout = 8000) {
  try { await page.waitForFunction((n) => document.body.innerText.includes(n), { timeout }, needle); return true } catch { return false }
}
export async function waitPath(page, prefix, timeout = 8000) {
  try { await page.waitForFunction((p) => location.pathname.startsWith(p), { timeout }, prefix); return true } catch { return false }
}

/** Sets a labelled input's value the way React expects (native setter + input event). */
export async function fill(page, label, value) {
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
export async function click(page, label, { exact = false } = {}) {
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

export async function uploadPicture(page, ariaLabelStart, file) {
  await page.waitForFunction((l) => [...document.querySelectorAll('input[type=file]')].some((i) => (i.getAttribute('aria-label') ?? '').startsWith(l) && !i.disabled), { timeout: 10000 }, ariaLabelStart).catch(() => {})
  const handle = await page.evaluateHandle((l) => [...document.querySelectorAll('input[type=file]')].find((i) => (i.getAttribute('aria-label') ?? '').startsWith(l)), ariaLabelStart)
  const input = handle.asElement()
  if (!input) throw new Error(`file input not found: ${ariaLabelStart}`)
  await input.uploadFile(file)
}

export async function signUp(page, role, name, email, password) {
  await page.goto(`${WEB}/signup/${role}`, { waitUntil: 'networkidle0' })
  await fill(page, 'Full name', name)
  await fill(page, 'Email', email)
  await fill(page, 'Password', password)
  await fill(page, 'Confirm password', password)
  await page.evaluate(() => document.querySelector('input[type=checkbox]').click())
  await click(page, 'Continue', { exact: true })
}

export async function signIn(page, who, pw, admin = false) {
  await page.goto(`${WEB}/${admin ? 'admin/login' : 'login'}`, { waitUntil: 'networkidle0' })
  await fill(page, admin ? 'Admin email' : 'Email', who)
  await fill(page, 'Password', pw)
  await page.evaluate(() => document.querySelector('form button[type=submit]').click())
}

