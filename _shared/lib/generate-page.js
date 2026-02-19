#!/usr/bin/env node

/**
 * CLI entry point for generating a module's page and theme.
 *
 * Usage: node generate-page.js <module-dir>
 */

import { resolve } from "node:path";
import { generatePage } from "./module-helpers.js";

const moduleDir = resolve(process.argv[2] || process.env.DASHBUILD_MODULE_DIR);
generatePage(moduleDir);
