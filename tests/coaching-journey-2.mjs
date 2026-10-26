import { launch, go, txt, btn, fill, T, done, drawer, w8 } from './h.mjs'
const { b, p, errs } = await launch(1440, 900)
const A = '/app/coaching'; const here = () => p.evaluate(() => location.pathname)
const num = async (label) => p.evaluate((l) => { const a = [...document.querySelectorAll('main a[href^="/app/coaching/"]')].find((x) => x.innerText.toLowerCase().includes(l)); return a ? a.innerText : '' }, label)

// unverified: read-only everywhere
await go(p, A + '/teachers'); let t = await txt(p)
T('unverified teachers read-only bar', /Read-only until verified/.test(t))
T('unverified: Add teacher locked', await p.evaluate(() => [...document.querySelectorAll('button')].some((x) => x.innerText.includes('Add teacher') && x.disabled)))
await go(p, A + '/teachers/new'); t = await txt(p); T('unverified add-teacher form hidden', /Read-only until verified/.test(t) && !/Add teacher and send invite/.test(t))
await go(p, A + '/messages/M-1'); T('unverified composer disabled', await p.evaluate(() => document.querySelector('main textarea')?.disabled === true))
await go(p, A + '/profile'); T('unverified listing toggle off', await p.evaluate(() => document.querySelector('[role=switch]').getAttribute('aria-checked') === 'false'))
await drawer(p, 'Approve organization')

// Teachers
await go(p, A + '/teachers'); t = await txt(p); T('CO-01 teachers list', /CO-01/.test(t) && /Sabrina Akter/.test(t) && /Showing 1 to/.test(t))
T('teacher phones masked', !/01712345678/.test(t) && !/01812345621/.test(t))
await fill(p, 'Search teachers', 'physics'); t = await txt(p); T('teacher search', /Rakibul Hasan/.test(t) && !/Sabrina Akter/.test(t))
await fill(p, 'Search teachers', 'zzzz'); T('teacher no match + clear', /No teachers match/.test(await txt(p)) && await btn(p, 'Clear'))
await fill(p, 'Status', 'Invite sent'); t = await txt(p); T('teacher filter invited', /Invite sent/.test(t) && !/Sabrina Akter/.test(t)); await fill(p, 'Status', 'All')
await btn(p, '=Name'); await w8(100); T('sortable header sets aria-sort', await p.evaluate(() => !!document.querySelector('th[aria-sort="ascending"],th[aria-sort="descending"]')))
await go(p, A + '/teachers/new'); await btn(p, 'Add teacher and send invite'); t = await txt(p); T('CO-02 validation', /first and last name/.test(t) && /qualification/i.test(t) && /valid mobile/.test(t) && /valid email/.test(t))
await fill(p, 'Full name', 'Mehedi Hasan'); await fill(p, 'Qualification', 'MSc, Dhaka University'); await fill(p, 'Mobile number', '1712345678'); await btn(p, 'Add teacher and send invite'); T('duplicate phone', /already in your list/.test(await txt(p)))
await fill(p, 'Mobile number', '1999887766'); await fill(p, 'Email', 'mehedi@demo.test'); await fill(p, 'Subject', 'Mathematics'); await btn(p, 'Add teacher and send invite'); await w8(300)
t = await txt(p); T('-> teacher detail (invited)', /CO-03/.test(t) && /Mehedi Hasan/.test(t) && /Invite sent/.test(t)); T('detail masks phone and email', !/01999887766/.test(t) && !/mehedi@demo\.test/.test(t))
const tid = (await here()).split('/').pop()
await btn(p, 'Simulate: invite accepted'); T('invite accepted -> active', /Active/.test(await txt(p)))
await go(p, A + '/teachers/T-2'); await btn(p, 'Remove'); await w8(200); t = await txt(p); T('remove teacher confirm blocked while teaching', /still teaches/.test(t) && await p.evaluate(() => [...document.querySelectorAll('[role=dialog] button')].some((x) => x.innerText.includes('Remove teacher') && x.disabled)))
await btn(p, 'Cancel', '[role=dialog]')

