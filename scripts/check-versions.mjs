#!/usr/bin/env node
/* eslint-disable no-undef */
// Version-drift guard for the SmartTable monorepo.
//
// Fails if any publishable package version differs from the unified version
// defined below. Exposed as `pnpm check:versions`.
//
// The authoritative list of publishable packages is the fixed group in
// `.changeset/config.json`. Private apps (docs, playground, storybook,
// performance, www) are excluded by construction. Packages are located under
// the workspace roots `packages/`, `apps/` and `examples/`.

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdir } from 'node:fs/promises';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const UNIFIED_VERSION = '0.9.0-beta';

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

const config = readJson(resolve(root, '.changeset/config.json'));
const fixedGroup = config.fixed?.[0];
if (!fixedGroup || fixedGroup.length !== 12) {
  console.error(
    `check:versions: expected the 12-package fixed group in .changeset/config.json, found ${fixedGroup?.length ?? 0} packages`
  );
  process.exit(1);
}

// Workspace roots (from pnpm-workspace.yaml: 'packages/*', 'apps/*', 'examples/*').
const workspaceRoots = ['packages', 'apps', 'examples'];

async function findManifest(pkgName) {
  for (const rootDir of workspaceRoots) {
    try {
      const entries = await readdir(resolve(root, rootDir));
      const short = pkgName.replace(/^@[^/]+\//, '');
      if (entries.includes(short)) {
        return resolve(root, rootDir, short, 'package.json');
      }
    } catch {
      // workspace root missing — skip
    }
  }
  return null;
}

const failures = [];
const inspected = [];

for (const pkgName of fixedGroup) {
  const manifestPath = await findManifest(pkgName);
  if (!manifestPath) {
    failures.push(`${pkgName}: package.json not found under any workspace root`);
    continue;
  }
  const manifest = readJson(manifestPath);
  inspected.push(`${pkgName}@${manifest.version}`);
  if (manifest.version !== UNIFIED_VERSION) {
    failures.push(`${pkgName}: expected ${UNIFIED_VERSION}, found ${manifest.version}`);
  }
}

if (failures.length > 0) {
  console.error('Version drift detected:');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log(
  `check:versions: OK — all ${inspected.length} publishable packages at ${UNIFIED_VERSION}`
);
