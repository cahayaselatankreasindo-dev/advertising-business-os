/* CSK HPP UI — local-only calculator. Never imports/exports Google Sheets data. */
(function(root){
'use strict';
var KEY='csk_hpp_local_quotes_v1',DRAFT='csk_hpp_local_draft_v1',MAX=50;
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function rp(n){return 'Rp '+Number(n||0).toLocaleString('id-ID',{maximumFractionDigits:2})}
function init(panel,engine){
  if(!panel||!engine||panel.dataset.init==='1')return;
  panel.dataset.init='1';
  var draft=engine.create(),history=[],valid=false,warning='';
  function load(key,fallback){try{var s=localStorage.getItem(key);return s?JSON.parse(s):fallback}catch(e){warning='Penyimpanan browser tidak dapat dibaca.';return fallback}}
  var old=load(DRAFT,null);
  if(old)try{draft=engine.from(old)}catch(e){warning='Draft lama tidak valid; kalkulasi baru dibuat.'}
  var stored=load(KEY,[]);
  if(Array.isArray(stored))history=stored.slice(0,MAX).flatMap(function(x){try{return [engine.from(x)]}catch(e){return []}});
  function $(s){return panel.querySelector(s)}
  function save(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true}catch(e){message('Penyimpanan tidak tersedia. Gunakan Unduh JSON.',true);return false}}
  function message(s,bad){var t=$('#hpp-message');t.textContent=s;t.style.color=bad?'#B91C1C':'#047857'}
  function opts(values,v){return values.map(function(x){return '<option value="'+esc(x)+'"'+(x===v?' selected':'')+'>'+esc(x)+'</option>'}).join('')}
  panel.innerHTML=[
    '<div class="hpp-head"><div><span class="hpp-kicker">CSK COST ESTIMATION · BUSINESS OS</span><h2>Hitung HPP & Harga Penawaran</h2><p>Material, fabrikasi, finishing, waste, biaya instalasi, dan biaya tambahan per proyek.</p></div><span class="hpp-badge">LOKAL · TIDAK SYNC</span></div>',
    '<p class="hpp-note">Estimasi disimpan hanya di browser perangkat ini dan <strong>tidak masuk Leads, Finance, Projects, maupun Google Sheets</strong>. Unduh JSON sebagai cadangan. Harga acuan bukan harga vendor terkini.</p>',
    '<div class="hpp-card">',
      '<div class="hpp-form-grid"><label>Template pekerjaan <select id="hpp-template"><option value="blank">Estimasi kosong</option><option value="rack">Rak Display PVC</option><option value="booth">Booth Pameran</option><option value="signage">Signage / Neon Box</option><option value="acrylic">Display Akrilik (vendor)</option><option value="banner">Tripod A1 + Foamboard</option></select></label>',
      '<label>Nama barang / proyek <input id="hpp-name" maxlength="120" placeholder="Contoh: Rak Display Brand X"></label>',
      '<label>Jenis penawaran <select id="hpp-mode"><option value="custom_install">Produksi + instalasi (markup HPP 100%)</option><option value="ready_vendor">Maklon siap pakai (harga vendor, 0% markup)</option></select></label>',
      '<label>Jumlah produk jadi <input id="hpp-qty" type="number" min="1" max="1000000" step="1" inputmode="numeric"></label></div>',
      '<div class="hpp-section-head"><div><h3>Rincian HPP produksi</h3><p>Masukkan material, jasa fabrikasi, finishing, dan ongkos instalasi yang termasuk biaya pokok.</p></div><button id="hpp-add-row" type="button" class="hpp-secondary">+ Tambah Komponen</button></div>',
      '<div id="hpp-items" aria-live="polite"></div>',
      '<div class="hpp-section-head"><div><h3>Biaya tambahan di luar HPP</h3><p>Contoh ongkir terpisah, parkir, dan biaya titipan. Tidak terkena markup.</p></div><button id="hpp-add-extra" type="button" class="hpp-secondary">+ Tambah Biaya</button></div>',
      '<div id="hpp-extras"></div>',
      '<label class="hpp-notes">Catatan / spesifikasi<textarea id="hpp-notes" rows="3" maxlength="2000" placeholder="Spesifikasi teknis, vendor, jadwal, asumsi biaya..."></textarea></label>',
    '</div>',
    '<div class="hpp-summary"><div class="hpp-kicker">RINGKASAN BIAYA & PENAWARAN</div><p id="hpp-alert" role="status"></p>',
      '<div class="hpp-kpis"><div><small>HPP dasar</small><strong id="hpp-base">Rp 0</strong></div><div><small>Markup <span id="hpp-rate">100%</span></small><strong id="hpp-markup">Rp 0</strong></div><div><small>Tambahan tanpa markup</small><strong id="hpp-extra-total">Rp 0</strong></div><div class="hpp-price"><small>Penawaran (belum pajak)</small><strong id="hpp-price">Rp 0</strong></div></div>',
      '<p class="hpp-facts">Total HPP semua biaya <b id="hpp-total">Rp 0</b> · HPP/pcs <b id="hpp-unit-cost">Rp 0</b> · Harga/pcs <b id="hpp-unit-price">Rp 0</b> · Laba kotor estimasi <b id="hpp-profit">Rp 0</b> (<span id="hpp-margin">0%</span> dari penawaran).</p>',
      '<p class="hpp-footnote">PPN/pajak belum termasuk. Tidak otomatis mencatat kas masuk. Laba kotor hanya berdasarkan biaya yang diisi.</p>',
    '</div>',
    '<div class="hpp-actions"><button id="hpp-save" class="hpp-primary" type="button">Simpan HPP Lokal</button><button id="hpp-copy" class="hpp-secondary" type="button">Salin RAB</button><button id="hpp-export" class="hpp-secondary" type="button">Unduh JSON</button><button id="hpp-new" class="hpp-secondary" type="button">Estimasi Baru</button></div>',
    '<p id="hpp-message" role="status" aria-live="polite"></p>',
    '<div class="hpp-card"><div class="hpp-section-head"><div><h3>Riwayat estimasi</h3><p>Tersimpan lokal di browser ini, maksimal 50 estimasi.</p></div></div><div id="hpp-history"></div></div>'
  ].join('');
  function drawItems(){
    $('#hpp-items').innerHTML=draft.rows.length?draft.rows.map(function(x){
      return '<div class="hpp-item" data-row="'+esc(x.id)+'">'+
      '<label>Kategori<select data-f="category">'+opts(engine.CATEGORIES,x.category)+'</select></label>'+
      '<label class="hpp-wide">Material / jasa<input data-f="description" maxlength="140" value="'+esc(x.description)+'" placeholder="Material / jasa produksi"></label>'+
      '<label>Qty<input data-f="quantity" type="number" min="0" step="any" value="'+esc(x.quantity)+'"></label>'+
      '<label>Satuan<input data-f="unit" maxlength="24" value="'+esc(x.unit)+'"></label>'+
      '<label>Harga satuan (Rp)<input data-f="unitCost" type="number" min="0" step="any" value="'+esc(x.unitCost)+'"></label>'+
      '<label>Waste (%)<input data-f="wastePercent" type="number" min="0" max="100" step="any" value="'+esc(x.wastePercent)+'"></label>'+
      '<div class="hpp-row-footer"><strong data-total="'+esc(x.id)+'">Rp 0</strong><button type="button" data-delete-row="'+esc(x.id)+'" aria-label="Hapus baris" class="hpp-remove">Hapus</button></div></div>';
    }).join(''):'<p class="hpp-empty">Belum ada komponen biaya produksi. Klik Tambah Komponen.</p>';totals();
  }
  function drawExtras(){
    $('#hpp-extras').innerHTML=draft.extras.length?draft.extras.map(function(x){
      return '<div class="hpp-extra-item" data-extra="'+esc(x.id)+'">'+
      '<label>Jenis biaya tambahan<input data-f="description" maxlength="140" value="'+esc(x.description)+'" placeholder="Ongkos kirim / parkir / titipan"></label>'+
      '<label>Nominal (Rp)<input data-f="amount" type="number" min="0" step="any" value="'+esc(x.amount)+'"></label>'+
      '<button type="button" class="hpp-remove" data-delete-extra="'+esc(x.id)+'">Hapus</button></div>';
    }).join(''):'<p class="hpp-empty">Tidak ada biaya tambahan.</p>';totals();
  }
  function totals(){
    var selectors={'#hpp-base':'baseHpp','#hpp-markup':'markupAmount','#hpp-extra-total':'extraTotal','#hpp-price':'price','#hpp-total':'totalHpp','#hpp-unit-cost':'hppPerUnit','#hpp-unit-price':'pricePerUnit','#hpp-profit':'profit'};
    try{
      var r=engine.calc(draft);valid=r.ready;
      Object.keys(selectors).forEach(function(key){$(key).textContent=rp(r[selectors[key]])});
      $('#hpp-rate').textContent=r.markupPercent+'%';
      $('#hpp-margin').textContent=r.marginPercent.toLocaleString('id-ID')+'%';
      var alert=r.missingPrices?r.missingPrices+' harga komponen masih Rp 0, lengkapi sebelum penawaran.':(!r.ready?'Tambahkan biaya produksi agar estimasi valid.':'Estimasi siap diperiksa; pastikan harga aktual vendor.');
      $('#hpp-alert').textContent=alert;
      $('#hpp-alert').style.color=r.ready?'#047857':'#B45309';
      r.rows.forEach(function(x){var t=panel.querySelector('[data-total="'+x.id+'"]');if(t)t.textContent=rp(x.total)});
      return r;
    }catch(err){
      valid=false;$('#hpp-alert').textContent='Periksa input: '+err.message;
      $('#hpp-alert').style.color='#B91C1C';$('#hpp-price').textContent='—';return null;
    }
  }
  function historyUI(){
    $('#hpp-history').innerHTML=history.length?history.map(function(x){
      var price='—';try{price=rp(engine.calc(x).price)}catch(e){}
      return '<div class="hpp-history-row"><div><strong>'+esc(x.name)+'</strong><small>'+esc(x.updatedAt.slice(0,10))+' · '+price+'</small></div><div><button type="button" data-open="'+esc(x.id)+'">Buka</button><button type="button" data-remove-saved="'+esc(x.id)+'">Hapus</button></div></div>'
    }).join(''):'<p class="hpp-empty">Belum ada estimasi yang disimpan.</p>';
  }
  function fill(){
    $('#hpp-name').value=draft.name;$('#hpp-mode').value=draft.mode;$('#hpp-qty').value=draft.outputQty;
    $('#hpp-notes').value=draft.notes;$('#hpp-template').value='blank';
    drawItems();drawExtras();historyUI();totals();
  }
  function changed(){draft.updatedAt=new Date().toISOString();save(DRAFT,draft);totals()}
  function getText(r){
    return ['CSK — ESTIMASI HPP & PENAWARAN','Produk: '+r.quote.name,'Mode: '+engine.MODES[r.quote.mode].label,'Jumlah hasil: '+r.quote.outputQty,'',
      ...r.rows.map(function(x,i){return (i+1)+'. '+x.description+' | '+x.quantity+' '+x.unit+' x '+rp(x.unitCost)+' | waste '+x.wastePercent+'% | '+rp(x.total)}),
      '','HPP dasar: '+rp(r.baseHpp),'Markup '+r.markupPercent+'%: '+rp(r.markupAmount),
      ...r.extras.map(function(x){return 'Biaya tambahan — '+x.description+': '+rp(x.total)}),
      'Total HPP: '+rp(r.totalHpp),'HARGA PENAWARAN (belum PPN): '+rp(r.price),
      'Harga per hasil jadi: '+rp(r.pricePerUnit),'Laba kotor estimasi: '+rp(r.profit)+' ('+r.marginPercent+'%)',
      'Catatan: '+r.quote.notes,'PPN/pajak belum termasuk. Bukan faktur atau bukti pembayaran.'
    ].join('\n');
  }
  panel.addEventListener('input',function(e){
    var t=e.target,field=t.dataset.f,box=t.closest('[data-row], [data-extra]');
    if(t.id==='hpp-name')draft.name=t.value;
    if(t.id==='hpp-qty')draft.outputQty=t.value;
    if(t.id==='hpp-mode')draft.mode=t.value;
    if(t.id==='hpp-notes')draft.notes=t.value;
    if(box&&field){
      var isRow=box.hasAttribute('data-row'),arr=isRow?draft.rows:draft.extras;
      var key=isRow?'row':'extra',r=arr.find(function(x){return x.id===box.dataset[key]});
      if(r&&Object.prototype.hasOwnProperty.call(r,field))r[field]=t.value;
    }
    changed();
  });
  panel.addEventListener('change',function(e){
    if(e.target.id==='hpp-template'){
      var preset=e.target.value;
      if(!confirm('Ganti ke template baru? Draft aktif akan diganti. Simpan lebih dulu jika perlu.')){e.target.value='blank';return}
      draft=engine.create(preset);changed();fill();$('#hpp-template').value=preset;message('Template dimuat. Komponen Rp 0 harus diisi sesuai harga vendor.');
    }
  });
  panel.addEventListener('click',function(e){
    var b=e.target.closest('button');if(!b||!panel.contains(b))return;
    if(b.id==='hpp-add-row'){if(draft.rows.length>=120)return message('Maksimal 120 komponen.',true);draft.rows.push(engine.row());changed();drawItems();}
    if(b.id==='hpp-add-extra'){if(draft.extras.length>=40)return message('Maksimal 40 biaya tambahan.',true);draft.extras.push(engine.fee());changed();drawExtras();}
    if(b.dataset.deleteRow){draft.rows=draft.rows.filter(function(x){return x.id!==b.dataset.deleteRow});changed();drawItems()}
    if(b.dataset.deleteExtra){draft.extras=draft.extras.filter(function(x){return x.id!==b.dataset.deleteExtra});changed();drawExtras()}
    if(b.id==='hpp-new'){if(confirm('Buat estimasi kosong baru? Draft aktif akan diganti.')){draft=engine.create();changed();fill();message('Draft kosong baru dibuat.')}}
    if(b.id==='hpp-save'){
      var r=totals();if(!r||!r.ready)return message('Isi semua harga biaya pokok sebelum menyimpan.',true);
      var i=history.findIndex(function(x){return x.id===draft.id});
      if(i>=0)history[i]=engine.from(draft);else history.unshift(engine.from(draft));
      history=history.slice(0,MAX);if(save(KEY,history)){historyUI();message('HPP tersimpan lokal; cadangkan via Unduh JSON.')}
    }
    if(b.id==='hpp-export'){
      var result=totals();if(!result)return;
      var blob=new Blob([JSON.stringify({format:'csk-hpp-v1',quote:result.quote,summary:{hpp:result.totalHpp,markup:result.markupPercent,price:result.price,missingPrices:result.missingPrices},taxExcluded:true},null,2)],{type:'application/json'});
      var url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;
      a.download='CSK-HPP-'+new Date().toISOString().slice(0,10)+'.json';
      document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url)},1000);
      message('File JSON dibuat. Simpan di Drive pribadi jika ingin lintas perangkat.');
    }
    if(b.id==='hpp-copy'){
      var r=totals();if(!r)return;
      if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(getText(r)).then(function(){message('RAB tersalin ke clipboard.');},function(){message('Clipboard diblokir; gunakan Unduh JSON.',true)});
      else message('Clipboard tidak tersedia; gunakan Unduh JSON.',true);
    }
    if(b.dataset.open){
      var saved=history.find(function(x){return x.id===b.dataset.open});
      if(saved&&confirm('Buka estimasi ini? Draft aktif diganti.')){draft=engine.from(saved);changed();fill();message('Estimasi lokal berhasil dibuka.')}
    }
    if(b.dataset.removeSaved){
      if(confirm('Hapus estimasi dari browser ini?')){history=history.filter(function(x){return x.id!==b.dataset.removeSaved});save(KEY,history);historyUI();message('Estimasi dihapus dari riwayat lokal.')}
    }
  });
  fill();if(warning)message(warning,true);
}
var api={init,STORE:KEY,DRAFT};
root.CSKHPPUI=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
