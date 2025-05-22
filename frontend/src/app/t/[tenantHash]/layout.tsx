'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { LogOut, BarChart3, Shield, AlertTriangle } from 'lucide-react'
import Cookies from 'js-cookie'
import { DashboardData } from '@/types'

export default function TenantLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const params = useParams()
  const tenantHash = params.tenantHash as string

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const response = await api.getDashboard(tenantHash)
        if (response.success) {
          setDashboardData(response.data)
        }
      } catch (error) {
        console.error('Failed to load dashboard:', error)
        router.push('/auth/login')
      } finally {
        setLoading(false)
      }
    }

    if (tenantHash) {
      loadDashboard()
    }
  }, [tenantHash, router])

  const handleLogout = () => {
    Cookies.remove('auth_token')
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (!dashboardData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900">Access Denied</h2>
          <p className="text-gray-600 mt-2">Unable to load tenant data</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">
                {dashboardData.tenant.name}
              </h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <Link
                href={`/t/${tenantHash}/dashboard`}
                className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                Dashboard
              </Link>
              
              <Link
                href={`/t/${tenantHash}/frameworks`}
                className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                <Shield className="w-4 h-4 mr-2" />
                Frameworks
              </Link>
              
              <Link
                href={`/t/${tenantHash}/risks`}
                className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                <AlertTriangle className="w-4 h-4 mr-2" />
                Risks
              </Link>
              
              <button
                onClick={handleLogout}
                className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  )
}