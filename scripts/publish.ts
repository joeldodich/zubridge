// Publish script for the project - publishes the packages to the npm registry
// Usage: tsx scripts/publish.ts [option1] [option2] [...]
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2);
let tag = 'latest';
let filterPackages: string[] = [];

// Process args
const options: string[] = [];
for (let i = 0; i < args.length; i++) {
  const arg = args[i];

  if (arg === '--tag' && i + 1 < args.length) {
    tag = args[i + 1];
    i++; // Skip the next arg since we've used it
  } else if (arg === '--filter' && i + 1 < args.length) {
    // Process comma-separated package names
    filterPackages = args[i + 1].split(',').map((pkg) => pkg.trim());
    i++; // Skip the next arg since we've used it
  } else {
    options.push(arg);
  }
}

// Function to find all packages in the packages directory
function findPackagesToPublish(): string[] {
  const packagesDir = path.join(process.cwd(), 'packages');

  // Ensure the packages directory exists
  if (!fs.existsSync(packagesDir)) {
    console.error('Packages directory not found');
    process.exit(1);
  }

  // Get directories in the packages folder
  const packageDirs = fs.readdirSync(packagesDir);

  // Create a map of package names to directories
  const packageMap: Record<string, string> = {};
  for (const dir of packageDirs) {
    const packageJsonPath = path.join(packagesDir, dir, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      packageMap[packageJson.name] = dir;
    }
  }

  // Special handling for the 'all' option
  if (filterPackages.includes('all')) {
    return packageDirs
      .filter((dir) => fs.existsSync(path.join(packagesDir, dir, 'package.json')))
      .map((dir) => path.join('packages', dir));
  }

  // If we have specific packages to filter
  if (filterPackages.length > 0) {
    // Set to track unique package directories to publish
    const packagesToPublishSet = new Set<string>();

    // Add the specifically requested packages first
    for (const packageName of Object.keys(packageMap)) {
      if (filterPackages.some((filter) => packageName.includes(filter))) {
        packagesToPublishSet.add(packageMap[packageName]);
      }
    }

    console.log('Publishing requested packages');
    return Array.from(packagesToPublishSet).map((dir) => path.join('packages', dir));
  }

  // If no filter, publish all packages
  return packageDirs
    .filter((dir) => fs.existsSync(path.join(packagesDir, dir, 'package.json')))
    .map((dir) => path.join('packages', dir));
}

// Find packages to publish
const packagesToPublish = findPackagesToPublish();

if (packagesToPublish.length === 0) {
  console.log('No packages found to publish');
  process.exit(0);
}

console.log(`Publishing packages with tag "${tag}":`);
packagesToPublish.forEach((pkg) => console.log(`- ${pkg}`));

// Construct filter argument for pnpm publish
const filterArgs = packagesToPublish.map((pkg) => `--filter ./${pkg}`).join(' ');

// Create and run the publish command
const publishCommand = `pnpm publish ${filterArgs} --access public --no-git-checks --tag ${tag} ${options.join(' ')}`;

console.log(`\nRunning: ${publishCommand}\n`);

try {
  execSync(publishCommand, { stdio: 'inherit' });
  console.log('Packages published successfully!');
} catch (error) {
  console.error('Failed to publish packages:', error);
  process.exit(1);
}
