/**
 * Download SOPs as a PDF: number, title, pillar, status, version, owner, purpose, what it applies
 * to and each step. Uses jsPDF (already used by the exporter), loaded only when needed.
 */
import { sopRef, type Sop } from '../shared/data/sops'

const fmt = (d?: string) => (d ? new Date(`${d.slice(0, 10)}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '')

/** The built-in PDF font only draws Latin characters (WinAnsi): swap or drop the rest. */
const WIN_ANSI_EXTRA = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ'
const safe = (s: string) =>
  s
    .replace(/[→⇒]/g, '>')
    .replace(/[←⇐]/g, '<')
    .replace(/≥/g, '>=')
    .replace(/≤/g, '<=')
    .replace(/[✓✔]/g, 'v')
    .replace(/[^\u0000-ÿ]/g, (c) => (WIN_ANSI_EXTRA.includes(c) ? c : ''))

export const sopFileName = (x: Sop) => `${sopRef(x)} ${x.title}`.replace(/[\\/:*?"<>|]+/g, '-').trim()

/** Build one PDF holding the given SOPs, each starting on a new page, and download it. */
export async function downloadSopsPdf(sops: Sop[], fileName: string) {
  const { default: JsPDF } = await import('jspdf')
  const doc = new JsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const M = 48
  const width = W - M * 2
  let y = M

  const room = (h: number) => {
    if (y + h > H - M) {
      doc.addPage()
      y = M
    }
  }
  const text = (s: string, o: { size?: number; bold?: boolean; color?: [number, number, number]; indent?: number; gap?: number } = {}) => {
    const size = o.size ?? 10.5
    doc.setFont('helvetica', o.bold ? 'bold' : 'normal')
    doc.setFontSize(size)
    doc.setTextColor(...(o.color ?? [40, 44, 52]))
    const lines = doc.splitTextToSize(safe(s), width - (o.indent ?? 0)) as string[]
    const lh = size * 1.4
    for (const line of lines) {
      room(lh)
      doc.text(line, M + (o.indent ?? 0), y + size)
      y += lh
    }
    y += o.gap ?? 0
  }

  sops.forEach((x, n) => {
    if (n > 0) {
      doc.addPage()
      y = M
    }
    text(sopRef(x), { size: 10, bold: true, color: [21, 62, 140], gap: 2 })
    text(x.title, { size: 17, bold: true, color: [16, 24, 40], gap: 4 })
    const meta = [x.pillar, x.status, `v${x.version}`, `Owner: ${x.owner}`, x.reviewedBy ? `Approved by ${x.reviewedBy}${x.reviewedAt ? ` on ${fmt(x.reviewedAt)}` : ''}` : 'Not yet approved'].join('  ·  ')
    text(meta, { size: 9, color: [100, 108, 120], gap: 10 })
    doc.setDrawColor(220, 224, 230)
    doc.line(M, y, W - M, y)
    y += 14
    if (x.purpose) {
      text('Purpose', { size: 10, bold: true, gap: 1 })
      text(x.purpose, { gap: 8 })
    }
    if (x.appliesTo.length) {
      text('Applies to', { size: 10, bold: true, gap: 1 })
      text(x.appliesTo.join(' · '), { gap: 8 })
    }
    if (x.document) text(`Attached document: ${x.document.name} (download it from the SOP page)`, { size: 9, color: [100, 108, 120], gap: 8 })
    if (x.steps.length) {
      text('Steps', { size: 12, bold: true, color: [16, 24, 40], gap: 4 })
      x.steps.forEach((s, i) => {
        room(40)
        text(`${i + 1}.  ${s.title}`, { size: 10.5, bold: true, gap: 1 })
        if (s.detail) text(s.detail, { indent: 18, gap: 0 })
        if (s.toLabel) text(`Done in the platform: ${s.toLabel}`, { size: 9, indent: 18, color: [100, 108, 120] })
        y += 6
      })
    } else if (!x.document) {
      text('No steps written yet.', { color: [100, 108, 120] })
    }
  })

  // Footer on every page.
  const pages = doc.getNumberOfPages()
  const today = fmt(new Date().toISOString())
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(140, 146, 156)
    doc.text(`CHII SOPs · downloaded ${today}`, M, H - 24)
    doc.text(`Page ${i} of ${pages}`, W - M, H - 24, { align: 'right' })
  }
  doc.save(`${fileName}.pdf`)
}
