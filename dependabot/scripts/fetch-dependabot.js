import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const moduleDir = join(__dirname, "..");
const moduleConfig = JSON.parse(
  readFileSync(join(moduleDir, "module.json"), "utf-8"),
);
const slug = moduleConfig.slug;

// ─── Environment ────────────────────────────────────────────────────

const dashbuildDir = process.env.DASHBUILD_DIR;
if (!dashbuildDir) {
  console.error(
    "::error::DASHBUILD_DIR is not set. Did you run dashbuild/setup first?",
  );
  process.exit(1);
}

const token = process.env.GITHUB_TOKEN;
if (!token) {
  console.error("::error::GITHUB_TOKEN is not set.");
  process.exit(1);
}

const repository = process.env.DEPENDABOT_REPOSITORY;
if (!repository) {
  console.error("::error::DEPENDABOT_REPOSITORY is not set.");
  process.exit(1);
}

const [owner, repo] = repository.split("/");
const areasStr =
  process.env.DEPENDABOT_AREAS || "dependabot,code-scanning,secret-scanning";
const areas = areasStr
  .split(",")
  .map((a) => a.trim())
  .filter(Boolean);
const cacheFile = process.env.DEPENDABOT_CACHE_FILE || "";
const retentionDays = parseInt(
  process.env.DEPENDABOT_RETENTION_DAYS || "90",
  10,
);

// ─── API helpers ────────────────────────────────────────────────────

const API_BASE = "https://api.github.com";
const headers = {
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "dashbuild-dependabot",
};

let requestCount = 0;

async function ghFetch(path) {
  requestCount++;
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const res = await fetch(url, { headers });

  if (res.status === 404) {
    console.warn(`  ::warning::404 for ${path} — feature may not be enabled`);
    return null;
  }
  if (res.status === 403) {
    const remaining = res.headers.get("x-ratelimit-remaining");
    if (remaining === "0") {
      const resetTime = res.headers.get("x-ratelimit-reset");
      console.error(
        `::error::GitHub API rate limit exceeded. Resets at ${new Date(resetTime * 1000).toISOString()}`,
      );
      process.exit(1);
    }
    console.warn(`  ::warning::403 for ${path} — may lack permissions`);
    return null;
  }
  if (!res.ok) {
    console.warn(`  ::warning::${res.status} for ${path}`);
    return null;
  }

  return res.json();
}

async function ghFetchPaginated(path, { maxPages = 10 } = {}) {
  const results = [];
  let url = `${API_BASE}${path}${path.includes("?") ? "&" : "?"}per_page=100`;
  let page = 0;

  while (url && page < maxPages) {
    page++;
    requestCount++;
    const res = await fetch(url, { headers });

    if (!res.ok) {
      if (res.status === 404) {
        console.warn(
          `  ::warning::404 for ${path} — feature may not be enabled`,
        );
      } else {
        console.warn(`  ::warning::${res.status} fetching ${url}`);
      }
      break;
    }

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;
    results.push(...data);

    const linkHeader = res.headers.get("link");
    if (linkHeader) {
      const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
      url = nextMatch ? nextMatch[1] : null;
    } else {
      url = null;
    }
  }

  return results;
}

// ─── Area fetchers ──────────────────────────────────────────────────

