// Development-only demo accounts: two each of tutor, coaching centre, guardian
// and student, plus connected records (links, tuition posts, applications,
// messages, an active tuition with a classroom, a coaching batch, results,
// fees, reviews and a support ticket).
//
// Everything goes through the real HTTP API, exactly as the web app would, so
// verification follows the normal workflow: the account uploads pictures and
// submits, and an administrator decides. Running the script again creates
// nothing twice.
//
//   DEMO_API=http://localhost:8080 node scripts/seed-demo.mjs --yes
//
// Passwords live only in the git-ignored .env.demo.local (generated on first
// run); a private credential report is written to .runtime/. Optional
// DEMO_ADMIN_EMAIL / DEMO_ADMIN_PASSWORD let the script record the approval of
// the first tutor and centre; without them those stay pending for you to
// review in the admin dashboard, and a rerun after approval adds the rest.
// See docs/demo-accounts.md.

import { randomInt } from 'node:crypto'
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const root = new URL('../', import.meta.url)
const ENV_FILE = new URL('.env.demo.local', root)
const fixture = (name) => readFileSync(new URL(`tests/fixtures/${name}`, root))
const PNG = fixture('id-card.png')
const JPEG = fixture('certificate.jpg')
const PDF = Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n')

// ---------- safety checks ----------
function fatal(message) { console.error(`seed-demo: ${message}`); process.exit(2) }
if (!process.argv.includes('--yes')) fatal('pass --yes to confirm you are seeding a local development server')
if ([process.env.APP_ENV, process.env.NODE_ENV].includes('production')) fatal('refusing to run with a production environment')
const API = process.env.DEMO_API
if (!API) fatal('DEMO_API is required (for example http://localhost:8080)')
const apiHost = new URL(API).hostname
if (!['localhost', '127.0.0.1', '[::1]', '::1'].includes(apiHost)) fatal(`refusing to seed a non-local API (${apiHost})`)
const WEB = process.env.DEMO_WEB ?? 'http://localhost:5173'
const LABEL = (process.env.DEMO_LABEL ?? 'dev').replace(/[^a-z0-9_-]/gi, '')

// ---------- local credentials ----------
function readEnvFile() {
  const values = {}
  if (!existsSync(ENV_FILE)) return values
  for (const line of readFileSync(ENV_FILE, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) values[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
  }
  return values
}
const envValues = readEnvFile()
function generatePassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  const group = () => Array.from({ length: 4 }, () => alphabet[randomInt(alphabet.length)]).join('')
  return `Demo-${group()}-${group()}-${group()}`
}
function passwordFor(key) {
  const name = `DEMO_${key.toUpperCase()}_PASSWORD`
  if (!envValues[name]) {
    envValues[name] = generatePassword()
    const header = '# Local demo-account passwords for scripts/seed-demo.mjs. Git ignores this file; never commit it.\n'
    const body = Object.entries(envValues).map(([k, v]) => `${k}=${v}`).join('\n')
    writeFileSync(ENV_FILE, header + body + '\n', { mode: 0o600 })
    chmodSync(ENV_FILE, 0o600)
  }
  return envValues[name]
}

// ---------- HTTP ----------
async function call(method, path, { token, body, form } = {}) {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  let payload
  if (form) payload = form
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body) }
  const res = await fetch(API + path, { method, headers, body: payload })
  const type = res.headers.get('content-type') ?? ''
  const data = type.includes('application/json') ? await res.json().catch(() => null) : null
  return { status: res.status, data }
}
const GET = (p, t) => call('GET', p, { token: t })
const POST = (p, t, body) => call('POST', p, { token: t, body })
const PUT = (p, t, body) => call('PUT', p, { token: t, body })
function upload(token, path, field, bytes, name, mime, extra = {}) {
  const form = new FormData()
  for (const [k, v] of Object.entries(extra)) form.append(k, v)
  form.append(field, new Blob([bytes], { type: mime }), name)
  return call('POST', path, { token, form })
}
function expect(res, ok, what) {
  if (!ok.includes(res.status)) throw new Error(`${what}: HTTP ${res.status} ${JSON.stringify(res.data)}`)
  return res
}

