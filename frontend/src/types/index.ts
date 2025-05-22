export interface Framework {
  id: string
  name: string
  description: string
  framework_type: string
  category: string
  issuing_body: string
  standard_number: string
  certification_available: boolean
  subscribed?: boolean
  control_count?: number
}

export interface Risk {
  id: string
  tenant_id: string
  title: string
  description: string
  risk_category: string
  likelihood: number
  impact: number
  inherent_risk_score: number
  status: string
  owner: string
  created_at: string
}

export interface User {
  id: string
  email: string
  role: string
  first_name: string
  last_name: string
}

export interface DashboardData {
  tenant: {
    name: string
    hash: string
  }
  metrics: {
    totalRisks: number
    activeFrameworks: number
  }
}
