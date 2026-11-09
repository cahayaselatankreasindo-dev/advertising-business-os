'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crm=require('./crm-upgrade.js');
const today='2026-11-08';
const leads=[
{id:'L1',name:'PT Alfa',status:'new',nextFollowUp:'2026-11-07'},
{id:'L2',name:'PT Beta',status:'contacted',nextFollowUp:'2026-11-08'},
{id:'L3',name:'CV Gamma',status:'nego',nextFollowUp:'2026-11-12'},
{id:'L4',name:'UD Delta',status:'new',nextFollowUp:''},
{id:'L5',name:'PT Epsilon',status:'won',nextFollowUp:'2026-11-01'}
];
assert.equal(crm.getLeadFollowUpState(leads[0],today),'overdue');
assert.equal(crm.getLeadFollowUpState(leads[1],today),'today');
assert.equal(crm.getLeadFollowUpState(leads[2],today),'scheduled');
assert.equal(crm.getLeadFollowUpState(leads[3],today),'unscheduled');
assert.equal(crm.getLeadFollowUpState({nextFollowUp:'2026-02-31'},today),'unscheduled');
assert.deepEqual(crm.filterLeadRecords(leads,{query:'beta'},today).map(x=>x.id),['L2']);
assert.deepEqual(crm.filterLeadRecords(leads,{status:'new',followUp:'overdue'},today).map(x=>x.id),['L1']);
assert.deepEqual(crm.filterLeadRecords(leads,{followUp:'unscheduled'},today).map(x=>x.id),['L4']);
assert.deepEqual(crm.filterLeadRecords(leads,{query:'epsilon',followUp:'overdue'},today).map(x=>x.id),['L5']);
const clients=[{id:'C1',name:'PT Alfa',phone:'081234'},{id:'C2',name:'CV Beta',phone:'089999'}];
assert.deepEqual(crm.filterClientRecords(clients,{query:'0899'}).map(x=>x.id),['C2']);
const projects=[
{id:'P1',title:'Booth Alfa',client:'PT Alfa',pic:'Budi',status:'ongoing',deadline:'2026-11-07',sopChecklist:'Brief:1;Produksi:1;Review:0;Revisi:0;Delivery:0'},
{id:'P2',title:'Signage Beta',client:'CV Beta',pic:'Sari',status:'review',deadline:'2026-11-08',sopChecklist:'Brief:1;Produksi:1;Review:1;Revisi:0;Delivery:0'},
{id:'P3',title:'Display Gamma',client:'UD Gamma',pic:'',status:'plan',deadline:'2026-11-20',sopChecklist:''},
{id:'P4',title:'Project Done',client:'PT Delta',pic:'Budi',status:'done',deadline:'2026-11-01',sopChecklist:'Brief:1;Produksi:1;Review:1;Revisi:1;Delivery:1'}
];
assert.equal(crm.getProjectDeadlineState(projects[0],today),'overdue');
assert.equal(crm.getProjectDeadlineState(projects[1],today),'today');
assert.equal(crm.getProjectDeadlineState(projects[2],today),'upcoming');
assert.equal(crm.getProjectDeadlineState(projects[3],today),'completed');
assert.deepEqual(crm.filterProjectRecords(projects,{query:'sari'},today).map(x=>x.id),['P2']);
assert.deepEqual(crm.filterProjectRecords(projects,{deadline:'overdue'},today).map(x=>x.id),['P1']);
assert.deepEqual(crm.getProjectProgress(projects[0]),{completed:2,total:5,percent:40});
const summary=crm.summarizeCRM(leads,projects,today);
assert.equal(summary.activeLeads,4);
assert.equal(summary.overdueLeads.length,1);
assert.equal(summary.dueTodayLeads.length,1);
assert.equal(summary.unscheduledLeads.length,1);
assert.equal(summary.overdueProjects.length,1);
const backend=fs.readFileSync('apps-script/Code.gs','utf8');
const backendCopy=fs.readFileSync('google_apps_script.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const sw=fs.readFileSync('sw.js','utf8');
assert.equal(backend.trimEnd(),backendCopy.trimEnd(),'Apps Script source copies must remain identical');
assert.match(backend,/"NextFollowUp"/);
assert.match(backend,/"LastContactAt"/);
assert.match(backend,/"FollowUpNote"/);
assert.match(backend,/function stableLeadEntityId_/);
assert.match(backend,/LockService\.getScriptLock\(\)/);
assert.match(backend,/financeCreated: 0/);
assert.match(html,/nextFollowUp: val\('lead-next-follow-up'\)/);
assert.match(html,/followUpNote: val\('lead-follow-up-note'\)/);
assert.match(html,/pic: \(document\.getElementById\('proj-pic'\)/);
assert.match(html,/if \(!isOwnerSession\(\)\)/);
assert.match(html,/isOwnerSession\(\)\?'<button onclick="convertLeadToWon/);
assert.match(html,/leadWonOption\.disabled = isTeam/);
assert.match(html,/src="\.\/crm-upgrade\.js"/);
assert.doesNotMatch(html,/Deal Menang → Pendapatan \+ Antrean Proyek/);
assert.match(sw,/csk-business-os-v3\.2\.2/);
assert.match(sw,/'\.\/crm-upgrade\.js'/);
console.log('CSK CRM upgrade unit and integration checks passed.');
