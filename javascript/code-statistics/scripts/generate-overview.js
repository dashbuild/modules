import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadModuleContext,
  readModuleData,
  writeOverview,
} from "../../../../scripts/lib/module-helpers.js";

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

if (metrics.line_coverage != null) {
  summaries.push({
    label: "Line Coverage",
    value: formatMetric(metrics.line_coverage, "%"),
  });
}
if (metrics.tests != null) {
  summaries.push({ label: "Tests", value: formatMetric(metrics.tests) });
}
if (metrics.tests_failed != null) {
  summaries.push({
    label: "Failed",
    value: formatMetric(metrics.tests_failed),
  });
}

writeOverview(dashbuildDir, slug, {
  moduleName: config.name,
  modulePath: `/${slug}`,
  backgroundColor: "#16171d",
  boxColor: "#1e1f28",
  borderColor: "#363950",
  textColor: "#e2e4ed",
  titleColor: "#a78bfa",
  summaries,
});
