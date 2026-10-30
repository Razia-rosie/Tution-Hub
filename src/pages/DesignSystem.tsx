import { useState } from 'react'
import { Link } from 'react-router'
import { Bell, Plus, Search } from 'lucide-react'
import {
  Avatar, Bar, Button, Card, Chip, DemoTag, EmptyState, ErrorState, Field, IconButton, Input, Modal, OtpInput, PhoneInput, ProgressRing,
  Select, Skeleton, StatCard, StatusChip, Stepper, Table, Tabs, Textarea, Toggle, VerifiedGate, VerifyBadge,
} from '../components/ui'
import { useStore, type VerifyState } from '../lib/store'

const colors: [string, string][] = [['navy-900', '#0A1F44'], ['navy-700', '#12336B'], ['blue-600', '#1F5FBF'], ['blue-100', '#E6EEFA'], ['teal-600', '#0E8F7E'], ['teal-700', '#0B7A67'], ['emerald-600', '#0F9D74'], ['offwhite-50', '#F7F5F0'], ['charcoal-900', '#1F2933'], ['gray-600', '#52606D'], ['gray-400', '#9AA5B1'], ['gray-200', '#E4E7EB'], ['gray-100', '#F1F3F5'], ['warning-600', '#B7791F'], ['danger-600', '#C0392B'], ['info-600', '#2F6FDE']]
const type: [string, string, string][] = [['Display', 'text-5xl leading-[56px]', '48/56'], ['H1', 'text-[32px] leading-10', '32/40'], ['H2', 'text-2xl leading-8', '24/32'], ['H3', 'text-xl leading-7', '20/28'], ['Body-L', 'text-lg leading-7 font-sans font-normal', '18/28'], ['Body', 'text-base font-sans font-normal', '16/24'], ['Body-S', 'text-sm font-sans font-normal', '14/20'], ['Caption', 'text-xs font-sans font-normal', '12/16']]

