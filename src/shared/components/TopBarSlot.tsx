/**
 * A place in the top bar (beside Create) that the page can fill, e.g. with its Filters.
 * The page decides what goes there; pages that put nothing there show nothing.
 */
import React, { createContext, useContext } from 'react'
import { createPortal } from 'react-dom'

export const TopBarSlotContext = createContext<HTMLElement | null>(null)

/** Render children in the top bar, next to Create. */
export function TopBar({ children }: { children: React.ReactNode }) {
  const slot = useContext(TopBarSlotContext)
  return slot ? createPortal(children, slot) : null
}
