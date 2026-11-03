const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ops=require('./operations-core.js');
const ui=require('./operations-ui.js');

const lead={id:'LEAD-1',name:'PT Brand Contoh'};
const hpp={id:'hpp-1',name:'Rak display',outputQty:2};
const hppEngine={calc(){return {ready:true,quote:hpp,price:1620000,baseHpp:760000,extraTotal:100000,
 markupPercent:100,rows:[{description:'PVC board',quantity:2,unit:'lembar',unitCost:175000,wastePercent:0,total:350000}],
 extras:[{description:'Parkir dan ongkir',total:100000}]}}};
function quote(state){return ops.quoteFromHpp(state,hpp,hppEngine,lead,{number:'CSK-Q-001',name:'Rak display',validUntil:'2026-11-30'});}

test('seven isolated collections start empty, no customer or production API defaults',()=>{
 const data=ops.empty();
 assert.equal(data.schemaVersion,1);
 for(const kind of ops.KINDS)assert.deepEqual(data[kind],[]);
 assert.match(ops.KEY,/local/);
 assert.deepEqual(ops.load(data),data);
});
test('follow-up can be added, completed, and counted when due',()=>{
 let state=ops.add(ops.empty(),'followups',{leadId:lead.id,leadName:lead.name,due:'2026-11-01',channel:'WhatsApp',note:'Kirim referensi produksi'});
 assert.equal(ops.summary(state,'2026-11-02').followupDue,1);
 state=ops.update(state,'followups',state.followups[0].id,{status:'done'});
 assert.equal(ops.summary(state,'2026-11-02').followupDue,0);
 assert.throws(()=>ops.add(state,'followups',{leadId:'',due:'2026-11-31'}),/jadwal|lead/i);
});
test('supplier pricebook requires positive price and supports updates without touching HPP',()=>{
 let state=ops.add(ops.empty(),'suppliers',{name:'Vendor A',material:'PVC 5mm',unit:'lembar',price:175000,updated:'2026-11-02'});
 const id=state.suppliers[0].id;
 state=ops.update(state,'suppliers',id,{price:180000});
 assert.equal(state.suppliers[0].price,180000);
 assert.throws(()=>ops.add(state,'suppliers',{name:'Vendor X',material:'Hollow',price:0}),/Harga supplier/);
});
test('quotation snapshots HPP, rejects incomplete estimates and prevents fake invoices',()=>{
 let state=quote(ops.empty());const q=state.quotes[0];
 assert.equal(q.price,1620000);
 assert.equal(q.baseHpp,760000);
 assert.equal(q.extraTotal,100000);
 assert.equal(q.rows[0].description,'PVC board');
 assert.throws(()=>quote(state),/Nomor dokumen/);
 assert.throws(()=>ops.newInvoice(state,q.id,'INV-1','2026-11-02','2026-11-15'),/diterima/);
 assert.throws(()=>ops.quoteFromHpp(state,hpp,{calc:()=>({...hppEngine.calc(),ready:false})},lead,{number:'Q-2',validUntil:'2026-11-30'}),/belum lengkap/);
 state=ops.update(state,'quotes',q.id,{status:'sent'});
 state=ops.update(state,'quotes',q.id,{status:'accepted'});
 state=ops.newInvoice(state,q.id,'INV-1','2026-11-02','2026-11-15','DP setelah diterima');
 assert.equal(state.invoices[0].amount,1620000);
 assert.throws(()=>ops.update(state,'quotes',q.id,{price:1}),/terkait/);
 assert.throws(()=>ops.remove(state,'quotes',q.id),/invoice/);
 assert.throws(()=>ops.add(state,'quotes',{...q,id:'bad',price:1}),/tidak konsisten/);
 assert.throws(()=>ops.newInvoice(state,q.id,'INV-2','2026-11-20','2026-11-10'),/Jatuh tempo/);
});
test('one accepted quotation maps to one invoice and document numbers stay unique on update',()=>{
 let state=quote(ops.empty());const q=state.quotes[0];
 state=ops.update(state,'quotes',q.id,{status:'accepted'});
 state=ops.newInvoice(state,q.id,'INV-UNIQUE','2026-11-02','2026-11-15');
 const invoice=state.invoices[0];
 assert.throws(()=>ops.newInvoice(state,q.id,'INV-DUP','2026-11-02','2026-11-15'),/satu penawaran/i);
 state=ops.quoteFromHpp(state,hpp,hppEngine,{id:'LEAD-2',name:'Brand Kedua'},{number:'CSK-Q-002',name:'Rak display',validUntil:'2026-11-30'});
 const secondQuote=state.quotes[1];
 state=ops.update(state,'quotes',secondQuote.id,{status:'accepted'});
 state=ops.newInvoice(state,secondQuote.id,'INV-SECOND','2026-11-02','2026-11-15');
 assert.throws(()=>ops.update(state,'invoices',invoice.id,{number:'INV-SECOND'}),/nomor dokumen/i);
 assert.throws(()=>ops.update(state,'invoices',invoice.id,{amount:1}),/sesuai penawaran/i);
 assert.throws(()=>ops.update(state,'invoices',invoice.id,{quoteId:secondQuote.id}),/relasi invoice/i);
});


