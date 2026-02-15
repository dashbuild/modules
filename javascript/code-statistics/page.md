---
title: Code Statistics
style: js-code-stats-theme.css
toc: false
---

# Code Statistics

```js
const data = /*INLINE_DATA*/ {};
```

```js
import {
  formatMetric,
  calculateTrend,
  buildTrendChart,
  makeArrowNode,
} from "./components/trendChart.js";
```

```js
const enabledAreas = new Set(data.config.areas);

const metricHistory = data.history.map((entry) => ({
  ...entry,
  date: new Date(entry.date),
}));

const latestMetrics = metricHistory[metricHistory.length - 1]?.metrics ?? {};

// Convenience wrappers that bind metricHistory and latestMetrics
function statsTrend(metricKey, opts) {
  return calculateTrend(metricHistory, latestMetrics, metricKey, opts);
}
function statsChart(metricKey, opts) {
  return buildTrendChart(metricHistory, latestMetrics, metricKey, opts);
}
```

<div class="dash-section" style="--si:0">

### Codebase

```js
const codeCards = [];

const codeMetrics = [
  { key: "total_lines", label: "Total Lines", highlight: true },
  { key: "total_files", label: "Total Files", highlight: true },
  { key: "source_files", label: "Source Files" },
  { key: "test_files", label: "Test Files" },
  { key: "packages", label: "Packages" },
  { key: "avg_lines_per_file", label: "Avg Lines / File" },
];

for (const metric of codeMetrics) {
  const value = latestMetrics[metric.key];
  if (value != null) {
    const trend = statsTrend(metric.key, { neutral: true });
    const trendHtml = trend.text
      ? html`<span class="muted trend-container" style="font-size: 0.75rem;">
          ${makeArrowNode(trend)}${trend.text} from previous
        </span>`
      : "";
    const inner = html`<div class="card summary-card">
      <h2>${metric.label}</h2>
      <span class="big ${metric.highlight ? "purple" : ""}"
        >${formatMetric(value)}</span
      >
      ${trendHtml}
    </div>`;
    codeCards.push(
      metric.highlight
        ? html`<div class="gradient-card-purple">${inner}</div>`
        : inner,
    );
  }
}
```

<div class="grid grid-cols-3 skel-cards-3">
  ${codeCards}
</div>
</div>

<div class="dash-section" style="--si:1">

### Testing

```js
const testCards = [];

const testMetrics = [
  { key: "test_pass_rate", label: "Pass Rate", suffix: "%", highlight: true },
  { key: "tests_failed", label: "Failed", inverse: true, highlight: true },
  { key: "test_to_code_ratio", label: "Tests / 1k Lines" },
];

for (const metric of testMetrics) {
  const value = latestMetrics[metric.key];
  if (value != null) {
    const isFailed = metric.key === "tests_failed";
    const colorClass = metric.highlight
      ? isFailed && value > 0
        ? "red"
        : "purple"
      : "";
    const useHighlight = metric.highlight && !(isFailed && value > 0);
    const trend = statsTrend(metric.key, { inverse: metric.inverse });
    const trendHtml = trend.text
      ? html`<span class="muted trend-container" style="font-size: 0.75rem;">
          ${makeArrowNode(trend)}${trend.text}${metric.suffix || ""} from
          previous
        </span>`
      : "";
    const inner = html`<div class="card summary-card">
      <h2>${metric.label}</h2>
      <span class="big ${colorClass}"
        >${formatMetric(value, metric.suffix)}</span
      >
      ${trendHtml}
    </div>`;
    testCards.push(
      useHighlight
        ? html`<div class="gradient-card-purple">${inner}</div>`
        : inner,
    );
  }
}
```

<div class="grid grid-cols-3 skel-cards-3">
  ${testCards}
</div>
</div>

<div class="dash-section" style="--si:2">

### Test Results

```js
const resultCards = [];

const resultMetrics = [
  { key: "tests", label: "Tests" },
  { key: "tests_passed", label: "Passed", color: "teal" },
  { key: "test_suites", label: "Test Suites" },
  { key: "tests_failed", label: "Failed", inverse: true },
  { key: "tests_skipped", label: "Skipped", neutral: true },
];

for (const metric of resultMetrics) {
  const value = latestMetrics[metric.key];
  if (value != null) {
    const isFailed = metric.key === "tests_failed";
    const colorClass =
      isFailed && value > 0 ? "red" : metric.color || "muted-value";
    const trend = statsTrend(metric.key, {
      inverse: metric.inverse,
      neutral: metric.neutral,
    });
    const trendHtml = trend.text
      ? html`<span class="muted trend-container" style="font-size: 0.75rem;">
          ${makeArrowNode(trend)}${trend.text} from previous
        </span>`
      : "";
    resultCards.push(
      html`<div class="card summary-card">
        <h2>${metric.label}</h2>
        <span class="big ${colorClass}">${formatMetric(value)}</span>
        ${trendHtml}
      </div>`,
    );
  }
}
```

