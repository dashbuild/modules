import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
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
const enableTests =
  (process.env.ENABLE_TESTS || "true").toLowerCase() !== "false";
const enableCoverage =
  (process.env.ENABLE_COVERAGE || "true").toLowerCase() !== "false";
const sourcePatterns = (process.env.SOURCE_PATTERNS || "")
  .split(",")
  .map((p) => p.trim())
  .filter(Boolean);

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

// ─── Find source files ──────────────────────────────────────────────

const DEFAULT_EXTENSIONS = ["ts", "tsx", "js", "jsx", "mjs", "cjs"];
const DEFAULT_EXCLUDES = ["node_modules", "dist", ".next", "build"];

function findSourceFiles(projectDir, patterns) {
  try {
    let cmd;
    if (patterns.length > 0) {
      // Use bash globstar to expand user-provided patterns (unquoted so globs expand)
      const globExpr = patterns.map((p) => `${projectDir}/${p}`).join(" ");
      cmd = `bash -c 'shopt -s globstar nullglob; for f in ${globExpr}; do [ -f "$f" ] && echo "$f"; done'`;
    } else {
      // Default: find all JS/TS files, excluding common non-source directories
      const nameArgs = DEFAULT_EXTENSIONS.map((ext) => `-name "*.${ext}"`).join(
        " -o ",
      );
      const excludeArgs = DEFAULT_EXCLUDES.map(
        (dir) => `-not -path "*/${dir}/*"`,
      ).join(" ");
      cmd = `find "${projectDir}" -type f \\( ${nameArgs} \\) ${excludeArgs} 2>/dev/null`;
    }
    const result = execSync(cmd, { encoding: "utf-8" }).trim();
    return result ? result.split("\n").filter(Boolean) : [];
  } catch {
    return [];
  }
}

function countLines(files) {
  if (files.length === 0) return 0;
  try {
    // Process in batches to avoid argument list too long
    let total = 0;
    const batchSize = 500;
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      const result = execSync(
        `cat ${batch.map((f) => `"${f}"`).join(" ")} 2>/dev/null | wc -l`,
        {
          encoding: "utf-8",
        },
      ).trim();
      total += parseInt(result, 10) || 0;
    }
    return total;
  } catch {
    return 0;
  }
}

// ─── Find LCOV files ────────────────────────────────────────────────

let lcovFiles = [];

if (enableCoverage) {
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
} else {
  console.log("Coverage collection is disabled.");
}

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

let testStats = null;

if (enableTests) {
  const testResultsFile = findTestResults();

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
} else {
  console.log("Test result collection is disabled.");
}

// ─── Build today's metrics ──────────────────────────────────────────

const allFiles = [];
for (const [, pkg] of packageMap) {
  allFiles.push(...pkg.files);
}

const coverageStats = enableCoverage ? computeCoverageStats(allFiles) : null;
const allSourceFiles = findSourceFiles(coveragePath, sourcePatterns);
const totalLines = countLines(allSourceFiles);
const totalFiles = allSourceFiles.length;
const packageCount = packageMap.size;

// Classify files as source vs test
const testFilePatterns = /(\.test\.|_test\.|\.(spec)\.|__tests__)/;
const srcFileCount = allSourceFiles.filter(
  (f) => !testFilePatterns.test(f),
).length;
const testFileCount = allSourceFiles.filter((f) =>
  testFilePatterns.test(f),
).length;

const todaysMetrics = {
  total_lines: totalLines,
  total_files: totalFiles,
  source_files: srcFileCount,
  test_files: testFileCount,
  packages: packageCount,
  avg_lines_per_file:
    totalFiles > 0 ? parseFloat((totalLines / totalFiles).toFixed(1)) : 0,
};

if (enableCoverage && coverageStats) {
  todaysMetrics.line_coverage = parseFloat(coverageStats.lines.pct.toFixed(2));
  todaysMetrics.function_coverage = parseFloat(
    coverageStats.functions.pct.toFixed(2),
  );
  todaysMetrics.branch_coverage = parseFloat(
    coverageStats.branches.pct.toFixed(2),
  );
  todaysMetrics.uncovered_lines =
    coverageStats.lines.found - coverageStats.lines.hit;
}

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

// ─── Merge into history and write output ────────────────────────────

const codebaseAreas = [
  "total_lines",
  "total_files",
  "source_files",
  "test_files",
  "packages",
  "avg_lines_per_file",
];
const testAreas = [
  "test_suites",
  "tests",
  "tests_passed",
  "tests_failed",
  "tests_skipped",
  "test_pass_rate",
  "test_to_code_ratio",
];
const coverageAreas = [
  "line_coverage",
  "function_coverage",
  "branch_coverage",
  "uncovered_lines",
];

const allAreas = [
  ...codebaseAreas,
  ...(enableTests ? testAreas : []),
  ...(enableCoverage ? coverageAreas : []),
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
if (enableCoverage && coverageStats) {
  console.log(`  Line coverage: ${coverageStats.lines.pct.toFixed(1)}%`);
}
if (testStats) {
  console.log(`  Tests: ${testStats.passed}/${testStats.tests} passed`);
}