const log = []
const note = (msg) => { log.push(msg); console.log(`  ${msg}`) }
const future = (days, hour = 17) => { const d = new Date(Date.now() + days * 86400000); d.setUTCHours(hour - 6, 0, 0, 0); return d.toISOString() }
const today = () => new Date().toISOString().slice(0, 10)
const month = new Date().toISOString().slice(0, 7)

// ---------- accounts ----------
const accounts = {
  tutor1: { role: 'tutor', name: 'Arif Hossain', email: 'demo.tutor1@example.test', approve: true },
  tutor2: { role: 'tutor', name: 'Sadia Rahman', email: 'demo.tutor2@example.test', approve: false },
  coaching1: { role: 'coaching', name: 'Bright Future Coaching', email: 'demo.coaching1@example.test', approve: true },
  coaching2: { role: 'coaching', name: 'Pathshala Academy', email: 'demo.coaching2@example.test', approve: false },
  parent1: { role: 'parent', name: 'Farzana Akter', email: 'demo.parent1@example.test' },
  parent2: { role: 'parent', name: 'Kamal Uddin', email: 'demo.parent2@example.test' },
  student1: { role: 'student', name: 'Rafi Hasan', email: 'demo.student1@example.test' },
  student2: { role: 'student', name: 'Nabila Islam', email: 'demo.student2@example.test' },
}

let devServerConfirmed = false
async function ensureAccount(key) {
  const a = accounts[key]
  a.password = passwordFor(key)
  let res = await POST('/api/v1/auth/login', undefined, { email: a.email, password: a.password })
  if (res.status === 200) {
    a.created = false
  } else if (res.status === 401) {
    res = await POST('/api/v1/auth/register', undefined, { name: a.name, email: a.email, password: a.password, role: a.role })
    if (res.status === 409) fatal(`${a.email} already exists with a different password; it was left untouched`)
    expect(res, [201], `register ${key}`)
    a.created = true
    note(`created ${a.role} account ${a.email}`)
  } else {
    expect(res, [200], `login ${key}`)
  }
  a.token = res.data.tokens.access_token
  a.id = res.data.user.id
  a.emailVerified = !!res.data.user.email_verified_at
  if (!a.emailVerified) {
    // The development email workflow: a non-production server returns the token
    // instead of emailing it. Its absence means this is not a development server.
    const req = await POST('/api/v1/auth/verify-email/request', undefined, { email: a.email })
    if (req.status === 429) { note(`email verification for ${a.email} deferred (rate limit); run again later`); return }
    expect(req, [202], `verify-email request ${key}`)
    if (!req.data?.development_token) fatal('the server did not return a development token: it is not a development server. Stopping.')
    devServerConfirmed = true
    const v = await POST('/api/v1/auth/verify-email', undefined, { token: req.data.development_token })
    if (v.status === 429) { note(`email verification for ${a.email} deferred (rate limit); run again later`); return }
    expect(v, [200, 204], `verify-email ${key}`)
    a.emailVerified = true
    note(`verified email of ${a.email} (development token, no email sent)`)
  }
}

