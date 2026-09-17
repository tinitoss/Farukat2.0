const fs = require('fs');
const content = fs.readFileSync('src/components/AppPreferencesPage.tsx', 'utf8');
const searchStr = `    </div>
  );
};`;
const replaceStr = `    </div>
    </div>
  );
};`;

if (content.includes(searchStr)) {
  fs.writeFileSync('src/components/AppPreferencesPage.tsx', content.replace(searchStr, replaceStr));
  console.log('Patched bottom successfully');
} else {
  console.log('Search string not found');
}
