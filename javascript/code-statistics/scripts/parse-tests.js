import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { mergeHistory } from "../../../../scripts/lib/merge-history.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const moduleDir = join(__dirname, "..");
const moduleConfig = JSON.parse(
  readFileSync(join(moduleDir, "module.json"), "utf-8"),
);
const slug = moduleConfig.slug;

const dashbuildDir = process.env.DASHBUILD_DIR;
if (!dashbuildDir) {
  console.error(
    "::error::DASHBUILD_DIR is not set. Did you run dashbuild/setup first?",
  );
  process.exit(1);
}

const coveragePath = resolve(process.env.COVERAGE_PATH || ".");
const testRunner = (process.env.TEST_RUNNER || "vitest").toLowerCase();
const testResultsPath = process.env.TEST_RESULTS_PATH || "";
const cacheFile = process.env.CACHE_FILE || "";
const retentionDays = process.env.RETENTION_DAYS || "90";

// ─── LCOV parsing ───────────────────────────────────────────────────

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

// ─── Package name inference ─────────────────────────────────────────

function inferPackageName(lcovFilePath) {
  let dir = dirname(resolve(lcovFilePath));

  while (dir !== "/" && dir !== ".") {
    const pkgPath = join(dir, "package.json");
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
        if (pkg.name) {
          return pkg.name;
        }
      } catch {
        // ignore parse errors
      }
    }

    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return null;
}

// ─── Count total source lines and files ─────────────────────────────

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

// ─── Find LCOV files ────────────────────────────────────────────────

let lcovFiles;
try {
  const result = execSync(
    `find "${coveragePath}" -type f \\( -name "lcov.info" -o -name "*.lcov" \\) 2>/dev/null || true`,
    { encoding: "utf-8" },
  ).trim();
  lcovFiles = result ? result.split("\n").filter(Boolean) : [];
} catch {
  lcovFiles = [];
}

if (lcovFiles.length === 0) {
  console.warn(
    "::warning::No LCOV coverage files found. Coverage data will be empty.",
  );
}

console.log(`Found ${lcovFiles.length} LCOV file(s):`);
lcovFiles.forEach((f) => console.log(`  - ${f}`));

// ─── Parse coverage by package ──────────────────────────────────────

const packageMap = new Map();

for (const lcovFile of lcovFiles) {
  const packageName = inferPackageName(lcovFile) || "(root)";

  if (!packageMap.has(packageName)) {
    packageMap.set(packageName, { files: [], lcovFile });
  }

  try {
    const content = readFileSync(lcovFile, "utf-8");
    const parsed = parseLcov(content);

    // Make file paths relative to the coverage search root
    for (const f of parsed) {
      f.file =
        relative(coveragePath, resolve(dirname(lcovFile), f.file)) || f.file;
    }

    packageMap.get(packageName).files.push(...parsed);
  } catch (err) {
    console.warn(`::warning::Failed to parse ${lcovFile}: ${err.message}`);
  }
}

// Deduplicate files within each package
for (const [, pkg] of packageMap) {
  const fileMap = new Map();
  for (const f of pkg.files) {
    fileMap.set(f.file, f);
  }
  pkg.files = Array.from(fileMap.values());
}

// ─── Compute coverage stats ─────────────────────────────────────────

function computeCoverageStats(files) {
  const stats = {
    lines: { hit: 0, found: 0, pct: 0 },
    functions: { hit: 0, found: 0, pct: 0 },
    branches: { hit: 0, found: 0, pct: 0 },
  };

  for (const f of files) {
    stats.lines.hit += f.lines.hit;
    stats.lines.found += f.lines.found;
    stats.functions.hit += f.functions.hit;
    stats.functions.found += f.functions.found;
    stats.branches.hit += f.branches.hit;
    stats.branches.found += f.branches.found;
  }

  stats.lines.pct =
    stats.lines.found > 0 ? (stats.lines.hit / stats.lines.found) * 100 : 0;
  stats.functions.pct =
    stats.functions.found > 0
      ? (stats.functions.hit / stats.functions.found) * 100
      : 0;
  stats.branches.pct =
    stats.branches.found > 0
      ? (stats.branches.hit / stats.branches.found) * 100
      : 0;

  return stats;
}

