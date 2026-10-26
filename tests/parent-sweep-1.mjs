import puppeteer from 'puppeteer-core'
const b = await puppeteer.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] })
const W=ms=>new Promise(r=>setTimeout(r,ms)); const U='http://localhost:3000'
const routes=['dashboard','children','children/add','children/ST-2042','children/ST-2042/permissions','children/denied/ST-3099','find-tutor','my-posts','tuitions','schedule','attendance','homework','progress','payments','messages','notifications','safety','settings','settings/verification','settings/verification/details','settings/verification/nid','settings/verification/phone','settings/verification/identity','settings/verification/guardian','settings/verification/link','settings/verification/confirm','settings/verification/status']
for (const w of [1440,1035,390]) {
  const p = await b.newPage(); await p.setViewport({width:w,height:816}); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>m.type()==='error'&&!/net::|ERR_|cert|Unsplash/.test(m.text())&&errs.push(m.text().slice(0,140)))
  const go=async(path)=>{ await p.evaluate(pa=>{history.pushState({},'',pa);dispatchEvent(new PopStateEvent('popstate'))},path); await W(350) }
  const btn=async(t)=>{ await p.evaluate(t=>{[...document.querySelectorAll('button')].find(x=>!x.disabled&&x.textContent.includes(t))?.click()},t); await W(300) }
  await p.goto(U+'/app/parent/dashboard',{waitUntil:'networkidle0'}); await W(500)
  await btn('Demo controls'); await btn('Link Ayaan and Mim'); await btn('+7 days').catch(()=>{}); await p.click('[aria-label="Close demo controls"]'); await W(300)
  await p.select('[aria-label="Child switcher"]','Mim'); await W(200)
  const states=[['dashboard',''],...routes.map(r=>[r,''])]
  for (const [r] of states) { await go('/app/parent/'+r); const m=await p.evaluate(()=>({sw:document.documentElement.scrollWidth,main:document.querySelector('main')?.getBoundingClientRect().height|0,h1:document.querySelector('h1')?.textContent?.slice(0,30)}))
    if (m.sw>w||!m.h1||m.main<150) console.log('PROBLEM',w,r,JSON.stringify(m)); if(r==='dashboard') await p.screenshot({path:`shots/p1_${w}_dash.png`}); if(w!==1440&&['children','children/ST-2042/permissions','settings/verification/confirm'].includes(r)) await p.screenshot({path:`shots/p1_${w}_${r.replace(/\//g,'_')}.png`}) }
  await go('/app/parent/payments'); console.log(w,'overdue(+7d):',/Overdue/.test(await p.evaluate(()=>document.body.innerText)))
  await go('/app/parent/dashboard'); await p.screenshot({path:`shots/p1_${w}_dash_over.png`})
  console.log(w,'errors',errs.slice(0,4))
}
await b.close()