#!/usr/bin/env node

/**
 * CLI entry point for registering a module in modules.json.
 *
 * Usage: node register-module.js <module-dir>
 *
 * If <module-dir> is not provided, falls back to resolving from
 * the caller's __dirname (for backwards compatibility with action.yml).
 */

import { resolve } from "node:path";
import { registerModule } from "./module-helpers.js";

const moduleDir = resolve(process.argv[2] || process.env.DASHBUILD_MODULE_DIR);
registerModule(moduleDir);
