#!/usr/bin/env bash
set -euo pipefail

# ─── Resolve paths ────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODULE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SLUG="$(node -e "console.log(JSON.parse(require('fs').readFileSync('${MODULE_DIR}/module.json','utf-8')).slug)")"

# ─── Validate required environment ────────────────────────────────────

if [ -z "${DASHBUILD_DIR:-}" ]; then
  echo "::error::DASHBUILD_DIR is not set. Did you run dashbuild/setup first?"
  exit 1
fi

if [ -z "${SONAR_TOKEN:-}" ]; then
  echo "::error::SONAR_TOKEN is not set."
  exit 1
fi

if [ -z "${SONAR_PROJECT_KEY:-}" ]; then
  echo "::error::SONAR_PROJECT_KEY is not set."
  exit 1
fi

# ─── Configuration with defaults ──────────────────────────────────────

HOST_URL="${SONAR_HOST_URL:-https://sonarcloud.io}"
HOST_URL="${HOST_URL%/}"

METRICS="${SONAR_METRICS:-bugs,vulnerabilities,code_smells,coverage,duplicated_lines_density,ncloc,security_hotspots,reliability_rating,security_rating,sqale_rating}"
AREAS="${SONAR_AREAS:-coverage,duplicated_lines_density,code_smells,bugs,vulnerabilities,reliability_rating,security_rating,sqale_rating}"
CACHE_FILE="${SONAR_CACHE_FILE:-}"
RETENTION_DAYS="${SONAR_RETENTION_DAYS:-90}"

# ─── Fetch metrics from API ───────────────────────────────────────────

API_URL="${HOST_URL}/api/measures/component?component=${SONAR_PROJECT_KEY}&metricKeys=${METRICS}"

echo "::group::Fetching SonarQube metrics"
echo "API URL: ${API_URL}"

if ! HTTP_RESPONSE=$(curl -sf \
  -u "${SONAR_TOKEN}:" \
  -H "Accept: application/json" \
  "${API_URL}"); then
  echo "::error::Failed to fetch metrics from SonarQube API"
  exit 1
fi

# ─── Build historical data file ───────────────────────────────────────

OUTPUT_FILE="${DASHBUILD_DIR}/src/data/${SLUG}.json"
mkdir -p "$(dirname "${OUTPUT_FILE}")"

# Pre-parse the API response into a flat metrics JSON object
METRICS_JSON="$(node -e "
  const r = JSON.parse(process.argv[1]);
  const m = {};
  for (const measure of r.component.measures) {
    const n = Number(measure.value);
    m[measure.metric] = isNaN(n) ? measure.value : n;
  }
  process.stdout.write(JSON.stringify(m));
" "${HTTP_RESPONSE}")"

# Find the repo root to locate the shared merge script
_DBROOT="${SCRIPT_DIR}"
while [ ! -d "${_DBROOT}/scripts/lib" ]; do
  _DBROOT="$(dirname "${_DBROOT}")"
  [ "${_DBROOT}" = "/" ] && echo "::error::Cannot find Dashbuild root" && exit 1
done

node "${_DBROOT}/scripts/lib/merge-history.js" \
  "${METRICS_JSON}" \
  "${CACHE_FILE}" \
  "${AREAS}" \
  "${OUTPUT_FILE}" \
  "${RETENTION_DAYS}"

echo "::endgroup::"
