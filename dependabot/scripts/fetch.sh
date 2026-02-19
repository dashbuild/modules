#!/usr/bin/env bash
# Fetch Dependabot/security data and merge into the module's fixture file.
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

export DEPENDABOT_REPOSITORY="${GITHUB_REPOSITORY}"
export DEPENDABOT_AREAS="${DEPENDABOT_AREAS:-dependabot,code-scanning,secret-scanning}"
export DEPENDABOT_CACHE_FILE="${FIXTURE}"
export DEPENDABOT_RETENTION_DAYS="${DEPENDABOT_RETENTION_DAYS:-90}"

echo "Fetching security data for: ${GITHUB_REPOSITORY}"
echo "Areas: ${DEPENDABOT_AREAS}"
echo "Output: ${FIXTURE}"

node "${SCRIPT_DIR}/fetch-dependabot.js"

echo "Done!"
