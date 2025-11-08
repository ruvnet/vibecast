# AgentDB Quick Reference Card

## 🚀 One-Minute Setup

```bash
# 1. Build
./build.sh

# 2. Test
./test.sh

# 3. Use
npm link agentdb
```

## 💻 Essential Code Snippets

### Initialize
```typescript
import { AgentDB } from 'agentdb';
await AgentDB.init();
const db = new AgentDB();
```

### Create Agent
```typescript
const agent = db.createAgent('Alice', 'manager');
// Returns: { id, name, role, status, ... }
```

### Create Franchise
```typescript
const franchise = db.createFranchise('TechCorp', ownerId, 'NYC');
// Returns: { id, name, owner_id, location, ... }
```

### Assign Agent
```typescript
db.assignAgent(agentId, franchiseId);
```

### Query Agents
```typescript
const agents = db.queryAgents({
  status: 'active',
  role: 'worker',
  franchise_id: 'franchise-123',
  limit: 10,
  offset: 0
});
```

### Get Statistics
```typescript
const stats = db.getStats();
// Returns: { total_agents, total_franchises, total_events, ... }
```

### Export/Import
```typescript
const json = db.export();
localStorage.setItem('backup', json);

const backup = localStorage.getItem('backup');
db.import(backup);
```

## 🎯 Common Patterns

### Singleton
```typescript
let dbInstance: AgentDB | null = null;
export async function getDB() {
  if (!dbInstance) {
    await AgentDB.init();
    dbInstance = new AgentDB();
  }
  return dbInstance;
}
```

### With Persistence
```typescript
class PersistentDB {
  private db: AgentDB;
  constructor() {
    this.db = new AgentDB();
    this.load();
  }
  save() {
    localStorage.setItem('db', this.db.export());
  }
  load() {
    const data = localStorage.getItem('db');
    if (data) this.db.import(data);
  }
}
```

### Connection Pool
```typescript
const pool = new AgentDBPool({ maxInstances: 5 });
await pool.execute(db => {
  return db.createAgent('Alice', 'worker');
});
```

## 📊 API Quick Reference

| Method | Purpose | Returns |
|--------|---------|---------|
| `createAgent(name, role)` | Create new agent | Agent |
| `getAgent(id)` | Get by ID (cached) | Agent |
| `queryAgents(filter)` | Query with filter | Agent[] |
| `deleteAgent(id)` | Delete agent | void |
| `createFranchise(name, owner, loc)` | Create franchise | Franchise |
| `getFranchise(id)` | Get by ID (cached) | Franchise |
| `queryFranchises(filter)` | Query with filter | Franchise[] |
| `deleteFranchise(id)` | Delete franchise | void |
| `assignAgent(aid, fid)` | Assign to franchise | void |
| `unassignAgent(aid)` | Unassign from franchise | void |
| `getEvents(id?, limit?)` | Get event history | Event[] |
| `getStats()` | Database statistics | DbStats |
| `export()` | Serialize to JSON | string |
| `import(json)` | Load from JSON | void |
| `clear()` | Clear all data | void |

## 🔍 Query Filters

```typescript
interface QueryFilter {
  status?: 'active' | 'idle' | 'busy' | 'offline' | 'error';
  role?: 'owner' | 'manager' | 'worker' | 'specialist' | 'coordinator';
  franchise_id?: string;
  limit?: number;    // Default: all
  offset?: number;   // Default: 0
}
```

## 🎨 Agent Roles

- `owner` - Franchise owner
- `manager` - Franchise manager
- `worker` - Regular worker
- `specialist` - Domain specialist
- `coordinator` - Coordination role

## 📈 Agent Status

- `active` - Currently active
- `idle` - Waiting for work
- `busy` - Working on task
- `offline` - Not available
- `error` - Error state

## 🏢 Franchise Tiers

- `starter` - Starter tier
- `professional` - Professional tier
- `enterprise` - Enterprise tier
- `elite` - Elite tier

