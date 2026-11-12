/**
 * PDF export (REPORT-TOOL-SPEC build step 5).
 *
 * The PDF is the same ReportDocument people see on screen, rendered off-screen, captured page by
 * page and laid out on A4. Nothing reaches the PDF that the viewer couldn't already see: numbers
 * come through the same metric source (live for drafts, the frozen snapshot for final versions),
 * so permissions and small-number suppression are already applied.
 *
 *   Draft   → "DRAFT" watermark on every page, plus "live data as of …" in the footer.
 *   Final   → clean copy from the frozen version, footer says "Version n · final".
 */
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { runDataCheck } from '../quality'
import { ReportDocument, type DataNotes } from '../render/ReportDocument'
import { collectAnswers, type FinalVersion } from '../snapshot'
import { MetricSource, liveSource, replaySource } from '../source'
import type { Report, Viewer } from '../types'

/** A4 at 96 dpi, in CSS pixels. */
const PAGE_W = 794
const PAGE_H = 1123
/** Space kept for the footer, and the top margin on pages that continue a section. */
const FOOT = 44
const TOP = 40
const SCALE = 2

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

export async function downloadReportPdf(job: PdfJob): Promise<string> {
  const [{ jsPDF, GState }, { default: html2canvas }] = await Promise.all([import('jspdf'), import('html2canvas')])
  const { viewer, version } = job
  const draft = !version
  const report = version ? version.snapshot.report : job.report

  // Data notes: the frozen check for a final version, a fresh one for a draft.
  let notes: DataNotes
  if (version) notes = { check: version.snapshot.check, asOf: version.dataAsOf, version: version.versionNo, override: version.snapshot.override }
  else {
    const check = runDataCheck(viewer, report, collectAnswers(report, viewer))
    notes = { check, asOf: check.checkedAt }
  }
  const ask = version ? replaySource(version.snapshot.answers) : liveSource(viewer)

  // Render off-screen, always in the light theme (the PDF is printed on white paper).
  const html = document.documentElement
  const wasDark = html.classList.contains('dark')
  if (wasDark) html.classList.remove('dark')
  const host = document.createElement('div')
  host.setAttribute('aria-hidden', 'true')
  host.style.cssText = `position:fixed;left:-20000px;top:0;width:${PAGE_W}px;background:#fff;pointer-events:none;`
  document.body.appendChild(host)
  const root = createRoot(host)

  try {
    flushSync(() =>
      root.render(
        <MetricSource ask={ask}>
          <ReportDocument report={report} viewer={viewer} notes={notes} print />
        </MetricSource>,
      ),
    )
    await document.fonts?.ready
    // Charts measure their container after layout; give them a couple of frames.
    await frames(3)
    await wait(250)

    const pdf = new jsPDF({ unit: 'pt', format: 'a4', compress: true })
    const pw = pdf.internal.pageSize.getWidth()
    const ph = pdf.internal.pageSize.getHeight()
    const k = pw / PAGE_W
    let first = true

    for (const page of Array.from(host.querySelectorAll<HTMLElement>('[data-pdf-page]'))) {
      const canvas = await html2canvas(page, {
        scale: SCALE,
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true,
        windowWidth: PAGE_W,
        onclone: (_doc, el) => plainColours(el),
      })
      const height = page.offsetHeight
      const top = page.getBoundingClientRect().top
      // Places a page may break: the top of any block marked "keep together".
      const cuts = Array.from(page.querySelectorAll<HTMLElement>('[data-keep]'))
        .map((el) => Math.round(el.getBoundingClientRect().top - top))
        .filter((y) => y > 0)
        .sort((a, b) => a - b)

      let start = 0
      let continued = false
      while (start < height - 1) {
        const room = (continued ? PAGE_H - TOP : PAGE_H) - FOOT
        let end = height
        if (height - start > room) {
          const fits = cuts.filter((c) => c > start + 120 && c <= start + room)
          end = fits.length ? fits[fits.length - 1] : start + room
        }
        if (!first) pdf.addPage()
        first = false
        const slice = document.createElement('canvas')
        slice.width = canvas.width
        slice.height = Math.max(1, Math.round((end - start) * SCALE))
        slice.getContext('2d')!.drawImage(canvas, 0, Math.round(start * SCALE), canvas.width, slice.height, 0, 0, canvas.width, slice.height)
        pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', 0, continued ? TOP * k : 0, pw, (end - start) * k, undefined, 'FAST')
        start = end
        continued = true
      }
    }

    // Footer and watermark on every page.
    const total = pdf.getNumberOfPages()
    const audience = report.audience === 'internal' ? 'Internal · Confidential' : report.audience === 'partner' ? 'Partner / Donor' : 'Public'
    const status = draft ? `DRAFT · live data as of ${stamp(notes.asOf)} · numbers may change` : `Version ${version!.versionNo} · final · data frozen ${stamp(version!.dataAsOf)}`
    for (let i = 1; i <= total; i++) {
      pdf.setPage(i)
      if (draft) {
        pdf.saveGraphicsState()
        pdf.setGState(new GState({ opacity: 0.09 }))
        pdf.setTextColor(16, 44, 94)
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(120)
        const w = pdf.getTextWidth('DRAFT')
        // Rotated 45°, centred on the page.
        const a = Math.PI / 4
        pdf.text('DRAFT', pw / 2 - (w / 2) * Math.cos(a) + 20, ph / 2 + (w / 2) * Math.sin(a), { angle: 45 })
        pdf.restoreGraphicsState()
      }
      if (i === 1) continue // the cover carries its own details
      pdf.setDrawColor(226, 232, 240)
      pdf.setLineWidth(0.5)
      pdf.line(30, ph - 30, pw - 30, ph - 30)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(7.5)
      pdf.setTextColor(draft ? 168 : 100, draft ? 27 : 116, draft ? 45 : 139)
      pdf.text(status, 30, ph - 18)
      pdf.setTextColor(100, 116, 139)
      pdf.text(`${clip(report.title, 60)} · ${audience} · Page ${i} of ${total}`, pw - 30, ph - 18, { align: 'right' })
    }

    pdf.setProperties({
      title: report.title,
      subject: draft ? 'Draft report (live data)' : `Final report, version ${version!.versionNo}`,
      creator: 'CHII MELA Manager',
      keywords: draft ? 'draft' : 'final',
    })
    const name = pdfFileName(job)
    pdf.save(name)
    return name
  } finally {
    root.unmount()
    host.remove()
    if (wasDark) html.classList.add('dark')
  }
}