<div class="grid grid-cols-4 skel-cards-4">
  ${resultCards}
</div>
</div>

<div class="dash-section" style="--si:3">

### Coverage

```js
const coverageCards = [];

const coverageMetrics = [
  {
    key: "line_coverage",
    label: "Line Coverage",
    suffix: "%",
    highlight: true,
  },
  {
    key: "branch_coverage",
    label: "Branch Coverage",
    suffix: "%",
    highlight: true,
  },
  { key: "function_coverage", label: "Function Coverage", suffix: "%" },
  { key: "uncovered_lines", label: "Uncovered Lines" },
];

for (const metric of coverageMetrics) {
  const value = latestMetrics[metric.key];
  if (value != null) {
    const isWarning = metric.key === "uncovered_lines";
    const trend = statsTrend(metric.key, { inverse: isWarning });
    const trendHtml = trend.text
      ? html`<span class="muted trend-container" style="font-size: 0.75rem;">
          ${makeArrowNode(trend)}${trend.text}${metric.suffix || ""} from
          previous
        </span>`
      : "";
    const inner = html`<div class="card summary-card">
      <h2>${metric.label}</h2>
      <span class="big ${metric.highlight ? "purple" : ""}"
        >${formatMetric(value, metric.suffix)}</span
      >
      ${trendHtml}
    </div>`;
    coverageCards.push(
      metric.highlight
        ? html`<div class="gradient-card-purple">${inner}</div>`
        : inner,
    );
  }
}
```

<div class="grid grid-cols-4 skel-cards-4">
  ${coverageCards}
</div>
</div>

<div class="dash-section" style="--si:4">

## Trends

```js
const trendCards = [];

if (enabledAreas.has("total_lines")) {
  trendCards.push(
    statsChart("total_lines", {
      title: "Total Lines",
      color: "var(--vt-chart-blue)",
      neutral: true,
    }),
  );
}

if (enabledAreas.has("total_files")) {
  trendCards.push(
    statsChart("total_files", {
      title: "Files",
      color: "var(--vt-chart-blue)",
      neutral: true,
    }),
  );
}

if (enabledAreas.has("tests")) {
  trendCards.push(
    statsChart("tests", {
      title: "Total Tests",
      color: "var(--vt-teal)",
    }),
  );
}

if (enabledAreas.has("test_suites")) {
  trendCards.push(
    statsChart("test_suites", {
      title: "Test Suites",
      color: "var(--vt-teal)",
    }),
  );
}

if (enabledAreas.has("tests_failed")) {
  trendCards.push(
    statsChart("tests_failed", {
      title: "Failed Tests",
      color: "var(--vt-chart-red)",
      inverse: true,
    }),
  );
}

if (enabledAreas.has("tests_skipped")) {
  trendCards.push(
    statsChart("tests_skipped", {
      title: "Skipped Tests",
      color: "var(--vt-chart-gray)",
      neutral: true,
    }),
  );
}

if (enabledAreas.has("test_pass_rate")) {
  trendCards.push(
    statsChart("test_pass_rate", {
      title: "Pass Rate",
      color: "var(--vt-teal)",
      suffix: "%",
      yDomain: [0, 100],
    }),
  );
}

if (enabledAreas.has("test_to_code_ratio")) {
  trendCards.push(
    statsChart("test_to_code_ratio", {
      title: "Tests / 1k Lines",
      color: "var(--vt-teal)",
    }),
  );
}

if (enabledAreas.has("line_coverage")) {
  trendCards.push(
    statsChart("line_coverage", {
      title: "Line Coverage",
      color: "var(--vt-purple)",
      suffix: "%",
      yDomain: [0, 100],
    }),
  );
}

if (enabledAreas.has("function_coverage")) {
  trendCards.push(
    statsChart("function_coverage", {
      title: "Function Coverage",
      color: "var(--vt-purple)",
      suffix: "%",
      yDomain: [0, 100],
    }),
  );
}

if (enabledAreas.has("branch_coverage")) {
  trendCards.push(
    statsChart("branch_coverage", {
      title: "Branch Coverage",
      color: "var(--vt-purple)",
      suffix: "%",
      yDomain: [0, 100],
    }),
  );
}

if (enabledAreas.has("uncovered_lines")) {
  trendCards.push(
    statsChart("uncovered_lines", {
      title: "Uncovered Lines",
      color: "var(--vt-chart-red)",
      inverse: true,
    }),
  );
}

if (enabledAreas.has("packages")) {
  trendCards.push(
    statsChart("packages", {
      title: "Packages",
      color: "var(--vt-chart-blue)",
      neutral: true,
    }),
  );
}

if (enabledAreas.has("avg_lines_per_file")) {
  trendCards.push(
    statsChart("avg_lines_per_file", {
      title: "Avg Lines / File",
      color: "var(--vt-chart-blue)",
      neutral: true,
    }),
  );
}
```

<div class="grid grid-cols-2 skel-charts-2">
  ${trendCards}
</div>
</div>
