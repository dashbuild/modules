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

if (metrics.dependabot_total_open != null) {
  summaries.push({
    label: "Open Alerts",
    value: formatMetric(metrics.dependabot_total_open),
  });
}
if (metrics.dependabot_critical != null) {
  summaries.push({
    label: "Critical",
    value: formatMetric(metrics.dependabot_critical),
  });
}
if (metrics.dependabot_high != null) {
  summaries.push({
    label: "High",
    value: formatMetric(metrics.dependabot_high),
  });
}
if (metrics.dependabot_prs_merged_30d != null) {
  summaries.push({
    label: "PRs Merged (30d)",
    value: formatMetric(metrics.dependabot_prs_merged_30d),
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
