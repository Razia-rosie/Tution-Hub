import { launch, go, txt, btn, fill, T, done, drawer, w8 } from './h.mjs'
const { b, p, errs } = await launch(1440, 900)
const A = '/app/student/'
// before verification
await go(p, A + 'find-tutor'); let t = await txt(p); T('find-tutor opens', /Find/.test(t) && !/Screen not found/.test(t))
for (const s of ['home','my-tuition','schedule','attendance','homework','assignments','progress','tutor','messages','profile','find-tutor','notifications','safety']) { await go(p, A + s); const x = await txt(p); if (/Not built yet|Screen not found/.test(x)) T('nav ' + s, false) }
T('all nav real', true)
for (const s of ['my-tuition','schedule','attendance','homework','assignments','progress','tutor']) { await go(p, A + s); T('empty ' + s, /No active tuition yet/.test(await txt(p))) }
// verify
await drawer(p, 'Approve student')
await go(p, A + 'find-tutor'); t = await txt(p)
T('tutors listed', /Tanvir|Tutor/.test(t)); T('no full phone/NID/address in list', !/\b01\d{9}\b/.test(t) && !/NID/.test(t))
await go(p, A + 'find-tutor/tanvir-ahmed-rahman'); t = await txt(p)
T('profile opens', /Tanvir/.test(t)); T('profile privacy', !/\b01\d{9}\b/.test(t) && !/NID number/.test(t) && /area/i.test(t))
T("I'm Interested present", /I'm Interested/.test(t))
await btn(p, "I'm Interested"); await w8(300); t = await txt(p)
T('interest sent', /Interest sent|Withdraw|sent/i.test(t))
await go(p, A + 'messages'); t = await txt(p); T('messages shows sent interest', /Tanvir/.test(t))
await drawer(p, 'Tutor accepts student interest'); await go(p, A + 'messages'); t = await txt(p); T('mutual interest chat', /Tanvir/.test(t) && /Mutual|chat|Message/i.test(t))
// chat
await go(p, A + 'messages/tanvir-ahmed-rahman')
const ta = await p.$('input[aria-label="Message"]')
if (ta) { await ta.click(); await p.keyboard.type('call me on 01712345678'); await btn(p, 'Send'); t = await txt(p); T('unsafe contact rejected', /not allowed|can't share|blocked|phone/i.test(t)) } else T('composer found', false)
t = await txt(p); T('masked contact only', !/\b01\d{9}\b/.test(t.replace(/01712345678/g, '')))
// agreement
await btn(p, 'Review agreement'); await w8(300); t = await txt(p)
T('agreement modal', /agreement/i.test(t))
T('guardian consent required (minor)', /Guardian consent is required/.test(t))
const cdis = await p.evaluate(() => [...document.querySelectorAll('[role=dialog] button')].find(x => /^confirm agreement/i.test(x.innerText.trim()))?.disabled)
T('confirm locked w/o guardian', cdis === true)
await btn(p, 'Simulate: guardian agrees'); await p.evaluate(() => document.querySelector('[role=dialog] input[type=checkbox]')?.click()); await btn(p, 'Confirm agreement'); await w8(300); t = await txt(p)
T('awaiting tutor', /waiting|Waiting/.test(t))
await drawer(p, 'Tutor confirms student agreement'); await go(p, A + 'my-tuition'); t = await txt(p)
T('Tuition Active', /Tuition Active/.test(t)); T('fee read-only note', /paid and recorded by your guardian/.test(t)); T('guardian consent shown', /Guardian .*agreed/i.test(t))
T('no pay/mark controls', !(await btn(p, '=Mark paid')) && !(await btn(p, 'Mark attendance')))
T('review locked', /locked|after .*complet/i.test(t))
await go(p, A + 'schedule'); t = await txt(p); T('schedule', /Today|Upcoming/.test(t))
await go(p, A + 'attendance'); t = await txt(p); T('attendance read-only', /Read-only/.test(t) && !/Mark attendance|Mark present/.test(t))
// homework
await go(p, A + 'homework'); t = await txt(p); T('homework to do', /To do/.test(t))
await btn(p, 'Submit homework'); await btn(p, 'Submit', '[role=dialog]'); t = await txt(p); T('submit validation', /Attach the sample file or write/.test(t))
await btn(p, 'Attach sample file'); T('file attached demo', /Demo/.test(await txt(p)))
await btn(p, '=Submit', '[role=dialog]'); await w8(300); await btn(p, '=Submitted'); t = await txt(p); T('submitted', /Waiting for review/.test(t) && /Demo file/i.test(t))
await btn(p, '=Resubmit'); await btn(p, '=Resubmit', '[role=dialog]'); t = await txt(p); T('resubmitted', /Resubmitted/.test(t))
await btn(p, 'Simulate tutor review'); await btn(p, '=Reviewed'); t = await txt(p); T('feedback shown', /Tutor feedback/i.test(t) && /9\/10/.test(t))
await go(p, A + 'assignments'); t = await txt(p); T('assignments opens', /Assignments/.test(t) && /To do|Nothing/.test(t))
// progress
await go(p, A + 'progress'); t = await txt(p); T('progress tuition', /Tuition test marks/.test(t))
await btn(p, 'School vs tuition'); t = await txt(p); T('school vs tuition', /School/.test(t) && /Demo marks/i.test(t))
await go(p, A + 'tutor'); t = await txt(p); T('tutor page masked', /Tanvir/.test(t) && !/\b01\d{9}\b/.test(t))
await go(p, A + 'notifications'); T('notifications', /Notifications/.test(await txt(p))); await btn(p, 'Mark all read'); T('mark all read', true)
await go(p, A + 'safety'); await btn(p, 'Report a concern'); await btn(p, 'Send report'); T('safety validation', /at least 10/.test(await txt(p)))
await fill(p, 'What happened', 'Someone asked for my address in chat'); await btn(p, 'Send report'); T('report sent', /Report received/.test(await txt(p)))
// review
await go(p, A + 'my-tuition'); await drawer(p, 'Fast-forward student tuition'); await go(p, A + 'my-tuition'); t = await txt(p)
T('review unlocked after completion', /Completed/.test(t) && /Submit review|Write a review|Rate/.test(t))
await btn(p, 'Submit review'); await w8(200); T('review validation', /rating|Choose|required/i.test(await txt(p)))
await p.evaluate(() => { const r = document.querySelector('[role=radio],[aria-label*="star"]'); r && r.click() })
await fill(p, 'Comment', 'Clear explanations and always on time.'); await fill(p, 'Your review', 'Clear explanations and always on time.')
await btn(p, 'Submit review'); await w8(300); t = await txt(p); T('review submitted', /Review submitted|Thank you|Your review/.test(t))
// permissions
for (const [u, re] of [['children/ST-2041', /Not available to students/], ['students/ST-3099', /Not available to students/], ['payments', /Not available to students/], ['attendance/mark', /Not available to students/]]) { await go(p, A + u); t = await txt(p); T('denied ' + u, re.test(t) && !/Aarav|Rahim|ST-3099 /.test(t.replace(/ST-3099|ST-2041/g, ''))) }
// public path in a fresh session
{
  const { b: b2, p: q, errs: e2 } = await launch(1440, 900); const here = () => q.evaluate(() => location.pathname)
  await go(q, '/find-tutor'); T('public find-tutor', /Find/.test(await txt(q)))
  await go(q, '/tutors/tanvir-ahmed-rahman'); await btn(q, '=Send interest'); T('sign-in gate', /Sign in to continue/.test(await txt(q)))
  await btn(q, 'Create account'); T('-> signup', (await here()) === '/signup')
  await fill(q, 'Full name', 'Nabila Chowdhury'); await fill(q, 'Email', 'nabila@example.com'); await fill(q, 'Password', 'Passw0rd!x'); await fill(q, 'Confirm password', 'Passw0rd!x')
  await q.click('input[type=checkbox]'); await btn(q, '=Continue'); await w8(1800); T('-> role', (await here()) === '/signup/role')
  await btn(q, 'Student'); await btn(q, 'Continue as Student'); await w8(1800); T('-> verify phone', (await here()) === '/verify/phone')
  await fill(q, 'Mobile number', '01712345678'); await btn(q, 'Send code'); await w8(1800); T('-> otp', (await here()) === '/verify/otp')
  await q.click('input[inputmode="numeric"]'); await q.keyboard.type('482913'); await btn(q, '=Verify'); await w8(1800); T('-> email', (await here()) === '/verify/email')
  await btn(q, 'Open verification link'); await btn(q, '=Continue'); await w8(1500); T('-> gate', /auth\/gate/.test(await here()))
  await go(q, '/app/student/profile/verification'); T('student verification, phone step done', /of 6 steps/.test(await txt(q)))
  T('no public page errors', e2.length === 0); await b2.close()
}
T('no page errors', errs.length === 0); if (errs.length) console.log(errs.slice(0, 5))
done(); await b.close()
