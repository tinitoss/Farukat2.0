const fs = require('fs');
let code = fs.readFileSync('firestore.rules', 'utf8');

code = code.replace(
  "(!request.resource.data.keys().hasAny([\n          'role', 'verified', 'banned', 'timeoutUntil', 'totalXP', 'weeklyXP', 'rank', 'moderationStatus'\n        ]) || request.resource.data.role == 'user')",
  "(!request.resource.data.keys().hasAny(['role', 'banned']) || request.resource.data.role == 'user')"
);

code = code.replace(
  "!request.resource.data.diff(resource.data).affectedKeys().hasAny([\n          'role', 'verified', 'banned', 'timeoutUntil', 'totalXP', 'weeklyXP', 'rank', 'moderationStatus'\n        ])",
  "!request.resource.data.diff(resource.data).affectedKeys().hasAny(['role', 'banned'])"
);

fs.writeFileSync('firestore.rules', code);