async function fetchDependabotAlerts() {
  console.log("  Fetching Dependabot alerts...");

  const openAlerts = await ghFetchPaginated(
    `/repos/${owner}/${repo}/dependabot/alerts?state=open&sort=created&direction=desc`,
    { maxPages: 3 },
  );

  if (openAlerts === null) {
    return { metrics: {}, details: {} };
  }

  // Count recently fixed (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const fixedAlerts = await ghFetchPaginated(
    `/repos/${owner}/${repo}/dependabot/alerts?state=fixed&sort=updated&direction=desc`,
    { maxPages: 2 },
  );

  const fixedRecently = (fixedAlerts || []).filter(
    (a) => a.fixed_at && new Date(a.fixed_at) >= thirtyDaysAgo,
  ).length;

  // Count by severity
  const severityCounts = { critical: 0, high: 0, medium: 0, low: 0 };
  const ecosystemCounts = {};

  const alertDetails = openAlerts.map((alert) => {
    const severity = alert.security_advisory?.severity || "low";
    severityCounts[severity] = (severityCounts[severity] || 0) + 1;

    const ecosystem =
      alert.dependency?.package?.ecosystem || "unknown";
    ecosystemCounts[ecosystem] = (ecosystemCounts[ecosystem] || 0) + 1;

    return {
      number: alert.number,
      severity,
      package: alert.dependency?.package?.name || "unknown",
      ecosystem,
      cve:
        alert.security_advisory?.cve_id ||
        alert.security_advisory?.ghsa_id ||
        "—",
      cvss: alert.security_advisory?.cvss?.score || null,
      summary: alert.security_advisory?.summary || "No description",
      createdAt: alert.created_at,
      url: alert.html_url,
      manifestPath: alert.dependency?.manifest_path || "",
    };
  });

  // Fetch Dependabot PRs
  console.log("  Fetching Dependabot PRs...");
  const allPrs = await ghFetchPaginated(
    `/repos/${owner}/${repo}/pulls?state=all&sort=updated&direction=desc`,
    { maxPages: 3 },
  );

  const dependabotPrs = (allPrs || []).filter(
    (pr) =>
      pr.user?.login === "dependabot[bot]" ||
      pr.user?.login === "dependabot",
  );

  const openDependabotPrs = dependabotPrs.filter(
    (pr) => pr.state === "open",
  );
  const mergedDependabotPrs = dependabotPrs.filter(
    (pr) => pr.merged_at && new Date(pr.merged_at) >= thirtyDaysAgo,
  );

  const prDetails = dependabotPrs.slice(0, 10).map((pr) => ({
    number: pr.number,
    title: pr.title,
    state: pr.merged_at ? "merged" : pr.state,
    createdAt: pr.created_at,
    mergedAt: pr.merged_at || null,
    url: pr.html_url,
  }));

  return {
    metrics: {
      dependabot_critical: severityCounts.critical,
      dependabot_high: severityCounts.high,
      dependabot_medium: severityCounts.medium,
      dependabot_low: severityCounts.low,
      dependabot_total_open: openAlerts.length,
      dependabot_fixed_30d: fixedRecently,
      dependabot_prs_open: openDependabotPrs.length,
      dependabot_prs_merged_30d: mergedDependabotPrs.length,
    },
    details: {
      dependabotAlerts: alertDetails,
      dependabotPrs: prDetails,
      severityCounts,
      ecosystemCounts,
    },
  };
}

async function fetchCodeScanningAlerts() {
  console.log("  Fetching code scanning alerts...");

  const alerts = await ghFetchPaginated(
    `/repos/${owner}/${repo}/code-scanning/alerts?state=open&sort=created&direction=desc`,
    { maxPages: 3 },
  );

  if (alerts === null || !Array.isArray(alerts)) {
    return { metrics: {}, details: {} };
  }

  let errors = 0;
  let warnings = 0;
  let notes = 0;

  const alertDetails = alerts.map((alert) => {
    const severity =
      alert.rule?.security_severity_level || alert.rule?.severity || "note";
    if (severity === "error" || severity === "critical" || severity === "high")
      errors++;
    else if (severity === "warning" || severity === "medium") warnings++;
    else notes++;

    return {
      number: alert.number,
      severity:
        severity === "critical" || severity === "high"
          ? "error"
          : severity === "medium"
            ? "warning"
            : severity === "error"
              ? "error"
              : severity === "warning"
                ? "warning"
                : "note",
      rule: alert.rule?.id || "unknown",
      tool: alert.tool?.name || "unknown",
      description: alert.rule?.description || alert.message?.text || "",
      location: alert.most_recent_instance?.location
        ? {
            path: alert.most_recent_instance.location.path,
            startLine: alert.most_recent_instance.location.start_line,
            endLine: alert.most_recent_instance.location.end_line,
          }
        : null,
      createdAt: alert.created_at,
      url: alert.html_url,
    };
  });

  return {
    metrics: {
      code_scanning_errors: errors,
      code_scanning_warnings: warnings,
      code_scanning_notes: notes,
      code_scanning_total_open: alerts.length,
    },
    details: {
      codeScanningAlerts: alertDetails,
    },
  };
}

