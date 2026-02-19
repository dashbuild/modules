# Dashbuild Code Tasks Module

Scans source code across all languages for task comments (TODO, FIXME, HACK, REVIEW, NOTE, BUG, XXX) and generates a GitHub-themed report showing each task with surrounding code context.

## Features

- **Multi-tag support** — Finds TODO, FIXME, HACK, REVIEW, NOTE, BUG, and XXX comments
- **Code context** — Shows ±5 lines around each task with syntax-aware formatting
- **Click to expand** — Context blocks are collapsed by default, expandable on click
- **Filtering** — Filter tasks by tag type or file path
- **Language detection** — Automatically detects language from file extension for styling
- **GitHub dark theme** — Familiar code-review aesthetic with tag-colored badges

## Quick Start

```yaml
- uses: your-org/dashbuild/modules/code-tasks@main
```

## Inputs

| Input           | Required | Default                               | Description                                        |
| --------------- | -------- | ------------------------------------- | -------------------------------------------------- |
| `source-path`   | No       | `src`                                 | Directory to scan for source files                 |
| `patterns`      | No       | `**/*.{js,ts,jsx,tsx,vue,svelte}`     | Comma-separated glob patterns for source files     |
| `tags`          | No       | `TODO,FIXME,HACK,REVIEW,NOTE,BUG,XXX` | Comma-separated task tags to search for            |
| `context-lines` | No       | `5`                                   | Lines of context above and below each task comment |

### Supported Tags

| Tag      | Color  | Typical Use                             |
| -------- | ------ | --------------------------------------- |
| `TODO`   | Blue   | Planned work or missing features        |
| `FIXME`  | Red    | Known bugs that need fixing             |
| `HACK`   | Orange | Temporary workarounds                   |
| `REVIEW` | Purple | Code that needs peer review             |
| `NOTE`   | Green  | Important context for future developers |
| `BUG`    | Red    | Confirmed bugs                          |
| `XXX`    | Orange | Dangerous or fragile code               |

## Examples

### Default — scan src/ for all tags

```yaml
- uses: your-org/dashbuild/modules/code-tasks@main
```

### Custom source path and patterns

```yaml
- uses: your-org/dashbuild/modules/code-tasks@main
  with:
    source-path: "."
    patterns: "**/*.{ts,tsx},**/*.vue"
```

### Only TODOs and FIXMEs with more context

```yaml
- uses: your-org/dashbuild/modules/code-tasks@main
  with:
    tags: "TODO,FIXME"
    context-lines: "10"
```

## Local Development

### Using example fixtures

```bash
# Copy the example fixture for quick testing
cp modules/code-tasks/fixtures/code-tasks.json.example \
   modules/code-tasks/fixtures/code-tasks.json

# Preview
just dev code-tasks
```

### Generating fixtures from a real project

```bash
# Scan a real project for task comments
just generate-fixture-code-tasks /path/to/your/project

# Preview
just dev code-tasks
```

## Report Sections

### Overview

Summary cards showing total task count and per-tag breakdown with colored badges.

### Filter

Interactive controls to filter tasks by tag type or file path substring.

### Tasks

Each task is rendered as a code block with:

- **Header** — Tag badge, file path, line number, and task description
- **Expandable context** — Click "Show context" to reveal ±5 lines of surrounding code
- **Highlighted task line** — The comment line is visually highlighted within the context
- **Line numbers** — Matching the original source file
