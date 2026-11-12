import React, { useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, ChevronDown, ImagePlus, Lock, Save, ShieldAlert, Sparkles } from 'lucide-react'
import { Button, Panel, PanelHeader, PillarTag } from '../shared/components/ui'
import { roleLabel, staff, type Pillar } from '../shared/data/mela'
import { cohorts as allCohorts } from '../shared/reports/facts'
import { FILTERS, MetricAccessError, MetricPolicyError, filterOptions, getMetric, scopeOptions } from '../shared/reports/metrics'
import { PRESETS, REPORT_SETTINGS, comparisonPeriod, customPeriod, fmtRange, presetPeriod, type PresetId } from '../shared/reports/periods'
import { canEditReport, newId, saveReport } from '../shared/reports/store'
import type { FixTarget } from '../shared/reports/quality'
import { CheckStep, FinaliseStep } from './FinishSteps'
import { SCOPE_TYPE_LABEL, SYSTEM_TEMPLATES, templateById } from '../shared/reports/templates'
import type { Audience, Comparison, DateRule, FilterKey, Report, Scope, Viewer } from '../shared/reports/types'
import { AUDIENCE, ChoiceCard, Chip, DATE_RULE, Field, TemplateThumb, inputCls } from './parts'
import { ContentStep, ensureContent } from './ContentStep'
import { defaultContent } from '../shared/reports/blocks'
import { canUseVentures } from '../shared/ventures/store'

const STEPS = [
  { n: 1, label: 'Template' },
  { n: 2, label: 'Scope and period' },
  { n: 3, label: 'Details' },
  { n: 4, label: 'Content' },
  { n: 5, label: 'Preview and check' },
  { n: 6, label: 'Finalise and export' },
] as { n: number; label: string; later?: string }[]

type Draft = Omit<Report, 'id' | 'createdAt' | 'updatedAt'> & { id?: string; createdAt?: string }
type Step = 1 | 2 | 3 | 4 | 5 | 6
const LAST_STEP: Step = 6

export function blankDraft(viewer: Viewer, me: { email: string; name: string }, portalPillars: Pillar[]): Draft {
  return {
    templateId: null,
    templateVersion: null,
    title: '',
    subtitle: '',
    audience: 'internal',
    status: 'draft',
    scope: { pillars: portalPillars.filter((p) => viewer.pillars.includes(p)), interventions: [], cohorts: [], filters: {} },
    period: presetPeriod('last_quarter'),
    periodPreset: 'last_quarter',
    dateRule: 'session',
    comparison: 'previous',
    ownerId: me.email,
    preparedBy: me.name,
    reviewers: [],
    cover: { showLogo: true, pillarColour: true },
  }
}

