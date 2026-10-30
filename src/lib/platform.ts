import { api } from './api'

// Typed client for the platform API (marketplace, messaging, tuitions,
// classrooms, coaching, admin). Shapes mirror backend/internal/platform.

export type TutorCard = {
  id: string; name: string; bio?: string | null; institution?: string | null; education?: string | null; current_study?: string | null; results?: string | null
  subjects: string[]; classes: string[]; areas: string[]; mediums: string[]; teaching_modes: string[]; availability: Record<string, unknown> | null
  experience_years?: number | null; fee_expectation?: number | null; gender?: string | null; has_photo: boolean; rating: number; review_count: number
  tuitions_done: number; education_verified: boolean; member_since: string
}
export type Review = { id: string; stars: number; body?: string | null; reply?: string | null; by: string; by_role: string; subject: string; created_at: string; replied_at?: string | null }
export type Award = { id: string; title: string; description?: string | null; awarded_at: string }
export type Centre = {
  id: string; name: string; institution?: string | null; about?: string | null; subjects: string[]; levels: string[]; areas: string[]; opening_hours?: string | null
  established?: string | null; has_photo: boolean; rating: number; review_count: number; teachers: number; students: number; batches: number
  teacher_list?: { name: string; subject?: string | null }[]; batch_list?: { name: string; subject: string; class_name?: string | null; days?: string | null; time_slot?: string | null; monthly_fee?: number | null }[]
}
export type Post = {
  id: string; owner_id: string; owner_role: string; owner_name: string; student_id?: string | null; subject: string; class_name: string; medium?: string | null; area: string
  mode: string; days?: string | null; time_slot?: string | null; budget?: number | null; requirements?: string | null; status: string; created_at: string; applicants: number
  my_application?: string | null; saved: boolean
}
export type PostInput = { subject: string; class_name: string; medium?: string; area: string; mode: string; days?: string; time_slot?: string; budget?: number | null; requirements?: string; student_id?: string }
export type Application = {
  id: string; listing_id: string; tutor_id: string; tutor_name: string; note?: string | null; status: string; created_at: string; subject: string; class_name: string
  area: string; budget?: number | null; post_status: string; owner_id: string; owner_name: string; tutor_rating: number
}
export type Link = { id: string; guardian_id: string; guardian_name: string; student_id: string; student_name: string; class_name?: string | null; institution?: string | null; relationship: string; status: string; created_at: string }
export type ChatRequest = { id: string; from_id: string; from_name: string; from_role: string; to_id: string; to_name: string; to_role: string; message?: string | null; status: string; conversation_id?: string | null; created_at: string }
export type Conversation = { id: string; other_id: string; other_name: string; other_role: string; last_message?: string | null; last_message_at?: string | null; unread: number; blocked: boolean }
export type Message = { id: string; sender_id?: string | null; sender_name?: string | null; body: string; created_at: string }
export type Engagement = {
  id: string; tutor_id: string; tutor_name: string; guardian_id?: string | null; guardian_name?: string | null; student_id?: string | null; student_name?: string | null
  listing_id?: string | null; conversation_id?: string | null; subject: string; class_name: string; days?: string | null; time_slot?: string | null; mode: string
  location_note?: string | null; monthly_fee?: number | null; start_date?: string | null; status: string; trial_at?: string | null; trial_note?: string | null
  tutor_confirmed_at?: string | null; client_confirmed_at?: string | null; cancel_reason?: string | null; classroom_id?: string | null; created_at: string
  contact?: { email: string; phone?: string | null }
}
export type Payment = { id: string; month: string; amount: number; status: string; note?: string | null; marked_at?: string | null; confirmed_at?: string | null }
export type ClassroomSummary = {
  id: string; name: string; subject?: string | null; owner_id: string; owner_name: string; owner_role: string; engagement_id?: string | null; members: number
  open_assignments: number; next_session?: string | null; archived: boolean; created_at: string; child_name?: string | null
}
export type Mark = { learner_kind: 'user' | 'roster'; learner_id: string; mark: 'present' | 'absent' | 'late' | 'excused' }
export type Session = { id: string; starts_at: string; ends_at?: string | null; status: string; note?: string | null; marks: Mark[] }
export type Assignment = {
  id: string; kind: string; title: string; instructions?: string | null; due_at: string; max_score?: number | null; created_at: string; submitted_count: number
  my_status?: string | null; my_score?: number | null; my_feedback?: string | null
}
export type Material = { id: string; title: string; body?: string | null; link_url?: string | null; file_name?: string | null; file_mime?: string | null; created_at: string }
export type Diary = { id: string; entry_date: string; topics: string; homework?: string | null; note?: string | null }
export type ClassroomDetail = ClassroomSummary & {
  description?: string | null; access: 'owner' | 'member' | 'viewer'
  members: { id: string; name: string; class_name?: string | null }[]; materials: Material[]; assignments: Assignment[]; sessions: Session[]; diary: Diary[]
}
export type Submission = { id: string; student_id: string; student_name: string; note?: string | null; file_name?: string | null; status: string; score?: number | null; feedback?: string | null; submitted_at: string; reviewed_at?: string | null; late: boolean }
export type Progress = { student_id: string; present: number; absent: number; late: number; attendance_percent?: number | null; assigned: number; submitted: number; reviewed: number; average_score_percent?: number | null }
export type Result = { student: string; centre: string; batch: string; title: string; exam_date: string; total_marks: number; marks?: number | null }
export type Ticket = { id: string; reporter_name?: string | null; subject_user_id?: string | null; subject_name?: string | null; category: string; title: string; body: string; status: string; assignee_name?: string | null; resolution?: string | null; created_at: string; updated_at: string }

