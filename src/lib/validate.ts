export const validEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim())
export const normalizePhone = (v: string) => v.replace(/\D/g, '').replace(/^0/, '').slice(0, 10)
export const validPhone = (v: string) => /^1[3-9]\d{8}$/.test(v)
export const maskPhone = (v: string) => (v.length >= 10 ? `+880 ${v.slice(0, 2)}•• •••${v.slice(-3)}` : '+880 ••••••••••')
export const maskEmail = (v: string) => { const [a, b] = v.split('@'); return b ? `${a.slice(0, 2)}${'•'.repeat(Math.max(2, a.length - 2))}@${b}` : v }
export function strength(pw: string) {
  const checks = [pw.length >= 8, /[a-z]/.test(pw) && /[A-Z]/.test(pw), /\d/.test(pw), /[^A-Za-z0-9]/.test(pw)]
  const score = checks.filter(Boolean).length
  return { score, checks, label: ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'][score] }
}
export const DEMO_ACCOUNTS = [
  { email: 'tanvir@demo.tuitionhub.test', role: 'tutor', label: 'Tutor · Tanvir Ahmed Rahman' },
  { email: 'farzana@demo.tuitionhub.test', role: 'parent', label: 'Parent · Farzana Islam' },
  { email: 'nabila@demo.tuitionhub.test', role: 'student', label: 'Student · Nabila Chowdhury' },
  { email: 'scholars@demo.tuitionhub.test', role: 'coaching', label: 'Coaching · Scholars Point' },
  { email: 'locked@demo.tuitionhub.test', role: 'tutor', label: 'Locked account (demo)' },
] as const
export const DEMO_PASSWORD = 'Demo@1234'
export const DEMO_OTP_FIRST = '482913'
export const DEMO_OTP_RESENT = '735216'
export const DEMO_2FA = '246810'