// ---------- profiles and verification ----------
const reviewedProfiles = {
  tutor1: { display_name: 'Arif Hossain', education: 'BSc in Physics, University of Dhaka', subjects: ['Physics', 'Mathematics', 'Higher Math'], classes: ['Class 9', 'Class 10', 'HSC'], areas: ['Uttara', 'Mirpur'] },
  tutor2: { display_name: 'Sadia Rahman', education: 'BA in English, Jahangirnagar University', subjects: ['English', 'Bangla'], classes: ['Class 6', 'Class 8', 'SSC'], areas: ['Dhanmondi', 'Mohammadpur'] },
  coaching1: { display_name: 'Bright Future Coaching', institution: 'Bright Future Coaching Centre', education: 'Trade licence TRAD/DNCC/0451/2024', subjects: ['Mathematics', 'Physics', 'Chemistry', 'English'], classes: ['SSC', 'HSC'], areas: ['Mohakhali', 'Banani'] },
  coaching2: { display_name: 'Pathshala Academy', institution: 'Pathshala Academy', education: 'Trade licence TRAD/DSCC/0782/2023', subjects: ['Bangla', 'English', 'ICT'], classes: ['Class 8', 'SSC'], areas: ['Mirpur 10'] },
}
const extraProfiles = {
  tutor1: { bio: 'I teach physics by building intuition first, then practising board and admission questions.', fee_expectation: 8000, experience_years: 5, teaching_modes: ['offline', 'online'], mediums: ['Bangla Medium', 'English Version'], current_study: 'MSc in Applied Physics (ongoing)', results: 'CGPA 3.78; HSC GPA 5.00', availability: { days: ['Sun', 'Tue', 'Thu'], time: 'Evening' }, gender: 'male', district: 'Dhaka', listed: true },
  tutor2: { bio: 'Patient English and Bangla tutor focused on grammar, writing and reading habits.', fee_expectation: 5000, experience_years: 3, teaching_modes: ['offline'], mediums: ['Bangla Medium'], current_study: 'MA in English Literature', results: 'CGPA 3.65', availability: { days: ['Sat', 'Mon', 'Wed'], time: 'Afternoon' }, gender: 'female', district: 'Dhaka' },
  coaching1: { bio: 'Small-batch SSC and HSC science coaching with monthly model tests.', address: 'House 12, Road 5, Mohakhali DOHS, Dhaka', district: 'Dhaka', established: '2016', opening_hours: 'Sat-Thu, 3:00 PM - 9:00 PM' },
  coaching2: { bio: 'Language and ICT coaching for Class 8 and SSC students.', address: 'Section 10, Mirpur, Dhaka', district: 'Dhaka', established: '2019', opening_hours: 'Sat-Thu, 4:00 PM - 8:00 PM' },
  parent1: { address: 'Sector 7, Uttara, Dhaka', district: 'Dhaka', guardian_notes: 'Prefers evening classes at home.' },
  parent2: { address: 'Mirpur 10, Dhaka', district: 'Dhaka', guardian_notes: 'Interested in English support and coaching for SSC.' },
  student1: { class_name: 'HSC', institution: 'Uttara High School and College', address: 'Sector 7, Uttara, Dhaka', district: 'Dhaka', mediums: ['Bangla Medium'] },
  student2: { class_name: 'SSC', institution: 'Mirpur Girls Ideal School', address: 'Mirpur 10, Dhaka', district: 'Dhaka', mediums: ['Bangla Medium'] },
}
const verificationDocs = {
  tutor: [['identity', PNG, 'national-id.png', 'image/png'], ['education', JPEG, 'certificate.jpg', 'image/jpeg']],
  coaching: [['trade_license', JPEG, 'trade-licence.jpg', 'image/jpeg'], ['owner_identity', PNG, 'owner-id.png', 'image/png']],
}

let adminToken = null
async function adminLogin() {
  const email = process.env.DEMO_ADMIN_EMAIL ?? envValues.DEMO_ADMIN_EMAIL
  const password = process.env.DEMO_ADMIN_PASSWORD ?? envValues.DEMO_ADMIN_PASSWORD
  if (!email || !password) return null
  const res = await POST('/api/v1/auth/login', undefined, { email, password })
  if (res.status !== 200 || res.data.user.role !== 'admin') { note('admin login failed; approvals skipped'); return null }
  return res.data.tokens.access_token
}

async function dashboard(a) { return expect(await GET('/api/v1/workflow/dashboard', a.token), [200], `dashboard ${a.email}`).data }

async function ensureVerification(key) {
  const a = accounts[key]
  let d = await dashboard(a)
  let status = d.verification?.status ?? null
  if (status === null || status === 'draft' || status === 'correction_requested' || status === 'rejected') {
    const have = new Set((d.documents ?? []).map((doc) => doc.document_type ?? doc.type))
    for (const [type, bytes, name, mime] of verificationDocs[a.role]) {
      if (have.has(type)) continue
      expect(await upload(a.token, '/api/v1/workflow/verification/documents', 'document', bytes, name, mime, { document_type: type }), [200, 201, 204], `upload ${type} for ${key}`)
      note(`${a.email}: uploaded ${type} picture`)
    }
    expect(await PUT('/api/v1/workflow/profile', a.token, reviewedProfiles[key]), [204], `profile ${key}`)
    expect(await POST('/api/v1/workflow/verification/submit', a.token), [202], `submit ${key}`)
    note(`${a.email}: verification submitted for manual review`)
    d = await dashboard(a)
    status = d.verification?.status
  }
  if ((status === 'pending' || status === 'under_review') && a.approve && adminToken) {
    expect(await POST(`/api/v1/workflow/admin/verifications/${d.verification.id}/decision`, adminToken, { decision: 'approved' }), [204], `approve ${key}`)
    note(`${a.email}: approved by the administrator account`)
    d = await dashboard(a)
    status = d.verification?.status
  }
  a.verification = status
  a.verified = status === 'approved'
}

