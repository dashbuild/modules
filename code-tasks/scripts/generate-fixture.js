#!/usr/bin/env node

/**
 * Generate fixture data for the code-tasks module from a real project.
 *
 * Usage:
 *   node generate-fixture.js [project-path]
 *
 * Scans the given directory (default: cwd) for source files containing task
 * comments (TODO, FIXME, etc.) and writes parsed output to the fixtures directory.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  extToLanguage,
  findSourceFiles,
  buildTagRegex,
  scanFile,
  buildTaskOutput,
} from "./lib/scanner.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const moduleDir = join(__dirname, "..");
const moduleConfig = JSON.parse(
  readFileSync(join(moduleDir, "module.json"), "utf-8"),
);
const slug = moduleConfig.slug;
const fixtureDir = join(moduleDir, "fixtures");

const projectPath = resolve(process.argv[2] || ".");
const contextLines = 5;
const taskTags = ["TODO", "FIXME", "HACK", "REVIEW", "NOTE", "BUG", "XXX"];

if (!existsSync(projectPath)) {
  console.error(`Error: Project path does not exist: ${projectPath}`);
  process.exit(1);
}

console.log(`Scanning project at: ${projectPath}`);

// ─── Main ───────────────────────────────────────────────────────────

const validExtensions = new Set(Object.keys(extToLanguage));
const sourceFiles = findSourceFiles(projectPath, { validExtensions });
console.log(`Found ${sourceFiles.length} source file(s)`);

const tagRegex = buildTagRegex(taskTags);
const allTasks = [];

for (const file of sourceFiles) {
  const relativePath = relative(projectPath, file);
  const tasks = scanFile(file, tagRegex, contextLines);

  for (const task of tasks) {
    task.file = relativePath;
    allTasks.push(task);
  }
}

const output = buildTaskOutput(allTasks, taskTags, sourceFiles.length);

mkdirSync(fixtureDir, { recursive: true });
const outputPath = join(fixtureDir, `${slug}.json`);
writeFileSync(outputPath, JSON.stringify(output, null, 2), "utf-8");

console.log(`\nFixture written to: ${outputPath}`);
console.log(`  Total tasks: ${allTasks.length}`);
for (const [tag, count] of Object.entries(output.summary.byTag)) {
  if (count > 0) console.log(`  ${tag}: ${count}`);
}
