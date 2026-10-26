import { useState } from 'react'
import { Link } from 'react-router'
import { MapPin, PauseCircle, PlayCircle } from 'lucide-react'
import { AGREEMENT, JOURNEY_POST, allClasses, stats } from '../../lib/journey'
import { useStore } from '../../lib/store'
import { Avatar, Button, Card, Chip, EmptyState, Field, Modal, Select, Tabs } from '../../components/ui'
import { LockChip, PageHead, StatLink } from '../../components/tutor/bits'
import { BookOpenCheck, CalendarClock, CheckSquare } from 'lucide-react'
import { RevealModal } from './Tuition'

const A = '/app/tutor'
export default function Students({ sub }: { sub: string }) {
  const s = useStore(); const j = s.journey; const has = j.tuition === 'active' || j.tuition === 'completed'
  if (sub === 'ayaan' && has) return <Detail />
  return (
    <div>
      <PageHead title="My Students" tag="ACT-01" sub="Students you teach, with their schedule, homework and progress." />
      {j.tuition === 'cancelled' && <Card className="mb-5 border-warning-600/40 bg-warning-100/60"><p className="font-semibold text-navy-900">Tuition cancelled (ACT-03)</p><p className="mt-1 text-sm text-gray-600">The guardian has been told{j.cancelReason ? ` (${j.cancelReason})` : ''}. Your slot is open again, so you can find a replacement.</p><Link to={`${A}/find-tuition`} className="mt-3 inline-block text-sm font-semibold text-blue-600 hover:underline">Find replacement tuition</Link></Card>}
      {!has ? <Card><EmptyState title="No students yet" body="After you and a guardian confirm an agreement, the student appears here with everything for the tuition." action={<Link to={`${A}/messages`} className="text-sm font-semibold text-blue-600 hover:underline">Open messages</Link>} /></Card>
        : <Link to={`${A}/my-students/ayaan`} className="flex flex-wrap items-center gap-4 rounded-card border border-gray-200 bg-white p-6 shadow-card hover:border-blue-600">
          <Avatar name="Ayaan Rahman" size={52} /><div className="min-w-0 flex-1"><p className="font-heading text-lg font-bold text-navy-900">Ayaan Rahman</p><p className="text-sm text-gray-600">{AGREEMENT.subject}, {AGREEMENT.cls} · {AGREEMENT.days} · {AGREEMENT.time}</p></div>
          <Chip tone={j.tuition === 'completed' ? 'gray' : j.paused ? 'amber' : 'green'}>{j.tuition === 'completed' ? 'Completed' : j.paused ? 'Paused' : 'Active'}</Chip></Link>}
    </div>
  )
}

