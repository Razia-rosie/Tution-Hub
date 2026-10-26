export type Screen = {
  id: string; name: string; role: string; purpose: string; entry: string; components: string; primary: string; secondary: string
  success: string; error: string; next: string; related: string; tier: 'P0' | 'P1' | 'P2'; order: number; route: string; status: 'Built' | 'Planned'
}
type T = [string, string, string, string, string, string, string, string, string, string, string, string, string]
// id, name, role, purpose, entry, components, primary, secondary, success, error/empty, next, related, route
import { TUTOR_ROWS } from './screens_tutor'
import { PARENT_ROWS } from './screens_parent'
import { STUDENT_ROWS } from './screens_student'
import { COACHING_ROWS } from './screens_coaching'
const rows: T[] = [
  ['PUB-01', 'Landing', 'Public', 'Explain the trust-first model and route each visitor to a path', 'Direct URL, logo', 'Hero, trust strip, 5-step flow, role cards, differentiators, safety timeline, footer', 'Find a Tutor', 'Find Tuition, Post a Tuition, Join as Tutor/Parent/Coaching, How It Works, Safety', 'CTA opens its destination', 'Hero photo falls back to initials', 'PUB-03, PUB-04, AUTH-02', 'PUB-02, PUB-07', '/'],
  ['PUB-02', 'How It Works', 'Public', 'Explain the core loop and each role flow', 'Nav, landing CTA', 'Core loop, role flows, match weights, CTA band', 'Create free account', 'Join as role', 'Visitor reaches signup', 'None (static)', 'AUTH-02', 'PUB-01, PUB-07', '/how-it-works'],
  ['PUB-03', 'Find Tutor', 'Public', 'Search verified tutors with limited fields', 'Nav, landing CTA', 'Filters, applied chips, tutor cards, sort, load more, skeleton', 'View profile', 'Contact (gated), Save search (gated), Clear filters', 'Filtered results shown', 'No-results with clear filters; loading skeleton', 'PUB-11, PUB-13', 'SRCH-01, AUTH-01', '/find-tutor'],
  ['PUB-04', 'Find Tuition', 'Public', 'Browse open tuition posts with limited fields', 'Nav, landing CTA', 'Filters, post cards, skeleton', 'View details', "I'm interested (gated)", 'Filtered posts shown', 'No-results; online note', 'PUB-12, PUB-13', 'SRCH-02', '/find-tuition'],
  ['PUB-05', 'Coaching directory', 'Public', 'List verified coaching centres', 'Nav', 'Filters, centre cards, Verified Organization badge', 'View centre', 'Filter by subject/area', 'Centres filtered', 'No-results', 'PUB-06', 'CV-09', '/coaching'],
  ['PUB-06', 'Coaching public profile', 'Public', 'Show a centre with teachers and batches', 'PUB-05', 'Header, about, teachers, batches, rating', 'Contact centre (gated)', 'Back to directory', 'Gate modal opens', 'Unknown id shows 404', 'PUB-13', 'PRF-06', '/coaching/scholars-point'],
  ['PUB-07', 'Safety Center', 'Public', 'Explain protections and what is never public', 'Nav, footer, landing', 'Six protections, class timeline, never-public list', 'Join as a parent', 'Report a concern', 'Visitor reaches signup/contact', 'None (static)', 'AUTH-02, PUB-09', 'SAF-01', '/safety'],
  ['PUB-08', 'About', 'Public', 'State beliefs and describe the prototype', 'Nav, footer', 'Beliefs, prototype notice, links', 'Create account', 'Reference, Design system', 'None', 'None (static)', 'AUTH-02', 'Reference', '/about'],
  ['PUB-09', 'Contact', 'Public', 'Send a message to the team', 'Nav, footer', 'Form, phone +880, topic, contact info', 'Send message', 'Send another', 'Message received panel', 'Inline field errors; sending state', 'PUB-01', 'PUB-10', '/contact'],
  ['PUB-10', 'FAQ', 'Public', 'Answer common questions', 'Nav, footer', 'Search, grouped accordion', 'Expand a question', 'Search, Contact us', 'Answer expands', 'No-match empty state', 'PUB-09', 'PUB-07', '/faq'],
  ['PUB-11', 'Public tutor profile', 'Public', 'Show a limited tutor profile', 'PUB-03', 'Header, badges, about, reviews, availability, trust ring, stats', 'Send interest (gated)', 'Message (gated), Share, Report (gated)', 'Gate modal; link copied toast', 'Unknown id shows 404', 'PUB-13', 'PRF-02', '/tutors/tanvir-ahmed-rahman'],
  ['PUB-12', 'Public tuition detail', 'Public', 'Show a limited tuition post', 'PUB-04', 'Requirement grid, route preview (Demo), privacy note', "I'm interested (gated)", 'Save (gated), Share, Report (gated)', 'Gate modal; link copied toast', 'Unknown id shows 404', 'PUB-13', 'TD-01', '/tuition/p-1'],
  ['PUB-13', 'Sign-in gate modal', 'Public', 'Stop contact actions for signed-out users', 'Any gated action', 'Modal, reason text, privacy note', 'Log in', 'Create account, Close (Esc)', 'Routes to AUTH-01/02 with return path', 'None', 'AUTH-01, AUTH-02', 'PUB-03, PUB-11', 'Modal on /find-tutor'],
  ['PUB-14', '404 and offline', 'Public', 'Handle missing pages and lost connection', 'Unknown URL', '404 art, actions, offline variant (Demo)', 'Go home', 'Find a tutor, Go back, Try again', 'Navigates away', 'Offline variant', 'PUB-01', 'None', '/page-that-does-not-exist'],
  ['AUTH-01', 'Login', 'All', 'Sign in with email and password', 'Nav, gate modal', 'Form, show password, demo accounts', 'Log in', 'Forgot password, Create account, Admin sign-in', 'Routes to AUTH-13', 'Unknown account; wrong password with attempts; locked', 'AUTH-13', 'AUTH-07, AUTH-11', '/login'],
  ['AUTH-02', 'Sign Up', 'Tutor, Student, Parent, Coaching', 'Create an account', 'Nav, role CTAs', 'Name, email, password, strength meter, confirm, terms', 'Continue', 'Change role, Log in', 'Routes to AUTH-03 or AUTH-04', 'Inline errors; demo email already used', 'AUTH-03, AUTH-04', 'AUTH-01', '/signup'],
  ['AUTH-03', 'Role selection', 'Tutor, Student, Parent, Coaching', 'Pick a role', 'AUTH-02', 'Radio cards for four roles', 'Continue as role', 'How it works', 'Routes to AUTH-04', 'No role chosen error', 'AUTH-04', 'AUTH-02', '/signup/role'],
  ['AUTH-04', 'Phone verification', 'All', 'Collect a +880 mobile number', 'AUTH-02/03', '+880 input, demo notice', 'Send code', 'None', 'Routes to AUTH-05', 'Length and prefix errors', 'AUTH-05', 'AUTH-06', '/verify/phone'],
  ['AUTH-05', 'OTP entry', 'All', 'Confirm the phone with a 6-digit code', 'AUTH-04', '6 boxes, resend timer, demo code (Demo)', 'Verify', 'Resend, Change number, Simulate expired', 'Routes to AUTH-06', 'Wrong (attempts left), expired, locked', 'AUTH-06', 'AUTH-04', '/verify/otp'],
  ['AUTH-06', 'Email verification', 'All', 'Confirm the email address', 'AUTH-05', 'Sent, verified and expired states, Demo link', 'Open link (Demo)', 'Resend, Start again', 'Verified then AUTH-13', 'Expired link', 'AUTH-13', 'AUTH-05', '/verify/email'],
  ['AUTH-07', 'Forgot password', 'All', 'Request a reset link', 'AUTH-01', 'Email field', 'Send reset link', 'Back to log in, Lost phone or email', 'Routes to AUTH-08', 'Invalid email error', 'AUTH-08', 'AUTH-11', '/forgot'],
  ['AUTH-08', 'Reset link sent', 'All', 'Confirm the link was sent', 'AUTH-07', 'Masked email, Demo open link, resend', 'Open reset link (Demo)', 'Resend link', 'Routes to AUTH-09', 'Direct visit redirects to AUTH-07', 'AUTH-09', 'AUTH-07', '/forgot/sent'],
  ['AUTH-09', 'Reset password', 'All', 'Set a new password', 'AUTH-08', 'Two password fields, strength meter', 'Reset password', 'None', 'Routes to AUTH-10', 'Weak password; mismatch', 'AUTH-10', 'AUTH-08', '/reset'],
  ['AUTH-10', 'Reset success', 'All', 'Confirm the new password', 'AUTH-09', 'Success panel', 'Log in', 'None', 'Routes to AUTH-01', 'None', 'AUTH-01', 'AUTH-09', '/reset/done'],
  ['AUTH-11', 'Account recovery', 'All', 'Recover access when phone or email is lost', 'AUTH-01, AUTH-07', 'Problem radios, details, contact email', 'Submit request', 'Back to log in', 'Reference number shown (Demo)', 'Inline errors', 'AUTH-01', 'AUTH-07', '/recover'],
  ['AUTH-12', 'Logout', 'All', 'Confirm and complete sign-out', 'App shell, Sign out', 'Confirm card, signed-out card', 'Log out', 'Stay signed in', 'Signed-out panel', 'Direct visit when signed out shows signed-out panel', 'AUTH-01, PUB-01', 'AUTH-13', '/logout'],
  ['AUTH-13', 'Verification gate', 'Tutor, Student, Parent, Coaching', 'Route by role and verification status', 'After login or signup', 'Status chip, access level, role-specific CTA', 'Continue by status', 'Explore limited dashboard', 'Verified goes to dashboard', 'Rejected and action-required copy', 'Role verification or dashboard', 'TV, SV, PV, CV', '/auth/gate'],
  ['AUTH-14', 'Admin login and 2FA', 'Admin', 'Sign in staff with demo 2FA', 'AUTH-01 footer link', 'Credentials, 6-digit code, Demo code', 'Verify and continue', 'Fill credentials', 'Admin dashboard', 'Bad credentials; wrong code; locked', 'ADM-01', 'SET-09', '/admin/login'],
  ...TUTOR_ROWS,
  ...PARENT_ROWS,
  ...STUDENT_ROWS,
  ...COACHING_ROWS,
]
export const SCREENS: Screen[] = rows.map((r, i) => ({
  id: r[0], name: r[1], role: r[2], purpose: r[3], entry: r[4], components: r[5], primary: r[6], secondary: r[7], success: r[8], error: r[9], next: r[10], related: r[11], route: r[12],
  tier: 'P0', order: i + 1, status: 'Built',
}))

export const PLANNED: { group: string; ids: string; step: string; tier: string }[] = [
  { group: 'Tutor extras not yet separate screens: SCH-02/03/05..08/10/14, ATT-02/03, HW-02..04/06..08, ASG-02..06, RES-01, RPT-01 detail, RNK-02, SAF-02..10', ids: 'Folded into the tutor pages above as tabs, modals or toasts', step: 'Step 8', tier: 'P1' },
  { group: 'Admin console', ids: 'ADM-01 to ADM-23, DASH-A', step: 'Step 7', tier: 'P0' },
  { group: 'Active tuition, schedule, attendance, homework, progress, payments, safety, notifications, replacement, settings', ids: 'ACT, SCH, ATT, HW, ASG, PRG, RPT, REV, RNK, AWD, PAY, SAF, NOT, REP, MAP, SET', step: 'Step 8', tier: 'P1/P2' },
]
