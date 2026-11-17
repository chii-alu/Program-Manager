import { beforeEach, describe, expect, it } from 'vitest'
import { sessions } from './mela'
import { MeetingError, addMeeting, attendanceByPerson, cohortMembers, deleteMeeting, meetingsFor, resetMeetings, setPresent, updateMeeting } from './meetings'
import type { SessionRun } from './sessionStore'

const sie = sessions.find((s) => s.intervention === 'SIE') as SessionRun
beforeEach(() => resetMeetings())

describe('attendance by meeting (selective)', () => {
  it('starts with one meeting per cohort date', () => {
    expect(meetingsFor(sie).length).toBe(6)
  })
  it('a meeting for some people only counts towards their rate', () => {
    const members = cohortMembers(sie).map((p) => p.id)
    const [a, b] = members
    const m = addMeeting(sie, { title: 'Site visit: group A', type: 'Site visit', date: '2025-11-05', time: '10:00', mode: 'In person', invite: [a] }, 'Yusuf')
    setPresent(sie, m.id, [a], true)
    const rows = attendanceByPerson(meetingsFor(sie), members)
    const before = rows.find((r) => r.id === b)!.expected
    expect(rows.find((r) => r.id === a)!.expected).toBe(before + 1)
  })
  it('narrowing who’s expected drops their check-ins', () => {
    const members = cohortMembers(sie).map((p) => p.id)
    const m = addMeeting(sie, { title: 'Workshop', type: 'Workshop', date: '2025-11-06', mode: 'Online', invite: 'all' }, 'Yusuf')
    setPresent(sie, m.id, members, true)
    updateMeeting(sie, m.id, { title: 'Workshop', type: 'Workshop', date: '2025-11-06', mode: 'Online', invite: [members[0]] })
    expect(Object.keys(meetingsFor(sie).find((x) => x.id === m.id)!.present)).toEqual([members[0]])
  })
  it('needs a name and someone expected', () => {
    expect(() => addMeeting(sie, { title: ' ', type: 'Other', date: '2025-11-06', mode: 'Online', invite: 'all' }, 'Y')).toThrow(MeetingError)
    expect(() => addMeeting(sie, { title: 'X', type: 'Other', date: '2025-11-06', mode: 'Online', invite: [] }, 'Y')).toThrow(MeetingError)
  })
  it('deletes a meeting', () => {
    const id = meetingsFor(sie)[0].id
    deleteMeeting(sie, id)
    expect(meetingsFor(sie).some((m) => m.id === id)).toBe(false)
  })
})
