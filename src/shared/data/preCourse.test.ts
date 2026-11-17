import { beforeEach, describe, expect, it } from 'vitest'
import { sessions } from './mela'
import { courseFor, getPreCourses, matchStudent, resetPreCourses, saveCourseSettings, selectedOf, studentSummary, syncCourse, PreCourseError } from './preCourse'
import type { SessionRun } from './sessionStore'

const sie = sessions.find((s) => s.intervention === 'SIE') as SessionRun

beforeEach(() => resetPreCourses())

describe('SIE pre-internship course', () => {
  it('enrols only the selected students', () => {
    const run = syncCourse(sie, 'Yusuf')
    const ids = Object.keys(getPreCourses()[sie.id].progress)
    expect(ids.length).toBe(selectedOf(sie).length)
    expect(ids.every((id) => selectedOf(sie).some((p) => p.id === id))).toBe(true)
    expect(run.unmatched).toBe(1)
  })
  it('running the sync twice writes nothing the second time', () => {
    syncCourse(sie, 'Yusuf')
    expect(syncCourse(sie, 'Yusuf').written).toBe(0)
  })
  it('a student matched by staff comes in on the next sync', () => {
    syncCourse(sie, 'Yusuf')
    const u = getPreCourses()[sie.id].unmatched[0]
    matchStudent(sie, u.canvasId, 'CHII-000214')
    syncCourse(sie, 'Yusuf')
    expect(getPreCourses()[sie.id].progress['CHII-000214']).toBeTruthy()
    expect(getPreCourses()[sie.id].unmatched).toHaveLength(0)
  })
  it('anyone not finished after the complete-by date is flagged as not complete', () => {
    syncCourse(sie, 'Yusuf')
    const c = courseFor(sie)
    const after = '2026-03-01'
    const statuses = Object.values(c.progress).map((p) => studentSummary(c, p, after).status)
    expect(statuses.every((st) => st === 'complete' || st === 'not_complete')).toBe(true)
  })
  it('complete-by can’t be before the start', () => {
    expect(() => saveCourseSettings(sie, { startsOn: '2025-12-01', completeBy: '2025-11-01' })).toThrow(PreCourseError)
  })
})
