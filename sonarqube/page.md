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
import { buildTrendChart } from "./components/trendChart.js";
import { summaryCard } from "./components/dashbuild-components.js";
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
// Convenience wrapper that binds metricHistory and latestMetrics
function sonarChart(metricKey, opts) {
  return buildTrendChart(metricHistory, latestMetrics, metricKey, opts);
}
```

```js
// Build rating badge cards based on which rating areas are enabled
const ratingConfigs = [
  {
    area: "reliability_rating",
    label: "Reliability",
    ratingKey: "reliability_rating",
    childText: `${latestMetrics.bugs ?? 0} bug(s)`,
  },
  {
    area: "security_rating",
    label: "Security",
    ratingKey: "security_rating",
    childText: `${latestMetrics.vulnerabilities ?? 0} vulnerability(ies)`,
  },
  {
    area: "sqale_rating",
    label: "Maintainability",
    ratingKey: "sqale_rating",
    childText: `${latestMetrics.code_smells ?? 0} code smell(s)`,
  },
];

const ratingCards = ratingConfigs
  .filter((cfg) => enabledAreas.has(cfg.area))
  .map((cfg) =>
    summaryCard({
      label: cfg.label,
      badge: {
        text: ratingToLabel(latestMetrics[cfg.ratingKey]),
        background: ratingToBackground(latestMetrics[cfg.ratingKey]),
      },
      child: html`<span class="muted">${cfg.childText}</span>`,
    }),
  );
```

```js
if (ratingCards.length > 0) {
  display(
    html`<div class="dash-section" style="--si:0">
      <h2>Current Ratings</h2>
      <div class="grid grid-cols-3 skel-cards-3">${ratingCards}</div>
    </div>`,
  );
}
```

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

```js
display(
  html`<div class="dash-section" style="--si:1">
    <h2>Trends</h2>
    <div class="grid grid-cols-2 skel-charts-2">${trendCards}</div>
  </div>`,
);
```