// Coaching
export type Teacher = { id: string; name: string; subject?: string | null; qualification?: string | null; phone?: string | null; email?: string | null; status: string; batches: number }
export type Course = { id: string; name: string; description?: string | null; subjects: string[]; monthly_fee?: number | null; batches: number }
export type Branch = { id: string; name: string; address?: string | null }
export type Roster = { id: string; name: string; class_name?: string | null; guardian_name?: string | null; guardian_phone?: string | null; status: string; admitted_at?: string | null; has_account: boolean; batch_ids: string[] }
export type Batch = {
  id: string; name: string; subject: string; class_name?: string | null; course_id?: string | null; branch_id?: string | null; teacher_id?: string | null; teacher_name?: string | null
  classroom_id?: string | null; days?: string | null; time_slot?: string | null; room?: string | null; capacity?: number | null; monthly_fee?: number | null; status: string; enrolled: number
}
export type Exam = { id: string; batch_id: string; batch_name: string; title: string; exam_date: string; total_marks: number; published_at?: string | null; marks_entered: number; average?: number | null }
export type Fee = { id: string; student_id: string; student_name: string; month: string; amount: number; status: string; paid_at?: string | null; reminded_at?: string | null }
export type CoachingReport = { students: number; teachers: number; batches: number; attendance_percent?: number | null; attendance_marks: number; fees_due?: number | null; fees_paid?: number | null; exams_published: number; average_exam_percent?: number | null }

const q = (params: Record<string, string | number | boolean | undefined | null>) => {
  const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => [k, String(v)])).toString()
  return s ? `?${s}` : ''
}
const P = '/api/v1'

