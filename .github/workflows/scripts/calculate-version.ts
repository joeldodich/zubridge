#!/usr/bin/env node
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync, StdioOptions } from 'node:child_process';

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

function runCommand(command: string, dryRun: boolean): string {
  console.log(`Executing: ${command}`);
  if (dryRun && !command.startsWith('git diff') && !command.startsWith('pnpm turbo-version')) {
    // For most commands in dry run, just log them
    console.log(`DRY RUN: Would execute: ${command}`);
    return '';
  }
  try {
    // Increase maxBuffer size for potentially large git diffs
    const stdioOptions: StdioOptions = ['pipe', 'pipe', 'pipe'];

    const output = execSync(command, {
      stdio: stdioOptions,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
    });

    // Print the captured output for commands like turbo-version or git diff
    if (command.includes('pnpm turbo-version') || command.startsWith('git diff')) {
      if (output) {
        console.log('--- Command Output ---');
        console.log(output.trim());
        console.log('--- End Command Output ---');
      } else {
        console.log('--- Command executed successfully, but produced no output. ---');
      }
    }
    // Return the output as a string
    return output || '';
  } catch (error: any) {
    console.error(`Error executing command: ${command}`);
    // error object from execSync might contain stdout/stderr buffers if the process wrote to them before exiting with error
    if (error.stdout && error.stdout.length > 0) {
      console.error('--- STDOUT on Error ---');
      console.error(error.stdout.toString().trim());
      console.error('--- End STDOUT on Error ---');
    }
    if (error.stderr && error.stderr.length > 0) {
      console.error('--- STDERR on Error ---');
      console.error(error.stderr.toString().trim());
      console.error('--- End STDERR on Error ---');
    }
    // Rethrow or handle as needed, maybe exit
    process.exit(1);
  }
}

// Helper to strip scope (e.g., @zubridge/) if present
function getUnscopedPackageName(pkgName: string): string {
  return pkgName.includes('/') ? pkgName.split('/')[1] : pkgName;
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
  for (const scopedPkg of pkgList) {
    // scopedPkg might be scoped (e.g., @zubridge/electron), get unscoped name for path checks
    const pkg = getUnscopedPackageName(scopedPkg);
    if (fs.existsSync(path.resolve(`packages/${pkg}/package.json`))) {
      return pkg; // Return the simple name
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

  // Handle potentially scoped specific package like @zubridge/electron
  if (packagesInput.startsWith('@zubridge/')) {
    const simpleName = getUnscopedPackageName(packagesInput); // Use renamed function
    if (fs.existsSync(path.resolve(`packages/${simpleName}/package.json`))) {
      return [simpleName]; // Return simple name for turbo target
    } else {
      console.warn(
        `::warning::Package ${packagesInput} (simple: ${simpleName}) not found in packages directory, skipping`,
      );
      return []; // Or handle error appropriately
    }
  }

  // Handle comma-separated list
  const targets: string[] = [];
  const pkgList = packagesInput
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  for (const scopedPkg of pkgList) {
    const pkg = getUnscopedPackageName(scopedPkg); // Use renamed function & simple name for path check
    if (fs.existsSync(path.resolve(`packages/${pkg}/package.json`))) {
      targets.push(pkg); // Add simple name for turbo target
    } else {
      console.warn(`::warning::Package ${scopedPkg} (simple: ${pkg}) not found in packages directory, skipping`);
    }
  }
  return targets;
}

// Function to get the FULL package name (scoped if present) from local file
function getScopedPackageName(simpleName: string): string | null {
  const pkgJson = readPackageJson(path.join('packages', simpleName, 'package.json'));
  return pkgJson ? pkgJson.name : null;
}

// --- Main Logic ---

async function main() {
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

  // --- Determine Targets --- Moved inside main scope ---
  const initialSimpleTargets: string[] = [];
  if (packagesInput !== 'all') {
    // Don't bother if input is 'all' anyway
    if (['electron', 'tauri', 'tauri-v1'].includes(packagesInput)) {
      initialSimpleTargets.push(packagesInput);
    } else if (packagesInput.startsWith('@zubridge/')) {
      const simpleName = getUnscopedPackageName(packagesInput);
      if (fs.existsSync(path.resolve(`packages/${simpleName}/package.json`))) {
        initialSimpleTargets.push(simpleName);
      } else {
        console.warn(`::warning::Package ${packagesInput} (simple: ${simpleName}) not found, skipping initial target`);
      }
    } else {
      // Handle comma-separated list
      const pkgList = packagesInput
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);
      for (const scopedPkg of pkgList) {
        const simpleName = getUnscopedPackageName(scopedPkg);
        if (fs.existsSync(path.resolve(`packages/${simpleName}/package.json`))) {
          initialSimpleTargets.push(simpleName);
        } else {
          console.warn(`::warning::Package ${scopedPkg} (simple: ${simpleName}) not found, skipping initial target`);
        }
      }
    }
  }

  // Ensure core and types are always included if not versioning 'all'
  let effectiveSimpleTargets = initialSimpleTargets;
  if (packagesInput !== 'all') {
    const targetSet = new Set(initialSimpleTargets);
    targetSet.add('core');
    targetSet.add('types');
    effectiveSimpleTargets = Array.from(targetSet);
  }

  // Convert simple target names back to scoped names for the -t flag
  const effectiveScopedTargets: string[] = [];
  if (packagesInput !== 'all') {
    // Only needed if not 'all'
    for (const simpleName of effectiveSimpleTargets) {
      const scopedName = getScopedPackageName(simpleName);
      if (scopedName) {
        effectiveScopedTargets.push(scopedName);
      } else {
        console.warn(`::warning::Could not get scoped name for target '${simpleName}'. Skipping.`);
      }
    }
    console.log(`Effective SCOPED targets for -t flag: ${effectiveScopedTargets.join(', ')}`);
  }
  // --- End Determine Targets ---

  let turboCmd = `pnpm turbo-version -b "${turboVersionBase}"`;
  // Only add -t flag if we are NOT versioning 'all'
  if (packagesInput !== 'all') {
    if (effectiveScopedTargets.length > 0) {
      // Join SCOPED targets with a comma for a single -t flag
      const targetsArg = effectiveScopedTargets.join(',');
      turboCmd += ` -t ${targetsArg}`;
    } else {
      // If somehow core/types weren't found, log warning and proceed without -t
      console.warn(
        "::warning:: No valid scoped targets determined (even core/types), but input was not 'all'. Check package existence. Running without -t flag.",
      );
    }
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
      const diffOutput = runCommand('git diff --color', false);
      console.log(diffOutput);
    } catch (error) {
      console.warn('Could not get git diff --color:', error.message);
      // If diff fails, try without color
      try {
        const diffOutputPlain = runCommand('git diff', false);
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

  // Output the new version for subsequent steps using environment file
  const githubOutputFile = process.env.GITHUB_OUTPUT;
  if (githubOutputFile) {
    console.log(`\nAppending new_version to ${githubOutputFile}`);
    // Use fs/promises for async file operations
    await fs.promises.appendFile(githubOutputFile, `new_version=${newVersion}\n`);
  } else {
    console.error(
      'Error: GITHUB_OUTPUT environment variable not set. This script expects to be run in a GitHub Actions environment where GITHUB_OUTPUT is automatically provided.',
    );
    // Fail if GITHUB_OUTPUT isn't set in Actions context
    console.error('Error: GITHUB_OUTPUT is required but not set. Unable to proceed.');
    process.exit(1);
  }

  console.log('\nScript finished successfully.');
}

// Execute main function
main().catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});