function Sec({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="space-y-4"><h2 className="border-b border-gray-200 pb-2 text-2xl">{title}</h2>{children}</section>
}

export default function DesignSystem() {
  const s = useStore()
  const [tab, setTab] = useState('Overview')
  const [modal, setModal] = useState(false)
  const [otp, setOtp] = useState('')
  const [phone, setPhone] = useState('')
  const [on, setOn] = useState(true)
  const [n, setN] = useState(2)
  const [loading, setLoading] = useState(false)
  const states: VerifyState[] = ['not_started', 'draft', 'pending', 'under_review', 'verified', 'rejected', 'action_required']

  return (
    <main id="main" className="mx-auto max-w-[1200px] space-y-12 px-4 py-10 md:px-8">
      <div><Link to="/" className="text-sm font-semibold text-blue-600">Back to start</Link>
        <h1 className="mt-3 text-4xl">Design system — component test sheet</h1>
        <p className="mt-2 text-gray-600">Tokens live as CSS variables in <code>src/index.css</code>; components in <code>src/components/ui.tsx</code>. Weights 400–700 only.</p></div>

      <Sec title="Colour tokens">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {colors.map(([k, v]) => (<div key={k}><div className="h-14 rounded-input border border-gray-200" style={{ background: `var(--color-${k})` }} /><p className="mt-1 text-xs font-semibold">{k}</p><p className="text-xs text-gray-600 tabular">{v}</p></div>))}
        </div>
      </Sec>

      <Sec title="Typography — Manrope / Inter / Noto Sans Bengali">
        <div className="space-y-2">{type.map(([n, c, m]) => <p key={n} className={`${c} font-heading`}><span className="font-bold text-navy-900">{n}</span> <span className="text-xs font-sans font-normal text-gray-600">{m}</span> <span className="font-sans text-sm font-normal text-gray-600">Find a verified tutor · টিউটর খুঁজুন · ৳8,000</span></p>)}</div>
      </Sec>

      <Sec title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primary</Button><Button variant="secondary">Secondary</Button><Button variant="tertiary">Tertiary</Button><Button variant="destructive">Destructive</Button>
          <Button disabled>Disabled</Button><Button loading={loading} onClick={() => { setLoading(true); setTimeout(() => setLoading(false), 1500) }}>{loading ? 'Saving' : 'Click for loading'}</Button>
          <Button icon={<Plus size={16} />}>With icon</Button><IconButton label="Search"><Search size={20} /></IconButton>
        </div>
      </Sec>

      <Sec title="Inputs">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Full name" hint="As on your NID">{(id) => <Input id={id} placeholder="Tanvir Ahmed Rahman" />}</Field>
          <Field label="Email" error="Enter a valid email address">{(id) => <Input id={id} aria-invalid defaultValue="tanvir@" />}</Field>
          <Field label="Phone">{(id) => <PhoneInput id={id} value={phone} onChange={setPhone} />}</Field>
          <Field label="Class">{(id) => <Select id={id} options={['Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10', 'SSC', 'HSC']} />}</Field>
          <Field label="Note">{(id) => <Textarea id={id} placeholder="Anything the tutor should know" />}</Field>
          <Field label="Disabled">{(id) => <Input id={id} disabled value="Locked" readOnly />}</Field>
        </div>
        <div className="flex flex-wrap items-center gap-8">
          <div><p className="mb-1 text-sm font-medium">OTP <DemoTag label="Demo OTP" /></p><OtpInput value={otp} onChange={setOtp} /></div>
          <div className="flex items-center gap-2 text-sm">Toggle <Toggle checked={on} onChange={setOn} label="Example toggle" /></div>
          <div className="flex items-center gap-2 text-sm">Stepper <Stepper value={n} onChange={setN} min={1} max={7} label="Days per week" /></div>
        </div>
      </Sec>

      <Sec title="Chips and verification badges">
        <div className="flex flex-wrap gap-2">{states.map((x) => <StatusChip key={x} state={x} />)}<Chip tone="green">Success</Chip><Chip tone="gray">Neutral</Chip></div>
        <div className="flex flex-wrap gap-2"><VerifyBadge kind="identity" /><VerifyBadge kind="education" /><VerifyBadge kind="experience" /><VerifyBadge kind="skill" active={false} /><VerifyBadge kind="student" /><VerifyBadge kind="parent" /><VerifyBadge kind="organization" /></div>
      </Sec>

      <Sec title="Cards">
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard label="Verified tuitions" value="27" delta="+2 this month" icon={<Bell size={18} />} />
          <StatCard label="Attendance" value="92%" />
          <Card className="flex items-center gap-3"><ProgressRing value={87} label="Trust Score" /><div><p className="font-semibold text-navy-900">Trust Score</p><p className="text-xs text-gray-600">Distinct from rating and rank</p></div></Card>
          <Card className="flex items-center gap-3"><Avatar name="Tanvir Ahmed Rahman" /><div><p className="font-semibold text-navy-900">Tanvir Ahmed Rahman</p><p className="text-xs text-gray-600">Maths · Physics · Uttara</p></div></Card>
        </div>
        <Card><div className="grid gap-3 md:grid-cols-3"><Bar value={92} label="Attendance" /><Bar value={78} label="Test average" tone="teal" /><Bar value={90} label="Homework" /></div></Card>
      </Sec>

      <Sec title="Tabs, table, modal, locked action">
        <Tabs tabs={['Overview', 'Details', 'History']} value={tab} onChange={setTab} />
        <p className="text-sm text-gray-600">Selected: {tab}</p>
        <Table cols={[{ key: 'name', label: 'Tutor', sortable: true }, { key: 'area', label: 'Area', sortable: true }, { key: 'fee', label: 'Fee / month', sortable: true }]}
          rows={[{ name: 'Tanvir Ahmed Rahman', area: 'Uttara', fee: '৳6,000' }, { name: 'Samira Khanam', area: 'Mirpur', fee: '৳4,500' }, { name: 'Rafiq Hasan', area: 'Banani', fee: '৳8,000' }]} />
        <div className="flex flex-wrap items-center gap-4">
          <Button variant="secondary" onClick={() => setModal(true)}>Open modal</Button>
          <Button variant="secondary" onClick={() => s.toast('Saved (demo)', 'success')}>Show toast</Button>
          <VerifiedGate what="Sending interest"><Button>Send interest</Button></VerifiedGate>
          <span className="text-xs text-gray-600">Locked until an administrator approves verification.</span>
        </div>
      </Sec>

      <Sec title="Loading, empty and error states">
        <div className="grid gap-4 md:grid-cols-3">
          <Card><Skeleton className="h-4 w-1/2" /><Skeleton className="mt-3 h-3 w-full" /><Skeleton className="mt-2 h-3 w-4/5" /></Card>
          <EmptyState title="No posts yet" body="Create your first tuition post to start receiving matches." />
          <ErrorState title="Could not load schedule" onRetry={() => s.toast('Retry (demo)', 'info')} />
        </div>
      </Sec>

      <Modal open={modal} onClose={() => setModal(false)} title="Cancel this tuition?" footer={<><Button variant="secondary" onClick={() => setModal(false)}>Keep tuition</Button><Button variant="destructive" onClick={() => { setModal(false); s.toast('Cancelled (demo)', 'warning') }}>Cancel tuition</Button></>}>
        Cancelling needs a reason and confirmation. Both parties are notified.
      </Modal>
    </main>
  )
}
