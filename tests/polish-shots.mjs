import { launch, go, drawer, btn, w8 } from './h.mjs'
const [,, w = '1440', dir = 'polish'] = process.argv
const { b, p } = await launch(+w, +w < 600 ? 844 : 900)
const S = async (name, full = false) => { await w8(450); await p.screenshot({ path: `shots/${dir}/${w}-${name}.png`, fullPage: full }) }
await go(p, '/'); await S('landing', true)
// tutor
await go(p, '/app/tutor/dashboard'); for (let i = 0; i < 5; i++) await drawer(p, 'Advance one step')
await go(p, '/app/tutor/dashboard'); await S('tutor-dashboard', true)
await go(p, '/app/tutor/find-tuition'); await S('tutor-inside', true)
// parent
await drawer(p, '=Simulate approval'); await drawer(p, 'Link Ayaan and Mim')
await go(p, '/app/parent/dashboard'); await S('parent-dashboard', true)
await go(p, '/app/parent/find-tutor'); await S('parent-inside', true)
// student
await go(p, '/app/student/home'); await drawer(p, 'Approve student'); await drawer(p, 'Start sample tuition')
await go(p, '/app/student/home'); await S('student-dashboard', true)
await go(p, '/app/student/homework'); await S('student-inside', true)
await b.close()
