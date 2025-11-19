#!/bin/bash
# VibeCast Xenosphere - Swarm Launch Script
# Orchestrates 5 parallel agents using Claude-Flow

set -e

echo "🌌 Launching VibeCast Xenosphere Swarm..."
echo "================================================"
echo ""
echo "Deploying 5 specialized agents:"
echo "  1. Hyperdimensional Architect"
echo "  2. Stigmergy Coordinator"
echo "  3. Chrono-Engine"
echo "  4. Biodata Stream"
echo "  5. Integration Architect"
echo ""
echo "Mode: Parallel Swarm Intelligence"
echo "Coordination: Stigmergic (environment-mediated)"
echo ""
echo "================================================"
echo ""

# Create output directory for agent logs
mkdir -p .flow/logs

# Launch agents in parallel using claude-flow
# Each agent gets its own task file and works independently
# They coordinate through the shared workspace (stigmergic!)

echo "🚀 Deploying Agent 1: Hyperdimensional Architect..."
npx claude-flow run \
  --task ".flow/tasks/hyperdimensional.md" \
  --output ".flow/logs/hyperdimensional.log" \
  --mode "autonomous" \
  &
AGENT1_PID=$!

echo "🚀 Deploying Agent 2: Stigmergy Coordinator..."
npx claude-flow run \
  --task ".flow/tasks/stigmergy.md" \
  --output ".flow/logs/stigmergy.log" \
  --mode "autonomous" \
  &
AGENT2_PID=$!

echo "🚀 Deploying Agent 3: Chrono-Engine..."
npx claude-flow run \
  --task ".flow/tasks/chrono-adaptive.md" \
  --output ".flow/logs/chrono.log" \
  --mode "autonomous" \
  &
AGENT3_PID=$!

echo "🚀 Deploying Agent 4: Biodata Stream..."
npx claude-flow run \
  --task ".flow/tasks/biodata-streaming.md" \
  --output ".flow/logs/biodata.log" \
  --mode "autonomous" \
  &
AGENT4_PID=$!

echo ""
echo "⏳ Waiting for specialized agents to complete..."
echo "   (Integration agent will deploy once others finish)"
echo ""

# Wait for all 4 specialized agents
wait $AGENT1_PID $AGENT2_PID $AGENT3_PID $AGENT4_PID

echo ""
echo "✅ Specialized agents complete!"
echo ""
echo "🚀 Deploying Agent 5: Integration Architect..."
npx claude-flow run \
  --task ".flow/tasks/integration.md" \
  --output ".flow/logs/integration.log" \
  --mode "autonomous"

echo ""
echo "================================================"
echo "🎉 Swarm Complete!"
echo ""
echo "Check logs in .flow/logs/"
echo "Review outputs in src/"
echo ""
echo "Next: npm run demo"
echo "================================================"
