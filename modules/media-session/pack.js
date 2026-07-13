// module/media-session/pack.js

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Read package.json from the current module directory
const pkg = require(path.join(__dirname, 'package.json'));

try {
    console.log('Running npm pack...');

    // Run npm pack inside this directory
    execSync('npm pack', {
        cwd: __dirname,
        stdio: 'inherit',
    });

    // npm pack sanitizes scoped package names
    const generatedFile = `${pkg.name.replace('@', '').replace('/', '-')}-${pkg.version}.tgz`;

    if (!fs.existsSync(path.join(__dirname, generatedFile))) {
        throw new Error(`Could not find generated file: ${generatedFile}`);
    }

    // Always rename to media-session-<version>.tgz
    const newName = `media-session-${pkg.version}.tgz`;

    const oldPath = path.join(__dirname, generatedFile);
    const newPath = path.join(__dirname, newName);

    // Replace existing file if present
    if (fs.existsSync(newPath)) {
        fs.unlinkSync(newPath);
    }

    fs.renameSync(oldPath, newPath);

    console.log(`Successfully packed to: ${newName}`);
} catch (error) {
    console.error('Failed to pack:', error.message);
    process.exit(1);
}