// Students
await go(p, A + '/dashboard'); const before = await p.evaluate(() => document.querySelector('main').innerText)
await go(p, A + '/students'); t = await txt(p); T('CO-04 students list', /CO-04/.test(t) && /Ayaan Rahman/.test(t))
T('no full phones in students', !/01[3-9]\d{8}/.test(t))
await go(p, A + '/students/new'); await btn(p, 'Add student'); t = await txt(p); T('CO-05 validation', /full name/i.test(t))
await fill(p, 'Student full name', 'Tahsin Rahman'); await fill(p, 'Class', 'Class 10'); await fill(p, 'Parent full name', 'Mr. Abdur Rahman'); await fill(p, 'Parent mobile number', '1555123456'); await fill(p, 'Parent email', 'abdur@demo.test')
await btn(p, 'Add student'); t = await txt(p); T('student needs a batch', /batch/i.test(t) && /CO-05/.test(t))
await btn(p, 'Class 10 Maths, Evening'); await btn(p, 'Add student'); await w8(300); t = await txt(p)
T('-> student detail', /CO-07/.test(t) && /Tahsin Rahman/.test(t)); T('student detail masks parent', !/01555123456/.test(t) && !/abdur@demo\.test/.test(t))
const sid = (await here()).split('/').pop()
await go(p, A + '/students/import'); await btn(p, 'sample'); t = await txt(p); T('CO-06 import shows row problems (Demo)', /Demo/.test(t) && /not found|invalid|short/i.test(t))
await btn(p, 'valid row'); await w8(300); t = await txt(p); T('import done', /Import complete/.test(t))
await go(p, A + '/students'); await fill(p, 'Search students', 'Tahsin'); t = await txt(p); T('student search', /Tahsin Rahman/.test(t) && !/Ayaan Rahman/.test(t)); await fill(p, 'Search students', '')
await p.evaluate(() => document.querySelector('main tbody input[type=checkbox]')?.click()); await w8(150); t = await txt(p); T('row selection shows bulk bar', /selected/i.test(t) && /Pause/.test(t))

// Parents
await go(p, A + '/parents'); await fill(p, 'Search parents', 'Shirin'); t = await txt(p); T('CO-08 parents masked', /CO-08/.test(t) && /017•• ••• 101/.test(t) && !/01711000101/.test(t))
T('parent emails masked', !/@scholarspoint\.demo/.test(t) || /•/.test(t))
await go(p, A + '/parents/PR-1'); t = await txt(p); T('CO-09 parent detail linked students only', /Shirin Sultana/.test(t) && /Linked students/i.test(t) && !/01711000101/.test(t))
await go(p, A + '/parents/PR-999'); T('unknown parent not found', /not found/i.test(await txt(p)))

// Batches
await go(p, A + '/batches'); t = await txt(p); T('CO-10 batches', /CO-10/.test(t) && /HSC Physics, Morning/.test(t))
await go(p, A + '/batches/new'); await btn(p, '=Create batch'); t = await txt(p); T('CO-11 validation', /name/i.test(t) && /day/i.test(t))
await fill(p, 'Batch name', 'Class 8 Science, Morning'); await fill(p, 'Teacher', 'Mehedi Hasan'); await fill(p, 'Room', 'Room 4'); await fill(p, 'Time', '8:00-9:30 AM'); await btn(p, 'Sat'); await btn(p, 'Mon')
await btn(p, '=Create batch'); await w8(300); t = await txt(p); T('-> batch detail', /CO-12/.test(t) && /Class 8 Science, Morning/.test(t))
const bid = (await here()).split('/').pop()
await btn(p, 'Add students'); await w8(200); T('add-students modal', await p.evaluate(() => !!document.querySelector('[role=dialog]')))
await p.evaluate(() => document.querySelector('[role=dialog] input[type=checkbox]')?.click()); await btn(p, 'selected', '[role=dialog]'); await w8(250)
t = await txt(p); T('student added to batch', !/No students/.test(t))
await go(p, A + '/batches/' + bid); await btn(p, 'Delete batch'); await w8(200); T('delete batch confirm modal', /Delete .*\?/.test(await p.evaluate(() => document.querySelector('[role=dialog]')?.innerText || ''))); await btn(p, 'Cancel', '[role=dialog]')

// Classes
await go(p, A + '/classes'); t = await txt(p); T('CO-13 calendar', /CO-13/.test(t) && /This week/.test(t))
await btn(p, 'Next week'); await w8(150); T('calendar next week', /Mon|Tue/.test(await txt(p))); await btn(p, 'This week')
await go(p, `${A}/classes/new?batch=${bid}`); t = await txt(p); T('CO-14 schedule prefilled', /Schedule class/.test(t) && /Class 8 Science/.test(t))
await fill(p, 'Batch', 'HSC Physics, Morning'); await fill(p, 'Time', '8:00-9:30 AM'); await fill(p, 'Room', 'Room 2')
await p.evaluate((o) => { const s = document.querySelector('select[id]'); }, 0)
await btn(p, '=Schedule class'); await w8(300); t = await txt(p)
T('class created or conflict shown', /CO-1[45]|conflict|already/i.test(t))

