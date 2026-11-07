import { useRef, type PointerEvent } from 'react'

/** How far a finger has to travel sideways before a swipe counts. */
export const SWIPE_DISTANCE = 48

/**
 * Reads a finished gesture: 'left' or 'right' when it went far enough sideways and more sideways
 * than up or down (a vertical scroll that drifts is not a swipe), else null.
 */
export function swipeDirection(dx: number, dy: number, distance = SWIPE_DISTANCE) {
  if (Math.abs(dx) < distance || Math.abs(dx) < Math.abs(dy) * 1.5) return null
  return dx < 0 ? ('left' as const) : ('right' as const)
}

/**
 * Pointer handlers for a horizontal swipe by finger or pen (a mouse drags and selects as
 * usual). Give the element `touch-action: pan-y` (`touch-pan-y`) so the page still scrolls
 * vertically while the browser leaves sideways moves to us.
 */
export function useSwipe({ onLeft, onRight }: { onLeft(): void; onRight(): void }) {
  const start = useRef<{ id: number; x: number; y: number } | null>(null)
  const handlers = useRef({ onLeft, onRight })
  handlers.current = { onLeft, onRight }
  return {
    onPointerDown(event: PointerEvent) {
      if (event.pointerType === 'mouse' || !event.isPrimary) return
      start.current = { id: event.pointerId, x: event.clientX, y: event.clientY }
    },
    onPointerUp(event: PointerEvent) {
      const from = start.current
      start.current = null
      if (!from || from.id !== event.pointerId) return
      const direction = swipeDirection(event.clientX - from.x, event.clientY - from.y)
      if (direction === 'left') handlers.current.onLeft()
      else if (direction === 'right') handlers.current.onRight()
    },
    onPointerCancel() {
      start.current = null
    },
  }
}
