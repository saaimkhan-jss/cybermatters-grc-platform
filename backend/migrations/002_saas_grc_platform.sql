-- ===============================================
-- MULTI-TIER SAAS GRC PLATFORM MIGRATION (FIXED)
-- ===============================================

-- ===============================================
-- GLOBAL ADMIN SYSTEM
-- ===============================================

-- Global Admin Users (separate from tenant users)
CREATE TABLE global_admins (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  role TEXT NOT NULL DEFAULT 'sub_admin', -- 'master_admin', 'sub_admin'
  is_active BOOLEAN DEFAULT true,
  last_login DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tenant Subscription Limits
CREATE TABLE tenant_limits (
  id TEXT PRIMARY KEY,
  tenant_id TEXT UNIQUE REFERENCES tenants(id),
  max_frameworks INTEGER DEFAULT 3,
  max_users INTEGER DEFAULT 10,
  max_assets INTEGER DEFAULT 100,
  max_risks INTEGER DEFAULT 50,
  tier_name TEXT DEFAULT 'starter', -- starter, professional, enterprise
  notes TEXT,
  set_by_admin_id TEXT REFERENCES global_admins(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Global Admin Access Log (audit trail for tenant access)
CREATE TABLE global_admin_access_log (
  id TEXT PRIMARY KEY,
  admin_id TEXT REFERENCES global_admins(id),
  tenant_id TEXT REFERENCES tenants(id),
  access_type TEXT, -- login, view, create, update, delete
  resource_type TEXT, -- dashboard, risks, frameworks, users, etc.
  resource_id TEXT, -- specific ID of accessed resource
  action_description TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ===============================================
-- ENHANCED TENANT USER MANAGEMENT
-- ===============================================

-- Add new columns to existing tenant_users table (skip role as it exists)
ALTER TABLE tenant_users ADD COLUMN department TEXT;
ALTER TABLE tenant_users ADD COLUMN job_title TEXT;
ALTER TABLE tenant_users ADD COLUMN phone TEXT;
ALTER TABLE tenant_users ADD COLUMN is_active BOOLEAN DEFAULT true;
ALTER TABLE tenant_users ADD COLUMN last_login DATETIME;

-- ===============================================
-- ENHANCED FRAMEWORK SYSTEM
-- ===============================================

-- Add new columns to existing frameworks table
ALTER TABLE frameworks ADD COLUMN created_by_admin_id TEXT REFERENCES global_admins(id);
ALTER TABLE frameworks ADD COLUMN updated_by_admin_id TEXT REFERENCES global_admins(id);
ALTER TABLE frameworks ADD COLUMN version TEXT DEFAULT '1.0';
ALTER TABLE frameworks ADD COLUMN change_log TEXT;
ALTER TABLE frameworks ADD COLUMN is_premium BOOLEAN DEFAULT false;
ALTER TABLE frameworks ADD COLUMN sort_order INTEGER DEFAULT 0;

-- Pre-built Controls Templates (global controls for frameworks)
CREATE TABLE framework_control_templates (
  id TEXT PRIMARY KEY,
  framework_id TEXT REFERENCES frameworks(id),
  control_reference TEXT NOT NULL,
  parent_control_id TEXT REFERENCES framework_control_templates(id),
  level INTEGER DEFAULT 1,
  title TEXT NOT NULL,
  description TEXT,
  requirements TEXT,
  guidance TEXT,
  implementation_template TEXT, -- pre-filled template
  evidence_template TEXT, -- template for evidence collection
  control_type TEXT DEFAULT 'policy',
  control_nature TEXT, -- preventive, detective, corrective
  testing_procedure TEXT,
  frequency TEXT DEFAULT 'annually',
  estimated_effort_hours INTEGER,
  complexity TEXT DEFAULT 'medium', -- low, medium, high
  created_by_admin_id TEXT REFERENCES global_admins(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tenant Control Implementations (local copies that can be customized)
CREATE TABLE tenant_control_implementations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  framework_control_template_id TEXT REFERENCES framework_control_templates(id),
  framework_id TEXT REFERENCES frameworks(id),

  -- Local customizable fields (start with template values)
  local_title TEXT, -- can override template title
  local_description TEXT,
  local_requirements TEXT,
  local_guidance TEXT,
  local_implementation_notes TEXT,
  local_evidence_location TEXT,
  local_testing_procedure TEXT,
  local_frequency TEXT,

  -- Implementation tracking
  implementation_status TEXT DEFAULT 'not_started',
  responsible_person TEXT,
  responsible_department TEXT,
  target_completion_date DATE,
  actual_completion_date DATE,
  effectiveness_rating TEXT,
  last_test_date DATE,
  next_test_date DATE,
  test_results TEXT,

  -- Customization tracking
  is_customized BOOLEAN DEFAULT false,
  customized_fields JSON DEFAULT '[]', -- track which fields were modified
  last_global_sync DATETIME, -- when last synced with template
  needs_sync BOOLEAN DEFAULT false, -- flag when template updates available

  -- Status and metadata
  status TEXT DEFAULT 'active', -- active, inactive, superseded
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Add new columns to existing tenant_frameworks table
ALTER TABLE tenant_frameworks ADD COLUMN subscription_date DATETIME DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE tenant_frameworks ADD COLUMN auto_update BOOLEAN DEFAULT true;
ALTER TABLE tenant_frameworks ADD COLUMN framework_version TEXT;
ALTER TABLE tenant_frameworks ADD COLUMN last_sync_date DATETIME;
ALTER TABLE tenant_frameworks ADD COLUMN subscription_notes TEXT;

-- ===============================================
-- UNIVERSAL ORGANIZATIONAL STRUCTURE
-- ===============================================

-- Business Units/Departments
CREATE TABLE business_units (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  description TEXT,
  parent_unit_id TEXT REFERENCES business_units(id),
  head_of_unit TEXT,
  contact_email TEXT,
  cost_center TEXT,
  disabled INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Business Processes
CREATE TABLE business_processes (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  description TEXT,
  business_unit_id TEXT REFERENCES business_units(id),
  process_owner TEXT,
  criticality TEXT DEFAULT 'medium',
  max_tolerable_outage INTEGER,
  disabled INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ===============================================
-- UNIVERSAL ASSET MANAGEMENT
-- ===============================================

-- Asset Types (no initial data to avoid foreign key issues)
CREATE TABLE asset_types (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  disabled INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Assets
CREATE TABLE assets (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  asset_code TEXT,
  name TEXT NOT NULL,
  description TEXT,
  asset_type_id TEXT REFERENCES asset_types(id),
  owner_id TEXT,
  custodian_id TEXT,
  business_unit_id TEXT REFERENCES business_units(id),
  location TEXT,
  value REAL,
  status TEXT DEFAULT 'active',
  disabled INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ===============================================
-- ENHANCED RISK MANAGEMENT
-- ===============================================

-- Add new columns to existing risks table
ALTER TABLE risks ADD COLUMN risk_code TEXT;
ALTER TABLE risks ADD COLUMN threat_description TEXT;
ALTER TABLE risks ADD COLUMN vulnerability_description TEXT;
ALTER TABLE risks ADD COLUMN business_impact_description TEXT;
ALTER TABLE risks ADD COLUMN financial_impact REAL;
ALTER TABLE risks ADD COLUMN review_frequency TEXT;
ALTER TABLE risks ADD COLUMN next_review_date DATE;

-- Risk-Asset Relationships
CREATE TABLE risk_asset_relationships (
  id TEXT PRIMARY KEY,
  risk_id TEXT REFERENCES risks(id),
  asset_id TEXT REFERENCES assets(id),
  relationship_type TEXT,
  impact_description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ===============================================
-- INCIDENT MANAGEMENT
-- ===============================================

-- Universal Incidents
CREATE TABLE incidents (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  incident_code TEXT UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  incident_type TEXT,
  severity TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'reported',
  reporter_id TEXT,
  assigned_to TEXT,
  root_cause TEXT,
  corrective_actions TEXT,
  open_date DATE NOT NULL,
  resolution_date DATE,
  closure_date DATE,
  disabled INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ===============================================
-- THIRD PARTY MANAGEMENT
-- ===============================================

-- Third Parties
CREATE TABLE third_parties (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  description TEXT,
  party_type TEXT,
  risk_tier TEXT,
  contact_person TEXT,
  contact_email TEXT,
  disabled INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ===============================================
-- EXCEPTION MANAGEMENT
-- ===============================================

-- Universal Exceptions
CREATE TABLE exceptions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  exception_code TEXT,
  title TEXT NOT NULL,
  description TEXT,
  exception_type TEXT,
  business_justification TEXT,
  compensating_controls TEXT,
  requester_id TEXT,
  approver_id TEXT,
  effective_date DATE,
  expiration_date DATE,
  status TEXT DEFAULT 'pending',
  disabled INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ===============================================
-- INDEXES FOR PERFORMANCE
-- ===============================================

CREATE INDEX idx_global_admins_email ON global_admins(email);
CREATE INDEX idx_tenant_limits_tenant ON tenant_limits(tenant_id);
CREATE INDEX idx_access_log_admin ON global_admin_access_log(admin_id);
CREATE INDEX idx_access_log_tenant ON global_admin_access_log(tenant_id);
CREATE INDEX idx_control_templates_framework ON framework_control_templates(framework_id);
CREATE INDEX idx_tenant_controls_tenant ON tenant_control_implementations(tenant_id);
CREATE INDEX idx_tenant_controls_framework ON tenant_control_implementations(framework_id);
CREATE INDEX idx_business_units_tenant ON business_units(tenant_id);
CREATE INDEX idx_assets_tenant ON assets(tenant_id);
CREATE INDEX idx_incidents_tenant ON incidents(tenant_id);
CREATE INDEX idx_third_parties_tenant ON third_parties(tenant_id);
CREATE INDEX idx_exceptions_tenant ON exceptions(tenant_id);

-- ===============================================
-- INITIAL DATA (NO FOREIGN KEY DEPENDENCIES)
-- ===============================================

-- Create master global admin (change password after deployment!)
INSERT INTO global_admins (id, email, password_hash, first_name, last_name, role) VALUES
('master-admin-001', 'admin@cybermatters.io', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBdXwtGtrKG5uy', 'System', 'Administrator', 'master_admin');

-- Note: Asset types will be created per tenant when they register
-- No initial data that requires foreign key references