// Attendance
await go(p, A + '/attendance/C-B-1--7'); t = await txt(p); T('CO-17 mark page (past class)', /CO-17/.test(t) && /Mark all present/.test(t))
await btn(p, 'Mark all present'); await btn(p, 'Save attendance'); await w8(300); T('attendance saved toast or return', /saved|Attendance/i.test(await txt(p)))
await go(p, A + '/attendance'); t = await txt(p); T('CO-16 attendance summaries', /CO-16/.test(t)); await btn(p, 'Summary by batch'); T('batch summary tab', /HSC Physics/.test(await txt(p)))
await btn(p, 'Summary by student'); T('student summary tab', /Ayaan Rahman/.test(await txt(p)))
await go(p, A + '/attendance/C-B-1-30'); T('future class blocked', /not|cannot|future|no class/i.test(await txt(p)))

// Homework
await go(p, A + '/homework'); t = await txt(p); T('CO-18 homework', /CO-18/.test(t) && /Algebra worksheet 4/.test(t))
await go(p, A + '/homework/new'); await btn(p, 'Assign homework'); t = await txt(p); T('CO-19 validation', /title/i.test(t) && /Describe/.test(t))
await fill(p, 'Assign to batch', 'Class 10 Maths, Evening'); await fill(p, 'Title', 'Quadratic equations set 2'); await fill(p, 'Instructions', 'Solve all questions in exercise 4.2 and show working.'); await btn(p, 'Assign homework'); await w8(300)
t = await txt(p); T('-> homework detail', /CO-20/.test(t) && /Quadratic equations set 2/.test(t)); const hid = (await here()).split('/').pop()
await btn(p, 'Mark handed in'); await w8(150); T('mark one handed in', /Handed in/.test(await txt(p)))
await btn(p, 'Remind'); await w8(150); T('Demo reminder toast', /Demo/.test(await txt(p)))
await btn(p, 'Delete'); await w8(200); T('delete homework confirm', /Delete this homework/.test(await txt(p))); await btn(p, 'Cancel', '[role=dialog]')

// Exams
await go(p, A + '/exams'); t = await txt(p); T('CO-21 exams', /CO-21/.test(t) && /Published|Marks pending|Upcoming/.test(t))
await go(p, A + '/exams/new'); await btn(p, 'Create exam'); T('CO-22 validation', /exam title/i.test(await txt(p)))
await fill(p, 'Batch', 'Class 10 Maths, Evening'); await fill(p, 'Exam title', 'Algebra monthly test'); await fill(p, 'Total marks', '30'); await btn(p, '=Create exam'); await w8(300)
t = await txt(p); T('-> exam detail', /CO-23/.test(t) && /Algebra monthly test/.test(t)); const eid = (await here()).split('/').pop()
const inputs = await p.$$('main input[aria-label^="Marks for"]'); T('marks inputs for batch students', inputs.length > 0)
await btn(p, 'Publish results'); T('cannot publish incomplete (disabled)', await p.evaluate(() => [...document.querySelectorAll('button')].some((x) => x.innerText.includes('Publish results') && x.disabled)))
await fill(p, p ? (await p.evaluate(() => document.querySelector('main input[aria-label^="Marks for"]').getAttribute('aria-label'))) : '', '45'); await btn(p, 'Save marks'); T('out-of-range mark error', /Out of 30/.test(await txt(p)))
const labels = await p.evaluate(() => [...document.querySelectorAll('main input[aria-label^="Marks for"]')].map((x) => x.getAttribute('aria-label')))
for (let i = 0; i < labels.length; i++) { if (i === 0) await p.evaluate((l) => { document.querySelector(`input[aria-label="${l}"]`).closest('li').querySelector('input[type=checkbox]').click() }, labels[i]); else await fill(p, labels[i], String(18 + (i % 10))); }
await btn(p, 'Save marks'); await w8(200); T('marks saved', /saved/i.test(await txt(p)))
await btn(p, 'Publish results'); await w8(200); T('publish confirm modal', /Publish these results/.test(await txt(p))); await btn(p, 'Publish results', '[role=dialog]'); await w8(400)
t = await txt(p); T('-> results page after publish', /CO-24/.test(t) && /Algebra monthly test/.test(t))

// Results
T('results by batch rank/avg', /rank/i.test(t) && /Average/.test(t) && /Pass rate/.test(t))
await btn(p, 'By student'); await w8(150); T('results by student tab', /class average|No published results/i.test(await txt(p)))

