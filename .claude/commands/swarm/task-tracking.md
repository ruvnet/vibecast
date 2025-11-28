# Task Tracking Format for Swarm Operations

## Overview
Swarm operations use a standardized task tracking format to provide clear visibility into progress, priorities, and dependencies across all agents.

## Progress Overview Display

The swarm coordinator will display task progress using this format:

```
📊 Progress Overview
   ├── Total Tasks: 12
   ├── ✅ Completed: 8 (67%)
   ├── 🔄 In Progress: 2 (17%)
   ├── ⭕ Todo: 1 (8%)
   └── ❌ Blocked: 1 (8%)
```

## Task Lists by Status

### 📋 Todo Tasks
Tasks waiting to be started:
```
📋 Todo (1)
   └── 🔴 001: Set up authentication system [HIGH] ▶
```

### 🔄 In Progress Tasks
Tasks currently being worked on:
```
🔄 In progress (2)
   ├── 🟡 002: Implement user dashboard ↳ 1 deps ▶
   └── 🔴 003: Add payment integration [CRITICAL] ▶
```

### ✅ Completed Tasks
Tasks that have been finished:
```
✅ Completed (8)
   ├── ✅ 004: Design wireframes
   ├── ✅ 005: Set up database schema
   ├── ✅ 006: Create API endpoints
   └── ... (more completed tasks)
```

### ❌ Blocked Tasks
Tasks that cannot proceed due to dependencies:
```
❌ Blocked (1)
   └── 🔴 007: Deploy to production ↳ 3 deps [BLOCKED]
```

## Priority Indicators

Tasks use color-coded priority indicators:
- 🔴 **HIGH/CRITICAL**: Urgent tasks requiring immediate attention
- 🟡 **MEDIUM**: Important tasks that should be addressed soon
- 🟢 **LOW**: Tasks that can be deferred if needed

## Special Notations

### Dependencies
- `↳ X deps`: Indicates the task depends on X other tasks
- Tasks with dependencies show the count after the task description

### Action Indicators
- `▶`: Indicates an actionable task that can be started
- `[BLOCKED]`: Task cannot proceed until dependencies are resolved
- `[PRIORITY]`: Explicit priority level (HIGH, CRITICAL, etc.)

## Usage in Swarm Operations

### TodoWrite Integration
When creating tasks with TodoWrite, include priority and dependency information:
```javascript
TodoWrite([
  {
    id: "auth_001",
    content: "Set up authentication system",
    status: "pending",
    priority: "high",
    dependencies: []
  },
  {
    id: "dashboard_002",
    content: "Implement user dashboard",
    status: "pending",
    priority: "medium",
    dependencies: ["auth_001"]
  },
  {
    id: "payment_003",
    content: "Add payment integration",
    status: "pending",
    priority: "critical",
    dependencies: []
  }
]);
```

### Real-time Updates
The swarm coordinator will:
1. Update task statuses as agents progress
2. Recalculate percentages automatically
3. Move tasks between categories based on status
4. Show dependency resolution in real-time

## Best Practices

### Task Organization
- Group related tasks together
- Use clear, actionable task descriptions
- Set realistic priorities based on business value
- Define dependencies explicitly

### Progress Monitoring
- Check progress overview regularly
- Focus on unblocking blocked tasks
- Prioritize high/critical items
- Balance workload across agents

### Status Management
- Update task status immediately when starting work
- Mark tasks complete as soon as finished
- Document blockers when they occur
- Use Memory to store progress details

## Example Swarm Progress Display

```
🐝 Swarm: Build E-commerce Platform
📊 Progress Overview
   ├── Total Tasks: 25
   ├── ✅ Completed: 15 (60%)
   ├── 🔄 In Progress: 5 (20%)
   ├── ⭕ Todo: 4 (16%)
   └── ❌ Blocked: 1 (4%)

📋 Todo (4)
   ├── 🔴 008: Implement cart functionality [HIGH] ▶
   ├── 🟡 009: Add product search ▶
   ├── 🟡 010: Create order history page ▶
   └── 🟢 011: Add social sharing buttons [LOW] ▶

🔄 In progress (5)
   ├── 🔴 012: Payment gateway integration [CRITICAL] 
   ├── 🔴 013: User authentication system [HIGH] 
   ├── 🟡 014: Product catalog implementation ↳ 2 deps 
   ├── 🟡 015: Shopping cart API endpoints 
   └── 🟢 016: Email notification service 

✅ Completed (15)
   ├── ✅ 001: Project setup and configuration
   ├── ✅ 002: Database schema design
   ├── ✅ 003: API framework setup
   └── ... (12 more completed tasks)

❌ Blocked (1)
   └── 🔴 017: Deploy to production ↳ 5 deps [BLOCKED]
```

This format ensures all swarm participants have clear visibility into:
- Overall progress percentage
- Task priorities and urgencies
- Dependencies and blockers
- What can be worked on immediately (▶ indicators)
- Distribution of work across different states

Use this format consistently across all swarm operations for maximum clarity and coordination efficiency.
