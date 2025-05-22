'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { api } from '@/lib/api'
import { DashboardData } from '@/types'

export default function DashboardPage() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const params = useParams()
  const tenantHash = params.tenantHash as string

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const response = await api.getDashboard(tenantHash)
        if (response.success) {
          setDashboardData(response.data)
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load dashboard')
        console.error('Failed to load dashboard:', err)
      } finally {
        setLoading(false)
      }
    }

    loadDashboard()
  }, [tenantHash])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900">Error</h3>
        <p className="text-red-600">{error}</p>
      </div>
    )
  }

  if (!dashboardData) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900">No data available</h3>
      </div>
    )
  }

  return (
    <div className="px-4 py-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Welcome, {dashboardData.tenant.name}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium">Active Frameworks</h3>
          <p className="text-2xl font-bold text-blue-600">{dashboardData.metrics.activeFrameworks}</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium">Total Risks</h3>
          <p className="text-2xl font-bold text-orange-600">{dashboardData.metrics.totalRisks}</p>
        </div>
      </div>
    </div>
  )
}
