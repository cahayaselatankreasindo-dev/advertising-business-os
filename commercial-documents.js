/* CSK Commercial Document Center: independent quotations and invoices. */
(function(w){
'use strict';
function n(v){v=Number(v);return Number.isFinite(v)?v:0;}
function calculateCommercialTotals(lines,discount,taxRate){var s=(Array.isArray(lines)?lines:[]).reduce(function(a,x){return a+Math.max(0,n(x.qty))*Math.max(0,n(x.unitPrice));},0),d=Math.min(s,Math.max(0,n(discount))),r=Math.min(100,Math.max(0,n(taxRate))),tax=Math.round((s-d)*r/100);return{subtotal:Math.round(s),discount:Math.round(d),taxRate:r,taxAmount:tax,total:Math.round(s-d+tax)};}
function localDate(d){d=d instanceof Date?d:new Date(d||Date.now());return[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}
function nextDocumentNumber(k,rows,date){var p=k==='quotation'?'QUO':'INV',y=(date||localDate()).slice(0,4),re=new RegExp('^'+p+'-CSK-'+y+'-(\\d+)$'),m=0;(rows||[]).forEach(function(x){var z=re.exec(String(x.docNo||''));if(z)m=Math.max(m,Number(z[1])||0);});return p+'-CSK-'+y+'-'+String(m+1).padStart(5,'0');}
function findExistingProjectForDocument(projects,d,sourceQ,sourceI){
 var leadToken=d&&d.leadId?'[LEAD-'+String(d.leadId)+']':'';
 return(projects||[]).find(function(p){
  return(sourceI&&String(p.sourceInvoiceId||'')===String(sourceI))||
   (sourceQ&&String(p.sourceQuotationId||'')===String(sourceQ))||
   (d&&d.projectId&&String(p.id)===String(d.projectId))||
   (leadToken&&String(p.notes||'').indexOf(leadToken)!==-1);
 })||null;
}
function syncProjectCommercialFields(project,sourceDoc){
 if(!project||!sourceDoc)return false;
 var projectName=String(sourceDoc.projectName||'').trim();
 var clientName=String(sourceDoc.client||'').trim();
 if(projectName)project.title=projectName;
 else if(!project.title&&clientName)project.title='Pekerjaan '+clientName;
 if(clientName)project.client=clientName;
 var total=n(sourceDoc.total);
 project.value=total;
 project.suggestedPrice=total;
 if(sourceDoc.projectDeadline)project.deadline=String(sourceDoc.projectDeadline);
 return true;
}
function summarizeInvoicePayments(invoice,payments){
 var total=Math.max(0,Math.round(n(invoice&&invoice.total)));
 var rows=(payments||[]).filter(function(p){return String(p.invoiceId)===String(invoice&&invoice.id);});
 var paid=rows.reduce(function(sum,p){return sum+Math.max(0,Math.round(n(p.amount)));},0);
 var balance=Math.max(0,total-paid);
 return{total:total,paid:paid,balance:balance,count:rows.length,status:total>0&&paid>=total?'paid':paid>0?'partial':'unpaid'};
}
if(typeof module!=='undefined'&&module.exports)module.exports={calculateCommercialTotals:calculateCommercialTotals,nextDocumentNumber:nextDocumentNumber,localDate:localDate,findExistingProjectForDocument:findExistingProjectForDocument,summarizeInvoicePayments:summarizeInvoicePayments};
if(!w||!w.document)return;
var doc=null,kind='quotation',paymentDraftId='',currentPaymentInvoiceId='',pendingPaymentDrafts=Object.create(null),labels={draft:'Draft',sent:'Dikirim',approved:'Disetujui',rejected:'Ditolak',partial:'Dibayar sebagian',paid:'Lunas',unpaid:'Belum dibayar',cancelled:'Dibatalkan'};
function el(id){return w.document.getElementById(id);}
function say(s,e){if(w.showToast)w.showToast(s,!!e);}
function esc(v){return typeof escapeInvoiceHtml==='function'?escapeInvoiceHtml(v):String(v==null?'':v).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];});}
function rp(v){return typeof formatRp==='function'?formatRp(n(v)):'Rp '+Math.round(n(v)).toLocaleString('id-ID');}
function arr(k){if(k==='quotation'){db.quotations=Array.isArray(db.quotations)?db.quotations:[];return db.quotations;}db.invoices=Array.isArray(db.invoices)?db.invoices:[];return db.invoices;}
function all(){return arr('quotation').map(function(x){return Object.assign({kind:'quotation'},x);}).concat(arr('invoice').map(function(x){return Object.assign({kind:'invoice'},x);}));}
function newid(k){return(k==='quotation'?'QUO':'INV')+'-'+Date.now()+'-'+Math.random().toString(36).slice(2,7).toUpperCase();}
function plus(d,k){var x=new Date((d||localDate())+'T12:00:00');x.setDate(x.getDate()+k);return localDate(x);}
function getProject(id){return(db.projects||[]).find(function(x){return String(x.id)===String(id);})||null;}
function getLead(id){return(db.leads||[]).find(function(x){return String(x.id)===String(id);})||null;}
function defaultDoc(k,pid){var p=pid?getProject(pid):null,t=localDate(),l=p?(db.leads||[]).find(function(x){return String(x.name||'').toLowerCase()===String(p.client||'').toLowerCase();}):null,c=(db.clients||[]).find(function(x){return String(x.name||'').toLowerCase()===String(p&&p.client||'').toLowerCase();}),v=p?n(p.value):0;return{id:newid(k),projectId:p?String(p.id):'',leadId:l?String(l.id):'',quotationId:'',sourceQuotationId:'',sourceInvoiceId:'',docNo:nextDocumentNumber(k,arr(k),t),projectName:p?p.title||'':'',client:p?p.client||'':'',clientPhone:c?c.phone||'':(l?l.phone||'':''),clientEmail:l?l.email||'':'',clientAddress:c?c.address||'':'',contactPerson:l?l.pic||'':'',date:t,dueDate:plus(t,k==='quotation'?14:7),projectDeadline:p&&p.deadline?String(p.deadline).slice(0,10):'',lines:p?[{id:'L-'+Date.now(),name:p.title||'Pekerjaan',description:'',qty:1,unit:'Lot',unitPrice:v}]:[],subtotal:v,discount:0,taxRate:0,taxAmount:0,total:v,dpPercent:50,terms:'Harga dan ruang lingkup mengikuti rincian dokumen ini. Perubahan di luar rincian dikonfirmasi dan dihitung terpisah.',paymentTerms:k==='invoice'?'Pembayaran mengikuti nilai tagihan dan jatuh tempo.':'Penawaran berlaku 14 hari. Pekerjaan dimulai setelah persetujuan tertulis dan pembayaran uang muka sesuai kesepakatan.',notes:'',status:'draft',convertedInvoiceId:'',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};}
function ensure(){
 if(el('commercial-document-modal'))return;
 var st=w.document.createElement('style');st.textContent='#commercial-document-modal{position:fixed;inset:0;z-index:100050;background:#0f172acc;display:flex;align-items:center;justify-content:center;padding:12px}#commercial-document-modal.hidden{display:none}#commercial-document-modal .cd-shell{width:100%;max-width:1400px;max-height:96vh;overflow:hidden;background:#f8fafc;border-radius:16px;display:flex;flex-direction:column}#commercial-document-modal .cd-body{display:grid;grid-template-columns:1fr 1fr;overflow:auto;min-height:0}#commercial-document-modal .cd-field{display:block;font-size:11px;font-weight:700;color:#475569}#commercial-document-modal .cd-input{display:block;width:100%;margin-top:5px;padding:9px;border:1px solid #cbd5e1;border-radius:8px;background:white;font-size:12px}#commercial-document-modal .cd-btn{padding:8px 11px;border-radius:8px;font-size:11px;font-weight:700;min-height:36px}#commercial-document-modal .cd-line{background:white;border:1px solid #e2e8f0;border-radius:10px;padding:10px;margin-top:8px}#commercial-printable{background:white;color:#0f172a;max-width:780px;margin:auto;padding:30px;border:1px solid #e2e8f0;font:11px Arial,sans-serif}#commercial-printable table{width:100%;border-collapse:collapse}#commercial-printable th{background:#0f172a;color:white;padding:9px;text-align:left}#commercial-printable td{padding:8px;border-bottom:1px solid #e2e8f0;vertical-align:top}@media(max-width:900px){#commercial-document-modal .cd-body{grid-template-columns:1fr}#commercial-document-modal .cd-preview-pane{border-left:0!important;border-top:1px solid #e2e8f0}}@media print{body *{visibility:hidden!important}#commercial-printable,#commercial-printable *{visibility:visible!important}#commercial-printable{position:absolute!important;left:0!important;top:0!important;width:100%!important;max-width:none!important;border:0!important;padding:12mm!important}#invoice-printable,#invoice-printable *{visibility:hidden!important}#commercial-document-modal{position:static!important;display:block!important;background:white!important;padding:0!important}#commercial-document-modal .cd-shell{display:block!important;max-height:none!important;max-width:none!important;overflow:visible!important}#commercial-document-modal .cd-header,#commercial-document-modal .cd-form-pane,#commercial-document-modal .cd-preview-actions{display:none!important}#commercial-document-modal .cd-body{display:block!important;overflow:visible!important}#commercial-document-modal .cd-preview-pane{padding:0!important;border:0!important}}';
 w.document.head.appendChild(st);
 var m=w.document.createElement('div');m.id='commercial-document-modal';m.className='hidden';
 m.innerHTML='<div class="cd-shell"><header class="cd-header bg-slate-900 text-white p-4 flex justify-between items-center"><div><b id="cd-title">Commercial Document</b><div class="text-[10px] text-slate-300">Dokumen mandiri · Google Sheets</div></div><div class="flex gap-2"><button class="cd-btn bg-amber-500" data-action="save">Simpan</button><button class="cd-btn bg-slate-700 text-white" data-action="close">Tutup</button></div></header><div class="cd-body"><section class="cd-form-pane p-4 space-y-3 overflow-y-auto"><div class="grid grid-cols-1 sm:grid-cols-2 gap-3"><label class="cd-field sm:col-span-2">Ambil data Lead (opsional)<select id="cd-lead" class="cd-input"></select></label><label class="cd-field">Nama pelanggan / perusahaan<input id="cd-client" data-field="client" class="cd-input"></label><label class="cd-field">WhatsApp / telepon<input id="cd-phone" data-field="clientPhone" class="cd-input"></label><label class="cd-field">Email pelanggan<input id="cd-email" data-field="clientEmail" class="cd-input"></label><label class="cd-field">PIC pelanggan<input id="cd-contact" data-field="contactPerson" class="cd-input"></label><label class="cd-field sm:col-span-2">Alamat penagihan<textarea id="cd-address" data-field="clientAddress" rows="2" class="cd-input"></textarea></label><label class="cd-field sm:col-span-2">Nama pekerjaan / proyek<input id="cd-project" data-field="projectName" class="cd-input"></label><label class="cd-field">Nomor dokumen<input id="cd-number" data-field="docNo" class="cd-input"></label><label class="cd-field">Status<select id="cd-status" data-field="status" class="cd-input"></select></label><label class="cd-field">Tanggal<input id="cd-date" data-field="date" type="date" class="cd-input"></label><label class="cd-field">Jatuh tempo / berlaku<input id="cd-due" data-field="dueDate" type="date" class="cd-input"></label><label class="cd-field">Deadline proyek (opsional)<input id="cd-project-deadline" data-field="projectDeadline" type="date" class="cd-input"></label></div><div class="border-t pt-3"><div class="flex justify-between"><b class="text-sm">Rincian item</b><button class="cd-btn border bg-white" data-action="manual">+ Item manual</button></div><div class="grid grid-cols-[1fr_auto] gap-2 mt-2"><select id="cd-master" class="cd-input mt-0"></select><button class="cd-btn bg-slate-800 text-white" data-action="master">Tambah master</button></div><div id="cd-lines"></div></div><div class="grid grid-cols-3 gap-2 border-t pt-3"><label class="cd-field">Diskon Rp<input id="cd-discount" data-field="discount" type="number" min="0" class="cd-input"></label><label class="cd-field">Pajak %<input id="cd-tax" data-field="taxRate" type="number" min="0" max="100" step=".01" class="cd-input"></label><label class="cd-field">DP %<input id="cd-dp" data-field="dpPercent" type="number" min="1" max="99" class="cd-input"></label></div><div id="cd-totals" class="bg-slate-900 text-white rounded-xl p-3 text-xs"></div><label class="cd-field">Ketentuan pembayaran<textarea id="cd-payment" data-field="paymentTerms" rows="2" class="cd-input"></textarea></label><label class="cd-field">Syarat dan ketentuan<textarea id="cd-terms" data-field="terms" rows="3" class="cd-input"></textarea></label><label class="cd-field">Catatan<textarea id="cd-notes" data-field="notes" rows="2" class="cd-input"></textarea></label><div class="flex flex-wrap gap-2"><button class="cd-btn bg-amber-500" data-action="save">Simpan</button><button class="cd-btn border bg-white" data-action="print">Cetak / PDF</button><button class="cd-btn bg-emerald-600 text-white" data-action="wa">Salin WhatsApp</button></div></section><section class="cd-preview-pane p-4 bg-slate-100 border-l overflow-y-auto"><div class="cd-preview-actions mb-3 font-bold text-sm">Pratinjau dokumen</div><div id="commercial-printable"></div></section></div></div>';
 m.addEventListener('click',function(e){var b=e.target.closest('[data-action]');if(!b)return;var a=b.dataset.action;if(a==='close')closeCommercialDocumentEditor();if(a==='save')saveCommercialDocument();if(a==='print')printCommercialDocument();if(a==='wa')copyCommercialDocumentWA();if(a==='manual')addCommercialManualLine();if(a==='master')addCommercialMasterItem();});
 m.addEventListener('change',function(e){var t=e.target;if(t.id==='cd-lead'){selectCommercialLead(t.value);return;}if(t.dataset.field){updateCommercialField(t.dataset.field,t.value);return;}if(t.dataset.lineIndex!==undefined){updateCommercialLine(Number(t.dataset.lineIndex),t.dataset.lineField,t.value);}});
 m.addEventListener('click',function(e){var b=e.target.closest('[data-remove-line]');if(b)removeCommercialLine(Number(b.dataset.removeLine));});
 w.document.body.appendChild(m);
}
function ensurePaymentModal(){
 if(el('commercial-payment-modal'))return;
 var st=w.document.createElement('style');
 st.textContent='#commercial-payment-modal{position:fixed;inset:0;z-index:100060;background:#0f172acc;display:flex;align-items:center;justify-content:center;padding:12px}#commercial-payment-modal.hidden{display:none}#commercial-payment-modal .cp-shell{width:100%;max-width:620px;max-height:94vh;overflow:auto;background:#fff;border-radius:16px;padding:18px}#commercial-payment-modal .cp-field{display:block;font-size:11px;font-weight:700;color:#475569}#commercial-payment-modal .cp-input{display:block;width:100%;margin-top:5px;padding:9px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;font-size:12px}';
 w.document.head.appendChild(st);
 var m=w.document.createElement('div');m.id='commercial-payment-modal';m.className='hidden';
 m.innerHTML='<div class="cp-shell"><div class="flex items-center justify-between gap-3 mb-3"><div><b class="text-base">Catat Pembayaran Invoice</b><div id="cp-invoice-title" class="text-xs text-slate-500 mt-1"></div></div><button type="button" class="px-3 py-2 rounded-lg bg-slate-100" data-payment-action="close">Tutup</button></div><div id="cp-summary" class="grid grid-cols-3 gap-2 text-xs mb-3"></div><div class="border rounded-xl p-3 mb-4"><b class="text-xs">Riwayat pembayaran</b><div id="cp-history" class="mt-2 space-y-2"></div></div><div class="grid grid-cols-1 sm:grid-cols-2 gap-3"><label class="cp-field">Tanggal pembayaran<input id="cp-date" type="date" class="cp-input"></label><label class="cp-field">Jenis pembayaran<select id="cp-type" class="cp-input"><option value="dp">DP</option><option value="installment">Cicilan</option><option value="settlement">Pelunasan</option></select></label><label class="cp-field">Nominal diterima (Rp)<input id="cp-amount" type="number" min="1" step="1" class="cp-input"></label><label class="cp-field">Metode<select id="cp-method" class="cp-input"><option value="transfer">Transfer bank</option><option value="cash">Tunai</option><option value="qris">QRIS</option><option value="ewallet">E-wallet</option><option value="other">Lainnya</option></select></label><label class="cp-field sm:col-span-2">Nomor referensi / bukti transfer<input id="cp-reference" maxlength="120" class="cp-input" placeholder="Opsional"></label><label class="cp-field sm:col-span-2">Catatan<textarea id="cp-notes" maxlength="500" rows="2" class="cp-input" placeholder="Opsional"></textarea></label></div><div class="flex justify-end gap-2 mt-4"><button type="button" class="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold" data-payment-action="close">Batal</button><button type="button" class="px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold" data-payment-action="save">Konfirmasi Pembayaran</button></div><p id="cp-retry-note" class="text-xs text-amber-700 bg-amber-50 rounded-lg p-3 mt-3" style="display:none">Percobaan sebelumnya belum terverifikasi. Data dikunci dan ID transaksi dipertahankan. Tekan <b>Coba Verifikasi Ulang</b> untuk melanjutkan tanpa membuat pembayaran ganda.</p><p class="text-[10px] text-slate-400 mt-3">Konfirmasi hanya dilakukan setelah dana benar-benar diterima. Setiap pembayaran membuat satu catatan Finance dan satu riwayat pembayaran.</p></div>';
 m.addEventListener('click',function(e){var b=e.target.closest('[data-payment-action]');if(!b)return;if(b.dataset.paymentAction==='close')closePaymentEditor();if(b.dataset.paymentAction==='save')saveInvoicePayment();});
 m.addEventListener('change',function(e){if(e.target&&e.target.id==='cp-type')updatePaymentType();});
 w.document.body.appendChild(m);
}
function paymentRows(invoiceId){
 return(db.invoicePayments||[]).filter(function(p){return String(p.invoiceId)===String(invoiceId);}).slice().sort(function(a,b){return String(b.paymentDate||'').localeCompare(String(a.paymentDate||''))||String(b.createdAt||'').localeCompare(String(a.createdAt||''));});
}
function pendingPaymentStorageKey(invoiceId){return 'csk_invoice_payment_pending_'+encodeURIComponent(String(invoiceId));}
function readPendingPayment(invoiceId){
 var id=String(invoiceId||'');if(!id)return null;
 if(pendingPaymentDrafts[id])return pendingPaymentDrafts[id];
 try{if(w.sessionStorage){var raw=w.sessionStorage.getItem(pendingPaymentStorageKey(id));if(raw){var saved=JSON.parse(raw);if(saved&&saved.id&&saved.payload&&String(saved.payload.invoiceId)===id){pendingPaymentDrafts[id]=saved;return saved;}w.sessionStorage.removeItem(pendingPaymentStorageKey(id));}}}catch(e){}
 return null;
}
function writePendingPayment(invoiceId,pending){
 var id=String(invoiceId||'');if(!id)return;
 pendingPaymentDrafts[id]=pending;
 try{if(w.sessionStorage)w.sessionStorage.setItem(pendingPaymentStorageKey(id),JSON.stringify(pending));}catch(e){}
}
function clearPendingPayment(invoiceId){
 var id=String(invoiceId||'');delete pendingPaymentDrafts[id];
 try{if(w.sessionStorage)w.sessionStorage.removeItem(pendingPaymentStorageKey(id));}catch(e){}
}
function setPaymentRetryMode(pending){
 var retry=!!(pending&&pending.attempted&&pending.payload);
 ['cp-date','cp-type','cp-amount','cp-method','cp-reference','cp-notes'].forEach(function(id){var field=el(id);if(field)field.disabled=retry;});
 var note=el('cp-retry-note');if(note)note.style.display=retry?'block':'none';
 var save=el('commercial-payment-modal')&&el('commercial-payment-modal').querySelector('[data-payment-action="save"]');
 if(save)save.textContent=retry?'Coba Verifikasi Ulang':'Konfirmasi Pembayaran';
}
function closePaymentEditor(){
 var m=el('commercial-payment-modal');if(m)m.classList.add('hidden');
 if(currentPaymentInvoiceId){var pending=readPendingPayment(currentPaymentInvoiceId);if(pending&&!pending.attempted)clearPendingPayment(currentPaymentInvoiceId);}
 paymentDraftId='';currentPaymentInvoiceId='';
}
function updatePaymentType(){
 var invoice=arr('invoice').find(function(x){return String(x.id)===String(currentPaymentInvoiceId);});if(!invoice)return;
 var summary=summarizeInvoicePayments(invoice,db.invoicePayments||[]),type=el('cp-type').value;
 var amount=summary.balance;
 if(type==='dp'){
  amount=Math.min(Math.max(0,summary.balance-1),Math.round(summary.total*(n(invoice.dpPercent)||50)/100));
  if(amount<=0){el('cp-type').value='settlement';amount=summary.balance;}
 }else if(type==='installment'){amount=Math.min(summary.balance,Math.max(1,Math.round(summary.balance/2)));}
 el('cp-amount').value=amount;
}
function openPaymentEditor(invoiceId){
 if(typeof isOwnerSession!=='function'||!isOwnerSession())return say('Pencatatan pembayaran hanya dapat dilakukan Owner.',true);
 if(!w.CSKAuth||!w.CSKAuth.isReady||!w.CSKAuth.isReady()||typeof w.CSKAuth.recordInvoicePayment!=='function')return say('Koneksi Google Sheets belum siap. Pembayaran belum dicatat.',true);
 var invoice=arr('invoice').find(function(x){return String(x.id)===String(invoiceId);});if(!invoice)return say('Invoice tidak ditemukan.',true);
 var id=String(invoice.id),pending=readPendingPayment(id),summary=summarizeInvoicePayments(invoice,db.invoicePayments||[]);
 if(summary.balance<=0&&!pending)return say('Invoice sudah lunas.',true);
 ensurePaymentModal();currentPaymentInvoiceId=id;paymentDraftId=pending?pending.id:'PAY-'+Date.now()+'-'+Math.random().toString(36).slice(2,8).toUpperCase();
 el('cp-invoice-title').textContent=(invoice.docNo||invoice.id)+' · '+(invoice.client||'-');
 el('cp-summary').innerHTML='<div class="bg-slate-50 rounded-lg p-2"><span class="text-slate-500">Total</span><b class="block mt-1">'+rp(summary.total)+'</b></div><div class="bg-emerald-50 rounded-lg p-2"><span class="text-slate-500">Diterima</span><b class="block mt-1">'+rp(summary.paid)+'</b></div><div class="bg-amber-50 rounded-lg p-2"><span class="text-slate-500">Sisa</span><b class="block mt-1">'+rp(summary.balance)+'</b></div>';
 var history=paymentRows(invoice.id);
 el('cp-history').innerHTML=history.length?history.map(function(p){return '<div class="flex justify-between gap-3 border-b pb-2 text-xs"><div><b>'+esc(p.paymentType==='dp'?'DP':p.paymentType==='settlement'?'Pelunasan':'Cicilan')+'</b><div class="text-slate-500">'+esc(p.paymentDate)+' · '+esc(p.method)+' '+(p.reference?'· '+esc(p.reference):'')+'</div></div><b>'+rp(p.amount)+'</b></div>';}).join(''):'<div class="text-xs text-slate-400">Belum ada pembayaran.</div>';
 var pendingType=pending&&pending.payload?String(pending.payload.paymentType||''):'';
 var type=pendingType||(summary.paid>0?'installment':'dp');if(!pending&&summary.balance<=1)type='settlement';
 var includeDp=summary.paid===0||pendingType==='dp';
 el('cp-type').innerHTML=(includeDp?'<option value="dp">DP</option>':'')+'<option value="installment">Cicilan</option><option value="settlement">Pelunasan</option>';
 el('cp-type').value=type;
 el('cp-date').value=pending&&pending.payload?pending.payload.paymentDate:localDate();
 el('cp-method').value=pending&&pending.payload?pending.payload.method:'transfer';
 el('cp-reference').value=pending&&pending.payload?pending.payload.reference||'':'';
 el('cp-notes').value=pending&&pending.payload?pending.payload.notes||'':'';
 if(pending&&pending.payload){el('cp-amount').value=pending.payload.amount;setPaymentRetryMode(pending);}
 else{setPaymentRetryMode(null);updatePaymentType();}
 el('commercial-payment-modal').classList.remove('hidden');
}
async function saveInvoicePayment(){
 var invoiceId=currentPaymentInvoiceId,invoice=arr('invoice').find(function(x){return String(x.id)===String(invoiceId);});
 if(!invoice||!paymentDraftId)return;
 var pending=readPendingPayment(invoiceId),payment;
 if(pending&&pending.payload){payment=pending.payload;paymentDraftId=pending.id;}
 else{
  payment={id:paymentDraftId,invoiceId:String(invoice.id),paymentDate:el('cp-date').value,paymentType:el('cp-type').value,amount:Number(el('cp-amount').value),method:el('cp-method').value,reference:el('cp-reference').value.trim(),notes:el('cp-notes').value.trim()};
 }
 var summary=summarizeInvoicePayments(invoice,db.invoicePayments||[]);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(String(payment.paymentDate||'')))return say('Tanggal pembayaran wajib diisi dengan format tanggal yang valid.',true);
 if(!Number.isSafeInteger(Number(payment.amount))||Number(payment.amount)<=0)return say('Nominal pembayaran harus berupa rupiah bulat lebih dari nol.',true);
 if(['dp','installment','settlement'].indexOf(String(payment.paymentType))<0)return say('Jenis pembayaran tidak valid.',true);
 if(['transfer','cash','qris','ewallet','other'].indexOf(String(payment.method))<0)return say('Metode pembayaran tidak valid.',true);
 if(!(pending&&pending.attempted)){
  if(Number(payment.amount)>summary.balance)return say('Nominal melebihi sisa tagihan.',true);
  if(payment.paymentType==='settlement'&&Number(payment.amount)!==summary.balance)return say('Pelunasan harus sama dengan sisa tagihan.',true);
  if(payment.paymentType==='dp'&&summary.paid>0)return say('DP hanya dapat dicatat pada pembayaran pertama.',true);
  pending={id:payment.id,payload:payment,attempted:false};
 }
 pending.attempted=true;writePendingPayment(invoiceId,pending);
 setPaymentRetryMode(pending);
 var modal=el('commercial-payment-modal'),buttons=modal?modal.querySelectorAll('[data-payment-action]'):[];
 buttons.forEach(function(b){b.disabled=true;});
 try{
  await w.CSKAuth.recordInvoicePayment(payment);
  clearPendingPayment(invoiceId);
  closePaymentEditor();renderDocuments();say('Pembayaran berhasil diverifikasi dan dicatat di Finance.');
 }catch(e){
  writePendingPayment(invoiceId,pending);setPaymentRetryMode(pending);
  say('Pembayaran belum terverifikasi. Data percobaan dan ID transaksi dipertahankan. Buka kembali lalu tekan Coba Verifikasi Ulang; jangan buat pembayaran baru. '+String(e&&e.message||e),true);
 }finally{
  buttons.forEach(function(b){b.disabled=false;});
  var save=modal&&modal.querySelector('[data-payment-action="save"]');
  if(save)save.textContent=pending&&pending.attempted?'Coba Verifikasi Ulang':'Konfirmasi Pembayaran';
 }
}
function renderMaster(){var s=el('cd-master'),o=['<option value="">Pilih material / jasa</option>'];(db.materials||[]).forEach(function(x){o.push('<option value="m:'+esc(x.id)+'">Material · '+esc(x.name)+' · '+rp(x.unitPrice)+'/'+esc(x.unit||'unit')+'</option>');});(db.services||[]).forEach(function(x){o.push('<option value="s:'+esc(x.id)+'">Jasa · '+esc(x.name)+' · '+rp(x.basePrice)+'</option>');});s.innerHTML=o.join('');}
function renderLines(){el('cd-lines').innerHTML=doc.lines.map(function(x,i){return '<article class="cd-line"><div class="grid grid-cols-2 gap-2"><label class="cd-field col-span-2">Nama<input class="cd-input" data-line-index="'+i+'" data-line-field="name" value="'+esc(x.name)+'"></label><label class="cd-field col-span-2">Deskripsi<input class="cd-input" data-line-index="'+i+'" data-line-field="description" value="'+esc(x.description||'')+'"></label><label class="cd-field">Qty<input class="cd-input" type="number" min=".01" step=".01" data-line-index="'+i+'" data-line-field="qty" value="'+n(x.qty)+'"></label><label class="cd-field">Satuan<input class="cd-input" data-line-index="'+i+'" data-line-field="unit" value="'+esc(x.unit||'unit')+'"></label><label class="cd-field col-span-2">Harga satuan<input class="cd-input" type="number" min="0" data-line-index="'+i+'" data-line-field="unitPrice" value="'+n(x.unitPrice)+'"></label></div><div class="flex justify-between mt-2 text-xs"><b>'+rp(n(x.qty)*n(x.unitPrice))+'</b><button class="text-red-600" data-remove-line="'+i+'">Hapus</button></div></article>';}).join('')||'<div class="border border-dashed rounded-lg p-4 text-xs text-center text-slate-400">Belum ada item.</div>';}
function preview(){if(!doc)return;var t=calculateCommercialTotals(doc.lines,doc.discount,doc.taxRate);Object.assign(doc,t);var d=doc,date=d.date?new Date(d.date+'T12:00:00').toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'}):'-',due=d.dueDate?new Date(d.dueDate+'T12:00:00').toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'}):'-',label=kind==='quotation'?'QUOTATION / SURAT PENAWARAN':'INVOICE / TAGIHAN';
var rows=d.lines.map(function(x,i){return '<tr><td>'+(i+1)+'. '+esc(x.name)+(x.description?'<div style="color:#64748b">'+esc(x.description)+'</div>':'')+'</td><td style="text-align:center">'+n(x.qty)+' '+esc(x.unit||'')+'</td><td style="text-align:right">'+rp(x.unitPrice)+'</td><td style="text-align:right">'+rp(n(x.qty)*n(x.unitPrice))+'</td></tr>';}).join('')||'<tr><td colspan="4">Belum ada item</td></tr>';
el('commercial-printable').innerHTML='<div style="border-top:7px solid #f59e0b;padding-top:18px"><div style="display:flex;justify-content:space-between;gap:18px;border-bottom:2px solid #e2e8f0;padding-bottom:16px"><div><b style="font-size:20px">CAHAYA SELATAN KREASINDO</b><div style="font-size:10px;color:#b45309;margin:5px 0">PRODUCTION PARTNER UNTUK BRAND & BISNIS</div><div style="font-size:10px;color:#64748b;line-height:1.6">Jl. Doel Silem No. 45, Rawa Mekar Jaya, Serpong<br>Kota Tangerang Selatan, Banten 15317<br>WA 0888-8533-488 · halo@cahayaselatankreasindo.my.id</div></div><div style="text-align:right"><b style="background:#f59e0b;padding:7px;font-size:10px">'+label+'</b><div style="font-size:10px;margin-top:10px">No. Dokumen</div><b>'+esc(d.docNo||'-')+'</b><div style="font-size:10px;margin-top:5px">Tanggal: '+date+'</div><div style="font-size:10px">Jatuh tempo / berlaku: '+due+'</div><div style="font-size:10px">Deadline proyek: '+(d.projectDeadline?new Date(d.projectDeadline+'T12:00:00').toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'}):'-')+'</div></div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;padding:16px 0;border-bottom:1px solid #e2e8f0"><div><small>DITUJUKAN KEPADA</small><br><b>'+esc(d.client||'Nama pelanggan')+'</b><br>'+esc(d.clientPhone||'-')+(d.clientEmail?'<br>'+esc(d.clientEmail):'')+(d.contactPerson?'<br>PIC: '+esc(d.contactPerson):'')+(d.clientAddress?'<br>'+esc(d.clientAddress):'')+'</div><div><small>PEKERJAAN / PROYEK</small><br><b>'+esc(d.projectName||'-')+'</b><br><small>'+(d.projectId?'Project ID: '+esc(d.projectId):'Dokumen mandiri')+'</small></div></div><table style="margin:18px 0"><thead><tr><th>Item / pekerjaan</th><th>Qty</th><th style="text-align:right">Harga satuan</th><th style="text-align:right">Jumlah</th></tr></thead><tbody>'+rows+'</tbody></table><div style="margin-left:auto;width:250px;border-top:1px solid #cbd5e1;padding-top:8px"><div>Subtotal: <b style="float:right">'+rp(t.subtotal)+'</b></div><div>Diskon: <b style="float:right">'+rp(t.discount)+'</b></div><div>Pajak ('+t.taxRate+'%): <b style="float:right">'+rp(t.taxAmount)+'</b></div><div style="font-size:14px;font-weight:bold;border-top:2px solid #0f172a;margin-top:8px;padding-top:8px">TOTAL <span style="float:right;color:#b45309">'+rp(t.total)+'</span></div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;border-top:1px solid #e2e8f0;margin-top:18px;padding-top:16px"><div><b>KETENTUAN PEMBAYARAN</b><p style="white-space:pre-wrap">'+esc(d.paymentTerms||'-')+'</p><b>SYARAT DAN KETENTUAN</b><p style="white-space:pre-wrap">'+esc(d.terms||'-')+'</p>'+(d.notes?'<b>CATATAN</b><p>'+esc(d.notes)+'</p>':'')+'</div><div style="text-align:right"><b>Hormat kami,</b><div style="margin-top:70px"><b>Zefry Dany Adi Syahputra</b><br>Owner & Lead Project</div></div></div><div style="margin-top:16px;padding:9px;background:#f8fafc;font-size:9px">Bank Jago Syariah · 508705048143 · a.n. Zefry Dany Adi Syahputra · Konfirmasi WA 0888-8533-488</div></div>';
el('cd-totals').innerHTML='Subtotal: <b>'+rp(t.subtotal)+'</b><br>Diskon: <b>'+rp(t.discount)+'</b><br>Pajak: <b>'+rp(t.taxAmount)+'</b><hr style="margin:6px 0;border-color:#475569">Total: <b>'+rp(t.total)+'</b>';}
function renderEditor(){el('cd-title').textContent=(kind==='quotation'?'Quotation':'Invoice')+' · Editor';var s=el('cd-lead');s.innerHTML='<option value="">Input pelanggan manual / tanpa Lead</option>'+(db.leads||[]).map(function(x){return '<option value="'+esc(x.id)+'">'+esc(x.name||'Lead')+'</option>';}).join('');s.value=doc.leadId||'';var states=kind==='quotation'?['draft','sent','approved','rejected','cancelled']:['draft','sent','cancelled'];var savedStatus=doc.status||'draft';if(kind==='invoice'&&['partial','paid','unpaid'].indexOf(savedStatus)>=0)savedStatus='sent';el('cd-status').innerHTML=states.map(function(x){return '<option value="'+x+'">'+labels[x]+'</option>';}).join('');el('cd-status').value=states.indexOf(savedStatus)>=0?savedStatus:'draft';[['cd-client','client'],['cd-phone','clientPhone'],['cd-email','clientEmail'],['cd-contact','contactPerson'],['cd-address','clientAddress'],['cd-project','projectName'],['cd-number','docNo'],['cd-date','date'],['cd-due','dueDate'],['cd-project-deadline','projectDeadline'],['cd-discount','discount'],['cd-tax','taxRate'],['cd-dp','dpPercent'],['cd-payment','paymentTerms'],['cd-terms','terms'],['cd-notes','notes']].forEach(function(x){el(x[0]).value=doc[x[1]]==null?'':doc[x[1]];});renderMaster();renderLines();preview();}
function openCommercialDocumentEditor(k,id,pid){if(k!=='quotation'&&k!=='invoice')return;if(typeof isOwnerSession!=='function'||!isOwnerSession())return say('Dokumen komersial hanya dapat dikelola Owner.',true);ensure();kind=k;var old=id?arr(k).find(function(x){return String(x.id)===String(id);}):null;doc=old?JSON.parse(JSON.stringify(old)):defaultDoc(k,pid);delete doc.kind;if(!Array.isArray(doc.lines))doc.lines=[];if(!doc.date)doc.date=localDate();if(!doc.dueDate)doc.dueDate=plus(doc.date,7);if(!doc.docNo)doc.docNo=nextDocumentNumber(k,arr(k),doc.date);renderEditor();el('commercial-document-modal').classList.remove('hidden');}
function closeCommercialDocumentEditor(){if(el('commercial-document-modal'))el('commercial-document-modal').classList.add('hidden');doc=null;}
function updateCommercialField(f,v){if(!doc)return;doc[f]=['discount','taxRate','dpPercent'].includes(f)?n(v):String(v==null?'':v).trim();preview();}
function selectCommercialLead(id){if(!doc)return;var l=id?getLead(id):null;doc.leadId=l?String(l.id):'';if(l){doc.client=l.name||'';doc.clientPhone=l.phone||'';doc.clientEmail=l.email||'';doc.contactPerson=l.pic||'';if(!doc.projectName)doc.projectName=l.name||'';el('cd-client').value=doc.client;el('cd-phone').value=doc.clientPhone;el('cd-email').value=doc.clientEmail;el('cd-contact').value=doc.contactPerson;el('cd-project').value=doc.projectName;}preview();}
function updateCommercialLine(i,f,v){if(!doc||!doc.lines[i])return;doc.lines[i][f]=['qty','unitPrice'].includes(f)?n(v):String(v==null?'':v).trim();preview();}
function addCommercialMasterItem(){if(!doc)return;var v=el('cd-master').value;if(!v)return say('Pilih material atau jasa.',true);var p=v.split(':'),id=p.slice(1).join(':'),x=p[0]==='m'?(db.materials||[]).find(function(a){return String(a.id)===id;}):(db.services||[]).find(function(a){return String(a.id)===id;});if(!x)return say('Item master tidak ditemukan.',true);doc.lines.push({id:'L-'+Date.now(),materialId:p[0]==='m'?x.id:'',serviceId:p[0]==='s'?x.id:'',name:x.name||'Item',description:x.spec||'',qty:1,unit:x.unit||(p[0]==='s'?'Jasa':'unit'),unitPrice:n(p[0]==='m'?x.unitPrice:x.basePrice)});el('cd-master').value='';renderLines();preview();}
function addCommercialManualLine(){if(!doc)return;doc.lines.push({id:'L-'+Date.now(),name:'Item baru',description:'',qty:1,unit:'unit',unitPrice:0});renderLines();preview();}
function removeCommercialLine(i){if(!doc)return;doc.lines.splice(i,1);renderLines();preview();}
function readForm(){[['cd-lead','leadId'],['cd-client','client'],['cd-phone','clientPhone'],['cd-email','clientEmail'],['cd-contact','contactPerson'],['cd-address','clientAddress'],['cd-project','projectName'],['cd-number','docNo'],['cd-status','status'],['cd-date','date'],['cd-due','dueDate'],['cd-project-deadline','projectDeadline'],['cd-payment','paymentTerms'],['cd-terms','terms'],['cd-notes','notes']].forEach(function(x){doc[x[1]]=el(x[0]).value.trim();});doc.discount=n(el('cd-discount').value);doc.taxRate=n(el('cd-tax').value);doc.dpPercent=Math.min(99,Math.max(1,n(el('cd-dp').value)||50));}
async function persistCommercialChanges(successMessage){
 if(typeof saveDB==='function')saveDB(true);
 if(!w.CSKAuth||typeof w.CSKAuth.isReady!=='function'||!w.CSKAuth.isReady()||typeof w.CSKAuth.sync!=='function'){
  say('Perubahan belum diverifikasi. Login dan koneksi Google Sheets harus aktif.',true);
  return false;
 }
 say('Memverifikasi penyimpanan ke Google Sheets...');
 try{
  var verified=await w.CSKAuth.sync(true);
  if(!verified)throw new Error('SYNC_NOT_VERIFIED');
  say(successMessage+' berhasil disimpan dan diverifikasi di Google Sheets.');
  return true;
 }catch(e){
  say('Perubahan belum terverifikasi di Google Sheets. Jangan tutup aplikasi; periksa koneksi lalu coba Simpan/Sync lagi. '+String(e&&e.message||e),true);
  return false;
 }
}
async function saveCommercialDocument(){
 if(!doc)return;
 if(typeof isOwnerSession!=='function'||!isOwnerSession())return say('Dokumen komersial hanya dapat dikelola Owner.',true);
 readForm();
 if(!doc.client)return say('Nama pelanggan wajib diisi.',true);
 if(!doc.docNo)return say('Nomor dokumen wajib diisi.',true);
 if(!doc.date||!doc.dueDate)return say('Tanggal dan jatuh tempo wajib diisi.',true);
  if(doc.projectDeadline&&!/^\\d{4}-\\d{2}-\\d{2}$/.test(String(doc.projectDeadline)))return say('Deadline proyek tidak valid.',true);
 if(!doc.lines.length)return say('Tambahkan minimal satu item.',true);
 if(doc.lines.some(function(x){return !String(x.name||'').trim()||n(x.qty)<=0||n(x.unitPrice)<0;}))return say('Periksa nama item, kuantitas, dan harga.',true);
 if(arr(kind).some(function(x){return String(x.id)!==String(doc.id)&&String(x.docNo||'').toLowerCase()===doc.docNo.toLowerCase();}))return say('Nomor dokumen sudah digunakan.',true);
 if(doc.leadId&&!getLead(doc.leadId))doc.leadId='';
 var totals=calculateCommercialTotals(doc.lines,doc.discount,doc.taxRate);
 var prior=kind==='invoice'?arr('invoice').find(function(x){return String(x.id)===String(doc.id);}):null;
 var paid=prior?summarizeInvoicePayments(prior,db.invoicePayments||[]):null;
 if(paid&&paid.paid>0&&totals.total!==Math.round(n(prior.total)))return say('Total invoice tidak boleh diubah setelah ada pembayaran. Buat dokumen penyesuaian terpisah.',true);
 if(paid&&paid.paid>0&&doc.status==='cancelled')return say('Invoice dengan pembayaran tidak dapat dibatalkan langsung. Selesaikan rekonsiliasi terlebih dahulu.',true);
 Object.assign(doc,totals);
 delete doc.kind;
 doc.updatedAt=new Date().toISOString();
 if(!doc.createdAt)doc.createdAt=doc.updatedAt;
 var a=arr(kind),i=a.findIndex(function(x){return String(x.id)===String(doc.id);});
 if(i>=0)a[i]=JSON.parse(JSON.stringify(doc));
 else a.push(JSON.parse(JSON.stringify(doc)));
 await persistCommercialChanges((kind==='quotation'?'Quotation':'Invoice')+' tersimpan');
}
function printCommercialDocument(){if(!doc)return;readForm();preview();w.print();}
function copyCommercialDocumentWA(){if(!doc)return;readForm();var t=calculateCommercialTotals(doc.lines,doc.discount,doc.taxRate),msg='*'+(kind==='quotation'?'QUOTATION':'INVOICE')+' — CAHAYA SELATAN KREASINDO*\nNo: '+doc.docNo+'\nKlien: '+doc.client+'\nTanggal: '+doc.date+' · Jatuh tempo/berlaku: '+doc.dueDate+'\nPekerjaan: '+(doc.projectName||'-')+'\n'+doc.lines.map(function(x){return x.name+' × '+x.qty+' '+x.unit+' = '+rp(n(x.qty)*n(x.unitPrice));}).join('\n')+'\nSubtotal: '+rp(t.subtotal)+'\nDiskon: '+rp(t.discount)+'\nPajak: '+rp(t.taxAmount)+'\n*TOTAL: '+rp(t.total)+'*\n\nKetentuan: '+(doc.paymentTerms||'-')+'\nSyarat: '+(doc.terms||'-')+'\nWA 0888-8533-488';if(w.navigator.clipboard&&w.navigator.clipboard.writeText)w.navigator.clipboard.writeText(msg).then(function(){say('Teks dokumen disalin.');}).catch(function(){say('Clipboard tidak tersedia.',true);});else say('Clipboard tidak tersedia.',true);}
async function createProjectFromDocument(k,id){
 if(typeof isOwnerSession!=='function'||!isOwnerSession())return say('Dokumen komersial hanya dapat dikelola Owner.',true);
 var d=arr(k).find(function(x){return String(x.id)===String(id);});
 if(!d)return say('Dokumen tidak ditemukan.',true);
 if(k==='quotation'&&String(d.status||'').toLowerCase()!=='approved')return say('Quotation harus disetujui terlebih dahulu sebelum membuat atau menghubungkan proyek.',true);
 if(k==='invoice'&&String(d.status||'').toLowerCase()==='cancelled')return say('Invoice yang dibatalkan tidak dapat menjadi sumber proyek.',true);
 var sourceQ=k==='quotation'?String(d.id):String(d.sourceQuotationId||d.quotationId||'');
 var q=k==='quotation'?d:(sourceQ?arr('quotation').find(function(x){return String(x.id)===sourceQ;}):null);
 var sourceI=k==='invoice'?String(d.id):'';
 var old=findExistingProjectForDocument(db.projects||[],d,sourceQ,sourceI);
 if(old){
  var leadToken=d.leadId?'[LEAD-'+d.leadId+']':'';
  var isLeadQueue=!!(leadToken&&String(old.notes||'').indexOf(leadToken)!==-1&&!old.sourceQuotationId&&!old.sourceInvoiceId);
  var projectSource=d;
  if(k==='quotation'&&old.sourceInvoiceId){
   var linkedInvoice=arr('invoice').find(function(x){return String(x.id)===String(old.sourceInvoiceId)&&String(x.status||'').toLowerCase()!=='cancelled';});
   if(linkedInvoice)projectSource=linkedInvoice;
  }
  syncProjectCommercialFields(old,projectSource);
  if(isLeadQueue)old.notes='Dokumen '+(d.docNo||d.id)+' · '+String(old.notes||'');
  if(sourceQ)old.sourceQuotationId=sourceQ;
  if(sourceI)old.sourceInvoiceId=sourceI;
  d.projectId=String(old.id);
  if(q){q.projectId=String(old.id);q.status='approved';q.updatedAt=new Date().toISOString();}
  d.updatedAt=new Date().toISOString();
  return await persistCommercialChanges('Dokumen dihubungkan ke proyek yang sudah ada tanpa duplikasi');
 }
 var p={
  id:'PRJ-'+Date.now()+'-'+Math.random().toString(36).slice(2,7).toUpperCase(),
  title:d.projectName||('Pekerjaan '+d.client),
  client:d.client||'',
  value:n(d.total),
  suggestedPrice:n(d.total),
  deadline:d.projectDeadline||'',
  status:'plan',
  notes:'Dibuat dari '+(k==='quotation'?'quotation ':'invoice ')+(d.docNo||d.id)+(d.leadId?' [LEAD-'+d.leadId+']':''),
  sopChecklist:'Brief:0;Produksi:0;Review:0;Revisi:0;Delivery:0',
  sourceQuotationId:sourceQ,
  sourceInvoiceId:sourceI
 };
 db.projects=db.projects||[];
 db.projects.unshift(p);
 d.projectId=p.id;
 if(k==='quotation')d.status='approved';
 if(q&&q!==d){q.projectId=p.id;q.status='approved';q.updatedAt=new Date().toISOString();}
 d.updatedAt=new Date().toISOString();
 return await persistCommercialChanges('Proyek dibuat dari dokumen dan berhasil dihubungkan');
}
function createProjectFromQuotation(id){return createProjectFromDocument('quotation',id);}
function createProjectFromInvoice(id){return createProjectFromDocument('invoice',id);}
async function createInvoiceFromQuotation(id){
 if(typeof isOwnerSession!=='function'||!isOwnerSession())return say('Dokumen komersial hanya dapat dikelola Owner.',true);
 var q=arr('quotation').find(function(x){return String(x.id)===String(id);});
 if(!q)return say('Quotation tidak ditemukan.',true);
 var old=q.convertedInvoiceId?arr('invoice').find(function(x){return String(x.id)===String(q.convertedInvoiceId);}):null;
 if(!old)old=arr('invoice').find(function(x){return String(x.sourceQuotationId||x.quotationId||'')===String(q.id);});
 if(old){
  if(String(q.convertedInvoiceId||'')!==String(old.id)){
   q.convertedInvoiceId=String(old.id);
   q.updatedAt=new Date().toISOString();
   await persistCommercialChanges('Relasi invoice dari quotation dipulihkan');
  }
  return openCommercialDocumentEditor('invoice',old.id);
 }
 if(String(q.status||'').toLowerCase()!=='approved')return say('Quotation harus berstatus Disetujui sebelum dikonversi menjadi Invoice.',true);
 var t=localDate(),v=JSON.parse(JSON.stringify(q));
 v.id=newid('invoice');
 delete v.kind;
 delete v.convertedInvoiceId;
 v.docNo=nextDocumentNumber('invoice',arr('invoice'),t);
 v.quotationId=q.id;
 v.sourceQuotationId=q.id;
 v.date=t;
 v.dueDate=plus(t,7);v.projectDeadline=q.projectDeadline||'';
 v.status='draft';
 v.createdAt=new Date().toISOString();
 v.updatedAt=v.createdAt;
 delete v.sourceCostSheetId;
 delete v.sourceCostSheetUpdatedAt;
 arr('invoice').push(v);
 q.convertedInvoiceId=v.id;
 q.updatedAt=new Date().toISOString();
 await persistCommercialChanges('Invoice dibuat dari quotation');
 openCommercialDocumentEditor('invoice',v.id);
}
async function deleteCommercialDocument(k,id){if(typeof requireOwnerForDelete!=='function'||!requireOwnerForDelete())return;if(k==='invoice'&&paymentRows(id).length)return say('Invoice yang sudah memiliki riwayat pembayaran tidak dapat dihapus.',true);if(!w.confirm('Hapus dokumen ini?'))return;var sheet=k==='quotation'?'Commercial_Quotations':'Invoices';if(db.settings&&db.settings.googleSheetUrl&&typeof deleteOnCloud==='function'&&!await deleteOnCloud(sheet,id))return;if(k==='quotation')db.quotations=arr(k).filter(function(x){return String(x.id)!==String(id);});else db.invoices=arr(k).filter(function(x){return String(x.id)!==String(id);});saveDB(true);renderDocuments();say('Dokumen dihapus.');}
function renderDocuments(){
 var box=el('documents-projects-container');if(!box)return;
 var q=arr('quotation'),v=arr('invoice'),rows=all().sort(function(a,b){return String(b.updatedAt||'').localeCompare(String(a.updatedAt||''));});
 var h='<div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4"><button data-action="new-quote" class="bg-slate-900 text-white rounded-xl p-4 text-left"><b class="block">+ Buat Quotation</b><small>Penawaran dari Lead atau input manual</small></button><button data-action="new-invoice" class="bg-amber-500 text-slate-950 rounded-xl p-4 text-left"><b class="block">+ Buat Invoice</b><small>Tagihan mandiri atau hasil konversi</small></button></div><div class="grid grid-cols-2 gap-3 mb-4"><div class="bg-white border rounded-xl p-3">Quotation <b>'+q.length+'</b></div><div class="bg-white border rounded-xl p-3">Invoice <b>'+v.length+'</b></div></div><h3 class="font-bold text-sm mb-3">Riwayat dokumen</h3>';
 if(!rows.length)h+='<div class="bg-white border border-dashed rounded-xl p-8 text-center text-sm">Belum ada dokumen. Proyek tidak wajib dibuat terlebih dahulu.</div>';
 else h+=rows.map(function(x){
  var k=x.kind==='invoice'?'invoice':'quotation',isq=k==='quotation',id=esc(x.id),summary=isq?null:summarizeInvoicePayments(x,db.invoicePayments||[]);
  var status=isq?(labels[x.status]||x.status||'Draft'):(x.status==='cancelled'?'Dibatalkan':summary.status==='paid'?'Lunas':summary.status==='partial'?'Dibayar sebagian':'Belum dibayar');
  var paymentInfo=isq?'':'<div class="grid grid-cols-2 gap-2 text-xs mt-2"><div class="bg-emerald-50 rounded-lg p-2">Diterima <b class="block">'+rp(summary.paid)+'</b></div><div class="bg-amber-50 rounded-lg p-2">Sisa tagihan <b class="block">'+rp(summary.balance)+'</b></div></div>';
  var pendingPayment=!isq?readPendingPayment(x.id):null;var paymentButton=!isq&&x.status!=='cancelled'&&(summary.balance>0||pendingPayment)?'<button class="cd-btn bg-emerald-600 text-white" data-action="payment" data-id="'+id+'">'+(pendingPayment?'Verifikasi Ulang Pembayaran':'Catat Pembayaran')+'</button>':'';
  return '<article class="bg-white border rounded-xl p-4 mb-3 space-y-3"><div class="flex justify-between gap-3"><div><b>'+esc(x.docNo||x.id)+'</b> · '+(isq?'Quotation':'Invoice')+'<div class="text-xs mt-1">'+esc(x.client||'-')+' · '+esc(x.projectName||'-')+'</div><small class="text-slate-400">'+esc(x.date||'-')+' · '+(x.projectId?'Terhubung ke proyek':'Dokumen mandiri')+'</small>'+paymentInfo+'</div><div class="text-right"><b>'+rp(x.total)+'</b><div class="text-xs">'+esc(status)+'</div></div></div><div class="flex flex-wrap gap-2"><button class="cd-btn border" data-action="edit" data-kind="'+k+'" data-id="'+id+'">Edit</button>'+(isq&&(x.status==='approved'||x.convertedInvoiceId)?'<button class="cd-btn bg-amber-500" data-action="convert" data-id="'+id+'">Buat Invoice</button>':'')+paymentButton+'<button class="cd-btn bg-emerald-600 text-white" data-action="project" data-kind="'+k+'" data-id="'+id+'">Buat / Hubungkan Proyek</button><button class="cd-btn bg-slate-800 text-white" data-action="print-existing" data-kind="'+k+'" data-id="'+id+'">Cetak PDF</button><button class="cd-btn border border-red-200 text-red-700" data-action="delete" data-kind="'+k+'" data-id="'+id+'">Hapus</button></div></article>';
 }).join('');
 box.innerHTML=h;
 if(!box.dataset.bound){box.dataset.bound='1';box.addEventListener('click',function(e){
  var b=e.target.closest('[data-action]');if(!b)return;
  var a=b.dataset.action,id=b.dataset.id,k=b.dataset.kind;
  if(a==='new-quote')openCommercialDocumentEditor('quotation');
  if(a==='new-invoice')openCommercialDocumentEditor('invoice');
  if(a==='edit')openCommercialDocumentEditor(k,id);
  if(a==='convert')createInvoiceFromQuotation(id);
  if(a==='payment')openPaymentEditor(id);
  if(a==='project')createProjectFromDocument(k,id);
  if(a==='delete')deleteCommercialDocument(k,id);
  if(a==='print-existing'){openCommercialDocumentEditor(k,id);setTimeout(printCommercialDocument,250);}
 });}
}
w.openCommercialDocumentEditor=openCommercialDocumentEditor;w.closeCommercialDocumentEditor=closeCommercialDocumentEditor;w.updateCommercialField=updateCommercialField;w.selectCommercialLead=selectCommercialLead;w.updateCommercialLine=updateCommercialLine;w.addCommercialMasterItem=addCommercialMasterItem;w.addCommercialManualLine=addCommercialManualLine;w.removeCommercialLine=removeCommercialLine;w.saveCommercialDocument=saveCommercialDocument;w.printCommercialDocument=printCommercialDocument;w.copyCommercialDocumentWA=copyCommercialDocumentWA;w.createProjectFromDocument=createProjectFromDocument;w.createProjectFromQuotation=createProjectFromQuotation;w.createProjectFromInvoice=createProjectFromInvoice;w.createInvoiceFromQuotation=createInvoiceFromQuotation;w.deleteCommercialDocument=deleteCommercialDocument;w.renderDocuments=renderDocuments;w.openPaymentEditor=openPaymentEditor;w.closePaymentEditor=closePaymentEditor;w.saveInvoicePayment=saveInvoicePayment;w.openInvoiceModal=function(id){openCommercialDocumentEditor('invoice',null,id);};
db.quotations=Array.isArray(db.quotations)?db.quotations:[];db.invoices=Array.isArray(db.invoices)?db.invoices:[];db.quotationSnapshots=Array.isArray(db.quotationSnapshots)?db.quotationSnapshots:[];ensure();
})(typeof window!=='undefined'?window:null);
