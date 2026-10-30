import puppeteer from 'puppeteer-core'
const routes = process.argv.slice(2)
const b = await puppeteer.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] })
for (const w of [1440, 1035, 390]) {
  const p = await b.newPage(); await p.setViewport({ width: w, height: 816 })
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type()==='error' && !/cert|ERR_|Unsplash|net::/.test(m.text()) && errs.push(m.text().slice(0,140)))
  for (const r of routes) {
    await p.goto('http://localhost:3000' + r, { waitUntil: 'networkidle0' }); await new Promise(r => setTimeout(r, 450))
    const m = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight, main: document.querySelector('main')?.getBoundingClientRect().height|0, h1: document.querySelector('h1')?.textContent?.slice(0,30) }))
    if (m.sw > w || !m.h1 || m.main < 150) console.log('PROBLEM', w, r, JSON.stringify(m))
    if (w === 390 || w===1035) await p.screenshot({ path: `shots/sw_${w}_${r.replace(/\//g,'_')}.png` })
  }
  console.log(w, 'errors:', errs.slice(0,5))
}
await b.close()// populated state (sample tuition) via in-memory navigation
import { launch, go, drawer, w8 } from './h.mjs'
const R = ['find-tutor','find-tutor/tanvir-ahmed-rahman','find-tutor/compare','my-tuition','schedule','attendance','homework','assignments','progress','tutor','messages','notifications','safety','students/ST-3099']
for (const w of [1440, 1035, 390]) {
  const { b: bb, p, errs } = await launch(w, 816); await go(p, '/app/student/home'); await drawer(p, 'Approve student'); await drawer(p, 'Start sample tuition')
  for (const r of R) { await go(p, '/app/student/' + r); await w8(250)
    const m = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, h1: !!document.querySelector('h1'), main: document.querySelector('main')?.getBoundingClientRect().height | 0 }))
    if (m.sw > w || !m.h1 || m.main < 150) console.log('PROBLEM(tuition)', w, r, JSON.stringify(m))
    if (w === 390) await p.screenshot({ path: `shots/sw2_${w}_${r.replace(/\//g, '_')}.png` }) }
  console.log(w, 'tuition errors:', errs.slice(0, 5)); await bb.close()
}
