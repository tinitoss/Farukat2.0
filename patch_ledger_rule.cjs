const fs = require('fs');
let code = fs.readFileSync('firestore.rules', 'utf8');

if (!code.includes("match /ledger/")) {
  code = code.replace(
    "    match /market_assets/{assetId} {",
    `    match /ledger/{ledgerId} {
      allow read, write: if isAuthenticated();
    }
    match /market_assets/{assetId} {`
  );
  fs.writeFileSync('firestore.rules', code);
}
