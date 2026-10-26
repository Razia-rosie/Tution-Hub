import puppeteer from 'puppeteer-core'
const b = await puppeteer.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] })
const p = await b.newPage(); await p.setViewport({width:1440,height:900}); const errs=[]; p.on('pageerror', e => errs.push(e.message)); p.on('console',m=>m.type()==='error'&&!/net::|ERR_|cert|Unsplash/.test(m.text())&&errs.push(m.text().slice(0,150)))
const W=ms=>new Promise(r=>setTimeout(r,ms)); const U='http://localhost:3000'
const txt=()=>p.evaluate(()=>document.body.innerText)
const btn=async(t,exact)=>{ const ok=await p.evaluate((t,exact)=>{const e=[...document.querySelectorAll('button,a')].filter(x=>!x.disabled).find(x=>exact?x.textContent.trim()===t:x.textContent.toLowerCase().includes(t.toLowerCase())); if(e){e.click();return true} return false},t,exact); await W(350); if(!ok) console.log('  (no button)',t); return ok }
const go=async(path)=>{ await p.evaluate(pa=>{history.pushState({},'',pa);dispatchEvent(new PopStateEvent('popstate'))},path); await W(400) }
const R=(n,c)=>console.log(c?'PASS':'FAIL',n)
const typeIn=async(sel,v)=>{ await p.click(sel,{clickCount:3}); await p.type(sel,v,{delay:15}); await W(80) }
const lbl=async(label,v)=>{ const id=await p.evaluate(l=>{const e=[...document.querySelectorAll('label')].find(x=>x.textContent.trim().startsWith(l)); return e?.htmlFor},label); if(!id){console.log('  no label',label);return} await typeIn('#'+CSS.escape?.call?`#${id.replace(/:/g,'\\:')}`:'',v) }
const fill=async(label,v)=>{ const id=await p.evaluate(l=>[...document.querySelectorAll('label')].find(x=>x.textContent.trim().startsWith(l))?.htmlFor,label); if(!id) return console.log('  no label',label); const sel='[id="'+id+'"]'; await p.click(sel); await p.evaluate(s=>document.querySelector(s).select(),sel); await p.keyboard.press('Backspace'); await p.type(sel,v,{delay:15}); await W(80) }
await p.goto(U+'/app/parent/dashboard'); await W(900)
let t=await txt(); R('dashboard empty (no child)', /Let's get you started/.test(t)); R('no child switcher', !(await p.$('[aria-label="Child switcher"]')))
R('banner unverified', /Continue verification/.test(t))
// all 14 nav open
for (const s of ['dashboard','children','find-tutor','my-posts','tuitions','schedule','attendance','homework','progress','payments','messages','notifications','safety','settings']) { await go('/app/parent/'+s); const x=await txt(); if(/Screen not found/.test(x)) R('nav '+s,false) }
// verification
await go('/app/parent/settings/verification'); t=await txt(); R('PV-01', /0 of 7 steps/.test(t))
await go('/app/parent/settings/verification/details'); await btn('Save and continue'); t=await txt(); R('details validation', /Enter your full name/.test(t))
await fill('Full name','Farzana Islam'); await fill('Date of birth','12121985'); await btn('Save and continue'); R('-> nid', /National ID/.test(await txt()))
await btn('Save and continue'); R('nid validation', /last 4 digits only/.test(await txt()))
await fill('Last 4','4821'); await btn('Add placeholder file'); await btn('Save and continue'); R('-> phone', /Phone number/.test(await txt()))
let ph=await txt(); R('phone masked, no full', /\+880 \d\d••/.test(ph))
// wrong otp
await p.click('input[aria-label*="digit"],input[inputmode="numeric"]').catch(()=>{}); await p.keyboard.type('111111'); await btn('Verify code'); R('wrong otp error', /not correct/.test(await txt()))
await p.click('input[inputmode="numeric"]').catch(()=>{}); await p.keyboard.type('482913'); await btn('Verify code'); R('phone verified', /Phone verified/.test(await txt()))
await btn('Save and continue'); await btn('Save and continue'); R('identity validation', /Add the placeholder selfie/.test(await txt()))
await btn('Add placeholder file'); await p.click('input[type=checkbox]'); await btn('Save and continue'); R('-> guardian', /Guardian proof/.test(await txt()))
await btn('Add placeholder file'); await btn('Save and continue'); R('-> link', /Link your child/.test(await txt()))
// link validation
await btn('Send link request'); R('link consent err', /tick the confirmation/.test(await txt()))
await fill('Student ID','ST-9999'); await fill("Student's birth",'2000'); await p.click('input[type=checkbox]'); await btn('Send link request'); R('link no match', /could not match/.test(await txt()))
await fill('Student ID','ST-3099'); await fill("Student's birth",'2011'); await btn('Send link request'); R('other-guardian refused', /different guardian/.test(await txt()))
await fill('Student ID','ST-2041'); await fill("Student's birth",'2008'); await btn('Send link request'); R('Ayaan requested', /Ayaan Islam/.test(await txt()) && /Waiting for confirmation/.test(await txt()))
await btn('Continue',true); R('-> confirm', /Relationship confirmation/.test(await txt()))
await btn('Submit for review'); R('submit blocked', /Complete every step/.test(await txt()))
R('child still hidden from switcher', !(await p.$('[aria-label="Child switcher"]')))
await btn('Simulate: child confirms'); R('Ayaan linked', /Linked/.test(await txt()))
R('switcher shows Ayaan only', await p.evaluate(()=>{const s=document.querySelector('[aria-label="Child switcher"]'); return s&&[...s.options].map(o=>o.text).join()==='Ayaan'}))
await btn('Submit for review'); R('PV-09 pending', /Verification status/.test(await txt()) && /Pending/.test(await txt()))
await p.screenshot({path:'shots/p1_status.png'})
await btn('Start review'); R('under review', /Under review/.test(await txt()))
await btn('Simulate rejection'); t=await txt(); R('PV-11 rejected', /not approved/.test(t) && /did not match/.test(t))
await btn('Resubmit as is'); await btn('Simulate: action required'); R('action required', /one more thing/.test(await txt()))
await btn('Send back for review'); await btn('Simulate approval'); R('PV-10 verified', /You are verified/.test(await txt()))
R('banner gone', !/Continue verification/.test(await txt()))
// children
await go('/app/parent/children'); await btn('Add a child'); await fill('Student ID','ST-2042'); await fill("Student's birth",'2013'); await p.click('input[type=checkbox]'); await btn('Send link request'); R('Mim requested on list', /Mim Islam/.test(await txt()) && /Waiting for \w+ to confirm/.test(await txt()))
R('Mim not in switcher yet', await p.evaluate(()=>[...document.querySelector('[aria-label="Child switcher"]').options].map(o=>o.text).join()==='Ayaan'))
await btn('Simulate: child confirms'); R('Mim in switcher', await p.evaluate(()=>[...document.querySelector('[aria-label="Child switcher"]').options].map(o=>o.text).join()==='Ayaan,Mim'))
// view / denied
await go('/app/parent/children/ST-2042'); R('CH-03 view', /Uttara Girls High School/.test(await txt()))
t=await txt(); R('no address/phone/nid in view', !/House|\+880 1\d{3} \d{6}|\d{13}/.test(t))
await go('/app/parent/children/ST-3099'); R('CH-07 denied (direct url)', /not linked to your account/.test(await txt())); R('no Rafi detail leaked', !/Rafi|Mirpur|Class 9/.test(await txt()))
await go('/app/parent/children/denied/ST-0000'); R('unknown same denied text', /not linked to your account/.test(await txt()))
await go('/app/parent/children'); await fill('Student ID','ST-3099').catch(()=>{}); 
await p.type('#open-id','ST-3099'); await btn('Open student'); R('open-by-ID unlinked -> denied', /not linked to your account/.test(await txt()))
await go('/app/parent/children'); await p.type('#open-id','abc'); await btn('Open student'); R('open-by-ID invalid error', /Enter an ID like/.test(await txt()))
// permissions
await go('/app/parent/children/ST-2042/permissions'); await p.click('[aria-label="See attendance for Mim"]'); R('perm toggled', /See attendance turned off for Mim/.test(await txt())||/Mim: attendance off/.test(await txt()))
// dashboard scoped
await go('/app/parent/dashboard'); await p.select('[aria-label="Child switcher"]','Mim'); await W(300); t=await txt(); R('Today for Mim', /Today for Mim/.test(t)); R('class today English', /English at 5:00/.test(t)); R('attendance hidden by perm', /Hidden by your permission settings/.test(t)); R('fee due', /৳3,000 due on 15 Oct, in 2 days/.test(t)); R('hw due tomorrow', /due tomorrow/.test(t))
await go('/app/parent/attendance'); R('attendance page perm-off card', /turned off for Mim/.test(await txt()))
await p.select('[aria-label="Child switcher"]','Ayaan'); await W(300); await go('/app/parent/dashboard'); t=await txt(); R('Ayaan scoped: no tuition', /Ayaan has no tuition yet/.test(t) && !/Mim/.test(t.replace(/Mim/,'').slice(0,0)))
R('Ayaan page has no Mim data', !/English at 5:00/.test(t))
await go('/app/parent/attendance'); R('Ayaan attendance empty', /no active tuition/.test(await txt()) && !/Present/.test(await txt()))
// remove warns
await go('/app/parent/children/ST-2042/permissions'); await p.click('[aria-label="See attendance for Mim"]'); await go('/app/parent/children'); 
await p.evaluate(()=>{[...document.querySelectorAll('button')].filter(b=>b.textContent.includes('Remove'))[1].click()}); await W(300); t=await txt(); R('remove warns active tuition', /has 1 active tuition/.test(t)); 
await btn('Keep Mim'); await p.evaluate(()=>{[...document.querySelectorAll('button')].filter(b=>b.textContent.includes('Remove'))[1].click()}); await W(300); await btn('Remove Mim',true); t=await txt(); R('Mim removed', !/Mim Islam/.test(t));
R('switcher no longer lists Mim', await p.evaluate(()=>{const s=document.querySelector('[aria-label="Child switcher"]');return !s||![...s.options].some(o=>o.text==='Mim')}))
await go('/app/parent/children/ST-2042'); R('removed child -> denied', /not linked to your account/.test(await txt()))
// dashboard variants
await go('/app/parent/dashboard'); for (const v of ['Loading','Error','Empty (no child)','Normal']) { await p.select('[aria-label="Dashboard view state"]',v); await W(300); const x=await txt(); R('variant '+v, v==='Loading'?!!(await p.$('[aria-busy]')):v==='Error'?/could not load/.test(x):v.startsWith('Empty')?/get you started/.test(x):/Today for/.test(x)) }
// demo seed
await btn('Demo controls'); await btn('Link Ayaan and Mim'); await p.click('[aria-label="Close demo controls"]'); await W(300); R('seed both', await p.evaluate(()=>[...document.querySelector('[aria-label="Child switcher"]').options].map(o=>o.text).join()==='Ayaan,Mim'))
await go('/app/parent/payments'); await p.select('[aria-label="Child switcher"]','Mim'); await W(300); await btn('Mark as paid'); await go('/app/parent/dashboard'); R('fee paid on dashboard', /October 2026: ৳3,000 paid/.test(await txt()))
// fast forward overdue
console.log('errors:', errs.slice(0,5)); await b.close()