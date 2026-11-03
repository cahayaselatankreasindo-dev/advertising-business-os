/* CSK Business OS — local-only Operations Suite (staging).
 * No remote API, CRM mutation, payment posting, or automatic outreach.
 */
(function(root){
'use strict';
const KEY='csk_ops_local_v1';
const VERSION=1;
const KINDS=['followups','quotes','suppliers','invoices','payments','qc','attribution'];
const STAGES=['Brief','Persetujuan Desain','Pembelian Bahan','Fabrikasi','Finishing','Quality Control','Pengiriman','Instalasi'];
const LIMIT=1e12, MAX_RECORDS=800;
function clean(v,max=300){return String(v==null?'':v).trim().slice(0,max)}
function number(v,label,min=0,max=LIMIT){
 if(v===''||v===null||v===undefined||!Number.isFinite(Number(v))||Number(v)<min||Number(v)>max)throw Error(label+' tidak valid.');
 return Math.round(Number(v)*100)/100;
}
function date(v,label){
 const s=clean(v,10);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(s))throw Error(label+' harus berupa tanggal.');
 const [y,m,d]=s.split('-').map(Number);
 const check=new Date(Date.UTC(y,m-1,d));
 if(check.getUTCFullYear()!==y||check.getUTCMonth()!==m-1||check.getUTCDate()!==d)throw Error(label+' tidak valid.');
 return s;
}
function today(){const now=new Date();return [now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-')}
function id(prefix='ops') {return prefix+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10)}
function empty(){return {schemaVersion:VERSION,followups:[],quotes:[],suppliers:[],invoices:[],payments:[],qc:[],attribution:[]}}
function assertKind(kind){if(!KINDS.includes(kind))throw Error('Jenis catatan tidak dikenal.')}
function normalize(kind,input){
 assertKind(kind);
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Format catatan tidak valid.');
 const shared={id:clean(input.id||id(kind),90),createdAt:clean(input.createdAt||new Date().toISOString(),40)};
 if(!shared.id)throw Error('ID kosong.');
 let r;
 switch(kind){
 case 'followups':
  r={...shared,leadId:clean(input.leadId,120),leadName:clean(input.leadName,180),due:date(input.due,'Jadwal follow-up'),channel:clean(input.channel||'WhatsApp',30),status:['planned','done','skipped'].includes(input.status)?input.status:'planned',note:clean(input.note,1200)};
  if(!r.leadId)throw Error('Pilih lead untuk follow-up.');break;
 case 'suppliers':
  r={...shared,name:clean(input.name,160),category:clean(input.category,80),material:clean(input.material,180),unit:clean(input.unit||'pcs',30),price:number(input.price,'Harga supplier',0.01),updated:date(input.updated||today(),'Tanggal harga'),contact:clean(input.contact,150),note:clean(input.note,800)};
  if(!r.name||!r.material)throw Error('Nama supplier dan material wajib diisi.');break;
 case 'quotes':
  r={...shared,leadId:clean(input.leadId,120),leadName:clean(input.leadName,180),number:clean(input.number,70),name:clean(input.name,150),hppId:clean(input.hppId,100),validUntil:date(input.validUntil,'Masa berlaku'),status:['draft','sent','accepted','rejected'].includes(input.status)?input.status:'draft',price:number(input.price,'Nilai penawaran',0),baseHpp:number(input.baseHpp,'HPP',0),extraTotal:number(input.extraTotal,'Biaya tambahan',0),markupPercent:number(input.markupPercent,'Markup',0,1000),qty:number(input.qty,'Jumlah hasil',1,1e6),rows:[],extras:[],note:clean(input.note,1500),taxExcluded:true};
  if(!r.leadId||!r.number||!r.name)throw Error('Lead, nomor, dan judul penawaran wajib diisi.');
  if(!Array.isArray(input.rows)||input.rows.length>120||!Array.isArray(input.extras)||input.extras.length>40)throw Error('RAB tidak valid.');
  r.rows=input.rows.map(x=>({description:clean(x.description,180),quantity:number(x.quantity,'Kuantitas',0),unit:clean(x.unit,30),unitCost:number(x.unitCost,'Harga satuan',0),wastePercent:number(x.wastePercent||0,'Waste',0,100),total:number(x.total,'Subtotal',0)}));
  r.extras=input.extras.map(x=>({description:clean(x.description,180),total:number(x.total,'Biaya tambahan',0)}));
  if(Math.abs(r.price-Math.round((r.baseHpp*(1+r.markupPercent/100)+r.extraTotal)*100)/100)>0.01)throw Error('Nilai penawaran tidak konsisten dengan snapshot HPP.');
  break;
 case 'invoices':
  r={...shared,quoteId:clean(input.quoteId,100),number:clean(input.number,70),issued:date(input.issued,'Tanggal invoice'),due:date(input.due,'Jatuh tempo'),amount:number(input.amount,'Nilai invoice',0),note:clean(input.note,1200)};
  if(!r.quoteId||!r.number)throw Error('Nomor invoice dan penawaran wajib diisi.');break;
 case 'payments':
  r={...shared,invoiceId:clean(input.invoiceId,100),date:date(input.date,'Tanggal pembayaran'),amount:number(input.amount,'Nominal pembayaran',0.01),method:clean(input.method||'Transfer',80),reference:clean(input.reference,100),note:clean(input.note,500)};
  if(!r.invoiceId)throw Error('Pilih invoice.');break;
 case 'qc':
  r={...shared,projectId:clean(input.projectId,120),projectName:clean(input.projectName,180),stage:STAGES.includes(input.stage)?input.stage:'Brief',status:['done','issue','pending'].includes(input.status)?input.status:'pending',date:date(input.date,'Tanggal QC'),note:clean(input.note,1200)};
  if(!r.projectId)throw Error('Pilih proyek.');break;
 case 'attribution':
  r={...shared,leadId:clean(input.leadId,120),leadName:clean(input.leadName,180),channel:clean(input.channel,80),campaign:clean(input.campaign,140),date:date(input.date,'Tanggal sumber'),evidence:clean(input.evidence,1000)};
  if(!r.leadId||!r.channel||!r.campaign)throw Error('Lead, kanal, dan campaign wajib diisi.');break;
 }
 if(kind==='invoices'&&r.due<r.issued)throw Error('Jatuh tempo tidak boleh sebelum tanggal invoice.');
 return r;
}
function load(parsed){
 if(parsed==null)return empty();
 if(!parsed||typeof parsed!=='object'||Array.isArray(parsed)||parsed.schemaVersion!==VERSION)throw Error('Versi backup Operations tidak dikenali.');
 const result=empty();
 for(const kind of KINDS){
  if(!Array.isArray(parsed[kind])||parsed[kind].length>MAX_RECORDS)throw Error('Koleksi '+kind+' rusak atau terlalu besar.');
  const seen=new Set();
  result[kind]=parsed[kind].map(x=>{
   const row=normalize(kind,x);
   if(seen.has(row.id))throw Error('ID duplikat dalam '+kind+'.');
   seen.add(row.id);return row;
  });
 }
 return result;
}
function get(state,kind,recordId){assertKind(kind);return state[kind].find(x=>x.id===recordId)}
function balance(state,invoiceId){
 const invoice=get(state,'invoices',invoiceId);
 if(!invoice)throw Error('Invoice tidak ditemukan.');
 const paid=Math.round(state.payments.filter(x=>x.invoiceId===invoiceId).reduce((sum,x)=>sum+x.amount,0)*100)/100;
 return {amount:invoice.amount,paid,remaining:Math.max(0,Math.round((invoice.amount-paid)*100)/100),overpaid:paid>invoice.amount};
}
function add(state,kind,input){
 assertKind(kind);
 const item=normalize(kind,input);
 if(state[kind].length>=MAX_RECORDS)throw Error('Batas catatan lokal tercapai; lakukan backup.');
 if(get(state,kind,item.id))throw Error('ID catatan sudah ada.');
 if((kind==='quotes'||kind==='invoices')&&state[kind].some(x=>x.number.toLowerCase()===item.number.toLowerCase()))throw Error('Nomor dokumen sudah digunakan pada perangkat ini.');
 if(kind==='invoices'){
  const quote=get(state,'quotes',item.quoteId);
  if(!quote||quote.status!=='accepted')throw Error('Invoice harus berasal dari penawaran yang sudah diterima.');
  if(state.invoices.some(x=>x.quoteId===item.quoteId))throw Error('Satu penawaran hanya boleh memiliki satu invoice aktif.');
  if(item.amount!==quote.price)throw Error('Nilai invoice harus sesuai penawaran; pajak belum dihitung.');
 }
 if(kind==='payments'){
  const remaining=balance(state,item.invoiceId).remaining;
  if(item.amount>remaining)throw Error('Pembayaran melebihi sisa tagihan.');
 }
 return {...state,[kind]:[...state[kind],item]};
}
function update(state,kind,recordId,changes){
 const existing=get(state,kind,recordId);
 if(!existing)throw Error('Catatan tidak ditemukan.');
 if(kind==='payments'||kind==='quotes'&&state.invoices.some(x=>x.quoteId===recordId)||kind==='invoices'&&state.payments.some(x=>x.invoiceId===recordId))throw Error('Catatan keuangan terkait tidak dapat diubah; buat revisi baru.');
 const item=normalize(kind,{...existing,...changes,id:recordId,createdAt:existing.createdAt});
 if(kind==='quotes'||kind==='invoices'){
  if(state[kind].some(x=>x.id!==recordId&&x.number.toLowerCase()===item.number.toLowerCase()))throw Error('Nomor dokumen sudah digunakan pada perangkat ini.');
 }
 if(kind==='invoices'){
  if(item.quoteId!==existing.quoteId)throw Error('Relasi invoice ke penawaran tidak dapat diubah.');
  const quote=get(state,'quotes',existing.quoteId);
  if(!quote||quote.status!=='accepted'||item.amount!==quote.price)throw Error('Nilai invoice harus tetap sesuai penawaran yang diterima.');
 }
 return {...state,[kind]:state[kind].map(x=>x.id===recordId?item:x)};
}
function remove(state,kind,recordId){
 if(!get(state,kind,recordId))throw Error('Catatan tidak ditemukan.');
 if(kind==='quotes'&&state.invoices.some(x=>x.quoteId===recordId))throw Error('Penawaran sudah dipakai invoice.');
 if(kind==='invoices'&&state.payments.some(x=>x.invoiceId===recordId))throw Error('Invoice sudah memiliki pembayaran.');
 return {...state,[kind]:state[kind].filter(x=>x.id!==recordId)};
}
function quoteFromHpp(state,hpp,engine,lead,opts){
 if(!engine||typeof engine.calc!=='function')throw Error('Kalkulator HPP tidak tersedia.');
 const result=engine.calc(hpp);
 if(!result.ready)throw Error('Harga material/HPP belum lengkap. Periksa kalkulator HPP dahulu.');
 if(!lead||!clean(lead.id))throw Error('Pilih lead penerima penawaran.');
 return add(state,'quotes',{
  id:id('quote'),leadId:lead.id,leadName:clean(lead.name||lead.brand),
  number:clean(opts.number),name:clean(opts.name||result.quote.name),hppId:result.quote.id,
  validUntil:opts.validUntil,status:'draft',price:result.price,baseHpp:result.baseHpp,
  extraTotal:result.extraTotal,markupPercent:result.markupPercent,qty:result.quote.outputQty,
  rows:result.rows.map(r=>({description:r.description,quantity:r.quantity,unit:r.unit,unitCost:r.unitCost,wastePercent:r.wastePercent,total:r.total})),
  extras:result.extras.map(r=>({description:r.description,total:r.total})),note:clean(opts.note||result.quote.notes,1500)
 });
}
function newInvoice(state,quoteId,number,issued,due,note){
 const quote=get(state,'quotes',quoteId);
 if(!quote)throw Error('Penawaran tidak ditemukan.');
 return add(state,'invoices',{quoteId,number,issued,due,amount:quote.price,note});
}
function projectProgress(state,projectId){
 const records=state.qc.filter(x=>x.projectId===projectId);
 const latest=new Map();
 records.forEach(x=>latest.set(x.stage,x));
 const done=STAGES.filter(stage=>latest.get(stage)?.status==='done').length;
 return {done,total:STAGES.length,percent:Math.round(done/STAGES.length*100),issues:[...latest.values()].filter(x=>x.status==='issue').length};
}
function campaignSummary(state){
 const groups=new Map(),leadGroups=new Map();
 for(const touch of state.attribution){
  const key=touch.channel+' / '+touch.campaign;
  if(!groups.has(key))groups.set(key,{key,channel:touch.channel,campaign:touch.campaign,leads:new Set(),quoteCount:0,acceptedCount:0,paidLinked:0});
  groups.get(key).leads.add(touch.leadId);
  if(!leadGroups.has(touch.leadId))leadGroups.set(touch.leadId,new Set());
  leadGroups.get(touch.leadId).add(key);
 }
 for(const quote of state.quotes){
  // Only a lead with ONE distinct manual campaign tag gets a financial link;
  // multi-touch leads remain unallocated to avoid double counting cash.
  const assigned=leadGroups.get(quote.leadId);
  if(!assigned||assigned.size!==1)continue;
  const group=groups.get([...assigned][0]);
  group.quoteCount++;
  if(quote.status==='accepted')group.acceptedCount++;
  const invoice=state.invoices.find(i=>i.quoteId===quote.id);
  if(invoice)group.paidLinked+=state.payments.filter(p=>p.invoiceId===invoice.id).reduce((sum,p)=>sum+p.amount,0);
 }
 // These are manually LINKED records, not evidence that the ad caused the sale.
 // Do not compute or label a ROAS without validated cost + attribution policy.
 return [...groups.values()].map(x=>({channel:x.channel,campaign:x.campaign,leadCount:x.leads.size,quoteCount:x.quoteCount,acceptedCount:x.acceptedCount,paidLinked:Math.round(x.paidLinked*100)/100})).sort((a,b)=>b.leadCount-a.leadCount);
}
function summary(state,now=today()){
 const open=state.followups.filter(x=>x.status==='planned');
 return {followupDue:open.filter(x=>x.due<=now).length,followupOpen:open.length,
  quotesDraft:state.quotes.filter(x=>x.status==='draft').length,quotesAccepted:state.quotes.filter(x=>x.status==='accepted').length,
  unpaid:state.invoices.filter(x=>balance(state,x.id).remaining>0).length,
  overdueInvoices:state.invoices.filter(x=>x.due<now&&balance(state,x.id).remaining>0).length,
  qcIssues:state.qc.filter(x=>x.status==='issue').length,campaigns:campaignSummary(state).length};
}
function mergeBackup(existing,incoming){
 const importState=load(incoming),current=load(existing),merged=empty(),report={};
 for(const kind of KINDS){
  const seen=new Set(current[kind].map(x=>x.id));
  const additions=importState[kind].filter(x=>!seen.has(x.id));
  if(current[kind].length+additions.length>MAX_RECORDS)throw Error('Backup terlalu besar untuk '+kind+'.');
  merged[kind]=[...current[kind],...additions];
  report[kind]={added:additions.length,skipped:importState[kind].length-additions.length};
 }
 // Preserve references even when imported arrays are not sorted in dependency order.
 for(const i of merged.invoices)if(!merged.quotes.some(q=>q.id===i.quoteId))throw Error('Backup memiliki invoice tanpa penawaran.');
 for(const p of merged.payments)if(!merged.invoices.some(i=>i.id===p.invoiceId))throw Error('Backup memiliki pembayaran tanpa invoice.');
 for(const inv of merged.invoices)if(balance(merged,inv.id).overpaid)throw Error('Backup membuat pembayaran melebihi invoice.');
 return {state:merged,report};
}
const API={KEY,VERSION,KINDS,STAGES,empty,load,normalize,add,update,remove,get,balance,quoteFromHpp,newInvoice,projectProgress,campaignSummary,summary,mergeBackup,today,id};
root.CSKOperations=API;
if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof window!=='undefined'?window:globalThis);