function Detail() {
  const s = useStore(); const j = s.journey; const st = stats(j, s.dayOffset); const [tab, setTab] = useState('Overview'); const [m, setM] = useState<'complete' | 'cancel' | null>(null); const [why, setWhy] = useState('Student moved away'); const [rev, setRev] = useState(false)
  const done = j.tuition === 'completed'; const next = allClasses(j).filter((c) => c.day >= s.dayOffset && !j.marks[c.id]).slice(0, 3)
  return (
    <div>
      <PageHead title="Ayaan Rahman" tag="ACT-01" crumb={{ to: `${A}/my-students`, label: 'My Students' }} sub={`${AGREEMENT.subject}, ${AGREEMENT.cls} · guardian ${AGREEMENT.parent}`}
        actions={<><Chip tone={done ? 'gray' : j.paused ? 'amber' : 'green'}>{done ? 'Completed' : j.paused ? 'Paused' : 'Active'}</Chip>
          {!done && <><Button size="sm" variant="secondary" icon={j.paused ? <PlayCircle size={14} /> : <PauseCircle size={14} />} onClick={() => { s.setJourney((x) => ({ paused: !x.paused })); s.toast(j.paused ? 'Tuition resumed' : 'Tuition paused. The guardian is told.', 'info') }}>{j.paused ? 'Resume' : 'Pause'}</Button>
            <Button size="sm" onClick={() => setM('complete')}>Mark complete</Button><Button size="sm" variant="tertiary" onClick={() => setM('cancel')}>Cancel tuition</Button></>}</>} />
      {j.paused && !done && <Card className="mb-5 bg-warning-100/60"><p className="text-sm text-gray-600">Tuition is paused. No classes are expected until you resume.</p></Card>}
      <Tabs tabs={['Overview', 'Classes', 'Homework', 'Progress']} value={tab} onChange={setTab} />
      <div className="mt-5">
        {tab === 'Overview' && <div className="grid gap-6 lg:grid-cols-2">
          <Card><h2 className="text-lg">Agreement</h2><dl className="mt-3 space-y-2 text-sm">{[['Fee', `৳${AGREEMENT.salary.toLocaleString('en-IN')}/mo`], ['Days', AGREEMENT.days], ['Time', AGREEMENT.time], ['Started', AGREEMENT.start]].map(([k, v]) => <div key={k} className="flex justify-between"><dt className="text-gray-600">{k}</dt><dd className="font-semibold text-navy-900">{v}</dd></div>)}</dl><Link to={`${A}/messages/${JOURNEY_POST}/agreement`} className="mt-3 inline-block text-sm font-semibold text-blue-600 hover:underline">View agreement</Link></Card>
          <Card><h2 className="flex items-center gap-2 text-lg"><MapPin size={18} aria-hidden /> Address</h2>
            {j.addressRevealed ? <p className="mt-3 text-sm"><b className="text-navy-900">House 14, Road 7, Sector 11, Uttara, Dhaka</b><br /><span className="text-xs text-gray-600">DEMO address, view logged.</span></p> : <><p className="mt-2 text-sm text-gray-600">Area only: Uttara. Reveal the exact address when you are ready to travel. It is logged.</p><div className="mt-3"><Button size="sm" onClick={() => setRev(true)} disabled={done}>Reveal exact address</Button></div></>}
            <p className="mt-3 text-xs text-gray-600"><LockChip>Tutor only</LockChip></p></Card>
        </div>}
        {tab === 'Classes' && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><StatLink to={`${A}/schedule`} label="Upcoming classes" value={String(st.upcoming)} sub="Open Schedule" icon={<CalendarClock size={20} />} /><StatLink to={`${A}/attendance`} label="Attendance" value={st.counted ? `${st.attendancePct}%` : '—'} sub={st.unmarked ? `${st.unmarked} to mark` : 'Open Attendance'} icon={<CheckSquare size={20} />} />
          {next.length > 0 && <Card><h2 className="text-base">Next up</h2><ul className="mt-2 space-y-1 text-sm text-gray-600">{next.map((c) => <li key={c.id}>{c.label} · {c.time}</li>)}</ul></Card>}</div>}
        {tab === 'Homework' && <div className="grid gap-4 sm:grid-cols-2"><StatLink to={`${A}/homework`} label="Homework items" value={String(j.hw.filter((h) => h.kind === 'Homework').length)} sub="Open Homework" icon={<BookOpenCheck size={20} />} /><StatLink to={`${A}/assignments`} label="Assignments" value={String(j.hw.filter((h) => h.kind === 'Assignment').length)} sub="Open Assignments" icon={<BookOpenCheck size={20} />} /></div>}
        {tab === 'Progress' && <Card><p className="text-sm text-gray-600">Attendance {st.counted ? `${st.attendancePct}%` : 'not started'} · test marks {j.testMarks.join(', ') || 'none yet'}.</p><Link to={`${A}/progress`} className="mt-2 inline-block text-sm font-semibold text-blue-600 hover:underline">Open full progress</Link></Card>}
      </div>
      <Modal open={m === 'complete'} onClose={() => setM(null)} title="Mark this tuition complete? (ACT-02)" footer={<><Button variant="secondary" onClick={() => setM(null)}>Not yet</Button><Button onClick={() => { s.completeTuition(); setM(null); s.toast('Tuition completed. The guardian review arrived (Demo).', 'success') }}>Mark complete</Button></>}><p className="text-sm text-gray-600">Remaining classes are recorded as held and the guardian is asked for a review. Demo: the review arrives immediately and time moves ahead 60 days.</p></Modal>
      <Modal open={m === 'cancel'} onClose={() => setM(null)} title="Cancel this tuition? (ACT-02)" footer={<><Button variant="secondary" onClick={() => setM(null)}>Keep tuition</Button><Button variant="destructive" onClick={() => { s.setJourney(() => ({ tuition: 'cancelled', cancelReason: why, agree: { tutor: false, parent: false, change: '' } })); setM(null); s.toast('Tuition cancelled', 'info') }}>Cancel tuition</Button></>}><Field label="Reason">{(i) => <Select id={i} value={why} onChange={(e) => setWhy(e.target.value)} options={['Student moved away', 'Schedule conflict', 'Fee issue', 'Safety concern', 'Other']} />}</Field><p className="mt-3 text-xs text-gray-600">Cancelling affects your cancellation rate in ranking.</p></Modal>
      <RevealModal open={rev} onClose={() => setRev(false)} />
    </div>
  )
}
