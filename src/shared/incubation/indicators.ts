/**
 * Incubation indicators shown on the Analytics page, by level (addendum §8), with the
 * implementation-research tag (RE-AIM / Proctor). The Session Mapping sheet's rows are added
 * here when MELA shares it; these are the ones the page already computes.
 */
export type Level = 1 | 2 | 3 | 4 | 5
export const LEVELS: Record<Level, string> = {
  1: 'Reach and engagement',
  2: 'Founder skills',
  3: 'Venture case',
  4: 'Progression',
  5: 'Longer term',
}

export type Indicator = { code: string; level: Level; name: string; definition: string; numerator?: string; denominator?: string; source: string; tag?: string; module?: string }

export const INC_INDICATORS: Indicator[] = [
  { code: 'INC-R01', level: 1, name: 'Founders enrolled', definition: 'Distinct founders enrolled in the Expose cohorts in view (withdrawn included).', source: 'Founders', tag: 'RE-AIM: reach' },
  { code: 'INC-R02', level: 1, name: 'Attendance', definition: 'Sessions attended ÷ sessions held, per founder, then averaged. Modules a founder is exempt from are left out.', numerator: 'Sessions attended', denominator: 'Sessions held (not exempt)', source: 'Attendance', tag: 'Proctor: acceptability' },
  { code: 'INC-R03', level: 1, name: 'Delivered as planned', definition: 'Sessions logged as delivered as planned ÷ sessions with a delivery log.', numerator: 'Logged "as planned"', denominator: 'Sessions logged', source: 'Delivery log', tag: 'Proctor: fidelity' },
  { code: 'INC-R04', level: 1, name: 'Module feedback', definition: 'End-of-module feedback responses (one per founder per module) and their mean rating (1–5).', source: 'Module feedback', tag: 'Proctor: acceptability' },
  { code: 'INC-S01', level: 2, name: 'Skills quiz gain', definition: 'End-of-I4 (or end-of-I1) quiz score minus intake score, for founders with both. Out of 20.', numerator: 'Sum of gains', denominator: 'Founders with both scores', source: 'Skills quiz', tag: 'RE-AIM: effectiveness' },
  { code: 'INC-S02', level: 2, name: 'Confidence gain', definition: 'End-of-I4 confidence minus intake confidence (1–5), for founders with both.', source: 'Confidence survey', tag: 'RE-AIM: effectiveness' },
  { code: 'INC-S03', level: 2, name: 'Mean rubric score', definition: 'Mean of criterion scores (1–4) across assignments and final briefs, by module.', source: 'Assessments' },
  { code: 'INC-S04', level: 2, name: 'Work on time', definition: 'Assignments and briefs handed in on or before the due date ÷ those due so far (not exempt).', numerator: 'On time', denominator: 'Due', source: 'Assessments (Canvas)', tag: 'Proctor: feasibility' },
  { code: 'INC-V01', level: 3, name: 'Change of direction', definition: 'Founders who said their idea changed ÷ founders who answered.', source: 'Founder questions' },
  { code: 'INC-V02', level: 3, name: 'Stakeholders spoken to', definition: 'Median number of stakeholders each founder spoke to.', source: 'Founder questions' },
  { code: 'INC-V03', level: 3, name: 'Real observation', definition: 'Founders whose observation was of a real setting ÷ founders who answered.', source: 'Founder questions' },
  { code: 'INC-P01', level: 4, name: 'Funnel', definition: 'Enrolled → I1 … I4 complete (each needs the earlier ones; exempt counts as complete) → gate reviewed → to Build.', source: 'Progress, gate', tag: 'RE-AIM: adoption' },
  { code: 'INC-P02', level: 4, name: 'Gate decisions', definition: 'Ventures by EBI Evidence Gate decision.', source: 'Gate' },
  { code: 'INC-L01', level: 5, name: 'Follow-up by gate decision', definition: 'For ventures with a gate decision: share still active, jobs and funding from their latest venture update. Read at 6, 12 and 24 months as updates come in.', source: 'Gate × venture updates', tag: 'RE-AIM: maintenance' },
]