export const platform = {
  // discovery
  tutors: (f: { subject?: string; area?: string; class?: string; mode?: string; q?: string; max_fee?: number; offset?: number }) => api.get<{ tutors: TutorCard[]; total: number }>(`${P}/public/tutors${q(f)}`),
  tutor: (id: string) => api.get<{ tutor: TutorCard; reviews: Review[]; awards: Award[] }>(`${P}/public/tutors/${id}`),
  centres: (f: { subject?: string; area?: string; q?: string }) => api.get<{ centres: Centre[]; total: number }>(`${P}/public/coaching${q(f)}`),
  centre: (id: string) => api.get<{ centre: Centre; reviews: Review[] }>(`${P}/public/coaching/${id}`),
  publicPosts: (f: { subject?: string; class?: string; area?: string; mode?: string; q?: string; min_budget?: number }) => api.get<{ posts: Post[]; total: number }>(`${P}/public/tuition${q(f)}`),
  publicPost: (id: string) => api.get<{ post: Post }>(`${P}/public/tuition/${id}`),
  photoUrl: (id: string) => api.blobUrl(`${P}/public/users/${id}/photo`),
  setPhoto: (file: File) => { const f = new FormData(); f.append('photo', file); return api.form(`${P}/profile/photo`, f) },
  // tuition posts
  posts: (f: { subject?: string; class?: string; area?: string; mode?: string; q?: string; min_budget?: number; saved?: boolean; offset?: number }) => api.get<{ posts: Post[]; total: number }>(`${P}/tuition-posts${q({ ...f, saved: f.saved ? 1 : undefined })}`),
  myPosts: () => api.get<{ posts: Post[] }>(`${P}/tuition-posts/mine`),
  createPost: (body: PostInput) => api.post<{ id: string }>(`${P}/tuition-posts`, body),
  updatePost: (id: string, body: PostInput) => api.put(`${P}/tuition-posts/${id}`, body),
  setPostStatus: (id: string, status: string) => api.post(`${P}/tuition-posts/${id}/status`, { status }),
  apply: (id: string, note: string) => api.post(`${P}/tuition-posts/${id}/apply`, { note }),
  save: (id: string, on: boolean) => (on ? api.post(`${P}/tuition-posts/${id}/save`) : api.del(`${P}/tuition-posts/${id}/save`)),
  postApplications: (id: string) => api.get<{ applications: Application[] }>(`${P}/tuition-posts/${id}/applications`),
  myApplications: () => api.get<{ applications: Application[] }>(`${P}/applications/mine`),
  setApplication: (id: string, status: string) => api.post<{ status: string; conversation_id?: string }>(`${P}/applications/${id}/status`, { status }),
  // links and progress
  links: () => api.get<{ links: Link[] }>(`${P}/links`),
  requestLink: (student_email: string, relationship: string) => api.post(`${P}/links`, { student_email, relationship }),
  respondLink: (id: string, accept: boolean) => api.post(`${P}/links/${id}/respond`, { accept }),
  progress: (studentId: string) => api.get<Progress>(`${P}/students/${studentId}/progress`),
  results: () => api.get<{ results: Result[] }>(`${P}/results`),
  // chat
  chatRequests: () => api.get<{ requests: ChatRequest[] }>(`${P}/chat-requests`),
  requestChat: (body: { to_id: string; student_id?: string; listing_id?: string; message?: string }) => api.post<{ id: string }>(`${P}/chat-requests`, body),
  answerChat: (id: string, action: 'accept' | 'decline' | 'cancel') => api.post<{ status: string; conversation_id?: string }>(`${P}/chat-requests/${id}/${action}`),
  conversations: () => api.get<{ conversations: Conversation[] }>(`${P}/conversations`),
  unreadMessages: () => api.get<{ unread: number }>(`${P}/conversations/unread`),
  messages: (id: string, after?: string) => api.get<{ messages: Message[] }>(`${P}/conversations/${id}/messages${q({ after })}`),
  send: (id: string, body: string) => api.post<{ message: Message }>(`${P}/conversations/${id}/messages`, { body }),
  markRead: (id: string) => api.post(`${P}/conversations/${id}/read`),
  block: (userId: string, on: boolean) => (on ? api.post(`${P}/users/${userId}/block`) : api.del(`${P}/users/${userId}/block`)),
  // tuitions
  engagements: () => api.get<{ engagements: Engagement[] }>(`${P}/engagements`),
  createEngagement: (body: Record<string, unknown>) => api.post<{ id: string }>(`${P}/engagements`, body),
  actOnEngagement: (id: string, body: Record<string, unknown>) => api.post<{ status?: string; classroom_id?: string }>(`${P}/engagements/${id}/actions`, body),
  payments: (id: string) => api.get<{ payments: Payment[] }>(`${P}/engagements/${id}/payments`),
  paymentAction: (id: string, action: string, month: string, note = '') => api.post(`${P}/engagements/${id}/payments`, { action, month, note }),
  review: (id: string, stars: number, body: string) => api.post(`${P}/engagements/${id}/review`, { stars, body }),
  reviewsFor: (userId: string) => api.get<{ reviews: Review[] }>(`${P}/users/${userId}/reviews`),
  replyReview: (id: string, reply: string) => api.post(`${P}/reviews/${id}/reply`, { reply }),
  awards: (userId: string) => api.get<{ awards: Award[] }>(`${P}/users/${userId}/awards`),
  // classrooms
  classrooms: () => api.get<{ classrooms: ClassroomSummary[] }>(`${P}/classrooms`),
  classroom: (id: string) => api.get<ClassroomDetail>(`${P}/classrooms/${id}`),
  createClassroom: (body: { name: string; subject?: string; description?: string }) => api.post<{ id: string }>(`${P}/classrooms`, body),
  addMember: (id: string, email: string) => api.post(`${P}/classrooms/${id}/members`, { email }),
  removeMember: (id: string, studentId: string) => api.del(`${P}/classrooms/${id}/members/${studentId}`),
  addMaterial: (id: string, form: FormData) => api.form(`${P}/classrooms/${id}/materials`, form),
  materialUrl: (id: string) => api.blobUrl(`${P}/materials/${id}/file`),
  createAssignment: (id: string, body: { kind: string; title: string; instructions?: string; due_at: string; max_score?: number | null }) => api.post(`${P}/classrooms/${id}/assignments`, body),
  submit: (assignmentId: string, form: FormData) => api.form(`${P}/assignments/${assignmentId}/submit`, form),
  submissions: (assignmentId: string) => api.get<{ submissions: Submission[] }>(`${P}/assignments/${assignmentId}/submissions`),
  reviewSubmission: (id: string, body: { score?: number | null; feedback?: string; status: 'reviewed' | 'revision' }) => api.post(`${P}/submissions/${id}/review`, body),
  submissionUrl: (id: string) => api.blobUrl(`${P}/submissions/${id}/file`),
  createSessions: (id: string, body: { starts_at: string; ends_at?: string; repeat_weeks?: number }) => api.post(`${P}/classrooms/${id}/sessions`, body),
  setSession: (id: string, body: { status: string; note?: string; new_starts_at?: string }) => api.post(`${P}/sessions/${id}/status`, body),
  attendance: (id: string, marks: Mark[]) => api.post(`${P}/sessions/${id}/attendance`, { marks }),
  diary: (id: string, body: { entry_date: string; topics: string; homework?: string; note?: string }) => api.post(`${P}/classrooms/${id}/diary`, body),
  // support
  createTicket: (body: { category: string; title: string; body: string; subject_user_id?: string; listing_id?: string }) => api.post<{ id: string }>(`${P}/support-tickets`, body),
  myTickets: () => api.get<{ tickets: Ticket[] }>(`${P}/support-tickets/mine`),
  // coaching
  coaching: {
    teachers: () => api.get<{ teachers: Teacher[] }>(`${P}/coaching/teachers`),
    saveTeacher: (body: Record<string, unknown>, id?: string) => (id ? api.put<{ id: string }>(`${P}/coaching/teachers/${id}`, body) : api.post<{ id: string }>(`${P}/coaching/teachers`, body)),
    courses: () => api.get<{ courses: Course[] }>(`${P}/coaching/courses`),
    saveCourse: (body: Record<string, unknown>, id?: string) => (id ? api.put<{ id: string }>(`${P}/coaching/courses/${id}`, body) : api.post<{ id: string }>(`${P}/coaching/courses`, body)),
    branches: () => api.get<{ branches: Branch[] }>(`${P}/coaching/branches`),
    saveBranch: (body: Record<string, unknown>, id?: string) => (id ? api.put<{ id: string }>(`${P}/coaching/branches/${id}`, body) : api.post<{ id: string }>(`${P}/coaching/branches`, body)),
    students: () => api.get<{ students: Roster[] }>(`${P}/coaching/students`),
    saveStudent: (body: Record<string, unknown>, id?: string) => (id ? api.put<{ id: string }>(`${P}/coaching/students/${id}`, body) : api.post<{ id: string }>(`${P}/coaching/students`, body)),
    batches: () => api.get<{ batches: Batch[] }>(`${P}/coaching/batches`),
    saveBatch: (body: Record<string, unknown>, id?: string) => (id ? api.put<{ id: string }>(`${P}/coaching/batches/${id}`, body) : api.post<{ id: string }>(`${P}/coaching/batches`, body)),
    learners: (batchId: string) => api.get<{ learners: { learner_kind: 'roster'; learner_id: string; name: string }[] }>(`${P}/coaching/batches/${batchId}/learners`),
    enrol: (batchId: string, studentId: string, on: boolean) => (on ? api.post(`${P}/coaching/batches/${batchId}/enrollments/${studentId}`) : api.del(`${P}/coaching/batches/${batchId}/enrollments/${studentId}`)),
    exams: () => api.get<{ exams: Exam[] }>(`${P}/coaching/exams`),
    createExam: (body: { batch_id: string; title: string; exam_date: string; total_marks: number }) => api.post<{ id: string }>(`${P}/coaching/exams`, body),
    examMarks: (id: string) => api.get<{ marks: { student_id: string; name: string; marks?: number | null }[] }>(`${P}/coaching/exams/${id}/marks`),
    saveMarks: (id: string, marks: Record<string, number | null>, publish: boolean) => api.post(`${P}/coaching/exams/${id}/marks`, { marks, publish }),
    fees: (month?: string) => api.get<{ fees: Fee[] }>(`${P}/coaching/fees${q({ month })}`),
    generateFees: (month: string) => api.post<{ created: number }>(`${P}/coaching/fees/generate`, { month }),
    feeAction: (id: string, action: 'paid' | 'waive' | 'remind') => api.post(`${P}/coaching/fees/${id}/${action}`),
    report: () => api.get<CoachingReport>(`${P}/coaching/report`),
  },
  // admin
  admin: {
    tickets: (f: { status?: string; category?: string }) => api.get<{ tickets: Ticket[] }>(`${P}/admin/tickets${q(f)}`),
    updateTicket: (id: string, status: string, resolution: string) => api.post(`${P}/admin/tickets/${id}`, { status, resolution }),
    posts: (f: { status?: string; q?: string; offset?: number }) => api.get<{ posts: Post[]; total: number }>(`${P}/admin/tuition-posts${q(f)}`),
    setPost: (id: string, status: string, reason: string) => api.post(`${P}/admin/tuition-posts/${id}/status`, { status, reason }),
    settings: () => api.get<{ settings: Record<string, string | number | boolean> }>(`${P}/admin/settings`),
    saveSettings: (body: Record<string, unknown>) => api.put(`${P}/admin/settings`, body),
    announce: (body: { role?: string; title: string; body: string }) => api.post<{ recipients: number }>(`${P}/admin/announcements`, body),
    award: (body: { user_id: string; title: string; description?: string }) => api.post(`${P}/admin/awards`, body),
    user: (id: string) => api.get<{ user: Record<string, unknown>; profile?: Record<string, unknown> | null; activity: Record<string, number> }>(`${P}/admin/users/${id}`),
    report: (from?: string, to?: string) => api.get<Record<string, unknown>>(`${P}/admin/reports${q({ from, to })}`),
    suspicious: () => api.get<{ accounts: { id: string; name: string; email: string; role: string; account_status: string; failed_logins: number | string; reports: number | string }[] }>(`${P}/admin/suspicious`),
    engagements: (f: { status?: string }) => api.get<{ engagements: Engagement[] }>(`${P}/admin/engagements${q(f)}`),
    reviews: () => api.get<{ reviews: (Review & { subject_name: string })[] }>(`${P}/admin/reviews`),
    payments: (f: { status?: string }) => api.get<{ payments: (Payment & { engagement_id: string; tutor_name: string; client_name?: string | null; subject: string })[] }>(`${P}/admin/payments${q(f)}`),
  },
}

/** Formats a taka amount. */
export const taka = (n?: number | null) => (n == null ? '—' : `৳${Math.round(n).toLocaleString('en-IN')}`)
export const fmtDate = (s?: string | null) => (s ? new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
export const fmtDateTime = (s?: string | null) => (s ? new Date(s).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—')
export const errMsg = (e: unknown, fallback = 'Something went wrong.') => (e instanceof Error ? e.message : fallback)
