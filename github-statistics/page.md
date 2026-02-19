---
title: GitHub Statistics
style: github-statistics-theme.css
toc: false
---

# GitHub Statistics

```js
const data = /*INLINE_DATA*/ {};
```

```js
import { buildTrendChart } from "./components/trendChart.js";
import {
  summaryCard,
  metricGrid,
  sectionHeader,
  segmentBar,
  barLegend,
  pillList,
} from "./components/dashbuild-components.js";
```

```js
const enabledAreas = new Set(data.config?.areas || []);
const visibility = data.config?.visibility || "private";
const repoName = data.config?.repository || "unknown";

const metricHistory = (data.history || []).map((entry) => ({
  ...entry,
  date: new Date(entry.date),
}));

const latestMetrics = metricHistory[metricHistory.length - 1]?.metrics ?? {};
const details = data.details || {};
```

```js
function ghChart(metricKey, opts) {
  return buildTrendChart(metricHistory, latestMetrics, metricKey, opts);
}

function daysSince(dateStr) {
  if (!dateStr) return "—";
  const d = Math.floor(
    (new Date() - new Date(dateStr)) / (1000 * 60 * 60 * 24),
  );
  if (d === 0) return "today";
  if (d === 1) return "1 day ago";
  return `${d} days ago`;
}

function formatHours(h) {
  if (h == null || h === 0) return "—";
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h < 24) return `${Math.round(h * 10) / 10}h`;
  const days = Math.floor(h / 24);
  const rem = Math.round(h % 24);
  return rem > 0 ? `${days}d ${rem}h` : `${days}d`;
}

function statusDot(status) {
  const color =
    status === "success"
      ? "var(--gh-green)"
      : status === "failure"
        ? "var(--gh-red)"
        : "var(--gh-orange)";
  return html`<span
    class="dash-status-dot"
    style="background:${color}"
  ></span>`;
}

function rawHtml(str) {
  const tpl = document.createElement("template");
  tpl.innerHTML = str;
  return tpl.content.cloneNode(true);
}

const agingSegmentConfig = (buckets) => [
  {
    value: buckets["0-7"] || 0,
    color: "var(--gh-green)",
    label: buckets["0-7"],
  },
  {
    value: buckets["7-14"] || 0,
    color: "var(--gh-blue)",
    label: buckets["7-14"],
  },
  {
    value: buckets["14-30"] || 0,
    color: "var(--gh-orange)",
    label: buckets["14-30"],
  },
  { value: buckets["30+"] || 0, color: "var(--gh-red)", label: buckets["30+"] },
];

const agingLegendConfig = [
  { color: "var(--gh-green)", label: "< 7d" },
  { color: "var(--gh-blue)", label: "7–14d" },
  { color: "var(--gh-orange)", label: "14–30d" },
  { color: "var(--gh-red)", label: "30d+" },
];
```

<div class="dash-section" style="--si:0">
<div class="muted" style="font-size: 0.85rem; margin-bottom: 0.75rem;">
  Repository: <strong>${repoName}</strong> · Lookback: ${data.config?.lookbackDays || 90} days · Visibility: ${visibility}
</div>
</div>

```js
// ─── Summary cards ──────────────────────────────────────────────────
const summaryMetrics = [];

if (enabledAreas.has("prs")) {
  summaryMetrics.push({
    key: "prs_open_count",
    label: "Open PRs",
    colorClass: "accent-primary",
  });
}
if (enabledAreas.has("issues")) {
  summaryMetrics.push({
    key: "issues_open_count",
    label: "Open Issues",
    colorClass: "accent-primary",
    inverse: true,
  });
}
if (enabledAreas.has("workflows")) {
  summaryMetrics.push({
    key: "workflow_success_rate",
    label: "CI Success Rate",
    suffix: "%",
    colorClass: "green",
  });
}
if (enabledAreas.has("releases")) {
  summaryMetrics.push({
    key: "days_since_last_release",
    label: "Days Since Release",
    colorClass: "accent-primary",
    inverse: true,
    neutral: true,
  });
}
if (enabledAreas.has("contributors")) {
  summaryMetrics.push({
    key: "contributors_active_30d",
    label: "Active Contributors (30d)",
    colorClass: "accent-secondary",
  });
}

display(
  metricGrid(summaryMetrics, latestMetrics, metricHistory, {
    cols: 3,
    sectionIndex: 1,
  }),
);
```

