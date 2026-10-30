import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { Ban, Flag, Send } from 'lucide-react'
import { Button, Card, Chip, EmptyState, Tabs, Textarea } from '../components/ui'
import { useStore } from '../lib/store'
import { platform, errMsg, fmtDateTime, type Message } from '../lib/platform'
import { useAction, useLoad } from '../lib/useLoad'
import { Loaded, PageTitle } from './common'
import { RequestDemoClass } from './Tuitions'

const POLL_MS = 4000

/**
 * Chat requests and persistent conversations. New messages arrive by polling
 * every few seconds while the thread is open (the API has no push channel).
 */
export default function Messages({ sub, basePath }: { sub: string; basePath: string }) {
  const { user, toast } = useStore()
  const nav = useNavigate()
  const [tab, setTab] = useState('Conversations')
  const convs = useLoad(() => platform.conversations(), [])
  const reqs = useLoad(() => platform.chatRequests(), [])
  const { busy, run } = useAction(toast)
  const openId = sub.split('/')[0]
  useEffect(() => {
    // Refresh the list while the page is open so unread counts stay current.
    const t = setInterval(() => { void convs.reload() }, POLL_MS * 3)
    return () => clearInterval(t)
  }, [convs.reload])

  const incoming = reqs.data?.requests.filter((r) => r.to_id === user?.id) ?? []
  const outgoing = reqs.data?.requests.filter((r) => r.from_id === user?.id) ?? []
  const pendingIn = incoming.filter((r) => r.status === 'pending').length

  return (
    <div>
      <PageTitle title="Messages" sub="Phone numbers and addresses stay private until a tuition is confirmed." />
      <Tabs tabs={['Conversations', `Requests${pendingIn ? ` (${pendingIn})` : ''}`]} value={tab.startsWith('Requests') ? `Requests${pendingIn ? ` (${pendingIn})` : ''}` : tab} onChange={(t) => setTab(t.startsWith('Requests') ? 'Requests' : t)} />
      <div className="mt-4">
        {tab === 'Conversations' ? (
          <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
            <Loaded load={convs} empty={(d) => d.conversations.length ? null : { title: 'No conversations yet', body: user?.role === 'tutor' || user?.role === 'coaching' ? 'Conversations start when a guardian accepts your application or you accept a chat request.' : 'Send a chat request from a tutor profile, or accept a tutor application on your tuition post.' }}>
              {(d) => (
                <ul className={`space-y-2 ${openId ? 'hidden lg:block' : ''}`}>
                  {d.conversations.map((c) => (
                    <li key={c.id}>
                      <button onClick={() => nav(`${basePath}/${c.id}`)} aria-current={c.id === openId} className={`w-full rounded-input border p-3 text-left ${c.id === openId ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-400'}`}>
                        <span className="flex items-center justify-between gap-2"><span className="font-semibold">{c.other_name}</span>{c.unread > 0 && <Chip tone="blue">{c.unread} new</Chip>}</span>
                        <span className="block truncate text-sm text-gray-600">{c.last_message ?? 'No messages yet'}</span>
                        <span className="text-xs text-gray-600">{c.other_role} · {fmtDateTime(c.last_message_at)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Loaded>
            {openId ? <Thread key={openId} id={openId} onBack={() => nav(basePath)} onChange={() => void convs.reload()} /> : <Card className="hidden lg:block"><p className="text-sm text-gray-600">Select a conversation.</p></Card>}
          </div>
        ) : (
          <Loaded load={reqs} empty={(d) => d.requests.length ? null : { title: 'No chat requests', body: 'Requests you send or receive appear here.' }}>
            {() => (
              <div className="space-y-6">
                {incoming.length > 0 && <section><h2 className="mb-2 text-lg">Received</h2><ul className="space-y-2">{incoming.map((r) => (
                  <li key={r.id}><Card><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{r.from_name} <span className="text-sm font-normal text-gray-600">({r.from_role})</span></p>{r.message && <p className="mt-1 text-sm">{r.message}</p>}<p className="mt-1 text-xs text-gray-600">{fmtDateTime(r.created_at)}</p></div>
                    {r.status === 'pending' ? <div className="flex gap-2"><Button size="sm" loading={busy} onClick={() => void run(async () => { const out = await platform.answerChat(r.id, 'accept'); await Promise.all([reqs.reload(), convs.reload()]); if (out.conversation_id) { setTab('Conversations'); nav(`${basePath}/${out.conversation_id}`) } }, 'Request accepted.')}>Accept</Button><Button size="sm" variant="secondary" loading={busy} onClick={() => void run(async () => { await platform.answerChat(r.id, 'decline'); await reqs.reload() }, 'Request declined.')}>Decline</Button></div> : <Chip>{r.status}</Chip>}
                  </div></Card></li>))}</ul></section>}
                {outgoing.length > 0 && <section><h2 className="mb-2 text-lg">Sent</h2><ul className="space-y-2">{outgoing.map((r) => (
                  <li key={r.id}><Card><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold">To {r.to_name}</p><p className="text-xs text-gray-600">{fmtDateTime(r.created_at)}</p></div>
                    <div className="flex items-center gap-2"><Chip tone={r.status === 'accepted' ? 'green' : r.status === 'pending' ? 'amber' : 'gray'}>{r.status}</Chip>{r.status === 'pending' && <Button size="sm" variant="secondary" loading={busy} onClick={() => void run(async () => { await platform.answerChat(r.id, 'cancel'); await reqs.reload() }, 'Request cancelled.')}>Cancel</Button>}{r.conversation_id && <Button size="sm" variant="secondary" onClick={() => { setTab('Conversations'); nav(`${basePath}/${r.conversation_id}`) }}>Open chat</Button>}</div>
                  </div></Card></li>))}</ul></section>}
              </div>
            )}
          </Loaded>
        )}
      </div>
    </div>
  )
}

function Thread({ id, onBack, onChange }: { id: string; onBack: () => void; onChange: () => void }) {
  const { user, toast } = useStore()
  const [messages, setMessages] = useState<Message[] | null>(null)
  const [error, setError] = useState('')
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const lastRef = useRef<string | undefined>(undefined)
  const endRef = useRef<HTMLDivElement>(null)
  const convs = useLoad(() => platform.conversations(), [id])
  const other = convs.data?.conversations.find((c) => c.id === id)
  const [demo, setDemo] = useState(false)
  const canRequestDemo = (user?.role === 'parent' || user?.role === 'student') && other?.other_role === 'tutor' && !other.blocked

  useEffect(() => {
    let stopped = false
    const poll = async () => {
      try {
        const { messages: fresh } = await platform.messages(id, lastRef.current)
        if (stopped) return
        if (fresh.length) {
          lastRef.current = fresh[fresh.length - 1].created_at
          setMessages((m) => [...(m ?? []), ...fresh.filter((f) => !(m ?? []).some((x) => x.id === f.id))])
          await platform.markRead(id)
          onChange()
        } else setMessages((m) => m ?? [])
      } catch (e) { if (!stopped) setError(errMsg(e, 'Could not load messages.')) }
    }
    void poll()
    const t = setInterval(poll, POLL_MS)
    return () => { stopped = true; clearInterval(t) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }) }, [messages?.length])

  const send = async () => {
    const body = text.trim()
    if (!body) return
    setSending(true)
    try {
      const { message } = await platform.send(id, body)
      lastRef.current = message.created_at
      setMessages((m) => [...(m ?? []), message])
      setText('')
      onChange()
    } catch (e) { toast(errMsg(e), 'danger') } finally { setSending(false) }
  }

  if (error) return <Card><p role="alert" className="text-sm text-danger-600">{error}</p></Card>
  return (
    <Card pad={false} className="flex min-h-[420px] flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 p-3">
        <div className="flex items-center gap-2"><button className="text-sm text-blue-600 lg:hidden" onClick={onBack}>← Back</button><p className="font-semibold">{other?.other_name ?? 'Conversation'}</p>{other?.blocked && <Chip tone="red">Blocked</Chip>}</div>
        {other && <div className="flex flex-wrap gap-2">
          {canRequestDemo && <Button size="sm" onClick={() => setDemo(true)}>Request demo class</Button>}
          <Button size="sm" variant="tertiary" icon={<Ban size={14} />} onClick={async () => { if (!window.confirm(other.blocked ? `Unblock ${other.other_name}?` : `Block ${other.other_name}? Neither of you will be able to send messages.`)) return; try { await platform.block(other.other_id, !other.blocked); await convs.reload(); onChange(); toast(other.blocked ? 'Unblocked.' : 'Blocked.', 'success') } catch (e) { toast(errMsg(e), 'danger') } }}>{other.blocked ? 'Unblock' : 'Block'}</Button>
          <ReportButton userId={other.other_id} name={other.other_name} />
        </div>}
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-3" style={{ maxHeight: 480 }} aria-live="polite">
        {messages === null && <p role="status" className="text-sm text-gray-600">Loading…</p>}
        {messages?.length === 0 && <p className="text-sm text-gray-600">No messages yet. Say hello.</p>}
        {messages?.map((m) => {
          const mine = m.sender_id === user?.id
          if (!m.sender_id) return <p key={m.id} className="mx-auto max-w-md rounded-input bg-gray-100 px-3 py-2 text-center text-xs text-gray-600">{m.body}</p>
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-card px-3 py-2 text-sm ${mine ? 'bg-blue-600 text-white' : 'bg-gray-100 text-charcoal-900'}`}>
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className={`mt-1 text-[11px] ${mine ? 'text-blue-100' : 'text-gray-600'}`}>{fmtDateTime(m.created_at)}</p>
              </div>
            </div>
          )
        })}
        <div ref={endRef} />
      </div>
      {demo && other && <RequestDemoClass tutorId={other.other_id} tutorName={other.other_name} onDone={() => setDemo(false)} />}
      <form className="flex items-end gap-2 border-t border-gray-100 p-3" onSubmit={(e) => { e.preventDefault(); void send() }}>
        <Textarea aria-label="Message" value={text} maxLength={4000} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send() } }} className="!min-h-11 flex-1" placeholder={other?.blocked ? 'Messaging is blocked' : 'Write a message'} disabled={other?.blocked} />
        <Button type="submit" loading={sending} disabled={!text.trim() || other?.blocked} icon={<Send size={16} />}>Send</Button>
      </form>
    </Card>
  )
}

/** Files a report about a user with the support team. */
export function ReportButton({ userId, name, listingId }: { userId?: string; name: string; listingId?: string }) {
  const { toast } = useStore()
  const [open, setOpen] = useState(false)
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  if (!open) return <Button size="sm" variant="tertiary" icon={<Flag size={14} />} onClick={() => setOpen(true)}>Report</Button>
  return (
    <div role="dialog" aria-modal="true" aria-label={`Report ${name}`} className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-md">
        <h2 className="text-lg">Report {name}</h2>
        <p className="mt-1 text-sm text-gray-600">Tell the TuitionHub team what happened. Reports are confidential.</p>
        <Textarea className="mt-3" aria-label="What happened" value={body} onChange={(e) => setBody(e.target.value)} autoFocus />
        <div className="mt-3 flex justify-end gap-2"><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
          <Button loading={busy} disabled={body.trim().length < 10} onClick={async () => { setBusy(true); try { await platform.createTicket({ category: listingId ? 'report_post' : 'report_user', title: `Report about ${name}`, body, subject_user_id: userId, listing_id: listingId }); toast('Report sent to the TuitionHub team.', 'success'); setOpen(false); setBody('') } catch (e) { toast(errMsg(e), 'danger') } finally { setBusy(false) } }}>Send report</Button></div>
        {body.trim().length > 0 && body.trim().length < 10 && <p className="mt-2 text-xs text-gray-600">Please write at least 10 characters.</p>}
      </Card>
    </div>
  )
}

export function EmptyMessages() {
  return <EmptyState title="No messages" body="Start a conversation from a tutor profile." />
}
