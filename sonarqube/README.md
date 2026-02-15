# Dashbuild SonarQube Module

Fetches metrics from SonarQube or SonarCloud and generates an interactive report page with trend charts showing data over time.

## Features

- **Rating badges** — Reliability, Security, and Maintainability shown as colored circle badges (A–E), matching SonarQube's own grading system
- **Trend charts** — Area charts tracking each metric over time, with trend arrows indicating direction (↗ green for up, ↘ red for down)
- **Historical data** — Uses GitHub Actions cache to persist data across runs, building a time-series automatically
- **Configurable areas** — Choose which metrics to display via the `areas` input
- **Data retention** — Automatically prune old entries beyond a configurable retention window

## Quick Start

```yaml
- uses: your-org/dashbuild/modules/sonarqube@main
  with:
    token: ${{ secrets.SONAR_TOKEN }}
    project-key: "my-org_my-project"
    cache-key: "dashbuild-sonarqube"
```

This uses all defaults: connects to SonarCloud, displays the default metric areas, keeps 90 days of history.

## Inputs

| Input            | Required | Default                 | Description                                                                                   |
| ---------------- | -------- | ----------------------- | --------------------------------------------------------------------------------------------- |
| `token`          | **Yes**  | —                       | SonarQube/SonarCloud API token                                                                |
| `project-key`    | **Yes**  | —                       | SonarQube project key (e.g. `my-org_my-project`)                                              |
| `host-url`       | No       | `https://sonarcloud.io` | SonarQube server URL                                                                          |
| `metrics`        | No       | _(see below)_           | Comma-separated metric keys to fetch from the API                                             |
| `areas`          | No       | _(see below)_           | Comma-separated metric areas to display on the report                                         |
| `cache-key`      | No       | `""`                    | GitHub Actions cache key for historical data. **Set this to enable data-over-time tracking.** |
| `retention-days` | No       | `90`                    | Number of days of history to keep. Set to `0` to keep all data.                               |

### `metrics` (API fetch)

Controls which metric keys are requested from the SonarQube API. You generally don't need to change this unless you want to reduce API payload size.

**Default:**

```
bugs,vulnerabilities,code_smells,coverage,duplicated_lines_density,ncloc,security_hotspots,reliability_rating,security_rating,sqale_rating
```

### `areas` (display)

Controls which metrics appear as trend charts and rating badges on the report page. This is the primary way to configure what your team sees.

**Default areas** (enabled out of the box):

| Area                       | What it shows                                    |
| -------------------------- | ------------------------------------------------ |
| `coverage`                 | Code coverage percentage over time               |
| `duplicated_lines_density` | Duplication percentage over time                 |
| `code_smells`              | Code smell count over time                       |
| `bugs`                     | Bug count over time                              |
| `vulnerabilities`          | Vulnerability count over time                    |
| `sqale_rating`             | Maintainability rating badge (A–E) + trend chart |

**Opt-in areas** (add to `areas` to enable):

| Area                 | What it shows                                |
| -------------------- | -------------------------------------------- |
| `ncloc`              | Lines of code over time                      |
| `reliability_rating` | Reliability rating badge (A–E) + trend chart |
| `security_rating`    | Security rating badge (A–E) + trend chart    |
| `security_hotspots`  | Security hotspot count over time             |

Rating areas (`reliability_rating`, `security_rating`, `sqale_rating`) show both a **badge** in the Current Ratings section and a **trend chart** in the Trends section. Count/percentage areas only show trend charts.

## Examples

### Minimal — just the defaults

```yaml
- uses: your-org/dashbuild/modules/sonarqube@main
  with:
    token: ${{ secrets.SONAR_TOKEN }}
    project-key: "my-org_my-project"
```

No historical data — shows a single data point each run.

### With history tracking

```yaml
- uses: your-org/dashbuild/modules/sonarqube@main
  with:
    token: ${{ secrets.SONAR_TOKEN }}
    project-key: "my-org_my-project"
    cache-key: "dashbuild-sonarqube"
```

Each run appends today's metrics to the cache. Trend charts build up over time.

### All areas enabled, 180-day retention

```yaml
- uses: your-org/dashbuild/modules/sonarqube@main
  with:
    token: ${{ secrets.SONAR_TOKEN }}
    project-key: "my-org_my-project"
    cache-key: "dashbuild-sonarqube"
    retention-days: "180"
    areas: "coverage,duplicated_lines_density,code_smells,bugs,vulnerabilities,sqale_rating,ncloc,reliability_rating,security_rating,security_hotspots"
```

