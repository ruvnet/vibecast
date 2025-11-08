# AgentDB Integration Guide

Quick reference for integrating AgentDB into the franchise platform.

## 🚀 Quick Start (5 minutes)

### Step 1: Build the WASM Module

```bash
./build.sh
```

This will:
- Compile Rust to WASM
- Generate JavaScript bindings
- Build the npm package

### Step 2: Install in Your Project

```bash
# From npm (after publishing)
npm install agentdb

# Or link locally for development
cd agentdb-npm
npm link

# Then in your project
npm link agentdb
```

### Step 3: Use in Your Application

```typescript
import { AgentDB } from 'agentdb';

// Initialize once
await AgentDB.init();

// Create database
const db = new AgentDB();

// Start using!
const agent = db.createAgent('Alice', 'manager');
```

## 🔌 Integration Patterns

### Pattern 1: Singleton Database

Use a single database instance across your application:

```typescript
// db.ts
import { AgentDB } from 'agentdb';

let instance: AgentDB | null = null;

export async function getDB(): Promise<AgentDB> {
  if (!instance) {
    await AgentDB.init();
    instance = new AgentDB({
      cacheEnabled: true,
      cacheTTL: 5000,
    });
  }
  return instance;
}

// Usage in any file
import { getDB } from './db';

const db = await getDB();
const agent = db.createAgent('Alice', 'manager');
```

### Pattern 2: Connection Pool

Use a pool for high-concurrency scenarios:

```typescript
// pool.ts
import { AgentDBPool } from 'agentdb';

let pool: AgentDBPool | null = null;

export async function getPool(): Promise<AgentDBPool> {
  if (!pool) {
    await AgentDB.init();
    pool = new AgentDBPool({
      maxInstances: 10,
      cacheEnabled: true,
    });
  }
  return pool;
}

// Usage
import { getPool } from './pool';

const pool = await getPool();
await pool.execute(db => {
  return db.createAgent('Alice', 'manager');
});
```

### Pattern 3: Persistent Database

Automatically save/load from storage:

```typescript
// persistent-db.ts
import { AgentDB } from 'agentdb';

export class PersistentDB {
  private db: AgentDB;
  private storageKey = 'agentdb-state';

  constructor() {
    this.db = new AgentDB();
    this.load();
  }

  static async create() {
    await AgentDB.init();
    return new PersistentDB();
  }

  private load() {
    const data = localStorage.getItem(this.storageKey);
    if (data) {
      this.db.import(data);
    }
  }

  private save() {
    const data = this.db.export();
    localStorage.setItem(this.storageKey, data);
  }

  createAgent(name: string, role: string) {
    const agent = this.db.createAgent(name, role);
    this.save();
    return agent;
  }

  // Wrap other methods similarly...
}

// Usage
const db = await PersistentDB.create();
const agent = db.createAgent('Alice', 'manager');
// Automatically saved to localStorage
```

### Pattern 4: Backend Sync

Sync with a backend API:

```typescript
// synced-db.ts
import { AgentDB } from 'agentdb';

export class SyncedDB {
  private db: AgentDB;
  private apiUrl: string;

  constructor(apiUrl: string) {
    this.db = new AgentDB();
    this.apiUrl = apiUrl;
  }

  static async create(apiUrl: string) {
    await AgentDB.init();
    const instance = new SyncedDB(apiUrl);
    await instance.pull();
    return instance;
  }

  async pull() {
    const response = await fetch(`${this.apiUrl}/agents/export`);
    const data = await response.text();
    this.db.import(data);
  }

  async push() {
    const data = this.db.export();
    await fetch(`${this.apiUrl}/agents/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: data,
    });
  }

  createAgent(name: string, role: string) {
    const agent = this.db.createAgent(name, role);
    this.push(); // Sync to backend
    return agent;
  }
}

// Usage
const db = await SyncedDB.create('https://api.example.com');
const agent = db.createAgent('Alice', 'manager');
// Automatically synced to backend
```

## 🎯 Common Use Cases

### Use Case 1: Agent Dashboard

```typescript
import { AgentDB } from 'agentdb';

class AgentDashboard {
  private db: AgentDB;

  async init() {
    await AgentDB.init();
    this.db = new AgentDB();
  }

  getActiveAgents() {
    return this.db.queryAgents({
      status: 'active',
      limit: 100,
    });
  }

