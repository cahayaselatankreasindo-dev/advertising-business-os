/* CSK Operations Suite — 6 editable local workflows; no network requests. */
(function(root){
'use strict';
const PANELS={followups:'Follow-up',quotes:'Penawaran & RAB',suppliers:'Supplier & Material',invoices:'Invoice & DP',qc:'QC Produksi',attribution:'Atribusi Marketing'};
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function rp(n){return 'Rp '+Number(n||0).toLocaleString('id-ID',{maximumFractionDigits:2})}
function opt(value,label){return '<option value="'+esc(value)+'">'+esc(label)+'</option>'}
function datePlus(days){const d=new Date();d.setDate(d.getDate()+days);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
function box(title,inner){return '<section class="ops-card"><h3>'+esc(title)+'</h3>'+inner+'</section>'}
function field(label,name,type='text',extra=''){return '<label>'+esc(label)+'<input name="'+esc(name)+'" type="'+esc(type)+'" '+extra+'></label>'}
function sel(label,name,options){return '<label>'+esc(label)+'<select name="'+esc(name)+'">'+options+'</select></label>'}
function area(label,name){return '<label>'+esc(label)+'<textarea name="'+esc(name)+'" rows="2" maxlength="1200"></textarea></label>'}
function submit(label){return '<button type="submit" class="ops-primary">'+esc(label)+'</button>'}
function empty(msg){return '<div class="ops-empty">'+esc(msg)+'</div>'}
function leadSelect(read){const leads=read().leads||[];return opt('','Pilih lead dari CRM')+leads.map(x=>opt(x.id,x.name+' · '+(x.pic||x.email||'PIC belum ada'))).join('')}
function projectSelect(read){return opt('','Pilih proyek dari CRM')+(read().projects||[]).map(x=>opt(x.id,x.name||x.projectName||'Proyek tanpa nama')).join('')}
function formValues(form){return Object.fromEntries(new FormData(form).entries())}
function mount(el,engine,read,hppEngine){
 if(!el||!engine||typeof read!=='function'||el.dataset.opsInit==='1')return;
 el.dataset.opsInit='1';
 let state,blocked=false,tab='followups',editingSupplier=null;
 try{const saved=localStorage.getItem(engine.KEY);state=engine.load(saved?JSON.parse(saved):null)}
 catch(error){blocked=true;state=engine.empty()}
 el.innerHTML='<div class="ops-hero"><div><span>CSK · BUSINESS OPERATIONS</span><h2>Alur Penjualan hingga Produksi</h2><p>Enam sistem operasional saling merujuk ID Leads, Projects, dan HPP. Semua data baru hanya disimpan di browser ini.</p></div><b>STAGING · LOKAL</b></div>'+
 '<div class="ops-notice"><strong>Belum sync ke Google Sheets.</strong> Jangan anggap catatan ini tersedia di perangkat lain. Selalu unduh backup, khususnya sebelum membersihkan browser. Pembayaran di sini tidak otomatis masuk jurnal Finance.</div>'+
 '<div id="ops-stats" class="ops-stats"></div><div class="ops-toolbar"><div id="ops-tabs" role="tablist" aria-label="Pilih sistem operasional"></div><div class="ops-tools"><button type="button" data-action="export">Unduh Backup</button><button type="button" data-action="import">Gabungkan Backup</button><input id="ops-import-file" type="file" accept="application/json,.json" hidden></div></div>'+
 '<div id="ops-error" role="status" aria-live="polite"></div><div id="ops-content"></div>';
 function $(q){return el.querySelector(q)}
 function message(text,error){const n=$('#ops-error');n.textContent=text;n.dataset.error=error?'true':'false'}
 if(blocked)message('Data Operations lama tidak terbaca/versinya berbeda. Penyimpanan dinonaktifkan untuk melindungi data lama. Unduh cadangan dari browser sebelum melanjutkan.',true);
 function persist(next){
  if(blocked)throw Error('Penyimpanan dinonaktifkan karena data lama tidak terbaca.');
  const normalized=engine.load(next);
  localStorage.setItem(engine.KEY,JSON.stringify(normalized));
  state=normalized;
 }
 function apply(fn,success){try{persist(fn());draw();message(success||'Data tersimpan di browser ini.')}catch(error){message(error.message||'Penyimpanan gagal.',true)}}
 function findLead(id){return (read().leads||[]).find(x=>String(x.id)===String(id))}
 function findProject(id){return (read().projects||[]).find(x=>String(x.id)===String(id))}
 function hppHistory(){
  try{const data=JSON.parse(localStorage.getItem('csk_hpp_local_quotes_v1')||'[]');return Array.isArray(data)?data.slice(0,50):[]}
  catch(error){return []}
 }
 function renderStats(){const s=engine.summary(state);$('#ops-stats').innerHTML=[
  ['Follow-up jatuh tempo',s.followupDue],['Draft penawaran',s.quotesDraft],['Invoice belum lunas',s.unpaid],['Isu QC tercatat',s.qcIssues]
 ].map(x=>'<div><small>'+esc(x[0])+'</small><strong>'+x[1]+'</strong></div>').join('')}
 function renderFollowups(){
  const form='<form data-form="followups" class="ops-form">'+sel('Lead CRM','leadId',leadSelect(read))+field('Jadwal berikutnya','due','date','required value="'+engine.today()+'"')+
    sel('Kanal','channel',opt('WhatsApp','WhatsApp')+opt('Email','Email')+opt('Telepon','Telepon')+opt('Meeting','Meeting'))+
    area('Tujuan / hasil pembicaraan','note')+submit('Simpan Follow-up')+'</form>';
  const list=[...state.followups].sort((a,b)=>a.due.localeCompare(b.due)).map(x=>{
   const overdue=x.status==='planned'&&x.due<=engine.today();
   return '<div class="ops-record"><div><strong>'+esc(x.leadName||x.leadId)+'</strong><small>'+esc(x.due)+' · '+esc(x.channel)+' · '+esc(x.status)+(overdue?' · JATUH TEMPO':'')+'</small><p>'+esc(x.note||'Belum ada catatan')+'</p></div><div class="ops-record-actions">'+
   (x.status==='planned'?'<button type="button" data-action="done" data-kind="followups" data-id="'+esc(x.id)+'">Selesai</button>':'')+
   '<button type="button" data-action="delete" data-kind="followups" data-id="'+esc(x.id)+'">Hapus</button></div></div>';
  }).join('');
  return box('Jadwalkan follow-up lead',form)+box('Daftar tindak lanjut',list||empty('Belum ada follow-up. Mulai dari lead CRM yang sudah ada.'));
 }
 function renderQuotes(){
  const hpps=hppHistory(),hopts=opt('','Pilih estimasi HPP tersimpan')+hpps.map(x=>opt(x.id,x.name||x.id)).join('');
  const form='<p class="ops-hint">Simpan dan lengkapi estimasi pada menu HPP terlebih dahulu. Sistem mengunci snapshot harga saat penawaran dibuat; revisi dibuat dengan penawaran baru.</p>'+
   '<form data-form="quotes" class="ops-form">'+sel('Lead penerima','leadId',leadSelect(read))+sel('Estimasi HPP','hppId',hopts)+
   field('Nomor penawaran','number','text','required maxlength="70" placeholder="CSK-Q-2026-001"')+
   field('Judul penawaran','name','text','required maxlength="150" placeholder="Rak Display Custom"')+
   field('Berlaku sampai','validUntil','date','required value="'+datePlus(14)+'"')+
   area('Ketentuan / catatan','note')+submit('Buat Penawaran dari HPP')+'</form>';
  const list=state.quotes.map(x=>'<div class="ops-record"><div><strong>'+esc(x.number)+' · '+esc(x.name)+'</strong><small>'+esc(x.leadName)+' · '+rp(x.price)+' · '+esc(x.status)+' · sampai '+esc(x.validUntil)+'</small><p>HPP dasar '+rp(x.baseHpp)+' · markup '+x.markupPercent+'% · belum PPN</p></div><div class="ops-record-actions">'+
   (x.status==='draft'?'<button type="button" data-action="quote-status" data-status="sent" data-id="'+esc(x.id)+'">Terkirim</button>':'')+
   (x.status==='sent'?'<button type="button" data-action="quote-status" data-status="accepted" data-id="'+esc(x.id)+'">Diterima</button>':'')+
   (x.status==='sent'?'<button type="button" data-action="quote-status" data-status="rejected" data-id="'+esc(x.id)+'">Ditolak</button>':'')+
   '<button type="button" data-action="print-quote" data-id="'+esc(x.id)+'">Unduh Penawaran</button><button type="button" data-action="export-rab" data-id="'+esc(x.id)+'">RAB Internal JSON</button><button type="button" data-action="delete" data-kind="quotes" data-id="'+esc(x.id)+'">Hapus</button></div></div>').join('');
  return box('Buat penawaran / RAB',form)+box('Riwayat penawaran',list||empty('Belum ada penawaran. Simpan HPP yang sudah lengkap dahulu.'));
 }
 function renderSuppliers(){
  const edit=editingSupplier?state.suppliers.find(x=>x.id===editingSupplier):null;
  const form='<form data-form="suppliers" class="ops-form">'+field('Nama supplier','name','text','required maxlength="160"')+
   field('Kategori','category','text','placeholder="PVC / Akrilik / Besi / Vendor Cetak"')+
   field('Bahan / jasa','material','text','required maxlength="180"')+field('Unit','unit','text','required placeholder="lembar / meter / batang"')+
   field('Harga/unit (Rp)','price','number','required min="0" step="0.01"')+field('Tanggal harga','updated','date','required value="'+engine.today()+'"')+
   field('Kontak (opsional)','contact','text','maxlength="150"')+area('Catatan harga','note')+
   submit(edit?'Perbarui Harga Supplier':'Simpan Harga Supplier')+'</form>';
  const list=state.suppliers.map(x=>'<div class="ops-record"><div><strong>'+esc(x.material)+'</strong><small>'+esc(x.name)+' · '+esc(x.category)+' · '+rp(x.price)+' / '+esc(x.unit)+' · '+esc(x.updated)+'</small><p>'+esc(x.contact||'')+' '+esc(x.note||'')+'</p></div><div class="ops-record-actions"><button type="button" data-action="supplier-edit" data-id="'+esc(x.id)+'">Edit</button><button type="button" data-action="delete" data-kind="suppliers" data-id="'+esc(x.id)+'">Hapus</button></div></div>').join('');
  return box(edit?'Edit supplier':'Tambah supplier / material',form)+box('Pricebook lokal',list||empty('Belum ada harga supplier. Masukkan harga yang sudah diverifikasi vendor.'));
 }
 function renderInvoices(){
  const accepted=state.quotes.filter(x=>x.status==='accepted'&&!state.invoices.some(i=>i.quoteId===x.id));
  const opts=opt('','Pilih penawaran diterima')+accepted.map(x=>opt(x.id,x.number+' · '+x.leadName+' · '+rp(x.price))).join('');
  const form='<p class="ops-hint">Invoice hanya berasal dari penawaran berstatus Diterima. PPN/pajak belum dihitung. Pembayaran harus benar-benar diterima sebelum dicatat.</p><form data-form="invoices" class="ops-form">'+
    sel('Penawaran diterima','quoteId',opts)+field('Nomor invoice','number','text','required placeholder="CSK-INV-2026-001"')+
    field('Tanggal invoice','issued','date','required value="'+engine.today()+'"')+field('Jatuh tempo','due','date','required value="'+datePlus(14)+'"')+
    area('Termin / catatan','note')+submit('Buat Invoice')+'</form>';
  const payOpts=opt('','Pilih invoice belum lunas')+state.invoices.filter(x=>engine.balance(state,x.id).remaining>0).map(x=>opt(x.id,x.number+' · sisa '+rp(engine.balance(state,x.id).remaining))).join('');
  const payment='<form data-form="payments" class="ops-form">'+sel('Invoice','invoiceId',payOpts)+field('Tanggal pembayaran aktual','date','date','required value="'+engine.today()+'"')+
    field('Nominal diterima (Rp)','amount','number','required min="0.01" step="0.01"')+sel('Metode','method',opt('Transfer','Transfer')+opt('Tunai','Tunai')+opt('Lainnya','Lainnya'))+
    field('Referensi pembayaran','reference','text','placeholder="Nomor bukti transfer"')+area('Catatan','note')+submit('Catat Pembayaran Aktual')+'</form>';
  const list=state.invoices.map(x=>{
   const b=engine.balance(state,x.id);const quote=state.quotes.find(q=>q.id===x.quoteId);
   return '<div class="ops-record"><div><strong>'+esc(x.number)+' · '+esc(quote?.leadName||'Klien')+'</strong><small>Nilai '+rp(x.amount)+' · diterima '+rp(b.paid)+' · sisa '+rp(b.remaining)+' · jatuh tempo '+esc(x.due)+'</small><p>'+esc(x.note||'Belum ada termin')+'</p></div><div class="ops-record-actions"><button type="button" data-action="print-invoice" data-id="'+esc(x.id)+'">Unduh Invoice</button><button type="button" data-action="delete" data-kind="invoices" data-id="'+esc(x.id)+'">Hapus</button></div></div>';
  }).join('');
  return box('Invoice dari penawaran disetujui',form)+box('Catat DP / pelunasan yang benar-benar diterima',payment)+box('Tagihan dan saldo',list||empty('Belum ada invoice. Ubah penawaran menjadi Diterima terlebih dahulu.'));
 }
 function renderQC(){
  const stages=engine.STAGES.map(x=>opt(x,x)).join('');
  const form='<form data-form="qc" class="ops-form">'+sel('Proyek dari CRM','projectId',projectSelect(read))+sel('Tahap produksi','stage',stages)+
   sel('Hasil','status',opt('pending','Belum selesai')+opt('done','Selesai / lulus QC')+opt('issue','Ada kendala / revisi'))+
   field('Tanggal pemeriksaan','date','date','required value="'+engine.today()+'"')+area('Catatan QC / bukti pekerjaan','note')+submit('Catat Progres / QC')+'</form>';
  const projects=(read().projects||[]).map(p=>{const x=engine.projectProgress(state,p.id);return '<div class="ops-progress"><strong>'+esc(p.name||p.projectName||p.id)+'</strong><span>'+x.done+'/'+x.total+' tahap · '+x.percent+'% · '+x.issues+' kendala</span><div class="ops-bar"><i style="width:'+x.percent+'%"></i></div></div>'}).join('');
  const list=[...state.qc].reverse().map(x=>'<div class="ops-record"><div><strong>'+esc(x.projectName)+' · '+esc(x.stage)+'</strong><small>'+esc(x.status)+' · '+esc(x.date)+'</small><p>'+esc(x.note||'Tanpa catatan')+'</p></div><button type="button" data-action="delete" data-kind="qc" data-id="'+esc(x.id)+'">Hapus</button></div>').join('');
  return box('Catat tahap & QC proyek',form)+box('Progress proyek',projects||empty('Belum ada proyek pada CRM.'))+box('Log QC',list||empty('Belum ada catatan tahapan produksi.'));
 }
 function renderAttribution(){
  const channels=['Meta Ads','Google Ads','Website Organik','WhatsApp','Referral','Event','Lainnya'].map(x=>opt(x,x)).join('');
  const form='<p class="ops-hint">Hubungkan satu lead dengan kanal dan nama kampanye berdasarkan bukti yang diperiksa. Ini bukan tracking otomatis, tidak mengklaim ROAS, dan tidak mengubah data iklan asli.</p><form data-form="attribution" class="ops-form">'+
   sel('Lead CRM','leadId',leadSelect(read))+sel('Kanal','channel',channels)+field('Nama campaign / UTM','campaign','text','required maxlength="140"')+
   field('Tanggal bukti','date','date','required value="'+engine.today()+'"')+area('Bukti sumber: UTM, chat, form, dll.','evidence')+submit('Simpan Atribusi Manual')+'</form>';
  const groups=engine.campaignSummary(state).map(x=>'<div class="ops-record"><div><strong>'+esc(x.campaign)+'</strong><small>'+esc(x.channel)+' · '+x.leadCount+' lead unik · '+x.quoteCount+' penawaran · '+x.acceptedCount+' diterima</small><p>Kas tertaut secara manual: '+rp(x.paidLinked)+' (bukan ROAS dan bukan bukti kausal)</p></div></div>').join('');
  const list=state.attribution.map(x=>'<div class="ops-record"><div><strong>'+esc(x.leadName)+' → '+esc(x.campaign)+'</strong><small>'+esc(x.channel)+' · '+esc(x.date)+'</small><p>'+esc(x.evidence||'Bukti belum dicatat')+'</p></div><button type="button" data-action="delete" data-kind="attribution" data-id="'+esc(x.id)+'">Hapus</button></div>').join('');
  return box('Tag sumber lead berdasarkan bukti',form)+box('Rekap kampanye (manual)',groups||empty('Belum ada lead yang ditautkan ke campaign.'))+box('Log atribusi',list||empty('Belum ada atribusi manual.'));
 }
 const renderers={followups:renderFollowups,quotes:renderQuotes,suppliers:renderSuppliers,invoices:renderInvoices,qc:renderQC,attribution:renderAttribution};
 function draw(){
  renderStats();
  $('#ops-tabs').innerHTML=Object.keys(PANELS).map(k=>'<button type="button" role="tab" aria-selected="'+(tab===k)+'" class="'+(tab===k?'active':'')+'" data-tab="'+esc(k)+'">'+esc(PANELS[k])+'</button>').join('');
  $('#ops-content').innerHTML=renderers[tab]();
  if(tab==='suppliers'&&editingSupplier){
   const x=state.suppliers.find(item=>item.id===editingSupplier);
   if(x){const form=$('[data-form="suppliers"]');for(const name of ['name','category','material','unit','price','updated','contact','note'])form.elements[name].value=x[name]??''}
  }
 }
 function saveFile(filename,content,mime){
  const blob=new Blob([content],{type:mime||'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
 }
 function printable(kind,id){
  const item=engine.get(state,kind,id);if(!item)return;
  let content='';
  if(kind==='quotes'){
   content='<h1>PENAWARAN PRODUKSI</h1><p>No. '+esc(item.number)+' · Berlaku sampai '+esc(item.validUntil)+'</p><p>Kepada: '+esc(item.leadName)+'</p><h2>'+esc(item.name)+'</h2>'+
    '<table><thead><tr><th>Uraian pekerjaan</th><th>Jumlah</th><th>Unit</th></tr></thead><tbody>'+item.rows.map(x=>'<tr><td>'+esc(x.description)+'</td><td>'+x.quantity+'</td><td>'+esc(x.unit)+'</td></tr>').join('')+'</tbody></table>'+
    '<p><b>Nilai penawaran: '+rp(item.price)+'</b></p><p>Belum termasuk pajak/PPN. '+esc(item.note)+'</p>';
  }else{
   const q=state.quotes.find(x=>x.id===item.quoteId),b=engine.balance(state,item.id);
   content='<h1>INVOICE</h1><p>No. '+esc(item.number)+' · Terbit '+esc(item.issued)+' · Jatuh tempo '+esc(item.due)+'</p><p>Kepada: '+esc(q?.leadName||'Pelanggan')+'</p><h2>'+esc(q?.name||'Pekerjaan Produksi')+'</h2><p><b>Total tagihan: '+rp(item.amount)+'</b></p><p>Pembayaran dicatat: '+rp(b.paid)+' · Sisa: '+rp(b.remaining)+'</p><p>Catatan: '+esc(item.note)+'</p><p>Belum termasuk perhitungan pajak/PPN.</p>';
  }
  const html='<!doctype html><html lang="id"><meta charset="utf-8"><title>CSK · '+esc(item.number)+'</title><style>body{font-family:Arial,sans-serif;color:#111;max-width:820px;margin:45px auto;padding:0 20px}header{background:#0B0B0B;color:#fff;padding:23px;border-left:7px solid #FF8A3D}header strong{letter-spacing:.05em}main{margin-top:35px}table{border-collapse:collapse;width:100%;margin:18px 0}th,td{padding:10px;text-align:left;border:1px solid #ddd;font-size:12px}th{background:#f8f7f4}footer{margin-top:50px;border-top:1px solid #ddd;padding-top:15px;color:#666;font-size:11px}@media print{body{margin:0;padding:0}}</style><header><strong>CAHAYA SELATAN KREASINDO</strong><p>Production Partner untuk Brand dan Bisnis</p></header><main>'+content+'</main><footer>Draft dokumen lokal · Periksa angka, pajak, identitas pihak, dan syarat pembayaran sebelum dikirim. Buka file ini lalu gunakan Print → Save as PDF.</footer></html>';
  saveFile('CSK-'+item.number.replace(/[^a-z0-9-]/gi,'-')+'.html',html,'text/html;charset=utf-8');
  message('Dokumen HTML diunduh. Buka lalu pilih Cetak → Simpan sebagai PDF. Periksa isinya sebelum dikirim.');
 }
 el.addEventListener('click',e=>{
  const btn=e.target.closest('button');if(!btn||!el.contains(btn))return;
  if(btn.dataset.tab){tab=btn.dataset.tab;editingSupplier=null;draw();return}
  const act=btn.dataset.action,id=btn.dataset.id;
  if(!act)return;
  if(act==='export'){
   saveFile('CSK-Operations-Backup-'+engine.today()+'.json',JSON.stringify({source:'CSK Operations Local',exportedAt:new Date().toISOString(),data:state},null,2));
   message('Backup dibuat di perangkat. Simpan di lokasi pribadi; berisi data bisnis.');return;
  }
  if(act==='import'){$('#ops-import-file').click();return}
  if(act==='done')return apply(()=>engine.update(state,'followups',id,{status:'done'}),'Follow-up ditandai selesai.');
  if(act==='delete'){
   const kind=btn.dataset.kind;
   if(!confirm('Hapus satu catatan '+kind+' dari perangkat ini? Data lokal tidak otomatis dapat dipulihkan.'))return;
   return apply(()=>engine.remove(state,kind,id),'Catatan dihapus dari perangkat.');
  }
  if(act==='supplier-edit'){editingSupplier=id;tab='suppliers';draw();return}
  if(act==='quote-status'){
   const value=btn.dataset.status;
   if(!confirm('Ubah status penawaran menjadi '+value+'? Pastikan telah sesuai komunikasi dengan klien.'))return;
   return apply(()=>engine.update(state,'quotes',id,{status:value}),'Status penawaran diperbarui.');
  }
  if(act==='print-quote')return printable('quotes',id);
  if(act==='export-rab'){
   const quote=engine.get(state,'quotes',id);if(!quote)return;
   saveFile('CSK-RAB-INTERNAL-'+quote.number.replace(/[^a-z0-9-]/gi,'-')+'.json',JSON.stringify({warning:'RAHASIA INTERNAL CSK - jangan dikirim ke pelanggan',quote},null,2));
   return message('RAB biaya internal diunduh. Jangan lampirkan pada penawaran pelanggan.');
  }
  if(act==='print-invoice')return printable('invoices',id);
 });
 el.addEventListener('submit',e=>{
  const form=e.target.closest('form[data-form]');if(!form)return;
  e.preventDefault();const kind=form.dataset.form,data=formValues(form);
  if(kind==='followups'||kind==='attribution'){
   const lead=findLead(data.leadId);if(!lead)return message('Lead tidak tersedia pada CRM.',true);
   data.leadName=lead.name||lead.brand||lead.id;
  }
  if(kind==='qc'){
   const project=findProject(data.projectId);if(!project)return message('Proyek tidak tersedia di CRM.',true);
   data.projectName=project.name||project.projectName||project.id;
  }
  if(kind==='quotes'){
   const lead=findLead(data.leadId),hpp=hppHistory().find(x=>x.id===data.hppId);
   if(!lead||!hpp)return message('Lead atau HPP tersimpan tidak ditemukan.',true);
   return apply(()=>engine.quoteFromHpp(state,hpp,hppEngine,lead,data),'Penawaran dibuat dari snapshot HPP. Belum dikirim.');
  }
  if(kind==='invoices')return apply(()=>engine.newInvoice(state,data.quoteId,data.number,data.issued,data.due,data.note),'Invoice dicatat lokal; belum masuk Finance.');
  if(kind==='suppliers'&&editingSupplier){
   const target=editingSupplier;
   return apply(()=>{const next=engine.update(state,'suppliers',target,data);editingSupplier=null;return next},'Harga supplier diperbarui.');
  }
  return apply(()=>engine.add(state,kind,data),'Catatan '+(PANELS[kind]||kind)+' tersimpan lokal.');
 });
 $('#ops-import-file').addEventListener('change',async e=>{
  const file=e.target.files?.[0];e.target.value='';if(!file)return;
  if(file.size>3*1024*1024)return message('Backup terlalu besar (maksimal 3 MB).',true);
  try{
   const parsed=JSON.parse(await file.text()),incoming=parsed.data||parsed;
   const merged=engine.mergeBackup(state,incoming);
   const count=Object.values(merged.report).reduce((a,x)=>a+x.added,0);
   if(!confirm('Gabungkan '+count+' catatan baru? ID yang sudah ada tetap dipertahankan. Buat backup saat ini terlebih dahulu bila perlu.'))return;
   persist(merged.state);draw();message('Backup digabung: '+count+' catatan baru. Tidak ada data cloud yang diubah.');
  }catch(error){message('Backup ditolak: '+error.message,true)}
 });
 draw();
 return {refresh:draw,exportState:()=>state};
}
const API={mount,esc,rp};
root.CSKOperationsUI=API;
if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof window!=='undefined'?window:globalThis);
