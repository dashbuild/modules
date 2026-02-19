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

const repository = process.env.GITHUB_STATS_REPOSITORY;
if (!repository) {
  console.error("::error::GITHUB_STATS_REPOSITORY is not set.");
  process.exit(1);
}

const [owner, repo] = repository.split("/");
const areasStr =
  process.env.GITHUB_STATS_AREAS ||
  "prs,issues,workflows,releases,commits,contributors,branches,languages,community";
const areas = areasStr
  .split(",")
  .map((a) => a.trim())
  .filter(Boolean);
const lookbackDays = parseInt(process.env.GITHUB_STATS_LOOKBACK_DAYS || "90", 10);
const cacheFile = process.env.GITHUB_STATS_CACHE_FILE || "";
const retentionDays = parseInt(
  process.env.GITHUB_STATS_RETENTION_DAYS || "90",
  10,
);
const maxReviewPrs = parseInt(
  process.env.GITHUB_STATS_MAX_REVIEW_PRS || "30",
  10,
);

const lookbackDate = new Date();
lookbackDate.setDate(lookbackDate.getDate() - lookbackDays);
const lookbackISO = lookbackDate.toISOString();

// ─── API helpers ────────────────────────────────────────────────────

const API_BASE = "https://api.github.com";
const headers = {
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "dashbuild-github-statistics",
};

let requestCount = 0;

async function ghFetch(path, extraHeaders = {}) {
  requestCount++;
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const res = await fetch(url, { headers: { ...headers, ...extraHeaders } });

  if (res.status === 404) return null;
  if (res.status === 403) {
    const remaining = res.headers.get("x-ratelimit-remaining");
    if (remaining === "0") {
      const resetTime = res.headers.get("x-ratelimit-reset");
      console.error(
        `::error::GitHub API rate limit exceeded. Resets at ${new Date(resetTime * 1000).toISOString()}`,
      );
      process.exit(1);
    }
    console.warn(`::warning::403 for ${path} — may lack permissions`);
    return null;
  }
  if (!res.ok) {
    console.warn(`::warning::${res.status} for ${path}`);
    return null;
  }

  return res.json();
}

