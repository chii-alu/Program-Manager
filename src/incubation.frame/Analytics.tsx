/**
 * Incubation → Analytics: indicators by level (addendum §8) with cohort / module / pathway /
 * gender / country filters in the top bar. Aggregates only: no names, emails or CHII IDs, and
 * anything describing fewer than 5 founders is hidden.
 */
import React, { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, LabelList, Legend as RLegend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { BookOpen, CheckCircle2, ClipboardCheck, EyeOff, Rocket, Users } from 'lucide-react'
import { CHART, ChartTooltip, Funnel, categoryAxisProps, gridProps, valueAxisProps } from '../shared/components/charts'
import { DefinitionsModal } from '../shared/components/DefinitionsModal'
import { PageFilters } from '../shared/components/PageFilters'
import { StatCards } from '../shared/components/StatStrip'
import { Button, PageHeader, Panel } from '../shared/components/ui'
import { bounds, useTimeRange } from '../shared/lib/time'
import { acceptedUpdates } from '../shared/ventures/derive'
import { countryName } from '../shared/ventures/lists'
import { personById } from '../shared/ventures/people'
import { useRegistry } from '../shared/ventures/store'
import { EXPOSE_MODULES, moduleWork } from '../shared/incubation/curriculum'
import { INC_INDICATORS, LEVELS, type Level } from '../shared/incubation/indicators'
import { attendance, cohortSessions, foundersIn, funnel, gateOf, held, isExempt, moduleMean, onTimeShare, resultOf, resultScore, skillsGain } from '../shared/incubation/progress'
import { DELIVERED_LABEL, GATE_LABEL, PATHWAYS, PATHWAY_LABEL, type Delivered, type Founder, type GateChoice, type IncubationData } from '../shared/incubation/types'
import { pct } from './parts'

const NAVY = 'var(--color-navy)'
const SKY = 'var(--color-sky)'
const ORANGE = 'var(--color-orange)'
const MIN_N = 5
const avg = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x != null)
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
}
const median = (xs: number[]) => {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2
}
const r1 = (x: number | null) => (x == null ? null : Math.round(x * 10) / 10)
const def = (code: string) => INC_INDICATORS.find((i) => i.code === code)?.definition

