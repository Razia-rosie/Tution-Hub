import { useState } from 'react'
import { Link } from 'react-router'
import { Bell, CheckCircle2, Flag, Lock, ShieldCheck } from 'lucide-react'
import { PageHead } from '../../components/tutor/bits'
import { Button, Card, Chip, DemoTag, EmptyState, Field, Textarea } from '../../components/ui'
import { attendanceStats, classesFor, hwFor } from '../../lib/parent'
import { studentKid } from '../../lib/student'
import { useStore } from '../../lib/store'

const A = '/app/student'

export function Notifications() {
  const s = useStore(); const kid = studentKid(s.sj); const kj = s.sj.kj; const read = s.sj.read; const off = s.dayOffset
  const items: { id: string; t: string; to: string }[] = [
    s.verification.student === 'verified' ? { id: 'v', t: 'You are verified. You can send interest and chat.', to: `${A}/find-tutor` } : { id: 'v', t: 'Finish student verification to send interest and chat.', to: `${A}/profile/verification` },
  ]
  if (Object.values(kj.incoming).includes('received')) items.push({ id: 'inc', t: 'A tutor sent you interest. Accept or decline.', to: `${A}/messages` })
  if (Object.values(kj.sent).includes('mutual') && kj.stage === 'none') items.push({ id: 'mut', t: 'Mutual interest. Your chat is open.', to: `${A}/messages` })
  if (kj.stage === 'agreement') items.push({ id: 'agr', t: 'You confirmed the agreement. Waiting for your tutor.', to: `${A}/messages` })
  if (kid.tuition) {
    const hw = hwFor(kid, off).filter((h) => h.state === 'assigned' && !s.sj.subs[h.id])
    if (hw[0]) items.push({ id: 'hw', t: `Homework to do: ${hw[0].title}.`, to: `${A}/${hw[0].kind === 'Homework' ? 'homework' : 'assignments'}` })
    if (classesFor(kid, off).some((c) => c.day === off)) items.push({ id: 'cl', t: 'You have a class today.', to: `${A}/schedule` })
    if (attendanceStats(kid, off).total) items.push({ id: 'att', t: 'Attendance was updated after your last class.', to: `${A}/attendance` })
    if (kj.stage === 'completed' && !kj.review) items.push({ id: 'rev', t: 'Your tuition is complete. Review your tutor.', to: `${A}/my-tuition` })
  }
  const mark = (id: string) => s.setSJ((p) => ({ read: p.read.includes(id) ? p.read : [...p.read, id] }))
  return (
    <div><PageHead title="Notifications" tag="NOT-S" sub="Only about you and your tuition." actions={<Button variant="secondary" size="sm" disabled={items.every((i) => read.includes(i.id))} onClick={() => s.setSJ(() => ({ read: items.map((i) => i.id) }))}>Mark all read</Button>} />
      {items.length === 0 ? <Card><EmptyState title="All caught up" body="New updates will appear here." /></Card> : (
        <Card pad={false}><ul className="divide-y divide-gray-100">{items.map((i) => <li key={i.id}><Link to={i.to} onClick={() => mark(i.id)} className="flex items-center gap-3 p-4 text-sm hover:bg-offwhite-50"><Bell size={18} className={read.includes(i.id) ? 'text-gray-400' : 'text-blue-600'} aria-hidden /><span className={read.includes(i.id) ? 'flex-1 text-gray-600' : 'flex-1 font-semibold text-navy-900'}>{i.t}</span>{!read.includes(i.id) && <Chip tone="blue">New</Chip>}</Link></li>)}</ul></Card>)}
    </div>
  )
}

export function Safety() {
  const s = useStore(); const [open, setOpen] = useState(false); const [txt, setTxt] = useState(''); const [t, setT] = useState(false); const [sent, setSent] = useState(false)
  const bad = txt.trim().length < 10
  return (
    <div><PageHead title="Safety" tag="SAF-S" sub="How TuitionHub keeps you safe, and what to do if something feels wrong." />
      <div className="grid gap-4 md:grid-cols-2">
        {[['Verified tutors only', 'Only tutors with an Identity Verified badge can contact you.'], ['Keep details private', 'Never share your phone, address or school ID in chat. Messages with numbers are blocked.'], ['Tell a trusted adult', 'Your guardian agrees to every tuition. Tell them if anything feels odd.'], ['Meet safely', 'For the first class, be at home with a family member nearby, or use online class.']].map(([h, b]) => <Card key={h}><h2 className="flex items-center gap-2 text-base"><ShieldCheck size={16} className="text-teal-700" aria-hidden />{h}</h2><p className="mt-1 text-sm text-gray-600">{b}</p></Card>)}
      </div>
      <Card className="mt-6"><h2 className="text-lg">Report a concern</h2>
        {sent ? <p className="mt-2 flex items-center gap-2 text-sm text-navy-900"><CheckCircle2 size={18} className="text-emerald-600" aria-hidden />Report received. A safety reviewer will look at it. <DemoTag /></p> : open ? (
          <form className="mt-3 space-y-3" onSubmit={(e) => { e.preventDefault(); setT(true); if (!bad) { setSent(true); s.toast('Report sent (demo)', 'success') } }} noValidate>
            <Field label="What happened?" error={t && bad ? 'Please write at least 10 characters.' : ''}>{(id) => <Textarea id={id} value={txt} onChange={(e) => setTxt(e.target.value)} />}</Field>
            <div className="flex gap-2"><Button type="submit">Send report</Button><Button variant="tertiary" onClick={() => setOpen(false)}>Cancel</Button></div></form>
        ) : <Button className="mt-3" variant="secondary" icon={<Flag size={15} />} onClick={() => setOpen(true)}>Report a concern</Button>}
        <p className="mt-3 text-xs text-gray-600">In an emergency call 999. This prototype has no live safety team.</p></Card>
    </div>
  )
}

export function NotForStudents({ what }: { what: string }) {
  return <div><PageHead title="Not available to students" tag="PERM-S" /><Card className="flex flex-wrap items-center gap-3"><Lock size={20} className="text-gray-600" aria-hidden /><div className="min-w-0 flex-1"><p className="font-semibold text-navy-900">{what}</p><p className="text-sm text-gray-600">Students only see their own data. Other students, attendance marking and payments are not available to your account.</p></div><Link to={`${A}/home`} className="text-sm font-semibold text-blue-600 hover:underline">Back to home</Link></Card></div>
}
