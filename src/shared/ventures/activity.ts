import type { ActivityEntry, RegistryData, UpdateLink } from './types'

/**
 * The activity log for registries saved before it existed (and the sample data), rebuilt from
 * what the records already say: when registrations arrived and who reviewed them, when links
 * were created, sent and reminded, and when founders answered. Bulk link actions made at the
 * same moment become one entry. Who sent the links wasn't recorded then, so it says so
 * (the sample data names the HENT lead).
 */
export function rebuildActivity(d: RegistryData, unrecorded = 'HENT team (not recorded)'): ActivityEntry[] {
  const out: ActivityEntry[] = []
  const code = (id?: string) => d.ventures.find((v) => v.id === id)?.code ?? ''
  for (const s of d.submissions ?? []) {
    out.push({ id: `act-r-${s.id}`, at: s.receivedAt, by: 'Registration form', area: 'registrations', action: 'registration_received', detail: `${s.name} registered`, submissionId: s.id })
    if (s.status === 'accepted' && s.reviewedAt)
      out.push({ id: `act-a-${s.id}`, at: s.reviewedAt, by: s.reviewedBy ?? 'Unknown', area: 'registrations', action: 'registration_accepted', detail: `${s.name} added to the registry as ${code(s.ventureId)}`, submissionId: s.id, ventureId: s.ventureId })
    if (s.status === 'rejected' && s.reviewedAt)
      out.push({ id: `act-d-${s.id}`, at: s.reviewedAt, by: s.reviewedBy ?? 'Unknown', area: 'registrations', action: 'registration_declined', detail: `${s.name} declined: ${s.rejectReason ?? 'no reason given'}`, submissionId: s.id })
  }
  const bulk = (field: 'createdAt' | 'sentAt' | 'remindedAt', action: ActivityEntry['action'], verb: string) => {
    const groups = new Map<string, UpdateLink[]>()
    for (const l of d.links ?? []) {
      const at = l[field]
      if (at) groups.set(`${l.roundId}|${at}`, [...(groups.get(`${l.roundId}|${at}`) ?? []), l])
    }
    for (const [k, ls] of groups) {
      const [roundId, at] = k.split('|')
      const round = (d.settings?.rounds ?? []).find((r) => r.id === roundId)?.label ?? roundId
      out.push({ id: `act-${action}-${k}`, at, by: unrecorded, area: 'updates', action, detail: `${verb} ${ls.length} link${ls.length === 1 ? '' : 's'} · ${round}`, count: ls.length })
    }
  }
  bulk('createdAt', 'links_created', 'Created')
  bulk('sentAt', 'links_sent', 'Sent')
  bulk('remindedAt', 'links_reminded', 'Reminded')
  for (const u of d.updates.filter((x) => x.source === 'founder_form' && x.updateType === 'update')) {
    const link = (d.links ?? []).find((l) => l.updateId === u.id)
    out.push({ id: `act-f-${u.id}`, at: link?.respondedAt ?? `${u.asOf}T12:00:00.000Z`, by: 'Founder update form', area: 'updates', action: 'founder_update_received', detail: `${code(u.ventureId)} sent an update as of ${u.asOf}`, ventureId: u.ventureId })
    if (u.acceptedAt) out.push({ id: `act-u-${u.id}`, at: u.acceptedAt, by: u.acceptedBy ?? 'Unknown', area: 'updates', action: 'update_accepted', detail: `Accepted ${code(u.ventureId)}’s update as of ${u.asOf}`, ventureId: u.ventureId })
  }
  return out.sort((a, b) => a.at.localeCompare(b.at))
}
