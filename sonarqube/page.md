---
title: SonarQube
style: sonarqube-theme.css
toc: false
---

# SonarQube Analysis

```js
const sonarqubeData = /*INLINE_DATA*/ {};
```

```js
const enabledAreas = new Set(sonarqubeData.config.areas);

const metricHistory = sonarqubeData.history.map((entry) => ({
  ...entry,
  date: new Date(entry.date),
}));

const latestMetrics = metricHistory[metricHistory.length - 1]?.metrics ?? {};
```

```js
import {
  formatMetric,
  calculateTrend,
  buildTrendChart,
} from "./components/trendChart.js";
```

```js
// Convert a numeric rating (1–5) to its letter grade
function ratingToLabel(ratingValue) {
  const labels = { 1: "A", 2: "B", 3: "C", 4: "D", 5: "E" };
  return labels[Math.round(ratingValue)] || "—";
}

// Get the badge background color for a rating value
function ratingToBackground(ratingValue) {
  const backgrounds = {
    1: "var(--sonar-a)",
    2: "var(--sonar-b)",
    3: "var(--sonar-c)",
    4: "var(--sonar-d)",
    5: "var(--sonar-e)",
  };
  return (
    backgrounds[Math.round(ratingValue)] || "var(--theme-foreground-faint)"
  );
}
```

```js
// Convenience wrappers that bind metricHistory and latestMetrics
function sonarTrend(metricKey, opts) {
  return calculateTrend(metricHistory, latestMetrics, metricKey, opts);
}
function sonarChart(metricKey, opts) {
  return buildTrendChart(metricHistory, latestMetrics, metricKey, opts);
}
```

```js
// Build summary stat cards for the top-level overview
const summaryCards = [];

const summaryMetrics = [
  { key: "coverage", label: "Coverage", suffix: "%", show: true },
  { key: "bugs", label: "Bugs", suffix: "", show: true },
  { key: "vulnerabilities", label: "Vulnerabilities", suffix: "", show: true },
  {
    key: "security_hotspots",
    label: "Security Hotspots",
    suffix: "",
    show: true,
  },
  { key: "code_smells", label: "Code Smells", suffix: "", show: true },
  {
    key: "duplicated_lines_density",
    label: "Duplication",
    suffix: "%",
    show: true,
  },
  { key: "ncloc", label: "Lines of Code", suffix: "", show: true },
];

for (const metric of summaryMetrics) {
  const value = latestMetrics[metric.key];
  if (value != null) {
    summaryCards.push(
      html`<div class="card summary-card">
        <h2>${metric.label}</h2>
        <span class="big">${formatMetric(value, metric.suffix)}</span>
      </div>`,
    );
  }
}
```

<div class="dash-section" style="--si:0">
<div class="grid grid-cols-4 skel-cards-4">
  ${summaryCards}
</div>
</div>

```js
// Build rating badge cards based on which rating areas are enabled
const ratingCards = [];

if (enabledAreas.has("reliability_rating")) {
  ratingCards.push(
    html`<div class="card">
      <h2>Reliability</h2>
      <span
        class="sonar-rating"
        style="background: ${ratingToBackground(
          latestMetrics.reliability_rating,
        )}"
        >${ratingToLabel(latestMetrics.reliability_rating)}</span
      >
      <span class="muted">${latestMetrics.bugs ?? 0} bug(s)</span>
    </div>`,
  );
}

if (enabledAreas.has("security_rating")) {
  ratingCards.push(
    html`<div class="card">
      <h2>Security</h2>
      <span
        class="sonar-rating"
        style="background: ${ratingToBackground(latestMetrics.security_rating)}"
        >${ratingToLabel(latestMetrics.security_rating)}</span
      >
      <span class="muted"
        >${latestMetrics.vulnerabilities ?? 0} vulnerability(ies)</span
      >
    </div>`,
  );
}

if (enabledAreas.has("sqale_rating")) {
  ratingCards.push(
    html`<div class="card">
      <h2>Maintainability</h2>
      <span
        class="sonar-rating"
        style="background: ${ratingToBackground(latestMetrics.sqale_rating)}"
        >${ratingToLabel(latestMetrics.sqale_rating)}</span
      >
      <span class="muted">${latestMetrics.code_smells ?? 0} code smell(s)</span>
    </div>`,
  );
}
```

