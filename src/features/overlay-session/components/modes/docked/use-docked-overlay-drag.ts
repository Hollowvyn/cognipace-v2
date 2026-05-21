import { type PointerEvent, useRef, useState } from 'react'

const dockBottomOffsetPx = 24
const dockTopMarginPx = 16
const dragThresholdPx = 5

export function useDockedOverlayDrag() {
  const activePointerIdRef = useRef<number | null>(null)
  const dockOffsetRef = useRef(0)
  const dragStartYRef = useRef(0)
  const lastPointerYRef = useRef(0)
  const suppressClickRef = useRef(false)
  const wasDraggedRef = useRef(false)
  const [dockOffsetY, setDockOffsetY] = useState(0)

  function shouldSuppressRestoreClick() {
    if (!suppressClickRef.current) {
      return false
    }

    suppressClickRef.current = false
    return true
  }

  function handlePointerDown(event: PointerEvent<HTMLElement>) {
    activePointerIdRef.current = event.pointerId
    dragStartYRef.current = event.clientY
    lastPointerYRef.current = event.clientY
    wasDraggedRef.current = false
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  function handlePointerMove(event: PointerEvent<HTMLElement>) {
    if (!isActivePointer(activePointerIdRef.current, event)) {
      return
    }

    const totalDeltaY = event.clientY - dragStartYRef.current
    if (!wasDraggedRef.current && Math.abs(totalDeltaY) < dragThresholdPx) {
      return
    }

    wasDraggedRef.current = true
    suppressClickRef.current = true

    const stepDeltaY = event.clientY - lastPointerYRef.current
    lastPointerYRef.current = event.clientY

    if (stepDeltaY === 0) {
      return
    }

    const nextOffset = clampDockOffset(
      dockOffsetRef.current + stepDeltaY,
      event.currentTarget.getBoundingClientRect().height,
    )
    dockOffsetRef.current = nextOffset
    setDockOffsetY(nextOffset)
  }

  function handlePointerUp(event: PointerEvent<HTMLElement>) {
    if (!isActivePointer(activePointerIdRef.current, event)) {
      return
    }

    event.currentTarget.releasePointerCapture?.(event.pointerId)
    activePointerIdRef.current = null
    suppressClickRef.current = wasDraggedRef.current
    wasDraggedRef.current = false
  }

  function handlePointerCancel() {
    activePointerIdRef.current = null
    suppressClickRef.current = wasDraggedRef.current
    wasDraggedRef.current = false
  }

  return {
    dockOffsetY,
    handlePointerCancel,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    shouldSuppressRestoreClick,
  }
}

function clampDockOffset(offsetY: number, dockHeight: number) {
  const viewportHeight = globalThis.window?.innerHeight ?? 800
  const maxUpwardOffset = Math.min(
    0,
    dockTopMarginPx + dockHeight + dockBottomOffsetPx - viewportHeight,
  )

  return Math.min(0, Math.max(maxUpwardOffset, offsetY))
}

function isActivePointer(
  activePointerId: number | null,
  event: PointerEvent<HTMLElement>,
) {
  return activePointerId !== null && event.pointerId === activePointerId
}
