/**
 * Shared task scanning utilities for the code-tasks module.
 *
 * Used by both scan-tasks.js (CI) and generate-fixture.js (local dev).
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, extname } from "node:path";

// ─── File extension → language mapping ──────────────────────────────

export const extToLanguage = {
  // JavaScript / TypeScript
  ".js": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".jsx": "javascript",
  ".ts": "typescript",
  ".mts": "typescript",
  ".cts": "typescript",
  ".tsx": "typescript",
  // Web frameworks
  ".vue": "vue",
  ".svelte": "svelte",
  // Python
  ".py": "python",
  ".pyw": "python",
  ".pyi": "python",
  // Ruby
  ".rb": "ruby",
  ".rake": "ruby",
  ".gemspec": "ruby",
  // Go
  ".go": "go",
  // Rust
  ".rs": "rust",
  // Java / JVM
  ".java": "java",
  ".kt": "kotlin",
  ".kts": "kotlin",
  ".scala": "scala",
  ".groovy": "groovy",
  // C#/.NET
  ".cs": "csharp",
  ".fs": "fsharp",
  ".vb": "vb",
  // C/C++
  ".c": "c",
  ".h": "c",
  ".cpp": "cpp",
  ".cc": "cpp",
  ".cxx": "cpp",
  ".hpp": "cpp",
  ".hxx": "cpp",
  // Swift / Objective-C
  ".swift": "swift",
  ".m": "objectivec",
  ".mm": "objectivec",
  // PHP
  ".php": "php",
  // Lua
  ".lua": "lua",
  // R
  ".r": "r",
  ".R": "r",
  // Perl
  ".pl": "perl",
  ".pm": "perl",
  // Shell
  ".sh": "bash",
  ".bash": "bash",
  ".zsh": "bash",
  ".fish": "fish",
  ".ps1": "powershell",
  ".psm1": "powershell",
  // Elixir / Erlang
  ".ex": "elixir",
  ".exs": "elixir",
  ".erl": "erlang",
  ".hrl": "erlang",
  // Haskell / Elm
  ".hs": "haskell",
  ".elm": "elm",
  // Clojure
  ".clj": "clojure",
  ".cljs": "clojure",
  ".cljc": "clojure",
  // Dart
  ".dart": "dart",
  // Zig / Nim / V
  ".zig": "zig",
  ".nim": "nim",
  ".v": "v",
  // SQL
  ".sql": "sql",
  // GraphQL / Protobuf
  ".graphql": "graphql",
  ".gql": "graphql",
  ".proto": "protobuf",
  // Infrastructure
  ".tf": "hcl",
  ".hcl": "hcl",
  ".nix": "nix",
  ".dockerfile": "dockerfile",
  // Styles
  ".css": "css",
  ".scss": "scss",
  ".sass": "sass",
  ".less": "less",
  // Markup
  ".html": "html",
  ".xml": "xml",
  ".svg": "xml",
  // Config / Data
  ".yaml": "yaml",
  ".yml": "yaml",
  ".toml": "toml",
  ".ini": "ini",
  ".conf": "ini",
  ".cfg": "ini",
  ".json": "json",
  // Documentation
  ".md": "markdown",
  ".mdx": "markdown",
  ".rst": "rst",
  ".tex": "latex",
};

export function detectLanguage(filePath) {
  const ext = extname(filePath).toLowerCase();
  return extToLanguage[ext] || "text";
}

// ─── Glob matching (simple) ─────────────────────────────────────────

export function matchesPattern(filePath, patterns) {
  const ext = extname(filePath).toLowerCase();

  for (const pattern of patterns) {
    // Extract extensions from brace patterns like "**/*.{js,ts,jsx,tsx}"
    const braceMatch = pattern.match(/\.\{([^}]+)\}$/);
    if (braceMatch) {
      const extensions = braceMatch[1].split(",").map((e) => `.${e.trim()}`);
      if (extensions.includes(ext)) return true;
      continue;
    }

    // Simple extension match like "**/*.js"
    const extMatch = pattern.match(/\*(\.\w+)$/);
    if (extMatch && ext === extMatch[1]) return true;

    // Exact filename match
    if (filePath.endsWith(pattern)) return true;
  }

  return false;
}

