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

if (metrics.coverage != null) {
  summaries.push({
    label: "Coverage",
    value: formatMetric(metrics.coverage, "%"),
  });
}
if (metrics.bugs != null) {
  summaries.push({ label: "Bugs", value: formatMetric(metrics.bugs) });
}
if (metrics.vulnerabilities != null) {
  summaries.push({
    label: "Vulnerabilities",
    value: formatMetric(metrics.vulnerabilities),
  });
}
if (metrics.code_smells != null) {
  summaries.push({
    label: "Code Smells",
    value: formatMetric(metrics.code_smells),
  });
}

writeOverview(dashbuildDir, slug, {
  moduleName: config.name,
  modulePath: `/${slug}`,
  backgroundColor: "#1d212f",
  boxColor: "#2a2f40",
  borderColor: "#637192",
  textColor: "#e1e6f3",
  titleColor: "#4a9eff",
  summaries,
});
