import {
  LayoutDashboard, Search, FileText, Users, CalendarDays, CheckSquare, BookOpen, ClipboardList,
  LineChart, Star, Trophy, Award, Wallet, ShieldCheck, User, MessageSquare, Bell, ShieldAlert,
  Home, GraduationCap, Baby, GitCompare, Building2, Layers, School, FileBarChart, AlertTriangle,
  Gavel, Settings, BarChart3, MapPin, MoreHorizontal, Flag, Inbox,
  type LucideIcon,
} from 'lucide-react'

export type Role = 'tutor' | 'student' | 'parent' | 'coaching' | 'admin'

export const ROLES: { id: Role; label: string; persona: string; blurb: string }[] = [
  { id: 'tutor', label: 'Tutor', persona: 'Tanvir Ahmed Rahman', blurb: 'Find tuition, manage students, build trust' },
  { id: 'parent', label: 'Parent / Guardian', persona: 'Farzana Islam', blurb: 'Find a verified tutor, monitor progress' },
  { id: 'student', label: 'Student', persona: 'Nabila Chowdhury', blurb: 'Learn, submit homework, track progress' },
  { id: 'coaching', label: 'Coaching / Institute', persona: 'Scholars Point Coaching', blurb: 'Run batches, classes, exams' },
  { id: 'admin', label: 'Admin', persona: 'Platform Operations (Demo)', blurb: 'Verify, moderate, audit' },
]

export type NavItem = { slug: string; label: string; icon: LucideIcon; mobile?: boolean }

const n = (slug: string, label: string, icon: LucideIcon, mobile = false): NavItem => ({ slug, label, icon, mobile })

export const NAV: Record<Role, NavItem[]> = {
  tutor: [
    n('dashboard', 'Dashboard', LayoutDashboard, true), n('find-tuition', 'Find Tuition', Search, true),
    n('my-posts', 'My Posts', FileText), n('my-students', 'My Students', Users), n('schedule', 'Schedule', CalendarDays, true),
    n('attendance', 'Attendance', CheckSquare), n('homework', 'Homework', BookOpen), n('assignments', 'Assignments', ClipboardList),
    n('progress', 'Progress', LineChart), n('reviews', 'Reviews', Star), n('ranking', 'Ranking', Trophy), n('awards', 'Awards', Award),
    n('payments', 'Payments', Wallet), n('verification', 'Verification', ShieldCheck), n('profile', 'Profile', User),
    n('messages', 'Messages', MessageSquare, true), n('notifications', 'Notifications', Bell), n('safety', 'Safety', ShieldAlert),
  ],
  student: [
    n('home', 'Home', Home, true), n('my-tuition', 'My Tuition', GraduationCap), n('schedule', 'Schedule', CalendarDays, true),
    n('attendance', 'Attendance', CheckSquare), n('homework', 'Homework', BookOpen, true), n('assignments', 'Assignments', ClipboardList),
    n('progress', 'Progress', LineChart), n('tutor', 'Tutor', User), n('messages', 'Messages', MessageSquare, true),
    n('profile', 'Profile', User), n('find-tutor', 'Find Tutor', Search), n('notifications', 'Notifications', Bell), n('safety', 'Safety', ShieldAlert),
  ],
  parent: [
    n('dashboard', 'Dashboard', LayoutDashboard, true), n('children', 'Children', Baby, true), n('find-tutor', 'Find Tutor', Search),
    n('my-posts', 'My Posts', FileText), n('tuitions', 'Active Tuitions', GraduationCap, true), n('schedule', 'Schedule', CalendarDays),
    n('attendance', 'Attendance', CheckSquare), n('homework', 'Homework & Assignments', BookOpen), n('progress', 'Progress & Reports', LineChart),
    n('payments', 'Payments', Wallet), n('messages', 'Messages', MessageSquare, true), n('notifications', 'Notifications', Bell),
    n('safety', 'Safety', ShieldAlert), n('settings', 'Profile & Settings', Settings),
  ],
  coaching: [
    n('dashboard', 'Dashboard', LayoutDashboard, true), n('teachers', 'Teachers', Users), n('students', 'Students', GraduationCap, true),
    n('batches', 'Batches', Layers), n('classes', 'Classes', School, true), n('attendance', 'Attendance', CheckSquare),
    n('homework', 'Homework', BookOpen), n('exams', 'Exams', ClipboardList), n('results', 'Results', BarChart3), n('parents', 'Parents', Baby),
    n('reports', 'Reports', FileBarChart), n('payments', 'Payments', Wallet), n('verification', 'Verification', ShieldCheck),
    n('profile', 'Profile', Building2), n('messages', 'Messages', MessageSquare, true), n('notifications', 'Notifications', Bell),
  ],
  admin: [
    n('overview', 'Overview', LayoutDashboard), n('users', 'Users', Users), n('tutors', 'Tutors', User), n('students', 'Students', GraduationCap),
    n('parents', 'Parents', Baby), n('coaching', 'Coaching', Building2), n('verification', 'Verification', ShieldCheck),
    n('tuition-posts', 'Tuition Posts', FileText), n('matches', 'Matches', GitCompare), n('reports', 'Reports', Flag),
    n('complaints', 'Complaints', AlertTriangle), n('reviews', 'Reviews', Star), n('awards', 'Awards', Award), n('payments', 'Payments', Wallet),
    n('safety', 'Safety', ShieldAlert), n('analytics', 'Analytics', LineChart), n('appeals', 'Appeals', Gavel), n('settings', 'Settings', Settings),
  ],
}

export const MORE_ICON = MoreHorizontal
export const ICONS_MISC = { MapPin, Inbox }

export const verifyPath = (role: Role) =>
  `/app/${role}/${role === 'parent' ? 'settings/verification' : role === 'student' ? 'profile/verification' : 'verification'}`
