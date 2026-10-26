import { Link } from 'react-router'
import { ShieldCheck } from 'lucide-react'
import { PageHead, Masked } from '../../components/tutor/bits'
import { Avatar, Card, DemoTag, StatusChip, VerifyBadge } from '../../components/ui'
import { useStore } from '../../lib/store'
import { STUDENT, ageOf, isMinor, maskGuardianPhone } from '../../lib/student'
import { maskPhone } from '../../lib/validate'

export default function Profile() {
  const s = useStore(); const f = s.sj.form; const vs = s.verification.student
  const rows: [string, React.ReactNode][] = [['Name', f.fullName || STUDENT.name], ['Age', f.dob ? `${ageOf(f.dob)} years` : 'Not added'], ['District', f.district], ['Institution', f.school || 'Not added'], ['Class', f.cls ? `${f.cls}, ${f.year}` : 'Not added'], ['Phone', <Masked key="p" value={maskPhone(s.signup.phone || '1812345678')} />], ['Guardian', isMinor(f) && f.guardianName ? <span key="g">{f.guardianName} · <Masked value={maskGuardianPhone(f.guardianPhone)} /></span> : 'Not needed or not added']]
  return (
    <div>
      <PageHead title="Profile" tag="PROF-S" sub="This is what tutors see: first name, class and verification. Never your address or phone." actions={<StatusChip state={vs} />} />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card><div className="flex items-center gap-3"><Avatar name={f.fullName || STUDENT.name} size={56} /><div><h2 className="text-xl">{f.fullName || STUDENT.name}</h2>{vs === 'verified' && <VerifyBadge kind="student" />}</div></div>
          <dl className="mt-4 divide-y divide-gray-100 text-sm">{rows.map(([l, v]) => <div key={l} className="grid grid-cols-[7rem_1fr] gap-3 py-2"><dt className="text-gray-600">{l}</dt><dd className="font-semibold text-navy-900">{v}</dd></div>)}</dl></Card>
        <Card><h2 className="flex items-center gap-2 text-base"><ShieldCheck size={16} className="text-teal-700" aria-hidden /> Verification</h2><p className="mt-2 text-sm text-gray-600">{vs === 'verified' ? 'Student Status: Verified.' : 'Verify to send interest and chat with tutors.'}</p>
          <Link to="/app/student/profile/verification" className="mt-3 inline-block rounded-input bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">{vs === 'not_started' || vs === 'draft' ? 'Start verification' : 'Open verification'}</Link>
          <p className="mt-3 text-xs text-gray-600"><DemoTag /> Demo profile, fictional data.</p></Card>
      </div>
    </div>
  )
}
