const fs = require('fs');
const content = fs.readFileSync('src/components/AppPreferencesPage.tsx', 'utf8');

// Find the "DATA & SYNC" section and remove it entirely.
// Find the "Delete My Account" section and remove it entirely.

let lines = content.split('\n');

// Simplest way is to just find the indices.

const writeLines = (lines) => {
  fs.writeFileSync('src/components/AppPreferencesPage.tsx', lines.join('\n'));
}

writeLines(lines);
