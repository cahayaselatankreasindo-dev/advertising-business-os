'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ui = require('./operations-ui.js');

const code = fs.readFileSync('photo-lab/Code.gs', 'utf8');
const html = fs.readFileSync('photo-lab/Index.html', 'utf8');
const manifest = JSON.parse(fs.readFileSync('photo-lab/appsscript.json','utf8'));
new vm.Script(html.match(/<script>([\s\S]*?)<\/script>/)[1],{filename:'photo-lab/Index.html inline JavaScript'});
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+kLJ0AAAAASUVORK5CYII=', 'base64');
let checks = 0;
function test(name, fn) { fn(); checks++; process.stdout.write('✓ '+name+'\n'); }

function labHarness() {
  const config = {
    CSK_PHOTO_OWNER_EMAIL:'owner@example.com',
    CSK_PHOTO_LAB_FOLDER_ID:'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    CSK_PHOTO_LAB_SPREADSHEET_ID:'ABCDEFGHIJKLMNOPQRSTUVWXYZ9876',
    CSK_PHOTO_ENABLE_WRITE:'true'
  };
  const state={active:'owner@example.com',effective:'owner@example.com',folderName:'LAB - Foto Laporan Proyek Business OS (DRAFT)',private:true,created:0,rows:[],marker:'CSK_PHOTO_LAB_ONLY_V1',folderEditors:[],folderViewers:[],failMetadata:false};
  const folder={
    getId:()=>config.CSK_PHOTO_LAB_FOLDER_ID,getName:()=>state.folderName,
    getSharingAccess:()=>state.private?'PRIVATE':'ANYONE',getEditors:()=>state.folderEditors,getViewers:()=>state.folderViewers,
    createFile:()=>{state.created++;return{getId:()=>`LABFILE_${state.created}`}}
  };
  const report={
    getLastRow:()=>1+state.rows.length,
    getRange:()=>({setValues:rows=>{if(state.failMetadata)throw Error('sheet service unavailable');state.rows.push(...rows)}}),
    getDataRange:()=>({getValues:()=>[['header'],...state.rows]})
  };
  const sheet={
    getName:()=> 'CSK PHOTO LAB - Business OS (DRAFT)',
    getSheetByName:name=>name==='_CSK_PHOTO_LAB'?{getRange:()=>({getValue:()=>state.marker})}:name==='Photo_Reports'?report:null
  };
  const ctx=vm.createContext({
    console:{error(){}},
    PropertiesService:{getScriptProperties:()=>({getProperty:key=>config[key]||'',setProperty:(key,value)=>{config[key]=value}})},
    Session:{getActiveUser:()=>({getEmail:()=>state.active}),getEffectiveUser:()=>({getEmail:()=>state.effective})},
    DriveApp:{Access:{PRIVATE:'PRIVATE'},getFolderById:()=>folder,getFileById:()=>({getParents:()=>({hasNext:()=>true,next:()=>folder})})},
    SpreadsheetApp:{openById:()=>sheet},
    LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},
    Utilities:{base64Decode:b64=>Array.from(Buffer.from(b64,'base64')),getUuid:()=> '00000000-0000-4000-8000-000000000001',newBlob:(bytes,mime,name)=>({bytes,mime,name})}
  });
  vm.runInContext(code,ctx,{filename:'Code.gs'});
  const call=(name,...args)=>vm.runInContext(name,ctx)(...args);
  const payload={projectId:'PRJ-001',stage:'Fabrikasi',caption:'Rangka selesai',mime:'image/png',base64:png.toString('base64'),originalName:'bukti.png'};
  return {config,state,payload,call};
}

