import { useEffect } from 'react'
import { STATUS, formatClock, formatUp } from '../lib/time'

const BASE_TITLE = 'SyncTimer'

/** Mirrors the live clock in the browser tab, e.g. "09:42 · Team standup". */
export function useTimerTitle({ displayMs, status, name, mode }) {
  const clock = mode === 'stopwatch' ? formatUp(displayMs) : formatClock(displayMs)
  let prefix = clock
  if (status === STATUS.PAUSED) prefix = `${clock} (paused)`
  else if (status === STATUS.FINISHED) prefix = "Time's up!"
  else if (status === STATUS.ENDED) prefix = 'Ended'
  const title = `${prefix} · ${name || BASE_TITLE}`

  useEffect(() => {
    document.title = title
  }, [title])

  useEffect(
    () => () => {
      document.title = `${BASE_TITLE} — Shared Countdown`
    },
    [],
  )
}
