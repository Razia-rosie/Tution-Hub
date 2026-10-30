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