<div class="dash-section" style="--si:1">

${ratingCards.length > 0 ? html`<h2>Current Ratings</h2>` : ""}

<div class="grid grid-cols-3 skel-cards-3">
  ${ratingCards}
</div>
</div>

<div class="dash-section" style="--si:2">

## Trends

```js
// Build trend chart cards — ordered by importance:
// 1. Coverage & quality gates (coverage, bugs, vulnerabilities, security hotspots)
// 2. Maintainability (code smells, duplication)
// 3. Size (lines of code)
// 4. Rating trends
const trendCards = [];

if (enabledAreas.has("coverage")) {
  trendCards.push(
    sonarChart("coverage", {
      title: "Coverage",
      color: "var(--sonar-chart-green)",
      suffix: "%",
      yDomain: [0, 100],
    }),
  );
}

if (enabledAreas.has("bugs")) {
  trendCards.push(
    sonarChart("bugs", {
      title: "Bugs",
      color: "var(--sonar-chart-red)",
      inverse: true,
    }),
  );
}

if (enabledAreas.has("vulnerabilities")) {
  trendCards.push(
    sonarChart("vulnerabilities", {
      title: "Vulnerabilities",
      color: "var(--sonar-chart-orange)",
      inverse: true,
    }),
  );
}

if (enabledAreas.has("security_hotspots")) {
  trendCards.push(
    sonarChart("security_hotspots", {
      title: "Security Hotspots",
      color: "var(--sonar-chart-orange)",
      inverse: true,
    }),
  );
}

if (enabledAreas.has("code_smells")) {
  trendCards.push(
    sonarChart("code_smells", {
      title: "Code Smells",
      color: "var(--sonar-chart-yellow)",
      inverse: true,
    }),
  );
}

if (enabledAreas.has("duplicated_lines_density")) {
  trendCards.push(
    sonarChart("duplicated_lines_density", {
      title: "Duplication",
      color: "var(--sonar-chart-blue)",
      suffix: "%",
      inverse: true,
    }),
  );
}

if (enabledAreas.has("ncloc")) {
  trendCards.push(
    sonarChart("ncloc", {
      title: "Lines of Code",
      color: "var(--sonar-chart-blue)",
      neutral: true,
    }),
  );
}

const ratingLabels = { 1: "A", 2: "B", 3: "C", 4: "D", 5: "E" };
const ratingTickFormat = (d) => ratingLabels[Math.round(d)] ?? "";
const ratingValueFormat = (d) => ratingLabels[Math.round(d)] ?? "—";
const ratingOpts = {
  tickFormat: ratingTickFormat,
  valueFormat: ratingValueFormat,
  reverse: true,
};

if (enabledAreas.has("reliability_rating")) {
  trendCards.push(
    sonarChart("reliability_rating", {
      title: "Reliability Rating",
      color: "var(--sonar-chart-green)",
      yDomain: [1, 5],
      inverse: true,
      ...ratingOpts,
    }),
  );
}

if (enabledAreas.has("security_rating")) {
  trendCards.push(
    sonarChart("security_rating", {
      title: "Security Rating",
      color: "var(--sonar-chart-orange)",
      yDomain: [1, 5],
      inverse: true,
      ...ratingOpts,
    }),
  );
}

if (enabledAreas.has("sqale_rating")) {
  trendCards.push(
    sonarChart("sqale_rating", {
      title: "Maintainability Rating",
      color: "var(--sonar-chart-yellow)",
      yDomain: [1, 5],
      inverse: true,
      ...ratingOpts,
    }),
  );
}
```

<div class="grid grid-cols-2 skel-charts-2">
  ${trendCards}
</div>
</div>
