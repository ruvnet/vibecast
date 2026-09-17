#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p evidence
# This coordinates explicit validation work; it does not claim that task creation runs agents.
RUFLO=(npx --yes ruflo@3.42.2)
{
  "${RUFLO[@]}" --version
  "${RUFLO[@]}" swarm init --topology hierarchical --max-agents 3 --strategy development --with-permissions strict
  "${RUFLO[@]}" task create --type testing --description 'Verify Vibecast ownership, quote approval, idempotency and unknown submission invariants. No paid calls.' --tags vibecast,security
  "${RUFLO[@]}" task create --type testing --description 'Verify browser-selected takes, narration and bounded review-film export. No public publishing.' --tags vibecast,media
  "${RUFLO[@]}" memory init
} 2>&1 | tee evidence/ruflo-coordination.log
python -m pytest tests/test_studio.py -q | tee evidence/backend-tests.txt
python scripts/benchmark.py
"${RUFLO[@]}" memory store -k vibecast-validation -v "Deterministic validation executed by scripts/coordinate.sh. Read evidence/backend-tests.txt and evidence/benchmark.json for results. No paid provider smoke, autonomous agent completion, deployment or promotion to main is implied." 2>&1 | tee -a evidence/ruflo-coordination.log
