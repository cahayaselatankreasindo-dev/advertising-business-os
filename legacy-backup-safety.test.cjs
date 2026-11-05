'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');

const archive = fs.readFileSync('backups', 'utf8');

assert.match(archive, /ARCHIVED LEGACY BACKEND — DO NOT DEPLOY/i);
assert.match(archive, /NO authentication or authorization/i);
assert.match(archive, /legacy POST overwrote entire sheet tabs/i);
assert.match(archive, /ARSIP SAJA — TIDAK ADA LANGKAH PEMASANGAN/i);

assert.doesNotMatch(archive, /^\s*function\s+doGet\s*\(/m,
  'the archived backend must not expose an active Apps Script GET handler');
assert.doesNotMatch(archive, /^\s*function\s+doPost\s*\(/m,
  'the archived backend must not expose an active Apps Script POST handler');
assert.doesNotMatch(archive, /^\s*function\s+setupSheet\s*\(/m,
  'the archived backend must not expose an active destructive setup entry point');

assert.match(archive, /function\s+legacyDoGet_DISABLED_DO_NOT_DEPLOY\s*\(/);
assert.match(archive, /function\s+legacyDoPost_DISABLED_DO_NOT_DEPLOY\s*\(/);
assert.match(archive, /function\s+setupSheet_DISABLED_DO_NOT_RUN\s*\(/);

process.stdout.write('Legacy backend archive safety: no active web app or setup entry points.\n');
