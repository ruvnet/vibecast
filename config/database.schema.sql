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

-- ============================================================================
-- AI-NATIVE PLATFORM TABLES
-- ============================================================================

-- Agent Specifications: Stores generated agent specifications
CREATE TABLE IF NOT EXISTS agent_specifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  specification JSONB NOT NULL,     -- Complete agent spec
  template_id VARCHAR(100),         -- Template used (if any)
  created_by VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  version VARCHAR(20) DEFAULT '1.0.0',
  metadata JSONB DEFAULT '{}'::JSONB
);

CREATE INDEX idx_agent_specs_name ON agent_specifications(name);
CREATE INDEX idx_agent_specs_template ON agent_specifications(template_id);
CREATE INDEX idx_agent_specs_created_at ON agent_specifications(created_at DESC);

-- Workflows: Stores workflow definitions
CREATE TABLE IF NOT EXISTS workflows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  definition JSONB NOT NULL,        -- Compiled workflow definition
  source_file TEXT,                 -- Original YAML/JSON file
  compiled_at TIMESTAMPTZ DEFAULT NOW(),
  compiled_by VARCHAR(255),
  active BOOLEAN DEFAULT true,
  version VARCHAR(20) DEFAULT '1.0.0',
  metadata JSONB DEFAULT '{}'::JSONB
);

CREATE INDEX idx_workflows_name ON workflows(name);
CREATE INDEX idx_workflows_active ON workflows(active);
CREATE INDEX idx_workflows_compiled_at ON workflows(compiled_at DESC);

-- Workflow Executions: Stores workflow execution history
CREATE TABLE IF NOT EXISTS workflow_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_name VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL,      -- 'running', 'completed', 'failed'
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration INTEGER,                 -- Duration in milliseconds
  context JSONB DEFAULT '{}'::JSONB, -- Execution context
  result JSONB,                     -- Final result
  error TEXT,                       -- Error message if failed
  metadata JSONB DEFAULT '{}'::JSONB
);

CREATE INDEX idx_workflow_executions_workflow ON workflow_executions(workflow_name);
CREATE INDEX idx_workflow_executions_status ON workflow_executions(status);
CREATE INDEX idx_workflow_executions_started ON workflow_executions(started_at DESC);

-- ============================================================================
-- VIEWS FOR AI-NATIVE PLATFORM
-- ============================================================================

-- View: Agent creation metrics
CREATE OR REPLACE VIEW agent_creation_metrics AS
SELECT
  DATE(created_at) as date,
  COUNT(*) as agents_created,
  COUNT(DISTINCT created_by) as unique_creators,
  COUNT(DISTINCT template_id) as templates_used
FROM agent_specifications
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- View: Workflow execution summary
CREATE OR REPLACE VIEW workflow_execution_summary AS
SELECT
  workflow_name,
  COUNT(*) as total_executions,
  SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful,
  SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
  AVG(duration) as avg_duration_ms,
  MAX(started_at) as last_execution
FROM workflow_executions
GROUP BY workflow_name
ORDER BY total_executions DESC;

-- View: Platform productivity metrics
CREATE OR REPLACE VIEW platform_productivity AS
SELECT
  COUNT(DISTINCT a.name) as total_agents,
  COUNT(DISTINCT w.name) as total_workflows,
  COUNT(DISTINCT we.id) as total_executions,
  COUNT(DISTINCT a.created_by) as unique_developers,
  AVG(we.duration) as avg_workflow_duration,
  SUM(CASE WHEN we.status = 'completed' THEN 1 ELSE 0 END)::FLOAT / NULLIF(COUNT(we.id), 0) * 100 as success_rate
FROM agent_specifications a
CROSS JOIN workflows w
CROSS JOIN workflow_executions we;

-- ============================================================================
-- FUNCTIONS FOR AI-NATIVE PLATFORM
-- ============================================================================

