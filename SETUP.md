# Setup Guide - Agentic Data Entry Automation

Complete setup instructions for the Agentic Data Entry System.

---

## Prerequisites

### Required

1. **Node.js** >= 18.0.0
   ```bash
   node --version  # Should be v18 or higher
   ```

2. **Supabase Account** (Free tier works)
   - Sign up at: https://supabase.com
   - Create a new project
   - Note your project URL and keys

3. **Anthropic API Key**
   - Sign up at: https://console.anthropic.com
   - Create an API key
   - Free tier available with $5 credit

### Optional

4. **OpenRouter Account** (for multi-model routing)
   - Sign up at: https://openrouter.ai
   - Create an API key

---

## Step 1: Clone and Install

```bash
# Clone repository
git clone https://github.com/ruvnet/vibecast.git
cd vibecast

# Checkout the agentic data entry branch
git checkout claude/agentic-data-entry-automation-011CUoy2taW1UFBWxR8pyr3m

# Install dependencies
npm install
```

---

## Step 2: Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your credentials
nano .env  # or use your preferred editor
```

### Required Configuration

Edit `.env` and add:

```env
# Anthropic API Configuration
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxx

# AgentDB Configuration (from Supabase)
AGENTDB_URL=https://your-project-id.supabase.co
AGENTDB_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxxx
AGENTDB_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxxx
```

### Get Supabase Credentials

1. Go to your Supabase project dashboard
2. Click "Settings" (gear icon) → "API"
3. Copy:
   - **Project URL** → `AGENTDB_URL`
   - **anon/public key** → `AGENTDB_KEY`
   - **service_role key** → `AGENTDB_SERVICE_KEY` (keep secret!)

### Get Anthropic API Key

1. Go to https://console.anthropic.com
2. Click "API Keys"
3. Create a new key
4. Copy to `ANTHROPIC_API_KEY`

### Optional Configuration

```env
# OpenRouter (for model routing)
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxx

# Flow-Nexus (if using external instance)
FLOW_NEXUS_ENDPOINT=http://localhost:3000
FLOW_NEXUS_API_KEY=your-flow-nexus-key

# Security
ENABLE_ENCRYPTION=true
ENCRYPTION_KEY=your-random-32-byte-key-generate-this
ENABLE_LEAN_PROOFS=true

# Application
NODE_ENV=development
PORT=3001
LOG_LEVEL=info
```

---

## Step 3: Initialize Database

### Option A: Automatic Setup

```bash
npm run setup
```

This will:
- Connect to your Supabase database
- Create all required tables
- Set up indexes and functions
- Insert default rules
- Verify installation

### Option B: Manual Setup

If automatic setup fails, you can manually run the SQL:

1. Go to Supabase dashboard → SQL Editor
2. Copy contents of `config/database.schema.sql`
3. Paste and execute in SQL Editor
4. Verify tables were created in Table Editor

### Verify Database

Check that these tables exist:
- `rules`
- `records`
- `exceptions`
- `agent_memory`
- `audit_trail`
- `cryptographic_proofs`
- `processing_metrics`

---

## Step 4: Test Installation

### Run Example

```bash
npm start example
```

This will:
1. Process 5 sample records
2. Some will pass validation
3. Some will fail and create exceptions
4. Display metrics dashboard

Expected output:
```
🎯 Agentic Data Entry Automation System
   Example: Processing Sample Data

🚀 Processing batch of 5 records...

✅ Record 1 processed successfully
❌ Record 2 failed: validation error
...

📊 Batch Processing Summary
Total Records: 5
Successful: 3
Failed: 2
```

### View Metrics

```bash
npm run metrics
```

Expected output:
```
📊 AGENTIC DATA ENTRY SYSTEM - METRICS DASHBOARD

📈 Processing Metrics:
  Total Records: 5
  Valid: 3 (60%)
  Invalid: 2
  Avg Latency: 245ms

⚠️  Exception Metrics:
  Exception Rate: 40%
  Automation Rate: 60%