export function Wizard({
  viewer,
  me,
  initial,
  onClose,
  onNavigate,
}: {
  viewer: Viewer
  me: { email: string; name: string }
  initial: Draft
  /** Unused: edit rights are worked out here from the report's live status. Kept for callers. */
  readOnly?: boolean
  onClose: (saved?: Report) => void
  /** Leave the reports tool for another page (data check "Fix" links). */
  onNavigate?: (to: string) => void
}) {
  // Reports made before the Content step existed get their template's default blocks on first open.
  // A new report gets its id up front, so it can be checked and finalised before its first save.
  const [d, setD] = useState<Draft>(() => ({ ...initial, ...ensureContent(initial), id: initial.id ?? newId() }))
  const [step, setStep] = useState<Step>(initial.status === 'final' || initial.status === 'in_review' ? 6 : initial.id ? 2 : 1)
  const isNew = !initial.id
  const [tried, setTried] = useState(false)
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }))
  const setScope = (patch: Partial<Scope>) => setD((x) => ({ ...x, scope: { ...x.scope, ...patch } }))

  const asReport = useMemo(() => ({ ...d, id: d.id!, createdAt: d.createdAt ?? '', updatedAt: '' }) as Report, [d])
  // Only drafts can be edited, and only by people with access (reviewers comment instead).
  const readOnly = !canEditReport(viewer, me.email, asReport)
  const mayRework = canEditReport(viewer, me.email, { ...asReport, status: 'draft' })

  const template = templateById(d.templateId)
  const periodOk = d.period.start <= d.period.end
  const problems = {
    2: [!d.scope.pillars.length && 'Choose at least one pillar.', !periodOk && 'The start date must be on or before the end date.'].filter(Boolean) as string[],
    3: [!d.title.trim() && 'Give the report a title.'].filter(Boolean) as string[],
  }

  const save = (close: boolean) => {
    setTried(true)
    const issues = [...problems[2], ...problems[3]]
    if (issues.length) {
      if (problems[2].length) setStep(2)
      else setStep(3)
      return
    }
    const now = new Date().toISOString()
    const saved = saveReport({ ...d, id: d.id!, createdAt: d.createdAt ?? now, updatedAt: now, title: d.title.trim(), subtitle: d.subtitle.trim() } as Report)
    if (close) onClose(saved)
    else setD((x) => ({ ...x, id: saved.id, createdAt: saved.createdAt }))
  }

  const fix = (t: FixTarget) => {
    if (t.step) return setStep(t.step)
    if (!t.page || !onNavigate) return
    if (!readOnly && !problems[2].length && !problems[3].length) save(false)
    onNavigate(t.page)
  }

  const goTo = (n: Step) => {
    if (n >= 3 && problems[2].length) return setTried(true), setStep(2)
    if (n >= 4 && problems[3].length) return setTried(true), setStep(3)
    setStep(n)
  }

  const next = () => {
    if (step === 2 && problems[2].length) return setTried(true)
    if (step === 3 && problems[3].length) return setTried(true)
    if (step < LAST_STEP) setStep((s) => (s + 1) as Step)
    else if (readOnly) onClose()
    else save(true)
  }

  return (
    <div className="space-y-5">
      <Stepper step={step} onStep={goTo} />

      {readOnly && step < 5 && (
        <div className="flex items-start gap-2.5 rounded-lg border border-line bg-canvas px-4 py-3 text-sm text-body">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
          <span>
            You’re viewing this report. It’s <b>{d.status.replace('_', ' ')}</b>
            {viewer.role === 'reviewer' ? ', and reviewers comment rather than edit.' : d.status === 'final' ? '. Start a new version in Finalise to change it.' : ', so only drafts can be edited.'}
          </span>
        </div>
      )}

      <fieldset disabled={readOnly} className="contents">
        {step === 1 && <StepTemplate d={d} set={set} viewer={viewer} />}
        {step === 2 && <StepScope d={d} set={set} setScope={setScope} viewer={viewer} errors={tried ? problems[2] : []} />}
        {step === 3 && <StepDetails d={d} set={set} me={me} errors={tried ? problems[3] : []} templateNeedsApproval={!!template?.needsApproval} />}
      </fieldset>
      {/* The content step manages its own read-only state (preview only), so it sits outside the fieldset. */}
      {step === 4 && (
        <ContentStep
          report={asReport}
          viewer={viewer}
          readOnly={readOnly}
          onChange={(c) => set({ ...c, contentEdited: true })}
        />
      )}
      {step === 5 && <CheckStep report={asReport} viewer={viewer} onFix={fix} />}
      {step === 6 && (
        <FinaliseStep
          report={asReport}
          viewer={viewer}
          me={me}
          canEditContent={mayRework}
          onFix={fix}
          onChange={(r) => setD((x) => ({ ...x, ...r, createdAt: r.createdAt }))}
        />
      )}

      {/* Footer actions */}
      {/* Right padding leaves room for the floating help button */}
      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-between gap-2 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur sm:-mx-5 sm:pl-5 sm:pr-24">
        <button type="button" onClick={() => (step === 1 ? onClose() : setStep((s) => (s - 1) as Step))} className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-[13px] font-semibold text-body hover:bg-canvas">
          <ArrowLeft className="h-4 w-4" /> {step === 1 ? (isNew ? 'Cancel' : 'Back to reports') : 'Back'}
        </button>
        <div className="flex items-center gap-2">
          {!readOnly && step > 1 && (
            <Button onClick={() => save(false)}>
              <Save className="h-4 w-4" /> Save draft
            </Button>
          )}
          {readOnly ? (
            step < LAST_STEP ? (
              <Button variant="primary" onClick={() => setStep((s) => (s + 1) as Step)}>
                Next <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button variant="primary" onClick={() => onClose()}>
                <Check className="h-4 w-4" /> Done
              </Button>
            )
          ) : (
            <Button variant="primary" onClick={next}>
              {step === LAST_STEP ? (
                <>
                  <Check className="h-4 w-4" /> Save and close
                </>
              ) : (
                <>
                  Continue <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ---------- Stepper ---------- */

function Stepper({ step, onStep }: { step: number; onStep: (n: Step) => void }) {
  return (
    <ol className="no-scrollbar flex gap-1 overflow-x-auto rounded-[var(--radius-card)] border border-[color:var(--card-border)] bg-surface p-1.5 shadow-[var(--shadow-soft)]">
      {STEPS.map((s) => {
        const later = !!s.later
        const active = s.n === step
        const done = !later && s.n < step
        return (
          <li key={s.n} className={active ? 'min-w-0 flex-1' : 'shrink-0 md:min-w-0 md:flex-1'}>
            <button
              type="button"
              disabled={later}
              onClick={() => onStep(s.n as Step)}
              title={later ? `Coming in ${s.later}` : undefined}
              className={`flex w-full items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-left text-[13px] transition-colors duration-150 ease-out ${
                active ? 'bg-brand text-white' : later ? 'cursor-not-allowed text-faint' : 'text-body hover:bg-canvas'
              }`}
            >
              <span
                className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
                  active ? 'bg-white text-brand' : done ? 'bg-good text-white' : later ? 'border border-dashed border-line-strong' : 'border border-line-strong'
                }`}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : s.n}
              </span>
              {/* Phones show only the current step's name; the others are numbered circles. */}
              <span className={active ? 'min-w-0' : 'hidden min-w-0 md:block'}>
                <span className="block font-semibold">{s.label}</span>
                {later && <span className="block text-[10px]">Next build step</span>}
              </span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}

/* ---------- Step 1: Template ---------- */

function StepTemplate({ d, set, viewer }: { d: Draft; set: (p: Partial<Draft>) => void; viewer: Viewer }) {
  // The venture template is for people who can use the Venture Registry (HENT staff and MELA).
  const templates = SYSTEM_TEMPLATES.filter((t) => !t.needsVentures || canUseVentures({ role: viewer.role, pillars: viewer.pillars }))
  const pick = (id: string | null) => {
    const t = templateById(id)
    const pillars = t?.pillars?.filter((p) => viewer.pillars.includes(p))
    set({
      ...(pillars?.length ? { scope: { ...d.scope, pillars, interventions: [], cohorts: [] } } : {}),
      templateId: id,
      templateVersion: t?.version ?? null,
      dateRule: t?.defaultDateRule ?? d.dateRule,
      audience: t?.audienceDefault ?? d.audience,
      // Untouched content follows the template; content the author has edited is never replaced.
      ...(d.contentEdited ? {} : defaultContent(id)),
    })
  }
  return (
    <Panel title="Choose a template" sub="It sets the default sections, date rule and audience. You can change everything later.">
      <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-4">
        {templates.map((t) => (
          <TemplateCard key={t.id} on={d.templateId === t.id} onClick={() => pick(t.id)} name={t.name} body={t.description} thumb={<TemplateThumb template={t} />}>
            <span className="rounded bg-canvas px-1.5 py-0.5 text-[10px] font-semibold text-muted">{SCOPE_TYPE_LABEL[t.scopeType]}</span>
            <span className="rounded bg-canvas px-1.5 py-0.5 text-[10px] font-semibold text-muted">{DATE_RULE[t.defaultDateRule].label}</span>
            {t.needsApproval && <span className="rounded bg-warn-bg px-1.5 py-0.5 text-[10px] font-semibold text-warn">Needs MELA approval</span>}
          </TemplateCard>
        ))}
        <TemplateCard on={d.templateId === null} onClick={() => pick(null)} name="Start blank" body="No sections yet. Pick your own blocks in the Content step." thumb={<TemplateThumb template={null} />} />
      </div>
    </Panel>
  )
}

function TemplateCard({ on, onClick, name, body, thumb, children }: { on: boolean; onClick: () => void; name: string; body: string; thumb: React.ReactNode; children?: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`relative flex flex-col rounded-[var(--radius-card)] border p-3 text-left transition-[border-color,box-shadow] duration-150 ease-out ${
        on ? 'border-brand ring-2 ring-brand/30' : 'border-line hover:border-line-strong hover:shadow-[var(--shadow-soft)]'
      }`}
    >
      {on && (
        <span className="absolute right-2.5 top-2.5 grid h-5 w-5 place-items-center rounded-full bg-brand text-white">
          <Check className="h-3 w-3" />
        </span>
      )}
      <span className="rounded-lg bg-canvas px-3 py-3">{thumb}</span>
      <span className="mt-3 text-sm font-semibold text-ink">{name}</span>
      <span className="mt-1 text-xs leading-5 text-muted">{body}</span>
      {children && <span className="mt-2.5 flex flex-wrap gap-1">{children}</span>}
    </button>
  )
}

/* ---------- Step 2: Scope and period ---------- */

function StepScope({ d, set, setScope, viewer, errors }: { d: Draft; set: (p: Partial<Draft>) => void; setScope: (p: Partial<Scope>) => void; viewer: Viewer; errors: string[] }) {
  const opts = useMemo(() => scopeOptions(viewer), [viewer])
  const [showFilters, setShowFilters] = useState(Object.values(d.scope.filters).some((v) => v?.length))
  const template = templateById(d.templateId)
  const periodOk = d.period.start <= d.period.end

  const togglePillar = (p: Pillar) => {
    const pillars = d.scope.pillars.includes(p) ? d.scope.pillars.filter((x) => x !== p) : [...d.scope.pillars, p]
    // Drop interventions and cohorts that no longer fit the pillars.
    const ivOk = new Set(opts.interventions.filter((i) => pillars.includes(i.pillar)).map((i) => i.name))
    setScope({ pillars, interventions: d.scope.interventions.filter((i) => ivOk.has(i)), cohorts: d.scope.cohorts.filter((c) => pillars.includes(allCohorts.find((x) => x.id === c)!.pillar)) })
  }
  const toggleIntervention = (name: string) => {
    const interventions = d.scope.interventions.includes(name) ? d.scope.interventions.filter((x) => x !== name) : [...d.scope.interventions, name]
    setScope({ interventions, cohorts: d.scope.cohorts.filter((c) => !interventions.length || interventions.includes(allCohorts.find((x) => x.id === c)!.intervention)) })
  }
  const toggleCohort = (id: string) => setScope({ cohorts: d.scope.cohorts.includes(id) ? d.scope.cohorts.filter((x) => x !== id) : [...d.scope.cohorts, id] })
  const toggleFilter = (k: FilterKey, v: string) => {
    const cur = d.scope.filters[k] ?? []
    const nextVals = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]
    setScope({ filters: { ...d.scope.filters, [k]: nextVals } })
  }
  const choosePreset = (id: PresetId) => {
    if (id === 'custom') set({ periodPreset: 'custom', period: customPeriod(d.period.start, d.period.end) })
    else set({ periodPreset: id, period: presetPeriod(id) })
  }

  const ivInScope = opts.interventions.filter((i) => d.scope.pillars.includes(i.pillar))
  const cohortChoices = opts.cohorts.filter((c) => d.scope.pillars.includes(c.pillar) && (!d.scope.interventions.length || d.scope.interventions.includes(c.intervention)))

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-5">
        {errors.length > 0 && <ErrorBox errors={errors} />}

        <Panel title="What it covers" sub="Only the pillars, interventions and cohorts you have access to are listed.">
          <div className="space-y-5 p-4 sm:p-5">
            <Field label="Pillars" required hint={viewer.pillars.length === 1 ? `Your role reports on ${viewer.pillars[0]} only.` : undefined}>
              <div className="flex flex-wrap gap-2">
                {opts.pillars.map((p) => (
                  <Chip key={p} on={d.scope.pillars.includes(p)} onClick={() => togglePillar(p)} disabled={opts.pillars.length === 1}>
                    {p}
                  </Chip>
                ))}
              </div>
            </Field>

            <Field label="Interventions" hint="Leave all unticked to include every intervention in the chosen pillars.">
              <div className="space-y-3">
                {d.scope.pillars.map((p) => {
                  const list = ivInScope.filter((i) => i.pillar === p)
                  const allOn = !list.some((i) => d.scope.interventions.includes(i.name))
                  return (
                    <div key={p} className="rounded-lg border border-line p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <PillarTag pillar={p} />
                        <button
                          type="button"
                          onClick={() => setScope({ interventions: d.scope.interventions.filter((x) => !list.some((i) => i.name === x)) })}
                          className={`text-xs font-semibold ${allOn ? 'text-good' : 'text-brand-600 hover:underline'}`}
                        >
                          {allOn ? `✓ All interventions in ${p}` : `All interventions in ${p}`}
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {list.map((i) => (
                          <Chip key={i.name} on={d.scope.interventions.includes(i.name)} onClick={() => toggleIntervention(i.name)}>
                            {i.name}
                          </Chip>
                        ))}
                      </div>
                    </div>
                  )
                })}
                {!d.scope.pillars.length && <p className="text-xs text-muted">Choose a pillar first.</p>}
              </div>
            </Field>

            <Field label="Cohorts" hint={d.scope.cohorts.length ? `${d.scope.cohorts.length} selected` : 'All cohorts that fall in the period are included.'}>
              <div className="scrollbar-thin max-h-56 overflow-y-auto rounded-lg border border-line">
                {cohortChoices.map((c) => (
                  <label key={c.id} className="flex cursor-pointer items-center gap-3 border-b border-line px-3 py-2 text-sm last:border-0 hover:bg-canvas">
                    <input type="checkbox" className="accent-brand" checked={d.scope.cohorts.includes(c.id)} onChange={() => toggleCohort(c.id)} />
                    <span className="min-w-0 flex-1 truncate font-medium text-ink">{c.name}</span>
                    <span className="hidden whitespace-nowrap text-xs text-muted sm:inline">{fmtRange(c.start, c.end)}</span>
                    <span className={`rounded px-1.5 py-px text-[10px] font-semibold ${c.status === 'completed' ? 'bg-canvas text-muted' : c.status === 'ongoing' ? 'bg-good-bg text-good' : 'bg-brand-50 text-brand dark:text-brand-600'}`}>{c.status}</span>
                  </label>
                ))}
                {!cohortChoices.length && <p className="px-3 py-3 text-xs text-muted">No cohorts for this selection.</p>}
              </div>
            </Field>
          </div>
        </Panel>

        <Panel title="Period" sub="Which dates the report covers, and what it compares against.">
          <div className="space-y-5 p-4 sm:p-5">
            <div>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((p) => (
                  <Chip key={p.id} on={d.periodPreset === p.id} onClick={() => choosePreset(p.id)}>
                    {p.label}
                  </Chip>
                ))}
              </div>
              {d.periodPreset === 'custom' ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field label="Start date">
                    <input type="date" className={inputCls} value={d.period.start} onChange={(e) => e.target.value && set({ period: customPeriod(e.target.value, d.period.end) })} />
                  </Field>
                  <Field label="End date">
                    <input type="date" className={inputCls} value={d.period.end} onChange={(e) => e.target.value && set({ period: customPeriod(d.period.start, e.target.value) })} />
                  </Field>
                </div>
              ) : (
                <p className="mt-3 text-sm text-body">
                  <b className="text-ink">{d.period.label}</b> · {fmtRange(d.period.start, d.period.end)}
                  {(d.periodPreset === 'this_fy' || d.periodPreset === 'last_fy') && <span className="text-muted"> · financial year starts in month {REPORT_SETTINGS.fyStartMonth}</span>}
                </p>
              )}
            </div>

            <Field label="Date rule" hint="Shown in the report’s methodology, so readers know how the period was applied.">
              <div className="grid gap-2 md:grid-cols-3">
                {(Object.keys(DATE_RULE) as DateRule[]).map((r) => (
                  <ChoiceCard key={r} on={d.dateRule === r} onClick={() => set({ dateRule: r })} title={DATE_RULE[r].label} body={DATE_RULE[r].body} badge={template?.defaultDateRule === r ? 'Template default' : undefined} />
                ))}
              </div>
            </Field>

            <Field label="Comparison">
              <div className="grid gap-2 md:grid-cols-3">
                {(
                  [
                    ['none', 'No comparison'],
                    ['previous', 'Previous period'],
                    ['last_year', 'Same period last year'],
                  ] as [Comparison, string][]
                ).map(([c, label]) => (
                  <ChoiceCard key={c} on={d.comparison === c} onClick={() => set({ comparison: c })} title={label} body={c === 'none' || !periodOk ? undefined : fmtRange(comparisonPeriod(d.period, c).start, comparisonPeriod(d.period, c).end)} />
                ))}
              </div>
            </Field>
          </div>
        </Panel>

        <Panel>
          <button type="button" onClick={() => setShowFilters((s) => !s)} className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left sm:px-5">
            <span>
              <span className="block text-sm font-semibold text-ink">Optional filters</span>
              <span className="block text-xs text-muted">Narrow the report to particular groups of people.</span>
            </span>
            <ChevronDown className={`h-4 w-4 text-muted transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
          {showFilters && (
            <div className="grid gap-4 border-t border-line p-4 sm:p-5 lg:grid-cols-2">
              {(Object.keys(FILTERS) as FilterKey[]).map((k) => {
                const blocked = FILTERS[k].sensitive && d.audience === 'public' && !(viewer.role === 'admin' && viewer.allowSensitive)
                return (
                  <div key={k}>
                    <div className="mb-1.5 flex items-center gap-2 text-[13px] font-semibold text-ink">
                      {FILTERS[k].label}
                      {FILTERS[k].sensitive && <span className="rounded bg-warn-bg px-1.5 py-px text-[10px] font-semibold text-warn">Sensitive</span>}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {filterOptions(k).map((v) => (
                        <Chip key={v} on={!!d.scope.filters[k]?.includes(v)} onClick={() => toggleFilter(k, v)} disabled={blocked} title={blocked ? 'Hidden in Public reports' : undefined}>
                          {v}
                        </Chip>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Panel>
      </div>

      <ScopeCheck d={d} viewer={viewer} />
    </div>
  )
}

/** Live numbers for the chosen scope, straight from getMetric (with permissions and suppression). */
function ScopeCheck({ d, viewer }: { d: Draft; viewer: Viewer }) {
  const res = useMemo(() => {
    if (!d.scope.pillars.length || d.period.start > d.period.end) return null
    try {
      const ask = (code: string) => getMetric(viewer, { code, scope: d.scope, period: d.period, dateRule: d.dateRule, comparison: d.comparison, audience: d.audience })
      return { reach: ask('reach.unique_people'), cohorts: ask('participation.cohorts'), attendance: ask('attendance.rate'), nps: ask('feedback.nps') }
    } catch (e) {
      if (e instanceof MetricAccessError || e instanceof MetricPolicyError) return { error: e.message }
      throw e
    }
  }, [d.scope, d.period, d.dateRule, d.comparison, d.audience, viewer])

  return (
    <aside className="xl:sticky xl:top-5 xl:self-start">
      <section className="overflow-hidden rounded-[var(--radius-card)] border border-[color:var(--card-border)] bg-surface shadow-[var(--shadow-soft)]">
        <PanelHeader title="Scope check" sub="Live from the metrics layer, with the report’s privacy rules applied." />
        {!res ? (
          <p className="p-4 text-sm text-muted">Choose a pillar and a valid period to see the numbers.</p>
        ) : 'error' in res ? (
          <div className="m-4 flex gap-2 rounded-lg bg-bad-bg p-3 text-sm text-bad">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            {res.error}
          </div>
        ) : (
          <div className="divide-y divide-line">
            {[res.reach, res.cohorts, res.attendance, res.nps].map((m) => (
              <div key={m.code} className="flex items-baseline justify-between gap-3 px-4 py-3">
                <span className="text-[13px] text-body">{m.label}</span>
                <span className="text-right">
                  <span className={`font-display text-xl font-semibold tabular-nums ${m.suppressed ? 'text-bad' : 'text-brand-deep'}`}>{m.display}</span>
                  {m.comparison && <span className="block text-[11px] text-muted">vs {m.comparison.display}</span>}
                </span>
              </div>
            ))}
            <p className="flex gap-2 px-4 py-3 text-[11px] leading-5 text-muted">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" />
              Counts under {res.reach.threshold} show as “&lt;{res.reach.threshold}” in a {AUDIENCE[d.audience].label} report. Change the audience in Details.
            </p>
          </div>
        )}
      </section>
    </aside>
  )
}

/* ---------- Step 3: Details ---------- */

function StepDetails({ d, set, me, errors, templateNeedsApproval }: { d: Draft; set: (p: Partial<Draft>) => void; me: { email: string }; errors: string[]; templateNeedsApproval: boolean }) {
  const reviewerChoices = staff.filter((s) => s.email !== me.email && (s.role === 'reviewer' || s.role === 'admin' || s.role === 'pillar_lead'))
  const toggleReviewer = (email: string) => set({ reviewers: d.reviewers.includes(email) ? d.reviewers.filter((x) => x !== email) : [...d.reviewers, email] })
  const onImage = (file: File | undefined) => {
    if (!file) return
    // Keep small images with the report; larger ones are referenced by name only.
    if (file.size > 400_000) return set({ cover: { ...d.cover, imageName: file.name, imageDataUrl: undefined } })
    const r = new FileReader()
    r.onload = () => set({ cover: { ...d.cover, imageName: file.name, imageDataUrl: String(r.result) } })
    r.readAsDataURL(file)
  }
  const needsApproval = d.audience !== 'internal' || templateNeedsApproval

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-5">
        {errors.length > 0 && <ErrorBox errors={errors} />}
        <Panel title="Title and audience">
          <div className="space-y-5 p-4 sm:p-5">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Report title" required>
                <input className={inputCls} value={d.title} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. HEMP quarterly report · Q3 2025" aria-invalid={errors.length > 0 && !d.title.trim()} />
              </Field>
              <Field label="Subtitle">
                <input className={inputCls} value={d.subtitle} onChange={(e) => set({ subtitle: e.target.value })} placeholder="e.g. Health Employment pillar" />
              </Field>
            </div>
            <Field label="Audience" hint="Sets the privacy rules for every number in the report, and whether MELA must approve it.">
              <div className="grid gap-2 md:grid-cols-3">
                {(Object.keys(AUDIENCE) as Audience[]).map((a) => (
                  <ChoiceCard key={a} on={d.audience === a} onClick={() => set({ audience: a })} title={AUDIENCE[a].label} body={AUDIENCE[a].body} />
                ))}
              </div>
            </Field>
            {needsApproval && (
              <p className="flex items-start gap-2 rounded-lg bg-warn-bg px-3 py-2.5 text-xs leading-5 text-warn">
                <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                This report needs MELA approval before it can be finalised{d.audience === 'internal' ? ' (the template requires it)' : ''}.
              </p>
            )}
          </div>
        </Panel>

        <Panel title="People">
          <div className="space-y-5 p-4 sm:p-5">
            <Field label="Prepared by" hint="Filled in from your account. Change it if someone else wrote the report.">
              <input className={`${inputCls} md:max-w-sm`} value={d.preparedBy} onChange={(e) => set({ preparedBy: e.target.value })} />
            </Field>
            <Field label="Reviewers" hint="They can read and comment on the draft, and approve it.">
              <div className="grid gap-1.5 sm:grid-cols-2">
                {reviewerChoices.map((s) => (
                  <label key={s.email} className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors ${d.reviewers.includes(s.email) ? 'border-brand bg-brand-50/50 dark:bg-brand-50' : 'border-line hover:bg-canvas'}`}>
                    <input type="checkbox" className="accent-brand" checked={d.reviewers.includes(s.email)} onChange={() => toggleReviewer(s.email)} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-ink">{s.name}</span>
                      <span className="block truncate text-xs text-muted">
                        {roleLabel[s.role]} · {s.pillars.join(', ')}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </Field>
          </div>
        </Panel>

        <Panel title="Cover">
          <div className="grid gap-4 p-4 sm:p-5 md:grid-cols-2">
            <Toggle on={d.cover.showLogo} onChange={(v) => set({ cover: { ...d.cover, showLogo: v } })} label="Show the CHII logo" />
            <Toggle on={d.cover.pillarColour} onChange={(v) => set({ cover: { ...d.cover, pillarColour: v } })} label="Use the pillar colour" />
            <div className="md:col-span-2">
              <Field label="Cover image" hint="Optional. JPG or PNG. Images under 400 KB are kept with the report.">
                <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-line-strong px-3 py-3 text-sm text-body hover:bg-canvas">
                  <ImagePlus className="h-4 w-4 text-muted" />
                  <span className="min-w-0 flex-1 truncate">{d.cover.imageName ?? 'Choose an image'}</span>
                  <input type="file" accept="image/png,image/jpeg" className="sr-only" onChange={(e) => onImage(e.target.files?.[0])} />
                </label>
              </Field>
            </div>
          </div>
        </Panel>
      </div>

      <CoverPreview d={d} />
    </div>
  )
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" onClick={() => onChange(!on)} aria-pressed={on} className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2.5 text-left text-sm font-medium text-ink hover:bg-canvas">
      {label}
      <span className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${on ? 'bg-brand dark:bg-brand-600' : 'bg-line-strong'}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
      </span>
    </button>
  )
}

/** A small live preview of the report cover, so the Details choices are visible. */
function CoverPreview({ d }: { d: Draft }) {
  const single = d.scope.pillars.length === 1 ? d.scope.pillars[0] : null
  return (
    <aside className="xl:sticky xl:top-5 xl:self-start">
      <section className="overflow-hidden rounded-[var(--radius-card)] border border-[color:var(--card-border)] bg-surface shadow-[var(--shadow-soft)]">
        <PanelHeader title="Cover preview" />
        <div className="p-4">
          <div className="mx-auto flex aspect-[1/1.414] w-full max-w-[260px] flex-col overflow-hidden rounded-md border border-line bg-white text-[#111827] shadow-[0_6px_18px_-8px_rgba(16,44,94,0.25)]">
            <div
              className="relative flex flex-1 flex-col justify-end p-4 text-white"
              style={{
                background: d.cover.imageDataUrl ? `linear-gradient(180deg, rgba(16,44,94,0.2), rgba(16,44,94,0.92)), url(${d.cover.imageDataUrl}) center/cover` : '#102c5e',
              }}
            >
              {d.cover.showLogo && <img src="/logos/chii-white.png" alt="" className="absolute left-4 top-4 h-4 w-auto" />}
              {d.cover.pillarColour && single && <span className="mb-2 w-fit rounded bg-white/15 px-1.5 py-0.5 text-[9px] font-bold tracking-wide">{single}</span>}
              <p className="font-display text-[17px] font-semibold leading-tight">{d.title || 'Report title'}</p>
              {d.subtitle && <p className="mt-1 text-[10px] text-white/80">{d.subtitle}</p>}
            </div>
            <div className="space-y-1 px-4 py-3 text-[9px] text-[#374151]">
              <p>
                <b>Period</b> · {d.period.label} ({fmtRange(d.period.start, d.period.end)})
              </p>
              <p>
                <b>Prepared by</b> · {d.preparedBy || '—'}
              </p>
              <p>
                <b>Audience</b> · {AUDIENCE[d.audience].label}
                {d.audience === 'internal' && ' · Confidential'}
              </p>
            </div>
          </div>
        </div>
      </section>
    </aside>
  )
}

function ErrorBox({ errors }: { errors: string[] }) {
  return (
    <div role="alert" className="flex gap-2.5 rounded-lg border border-bad/30 bg-bad-bg px-4 py-3 text-sm text-bad">
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
      <ul className="space-y-0.5">
        {errors.map((e) => (
          <li key={e}>{e}</li>
        ))}
      </ul>
    </div>
  )
}
