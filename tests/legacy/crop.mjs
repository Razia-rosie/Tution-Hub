import {launch,go,drawer,w8} from './h.mjs'
const {b,p}=await launch(390,844)
await drawer(p,'=Simulate approval'); await drawer(p,'Link Ayaan and Mim')
await go(p,'/app/parent/find-tutor/tanvir-ahmed-rahman'); await w8(400)
await p.evaluate(()=>{window.scrollTo(0,520)}); await w8(300)
await p.screenshot({path:'shots/crop.png'}); await b.close()
