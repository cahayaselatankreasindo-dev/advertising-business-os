'use strict';
/**
 * Regression guard for the STAGING backend only.
 * No Google API calls, outbound email, or production data.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

let sends = 0, installs = 0, deletions = [];
const mockToken = 'QA-ONLY-BACKEND-TOKEN-NEVER-DEPLOY';
const triggers = [
  {getHandlerFunction:()=> 'cronDailyOutreach', id:'old-cron'},
  {getHandlerFunction:()=> 'handleAutoTrigger', id:'different-job'}
];
const ctx = {
  PropertiesService: {getScriptProperties:()=>({getProperty:()=>mockToken})},
  SpreadsheetApp: {getActiveSpreadsheet:()=>({})},
  ContentService: {
    MimeType:{JSON:'JSON'},
    createTextOutput:content=>({getContent:()=>content,setMimeType(){return this;}})
  },
  GmailApp: {sendEmail:()=>{sends++;throw Error('An email was sent');}},
  MailApp: {sendEmail:()=>{sends++;throw Error('An email was sent');}},
  ScriptApp: {
    getProjectTriggers:()=>triggers,
    deleteTrigger:trigger=>deletions.push(trigger.id),
    newTrigger:()=>{installs++;throw Error('Unexpected trigger created');}
  },
  Logger: {log:()=>{}}
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('google_apps_script.js','utf8'),ctx,{filename:'google_apps_script.js'});

const response=ctx.doPost({postData:{contents:JSON.stringify({
  action:'send_cold_email',token:mockToken,protocolVersion:2,toEmail:'dummy@example.test'
})}});
const parsed=JSON.parse(response.getContent());
assert.equal(parsed.status,'error');
assert.match(parsed.message,/dinonaktifkan/);
assert.equal(sends,0,'No outbound mail may be sent by the legacy API');

const cron=ctx.cronDailyOutreach();
assert.equal(cron.disabled,true);
assert.equal(cron.sent,0);
const installer=ctx.installDailyOutreachTrigger();
assert.equal(installer.disabled,true);
assert.equal(installer.installed,0);
assert.equal(installs,0,'No scheduled email trigger may be installed');

const cleanup=ctx.removeLegacyOutreachTriggers();
assert.equal(cleanup.removed,1);
assert.deepEqual(deletions,['old-cron']);
assert.equal(sends,0);
process.stdout.write('✓ Staging backend cold-email API, cron, and installer are disabled; no emails sent.\n');
