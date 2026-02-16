#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const PACKAGE_FILES = [
  'package.json',
  'packages/ui/package.json',
  'packages/web/package.json',
];

const BUN_LOCK = 'bun.lock';

const newVersion = process.argv[2];
if (!newVersion || !/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(newVersion)) {
  console.error('Usage: node scripts/bump-version.mjs <version>');
  console.error('Example: node scripts/bump-version.mjs 0.2.0');
  console.error('Example: node scripts/bump-version.mjs 0.2.0-beta.1');
  process.exit(1);
}

console.log(`Bumping version to ${newVersion}\n`);

for (const packageFile of PACKAGE_FILES) {
  const fullPath = path.join(ROOT, packageFile);
  const content = fs.readFileSync(fullPath, 'utf8');
  const pkg = JSON.parse(content);

  const oldVersion = pkg.version;
  pkg.version = newVersion;

  fs.writeFileSync(fullPath, `${JSON.stringify(pkg, null, 2)}\n`);
  console.log(`  ${packageFile}: ${oldVersion} -> ${newVersion}`);
}

const lockPath = path.join(ROOT, BUN_LOCK);
if (fs.existsSync(lockPath)) {
  let lockContent = fs.readFileSync(lockPath, 'utf8');

  const workspaceEntries = [
    { workspace: 'packages/ui', name: '@ikanban/ui' },
    { workspace: 'packages/web', name: '@ikanban/web' },
  ];

  for (const entry of workspaceEntries) {
    const sectionPattern = new RegExp(
      `(\"${entry.workspace}\"\\s*:\\s*\\{[\\s\\S]*?\"name\"\\s*:\\s*\"${entry.name}\"\\s*,[\\s\\S]*?\"version\"\\s*:\\s*\")([^\"]+)(\")`,
      'm'
    );

    const match = lockContent.match(sectionPattern);
    if (!match) {
      console.warn(`Warning: could not find ${entry.workspace} version in ${BUN_LOCK}`);
      continue;
    }

    const oldLockVersion = match[2];
    lockContent = lockContent.replace(sectionPattern, `$1${newVersion}$3`);
    console.log(`  ${BUN_LOCK} (${entry.workspace}): ${oldLockVersion} -> ${newVersion}`);
  }

  fs.writeFileSync(lockPath, lockContent);
} else {
  console.warn(`Warning: ${BUN_LOCK} not found, skipping lockfile update`);
}

console.log(`\nVersion bumped to ${newVersion}`);
console.log('\nNext steps:');
console.log('  bun install');
console.log('  git add -A');
console.log(`  git commit -m "release v${newVersion}"`);
console.log(`  git tag v${newVersion}`);
console.log('  git push origin main --tags');
