import { launch, go, drawer, w8 } from './h.mjs'
for (const [w, h] of [[390, 844], [1440, 900]]) {
  const { b, p } = await launch(w, h)
  await go(p, '/app/coaching/dashboard'); await drawer(p, 'Approve organization')
  for (const r of ['students', 'classes', 'exams/E-1', 'reports/R-1', 'payments']) { await go(p, '/app/coaching/' + r); await w8(300); await p.evaluate(() => document.querySelectorAll('[aria-label=Dismiss]').forEach((x) => x.click())); await p.screenshot({ path: `shots/after/${w}-co-${r.replace('/', '-')}.png`, fullPage: false }) }
  await b.close()
}
