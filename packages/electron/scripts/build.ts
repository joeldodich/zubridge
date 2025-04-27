// Build script for the project
// Usage: tsx scripts/build.ts
import fs from 'node:fs';
import shell from 'shelljs';

// compile and bundle
shell.exec('tsc --project tsconfig.json');
shell.exec('rollup --config rollup.config.js');

// ensure dist dir exists
if (!fs.existsSync('dist')) {
  shell.mkdir('dist');
}

// Find all d.ts files and create d.cts counterparts
// The find command will find all d.ts files in the dist directory and its subdirectories
const result = shell.find('dist').filter((file) => file.endsWith('.d.ts'));

// Create .d.cts versions for the found files
result.forEach((file) => {
  const ctsFile = file.replace('.d.ts', '.d.cts');
  shell.cp(file, ctsFile);
});