test('payments are actual separate records with balances and overpayment rejection',()=>{
 let state=quote(ops.empty());const q=state.quotes[0];
 state=ops.update(state,'quotes',q.id,{status:'accepted'});
 state=ops.newInvoice(state,q.id,'INV-1','2026-11-02','2026-11-15');
 const invoiceId=state.invoices[0].id;
 state=ops.add(state,'payments',{invoiceId,date:'2026-11-03',amount:620000,method:'Transfer'});
 assert.equal(ops.balance(state,invoiceId).remaining,1000000);
 assert.equal(ops.summary(state,'2026-12-01').overdueInvoices,1);
 assert.throws(()=>ops.add(state,'payments',{invoiceId,date:'2026-11-03',amount:1000001}),/melebihi/);
 state=ops.add(state,'payments',{invoiceId,date:'2026-11-14',amount:1000000});
 assert.equal(ops.balance(state,invoiceId).remaining,0);
 assert.equal(ops.summary(state,'2026-12-01').overdueInvoices,0);
 assert.throws(()=>ops.remove(state,'invoices',invoiceId),/pembayaran/);
 assert.throws(()=>ops.update(state,'payments',state.payments[0].id,{amount:1}),/terkait/);
});
test('production QC summarizes latest stage outcome, not automatic project mutation',()=>{
 let state=ops.add(ops.empty(),'qc',{projectId:'PRJ-1',projectName:'Booth A',stage:'Brief',status:'done',date:'2026-11-02'});
 state=ops.add(state,'qc',{projectId:'PRJ-1',projectName:'Booth A',stage:'Fabrikasi',status:'issue',date:'2026-11-03'});
 assert.deepEqual(ops.projectProgress(state,'PRJ-1'),{done:1,total:8,percent:13,issues:1});
 state=ops.add(state,'qc',{projectId:'PRJ-1',projectName:'Booth A',stage:'Fabrikasi',status:'done',date:'2026-11-04'});
 assert.deepEqual(ops.projectProgress(state,'PRJ-1'),{done:2,total:8,percent:25,issues:0});
});
test('marketing attribution counts unique leads and does not claim ROAS',()=>{
 let state=ops.add(ops.empty(),'attribution',{leadId:'L1',leadName:'Brand A',channel:'Meta Ads',campaign:'November',date:'2026-11-02'});
 state=ops.add(state,'attribution',{leadId:'L1',leadName:'Brand A',channel:'Meta Ads',campaign:'November',date:'2026-11-03'});
 state=ops.add(state,'attribution',{leadId:'L2',leadName:'Brand B',channel:'Meta Ads',campaign:'November',date:'2026-11-03'});
 const summary=ops.campaignSummary(state);
 assert.equal(summary.length,1);
 assert.equal(summary[0].leadCount,2);
 assert.ok(!('roas' in summary[0]));
});
test('only unambiguous manual campaign links can show actual received cash',()=>{
 let state=ops.add(ops.empty(),'attribution',{leadId:'LEAD-1',leadName:'PT Brand Contoh',channel:'Meta Ads',campaign:'Campaign A',date:'2026-11-02'});
 state=quote(state);const q=state.quotes[0];
 state=ops.update(state,'quotes',q.id,{status:'accepted'});
 state=ops.newInvoice(state,q.id,'INV-1','2026-11-02','2026-11-15');
 state=ops.add(state,'payments',{invoiceId:state.invoices[0].id,date:'2026-11-04',amount:620000});
 assert.equal(ops.campaignSummary(state)[0].paidLinked,620000);
 assert.equal(ops.campaignSummary(state)[0].acceptedCount,1);
 state=ops.add(state,'attribution',{leadId:'LEAD-1',leadName:'PT Brand Contoh',channel:'Google Ads',campaign:'Campaign B',date:'2026-11-04'});
 assert.ok(ops.campaignSummary(state).every(x=>x.paidLinked===0&&x.acceptedCount===0));
});
test('backup merges IDs without overwriting existing records and protects relationships',()=>{
 const original=ops.add(ops.empty(),'suppliers',{id:'S1',name:'Asli',material:'Akrilik',unit:'lembar',price:100000,updated:'2026-11-02'});
 const imported=ops.add(ops.empty(),'suppliers',{id:'S1',name:'Tertimpa?',material:'Akrilik',unit:'lembar',price:999999,updated:'2026-11-03'});
 const merged=ops.mergeBackup(original,imported);
 assert.equal(merged.state.suppliers[0].name,'Asli');
 assert.equal(merged.report.suppliers.skipped,1);
 assert.throws(()=>ops.load({...ops.empty(),schemaVersion:999}),/Versi backup/);
 assert.throws(()=>ops.mergeBackup(ops.empty(),{...ops.empty(),invoices:[{quoteId:'missing',number:'INV',issued:'2026-11-02',due:'2026-11-03',amount:10}]}),/tanpa penawaran/);
});
test('photo LAB launcher resolves the real CRM title and safely carries project ID plus stage',()=>{
 const project={id:'PRJ-42',title:'Booth Aktivasi Brand',client:'Brand Contoh'};
 assert.equal(ui.projectDisplayName(project),'Booth Aktivasi Brand');
 const options=ui.projectSelect(()=>({projects:[project]}));
 assert.match(options,/Booth Aktivasi Brand/);
 assert.match(options,/PRJ-42/);
 const url=ui.buildPhotoLabUrl('https://script.google.com/macros/s/Abc123_-9/exec','PRJ-42','Fabrikasi');
 assert.equal(new URL(url).searchParams.get('projectId'),'PRJ-42');
 assert.equal(new URL(url).searchParams.get('stage'),'Fabrikasi');
 assert.throws(()=>ui.buildPhotoLabUrl('https://example.com/exec','PRJ-42','Fabrikasi'),/URL uploader/);
 assert.throws(()=>ui.buildPhotoLabUrl('https://script.google.com/macros/s/Abc123_-9/exec','bad id','Fabrikasi'),/ID proyek/);
});
test('UI keeps Operations data local and opens only an explicit owner-controlled LAB uploader',()=>{
 assert.equal(ui.esc('<img src=x onerror=alert(1)>'),'&lt;img src=x onerror=alert(1)&gt;');
 const source=fs.readFileSync(require.resolve('./operations-ui.js'),'utf8');
 assert.doesNotMatch(source,/\bfetch\s*\(|\bXMLHttpRequest\b|MailApp|GmailApp|google\.script\.run/);
 assert.match(source,/validPhotoLabUrl/);
 assert.match(source,/Buka Upload Foto Proyek Privat/);
 assert.match(source,/RAB Internal JSON/);
 assert.match(source,/Print → Save as PDF/);
 assert.doesNotMatch(source,/Subtotal biaya<\/th>/);
});
test('staging index connects the six workflows without writing CRM or cloud',{skip:!fs.existsSync('index.html')},()=>{
 const html=fs.readFileSync('index.html','utf8');
 const sw=fs.readFileSync('sw.js','utf8');
 assert.match(html,/id="page-ops"/);
 assert.match(html,/nav\('ops'\)/);
 assert.match(html,/operations-core\.js/);
 assert.match(html,/operations-ui\.js/);
 assert.match(html,/CSKOperationsUI\.mount/);
 assert.match(sw,/operations-core\.js/);
 assert.match(sw,/operations-ui\.js/);
});
