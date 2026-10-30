import { launch, go, drawer, w8 } from './h.mjs'
for (const [w, h] of [[1440, 900], [390, 844]]) {
  const { b, p } = await launch(w, h)
  await go(p, '/app/coaching/dashboard'); await drawer(p, 'Approve organization')
  await go(p, '/app/coaching/dashboard'); await w8(300)
  await p.evaluate(() => document.querySelectorAll('[aria-label=Dismiss]').forEach((x) => x.click())); await w8(200)
  await p.screenshot({ path: `shots/after/${w}-coaching-dashboard.png`, fullPage: true })
  await go(p, '/app/coaching/verification/documents'); await p.evaluate(() => document.querySelectorAll('[aria-label=Dismiss]').forEach((x) => x.click())); await w8(200)
  await p.screenshot({ path: `shots/after/${w}-coaching-verification.png`, fullPage: true })
  await b.close()
}
