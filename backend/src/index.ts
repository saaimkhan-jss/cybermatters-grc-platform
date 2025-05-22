import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { sign, verify } from 'hono/jwt'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import Anthropic from '@anthropic-ai/sdk'

type Env = {
  DB: D1Database
  DOCUMENTS: R2Bucket
  SESSIONS: KVNamespace
  ANTHROPIC_API_KEY: string
  JWT_SECRET: string
  ENVIRONMENT: string
}

const app = new Hono<{ Bindings: Env }>()

// CORS middleware
app.use('*', cors({
  origin: ['https://app.cybermatters.io', 'https://staging.cybermatters.io', 'http://localhost:3000'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}))

// Validation schemas
const RegisterSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8)
})

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  tenantHash: z.string().optional()
})

// Auth helpers
const hashPassword = async (password: string): Promise<string> => {
  return await bcrypt.hash(password, 12)
}

const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  return await bcrypt.compare(password, hash)
}

const generateTenantHash = async (tenantId: string): Promise<string> => {
  const encoder = new TextEncoder()
  const data = encoder.encode(tenantId + Date.now().toString() + Math.random().toString())
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 12)
}

// Health check
app.get('/health', (c) => c.json({
  status: 'healthy',
  environment: c.env.ENVIRONMENT || 'development',
  timestamp: new Date().toISOString()
}))

// Register new tenant
app.post('/api/auth/register', async (c) => {
  try {
    const body = await c.req.json()
    const { name, email, password } = RegisterSchema.parse(body)

    // Check if email already exists
    const existingUser = await c.env.DB.prepare(`
      SELECT email FROM tenant_users WHERE email = ?
    `).bind(email).first()

    if (existingUser) {
      return c.json({ error: 'Email already registered' }, 400)
    }

    const tenantId = crypto.randomUUID()
    const tenantHash = await generateTenantHash(tenantId)
    const hashedPassword = await hashPassword(password)
    const userId = crypto.randomUUID()

    // Create tenant
    await c.env.DB.prepare(`
      INSERT INTO tenants (id, hash, name)
      VALUES (?, ?, ?)
    `).bind(tenantId, tenantHash, name).run()

    // Create admin user
    await c.env.DB.prepare(`
      INSERT INTO tenant_users (id, tenant_id, email, password_hash, role, first_name)
      VALUES (?, ?, ?, ?, 'admin', ?)
    `).bind(userId, tenantId, email, hashedPassword, name.split(' ')[0]).run()

    // Generate JWT token
    const token = await sign({
      userId,
      tenantId,
      tenantHash,
      role: 'admin',
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
    }, c.env.JWT_SECRET)

    return c.json({
      success: true,
      token,
      tenantHash,
      message: 'Account created successfully',
      redirectUrl: `/t/${tenantHash}/dashboard`
    })
  } catch (error) {
    console.error('Registration error:', error)
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid input data', details: error.errors }, 400)
    }
    return c.json({ error: 'Registration failed' }, 500)
  }
})

// Login
app.post('/api/auth/login', async (c) => {
  try {
    const body = await c.req.json()
    const { email, password, tenantHash } = LoginSchema.parse(body)

    let user
    if (tenantHash) {
      // Tenant-specific login
      user = await c.env.DB.prepare(`
        SELECT tu.*, t.hash as tenant_hash, t.name as tenant_name
        FROM tenant_users tu
        JOIN tenants t ON tu.tenant_id = t.id
        WHERE tu.email = ? AND t.hash = ?
      `).bind(email, tenantHash).first()
    } else {
      // Find user across all tenants
      user = await c.env.DB.prepare(`
        SELECT tu.*, t.hash as tenant_hash, t.name as tenant_name
        FROM tenant_users tu
        JOIN tenants t ON tu.tenant_id = t.id
        WHERE tu.email = ?
      `).bind(email).first()
    }

    if (!user || !await verifyPassword(password, user.password_hash)) {
      return c.json({ error: 'Invalid credentials' }, 401)
    }

    const token = await sign({
      userId: user.id,
      tenantId: user.tenant_id,
      tenantHash: user.tenant_hash,
      role: user.role,
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60)
    }, c.env.JWT_SECRET)

    return c.json({
      success: true,
      token,
      tenantHash: user.tenant_hash,
      redirectUrl: `/t/${user.tenant_hash}/dashboard`
    })
  } catch (error) {
    console.error('Login error:', error)
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid input data' }, 400)
    }
    return c.json({ error: 'Login failed' }, 500)
  }
})