  getAgentsByFranchise(franchiseId: string) {
    return this.db.queryAgents({
      franchise_id: franchiseId,
    });
  }

  getAgentStats() {
    const stats = this.db.getStats();
    return {
      total: stats.total_agents,
      active: stats.active_agents,
      idle: this.db.queryAgents({ status: 'idle' }).length,
      busy: this.db.queryAgents({ status: 'busy' }).length,
    };
  }
}
```

### Use Case 2: Franchise Management

```typescript
import { AgentDB } from 'agentdb';

class FranchiseManager {
  private db: AgentDB;

  async init() {
    await AgentDB.init();
    this.db = new AgentDB();
  }

  createFranchise(name: string, ownerId: string, location: string) {
    const franchise = this.db.createFranchise(name, ownerId, location);

    // Auto-assign owner
    this.db.assignAgent(ownerId, franchise.id);

    return franchise;
  }

  getFranchiseDetails(franchiseId: string) {
    const franchise = this.db.getFranchise(franchiseId);
    const agents = this.db.queryAgents({
      franchise_id: franchiseId,
    });

    return {
      ...franchise,
      agent_count: agents.length,
      active_agents: agents.filter(a => a.status === 'active').length,
    };
  }

  reassignAgent(agentId: string, newFranchiseId: string) {
    // Unassign from current franchise
    this.db.unassignAgent(agentId);

    // Assign to new franchise
    this.db.assignAgent(agentId, newFranchiseId);
  }
}
```

### Use Case 3: Audit Trail

```typescript
import { AgentDB } from 'agentdb';

class AuditService {
  private db: AgentDB;

  async init() {
    await AgentDB.init();
    this.db = new AgentDB();
  }

  getEntityHistory(entityId: string) {
    return this.db.getEvents(entityId);
  }

  getRecentActivity(limit = 50) {
    return this.db.getEvents(undefined, limit);
  }

  getActivityByType(eventType: string) {
    const allEvents = this.db.getEvents();
    return allEvents.filter(e => e.event_type === eventType);
  }

  generateReport() {
    const events = this.db.getEvents();
    const stats = this.db.getStats();

    return {
      total_events: events.length,
      total_agents: stats.total_agents,
      total_franchises: stats.total_franchises,
      events_by_type: this.groupEventsByType(events),
      recent_activity: events.slice(0, 10),
    };
  }

  private groupEventsByType(events: Event[]) {
    const grouped: Record<string, number> = {};
    events.forEach(event => {
      const type = event.event_type;
      grouped[type] = (grouped[type] || 0) + 1;
    });
    return grouped;
  }
}
```

## 🔄 State Management Integration

### React Integration

```typescript
// useAgentDB.ts
import { useState, useEffect } from 'react';
import { AgentDB, Agent } from 'agentdb';

let dbInstance: AgentDB | null = null;

async function getDB() {
  if (!dbInstance) {
    await AgentDB.init();
    dbInstance = new AgentDB();
  }
  return dbInstance;
}

export function useAgentDB() {
  const [db, setDb] = useState<AgentDB | null>(null);

  useEffect(() => {
    getDB().then(setDb);
  }, []);

  return db;
}

export function useAgents(filter = {}) {
  const db = useAgentDB();
  const [agents, setAgents] = useState<Agent[]>([]);

  useEffect(() => {
    if (db) {
      const result = db.queryAgents(filter);
      setAgents(result);
    }
  }, [db, filter]);

  return agents;
}

// Usage in component
function AgentList() {
  const db = useAgentDB();
  const agents = useAgents({ status: 'active' });

  const createAgent = () => {
    if (db) {
      db.createAgent('New Agent', 'worker');
      // Trigger re-render
      setAgents(db.queryAgents({ status: 'active' }));
    }
  };

  return (
    <div>
      <button onClick={createAgent}>Create Agent</button>
      <ul>
        {agents.map(agent => (
          <li key={agent.id}>{agent.name}</li>
        ))}
      </ul>
    </div>
  );
}
```

### Vue Integration

```typescript
// db-plugin.ts
import { AgentDB } from 'agentdb';
import { App, Plugin } from 'vue';

let db: AgentDB | null = null;

export const AgentDBPlugin: Plugin = {
  async install(app: App) {
    await AgentDB.init();
    db = new AgentDB();

    app.config.globalProperties.$agentdb = db;
    app.provide('agentdb', db);
  },
};

