import Link from 'next/link'
import { Shield, CheckCircle, Users, BarChart3 } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Universal GRC Platform
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Manage ISO standards, ESG frameworks, and compliance requirements in one platform
          </p>
          <div className="flex justify-center space-x-4">
            <Link 
              href="/auth/register"
              className="bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 transition-colors"
            >
              Get Started
            </Link>
            <Link 
              href="/auth/login"
              className="bg-white text-blue-600 px-6 py-3 rounded-md border border-blue-600 hover:bg-blue-50 transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <Shield className="w-12 h-12 text-blue-600 mb-4" />
            <h3 className="text-lg font-semibold mb-2">ISO Standards</h3>
            <p className="text-gray-600">ISO 9001, 14001, 45001, 27001, 42001 and more</p>
          </div>
          
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <BarChart3 className="w-12 h-12 text-green-600 mb-4" />
            <h3 className="text-lg font-semibold mb-2">ESG Reporting</h3>
            <p className="text-gray-600">GRI, SASB, TCFD compliance tracking</p>
          </div>
          
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <Users className="w-12 h-12 text-purple-600 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Multi-Tenant</h3>
            <p className="text-gray-600">Secure tenant isolation and management</p>
          </div>
          
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <CheckCircle className="w-12 h-12 text-orange-600 mb-4" />
            <h3 className="text-lg font-semibold mb-2">AI-Powered</h3>
            <p className="text-gray-600">Intelligent risk assessment and insights</p>
          </div>
        </div>
      </div>
    </div>
  )
}
