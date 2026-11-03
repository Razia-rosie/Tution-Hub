// Two accounts in two tabs of one browser. The refresh cookie is shared by
// every tab, so after another tab signs in as someone else, a tab whose access
// token expires must not silently continue as that other account while still
// showing the first one. It must reload and show who is really signed in.
//
// Needs a test API with a short access token, e.g. ACCESS_TOKEN_TTL=5s:
//   E2E_WEB=http://127.0.0.1:5174 E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... node tests/session-tabs-browser.mjs

import puppeteer from 'puppeteer-core'
import { CHROME, WEB, check, click, signIn, signUp, summary, text, wait, waitPath, waitText } from './lib/browser.mjs'

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD
const TTL_MS = Number(process.env.E2E_ACCESS_TTL_MS ?? 6000)
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) { console.error('E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD are required'); process.exit(2) }
const run = Math.random().toString(36).slice(2, 8)
const PARENT = `Tab Parent ${run}`

async function main() {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] })
  try {
    // One browser context = one cookie jar, like two tabs of the user's Chrome.
    const ctx = await browser.createBrowserContext()
    const P = await ctx.newPage(); await P.setViewport({ width: 1280, height: 900 })
    await signUp(P, 'parent', PARENT, `tabs-parent-${run}@tuitionhub.test`, `Tab5-${run}-Pw!`)
    check('parent tab: on parent verification', await waitPath(P, '/app/parent/verification') && await waitText(P, 'Not submitted'))

    const A = await ctx.newPage(); await A.setViewport({ width: 1280, height: 900 })
    await signIn(A, ADMIN_EMAIL, ADMIN_PASSWORD, true)
    check('admin tab: signed in', await waitPath(A, '/app/admin'))

    await wait(TTL_MS + 1500) // the parent tab's access token expires
    // Navigate inside the app (no reload), as a user clicking the sidebar would.
    // The click's API calls find the token expired and refresh; the tab may reload.
    await click(P, 'Dashboard', { exact: true })
    await wait(3000)
    await P.waitForFunction(() => document.readyState === 'complete', { timeout: 10000 })
    await waitText(P, 'signed in as', 5000)
    const body = await text(P)
    check('parent tab never acts as the admin while showing the parent', !body.includes('only parents and students have family links'), body.slice(0, 300))
    check('parent tab reloads to the account that is really signed in', (await P.evaluate(() => location.pathname)).startsWith('/app/admin') && body.includes('signed in as'), `${await P.evaluate(() => location.pathname)} | ${body.slice(0, 200)}`)

    // The ordinary case still works: one account, token expires, refresh keeps the same account.
    const solo = await (await browser.createBrowserContext()).newPage(); await solo.setViewport({ width: 1280, height: 900 })
    await signUp(solo, 'parent', `Solo Parent ${run}`, `tabs-solo-${run}@tuitionhub.test`, `Tab5-${run}-Pw!`)
    await waitPath(solo, '/app/parent/verification')
    await wait(TTL_MS + 1500)
    await click(solo, 'Dashboard', { exact: true })
    await click(solo, 'Verification', { exact: true })
    check('single tab: expired token refreshes silently as the same account', await waitText(solo, 'Not submitted') && (await solo.evaluate(() => location.pathname)) === '/app/parent/verification' && !(await text(solo)).includes('signed in as') && !(await text(solo)).includes('only parents and students'))
  } finally {
    await browser.close()
  }
  summary(run)
}

main().catch((e) => { console.error(e); process.exit(1) })
