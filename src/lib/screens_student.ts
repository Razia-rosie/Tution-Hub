type T = [string, string, string, string, string, string, string, string, string, string, string, string, string]
const V = '/app/student/profile/verification'
type O = Partial<Record<'entry' | 'components' | 'primary' | 'secondary' | 'success' | 'error' | 'next' | 'related', string>>
const m = (id: string, name: string, purpose: string, route: string, o: O = {}): T => [
  id, name, 'Student', purpose, o.entry ?? 'Student sidebar', o.components ?? 'Page header, content cards', o.primary ?? 'Continue', o.secondary ?? 'Back', o.success ?? 'Saved with a toast', o.error ?? 'Inline errors, empty state', o.next ?? '', o.related ?? '', route,
]
export const STUDENT_ROWS: T[] = [
  m('SV-01', 'Student verification overview', 'Checklist of 7 steps with progress and status', V, { entry: 'Verification banner, Profile', components: 'Progress bar, step list, privacy card', primary: 'Start or continue', next: 'SV-02', related: 'SV-09' }),
  m('SV-02', 'Student information', 'Name, date of birth, gender, district', `${V}/details`, { components: 'Text, date, selects', error: 'Two-word name; age 10 to 25', next: 'SV-03' }),
  m('SV-03', 'School or college', 'Institution, type and board', `${V}/school`, { components: 'Selects', error: 'Institution required', next: 'SV-04' }),
  m('SV-04', 'Student ID (demo)', 'Last 4 digits and a placeholder photo, DEMO no real document', `${V}/id`, { components: 'Masked preview, DocPlaceholder, Demo tag', error: 'Four digits and placeholder photo required', next: 'SV-05' }),
  m('SV-05', 'Class and academic year', 'Class, year, optional section', `${V}/class`, { components: 'Selects, text', error: 'Class and year required', next: 'SV-06' }),
  m('SV-06', 'Phone verification', 'Confirm the number with a demo code', `${V}/phone`, { components: 'Masked number, OTP boxes, Demo code', error: 'Wrong code clears boxes', next: 'SV-07' }),
  m('SV-07', 'Guardian consent', 'Required under 18: request, simulated agree or decline; skipped for 18+', `${V}/consent`, { components: 'Guardian form, masked phone, Demo simulate buttons', error: 'Declined blocks Continue; send again or change guardian', next: 'SV-08' }),
  m('SV-08', 'Review and submit', 'Summary, completeness checklist, confirm box', `${V}/review`, { components: 'Summary list, checklist, checkbox', primary: 'Submit for review', error: 'Missing steps and unticked box block submit', next: 'SV-09' }),
  m('SV-09', 'Pending and under review', 'Review timeline plus Demo reviewer controls', `${V}/status`, { components: 'Timeline, Demo reviewer card', primary: 'Start review, Simulate approval', next: 'SV-10, SV-11, SV-12' }),
  m('SV-10', 'Verified', 'Student Status: Verified with the student badge', `${V}/status`, { components: 'Student badge, CTAs', primary: 'Go to home', success: 'Interest and chat unlock', related: 'DASH-S' }),
  m('SV-11', 'Rejected', 'Reason and resubmit path', `${V}/status`, { components: 'Reason, Fix details, Resubmit', primary: 'Fix details', next: 'SV-02, SV-09' }),
  m('SV-12', 'Action required', 'One missing item with a direct fix link', `${V}/status`, { components: 'Needed note, Replace student ID', primary: 'Replace student ID', next: 'SV-04, SV-09' }),
  m('DASH-S', 'Student dashboard', "Today's class, upcoming, tutor, homework, assignments, attendance, progress, feedback, messages, notifications", '/app/student/home', { entry: 'Sign-in, Home', components: 'Today banner, 10 section cards, Demo view picker', primary: 'Find a tutor', error: 'Loading, empty and error variants', related: 'SV-01' }),
  m('PROF-S', 'Student profile', 'Masked profile and verification link', '/app/student/profile', { components: 'Avatar, masked rows, verification card', primary: 'Open verification' }),
  m('FND-S', 'Find tutor (student)', 'Verified tutors ranked by match, filters, masked cards', '/app/student/find-tutor', { entry: 'Sidebar, public /find-tutor after sign-in', components: 'Filters, tutor cards, match score, Trust Score', primary: "I'm Interested", error: 'No results, locked until verified', next: 'TP-S', related: 'PUB-03' }),
  m('TP-S', 'Tutor profile (student)', 'Same privacy as parent: no phone, address or NID; area only', '/app/student/find-tutor/tanvir-ahmed-rahman', { components: 'Badges, Trust Score parts, masked contact, reviews', primary: "I'm Interested", error: 'Locked chip until verified' }),
  m('CMP-S', 'Compare tutors (student)', 'Side-by-side of up to 3 tutors', '/app/student/find-tutor/compare', { components: 'Comparison table, Trust Score', primary: 'Open profile' }),
  m('INT-S', 'Interest (student)', 'Sent, received and mutual interest with accept, decline, withdraw', '/app/student/messages', { components: 'Interest list, status chips, Demo tutor buttons', primary: 'Accept', error: 'Empty state' }),
  m('CHAT-S', 'Chat (student)', 'Message thread; numbers and links are blocked, contact stays masked', '/app/student/messages', { components: 'Thread, composer, masked contact, Demo replies', primary: 'Send', error: 'Unsafe contact rejected' }),
  m('AGR-S', 'Agreement (student)', 'Terms, Demo guardian consent for under 18, then Tuition Active', '/app/student/messages', { components: 'Terms list, guardian consent block, Demo tag', primary: 'Confirm agreement', error: 'Confirm locked until guardian agrees', next: 'ACT-S' }),
  m('ACT-S', 'My Tuition', 'Tutor, schedule, read-only fee, agreement, review', '/app/student/my-tuition', { components: 'Summary card, agreement card, review section', primary: 'Review tutor (after completion)', error: 'No-tuition empty state' }),
  m('SCH-S', 'Schedule (student)', 'Upcoming classes with Today highlighted', '/app/student/schedule', { components: 'Class cards', error: 'Empty state' }),
  m('ATT-S', 'Attendance (student)', 'Read-only stats and class list; only tutor marks', '/app/student/attendance', { components: 'Stats, list, lock note', error: 'Empty state' }),
  m('HW-S', 'Homework (student)', 'To do, Submitted, Reviewed; submit with Demo file attach, resubmit, feedback', '/app/student/homework', { components: 'Tabs, submit modal, Demo file, feedback', primary: 'Submit homework', error: 'Needs file or note' }),
  m('ASG-S', 'Assignments (student)', 'Same flow as homework for larger work', '/app/student/assignments', { components: 'Tabs, submit modal, Demo file, feedback', primary: 'Submit assignment', error: 'Needs file or note' }),
  m('PRG-S', 'Progress (student)', 'Tuition marks and school vs tuition comparison, monthly report', '/app/student/progress', { components: 'Tabs, ProgressRing, bars, Demo marks', error: 'No tests yet' }),
  m('TUT-S', 'My tutor', 'Tutor card with masked contact and message link', '/app/student/tutor', { components: 'Avatar, badges, masked rows', primary: 'Message', error: 'No-tuition empty state' }),
  m('NOT-S', 'Notifications (student)', 'Updates about the student only; mark all read', '/app/student/notifications', { components: 'List, New chip', primary: 'Mark all read', error: 'All caught up' }),
  m('SAF-S', 'Safety (student)', 'Safety tips and report a concern form', '/app/student/safety', { components: 'Tip cards, report form, Demo tag', primary: 'Send report', error: 'Minimum 10 characters' }),
  m('REV-S', 'Review tutor (student)', 'Locked until completion, Demo fast-forward, form, submitted view', '/app/student/my-tuition', { components: 'Locked card, rating, comment', primary: 'Submit review', error: 'Rating and comment required' }),
  m('PERM-S', 'Not available to students', 'Direct URLs for other students, payments, mark attendance show a denied screen', '/app/student/students/ST-3099', { components: 'Lock card', primary: 'Back to home' }),
]