async function ghFetchPaginated(path, { maxPages = 10, filter } = {}) {
  const results = [];
  let url = `${API_BASE}${path}${path.includes("?") ? "&" : "?"}per_page=100`;
  let page = 0;

  while (url && page < maxPages) {
    page++;
    requestCount++;
    const res = await fetch(url, { headers });

    if (!res.ok) {
      if (res.status === 404) break;
      console.warn(`::warning::${res.status} fetching ${url}`);
      break;
    }

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;

    if (filter) {
      let keepGoing = true;
      for (const item of data) {
        if (filter(item)) {
          results.push(item);
        } else {
          keepGoing = false;
        }
      }
      if (!keepGoing) break;
    } else {
      results.push(...data);
    }

    // Parse Link header for next page
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

async function fetchPrs() {
  console.log("  Fetching pull requests...");

  // Fetch all PRs updated within lookback window
  const allPrs = await ghFetchPaginated(
    `/repos/${owner}/${repo}/pulls?state=all&sort=updated&direction=desc`,
    {
      maxPages: 5,
      filter: (pr) => new Date(pr.updated_at) >= lookbackDate,
    },
  );

  const openPrs = allPrs.filter((pr) => pr.state === "open");
  const mergedPrs = allPrs.filter((pr) => pr.merged_at);
  const closedNotMerged = allPrs.filter(
    (pr) => pr.state === "closed" && !pr.merged_at,
  );

  // PR cycle times (for merged PRs)
  const cycleTimes = mergedPrs
    .map((pr) => {
      const created = new Date(pr.created_at);
      const merged = new Date(pr.merged_at);
      return (merged - created) / (1000 * 60 * 60); // hours
    })
    .sort((a, b) => a - b);

  // Fetch reviews for most recent merged PRs (configurable limit)
  const reviewPrs = mergedPrs.slice(0, maxReviewPrs);
  const reviewTimes = [];
  for (const pr of reviewPrs) {
    const reviews = await ghFetch(
      `/repos/${owner}/${repo}/pulls/${pr.number}/reviews`,
    );
    if (reviews && reviews.length > 0) {
      const firstReview = reviews.reduce((earliest, r) => {
        const d = new Date(r.submitted_at);
        return d < earliest ? d : earliest;
      }, new Date());
      const created = new Date(pr.created_at);
      reviewTimes.push((firstReview - created) / (1000 * 60 * 60));
    }
  }
  reviewTimes.sort((a, b) => a - b);

  // Aging buckets for open PRs
  const now = new Date();
  const agingBuckets = { "0-7": 0, "7-14": 0, "14-30": 0, "30+": 0 };
  for (const pr of openPrs) {
    const ageDays = (now - new Date(pr.created_at)) / (1000 * 60 * 60 * 24);
    if (ageDays <= 7) agingBuckets["0-7"]++;
    else if (ageDays <= 14) agingBuckets["7-14"]++;
    else if (ageDays <= 30) agingBuckets["14-30"]++;
    else agingBuckets["30+"]++;
  }

  const median = (arr) =>
    arr.length === 0 ? 0 : arr[Math.floor(arr.length / 2)];

  const openPrDetails = openPrs.slice(0, 20).map((pr) => ({
    number: pr.number,
    title: pr.title,
    author: pr.user?.login || "unknown",
    createdAt: pr.created_at,
    updatedAt: pr.updated_at,
    labels: (pr.labels || []).map((l) => l.name),
    url: pr.html_url,
  }));

  return {
    metrics: {
      prs_opened: allPrs.length,
      prs_merged: mergedPrs.length,
      prs_closed: closedNotMerged.length,
      prs_open_count: openPrs.length,
      pr_cycle_time_median_hours: Math.round(median(cycleTimes) * 10) / 10,
      pr_review_time_median_hours:
        Math.round(median(reviewTimes) * 10) / 10,
    },
    details: {
      openPrs: openPrDetails,
      prAgingBuckets: agingBuckets,
    },
  };
}

async function fetchIssues() {
  console.log("  Fetching issues...");

  const allItems = await ghFetchPaginated(
    `/repos/${owner}/${repo}/issues?state=all&sort=updated&direction=desc`,
    {
      maxPages: 5,
      filter: (item) => new Date(item.updated_at) >= lookbackDate,
    },
  );

  // GitHub issues API includes PRs — filter them out
  const issues = allItems.filter((item) => !item.pull_request);
  const openIssues = issues.filter((i) => i.state === "open");
  const closedIssues = issues.filter((i) => i.state === "closed");

  const now = new Date();
  const agingBuckets = { "0-7": 0, "7-14": 0, "14-30": 0, "30+": 0 };
  for (const issue of openIssues) {
    const ageDays =
      (now - new Date(issue.created_at)) / (1000 * 60 * 60 * 24);
    if (ageDays <= 7) agingBuckets["0-7"]++;
    else if (ageDays <= 14) agingBuckets["7-14"]++;
    else if (ageDays <= 30) agingBuckets["14-30"]++;
    else agingBuckets["30+"]++;
  }

  // Get total open issue count (not just lookback window)
  const repoData = await ghFetch(`/repos/${owner}/${repo}`);
  const totalOpenIssues = repoData?.open_issues_count ?? openIssues.length;

  return {
    metrics: {
      issues_opened: issues.length,
      issues_closed: closedIssues.length,
      issues_open_count: totalOpenIssues,
    },
    details: {
      issueAgingBuckets: agingBuckets,
    },
  };
}

async function fetchWorkflows() {
  console.log("  Fetching workflow runs...");

  const runs = await ghFetchPaginated(
    `/repos/${owner}/${repo}/actions/runs?created=>${lookbackISO.slice(0, 10)}`,
    { maxPages: 5 },
  );

  if (runs.length === 0) {
    return {
      metrics: {
        workflow_success_rate: 0,
        workflow_p50_duration_min: 0,
        workflow_p95_duration_min: 0,
      },
      details: { workflowBreakdown: [] },
    };
  }

  // Group by workflow name
  const byWorkflow = new Map();
  for (const run of runs) {
    const name = run.name || "Unknown";
    if (!byWorkflow.has(name)) {
      byWorkflow.set(name, { runs: [], successes: 0, durations: [] });
    }
    const wf = byWorkflow.get(name);
    wf.runs.push(run);
    if (run.conclusion === "success") wf.successes++;
    if (run.run_started_at && run.updated_at) {
      const duration =
        (new Date(run.updated_at) - new Date(run.run_started_at)) /
        (1000 * 60);
      if (duration > 0) wf.durations.push(duration);
    }
  }

  const percentile = (arr, p) => {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, idx)];
  };

  const workflowBreakdown = [];
  let totalRuns = 0;
  let totalSuccesses = 0;
  const allDurations = [];

  for (const [name, wf] of byWorkflow) {
    const successRate =
      wf.runs.length > 0
        ? Math.round((wf.successes / wf.runs.length) * 1000) / 10
        : 0;
    totalRuns += wf.runs.length;
    totalSuccesses += wf.successes;
    allDurations.push(...wf.durations);

    const lastRun = wf.runs[0];
    workflowBreakdown.push({
      name,
      successRate,
      p50: Math.round(percentile(wf.durations, 50) * 10) / 10,
      p95: Math.round(percentile(wf.durations, 95) * 10) / 10,
      runs: wf.runs.length,
      lastStatus: lastRun?.conclusion || "unknown",
    });
  }

  workflowBreakdown.sort((a, b) => b.runs - a.runs);

  return {
    metrics: {
      workflow_success_rate:
        totalRuns > 0
          ? Math.round((totalSuccesses / totalRuns) * 1000) / 10
          : 0,
      workflow_p50_duration_min:
        Math.round(percentile(allDurations, 50) * 10) / 10,
      workflow_p95_duration_min:
        Math.round(percentile(allDurations, 95) * 10) / 10,
    },
    details: { workflowBreakdown },
  };
}

