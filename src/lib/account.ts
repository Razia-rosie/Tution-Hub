import type { Role } from './nav'
export let createdAccount: { email: string; password: string; role: Role } | null = null
export const setCreatedAccount = (a: typeof createdAccount) => { createdAccount = a }
