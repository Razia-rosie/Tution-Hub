import {launch,go,btn,drawer,w8} from './h.mjs'
const [,, w='390', ...routes]=process.argv
const {b,p}=await launch(+w,844)
await drawer(p,'=Simulate approval'); await drawer(p,'Link Ayaan and Mim')
await go(p,'/app/parent/find-tutor'); await w8(500); await p.evaluate(()=>{[...document.querySelectorAll('button,label')].filter(x=>x.innerText.trim()==='Compare').slice(0,3).forEach(x=>x.click())}); await w8(200)
for(const r of routes){await go(p,'/app/parent/'+r); await w8(300); await p.screenshot({path:`shots/${w}-${r.replace(/\W/g,'_')}.png`,fullPage:true})}
await b.close()
