-- AgentDB Schema for Agentic Data Entry System
-- Designed for Supabase/PostgreSQL with reflexion and audit trail support

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Rules table: Stores active validation and enrichment rules
CREATE TABLE IF NOT EXISTS rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  rule_type VARCHAR(50) NOT NULL, -- 'validation', 'enrichment', 'transformation'
  condition JSONB NOT NULL,        -- Rule condition as JSON
  action JSONB NOT NULL,           -- Action to take as JSON
  priority INTEGER DEFAULT 0,      -- Execution priority (higher = first)
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by VARCHAR(255),
  metadata JSONB DEFAULT '{}'::JSONB
);

CREATE INDEX idx_rules_active ON rules(active);
CREATE INDEX idx_rules_type ON rules(rule_type);
CREATE INDEX idx_rules_priority ON rules(priority DESC);

-- Records table: Stores processed data entries
CREATE TABLE IF NOT EXISTS records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  external_id VARCHAR(255) UNIQUE,  -- External reference ID
  data JSONB NOT NULL,               -- The actual record data
  status VARCHAR(50) NOT NULL,       -- 'pending', 'valid', 'invalid', 'processing'
  valid BOOLEAN,                     -- Validation result
  enriched BOOLEAN DEFAULT false,    -- Whether data has been enriched
  process_time INTEGER,              -- Processing time in milliseconds
  rules_applied JSONB DEFAULT '[]'::JSONB, -- Array of rule IDs applied
  validation_errors JSONB DEFAULT '[]'::JSONB, -- Validation error details
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::JSONB
);

CREATE INDEX idx_records_status ON records(status);
CREATE INDEX idx_records_valid ON records(valid);
CREATE INDEX idx_records_external_id ON records(external_id);
CREATE INDEX idx_records_created_at ON records(created_at DESC);

-- Exceptions table: Stores records that failed validation for human review
CREATE TABLE IF NOT EXISTS exceptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  record_id UUID REFERENCES records(id) ON DELETE CASCADE,
  exception_type VARCHAR(100) NOT NULL, -- 'validation_failed', 'enrichment_failed', etc.
  error_message TEXT,
  error_details JSONB DEFAULT '{}'::JSONB,
  severity VARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
  reviewed BOOLEAN DEFAULT false,
  reviewed_by VARCHAR(255),
  reviewed_at TIMESTAMPTZ,
  resolution TEXT,
  resolution_action VARCHAR(50), -- 'approved', 'rejected', 'modified', 'reprocessed'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::JSONB
);

CREATE INDEX idx_exceptions_reviewed ON exceptions(reviewed);
CREATE INDEX idx_exceptions_record_id ON exceptions(record_id);
CREATE INDEX idx_exceptions_severity ON exceptions(severity);
CREATE INDEX idx_exceptions_created_at ON exceptions(created_at DESC);

-- ============================================================================
-- REFLEXION AND MEMORY TABLES
-- ============================================================================

-- Agent Memory: Stores agent learning and reflexion data
CREATE TABLE IF NOT EXISTS agent_memory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_name VARCHAR(255) NOT NULL,
  memory_type VARCHAR(50) NOT NULL, -- 'reflection', 'learning', 'pattern', 'failure'
  content TEXT NOT NULL,
  context JSONB DEFAULT '{}'::JSONB,
  confidence_score DECIMAL(3,2), -- 0.00 to 1.00
  usage_count INTEGER DEFAULT 0,
  successful_applications INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::JSONB
);

CREATE INDEX idx_agent_memory_name ON agent_memory(agent_name);
CREATE INDEX idx_agent_memory_type ON agent_memory(memory_type);
CREATE INDEX idx_agent_memory_confidence ON agent_memory(confidence_score DESC);

-- ============================================================================
-- AUDIT AND PROVENANCE TABLES
-- ============================================================================

-- Audit Trail: Complete audit log with cryptographic proofs
CREATE TABLE IF NOT EXISTS audit_trail (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type VARCHAR(100) NOT NULL, -- 'record_created', 'record_validated', etc.
  entity_type VARCHAR(50) NOT NULL, -- 'record', 'exception', 'rule'
  entity_id UUID NOT NULL,
  actor VARCHAR(255) NOT NULL,      -- User or agent identifier
  action VARCHAR(100) NOT NULL,     -- Action performed
  before_state JSONB,               -- State before action
  after_state JSONB,                -- State after action
  changes JSONB,                    -- Specific changes made
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT,
  session_id VARCHAR(255),
  metadata JSONB DEFAULT '{}'::JSONB
);

CREATE INDEX idx_audit_trail_entity ON audit_trail(entity_type, entity_id);
CREATE INDEX idx_audit_trail_timestamp ON audit_trail(timestamp DESC);
CREATE INDEX idx_audit_trail_actor ON audit_trail(actor);
CREATE INDEX idx_audit_trail_event_type ON audit_trail(event_type);

