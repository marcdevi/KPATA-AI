#!/usr/bin/env node
/**
 * Fix HTML to add type="module" to script tags
 * This is needed because Expo Web uses import.meta which requires ES modules
 */

const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../dist/index.html');

if (!fs.existsSync(htmlPath)) {
  console.error('dist/index.html not found');
  process.exit(1);
}

let html = fs.readFileSync(htmlPath, 'utf8');

// Replace script tags to add type="module"
html = html.replace(
  /<script src="([^"]+)" defer><\/script>/g,
  '<script type="module" src="$1"></script>'
);

fs.writeFileSync(htmlPath, html);
console.log('✅ Fixed index.html - added type="module" to script tags');