// Only empty fields are filled, so edits made later in the app survive a rerun.
async function ensureProfile(key) {
  const a = accounts[key]
  let d = await dashboard(a)
  const empty = (v) => v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)
  const patch = Object.fromEntries(Object.entries(extraProfiles[key]).filter(([k]) => empty(d.profile?.[k])))
  if (Object.keys(patch).length) {
    expect(await PUT('/api/v1/workflow/profile', a.token, patch), [204], `profile details ${key}`)
    note(`${a.email}: profile details filled in`)
  }
  if ((a.role === 'tutor' || a.role === 'coaching') && !d.profile?.has_photo) {
    expect(await upload(a.token, '/api/v1/profile/photo', 'photo', JPEG, 'photo.jpg', 'image/jpeg'), [204], `photo ${key}`)
    note(`${a.email}: profile photo added`)
  }
  d = await dashboard(a)
  a.accountStatus = d.account.status
}

// ---------- connected records ----------
async function ensureLink(guardianKey, studentKey, relationship) {
  const g = accounts[guardianKey], s = accounts[studentKey]
  let link = (await GET('/api/v1/links', g.token)).data.links.find((l) => l.student_id === s.id)
  if (!link) {
    expect(await POST('/api/v1/links', g.token, { student_email: s.email, relationship }), [201], `link ${guardianKey}`)
    link = (await GET('/api/v1/links', g.token)).data.links.find((l) => l.student_id === s.id)
    note(`${g.email} asked to link ${s.email} as ${relationship}`)
  }
  if (link.status === 'pending') {
    expect(await POST(`/api/v1/links/${link.id}/respond`, s.token, { accept: true }), [204], `approve link ${studentKey}`)
    note(`${s.email} approved the guardian link`)
  }
}

async function ensurePost(ownerKey, post) {
  const o = accounts[ownerKey]
  const mine = (await GET('/api/v1/tuition-posts/mine', o.token)).data.posts
  const found = mine.find((p) => p.subject === post.subject && p.class_name === post.class_name && (!post.student_id || p.student_id === post.student_id))
  if (found) return found.id
  const res = expect(await POST('/api/v1/tuition-posts', o.token, post), [201], `post by ${ownerKey}`)
  note(`${o.email} posted a ${post.subject} (${post.class_name}) tuition`)
  return res.data.id
}

async function ensureApplication(tutorKey, postId, noteText) {
  const t = accounts[tutorKey]
  let app = (await GET('/api/v1/applications/mine', t.token)).data.applications.find((x) => x.listing_id === postId)
  if (!app) {
    expect(await POST(`/api/v1/tuition-posts/${postId}/apply`, t.token, { note: noteText }), [201], `apply ${tutorKey}`)
    app = (await GET('/api/v1/applications/mine', t.token)).data.applications.find((x) => x.listing_id === postId)
    note(`${t.email} applied to tuition post`)
  }
  return app
}

async function ensureMessages(convId, lines) {
  const first = accounts[lines[0][0]]
  const existing = (await GET(`/api/v1/conversations/${convId}/messages`, first.token)).data.messages
  const sent = new Set(existing.map((m) => m.body))
  for (const [who, body] of lines) {
    if (sent.has(body)) continue
    expect(await POST(`/api/v1/conversations/${convId}/messages`, accounts[who].token, { body }), [201], `message from ${who}`)
  }
}

