const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

const replacements = [
  { regex: /bg-\[#050505\]/g, replace: 'bg-[var(--bg-main)]' },
  { regex: /bg-black/g, replace: 'bg-[var(--bg-main)]' },
  { regex: /bg-\[#080808\]/g, replace: 'bg-[var(--bg-surface)]' },
  { regex: /bg-\[#0a0a0a\]/g, replace: 'bg-[var(--bg-surface)]' },
  { regex: /bg-\[#111111\]/g, replace: 'bg-[var(--bg-card)]' },
  { regex: /bg-\[#121212\]/g, replace: 'bg-[var(--bg-card)]' },
  { regex: /bg-\[#141414\]/g, replace: 'bg-[var(--bg-card)]' },
  { regex: /bg-\[#1a1a1a\]/g, replace: 'bg-[var(--bg-card-elevated)]' },
  { regex: /bg-\[#222222\]|bg-\[#222\]/g, replace: 'bg-[var(--bg-card-elevated)]' },
  { regex: /bg-\[#333333\]|bg-\[#333\]/g, replace: 'bg-[var(--bg-card-elevated)]' },
  
  { regex: /text-white/g, replace: 'text-[var(--text-primary)]' },
  { regex: /text-\[#e5e5e5\]/g, replace: 'text-[var(--text-primary)]' },
  { regex: /text-\[#aaa\]|text-\[#aaaaaa\]/g, replace: 'text-[var(--text-secondary)]' },
  { regex: /text-\[#888\]|text-\[#888888\]/g, replace: 'text-[var(--text-secondary)]' },
  { regex: /text-\[#8E8E93\]/g, replace: 'text-[var(--text-secondary)]' },
  { regex: /text-\[#777\]|text-\[#777777\]/g, replace: 'text-[var(--text-muted)]' },
  { regex: /text-\[#737373\]/g, replace: 'text-[var(--text-muted)]' },
  { regex: /text-\[#666\]|text-\[#666666\]/g, replace: 'text-[var(--text-muted)]' },
  { regex: /text-\[#555\]|text-\[#555555\]/g, replace: 'text-[var(--text-muted)]' },

  { regex: /border-\[#1a1a1a\]/g, replace: 'border-[var(--border-subtle)]' },
  { regex: /border-\[#1f1f1f\]/g, replace: 'border-[var(--border-subtle)]' },
  { regex: /border-\[#252525\]/g, replace: 'border-[var(--border-subtle)]' },
  { regex: /border-\[#222\]|border-\[#222222\]/g, replace: 'border-[var(--border-subtle)]' },
  { regex: /border-\[#333\]|border-\[#333333\]/g, replace: 'border-[var(--border-elevated)]' },
];

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let originalContent = content;
      for (const { regex, replace } of replacements) {
        content = content.replace(regex, replace);
      }
      if (content !== originalContent) {
        fs.writeFileSync(fullPath, content);
        console.log(`Updated ${fullPath}`);
      }
    }
  }
}

processDirectory(srcDir);
console.log('Done.');
