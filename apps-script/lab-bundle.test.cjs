const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const files = [
  'apps-script/Code.gs',
  'apps-script/LabRequestGuard.gs',
  'apps-script/LabSelfTest.gs',
  'apps-script/LabHandlerVerification.gs'
];
let expected = `/**
 * GENERATED ONE-FILE CSK BUSINESS OS LAB BACKEND.
 * Generated from Code.gs + LabRequestGuard.gs + LabSelfTest.gs + LabHandlerVerification.gs.
 * Paste this entire file into Code.gs ONLY in the isolated TEST ONLY spreadsheet Apps Script project.
 * Never paste into production. Never deploy publicly. LAB Web App access must remain Only myself.
 * Regenerate with: node apps-script/build-lab-bundle.cjs
 */`;
const sections = files.map(file => {
  let source = fs.readFileSync(path.join(root,file),'utf8').replace(/\\s+$/,'');
  if (file === 'apps-script/Code.gs') source = source.replace(
    'Requires LabSelfTest.gs, LabRequestGuard.gs and LabHandlerVerification.gs.',
    'Guard and LAB test helpers are appended in this generated one-file bundle.'
  );
  return '// ===== BEGIN ' + file + ' =====\\n' + source + '\\n// ===== END ' + file + ' =====';
});
expected += '\\n\\n' + sections.join('\\n\\n') + '\\n';
const actual = fs.readFileSync(path.join(__dirname,'CSK-LAB-BUNDLE.gs'),'utf8');
assert.equal(actual,expected,'one-file LAB bundle must match all source modules');
assert.ok(actual.includes('cskLabGuardRead_()'),'bundle contains the GET guard');
assert.ok(actual.includes('cskLabGuardPost_(payload)'),'bundle contains the POST guard');
assert.ok(actual.includes('cskLabRunRoleIsolationTests()'),'bundle contains role isolation test');
assert.ok(actual.includes('CSK_LAB_SHEET_ID = "19le34ltpZCMIHmjw2n_JbEvrtZBWNTKd61U-xEAoR5Y"'),'bundle is bound to the exact LAB sheet');
console.log('CSK LAB bundle contract passed');
