#!/usr/bin/env bash
# Generate code-tasks fixture data by scanning a project for task comments.
# Defaults to scanning tests/javascript from the dashbuild root.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../../.." && pwd)"

TARGET="${1:-${ROOT_DIR}/tests/javascript}"

echo "Scanning ${TARGET} for code tasks..."
node "${SCRIPT_DIR}/generate-fixture.js" "${TARGET}"
echo "Done!"
