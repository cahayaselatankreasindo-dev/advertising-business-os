'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(require('node:path').join(__dirname, 'TinyFishService.gs'), 'utf8');
const props = new Map();
const calls = [];
let mockResponse = {};
let mockCode = 200;
let now = 1700000000000;
const context = {
  Date: { now: () => now },
  PropertiesService: {
    getScriptProperties: () => ({
      getProperty: key => props.get(key) || '',
      setProperty: (key, value) => { props.set(key, String(value)); }
    })
  },
  LockService: {
    getUserLock: () => ({ tryLock: () => true, releaseLock: () => {} })
  },
  UrlFetchApp: {
    fetch: (url, options) => {
      calls.push({ url, options });
      return {
        getResponseCode: () => mockCode,
        getContentText: () => JSON.stringify(mockResponse)
      };
    }
  },
  cskLabRequireDummySheet_: () => ({}),
  cskLabEnsurePrivateToken_: () => ({ configured: true }),
  cskLabGuardRead_: () => ({}),
  encodeURIComponent,
  JSON,
  String,
  Number,
  Array,
  Math,
  Error,
  RegExp
};
vm.createContext(context);
vm.runInContext(source, context);

function resetRate(key) { props.delete(key); now += 2000; }
function invoke(action, payload) { return context.cskLabTinyFishRequest(Object.assign({ action }, payload || {})); }

let result = invoke('status');
assert.equal(result.status, 'success');
assert.equal(result.configured, false);
assert.equal(JSON.stringify(result).includes('sk-tinyfish'), false);

result = invoke('search', { query: 'percetakan signage Jakarta' });
assert.equal(result.status, 'error');
assert.equal(result.code, 'TINYFISH_NOT_CONFIGURED');

props.set('TINYFISH_API_KEY', 'sk-tinyfish-TEST-ONLY-DO-NOT-USE');
resetRate('TINYFISH_LAST_SEARCH_MS');
mockResponse = {
  query: 'percetakan signage Jakarta',
  total_results: 1,
  results: [{ position: 1, site_name: 'Example', title: 'Vendor Signage', snippet: 'Public result', url: 'https://example.com/vendor' }]
};
result = invoke('search', { query: 'percetakan signage Jakarta' });
assert.equal(result.status, 'success');
assert.equal(result.results.length, 1);
assert.equal(result.results[0].url, 'https://example.com/vendor');
assert.equal(calls.at(-1).options.headers['X-API-Key'], 'sk-tinyfish-TEST-ONLY-DO-NOT-USE');
assert.match(calls.at(-1).url, /location=ID&language=id/);
assert.equal(JSON.stringify(result).includes('sk-tinyfish'), false);

resetRate('TINYFISH_LAST_FETCH_MS');
mockResponse = { results: [{ url: 'https://example.com', final_url: 'https://example.com/', title: 'Example', text: 'Public content', links: [] }] };
result = invoke('fetch', { url: 'https://example.com' });
assert.equal(result.status, 'success');
assert.equal(result.text, 'Public content');

result = invoke('fetch', { url: 'http://127.0.0.1/admin' });
assert.equal(result.status, 'error');
assert.equal(result.code, 'URL_NOT_PUBLIC');

result = invoke('agent_start', { url: 'https://example.com', goal: 'Log in and submit the contact form' });
assert.equal(result.status, 'error');
assert.equal(result.code, 'READ_ONLY_GOAL_REQUIRED');

resetRate('TINYFISH_LAST_AGENT_MS');
mockResponse = { run_id: 'run_TEST_12345678' };
result = invoke('agent_start', { url: 'https://example.com', goal: 'Read the public company profile and summarize services.' });
assert.equal(result.status, 'success');
assert.equal(result.runId, 'run_TEST_12345678');
assert.equal(calls.at(-1).url, 'https://agent.tinyfish.ai/v1/automation/run-async');
assert.equal(calls.at(-1).options.headers['X-API-Key'], 'sk-tinyfish-TEST-ONLY-DO-NOT-USE');
assert.doesNotMatch(calls.at(-1).options.payload, /TINYFISH_API_KEY|sk-tinyfish/);

mockResponse = { run_id: 'run_TEST_12345678', status: 'COMPLETED', result: { summary: 'Public research' }, steps: [] };
result = invoke('agent_status', { runId: 'run_TEST_12345678' });
assert.equal(result.status, 'success');
assert.equal(result.runStatus, 'COMPLETED');
assert.deepEqual(JSON.parse(JSON.stringify(result.result)), { summary: 'Public research' });

mockCode = 401;
mockResponse = { error: { code: 'INVALID_API_KEY', message: 'Do not echo secret' } };
result = invoke('search', { query: 'test' });
assert.equal(result.status, 'error');
assert.equal(result.code, 'TINYFISH_HTTP_401');
assert.doesNotMatch(result.message, /Do not echo secret|sk-tinyfish/);

console.log('TinyFish server-side integration tests passed.');