async function fetchSecretScanningAlerts() {
  console.log("  Fetching secret scanning alerts...");

  const openAlerts = await ghFetchPaginated(
    `/repos/${owner}/${repo}/secret-scanning/alerts?state=open`,
    { maxPages: 2 },
  );

  if (openAlerts === null) {
    return { metrics: {}, details: {} };
  }

  const resolvedAlerts = await ghFetchPaginated(
    `/repos/${owner}/${repo}/secret-scanning/alerts?state=resolved`,
    { maxPages: 2 },
  );

  const alertDetails = (openAlerts || []).map((alert) => ({
    number: alert.number,
    secretType: alert.secret_type_display_name || alert.secret_type || "unknown",
    createdAt: alert.created_at,
    url: alert.html_url,
  }));

  return {
    metrics: {
      secret_scanning_open: (openAlerts || []).length,
      secret_scanning_resolved: (resolvedAlerts || []).length,
    },
    details: {
      secretScanningAlerts: alertDetails,
    },
  };
}

// ─── Main ───────────────────────────────────────────────────────────

console.log("::group::Fetching Dependabot / security data");
console.log(`Repository: ${owner}/${repo}`);
console.log(`Areas: ${areas.join(", ")}`);

const metrics = {};
const details = {};

const areaFetchers = {
  dependabot: fetchDependabotAlerts,
  "code-scanning": fetchCodeScanningAlerts,
  "secret-scanning": fetchSecretScanningAlerts,
};

for (const area of areas) {
  const fetcher = areaFetchers[area];
  if (!fetcher) {
    console.warn(`::warning::Unknown area: ${area}`);
    continue;
  }

  try {
    const result = await fetcher();
    Object.assign(metrics, result.metrics);
    Object.assign(details, result.details);
  } catch (err) {
    console.warn(`::warning::Failed to fetch ${area}: ${err.message}`);
  }
}

console.log(`Total API requests: ${requestCount}`);

// ─── Build output via merge-history ─────────────────────────────────

const outputFile = join(dashbuildDir, "src", "data", `${slug}.json`);
mkdirSync(dirname(outputFile), { recursive: true });

// Find merge-history.js
let dbRoot = __dirname;
while (!existsSync(join(dbRoot, "scripts", "lib"))) {
  const parent = dirname(dbRoot);
  if (parent === dbRoot) {
    console.error("::error::Cannot find Dashbuild root");
    process.exit(1);
  }
  dbRoot = parent;
}

const { mergeHistory } = await import(
  join(dbRoot, "scripts", "lib", "merge-history.js")
);

const historyData = mergeHistory({
  todaysMetrics: metrics,
  cacheFilePath: cacheFile,
  areas,
  outputFilePath: outputFile,
  retentionDays,
});

// Attach details and config to the output
const finalOutput = {
  ...historyData,
  config: {
    areas,
    repository: `${owner}/${repo}`,
  },
  details,
};

writeFileSync(outputFile, JSON.stringify(finalOutput, null, 2), "utf-8");
console.log(`Data written to ${outputFile}`);

if (cacheFile) {
  mkdirSync(dirname(cacheFile), { recursive: true });
  writeFileSync(cacheFile, JSON.stringify(finalOutput, null, 2), "utf-8");
  console.log(`Cache updated at ${cacheFile}`);
}

console.log("::endgroup::");
