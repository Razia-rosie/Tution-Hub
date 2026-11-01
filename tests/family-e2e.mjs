// End-to-end test of parent and student verification through the real API and
// database: parent signup, NID and child birth certificate, admin approval of
// the parent, the child email, admin permission to register, the child's own
// signup with that exact email, the student's birth certificate and the
// separate admin review of the student — plus the refusals and permission
// checks around every step.
//
//   E2E_API=http://localhost:8090 E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... node tests/family-e2e.mjs
//
// Run only against an isolated *_e2e database (see backend/README.md).

import { readFileSync } from 'node:fs'

const API = process.env.E2E_API ?? 'http://localhost:8090'
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) { console.error('E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD are required'); process.exit(2) }

let pass = 0
let fail = 0
const failures = []
function check(name, ok, detail = '') {
  if (ok) { pass++; console.log('PASS', name) } else { fail++; failures.push(name); console.log('FAIL', name, detail) }
}

async function call(method, path, { token, body, form } = {}) {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  let payload
  if (form) payload = form
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body) }
  const res = await fetch(API + path, { method, headers, body: payload })
  const type = res.headers.get('content-type') ?? ''
  const data = type.includes('application/json') ? await res.json().catch(() => null) : Buffer.from(await res.arrayBuffer())
  return { status: res.status, data, headers: res.headers }
}
const GET = (p, token) => call('GET', p, { token })
const POST = (p, token, body) => call('POST', p, { token, body })
const PUT = (p, token, body) => call('PUT', p, { token, body })
const show = (r) => `${r.status} ${JSON.stringify(r.data).slice(0, 200)}`

const run = Math.random().toString(36).slice(2, 8)
const password = `Fam1ly-${run}-pw`
const email = (label) => `fam-${label}-${run}@tuitionhub.test`
const PNG = readFileSync(new URL('./fixtures/id-card.png', import.meta.url))
const JPEG = readFileSync(new URL('./fixtures/certificate.jpg', import.meta.url))

async function register(label, role, name, pw = password) {
  return call('POST', '/api/v1/auth/register', { body: { name: name ?? `Fam ${label} ${run}`, email: email(label), password: pw, role } })
}
async function account(label, role, name) {
  const r = await register(label, role, name)
  if (r.status !== 201) throw new Error(`register ${label}: ${show(r)}`)
  return { token: r.data.tokens.access_token, id: r.data.user.id, email: email(label), status: r.data.user.account_status }
}
const login = async (address, pw = password) => (await POST('/api/v1/auth/login', undefined, { email: address, password: pw }))
const upload = (token, type, bytes = PNG, mime = 'image/png') => {
  const form = new FormData()
  form.append('document_type', type)
  form.append('document', new Blob([bytes], { type: mime }), `${type}.${mime === 'image/png' ? 'png' : 'jpg'}`)
  return call('POST', '/api/v1/workflow/verification/documents', { token, form })
}
const dashboard = async (u) => (await GET('/api/v1/workflow/dashboard', u.token)).data
const family = async (u) => (await GET('/api/v1/workflow/family', u.token)).data
const apps = async (admin, role, status = '') => (await GET(`/api/v1/workflow/admin/verifications?role=${role}${status ? `&status=${status}` : ''}`, admin)).data.applications ?? []
const invitations = async (admin, status = '') => (await GET(`/api/v1/workflow/admin/student-invitations${status ? `?status=${status}` : ''}`, admin)).data.invitations ?? []

/** A parent who uploads both pictures and submits; returns the parent with their application id. */
async function submittedParent(label, name) {
  const p = await account(label, 'parent', name)
  await upload(p.token, 'parent_nid')
  await upload(p.token, 'child_birth_certificate', JPEG, 'image/jpeg')
  await PUT('/api/v1/workflow/profile', p.token, { display_name: name ?? `Fam ${label} ${run}`, address: 'House 1, Road 2, Mirpur, Dhaka' })
  const s = await POST('/api/v1/workflow/verification/submit', p.token)
  if (s.status !== 202) throw new Error(`submit ${label}: ${show(s)}`)
  p.application = s.data.verification.id
  return p
}
const decide = (admin, application, decision, reason = '') => POST(`/api/v1/workflow/admin/verifications/${application}/decision`, admin, { decision, reason })
const allow = (admin, invitation, decision = 'approved', reason = '') => POST(`/api/v1/workflow/admin/student-invitations/${invitation}/decision`, admin, { decision, reason })
const invite = (p, childEmail, relationship = 'mother', childName = '') => POST('/api/v1/workflow/family/invitations', p.token, { child_email: childEmail, relationship, child_name: childName })

