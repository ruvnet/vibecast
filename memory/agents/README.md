# Agents Directory

This directory stores persistent information about AI agents created and managed by Claude-Flow.

## Structure
- Each agent gets its own JSON file named by agent ID
- Agent files contain configuration, state, and memory
- Shared agent data is stored in agent-registry.json

## Usage
Agents are automatically managed by the Claude-Flow orchestration system. You can:
- View agent status with `claude-flow agent list`
- Create new agents with `claude-flow agent spawn <type>`
- Configure agents with `claude-flow agent configure <id>`

## Files
- `agent-registry.json`: Central agent registry
- `agent-<id>.json`: Individual agent data files
- `templates/`: Agent configuration templates
