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
    } catch (error: any) {
      console.error(`Error reading or parsing ${fullPath}:`, error.message);
      return null;
    }
  }
}

// Simplified runCommand: always executes, returns stdout
function runCommand(command: string): string {
  console.log(`Executing: ${command}`);
  try {
    const stdioOptions: StdioOptions = ['pipe', 'pipe', 'pipe'];
    const output = execSync(command, {
      stdio: stdioOptions,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
    });

    // Log output for specific commands
    if (command.includes('pnpm package-versioner') || command.startsWith('git diff')) {
      if (output) {
        console.log('--- Command Output ---');
        console.log(output.trim());
        console.log('--- End Command Output ---');
      } else {
        console.log('--- Command executed successfully, but produced no stdout. ---');
      }
    }
    return output || '';
  } catch (error: any) {
    console.error(`Error executing command: ${command}`);
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
    process.exit(1);
  }
}

// Helper to strip scope (e.g., @zubridge/) if present
function getUnscopedPackageName(pkgName: string): string {
  return pkgName.includes('/') ? pkgName.split('/')[1] : pkgName;
}

// Function to get the FULL package name (scoped if present) from local file
function getScopedPackageName(simpleName: string): string | null {
  const pkgJson = readPackageJson(path.join('packages', simpleName, 'package.json'));
  return pkgJson ? pkgJson.name : null;
}

// --- Main Logic ---

async function main() {
  // Read Inputs
  const packagesInput = process.env.INPUT_PACKAGES || 'all'; // Read INPUT_PACKAGES again
  const releaseVersionInput = process.env.INPUT_RELEASE_VERSION;
  const dryRun = process.env.INPUT_DRY_RUN === 'true';
  const workspaceRoot = process.env.GITHUB_WORKSPACE || '.';

  if (!releaseVersionInput) {
    console.error('Error: INPUT_RELEASE_VERSION is required.');
    process.exit(1);
  }

  console.log(`Release Version Input: ${releaseVersionInput}`);
  console.log(`Dry Run: ${dryRun}`);
  console.log(`Workspace Root: ${workspaceRoot}`);

  process.chdir(workspaceRoot);

  // --- Reference Package Info ---
  const refPkgSimpleName = 'core';
  const refPkgPath = path.join('packages', refPkgSimpleName, 'package.json');
  const refPkgScopedName = '@zubridge/core';

  // --- Determine Targets (Re-introduced) ---
  const initialSimpleTargets: string[] = [];
  if (packagesInput !== 'all') {
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

  // --- Construct package-versioner Command ---
  let packageVersionerCmd = 'pnpm package-versioner';

  // Add flags based on release type input
  if (['patch', 'minor', 'major'].includes(releaseVersionInput)) {
    packageVersionerCmd += ` --bump ${releaseVersionInput}`;
  } else if (releaseVersionInput.startsWith('pre')) {
    let identifier = 'beta'; // Default identifier for 'prerelease'
    if (releaseVersionInput.includes(':')) {
      // Extract identifier if present (e.g., prerelease:rc -> rc)
      const parts = releaseVersionInput.split(':');
      if (parts.length > 1 && parts[1]) {
        identifier = parts[1];
      }
    } else {
      // Handle simple prepatch, preminor, premajor
      if (releaseVersionInput !== 'prerelease') {
        // Use the type itself as the identifier, tool should handle it
        identifier = releaseVersionInput.substring(3); // e.g., prepatch -> patch
      }
    }
    packageVersionerCmd += ` --prerelease ${identifier}`;
  } else {
    console.error(
      `Error: Invalid INPUT_RELEASE_VERSION value: ${releaseVersionInput}. Expected patch, minor, major, or pre*`,
    );
    process.exit(1);
  }

  // Add dry-run flag if applicable
  if (dryRun) {
    packageVersionerCmd += ' --dry-run';
  }

  // Add target flag if not 'all'
  if (packagesInput !== 'all') {
    if (effectiveScopedTargets.length > 0) {
      const targetsArg = effectiveScopedTargets.join(',');
      packageVersionerCmd += ` -t ${targetsArg}`;
    } else {
      console.warn(
        "::warning:: No valid scoped targets determined (even core/types), but input was not 'all'. Check package existence. Proceeding without -t flag (might affect all packages).",
      );
      // If no targets are found, running without -t will run in async mode.
      // Is this desired, or should it error?
      // process.exit(1); // Option: Fail if specific targets were intended but none found.
    }
  }

  // --- Execute Command and Determine Version ---
  let newVersion: string | null = null;

  if (dryRun) {
    console.log('\n--- Dry Run: Calculating Version via package-versioner output ---');
    const commandOutput = runCommand(packageVersionerCmd);

    // Regex to find the log line for the reference package
    // Example line: ℹ [DRY RUN] Would update @zubridge/core package.json to version 1.1.0
    // Making regex more robust to handle potential info/warning prefixes or ANSI codes
    const regex = new RegExp(`Would update ${refPkgScopedName} package\.json to version (\S+)`, 'm');
    const match = commandOutput.match(regex);

    if (match && match[1]) {
      newVersion = match[1];
      console.log(`Dry run: Determined next version for ${refPkgScopedName} would be: ${newVersion}`);
    } else {
      console.error(
        `Error: Could not parse new version for ${refPkgScopedName} from package-versioner dry run output.`,
      );
      console.error('Full output was:\n' + commandOutput);
      // Fallback: Attempt to read current version as it *shouldn't* have changed
      const currentPkgJson = readPackageJson(refPkgPath);
      if (currentPkgJson) {
        newVersion = currentPkgJson.version;
        console.warn(`::warning::Falling back to current version '${newVersion}' due to parsing error.`);
      } else {
        console.error(`Error: Could not read current version from ${refPkgPath} either.`);
        process.exit(1); // Exit if we can't determine a version
      }
    }
    // No git diff/reset needed as tool handles dry run
  } else {
    // Actual Run
    console.log('\n--- Actual Run: Applying Version via package-versioner ---');
    runCommand(packageVersionerCmd); // Execute the actual versioning

    // Read the updated version directly from the reference package's file
    console.log(`Reading updated version from ${refPkgPath}...`);
    const updatedPkgJson = readPackageJson(refPkgPath);
    if (updatedPkgJson && updatedPkgJson.version) {
      newVersion = updatedPkgJson.version;
      console.log(`Version bumped to: ${newVersion} (read from ${refPkgSimpleName})`);
    } else {
      console.error(`Error: Could not read updated version from ${refPkgPath} after package-versioner run.`);
      process.exit(1);
    }
  }

  // --- Output the Determined Version ---
  if (!newVersion) {
    console.error('Error: Failed to determine new version.');
    process.exit(1);
  }

  const githubOutputFile = process.env.GITHUB_OUTPUT;
  if (githubOutputFile) {
    console.log(`\nAppending new_version=${newVersion} to ${githubOutputFile}`);
    await fs.promises.appendFile(githubOutputFile, `new_version=${newVersion}\n`);
  } else {
    console.error(
      'Error: GITHUB_OUTPUT environment variable not set. This script expects to be run in a GitHub Actions environment where GITHUB_OUTPUT is automatically provided.',
    );
    process.exit(1);
  }

  console.log('\nScript finished successfully.');
}

// Execute main function
main().catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});
