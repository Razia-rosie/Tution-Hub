import { launch, go, drawer, w8 } from './h.mjs'
const [,, w = '1440'] = process.argv
const { b, p, errs } = await launch(+w, +w < 600 ? 844 : 900)
const SCAN = () => p.evaluate((W) => {
  const out = { contrast: [], small: [], h1: document.querySelectorAll('h1').length, main: document.querySelectorAll('main').length, tables: 0, overflow: document.documentElement.scrollWidth > W }
  const cv = document.createElement('canvas'); cv.width = cv.height = 1; const cx2 = cv.getContext('2d', { willReadFrequently: true })
  const parse = (c) => { cx2.clearRect(0, 0, 1, 1); cx2.fillStyle = '#000'; cx2.fillStyle = c; cx2.fillRect(0, 0, 1, 1); const d = cx2.getImageData(0, 0, 1, 1).data; return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 } }
  const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4 }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b) }
  const blend = (f, bg) => ({ r: f.r * f.a + bg.r * (1 - f.a), g: f.g * f.a + bg.g * (1 - f.a), b: f.b * f.a + bg.b * (1 - f.a), a: 1 })
  const bgOf = (el) => { const stack = []; for (let e = el; e; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.backgroundImage !== 'none') return null; const c = parse(cs.backgroundColor); if (c && c.a > 0) { stack.push(c); if (c.a >= 1) break } } let base = { r: 247, g: 245, b: 240, a: 1 }; for (const c of stack.reverse()) base = blend(c, base); return base }
  const seen = new Set()
  for (const el of document.querySelectorAll('body *')) {
    if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') continue
    const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1)
    if (hasText && !el.closest('[aria-hidden=true]') && !el.closest('[disabled]') && !(el.disabled)) {
      const cs = getComputedStyle(el); const fg = parse(cs.color); const bg = bgOf(el); if (fg && bg) {
        const f = blend(fg, bg); const L1 = lum(f), L2 = lum(bg); const ratio = (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05)
        const size = parseFloat(cs.fontSize), bold = +cs.fontWeight >= 700; const large = size >= 24 || (size >= 18.66 && bold)
        const need = large ? 3 : 4.5
        const key = el.tagName + el.className + ratio.toFixed(1)
        if (ratio < need && !seen.has(key)) { seen.add(key); out.contrast.push(`${ratio.toFixed(2)} ${(el.innerText || '').trim().slice(0, 30)} [${el.tagName}.${String(el.className).slice(0, 60)}]`) } } }
    if (W < 600 && el.matches('button,a[href],input:not([type=hidden]),select,textarea,[role=tab],[role=switch]')) {
      const r = el.getBoundingClientRect(); const inline = el.matches('a') && el.closest('p,li,span') && getComputedStyle(el).display === 'inline'
      if (r.width && r.height && !inline && (r.height < 43.5 || r.width < 43.5) && !(el.matches('input[type=checkbox],input[type=radio]') )) { const k = el.tagName + el.className; if (!seen.has(k)) { seen.add(k); out.small.push(`${Math.round(r.width)}x${Math.round(r.height)} ${(el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 25)}`) } } }
  }
  if (W < 600) for (const t of document.querySelectorAll('table')) if (t.offsetParent) out.tables++
  return out }, +w)
const routes = []
const R = (role, list) => list.forEach((s) => routes.push(`/app/${role}/${s}`))
const report = async (name) => { await w8(300); const r = await SCAN(); const bad = r.contrast.length || r.small.length || r.h1 !== 1 || r.main !== 1 || r.tables || r.overflow
  if (bad) console.log(name, `h1=${r.h1} main=${r.main} tables=${r.tables} overflow=${r.overflow}`, r.contrast.slice(0, 6), r.small.slice(0, 6)) }
// public
for (const r of ['/', '/find-tutor', '/tutors/tanvir-ahmed-rahman', '/how-it-works', '/safety', '/faq', '/login', '/signup']) { await go(p, r); await report(r) }
await go(p, '/app/tutor/dashboard'); for (let i = 0; i < 5; i++) await drawer(p, 'Advance one step')
for (const s of ['dashboard','find-tuition','my-posts','my-students','schedule','attendance','homework','assignments','progress','reviews','ranking','awards','payments','verification','profile','messages','notifications','safety']) { await go(p, '/app/tutor/' + s); await report('tutor/' + s) }
await drawer(p, '=Simulate approval'); await drawer(p, 'Link Ayaan and Mim')
for (const s of ['dashboard','children','find-tutor','my-posts','tuitions','schedule','attendance','homework','progress','payments','messages','notifications','safety','settings']) { await go(p, '/app/parent/' + s); await report('parent/' + s) }
await go(p, '/app/student/home'); await drawer(p, 'Approve student'); await drawer(p, 'Start sample tuition')
for (const s of ['home','my-tuition','schedule','attendance','homework','assignments','progress','tutor','messages','profile','find-tutor','notifications','safety']) { await go(p, '/app/student/' + s); await report('student/' + s) }
for (const s of ['dashboard','verification','verification/organization','verification/institution','verification/documents','verification/contact','verification/review','verification/submit','verification/status','teachers','teachers/new','teachers/T-1','students','students/new','students/import','students/CS-100','parents','parents/PR-1','batches','batches/new','batches/B-1','classes','classes/new','attendance','attendance/C-B-1--7','homework','homework/new','homework/H-1','exams','exams/new','exams/E-1','results','reports','reports/new','reports/R-1','payments','profile','messages','messages/M-1','notifications']) { await go(p, '/app/coaching/' + s); await report('coaching/' + s) }
await drawer(p, 'Approve organization'); await go(p, '/app/coaching/dashboard'); await report('coaching/dashboard-verified'); for (const s of ['teachers','students','batches','classes','attendance','homework','exams','results','reports','payments','profile','messages','notifications']) { await go(p, '/app/coaching/' + s); await report('coaching-verified/' + s) }
for (const s of ['/design-system', '/reference']) { await go(p, s); await report(s) }
console.log('page errors', errs.slice(0, 3)); await b.close()
