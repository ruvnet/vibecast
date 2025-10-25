# Claude Code Skill Gallery

A curated collection of Claude Code skills for enhancing your AI-powered development workflow. This gallery contains pre-packaged skill sets that can be easily integrated into your Claude Code projects.

## What are Skills?

Skills are reusable command modules that extend Claude Code's capabilities. Each skill provides specialized functionality for specific tasks like analysis, automation, coordination, and more.

## Available Skills

### Analysis Skills
**File**: `analysis.zip`

Performance and code analysis tools:
- Bottleneck detection
- Performance reporting
- Token usage analysis

### Automation Skills
**File**: `automation.zip`

Workflow automation and smart agent management:
- Auto-agent spawning
- Workflow selection
- Smart task distribution

### Coordination Skills
**File**: `coordination.zip`

Multi-agent coordination and orchestration:
- Swarm initialization
- Task orchestration
- Agent spawning and management

### GitHub Skills
**File**: `github.zip`

GitHub integration and automation:
- PR enhancement
- Issue triage
- Repository analysis
- Code review automation
- Swarm-based GitHub operations

### Hive Mind Skills
**File**: `hive-mind.zip`

Collective intelligence and distributed processing:
- Hive mind initialization
- Collective memory management
- Consensus mechanisms
- Multi-session coordination
- Performance metrics

### Hooks Skills
**File**: `hooks.zip`

Event-driven automation with lifecycle hooks:
- Pre/post task hooks
- Pre/post edit hooks
- Session lifecycle management

### Memory Skills
**File**: `memory.zip`

Persistent memory and knowledge management:
- Memory persistence
- Memory search and retrieval
- Usage tracking

### Monitoring Skills
**File**: `monitoring.zip`

Real-time monitoring and observability:
- Agent metrics
- Swarm monitoring
- Real-time dashboards

### Optimization Skills
**File**: `optimization.zip`

Performance optimization and tuning:
- Parallel execution optimization
- Cache management
- Topology optimization

### Swarm Skills
**File**: `swarm.zip`

Multi-agent swarm coordination:
- Swarm initialization
- Agent spawning
- Strategy selection
- Background processing
- Status monitoring

### Training Skills
**File**: `training.zip`

Model and pattern training:
- Neural training
- Pattern learning
- Model updates

### Workflows Skills
**File**: `workflows.zip`

Workflow creation and management:
- Workflow creation
- Workflow execution
- Workflow export

### Agents Skills
**File**: `agents.zip`

Agent management and capabilities:
- Agent spawning
- Agent types and capabilities
- Agent coordination

## Installation

### Prerequisites

```bash
npm install -g @anthropic-ai/claude-code
npx claude-flow@alpha init
```

### Installing Individual Skills

1. **Download** the skill zip file from this gallery
2. **Extract** the zip file
3. **Copy** the skill folder to your project's `.claude/commands/` directory

```bash
# Example: Installing analysis skills
unzip analysis.zip
cp -r analysis .claude/commands/
```

### Installing All Skills

To install all skills at once:

```bash
# Extract all skills
for file in skills/*.zip; do
  unzip "$file" -d .claude/commands/
done
```

## Usage

Once installed, skills can be used through Claude Code slash commands:

```bash
# Analysis example
/bottleneck-detect --time-range 24h

# Automation example
/auto-agent --task "analyze codebase"

# GitHub example
/pr-enhance --pr-number 123

# Swarm example
/swarm-init --topology hierarchical
```

## Directory Structure

```
skill-gallery-temp/
├── README.md                 # This file
├── skill.md                  # Template for creating new skills
├── skills/                   # Skill packages
│   ├── agents.zip
│   ├── analysis.zip
│   ├── automation.zip
│   ├── coordination.zip
│   ├── github.zip
│   ├── hive-mind.zip
│   ├── hooks.zip
│   ├── memory.zip
│   ├── monitoring.zip
│   ├── optimization.zip
│   ├── swarm.zip
│   ├── training.zip
│   └── workflows.zip
└── .claude/                  # Example Claude Code configuration
```

## Creating Your Own Skills

Use the included `skill.md` template to create your own custom skills:

1. Copy `skill.md` to your skill directory
2. Rename it to match your skill's command name
3. Fill in the sections with your skill's details
4. Place the file in `.claude/commands/your-skill-category/`

## Skill Development Guidelines

### File Naming

- Use kebab-case for skill files: `skill-name.md`
- Group related skills in category folders
- Include a `README.md` in each category folder

### Documentation

Each skill should include:
- Clear description and purpose
- Usage examples
- Options and arguments
- Output format
- Integration examples
- Related skills

### Best Practices

1. **Single Responsibility**: Each skill should do one thing well
2. **Clear Documentation**: Make usage obvious and provide examples
3. **Composability**: Design skills to work together
4. **Error Handling**: Provide helpful error messages
5. **Performance**: Consider token usage and execution time

## Integration with Claude Flow

These skills are designed to work seamlessly with Claude Flow:

```bash
# Initialize Claude Flow in your project
npx claude-flow@alpha init

# Skills are automatically available through MCP
mcp__claude-flow__skill-name {
  parameter: "value"
}
```

## Configuration

Skills can be configured through `.claude/settings.json`:

```json
{
  "skills": {
    "enabled": true,
    "categories": {
      "analysis": true,
      "automation": true,
      "monitoring": true
    }
  }
}
```

## Updates and Maintenance

To update skills:

1. Download the latest version from the gallery
2. Backup your existing `.claude/commands/` directory
3. Extract and replace with new versions
4. Review any configuration changes

## Contributing

To contribute your own skills to the gallery:

1. Create your skill following the template
2. Test thoroughly in your environment
3. Package as a zip file with the category name
4. Submit with documentation and examples

## Support

For issues or questions:
- Check the skill's documentation in the `.md` file
- Review the `skill.md` template for guidance
- Consult Claude Code documentation

## License

These skills are provided as examples and templates for use with Claude Code. Modify and distribute as needed for your projects.

## Version

**Gallery Version**: 1.0.0
**Claude Flow Version**: 2.0.0+
**Last Updated**: 2025-10-25

---

Built with Claude Code - AI-powered development at scale