-- Cryptographic Proofs: Lean-Agentic proof storage
CREATE TABLE IF NOT EXISTS cryptographic_proofs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  audit_trail_id UUID REFERENCES audit_trail(id) ON DELETE CASCADE,
  proof_type VARCHAR(50) NOT NULL, -- 'lean_proof', 'merkle_tree', 'signature'
  proof_data JSONB NOT NULL,       -- The actual proof
  hash VARCHAR(64) NOT NULL,       -- SHA-256 hash of the event
  previous_hash VARCHAR(64),       -- Previous block hash (blockchain-style)
  signature TEXT,                  -- Cryptographic signature
  verified BOOLEAN DEFAULT false,
  verification_timestamp TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::JSONB
);

CREATE INDEX idx_crypto_proofs_audit ON cryptographic_proofs(audit_trail_id);
CREATE INDEX idx_crypto_proofs_hash ON cryptographic_proofs(hash);
CREATE INDEX idx_crypto_proofs_verified ON cryptographic_proofs(verified);

-- ============================================================================
-- METRICS AND ANALYTICS TABLES
-- ============================================================================

-- Processing Metrics: Track performance and ROI metrics
CREATE TABLE IF NOT EXISTS processing_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  metric_type VARCHAR(100) NOT NULL, -- 'cycle_time', 'exception_rate', 'cost', etc.
  metric_value DECIMAL(15,4) NOT NULL,
  metric_unit VARCHAR(50),           -- 'ms', 'usd', 'count', 'percentage'
  dimension JSONB DEFAULT '{}'::JSONB, -- Dimensional attributes
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  aggregation_period VARCHAR(20),    -- 'minute', 'hour', 'day', 'week', 'month'
  metadata JSONB DEFAULT '{}'::JSONB
);

CREATE INDEX idx_metrics_type ON processing_metrics(metric_type);
CREATE INDEX idx_metrics_timestamp ON processing_metrics(timestamp DESC);
CREATE INDEX idx_metrics_aggregation ON processing_metrics(aggregation_period);

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- View: Pending exceptions for human review
CREATE OR REPLACE VIEW pending_exceptions AS
SELECT
  e.id,
  e.record_id,
  e.exception_type,
  e.error_message,
  e.severity,
  e.created_at,
  r.data as record_data,
  r.validation_errors
FROM exceptions e
JOIN records r ON e.record_id = r.id
WHERE e.reviewed = false
ORDER BY e.severity DESC, e.created_at ASC;

-- View: Processing metrics summary
CREATE OR REPLACE VIEW metrics_summary AS
SELECT
  COUNT(*) as total_records,
  SUM(CASE WHEN valid = true THEN 1 ELSE 0 END) as valid_records,
  SUM(CASE WHEN valid = false THEN 1 ELSE 0 END) as invalid_records,
  AVG(process_time) as avg_latency_ms,
  MIN(process_time) as min_latency_ms,
  MAX(process_time) as max_latency_ms,
  COUNT(DISTINCT DATE(created_at)) as days_active
FROM records
WHERE processed_at IS NOT NULL;

-- View: Exception rate by type
CREATE OR REPLACE VIEW exception_rates AS
SELECT
  exception_type,
  COUNT(*) as count,
  AVG(CASE WHEN reviewed THEN 1 ELSE 0 END) * 100 as review_rate_percent,
  COUNT(*) * 100.0 / (SELECT COUNT(*) FROM exceptions) as percentage_of_total
FROM exceptions
GROUP BY exception_type
ORDER BY count DESC;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function: Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_rules_updated_at BEFORE UPDATE ON rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_records_updated_at BEFORE UPDATE ON records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function: Calculate exception rate
CREATE OR REPLACE FUNCTION calculate_exception_rate(
  start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '24 hours',
  end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE(
  total_records BIGINT,
  total_exceptions BIGINT,
  exception_rate DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(DISTINCT r.id)::BIGINT as total_records,
    COUNT(DISTINCT e.id)::BIGINT as total_exceptions,
    (COUNT(DISTINCT e.id)::DECIMAL / NULLIF(COUNT(DISTINCT r.id), 0) * 100) as exception_rate
  FROM records r
  LEFT JOIN exceptions e ON r.id = e.record_id
  WHERE r.created_at BETWEEN start_date AND end_date;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SEED DATA
-- ============================================================================

-- Insert default validation rules
INSERT INTO rules (name, description, rule_type, condition, action, priority) VALUES
  (
    'Positive Amount Validation',
    'Ensures amount field is positive',
    'validation',
    '{"field": "amount", "operator": "gt", "value": 0}'::JSONB,
    '{"type": "reject", "message": "Amount must be positive"}'::JSONB,
    100
  ),
  (
    'Email Format Validation',
    'Validates email format',
    'validation',
    '{"field": "email", "operator": "regex", "value": "^[^@]+@[^@]+\\.[^@]+$"}'::JSONB,
    '{"type": "reject", "message": "Invalid email format"}'::JSONB,
    100
  ),
  (
    'Timestamp Enrichment',
    'Adds processing timestamp',
    'enrichment',
    '{"always": true}'::JSONB,
    '{"type": "add_field", "field": "processed_timestamp", "value": "NOW()"}'::JSONB,
    50
  ),
  (
    'Status Classification',
    'Classifies records by amount',
    'enrichment',
    '{"field": "amount", "operator": "exists"}'::JSONB,
    '{"type": "add_field", "field": "category", "value": "COMPUTE_CATEGORY"}'::JSONB,
    40
  );

-- Grant appropriate permissions (adjust based on your setup)
-- GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO authenticated;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