// ─── Parse test results ─────────────────────────────────────────────

const defaultTestPaths = {
  vitest: [
    "test-results.json",
    "vitest-results.json",
    "coverage/test-results.json",
  ],
  jest: [
    "test-results.json",
    "jest-results.json",
    "coverage/test-results.json",
  ],
  cypress: [
    "cypress/results/output.json",
    "mochawesome-report/mochawesome.json",
    "cypress/reports/mochawesome.json",
  ],
};

function findTestResults() {
  if (testResultsPath && existsSync(testResultsPath)) {
    return testResultsPath;
  }

  const candidates = defaultTestPaths[testRunner] || defaultTestPaths.vitest;
  for (const candidate of candidates) {
    const fullPath = resolve(coveragePath, candidate);
    if (existsSync(fullPath)) {
      return fullPath;
    }
  }

  return null;
}

function parseVitestJest(data) {
  return {
    suites: data.numTotalTestSuites ?? 0,
    tests: data.numTotalTests ?? 0,
    passed: data.numPassedTests ?? 0,
    failed: data.numFailedTests ?? 0,
    skipped: (data.numPendingTests ?? 0) + (data.numTodoTests ?? 0),
  };
}

function parseCypress(data) {
  const stats = data.stats || {};
  return {
    suites: stats.suites ?? 0,
    tests: stats.tests ?? 0,
    passed: stats.passes ?? 0,
    failed: stats.failures ?? 0,
    skipped: stats.pending ?? 0,
  };
}

const testResultsFile = findTestResults();
let testStats = null;

if (testResultsFile) {
  try {
    const raw = JSON.parse(readFileSync(testResultsFile, "utf-8"));
    console.log(
      `Parsing test results from: ${testResultsFile} (${testRunner})`,
    );

    if (testRunner === "cypress") {
      testStats = parseCypress(raw);
    } else {
      testStats = parseVitestJest(raw);
    }
  } catch (err) {
    console.warn(
      `::warning::Failed to parse test results from ${testResultsFile}: ${err.message}`,
    );
  }
} else {
  console.log(
    "No test results file found. Test statistics will not be included.",
  );
}

// ─── Build today's metrics ──────────────────────────────────────────

const allFiles = [];
for (const [, pkg] of packageMap) {
  allFiles.push(...pkg.files);
}

const coverageStats = computeCoverageStats(allFiles);
const totalLines = countSourceLines(coveragePath);
const totalFiles = countSourceFiles(coveragePath);
const packageCount = packageMap.size;

const todaysMetrics = {
  total_lines: totalLines,
  total_files: totalFiles,
  packages: packageCount,
  line_coverage: parseFloat(coverageStats.lines.pct.toFixed(2)),
  function_coverage: parseFloat(coverageStats.functions.pct.toFixed(2)),
  branch_coverage: parseFloat(coverageStats.branches.pct.toFixed(2)),
};

if (testStats) {
  todaysMetrics.test_suites = testStats.suites;
  todaysMetrics.tests = testStats.tests;
  todaysMetrics.tests_passed = testStats.passed;
  todaysMetrics.tests_failed = testStats.failed;
  todaysMetrics.tests_skipped = testStats.skipped;
}

// ─── Merge into history and write output ────────────────────────────

const allAreas = [
  "total_lines",
  "total_files",
  "packages",
  "test_suites",
  "tests",
  "tests_passed",
  "tests_failed",
  "tests_skipped",
  "line_coverage",
  "function_coverage",
  "branch_coverage",
];

const outputPath = join(dashbuildDir, "src", "data", `${slug}.json`);

mergeHistory({
  todaysMetrics,
  cacheFilePath: cacheFile,
  areas: allAreas,
  outputFilePath: outputPath,
  retentionDays: parseInt(retentionDays, 10) || 0,
});

console.log(`\nData written to ${outputPath}`);
console.log(`  Total lines: ${totalLines}`);
console.log(`  Total files: ${totalFiles}`);
console.log(`  Packages: ${packageCount}`);
console.log(`  Line coverage: ${coverageStats.lines.pct.toFixed(1)}%`);
if (testStats) {
  console.log(`  Tests: ${testStats.passed}/${testStats.tests} passed`);
}
