# Dashbuild Code Statistics Module

Track comprehensive code statistics — line counts, file counts, packages, test suites, tests, and coverage — with historical trend tracking. Generates a Vitest-themed dashboard with overview cards and time-series trend charts.

## Features

- **Repository-wide stats** — Total lines, files, packages, test suites, tests, pass/fail/skip counts
- **Coverage tracking** — Line, function, and branch coverage percentages
- **Historical trends** — Time-series caching (like SonarQube) with trend charts showing changes over time
- **Multi-runner support** — Parses Vitest/Jest JSON reporter output or Mochawesome (Cypress)
- **Monorepo-aware** — Discovers LCOV files in nested packages, infers package names from `package.json`
- **Vitest theme** — Dark background (`#16171d`) with green/purple gradient styling

## Quick Start

```yaml
- uses: your-org/dashbuild/modules/javascript/code-statistics@main
  with:
    test-runner: vitest
```

## Inputs

| Input               | Required | Default         | Description                                                                 |
| ------------------- | -------- | --------------- | --------------------------------------------------------------------------- |
| `coverage-path`     | No       | `.`             | Directory to search for LCOV coverage files                                 |
| `pattern`           | No       | `**/lcov.info`  | Glob pattern for LCOV files                                                 |
| `test-runner`       | No       | `vitest`        | Test runner: `vitest`, `jest`, or `cypress`                                 |
| `test-results-path` | No       | _(auto-detect)_ | Path to the test runner's JSON output. Auto-detected from common locations. |
| `cache-key`         | No       | _(empty)_       | GitHub Actions cache key for historical data. Enables trend tracking.       |
| `retention-days`    | No       | `90`            | Days of historical data to keep. 0 = keep all.                              |
| `enable-tests`      | No       | `false`         | Set to `true` to enable test result parsing and the Testing sections.       |
| `enable-coverage`   | No       | `false`         | Set to `true` to enable coverage parsing and the Coverage section.          |
| `source-patterns`   | No       | _(all JS/TS)_   | Comma-separated glob patterns for source files to count. Scopes statistics. |

### Test Runner Output

The module expects JSON output from your test runner:

- **Vitest / Jest** — Use the `json` reporter: `vitest run --reporter=json --outputFile=test-results.json`
- **Cypress** — Use [mochawesome](https://github.com/adamgruber/mochawesome): generates `mochawesome.json`

### Monorepo Support

When scanning for LCOV files, the module walks up from each file to find the nearest `package.json` and uses its `name` field as the package identifier. Coverage is grouped and displayed per-package with individual progress bars.

If no `package.json` is found, all files are grouped under a single `(root)` package.

## Examples

### Vitest with coverage and history

```yaml
- name: Run tests
  run: npx vitest run --coverage --reporter=json --outputFile=test-results.json

- uses: your-org/dashbuild/modules/javascript/code-statistics@main
  with:
    test-runner: vitest
    test-results-path: test-results.json
    cache-key: dashbuild-js-code-stats
```

### Jest monorepo

```yaml
- name: Run tests
  run: npx jest --coverage --json --outputFile=test-results.json

- uses: your-org/dashbuild/modules/javascript/code-statistics@main
  with:
    test-runner: jest
    test-results-path: test-results.json
    cache-key: dashbuild-js-code-stats
```

### Coverage only (no test stats)

```yaml
- uses: your-org/dashbuild/modules/javascript/code-statistics@main
```

If no test results file is found, the dashboard shows coverage data only.

### Codebase stats only (no tests, no coverage)

```yaml
- uses: your-org/dashbuild/modules/javascript/code-statistics@main
  with:
    enable-tests: "false"
    enable-coverage: "false"
```

Shows only line counts, file counts, and package counts. The Testing, Test Results, and Coverage sections are completely hidden.

## Local Development

### Using example fixtures

```bash
# Copy the example fixture for quick testing
cp modules/javascript/code-statistics/fixtures/js-code-stats.json.example \
   modules/javascript/code-statistics/fixtures/js-code-stats.json

# Preview
just dev javascript/code-statistics
```

### Generating fixtures from a real project

```bash
# From a project with lcov coverage output
just generate-fixture-js-code-stats /path/to/your/project

# Preview
just dev javascript/code-statistics
```

The fixture generator scans for LCOV files and test result JSON, then writes parsed data to the fixtures directory.

## Report Sections

### Overview

Summary cards showing the latest values for all tracked metrics:

- **Code metrics** — Total Lines, Files, Packages
- **Test metrics (green)** — Test Suites, Tests, Passed, Failed, Skipped
- **Coverage metrics (purple)** — Line Coverage, Function Coverage, Branch Coverage

### Trends

Time-series charts for each metric, showing how values change over time. Uses the same pattern as the SonarQube module:

- Area + line charts for multiple data points
- Horizontal rule + dot for single data points
- Trend arrows showing delta from previous entry