test('Uploader URL hanya Apps Script HTTPS /exec tanpa query',()=>{
  assert.equal(ui.validPhotoLabUrl('https://script.google.com/macros/s/ABC123/exec'),true);
  for(const url of ['http://script.google.com/macros/s/ABC123/exec','https://script.google.com.evil.test/macros/s/ABC123/exec','https://evil@script.google.com/macros/s/ABC123/exec','https://script.google.com/macros/s/ABC123/dev','https://script.google.com/macros/s/ABC123/exec?token=foo','javascript:alert(1)'])assert.equal(ui.validPhotoLabUrl(url),false);
});
test('Tidak ada endpoint produksi, fetch publik, atau berbagi publik dalam Apps Script LAB',()=>{
  assert.doesNotMatch(code,/AnyoneWithLink|ANYONE_WITH_LINK|setSharing\s*\(|UrlFetchApp|doPost\s*\(/);
  assert.match(code,/getActiveUser\(\)/);
  assert.match(code,/CSK_PHOTO_ENABLE_WRITE/);
  assert.match(html,/google\.script\.run/);
  assert.equal(manifest.webapp.access,'MYSELF');
  assert.equal(manifest.webapp.executeAs,'USER_DEPLOYING');
});
test('Upload positif menghasilkan satu file dan satu baris metadata LAB',()=>{
  const h=labHarness(),result=h.call('uploadPhoto',h.payload);
  assert.equal(result.ok,true);assert.equal(h.state.created,1);assert.equal(h.state.rows.length,1);
  assert.equal(h.state.rows[0][2],'PRJ-001');assert.equal(h.state.rows[0][5],'LABFILE_1');
});
test('Identitas aktif yang kosong ditolak sebelum mencipta file',()=>{
  const h=labHarness();h.state.active='';assert.throws(()=>h.call('uploadPhoto',h.payload),/Akses ditolak/);assert.equal(h.state.created,0);
});
test('User lain ditolak meskipun effective user adalah owner',()=>{
  const h=labHarness();h.state.active='viewer@example.com';assert.throws(()=>h.call('uploadPhoto',h.payload),/Akses ditolak/);assert.equal(h.state.created,0);
});
test('Toggle write mati memblokir semua upload',()=>{
  const h=labHarness();h.config.CSK_PHOTO_ENABLE_WRITE='false';assert.throws(()=>h.call('uploadPhoto',h.payload),/belum diaktifkan/);assert.equal(h.state.created,0);
});
test('Folder bukan LAB, terbagi publik, atau memiliki anggota lain ditolak',()=>{
  for(const wrong of ['folderName','private','folderEditors']){
    const h=labHarness();if(wrong==='folderName')h.state.folderName='Project Produksi';if(wrong==='private')h.state.private=false;if(wrong==='folderEditors')h.state.folderEditors=['editor@example.com'];
    assert.throws(()=>h.call('uploadPhoto',h.payload),/Folder/);assert.equal(h.state.created,0);
  }
});
test('Spreadsheet tanpa marker LAB tidak boleh ditulis',()=>{
  const h=labHarness();h.state.marker='PRODUCTION';assert.throws(()=>h.call('uploadPhoto',h.payload),/Sheet bukan metadata LAB/);assert.equal(h.state.created,0);
});
test('Proyek, tahap, dan mime berbahaya ditolak sebelum Drive write',()=>{
  for(const invalid of [{projectId:'../data'},{stage:'Setujui Invoice'},{mime:'text/html'},{caption:''}]){
    const h=labHarness();assert.throws(()=>h.call('uploadPhoto',{...h.payload,...invalid}));assert.equal(h.state.created,0);
  }
});
test('JPEG palsu berisi PNG dan foto terlalu besar ditolak',()=>{
  const h=labHarness();assert.throws(()=>h.call('uploadPhoto',{...h.payload,mime:'image/jpeg'}),/Isi file/);
  assert.throws(()=>h.call('uploadPhoto',{...h.payload,base64:'A'.repeat(2500000)}),/terlalu besar/);assert.equal(h.state.created,0);
});
test('Caption awalan formula diamankan saat tersimpan di Sheets',()=>{
  const h=labHarness();h.call('uploadPhoto',{...h.payload,caption:'=HYPERLINK("evil")'});assert.equal(h.state.rows[0][4],'\'=HYPERLINK("evil")');
});
test('Daftar foto dibatasi hanya untuk ID proyek yang diminta',()=>{
  const h=labHarness();h.call('uploadPhoto',h.payload);h.call('uploadPhoto',{...h.payload,projectId:'PRJ-002'});
  const rows=h.call('listProjectPhotos','PRJ-001');assert.equal(rows.length,1);assert.match(rows[0].fileUrl,/LABFILE_1/);
});
test('Kegagalan metadata tidak mengklaim sukses penuh dan tidak menghapus file',()=>{
  const h=labHarness();h.state.failMetadata=true;
  const result=h.call('uploadPhoto',h.payload);
  assert.equal(result.ok,false);assert.equal(result.needsReview,true);
  assert.equal(h.state.created,1);assert.equal(result.fileId,'LABFILE_1');
});
process.stdout.write(`\n${checks} photo LAB tests passed.\n`);
