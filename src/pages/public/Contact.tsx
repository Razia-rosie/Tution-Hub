import { useState } from 'react'
import { Link } from 'react-router'
import { CheckCircle2, Clock, Mail, MapPin, Phone } from 'lucide-react'
import { Button, btnClass, Card, DemoTag, Field, Input, Select, Textarea } from '../../components/ui'
import { PageHero, Section } from '../../components/public/bits'
import { normalizePhone, validEmail, validPhone } from '../../lib/validate'
import { PhoneInput } from '../../components/ui'

export default function Contact() {
  const [f, setF] = useState({ name: '', email: '', phone: '', topic: 'General question', msg: '' })
  const [touched, setTouched] = useState(false)
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const err = {
    name: f.name.trim().length < 2 ? 'Enter your full name.' : '',
    email: !f.email ? 'Enter your email address.' : !validEmail(f.email) ? 'This email looks incomplete. Use a format like name@example.com.' : '',
    phone: f.phone && !validPhone(f.phone) ? 'Enter 10 digits after +880, starting with 13 to 19.' : '',
    msg: f.msg.trim().length < 20 ? `Write at least 20 characters (${f.msg.trim().length}/20).` : '',
  }
  const bad = Object.values(err).some(Boolean)
  const show = (k: keyof typeof err) => (touched ? err[k] : '')
  const submit = (e: React.FormEvent) => {
    e.preventDefault(); setTouched(true)
    if (bad) return
    setState('sending'); setTimeout(() => setState('sent'), 900)
  }
  return (
    <>
      <PageHero eyebrow="Contact" title="Talk to a real person on the team." lead="Questions, safety concerns or partnership ideas. We reply within two working days." />
      <Section>
        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          <Card className="md:p-8">
            {state === 'sent' ? (
              <div className="py-10 text-center" role="status">
                <CheckCircle2 size={48} strokeWidth={1.5} className="mx-auto text-emerald-600" aria-hidden />
                <h2 className="mt-4 text-2xl">Message received</h2>
                <p className="mx-auto mt-2 max-w-sm text-gray-600">Thank you, {f.name.split(' ')[0]}. We will reply to {f.email} within two working days.</p>
                <p className="mt-3"><DemoTag label="Demo" title="No message is actually sent." /></p>
                <div className="mt-6 flex justify-center gap-3"><Link to="/" className={btnClass('primary')}>Back to home</Link><button className={btnClass('secondary')} onClick={() => { setF({ name: '', email: '', phone: '', topic: 'General question', msg: '' }); setTouched(false); setState('idle') }}>Send another</button></div>
              </div>
            ) : (
              <form onSubmit={submit} noValidate className="space-y-5">
                <div className="flex items-center justify-between"><h2 className="text-xl">Send a message</h2><DemoTag label="Demo" title="Nothing is sent. Simulated submit." /></div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Full name" error={show('name')}>{(id) => <Input id={id} aria-invalid={!!show('name')} autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />}</Field>
                  <Field label="Email" error={show('email')}>{(id) => <Input id={id} type="email" aria-invalid={!!show('email')} autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />}</Field>
                  <Field label="Phone (optional)" error={show('phone')} hint="Mobile number, +880 format">{(id) => <PhoneInput id={id} value={f.phone} onChange={(v) => setF({ ...f, phone: normalizePhone(v) })} />}</Field>
                  <Field label="Topic">{(id) => <Select id={id} options={['General question', 'Safety concern', 'Verification help', 'Coaching partnership', 'Press']} value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value })} />}</Field>
                </div>
                <Field label="Message" error={show('msg')}>{(id) => <Textarea id={id} aria-invalid={!!show('msg')} rows={5} value={f.msg} onChange={(e) => setF({ ...f, msg: e.target.value })} />}</Field>
                <Button type="submit" loading={state === 'sending'}>{state === 'sending' ? 'Sending…' : 'Send message'}</Button>
              </form>
            )}
          </Card>
          <div className="space-y-4">
            <Card><h3 className="text-lg">Other ways to reach us</h3>
              <ul className="mt-4 space-y-4 text-sm">
                <li className="flex gap-3"><Mail size={18} className="mt-0.5 text-blue-600" aria-hidden /><span>hello@tuitionhub.demo<br /><span className="text-gray-600">Fictional address</span></span></li>
                <li className="flex gap-3"><Phone size={18} className="mt-0.5 text-blue-600" aria-hidden /><span>+880 1700-000000<br /><span className="text-gray-600">Fictional number</span></span></li>
                <li className="flex gap-3"><MapPin size={18} className="mt-0.5 text-blue-600" aria-hidden /><span>Dhaka, Bangladesh<br /><span className="text-gray-600">Remote team</span></span></li>
                <li className="flex gap-3"><Clock size={18} className="mt-0.5 text-blue-600" aria-hidden /><span>Sat to Thu, 9:00 AM to 6:00 PM</span></li>
              </ul></Card>
            <Card className="bg-blue-100"><h3 className="text-lg">Safety concern?</h3><p className="mt-1 text-sm text-navy-700">Choose the topic "Safety concern" so it is routed to trust and safety first.</p></Card>
          </div>
        </div>
      </Section>
    </>
  )
}
