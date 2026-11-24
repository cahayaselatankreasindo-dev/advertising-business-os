(function(w){
'use strict';
var rootId='sales-orders-app',filter='all',bound=false;
function bridge(){return w.CSKSalesOrderBridge||null;}
function el(id){return w.document.getElementById(id);}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];});}
function money(v){return typeof w.formatRp==='function'?w.formatRp(v):'Rp '+Math.round(Number(v)||0).toLocaleString('id-ID');}
function n(v){var x=Number(v);return Number.isFinite(x)?x:0;}
function E(){if(!w.CSKSalesOrderEngine)throw new Error('Mesin Sales Order belum dimuat.');return w.CSKSalesOrderEngine;}
function data(){var b=bridge();if(!b)throw new Error('Koneksi modul Business OS belum siap.');return b.getData();}
function notify(msg,error){var b=bridge();if(b&&b.toast)b.toast(msg,!!error);}
function summary(order,d){return E().summarizePayments({id:order.quotationId,total:order.total,dpPercent:order.dpPercent,convertedInvoiceId:(d.quotations.find(function(q){return String(q.id)===String(order.quotationId);})||{}).convertedInvoiceId},d.invoices,d.invoicePayments);}
function quoteFor(id,d){return d.quotations.find(function(q){return String(q.id)===String(id);})||null;}
function invoiceForQuote(id,d){return d.invoices.filter(function(i){return String(i.sourceQuotationId||i.quotationId||'')===String(id);});}
function statusPill(status){
 var styles={awaiting_dp:'bg-amber-100 text-amber-800',awaiting_material:'bg-orange-100 text-orange-800',ready_production:'bg-blue-100 text-blue-800',in_production:'bg-cyan-100 text-cyan-800',quality_check:'bg-violet-100 text-violet-800',ready_delivery:'bg-indigo-100 text-indigo-800',delivered:'bg-emerald-100 text-emerald-800',closed:'bg-slate-900 text-white',cancelled:'bg-red-100 text-red-700'};
 return'<span class="inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold '+(styles[status]||'bg-slate-100 text-slate-700')+'">'+esc(E().statusLabel(status))+'</span>';
}
function ensureBound(){
 var page=el(rootId);if(!page||bound)return;
 page.addEventListener('click',function(event){
  var button=event.target.closest('[data-so-action]');if(!button)return;
  var action=button.dataset.soAction,id=button.dataset.id,status=button.dataset.status;
  if(action==='create')createSalesOrderFromQuotation(id);
  if(action==='create-po')createDraftPOFromShortage(id);
  if(action==='usage-report')downloadMaterialUsageReport(id);
  if(action==='transition')updateSalesOrderStatus(id,status);
  if(action==='invoice')openInvoiceForQuotation(id);
  if(action==='project')openProject(id);
  if(action==='filter'){filter=status||'all';renderSalesOrders();}
 });
 bound=true;
}
async function persist(){
 var b=bridge();if(!b)throw new Error('Koneksi Business OS tidak tersedia.');
 await b.save();
}
async function createSalesOrderFromQuotation(quotationId){
 var b=bridge();
 try{
  if(!b||!b.isOwner())throw new Error('Sales Order hanya dapat dibuat oleh Owner.');
  var d=data(),q=quoteFor(quotationId,d);if(!q)throw new Error('Quotation tidak ditemukan.');
  var old=d.salesOrders.find(function(x){return String(x.quotationId)===String(q.id);});
  if(old){notify('Quotation ini sudah memiliki Sales Order '+old.orderNo+'.');renderSalesOrders();return old;}
  if(String(q.status||'').toLowerCase()!=='approved')throw new Error('Quotation harus berstatus Disetujui.');
  var project=d.projects.find(function(p){return String(p.id)===String(q.projectId||'');});
  if(!project){
   if(typeof w.createProjectFromQuotation!=='function')throw new Error('Modul proyek belum tersedia.');
   var linked=await w.createProjectFromQuotation(q.id);
   if(!linked)throw new Error('Proyek belum berhasil disimpan dan diverifikasi. Sales Order belum dibuat.');
   d=data();q=quoteFor(quotationId,d);project=d.projects.find(function(p){return String(p.id)===String(q&&q.projectId||'');});
  }
  if(!project)throw new Error('Proyek belum terhubung dengan quotation.');
  var built=E().buildOrder(q,project,d.salesOrders,{date:E().localDate()});
  if(built.existing){notify('Sales Order sudah tersedia.');renderSalesOrders();return built.order;}
  prepareInitialMaterialReservation(built.order,d);
  d.salesOrders.unshift(built.order);
  await persist();
  renderSalesOrders();
  notify('Sales Order '+built.order.orderNo+' berhasil dibuat dan diverifikasi.');
  return built.order;
 }catch(error){notify(error.message||String(error),true);return null;}
}
async function updateSalesOrderStatus(id,nextStatus){
 var b=bridge();
 try{
  if(!b||!b.isOwner())throw new Error('Perubahan Sales Order hanya dapat dilakukan Owner.');
  var d=data(),order=d.salesOrders.find(function(x){return String(x.id)===String(id);});
  if(!order)throw new Error('Sales Order tidak ditemukan.');
  var q=quoteFor(order.quotationId,d),payment=summary(order,d),transitionOrder=order,transitionNote='';
  if(nextStatus==='ready_production'){
   var snapshot=null,snapshotError=null;
   try{snapshot=Array.isArray(order.materialRequirements)&&order.materialRequirements.length?order.materialRequirements:buildMaterialReservationSnapshot(order.projectId,d);}catch(error){snapshotError=error;}
   if(snapshotError){
    if(order.status==='awaiting_material')throw snapshotError;
    nextStatus='awaiting_material';transitionNote='Menunggu material. '+(snapshotError.message||String(snapshotError));
   }else{
    var candidate=Object.assign({},order,{status:'ready_production',materialRequirements:snapshot});
    var report=reservationReportForCandidate(candidate,d);
    var shortageRows=report.requirements.filter(function(row){return row.shortage>0;});
    if(report.errors.length||shortageRows.length){
     var reason=report.errors.length?report.errors.join(' '):'Stok tidak cukup untuk: '+shortageRows.map(function(row){return row.name+' kurang '+qtyFormat(row.shortage)+' '+row.unit;}).join(', ')+'.';
     if(order.status==='awaiting_material'){notify('Belum dapat melepas produksi. '+reason,true);return;}
     nextStatus='awaiting_material';transitionNote='Menunggu material. '+reason;
    }else{
     transitionOrder=candidate;
     transitionNote='Reservasi material otomatis dibuat berdasarkan snapshot HPP.';
    }
   }
  }else if(nextStatus==='in_production'&&order.status==='quality_check'){
   var reworkSnapshot=Array.isArray(order.materialRequirements)&&order.materialRequirements.length?order.materialRequirements:buildMaterialReservationSnapshot(order.projectId,d);
   var reworkCandidate=Object.assign({},order,{status:'in_production',materialRequirements:reworkSnapshot});
   var reworkReport=reservationReportForCandidate(reworkCandidate,d);
   var reworkShortages=reworkReport.requirements.filter(function(row){return row.shortage>0;});
   if(reworkReport.errors.length||reworkShortages.length){
    var reworkReason=reworkReport.errors.length?reworkReport.errors.join(' '):'Stok untuk rework belum cukup: '+reworkShortages.map(function(row){return row.name+' kurang '+qtyFormat(row.shortage)+' '+row.unit;}).join(', ')+'.';
    throw new Error(reworkReason);
   }
   transitionOrder=reworkCandidate;
   transitionNote='Reservasi material untuk pekerjaan ulang diaktifkan kembali.';
  }else if(nextStatus==='quality_check'){
   transitionNote='Reservasi sisa material yang belum dikeluarkan dilepas kembali ke stok tersedia.';
  }
  var identity=b.getIdentity();
  var updated=E().transition(transitionOrder,nextStatus,payment,identity&&identity.email||'Owner',new Date().toISOString(),transitionNote);
  var index=d.salesOrders.findIndex(function(x){return String(x.id)===String(id);});
  d.salesOrders[index]=updated;
  var project=d.projects.find(function(p){return String(p.id)===String(order.projectId);});
  if(project){
   var projectStatus={awaiting_material:'plan',ready_production:'plan',in_production:'ongoing',quality_check:'review',ready_delivery:'review',delivered:'done',closed:'done',cancelled:'cancelled'};
   if(projectStatus[nextStatus])project.status=projectStatus[nextStatus];
  }
  await persist();
  renderSalesOrders();
  notify('Status '+order.orderNo+' diperbarui menjadi '+E().statusLabel(nextStatus)+'.');
 }catch(error){notify(error.message||String(error),true);}
}
function openInvoiceForQuotation(id){
 var d=data(),q=quoteFor(id,d);
 if(!q)return notify('Quotation tidak ditemukan.',true);
 if(typeof w.createInvoiceFromQuotation!=='function')return notify('Modul invoice belum tersedia.',true);
 w.createInvoiceFromQuotation(id);
}
function openProject(id){
 var d=data(),order=d.salesOrders.find(function(x){return String(x.id)===String(id);});
 if(!order)return;
 if(typeof w.nav==='function')w.nav('projects');
 notify('Proyek: '+(order.projectName||order.projectId));
}
function buildMaterialReservationSnapshot(projectId,d){
 var sheet=(d.costSheets||[]).find(function(row){return String(row.projectId)===String(projectId);});
 if(!sheet)throw new Error('HPP proyek belum tersedia. Lengkapi HPP sebelum melepas produksi.');
 var plan=w.CSKInventoryEngine.calculateHppRequirements(sheet,d.materials||{});
 if(plan.errors.length)throw new Error(plan.errors.join(' '));
 if(!plan.requirements.length)throw new Error('HPP belum memiliki material yang dapat direservasi.');
 return plan.requirements.map(function(row){return{materialId:row.materialId,name:row.name,unit:row.unit,required:row.required,estimatedUnitCost:row.estimatedUnitCost===undefined?null:row.estimatedUnitCost,estimatedTotalCost:row.estimatedTotalCost===undefined?null:row.estimatedTotalCost};});
}
function reservationReportForCandidate(candidate,d){
 var balances=w.CSKInventoryEngine.calculateBalances(d.materials||[],d.inventoryTransactions||[]);
 var orders=(d.salesOrders||[]).filter(function(row){return String(row.id)!==String(candidate.id);});
 orders.push(candidate);
 return w.CSKInventoryEngine.calculateOpenSalesOrderCommitments(orders,d.costSheets||[],d.materials||[],d.inventoryTransactions||[],balances);
}
function prepareInitialMaterialReservation(order,d){
 if(order.status!=='ready_production')return;
 try{
  var snapshot=buildMaterialReservationSnapshot(order.projectId,d);
  var report=reservationReportForCandidate(Object.assign({},order,{materialRequirements:snapshot}),d);
  var shortages=report.requirements.filter(function(row){return row.shortage>0;});
  if(report.errors.length||shortages.length){
   var reason=report.errors.length?report.errors.join(' '):'Stok belum cukup untuk '+shortages.map(function(row){return row.name+' kurang '+qtyFormat(row.shortage)+' '+row.unit;}).join(', ')+'.';
   order.status='awaiting_material';
   var lastHistory=order.history[order.history.length-1];
   if(lastHistory&&lastHistory.status==='ready_production'){lastHistory.status='awaiting_material';lastHistory.note='Sales Order dibuat. Menunggu material. '+reason;}
   else order.history.push({date:new Date().toISOString(),status:'awaiting_material',actor:'System',note:'Menunggu material. '+reason});
  }else{
   order.materialRequirements=snapshot;
   var lastHistory=order.history[order.history.length-1];
   if(lastHistory&&lastHistory.status==='ready_production'){
    lastHistory.actor='System';
    lastHistory.note='Sales Order dibuat dan reservasi material otomatis disiapkan berdasarkan snapshot HPP.';
   }else{
    order.history.push({date:new Date().toISOString(),status:'ready_production',actor:'System',note:'Reservasi material otomatis dibuat berdasarkan snapshot HPP.'});
   }
  }
 }catch(error){
  order.status='awaiting_material';
  var lastHistory=order.history[order.history.length-1];
  if(lastHistory&&lastHistory.status==='ready_production'){lastHistory.status='awaiting_material';lastHistory.note='Sales Order dibuat. Menunggu material. '+(error.message||String(error));}
  else order.history.push({date:new Date().toISOString(),status:'awaiting_material',actor:'System',note:'Menunggu material. '+(error.message||String(error))});
 }
}
function openPurchaseOrderQty(projectId,materialId,d){
 return(d.purchaseOrders||[]).filter(function(po){return String(po.projectId)===String(projectId)&&['draft','ordered'].indexOf(String(po.status||'').toLowerCase())>=0;}).reduce(function(sum,po){
  var ordered=(Array.isArray(po.items)?po.items:[]).filter(function(item){return String(item.materialId)===String(materialId);}).reduce(function(total,item){return total+n(item.qty);},0);
  var received=(d.inventoryTransactions||[]).filter(function(tx){return String(tx.purchaseOrderId||'')===String(po.id)&&String(tx.materialId)===String(materialId)&&tx.movement==='receipt';}).reduce(function(total,tx){return total+n(tx.qty);},0);
  return sum+Math.max(0,ordered-received);
 },0);
}
function materialPlanForOrder(order,d,balances){
 if(Array.isArray(order.materialRequirements)&&order.materialRequirements.length){
  var errors=[],requirements=[];
  order.materialRequirements.forEach(function(line){
   var material=(d.materials||[]).find(function(row){return String(row.id)===String(line.materialId);});
   if(!material){errors.push('Material snapshot tidak ditemukan: '+String(line.materialId));return;}
   if(String(line.unit||'')!==String(material.unit||'')){errors.push('Satuan snapshot tidak cocok untuk '+material.name+'.');return;}
   if(!Number.isFinite(Number(line.required))||Number(line.required)<=0){errors.push('Kuantitas snapshot tidak valid untuk '+material.name+'.');return;}
   requirements.push({materialId:material.id,name:line.name||material.name,unit:material.unit,required:Number(line.required),onHand:n((balances||{})[String(material.id)]),estimatedUnitCost:line.estimatedUnitCost===null||line.estimatedUnitCost===undefined?null:Number(line.estimatedUnitCost),estimatedTotalCost:line.estimatedTotalCost===null||line.estimatedTotalCost===undefined?null:Number(line.estimatedTotalCost)});
  });
  return{requirements:requirements,errors:errors,ready:errors.length===0};
 }
 return w.CSKInventoryEngine.calculateHppRequirements((d.costSheets||[]).find(function(x){return String(x.projectId)===String(order.projectId);}),d.materials||[],balances);
}
function materialShortageRows(order,d,balances,plan){
 var reservations=w.CSKInventoryEngine.calculateOpenSalesOrderCommitments(d.salesOrders||[],d.costSheets||[],d.materials||[],d.inventoryTransactions||[],balances);
 if(reservations.errors.length)return plan.requirements.map(function(item){return Object.assign({},item,{issued:0,varianceQty:-item.required,variancePct:-100,remainingRequired:item.required,reservedByOthers:0,availableForProject:0,shortage:item.required,reservationErrors:reservations.errors.slice()});});
 var usage=w.CSKInventoryEngine.calculateMaterialUsageVariance(plan.requirements,order.projectId,d.inventoryTransactions||[]);
 return plan.requirements.map(function(item){
  var row=reservations.requirements.find(function(x){return String(x.materialId)===String(item.materialId);});
  var reservedByOthers=row?row.projects.filter(function(project){return String(project.projectId)!==String(order.projectId);}).reduce(function(sum,project){return sum+n(project.outstanding);},0):0;
  var variance=usage.find(function(x){return String(x.materialId)===String(item.materialId);});
  var issued=variance?variance.netIssuedQty:0,remaining=variance?variance.remainingQty:item.required;
  var available=Math.max(0,n(balances[String(item.materialId)])-reservedByOthers);
  return Object.assign({},item,{issued:issued,varianceQty:variance?variance.varianceQty:0,variancePct:variance?variance.variancePct:0,remainingRequired:remaining,reservedByOthers:reservedByOthers,availableForProject:available,shortage:Math.max(0,remaining-available)});
 });
}
async function downloadMaterialUsageReport(salesOrderId){
 try{
  var b=bridge();if(!b||!b.isOwner())throw new Error('Laporan material hanya dapat diunduh oleh Owner.');
  var d=data(),order=(d.salesOrders||[]).find(function(row){return String(row.id)===String(salesOrderId);});
  if(!order)throw new Error('Sales Order tidak ditemukan.');
  if(!w.CSKInventoryEngine)throw new Error('Mesin Inventory belum tersedia.');
  if(!w.CSKPDF||typeof w.CSKPDF.downloadMaterialUsageReport!=='function')throw new Error('Mesin PDF laporan material belum tersedia. Muat ulang aplikasi.');
  var balances=w.CSKInventoryEngine.calculateBalances(d.materials||[],d.inventoryTransactions||[]);
  var plan=materialPlanForOrder(order,d,balances);
  if(plan.errors.length)throw new Error('Perbaiki data HPP terlebih dahulu: '+plan.errors.join(' '));
  if(!plan.requirements.length)throw new Error('Belum ada rincian material untuk dilaporkan.');
  var usage=w.CSKInventoryEngine.calculateMaterialUsageVariance(plan.requirements,order.projectId,d.inventoryTransactions||[]);
  var lines=usage.map(function(line){return{
   name:line.name,unit:line.unit,required:line.plannedQty,netIssued:line.netIssuedQty,
   varianceQty:line.varianceQty,remaining:line.remainingQty
  };});
  var result=await w.CSKPDF.downloadMaterialUsageReport({
   title:'LAPORAN PENGELUARAN MATERIAL',
   docNo:'MUR-'+String(order.orderNo||order.id),
   orderNo:String(order.orderNo||order.id),
   projectId:String(order.projectId||''),
   projectName:String(order.projectName||order.projectId||'-'),
   status:E().statusLabel(order.status),
   source:Array.isArray(order.materialRequirements)&&order.materialRequirements.length?'Snapshot HPP (dibekukan)':'HPP saat ini (belum dibekukan)',
   date:E().localDate(),
   lines:lines
  });
  if(!result||!result.ok)throw new Error(result&&result.error||'PDF laporan material belum berhasil dibuat.');
  return result;
 }catch(error){notify(error.message||String(error),true);return{ok:false,error:error.message||String(error)};}
}
async function downloadMaterialCostReport(salesOrderId){
 try{
  var b=bridge();if(!b||!b.isOwner())throw new Error('Laporan biaya material hanya dapat diunduh oleh Owner.');
  var d=data(),order=(d.salesOrders||[]).find(function(row){return String(row.id)===String(salesOrderId);});
  if(!order)throw new Error('Sales Order tidak ditemukan.');
  if(!w.CSKInventoryEngine)throw new Error('Mesin Inventory belum tersedia.');
  if(!w.CSKPDF||typeof w.CSKPDF.downloadMaterialCostReport!=='function')throw new Error('Mesin PDF biaya material belum tersedia. Muat ulang aplikasi.');
  var balances=w.CSKInventoryEngine.calculateBalances(d.materials||[],d.inventoryTransactions||[]);
  var plan=materialPlanForOrder(order,d,balances);
  if(plan.errors.length)throw new Error('Perbaiki data HPP terlebih dahulu: '+plan.errors.join(' '));
  if(!plan.requirements.length)throw new Error('Belum ada rincian material untuk direkonsiliasi.');
  var cost=w.CSKInventoryEngine.calculateMaterialCostVariance(plan.requirements,order.projectId,d.inventoryTransactions||[],d.materials||[]);
  var lines=cost.rows.map(function(row){return{
   name:row.name,unit:row.unit,estimatedQty:row.estimatedQty,actualQty:row.actualQty,
   estimatedCost:row.estimatedCost,actualCost:row.actualCost,varianceCost:row.varianceCost,
   variancePct:row.variancePct,estimated:row.estimated,rowComplete:row.rowComplete
  };});
  var result=await w.CSKPDF.downloadMaterialCostReport({
   title:'LAPORAN REKONSILIASI BIAYA MATERIAL',
   docNo:'MCR-'+String(order.orderNo||order.id),
   orderNo:String(order.orderNo||order.id),
   projectId:String(order.projectId||''),
   projectName:String(order.projectName||order.projectId||'-'),
   status:E().statusLabel(order.status),
   source:Array.isArray(order.materialRequirements)&&order.materialRequirements.length?'Snapshot HPP (dibekukan)':'HPP saat ini (belum dibekukan)',
   date:E().localDate(),
   estimatedTotalCost:cost.estimatedTotalCost,
   actualTotalCost:cost.actualTotalCost,
   varianceCost:cost.varianceCost,
   complete:cost.complete,
   estimated:cost.estimated,
   varianceComplete:cost.varianceComplete,
   hasActualMovement:cost.hasActualMovement,
   isFinal:['delivered','closed'].indexOf(String(order.status||''))>=0,
   valuationMethod:'Moving Weighted Average (WAC)',
   lines:lines
  });
  if(!result||!result.ok)throw new Error(result&&result.error||'PDF rekonsiliasi biaya material belum berhasil dibuat.');
  return result;
 }catch(error){notify(error.message||String(error),true);return{ok:false,error:error.message||String(error)};}
}
async function createDraftPOFromShortage(salesOrderId){
 var b=bridge(),created=[];
 try{
  if(!b||!b.isOwner())throw new Error('Draft Purchase Order hanya dapat dibuat oleh Owner.');
  var d=data(),order=d.salesOrders.find(function(x){return String(x.id)===String(salesOrderId);});
  if(!order)throw new Error('Sales Order tidak ditemukan.');
  var sheet=(d.costSheets||[]).find(function(x){return String(x.projectId)===String(order.projectId);});
  if(!sheet&&!(Array.isArray(order.materialRequirements)&&order.materialRequirements.length))throw new Error('HPP proyek belum tersedia.');
  var balances=w.CSKInventoryEngine.calculateBalances(d.materials||[],d.inventoryTransactions||[]);
  var plan=materialPlanForOrder(order,d,balances);
  if(plan.errors.length)throw new Error('Perbaiki konversi HPP terlebih dahulu: '+plan.errors.join(' '));
  var shortageRows=materialShortageRows(order,d,balances,plan),shortages=shortageRows.filter(function(x){return x.shortage>0;});
  if(shortageRows.length&&shortageRows[0].reservationErrors&&shortageRows[0].reservationErrors.length)throw new Error('Reservasi material proyek lain belum valid: '+shortageRows[0].reservationErrors.join(' '));
  if(!shortages.length){notify('Tidak ada kekurangan material yang perlu dibelikan.');return;}
  var groups={};
  shortages.forEach(function(row){
   var material=d.materials.find(function(m){return String(m.id)===String(row.materialId);});
   if(!material)throw new Error('Material '+row.name+' tidak ditemukan.');
   var supplier=String(material.supplierName||'').trim(),unitPrice=Number(material.unitPrice);
   if(!supplier)throw new Error('Supplier belum diisi untuk '+material.name+'. Lengkapi Master Material sebelum membuat PO.');
   if(!Number.isFinite(unitPrice)||unitPrice<=0)throw new Error('Harga satuan pemakaian belum valid untuk '+material.name+'.');
   if(!material.priceDate||!material.priceSource)throw new Error('Sumber dan tanggal harga belum dicatat untuk '+material.name+'. Perbarui Master Material sebelum membuat PO.');
   var openQty=openPurchaseOrderQty(order.projectId,material.id,d);
   var buyQty=Math.max(0,row.shortage-openQty);
   if(buyQty<=0)return;
   if(!groups[supplier])groups[supplier]=[];
   groups[supplier].push({materialId:material.id,name:material.name,unit:material.unit,qty:buyQty,unitPrice:unitPrice,subtotal:buyQty*unitPrice,priceSnapshot:{purchasePrice:material.purchasePrice,purchaseUnit:material.purchaseUnit,conversionFactor:material.conversionFactor,priceSource:material.priceSource,priceDate:material.priceDate}});
  });
  var suppliers=Object.keys(groups);
  if(!suppliers.length){notify('Kekurangan material sudah tercakup dalam Draft/PO berjalan untuk proyek ini.');return;}
  var now=new Date().toISOString(),date=E().localDate();
  suppliers.forEach(function(supplier,index){
   var items=groups[supplier],total=items.reduce(function(sum,item){return sum+item.subtotal;},0);
   created.push({id:'PO-CSK-'+Date.now()+'-'+(index+1),projectId:order.projectId,projectName:order.projectName||'',supplier:supplier,date:date,items:items,total:total,status:'draft',inventoryControlVersion:1,createdAt:now,updatedAt:now});
  });
  created.forEach(function(po){d.purchaseOrders.unshift(po);});
  try{await b.save();}catch(syncError){created.forEach(function(po){var i=d.purchaseOrders.findIndex(function(x){return String(x.id)===String(po.id);});if(i>=0)d.purchaseOrders.splice(i,1);});throw syncError;}
  renderSalesOrders();
  notify(created.length+' Draft Purchase Order dibuat dari kekurangan HPP. Periksa kembali harga, supplier, dan kuantitas sebelum diterbitkan.');
 }catch(error){notify(error.message||String(error),true);}
}
function materialPlanHtml(order,d,balances){
 var sheet=(d.costSheets||[]).find(function(x){return String(x.projectId)===String(order.projectId);});
 if(!sheet&&!(Array.isArray(order.materialRequirements)&&order.materialRequirements.length))return'<div class="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-800">HPP proyek belum dibuat. Lengkapi HPP sebelum melepas material ke produksi.</div>';
 if(!w.CSKInventoryEngine)return'';
 var plan=materialPlanForOrder(order,d,balances);
 if(!plan.requirements.length&&!plan.errors.length)return'<div class="mt-3 rounded-lg border p-3 text-[11px] text-slate-500">HPP belum memiliki baris material yang dapat dihitung.</div>';
 var rowsData=materialShortageRows(order,d,balances,plan);
 var materialCost=w.CSKInventoryEngine.calculateMaterialCostVariance(plan.requirements,order.projectId,d.inventoryTransactions||[],d.materials||[]);
 var costSummary='<div class="grid grid-cols-1 sm:grid-cols-3 gap-2 my-3">'+
  '<div class="rounded-lg bg-slate-50 p-3"><div class="text-[10px] text-slate-500">Estimasi HPP material</div><b class="text-sm">'+(materialCost.estimatedTotalCost===null?'Belum tersedia':money(materialCost.estimatedTotalCost))+'</b></div>'+
  '<div class="rounded-lg bg-slate-50 p-3"><div class="text-[10px] text-slate-500">Biaya aktual net keluar</div><b class="text-sm">'+money(materialCost.actualTotalCost)+'</b><div class="text-[10px] text-slate-500">'+(materialCost.complete?(materialCost.estimated?'Valuasi memakai fallback harga Master':'Valuasi tercatat lengkap'):'Valuasi belum lengkap')+'</div></div>'+
  '<div class="rounded-lg bg-slate-50 p-3"><div class="text-[10px] text-slate-500">Selisih biaya material (sementara)</div><b class="text-sm '+(materialCost.varianceCost===null?'text-slate-500':materialCost.varianceCost>0?'text-red-700':materialCost.varianceCost<0?'text-emerald-700':'text-slate-900')+'">'+(materialCost.varianceCost===null?'Belum dapat dihitung':(materialCost.varianceCost>0?'+':'')+money(materialCost.varianceCost))+'</b></div></div>'+
  (materialCost.estimated?'<p class="text-[10px] text-amber-700 mb-2">Sebagian transaksi lama menggunakan fallback harga Master Material. Nilai biaya aktual tersebut bersifat estimasi, bukan bukti harga pembelian historis.</p>':'');
 var rows=rowsData.map(function(item){
  var pendingPO=openPurchaseOrderQty(order.projectId,item.materialId,d),toBuy=Math.max(0,item.shortage-pendingPO);
  return'<tr class="border-t"><td class="py-2 pr-3"><b>'+esc(item.name)+'</b><div class="text-[10px] text-slate-400">'+esc(item.unit)+'</div></td><td class="py-2 text-right">'+qtyFormat(item.required)+'</td><td class="py-2 text-right">'+qtyFormat(item.issued)+'</td><td class="py-2 text-right font-semibold '+(item.varianceQty>0?'text-red-700':item.varianceQty<0?'text-amber-700':'text-emerald-700')+'">'+(item.varianceQty>0?'+':'')+qtyFormat(item.varianceQty)+'</td><td class="py-2 text-right">'+qtyFormat(item.remainingRequired)+'</td><td class="py-2 text-right">'+qtyFormat(item.onHand)+'</td><td class="py-2 text-right text-violet-700">'+(item.reservedByOthers>0?qtyFormat(item.reservedByOthers):'-')+'</td><td class="py-2 text-right font-semibold">'+qtyFormat(item.availableForProject)+'</td><td class="py-2 text-right font-bold '+(item.shortage>0?'text-red-700':'text-emerald-700')+'">'+(item.shortage>0?qtyFormat(item.shortage):'Cukup')+'</td><td class="py-2 text-right text-blue-700">'+(pendingPO>0?qtyFormat(pendingPO):'-')+'</td><td class="py-2 text-right font-bold '+(toBuy>0?'text-amber-700':'text-emerald-700')+'">'+(toBuy>0?qtyFormat(toBuy):'-')+'</td></tr>';
 }).join('');
 var reservationErrors=rowsData.length&&rowsData[0].reservationErrors?rowsData[0].reservationErrors:[];
 var allErrors=plan.errors.concat(reservationErrors);
 var errorHtml=allErrors.length?'<ul class="list-disc pl-4 mt-2 text-[10px] text-amber-800">'+allErrors.map(function(e){return'<li>'+esc(e)+'</li>';}).join('')+'</ul>':'';
 var hasBuyableShortage=allErrors.length===0&&rowsData.some(function(x){return x.shortage>openPurchaseOrderQty(order.projectId,x.materialId,d);});
 var hasShortage=rowsData.some(function(x){return x.shortage>0;});
 var poButton=plan.errors.length===0&&hasBuyableShortage?'<button data-so-action="create-po" data-id="'+esc(order.id)+'" class="mt-3 px-3 py-2 rounded-lg bg-emerald-700 text-white text-[11px] font-bold">Buat Draft PO dari Kekurangan</button>':hasShortage&&plan.errors.length===0?'<p class="mt-3 text-[10px] text-blue-700">Kekurangan stok sudah tercakup dalam Draft/PO berjalan.</p>':'';
 var reportButton=allErrors.length===0&&rowsData.length?'<button data-so-action="usage-report" data-id="'+esc(order.id)+'" class="mt-3 ml-2 px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-[11px] font-bold">Unduh Laporan Pengeluaran Material PDF</button>':'';
 var costReportButton=allErrors.length===0&&rowsData.length?'<button data-so-action="cost-report" data-id="'+esc(order.id)+'" class="mt-3 ml-2 px-3 py-2 rounded-lg bg-slate-900 text-white text-[11px] font-bold">Unduh Rekonsiliasi Biaya PDF</button>':'';
 var state=allErrors.length?'<span class="text-amber-700 font-bold">Perlu pemeriksaan</span>':!hasShortage?'<span class="text-emerald-700 font-bold">Kebutuhan tercukupi</span>':hasBuyableShortage?'<span class="text-amber-700 font-bold">Perlu pembelian</span>':'<span class="text-blue-700 font-bold">PO sedang berjalan</span>';
 return'<details class="mt-3 rounded-xl border border-slate-200 p-3"><summary class="cursor-pointer text-xs font-bold text-slate-700">Kebutuhan material & Actual Costing · '+rowsData.length+' jenis · '+state+'</summary>'+costSummary+'<div class="overflow-x-auto mt-2"><table class="w-full text-[11px] min-w-[1080px]"><thead class="text-slate-500"><tr><th class="text-left py-2">Material</th><th class="text-right py-2">HPP</th><th class="text-right py-2">Net keluar</th><th class="text-right py-2">Selisih vs HPP</th><th class="text-right py-2">Sisa kebutuhan</th><th class="text-right py-2">Stok fisik</th><th class="text-right py-2">Reservasi lain</th><th class="text-right py-2">Tersedia untuk proyek</th><th class="text-right py-2">Kekurangan</th><th class="text-right py-2">Sudah dipesan</th><th class="text-right py-2">Perlu PO</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+errorHtml+poButton+reportButton+costReportButton+'<p class="text-[10px] text-slate-400 mt-2">Perhitungan memakai snapshot HPP dan mengurangi stok yang sudah direservasi proyek lain. Biaya material dihitung dari snapshot transaksi Inventory dengan metode Moving Weighted Average. Penerimaan berbasis PO memakai harga PO yang disetujui, sedangkan penerimaan manual memakai biaya pada dokumen supplier. Nilai ini belum menggantikan rekonsiliasi faktur supplier. Selisih biaya membandingkan biaya net material yang sudah dikeluarkan dengan estimasi HPP. Nilainya masih sementara sampai material sisa diretur dan pekerjaan ditutup. Draft PO tetap memerlukan pemeriksaan Owner sebelum diterbitkan.</p></details>';
}
function qtyFormat(value){return Number(value||0).toLocaleString('id-ID',{maximumFractionDigits:3});}
function quoteCandidates(d){
 return d.quotations.filter(function(q){
  return String(q.status||'').toLowerCase()==='approved'&&!d.salesOrders.some(function(s){return String(s.quotationId)===String(q.id);});
 }).sort(function(a,b){return String(b.updatedAt||'').localeCompare(String(a.updatedAt||''));});
}
function renderSalesOrders(){
 var page=el(rootId);if(!page)return;
 try{
  var d=data(),engine=E(),orders=(d.salesOrders||[]).slice().sort(function(a,b){return String(b.updatedAt||'').localeCompare(String(a.updatedAt||''));});
  var stockBalances=w.CSKInventoryEngine?w.CSKInventoryEngine.calculateBalances(d.materials||[],d.inventoryTransactions||[]):{};
  var counts={};Object.keys(engine.LABELS).forEach(function(s){counts[s]=orders.filter(function(o){return o.status===s;}).length;});
  var active=filter==='all'?orders:orders.filter(function(o){return o.status===filter;});
  var candidates=quoteCandidates(d);
  var stats=[
   ['Menunggu DP',counts.awaiting_dp,'amber'],['Menunggu Material',counts.awaiting_material,'orange'],['Siap Produksi',counts.ready_production,'blue'],
   ['Dalam Produksi',counts.in_production,'cyan'],['Quality Control',counts.quality_check,'violet'],
   ['Siap Dikirim',counts.ready_delivery,'indigo'],['Selesai / Ditutup',counts.closed+counts.delivered,'emerald']
  ];
  var html='<div class="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-2 mb-5">'+stats.map(function(x){return'<div class="bg-white border border-slate-200 rounded-xl p-3"><div class="text-[10px] text-slate-500">'+x[0]+'</div><b class="text-xl text-slate-900">'+x[1]+'</b></div>';}).join('')+'</div>';
  html+='<section class="bg-white border border-slate-200 rounded-2xl p-4 mb-5"><div class="flex flex-wrap justify-between items-start gap-3"><div><h2 class="font-bold text-sm">Quotation siap dikonversi</h2><p class="text-xs text-slate-500 mt-1">Hanya quotation berstatus Disetujui yang dapat menjadi Sales Order.</p></div><span class="text-xs text-slate-500">'+candidates.length+' menunggu konversi</span></div>';
  if(!candidates.length)html+='<div class="mt-3 rounded-xl bg-slate-50 p-4 text-xs text-slate-500">Belum ada quotation disetujui yang belum memiliki Sales Order.</div>';
  else html+='<div class="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3">'+candidates.map(function(q){return'<article class="border border-slate-200 rounded-xl p-3"><div class="flex justify-between gap-3"><div class="min-w-0"><b class="text-sm">'+esc(q.docNo||q.id)+'</b><div class="text-xs text-slate-600 mt-1">'+esc(q.client||'-')+' · '+esc(q.projectName||'-')+'</div><div class="text-[11px] text-slate-400 mt-1">'+esc(q.date||'-')+' · DP '+Number(q.dpPercent||0)+'%</div></div><b class="text-sm whitespace-nowrap">'+money(q.total)+'</b></div><button data-so-action="create" data-id="'+esc(q.id)+'" class="mt-3 w-full min-h-10 rounded-lg bg-slate-900 text-white text-xs font-bold">Buat Sales Order</button></article>';}).join('')+'</div>';
  html+='</section><section><div class="flex flex-wrap items-center justify-between gap-2 mb-3"><div><h2 class="font-bold text-sm">Daftar Sales Order</h2><p class="text-xs text-slate-500 mt-1">Satu Sales Order untuk setiap quotation yang disetujui.</p></div><select id="so-filter" class="border border-slate-300 rounded-lg p-2 text-xs" aria-label="Filter status">'+['all'].concat(Object.keys(engine.LABELS)).map(function(s){return'<option value="'+s+'" '+(filter===s?'selected':'')+'>'+(s==='all'?'Semua status':esc(engine.statusLabel(s)))+'</option>';}).join('')+'</select></div>';
  if(!active.length)html+='<div class="bg-white border border-dashed border-slate-300 rounded-2xl p-8 text-center text-sm text-slate-500">Belum ada Sales Order pada filter ini.</div>';
  else html+=active.map(function(order){
   var pay=summary(order,d),actions=engine.availableActions(order,pay),invoice=invoiceForQuote(order.quotationId,d),shortfall=Math.max(0,Number(order.dpRequiredAmount||0)-pay.paid);
   var latest=(Array.isArray(order.history)?order.history:[]).slice(-3).reverse();
   var history=latest.map(function(h){return'<li class="text-[10px] text-slate-500">'+esc(h.date||'')+' · '+esc(engine.statusLabel(h.status))+(h.note?' — '+esc(h.note):'')+'</li>';}).join('');
   var actionHtml=actions.map(function(a){var color=a.status==='cancelled'?'bg-red-50 text-red-700':a.status==='closed'?'bg-slate-900 text-white':'bg-blue-50 text-blue-700';return'<button data-so-action="transition" data-id="'+esc(order.id)+'" data-status="'+esc(a.status)+'" class="px-3 py-2 rounded-lg text-[11px] font-bold '+color+'">'+esc(a.label)+'</button>';}).join('');
   var invoiceButton=invoice.length?'<button data-so-action="invoice" data-id="'+esc(order.quotationId)+'" class="px-3 py-2 rounded-lg border text-[11px] font-bold">Buka Invoice</button>':'<button data-so-action="invoice" data-id="'+esc(order.quotationId)+'" class="px-3 py-2 rounded-lg border text-[11px] font-bold">Buat Invoice</button>';
   return'<article class="bg-white border border-slate-200 rounded-2xl p-4 space-y-3"><div class="flex flex-wrap justify-between gap-3"><div class="min-w-0"><div class="flex flex-wrap items-center gap-2"><b class="text-sm">'+esc(order.orderNo||order.id)+'</b>'+statusPill(order.status)+'</div><div class="text-sm font-semibold text-slate-800 mt-2">'+esc(order.projectName||'-')+'</div><div class="text-xs text-slate-500">'+esc(order.client||'-')+' · Quotation '+esc(order.quotationNo||order.quotationId)+'</div><div class="text-[10px] text-slate-400 mt-1">Order '+esc(order.orderDate||'-')+' · Target kirim '+esc(order.deliveryDate||'Belum ditentukan')+'</div></div><div class="text-right"><div class="text-[10px] text-slate-500">Nilai pesanan</div><b class="text-lg">'+money(order.total)+'</b></div></div><div class="grid grid-cols-2 sm:grid-cols-4 gap-2"><div class="bg-slate-50 rounded-lg p-2"><div class="text-[10px] text-slate-500">DP '+Number(order.dpPercent||0)+'%</div><b class="text-xs">'+money(order.dpRequiredAmount)+'</b></div><div class="bg-slate-50 rounded-lg p-2"><div class="text-[10px] text-slate-500">Pembayaran masuk</div><b class="text-xs">'+money(pay.paid)+'</b></div><div class="bg-slate-50 rounded-lg p-2"><div class="text-[10px] text-slate-500">Kekurangan DP</div><b class="text-xs '+(shortfall?'text-amber-700':'text-emerald-700')+'">'+money(shortfall)+'</b></div><div class="bg-slate-50 rounded-lg p-2"><div class="text-[10px] text-slate-500">Sisa seluruh invoice</div><b class="text-xs">'+money(pay.invoiceBalance)+'</b></div></div><div class="text-[11px] text-slate-500">'+pay.invoiceCount+' invoice terkait · '+(pay.depositSatisfied?'DP memenuhi syarat':'Produksi menunggu DP terverifikasi')+'</div>'+materialPlanHtml(order,d,stockBalances)+'<div class="flex flex-wrap gap-2">'+invoiceButton+'<button data-so-action="project" data-id="'+esc(order.id)+'" class="px-3 py-2 rounded-lg border text-[11px] font-bold">Buka Proyek</button>'+actionHtml+'</div>'+(history?'<details class="border-t pt-2"><summary class="text-[11px] font-semibold text-slate-600 cursor-pointer">Riwayat perubahan status</summary><ul class="mt-2 space-y-1">'+history+'</ul></details>':'')+'</article>';
  }).join('');
  html+='</section>';
  page.innerHTML=html;
  var select=el('so-filter');if(select)select.addEventListener('change',function(){filter=this.value;renderSalesOrders();});
  ensureBound();
 }catch(error){page.innerHTML='<div class="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">'+esc(error.message||String(error))+'</div>';}
}
w.renderSalesOrders=renderSalesOrders;
w.downloadMaterialUsageReport=downloadMaterialUsageReport;
w.createSalesOrderFromQuotation=createSalesOrderFromQuotation;
w.updateSalesOrderStatus=updateSalesOrderStatus;
})(window);