```

### Review Exceptions

```bash
npm run review
```

Interactive interface:
1. Shows pending exceptions
2. Displays validation errors
3. Allows approve/reject/modify
4. Creates audit trail

---

## Step 5: Verify Components

### Test AgentDB Connection

```bash
node -e "import('./src/db/agentdb.js').then(m => m.connectAgentDB().query('rules').then(r => console.log('✅ AgentDB connected:', r.length, 'rules')))"
```

### Test Claude Agent

```bash
node -e "import('./src/agents/ClaudeAgent.js').then(m => new m.ClaudeAgent({name: 'Test'}).run('Say hello').then(r => console.log('✅ Claude connected:', r.text)))"
```

### Test Cryptographic Proofs

```bash
node -e "import('./src/utils/proofs.js').then(m => console.log('✅ Proof hash:', m.generateHash({test: 'data'})))"
```

---

## Step 6: Configure Rules (Optional)

### View Default Rules

```sql
-- In Supabase SQL Editor
SELECT name, rule_type, condition, action
FROM rules
WHERE active = true
ORDER BY priority DESC;
```

### Add Custom Validation Rule

```sql
INSERT INTO rules (name, description, rule_type, condition, action, priority)
VALUES (
  'Minimum Amount',
  'Ensures amount is at least $10',
  'validation',
  '{"field": "amount", "operator": "gte", "value": 10}',
  '{"type": "reject", "message": "Amount must be at least $10"}',
  90
);
```

### Add Custom Enrichment Rule

```sql
INSERT INTO rules (name, description, rule_type, condition, action, priority)
VALUES (
  'Add Processing Date',
  'Adds current date to records',
  'enrichment',
  '{"always": true}',
  '{"type": "add_field", "field": "process_date", "value": "NOW()"}',
  40
);
```

---

## Step 7: Production Configuration

### Security Checklist

- [ ] Use strong `ENCRYPTION_KEY` (32+ random bytes)
- [ ] Keep `AGENTDB_SERVICE_KEY` secret (never commit to git)
- [ ] Use environment-specific `.env` files
- [ ] Enable `ENABLE_ENCRYPTION=true`
- [ ] Enable `ENABLE_LEAN_PROOFS=true`
- [ ] Set `NODE_ENV=production`
- [ ] Configure rate limits in Supabase
- [ ] Set up database backups
- [ ] Enable Supabase row-level security (RLS)

### Performance Tuning

**Database Indexes** (already included in schema):
```sql
CREATE INDEX idx_records_status ON records(status);
CREATE INDEX idx_exceptions_reviewed ON exceptions(reviewed);
CREATE INDEX idx_audit_trail_timestamp ON audit_trail(timestamp DESC);
```

**Agentic-Flow Configuration**:

Edit `config/agentic-flow.policy.yaml`:

```yaml
# For high volume
rate_limits:
  requests_per_minute: 100
  requests_per_hour: 5000
  max_concurrent: 20

# For cost optimization
lanes:
  economy:
    order: [onnx_local, openrouter, anthropic]
    price_cap: 0.01  # Lower cap
```

### Monitoring

Set up monitoring for:
- Exception rate (should be < 20%)
- Average latency (should be < 500ms)
- Database query performance
- API costs
- Proof verification failures

---

## Troubleshooting

### Database Connection Fails

```bash
# Check Supabase credentials
echo $AGENTDB_URL
echo $AGENTDB_KEY

# Test connection
curl $AGENTDB_URL/rest/v1/ \
  -H "apikey: $AGENTDB_KEY"
```

### Claude API Fails

```bash
# Test API key
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-3-5-haiku-20241022","max_tokens":10,"messages":[{"role":"user","content":"Hi"}]}'
```

### Setup Script Fails

Try manual SQL execution:
1. Copy `config/database.schema.sql`
2. Go to Supabase → SQL Editor
3. Paste and run
4. Check error messages

### Import Errors

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Verify Node version
node --version  # Should be v18+
```

---

## Next Steps

1. **Customize Rules**: Add domain-specific validation/enrichment rules
2. **Integrate Data Source**: Connect to your actual data source (API, CSV, database)
3. **Set Up Monitoring**: Track metrics and exception rates
4. **Train Operators**: Familiarize team with exception review interface
5. **Scale Up**: Increase rate limits and add multiple agent instances

---

## Support

If you encounter issues:

1. Check logs: `npm start example 2>&1 | tee debug.log`
2. Verify environment: `npm run verify` (if implemented)
3. Check Supabase logs in dashboard
4. Review Claude API usage in Anthropic console

For help:
- Open an issue on GitHub
- Join the Vibecast community
- Check the main README.md

---

## Architecture Notes

### Data Flow

```
Input → Claude Agent → Validate (rules from DB)
  ↓
Valid? → Yes → Enrich → Store → Audit Trail → Done
  ↓
No → Create Exception → Human Review → Resolution
```

### Database Design

- **Normalized schema** for efficient queries
- **JSONB fields** for flexible rule storage
- **Indexes** on status and timestamp fields
- **Views** for common queries (pending_exceptions, metrics_summary)
- **Functions** for complex calculations

### Security Model

- **Row-Level Security** (RLS) in Supabase
- **Service key** for backend only
- **Anon key** for client operations (if needed)
- **Encryption** at rest and in transit
- **Audit trail** for all changes
- **Cryptographic proofs** for tamper detection

---

**Setup complete! 🎉**

You're now ready to automate data entry with human-in-loop exception handling.
