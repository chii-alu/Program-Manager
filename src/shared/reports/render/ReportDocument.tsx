/**
 * The report as a reader sees it: cover, contents, sections and the automatic methodology
 * appendix (spec §4 "Automatic appendices"). The PDF export (build step 5) prints this view.
 */
import React from 'react'
import { metricsUsed } from '../blocks'
import { indicatorByCode } from '../indicators'
import { REPORTING_DATE } from '../../ventures/derive'
import { FILTERS } from '../metrics'
import { comparisonPeriod, fmtDay, fmtRange } from '../periods'
import { templateById } from '../templates'
import type { FilterKey, Report, Viewer } from '../types'
import type { DataCheck } from '../quality'
import { BlockView } from './BlockView'

const AUDIENCE_LABEL = { internal: 'Internal · Confidential', partner: 'Partner / Donor', public: 'Public' } as const
const DATE_RULE_LABEL = { session: 'session date (when the cohort or session started)', registration: 'registration date (when the person registered or applied)', response: 'response date (when feedback was submitted)' } as const

export type DataNotes = { check: DataCheck; asOf: string; version?: number; override?: { by: string; reason: string } }

/** Print mode (PDF export): no page cards; the print stylesheet in export/pdf.tsx lays out A4 pages. */
const PrintCtx = React.createContext(false)