## 🔔 Event Types

- `created` - Entity created
- `updated` - Entity updated
- `deleted` - Entity deleted
- `status_changed` - Status changed
- `assigned` - Agent assigned
- `unassigned` - Agent unassigned

## ⚡ Performance Tips

### 1. Batch Operations
```typescript
// Disable cache during bulk ops
db.setCacheEnabled(false);
for (let i = 0; i < 1000; i++) {
  db.createAgent(`Agent ${i}`, 'worker');
}
db.setCacheEnabled(true);
```

### 2. Use Specific Queries
```typescript
// Good: Use filter
const workers = db.queryAgents({ role: 'worker' });

// Bad: Filter in JS
const all = db.queryAgents({});
const workers = all.filter(a => a.role === 'worker');
```

### 3. Cache Management
```typescript
// Clear cache when needed
if (db.getStats().memory_usage > 10_000_000) {
  db.clearCache();
}
```

## 🧪 Testing

```typescript
import { AgentDB } from 'agentdb';

beforeAll(async () => {
  await AgentDB.init();
});

test('creates agent', () => {
  const db = new AgentDB();
  const agent = db.createAgent('Alice', 'worker');
  expect(agent.name).toBe('Alice');
});
```

## 🐛 Debugging

```typescript
// Get version
console.log(AgentDB.version());

// Get stats
console.log(db.getStats());

// Time operations
const start = AgentDB.now();
// ... operations ...
const elapsed = AgentDB.now() - start;
console.log(`Took ${elapsed}ms`);
```

## 📁 Project Structure

```
agentdb-wasm/    # Rust WASM core
agentdb-npm/     # TypeScript wrapper
build.sh         # Build script
test.sh          # Test script
bench.sh         # Benchmark script
```

## 📚 Documentation

- **AGENTDB.md** - Complete overview
- **INTEGRATION.md** - Integration guide
- **agentdb-wasm/README.md** - Rust docs
- **agentdb-npm/README.md** - npm docs

## 🎯 Typical Workflow

```typescript
// 1. Initialize
await AgentDB.init();
const db = new AgentDB();

// 2. Create entities
const agent = db.createAgent('Alice', 'manager');
const franchise = db.createFranchise('Corp', agent.id, 'NYC');

// 3. Assign
db.assignAgent(agent.id, franchise.id);

// 4. Query
const agents = db.queryAgents({ franchise_id: franchise.id });

// 5. Monitor
const stats = db.getStats();
console.log(`${stats.total_agents} agents, ${stats.memory_usage} bytes`);

// 6. Persist
const backup = db.export();
localStorage.setItem('backup', backup);
```

## 🔧 Build Commands

```bash
# Full build
./build.sh

# WASM only
cd agentdb-wasm && wasm-pack build

# npm only
cd agentdb-npm && npm run build

# Tests
./test.sh

# Benchmarks
./bench.sh
```

## 💡 Pro Tips

1. **Always init once** - Call `AgentDB.init()` once at app start
2. **Use caching** - Enabled by default, 50-100x speedup
3. **Use pools** - For high-concurrency scenarios
4. **Export regularly** - Backup your data periodically
5. **Monitor stats** - Keep an eye on memory usage
6. **Clear old events** - Prevent event log from growing too large

## 🚨 Common Issues

### WASM not loading
```typescript
// Ensure init is called
await AgentDB.init();
```

### Memory growing
```typescript
// Clear cache
db.clearCache();

// Or export/import to reset
const data = db.export();
db.clear();
db.import(data);
```

### Slow queries
```typescript
// Use indexed queries
db.queryAgents({ franchise_id: 'id' }); // Fast (indexed)
db.queryAgents({ status: 'active' });    // Fast (indexed)
```

## 📞 Support

- Main docs: `AGENTDB.md`
- Integration: `INTEGRATION.md`
- Examples: `agentdb-npm/examples/`

---

**Quick Reference v0.1.0**
