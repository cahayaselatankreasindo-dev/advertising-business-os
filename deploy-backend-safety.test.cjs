'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');

const script = fs.readFileSync('deploy-backend.ps1', 'utf8');
const executableLines = script.split(/\r?\n/)
  .filter(line => !line.trim().startsWith('#'))
  .join('\n');

assert.match(script, /DEPLOYMENT BLOCKED/i);
assert.match(script, /isolated TEST ONLY Apps Script project/i);
assert.match(script, /No files were copied/i);
assert.match(script, /\bexit\s+1\b/i);
assert.doesNotMatch(executableLines, /^\s*(?:&\s*)?clasp\s+(?:push|deploy)\b/im,
  'repository deployment helper must not execute clasp push/deploy');
assert.doesNotMatch(executableLines, /^\s*Copy-Item\b/im,
  'repository deployment helper must not overwrite the guarded LAB source');

process.stdout.write('Deployment safety: automatic clasp push/deploy is blocked.\n');