### Only coverage and bugs

```yaml
- uses: your-org/dashbuild/modules/sonarqube@main
  with:
    token: ${{ secrets.SONAR_TOKEN }}
    project-key: "my-org_my-project"
    cache-key: "dashbuild-sonarqube"
    areas: "coverage,bugs"
```

No rating badges will appear since no rating areas are enabled.

### Self-hosted SonarQube

```yaml
- uses: your-org/dashbuild/modules/sonarqube@main
  with:
    token: ${{ secrets.SONAR_TOKEN }}
    host-url: "https://sonar.internal.company.com"
    project-key: "my-project"
    cache-key: "dashbuild-sonarqube"
```

## How Historical Data Works

When `cache-key` is set:

1. **Restore** — The action restores the previous data from GitHub Actions cache
2. **Fetch** — Today's metrics are fetched from the SonarQube API
3. **Merge** — The new entry is appended to the history (deduplicated by date)
4. **Prune** — Entries older than `retention-days` are removed
5. **Save** — The updated history is saved back to cache with a unique key (`<cache-key>-<run-id>`)

The cache key includes the run ID to ensure each run creates a new cache entry. GitHub Actions cache uses prefix matching on restore, so the latest matching key is always used.

Without `cache-key`, each run produces a single data point with no history.

## Local Development

Use the dev server to preview the SonarQube module with fixture data:

```bash
just dev sonarqube
# or
just dev all
```

The fixture at `fixtures/sonarqube.json` contains sample historical data with all areas enabled.

### Customizing areas in dev mode

Create a `.dev-config.yml` file in the project root (gitignored):

```yaml
sonarqube:
  areas:
    - coverage
    - bugs
    - sqale_rating
```

This overrides which areas are displayed during local development without modifying the fixture file.

## Testing with Real Data

You can fetch live metrics from SonarQube/SonarCloud and preview them locally. This runs the same fetch + merge pipeline that the GitHub Action uses, but writes the output into the dev fixture path so `just dev sonarqube` picks it up.

### 1. Set environment variables

```bash
export SONAR_TOKEN="your-sonarqube-api-token"
export SONAR_PROJECT_KEY="your-org_your-project"
```

For self-hosted SonarQube (not SonarCloud):

```bash
export SONAR_HOST_URL="https://sonar.internal.company.com"
```

### 2. Run the fetch script

```bash
just fetch-sonarqube
```

This calls `fetch-sonarqube.sh` which:

1. Fetches current metrics from the SonarQube API
2. Merges them into the fixture file (preserving any existing history)
3. Writes the result to `modules/sonarqube/fixtures/sonarqube.json`

You can also pass optional overrides:

```bash
# Custom areas
export SONAR_AREAS="coverage,bugs,sqale_rating,reliability_rating"

# Custom retention
export SONAR_RETENTION_DAYS="30"
```

### 3. Preview the result

```bash
just dev sonarqube
```

The dev server will use the freshly fetched data. Run the fetch again on subsequent days to build up real historical trend data.

### How it works

The fetch script pre-parses the API response into a flat metrics object, then calls the shared `scripts/lib/merge-history.js` which handles all the data merging logic:

- Loads existing history from the fixture/cache file
- Deduplicates by date (re-running on the same day replaces that day's entry)
- Prunes entries older than the retention period
- Writes the merged result back

You can also call `merge-history.js` directly if you want to merge data manually:

```bash
node scripts/lib/merge-history.js \
  '{"coverage":85.2,"bugs":3}' \
  "" \
  "coverage,bugs,sqale_rating" \
  "output.json" \
  90
```

## Report Sections

### Current Ratings

Shows rating badges for any enabled rating areas. Each badge is a colored circle (green A → red E) with a summary count beneath it.

- **Reliability** — shown when `reliability_rating` is in `areas`
- **Security** — shown when `security_rating` is in `areas`
- **Maintainability** — shown when `sqale_rating` is in `areas`

If no rating areas are enabled, this section is hidden entirely.

### Trends

Shows one trend chart per enabled area. Each card displays:

- The **current value** with a trend arrow (↗ ↘ →)
- A **delta** from the previous data point
- An **area chart** showing the metric over time

Charts are only rendered when there are 2+ data points.
