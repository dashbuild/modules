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
import { buildTrendChart } from "./components/trendChart.js";
import { metricGrid } from "./components/dashbuild-components.js";
```

```js
const enabledAreas = new Set(data.config.areas);

const testAreaKeys = [
  "tests",
  "test_suites",
  "tests_passed",
  "tests_failed",
  "tests_skipped",
  "test_pass_rate",
  "test_to_code_ratio",
];
const coverageAreaKeys = [
  "line_coverage",
  "function_coverage",
  "branch_coverage",
  "uncovered_lines",
];
const hasTests = testAreaKeys.some((k) => enabledAreas.has(k));
const hasCoverage = coverageAreaKeys.some((k) => enabledAreas.has(k));

const sectionOrder = [
  "codebase",
  hasTests ? ["testing", "testResults"] : [],
  hasCoverage ? ["coverage"] : [],
  "trends",
];
const sectionIndexByKey = Object.fromEntries(
  sectionOrder.flat().map((key, index) => [key, index]),
);

const metricHistory = data.history.map((entry) => ({
  ...entry,
  date: new Date(entry.date),
}));

const latestMetrics = metricHistory[metricHistory.length - 1]?.metrics ?? {};

// Convenience wrapper that binds metricHistory and latestMetrics
function statsChart(metricKey, opts) {
  return buildTrendChart(metricHistory, latestMetrics, metricKey, opts);
}
```

```js
display(
  metricGrid(
    [
      {
        key: "total_lines",
        label: "Total Lines",
        highlight: "primary",
        colorClass: "accent-primary",
        neutral: true,
      },
      {
        key: "total_files",
        label: "Total Files",
        highlight: "primary",
        colorClass: "accent-primary",
        neutral: true,
      },
      { key: "source_files", label: "Source Files", neutral: true },
      { key: "test_files", label: "Test Files", neutral: true },
      { key: "packages", label: "Packages", neutral: true },
      { key: "avg_lines_per_file", label: "Avg Lines / File", neutral: true },
    ],
    latestMetrics,
    metricHistory,
    {
      cols: 3,
      sectionIndex: sectionIndexByKey.codebase,
      sectionTitle: "Codebase",
    },
  ),
);
```

```js
if (hasTests) {
  const failedValue = latestMetrics["tests_failed"];
  const failedIsRed = failedValue != null && failedValue > 0;

  display(
    metricGrid(
      [
        {
          key: "test_pass_rate",
          label: "Pass Rate",
          suffix: "%",
          highlight: "primary",
          colorClass: "accent-primary",
        },
        {
          key: "tests_failed",
          label: "Failed",
          inverse: true,
          highlight: failedIsRed ? false : "primary",
          colorClass: failedIsRed ? "red" : "accent-primary",
        },
        { key: "test_to_code_ratio", label: "Tests / 1k Lines" },
      ],
      latestMetrics,
      metricHistory,
      {
        cols: 3,
        sectionIndex: sectionIndexByKey.testing,
        sectionTitle: "Testing",
      },
    ),
  );
}
```

```js
if (hasTests) {
  const failedResultValue = latestMetrics["tests_failed"];
  const failedResultIsRed = failedResultValue != null && failedResultValue > 0;

  display(
    metricGrid(
      [
        { key: "tests", label: "Tests", colorClass: "muted-value" },
        {
          key: "tests_passed",
          label: "Passed",
          colorClass: "accent-secondary",
        },
        { key: "test_suites", label: "Test Suites", colorClass: "muted-value" },
        {
          key: "tests_failed",
          label: "Failed",
          inverse: true,
          colorClass: failedResultIsRed ? "red" : "muted-value",
        },
        {
          key: "tests_skipped",
          label: "Skipped",
          neutral: true,
          colorClass: "muted-value",
        },
      ],
      latestMetrics,
      metricHistory,
      {
        cols: 4,
        sectionIndex: sectionIndexByKey.testResults,
        sectionTitle: "Test Results",
      },
    ),
  );
}
```

```js
if (hasCoverage) {
  display(
    metricGrid(
      [
        {
          key: "line_coverage",
          label: "Line Coverage",
          suffix: "%",
          highlight: "primary",
          colorClass: "accent-primary",
        },
        {
          key: "branch_coverage",
          label: "Branch Coverage",
          suffix: "%",
          highlight: "primary",
          colorClass: "accent-primary",
        },
        { key: "function_coverage", label: "Function Coverage", suffix: "%" },
        { key: "uncovered_lines", label: "Uncovered Lines", inverse: true },
      ],
      latestMetrics,
      metricHistory,
      {
        cols: 4,
        sectionIndex: sectionIndexByKey.coverage,
        sectionTitle: "Coverage",
      },
    ),
  );
}
```

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

display(
  html`<div class="dash-section" style="--si:${sectionIndexByKey.trends}">
    <h2>Trends</h2>
    <div class="grid grid-cols-2 skel-charts-2">${trendCards}</div>
  </div>`,
);
```
