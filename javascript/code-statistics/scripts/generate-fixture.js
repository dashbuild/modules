#!/usr/bin/env node

/**
 * Generate fixture data for the javascript/code-statistics module from a real project.
 *
 * Usage:
 *   node generate-fixture.js [project-path]
 *
 * Scans the given directory (default: cwd) for lcov coverage files and test
 * result JSON, then writes the parsed output to the module's fixtures directory
 * using the same history-based format as SonarQube for tracking over time.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname, relative, resolve } from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const moduleDir = join(__dirname, "..");
const moduleConfig = JSON.parse(
  readFileSync(join(moduleDir, "module.json"), "utf-8"),
);
const slug = moduleConfig.slug;
const fixtureDir = join(moduleDir, "fixtures");

const projectPath = resolve(process.argv[2] || ".");

if (!existsSync(projectPath)) {
  console.error(`Error: Project path does not exist: ${projectPath}`);
  process.exit(1);
}

console.log(`Scanning project at: ${projectPath}`);

// ─── Find LCOV files ────────────────────────────────────────────────

let lcovFiles;
try {
  const result = execSync(
    `find "${projectPath}" -type f \\( -name "lcov.info" -o -name "*.lcov" \\) -not -path "*/node_modules/*" 2>/dev/null || true`,
    { encoding: "utf-8" },
  ).trim();
  lcovFiles = result ? result.split("\n").filter(Boolean) : [];
} catch {
  lcovFiles = [];
}

console.log(`Found ${lcovFiles.length} LCOV file(s)`);

// ─── Parse LCOV ─────────────────────────────────────────────────────

function parseLcov(content) {
  const files = [];
  let current = null;

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("SF:")) {
      current = {
        file: trimmed.slice(3),
        lines: { hit: 0, found: 0 },
        functions: { hit: 0, found: 0 },
        branches: { hit: 0, found: 0 },
      };
    } else if (trimmed.startsWith("LF:") && current) {
      current.lines.found = parseInt(trimmed.slice(3), 10);
    } else if (trimmed.startsWith("LH:") && current) {
      current.lines.hit = parseInt(trimmed.slice(3), 10);
    } else if (trimmed.startsWith("FNF:") && current) {
      current.functions.found = parseInt(trimmed.slice(4), 10);
    } else if (trimmed.startsWith("FNH:") && current) {
      current.functions.hit = parseInt(trimmed.slice(4), 10);
    } else if (trimmed.startsWith("BRF:") && current) {
      current.branches.found = parseInt(trimmed.slice(4), 10);
    } else if (trimmed.startsWith("BRH:") && current) {
      current.branches.hit = parseInt(trimmed.slice(4), 10);
    } else if (trimmed === "end_of_record" && current) {
      files.push(current);
      current = null;
    }
  }

  return files;
}

function inferPackageName(lcovFilePath) {
  let dir = dirname(resolve(lcovFilePath));

  while (dir !== "/" && dir !== ".") {
    const pkgPath = join(dir, "package.json");
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
        if (pkg.name) return pkg.name;
      } catch {
        // ignore
      }
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return "(root)";
}

// ─── Count total source lines ────────────────────────────────────────

function countSourceLines(projectDir) {
  try {
    const result = execSync(
      `find "${projectDir}" -type f \\( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.mjs" -o -name "*.cjs" \\) -not -path "*/node_modules/*" -not -path "*/dist/*" -not -path "*/.next/*" -not -path "*/build/*" -exec cat {} + 2>/dev/null | wc -l`,
      { encoding: "utf-8" },
    ).trim();
    return parseInt(result, 10) || 0;
  } catch {
    return 0;
  }
}

function countSourceFiles(projectDir) {
  try {
    const result = execSync(
      `find "${projectDir}" -type f \\( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.mjs" -o -name "*.cjs" \\) -not -path "*/node_modules/*" -not -path "*/dist/*" -not -path "*/.next/*" -not -path "*/build/*" 2>/dev/null | wc -l`,
      { encoding: "utf-8" },
    ).trim();
    return parseInt(result, 10) || 0;
  } catch {
    return 0;
  }
}

function countTestFiles(projectDir) {
  try {
    const result = execSync(
      `find "${projectDir}" -type f \\( -name "*.test.*" -o -name "*.spec.*" -o -name "*_test.*" -o -name "*_spec.*" \\) -not -path "*/node_modules/*" -not -path "*/dist/*" 2>/dev/null | wc -l`,
      { encoding: "utf-8" },
    ).trim();
    return parseInt(result, 10) || 0;
  } catch {
    return 0;
  }
}

// ─── Parse coverage ─────────────────────────────────────────────────

const packageMap = new Map();

for (const lcovFile of lcovFiles) {
  const packageName = inferPackageName(lcovFile);

  if (!packageMap.has(packageName)) {
    packageMap.set(packageName, { files: [] });
  }

  try {
    const content = readFileSync(lcovFile, "utf-8");
    const parsed = parseLcov(content);

    for (const f of parsed) {
      f.file =
        relative(projectPath, resolve(dirname(lcovFile), f.file)) || f.file;
    }

    packageMap.get(packageName).files.push(...parsed);
  } catch (err) {
    console.warn(`Warning: Failed to parse ${lcovFile}: ${err.message}`);
  }
}

// Deduplicate
for (const [, pkg] of packageMap) {
  const fileMap = new Map();
  for (const f of pkg.files) {
    fileMap.set(f.file, f);
  }
  pkg.files = Array.from(fileMap.values());
}

// ─── Find test results ──────────────────────────────────────────────

const testResultCandidates = [
  "test-results.json",
  "vitest-results.json",
  "jest-results.json",
  "coverage/test-results.json",
];

let testStats = null;

for (const candidate of testResultCandidates) {
  const fullPath = join(projectPath, candidate);
  if (existsSync(fullPath)) {
    try {
      const raw = JSON.parse(readFileSync(fullPath, "utf-8"));
      testStats = {
        suites: raw.numTotalTestSuites ?? 0,
        tests: raw.numTotalTests ?? 0,
        passed: raw.numPassedTests ?? 0,
        failed: raw.numFailedTests ?? 0,
        skipped: (raw.numPendingTests ?? 0) + (raw.numTodoTests ?? 0),
      };
      console.log(`Parsed test results from: ${fullPath}`);
      break;
    } catch {
      // try next
    }
  }
}

// ─── Compute coverage stats ─────────────────────────────────────────

function computeStats(files) {
  const s = {
    lines: { hit: 0, found: 0, pct: 0 },
    functions: { hit: 0, found: 0, pct: 0 },
    branches: { hit: 0, found: 0, pct: 0 },
  };
  for (const f of files) {
    s.lines.hit += f.lines.hit;
    s.lines.found += f.lines.found;
    s.functions.hit += f.functions.hit;
    s.functions.found += f.functions.found;
    s.branches.hit += f.branches.hit;
    s.branches.found += f.branches.found;
  }
  s.lines.pct = s.lines.found > 0 ? (s.lines.hit / s.lines.found) * 100 : 0;
  s.functions.pct =
    s.functions.found > 0 ? (s.functions.hit / s.functions.found) * 100 : 0;
  s.branches.pct =
    s.branches.found > 0 ? (s.branches.hit / s.branches.found) * 100 : 0;
  return s;
}

const allFiles = [];
for (const [, pkg] of packageMap) {
  allFiles.push(...pkg.files);
}

const coverageStats = computeStats(allFiles);
const totalLines = countSourceLines(projectPath);
const totalFiles = countSourceFiles(projectPath);
const testFileCount = countTestFiles(projectPath);
const sourceFileCount = totalFiles - testFileCount;
const packageCount = packageMap.size;

// ─── Build today's metrics ──────────────────────────────────────────

const todaysMetrics = {
  total_lines: totalLines,
  total_files: totalFiles,
  source_files: sourceFileCount,
  test_files: testFileCount,
  packages: packageCount,
  avg_lines_per_file:
    totalFiles > 0 ? parseFloat((totalLines / totalFiles).toFixed(1)) : 0,
  line_coverage: parseFloat(coverageStats.lines.pct.toFixed(2)),
  function_coverage: parseFloat(coverageStats.functions.pct.toFixed(2)),
  branch_coverage: parseFloat(coverageStats.branches.pct.toFixed(2)),
  uncovered_lines:
    coverageStats.lines.found > 0
      ? coverageStats.lines.found - coverageStats.lines.hit
      : 0,
};

if (testStats) {
  todaysMetrics.test_suites = testStats.suites;
  todaysMetrics.tests = testStats.tests;
  todaysMetrics.tests_passed = testStats.passed;
  todaysMetrics.tests_failed = testStats.failed;
  todaysMetrics.tests_skipped = testStats.skipped;
  todaysMetrics.test_pass_rate =
    testStats.tests > 0
      ? parseFloat(((testStats.passed / testStats.tests) * 100).toFixed(1))
      : 0;
  todaysMetrics.test_to_code_ratio =
    totalLines > 0
      ? parseFloat(((testStats.tests / totalLines) * 1000).toFixed(1))
      : 0;
}

// ─── Build output in history format ─────────────────────────────────

const allAreas = [
  "total_lines",
  "total_files",
  "source_files",
  "test_files",
  "packages",
  "avg_lines_per_file",
  "test_suites",
  "tests",
  "tests_passed",
  "tests_failed",
  "tests_skipped",
  "test_pass_rate",
  "test_to_code_ratio",
  "line_coverage",
  "function_coverage",
  "branch_coverage",
  "uncovered_lines",
];

const todaysDate = new Date().toISOString().slice(0, 10);

// Try to load existing fixture to preserve history
let existingHistory = [];
const outputPath = join(fixtureDir, `${slug}.json`);
if (existsSync(outputPath)) {
  try {
    const existing = JSON.parse(readFileSync(outputPath, "utf-8"));
    if (existing.history) {
      existingHistory = existing.history.filter(
        (entry) => entry.date !== todaysDate,
      );
    }
  } catch {
    // start fresh
  }
}

existingHistory.push({ date: todaysDate, metrics: todaysMetrics });
existingHistory.sort((a, b) => a.date.localeCompare(b.date));

const output = {
  config: { areas: allAreas },
  history: existingHistory,
};

mkdirSync(fixtureDir, { recursive: true });
writeFileSync(outputPath, JSON.stringify(output, null, 2), "utf-8");

console.log(`\nFixture written to: ${outputPath}`);
console.log(`  History entries: ${existingHistory.length}`);
console.log(`  Total lines: ${totalLines}`);
console.log(`  Total files: ${totalFiles}`);
console.log(`  Packages: ${packageCount}`);
console.log(`  Line coverage: ${coverageStats.lines.pct.toFixed(1)}%`);
if (testStats) {
  console.log(`  Tests: ${testStats.passed}/${testStats.tests} passed`);
}