// Usage in component
import { inject } from 'vue';
import { AgentDB } from 'agentdb';

export default {
  setup() {
    const db = inject<AgentDB>('agentdb');

    const createAgent = () => {
      if (db) {
        db.createAgent('New Agent', 'worker');
      }
    };

    return { db, createAgent };
  },
};
```

### Svelte Integration

```typescript
// stores.ts
import { writable } from 'svelte/store';
import { AgentDB } from 'agentdb';

async function createDB() {
  await AgentDB.init();
  return new AgentDB();
}

export const agentDB = writable<AgentDB | null>(null);

createDB().then(db => agentDB.set(db));

// Usage in component
<script>
  import { agentDB } from './stores';

  function createAgent() {
    if ($agentDB) {
      $agentDB.createAgent('New Agent', 'worker');
    }
  }
</script>

<button on:click={createAgent}>Create Agent</button>
```

## 🧪 Testing Integration

### Jest Setup

```typescript
// setup.ts
import { AgentDB } from 'agentdb';

beforeAll(async () => {
  await AgentDB.init();
});

// test.ts
import { AgentDB } from 'agentdb';

describe('AgentDB', () => {
  let db: AgentDB;

  beforeEach(() => {
    db = new AgentDB();
  });

  afterEach(() => {
    db.clear();
  });

  test('creates agent', () => {
    const agent = db.createAgent('Alice', 'manager');
    expect(agent.name).toBe('Alice');
    expect(agent.role).toBe('manager');
  });

  test('queries agents', () => {
    db.createAgent('Alice', 'manager');
    db.createAgent('Bob', 'worker');

    const agents = db.queryAgents({ role: 'worker' });
    expect(agents).toHaveLength(1);
    expect(agents[0].name).toBe('Bob');
  });
});
```

## 📊 Performance Optimization

### Batch Operations

```typescript
// Instead of:
for (let i = 0; i < 1000; i++) {
  db.createAgent(`Agent ${i}`, 'worker');
}

// Disable cache during bulk operations:
db.setCacheEnabled(false);
for (let i = 0; i < 1000; i++) {
  db.createAgent(`Agent ${i}`, 'worker');
}
db.setCacheEnabled(true);
```

### Query Optimization

```typescript
// Cache frequently accessed data
const activeAgents = db.queryAgents({ status: 'active' });
// Subsequent calls within TTL are cached

// Use specific queries instead of filtering in JavaScript
// Good:
const workers = db.queryAgents({ role: 'worker' });

// Bad:
const allAgents = db.queryAgents({});
const workers = allAgents.filter(a => a.role === 'worker');
```

### Memory Management

```typescript
// Periodically clear old events
const stats = db.getStats();
if (stats.total_events > 10000) {
  // Export current state
  const state = db.export();

  // Clear and reimport (removes events)
  db.clear();
  db.import(state);
}
```

## 🔧 Troubleshooting

### Issue: WASM not loading

```typescript
// Ensure init is called before use
await AgentDB.init();

// Or handle initialization errors
try {
  await AgentDB.init();
} catch (error) {
  console.error('WASM init failed:', error);
}
```

### Issue: Performance degradation

```typescript
// Check memory usage
const stats = db.getStats();
console.log('Memory:', stats.memory_usage);

// Clear cache if too large
if (stats.memory_usage > 10_000_000) {
  db.clearCache();
}
```

### Issue: Data not persisting

```typescript
// Ensure export/import is called
window.addEventListener('beforeunload', () => {
  const data = db.export();
  localStorage.setItem('db-backup', data);
});

window.addEventListener('load', () => {
  const data = localStorage.getItem('db-backup');
  if (data) {
    db.import(data);
  }
});
```

## 📦 Next Steps

1. **Build the module**: Run `./build.sh`
2. **Run tests**: Run `./test.sh`
3. **Try examples**: Run `cd agentdb-npm && npm run example`
4. **Integrate into your app**: Follow patterns above
5. **Monitor performance**: Use `db.getStats()`

## 🤝 Support

For questions and issues:
- Check the main [AGENTDB.md](./AGENTDB.md) documentation
- Review examples in [agentdb-npm/examples/](./agentdb-npm/examples/)
- Open an issue on GitHub

---

Happy integrating! 🚀
