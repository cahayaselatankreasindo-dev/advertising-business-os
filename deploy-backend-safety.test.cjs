'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');

const script = fs.readFileSync('deploy-backend.ps1', 'utf8');

assert.match(script, /DEPLOYMENT BLOCKED/i);
assert.match(script, /isolated TEST ONLY Apps Script project/i);
assert.match(script, /No files were copied/i);
assert.match(script, /\bexit\s+1\b/i);
assert.doesNotMatch(script, /\bclasp\s+(?:push|deploy)\b/i,
  'repository deployment helper must not push to the LAB clasp target');
assert.doesNotMatch(script, /\bCopy-Item\b/i,
  'repository deployment helper must not overwrite the guarded LAB source');

process.stdout.write('Deployment safety: automatic clasp push/deploy is blocked.\n');
