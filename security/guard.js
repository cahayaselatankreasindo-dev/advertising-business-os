/* CSK authenticated frontend guard. Loaded deferred before DOMContentLoaded. */
(function(){
'use strict';
const OAUTH_CLIENT_ID='SET_GOOGLE_OAUTH_WEB_CLIENT_ID.apps.googleusercontent.com';
let sessionId='',identity=null,ready=false,originalNav=null;
const ownerKey='csk_business_os_db_owner',teamKey='csk_business_os_db_team';
function status(s){const el=document.getElementById('csk-auth-status');if(el)el.textContent=s;}
function gate(){
 let g=document.getElementById('csk-auth-gate');if(!g){g=document.createElement('div');g.id='csk-auth-gate';g.className='fixed inset-0 z-[2000] bg-slate-950 flex items-center justify-center p-5';g.innerHTML='<div class="w-full max-w-sm bg-white rounded-2xl p-6 shadow-2xl text-center space-y-4"><div class="text-xl font-bold">CSK BUSINESS OS</div><p class="text-sm text-slate-600">Masuk dengan akun Google yang diizinkan.</p><input id="csk-backend-url" type="url" placeholder="Apps Script Web App URL" class="w-full border rounded-lg p-2 text-xs"><button id="csk-save-backend" class="w-full bg-slate-900 text-white rounded-lg p-2 text-xs" type="button">Simpan URL Backend</button><div id="csk-google-signin" class="flex justify-center"></div><p id="csk-auth-status" class="text-xs text-slate-500">Menyiapkan login...</p></div>';document.body.appendChild(g);}
 return g;
}
function randomSession(){const b=new Uint8Array(32);crypto.getRandomValues(b);return btoa(String.fromCharCode(...b)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function apiUrl(){return (typeof db!=='undefined'&&db.settings&&db.settings.googleSheetUrl)||localStorage.getItem('csk_gas_url')||'';}
async function post(payload){const u=apiUrl();if(!u||!sessionId)throw Error('URL backend atau sesi belum tersedia.');await fetch(u,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({...payload,sessionId})});return {status:'submitted'};}
async function get(action){const u=apiUrl();if(!u||!sessionId)throw Error('URL backend atau sesi belum tersedia.');const x=new URL(u);x.searchParams.set('sessionId',sessionId);if(action)x.searchParams.set('action',action);const r=await fetch(x,{cache:'no-store'});const j=await r.json();if(j.status!=='success')throw Error(j.code||j.message||'Permintaan ditolak');return j;}
function merge(a,b){const m=new Map();(a||[]).forEach(x=>{if(x&&x.id!==undefined)m.set(String(x.id),x)});(b||[]).forEach(x=>{if(x&&x.id!==undefined)m.set(String(x.id),x)});return [...m.values()];}
function saveScoped(){const d=identity&&identity.role==='team'?{leads:db.leads,clients:db.clients,projects:db.projects}:db;localStorage.setItem(identity&&identity.role==='team'?teamKey:ownerKey,JSON.stringify(d));}
function applyRole(){
 document.querySelectorAll('#role-select,#role-select-mob').forEach(e=>e.style.display='none');
 const team=!identity||identity.role!=='owner';
 document.querySelectorAll('.pillar-finance,.pillar-marketing,.pillar-riset,.pillar-marketing-mob').forEach(e=>e.style.display=team?'none':'');
 const ownerOnly=['finance','marketing','analysis','memory','settings','services','purchasing','hpp','documents'];
 document.querySelectorAll('.mob-btn,.csk-mobile-more-grid button').forEach(b=>{const s=b.getAttribute('onclick')||'';const p=(s.match(/(?:nav|mobileGo)\('([^']+)'/)||[])[1];if(team&&ownerOnly.includes(p))b.style.display='none';});
 const work=document.getElementById('owner-workload-card');if(work)work.style.display=team?'none':'';
 const who=document.getElementById('csk-auth-identity');if(who)who.textContent=identity?((team?'Tim · ':'Owner · ')+identity.email):'';
}
async function credential(response){
 try{
  status('Memverifikasi akun Google...');
  const url=apiUrl();if(!url)throw Error('URL Apps Script belum diatur. Konfigurasikan URL pada penyimpanan lokal terlebih dahulu.');
  sessionId=randomSession();
  const r=await fetch(url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'auth_session',idToken:response.credential,sessionId})});
  const j=await r.json();if(j.status!=='success')throw Error(j.code||j.message||'Login ditolak.');
  identity=j.identity;
  const key=identity.role==='team'?teamKey:ownerKey;
  let local={};try{local=JSON.parse(localStorage.getItem(key)||'{}')}catch(e){}
  if(identity.role==='owner'&&local&&Object.keys(local).length)Object.assign(db,local);
  else if(identity.role==='team'){db.leads=[];db.clients=[];db.projects=[];db.finance=[];db.memory=[];db.marketingSpend=[];db.materials=[];db.costSheets=[];db.services=[];db.purchaseOrders=[];db.quotationSnapshots=[];}
  const cloud=await get('get_data'),d=cloud.data||{};
  db.leads=merge(d.leads,db.leads);db.clients=merge(d.clients,db.clients);db.projects=merge(d.projects,db.projects);
  if(identity.role==='owner'){['finance','memory','marketingSpend','materials','costSheets','services','purchaseOrders','quotationSnapshots'].forEach(k=>db[k]=merge(d[k],db[k]));}
  db.settings.lastSync=d.lastSynced||'';
  saveScoped();ready=true;applyRole();
  const g=document.getElementById('csk-auth-gate');if(g)g.remove();
  if(typeof renderAll==='function')renderAll();
  if(typeof initStarPicker==='function')initStarPicker('client-star-picker');
  if(identity.role==='owner')loadApprovals();
  status('Login berhasil.');
 }catch(e){sessionId='';identity=null;status(e.message);}
}
function start(){
 gate();
 const input=document.getElementById('csk-backend-url');if(input)input.value=apiUrl();
 const save=document.getElementById('csk-save-backend');if(save)save.onclick=()=>{const u=input.value.trim();if(!/^https:\/\/script\.google\.com\/macros\/s\//.test(u)){status('URL Apps Script tidak valid.');return;}localStorage.setItem('csk_gas_url',u);if(typeof db!=='undefined'){db.settings=db.settings||{};db.settings.googleSheetUrl=u;}status('URL tersimpan. Silakan masuk dengan Google.');};
 if(OAUTH_CLIENT_ID.startsWith('SET_')){status('Konfigurasi Google OAuth Client ID belum diisi.');return;}
 if(!window.google||!google.accounts||!google.accounts.id){status('Google Sign-In belum termuat. Muat ulang halaman.');return;}
 google.accounts.id.initialize({client_id:OAUTH_CLIENT_ID,callback:credential,auto_select:false});
 google.accounts.id.renderButton(document.getElementById('csk-google-signin'),{theme:'outline',size:'large',shape:'rectangular',text:'signin_with',width:280});
 status('Pilih akun Google untuk masuk.');
}
function loadApprovals(){if(!identity||identity.role!=='owner')return;get('list_pending_approvals').then(j=>{let box=document.getElementById('csk-approval-list');if(!box)return;box.innerHTML=(j.approvals||[]).map(x=>'<div class="border rounded p-3 text-xs flex justify-between gap-2"><span>'+esc(x.toEmail)+' · '+esc(x.status)+'</span><span>'+(x.status==='PENDING'?'<button onclick="cskSecurityAction(\''+x.approvalId+'\',\'approve_cold_email\')">Approve</button> <button onclick="cskSecurityAction(\''+x.approvalId+'\',\'reject_cold_email\')">Reject</button>':'')+(x.status==='APPROVED'?'<button onclick="cskSecurityAction(\''+x.approvalId+'\',\'send_approved_cold_email\')">Send</button>':'')+'</span></div>').join('')||'Belum ada permintaan.';}).catch(e=>console.warn(e));}
function esc(s){return String(s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
window.cskSecurityRefresh=loadApprovals;
window.cskSetBackendUrl=function(u){localStorage.setItem('csk_gas_url',u);};
window.cskSecurityAction=async function(id,action){if(!identity||identity.role!=='owner')return alert('Owner only');if(!confirm('Lanjutkan tindakan '+action+'?'))return;try{await post({action,approvalId:id});if(typeof showToast==='function')showToast('Permintaan dikirim ke server. Memperbarui status...');setTimeout(loadApprovals,1200);}catch(e){alert(e.message)}};
window.cskSecurityLogout=async function(){try{if(sessionId)await post({action:'logout'});}catch(e){}sessionId='';identity=null;ready=false;location.reload();};
originalNav=window.nav;
window.nav=function(page){if(!ready||!identity){status('Login diperlukan.');return false;}if(identity.role==='team'&&!['dashboard','leads','clients','projects'].includes(page)){if(typeof showToast==='function')showToast('Modul hanya tersedia untuk Owner.',true);return false;}return originalNav?originalNav(page):false;};
window.pullData=async function(){if(!identity||identity.role!=='owner')return alert('Owner only');if(!confirm('Tarik data cloud dan timpa data lokal?'))return;try{const j=await get('get_data'),d=j.data;Object.keys(d).forEach(k=>{if(Array.isArray(db[k]))db[k]=d[k]});saveScoped();renderAll();}catch(e){alert(e.message);}};
window.saveGoogleUrl=function(){if(!identity||identity.role!=='owner')return alert('Owner only');const u=document.getElementById('setting-google-url').value.trim();if(!/^https:\/\/script\.google\.com\/macros\/s\//.test(u))return alert('URL Apps Script tidak valid.');db.settings.googleSheetUrl=u;localStorage.setItem('csk_gas_url',u);saveScoped();if(typeof showToast==='function')showToast('URL backend tersimpan.');};
window.loadDB=function(){db.settings=db.settings||{};const u=localStorage.getItem('csk_gas_url');if(u)db.settings.googleSheetUrl=u;};
window.saveDB=function(){if(!ready)return;saveScoped();if(db.settings.googleSheetUrl)window.syncWithGoogle(true);if(typeof renderAll==='function')renderAll();};
window.pullAndMerge=async function(){if(!ready)return;try{const j=await get('get_data'),d=j.data||{};db.leads=merge(d.leads,db.leads);db.clients=merge(d.clients,db.clients);db.projects=merge(d.projects,db.projects);if(identity.role==='owner')['finance','memory','marketingSpend','materials','costSheets','services','purchaseOrders','quotationSnapshots'].forEach(k=>db[k]=merge(d[k],db[k]));saveScoped();renderAll();}catch(e){console.warn(e);}};
window.syncWithGoogle=async function(silent){if(!ready)return;try{const p={action:'sync_all',leads:db.leads,clients:db.clients,projects:db.projects};if(identity.role==='owner')Object.assign(p,{finance:db.finance,memory:db.memory,marketingSpend:db.marketingSpend,materials:db.materials,costSheets:db.costSheets,services:db.services,purchaseOrders:db.purchaseOrders,quotationSnapshots:db.quotationSnapshots});await post(p);if(!silent&&typeof showToast==='function')showToast('Sinkronisasi berhasil.');}catch(e){if(!silent&&typeof showToast==='function')showToast(e.message,true);}};
window.deleteOnCloud=async function(sheet,id){if(!ready)return;try{await post({action:'delete',sheet,id});}catch(e){console.warn(e);}};
window.sendColdEmailLead=async function(id){const l=db.leads.find(x=>String(x.id)===String(id));if(!l||!l.email)return alert('Email lead tidak tersedia.');if(!confirm('Ajukan cold email kepada Owner untuk '+l.email+'?'))return;try{await post({action:'request_cold_email',toEmail:l.email,name:l.name,brand:l.name});alert('Permintaan dikirim ke server. Periksa status persetujuan.');if(identity.role==='owner')setTimeout(loadApprovals,1200);}catch(e){alert(e.message);}};
window.onRoleChange=function(){alert('Role berasal dari akun Google dan tidak dapat diganti melalui dropdown.');};
document.addEventListener('click',e=>{const b=e.target.closest('[onclick*="openModal(\'modal-marketing\')"]');if(b&&(!ready||identity.role!=='owner')){e.preventDefault();e.stopImmediatePropagation();alert('Hanya Owner yang dapat mengakses Marketing.');}},true);
document.addEventListener('DOMContentLoaded',()=>{if(typeof db!=='undefined'){db.settings=db.settings||{};const old=localStorage.getItem('csk_business_os_db');try{const x=JSON.parse(old||'{}');if(x.settings&&x.settings.googleSheetUrl){db.settings.googleSheetUrl=x.settings.googleSheetUrl;localStorage.setItem('csk_gas_url',x.settings.googleSheetUrl);}}catch(e){}}const run=()=>start();if(window.google&&google.accounts)run();else{let n=0;const t=setInterval(()=>{if(window.google&&google.accounts){clearInterval(t);run();}else if(++n>40){clearInterval(t);status('Google Sign-In tidak tersedia.');}},250);}});
})();
