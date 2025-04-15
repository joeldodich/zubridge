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

function readPackageJson(pkgPath: string): PackageJson | undefined {
  const fullPath = path.resolve(pkgPath);
  if (fs.existsSync(fullPath)) {
    try {
      const content = fs.readFileSync(fullPath, 'utf-8');
      return JSON.parse(content);
    } catch (error: any) {
      console.error(`Error reading or parsing ${fullPath}:`, error.message);
      return undefined;
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
  const refPkgSimpleName = 'types';
  const refPkgPath = path.join('packages', refPkgSimpleName, 'package.json');
  const refPkgScopedName = '@zubridge/types';

  // --- Determine Targets (Revised for 'all' case) ---
  let effectiveSimpleTargets: string[] = [];

  if (packagesInput === 'all') {
    // Find all package.json files under packages/*
    console.log("Input is 'all', finding all @zubridge/* packages...");
    const allPkgPaths = findPackageJsonFiles(path.join(workspaceRoot, 'packages'));
    for (const pkgPath of allPkgPaths) {
      const pkgJson = readPackageJson(pkgPath);
      if (pkgJson && pkgJson.name.startsWith('@zubridge/')) {
        // Extract simple name for the list
        effectiveSimpleTargets.push(getUnscopedPackageName(pkgJson.name));
      }
    }
    console.log(`Found simple targets for 'all': ${effectiveSimpleTargets.join(', ')}`);
  } else {
    // Logic for specific targets (electron, tauri, custom list)
    const initialSimpleTargets: string[] = [];
    if (['electron', 'tauri'].includes(packagesInput)) {
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

    // Ensure types is always included when specific targets are given
    const targetSet = new Set(initialSimpleTargets);
    targetSet.add('types');
    effectiveSimpleTargets = Array.from(targetSet);
  }

  // Convert simple target names back to scoped names for the -t flag
  const effectiveScopedTargets: string[] = [];
  for (const simpleName of effectiveSimpleTargets) {
    const scopedName = getScopedPackageName(simpleName);
    if (scopedName) {
      effectiveScopedTargets.push(scopedName);
    } else {
      console.warn(`::warning::Could not get scoped name for target '${simpleName}'. Skipping.`);
    }
  }

  if (effectiveScopedTargets.length === 0) {
    console.error('Error: No valid target packages could be determined. Check INPUT_PACKAGES and package existence.');
    process.exit(1);
  }
  console.log(`Effective SCOPED targets for -t flag: ${effectiveScopedTargets.join(', ')}`);
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

  // Add JSON output flag for structured output
  packageVersionerCmd += ' --json';

  // Add target flag (now always added, as we handle 'all' by finding all packages)
  const targetsArg = effectiveScopedTargets.join(',');
  packageVersionerCmd += ` -t ${targetsArg}`;

  // --- Execute Command and Determine Version ---
  let newVersion: string | null = null;

  // Use the original command string built earlier
  const commandToExecute = packageVersionerCmd;

  if (dryRun) {
    console.log('\n--- Dry Run: Calculating Version via package-versioner output ---');
    console.log(`Executing: ${commandToExecute}`);
    const commandOutput = runCommand(commandToExecute);

    try {
      // Parse JSON output
      const jsonOutput = JSON.parse(commandOutput);

      // Extract version from the reference package in the updates array
      const refPackageUpdate = jsonOutput.updates?.find((update: any) => update.packageName === refPkgScopedName);

      if (refPackageUpdate && refPackageUpdate.newVersion) {
        newVersion = refPackageUpdate.newVersion;
        console.log(`Dry run: Determined next version for ${refPkgScopedName} would be: ${newVersion}`);
      } else {
        throw new Error(`Could not find ${refPkgScopedName} in the updates array`);
      }
    } catch (error: any) {
      console.error(`Error: Could not parse JSON output from package-versioner: ${error.message}`);
      console.error('Full output was:\n' + commandOutput);

      // Fall back to older regex-based parsing as a secondary fallback
      console.warn('::warning::Attempting to use regex fallback to extract version');

      // Try to find the version in the Updated package.json line
      const regexUpdated = new RegExp(
        `Updated package\\.json at .*/packages/${refPkgSimpleName}/package\\.json to version (\\S+)`,
      );
      const matchUpdated = commandOutput.match(regexUpdated);

      if (matchUpdated && matchUpdated[1]) {
        newVersion = matchUpdated[1];
        console.log(`Using regex fallback: Found version ${newVersion} in output`);
      } else {
        // Last resort: read current version
        const currentPkgJson = readPackageJson(refPkgPath);
        if (currentPkgJson) {
          newVersion = currentPkgJson.version;
          console.warn(`::warning::Falling back to current version '${newVersion}' due to parsing error.`);
        } else {
          console.error(`Error: Could not read current version from ${refPkgPath} either.`);
          process.exit(1); // Exit if we can't determine a version
        }
      }
    }
  } else {
    // Actual Run
    console.log('\n--- Actual Run: Applying Version via package-versioner ---');
    console.log(`Executing: ${commandToExecute}`);
    const commandOutput = runCommand(commandToExecute);

    try {
      // Parse JSON output
      const jsonOutput = JSON.parse(commandOutput);

      // Extract version from the reference package in the updates array
      const refPackageUpdate = jsonOutput.updates?.find((update: any) => update.packageName === refPkgScopedName);

      if (refPackageUpdate && refPackageUpdate.newVersion) {
        newVersion = refPackageUpdate.newVersion;
        console.log(`Version bumped to: ${newVersion} (from JSON output)`);
      } else {
        // Fall back to reading from package.json if JSON parsing fails
        throw new Error(`Could not find ${refPkgScopedName} in the updates array`);
      }
    } catch (error: any) {
      console.error(`Error parsing JSON output: ${error.message}`);
      console.error('Falling back to reading updated version from package.json');

      // Read the updated version directly from the reference package's file (@zubridge/types)
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

// --- Helper Function needed for 'all' case ---
function findPackageJsonFiles(startPath: string): string[] {
  let results: string[] = [];
  if (!fs.existsSync(startPath)) {
    console.warn(`Warning: Directory not found for finding package.json: ${startPath}`);
    return results;
  }

  const files = fs.readdirSync(startPath);
  for (const file of files) {
    const filename = path.join(startPath, file);
    const stat = fs.lstatSync(filename);

    if (stat.isDirectory()) {
      // Recurse into directories (but only one level deep for `packages/*`)
      if (path.basename(startPath) === 'packages') {
        // Simple depth check
        const subFiles = findPackageJsonFiles(filename);
        results = results.concat(subFiles);
      }
    } else if (path.basename(filename) === 'package.json') {
      results.push(filename);
    }
  }
  return results;
}
