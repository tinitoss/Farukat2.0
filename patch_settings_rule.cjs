const fs = require('fs');
let code = fs.readFileSync('firestore.rules', 'utf8');

if (!code.includes("match /settings/")) {
  code = code.replace(
    "    match /market_assets/{assetId} {",
    `    match /settings/{settingId} {
      allow read: if true;
      allow write: if isAdmin();
    }
    match /market_assets/{assetId} {`
  );
  fs.writeFileSync('firestore.rules', code);
}
