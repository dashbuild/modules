#!/usr/bin/env bash
# Generate code-statistics fixture by running real tests and collecting output.
# Defaults to running vitest in tests/javascript from the dashbuild root.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../../../.." && pwd)"

TARGET="${1:-${ROOT_DIR}/tests/javascript}"

if [ ! -d "${TARGET}" ]; then
    echo "Error: Target project not found at ${TARGET}"
    exit 1
fi

# Install dependencies if needed
if [ ! -d "${TARGET}/node_modules" ]; then
    echo "Installing dependencies in ${TARGET}..."
    (cd "${TARGET}" && npm install)
fi

echo "Running vitest in ${TARGET}..."
(cd "${TARGET}" && npx vitest run --coverage 2>&1)

echo ""
echo "Generating code-statistics fixture from test output..."
node "${SCRIPT_DIR}/generate-fixture.js" "${TARGET}"
echo "Done!"
