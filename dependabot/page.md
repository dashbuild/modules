---
title: Dependabot
style: dependabot-theme.css
toc: false
---

# Dependabot & Security

```js
const data = /*INLINE_DATA*/ {};
```

```js
import { buildTrendChart } from "./components/trendChart.js";
import {
  summaryCard,
  metricGrid,
  segmentBar,
  barLegend,
  dashBadge,
  pillList,
} from "./components/dashbuild-components.js";
```

```js
const enabledAreas = new Set(data.config?.areas || []);
const repoName = data.config?.repository || "unknown";

const metricHistory = (data.history || []).map((entry) => ({
  ...entry,
  date: new Date(entry.date),
}));

const latestMetrics = metricHistory[metricHistory.length - 1]?.metrics ?? {};
const details = data.details || {};
```

```js
function depChart(metricKey, opts) {
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

function cvssClass(score) {
  if (score == null) return "low";
  if (score >= 9.0) return "critical";
  if (score >= 7.0) return "high";
  if (score >= 4.0) return "medium";
  return "low";
}

function severityColor(sev) {
  const colors = {
    critical: "var(--gh-severity-critical)",
    high: "var(--gh-severity-high)",
    medium: "var(--gh-severity-medium)",
    low: "var(--gh-severity-low)",
    error: "var(--gh-scanning-error)",
    warning: "var(--gh-scanning-warning)",
    note: "var(--gh-scanning-note)",
  };
  return colors[sev] || "var(--gh-gray)";
}

function rawHtml(str) {
  const tpl = document.createElement("template");
  tpl.innerHTML = str;
  return tpl.content.cloneNode(true);
}

const severityStyles = {
  critical: {
    color: "var(--gh-severity-critical)",
    bg: "rgba(248, 81, 73, 0.15)",
    border: "rgba(248, 81, 73, 0.4)",
  },
  high: {
    color: "var(--gh-severity-high)",
    bg: "rgba(219, 109, 40, 0.15)",
    border: "rgba(219, 109, 40, 0.4)",
  },
  medium: {
    color: "var(--gh-severity-medium)",
    bg: "rgba(210, 153, 34, 0.15)",
    border: "rgba(210, 153, 34, 0.4)",
  },
  low: {
    color: "var(--gh-severity-low)",
    bg: "rgba(139, 148, 158, 0.15)",
    border: "rgba(139, 148, 158, 0.4)",
  },
  error: {
    color: "var(--gh-scanning-error)",
    bg: "rgba(248, 81, 73, 0.15)",
    border: "rgba(248, 81, 73, 0.4)",
  },
  warning: {
    color: "var(--gh-scanning-warning)",
    bg: "rgba(210, 153, 34, 0.15)",
    border: "rgba(210, 153, 34, 0.4)",
  },
  note: {
    color: "var(--gh-scanning-note)",
    bg: "rgba(88, 166, 255, 0.15)",
    border: "rgba(88, 166, 255, 0.4)",
  },
};

function sevBadge(severity) {
  const s = severityStyles[severity] || severityStyles.low;
  return dashBadge(severity, s);
}

function cvssBadge(score) {
  const cls = cvssClass(score);
  const s = severityStyles[cls] || severityStyles.low;
  return dashBadge(score, { color: s.color, bg: s.bg, mono: true });
}
```

<div class="dash-section" style="--si:0">
<div class="muted" style="font-size: 0.85rem; margin-bottom: 0.75rem;">
  Repository: <strong>${repoName}</strong>
</div>
</div>

```js
// ─── Severity summary cards ─────────────────────────────────────────
if (enabledAreas.has("dependabot")) {
  const hasCritical = (latestMetrics.dependabot_critical || 0) > 0;

  const severityMetrics = [
    {
      key: "dependabot_critical",
      label: "Critical",
      colorClass: "red",
      inverse: true,
      highlight: hasCritical ? "primary" : false,
    },
    {
      key: "dependabot_high",
      label: "High",
      colorClass: "red",
      inverse: true,
    },
    {
      key: "dependabot_medium",
      label: "Medium",
      colorClass: "accent-primary",
      inverse: true,
    },
    {
      key: "dependabot_low",
      label: "Low",
      colorClass: "muted-value",
      inverse: true,
    },
  ];

  display(
    metricGrid(severityMetrics, latestMetrics, metricHistory, {
      cols: 4,
      sectionIndex: 1,
      sectionTitle: "Open Vulnerability Alerts",
    }),
  );
}
```

