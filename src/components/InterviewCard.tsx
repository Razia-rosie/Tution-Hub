import { useState } from 'react'
import { Link } from 'react-router'
import { CalendarClock } from 'lucide-react'
import { Button, Card, Chip, Field, Textarea } from './ui'
import { useStore } from '../lib/store'
import { platform } from '../lib/platform'
import { confirmInterview, type ApplicantInterview } from '../lib/api'

const message = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback)

/** The interview's state as the applicant sees it. */
export function interviewStage(iv: Pick<ApplicantInterview, 'status' | 'confirmed_at'>): { label: string; tone: 'amber' | 'blue' | 'green' } {
  if (iv.status === 'completed') return { label: 'Completed', tone: 'green' }
  if (iv.confirmed_at) return { label: 'Confirmed', tone: 'blue' }
  return { label: 'Scheduled, please confirm', tone: 'amber' }
}

/**
 * The applicant's interview on their Verification page: details, the admin's
 * instructions and latest message, Confirm, and a message to the admin in the
 * same conversation as the meeting messages. Nothing here approves the
 * application; only the administrator's final decision does.
 */
export default function InterviewCard({ interview, onChange }: { interview: ApplicantInterview; onChange: () => Promise<unknown> | void }) {
  const { user, toast } = useStore()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState<'confirm' | 'send' | null>(null)
  const [error, setError] = useState('')
  const at = new Date(interview.scheduled_at)
  const stage = interviewStage(interview)
  const online = interview.mode === 'online'
  const conversation = interview.conversation_id ? `/app/${user?.role}/messages/${interview.conversation_id}` : null

  const confirm = async () => {
    setBusy('confirm'); setError('')
    try {
      const r = await confirmInterview()
      toast(r.already_confirmed ? 'You already confirmed this interview.' : 'Interview confirmed. The administrator has been told.', 'success')
      await onChange()
    } catch (e) { setError(message(e, 'Could not confirm the interview.')) } finally { setBusy(null) }
  }
  const send = async () => {
    if (!interview.conversation_id) return
    setBusy('send'); setError('')
    try {
      await platform.send(interview.conversation_id, text.trim())
      setText('')
      toast('Message sent to the administrator. The interview stays as scheduled until they change it.', 'success')
      await onChange()
    } catch (e) { setError(message(e, 'Could not send the message.')) } finally { setBusy(null) }
  }

  return (
    <Card className="border-blue-600">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg"><CalendarClock size={18} aria-hidden /> Your verification interview</h2>
        <Chip tone={stage.tone}>{stage.label}</Chip>
      </div>
      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
        <div><dt className="text-gray-600">Date</dt><dd className="font-medium">{at.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</dd></div>
        <div><dt className="text-gray-600">Time</dt><dd className="font-medium">{at.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</dd></div>
        <div><dt className="text-gray-600">Type</dt><dd className="font-medium">{online ? 'Online' : 'In person'}</dd></div>
        <div className="min-w-0"><dt className="text-gray-600">{online ? 'Meeting link' : 'Location'}</dt><dd className="break-words font-medium">{interview.location_or_link ? (online && /^https?:\/\//.test(interview.location_or_link) ? <a href={interview.location_or_link} target="_blank" rel="noreferrer noopener" className="text-blue-600 underline">{interview.location_or_link}</a> : interview.location_or_link) : 'To be shared by the administrator'}</dd></div>
        {interview.instructions && <div className="sm:col-span-2"><dt className="text-gray-600">Instructions from the administrator</dt><dd className="whitespace-pre-wrap">{interview.instructions}</dd></div>}
        {interview.latest_admin_message && <div className="sm:col-span-2"><dt className="text-gray-600">Latest message from the administrator{interview.latest_admin_message_at ? ` · ${new Date(interview.latest_admin_message_at).toLocaleString()}` : ''}</dt><dd className="whitespace-pre-wrap rounded-input bg-gray-50 p-2">{interview.latest_admin_message}</dd></div>}
      </dl>
      {interview.updated_at && interview.status === 'scheduled' && <p className="mt-2 text-xs text-gray-600">Rescheduled {new Date(interview.updated_at).toLocaleString()}.</p>}
      {interview.status === 'completed' && <p className="mt-3 text-sm">The interview is complete. The administrator will now make the final decision on your application.</p>}

      {interview.status === 'scheduled' && (
        <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
          {interview.confirmed_at
            ? <p className="text-sm text-teal-700">You confirmed on {new Date(interview.confirmed_at).toLocaleString()}.</p>
            : <Button loading={busy === 'confirm'} disabled={busy !== null} onClick={() => void confirm()}>Okay, confirm interview</Button>}
          {interview.conversation_id && (
            <div>
              <Field label="Message the administrator" hint="For example, if the time does not suit you. The interview is not changed until the administrator updates it.">{(id) => <Textarea id={id} value={text} onChange={(e) => setText(e.target.value)} maxLength={4000} />}</Field>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <Button variant="secondary" loading={busy === 'send'} disabled={busy !== null || !text.trim()} onClick={() => void send()}>Message admin</Button>
                {conversation && <Link to={conversation} className="text-sm font-semibold text-blue-600 hover:underline">Open the conversation</Link>}
              </div>
            </div>
          )}
        </div>
      )}
      {error && <p role="alert" className="mt-3 text-sm text-danger-700">{error}</p>}
    </Card>
  )
}