async function tuitionJourney() {
  const { tutor1: t, parent1: p, student1: s, parent2: p2, student2: s2 } = accounts
  const post1 = await ensurePost('parent1', { subject: 'Physics', class_name: 'HSC', medium: 'Bangla Medium', area: 'Uttara', mode: 'offline', days: 'Sun, Tue, Thu', time_slot: '6:30-7:30 PM', budget: 8000, requirements: 'Board and admission preparation; prefers a tutor with HSC physics experience.', student_id: s.id })
  const post2 = await ensurePost('parent2', { subject: 'English', class_name: 'SSC', medium: 'Bangla Medium', area: 'Mirpur', mode: 'offline', days: 'Sat, Mon, Wed', time_slot: '5:00-6:00 PM', budget: 5000, requirements: 'Grammar and composition practice for SSC.', student_id: s2.id })
  await ensurePost('student1', { subject: 'ICT', class_name: 'HSC', medium: 'Bangla Medium', area: 'Uttara', mode: 'online', days: 'Fri', time_slot: '10:00-11:00 AM', budget: 3000, requirements: 'Programming basics (C) for HSC ICT.' })
  if (!t.verified) { note('tutor1 is not approved yet: applications, chat and tuition records wait for approval'); return }

  // Parent 1 hires tutor 1: application -> shortlist -> accept -> chat -> demo class -> agreement.
  let app = await ensureApplication('tutor1', post1, 'Five years teaching HSC physics; I can start next week.')
  if (app.status === 'applied') { expect(await POST(`/api/v1/applications/${app.id}/status`, p.token, { status: 'shortlisted' }), [200], 'shortlist'); app.status = 'shortlisted' }
  let conv
  if (app.status === 'shortlisted') {
    conv = expect(await POST(`/api/v1/applications/${app.id}/status`, p.token, { status: 'accepted' }), [200], 'accept').data.conversation_id
    note(`${p.email} accepted ${t.email}'s application; a conversation opened`)
  }
  conv ??= (await GET('/api/v1/conversations', p.token)).data.conversations.find((c) => c.other_id === t.id || c.other_name === t.name)?.id
  if (conv) await ensureMessages(conv, [['parent1', 'Assalamu alaikum! Could you take a demo class this week?'], ['tutor1', 'Walaikum assalam. Yes, Sunday evening works for me.'], ['parent1', 'Great, I will send the demo class request now.']])

  let eng = (await GET('/api/v1/engagements', p.token)).data.engagements.find((e) => e.tutor_id === t.id && e.student_id === s.id && e.status !== 'cancelled')
  if (!eng) {
    const id = expect(await POST('/api/v1/engagements', p.token, { tutor_id: t.id, student_id: s.id, listing_id: post1, subject: 'Physics', class_name: 'HSC', mode: 'offline', trial_at: future(2), trial_note: 'Demo class at home, Uttara Sector 7' }), [201], 'demo request').data.id
    note(`${p.email} requested a demo class`)
    eng = { id, status: 'trial_requested' }
  }
  const act = (token, body) => POST(`/api/v1/engagements/${eng.id}/actions`, token, body)
  const refresh = async () => (await GET('/api/v1/engagements', p.token)).data.engagements.find((e) => e.id === eng.id)
  eng = await refresh()
  if (eng.status === 'trial_requested') { expect(await act(t.token, { action: 'accept_trial' }), [200], 'accept trial'); note(`${t.email} accepted the demo class`); eng = await refresh() }
  if (!eng.tutor_confirmed_at && !eng.client_confirmed_at && eng.status !== 'active') { expect(await act(t.token, { action: 'propose', days: 'Sun, Tue, Thu', time_slot: '6:30-7:30 PM', mode: 'offline', monthly_fee: 8000, start_date: future(4).slice(0, 10), location_note: 'Uttara Sector 7' }), [200], 'propose'); note(`${t.email} proposed tuition terms`); eng = await refresh() }
  if (eng.status !== 'active') { expect(await act(p.token, { action: 'confirm' }), [200], 'confirm'); note(`${p.email} confirmed the tuition; classroom created`); eng = await refresh() }
  const room = eng.classroom_id

  // Classroom: notes, assignments, a graded submission, schedule, attendance, diary.
  let detail = (await GET(`/api/v1/classrooms/${room}`, t.token)).data
  if (!detail.materials.some((m) => m.title === 'Vectors - chapter notes')) {
    expect(await upload(t.token, `/api/v1/classrooms/${room}/materials`, 'file', PDF, 'vectors-notes.pdf', 'application/pdf', { title: 'Vectors - chapter notes', body: 'Read sections 3.1-3.3 before Sunday.' }), [204], 'material')
    note('tutor1 shared class notes')
  }
  for (const [title, kind, days, max] of [['Vectors worksheet 1', 'homework', 3, 20], ['Model test: Motion', 'assignment', 7, 50]]) {
    if (!detail.assignments.some((x) => x.title === title)) {
      expect(await POST(`/api/v1/classrooms/${room}/assignments`, t.token, { kind, title, instructions: 'Show all working.', due_at: future(days), max_score: max }), [204], `assignment ${title}`)
      note(`tutor1 created "${title}"`)
    }
  }
  detail = (await GET(`/api/v1/classrooms/${room}`, s.token)).data
  const ws = detail.assignments.find((x) => x.title === 'Vectors worksheet 1')
  if (!ws.my_status) { expect(await upload(s.token, `/api/v1/assignments/${ws.id}/submit`, 'file', PNG, 'worksheet-answers.png', 'image/png', { note: 'Answers attached.' }), [201], 'submit'); note('student1 submitted the worksheet') }
  const sub = (await GET(`/api/v1/assignments/${ws.id}/submissions`, t.token)).data.submissions[0]
  if (sub && sub.status !== 'reviewed') { expect(await POST(`/api/v1/submissions/${sub.id}/review`, t.token, { score: 17, feedback: 'Good work; revise question 4.', status: 'reviewed' }), [204], 'grade'); note('tutor1 graded the submission') }
  detail = (await GET(`/api/v1/classrooms/${room}`, t.token)).data
  if (detail.sessions.length === 0) {
    expect(await POST(`/api/v1/classrooms/${room}/sessions`, t.token, { starts_at: future(1, 18), ends_at: future(1, 19), repeat_weeks: 3 }), [204], 'sessions')
    note('tutor1 scheduled 4 weekly classes')
    detail = (await GET(`/api/v1/classrooms/${room}`, t.token)).data
  }
  const firstSession = detail.sessions[0]
  if (!(firstSession.marks ?? []).length) { expect(await POST(`/api/v1/sessions/${firstSession.id}/attendance`, t.token, { marks: [{ learner_kind: 'user', learner_id: s.id, mark: 'present' }] }), [204], 'attendance'); note('tutor1 marked attendance') }
  if (!detail.diary.some((x) => x.entry_date?.slice(0, 10) === today())) { expect(await POST(`/api/v1/classrooms/${room}/diary`, t.token, { entry_date: today(), topics: 'Vectors: resolution and dot product', homework: 'Worksheet 1, questions 1-6' }), [204], 'diary'); note('tutor1 wrote a class diary entry') }

  // Fee tracking and a review.
  const ledger = (await GET(`/api/v1/engagements/${eng.id}/payments`, p.token)).data.payments
  let pay = ledger.find((x) => x.month === month)
  if (!pay) { expect(await POST(`/api/v1/engagements/${eng.id}/payments`, t.token, { action: 'due', month }), [204], 'due'); pay = { status: 'due' } }
  if (pay.status === 'due') { expect(await POST(`/api/v1/engagements/${eng.id}/payments`, p.token, { action: 'mark_paid', month, note: 'Paid by bKash' }), [204], 'mark paid'); pay.status = 'marked_paid' }
  if (pay.status === 'marked_paid') { expect(await POST(`/api/v1/engagements/${eng.id}/payments`, t.token, { action: 'confirm', month }), [204], 'confirm payment'); note(`fee for ${month} recorded, marked paid and confirmed`) }
  const reviewBody = 'Explains clearly and is always punctual. Rafi enjoys physics now.'
  if (!((await GET(`/api/v1/users/${t.id}/reviews`, p.token)).data.reviews ?? []).some((r) => r.body === reviewBody)) {
    expect(await POST(`/api/v1/engagements/${eng.id}/review`, p.token, { stars: 5, body: reviewBody }), [204], 'review')
    note(`${p.email} reviewed ${t.email}`)
  }

  // Parent 2: tutor 1 applies to their post (left for you to shortlist), and a
  // chat request to tutor 1 is left pending for you to accept.
  await ensureApplication('tutor1', post2, 'I also teach SSC English grammar on weekends.')
  const requests = (await GET('/api/v1/chat-requests', p2.token)).data
  const all = [...(requests.sent ?? []), ...(requests.received ?? []), ...(requests.requests ?? [])]
  if (!all.some((r) => r.to_id === t.id)) {
    expect(await POST('/api/v1/chat-requests', p2.token, { to_id: t.id, student_id: s2.id, message: 'Assalamu alaikum, can you help Nabila with SSC physics?' }), [201], 'chat request')
    note(`${p2.email} sent a chat request to ${t.email} (left pending)`)
  }
}

