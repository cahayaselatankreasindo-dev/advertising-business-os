'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

for (const path of ['google_apps_script.js', 'apps-script/Code.gs']) {
  const source = fs.readFileSync(path, 'utf8');
  assert.match(source, /function getApiToken\(\)[\s\S]*?getProperty\("API_TOKEN"\)/, path + ': token stored in Script Properties');
  assert.match(source, /if \(!\/\^\[a-f0-9\]\{64\}\$\/i\.test\(expected\)\) return false;/, path + ': missing/invalid server token fails closed');
  assert.doesNotMatch(source, /if \(expected === ""\) return true/, path + ': no unauthenticated compatibility mode');
  assert.match(source, /function setupApiToken\(\)[\s\S]*?if \(props\.getProperty\("API_TOKEN"\)\)[\s\S]*?throw new Error/, path + ': setup does not silently rotate existing token');
  assert.match(source, /function rotateApiToken\(\)/, path + ': explicit token rotation exists');
  assert.match(source, /function doGet\(e\)[\s\S]*?isAuthorized\(null, tokenParam\)/, path + ': GET protected');
  assert.match(source, /function doPost\(e\)[\s\S]*?isAuthorized\(payload\)/, path + ': POST protected');
}
console.log('CSK backend fail-closed API token checks passed.');
