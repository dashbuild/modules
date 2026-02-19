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

const summary = data.summary;

// ─── Build overview ─────────────────────────────────────────────────

const summaries = [{ label: "Total Tasks", value: String(summary.total) }];

// Show counts for the most actionable tags
const actionableTags = ["TODO", "FIXME", "BUG"];
for (const tag of actionableTags) {
  const count = summary.byTag[tag];
  if (count != null && count > 0) {
    summaries.push({ label: tag, value: String(count) });
  }
}

writeOverview(dashbuildDir, slug, {
  moduleName: config.name,
  modulePath: `/${slug}`,
  backgroundColor: "#0d1117",
  boxColor: "#161b22",
  borderColor: "#30363d",
  textColor: "#e6edf3",
  titleColor: "#58a6ff",
  summaries,
});
