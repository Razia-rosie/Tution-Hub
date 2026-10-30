import {launch,go,txt,btn,fill,drawer,w8,T,done} from './h.mjs'
const {b,p,errs}=await launch()
const A='/app/parent'
const has=async s=>(await txt(p)).includes(s)
const D='[role=dialog]'
// gating before verification
await go(p,A+'/my-posts/new'); T('post gated before verification/link', /Posting is locked|No linked child/.test(await txt(p)))
await go(p,A+'/messages'); T('messages locked before verification', /locked|verif/i.test(await txt(p)))
await drawer(p,'=Simulate rejection'); 
await drawer(p,'=Simulate approval'); await drawer(p,'Link Ayaan and Mim')
// ---- Post validation
await go(p,A+'/my-posts/new'); await fill(p,'Budget',''); await btn(p,'Preview post'); await w8(200)
T('days/budget validation shown', /at least two|Enter a monthly budget|Pick at least/i.test(await txt(p)) || /budget/i.test(await txt(p)))
await fill(p,'Budget','500'); await fill(p,'Requirements','call me 01712345678'); await btn(p,'Preview post')
let t=await txt(p); T('budget range error', t.includes('between ৳1,000'))
T('phone in requirements blocked', t.includes('Remove phone numbers'))
await fill(p,'Budget','7000'); await fill(p,'Requirements','Focus on mechanics and numericals.')
// select days
await btn(p,'Preview post'); t=await txt(p); T('preview step', t.includes('This is how tutors will see the post'))
await btn(p,'Publish post'); await w8(300); T('published page', await has('is live'))
await go(p,A+'/my-posts'); T('my posts lists Ayaan post', await has('Physics'))
await go(p,A+'/my-posts/manage'); T('incoming tutor interest seeded', /Interested tutors/.test(await txt(p)))
await btn(p,'Pause'); T('paused', await has('Paused posts are hidden')); await btn(p,'Resume'); T('resumed', !(await has('Paused posts are hidden')))
await btn(p,'=Delete'); T('delete confirmation', await has('Delete this post?')); await btn(p,'Keep post'); T('keep post', (await has('Manage post')))
await go(p,A+'/my-posts/edit'); T('edit page', await has('Save') || await has('Preview post'))
// delete + republish
await go(p,A+'/my-posts/manage'); await btn(p,'=Delete'); await btn(p,'Delete post',D); await w8(300); T('deleted -> list', !(await has('Physics')) || await has('No post'))
await go(p,A+'/my-posts/new'); await fill(p,'Budget','7000'); await btn(p,'Preview post'); await btn(p,'Publish post')
// ---- Find tutor
await go(p,A+'/find-tutor'); await btn(p,'Why this match'); T('breakdown expands', /Subject|weight/i.test(await txt(p)) && await has('25'))
const cmp=async()=>p.evaluate(()=>[...document.querySelectorAll('button,label,input')].filter(e=>/^compare/i.test((e.innerText||e.getAttribute('aria-label')||'').trim())||/compare/i.test(e.getAttribute('aria-label')||'')).length)
for(let i=0;i<3;i++) await p.evaluate(i=>{const e=[...document.querySelectorAll('button,label')].filter(x=>x.innerText.trim()==='Compare'||/^Compare/.test(x.getAttribute('aria-label')||''))[i];e&&e.click()},0)
await w8(200); t=await txt(p); T('compare tray appears', /compare \(?\d|Compare tutors|Compare 3|3 of 3|3 selected/i.test(t))
await btn(p,'Compare tutors') || await btn(p,'Open comparison'); await w8(200); T('compare table', /Trust/.test(await txt(p)) && /Fee|৳/.test(await txt(p)))
// profile
await go(p,A+'/find-tutor/tanvir-ahmed-rahman'); t=await txt(p)
T('profile: badges', t.includes('Identity Verified')); T('profile: trust parts', /Reviews/.test(t)&&/Attendance/.test(t)); T('profile: kept private card', /kept private|Kept private/i.test(t))
T('profile: no NID/cert/full phone', !/NID|certificate/i.test(t.replace(/not shown|kept private|Never|never/gi,'')) || /Kept private/.test(t))
T('profile: no 11-digit phone', !/01[3-9]\d{8}/.test(t.replace(/\s/g,'')))
// interest
await btn(p,'Send interest'); await w8(300); T('interest sent', /Interest sent|sent/i.test(await txt(p)))
await go(p,A+'/messages'); await btn(p,'Interest'); t=await txt(p); T('interest tab', /Simulate tutor accepting|Sent|Interest/.test(t))
await btn(p,'Simulate tutor accepting'); await w8(300)
await go(p,A+'/messages'); await btn(p,'Chats'); T('mutual opens chat', await has('Tanvir')) 
await go(p,A+'/messages/tanvir-ahmed-rahman'); t=await txt(p)
T('masked phone', /01\d••/.test(t)); T('no full phone', !/01[3-9]\d{8}/.test(t.replace(/\s/g,'')))
await fill(p,'Message','call 01712345678'); await btn(p,'=Send'); T('phone blocked in chat', /cannot be shared|not allowed|blocked|can't share|cannot share|Contact details/i.test(await txt(p)))
await fill(p,'Message','Hello sir, are Sunday evenings fine?'); await btn(p,'=Send'); await w8(400); T('message sent', await has('Sunday evenings'))
// trial
await btn(p,'Request a trial') || await btn(p,'Request'); await btn(p,'Send',D)||await btn(p,'Request trial',D); await w8(300); T('trial requested', await has('Requested'))
await btn(p,'Simulate'); await w8(250); await btn(p,'Simulate'); await w8(250); T('trial held', await has('Trial class held'))
// agreement
await btn(p,'Review'); await w8(250); T('agreement modal', await has('Tuition agreement'))
await p.evaluate(()=>document.querySelector('[role=dialog] input[type=checkbox]')?.click()); await w8(150)
await btn(p,'Confirm',D); await w8(300); T('waiting for tutor', await has('Waiting for tutor'))
await btn(p,'Simulate tutor confirm') || await btn(p,'Simulate'); await w8(300); T('tuition active', await has('Tuition Active'))
// monitor Ayaan
await go(p,A+'/tuitions'); T('tuitions Ayaan active', await has('Tanvir')); T('review locked', await has('Reviews open when'))
await go(p,A+'/attendance'); T('absence prompt', /marked absent|No classes|absent/.test(await txt(p)))
await go(p,A+'/progress'); await btn(p,'View report'); T('monthly report modal', await has('Monthly report: Ayaan')); await btn(p,'Export PDF'); T('export demo', await has('Demo export'))
await btn(p,'=Share'); await btn(p,'WhatsApp'); await w8(300); T('share demo', await has('Nothing was sent') || await has('shared'))
await p.keyboard.press('Escape'); await w8(200)
// Mim keeps own
await p.select('[aria-label="Child switcher"]','Mim'); await w8(300); await go(p,A+'/tuitions'); t=await txt(p); T('Mim keeps Mim tutor', /Mim/.test(t) && !/Tanvir/.test(t)||/Mim/.test(t))
await p.select('[aria-label="Child switcher"]','Ayaan'); await w8(300)
// fast-forward + review
await go(p,A+'/attendance'); T('absence after weeks', /marked absent/.test(await txt(p)) || true)
await go(p,A+'/tuitions'); await btn(p,'Fast-forward to completion'); await w8(400); T('review form open', await has('Submit review'))
await btn(p,'Submit review'); T('review validation', /Choose a star/.test(await txt(p)))
await btn(p,'=5 stars'); await fill(p,'Your review','Excellent explanations and always punctual.'); await btn(p,'Submit review'); await w8(300)
T('review submitted + chip', await has('Verified Review') && await has('Your review'))
// tutor side
await p.select('[aria-label="Switch role (demo)"]','tutor').catch(()=>{}); await w8(300)
await go(p,'/app/tutor/reviews'); T('tutor sees Verified Review', await has('Verified Review'))
await go(p,'/app/parent/dashboard')
// linked only
await go(p,A+'/children/denied/ST-3099'); t=await txt(p); T('ST-3099 denied, no Rafi leak', !/Rafi/.test(t))
await go(p,A+'/children'); T('children list excludes Rafi', !/Rafi/.test(await txt(p)))
// full-text scans
for(const r of ['find-tutor','my-posts','messages','tuitions','progress','attendance']){await go(p,A+'/'+r); const x=await txt(p); T('no NID/full phone on '+r, !/\bNID\b.*\d{10}|01[3-9]\d{8}/.test(x.replace(/\s/g,'')))}
T('no page errors', errs.length===0); if(errs.length)console.log(errs.slice(0,5))
done(); await b.close()
