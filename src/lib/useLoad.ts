import { useCallback, useEffect, useRef, useState } from 'react'
import { errMsg } from './platform'

/**
 * Loads data with loading and error state. `reload` refetches; stale responses
 * from an earlier call are ignored so fast filter changes cannot show old data.
 */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const seq = useRef(0)
  const reload = useCallback(async () => {
    const id = ++seq.current
    setLoading(true)
    try {
      const next = await fn()
      if (id === seq.current) { setData(next); setError('') }
    } catch (e) {
      if (id === seq.current) setError(errMsg(e, 'Could not load this page.'))
    } finally {
      if (id === seq.current) setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  useEffect(() => { void reload() }, [reload])
  return { data, error, loading, reload, setData }
}

/** Wraps an action with a busy flag and success/error toasts. Resolves to whether it succeeded. */
export function useAction(toast: (text: string, tone?: 'info' | 'success' | 'warning' | 'danger') => void) {
  const [busy, setBusy] = useState(false)
  const run = useCallback(async (fn: () => Promise<unknown>, success?: string) => {
    setBusy(true)
    try {
      await fn()
      if (success) toast(success, 'success')
      return true
    } catch (e) {
      toast(errMsg(e), 'danger')
      return false
    } finally {
      setBusy(false)
    }
  }, [toast])
  return { busy, run }
}
