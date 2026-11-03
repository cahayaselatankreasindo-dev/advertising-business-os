#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const modules = [
  'apps-script/Code.gs',
  'apps-script/LabRequestGuard.gs',
  'apps-script/LabSelfTest.gs',
  'apps-script/LabHandlerVerification.gs'
];
const outputPath = path.join(__dirname, 'CSK-LAB-BUNDLE.gs');
const preamble = [
  '/**',
  ' * GENERATED ONE-FILE CSK BUSINESS OS LAB BACKEND.',
  ' * Generated from Code.gs + LabRequestGuard.gs + LabSelfTest.gs + LabHandlerVerification.gs.',
  ' * Paste this entire file into Code.gs ONLY in the isolated TEST ONLY spreadsheet Apps Script project.',
  ' * Never paste into production. Never deploy publicly. LAB Web App access must remain Only myself.',
  ' * Regenerate with: node apps-script/build-lab-bundle.cjs',
  ' */'
].join('\\n');
const sections = modules.map(file => {
  let source = fs.readFileSync(path.join(root, file), 'utf8').replace(/\\s+$/, '');
  if (file === 'apps-script/Code.gs') {
    source = source.replace(
      'Requires LabSelfTest.gs, LabRequestGuard.gs and LabHandlerVerification.gs.',
      'Guard and LAB test helpers are appended in this generated one-file bundle.'
    );
  }
  return '// ===== BEGIN ' + file + ' =====\\n' + source + '\\n// ===== END ' + file + ' =====';
});
const expected = preamble + '\\n\\n' + sections.join('\\n\\n') + '\\n';
if (process.argv.includes('--check')) {
  const actual = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, 'utf8') : '';
  if (actual !== expected) {
    console.error('CSK LAB bundle is stale. Run: node apps-script/build-lab-bundle.cjs');
    process.exit(1);
  }
  console.log('CSK LAB one-file bundle is up to date.');
} else {
  fs.writeFileSync(outputPath, expected, 'utf8');
  console.log('Generated ' + path.relative(root, outputPath));
}
