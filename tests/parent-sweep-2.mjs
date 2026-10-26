import {launch,go,txt,btn,drawer,w8} from './h.mjs'
const A='/app/parent'
const routes=['dashboard','find-tutor','find-tutor/compare','find-tutor/tanvir-ahmed-rahman','my-posts','my-posts/new','my-posts/manage','my-posts/published','messages','messages/tanvir-ahmed-rahman','tuitions','progress','attendance']
for(const w of [1440,1035,390]){
  const {b,p,errs}=await launch(w,w===390?844:816)
  await drawer(p,'=Simulate approval'); await drawer(p,'Link Ayaan and Mim')
  await go(p,A+'/my-posts/new'); await btn(p,'Preview post'); await btn(p,'Publish post')
  await go(p,A+'/find-tutor'); await p.evaluate(()=>{[...document.querySelectorAll('button,label')].filter(x=>x.innerText.trim()==='Compare').slice(0,3).forEach(x=>x.click())})
  await go(p,A+'/messages'); await btn(p,'Interest'); await btn(p,'Accept'); await w8(200)
  const bad=[]
  for(const r of routes){await go(p,A+'/'+r); await w8(600)
    const o=await p.evaluate(()=>({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,len:document.body.innerText.length,main:document.querySelector('main')?.innerText.length||0,h1:document.querySelectorAll('h1').length}))
    if(o.sw>o.cw+1||o.main<60||o.h1!==1)bad.push(`${r}: ${JSON.stringify(o)}`)}
  console.log(w,bad.length?bad:'ok',errs.length?errs.slice(0,3):'')
  await b.close()}
