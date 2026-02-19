/**
 * Shared history merging for Dashbuild modules.
 *
 * Handles deduplication, retention pruning, and cache management for
 * any module that tracks metrics over time (sonarqube, js-code-stats, etc.).
 *
 * Can be used as:
 *   - An imported function: `import { mergeHistory } from "./merge-history.js"`
 *   - A CLI script: `node merge-history.js <metricsJson> <cacheFile> <areas> <outputFile> [retentionDays]`
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

/**
 * Merge today's metrics into a historical data file.
 *
 * @param {object} options
 * @param {object} options.todaysMetrics    — Flat object of metric key/value pairs
 * @param {string} [options.cacheFilePath]  — Path to existing cache file (empty = no cache)
 * @param {string[]} options.areas          — List of enabled metric area names
 * @param {string} options.outputFilePath   — Where to write the merged output JSON
 * @param {number} [options.retentionDays]  — Days to retain (0 = keep all)
 */
export function mergeHistory({
  todaysMetrics,
  cacheFilePath = "",
  areas,
  outputFilePath,
  retentionDays = 0,
}) {
  const todaysDate = new Date().toISOString().slice(0, 10);
  const todayEntry = { date: todaysDate, metrics: todaysMetrics };

  // ─── Load existing history from cache ──────────────────────────────

  let existingData = { config: { areas: [] }, history: [] };

  if (cacheFilePath && existsSync(cacheFilePath)) {
    try {
      existingData = JSON.parse(readFileSync(cacheFilePath, "utf-8"));
      console.log(
        "Loaded " +
          existingData.history.length +
          " existing entries from cache",
      );
    } catch {
      console.log("Cache file unreadable, starting fresh");
    }
  }

  // ─── Deduplicate and append today's entry ──────────────────────────

  let history = existingData.history.filter(
    (entry) => entry.date !== todaysDate,
  );
  history.push(todayEntry);
  history.sort((a, b) => a.date.localeCompare(b.date));

  // ─── Prune entries older than the retention period ─────────────────

  if (retentionDays > 0) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const cutoffString = cutoffDate.toISOString().slice(0, 10);

    const countBefore = history.length;
    history = history.filter((entry) => entry.date >= cutoffString);
    const prunedCount = countBefore - history.length;

    if (prunedCount > 0) {
      console.log(
        "Pruned " +
          prunedCount +
          " entries older than " +
          retentionDays +
          " days",
      );
    }
  }

  // ─── Write output ──────────────────────────────────────────────────

  const outputData = { config: { areas }, history };
  const outputJson = JSON.stringify(outputData, null, 2);

  mkdirSync(dirname(outputFilePath), { recursive: true });
  writeFileSync(outputFilePath, outputJson);
  console.log("Wrote " + history.length + " entries to " + outputFilePath);

  // ─── Update cache if provided ──────────────────────────────────────

  if (cacheFilePath) {
    mkdirSync(dirname(cacheFilePath), { recursive: true });
    writeFileSync(cacheFilePath, outputJson);
    console.log("Updated cache at " + cacheFilePath);
  }

  return outputData;
}

// ─── CLI entry point ─────────────────────────────────────────────────

const isCliInvocation =
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);

if (isCliInvocation) {
  const metricsJson = process.argv[2];
  const cacheFilePath = process.argv[3];
  const areasString = process.argv[4];
  const outputFilePath = process.argv[5];
  const retentionDays = parseInt(process.argv[6], 10) || 0;

  if (!metricsJson || !areasString || !outputFilePath) {
    console.error(
      "Usage: node merge-history.js <metricsJson> <cacheFile> <areas> <outputFile> [retentionDays]",
    );
    process.exit(1);
  }

  mergeHistory({
    todaysMetrics: JSON.parse(metricsJson),
    cacheFilePath,
    areas: areasString
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean),
    outputFilePath,
    retentionDays,
  });
}