// JWT middleware for protected routes
app.use('/api/t/*', async (c, next) => {
  try {
    const authHeader = c.req.header('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'No token provided' }, 401)
    }

    const token = authHeader.replace('Bearer ', '')
    const payload = await verify(token, c.env.JWT_SECRET)
    c.set('user', payload)
    await next()
  } catch (error) {
    return c.json({ error: 'Invalid token' }, 401)
  }
})

// Tenant context middleware
app.use('/api/t/:tenantHash/*', async (c, next) => {
  const tenantHash = c.req.param('tenantHash')
  const user = c.get('user')

  if (user.tenantHash !== tenantHash) {
    return c.json({ error: 'Access denied' }, 403)
  }

  const tenant = await c.env.DB.prepare(
    'SELECT * FROM tenants WHERE hash = ?'
  ).bind(tenantHash).first()

  if (!tenant) {
    return c.json({ error: 'Tenant not found' }, 404)
  }

  c.set('tenant', tenant)
  await next()
})

// Get available frameworks
app.get('/api/frameworks', async (c) => {
  try {
    const frameworks = await c.env.DB.prepare(`
      SELECT * FROM frameworks WHERE is_active = true ORDER BY category, name
    `).all()

    return c.json({ success: true, data: frameworks.results })
  } catch (error) {
    console.error('Frameworks error:', error)
    return c.json({ error: 'Failed to fetch frameworks' }, 500)
  }
})

// Tenant dashboard
app.get('/api/t/:tenantHash/dashboard', async (c) => {
  const tenant = c.get('tenant')

  try {
    // Get basic metrics
    const [risksResult, frameworksResult] = await Promise.all([
      c.env.DB.prepare('SELECT COUNT(*) as count FROM risks WHERE tenant_id = ?').bind(tenant.id).first(),
      c.env.DB.prepare('SELECT COUNT(*) as count FROM tenant_frameworks WHERE tenant_id = ? AND enabled = true').bind(tenant.id).first()
    ])

    return c.json({
      success: true,
      data: {
        tenant: {
          name: tenant.name,
          hash: tenant.hash
        },
        metrics: {
          totalRisks: risksResult?.count || 0,
          activeFrameworks: frameworksResult?.count || 0
        }
      }
    })
  } catch (error) {
    console.error('Dashboard error:', error)
    return c.json({ error: 'Failed to load dashboard' }, 500)
  }
})

// Get tenant's subscribed frameworks
app.get('/api/t/:tenantHash/frameworks', async (c) => {
  const tenant = c.get('tenant')

  try {
    const frameworks = await c.env.DB.prepare(`
      SELECT f.*,
             CASE WHEN tf.enabled IS NOT NULL THEN tf.enabled ELSE false END as subscribed,
             COUNT(fc.id) as control_count
      FROM frameworks f
      LEFT JOIN tenant_frameworks tf ON f.id = tf.framework_id AND tf.tenant_id = ?
      LEFT JOIN framework_controls fc ON f.id = fc.framework_id
      WHERE f.is_active = true
      GROUP BY f.id
      ORDER BY f.category, f.name
    `).bind(tenant.id).all()

    return c.json({ success: true, data: frameworks.results })
  } catch (error) {
    console.error('Tenant frameworks error:', error)
    return c.json({ error: 'Failed to fetch frameworks' }, 500)
  }
})

