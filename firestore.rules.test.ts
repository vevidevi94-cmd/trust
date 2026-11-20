import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
const blueprintPath = path.resolve(process.cwd(), 'firebase-blueprint.json');
const rulesText = fs.readFileSync(rulesPath, 'utf8');
const blueprint = JSON.parse(fs.readFileSync(blueprintPath, 'utf8'));

test('firestore.rules starts with rules_version 2 and default-deny catch-all', () => {
  assert.match(rulesText, /rules_version\s*=\s*'2';/);
  assert.match(rulesText, /match \/\{document=\*\*\} \{\s*allow read, write: if false;\s*\}/);
});

test('every collection in firebase-blueprint.json has an explicit match block in firestore.rules', () => {
  const paths = Object.keys(blueprint.firestore || {});
  assert.ok(paths.length >= 4);
  for (const colPath of paths) {
    assert.ok(
      rulesText.includes(`match ${colPath}`),
      `Missing match block for ${colPath} in firestore.rules`,
    );
  }
});

test('Dirty Dozen security invariants are enforced in firestore.rules', () => {
  // 1. Unauthenticated LIST /orders denied (strictly isAdmin)
  assert.match(rulesText, /match \/orders\/\{orderId\}[\s\S]*?allow list:\s*if isAdmin\(\);/);
  // 2. Email verification mandated before admin check
  assert.match(rulesText, /request\.auth\.token\.email_verified == true/);
  // 3. Payment receipts strictly Admin-only get, list denied, update denied
  assert.match(rulesText, /match \/order_receipts\/\{orderId\}[\s\S]*?allow get:\s*if isValidOrderId\(orderId\) && isAdmin\(\);/);
  assert.match(rulesText, /match \/order_receipts\/\{orderId\}[\s\S]*?allow list:\s*if false;/);
  assert.match(rulesText, /match \/order_receipts\/\{orderId\}[\s\S]*?allow update:\s*if false;/);
  // 4. Customer create forces pending status, empty adminMessage, empty recentAlerts
  assert.match(rulesText, /incoming\(\)\.status == 'pending'/);
  assert.match(rulesText, /incoming\(\)\.recentAlerts\.size\(\) == 0/);
  // 5. Strict schema keys (hasAll + hasOnly) and update affectedKeys allowlist
  assert.match(rulesText, /data\.keys\(\)\.hasAll\(/);
  assert.match(rulesText, /data\.keys\(\)\.hasOnly\(/);
  assert.match(rulesText, /incoming\(\)\.diff\(existing\(\)\)\.affectedKeys\(\)\.hasOnly\(/);
  // 6. Server timestamps validated against request.time
  assert.match(rulesText, /incoming\(\)\.serverCreatedAt == request\.time/);
  assert.match(rulesText, /incoming\(\)\.serverUpdatedAt == request\.time/);
  // 7. Orphaned receipt blocked via parent existence check
  assert.match(rulesText, /exists\(\/databases\/\$\(database\)\/documents\/orders\/\$\(orderId\)\)/);
  // 8. App config writes restricted to isAdmin()
  assert.match(rulesText, /match \/app_config\/\{configId\}[\s\S]*?allow update:[\s\S]*?isAdmin\(\)/);
  // 9. Admin allowlist list denied and create restricted to isAdmin()
  assert.match(rulesText, /match \/admins\/\{adminUid\}[\s\S]*?allow list:\s*if false;/);
});
