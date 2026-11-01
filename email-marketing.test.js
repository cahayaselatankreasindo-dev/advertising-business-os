/* CSK Email Marketing — safe local segmentation and draft contracts. */
'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const m=require('./email-marketing.js');
const leads=[
 {id:'DEMO-1',name:'Brand Fiktif A',email:'hello@brand-a.example',pic:'Nanda',industry:'Retail',status:'new',source:'Referral'},
 {id:'DEMO-2',name:'Brand Fiktif B',email:'HELLO@brand-a.example',pic:'Jono',industry:'FMCG',status:'contacted',source:'Google Ads'},
 {id:'DEMO-3',name:'EO Contoh',email:'events@eo-example.org',pic:'',industry:'EO',status:'nego',source:'Website'},
 {id:'DEMO-4',name:'Tidak Ada Email',email:'',pic:'Dono',industry:'Retail',status:'new'},
 {id:'DEMO-5',name:'Alamat Tidak Valid',email:'not an email',pic:'',industry:'',status:'new'}
];
test('CRM mapping pulls brand, PIC, industry, status, source and email from lead columns',()=>{
 const c=m.safeRow(leads[0]);
 assert.deepEqual(c,{id:'DEMO-1',brand:'Brand Fiktif A',email:'hello@brand-a.example',pic:'Nanda',picTitle:'',industry:'Retail',status:'new',source:'Referral'});
});
test('duplicate and invalid emails excluded, no implicit promotional consent',()=>{
 const a=m.audience(leads);
 assert.equal(a.summary.total,5);assert.equal(a.summary.invalid,2);assert.equal(a.summary.duplicate,1);
 assert.equal(a.summary.unverified,2);assert.equal(a.summary.eligible,0);
 assert.equal(a.eligible.length,0);
});
test('consent must include manually recorded evidence; unknown/unsubscribed cannot compose',()=>{
 const contact=leads[0];
 assert.throws(()=>m.permission({},contact.email,'consented',''),/bukti/i);
 assert.throws(()=>m.compose(contact,{},'Hello','Body'),/izin/);
 const approved=m.permission({},contact.email,'consented','Form opt-in ditandatangani 2026-11-02');
 assert.equal(m.audience(leads,approved).summary.eligible,1);
 assert.equal(m.compose(contact,approved,'Halo {{brand}}','Untuk {{pic}}').subject,'Halo Brand Fiktif A');
 assert.equal(m.compose(contact,approved,'Halo {{brand}}','Untuk {{pic}}').body,'Untuk Nanda');
 const denied=m.permission(approved,contact.email,'unsubscribed','Minta berhenti');
 assert.equal(m.audience(leads,denied).summary.suppressed,1);
 assert.throws(()=>m.compose(contact,denied,'Hi','Body'),/izin/);
});
test('no automatic sending or network calls; mailto only',()=>{
 const approved=m.permission({},leads[0].email,'consented','Opt-in email confirmed in writing');
 const draft=m.compose(leads[0],approved,'Kolaborasi {{brand}}','Halo {{pic}}\n\nBaru');
 const url=m.draftUrl(draft);
 assert.match(url,/^mailto:/);assert.match(url,/subject=Kolaborasi%20Brand%20Fiktif%20A/);
 const ui=fs.readFileSync(path.join(__dirname,'email-marketing-ui.js'),'utf8');
 assert.doesNotMatch(ui,/\bfetch\s*\(/);
 assert.doesNotMatch(ui,/\bXMLHttpRequest\b/);
 assert.doesNotMatch(ui,/script\.google\.com/);
 assert.doesNotMatch(ui,/send_cold_email/);
 assert.doesNotMatch(ui,/MailApp|GmailApp/);
 assert.doesNotThrow(()=>new vm.Script(ui));
});
test('safe segmentation by status, industry and search',()=>{
 let ledger=m.permission({},leads[0].email,'consented','Explicit opt-in from event booth');
 ledger=m.permission(ledger,leads[2].email,'unsubscribed','Asked to stop');
 const a=m.audience(leads,ledger,{status:'new',industry:'retail',search:'fiktif'});
 assert.equal(a.all.length,1);assert.equal(a.eligible.length,1);
 assert.equal(a.all[0].brand,'Brand Fiktif A');
});
test('merge placeholders only from explicitly supported lead columns, no code execution',()=>{
 const s=m.render('Halo {{pic}}, {{brand}} {{industry}} {{source}} {{status}} {{__proto__}}',leads[0]);
 assert.equal(s,'Halo Nanda, Brand Fiktif A Retail Referral Lead Baru {{__proto__}}');
});
test('CSV export excludes contacts without consent and escapes spreadsheet formula input',()=>{
 let approved=m.permission({},leads[0].email,'consented','Opt in confirmed by contact');
 const list=m.audience(leads,approved).eligible;
 assert.equal(list.length,1);
 const modified={...list[0],brand:'=HYPERLINK("http://invalid.test")'};
 const csv=m.csvExport([modified],approved,'Hi {{brand}}','Hello {{pic}}');
 assert.match(csv,/^﻿"Email","Brand"/);
 assert.match(csv,/"'=HYPERLINK\(""http:\/\/invalid\.test""\)"/);
 assert.ok(!csv.includes('events@eo-example.org'));
 assert.throws(()=>m.csvExport(m.audience(leads,{}).all,{},'Hi','Body'),/izin/);
});
test('staging app integrates owner-only marketing nav, safe draft and fresh Leads source',()=>{
 const index=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
 assert.match(index,/id="page-email"/);
 assert.match(index,/nav\('email'\)/);
 assert.match(index,/email-marketing\.js/);
 assert.match(index,/email-marketing-ui\.js/);
 assert.match(index,/CSKEmailUI\.mount\(.+, \(\) => db\.leads,/);
 assert.match(index,/openEmailMarketingLead/);
 assert.doesNotMatch(index,/async function sendColdEmailLead\(/);
 assert.doesNotMatch(index,/action:\s*'send_cold_email'/);
});

test('offline email preview ships corrected campaign engine, dummy leads and no API access',()=>{
 const html=fs.readFileSync(path.join(__dirname,'preview','CSK-Email-Marketing-Offline.html'),'utf8');
 assert.doesNotMatch(html,/<script[^>]+\bsrc\s*=/i);
 assert.doesNotMatch(html,/\bfetch\s*\(/i);
 assert.doesNotMatch(html,/script\.google\.com\/macros\/s\//i);
 assert.doesNotMatch(html,/https?:\/\/fonts\.googleapis\.com/i);
 const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
 assert.equal(scripts.length,3);
 scripts.forEach((match,i)=>assert.doesNotThrow(()=>new vm.Script(match[1],{filename:'Email-preview-'+i})));
 assert.equal(scripts[0][1].trim(),fs.readFileSync(path.join(__dirname,'email-marketing.js'),'utf8').trim());
 assert.ok(html.includes('DEMO-LEAD-01'));
 assert.ok(html.includes('Offline Lab Preview'));
});
test('full Business OS inline app syntax parses after marketing integration',()=>{
 const index=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
 const inline=[...index.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
 assert.equal(inline.length,1);
 assert.doesNotThrow(()=>new vm.Script(inline[0][1],{filename:'index.html'}));
});