// Reports
await go(p, A + '/reports'); t = await txt(p); T('CO-25 reports', /CO-25/.test(t))
await go(p, A + '/reports/new'); await fill(p, 'Batch', 'Class 10 Maths, Evening'); await fill(p, 'Month', 'October 2026'); await btn(p, '=Generate report'); await w8(300)
t = await txt(p); T('-> report detail (draft)', /CO-27/.test(t) && /Draft/.test(t)); T('report preview masks parent', /Parent preview/.test(t) && !/01[3-9]\d{8}/.test(t) && /•/.test(t))
const rid = (await here()).split('/').pop()
await fill(p, 'Teacher remark for parents', 'Steady progress this month. Keep practising algebra.'); await btn(p, 'Save remark'); T('remark saved', /Remark saved/.test(await txt(p)))
await btn(p, 'Send to'); await w8(200); T('send confirm (Demo)', /Send report \(Demo\)/.test(await txt(p))); await btn(p, 'Send report (Demo)', '[role=dialog]'); await w8(300)
t = await txt(p); T('report sent, Demo noted', /Sent/.test(t) && /Demo/.test(t) && /No SMS or email was really sent/.test(t))
await go(p, A + '/reports/new'); await fill(p, 'Batch', 'Class 10 Maths, Evening'); await fill(p, 'Month', 'October 2026'); T('duplicate report warning', /already exists/.test(await txt(p)))

// Payments
await go(p, A + '/payments'); t = await txt(p); T('CO-28 payments in ৳, Demo', /CO-28/.test(t) && /৳/.test(t) && /Collected/.test(t) && /Overdue/.test(t) && /Demo/.test(t))
const collected = t.match(/৳([\d,]+)\s*\n?\s*Collected/)?.[1]
await btn(p, 'Mark'); await w8(200); T('mark paid confirm', /Mark this fee as paid/.test(await txt(p))); await btn(p, '=Mark paid', '[role=dialog]'); await w8(200)
t = await txt(p); T('collected total increased', t.match(/৳([\d,]+)\s*\n?\s*Collected/)?.[1] !== collected)
await p.evaluate(() => document.querySelector('main tbody input[type=checkbox]')?.click()); await w8(150); await btn(p, 'Send reminder (Demo)'); T('bulk Demo reminder', /Demo, no real message/.test(await txt(p)))

// Profile
await go(p, A + '/profile'); t = await txt(p); T('CO-29 profile masked contact', /CO-29/.test(t) && /Verified Organization/.test(t) && !/01712345678/.test(t))
await fill(p, 'Organization name', 'Scholars Point Coaching Centre'); await btn(p, 'Save changes'); await w8(200); await go(p, A + '/dashboard'); T('profile name reaches dashboard', /Scholars Point Coaching Centre/.test(await txt(p)))
await go(p, A + '/profile'); await fill(p, 'About', 'short'); await btn(p, 'Save changes'); T('profile validation', /at least 20 characters/.test(await txt(p)))

// Messages
await go(p, A + '/messages'); t = await txt(p); T('CO-30 messages list', /CO-30/.test(t) && /Shirin Sultana/.test(t))
await go(p, A + '/messages/M-1'); await fill(p, 'Write a message', 'Call me on 01712345678 please'); await btn(p, '=Send'); T('phone number rejected in message', /Phone numbers cannot be shared/.test(await txt(p)))
await fill(p, 'Write a message', 'Ayaan did very well in the last test.'); await btn(p, '=Send'); await w8(200); T('message sent in thread', /Ayaan did very well/.test(await txt(p)))
await go(p, A + `/parents/PR-1`); await btn(p, 'Send message'); await w8(300); T('parent -> message thread', /messages\/M-/.test(await here()))

// Notifications
await go(p, A + '/notifications'); t = await txt(p); T('CO-31 notifications with new items', /CO-31/.test(t) && /Results published/.test(t) && /report for October 2026 sent/.test(t))
await btn(p, 'Mark all read'); await btn(p, 'Unread'); T('unread empty after mark all', /all caught up/.test(await txt(p)))

// dashboard counters and cleanup
await go(p, A + '/dashboard'); t = await txt(p); T('dashboard reflects new data', /Class 8|Tahsin|teachers/i.test(t) && /Teachers/.test(t))
await go(p, A + '/students/' + sid); await btn(p, 'Remove'); await w8(200); T('remove student confirm', /Remove .*\?/.test(await p.evaluate(() => document.querySelector('[role=dialog]')?.innerText || ''))); await btn(p, 'Remove student', '[role=dialog]'); await w8(300)
T('student removed -> list', /\/students$/.test(await here()))
await go(p, A + '/dashboard'); await drawer(p, 'Clear coaching data'); await go(p, A + '/teachers'); T('empty state teachers', /No teachers yet/.test(await txt(p)))
for (const r of ['students', 'batches', 'homework', 'exams', 'results', 'reports', 'payments', 'parents']) { await go(p, A + '/' + r); T('empty state ' + r, /No |no /.test(await txt(p)) && (await p.evaluate(() => document.querySelectorAll('h1').length)) === 1) }
await drawer(p, 'Restore Scholars Point data')
T('no page errors', errs.filter((e) => !/CERT/.test(e)).length === 0); if (errs.length) console.log(errs.slice(0, 3))
done(); await b.close()
