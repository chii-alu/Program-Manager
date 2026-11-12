/** Share a public venture form: link, copy, QR code, open and download, plus an open/closed switch. */
import React, { useRef, useState } from 'react'
import { Check, Copy, Download, ExternalLink, QrCode } from 'lucide-react'
import { Modal } from '../shared/components/Modal'
import { QrMark } from '../shared/components/QrMark'
import { Button } from '../shared/components/ui'

export const formUrl = (start: string, token?: string) => `${window.location.origin}/?start=${start}${token ? `&token=${token}` : ''}`

export function ShareLink({
  open,
  onClose,
  title,
  description,
  url,
  accepting,
  onToggle,
  fileName,
}: {
  open: boolean
  onClose: () => void
  title: string
  description: React.ReactNode
  url: string
  /** When given, shows the "accepting responses" switch. */
  accepting?: boolean
  onToggle?: (v: boolean) => void
  fileName: string
}) {
  const [copied, setCopied] = useState(false)
  const qr = useRef<HTMLDivElement>(null)
  const copy = () => {
    navigator.clipboard?.writeText(url).catch(() => undefined)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }
  const download = () => {
    const svg = qr.current?.querySelector('svg')
    if (!svg) return
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${fileName}-qr.svg`
    a.click()
    URL.revokeObjectURL(a.href)
  }
  return (
    <Modal open={open} onClose={onClose} title={title} description={description} size="sm" icon={<QrCode className="h-4 w-4" />}>
      <div className="flex flex-col items-center">
        {onToggle && (
          <button type="button" onClick={() => onToggle(!accepting)} aria-pressed={accepting} className="mb-4 flex w-full items-center justify-between gap-3 rounded-lg border border-line px-3 py-2.5 text-left text-sm">
            <span>
              <span className="block font-semibold text-ink">{accepting ? 'Accepting responses' : 'Not accepting responses'}</span>
              <span className="block text-xs text-muted">{accepting ? 'Anyone with the link can register a venture.' : 'The link shows “Registration is closed”.'}</span>
            </span>
            <span className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${accepting ? 'bg-good' : 'bg-line-strong'}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${accepting ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
            </span>
          </button>
        )}
        <div ref={qr} className={`rounded-xl border border-line bg-white p-4 ${accepting === false ? 'opacity-40' : ''}`}>
          <QrMark seed={url} />
        </div>
        <p className="mt-2 text-center text-[11px] text-warn">Sample QR pattern: phones can’t scan it yet. Use the link until a QR library is added.</p>
        <div className="mt-3 flex w-full gap-2">
          <div className="flex h-10 min-w-0 flex-1 items-center rounded-lg border border-line-strong bg-canvas px-3 font-mono text-xs text-body">
            <span className="truncate">{url}</span>
          </div>
          <Button className="h-10" onClick={copy}>
            {copied ? <Check className="h-4 w-4 text-good" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
        <div className="mt-3 grid w-full grid-cols-2 gap-2">
          <Button className="h-10" onClick={download}>
            <Download className="h-4 w-4" /> Download QR
          </Button>
          <Button className="h-10" onClick={() => window.open(url, '_blank', 'noopener')}>
            <ExternalLink className="h-4 w-4" /> Open form
          </Button>
        </div>
      </div>
    </Modal>
  )
}