export function ReportDocument({ report, viewer, notes, print = false }: { report: Report; viewer: Viewer; notes?: DataNotes; print?: boolean }) {
  const sections = report.sections ?? []
  const blocks = report.blocks ?? []
  const used = metricsUsed(blocks)
  const filters = Object.entries(report.scope.filters).filter(([, v]) => v?.length) as [FilterKey, string[]][]
  const single = report.scope.pillars.length === 1 ? report.scope.pillars[0] : null

  return (
    <PrintCtx.Provider value={print}>
    <article className={print ? 'w-full bg-white' : 'mx-auto w-full max-w-[860px] space-y-6'}>
      {/* Cover */}
      <Page cover>
        <div
          className="-m-10 mb-0 flex min-h-[340px] flex-col justify-end p-10 text-white"
          style={{
            background: report.cover.imageDataUrl ? `linear-gradient(180deg, rgba(16,44,94,0.25), rgba(16,44,94,0.94)), url(${report.cover.imageDataUrl}) center/cover` : '#102c5e',
          }}
        >
          {report.cover.showLogo && <img src="/logos/chii-white.png" alt="ALU Center for Health Innovation and Impact" className="mb-auto h-7 w-auto self-start" />}
          {report.cover.pillarColour && single && <span className="mb-3 w-fit rounded bg-white/15 px-2 py-0.5 text-[11px] font-bold tracking-wide">{single}</span>}
          <h1 className="font-display text-[34px] font-semibold leading-tight">{report.title || 'Untitled report'}</h1>
          {report.subtitle && <p className="mt-2 text-[15px] text-white/80">{report.subtitle}</p>}
        </div>
        <dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-3 text-[13px]">
          <Meta k="Period" v={`${report.period.label} · ${fmtRange(report.period.start, report.period.end)}`} />
          <Meta k="Covers" v={report.scope.interventions.length ? report.scope.interventions.join(', ') : report.scope.pillars.join(', ')} />
          <Meta k="Prepared by" v={report.preparedBy || '—'} />
          <Meta k="Audience" v={AUDIENCE_LABEL[report.audience]} />
          <Meta k="Template" v={templateById(report.templateId)?.name ?? 'Blank'} />
          <Meta k="Comparison" v={report.comparison === 'none' ? 'None' : comparisonPeriod(report.period, report.comparison).label} />
        </dl>

        {/* Contents */}
        <nav className="mt-10 border-t border-line pt-6">
          <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.1em] text-muted">Contents</h2>
          <ol className="space-y-1.5 text-[13.5px]">
            {sections.map((s, i) => (
              <li key={s.id} className="flex items-baseline gap-3">
                <span className="w-5 text-right font-display text-muted">{i + 1}</span>
                <span className="text-ink">{s.title}</span>
              </li>
            ))}
            <li className="flex items-baseline gap-3">
              <span className="w-5 text-right font-display text-muted">A</span>
              <span className="text-ink">Methodology and definitions</span>
            </li>
            {notes && (
              <li className="flex items-baseline gap-3">
                <span className="w-5 text-right font-display text-muted">B</span>
                <span className="text-ink">Data notes</span>
              </li>
            )}
          </ol>
        </nav>
      </Page>

      {/* Sections */}
      {sections.map((s, i) => {
        const list = blocks.filter((b) => b.sectionId === s.id)
        const kpis = list.filter((b) => b.type === 'kpi')
        const rest = list.filter((b) => b.type !== 'kpi')
        return (
          <Page key={s.id}>
            <SectionHeading n={String(i + 1)} title={s.title} />
            {kpis.length > 0 && (
              <div data-keep className={`grid gap-3 ${kpis.length >= 4 ? 'grid-cols-2 sm:grid-cols-4' : kpis.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
                {kpis.map((b) => (
                  <BlockView key={b.id} block={b} report={report} viewer={viewer} />
                ))}
              </div>
            )}
            <div className="mt-5 space-y-7">
              {rest.map((b) => (
                <div key={b.id} data-keep className="break-inside-avoid">
                  <BlockView block={b} report={report} viewer={viewer} />
                </div>
              ))}
              {!list.length && <p className="text-sm text-faint">This section has no content yet.</p>}
            </div>
          </Page>
        )
      })}

      {/* Appendix A: methodology, generated from the indicator dictionary */}
      <Page>
        <SectionHeading n="A" title="Methodology and definitions" />
        <div className="space-y-3 text-[13px] leading-6 text-body">
          {(() => {
            const vUsed = used.filter((c) => indicatorByCode.get(c)?.source === 'registry')
            const ventureOnly = vUsed.length > 0 && vUsed.length === used.length
            const t = report.audience === 'internal' ? 5 : 10
            const asOf = report.period.end > REPORTING_DATE ? REPORTING_DATE : report.period.end
            return (
              <>
                <p>
                  Every number in this report comes from the CHII metrics layer, so it is defined and counted the same way as on the platform dashboard.{' '}
                  {ventureOnly ? 'Venture numbers come from the HENT Venture Registry, with the same definitions as Venture Analytics. Founders are counted once by CHII ID and never named.' : 'People are counted once by CHII ID.'}
                </p>
                {!ventureOnly && (
                  <p>
                    <b className="text-ink">Period rule.</b> Records are counted in {report.period.label} ({fmtRange(report.period.start, report.period.end)}) by their {DATE_RULE_LABEL[report.dateRule]}. A metric that can’t use this rule uses
                    its own default, noted below.
                  </p>
                )}
                {vUsed.length > 0 && (
                  <p>
                    <b className="text-ink">Ventures.</b> Portfolio numbers are as of {fmtDay(asOf)}: each venture’s latest update accepted by then. New ventures and stage moves count what happened in {report.period.label}. Money is in US dollars at fixed
                    rates.
                  </p>
                )}
                {!ventureOnly && filters.length > 0 && (
                  <p>
                    <b className="text-ink">Filters.</b> {filters.map(([k, v]) => `${FILTERS[k].label}: ${v.join(', ')}`).join(' · ')}.
                  </p>
                )}
                <p>
                  <b className="text-ink">Small numbers.</b> To protect individuals, counts under {t} {ventureOnly ? 'ventures' : 'people'} are shown as “&lt;{t}”, and where one hidden value could be worked out from a total, a second value is hidden and shown
                  as “—”. Rates and averages based on fewer than {t} {ventureOnly ? 'ventures' : 'people'} are not shown.
                </p>
              </>
            )
          })()}
        </div>
        <dl className="mt-5 divide-y divide-line border-y border-line">
          {used.map((code) => {
            const ind = indicatorByCode.get(code)!
            return (
              <div key={code} data-keep className="grid gap-1 py-2.5 sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-4">
                <dt className="text-[13px] font-semibold text-ink">{ind.name}</dt>
                <dd className="text-[12.5px] leading-5 text-body">
                  {ind.definition}
                  {!ind.dateRules.includes(report.dateRule) && <span className="text-muted"> Counted by {DATE_RULE_LABEL[ind.defaultDateRule].split(' (')[0]}.</span>}
                </dd>
              </div>
            )
          })}
        </dl>
      </Page>

      {/* Appendix B: data notes (spec §4): completeness, issues, hidden values, "as of" */}
      {notes && (
        <Page>
          <SectionHeading n="B" title="Data notes" />
          <p className="text-[13px] leading-6 text-body">
            {notes.version ? (
              <>
                This is <b className="text-ink">version {notes.version}</b>, finalised on {stamp(notes.asOf)}. Its numbers are frozen as of that time and won’t change if the data is corrected later.
              </>
            ) : (
              <>This draft shows live data, checked {stamp(notes.asOf)}. Numbers will change until it is finalised.</>
            )}
          </p>
          {notes.override && (
            <p className="mt-3 rounded-md border border-bad/30 bg-bad-bg px-3 py-2 text-[12.5px] leading-5 text-bad">
              <b>Critical data issues were overridden</b> by {notes.override.by}: “{notes.override.reason}”
            </p>
          )}
          <h3 data-keep className="mt-5 text-[11px] font-bold uppercase tracking-[0.08em] text-muted">Completeness</h3>
          <dl className="mt-2 grid gap-x-8 gap-y-1.5 text-[12.5px] sm:grid-cols-2">
            {notes.check.completeness.map((c) => (
              <div key={c.key} data-keep className="flex justify-between gap-3 border-b border-line py-1">
                <dt className="text-body">{c.label}</dt>
                <dd className="tabular-nums text-ink">
                  {c.pct == null ? '—' : `${c.pct}%`} <span className="text-muted">· {c.detail}</span>
                </dd>
              </div>
            ))}
          </dl>
          <h3 data-keep className="mt-5 text-[11px] font-bold uppercase tracking-[0.08em] text-muted">{notes.version ? 'Issues at finalising' : 'Open issues'}</h3>
          {notes.check.issues.filter((i) => i.severity !== 'info' || i.id === 'suppressed').length ? (
            <ul className="mt-2 space-y-1.5 text-[12.5px] leading-5">
              {notes.check.issues
                .filter((i) => i.severity !== 'info' || i.id === 'suppressed')
                .map((i) => (
                  <li key={i.id} data-keep className="flex gap-2">
                    <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${i.severity === 'critical' ? 'bg-bad' : i.severity === 'warning' ? 'bg-warn' : 'bg-faint'}`} />
                    <span>
                      <b className="font-semibold text-ink">{i.title}.</b> <span className="text-body">{i.detail}</span>
                    </span>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="mt-2 text-[12.5px] text-body">No data quality issues affect this report.</p>
          )}
        </Page>
      )}
    </article>
    </PrintCtx.Provider>
  )
}

const stamp = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

function Page({ children, cover }: { children: React.ReactNode; cover?: boolean }) {
  const print = React.useContext(PrintCtx)
  // In print, sections run on from one another; only the cover has a page to itself.
  if (print) return <section className={cover ? 'report-print-cover bg-white' : 'report-print-section bg-white'}>{children}</section>
  return <section className="overflow-hidden rounded-md border border-line bg-surface p-10 shadow-[0_2px_4px_rgba(16,44,94,0.05),0_12px_32px_-12px_rgba(16,44,94,0.18)]">{children}</section>
}

function SectionHeading({ n, title }: { n: string; title: string }) {
  return (
    <header className="mb-5 flex items-baseline gap-3 border-b-2 border-brand pb-2.5">
      <span className="font-display text-xl text-brand-600">{n}</span>
      <h2 className="font-display text-[22px] font-semibold text-ink">{title}</h2>
    </header>
  )
}

function Meta({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-muted">{k}</dt>
      <dd className="mt-0.5 text-ink">{v}</dd>
    </div>
  )
}