async function coachingJourney() {
  const c = accounts.coaching1
  if (!c.verified) { note('coaching1 is not approved yet: batches and fees wait for approval'); return }
  const list = async (path, field) => (await GET(`/api/v1/coaching/${path}`, c.token)).data[field]
  const ensureNamed = async (path, field, body, label) => {
    const found = (await list(path, field)).find((x) => x.name === body.name)
    if (found) return found.id
    note(`coaching1 added ${label} "${body.name}"`)
    return expect(await POST(`/api/v1/coaching/${path}`, c.token, body), [201], `${path} ${body.name}`).data.id
  }
  const maths = await ensureNamed('teachers', 'teachers', { name: 'Anwar Hossain', subject: 'Mathematics', qualification: 'MSc in Mathematics' }, 'teacher')
  const physics = await ensureNamed('teachers', 'teachers', { name: 'Shirin Sultana', subject: 'Physics', qualification: 'MSc in Physics' }, 'teacher')
  const course = await ensureNamed('courses', 'courses', { name: 'SSC Science Package', description: 'Maths and physics for SSC candidates.', subjects: ['Mathematics', 'Physics'], monthly_fee: 3500 }, 'course')
  const branch = await ensureNamed('branches', 'branches', { name: 'Mohakhali Branch', address: 'House 12, Road 5, Mohakhali DOHS' }, 'branch')
  const batchA = await ensureNamed('batches', 'batches', { name: 'SSC Maths - Batch A', subject: 'Mathematics', class_name: 'SSC', course_id: course, branch_id: branch, teacher_id: maths, days: 'Sat, Mon, Wed', time_slot: '4:00-5:30 PM', room: '201', capacity: 25, monthly_fee: 3500 }, 'batch')
  await ensureNamed('batches', 'batches', { name: 'SSC Physics - Batch B', subject: 'Physics', class_name: 'SSC', course_id: course, branch_id: branch, teacher_id: physics, days: 'Sun, Tue, Thu', time_slot: '5:00-6:30 PM', room: '202', capacity: 25, monthly_fee: 3500 }, 'batch')
  const nabila = await ensureNamed('students', 'students', { name: 'Nabila Islam', class_name: 'SSC', guardian_name: 'Kamal Uddin', student_email: accounts.student2.email, guardian_email: accounts.parent2.email }, 'student')
  const walkIn = await ensureNamed('students', 'students', { name: 'Tanvir Alam', class_name: 'SSC', guardian_name: 'Rokeya Begum' }, 'student')
  const roster = await list('students', 'students')
  for (const id of [nabila, walkIn]) {
    if (!roster.find((r) => r.id === id)?.batch_ids?.includes(batchA)) { expect(await POST(`/api/v1/coaching/batches/${batchA}/enrollments/${id}`, c.token), [204], 'enrol'); note('coaching1 enrolled a student in Batch A') }
  }
  const batch = (await list('batches', 'batches')).find((b) => b.id === batchA)
  const room = batch.classroom_id
  let detail = (await GET(`/api/v1/classrooms/${room}`, c.token)).data
  if (detail.sessions.length === 0) {
    expect(await POST(`/api/v1/classrooms/${room}/sessions`, c.token, { starts_at: future(1, 16), ends_at: future(1, 17), repeat_weeks: 2 }), [204], 'batch sessions')
    detail = (await GET(`/api/v1/classrooms/${room}`, c.token)).data
    note('coaching1 scheduled Batch A classes')
  }
  if (!(detail.sessions[0].marks ?? []).length) { expect(await POST(`/api/v1/sessions/${detail.sessions[0].id}/attendance`, c.token, { marks: [{ learner_kind: 'roster', learner_id: nabila, mark: 'present' }, { learner_kind: 'roster', learner_id: walkIn, mark: 'late' }] }), [204], 'batch attendance'); note('coaching1 took Batch A attendance') }
  if (!detail.assignments.some((x) => x.title === 'Algebra practice set 1')) { expect(await POST(`/api/v1/classrooms/${room}/assignments`, c.token, { kind: 'homework', title: 'Algebra practice set 1', instructions: 'Exercise 4.2, all questions.', due_at: future(4), max_score: 10 }), [204], 'batch homework'); note('coaching1 set Batch A homework') }
  let exam = (await list('exams', 'exams')).find((e) => e.title === 'Monthly model test')
  if (!exam) { const id = expect(await POST('/api/v1/coaching/exams', c.token, { batch_id: batchA, title: 'Monthly model test', exam_date: today(), total_marks: 50 }), [201], 'exam').data.id; exam = { id }; note('coaching1 created an exam') }
  if (!exam.published_at) { expect(await POST(`/api/v1/coaching/exams/${exam.id}/marks`, c.token, { marks: { [nabila]: 44, [walkIn]: 36 }, publish: true }), [204], 'marks'); note('coaching1 published exam marks') }
  expect(await POST('/api/v1/coaching/fees/generate', c.token, { month }), [200], 'fees')
  const fees = (await GET(`/api/v1/coaching/fees?month=${month}`, c.token)).data.fees
  const walkInFee = fees.find((f) => f.student_id === walkIn)
  if (walkInFee && walkInFee.status !== 'paid') { expect(await POST(`/api/v1/coaching/fees/${walkInFee.id}/paid`, c.token), [204], 'fee paid'); note(`coaching1 recorded a ${month} fee payment`) }
}

