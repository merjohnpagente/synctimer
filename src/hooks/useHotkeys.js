import { useEffect, useRef } from 'react'

function isTypingTarget(el) {
  if (!el) return false
  const tag = el.tagName
  return (
    el.isContentEditable ||
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT'
  )
}

/**
 * Single-key shortcuts (no modifiers). `map` keys are KeyboardEvent.key
 * values, lower-cased; ' ' is the space bar. Ignored while typing.
 */
export function useHotkeys(map) {
  const mapRef = useRef(map)
  useEffect(() => {
    mapRef.current = map
  })

  useEffect(() => {
    const onKey = (e) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return
      if (isTypingTarget(e.target)) return
      const handler = mapRef.current[e.key.toLowerCase()]
      if (!handler) return
      // Space on a focused button would also "click" it — avoid double fire.
      if (e.key === ' ' && e.target?.tagName === 'BUTTON') return
      e.preventDefault()
      handler()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