async function main() {
  const adminLogin = await login(ADMIN_EMAIL, ADMIN_PASSWORD)
  if (adminLogin.status !== 200) throw new Error(`admin login: ${show(adminLogin)}`)
  const admin = adminLogin.data.tokens.access_token

  // ---------- 1. parent creates an account ----------
  const parent = await account('parent', 'parent', `Salma Parent ${run}`)
  check('1. parent signs up pending, not verified', parent.status === 'pending')
  let d = await dashboard(parent)
  check('1. parent dashboard lists NID and child birth certificate as required', JSON.stringify(d.requirements.map((r) => r.type)) === JSON.stringify(['parent_nid', 'child_birth_certificate']), JSON.stringify(d.requirements))
  check('1. pending parent cannot post tuition', (await POST('/api/v1/tuition-posts', parent.token, { subject: 'Physics', class_name: 'HSC', area: 'Uttara', mode: 'offline' })).status === 403)
  check('1. pending parent cannot request a guardian link', (await POST('/api/v1/links', parent.token, { student_email: email('nobody'), relationship: 'mother' })).status === 403)
  check('1. parent cannot ask for a child account before submitting verification', (await invite(parent, email('child'))).status === 409)

  // ---------- 2-4. parent uploads NID + child's birth certificate, submits ----------
  check('2. parent cannot upload a tutor document type', (await upload(parent.token, 'identity')).status === 400)
  check('2. parent uploads their NID', (await upload(parent.token, 'parent_nid')).status === 201)
  let r = await POST('/api/v1/workflow/verification/submit', parent.token)
  check('3. submit without the child birth certificate lists what is missing', r.status === 422 && r.data.missing.includes("Your child's birth certificate") && r.data.missing.includes('Your address'), show(r))
  check("3. parent uploads the child's birth certificate", (await upload(parent.token, 'child_birth_certificate', JPEG, 'image/jpeg')).status === 201)
  check('4. parent saves profile', (await PUT('/api/v1/workflow/profile', parent.token, { display_name: `Salma Parent ${run}`, address: 'House 1, Road 2, Mirpur, Dhaka' })).status === 204)
  r = await POST('/api/v1/workflow/verification/submit', parent.token)
  check('4. parent submits verification', r.status === 202 && r.data.verification.status === 'pending', show(r))
  parent.application = r.data.verification.id
  d = await dashboard(parent)
  check('4. parent dashboard shows Pending Admin Review state', d.account.status === 'pending' && d.verification.status === 'pending')
  check('4. pictures are locked while under review', (await upload(parent.token, 'parent_nid')).status === 409)
  check('4. reviewed profile fields are locked while under review', (await PUT('/api/v1/workflow/profile', parent.token, { address: 'Somewhere else' })).status === 409)

  // ---------- 2 (early). parent provides the child's email after submitting ----------
  const childEmail = email('child')
  check('2. invalid child email is refused', (await invite(parent, 'not-an-email')).status === 400)
  check("2. parent's own email cannot be the child's", (await invite(parent, parent.email)).status === 409)
  r = await invite(parent, `  ${childEmail.toUpperCase()} `, 'mother', 'Ayaan')
  check('2. parent submits a separate email for the child', r.status === 201 && r.data.invitation.child_email === childEmail && r.data.invitation.status === 'pending_approval', show(r))
  const invitationId = r.data.invitation.id
  check('2. duplicate invitation for the same email is refused', (await invite(parent, childEmail)).status === 409)

  // ---------- child cannot register yet ----------
  r = await register('child', 'student', `Ayaan Child ${run}`)
  check('child cannot register while the request awaits permission', r.status === 403 && r.data.code === 'invitation_pending_approval', show(r))
  r = await POST('/api/v1/auth/student-invitation/check', undefined, { email: childEmail })
  check('invitation check says pending', r.status === 200 && r.data.allowed === false && r.data.code === 'invitation_pending_approval', show(r))

  // ---------- 3. admin reviews the parent ----------
  const parentApp = (await apps(admin, 'parent', 'pending')).find((a) => a.id === parent.application)
  check('3. admin sees the parent request with child email and submission date', !!parentApp && parentApp.family?.invitations?.[0]?.child_email === childEmail && !!parentApp.submitted_at && parentApp.document_count === 2, JSON.stringify(parentApp).slice(0, 300))
  check('3. admin cannot grant student registration before parent approval', (await allow(admin, invitationId)).status === 409)
  const docs = (await GET(`/api/v1/workflow/admin/verifications/${parent.application}/documents`, admin)).data.documents
  check('3. admin lists NID and birth certificate', docs.length === 2 && docs.some((x) => x.document_type === 'parent_nid') && docs.some((x) => x.document_type === 'child_birth_certificate'))
  const nid = docs.find((x) => x.document_type === 'parent_nid')
  r = await GET(`/api/v1/workflow/verification/documents/${nid.id}`, admin)
  check('3. admin views the NID with private, no-store headers', r.status === 200 && r.headers.get('cache-control') === 'private, no-store' && r.headers.get('content-type') === 'image/png')
  check('security: NID is not public', (await GET(`/api/v1/workflow/verification/documents/${nid.id}`)).status === 401)
  check('security: parent can view own NID', (await GET(`/api/v1/workflow/verification/documents/${nid.id}`, parent.token)).status === 200)

  // unauthorized admin approval
  check('security: parent cannot use admin decision endpoint', (await decide(parent.token, parent.application, 'approved')).status === 403)
  check('security: parent cannot grant student registration', (await allow(parent.token, invitationId)).status === 403)
  check('security: parent cannot list admin requests', (await GET('/api/v1/workflow/admin/student-invitations', parent.token)).status === 403)

  check('3. admin approves the parent', (await decide(admin, parent.application, 'approved')).status === 204)
  d = await dashboard(parent)
  check('3. parent is approved and active', d.account.status === 'active' && d.verification.status === 'approved')
  const notes = (await GET('/api/v1/workflow/notifications', parent.token)).data.notifications
  check('3. parent is notified of the decision', notes.some((n) => n.kind === 'verification_approved'))
  check('3. approval does not approve the child request by itself', (await family(parent)).invitations[0].status === 'pending_approval')

  // ---------- 7. admin grants student registration permission ----------
  check('7. refusing needs a reason', (await allow(admin, invitationId, 'rejected', 'no')).status === 400)
  check('7. admin allows the child to register', (await allow(admin, invitationId)).status === 204)
  check('7. invitation now approved with an expiry', (await family(parent)).invitations[0].status === 'approved' && !!(await family(parent)).invitations[0].expires_at)
  check('7. a decided request cannot be approved twice', (await allow(admin, invitationId)).status === 409)
  r = await POST('/api/v1/auth/student-invitation/check', undefined, { email: childEmail })
  check('7. invitation check now allows the email', r.data.allowed === true, show(r))

  // ---------- unauthorized registration ----------
  r = await register('stranger', 'student', `Stranger ${run}`)
  check('security: unrelated email cannot register as student', r.status === 403 && r.data.code === 'invitation_not_invited', show(r))
  r = await POST('/api/v1/auth/student-invitation/check', undefined, { email: email('stranger') })
  check('invitation check: unknown email not invited', r.data.allowed === false && r.data.code === 'invitation_not_invited')

  // ---------- 8-9. child registers with the exact invited email and their own password ----------
  const childPassword = `Kid-${run}-0wn-pw`
  r = await call('POST', '/api/v1/auth/register', { body: { name: `Ayaan Child ${run}`, email: childEmail.toUpperCase(), password: childPassword, role: 'student' } })
  check('8. child registers with the invited email (case-insensitive)', r.status === 201 && r.data.user.role === 'student' && r.data.user.account_status === 'pending', show(r))
  const child = { token: r.data.tokens.access_token, id: r.data.user.id, email: childEmail }
  check('9. child logs in with their own password', (await login(childEmail, childPassword)).status === 200)
  check("9. parent's password does not open the child account", (await login(childEmail, password)).status === 401)
  r = await call('POST', '/api/v1/auth/register', { body: { name: `Ayaan Again ${run}`, email: childEmail, password: childPassword, role: 'student' } })
  check('duplicate student account with the same email is refused', r.status === 403 && r.data.code === 'invitation_used', show(r))
  check('duplicate invitation after registration is refused', (await invite(parent, childEmail)).status === 409)
  let f = await family(child)
  check('8. student is linked to the correct parent, pending', f.parent?.parent_id === parent.id && f.parent.link_status === 'pending' && f.parent.parent_email === undefined, JSON.stringify(f))
  check('8. parent sees the child registered', (await family(parent)).invitations[0].status === 'registered')
  check('8. parent cannot see child progress before student approval', (await GET(`/api/v1/students/${child.id}/progress`, parent.token)).status === 404)
  const pendingLink = (await GET('/api/v1/links', child.token)).data.links.find((l) => l.guardian_id === parent.id)
  check('security: student cannot self-approve the invitation link', (await POST(`/api/v1/links/${pendingLink.id}/respond`, child.token, { accept: true })).status === 403)
  check('security: parent cannot approve their own child link', [403, 409].includes((await POST(`/api/v1/links/${pendingLink.id}/respond`, parent.token, { accept: true })).status))
  check('pending student cannot request chats', (await POST('/api/v1/chat-requests', child.token, { to_id: parent.id })).status === 403)

  // ---------- 10. child uploads their birth certificate and submits ----------
  d = await dashboard(child)
  check('10. student needs only their own birth certificate', d.requirements.length === 1 && d.requirements[0].type === 'birth_certificate')
  check('10. student cannot upload a parent document type', (await upload(child.token, 'parent_nid')).status === 400)
  r = await POST('/api/v1/workflow/verification/submit', child.token)
  check('10. submit without certificate and details lists what is missing', r.status === 422 && r.data.missing.includes('Your birth certificate') && r.data.missing.includes('Your class'), show(r))
  check('10. student uploads their birth certificate', (await upload(child.token, 'birth_certificate', JPEG, 'image/jpeg')).status === 201)
  check('10. student saves profile', (await PUT('/api/v1/workflow/profile', child.token, { display_name: `Ayaan Child ${run}`, birth_date: '2012-05-14', class_name: 'Class 8', institution: 'Mirpur Model School' })).status === 204)
  r = await POST('/api/v1/workflow/verification/submit', child.token)
  check('10. student submits for review', r.status === 202 && r.data.verification.status === 'pending', show(r))
  child.application = r.data.verification.id
  const childDoc = (await dashboard(child)).documents[0]

  // ---------- 11-12. admin reviews and approves the student separately ----------
  const studentApp = (await apps(admin, 'student', 'pending')).find((a) => a.id === child.application)
  check('11. admin sees student with linked, approved parent and invited email', studentApp?.family?.parent?.parent_id === parent.id && studentApp.family.parent.parent_verification_status === 'approved' && studentApp.family.parent.invited_email === childEmail, JSON.stringify(studentApp?.family))
  check("security: parent cannot view the child's birth certificate", (await GET(`/api/v1/workflow/verification/documents/${childDoc.id}`, parent.token)).status === 404)
  check("11. admin can view the child's birth certificate", (await GET(`/api/v1/workflow/verification/documents/${childDoc.id}`, admin)).status === 200)
  check('security: student cannot approve themselves', (await decide(child.token, child.application, 'approved')).status === 403)
  check('12. admin approves the student', (await decide(admin, child.application, 'approved')).status === 204, '')

  // ---------- 13-15. independent statuses and access ----------
  d = await dashboard(child)
  const pd = await dashboard(parent)
  check('13. student approved and active', d.account.status === 'active' && d.verification.status === 'approved')
  check('13. parent still approved, separately', pd.account.status === 'active' && pd.verification.status === 'approved' && pd.verification.id !== d.verification.id)
  f = await family(parent)
  check('13. parent sees child approved and linked', f.invitations[0].student_verification_status === 'approved' && f.invitations[0].link_status === 'approved')
  check('14. parent can now see own child progress', (await GET(`/api/v1/students/${child.id}/progress`, parent.token)).status === 200)
  check('13. parent notified of child approval', (await GET('/api/v1/workflow/notifications', parent.token)).data.notifications.some((n) => n.kind === 'child_verification_approved'))

  // a second, unrelated family to test isolation
  const parent2 = await submittedParent('parent2', `Kamal Parent ${run}`)
  await decide(admin, parent2.application, 'approved')
  const child2Email = email('child2')
  const inv2 = (await invite(parent2, child2Email, 'father')).data.invitation.id
  await allow(admin, inv2)
  r = await call('POST', '/api/v1/auth/register', { body: { name: `Nabila Child ${run}`, email: child2Email, password: childPassword, role: 'student' } })
  const child2 = { token: r.data.tokens.access_token, id: r.data.user.id }
  check('14. parent cannot see another family\'s child', (await GET(`/api/v1/students/${child2.id}/progress`, parent.token)).status === 404)
  check('14. parent sees only their own invitations', (await family(parent)).invitations.every((i) => i.parent_id === parent.id))
  check("15. student cannot see another student's progress", (await GET(`/api/v1/students/${child2.id}/progress`, child.token)).status === 404)
  check('15. student cannot use the parent-only invitation endpoint', (await POST('/api/v1/workflow/family/invitations', child.token, { child_email: email('x'), relationship: 'sibling' })).status === 403)
  await upload(child2.token, 'birth_certificate')
  const c2doc = (await dashboard(child2)).documents[0]
  check("security: student cannot view another student's document", (await GET(`/api/v1/workflow/verification/documents/${c2doc.id}`, child.token)).status === 404)
  check('security: other parent cannot cancel this parent\'s invitation', (await POST(`/api/v1/workflow/family/invitations/${invitationId}/cancel`, parent2.token)).status === 404)

  // ---------- student rejected after parent approval ----------
  await PUT('/api/v1/workflow/profile', child2.token, { display_name: `Nabila Child ${run}`, birth_date: '2011-01-02', class_name: 'Class 9', institution: 'Uttara High School' })
  const c2app = (await POST('/api/v1/workflow/verification/submit', child2.token)).data.verification.id
  check('16. admin requests corrections from student', (await decide(admin, c2app, 'resubmission_required', 'Birth certificate photo is blurry, please retake.')).status === 204)
  d = await dashboard(child2)
  check('16. student sees corrections requested with reason', d.account.status === 'resubmission_required' && /blurry/.test(d.verification.correction_request))
  check('16. student re-uploads after correction', (await upload(child2.token, 'birth_certificate', JPEG, 'image/jpeg')).status === 201)
  check('16. student resubmits', (await POST('/api/v1/workflow/verification/submit', child2.token)).status === 202)
  check('16. admin rejects the student with a reason', (await decide(admin, c2app, 'rejected', 'The birth certificate does not match the student name.')).status === 204)
  d = await dashboard(child2)
  check('16. student rejected with reason shown', d.account.status === 'rejected' && /does not match/.test(d.verification.rejection_reason))
  check('16. parent stays approved after student rejection', (await dashboard(parent2)).account.status === 'active')
  f = await family(parent2)
  check('16. parent sees student rejected and link rejected', f.invitations[0].student_verification_status === 'rejected' && f.invitations[0].link_status === 'rejected' && /does not match/.test(f.invitations[0].student_rejection_reason))
  check('16. rejected student access stays restricted', (await POST('/api/v1/chat-requests', child2.token, { to_id: parent2.id })).status === 403)

  // ---------- parent rejected before child registration ----------
  const parent3 = await submittedParent('parent3', `Rina Parent ${run}`)
  const child3Email = email('child3')
  const inv3 = (await invite(parent3, child3Email)).data.invitation.id
  check('16. admin requests corrections from parent', (await decide(admin, parent3.application, 'resubmission_required', 'Please upload a clearer NID photo.')).status === 204)
  check('16. parent re-uploads NID after corrections', (await upload(parent3.token, 'parent_nid', JPEG, 'image/jpeg')).status === 201)
  check('16. parent resubmits', (await POST('/api/v1/workflow/verification/submit', parent3.token)).status === 202)
  check('admin cannot allow child of a parent under review', (await allow(admin, inv3)).status === 409)
  check('16. admin rejects the parent', (await decide(admin, parent3.application, 'rejected', 'The NID does not match the account holder.')).status === 204)
  f = await family(parent3)
  check('parent rejected: child request withdrawn', f.invitations[0].status === 'rejected' && /Parent verification was rejected/.test(f.invitations[0].rejection_reason))
  r = await call('POST', '/api/v1/auth/register', { body: { name: `Rina Child ${run}`, email: child3Email, password: childPassword, role: 'student' } })
  check('parent rejected: child registration permission denied', r.status === 403 && r.data.code === 'invitation_not_authorized', show(r))
  check('parent rejected: new child requests refused', (await invite(parent3, email('child3b'))).status === 409)

  // ---------- refused request, then a new request reuses the email ----------
  const parent4 = await submittedParent('parent4', `Tania Parent ${run}`)
  await decide(admin, parent4.application, 'approved')
  const child4Email = email('child4')
  const inv4 = (await invite(parent4, child4Email)).data.invitation.id
  check('admin refuses a request with a reason', (await allow(admin, inv4, 'rejected', 'Please use the child’s own email, not a shared one.')).status === 204)
  check('refused request: child cannot register', (await call('POST', '/api/v1/auth/register', { body: { name: `Kid Four ${run}`, email: child4Email, password: childPassword, role: 'student' } })).data?.code === 'invitation_not_authorized')
  r = await invite(parent4, child4Email)
  check('parent can request again after a refusal', r.status === 201 && r.data.invitation.status === 'pending_approval' && r.data.invitation.id === inv4)
  check('parent cancels a pending request', (await POST(`/api/v1/workflow/family/invitations/${inv4}/cancel`, parent4.token)).status === 204)
  check('cancelled request cannot be cancelled again', (await POST(`/api/v1/workflow/family/invitations/${inv4}/cancel`, parent4.token)).status === 409)
  check('cancelled request is hidden from the parent', !(await family(parent4)).invitations.some((i) => i.id === inv4))

  // ---------- admin queue filters ----------
  const queue = await invitations(admin, 'registered')
  check('admin queue lists registered requests with both statuses', queue.some((i) => i.id === invitationId && i.parent_verification_status === 'approved' && i.student_verification_status === 'approved'))
  check('admin queue filter excludes others', (await invitations(admin, 'pending_approval')).every((i) => i.status === 'pending_approval'))

  // ---------- tutor and coaching flows unaffected ----------
  const tutor = await account('tutor', 'tutor')
  await upload(tutor.token, 'identity')
  await PUT('/api/v1/workflow/profile', tutor.token, { display_name: `Fam tutor ${run}`, education: 'BSc', subjects: ['Physics'], classes: ['HSC'], areas: ['Uttara'] })
  const tapp = (await POST('/api/v1/workflow/verification/submit', tutor.token)).data?.verification?.id
  check('tutor verification still works', !!tapp && (await decide(admin, tapp, 'approved')).status === 204 && (await dashboard(tutor)).account.status === 'active')
  check('tutors cannot request student accounts', (await POST('/api/v1/workflow/family/invitations', tutor.token, { child_email: email('t'), relationship: 'x' })).status === 403)

  console.log(`\n${pass} passed, ${fail} failed`)
  if (fail) { console.log('Failures:\n - ' + failures.join('\n - ')); process.exit(1) }
}

main().catch((e) => { console.error(e); process.exit(1) })
