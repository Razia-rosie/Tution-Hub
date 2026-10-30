import puppeteer from 'puppeteer-core'
export const URL='http://localhost:3000'
export async function launch(w=1440,h=900){
  const b=await puppeteer.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']})
  const p=await b.newPage(); await p.setViewport({width:w,height:h})
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)))
  p.on('console',m=>{if(m.type()==='error'&&!/Source data|resolution/.test(m.text()))errs.push(m.text())})
  await p.goto(URL+'/app/parent/dashboard',{waitUntil:'networkidle0'}); await w8(300)
  return {b,p,errs}
}
export const w8=ms=>new Promise(r=>setTimeout(r,ms))
export const go=async(p,path)=>{await p.evaluate(x=>{history.pushState({},'',x);dispatchEvent(new PopStateEvent('popstate'))},path);await w8(250)}
export const txt=p=>p.evaluate(()=>document.body.innerText)
export const btn=async(p,t,scope='body')=>{const ok=await p.evaluate((t,sc)=>{const r=document.querySelector(sc)||document;const e=[...r.querySelectorAll('button,a,[role=tab],label')].find(x=>!x.disabled&&x.offsetParent&&(t[0]==='='?(x.innerText.trim()||x.getAttribute('aria-label')||'').toLowerCase()===t.slice(1).toLowerCase():(x.innerText.trim()||x.getAttribute('aria-label')||'').toLowerCase().includes(t.toLowerCase())));if(e){e.click();return true}return false},t,scope);await w8(200);return ok}
export const fill=async(p,label,v)=>{const ok=await p.evaluate((l,v)=>{const lb=[...document.querySelectorAll('label')].find(x=>x.innerText.trim().toLowerCase().startsWith(l.toLowerCase()));const el=(lb&&document.getElementById(lb.htmlFor))||document.querySelector(`[aria-label="${l}"]`);if(!el)return false;const proto=el.tagName==='TEXTAREA'?HTMLTextAreaElement:el.tagName==='SELECT'?HTMLSelectElement:HTMLInputElement;Object.getOwnPropertyDescriptor(proto.prototype,'value').set.call(el,v);el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));return true},label,v);await w8(120);return ok}
let pass=0,fail=0
export const T=(name,c)=>{if(c){pass++;console.log('PASS',name)}else{fail++;console.log('FAIL',name)}}
export const done=()=>{console.log(`\n${pass} pass, ${fail} fail`)}
export const drawer=async(p,t)=>{await btn(p,'Demo controls');await w8(250);const ok=await btn(p,t,'[role=dialog][aria-label="Demo controls"]');await p.click('[aria-label="Close demo controls"]');await w8(250);return ok}
