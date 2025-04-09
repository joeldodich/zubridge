#!/usr/bin/env node
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';

interface PackageJson {
  version: string;
  name: string;
  workspaces?: string[];
}

// --- Helper Functions ---

function readPackageJson(pkgPath: string): PackageJson | null {
  const fullPath = path.resolve(pkgPath);
  if (fs.existsSync(fullPath)) {
    try {
      const content = fs.readFileSync(fullPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error(`Error reading or parsing ${fullPath}:`, error);
      return null;
    }
  }
  return null;
}

function runCommand(command: string, dryRun: boolean): Buffer | string {
  console.log(`Executing: ${command}`);
  if (dryRun && !command.startsWith('git diff') && !command.startsWith('pnpm turbo-version')) {
    // For most commands in dry run, just log them
    console.log(`DRY RUN: Would execute: ${command}`);
    return '';
  }
  try {
    // Increase maxBuffer size for potentially large git diffs
    return execSync(command, { stdio: 'pipe', encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
  } catch (error) {
    console.error(`Error executing command: ${command}`);
    // If error has stdout/stderr properties, print them
    if (error.stdout) {
      console.error('STDOUT:', error.stdout.toString());
    }
    if (error.stderr) {
      console.error('STDERR:', error.stderr.toString());
    }
    // Rethrow or handle as needed, maybe exit
    process.exit(1);
  }
}

function getReferencePackage(packagesInput: string): string {
  if (!packagesInput || packagesInput === 'all') {
    return 'core';
  }
  if (['electron', 'tauri', 'tauri-v1'].includes(packagesInput)) {
    return packagesInput;
  }

  // Handle comma-separated list
  const pkgList = packagesInput
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  for (const pkg of pkgList) {
    if (fs.existsSync(path.resolve(`packages/${pkg}/package.json`))) {
      return pkg;
    }
  }

  console.warn(`::warning::No valid packages found in selection "${packagesInput}", falling back to core as reference`);
  return 'core';
}

function getTurboTargets(packagesInput: string): string[] {
  if (!packagesInput || packagesInput === 'all') {
    return []; // Empty means target all packages
  }
  if (['electron', 'tauri', 'tauri-v1'].includes(packagesInput)) {
    return [packagesInput]; // Target the specific main package
  }

  // Handle comma-separated list
  const targets: string[] = [];
  const pkgList = packagesInput
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  for (const pkg of pkgList) {
    if (fs.existsSync(path.resolve(`packages/${pkg}/package.json`))) {
      targets.push(pkg);
    } else {
      console.warn(`::warning::Package ${pkg} not found in packages directory, skipping`);
    }
  }
  // If custom list is empty after filtering, maybe default to something or throw?
  // For now, return the potentially empty list based on valid packages found.
  return targets;
}

// --- Main Logic ---

const packagesInput = process.env.INPUT_PACKAGES || 'all';
const releaseVersion = process.env.INPUT_RELEASE_VERSION;
const dryRun = process.env.INPUT_DRY_RUN === 'true';
const workspaceRoot = process.env.GITHUB_WORKSPACE || '.'; // Use GITHUB_WORKSPACE if available

if (!releaseVersion) {
  console.error('Error: INPUT_RELEASE_VERSION is required.');
  process.exit(1);
}

console.log(`Input Packages: ${packagesInput}`);
console.log(`Release Version: ${releaseVersion}`);
console.log(`Dry Run: ${dryRun}`);
console.log(`Workspace Root: ${workspaceRoot}`);

// Change to workspace root
process.chdir(workspaceRoot);

const refPkg = getReferencePackage(packagesInput);
const refPkgJsonPath = path.join('packages', refPkg, 'package.json');
const refPackageJson = readPackageJson(refPkgJsonPath);

if (!refPackageJson) {
  console.error(`Error: Could not read reference package.json at ${refPkgJsonPath}`);
  process.exit(1);
}

const currentVersion = refPackageJson.version;
console.log(`Current version (from ${refPkg}): ${currentVersion}`);

const turboVersionBase = releaseVersion;
const turboVersionTargets = getTurboTargets(packagesInput);

let turboCmd = `pnpm turbo-version -b "${turboVersionBase}"`;
if (turboVersionTargets.length > 0) {
  const targetArgs = turboVersionTargets.map((t) => `-t ${t}`).join(' ');
  turboCmd += ` ${targetArgs}`;
}

let newVersion: string;

if (dryRun) {
  console.log('\n--- Dry Run: Calculating Version ---');
  runCommand(turboCmd, false); // Run turbo-version even in dry run to calculate version

  const updatedRefPackageJson = readPackageJson(refPkgJsonPath);
  if (!updatedRefPackageJson) {
    console.error(`Error: Could not read reference package.json after turbo-version at ${refPkgJsonPath}`);
    runCommand('git reset --hard HEAD', false); // Attempt reset before exiting
    process.exit(1);
  }
  newVersion = updatedRefPackageJson.version;

  console.log(`\nNext version would be: ${newVersion}`);

  console.log('\nFiles that would be modified:');
  const diffNameOnly = runCommand('git diff --name-only', false);
  console.log(diffNameOnly);

  console.log('\nChanges that would be made:');
  // Use try-catch for git diff as it might fail if no changes were made (though turbo-version should make changes)
  try {
    const diffOutput = execSync('git diff --color', { stdio: 'pipe', encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
    console.log(diffOutput);
  } catch (error) {
    console.warn('Could not get git diff --color:', error.message);
    // If diff fails, try without color
    try {
      const diffOutputPlain = execSync('git diff', { stdio: 'pipe', encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
      console.log(diffOutputPlain);
    } catch (innerError) {
      console.error('Could not get git diff even without color:', innerError.message);
    }
  }

  console.log(`\nDRY RUN: Would bump version from ${currentVersion} to ${newVersion}`);
  console.log(`DRY RUN: Would create git tag v${newVersion}`);

  console.log('\nResetting changes made by turbo-version (dry run)...');
  runCommand('git reset --hard HEAD', false); // Ensure reset happens
  console.log('Changes reset.');
} else {
  console.log('\n--- Actual Run: Applying Version ---');
  runCommand(turboCmd, false);

  const updatedRefPackageJson = readPackageJson(refPkgJsonPath);
  if (!updatedRefPackageJson) {
    console.error(`Error: Could not read reference package.json after turbo-version at ${refPkgJsonPath}`);
    // No reset needed here as it's not a dry run, but we should exit
    process.exit(1);
  }
  newVersion = updatedRefPackageJson.version;
  console.log(`Version bumped to: ${newVersion}`);
}

// Output the new version for subsequent steps
console.log(`::set-output name=new_version::${newVersion}`);

console.log('\nScript finished successfully.');
