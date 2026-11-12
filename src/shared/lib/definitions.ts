/**
 * Definitions for the Platform Analytics page (every pillar portal and MELA): first what each
 * chart, card and column on the page means, then the full CHII metric dictionary that Reports
 * use, so any metric can be looked up by name or code. Wording comes from the dictionary where
 * the page shows the same metric, so a metric is described the same way everywhere.
 */
import type { Definition } from '../components/DefinitionsModal'
import { INDICATORS, indicatorByCode } from '../reports/indicators'

const def = (code: string) => indicatorByCode.get(code)?.definition ?? ''

const PAGE = 'On this page'

export function platformDefinitions(opts: { ventures: boolean }): Definition[] {
  const page: Omit<Definition, 'group'>[] = [
    { name: 'People reached', where: 'Top chart · Reach', definition: 'Participations in the period, day by day, added up across the pillars shown. Someone who takes part on two days counts on both days; the unique count is “People reached” in the dictionary below.' },
    { name: 'Registrations', where: 'Top chart · Pipeline', definition: 'Registrations received through the forms in the period.' },
    { name: 'Change vs previous period', where: 'Beside the top figure', definition: 'Compared with the same number of days just before the period. For a calendar year, compared with the same dates a year earlier.' },
    { name: 'Registered', code: 'intake.registrations', where: 'Registration to feedback', definition: def('intake.registrations') },
    { name: 'Attended', code: 'participation.attended', where: 'Registration to feedback', definition: def('participation.attended') },
    { name: 'Completed', code: 'participation.completed', where: 'Registration to feedback', definition: def('participation.completed') },
    { name: 'Gave feedback', code: 'feedback.responded', where: 'Registration to feedback', definition: def('feedback.responded') },
    { name: 'Step conversion', where: 'Registration to feedback', definition: 'Each stage as a share of the stage before it, e.g. attended ÷ registered.' },
    { name: 'Attendance rate', where: 'Attendance rate chart', definition: 'People who attended ÷ people who registered, for each part of the period. (Reports use the stricter “Attendance rate” below: attended ÷ people eligible.)' },
    { name: 'Net Promoter Score (NPS)', code: 'feedback.nps', where: 'NPS by intervention · Intervention performance', definition: def('feedback.nps') },
    { name: 'Satisfaction', where: 'Satisfaction & relevance · Intervention performance (Sat.)', definition: 'Average answer to “How satisfied were you?”, on a 1–5 scale. The target line is 4.5.' },
    { name: 'Relevance', code: 'feedback.item.relevance', where: 'Satisfaction & relevance', definition: `${def('feedback.item.relevance')} The target line is 4.5.` },
    { name: 'Gender', where: 'Gender chart', definition: 'People in the period by gender, each counted once by CHII ID.' },
    { name: 'Age', where: 'Age chart', definition: 'People in the period by age group, each counted once by CHII ID.' },
    { name: 'People', where: 'Intervention performance · Reach by country', definition: 'Unique people (counted once by CHII ID) in that intervention or country in the period.' },
    { name: 'Avg. attendance', where: 'Intervention performance · Reach by country', definition: 'Average share of sessions attended by the people in that row.' },
    { name: 'Completion', code: 'completion.rate', where: 'Intervention performance', definition: def('completion.rate') },
    { name: 'Responses', where: 'Intervention performance', definition: 'Feedback forms submitted for that intervention in the period.' },
    { name: 'Female', where: 'Reach by country', definition: 'Share of the people in that country who are female.' },
    { name: 'Cross-pillar', where: 'Reach by country', definition: 'People who have taken part in more than one pillar (HENT, HEMP, HECO).' },
  ]
  const dictionary = INDICATORS.filter((i) => opts.ventures || i.source !== 'registry').map(
    (i): Definition => ({ name: i.name, code: i.code, definition: i.definition, group: i.group === 'Ventures' ? 'Ventures (HENT)' : i.group }),
  )
  return [...page.map((p) => ({ ...p, group: PAGE })), ...dictionary]
}
