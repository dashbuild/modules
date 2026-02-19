import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
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

const dashbuildDir = process.env.DASHBUILD_DIR;
if (!dashbuildDir) {
  console.error(
    "::error::DASHBUILD_DIR is not set. Did you run dashbuild/setup first?",
  );
  process.exit(1);
}

const sourcePath = resolve(process.env.SOURCE_PATH || ".");
const sourcePatterns = (
  process.env.SOURCE_PATTERNS ||
  "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx,vue,svelte,py,rb,go,rs,java,kt,kts,scala,cs,fs,cpp,cc,cxx,c,h,hpp,hxx,swift,m,mm,php,lua,r,R,pl,pm,sh,bash,zsh,fish,ps1,psm1,ex,exs,erl,hrl,hs,elm,clj,cljs,cljc,dart,zig,nim,v,sql,graphql,gql,proto,tf,hcl,nix,css,scss,sass,less,html,xml,svg,yaml,yml,toml,ini,conf,cfg,md,mdx,rst,tex,dockerfile}"
)
  .split(",")
  .map((p) => p.trim())
  .filter(Boolean);
const taskTags = (
  process.env.TASK_TAGS || "TODO,FIXME,HACK,REVIEW,NOTE,BUG,XXX"
)
  .split(",")
  .map((t) => t.trim())
  .filter(Boolean);
const contextLines = parseInt(process.env.CONTEXT_LINES || "5", 10);
const customRegex = process.env.TASK_REGEX || "";

// ─── Main ───────────────────────────────────────────────────────────

console.log(`Scanning: ${sourcePath}`);
console.log(`Patterns: ${sourcePatterns.join(", ")}`);
console.log(`Tags: ${taskTags.join(", ")}`);
console.log(`Context: ±${contextLines} lines`);

const sourceFiles = findSourceFiles(sourcePath, { patterns: sourcePatterns });
console.log(`Found ${sourceFiles.length} source file(s)`);

const tagRegex = buildTagRegex(taskTags, customRegex);
const allTasks = [];

for (const file of sourceFiles) {
  const relativePath = relative(sourcePath, file);
  const tasks = scanFile(file, tagRegex, contextLines);

  for (const task of tasks) {
    task.file = relativePath;
    allTasks.push(task);
  }
}

const output = buildTaskOutput(allTasks, taskTags, sourceFiles.length);

const outputPath = join(dashbuildDir, "src", "data", `${slug}.json`);
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, JSON.stringify(output, null, 2), "utf-8");

console.log(`\nData written to ${outputPath}`);
console.log(`  Total tasks: ${allTasks.length}`);
for (const [tag, count] of Object.entries(output.summary.byTag)) {
  if (count > 0) console.log(`  ${tag}: ${count}`);
}
