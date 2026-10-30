import { launch, go, drawer, w8, btn } from './h.mjs'
const A = '/app/coaching'
const routes = ['dashboard', 'verification', 'verification/organization', 'verification/institution', 'verification/documents', 'verification/contact', 'verification/review', 'verification/submit', 'verification/status', 'teachers', 'students', 'batches', 'classes', 'attendance', 'homework', 'exams', 'results', 'parents', 'reports', 'payments', 'profile', 'messages', 'notifications']
for (const w of [1440, 1035, 390]) {
  const { b, p, errs } = await launch(w, w === 390 ? 844 : 816)
  await go(p, A + '/dashboard')
  const bad = []
  for (const st of ['unverified', 'verified']) {
    if (st === 'verified') await drawer(p, 'Approve organization')
    for (const r of routes) { await go(p, A + '/' + r); await w8(500)
      const o = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, main: document.querySelector('main')?.innerText.length || 0, h1: document.querySelectorAll('h1').length }))
      if (o.sw > o.cw + 1 || o.main < 60 || o.h1 !== 1) bad.push(`${st} ${r}: ${JSON.stringify(o)}`) }
  }
  for (const v of ['Loading', 'Error', 'Empty (new organization)']) { await go(p, A + '/dashboard'); await p.evaluate((v) => { const s = document.querySelector('[aria-label="Dashboard view state"]'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, v); s.dispatchEvent(new Event('change', { bubbles: true })) }, v); await w8(200)
    const o = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); if (o > 1) bad.push(`variant ${v} overflow ${o}`) }
  console.log(w, bad.length ? bad : 'ok', errs.filter((e) => !/CERT/.test(e)).slice(0, 3))
  await b.close()
}
