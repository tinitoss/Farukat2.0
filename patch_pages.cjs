const fs = require('fs');
const files = [
  'src/components/settings/DataAccountPage.tsx',
  'src/components/settings/DevicesPage.tsx',
  'src/components/settings/HelpSupportPage.tsx',
  'src/components/AppPreferencesPage.tsx'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  if (!content.includes('import { createPortal } from \'react-dom\';')) {
    content = content.replace("import React, { useState } from 'react';", "import React, { useState } from 'react';\nimport { createPortal } from 'react-dom';");
    content = content.replace("import React, { useState, useCallback } from 'react';", "import React, { useState, useCallback } from 'react';\nimport { createPortal } from 'react-dom';");
  }
  
  if (file === 'src/components/AppPreferencesPage.tsx') {
    content = content.replace('  return (\n    <div className="fixed', '  return createPortal(\n    <div className="fixed');
    content = content.replace('    </div>\n    </div>\n  );\n};', '    </div>\n    </div>,\n    document.body\n  );\n};');
  } else {
    content = content.replace('  return (\n    <div className="fixed', '  return createPortal(\n    <div className="fixed');
    content = content.replace('    </div>\n  );\n};', '    </div>,\n    document.body\n  );\n};');
  }
  
  fs.writeFileSync(file, content);
}