/* ---------- Helpers ---------- */

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
const frames = (n: number) => new Promise<void>((r) => (n <= 0 ? r() : requestAnimationFrame(() => frames(n - 1).then(r))))
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)
const stamp = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

const BOX_COLOURS = ['color', 'background-color', 'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color', 'outline-color', 'text-decoration-color']
const SVG_PAINT = ['fill', 'stroke', 'stop-color']
const SVG_NS = 'http://www.w3.org/2000/svg'

/**
 * The capture library only understands rgb() colours and can't see CSS variables inside SVG
 * images. Rewrite every colour in the cloned page as plain rgba(), using the browser itself
 * to resolve the value, so modern colour syntax (oklab, color-mix) and chart colours survive.
 */
function plainColours(root: HTMLElement) {
  const win = root.ownerDocument.defaultView!
  const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!
  ctx.canvas.width = ctx.canvas.height = 1
  const seen = new Map<string, string>()
  const rgba = (c: string) => {
    if (!c || c === 'none' || c === 'transparent' || c.startsWith('url(') || /^rgba?\(/.test(c)) return c
    const hit = seen.get(c)
    if (hit) return hit
    ctx.clearRect(0, 0, 1, 1)
    ctx.fillStyle = '#000'
    ctx.fillStyle = c
    ctx.fillRect(0, 0, 1, 1)
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
    const out = `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`
    seen.set(c, out)
    return out
  }

  for (const el of [root, ...Array.from(root.querySelectorAll<HTMLElement | SVGElement>('*'))]) {
    const cs = win.getComputedStyle(el)
    if (el.namespaceURI === SVG_NS) {
      for (const p of SVG_PAINT) {
        const attr = el.getAttribute(p)
        const computed = cs.getPropertyValue(p)
        if ((attr && attr.includes('var(')) || (computed && !/^(rgba?\(|none|url\()/.test(computed) && attr)) el.setAttribute(p, rgba(computed))
      }
      if (el.tagName.toLowerCase() === 'svg') el.setAttribute('font-family', cs.fontFamily)
      continue
    }
    const style = (el as HTMLElement).style
    for (const p of BOX_COLOURS) {
      const v = cs.getPropertyValue(p)
      if (v && !/^rgba?\(/.test(v) && v !== 'transparent') style.setProperty(p, rgba(v))
    }
    style.setProperty('box-shadow', 'none')
    // One-line truncated text gets clipped at the top by the capture; let it show in full.
    if (cs.textOverflow === 'ellipsis') style.setProperty('overflow', 'visible')
    style.setProperty('text-shadow', 'none')
    const bg = cs.backgroundImage
    if (bg && bg !== 'none' && /oklab|oklch|color\(|color-mix/.test(bg)) style.setProperty('background-image', 'none')
  }
}
