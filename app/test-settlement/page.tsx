'use client'

import { useState } from 'react'

export default function TestSettlement() {
  const [status, setStatus] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const checkStatus = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/settle', {
        method: 'GET',
      })
      const data = await response.json()
      setStatus(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const triggerSettlement = async (autoDetect: boolean) => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/settle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ autoDetect }),
      })
      const data = await response.json()
      setStatus(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto text-black">
      <h1 className="text-2xl font-bold mb-6 text-white">Settlement Debug Page</h1>
      
      <div className="flex gap-4 mb-6">
        <button
          onClick={checkStatus}
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          Check Settlement Status
        </button>
        
        <button
          onClick={() => triggerSettlement(true)}
          disabled={loading}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
        >
          Auto-Detect & Settle
        </button>
      </div>

      {loading && <p>Loading...</p>}
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          Error: {error}
        </div>
      )}

      {status && (
        <div className="bg-gray-100 p-4 rounded">
          <h2 className="font-bold mb-2">Response:</h2>
          <pre className="whitespace-pre-wrap overflow-auto">
            {JSON.stringify(status, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}