'use strict';
(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.CSKInventoryEngine=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
  var MOVEMENTS={
    opening:{label:'Saldo awal',direction:1},
    receipt:{label:'Penerimaan',direction:1},
    return:{label:'Retur dari proyek',direction:1},
    issue:{label:'Pengeluaran ke proyek',direction:-1},
    adjustment_in:{label:'Penyesuaian masuk',direction:1},
    adjustment_out:{label:'Penyesuaian keluar',direction:-1}
  };
  function n(value){var x=Number(value);return Number.isFinite(x)?x:0;}
  function localDate(value){
    var d=value instanceof Date?value:new Date(value||Date.now());
    return[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
  }
  function nextTransactionNumber(rows,date){
    var year=String(date||localDate()).slice(0,4);
    var pattern=new RegExp('^STK-CSK-'+year+'-(\\d+)$'),max=0;
    (Array.isArray(rows)?rows:[]).forEach(function(row){var m=pattern.exec(String(row.transactionNo||''));if(m)max=Math.max(max,Number(m[1])||0);});
    return'STK-CSK-'+year+'-'+String(max+1).padStart(5,'0');
  }
  function sortTransactions(rows){
    return(Array.isArray(rows)?rows:[]).slice().sort(function(a,b){
      var dateA=String(a.date||'').slice(0,10),dateB=String(b.date||'').slice(0,10);
      if(dateA!==dateB)return dateA.localeCompare(dateB);
      var createdA=String(a.createdAt||''),createdB=String(b.createdAt||'');
      if(createdA!==createdB)return createdA.localeCompare(createdB);
      return String(a.id||'').localeCompare(String(b.id||''));
    });
  }
  function calculateBalances(materials,transactions){
    var materialMap=new Map((Array.isArray(materials)?materials:[]).map(function(m){return[String(m.id),m];}));
    var balances={},openingSeen={},movementSeen={};
    sortTransactions(transactions).forEach(function(tx){
      var materialId=String(tx.materialId||''),material=materialMap.get(materialId);
      if(!material)throw new Error('Transaksi stok mengacu pada material yang tidak terdaftar: '+materialId);
      var movement=MOVEMENTS[String(tx.movement||'')];
      if(!movement)throw new Error('Jenis pergerakan stok tidak dikenal.');
      var qty=n(tx.qty);
      if(!Number.isFinite(Number(tx.qty))||qty<=0)throw new Error('Kuantitas transaksi stok harus lebih dari nol.');
      if(String(tx.unit||'')!==String(material.unit||''))throw new Error('Satuan transaksi harus sama dengan satuan stok material ('+(material.unit||'-')+').');
      if(tx.movement==='opening'){
        if(openingSeen[materialId])throw new Error('Saldo awal hanya boleh dicatat satu kali untuk setiap material.');
        if(movementSeen[materialId])throw new Error('Saldo awal harus menjadi transaksi stok pertama material.');
        openingSeen[materialId]=true;
      }
      movementSeen[materialId]=true;
      var before=n(balances[materialId]),after=before+(qty*movement.direction);
      if(after< -0.000001)throw new Error('Stok tidak mencukupi untuk '+(material.name||materialId)+'. Stok tersedia '+before+' '+(material.unit||'')+'.');
      balances[materialId]=Math.max(0,after);
    });
    return balances;
  }
  function validateTransaction(input,context){
    context=context||{};
    var materials=Array.isArray(context.materials)?context.materials:[];
    var projects=Array.isArray(context.projects)?context.projects:[];
    var existing=Array.isArray(context.transactions)?context.transactions:[];
    var material=materials.find(function(m){return String(m.id)===String(input&&input.materialId||'');});
    if(!material)throw new Error('Pilih material yang terdaftar.');
    if(String(material.status||'active')!=='active')throw new Error('Material belum aktif. Lengkapi dan verifikasi Master Bahan Baku terlebih dahulu.');
    if(!String(material.unit||'').trim())throw new Error('Master Material belum memiliki satuan stok. Lengkapi satuan terlebih dahulu.');
    if(!MOVEMENTS[input.movement])throw new Error('Pilih jenis transaksi stok yang valid.');
    var qty=Number(input.qty);
    if(!Number.isFinite(qty)||qty<=0)throw new Error('Kuantitas harus lebih dari nol.');
    if(String(input.unit||'')!==String(material.unit||''))throw new Error('Satuan harus mengikuti satuan stok material: '+(material.unit||'-')+'.');
    var date=String(input.date||'');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error('Tanggal transaksi tidak valid.');
    var projectId=String(input.projectId||''),salesOrderId=String(input.salesOrderId||''),reservationId=String(input.reservationId||'');
    if(['issue','return'].indexOf(input.movement)>=0&&!projects.some(function(p){return String(p.id)===projectId;}))throw new Error('Pilih proyek untuk pengeluaran atau retur material.');
    if(salesOrderId&&['issue','return'].indexOf(input.movement)<0)throw new Error('Sales Order hanya dapat ditautkan pada pengeluaran atau retur material.');
    if(salesOrderId&&!reservationId)throw new Error('Pilih reservasi stok yang akan digunakan.');
    if(reservationId&&!salesOrderId)throw new Error('Referensi reservasi harus terhubung dengan Sales Order.');
    var salesOrders=Array.isArray(context.salesOrders)?context.salesOrders:[];
    if(salesOrderId){
      var salesOrder=salesOrders.find(function(order){return String(order.id)===salesOrderId;});
      if(!salesOrder||['ready_production','in_production','quality_check','ready_delivery'].indexOf(String(salesOrder.status||'').toLowerCase())<0)throw new Error('Sales Order tidak berada pada tahap produksi yang dapat menerima pengeluaran atau retur material.');
      if(String(salesOrder.projectId||'')!==projectId)throw new Error('Proyek transaksi tidak sesuai dengan Sales Order yang dipilih.');
    }
    var terminalSalesOrders=Object.create(null);
    salesOrders.forEach(function(order){
      if(['cancelled','delivered','closed'].indexOf(String(order.status||'').toLowerCase())>=0)terminalSalesOrders[String(order.id||'')]=true;
    });
    var reservationRows=(Array.isArray(context.inventoryReservations)?context.inventoryReservations:[]).filter(function(row){
      return ['active','consumed'].indexOf(String(row.status))>=0&&String(row.materialId)===String(material.id)&&!terminalSalesOrders[String(row.salesOrderId||'')];
    });
    function netIssuedForReservation(row){
      return existing.filter(function(tx){return String(tx.reservationId||'')===String(row.id||'');}).reduce(function(sum,tx){
        if(tx.movement==='issue')return sum+n(tx.qty);
        if(tx.movement==='return')return sum-n(tx.qty);
        return sum;
      },0);
    }
    function remainingReservation(row){
      return Math.max(0,n(row.qty)-Math.max(0,netIssuedForReservation(row)));
    }
    var totalReserved=reservationRows.reduce(function(sum,row){return sum+remainingReservation(row);},0);
    if(salesOrderId){
      var linkedReservation=reservationRows.find(function(row){return String(row.salesOrderId)===salesOrderId&&String(row.id)===reservationId;});
      if(!linkedReservation)throw new Error('Sales Order belum memiliki reservasi yang dapat digunakan untuk transaksi ini.');
      var reservedForOrder=remainingReservation(linkedReservation);
      var netIssued= Math.max(0,netIssuedForReservation(linkedReservation));
      if(input.movement==='issue'){
        if(reservedForOrder<=0.000001)throw new Error('Sales Order belum memiliki sisa reservasi aktif untuk material ini.');
        if(qty>reservedForOrder+0.000001)throw new Error('Kuantitas pengeluaran melebihi sisa reservasi Sales Order.');
      }else{
        if(netIssued<=0.000001)throw new Error('Belum ada material yang dikeluarkan dari reservasi ini untuk diretur.');
        if(qty>netIssued+0.000001)throw new Error('Kuantitas retur melebihi jumlah yang sudah dikeluarkan dari reservasi ini.');
      }
    }
    if(input.movement==='return'&&!salesOrderId){
      var unlinkedReservation=reservationRows.find(function(row){
        var linkedOrder=salesOrders.find(function(order){return String(order.id)===String(row.salesOrderId||'');});
        var rowProject=String(row.projectId||linkedOrder&&linkedOrder.projectId||'');
        return rowProject===projectId&&Math.max(0,netIssuedForReservation(row))>0.000001;
      });
      if(unlinkedReservation)throw new Error('Retur material dari Sales Order harus ditautkan ke Sales Order dan ID reservasi yang sama.');
    }
    if(['adjustment_in','adjustment_out'].indexOf(input.movement)>=0&&!String(input.notes||'').trim())throw new Error('Alasan penyesuaian stok wajib diisi.');
    if(input.movement==='receipt'&&!String(input.supplier||'').trim()&&!String(input.purchaseOrderId||'').trim())throw new Error('Isi supplier atau nomor Purchase Order untuk penerimaan.');
    if(input.movement==='receipt'&&String(input.purchaseOrderId||'').trim()){
      var po=(Array.isArray(context.purchaseOrders)?context.purchaseOrders:[]).find(function(p){return String(p.id)===String(input.purchaseOrderId);});
      if(!po||['ordered','received'].indexOf(String(po.status||'').toLowerCase())<0)throw new Error('Purchase Order harus berstatus Dipesan sebelum penerimaan dicatat.');
      var poItems=Array.isArray(po.items)?po.items:[];
      var matching=poItems.filter(function(item){return String(item.materialId)===String(material.id);});
      if(!matching.length)throw new Error('Material tidak tercantum pada Purchase Order yang dipilih.');
      matching.forEach(function(item){
        if(item.purchaseUnit){
          if(String(item.purchaseUnit)!==String(material.purchaseUnit||material.unit||'')||String(item.usageUnit||'')!==String(material.unit||''))throw new Error('Satuan beli atau satuan pakai pada Purchase Order tidak sesuai master material.');
          if(!Number.isFinite(Number(item.conversionFactor))||Number(item.conversionFactor)<=0)throw new Error('Faktor konversi pada Purchase Order tidak valid.');
        }else if(String(item.unit||'')!==String(material.unit||'')){
          throw new Error('Satuan item Purchase Order lama tidak sama dengan satuan stok material.');
        }
      });
      var orderedQty=matching.reduce(function(sum,item){return sum+n(item.qty)*(item.purchaseUnit?(Number(item.conversionFactor)||0):1);},0);
      var receivedQty=existing.filter(function(tx){return String(tx.purchaseOrderId||'')===String(po.id)&&String(tx.materialId)===String(material.id)&&tx.movement==='receipt';}).reduce(function(sum,tx){return sum+n(tx.qty);},0);
      if(receivedQty+qty>orderedQty+0.000001)throw new Error('Jumlah penerimaan melebihi sisa kuantitas Purchase Order.');
    }
    if(input.movement==='opening'&&existing.some(function(tx){return String(tx.materialId)===String(material.id)&&tx.movement==='opening';}))throw new Error('Saldo awal material ini sudah pernah dicatat.');
    var transaction={
      id:String(input.id||'ITX-'+Date.now()+'-'+Math.random().toString(36).slice(2,8).toUpperCase()),
      transactionNo:String(input.transactionNo||nextTransactionNumber(existing,date)),
      materialId:String(material.id),materialName:String(material.name||''),
      movement:String(input.movement),qty:qty,unit:String(material.unit||''),
      date:date,projectId:projectId,projectName:String((projects.find(function(p){return String(p.id)===projectId;})||{}).title||''),
      purchaseOrderId:String(input.purchaseOrderId||''),salesOrderId:salesOrderId,reservationId:reservationId,supplier:String(input.supplier||''),
      reference:String(input.reference||''),notes:String(input.notes||''),
      createdAt:String(input.createdAt||new Date().toISOString()),createdBy:String(input.createdBy||'Owner')
    };
    if(transaction.notes.length>500||transaction.reference.length>120||transaction.supplier.length>160)throw new Error('Catatan, referensi, atau supplier terlalu panjang.');
    var balances=calculateBalances(materials,existing.concat([transaction]));
    if(['issue','return','adjustment_out'].indexOf(input.movement)>=0){
      var reservedAfter=totalReserved;
      if(salesOrderId&&input.movement==='issue')reservedAfter=Math.max(0,reservedAfter-qty);
      if(salesOrderId&&input.movement==='return')reservedAfter+=qty;
      if(n(balances[material.id])<reservedAfter-0.000001)throw new Error('Stok tidak cukup untuk pengeluaran ini karena sebagian stok sedang dikunci oleh Sales Order lain.');
    }
    return{transaction:transaction,balances:balances};
  }
  function calculateHppRequirements(costSheet,materials,balances){
    if(!costSheet)return{hasHpp:false,requirements:[],errors:['HPP proyek belum dibuat.'],ready:false};
    var materialMap=new Map((Array.isArray(materials)?materials:[]).map(function(m){return[String(m.id),m];}));
    var grouped={},errors=[];
    (Array.isArray(costSheet.items)?costSheet.items:[]).forEach(function(item,index){
      if(item.serviceId||item.itemType==='service'||!item.materialId)return;
      var material=materialMap.get(String(item.materialId));
      if(!material){errors.push('Item '+(item.name||('#'+(index+1)))+' tidak ditemukan di Master Material.');return;}
      var qty=Number(item.qty),lineUnit=String(item.unit||'').trim().toLowerCase();
      if(!Number.isFinite(qty)||qty<=0){errors.push('Kuantitas HPP untuk '+material.name+' tidak valid.');return;}
      var snapshot=item.materialSnapshot&&typeof item.materialSnapshot==='object'?item.materialSnapshot:null;
      var stockUnit=String(snapshot&&snapshot.unit||material.unit||'').trim(),purchaseUnit=String(snapshot&&snapshot.purchaseUnit||material.purchaseUnit||'').trim();
      if(snapshot&&snapshot.unit&&material.unit&&String(snapshot.unit).trim().toLowerCase()!==String(material.unit).trim().toLowerCase()){
        errors.push('Satuan stok Master Material berubah sejak HPP disimpan untuk '+(material.name||item.name||'#'+(index+1))+'. Periksa ulang HPP sebelum membuat PO.');return;
      }
      var stockQty=0;
      if(lineUnit===stockUnit.toLowerCase())stockQty=qty;
      else if(lineUnit===purchaseUnit.toLowerCase()){
        var hasSnapshotFactor=snapshot&&Object.prototype.hasOwnProperty.call(snapshot,'conversionFactor');
        var factor=hasSnapshotFactor?Number(snapshot.conversionFactor):Number(material.conversionFactor);
        if(!Number.isFinite(factor)||factor<=0){errors.push('Faktor konversi '+material.name+' belum valid.');return;}
        stockQty=qty*factor;
      }else{
        errors.push('Satuan HPP '+item.unit+' untuk '+material.name+' tidak cocok dengan satuan stok '+stockUnit+' atau satuan beli '+purchaseUnit+'.');
        return;
      }
      var wasteRate=snapshot&&Object.prototype.hasOwnProperty.call(snapshot,'wasteRate')?Number(snapshot.wasteRate):(snapshot?0:n(material.wasteRate));
      if(!Number.isFinite(wasteRate)||wasteRate<0||wasteRate>100){errors.push('Waste allowance '+material.name+' harus 0 sampai 100 persen.');return;}
      stockQty*=1+wasteRate/100;
      var key=String(material.id);
      if(!grouped[key])grouped[key]={materialId:material.id,name:String(snapshot&&snapshot.name||material.name||item.name||''),unit:stockUnit,required:0,onHand:n((balances||{})[key])};
      grouped[key].required+=stockQty;
    });
    var requirements=Object.keys(grouped).map(function(key){
      var row=grouped[key];row.shortage=Math.max(0,row.required-row.onHand);row.remaining=row.onHand-row.required;row.ready=row.shortage<=0;return row;
    }).sort(function(a,b){return String(a.name).localeCompare(String(b.name));});
    return{hasHpp:true,requirements:requirements,errors:errors,ready:errors.length===0&&requirements.length>0&&requirements.every(function(row){return row.ready;}),materialCount:requirements.length};
  }
  function calculateOpenSalesOrderCommitments(salesOrders,costSheets,materials,transactions,balances){
    var activeStatuses={ready_production:true,in_production:true,quality_check:true,ready_delivery:true};
    var orders=Array.isArray(salesOrders)?salesOrders:[],sheets=Array.isArray(costSheets)?costSheets:[],materialRows=Array.isArray(materials)?materials:[],ledger=Array.isArray(transactions)?transactions:[];
    var activeProjects=Object.create(null),activeOrderCount=0,errors=[],grouped=Object.create(null);
    orders.forEach(function(order){
      var status=String(order&&order.status||'').toLowerCase(),projectId=String(order&&order.projectId||'');
      if(!activeStatuses[status]||!projectId)return;
      activeOrderCount++;
      if(!activeProjects[projectId])activeProjects[projectId]={projectId:projectId,projectName:String(order.projectName||''),orderCount:0,orders:[]};
      activeProjects[projectId].orderCount++;
      activeProjects[projectId].orders.push(order);
      if(!activeProjects[projectId].projectName)activeProjects[projectId].projectName=String(order.projectName||'');
    });
    var projectIds=Object.keys(activeProjects);
    projectIds.forEach(function(projectId){
      var project=activeProjects[projectId],requiredByMaterial=Object.create(null);
      function addSheetPlan(sheet,label){
        if(!sheet){errors.push('HPP belum tersedia untuk proyek '+(project.projectName||projectId)+(label?' · '+label:'')+'.');return;}
        var plan=calculateHppRequirements(sheet,materialRows,{});
        if(plan.errors.length){plan.errors.forEach(function(error){errors.push((project.projectName||projectId)+(label?' · '+label:'')+': '+error);});return;}
        if(!plan.requirements.length){errors.push('HPP proyek '+(project.projectName||projectId)+(label?' · '+label:'')+' belum memiliki kebutuhan material yang dapat dihitung.');return;}
        plan.requirements.forEach(function(requirement){
          var materialId=String(requirement.materialId);
          if(!requiredByMaterial[materialId])requiredByMaterial[materialId]={materialId:requirement.materialId,name:requirement.name,unit:requirement.unit,required:0};
          requiredByMaterial[materialId].required+=requirement.required;
        });
      }
      var snapshotOrders=project.orders.filter(function(order){return order.sourceCostSheetSnapshot&&typeof order.sourceCostSheetSnapshot==='object';});
      var legacyOrders=project.orders.filter(function(order){return !order.sourceCostSheetSnapshot||typeof order.sourceCostSheetSnapshot!=='object';});
      snapshotOrders.forEach(function(order){addSheetPlan(order.sourceCostSheetSnapshot,order.orderNo||order.id||'snapshot HPP');});
      if(legacyOrders.length){
        var currentSheet=sheets.find(function(row){return String(row.projectId)===projectId;});
        addSheetPlan(currentSheet,legacyOrders.length+' Sales Order lama tanpa snapshot');
      }
      var issued=Object.create(null);
      ledger.forEach(function(tx){
        if(String(tx.projectId||'')!==projectId)return;
        var materialId=String(tx.materialId||'');
        if(tx.movement==='issue')issued[materialId]=(issued[materialId]||0)+n(tx.qty);
        else if(tx.movement==='return')issued[materialId]=(issued[materialId]||0)-n(tx.qty);
      });
      Object.keys(requiredByMaterial).forEach(function(materialId){
        var requirement=requiredByMaterial[materialId],netIssued=Math.max(0,issued[materialId]||0),outstanding=Math.max(0,requirement.required-netIssued);
        if(!grouped[materialId])grouped[materialId]={materialId:requirement.materialId,name:requirement.name,unit:requirement.unit,onHand:n((balances||{})[materialId]),committed:0,projects:[]};
        grouped[materialId].committed+=outstanding;
        grouped[materialId].projects.push({projectId:projectId,projectName:project.projectName||projectId,orderCount:project.orderCount,required:requirement.required,netIssued:netIssued,outstanding:outstanding});
      });
    });
    var requirements=Object.keys(grouped).map(function(materialId){
      var row=grouped[materialId];
      row.availableAfterCommitments=row.onHand-row.committed;
      row.shortage=Math.max(0,row.committed-row.onHand);
      row.projects.sort(function(a,b){return String(a.projectName).localeCompare(String(b.projectName));});
      return row;
    }).sort(function(a,b){return String(a.name).localeCompare(String(b.name));});
    return{activeOrderCount:activeOrderCount,activeProjectCount:projectIds.length,requirements:requirements,errors:errors,ready:errors.length===0};
  }
  function calculateReorderSuggestions(materials,balances,commitments){
    var commitmentMap=Object.create(null);
    (Array.isArray(commitments)?commitments:[]).forEach(function(row){commitmentMap[String(row.materialId)]=n(row.committed);});
    return(Array.isArray(materials)?materials:[]).filter(function(material){
      return String(material.status||'active')==='active'&&Number.isFinite(Number(material.reorderPoint))&&Number(material.reorderPoint)>0;
    }).map(function(material){
      var id=String(material.id),onHand=n((balances||{})[id]),committed=n(commitmentMap[id]),available=onHand-committed,threshold=n(material.reorderPoint);
      return{materialId:id,sku:String(material.sku||''),name:String(material.name||id),unit:String(material.unit||''),onHand:onHand,committed:committed,available:available,reorderPoint:threshold,shortage:Math.max(0,threshold-available),needsReorder:available<threshold};
    }).filter(function(row){return row.needsReorder;}).sort(function(a,b){return b.shortage-a.shortage||a.name.localeCompare(b.name);});
  }
  function getBalance(materialId,balances){return n((balances||{})[String(materialId)]);}
  function movementLabel(value){return MOVEMENTS[value]?MOVEMENTS[value].label:String(value||'-');}
  return{MOVEMENTS:MOVEMENTS,localDate:localDate,nextTransactionNumber:nextTransactionNumber,sortTransactions:sortTransactions,calculateBalances:calculateBalances,validateTransaction:validateTransaction,getBalance:getBalance,calculateHppRequirements:calculateHppRequirements,calculateOpenSalesOrderCommitments:calculateOpenSalesOrderCommitments,calculateReorderSuggestions:calculateReorderSuggestions,movementLabel:movementLabel};
});