async function supportJourney() {
  const s = accounts.student2
  const title = 'How do I see my coaching results?'
  if (!(await GET('/api/v1/support-tickets/mine', s.token)).data.tickets.some((t) => t.title === title)) {
    expect(await POST('/api/v1/support-tickets', s.token, { category: 'support', title, body: 'I joined a coaching batch and want to know where published marks appear.' }), [201], 'ticket')
    note(`${s.email} opened a support ticket`)
  }
}

// ---------- report ----------
function writeReport() {
  mkdirSync(new URL('.runtime/', root), { recursive: true })
  const file = new URL(`.runtime/demo-accounts-${LABEL}.md`, root)
  const rows = Object.entries(accounts).map(([key, a]) => {
    const verification = a.role === 'tutor' || a.role === 'coaching' ? (a.verification ?? 'not submitted') : 'not required'
    return `| ${a.role} | ${a.name} | ${a.email} | \`${a.password}\` | ${a.accountStatus ?? '?'} | ${verification} | ${a.emailVerified ? 'verified' : 'pending'} |`
  })
  const text = `# TuitionHub demo accounts (${LABEL}) — PRIVATE, do not commit\n\nAPI: ${API}  \nLogin: ${WEB}/login  \nGenerated: ${new Date().toISOString()}\n\n| Role | Name | Email | Password | Account status | Verification | Email |\n|---|---|---|---|---|---|---|\n${rows.join('\n')}\n\nNo real email is sent: email addresses were verified with the development token workflow.\n`
  writeFileSync(file, text, { mode: 0o600 })
  chmodSync(file, 0o600)
  return decodeURIComponent(file.pathname)
}

async function main() {
  console.log(`Seeding demo accounts through ${API} (${LABEL})`)
  for (const key of Object.keys(accounts)) await ensureAccount(key)
  adminToken = await adminLogin()
  for (const key of ['tutor1', 'tutor2', 'coaching1', 'coaching2']) await ensureVerification(key)
  for (const key of Object.keys(accounts)) await ensureProfile(key)
  await ensureLink('parent1', 'student1', 'mother')
  await ensureLink('parent2', 'student2', 'father')
  await tuitionJourney()
  await coachingJourney()
  await supportJourney()
  for (const a of Object.values(accounts)) a.accountStatus = (await dashboard(a)).account.status // for the report
  const report = writeReport()
  console.log(`\nDone. ${log.length} changes. Private credential report: ${report}`)
  if (!devServerConfirmed) console.log('(All accounts already had verified emails; the development-server check relied on the local address.)')
}

main().catch((e) => { console.error(e.message ?? e); process.exit(1) })
