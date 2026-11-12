import React, { useState } from 'react'
import { MoreHorizontal, Pencil, Search, ShieldCheck, Trash2, UserPlus } from 'lucide-react'
import { AppShell } from '../shared/components/AppShell'
import { AdminOnly, Button, PageHeader, Panel, PillarTag } from '../shared/components/ui'
import { Modal } from '../shared/components/Modal'
import { Popover, MenuItem } from '../shared/components/Popover'
import { Field, inputClass } from '../shared/components/NewSessionModal'
import { Column, DataTable } from '../shared/components/DataTable'
import { notify } from '../shared/lib/notify'
import { Pillar, Portal, Role, StaffRow, roleLabel, staff as seed } from '../shared/data/mela'

export const args = {
  role: 'admin',
  portal: 'admin',
}

type Props = Partial<typeof args> & {
  onNavigate?: (to: string) => void
  onPortalChange?: (p: string) => void
  onSignOut?: () => void
}

export default function StaffAccess(props: Props) {
  const { role: r, portal: p, onNavigate, onPortalChange, onSignOut } = { ...args, ...props }
  const role = r as Role
  const portal = (role !== 'admin' && p === 'admin' ? 'hent' : p) as Portal
  const [list, setList] = useState<StaffRow[]>(seed)
  const [editing, setEditing] = useState<StaffRow | 'new' | null>(null)
  const [removing, setRemoving] = useState<StaffRow | null>(null)
  const columns: Column<StaffRow>[] = [
    {
      key: 'name',
      label: 'Person',
      filterable: false,
      render: (s) => (
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-50 text-[11px] font-semibold text-brand-600">{s.name.split(' ').map((n) => n[0]).join('')}</span>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{s.name}</div>
            <div className="truncate text-xs text-muted">{s.email}</div>
          </div>
        </div>
      ),
    },
    { key: 'email', label: 'Email', exportOnly: true },
    { key: 'role', label: 'Role', value: (s) => roleLabel[s.role], render: (s) => <RoleChip role={s.role} /> },
    { key: 'pillars', label: 'Pillars', value: (s) => (s.role === 'admin' ? 'All pillars' : s.pillars.join(' + ')), render: (s) => (s.role === 'admin' ? <span className="text-xs text-muted">All pillars</span> : <span className="flex gap-1">{s.pillars.map((pl) => <PillarTag key={pl} pillar={pl} />)}</span>) },
    { key: 'lastSeen', label: 'Last active', filterable: false, render: (s) => <span className="text-xs text-muted">{s.lastSeen}</span> },
  ]

  return (
    <AppShell role={role} portal={portal} active="staff" onNavigate={onNavigate} onPortalChange={onPortalChange} onSignOut={onSignOut}>
      {role !== 'admin' ? (
        <AdminOnly />
      ) : (
        <div className="mx-auto max-w-[1100px] space-y-5 px-4 py-5 sm:px-5">
          <StaffModal
            value={editing}
            onClose={() => setEditing(null)}
            onSave={(s) => {
              const isNew = !list.some((x) => x.id === s.id)
              setList((xs) => (xs.some((x) => x.id === s.id) ? xs.map((x) => (x.id === s.id ? s : x)) : [...xs, s]))
              setEditing(null)
              notify({ title: isNew ? `Staff added · ${s.email}` : `Role updated · ${s.name}`, body: `${roleLabel[s.role]} · ${s.role === 'admin' ? 'all pillars' : s.pillars.join(', ')}`, tone: 'good', to: 'staff' })
            }}
          />
          <Modal
            open={!!removing}
            onClose={() => setRemoving(null)}
            title={`Remove ${removing?.name ?? ''}?`}
            description="They can still sign in, but will see “no staff role” and no data."
            size="sm"
            icon={<Trash2 className="h-4 w-4" />}
            footer={
              <>
                <Button onClick={() => setRemoving(null)}>Cancel</Button>
                <button
                  type="button"
                  onClick={() => {
                    setList((xs) => xs.filter((x) => x.id !== removing?.id))
                    notify({ title: `Access removed · ${removing?.name ?? ''}`, body: 'They now see “no staff role” when signing in.', tone: 'warn', to: 'staff' })
                    setRemoving(null)
                  }}
                  className="h-9 rounded-lg bg-bad px-4 text-sm font-semibold text-white"
                >
                  Remove access
                </button>
              </>
            }
          />

          <PageHeader
            crumbs={['MELA', 'Staff access']}
            title="Staff Access"
            description={`${list.length} people have a staff role. Pillar staff only see their own pillar, enforced in the database.`}
            actions={
              <Button variant="primary" className="w-full sm:w-auto" onClick={() => setEditing('new')}>
                <UserPlus className="h-4 w-4" /> Add staff
              </Button>
            }
          />

          <DataTable
            title="Staff Access"
            rows={list}
            columns={columns}
            rowKey={(s) => s.id}
            searchPlaceholder="Search staff by name or email"
            emptyIcon={UserPlus}
            empty={{ title: 'No staff yet', body: 'Add a colleague to give them a role.' }}
            rowActions={[
              { label: 'Edit role', icon: Pencil, onClick: (s) => setEditing(s) },
              { label: 'Remove access', icon: Trash2, tone: 'bad', onClick: (s) => setRemoving(s) },
            ]}
            mobileRow={(s) => (
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{s.name}</div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <RoleChip role={s.role} />
                  {s.role === 'admin' ? <span className="text-xs text-muted">All pillars</span> : s.pillars.map((pl) => <PillarTag key={pl} pillar={pl} />)}
                </div>
              </div>
            )}
          />
          <p className="text-xs text-muted">New colleagues must sign in once so their account exists before you can add them.</p>
        </div>
      )}
    </AppShell>
  )
}

