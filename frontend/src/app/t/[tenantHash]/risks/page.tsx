'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { api } from '@/lib/api'
import { Plus, AlertTriangle, Edit, Save, X } from 'lucide-react'
import { Risk } from '@/types'
import Cookies from 'js-cookie'

interface ExtendedRisk extends Risk {
  risk_id?: string
  treatment_strategy?: 'accept' | 'mitigate' | 'avoid' | 'transfer'
  treatment_plan?: string
  residual_likelihood?: number
  residual_impact?: number
  residual_risk_score?: number
}

export default function RisksPage() {
  const [risks, setRisks] = useState<ExtendedRisk[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingRisk, setEditingRisk] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const params = useParams()
  const tenantHash = params.tenantHash as string
  const [aiAssessment, setAiAssessment] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [showAiSuggestions, setShowAiSuggestions] = useState(false)

// Add this function to handle AI assessment
const handleAiAssessment = async () => {
  if (!newRisk.title || !newRisk.description) {
    alert('Please fill in title and description first')
    return
  }

  setAiLoading(true)

  try {
    const requestData = {
      title: newRisk.title,
      description: newRisk.description,
      risk_category: newRisk.risk_category,
      industry: 'technology',
      company_size: 'medium'
    }

    // Use relative URL - Next.js will proxy to backend
    const response = await fetch(`/api/t/${tenantHash}/risks/ai-assess`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Cookies.get('auth_token')}`
      },
      body: JSON.stringify(requestData)
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()

    if (data.success) {
      setAiAssessment(data.assessment)
      setShowAiSuggestions(true)

      setNewRisk(prev => ({
        ...prev,
        likelihood: data.assessment.likelihood.score,
        impact: data.assessment.impact.score,
        residual_likelihood: Math.max(1, data.assessment.likelihood.score - 1),
        residual_impact: Math.max(1, data.assessment.impact.score - 1)
      }))
    } else {
      alert(`AI assessment failed: ${data.error || 'Unknown error'}`)
    }
  } catch (error) {
    console.error('AI assessment error:', error)
    alert(`AI assessment error: ${error.message}`)
  } finally {
    setAiLoading(false)
  }
}

// Enhanced form submission with AI data
const handleCreateRisk = async (e: React.FormEvent) => {
  e.preventDefault()
  setCreating(true)

  try {
    const endpoint = aiAssessment ? '/api/t/' + tenantHash + '/risks/create-with-ai' : '/api/t/' + tenantHash + '/risks'

    const riskData = {
      ...newRisk,
      residual_risk_score: newRisk.residual_likelihood * newRisk.residual_impact,
      ...(aiAssessment && { ai_assessment: aiAssessment })
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Cookies.get('auth_token')}`
      },
      body: JSON.stringify(riskData)
    })

    if (response.ok) {
      await loadRisks()
      // Reset form
      setNewRisk({
        title: '',
        description: '',
        risk_category: 'operational',
        likelihood: 3,
        impact: 3,
        treatment_strategy: 'mitigate',
        treatment_plan: '',
        residual_likelihood: 2,
        residual_impact: 2
      })
      setAiAssessment(null)
      setShowAiSuggestions(false)
      setShowCreateForm(false)
    }
  } catch (error) {
    console.error('Failed to create risk:', error)
  } finally {
    setCreating(false)
  }
}

  const [newRisk, setNewRisk] = useState({
    title: '',
    description: '',
    risk_category: 'operational',
    likelihood: 3,
    impact: 3,
    treatment_strategy: 'mitigate' as const,
    treatment_plan: '',
    residual_likelihood: 2,
    residual_impact: 2
  })

  const [editForm, setEditForm] = useState<Partial<ExtendedRisk>>({})

  useEffect(() => {
    loadRisks()
  }, [tenantHash])

  const loadRisks = async () => {
    try {
      const response = await api.getRisks(tenantHash)
      if (response.success) {
        // Add generated risk IDs and default treatment values for existing risks
        const risksWithIds = response.data.map((risk: any, index: number) => ({
          ...risk,
          risk_id: risk.risk_id || `R${String(index + 1).padStart(3, '0')}`,
          treatment_strategy: risk.treatment_strategy || 'mitigate',
          treatment_plan: risk.treatment_plan || '',
          residual_likelihood: risk.residual_likelihood || Math.max(1, risk.likelihood - 1),
          residual_impact: risk.residual_impact || Math.max(1, risk.impact - 1),
          residual_risk_score: risk.residual_risk_score || (Math.max(1, risk.likelihood - 1) * Math.max(1, risk.impact - 1))
        }))
        setRisks(risksWithIds)
      }
    } catch (error) {
      console.error('Failed to load risks:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateRiskId = () => {
    const nextNumber = risks.length + 1
    return `R${String(nextNumber).padStart(3, '0')}`
  }



  const startEdit = (risk: ExtendedRisk) => {
    setEditForm(risk)
    setEditingRisk(risk.id)
  }

  const saveEdit = async () => {
    if (!editForm.id) return

    try {
      // Calculate residual risk score
      const updatedRisk = {
        ...editForm,
        residual_risk_score: (editForm.residual_likelihood || 1) * (editForm.residual_impact || 1)
      }

      // Here you would call an update API endpoint
      // For now, we'll update locally
      setRisks(prev => prev.map(r =>
        r.id === editForm.id ? { ...r, ...updatedRisk } : r
      ))

      setEditingRisk(null)
      setEditForm({})
    } catch (error) {
      console.error('Failed to update risk:', error)
    }
  }

  const cancelEdit = () => {
    setEditingRisk(null)
    setEditForm({})
  }

  const getRiskLevel = (score: number) => {
    if (score >= 20) return { level: 'Critical', color: 'bg-red-500', textColor: 'text-red-800' }
    if (score >= 15) return { level: 'High', color: 'bg-orange-500', textColor: 'text-orange-800' }
    if (score >= 10) return { level: 'Medium', color: 'bg-yellow-500', textColor: 'text-yellow-800' }
    if (score >= 5) return { level: 'Low', color: 'bg-green-500', textColor: 'text-green-800' }
    return { level: 'Very Low', color: 'bg-gray-500', textColor: 'text-gray-800' }
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'operational': return 'bg-blue-100 text-blue-800'
      case 'financial': return 'bg-green-100 text-green-800'
      case 'strategic': return 'bg-purple-100 text-purple-800'
      case 'compliance': return 'bg-indigo-100 text-indigo-800'
      case 'reputational': return 'bg-pink-100 text-pink-800'
      case 'environmental': return 'bg-emerald-100 text-emerald-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const treatmentStrategies = [
    { value: 'accept', label: 'Accept', color: 'bg-gray-100 text-gray-800' },
    { value: 'mitigate', label: 'Mitigate', color: 'bg-blue-100 text-blue-800' },
    { value: 'avoid', label: 'Avoid', color: 'bg-red-100 text-red-800' },
    { value: 'transfer', label: 'Transfer', color: 'bg-green-100 text-green-800' }
  ]

  // Risk Matrix Component
  const RiskMatrix = () => {
    const matrix = Array.from({ length: 5 }, (_, impact) =>
      Array.from({ length: 5 }, (_, likelihood) => {
        const score = (5 - impact) * (likelihood + 1)
        const inherentRisks = risks.filter(r =>
          r.likelihood === likelihood + 1 && r.impact === 5 - impact
        )
        const residualRisks = risks.filter(r =>
          (r.residual_likelihood || r.likelihood) === likelihood + 1 &&
          (r.residual_impact || r.impact) === 5 - impact
        )

        return {
          likelihood: likelihood + 1,
          impact: 5 - impact,
          score,
          inherentRisks,
          residualRisks,
          color: getRiskLevel(score).color
        }
      })
    )

    return (
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Risk Matrix</h3>
        <div className="overflow-x-auto">
          <div className="grid grid-cols-6 gap-1 min-w-max">
            {/* Header */}
            <div className="p-2"></div>
            {[1, 2, 3, 4, 5].map(likelihood => (
              <div key={likelihood} className="p-2 text-center font-medium text-sm bg-gray-100">
                L{likelihood}
              </div>
            ))}

            {matrix.map((row, impactIndex) => (
              row.map((cell, likelihoodIndex) => {
                if (likelihoodIndex === 0) {
                  return [
                    <div key={`impact-${impactIndex}`} className="p-2 text-center font-medium text-sm bg-gray-100">
                      I{cell.impact}
                    </div>,
                    <div key={`cell-${impactIndex}-${likelihoodIndex}`}
                         className={`p-2 h-16 ${cell.color} border border-white relative text-xs`}>
                      <div className="absolute inset-1 overflow-hidden">
                        {/* Inherent risks (top) */}
                        <div className="flex flex-wrap gap-1 mb-1">
                          {cell.inherentRisks.map(risk => (
                            <span key={risk.id} className="bg-black text-white px-1 rounded text-xs">
                              {risk.risk_id}
                            </span>
                          ))}
                        </div>
                        {/* Residual risks (bottom) */}
                        <div className="flex flex-wrap gap-1">
                          {cell.residualRisks.map(risk => (
                            <span key={`res-${risk.id}`} className="bg-white text-black px-1 rounded text-xs border">
                              {risk.risk_id}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ]
                }
                return (
                  <div key={`cell-${impactIndex}-${likelihoodIndex}`}
                       className={`p-2 h-16 ${cell.color} border border-white relative text-xs`}>
                    <div className="absolute inset-1 overflow-hidden">
                      {/* Inherent risks (black) */}
                      <div className="flex flex-wrap gap-1 mb-1">
                        {cell.inherentRisks.map(risk => (
                          <span key={risk.id} className="bg-black text-white px-1 rounded text-xs">
                            {risk.risk_id}
                          </span>
                        ))}
                      </div>
                      {/* Residual risks (white) */}
                      <div className="flex flex-wrap gap-1">
                        {cell.residualRisks.map(risk => (
                          <span key={`res-${risk.id}`} className="bg-white text-black px-1 rounded text-xs border">
                            {risk.risk_id}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })
            ))}
          </div>
          <div className="mt-4 flex items-center space-x-4 text-sm">
            <div className="flex items-center space-x-2">
              <span className="bg-black text-white px-2 py-1 rounded text-xs">R001</span>
              <span>Inherent Risk</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="bg-white text-black px-2 py-1 rounded text-xs border">R001</span>
              <span>Residual Risk</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Risk Management</h1>
            <p className="text-gray-600 mt-1">
              Comprehensive risk assessment, treatment planning, and monitoring
            </p>
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Risk
          </button>
        </div>
      </div>

      {/* Risk Matrix */}
      <RiskMatrix />

      {/* Enhanced Create Risk Form with AI */}
{showCreateForm && (
  <div className="mb-8 bg-white rounded-lg shadow-sm border p-6">
    <h3 className="text-lg font-medium text-gray-900 mb-4">Create New Risk</h3>
    <form onSubmit={handleCreateRisk}>
      <div className="grid grid-cols-1 gap-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Risk Title
            </label>
            <input
              type="text"
              required
              value={newRisk.title}
              onChange={(e) => setNewRisk({...newRisk, title: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Data breach risk"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <select
              value={newRisk.risk_category}
              onChange={(e) => setNewRisk({...newRisk, risk_category: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="operational">Operational</option>
              <option value="financial">Financial</option>
              <option value="strategic">Strategic</option>
              <option value="compliance">Compliance</option>
              <option value="reputational">Reputational</option>
              <option value="environmental">Environmental</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            required
            value={newRisk.description}
            onChange={(e) => setNewRisk({...newRisk, description: e.target.value})}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Describe the risk in detail..."
          />
        </div>

        {/* AI Assessment Button */}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={handleAiAssessment}
            disabled={aiLoading || !newRisk.title || !newRisk.description}
            className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {aiLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                AI Analyzing...
              </>
            ) : (
              <>
                🤖 Get AI Risk Assessment
              </>
            )}
          </button>
        </div>

        {/* AI Suggestions Display */}
        {showAiSuggestions && aiAssessment && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-center mb-3">
              <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-xs font-medium">
                🤖 AI Assessment
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <strong>Likelihood: {aiAssessment.likelihood.score}/5</strong>
                <p className="text-sm text-gray-600">{aiAssessment.likelihood.reasoning}</p>
              </div>
              <div>
                <strong>Impact: {aiAssessment.impact.score}/5</strong>
                <p className="text-sm text-gray-600">{aiAssessment.impact.reasoning}</p>
              </div>
            </div>

            {aiAssessment.mitigation_strategies && aiAssessment.mitigation_strategies.length > 0 && (
              <div className="mb-4">
                <strong>AI Suggested Mitigations:</strong>
                <ul className="text-sm text-gray-600 mt-1">
                  {aiAssessment.mitigation_strategies.map((strategy, index) => (
                    <li key={index} className="mb-1">
                      • <strong>{strategy.timeframe}:</strong> {strategy.strategy}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="text-sm">
              <strong>Recommended Review:</strong> {aiAssessment.review_frequency}
            </div>
          </div>
        )}

        {/* Rest of your existing form fields... */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Inherent Likelihood (1-5)
            </label>
            <select
              value={newRisk.likelihood}
              onChange={(e) => setNewRisk({...newRisk, likelihood: parseInt(e.target.value)})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={1}>1 - Very Unlikely</option>
              <option value={2}>2 - Unlikely</option>
              <option value={3}>3 - Possible</option>
              <option value={4}>4 - Likely</option>
              <option value={5}>5 - Very Likely</option>
            </select>
            {aiAssessment && (
              <p className="text-xs text-purple-600 mt-1">
                AI suggested: {aiAssessment.likelihood.score}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Inherent Impact (1-5)
            </label>
            <select
              value={newRisk.impact}
              onChange={(e) => setNewRisk({...newRisk, impact: parseInt(e.target.value)})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={1}>1 - Minimal</option>
              <option value={2}>2 - Minor</option>
              <option value={3}>3 - Moderate</option>
              <option value={4}>4 - Major</option>
              <option value={5}>5 - Severe</option>
            </select>
            {aiAssessment && (
              <p className="text-xs text-purple-600 mt-1">
                AI suggested: {aiAssessment.impact.score}
              </p>
            )}
          </div>
        </div>

        {/* Continue with rest of existing form fields... */}

        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => {
              setShowCreateForm(false)
              setAiAssessment(null)
              setShowAiSuggestions(false)
            }}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={creating}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {creating ? 'Creating...' : aiAssessment ? 'Create with AI Assessment' : 'Create Risk'}
          </button>
        </div>
      </div>
    </form>
  </div>
)}

      {/* Risk Register */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Risk Register</h3>
        </div>

        {risks.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Risk ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Risk</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Inherent</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Treatment</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Residual</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {risks.map((risk) => (
                  <tr key={risk.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {risk.risk_id}
                    </td>
                    <td className="px-6 py-4">
                      {editingRisk === risk.id ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={editForm.title || ''}
                            onChange={(e) => setEditForm({...editForm, title: e.target.value})}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                          />
                          <textarea
                            value={editForm.description || ''}
                            onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                            rows={2}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                          />
                        </div>
                      ) : (
                        <div>
                          <div className="text-sm font-medium text-gray-900">{risk.title}</div>
                          <div className="text-sm text-gray-500">{risk.description}</div>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getCategoryColor(risk.risk_category)}`}>
                        {risk.risk_category}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {editingRisk === risk.id ? (
                        <div className="space-y-1">
                          <select
                            value={editForm.likelihood || risk.likelihood}
                            onChange={(e) => setEditForm({...editForm, likelihood: parseInt(e.target.value)})}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                          >
                            {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
                          </select>
                          <select
                            value={editForm.impact || risk.impact}
                            onChange={(e) => setEditForm({...editForm, impact: parseInt(e.target.value)})}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                          >
                            {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
                          </select>
                        </div>
                      ) : (
                        <div>
                          <div>L: {risk.likelihood} | I: {risk.impact}</div>
                          <div className="font-semibold">Score: {risk.inherent_risk_score}</div>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {editingRisk === risk.id ? (
                        <div className="space-y-2">
                          <select
                            value={editForm.treatment_strategy || risk.treatment_strategy}
                            onChange={(e) => setEditForm({...editForm, treatment_strategy: e.target.value as any})}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                          >
                            {treatmentStrategies.map(t => (
                              <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                          </select>
                          <textarea
                            value={editForm.treatment_plan || risk.treatment_plan || ''}
                            onChange={(e) => setEditForm({...editForm, treatment_plan: e.target.value})}
                            rows={2}
                            placeholder="Treatment plan..."
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                          />
                        </div>
                      ) : (
                        <div>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            treatmentStrategies.find(t => t.value === risk.treatment_strategy)?.color || 'bg-gray-100 text-gray-800'
                          }`}>
                            {treatmentStrategies.find(t => t.value === risk.treatment_strategy)?.label || 'Mitigate'}
                          </span>
                          {risk.treatment_plan && (
                            <div className="text-sm text-gray-500 mt-1">{risk.treatment_plan}</div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {editingRisk === risk.id ? (
                        <div className="space-y-1">
                          <select
                            value={editForm.residual_likelihood || risk.residual_likelihood}
                            onChange={(e) => setEditForm({...editForm, residual_likelihood: parseInt(e.target.value)})}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                          >
                            {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
                          </select>
                          <select
                            value={editForm.residual_impact || risk.residual_impact}
                            onChange={(e) => setEditForm({...editForm, residual_impact: parseInt(e.target.value)})}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                          >
                            {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
                            </select>
                       </div>
                     ) : (
                       <div>
                         <div>L: {risk.residual_likelihood || risk.likelihood} | I: {risk.residual_impact || risk.impact}</div>
                         <div className="font-semibold">Score: {risk.residual_risk_score || (risk.residual_likelihood || risk.likelihood) * (risk.residual_impact || risk.impact)}</div>
                       </div>
                     )}
                   </td>
                   <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                     {editingRisk === risk.id ? (
                       <div className="flex space-x-2">
                         <button
                           onClick={saveEdit}
                           className="text-green-600 hover:text-green-900"
                         >
                           <Save className="w-4 h-4" />
                         </button>
                         <button
                           onClick={cancelEdit}
                           className="text-gray-600 hover:text-gray-900"
                         >
                           <X className="w-4 h-4" />
                         </button>
                       </div>
                     ) : (
                       <button
                         onClick={() => startEdit(risk)}
                         className="text-indigo-600 hover:text-indigo-900"
                       >
                         <Edit className="w-4 h-4" />
                       </button>
                     )}
                   </td>
                 </tr>
               ))}
             </tbody>
           </table>
         </div>
       ) : (
         <div className="text-center py-12">
           <AlertTriangle className="mx-auto h-12 w-12 text-gray-400 mb-4" />
           <h3 className="text-lg font-medium text-gray-900 mb-2">No risks in register</h3>
           <p className="text-gray-500 mb-6">
             Start by creating your first risk assessment.
           </p>
           <button
             onClick={() => setShowCreateForm(true)}
             className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center mx-auto"
           >
             <Plus className="w-4 h-4 mr-2" />
             Create Your First Risk
           </button>
         </div>
       )}
     </div>
   </div>
 )
}
