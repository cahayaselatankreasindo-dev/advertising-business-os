/* CSK Business OS — marketing audience, segmentation and personalisation.
 * DRAFT ONLY: this module NEVER sends email, accesses API or CRM storage.
 * Permission must be recorded by the owner for EACH email, never inferred.
 */
(function(root){
'use strict';
const STATUSES={new:'Lead Baru',contacted:'Dihubungi',nego:'Negosiasi',won:'Deal',lost:'Batal'};
const TEMPLATES={
 intro:{
  label:'Perkenalan Production Partner',
  subject:'Kolaborasi produksi kebutuhan branding {{brand}}',
  body:'Halo {{pic}},\n\nPerkenalkan, kami dari Cahaya Selatan Kreasindo (CSK), production partner untuk brand dan bisnis.\n\nKami membantu kebutuhan rak display, booth pameran, POSM, signage, display akrilik, dan produksi branding custom untuk perusahaan seperti {{brand}}.\n\nApakah saat ini tim Anda memiliki kebutuhan produksi atau sedang mencari mitra vendor?\n\nJika berkenan, saya dapat mengirimkan portofolio dan berdiskusi mengenai kebutuhan tim Anda.\n\nSalam,\nTim Cahaya Selatan Kreasindo\n\nJika tidak ingin menerima email terkait layanan CSK lagi, silakan balas dengan \"Berhenti\".'
 },
 followup:{
  label:'Follow-up Penawaran',
  subject:'Tindak lanjut kebutuhan produksi {{brand}}',
  body:'Halo {{pic}},\n\nSaya ingin menindaklanjuti diskusi seputar kebutuhan produksi {{brand}}.\n\nApakah ada spesifikasi, target jumlah, atau tenggat yang perlu kami bantu hitungkan?\n\nCSK siap membantu dari estimasi material, fabrikasi, sampai instalasi sesuai kebutuhan.\n\nSalam,\nTim Cahaya Selatan Kreasindo\n\nJika tidak ingin menerima email terkait layanan CSK lagi, silakan balas dengan \"Berhenti\".'
 },
 portfolio:{
  label:'Portofolio B2B',
  subject:'Referensi produksi display dan branding untuk {{brand}}',
  body:'Halo {{pic}},\n\nKami ingin berbagi informasi mengenai kapabilitas produksi CSK untuk kebutuhan display retail, POSM, booth event, signage, dan custom fabrication.\n\nJika ada brief atau desain yang sedang dikembangkan tim {{brand}}, kami bisa membantu mengkaji kebutuhan produksi dan estimasi biayanya.\n\nTerima kasih,\nTim Cahaya Selatan Kreasindo\n\nJika tidak ingin menerima email terkait layanan CSK lagi, silakan balas dengan \"Berhenti\".'
 }
};
const MAX=5000,MAX_BODY=7000;
function clean(v,max=160){return String(v??'').trim().slice(0,max)}
function normalEmail(v){return clean(v,254).toLowerCase()}
function validEmail(v){
 const s=clean(v,254);
 return s.length>=5&&s.length<=254&&!/[\s<>"',;]/.test(s)&&/^[a-z0-9.!#$%&'*+/=?^_\x60{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(s);
}
function safeRow(lead){
 const l=lead&&typeof lead==='object'?lead:{};
 return {
  id:clean(l.id,120),
  brand:clean(l.name??l.brand,160),
  email:normalEmail(l.email),
  pic:clean(l.pic,120),
  picTitle:clean(l.picTitle,100),
  industry:clean(l.industry,100),
  status:clean(l.status,30).toLowerCase(),
  source:clean(l.source,80)
 };
}
function audience(leads,ledger={},filters={}){
 const items=Array.isArray(leads)?leads.slice(0,MAX).map(safeRow):[];
 const seen=new Set(),summary={total:items.length,invalid:0,duplicate:0,suppressed:0,unverified:0,eligible:0};
 const all=[];
 const needle=clean(filters.search,100).toLowerCase(),
  status=clean(filters.status,30).toLowerCase(),industry=clean(filters.industry,80).toLowerCase();
 for(const lead of items){
  if(!validEmail(lead.email)){summary.invalid++;continue}
  if(seen.has(lead.email)){summary.duplicate++;continue}
  seen.add(lead.email);
  const record=ledger[lead.email]||{};
  const state=record.status==='consented'?'consented':record.status==='unsubscribed'?'unsubscribed':'unknown';
  if(state==='unsubscribed')summary.suppressed++;
  else if(state==='unknown')summary.unverified++;
  else summary.eligible++;
  if(status&&lead.status!==status)continue;
  if(industry&&!lead.industry.toLowerCase().includes(industry))continue;
  if(needle&&![lead.brand,lead.email,lead.pic,lead.industry,lead.source].some(x=>x.toLowerCase().includes(needle)))continue;
  all.push({...lead,permission:state,proof:clean(record.proof,500)});
 }
 return {all,eligible:all.filter(x=>x.permission==='consented'),summary};
}
function permission(ledger,email,status,proof){
 const key=normalEmail(email);
 if(!validEmail(key))throw Error('Alamat email tidak valid.');
 if(!['consented','unsubscribed','unknown'].includes(status))throw Error('Status izin tidak dikenal.');
 const next={...(ledger||{})};
 if(status==='unknown')delete next[key];
 else{
  const evidence=clean(proof,500);
  if(status==='consented'&&evidence.length<8)throw Error('Tuliskan bukti/sumber persetujuan minimal 8 karakter.');
  next[key]={status,proof:evidence,updatedAt:new Date().toISOString()};
 }
 return next;
}
function render(template,lead){
 const t=clean(template,MAX_BODY);
 const p=safeRow(lead);
 // Use text placeholders, not HTML or template evaluation.
 return t.replace(/\{\{\s*(pic|brand|industry|source|status|picTitle)\s*\}\}/g,(_,k)=>{
  const values={pic:p.pic||'Bapak/Ibu',brand:p.brand||'perusahaan Anda',
    industry:p.industry||'industri Anda',source:p.source||'perkenalan',
    status:STATUSES[p.status]||p.status,picTitle:p.picTitle||'tim'};
  return values[k]||'';
 });
}
function compose(lead,ledger,subject,body){
 const l=safeRow(lead);
 if(!validEmail(l.email))throw Error('Email lead tidak valid.');
 if((ledger?.[l.email]?.status)!=='consented')throw Error('Kontak belum memiliki bukti izin email marketing.');
 const renderedSubject=render(clean(subject,220),l).replace(/[\r\n]/g,' ').trim();
 const renderedBody=render(clean(body,MAX_BODY),l).trim();
 if(!renderedSubject||!renderedBody)throw Error('Subjek dan isi email harus diisi.');
 return {to:l.email,subject:renderedSubject,body:renderedBody};
}
function draftUrl(mail){
 if(!mail||!validEmail(mail.to))throw Error('Draft tidak valid.');
 return 'mailto:'+encodeURIComponent(mail.to).replace('%40','@')+'?subject='+encodeURIComponent(mail.subject)+'&body='+encodeURIComponent(mail.body);
}
function csvCell(v){
 let s=String(v??'').replace(/\r\n?/g,'\n');
 if(/^[\s]*[=+\-@]/.test(s))s="'"+s; // spreadsheet formula injection protection
 return '"'+s.replace(/"/g,'""')+'"';
}
function csvExport(contacts,ledger,subject,body){
 const lines=[['Email','Brand','PIC','Jabatan PIC','Industri','Status Lead','Sumber','Subject','Body'].map(csvCell).join(',')];
 for(const l of contacts||[]){
  const m=compose(l,ledger,subject,body);
  lines.push([l.email,l.brand,l.pic,l.picTitle,l.industry,l.status,l.source,m.subject,m.body].map(csvCell).join(','));
 }
 return '\uFEFF'+lines.join('\r\n');
}
const API={STATUSES,TEMPLATES,validEmail,normalEmail,safeRow,audience,permission,render,compose,draftUrl,csvExport};
root.CSKEmailMarketing=API;
if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof window!=='undefined'?window:globalThis);
