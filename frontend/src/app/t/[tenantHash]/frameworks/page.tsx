'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { api } from '@/lib/api'
import { Check, Shield, FileText, Users, Calendar, Leaf, Building, Cpu } from 'lucide-react'
import { Framework } from '@/types'

export default function FrameworksPage() {
  const [frameworks, setFrameworks] = useState<Framework[]>([])
  const [loading, setLoading] = useState(true)
  const [subscribing, setSubscribing] = useState<string | null>(null)
  const params = useParams()
  const tenantHash = params.tenantHash as string

  useEffect(() => {
    const loadFrameworks = async () => {
      try {
        const response = await api.getTenantFrameworks(tenantHash)
        if (response.success) {
          setFrameworks(response.data)
        }
      } catch (error) {
        console.error('Failed to load frameworks:', error)
      } finally {
        setLoading(false)
      }
    }

    loadFrameworks()
  }, [tenantHash])

  const handleSubscribe = async (frameworkId: string) => {
    setSubscribing(frameworkId)
    try {
      const response = await api.subscribeToFramework(tenantHash, frameworkId)
      if (response.success) {
        setFrameworks(prev => prev.map(f =>
          f.id === frameworkId ? { ...f, subscribed: true } : f
        ))
      }
    } catch (error) {
      console.error('Failed to subscribe:', error)
    } finally {
      setSubscribing(null)
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'security': return <Shield className="w-5 h-5 text-blue-500" />
      case 'environmental': return <Leaf className="w-5 h-5 text-green-500" />
      case 'safety': return <Shield className="w-5 h-5 text-red-500" />
      case 'quality': return <FileText className="w-5 h-5 text-purple-500" />
      case 'social': return <Users className="w-5 h-5 text-orange-500" />
      case 'financial': return <Building className="w-5 h-5 text-indigo-500" />
      case 'technology': return <Cpu className="w-5 h-5 text-pink-500" />
      default: return <Calendar className="w-5 h-5 text-gray-500" />
    }
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'security': return 'bg-blue-100 text-blue-800'
      case 'environmental': return 'bg-green-100 text-green-800'
      case 'safety': return 'bg-red-100 text-red-800'
      case 'quality': return 'bg-purple-100 text-purple-800'
      case 'social': return 'bg-orange-100 text-orange-800'
      case 'financial': return 'bg-indigo-100 text-indigo-800'
      case 'technology': return 'bg-pink-100 text-pink-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  const subscribedFrameworks = frameworks.filter(f => f.subscribed)
  const availableFrameworks = frameworks.filter(f => !f.subscribed)

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Compliance Frameworks</h1>
        <p className="text-gray-600 mt-1">
          Select and manage the compliance frameworks that apply to your organization
        </p>
      </div>

      {subscribedFrameworks.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Active Frameworks ({subscribedFrameworks.length})
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {subscribedFrameworks.map((framework) => (
              <div
                key={framework.id}
                className="relative border-2 border-green-200 bg-green-50 rounded-lg p-6"
              >
                <div className="absolute top-4 right-4">
                  <div className="flex items-center justify-center w-6 h-6 bg-green-500 rounded-full">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                </div>

                <div className="flex items-start space-x-3 mb-4">
                  {getCategoryIcon(framework.category)}
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{framework.name}</h3>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getCategoryColor(framework.category)}`}>
                        {framework.category}
                      </span>
                      {framework.certification_available && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          Certification Available
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <p className="text-gray-600 text-sm mb-4">
                  {framework.description}
                </p>

                <div className="flex items-center justify-between text-sm text-gray-500">
                  <span>{framework.issuing_body}</span>
                  <span>{framework.standard_number}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {availableFrameworks.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Available Frameworks ({availableFrameworks.length})
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {availableFrameworks.map((framework) => (
              <div
                key={framework.id}
                className="relative border border-gray-200 bg-white rounded-lg p-6 hover:border-gray-300 transition-colors"
              >
                <div className="flex items-start space-x-3 mb-4">
                  {getCategoryIcon(framework.category)}
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{framework.name}</h3>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getCategoryColor(framework.category)}`}>
                        {framework.category}
                      </span>
                      {framework.certification_available && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          Certification Available
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <p className="text-gray-600 text-sm mb-4">
                  {framework.description}
                </p>

                <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                  <span>{framework.issuing_body}</span>
                  <span>{framework.standard_number}</span>
                </div>

                <button
                  onClick={() => handleSubscribe(framework.id)}
                  disabled={subscribing === framework.id}
                  className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {subscribing === framework.id ? 'Subscribing...' : 'Subscribe'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {frameworks.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <Shield className="mx-auto h-12 w-12" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No frameworks available
          </h3>
          <p className="text-gray-500">
            Contact your administrator to add compliance frameworks.
          </p>
        </div>
      )}
    </div>
  )
}
