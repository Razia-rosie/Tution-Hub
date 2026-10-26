import { SAMPLE_TUT, STUDENT, studentKid, studentNeed } from '../lib/student'
import { studentPost } from '../pages/parent/pj'
import { Link, useNavigate } from 'react-router'
import { kjOf, confirmedKids, pickKid } from '../lib/parent'
import { completeTuition, tutorAcceptsPatch, tutorConfirms, tutorSendsInterest } from '../pages/parent/pj'
import { FastForward, RotateCcw, ShieldCheck, Users, X } from 'lucide-react'
import { ROLES, NAV } from '../lib/nav'
import { useStore, type VerifyState } from '../lib/store'
import { initialCJ, initialCV, ORG } from '../lib/coaching'
import { Button, DemoTag, IconButton, StatusChip } from './ui'

export default function DemoDrawer() {
  const s = useStore()
  const nav = useNavigate()
  if (!s.drawerOpen) return null
  const j = s.journey
  const v = s.verification[s.role]
  const kid = pickKid(s.pj, s.child); const kj = kid ? kjOf(s.pj, kid.id) : null
  const pending = kj ? Object.keys(kj.sent).find((id) => kj.sent[id] === 'sent') : undefined
  const sPending = Object.keys(s.sj.kj.sent).find((id) => s.sj.kj.sent[id] === 'sent')
  const set = (x: VerifyState) => { s.setVerification(s.role, x); s.toast(`Demo: verification set to ${x.replace('_', ' ')}`, 'info') }
  return (
    <div className="fixed inset-0 z-[55]" onClick={() => s.setDrawer(false)}>
      <aside role="dialog" aria-label="Demo controls" onClick={(e) => e.stopPropagation()} className="absolute right-0 top-0 flex h-full w-full max-w-sm flex-col overflow-y-auto bg-white p-5 shadow-modal">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-xl">Demo controls <DemoTag /></h2>
          <IconButton label="Close demo controls" onClick={() => s.setDrawer(false)}><X size={20} /></IconButton>
        </div>
        <p className="mt-2 text-xs text-gray-600">These controls simulate what a backend, reviewer or the passage of time would do. State lives in memory only and is lost on reload.</p>

        <section className="mt-5">
          <h3 className="mb-2 flex items-center gap-2 text-sm"><Users size={16} aria-hidden /> Switch role</h3>
          <div className="grid gap-1.5">
            {ROLES.map((r) => (
              <button key={r.id} onClick={() => { nav(`/app/${r.id}/${NAV[r.id][0].slug}`); s.setDrawer(false) }}
                className={`rounded-input border px-3 py-2 text-left text-sm ${s.role === r.id ? 'border-blue-600 bg-blue-100' : 'border-gray-200 hover:bg-gray-100'}`}>
                <span className="font-semibold text-navy-900">{r.label}</span><span className="block text-xs text-gray-600">{r.persona}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="mt-5">
          <h3 className="mb-2 flex items-center gap-2 text-sm"><ShieldCheck size={16} aria-hidden /> Verification (any role)</h3>
          <div className="mb-2 flex items-center gap-2 text-xs text-gray-600"><span className="capitalize">{s.role}:</span><StatusChip state={v} /></div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => { s.advanceVerification(); s.toast('Demo: reviewer advanced the verification state', 'success') }}>Advance one step</Button>
            <Button size="sm" variant="secondary" onClick={() => set('rejected')}>Reject</Button>
            <Button size="sm" variant="secondary" onClick={() => set('action_required')}>Action required</Button>
            <Button size="sm" variant="tertiary" onClick={() => set('not_started')}>Unverify</Button>
          </div>
        </section>

        <section className="mt-5">
          <h3 className="mb-2 flex items-center gap-2 text-sm"><FastForward size={16} aria-hidden /> Fast-forward time</h3>
          <p className="mb-2 text-sm">Demo date: <strong className="tabular">{s.demoDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</strong></p>
          <div className="flex gap-2">
            {[1, 7, 30].map((d) => <Button key={d} size="sm" variant="secondary" onClick={() => s.fastForward(d)}>+{d} day{d > 1 ? 's' : ''}</Button>)}
          </div>
          <p className="mt-2 text-xs text-gray-600">Classes happen on the demo calendar, so time must move before attendance can be marked.</p>
        </section>

        <section className="mt-5">
          <h3 className="mb-2 text-sm">Tutor journey</h3>
          <div className="flex flex-col gap-2">
            <Button size="sm" variant="secondary" disabled={j.interests['p-2'] !== 'sent'} onClick={() => { s.parentAccepts('p-2'); s.toast('Demo: parent accepted', 'success') }}>Parent accepts interest</Button>
            <Button size="sm" variant="secondary" disabled={j.tuition !== 'awaiting'} onClick={() => { s.parentConfirms(); s.toast('Demo: parent confirmed. Tuition active.', 'success') }}>Parent confirms agreement</Button>
            <Button size="sm" variant="secondary" disabled={j.tuition !== 'active'} onClick={() => { s.completeTuition(); s.toast('Demo: fast-forwarded to completion', 'success') }}>Fast-forward to completion</Button>
          </div>
          <p className="mt-2 text-xs text-gray-600">Each button is enabled only when that step is waiting. Tuition: {j.tuition}.</p>
        </section>


        <section className="mt-5">
          <h3 className="mb-2 text-sm">Parent journey</h3>
          <div className="mb-1 flex items-center gap-2 text-xs text-gray-600">Parent verification: <StatusChip state={s.verification.parent} /></div>
          <div className="mb-3 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => { nav('/app/parent/settings/verification'); s.setDrawer(false) }}>Jump to start</Button>
            <Button size="sm" onClick={() => { s.setVerification('parent', 'verified'); s.toast('Demo: reviewer approved the parent', 'success') }}>Simulate approval</Button>
            <Button size="sm" variant="secondary" onClick={() => { s.setPJ(() => ({ note: 'The guardian proof photo was unclear. Please upload a sharper photo.' })); s.setVerification('parent', 'rejected'); s.toast('Demo: reviewer rejected the parent', 'warning') }}>Simulate rejection</Button>
          </div>
          
          <div className="flex flex-col gap-2">
            <Button size="sm" variant="secondary" disabled={s.pj.kids.filter((k) => k.link === 'confirmed').length >= 2} onClick={() => { s.seedChildren(); s.toast('Demo: Ayaan and Mim linked and confirmed', 'success') }}>Link Ayaan and Mim (confirmed)</Button>
          </div>
          <p className="mt-2 text-xs text-gray-600">Skips the link and confirmation steps. Linked children: {s.pj.kids.filter((k) => k.link === 'confirmed').length}.</p>
        </section>

        <section className="mt-5">
          <h3 className="mb-2 text-sm">Journey B: {kid ? kid.short : 'no child'}</h3>
          <div className="flex flex-col gap-2">
            <Button size="sm" variant="secondary" disabled={!kid || !kj?.post || kj.post.status !== 'published' || kj.stage !== 'none'} onClick={() => { tutorSendsInterest(s, kid!.id); s.toast('Demo: a tutor sent interest', 'success') }}>Tutor sends interest</Button>
            <Button size="sm" variant="secondary" disabled={!pending} onClick={() => { s.setKJ(kid!.id, (k) => tutorAcceptsPatch(k, pending!)); s.toast('Demo: tutor accepted. Chat is open.', 'success') }}>Tutor accepts parent interest</Button>
            <Button size="sm" variant="secondary" disabled={!kj || kj.stage !== 'agreement'} onClick={() => { tutorConfirms(s, kid!.id); s.toast('Demo: tutor confirmed. Tuition active.', 'success') }}>Tutor confirms agreement</Button>
            <Button size="sm" variant="secondary" disabled={!kid?.tut || kj?.stage !== 'active'} onClick={() => { completeTuition(s, kid!); s.toast('Demo: fast-forwarded to completion', 'success') }}>Fast-forward to completion</Button>
          </div>
          <p className="mt-2 text-xs text-gray-600">Each button is enabled only when that step is waiting. Stage: {kj?.stage ?? 'none'}. Confirmed children: {confirmedKids(s.pj).length}.</p>
        </section>

        <section className="mt-5">
          <h3 className="mb-2 text-sm">Journey C: Student</h3>
          <div className="mb-1 flex items-center gap-2 text-xs text-gray-600">Student verification: <StatusChip state={s.verification.student} /></div>
          <div className="mb-3 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => { nav('/app/student/profile/verification'); s.setDrawer(false) }}>Jump to start</Button>
            <Button size="sm" onClick={() => { s.setVerification('student', 'verified'); s.toast('Demo: reviewer approved the student', 'success') }}>Approve student</Button>
            <Button size="sm" variant="secondary" onClick={() => { s.setSJ(() => ({ note: 'The student ID photo did not match the name you entered.' })); s.setVerification('student', 'rejected'); s.toast('Demo: reviewer rejected the student', 'warning') }}>Reject student</Button>
          </div>
          <div className="flex flex-col gap-2">
            <Button size="sm" variant="secondary" disabled={!!s.sj.tut} onClick={() => { s.setSJ(() => ({ tut: SAMPLE_TUT })); s.toast('Demo: sample tuition started for Nabila', 'success') }}>Start sample tuition</Button>
            <Button size="sm" variant="secondary" disabled={!s.sj.tut} onClick={() => { s.setSJ(() => ({ tut: null })); s.toast('Demo: sample tuition removed', 'info') }}>Remove sample tuition</Button>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            <Button size="sm" variant="secondary" disabled={s.sj.kj.stage !== 'none' || !!s.sj.tut} onClick={() => { tutorSendsInterest(s, STUDENT.id); s.toast('Demo: a tutor sent interest', 'success') }}>Tutor sends interest to student</Button>
            <Button size="sm" variant="secondary" disabled={!sPending} onClick={() => { s.setKJ(STUDENT.id, (k) => ({ ...tutorAcceptsPatch(k, sPending!), post: k.post ?? studentPost(studentNeed(studentKid(s.sj))) })); s.toast('Demo: tutor accepted. Chat is open.', 'success') }}>Tutor accepts student interest</Button>
            <Button size="sm" variant="secondary" disabled={s.sj.kj.stage !== 'agreement'} onClick={() => { tutorConfirms(s, STUDENT.id); s.toast('Demo: tutor confirmed. Tuition active.', 'success') }}>Tutor confirms student agreement</Button>
            <Button size="sm" variant="secondary" disabled={!s.sj.tut || s.sj.kj.stage !== 'active'} onClick={() => { completeTuition(s, studentKid(s.sj)); s.toast('Demo: fast-forwarded to completion', 'success') }}>Fast-forward student tuition</Button>
          </div>
          <p className="mt-2 text-xs text-gray-600">Sample tuition: {s.sj.tut ? 'active' : 'none'}.</p>
        </section>

        <section className="mt-5">
          <h3 className="mb-2 text-sm">Journey D: Coaching</h3>
          <div className="mb-1 flex items-center gap-2 text-xs text-gray-600">Organization verification: <StatusChip state={s.verification.coaching} /></div>
          <div className="mb-3 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => { nav('/app/coaching/verification'); s.setDrawer(false) }}>Jump to coaching start</Button>
            <Button size="sm" onClick={() => { s.setVerification('coaching', 'verified'); s.toast('Demo: reviewer approved the organization', 'success') }}>Approve organization</Button>
            <Button size="sm" variant="secondary" onClick={() => { s.setCV(() => ({ note: 'The trade licence photo did not match the organization name you entered.' })); s.setVerification('coaching', 'rejected'); s.toast('Demo: reviewer rejected the organization', 'warning') }}>Reject organization</Button>
            <Button size="sm" variant="secondary" onClick={() => { s.setCV(() => ({ note: 'The licence copy is hard to read. Please add a clearer copy.' })); s.setVerification('coaching', 'action_required'); s.toast('Demo: reviewer needs more from the organization', 'warning') }}>Organization needs action</Button>
          </div>
          <div className="flex flex-col gap-2">
            <Button size="sm" variant="secondary" onClick={() => { s.setCV((x) => ({ cv: { register: true, organization: true, institution: true, review: true }, phoneOk: true, emailOk: true, form: { ...initialCV().form, orgName: ORG.name, ownerName: ORG.owner, established: '2016', levels: ['HSC'], subjects: ['Physics'], regLast4: '4821', email: 'scholars@demo.tuitionhub.test', phone: '01712345678', licenceFile: true, ownerIdFile: true, consent: true, declare: x.form.declare } })); s.toast('Demo: all verification steps filled in', 'success') }}>Fill all coaching verification steps</Button>
            <Button size="sm" variant="secondary" onClick={() => { s.setCJ(() => initialCJ()); s.toast('Demo: Scholars Point data restored', 'success') }}>Restore Scholars Point data</Button>
            <Button size="sm" variant="secondary" onClick={() => { s.setCJ((c) => ({ teachers: [], students: [], batches: [], classes: [], parents: [], marks: {}, homework: [], exams: [], reports: [], fees: [], threads: [], notifs: [] })); s.toast('Demo: coaching data cleared to show empty states', 'info') }}>Clear coaching data (empty states)</Button>
          </div>
          <p className="mt-2 text-xs text-gray-600">Teachers: {s.cj.teachers.length}, students: {s.cj.students.length}, batches: {s.cj.batches.length}.</p>
        </section>

        <section className="mt-5">
          <h3 className="mb-2 text-sm">Open</h3>
          <div className="flex flex-wrap gap-2 text-sm font-semibold text-blue-600">
            <Link to="/" onClick={() => s.setDrawer(false)} className="rounded-input border border-gray-200 px-3 py-1.5 hover:bg-blue-100">Public landing</Link>
            <Link to="/design-system" onClick={() => s.setDrawer(false)} className="rounded-input border border-gray-200 px-3 py-1.5 hover:bg-blue-100">Design system</Link>
            <Link to="/reference" onClick={() => s.setDrawer(false)} className="rounded-input border border-gray-200 px-3 py-1.5 hover:bg-blue-100">Reference</Link>
          </div>
        </section>

        <section className="mt-auto pt-6">
          <Button variant="destructive" icon={<RotateCcw size={16} />} className="w-full" onClick={() => { s.reset(); nav('/'); s.toast('Demo state reset', 'success') }}>Reset all demo state</Button>
        </section>
      </aside>
    </div>
  )
}