async function fetchReleases() {
  console.log("  Fetching releases...");

  const releases = await ghFetchPaginated(
    `/repos/${owner}/${repo}/releases`,
    { maxPages: 3 },
  );

  const now = new Date();
  const latestRelease = releases.find((r) => !r.prerelease && !r.draft);
  const daysSinceLastRelease = latestRelease
    ? Math.floor(
        (now - new Date(latestRelease.published_at)) / (1000 * 60 * 60 * 24),
      )
    : -1;

  const releaseDetails = releases.slice(0, 10).map((r) => ({
    tag: r.tag_name,
    name: r.name || r.tag_name,
    date: r.published_at || r.created_at,
    prerelease: r.prerelease,
    url: r.html_url,
  }));

  return {
    metrics: {
      releases_total: releases.length,
      days_since_last_release: daysSinceLastRelease,
    },
    details: { releases: releaseDetails },
  };
}

async function fetchCommits() {
  console.log("  Fetching commit activity...");

  // This endpoint returns the last 52 weeks of commit activity
  const data = await ghFetch(`/repos/${owner}/${repo}/stats/commit_activity`);

  if (!data || !Array.isArray(data)) {
    return {
      metrics: { commits_last_week: 0, net_churn_last_week: 0 },
      details: { commitActivity: [] },
    };
  }

  const commitActivity = data
    .filter((week) => week.total > 0)
    .slice(-12)
    .map((week) => ({
      week: new Date(week.week * 1000).toISOString().slice(0, 10),
      total: week.total,
    }));

  const lastWeek = data[data.length - 1];

  return {
    metrics: {
      commits_last_week: lastWeek?.total || 0,
    },
    details: { commitActivity },
  };
}

