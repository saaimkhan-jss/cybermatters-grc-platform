import Cookies from 'js-cookie'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || ''

class ApiClient {
  private getAuthHeaders() {
    const token = Cookies.get('auth_token')
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` })
    }
  }

  async request(endpoint: string, options: RequestInit = {}) {
    const url = `${API_BASE}${endpoint}`
    
    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.getAuthHeaders(),
        ...options.headers,
      },
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Network error' }))
      throw new Error(error.error || 'Request failed')
    }

    return response.json()
  }

  // Auth methods
  async register(data: { name: string; email: string; password: string }) {
    return this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async login(data: { email: string; password: string; tenantHash?: string }) {
    return this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  // Framework methods
  async getFrameworks() {
    return this.request('/api/frameworks')
  }

  async getTenantFrameworks(tenantHash: string) {
    return this.request(`/api/t/${tenantHash}/frameworks`)
  }

  async subscribeToFramework(tenantHash: string, frameworkId: string) {
    return this.request(`/api/t/${tenantHash}/frameworks/${frameworkId}/subscribe`, {
      method: 'POST',
    })
  }

  // Dashboard
  async getDashboard(tenantHash: string) {
    return this.request(`/api/t/${tenantHash}/dashboard`)
  }

  // Risks
  async getRisks(tenantHash: string) {
    return this.request(`/api/t/${tenantHash}/risks`)
  }

  async createRisk(tenantHash: string, data: any) {
    return this.request(`/api/t/${tenantHash}/risks`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }
}

export const api = new ApiClient()