```js
// ─── Pull Requests ──────────────────────────────────────────────────
if (enabledAreas.has("prs")) {
  const prThroughputCards = [];

  prThroughputCards.push(
    ghChart("prs_merged", {
      title: "PRs Merged",
      color: "var(--gh-chart-green)",
    }),
  );
  prThroughputCards.push(
    ghChart("prs_opened", {
      title: "PRs Opened",
      color: "var(--gh-chart-blue)",
      neutral: true,
    }),
  );
  prThroughputCards.push(
    ghChart("pr_cycle_time_median_hours", {
      title: "Cycle Time (median)",
      color: "var(--gh-chart-orange)",
      inverse: true,
      valueFormat: (v) => formatHours(v),
      tickFormat: (d) => formatHours(d),
    }),
  );
  prThroughputCards.push(
    ghChart("pr_review_time_median_hours", {
      title: "Time to First Review",
      color: "var(--gh-chart-purple)",
      inverse: true,
      valueFormat: (v) => formatHours(v),
      tickFormat: (d) => formatHours(d),
    }),
  );

  const agingBuckets = details.prAgingBuckets || {};

  const agingBar = segmentBar(agingSegmentConfig(agingBuckets), {
    emptyText: "No open PRs",
  });
  const agingLegend = barLegend(agingLegendConfig);

  // Open PRs table
  const openPrs = details.openPrs || [];
  let prTableHtml = "";
  if (openPrs.length > 0) {
    const rows = openPrs
      .map(
        (pr) =>
          `<tr>
        <td><a href="${pr.url}" target="_blank" style="color:var(--gh-blue)">#${pr.number}</a></td>
        <td>${pr.title}</td>
        <td>${pr.author}</td>
        <td>${daysSince(pr.createdAt)}</td>
      </tr>`,
      )
      .join("");
    prTableHtml = `<table class="dash-table">
      <thead><tr><th>#</th><th>Title</th><th>Author</th><th>Opened</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  }

  display(
    html`<div class="dash-section" style="--si:2">
      <h2>Pull Requests</h2>
      <div class="grid grid-cols-2 skel-charts-2">${prThroughputCards}</div>
      <h3>Open PR Age Distribution</h3>
      ${agingBar} ${agingLegend}
      ${prTableHtml
        ? html`<h3>Open Pull Requests</h3>
            ${rawHtml(prTableHtml)}`
        : ""}
    </div>`,
  );
}
```

```js
// ─── Issues ─────────────────────────────────────────────────────────
if (enabledAreas.has("issues")) {
  const issueCards = [];

  issueCards.push(
    ghChart("issues_closed", {
      title: "Issues Closed",
      color: "var(--gh-chart-green)",
    }),
  );
  issueCards.push(
    ghChart("issues_open_count", {
      title: "Open Issues",
      color: "var(--gh-chart-orange)",
      inverse: true,
    }),
  );

  const agingBuckets = details.issueAgingBuckets || {};

  const agingBar = segmentBar(agingSegmentConfig(agingBuckets), {
    emptyText: "No open issues",
  });
  const agingLegend = barLegend(agingLegendConfig);

  display(
    html`<div class="dash-section" style="--si:3">
      <h2>Issues</h2>
      <div class="grid grid-cols-2 skel-charts-2">${issueCards}</div>
      <h3>Open Issue Age Distribution</h3>
      ${agingBar} ${agingLegend}
    </div>`,
  );
}
```

```js
// ─── Workflows / CI ─────────────────────────────────────────────────
if (enabledAreas.has("workflows")) {
  const ciCards = [];

  ciCards.push(
    ghChart("workflow_success_rate", {
      title: "Success Rate",
      color: "var(--gh-chart-green)",
      suffix: "%",
    }),
  );
  ciCards.push(
    ghChart("workflow_p50_duration_min", {
      title: "Duration (p50)",
      color: "var(--gh-chart-blue)",
      inverse: true,
      suffix: "m",
    }),
  );

  const workflows = details.workflowBreakdown || [];
  let wfTableHtml = "";
  if (workflows.length > 0) {
    const rows = workflows
      .map(
        (wf) =>
          `<tr>
        <td>${wf.name}</td>
        <td style="color:${wf.successRate >= 95 ? "var(--gh-green)" : wf.successRate >= 80 ? "var(--gh-orange)" : "var(--gh-red)"}">${wf.successRate}%</td>
        <td>${wf.p50}m</td>
        <td>${wf.p95}m</td>
        <td>${wf.runs}</td>
      </tr>`,
      )
      .join("");
    wfTableHtml = `<table class="dash-table">
      <thead><tr><th>Workflow</th><th>Success Rate</th><th>p50</th><th>p95</th><th>Runs</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  }

  display(
    html`<div class="dash-section" style="--si:4">
      <h2>CI / Workflows</h2>
      <div class="grid grid-cols-2 skel-charts-2">${ciCards}</div>
      ${wfTableHtml
        ? html`<h3>Workflow Breakdown</h3>
            ${rawHtml(wfTableHtml)}`
        : ""}
    </div>`,
  );
}
```

```js
// ─── Releases ───────────────────────────────────────────────────────
if (enabledAreas.has("releases")) {
  const releaseCards = [];

  releaseCards.push(
    ghChart("releases_total", {
      title: "Total Releases",
      color: "var(--gh-chart-blue)",
      neutral: true,
    }),
  );

  const releases = details.releases || [];
  let releaseTableHtml = "";
  if (releases.length > 0) {
    const rows = releases
      .map(
        (r) =>
          `<tr>
        <td><a href="${r.url}" target="_blank" style="color:var(--gh-blue)">${r.tag}</a></td>
        <td>${r.name}</td>
        <td>${new Date(r.date).toLocaleDateString()}</td>
        <td>${r.prerelease ? '<span style="color:var(--gh-orange)">pre-release</span>' : '<span style="color:var(--gh-green)">stable</span>'}</td>
      </tr>`,
      )
      .join("");
    releaseTableHtml = `<table class="dash-table">
      <thead><tr><th>Tag</th><th>Name</th><th>Date</th><th>Type</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  }

  display(
    html`<div class="dash-section" style="--si:5">
      <h2>Releases</h2>
      <div class="grid grid-cols-2 skel-charts-2">${releaseCards}</div>
      ${releaseTableHtml
        ? html`<h3>Recent Releases</h3>
            ${rawHtml(releaseTableHtml)}`
        : ""}
    </div>`,
  );
}
```

```js
// ─── Commit Activity & Contributors ─────────────────────────────────
if (enabledAreas.has("commits") || enabledAreas.has("contributors")) {
  const activityCards = [];

  if (enabledAreas.has("commits")) {
    activityCards.push(
      ghChart("commits_last_week", {
        title: "Commits (last week)",
        color: "var(--gh-chart-green)",
        neutral: true,
      }),
    );
  }

  const contributors = details.topContributors || [];
  let contribTableHtml = "";
  if (enabledAreas.has("contributors") && contributors.length > 0) {
    const totalCommits = contributors.reduce((s, c) => s + c.commits, 0);
    const rows = contributors
      .map((c) => {
        const pct =
          totalCommits > 0 ? Math.round((c.commits / totalCommits) * 100) : 0;
        return `<tr>
        <td>${c.login}</td>
        <td>${c.commits.toLocaleString()}</td>
        <td style="color:var(--gh-green)">+${c.additions.toLocaleString()}</td>
        <td style="color:var(--gh-red)">-${c.deletions.toLocaleString()}</td>
        <td>${pct}%</td>
      </tr>`;
      })
      .join("");
    contribTableHtml = `<table class="dash-table">
      <thead><tr><th>Contributor</th><th>Commits</th><th>Additions</th><th>Deletions</th><th>Share</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  }

  display(
    html`<div class="dash-section" style="--si:6">
      <h2>Activity</h2>
      ${activityCards.length > 0
        ? html`<div class="grid grid-cols-2 skel-charts-2">
            ${activityCards}
          </div>`
        : ""}
      ${contribTableHtml
        ? html`<h3>Top Contributors</h3>
            ${rawHtml(contribTableHtml)}`
        : ""}
    </div>`,
  );
}
```

```js
// ─── Repository Health ──────────────────────────────────────────────
if (
  enabledAreas.has("branches") ||
  enabledAreas.has("languages") ||
  enabledAreas.has("community")
) {
  // Languages bar
  const languages = details.languages || {};
  const langEntries = Object.entries(languages).sort((a, b) => b[1] - a[1]);
  const langTotal = langEntries.reduce((s, [, v]) => s + v, 0);

  const langColors = [
    "#f1e05a",
    "#3178c6",
    "#89e051",
    "#e34c26",
    "#563d7c",
    "#dea584",
    "#b07219",
    "#4F5D95",
  ];

  let langBar = "";
  let langLegend = "";
  if (langEntries.length > 0 && enabledAreas.has("languages")) {
    langBar = segmentBar(
      langEntries.map(([lang, bytes], i) => ({
        value: bytes,
        color: langColors[i % langColors.length],
      })),
      { thin: true },
    );

    langLegend = barLegend(
      langEntries.map(([lang, bytes], i) => ({
        color: langColors[i % langColors.length],
        label: `${lang} ${Math.round((bytes / langTotal) * 100)}%`,
      })),
    );
  }

  // Community checklist
  const community = details.communityProfile || {};
  const communityChecks = [
    { key: "hasReadme", label: "README" },
    { key: "hasLicense", label: "LICENSE" },
    { key: "hasContributing", label: "CONTRIBUTING" },
    { key: "hasCodeOfConduct", label: "Code of Conduct" },
    { key: "hasCodeowners", label: "CODEOWNERS" },
    { key: "hasSecurity", label: "SECURITY" },
    { key: "hasIssueTemplate", label: "Issue Template" },
    { key: "hasPrTemplate", label: "PR Template" },
  ];

  let communityHtml = "";
  if (enabledAreas.has("community") && Object.keys(community).length > 0) {
    const items = communityChecks
      .map(
        (c) =>
          `<li><span class="check ${community[c.key] ? "yes" : "no"}">${community[c.key] ? "✓" : "✗"}</span>${c.label}</li>`,
      )
      .join("");
    communityHtml = `<ul class="community-list">${items}</ul>`;
  }

  // Branches
  const staleBranches = details.staleBranches || [];
  let branchHtml = "";
  if (enabledAreas.has("branches")) {
    const branchMetrics = [];
    branchMetrics.push({
      key: "branches_total",
      label: "Total Branches",
      colorClass: "accent-primary",
      neutral: true,
    });
    branchMetrics.push({
      key: "branches_stale",
      label: "Stale Branches (90d+)",
      colorClass: "red",
      inverse: true,
    });

    const branchCards = metricGrid(
      branchMetrics,
      latestMetrics,
      metricHistory,
      {
        cols: 2,
        sectionIndex: 7,
      },
    );

    const stalePills =
      staleBranches.length > 0
        ? pillList(
            staleBranches.map((b) => ({
              label: b,
              color: "var(--gh-red)",
              bg: "rgba(248, 81, 73, 0.1)",
              border: "rgba(248, 81, 73, 0.3)",
              mono: true,
            })),
          )
        : "";

    display(
      html`<div class="dash-section" style="--si:7">
        <h2>Repository Health</h2>
        ${branchCards}
        ${stalePills
          ? html`<h3>Stale Branches</h3>
              ${stalePills}`
          : ""}
        ${langBar
          ? html`<h3>Language Breakdown</h3>
              ${langBar}${langLegend}`
          : ""}
        ${communityHtml
          ? html`<h3>Community Scorecard</h3>
              ${rawHtml(communityHtml)}`
          : ""}
      </div>`,
    );
  } else {
    display(
      html`<div class="dash-section" style="--si:7">
        <h2>Repository Health</h2>
        ${langBar
          ? html`<h3>Language Breakdown</h3>
              ${langBar}${langLegend}`
          : ""}
        ${communityHtml
          ? html`<h3>Community Scorecard</h3>
              ${rawHtml(communityHtml)}`
          : ""}
      </div>`,
    );
  }
}
```

```js
// ─── Traffic (public repos only) ────────────────────────────────────
if (enabledAreas.has("traffic") && details.traffic) {
  const traffic = details.traffic;

  const trafficCards = [];
  trafficCards.push(
    ghChart("traffic_views_14d", {
      title: "Views (14d)",
      color: "var(--gh-chart-blue)",
      neutral: true,
    }),
  );
  trafficCards.push(
    ghChart("traffic_uniques_14d", {
      title: "Unique Visitors (14d)",
      color: "var(--gh-chart-green)",
      neutral: true,
    }),
  );

  // Referrers table
  const referrers = traffic.referrers || [];
  let referrerTableHtml = "";
  if (referrers.length > 0) {
    const rows = referrers
      .map(
        (r) =>
          `<tr><td>${r.referrer}</td><td>${r.count}</td><td>${r.uniques}</td></tr>`,
      )
      .join("");
    referrerTableHtml = `<table class="dash-table">
      <thead><tr><th>Referrer</th><th>Views</th><th>Uniques</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  }

  // Top paths table
  const paths = traffic.paths || [];
  let pathsTableHtml = "";
  if (paths.length > 0) {
    const rows = paths
      .map(
        (p) =>
          `<tr><td>${p.path}</td><td>${p.count}</td><td>${p.uniques}</td></tr>`,
      )
      .join("");
    pathsTableHtml = `<table class="dash-table">
      <thead><tr><th>Path</th><th>Views</th><th>Uniques</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  }

  display(
    html`<div class="dash-section" style="--si:8">
      <h2>Traffic</h2>
      <div class="grid grid-cols-2 skel-charts-2">${trafficCards}</div>
      ${referrerTableHtml
        ? html`<h3>Top Referrers</h3>
            ${rawHtml(referrerTableHtml)}`
        : ""}
      ${pathsTableHtml
        ? html`<h3>Top Content</h3>
            ${rawHtml(pathsTableHtml)}`
        : ""}
    </div>`,
  );
}
```

```js
// ─── Stars & Forks (public repos) ───────────────────────────────────
if (
  (enabledAreas.has("stars") || enabledAreas.has("forks")) &&
  visibility === "public"
) {
  const starForkMetrics = [];
  if (enabledAreas.has("stars")) {
    starForkMetrics.push({
      key: "stars_total",
      label: "Stars",
      colorClass: "accent-primary",
      neutral: true,
    });
  }
  if (enabledAreas.has("forks")) {
    starForkMetrics.push({
      key: "forks_total",
      label: "Forks",
      colorClass: "accent-secondary",
      neutral: true,
    });
  }

  display(
    html`<div class="dash-section" style="--si:9">
      <h2>Community</h2>
      ${metricGrid(starForkMetrics, latestMetrics, metricHistory, {
        cols: starForkMetrics.length,
        sectionIndex: 9,
      })}
    </div>`,
  );
}
```
