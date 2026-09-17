const fs = require('fs');
let code = fs.readFileSync('src/utils/xpSystem.ts', 'utf8');

code = code.replace(
  "for (let l = 11; l <= 100; l++) {", 
  "for (let l = 11; l <= 500; l++) {"
);

code = code.replace(
  "const span = Math.round(800 * Math.pow(1.025, l - 10));",
  "let span = Math.round(800 * Math.pow(1.025, l - 10));\n    if (l > 40) span = Math.round(5000 * Math.pow(1.035, l - 40));"
);

code = code.replace(
  "if (l === 100) title = 'Supreme Hall of Fame Legend (Level 100)';",
  "if (l >= 100) title = `Grandmaster Legend Lvl ${l}`;\n    if (l >= 250) title = `Ascendant Deity Lvl ${l}`;\n    if (l === 500) title = 'Supreme Hall of Fame Legend (Level 500)';"
);

code = code.replace(
  "// LEVEL THRESHOLDS & PROGRESSION CONFIG (MAX LEVEL 100)",
  "// LEVEL THRESHOLDS & PROGRESSION CONFIG (MAX LEVEL 500)"
);

fs.writeFileSync('src/utils/xpSystem.ts', code);
console.log("Patched xpSystem.ts");
