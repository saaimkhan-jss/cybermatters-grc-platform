import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { sign, verify } from 'hono/jwt'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

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

export default app
