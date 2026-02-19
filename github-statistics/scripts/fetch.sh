#!/usr/bin/env bash
# Fetch GitHub statistics and merge into the module's fixture file.
# Requires GITHUB_TOKEN and GITHUB_REPOSITORY environment variables.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODULE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SLUG="$(node -e "console.log(JSON.parse(require('fs').readFileSync('${MODULE_DIR}/module.json','utf-8')).slug)")"
FIXTURE="${MODULE_DIR}/fixtures/${SLUG}.json"

if [ -z "${GITHUB_TOKEN:-}" ]; then
    echo "Error: GITHUB_TOKEN is not set"
    echo "  export GITHUB_TOKEN=\"ghp_your-token\""
    exit 1
fi

if [ -z "${GITHUB_REPOSITORY:-}" ]; then
    echo "Error: GITHUB_REPOSITORY is not set"
    echo "  export GITHUB_REPOSITORY=\"owner/repo\""
    exit 1
fi

export GITHUB_STATS_REPOSITORY="${GITHUB_REPOSITORY}"
export GITHUB_STATS_AREAS="${GITHUB_STATS_AREAS:-prs,issues,workflows,releases,commits,contributors,branches,languages,community}"
export GITHUB_STATS_LOOKBACK_DAYS="${GITHUB_STATS_LOOKBACK_DAYS:-90}"
export GITHUB_STATS_MAX_REVIEW_PRS="${GITHUB_STATS_MAX_REVIEW_PRS:-30}"
export GITHUB_STATS_CACHE_FILE="${FIXTURE}"
export GITHUB_STATS_RETENTION_DAYS="${GITHUB_STATS_RETENTION_DAYS:-90}"

echo "Fetching GitHub stats for: ${GITHUB_REPOSITORY}"
echo "Areas: ${GITHUB_STATS_AREAS}"
echo "Output: ${FIXTURE}"

node "${SCRIPT_DIR}/fetch-github-stats.js"

echo "Done!"