// Subscribe to framework
app.post('/api/t/:tenantHash/frameworks/:frameworkId/subscribe', async (c) => {
  const tenant = c.get('tenant')
  const frameworkId = c.req.param('frameworkId')

  try {
    await c.env.DB.prepare(`
      INSERT OR REPLACE INTO tenant_frameworks (tenant_id, framework_id, enabled)
      VALUES (?, ?, true)
    `).bind(tenant.id, frameworkId).run()

    return c.json({ success: true, message: 'Framework subscribed successfully' })
  } catch (error) {
    console.error('Framework subscription error:', error)
    return c.json({ error: 'Failed to subscribe to framework' }, 500)
  }
})

// Get tenant risks
app.get('/api/t/:tenantHash/risks', async (c) => {
  const tenant = c.get('tenant')

  try {
    const risks = await c.env.DB.prepare(`
      SELECT * FROM risks
      WHERE tenant_id = ?
      ORDER BY inherent_risk_score DESC NULLS LAST, created_at DESC
    `).bind(tenant.id).all()

    return c.json({ success: true, data: risks.results })
  } catch (error) {
    console.error('Risks error:', error)
    return c.json({ error: 'Failed to fetch risks' }, 500)
  }
})

// Create new risk
app.post('/api/t/:tenantHash/risks', async (c) => {
  const tenant = c.get('tenant')

  try {
    const { title, description, risk_category, likelihood, impact } = await c.req.json()

    const inherentRiskScore = likelihood * impact
    const riskId = crypto.randomUUID()

    await c.env.DB.prepare(`
      INSERT INTO risks (id, tenant_id, title, description, risk_category, likelihood, impact, inherent_risk_score)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(riskId, tenant.id, title, description, risk_category, likelihood, impact, inherentRiskScore).run()

    return c.json({ success: true, message: 'Risk created successfully', id: riskId })
  } catch (error) {
    console.error('Risk creation error:', error)
    return c.json({ error: 'Failed to create risk' }, 500)
  }
})

// AI-powered risk assessment
app.post('/api/t/:tenantHash/risks/ai-assess', async (c) => {
  const tenant = c.get('tenant')
  const { title, description, risk_category, industry, company_size } = await c.req.json()

  try {
    const anthropic = new Anthropic({ apiKey: c.env.ANTHROPIC_API_KEY })

    const assessment = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: `As a GRC expert, assess this ${risk_category} risk for a ${company_size || 'medium-sized'} ${industry || 'technology'} company:

Risk Title: "${title}"
Risk Description: "${description}"
Risk Category: ${risk_category}

Provide a comprehensive assessment with:

1. LIKELIHOOD (1-5 scale):
   - Score with specific reasoning
   - Consider industry context and company size

2. IMPACT (1-5 scale):
   - Score with specific reasoning
   - Consider financial, operational, and reputational impacts

3. MITIGATION STRATEGIES (3 specific strategies):
   - Immediate actions (0-30 days)
   - Medium-term controls (1-6 months)
   - Long-term improvements (6+ months)

4. REVIEW FREQUENCY:
   - Recommended monitoring schedule

5. BUSINESS IMPACTS:
   - Financial impact estimate
   - Operational disruption potential
   - Regulatory/compliance implications

6. THREAT SOURCES:
   - Most likely sources of this risk

7. VULNERABILITIES:
   - Key weaknesses that enable this risk

Format as valid JSON with this structure:
{
  "likelihood": {
    "score": 3,
    "reasoning": "explanation"
  },
  "impact": {
    "score": 4,
    "reasoning": "explanation"
  },
  "risk_score": 12,
  "mitigation_strategies": [
    {
      "timeframe": "immediate",
      "strategy": "specific action",
      "description": "detailed explanation"
    }
  ],
  "review_frequency": "monthly",
  "business_impacts": {
    "financial": "estimate and explanation",
    "operational": "disruption assessment",
    "regulatory": "compliance implications"
  },
  "threat_sources": ["source1", "source2"],
  "vulnerabilities": ["vulnerability1", "vulnerability2"],
  "recommendations": {
    "priority": "high/medium/low",
    "next_steps": "immediate actions to take"
  }
}`
      }]
    })

    // Parse the AI response
    let aiResponse
    try {
      const responseText = assessment.content[0].text
      // Extract JSON from the response (in case there's extra text)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        aiResponse = JSON.parse(jsonMatch[0])
      } else {
        // Fallback if JSON parsing fails
        aiResponse = {
          likelihood: { score: 3, reasoning: "AI assessment unavailable" },
          impact: { score: 3, reasoning: "AI assessment unavailable" },
          risk_score: 9,
          mitigation_strategies: [],
          review_frequency: "quarterly",
          business_impacts: { financial: "To be determined", operational: "To be assessed", regulatory: "To be reviewed" },
          threat_sources: [],
          vulnerabilities: [],
          recommendations: { priority: "medium", next_steps: "Manual assessment required" }
        }
      }
    } catch (parseError) {
      console.error('AI response parsing error:', parseError)
      // Provide fallback response
      aiResponse = {
        likelihood: { score: 3, reasoning: "AI assessment unavailable - manual review required" },
        impact: { score: 3, reasoning: "AI assessment unavailable - manual review required" },
        risk_score: 9,
        mitigation_strategies: [
          { timeframe: "immediate", strategy: "Conduct manual risk assessment", description: "Perform detailed manual evaluation of this risk" }
        ],
        review_frequency: "quarterly",
        business_impacts: { financial: "To be determined", operational: "To be assessed", regulatory: "To be reviewed" },
        threat_sources: ["To be identified"],
        vulnerabilities: ["To be assessed"],
        recommendations: { priority: "medium", next_steps: "Conduct manual risk assessment" }
      }
    }

    return c.json({
      success: true,
      assessment: aiResponse,
      raw_response: assessment.content[0].text // for debugging
    })

  } catch (error) {
    console.error('AI risk assessment error:', error)
    return c.json({
      success: false,
      error: 'AI assessment failed',
      fallback_assessment: {
        likelihood: { score: 3, reasoning: "Manual assessment required" },
        impact: { score: 3, reasoning: "Manual assessment required" },
        risk_score: 9,
        mitigation_strategies: [
          { timeframe: "immediate", strategy: "Manual evaluation needed", description: "Please assess this risk manually" }
        ],
        recommendations: { priority: "medium", next_steps: "Conduct manual assessment" }
      }
    }, 500)
  }
})

// Enhanced risk creation with AI pre-population
app.post('/api/t/:tenantHash/risks/create-with-ai', async (c) => {
  const tenant = c.get('tenant')

  try {
    const { title, description, risk_category, ai_assessment } = await c.req.json()

    const riskId = crypto.randomUUID()
    const riskCode = `RISK-${String(Date.now()).slice(-6)}`

    // Calculate risk score from AI assessment
    const likelihood = ai_assessment?.likelihood?.score || 3
    const impact = ai_assessment?.impact?.score || 3
    const inherentRiskScore = likelihood * impact

    // Create risk with AI-enhanced data
    await c.env.DB.prepare(`
      INSERT INTO risks (
        id, tenant_id, risk_code, title, description, risk_category,
        likelihood, impact, inherent_risk_score,
        threat_description, vulnerability_description, business_impact_description,
        review_frequency, next_review_date, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      riskId,
      tenant.id,
      riskCode,
      title,
      description,
      risk_category,
      likelihood,
      impact,
      inherentRiskScore,
      ai_assessment?.threat_sources?.join(', ') || '',
      ai_assessment?.vulnerabilities?.join(', ') || '',
      ai_assessment?.business_impacts?.financial || '',
      ai_assessment?.review_frequency || 'quarterly',
      new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 90 days from now
      'open'
    ).run()

    return c.json({
      success: true,
      message: 'Risk created with AI assessment',
      risk_id: riskId,
      risk_code: riskCode,
      ai_enhanced: true
    })

  } catch (error) {
    console.error('AI-enhanced risk creation error:', error)
    return c.json({ error: 'Failed to create risk with AI assessment' }, 500)
  }
})

export default app
