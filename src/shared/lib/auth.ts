import { Portal, Role, staff } from '../data/mela'

export type Account = { role: Role; portal: Portal; name: string; email: string }

export const DEMO_PASSWORD = 'chii-demo-2026'

export const demoAccounts: (Account & { label: string; scope: string; initials: string })[] = [
  { role: 'admin', portal: 'admin', name: 'Amara Okafor', initials: 'AO', email: 'amara.okafor@chii.alu.edu', label: 'MELA admin', scope: 'All pillars · sees identity' },
  { role: 'pillar_lead', portal: 'hent', name: 'Tendai Moyo', initials: 'TM', email: 'tendai.moyo@chii.alu.edu', label: 'Pillar lead', scope: 'HENT only' },
  { role: 'pillar_staff', portal: 'hemp', name: 'Grace Wanjiru', initials: 'GW', email: 'grace.wanjiru@chii.alu.edu', label: 'Pillar staff', scope: 'HEMP only' },
  { role: 'reviewer', portal: 'hemp', name: 'Kofi Mensah', initials: 'KM', email: 'kofi.mensah@chii.alu.edu', label: 'Reviewer', scope: 'Scores applications' },
  { role: 'none', portal: 'hent', name: 'Lina Haddad', initials: 'LH', email: 'lina.haddad@alu.edu', label: 'No staff role', scope: 'Signs in, sees no data' },
]

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function validateEmail(v: string): string | null {
  const s = v.trim()
  if (!s) return 'Enter your email address.'
  if (!EMAIL.test(s)) return 'Enter a valid email, like name@chii.alu.edu.'
  if (!/@(chii\.)?alu\.edu$/i.test(s)) return 'Use your ALU or CHII staff email.'
  return null
}

export function validatePassword(v: string): string | null {
  if (!v) return 'Enter your password.'
  if (v.length < 8) return `Passwords are at least 8 characters (${v.length} so far).`
  return null
}

/** The callback's lookup: the staff_roles row decides the role and the home portal. */
export function resolveAccount(email: string): Account {
  const e = email.trim().toLowerCase()
  const demo = demoAccounts.find((d) => d.email === e)
  if (demo) return demo
  const row = staff.find((s) => s.email === e)
  if (row) return { role: row.role, portal: row.role === 'admin' ? 'admin' : (row.pillars[0].toLowerCase() as Portal), name: row.name, email: e }
  const name = e.split('@')[0].split('.').map((w) => w[0]?.toUpperCase() + w.slice(1)).join(' ')
  return { role: 'none', portal: 'hent', name, email: e }
}

export const portalName: Record<Portal, string> = { admin: 'MELA admin view', hent: 'HENT portal', hemp: 'HEMP portal', heco: 'HECO portal' }