export function IncubationAnalytics({ data, onOpenCohort: _open }: { data: IncubationData; onOpenCohort: (id: string) => void }) {
  const reg = useRegistry()
  const { range, label: periodLabel } = useTimeRange()
  const [f, setF] = useState<Record<string, string[]>>({ cohort: [], module: [], pathway: [], gender: [], country: [] })
  const [defs, setDefs] = useState(false)
  const toggle = (k: string) => (v: string) => setF((x) => ({ ...x, [k]: x[k].includes(v) ? x[k].filter((y) => y !== v) : [...x[k], v] }))

  const countryOf = (ventureId?: string) => reg.countries.find((c) => c.ventureId === ventureId && c.isPrimary)?.countryCode
  const b = bounds(range)
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  // Cohorts that ran during the period, then the cohort filter.
  const cohorts = data.cohorts.filter((c) => c.stage === 'expose' && c.startsOn <= iso(b.end) && (c.endsOn ?? c.startsOn) >= iso(b.start) && (!f.cohort.length || f.cohort.includes(c.id)))
  const keep = (x: Founder): boolean =>
    (!f.pathway.length || (!!x.pathway && f.pathway.includes(x.pathway))) &&
    (!f.gender.length || f.gender.includes(personById(x.chiiId)?.gender ?? '')) &&
    (!f.country.length || f.country.includes(countryOf(x.ventureId) ?? ''))
  const mods = f.module.length ? EXPOSE_MODULES.filter((m) => f.module.includes(m)) : [...EXPOSE_MODULES]
  const rows = cohorts.flatMap((c) => foundersIn(data, c.id, true).filter(keep).map((x) => ({ c, f: x })))
  const enrolled = rows.filter((r) => r.f.status === 'enrolled')
  const people = new Set(rows.map((r) => r.f.chiiId)).size
  const hidden = people > 0 && people < MIN_N

  const a = useMemo(() => {
    const attendanceByModule = mods.map((m) => {
      const v = enrolled.map(({ c, f: x }) => {
        if (isExempt(data, c.id, x.chiiId, m)) return null
        const ss = cohortSessions(data, c.id).filter((s) => s.moduleCode === m && held(s.date))
        return ss.length ? ss.filter((s) => s.present.includes(x.chiiId)).length / ss.length : null
      })
      return { label: m, value: Math.round((avg(v) ?? 0) * 100) }
    })
    const fidelity = mods.map((m) => {
      const ss = cohorts.flatMap((c) => cohortSessions(data, c.id).filter((s) => s.moduleCode === m && s.delivery))
      const by = (k: Delivered) => ss.filter((s) => s.delivery!.delivered === k).length
      return { label: m, as_planned: by('as_planned'), changed: by('changed'), rescheduled: by('rescheduled'), skipped: by('skipped') }
    })
    const logged = fidelity.reduce((n, x) => n + x.as_planned + x.changed + x.rescheduled + x.skipped, 0)
    const asPlanned = fidelity.reduce((n, x) => n + x.as_planned, 0)
    const fb = mods.map((m) => {
      const xs = data.feedback.filter((y) => y.moduleCode === m && enrolled.some((r) => r.c.id === y.cohortId && r.f.chiiId === y.chiiId))
      return { label: m, value: xs.length, rating: r1(avg(xs.map((y) => y.rating))) }
    })
    const quiz = (['intake', 'end_i1', 'end_i4'] as const).map((t) => ({ label: t === 'intake' ? 'Intake' : t === 'end_i1' ? 'End of I1' : 'End of I4', value: r1(avg(enrolled.map(({ c, f: x }) => resultScore(resultOf(data, c.id, `QUIZ-${t}`, x.chiiId))))) ?? 0 }))
    const conf = (['intake', 'end_i4'] as const).map((t) => ({ label: t === 'intake' ? 'Intake' : 'End of I4', value: r1(avg(enrolled.map(({ c, f: x }) => resultScore(resultOf(data, c.id, `CONF-${t}`, x.chiiId))))) ?? 0 }))
    const qGain = enrolled.map(({ c, f: x }) => skillsGain(data, c.id, x.chiiId, 'QUIZ')?.gain ?? null)
    const cGain = enrolled.map(({ c, f: x }) => skillsGain(data, c.id, x.chiiId, 'CONF')?.gain ?? null)
    const rubric = mods.map((m) => ({ label: m, value: r1(avg(enrolled.map(({ c, f: x }) => moduleMean(data, c.id, x.chiiId, m)))) ?? 0 }))
    const due = enrolled.map(({ c, f: x }) => onTimeShare(data, c, x.chiiId))
    const onTime = due.reduce((n, d) => n + d.onTime, 0) / Math.max(1, due.reduce((n, d) => n + d.due, 0))
    const answered = enrolled.filter((r) => r.f.ideaChanged != null)
    const obs = enrolled.filter((r) => r.f.observationType)
    const pathways = PATHWAYS.map((p) => ({ label: PATHWAY_LABEL[p], value: enrolled.filter((r) => r.f.pathway === p).length })).filter((x) => x.value)
    const steps = funnel(data, cohorts, keep).map((s) => ({ key: s.key, label: s.label, value: s.n }))
    const teams = new Map<string, { c: (typeof cohorts)[number]; f: Founder }>()
    for (const r of rows) teams.set(`${r.c.id}|${r.f.ventureId ?? r.f.chiiId}`, r)
    const decisions = [...teams.values()].map(({ c, f: x }) => gateOf(data, c.id, x)).filter(Boolean)
    const byDecision = (Object.keys(GATE_LABEL) as GateChoice[]).map((k) => ({ label: GATE_LABEL[k], key: k, value: decisions.filter((g) => g!.decision === k).length }))
    const followUp = (Object.keys(GATE_LABEL) as GateChoice[]).map((k) => {
      const vs = [...new Set(decisions.filter((g) => g!.decision === k && g!.ventureId).map((g) => g!.ventureId!))]
      const latest = vs.map((id) => acceptedUpdates(reg, id).slice(-1)[0]).filter(Boolean)
      return { k, n: vs.length, active: latest.filter((u) => u.status === 'Active').length, jobs: latest.reduce((n, u) => n + u.jobsTotal, 0), funding: latest.reduce((n, u) => n + u.fundingUsd, 0) }
    })
    return {
      attendanceByModule,
      fidelity,
      fidelityShare: logged ? asPlanned / logged : null,
      fb,
      quiz,
      conf,
      qGain: avg(qGain),
      qGainN: qGain.filter((x) => x != null).length,
      cGain: avg(cGain),
      rubric,
      onTime,
      changed: answered.length ? answered.filter((r) => r.f.ideaChanged).length / answered.length : null,
      stakeholders: median(enrolled.map((r) => r.f.stakeholders).filter((x): x is number => x != null)),
      realObs: obs.length ? obs.filter((r) => r.f.observationType === 'real').length / obs.length : null,
      pathways,
      steps,
      byDecision,
      followUp,
      att: avg(enrolled.map(({ c, f: x }) => attendance(data, c, x.chiiId).pct)),
    }
  }, [data, reg, JSON.stringify(f), range.preset, range.from, range.to, range.year])

  const genders = [...new Set(data.founders.map((x) => personById(x.chiiId)?.gender).filter(Boolean))] as string[]
  const countries = [...new Set(data.founders.map((x) => countryOf(x.ventureId)).filter(Boolean))] as string[]

  return (
    <>
      <PageFilters
        onClear={() => setF({ cohort: [], module: [], pathway: [], gender: [], country: [] })}
        groups={[
          { key: 'cohort', label: 'Cohort', options: data.cohorts.filter((c) => c.stage === 'expose').map((c) => ({ value: c.id, label: c.name.replace('Incubation ', '') })), selected: f.cohort, onToggle: toggle('cohort') },
          { key: 'module', label: 'Module', options: EXPOSE_MODULES.map((m) => ({ value: m })), selected: f.module, onToggle: toggle('module') },
          { key: 'pathway', label: 'Pathway', options: PATHWAYS.map((p) => ({ value: p, label: PATHWAY_LABEL[p] })), selected: f.pathway, onToggle: toggle('pathway') },
          { key: 'gender', label: 'Gender', options: genders.map((g) => ({ value: g, label: g === 'F' ? 'Women' : g === 'M' ? 'Men' : g })), selected: f.gender, onToggle: toggle('gender') },
          { key: 'country', label: 'Venture country', options: countries.map((c) => ({ value: c, label: countryName(c) })), selected: f.country, onToggle: toggle('country') },
        ]}
      />
      <PageHeader
        crumbs={['HENT', 'Incubation', 'Analytics']}
        title="Incubation Analytics"
        description={`${cohorts.length} Expose cohort${cohorts.length === 1 ? '' : 's'} that ran in ${periodLabel.toLowerCase()}. Founders are counted once each; groups under ${MIN_N} are hidden.`}
        actions={
          <Button onClick={() => setDefs(true)}>
            <BookOpen className="h-4 w-4" /> Definitions
          </Button>
        }
      />
      {people === 0 ? (
        <Panel>
          <div className="grid min-h-[240px] place-items-center p-6 text-center text-sm text-muted">No founders in this view. Try “All time” under Filters, or fewer filters.</div>
        </Panel>
      ) : hidden ? (
        <Panel>
          <div className="grid min-h-[240px] place-items-center p-6 text-center">
            <div>
              <EyeOff className="mx-auto h-6 w-6 text-muted" />
              <p className="mt-2 text-sm font-semibold text-ink">Fewer than {MIN_N} founders in this view</p>
              <p className="mt-1 text-sm text-muted">Figures are hidden so no one can be identified. Remove a filter to see them.</p>
            </div>
          </div>
        </Panel>
      ) : (
        <>
          <StatCards
            items={[
              { label: 'Founders', value: people, icon: Users, hint: `${new Set(rows.map((r) => r.f.ventureId).filter(Boolean)).size} ventures`, tip: def('INC-R01') },
              { label: 'Attendance', value: 0, display: pct(a.att), icon: CheckCircle2, hint: 'Sessions held so far', tip: def('INC-R02') },
              { label: 'Work on time', value: 0, display: pct(a.onTime), icon: ClipboardCheck, hint: 'Assignments and briefs due', tip: def('INC-S04') },
              { label: 'To Build', value: a.steps[6].value, icon: Rocket, hint: `${a.steps[5].value} reviewed at the gate`, tip: def('INC-P01') },
            ]}
          />
          <LevelHead level={1} />
          <Grid>
            <ChartPanel title="Attendance by module" sub="Average share of sessions attended" info={def('INC-R02')}>
              <Bars data={a.attendanceByModule} suffix="%" max={100} />
            </ChartPanel>
            <ChartPanel title="Delivery fidelity" sub={`Sessions by how they were delivered · ${pct(a.fidelityShare)} as planned`} info={def('INC-R03')}>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={a.fidelity} margin={{ top: 10, right: 10, bottom: 0, left: -16 }}>
                  <CartesianGrid {...gridProps} vertical={false} />
                  <XAxis dataKey="label" {...categoryAxisProps} />
                  <YAxis allowDecimals={false} {...valueAxisProps} />
                  <Tooltip content={<ChartTooltip />} cursor={CHART.cursor} />
                  <RLegend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="as_planned" name={DELIVERED_LABEL.as_planned} stackId="d" fill={NAVY} isAnimationActive={false} barSize={40} />
                  <Bar dataKey="changed" name={DELIVERED_LABEL.changed} stackId="d" fill={SKY} isAnimationActive={false} />
                  <Bar dataKey="rescheduled" name={DELIVERED_LABEL.rescheduled} stackId="d" fill="var(--color-faint)" isAnimationActive={false} />
                  <Bar dataKey="skipped" name={DELIVERED_LABEL.skipped} stackId="d" fill={ORANGE} isAnimationActive={false} radius={CHART.barRadius} />
                </BarChart>
              </ResponsiveContainer>
            </ChartPanel>
            <ChartPanel title="Module feedback" sub="Responses per module (one per founder), with the mean rating out of 5" info={def('INC-R04')}>
              <Bars data={a.fb.map((x) => ({ label: x.label, value: x.value, note: x.rating != null ? `★ ${x.rating}` : '' }))} />
            </ChartPanel>
          </Grid>
          <LevelHead level={2} />
          <StatCards
            columns={3}
            items={[
              { label: 'Skills quiz gain', value: 0, display: a.qGain == null ? '—' : `${a.qGain > 0 ? '+' : ''}${a.qGain.toFixed(1)}`, hint: `Out of 20 · ${a.qGainN} founders with both quizzes`, tip: def('INC-S01') },
              { label: 'Confidence gain', value: 0, display: a.cGain == null ? '—' : `${a.cGain > 0 ? '+' : ''}${a.cGain.toFixed(1)}`, hint: 'Out of 5 · intake to end of I4', tip: def('INC-S02') },
              { label: 'Mean rubric', value: 0, display: avg(a.rubric.map((x) => x.value || null))?.toFixed(1) ?? '—', hint: '1–4, across modules in view', tip: def('INC-S03') },
            ]}
          />
          <Grid>
            <ChartPanel title="Skills quiz" sub="Mean score out of 20, at each point" info={def('INC-S01')}>
              <Bars data={a.quiz} max={20} color={SKY} />
            </ChartPanel>
            <ChartPanel title="Rubric scores by module" sub="Mean of criterion scores, 1–4" info={def('INC-S03')}>
              <Bars data={a.rubric} max={4} />
            </ChartPanel>
            <ChartPanel title="Confidence" sub="Mean of the confidence survey, 1–5" info={def('INC-S02')}>
              <Bars data={a.conf} max={5} color={SKY} />
            </ChartPanel>
          </Grid>
          <LevelHead level={3} />
          <StatCards
            columns={3}
            items={[
              { label: 'Changed direction', value: 0, display: pct(a.changed), hint: 'Said their idea changed', tip: def('INC-V01') },
              { label: 'Stakeholders spoken to', value: 0, display: a.stakeholders == null ? '—' : String(a.stakeholders), hint: 'Median per founder', tip: def('INC-V02') },
              { label: 'Real observation', value: 0, display: pct(a.realObs), hint: 'Observed a real setting', tip: def('INC-V03') },
            ]}
          />
          <Grid>
            <ChartPanel title="Founders by pathway" sub="Regulatory and business pathway of their venture">
              <Bars data={a.pathways.map((x) => ({ ...x, value: x.value < MIN_N ? 0 : x.value, note: x.value < MIN_N ? `<${MIN_N}` : '' }))} horizontal />
            </ChartPanel>
          </Grid>
          <LevelHead level={4} />
          <Grid>
            <ChartPanel title="Expose funnel" sub="Each step needs the ones before it; exempt counts as complete" info={def('INC-P01')}>
              <div className="px-2 py-1">
                <Funnel steps={a.steps} />
              </div>
            </ChartPanel>
            <ChartPanel title="Gate decisions" sub="Ventures, by EBI Evidence Gate decision" info={def('INC-P02')}>
              <Bars data={a.byDecision} color={NAVY} />
            </ChartPanel>
          </Grid>
          <LevelHead level={5} />
          <Panel title="Follow-up by gate decision" sub="Ventures’ latest update in the registry. Read again at 6, 12 and 24 months as updates come in." info={def('INC-L01')}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="border-b border-line bg-canvas/60 text-left text-[11px] font-bold uppercase tracking-[0.05em] text-muted">
                  <tr>
                    <th className="px-4 py-2">Decision</th>
                    <th className="px-4 py-2 text-right">Ventures</th>
                    <th className="px-4 py-2 text-right">Still active</th>
                    <th className="px-4 py-2 text-right">Jobs</th>
                    <th className="px-4 py-2 text-right">Funding raised</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {a.followUp.map((x) => (
                    <tr key={x.k}>
                      <td className="px-4 py-2.5 font-semibold text-ink">{GATE_LABEL[x.k]}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{x.n}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{x.n ? (x.n < MIN_N ? `<${MIN_N} ventures` : pct(x.active / x.n)) : '—'}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{x.n && x.n >= MIN_N ? x.jobs : x.n ? 'Hidden' : '—'}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{x.n && x.n >= MIN_N ? `$${Math.round(x.funding).toLocaleString()}` : x.n ? 'Hidden' : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="border-t border-line px-4 py-2.5 text-xs text-muted">Rows with fewer than {MIN_N} ventures show the count only.</p>
          </Panel>
        </>
      )}
      <DefinitionsModal
        open={defs}
        onClose={() => setDefs(false)}
        title="Incubation indicators"
        description="How each figure on this page is worked out, by level. Tags show the implementation-research frame (RE-AIM or Proctor)."
        items={INC_INDICATORS.map((i) => ({ name: i.name, code: i.code, definition: `${i.definition}${i.numerator ? ` Numerator: ${i.numerator}. Denominator: ${i.denominator}.` : ''} Source: ${i.source}.${i.tag ? ` ${i.tag}.` : ''}`, group: `Level ${i.level} · ${LEVELS[i.level]}` }))}
      />
    </>
  )
}

function LevelHead({ level }: { level: Level }) {
  return (
    <h2 className="flex items-center gap-2 pt-2 text-[13px] font-bold uppercase tracking-[0.08em] text-muted">
      <span className="grid h-6 w-6 place-items-center rounded-full bg-brand text-[11px] text-white">{level}</span>
      {LEVELS[level]}
    </h2>
  )
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">{children}</div>
}

function ChartPanel({ title, sub, info, children }: { title: string; sub?: string; info?: string; children: React.ReactNode }) {
  return (
    <Panel title={title} sub={sub} info={info}>
      <div className="px-3 pb-3 pt-4">{children}</div>
    </Panel>
  )
}

function Bars({ data, suffix = '', max, color = NAVY, horizontal }: { data: { label: string; value: number; note?: string }[]; suffix?: string; max?: number; color?: string; horizontal?: boolean }) {
  if (!data.length || data.every((d) => !d.value && !d.note)) return <div className="grid h-[200px] place-items-center text-sm text-muted">Nothing to show in this view yet.</div>
  const rows = data.map((d) => ({ ...d, display: d.note && !d.value ? d.note : `${d.value}${suffix}${d.note ? ` · ${d.note}` : ''}` }))
  return (
    <ResponsiveContainer width="100%" height={horizontal ? Math.max(160, rows.length * 34 + 30) : 230}>
      {horizontal ? (
        <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 56, bottom: 0, left: 0 }}>
          <CartesianGrid {...gridProps} horizontal={false} />
          <XAxis type="number" allowDecimals={false} domain={[0, max ?? 'auto']} {...valueAxisProps} />
          <YAxis type="category" dataKey="label" width={130} {...categoryAxisProps} />
          <Tooltip content={<ChartTooltip suffix={suffix} />} cursor={CHART.cursor} />
          <Bar dataKey="value" name="Founders" fill={color} radius={CHART.barRadiusH} barSize={18} isAnimationActive={false}>
            <LabelList dataKey="display" position="right" fontSize={11} fontWeight={700} fill="var(--color-brand-deep)" />
          </Bar>
        </BarChart>
      ) : (
        <BarChart data={rows} margin={{ top: 18, right: 10, bottom: 0, left: -16 }} barCategoryGap="28%">
          <CartesianGrid {...gridProps} vertical={false} />
          <XAxis dataKey="label" {...categoryAxisProps} interval={0} />
          <YAxis allowDecimals={!!max && max <= 5} domain={[0, max ?? 'auto']} {...valueAxisProps} />
          <Tooltip content={<ChartTooltip suffix={suffix} />} cursor={CHART.cursor} />
          <Bar dataKey="value" name="Value" fill={color} radius={CHART.barRadius} barSize={46} isAnimationActive={false}>
            <LabelList dataKey="display" position="top" fontSize={11} fontWeight={700} fill="var(--color-brand-deep)" />
          </Bar>
        </BarChart>
      )}
    </ResponsiveContainer>
  )
}

export { moduleWork }
