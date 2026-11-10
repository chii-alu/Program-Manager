import React from 'react'

/** A scannable-looking QR mark generated from a seed string (stand-in until real QR generation). */
export function QrMark({ seed, size = 168 }: { seed: string; size?: number }) {
  const n = 25
  let h = 0
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0
  const rand = (i: number) => {
    const x = Math.sin(h + i * 12.9898) * 43758.5453
    return x - Math.floor(x) > 0.52
  }
  const finder = (x: number, y: number) => {
    const inBox = (ox: number, oy: number) => x >= ox && x < ox + 7 && y >= oy && y < oy + 7
    for (const [ox, oy] of [[0, 0], [n - 7, 0], [0, n - 7]]) {
      if (inBox(ox, oy)) {
        const dx = x - ox
        const dy = y - oy
        const ring = dx === 0 || dx === 6 || dy === 0 || dy === 6
        const core = dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4
        return ring || core ? 1 : 0
      }
    }
    return -1
  }
  const cells: React.ReactNode[] = []
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const f = finder(x, y)
      const on = f === -1 ? rand(y * n + x) : f === 1
      if (on) cells.push(<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} />)
    }
  return (
    <svg viewBox={`0 0 ${n} ${n}`} width={size} height={size} fill="#111827" shapeRendering="crispEdges" aria-label="QR code">
      {cells}
    </svg>
  )
}
