/* CSK Business OS — local email marketing campaign studio.
 * Reads CRM Leads via callback. Drafts only: no API or automatic email send.
 */
(function(root){
'use strict';
var STORE='csk_email_marketing_local_v1';
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function mount(el,readLeads,engine){
 if(!el||typeof readLeads!=='function'||!engine||el.dataset.emInit==='1')return;
 el.dataset.emInit='1';
 var ledger={},draft={template:'intro',subject:engine.TEMPLATES.intro.subject,body:engine.TEMPLATES.intro.body};
 var filters={search:'',status:'',industry:'',permission:''},highlight='';
 try{
  var state=JSON.parse(localStorage.getItem(STORE)||'null');
  if(state&&typeof state==='object'){
   if(state.ledger&&typeof state.ledger==='object'&&!Array.isArray(state.ledger))ledger=state.ledger;
   if(state.draft&&typeof state.draft==='object'){
    draft.subject=String(state.draft.subject||draft.subject).slice(0,220);
    draft.body=String(state.draft.body||draft.body).slice(0,7000);
    draft.template=engine.TEMPLATES[state.draft.template]?state.draft.template:'custom';
   }
  }
 }catch(e){}
 var templates=Object.keys(engine.TEMPLATES).map(function(k){return '<option value="'+esc(k)+'">'+esc(engine.TEMPLATES[k].label)+'</option>'}).join('');
 var statuses=Object.keys(engine.STATUSES).map(function(k){return '<option value="'+esc(k)+'">'+esc(engine.STATUSES[k])+'</option>'}).join('');
 el.innerHTML=[
 '<div class="em-hero"><div><span class="em-eyebrow">CSK · B2B OUTREACH STUDIO</span><h2>Email Marketing dari Leads CRM</h2>',
 '<p>Gunakan nama perusahaan, PIC, alamat email, industri, sumber, dan status yang sudah ada di Leads.</p></div>',
 '<span class="em-pill">DRAFT ONLY · NO AUTO SEND</span></div>',
 '<div class="em-banner"><b>Mode aman.</b> Tidak ada email dikirim otomatis. Izin kontak harus diverifikasi satu per satu. ',
 'Permintaan berhenti menerima email wajib dicatat. Bukti izin, daftar blokir dan template pada tahap ini hanya tersimpan di browser, bukan di Google Sheets.</div>',
 '<div class="em-stats"><div><small>Baris Leads</small><strong id="em-total">0</strong></div>',
 '<div><small>Email valid & unik</small><strong id="em-valid">0</strong></div>',
 '<div><small>Izin tercatat (lokal)</small><strong id="em-eligible">0</strong></div>',
 '<div><small>Unsubscribe / blokir</small><strong id="em-blocked">0</strong></div></div>',
 '<div class="em-layout"><div class="em-card">',
 '<div class="em-heading"><div><h3>1. Segmentasi Penerima</h3><p>Diambil langsung dari kolom Leads CRM.</p></div><button type="button" class="em-secondary" id="em-refresh">Perbarui</button></div>',
 '<div class="em-filters">',
 '<label>Cari perusahaan, PIC, email<input type="search" id="em-search" placeholder="Cari kontak..."></label>',
 '<label>Status Lead<select id="em-status-filter"><option value="">Semua</option>'+statuses+'</select></label>',
 '<label>Industri<input type="search" id="em-industry" placeholder="Contoh: Retail"></label>',
 '<label>Izin<select id="em-permission-filter"><option value="">Semua</option>',
 '<option value="unknown">Belum diverifikasi</option><option value="consented">Izin tercatat</option><option value="unsubscribed">Diblokir</option></select></label>',
 '</div><p class="em-hint">Email tidak valid dan alamat duplikat dikecualikan. Keberadaan email di CRM tidak berarti izin promosi.</p>',
 '<div id="em-contact-list" class="em-contact-list"></div></div>',
 '<div class="em-card"><div class="em-heading"><div><h3>2. Kampanye & Template</h3>',
 '<p>Personalisasi: {{pic}}, {{brand}}, {{industry}}, {{source}}.</p></div></div>',
 '<label>Jenis pesan<select id="em-template">'+templates+'<option value="custom">Kustom</option></select></label>',
 '<label>Subjek<input id="em-subject" maxlength="220"></label>',
 '<label>Isi email<textarea id="em-body" rows="13" maxlength="7000"></textarea></label>',
 '<label>Pratinjau penerima<select id="em-recipient"><option value="">Pilih email berizin</option></select></label>',
 '<div class="em-preview"><small>PREVIEW DRAFT</small><strong id="em-preview-title">Pilih penerima</strong>',
 '<pre id="em-preview-body">Isi email akan muncul di sini.</pre></div>',
 '<div class="em-actions"><button type="button" class="em-primary" id="em-mailto">Buka Draft Email Individu</button>',
 '<button type="button" class="em-secondary" id="em-csv">Unduh CSV Segmen Berizin</button></div>',
 '<p class="em-hint">Draft dibuka di aplikasi email dan tetap memerlukan pemeriksaan serta klik Kirim secara manual. CSV hanya memuat penerima berizin.',
 'Tidak ada status terkirim/terbaca yang diklaim dari tindakan ini.</p></div></div>',
 '<p class="em-message" id="em-message" role="status" aria-live="polite"></p>'
 ].join('');
 function $(s){return el.querySelector(s)}
 function message(text,error){var n=$('#em-message');n.textContent=text;n.dataset.error=error?'true':'false'}
 function save(){
  try{localStorage.setItem(STORE,JSON.stringify({ledger:ledger,draft:draft}))}
  catch(e){message('Penyimpanan lokal diblokir. Bukti izin tidak akan bertahan setelah halaman ditutup.',true)}
 }
 function audience(){return engine.audience(readLeads(),ledger,filters)}
 function visible(){var x=audience().all;return filters.permission?x.filter(function(c){return c.permission===filters.permission}):x}
 function draw(){
  var data=audience(),people=visible();
  $('#em-total').textContent=data.summary.total;
  $('#em-valid').textContent=data.summary.total-data.summary.invalid-data.summary.duplicate;
  $('#em-eligible').textContent=data.summary.eligible;
  $('#em-blocked').textContent=data.summary.suppressed;
  $('#em-contact-list').innerHTML=people.length?people.map(function(c){
   var status=c.permission==='consented'?'Izin tercatat':c.permission==='unsubscribed'?'Unsubscribe / diblokir':'Izin belum diverifikasi';
   var action=c.permission==='consented'?'preview':'consent';
   return '<div class="em-contact" data-email="'+esc(c.email)+'"><div class="em-contact-main">'+
    '<strong>'+esc(c.brand||'(Brand belum diisi)')+'</strong><span>'+esc(c.email)+'</span>'+
    '<small>'+esc(c.pic||'PIC belum diisi')+' · '+esc(c.industry||'Industri kosong')+
    ' · '+esc(engine.STATUSES[c.status]||c.status||'Status kosong')+'</small>'+
    '<span class="em-permission" data-state="'+esc(c.permission)+'">'+esc(status)+'</span></div>'+
    '<div class="em-contact-buttons"><button type="button" data-action="'+action+'">'+(action==='preview'?'Pratinjau':'Catat izin')+'</button>'+
    '<button type="button" class="em-danger" data-action="block">Blokir</button></div></div>'
  }).join(''):'<p class="em-empty">Belum ada kontak dengan email valid sesuai filter.</p>';
  var previous=$('#em-recipient').value;
  var eligible=people.filter(function(c){return c.permission==='consented'});
  $('#em-recipient').innerHTML='<option value="">Pilih penerima berizin</option>'+eligible.map(function(c){
   return '<option value="'+esc(c.email)+'">'+esc(c.brand||c.email)+' · '+esc(c.email)+'</option>'
  }).join('');
  if(eligible.some(function(c){return c.email===previous}))$('#em-recipient').value=previous;
  if(highlight&&eligible.some(function(c){return c.email===highlight})){$('#em-recipient').value=highlight;highlight=''}
  preview();
 }
 function preview(){
  var person=visible().find(function(c){return c.permission==='consented'&&c.email===$('#em-recipient').value});
  $('#em-preview-title').textContent=person?engine.render($('#em-subject').value,person):'Pilih penerima berizin';
  $('#em-preview-body').textContent=person?engine.render($('#em-body').value,person):'Pratinjau pesan untuk satu penerima muncul di sini.';
  $('#em-mailto').disabled=!person;
  $('#em-csv').disabled=!visible().some(function(c){return c.permission==='consented'});
 }
 function changeFilters(){
  filters.search=$('#em-search').value;filters.status=$('#em-status-filter').value;
  filters.industry=$('#em-industry').value;filters.permission=$('#em-permission-filter').value;
  draw();
 }
 function changeDraft(){
  draft.subject=$('#em-subject').value;draft.body=$('#em-body').value;draft.template=$('#em-template').value;
  save();preview();
 }
 $('#em-template').value=draft.template;$('#em-subject').value=draft.subject;$('#em-body').value=draft.body;
 ['em-search','em-status-filter','em-industry','em-permission-filter'].forEach(function(id){
  $('#'+id).addEventListener('input',changeFilters);
 });
 $('#em-refresh').addEventListener('click',function(){draw();message('Daftar penerima diperbarui dari Leads CRM.')});
 $('#em-template').addEventListener('change',function(){
  var t=engine.TEMPLATES[$('#em-template').value];
  if(t){$('#em-subject').value=t.subject;$('#em-body').value=t.body}
  changeDraft();
 });
 $('#em-subject').addEventListener('input',function(){$('#em-template').value='custom';changeDraft()});
 $('#em-body').addEventListener('input',function(){$('#em-template').value='custom';changeDraft()});
 $('#em-recipient').addEventListener('change',preview);
 $('#em-contact-list').addEventListener('click',function(e){
  var btn=e.target.closest('button[data-action]');if(!btn)return;
  var container=btn.closest('[data-email]'),email=container&&container.dataset.email;if(!email)return;
  if(btn.dataset.action==='consent'){
   if(ledger[email]?.status==='unsubscribed')return message('Email diblokir. Minta izin baru sebelum membuka blokir.',true);
   var proof=prompt('Bukti persetujuan menerima email promosi untuk '+email+' (wajib benar-benar ada). Contoh: Form pameran 2026-11-01, checkbox marketing disetujui.');
   if(proof===null)return;
   try{ledger=engine.permission(ledger,email,'consented',proof);save();draw();message('Persetujuan dicatat lokal. Simpan bukti aslinya.') }
   catch(err){message(err.message,true)}
  }else if(btn.dataset.action==='block'){
   if(!confirm('Blokir '+email+' dari semua ekspor dan draft email marketing?'))return;
   ledger=engine.permission(ledger,email,'unsubscribed','Permintaan berhenti / blokir manual');
   save();draw();message('Email masuk daftar blokir lokal. Belum disinkronkan ke perangkat lain.');
  }else if(btn.dataset.action==='preview'){
   filters={search:email,status:'',industry:'',permission:''};
   $('#em-search').value=email;$('#em-status-filter').value='';
   $('#em-industry').value='';$('#em-permission-filter').value='';
   highlight=email;draw();
   $('#em-recipient').value=email;preview();
   $('#em-recipient').scrollIntoView({behavior:'smooth',block:'center'});
  }
 });
 $('#em-mailto').addEventListener('click',function(){
  var email=$('#em-recipient').value;
  var person=visible().find(function(c){return c.email===email&&c.permission==='consented'});
  if(!person)return message('Pilih email dengan bukti izin.',true);
  try{
   var mail=engine.compose(person,ledger,$('#em-subject').value,$('#em-body').value);
   if(!confirm('Buka aplikasi email untuk MENINJAU DRAFT 1 penerima: '+mail.to+'? Email tidak terkirim otomatis.'))return;
   root.location.href=engine.draftUrl(mail);
   message('Draft dibuka; pengiriman hanya terjadi jika Anda mengirim dari aplikasi email.');
  }catch(err){message(err.message,true)}
 });
 $('#em-csv').addEventListener('click',function(){
  var list=visible().filter(function(c){return c.permission==='consented'});
  if(!list.length)return message('Tidak ada kontak berizin pada segmen ini.',true);
  if(!confirm('Unduh CSV yang memuat '+list.length+' email berizin? File berisi data pribadi dan harus disimpan dengan aman.'))return;
  try{
   var csv=engine.csvExport(list,ledger,$('#em-subject').value,$('#em-body').value);
   var blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
   var url=URL.createObjectURL(blob),a=document.createElement('a');
   a.href=url;a.download='CSK_Email_Berizin_'+new Date().toISOString().slice(0,10)+'.csv';
   document.body.appendChild(a);a.click();a.remove();
   setTimeout(function(){URL.revokeObjectURL(url)},1000);
   message('CSV berhasil dibuat. Tidak ada email terkirim.');
  }catch(err){message(err.message,true)}
 });
 function focusLead(id){
  var lead=readLeads().find(function(x){return String(x.id)===String(id)});
  if(!lead||!engine.validEmail(lead.email))return message('Lead tersebut belum memiliki email valid.',true);
  var email=engine.normalEmail(lead.email);
  filters={search:email,status:'',industry:'',permission:''};
  $('#em-search').value=email;$('#em-status-filter').value='';
  $('#em-industry').value='';$('#em-permission-filter').value='';
  highlight=email;draw();message('Lead dipilih. Verifikasi bukti izin sebelum membuat email.');
 }
 draw();
 el._cskEmail={refresh:draw,focusLead:focusLead};
 return el._cskEmail;
}
var API={mount:mount,STORE:STORE};
root.CSKEmailUI=API;
if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof window!=='undefined'?window:globalThis);