```js
// ─── Dependabot alerts section ──────────────────────────────────────
if (enabledAreas.has("dependabot")) {
  const trendCards = [];

  trendCards.push(
    depChart("dependabot_total_open", {
      title: "Total Open Alerts",
      color: "var(--gh-chart-red)",
      inverse: true,
    }),
  );
  trendCards.push(
    depChart("dependabot_fixed_30d", {
      title: "Fixed (last 30d)",
      color: "var(--gh-chart-green)",
    }),
  );

  // Severity breakdown bar
  const counts = details.severityCounts || {};
  const total =
    (counts.critical || 0) +
    (counts.high || 0) +
    (counts.medium || 0) +
    (counts.low || 0);

  const sevBar =
    total > 0
      ? segmentBar([
          { value: counts.critical || 0, color: "var(--gh-severity-critical)" },
          { value: counts.high || 0, color: "var(--gh-severity-high)" },
          { value: counts.medium || 0, color: "var(--gh-severity-medium)" },
          { value: counts.low || 0, color: "var(--gh-severity-low)" },
        ])
      : "";
  const sevLegend =
    total > 0
      ? barLegend([
          {
            color: "var(--gh-severity-critical)",
            label: `Critical ${counts.critical || 0}`,
          },
          {
            color: "var(--gh-severity-high)",
            label: `High ${counts.high || 0}`,
          },
          {
            color: "var(--gh-severity-medium)",
            label: `Medium ${counts.medium || 0}`,
          },
          { color: "var(--gh-severity-low)", label: `Low ${counts.low || 0}` },
        ])
      : "";

  // Ecosystem pills
  const ecosystems = details.ecosystemCounts || {};
  const ecoEntries = Object.entries(ecosystems).sort((a, b) => b[1] - a[1]);
  const ecosystemPills =
    ecoEntries.length > 0
      ? pillList(ecoEntries.map(([eco, count]) => ({ label: eco, count })))
      : "";

  // Alert table
  const alerts = details.dependabotAlerts || [];
  let alertTable = "";
  if (alerts.length > 0) {
    const tableEl = document.createElement("table");
    tableEl.className = "dash-table";
    tableEl.innerHTML = `<thead><tr><th>Severity</th><th>Package</th><th>CVE</th><th>CVSS</th><th>Summary</th><th>Opened</th></tr></thead>`;
    const tbody = document.createElement("tbody");
    for (const a of alerts) {
      const tr = document.createElement("tr");
      const tdSev = document.createElement("td");
      tdSev.appendChild(sevBadge(a.severity));
      const tdPkg = document.createElement("td");
      tdPkg.innerHTML = `<a href="${a.url}" target="_blank">${a.package}</a>`;
      const tdCve = document.createElement("td");
      tdCve.innerHTML = `<code>${a.cve}</code>`;
      const tdCvss = document.createElement("td");
      if (a.cvss != null) tdCvss.appendChild(cvssBadge(a.cvss));
      else tdCvss.textContent = "—";
      const tdSum = document.createElement("td");
      tdSum.className = "cell-muted";
      tdSum.textContent = a.summary;
      const tdAge = document.createElement("td");
      tdAge.textContent = daysSince(a.createdAt);
      tr.append(tdSev, tdPkg, tdCve, tdCvss, tdSum, tdAge);
      tbody.appendChild(tr);
    }
    tableEl.appendChild(tbody);
    alertTable = tableEl;
  }

  display(
    html`<div class="dash-section" style="--si:2">
      <h2>Dependabot Alerts</h2>
      <div class="grid grid-cols-2 skel-charts-2">${trendCards}</div>
      ${sevBar
        ? html`<h3>Severity Breakdown</h3>
            ${sevBar}${sevLegend}`
        : ""}
      ${ecosystemPills
        ? html`<h3>Ecosystems</h3>
            ${ecosystemPills}`
        : ""}
      ${alertTable
        ? html`<h3>Open Alerts</h3>
            ${alertTable}`
        : ""}
    </div>`,
  );
}
```