-- Function: Get agent specification by name
CREATE OR REPLACE FUNCTION get_agent_specification(
  agent_name VARCHAR
)
RETURNS JSONB AS $$
BEGIN
  RETURN (
    SELECT specification
    FROM agent_specifications
    WHERE name = agent_name
    AND active = true
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql;

-- Function: Get workflow execution history
CREATE OR REPLACE FUNCTION get_workflow_history(
  workflow_name_param VARCHAR,
  limit_param INTEGER DEFAULT 10
)
RETURNS TABLE(
  execution_id UUID,
  status VARCHAR,
  started_at TIMESTAMPTZ,
  duration INTEGER,
  error TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    id as execution_id,
    status,
    started_at,
    duration,
    error
  FROM workflow_executions
  WHERE workflow_name = workflow_name_param
  ORDER BY started_at DESC
  LIMIT limit_param;
END;
$$ LANGUAGE plpgsql;

-- Function: Calculate platform ROI
CREATE OR REPLACE FUNCTION calculate_platform_roi(
  start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days'
)
RETURNS TABLE(
  agents_created BIGINT,
  workflows_created BIGINT,
  executions_completed BIGINT,
  avg_execution_time_ms DECIMAL,
  estimated_time_saved_hours DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(DISTINCT a.id)::BIGINT as agents_created,
    COUNT(DISTINCT w.id)::BIGINT as workflows_created,
    COUNT(DISTINCT we.id)::BIGINT as executions_completed,
    AVG(we.duration)::DECIMAL as avg_execution_time_ms,
    -- Estimate: Each agent saves 2 hours of dev time, each workflow saves 4 hours
    (COUNT(DISTINCT a.id) * 2 + COUNT(DISTINCT w.id) * 4)::DECIMAL as estimated_time_saved_hours
  FROM agent_specifications a
  CROSS JOIN workflows w
  CROSS JOIN workflow_executions we
  WHERE a.created_at >= start_date;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SOTA ENTERPRISE TABLES (Router 2.0, Policies, Observability, Privacy)
-- ============================================================================

-- Router State: Thompson Sampling bandit state
CREATE TABLE IF NOT EXISTS router_state (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bandits JSONB NOT NULL,
  daily_spend DECIMAL(10,2) DEFAULT 0,
  last_reset_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Router Decisions: Routing decision log
CREATE TABLE IF NOT EXISTS router_decisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lane VARCHAR(50) NOT NULL,
  cost DECIMAL(10,4),
  features JSONB,
  reasoning TEXT,
  context_id VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_router_decisions_lane ON router_decisions(lane);
CREATE INDEX idx_router_decisions_created ON router_decisions(created_at DESC);

-- Router Feedback: Success/failure feedback for learning
CREATE TABLE IF NOT EXISTS router_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  decision_id UUID REFERENCES router_decisions(id),
  lane VARCHAR(50),
  success BOOLEAN,
  metrics JSONB,
  bandit_state JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rule Proposals: Auto-generated rule proposals from reflexion
CREATE TABLE IF NOT EXISTS rule_proposals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pattern_id VARCHAR(50),
  rule_spec JSONB NOT NULL,
  rationale TEXT,
  expected_impact JSONB,
  confidence DECIMAL(3,2),
  tests_passed BOOLEAN,
  test_results JSONB,
  status VARCHAR(50),
  approved_by VARCHAR(255),
  approved_at TIMESTAMPTZ,
  rejected_by VARCHAR(255),
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  deployed_rule_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rule_proposals_status ON rule_proposals(status);

-- Verifiable Log Trees: Sealed Merkle trees
CREATE TABLE IF NOT EXISTS verifiable_log_trees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sequence INTEGER NOT NULL UNIQUE,
  root_hash VARCHAR(64) NOT NULL,
  size INTEGER NOT NULL,
  sealed_at TIMESTAMPTZ,
  status VARCHAR(50)
);

-- Verifiable Log Entries: Individual log entries with proofs
CREATE TABLE IF NOT EXISTS verifiable_log_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tree_sequence INTEGER,
  leaf_index INTEGER NOT NULL,
  leaf_hash VARCHAR(64) NOT NULL,
  entry_data JSONB NOT NULL,
  tree_root VARCHAR(64),
  inclusion_proof JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_verifiable_entries_tree ON verifiable_log_entries(tree_sequence, leaf_index);

-- Verifiable Log State: Current tree state
CREATE TABLE IF NOT EXISTS verifiable_log_state (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tree_sequence INTEGER,
  tree_size INTEGER,
  root_hash VARCHAR(64),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Signed Tree Heads: STH for transparency
CREATE TABLE IF NOT EXISTS signed_tree_heads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tree_sequence INTEGER,
  root_hash VARCHAR(64),
  tree_size INTEGER,
  timestamp TIMESTAMPTZ,
  signature TEXT,
  signature_algorithm VARCHAR(50)
);

-- Policies: Policy-as-code definitions
CREATE TABLE IF NOT EXISTS policies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  policy_type VARCHAR(50) NOT NULL,  -- 'routing', 'egress'
  rules JSONB NOT NULL,
  priority INTEGER DEFAULT 100,
  active BOOLEAN DEFAULT true,
  version VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_policies_type ON policies(policy_type);
CREATE INDEX idx_policies_active ON policies(active);

-- Policy Decisions: Policy evaluation log
CREATE TABLE IF NOT EXISTS policy_decisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  policy_type VARCHAR(50),
  allowed BOOLEAN,
  denied_by VARCHAR(255),
  reasoning JSONB,
  context_id VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_policy_decisions_type ON policy_decisions(policy_type);
CREATE INDEX idx_policy_decisions_allowed ON policy_decisions(allowed);

-- Telemetry Traces: OpenTelemetry-style traces
CREATE TABLE IF NOT EXISTS telemetry_traces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  span_id VARCHAR(255),
  trace_id VARCHAR(255),
  name VARCHAR(255),
  start_time BIGINT,
  end_time BIGINT,
  duration INTEGER,
  status VARCHAR(50),
  attributes JSONB,
  events JSONB
);

CREATE INDEX idx_telemetry_traces_name ON telemetry_traces(name);
CREATE INDEX idx_telemetry_traces_start ON telemetry_traces(start_time DESC);

-- Telemetry Metrics: OpenTelemetry-style metrics
CREATE TABLE IF NOT EXISTS telemetry_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255),
  value DECIMAL(15,4),
  unit VARCHAR(50),
  timestamp BIGINT,
  attributes JSONB
);

CREATE INDEX idx_telemetry_metrics_name ON telemetry_metrics(name);
CREATE INDEX idx_telemetry_metrics_timestamp ON telemetry_metrics(timestamp DESC);

-- Redaction Log: PII redaction events
CREATE TABLE IF NOT EXISTS redaction_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  redactions INTEGER,
  types JSONB,
  confidence DECIMAL(3,2),
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_redaction_log_timestamp ON redaction_log(timestamp DESC);

-- Grant appropriate permissions (adjust based on your setup)
-- GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO authenticated;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
