import { useEffect } from 'react'
import { isRouteErrorResponse, Link, useRouteError } from 'react-router'
import { AlertTriangle } from 'lucide-react'

export default function RouteError() {
  const err = useRouteError()
  useEffect(() => { console.error('[TuitionHub] route render error:', err) }, [err])
  const msg = isRouteErrorResponse(err) ? `${err.status} ${err.statusText}` : err instanceof Error ? err.message : 'Unknown error'
  return (
    <div role="alert" className="mx-auto max-w-xl px-6 py-24 text-center">
      <AlertTriangle className="mx-auto text-danger-600" aria-hidden />
      <h1 className="mt-4 text-2xl">This page failed to render</h1>
      <p className="mt-2 text-sm text-gray-600">{msg}</p>
      <Link to="/" className="mt-6 inline-block font-semibold text-blue-600 hover:underline">Back to home</Link>
    </div>
  )
}
