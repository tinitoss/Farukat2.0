const fs = require('fs');
const content = fs.readFileSync('src/components/MediaDetailModal.tsx', 'utf8');
const lines = content.split('\n');
let depth = 0;
let printed = false;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const opens = (line.match(/<div[^>]*[^\/]\s*>/g) || []).length;
  const closes = (line.match(/<\/div>/g) || []).length;
  depth += opens - closes;
  if (depth < 0 && !printed) { console.log(`First negative at line ${i+1}: ${line}`); printed = true; }
}
console.log(`Final depth: ${depth}`);
