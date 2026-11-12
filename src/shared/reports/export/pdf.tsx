/**
 * PDF export (REPORT-TOOL-SPEC build step 5).
 *
 * The browser's own print engine makes the PDF: the report is laid out in a hidden frame with
 * the app's styles, then the print window opens with "Save as PDF". This gives sharp, selectable
 * text, sections that flow on from one another, page breaks that never split a block, and page
 * numbers. Numbers come through the same metric source as the screen (live for drafts, the frozen
 * snapshot for final versions), so permissions and small-number suppression are already applied.
 *
 *   Draft → "DRAFT" across every page, and "live data as of …" in the footer.
 *   Final → clean copy from the frozen version, footer says "Version n · final".
 */
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { runDataCheck } from '../quality'
import { ReportDocument, type DataNotes } from '../render/ReportDocument'
import { collectAnswers, type FinalVersion } from '../snapshot'
import { MetricSource, liveSource, replaySource } from '../source'
import type { Report, Viewer } from '../types'

/** A4 width minus 14 mm margins each side, in CSS pixels: charts are measured at this width. */
const CONTENT_W = 688

export type PdfJob = { report: Report; viewer: Viewer; version?: FinalVersion | null }

/** File name: title, then DRAFT + date, or the version number. */
export function pdfFileName({ report, version }: Pick<PdfJob, 'report' | 'version'>) {
  const title = (version?.snapshot.report.title ?? report.title ?? 'report')
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
  const today = new Date().toISOString().slice(0, 10)
  return `${title || 'report'}-${version ? `v${version.versionNo}` : `DRAFT-${today}`}.pdf`
}

/** Opens the print window for the report. Resolves with the suggested file name. */
export async function downloadReportPdf(job: PdfJob): Promise<string> {
  const { viewer, version } = job
  const draft = !version
  const report = version ? version.snapshot.report : job.report
  const name = pdfFileName(job)

  let notes: DataNotes
  if (version) notes = { check: version.snapshot.check, asOf: version.dataAsOf, version: version.versionNo, override: version.snapshot.override }
  else {
    const check = runDataCheck(viewer, report, collectAnswers(report, viewer))
    notes = { check, asOf: check.checkedAt }
  }
  const ask = version ? replaySource(version.snapshot.answers) : liveSource(viewer)

  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.tabIndex = -1
  frame.style.cssText = `position:fixed;left:-10000px;top:0;width:${CONTENT_W}px;height:1200px;border:0;`
  document.body.appendChild(frame)
  const doc = frame.contentDocument!
  // The document title becomes the suggested file name in "Save as PDF".
  doc.open()
  doc.write(`<!doctype html><html lang="en"><head><meta charset="utf-8"><base href="${location.origin}/"><title>${escHtml(name.replace(/\.pdf$/, ''))}</title></head><body><div id="report"></div></body></html>`)
  doc.close()

  // Same styles as the app (light theme: the frame has no "dark" class), plus the print rules.
  const loading: Promise<void>[] = []
  document.head.querySelectorAll('style, link[rel="stylesheet"]').forEach((n) => {
    const copy = doc.importNode(n, true) as HTMLElement
    if (copy.tagName === 'LINK') loading.push(new Promise((r) => ((copy as HTMLLinkElement).onload = (copy as HTMLLinkElement).onerror = () => r())))
    doc.head.appendChild(copy)
  })
  const style = doc.createElement('style')
  style.textContent = printCss(report, notes, version ?? null)
  doc.head.appendChild(style)
  await Promise.race([Promise.all(loading), wait(5000)])

  const root = createRoot(doc.getElementById('report')!)
  const cleanup = () => {
    root.unmount()
    frame.remove()
  }
  try {
    flushSync(() =>
      root.render(
        <MetricSource ask={ask}>
          {draft && (
            <div className="pdf-watermark" aria-hidden="true">
              <span>DRAFT</span>
            </div>
          )}
          <ReportDocument report={report} viewer={viewer} notes={notes} print />
        </MetricSource>,
      ),
    )
    // Wait for web fonts, images and the charts' first measurement before printing.
    await doc.fonts?.ready
    await Promise.race([Promise.all(Array.from(doc.images).map((i) => (i.complete ? null : new Promise((r) => (i.onload = i.onerror = r))))), wait(4000)])
    await frames(frame.contentWindow!, 3)
    await wait(300)
  } catch (e) {
    cleanup()
    throw e
  }

  const win = frame.contentWindow!
  win.focus()
  win.print() // blocks until the print window closes in Chrome
  // Keep the frame briefly in case the browser prints asynchronously (Safari, Firefox).
  if (!(window as unknown as { __keepPrintFrame?: boolean }).__keepPrintFrame) setTimeout(cleanup, 2000)
  return name
}

/* ---------- Print rules ---------- */

function printCss(report: Report, notes: DataNotes, version: FinalVersion | null) {
  const audience = report.audience === 'internal' ? 'Internal · Confidential' : report.audience === 'partner' ? 'Partner / Donor' : 'Public'
  const status = version ? `Version ${version.versionNo} · final · data frozen ${stamp(version.dataAsOf)}` : `DRAFT · live data as of ${stamp(notes.asOf)} · numbers may change`
  const right = `${clip(report.title, 60)} · ${audience} · Page `
  return `
@page {
  size: A4;
  margin: 14mm 14mm 16mm;
  @bottom-left { content: "${escCss(status)}"; font: ${version ? 400 : 600} 7pt Inter, Arial, sans-serif; color: ${version ? '#64748b' : '#a81b2d'}; }
  @bottom-right { content: "${escCss(right)}" counter(page) " of " counter(pages); font: 400 7pt Inter, Arial, sans-serif; color: #64748b; }
}
@page :first { @bottom-left { content: none; } @bottom-right { content: none; } }
html, body { margin: 0; background: #fff !important; }
* { -webkit-print-color-adjust: exact; print-color-adjust: exact; box-shadow: none !important; }
.report-print-cover { break-after: page; }
.report-print-cover > div:first-child { margin: 0 !important; border-radius: 10px; }
.report-print-section { padding-top: 26px; }
.report-print-section > header, .report-print-section h3 { break-after: avoid; }
/* Labels shortened with "…" on screen print in full. */
.report-print-section .truncate { white-space: normal; overflow: visible; text-overflow: clip; }
[data-keep] { break-inside: avoid; }
.pdf-watermark { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; z-index: 50; }
.pdf-watermark span { transform: rotate(-45deg); font: 800 120pt Inter, Arial, sans-serif; letter-spacing: 0.04em; color: rgba(16, 44, 94, 0.07); }
`
}

/* ---------- Helpers ---------- */

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
const frames = (w: Window, n: number) => new Promise<void>((r) => (n <= 0 ? r() : w.requestAnimationFrame(() => frames(w, n - 1).then(r))))
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)
const escCss = (s: string) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ')
const escHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
const stamp = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
