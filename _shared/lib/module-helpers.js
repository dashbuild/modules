/**
 * Shared utilities for Dashbuild module scripts.
 *
 * Provides common boilerplate used by register-module, generate-page,
 * generate-overview, and other per-module scripts.
 */

import {
  readFileSync,
  writeFileSync,
  cpSync,
  mkdirSync,
  existsSync,
} from "node:fs";
import { join, dirname } from "node:path";

// ─── Root discovery ──────────────────────────────────────────────────

/**
 * Walk up from a starting directory to find the Dashbuild repo root.
 * The root is identified by having a package.json with name "dashbuild".
 */
export function findRepoRoot(startDir) {
  let dir = startDir;
  while (dir !== "/" && dir !== ".") {
    const pkgPath = join(dir, "package.json");
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
        if (pkg.name === "dashbuild") return dir;
      } catch {
        // not the root, keep walking
      }
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

// ─── Module context ──────────────────────────────────────────────────

/**
 * Load module context from a module directory.
 * Returns { moduleDir, config, slug, dashbuildDir }.
 */
export function loadModuleContext(moduleDir) {
  const config = JSON.parse(
    readFileSync(join(moduleDir, "module.json"), "utf-8"),
  );
  const slug = config.slug;
  const dashbuildDir = requireDashbuildDir();
  return { moduleDir, config, slug, dashbuildDir };
}

/**
 * Validate that DASHBUILD_DIR is set and return it.
 */
export function requireDashbuildDir() {
  const dashbuildDir = process.env.DASHBUILD_DIR;
  if (!dashbuildDir) {
    console.error(
      "::error::DASHBUILD_DIR is not set. Did you run dashbuild/setup first?",
    );
    process.exit(1);
  }
  return dashbuildDir;
}

// ─── Generate page ──────────────────────────────────────────────────

/**
 * Generate a module's page: read page.md, inline data, copy theme.css.
 */
export function generatePage(moduleDir) {
  const config = JSON.parse(
    readFileSync(join(moduleDir, "module.json"), "utf-8"),
  );
  const slug = config.slug;
  const dashbuildDir = requireDashbuildDir();

  // Read page template and inline the module data
  const pageSource = join(moduleDir, "page.md");
  const pageDestination = join(dashbuildDir, "src", `${slug}.md`);
  mkdirSync(dirname(pageDestination), { recursive: true });

  let pageContent = readFileSync(pageSource, "utf-8");

  const dataPath = join(dashbuildDir, "src", "data", `${slug}.json`);
  if (existsSync(dataPath)) {
    const jsonStr = readFileSync(dataPath, "utf-8").trim();
    pageContent = pageContent.replace("/*INLINE_DATA*/ {}", jsonStr);
    console.log(`Inlined data from ${dataPath}`);
  } else {
    console.warn(
      `::warning::Data file not found at ${dataPath} — page will have empty data`,
    );
  }

  writeFileSync(pageDestination, pageContent, "utf-8");
  console.log(`Generated ${pageDestination}`);

  // Copy theme stylesheet
  const themeSource = join(moduleDir, "theme.css");
  if (existsSync(themeSource)) {
    const themeDestination = join(dashbuildDir, "src", `${slug}-theme.css`);
    cpSync(themeSource, themeDestination);
    console.log(`Copied theme.css → ${themeDestination}`);
  }
}

// ─── Register module ────────────────────────────────────────────────

/**
 * Register a module in the modules.json registry.
 */
export function registerModule(moduleDir) {
  const config = JSON.parse(
    readFileSync(join(moduleDir, "module.json"), "utf-8"),
  );
  const dashbuildDir = requireDashbuildDir();

  const modulesPath = join(dashbuildDir, "modules.json");
  const modules = JSON.parse(readFileSync(modulesPath, "utf-8"));

  modules.push({
    name: config.name,
    path: `/${config.slug}`,
    section: config.section || "Reports",
  });

  writeFileSync(modulesPath, JSON.stringify(modules, null, 2), "utf-8");
  console.log(`${config.name} module registered in modules.json`);
}

// ─── Overview helpers ───────────────────────────────────────────────

/**
 * Read a module's data file from the dashbuild workspace.
 * Returns parsed JSON or null if the file doesn't exist / is malformed.
 */
export function readModuleData(dashbuildDir, slug) {
  const dataPath = join(dashbuildDir, "src", "data", `${slug}.json`);
  try {
    return JSON.parse(readFileSync(dataPath, "utf-8"));
  } catch (err) {
    console.warn(
      `::warning::Could not read ${dataPath}: ${err.message}. Skipping overview generation.`,
    );
    return null;
  }
}

/**
 * Write an overview.json to the module API directory.
 */
export function writeOverview(dashbuildDir, slug, overview) {
  const outputDir = join(dashbuildDir, "module-api", slug);
  mkdirSync(outputDir, { recursive: true });
  const outputPath = join(outputDir, "overview.json");
  writeFileSync(outputPath, JSON.stringify(overview, null, 2), "utf-8");
  console.log(`Overview written to ${outputPath}`);
}

// ─── Dev setup ──────────────────────────────────────────────────────

/**
 * Copy a module's fixture data into the dashbuild workspace.
 * Equivalent to the per-module dev-setup.sh scripts.
 */
export function devSetup(moduleDir) {
  const config = JSON.parse(
    readFileSync(join(moduleDir, "module.json"), "utf-8"),
  );
  const slug = config.slug;
  const dashbuildDir = requireDashbuildDir();

  const fixtureSource = join(moduleDir, "fixtures", `${slug}.json`);
  if (!existsSync(fixtureSource)) {
    console.warn(`No fixture file found at ${fixtureSource}`);
    return;
  }

  const dataDir = join(dashbuildDir, "src", "data");
  mkdirSync(dataDir, { recursive: true });
  cpSync(fixtureSource, join(dataDir, `${slug}.json`));
}