async function fetchContributors() {
  console.log("  Fetching contributors...");

  // Returns contributor stats for the repo
  const data = await ghFetch(`/repos/${owner}/${repo}/stats/contributors`);

  if (!data || !Array.isArray(data)) {
    return {
      metrics: { contributors_active_30d: 0 },
      details: { topContributors: [] },
    };
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  let active30d = 0;
  const contributors = data
    .map((c) => {
      const totalCommits = c.total;
      let additions = 0;
      let deletions = 0;
      let recentCommits = 0;

      for (const week of c.weeks) {
        additions += week.a;
        deletions += week.d;
        if (new Date(week.w * 1000) >= thirtyDaysAgo) {
          recentCommits += week.c;
        }
      }

      if (recentCommits > 0) active30d++;

      return {
        login: c.author?.login || "unknown",
        commits: totalCommits,
        additions,
        deletions,
      };
    })
    .sort((a, b) => b.commits - a.commits)
    .slice(0, 10);

  return {
    metrics: { contributors_active_30d: active30d },
    details: { topContributors: contributors },
  };
}

async function fetchBranches() {
  console.log("  Fetching branches...");

  const branches = await ghFetchPaginated(
    `/repos/${owner}/${repo}/branches`,
    { maxPages: 3 },
  );

  // Get default branch info
  const repoData = await ghFetch(`/repos/${owner}/${repo}`);
  const defaultBranch = repoData?.default_branch || "main";

  // Check for stale branches (not updated in 90+ days)
  const staleCutoff = new Date();
  staleCutoff.setDate(staleCutoff.getDate() - 90);

  const staleBranches = [];
  for (const branch of branches) {
    if (branch.name === defaultBranch) continue;
    // Branch commit info requires individual fetch — just collect names
    // The API doesn't give us commit dates on the list endpoint directly
    // We'll check a sample of branches to avoid excessive API calls
    if (staleBranches.length >= 20) break;
  }

  // For stale detection, we fetch the last commit for non-default branches
  // Cap at 20 branches to avoid excessive API calls
  const branchesToCheck = branches
    .filter((b) => b.name !== defaultBranch)
    .slice(0, 20);

  let staleCount = 0;
  const staleNames = [];
  for (const branch of branchesToCheck) {
    if (branch.commit?.sha) {
      const commit = await ghFetch(
        `/repos/${owner}/${repo}/commits/${branch.commit.sha}`,
      );
      if (commit?.commit?.committer?.date) {
        const commitDate = new Date(commit.commit.committer.date);
        if (commitDate < staleCutoff) {
          staleCount++;
          staleNames.push(branch.name);
        }
      }
    }
  }

  return {
    metrics: {
      branches_total: branches.length,
      branches_stale: staleCount,
    },
    details: { staleBranches: staleNames },
  };
}

async function fetchLanguages() {
  console.log("  Fetching languages...");

  const data = await ghFetch(`/repos/${owner}/${repo}/languages`);

  return {
    metrics: {},
    details: { languages: data || {} },
  };
}

async function fetchCommunity() {
  console.log("  Fetching community profile...");

  // Try the community profile endpoint (works for public repos)
  const profile = await ghFetch(
    `/repos/${owner}/${repo}/community/profile`,
  );

  if (profile) {
    return {
      metrics: {},
      details: {
        communityProfile: {
          hasReadme: !!profile.files?.readme,
          hasLicense: !!profile.files?.license,
          hasContributing: !!profile.files?.contributing,
          hasCodeOfConduct: !!profile.files?.code_of_conduct,
          hasCodeowners: !!profile.files?.code_of_conduct_file,
          hasSecurity: !!profile.files?.security,
          hasIssueTemplate: !!profile.files?.issue_template,
          hasPrTemplate: !!profile.files?.pull_request_template,
        },
      },
    };
  }

  // Fallback for private repos: check individual files via the tree
  const tree = await ghFetch(
    `/repos/${owner}/${repo}/git/trees/HEAD?recursive=false`,
  );
  const fileNames = (tree?.tree || []).map((f) => f.path.toLowerCase());

  const check = (patterns) =>
    patterns.some((p) => fileNames.some((f) => f.includes(p)));

  return {
    metrics: {},
    details: {
      communityProfile: {
        hasReadme: check(["readme"]),
        hasLicense: check(["license"]),
        hasContributing: check(["contributing"]),
        hasCodeOfConduct: check(["code_of_conduct"]),
        hasCodeowners: check(["codeowners"]),
        hasSecurity: check(["security"]),
        hasIssueTemplate: check([".github/issue_template"]),
        hasPrTemplate: check([".github/pull_request_template"]),
      },
    },
  };
}

async function fetchTraffic() {
  console.log("  Fetching traffic (requires push access)...");

  const [views, clones, referrers, paths] = await Promise.all([
    ghFetch(`/repos/${owner}/${repo}/traffic/views`),
    ghFetch(`/repos/${owner}/${repo}/traffic/clones`),
    ghFetch(`/repos/${owner}/${repo}/traffic/popular/referrers`),
    ghFetch(`/repos/${owner}/${repo}/traffic/popular/paths`),
  ]);

  if (!views) {
    console.warn(
      "  ::warning::Traffic data unavailable (requires push access)",
    );
    return { metrics: {}, details: {} };
  }

  return {
    metrics: {
      traffic_views_14d: views.count || 0,
      traffic_uniques_14d: views.uniques || 0,
    },
    details: {
      traffic: {
        views: views.views || [],
        clones: clones?.clones || [],
        referrers: referrers || [],
        paths: paths || [],
      },
    },
  };
}

async function fetchStars() {
  console.log("  Fetching star history...");

  // Fetch stargazers with timestamps
  const stargazers = await ghFetchPaginated(
    `/repos/${owner}/${repo}/stargazers`,
    {
      maxPages: 2,
    },
  );

  // The timestamp header is needed for starred_at dates
  const stargazersWithDates = await ghFetchPaginated(
    `/repos/${owner}/${repo}/stargazers`,
    {
      maxPages: 2,
    },
  );

  // Get total stars from repo data
  const repoData = await ghFetch(`/repos/${owner}/${repo}`);
  const totalStars = repoData?.stargazers_count || 0;

  return {
    metrics: { stars_total: totalStars },
    details: { starHistory: [] },
  };
}

async function fetchForks() {
  console.log("  Fetching forks...");

  const repoData = await ghFetch(`/repos/${owner}/${repo}`);

  return {
    metrics: { forks_total: repoData?.forks_count || 0 },
    details: {},
  };
}

// ─── Main ───────────────────────────────────────────────────────────

console.log("::group::Fetching GitHub statistics");
console.log(`Repository: ${owner}/${repo}`);
console.log(`Areas: ${areas.join(", ")}`);
console.log(`Lookback: ${lookbackDays} days`);
console.log(`Max review PRs: ${maxReviewPrs}`);

const metrics = {};
const details = {};

const areaFetchers = {
  prs: fetchPrs,
  issues: fetchIssues,
  workflows: fetchWorkflows,
  releases: fetchReleases,
  commits: fetchCommits,
  contributors: fetchContributors,
  branches: fetchBranches,
  languages: fetchLanguages,
  community: fetchCommunity,
  traffic: fetchTraffic,
  stars: fetchStars,
  forks: fetchForks,
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

// ─── Detect repo visibility ─────────────────────────────────────────

let visibility = "private";
try {
  const repoData = await ghFetch(`/repos/${owner}/${repo}`);
  if (repoData) visibility = repoData.private ? "private" : "public";
} catch {
  // keep default
}

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

// Attach details and config to the output (details are point-in-time, not historical)
const finalOutput = {
  ...historyData,
  config: {
    areas,
    repository: `${owner}/${repo}`,
    lookbackDays,
    visibility,
  },
  details,
};

writeFileSync(outputFile, JSON.stringify(finalOutput, null, 2), "utf-8");
console.log(`Data written to ${outputFile}`);

// Update cache if provided
if (cacheFile) {
  mkdirSync(dirname(cacheFile), { recursive: true });
  writeFileSync(cacheFile, JSON.stringify(finalOutput, null, 2), "utf-8");
  console.log(`Cache updated at ${cacheFile}`);
}

console.log("::endgroup::");