// ─── Recursive file discovery ───────────────────────────────────────

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
  ".next",
  ".nuxt",
  ".svelte-kit",
  "__pycache__",
  ".dev",
]);

/**
 * Find source files recursively. When `patterns` is provided, uses glob
 * matching. When `validExtensions` is provided, filters by extension set.
 * If neither is provided, returns all files.
 */
export function findSourceFiles(dir, { patterns, validExtensions } = {}) {
  const results = [];

  if (!existsSync(dir)) return results;

  function walk(currentDir) {
    let entries;
    try {
      entries = readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.name.startsWith(".") && entry.isDirectory()) continue;
      if (SKIP_DIRS.has(entry.name) && entry.isDirectory()) continue;

      const fullPath = join(currentDir, entry.name);

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        if (patterns) {
          if (matchesPattern(entry.name, patterns)) results.push(fullPath);
        } else if (validExtensions) {
          const ext = extname(entry.name).toLowerCase();
          if (validExtensions.has(ext)) results.push(fullPath);
        } else {
          results.push(fullPath);
        }
      }
    }
  }

  walk(dir);
  return results;
}

// ─── Task scanning ──────────────────────────────────────────────────

/**
 * Build a regex to match task tags in comments across many languages.
 * Supports: //, *, #, <!--, --, %, ;, (*, {-
 */
export function buildTagRegex(tags, customRegex = "") {
  if (customRegex) {
    try {
      return new RegExp(customRegex, "i");
    } catch (err) {
      console.warn(
        `::warning::Invalid custom regex "${customRegex}": ${err.message}. Falling back to default.`,
      );
    }
  }

  const escaped = tags.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(
    `(?:\\/\\/|\\*|#|<!--|--|%|;|\\(\\*|\\{-)\\s*(${escaped.join("|")})\\b[:\\s]?(.*)`,
    "i",
  );
}

export function scanFile(filePath, tagRegex, numContextLines) {
  let content;
  try {
    content = readFileSync(filePath, "utf-8");
  } catch {
    return [];
  }

  const lines = content.split("\n");
  const tasks = [];

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(tagRegex);
    if (!match) continue;

    const tag = match[1].toUpperCase();
    const text = match[2]
      .replace(/\s*\*\/\s*$/, "")
      .replace(/\s*-->\s*$/, "")
      .trim();

    const beforeStart = Math.max(0, i - numContextLines);
    const afterEnd = Math.min(lines.length - 1, i + numContextLines);

    tasks.push({
      file: filePath,
      line: i + 1,
      tag,
      text,
      language: detectLanguage(filePath),
      context: {
        before: lines.slice(beforeStart, i),
        taskLine: lines[i],
        after: lines.slice(i + 1, afterEnd + 1),
        startLine: beforeStart + 1,
      },
    });
  }

  return tasks;
}

// ─── Summary builder ────────────────────────────────────────────────

export function buildTaskOutput(allTasks, tags, filesScanned) {
  allTasks.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);

  const byTag = {};
  for (const tag of tags) {
    byTag[tag] = 0;
  }
  for (const task of allTasks) {
    byTag[task.tag] = (byTag[task.tag] || 0) + 1;
  }

  const byFile = {};
  for (const task of allTasks) {
    byFile[task.file] = (byFile[task.file] || 0) + 1;
  }

  return {
    summary: {
      total: allTasks.length,
      byTag,
      byFile,
      filesScanned,
      filesWithTasks: Object.keys(byFile).length,
    },
    tasks: allTasks,
    tags,
  };
}