const RoleChip: React.FC<{ role: StaffRow['role'] }> = ({ role }) => (
  <span className={`inline-flex h-6 items-center whitespace-nowrap rounded-full px-2 text-xs font-medium ${role === 'admin' ? 'bg-brand-50 text-brand-600' : 'bg-canvas text-body'}`}>
    {roleLabel[role]}
  </span>
)

function StaffModal({ value, onClose, onSave }: { value: StaffRow | 'new' | null; onClose: () => void; onSave: (s: StaffRow) => void }) {
  const existing = value && value !== 'new' ? value : null
  const [role, setRole] = useState<StaffRow['role']>(existing?.role ?? 'pillar_staff')
  const [pillars, setPillars] = useState<Pillar[]>(existing?.pillars ?? ['HENT'])
  const [email, setEmail] = useState(existing?.email ?? '')
  const key = existing?.id ?? 'new'
  const [lastKey, setLastKey] = useState(key)
  if (key !== lastKey) {
    setLastKey(key)
    setRole(existing?.role ?? 'pillar_staff')
    setPillars(existing?.pillars ?? ['HENT'])
    setEmail(existing?.email ?? '')
  }
  const roles: { id: StaffRow['role']; hint: string }[] = [
    { id: 'admin', hint: 'Everything, all pillars, identity data' },
    { id: 'pillar_lead', hint: 'Reads and writes their pillar' },
    { id: 'pillar_staff', hint: 'Same as lead, for their pillar' },
    { id: 'reviewer', hint: 'Scores assigned applications' },
  ]
  return (
    <Modal
      open={!!value}
      onClose={onClose}
      title={existing ? `Edit ${existing.name}` : 'Add staff member'}
      description={existing ? existing.email : 'They need to have signed in once.'}
      icon={<ShieldCheck className="h-4 w-4" />}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() =>
              onSave({
                id: existing?.id ?? `u${Date.now()}`,
                name: existing?.name ?? email.split('@')[0].replace('.', ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
                email,
                role,
                pillars: role === 'admin' ? ['HENT', 'HEMP', 'HECO'] : pillars,
                lastSeen: existing?.lastSeen ?? 'Never',
              })
            }
          >
            {existing ? 'Save changes' : 'Add staff'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {!existing && (
          <Field label="Staff email">
            <input value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="name@chii.alu.edu" />
          </Field>
        )}
        <div>
          <div className="mb-2 text-[13px] font-medium text-body">Role</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {roles.map((x) => (
              <label key={x.id} className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 ${role === x.id ? 'border-brand-600 bg-brand-50' : 'border-line-strong'}`}>
                <input type="radio" checked={role === x.id} onChange={() => setRole(x.id)} className="mt-0.5 accent-brand" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{roleLabel[x.id]}</span>
                  <span className="block text-xs text-muted">{x.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
        {role !== 'admin' && (
          <div>
            <div className="mb-2 text-[13px] font-medium text-body">Pillars</div>
            <div className="grid grid-cols-3 gap-2">
              {(['HENT', 'HEMP', 'HECO'] as Pillar[]).map((pl) => {
                const on = pillars.includes(pl)
                return (
                  <button
                    key={pl}
                    type="button"
                    onClick={() => setPillars(on ? pillars.filter((x) => x !== pl) : [...pillars, pl])}
                    className={`h-10 rounded-lg border text-sm font-semibold transition-colors duration-150 ease-out ${on ? 'border-brand-600 bg-brand-50 text-brand-600' : 'border-line-strong text-body'}`}
                  >
                    {pl}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

