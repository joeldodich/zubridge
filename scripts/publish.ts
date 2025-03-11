// Publish script for the project - publishes the packages to the npm registry
// Usage: tsx scripts/publish.ts [option1] [option2] [...]
import shell from 'shelljs';
import fs from 'node:fs';
import path from 'node:path';

const options = process.argv.slice(2);

// Dynamically find all packages
const packagesDir = path.resolve('packages');
const packageDirs = fs.readdirSync(packagesDir).filter((dir) => {
  // Only include directories that have a package.json file
  const packageJsonPath = path.join(packagesDir, dir, 'package.json');
  return fs.existsSync(packageJsonPath);
});

console.log(`Found packages: ${packageDirs.join(', ')}`);

// Copy LICENSE to each package directory
packageDirs.forEach((dir) => {
  console.log(`Copying LICENSE to packages/${dir}`);
  shell.cp(['LICENSE'], `packages/${dir}`);
});

// --no-git-checks is used to skip the git checks - due to getting erroneous ERR_PNPM_GIT_UNCLEAN errors
const publishCommand = `pnpm publish -r --access public --no-git-checks ${options.join(' ')}`;

console.log(`Publishing zubridge...`, publishCommand);

shell.exec(publishCommand);
