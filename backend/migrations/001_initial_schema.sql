-- Core tenant management
CREATE TABLE tenants (
  id TEXT PRIMARY KEY,
  hash TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  domain TEXT,
  settings JSON DEFAULT '{}',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tenant users
CREATE TABLE tenant_users (
  id TEXT PRIMARY KEY,
  tenant_id TEXT REFERENCES tenants(id),
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'user',
  first_name TEXT,
  last_name TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, email)
);

-- Universal frameworks
CREATE TABLE frameworks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  framework_type TEXT NOT NULL,
  category TEXT NOT NULL,
  issuing_body TEXT,
  standard_number TEXT,
  certification_available BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Framework controls
CREATE TABLE framework_controls (
  id TEXT PRIMARY KEY,
  framework_id TEXT REFERENCES frameworks(id),
  control_reference TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  control_type TEXT DEFAULT 'policy',
  frequency TEXT DEFAULT 'annually',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tenant framework subscriptions
CREATE TABLE tenant_frameworks (
  tenant_id TEXT REFERENCES tenants(id),
  framework_id TEXT REFERENCES frameworks(id),
  enabled BOOLEAN DEFAULT true,
  enabled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tenant_id, framework_id)
);

-- Risk register
CREATE TABLE risks (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  title TEXT NOT NULL,
  description TEXT,
  risk_category TEXT,
  likelihood INTEGER CHECK (likelihood BETWEEN 1 AND 5),
  impact INTEGER CHECK (impact BETWEEN 1 AND 5),
  inherent_risk_score REAL,
  status TEXT DEFAULT 'open',
  owner TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Sample frameworks
INSERT INTO frameworks (id, name, description, framework_type, category, issuing_body, standard_number, certification_available) VALUES
('iso-14001', 'ISO 14001:2015', 'Environmental Management Systems', 'iso', 'environmental', 'ISO', 'ISO 14001', true),
('iso-45001', 'ISO 45001:2018', 'Occupational Health and Safety Management Systems', 'iso', 'safety', 'ISO', 'ISO 45001', true),
('iso-9001', 'ISO 9001:2015', 'Quality Management Systems', 'iso', 'quality', 'ISO', 'ISO 9001', true),
('iso-27001', 'ISO 27001:2022', 'Information Security Management Systems', 'iso', 'security', 'ISO', 'ISO 27001', true);

-- Sample controls for ISO 14001
INSERT INTO framework_controls (id, framework_id, control_reference, title, description) VALUES
('iso14001-4.1', 'iso-14001', '4.1', 'Understanding the organization and its context', 'The organization shall determine external and internal issues'),
('iso14001-4.2', 'iso-14001', '4.2', 'Understanding the needs and expectations of interested parties', 'The organization shall determine interested parties');

-- Create indexes
CREATE INDEX idx_tenant_hash ON tenants(hash);
CREATE INDEX idx_tenant_users ON tenant_users(tenant_id, email);
CREATE INDEX idx_risks_tenant ON risks(tenant_id);