```js
// ─── Code Scanning section ──────────────────────────────────────────
if (enabledAreas.has("code-scanning")) {
  const scanMetrics = [
    {
      key: "code_scanning_errors",
      label: "Errors",
      colorClass: "red",
      inverse: true,
    },
    {
      key: "code_scanning_warnings",
      label: "Warnings",
      colorClass: "accent-primary",
      inverse: true,
    },
    {
      key: "code_scanning_notes",
      label: "Notes",
      colorClass: "muted-value",
      inverse: true,
    },
  ];

  const scanCards = metricGrid(scanMetrics, latestMetrics, metricHistory, {
    cols: 3,
    sectionIndex: 3,
  });

  const scanTrend = depChart("code_scanning_total_open", {
    title: "Total Open Alerts",
    color: "var(--gh-chart-orange)",
    inverse: true,
  });

  // Code scanning alert table with file locations
  const csAlerts = details.codeScanningAlerts || [];
  let csTable = "";
  if (csAlerts.length > 0) {
    const tableEl = document.createElement("table");
    tableEl.className = "dash-table";
    tableEl.innerHTML = `<thead><tr><th>Severity</th><th>Rule</th><th>Tool</th><th>Description</th><th>Opened</th><th></th></tr></thead>`;
    const tbody = document.createElement("tbody");
    for (const a of csAlerts) {
      const tr = document.createElement("tr");
      const tdSev = document.createElement("td");
      tdSev.appendChild(sevBadge(a.severity));
      const tdRule = document.createElement("td");
      tdRule.innerHTML = `<code>${a.rule}</code>`;
      const tdTool = document.createElement("td");
      tdTool.textContent = a.tool;
      const tdDesc = document.createElement("td");
      const locationHtml = a.location
        ? `<div class="code-location"><div class="file-header">${a.location.path}<span class="line-ref">:${a.location.startLine}${a.location.endLine && a.location.endLine !== a.location.startLine ? `-${a.location.endLine}` : ""}</span></div></div>`
        : "";
      tdDesc.innerHTML = `${a.description}${locationHtml}`;
      const tdAge = document.createElement("td");
      tdAge.textContent = daysSince(a.createdAt);
      const tdLink = document.createElement("td");
      tdLink.innerHTML = `<a href="${a.url}" target="_blank">View</a>`;
      tr.append(tdSev, tdRule, tdTool, tdDesc, tdAge, tdLink);
      tbody.appendChild(tr);
    }
    tableEl.appendChild(tbody);
    csTable = tableEl;
  }

  display(
    html`<div class="dash-section" style="--si:3">
      <h2>Code Scanning</h2>
      ${scanCards}
      <div class="grid grid-cols-2 skel-charts-2">${[scanTrend]}</div>
      ${csTable
        ? html`<h3>Open Alerts</h3>
            ${csTable}`
        : html`<div class="muted" style="font-size:0.85rem">
            No code scanning alerts
          </div>`}
    </div>`,
  );
}
```

```js
// ─── Secret Scanning section ────────────────────────────────────────
if (enabledAreas.has("secret-scanning")) {
  const secretMetrics = [
    {
      key: "secret_scanning_open",
      label: "Open Secrets",
      colorClass: "red",
      inverse: true,
    },
    {
      key: "secret_scanning_resolved",
      label: "Resolved",
      colorClass: "green",
      neutral: true,
    },
  ];

  const secretCards = metricGrid(secretMetrics, latestMetrics, metricHistory, {
    cols: 2,
    sectionIndex: 4,
  });

  const secretAlerts = details.secretScanningAlerts || [];
  let secretTableHtml = "";
  if (secretAlerts.length > 0) {
    const rows = secretAlerts
      .map(
        (a) =>
          `<tr>
        <td>${a.secretType}</td>
        <td>${daysSince(a.createdAt)}</td>
        <td><a href="${a.url}" target="_blank">View</a></td>
      </tr>`,
      )
      .join("");
    secretTableHtml = `<table class="dash-table">
      <thead><tr><th>Secret Type</th><th>Opened</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  }

  display(
    html`<div class="dash-section" style="--si:4">
      <h2>Secret Scanning</h2>
      ${secretCards}
      ${secretTableHtml
        ? rawHtml(secretTableHtml)
        : html`<div class="muted" style="font-size:0.85rem">
            No open secret scanning alerts
          </div>`}
    </div>`,
  );
}
```

```js
// ─── Dependabot PR Activity ─────────────────────────────────────────
if (enabledAreas.has("dependabot")) {
  const prMetrics = [
    {
      key: "dependabot_prs_open",
      label: "Open Dependabot PRs",
      colorClass: "accent-primary",
      neutral: true,
    },
    {
      key: "dependabot_prs_merged_30d",
      label: "Merged (last 30d)",
      colorClass: "green",
    },
  ];

  const prCards = metricGrid(prMetrics, latestMetrics, metricHistory, {
    cols: 2,
    sectionIndex: 5,
  });

  const prs = details.dependabotPrs || [];
  let prTableHtml = "";
  if (prs.length > 0) {
    const rows = prs
      .map((pr) => {
        const stateColor =
          pr.state === "merged"
            ? "var(--gh-purple)"
            : pr.state === "open"
              ? "var(--gh-green)"
              : "var(--gh-red)";
        return `<tr>
        <td><a href="${pr.url}" target="_blank">#${pr.number}</a></td>
        <td>${pr.title}</td>
        <td style="color:${stateColor}">${pr.state}</td>
        <td>${daysSince(pr.createdAt)}</td>
      </tr>`;
      })
      .join("");
    prTableHtml = `<table class="dash-table">
      <thead><tr><th>#</th><th>Title</th><th>State</th><th>Opened</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  }

  display(
    html`<div class="dash-section" style="--si:5">
      <h2>Dependabot PR Activity</h2>
      ${prCards}
      ${prTableHtml
        ? html`<h3>Recent PRs</h3>
            ${rawHtml(prTableHtml)}`
        : ""}
    </div>`,
  );
}
```
