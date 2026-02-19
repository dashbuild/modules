import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadModuleContext,
  readModuleData,
  writeOverview,
} from "../../../scripts/lib/module-helpers.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const moduleDir = join(__dirname, "..");
const { config, slug, dashbuildDir } = loadModuleContext(moduleDir);

const data = readModuleData(dashbuildDir, slug);
if (!data) process.exit(0);

const latestEntry = data.history[data.history.length - 1];
const metrics = latestEntry?.metrics ?? {};

// ─── Build overview ─────────────────────────────────────────────────

function formatMetric(value, suffix = "") {
  if (value == null) return "—";
  if (typeof value === "number") return value.toLocaleString() + suffix;
  return String(value);
}

const summaries = [];

if (metrics.prs_open_count != null) {
  summaries.push({
    label: "Open PRs",
    value: formatMetric(metrics.prs_open_count),
  });
}
if (metrics.issues_open_count != null) {
  summaries.push({
    label: "Open Issues",
    value: formatMetric(metrics.issues_open_count),
  });
}
if (metrics.workflow_success_rate != null) {
  summaries.push({
    label: "CI Success",
    value: formatMetric(metrics.workflow_success_rate, "%"),
  });
}
if (metrics.days_since_last_release != null && metrics.days_since_last_release >= 0) {
  summaries.push({
    label: "Days Since Release",
    value: formatMetric(metrics.days_since_last_release),
  });
}

writeOverview(dashbuildDir, slug, {
  moduleName: config.name,
  modulePath: `/${slug}`,
  backgroundColor: "#151b23",
  boxColor: "#212830",
  borderColor: "#3d444d",
  textColor: "#e6edf3",
  titleColor: "#58a6ff",
  summaries,
});
