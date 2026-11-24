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
  function calculateInventoryValuation(materials,transactions){
    var materialMap=new Map((Array.isArray(materials)?materials:[]).map(function(m){return[String(m.id),m];}));
    var state=Object.create(null),transactionCosts=Object.create(null);
    sortTransactions(transactions).forEach(function(tx){
      var id=String(tx.materialId||''),material=materialMap.get(id),movement=MOVEMENTS[String(tx.movement||'')];
      if(!material||!movement)return;
      var current=state[id]||{qty:0,value:0,estimated:false,complete:true};
      var qty=n(tx.qty),beforeQty=current.qty,beforeValue=current.value;
      var average=beforeQty>0.000001?beforeValue/beforeQty:0;
      var masterCost=n(material.unitPrice),storedCost=n(tx.unitCost);
      var unitCost=storedCost,estimated=!!(tx.costSource==='master_fallback'||tx.costSource==='legacy_master_fallback'),complete=true;
      if(unitCost<=0){
        if(['issue','return','adjustment_out'].indexOf(String(tx.movement))>=0)unitCost=average||masterCost;
        else if(tx.movement==='adjustment_in'&&beforeQty>0)unitCost=average||masterCost;
        else unitCost=masterCost;
        estimated=true;
      }
      if(unitCost<=0){complete=false;unitCost=0;}
      var totalCost=n(tx.totalCost);
      if(totalCost<=0&&unitCost>0){totalCost=Math.round(qty*unitCost);estimated=true;}
      if(unitCost>0&&totalCost>0&&Math.abs(totalCost-qty*unitCost)>1.01)complete=false;
      var signedValue=movement.direction*totalCost;
      var afterQty=beforeQty+(movement.direction*qty);
      var afterValue=beforeValue+signedValue;
      if(afterQty< -0.000001)throw new Error('Stok tidak mencukupi saat menghitung valuasi '+(material.name||id)+'.');
      if(afterQty<=0.000001){afterQty=0;afterValue=0;}
      if(afterValue< -1.01){complete=false;estimated=true;afterValue=0;}
      current={qty:Math.max(0,afterQty),value:Math.max(0,afterValue),estimated:afterQty>0?(current.estimated||estimated):false,complete:afterQty>0?(current.complete&&complete):true};
      state[id]=current;
      transactionCosts[String(tx.id||'')]={
        unitCost:unitCost,totalCost:totalCost,estimated:estimated,complete:complete,
        costSource:String(tx.costSource|| (estimated?'legacy_master_fallback':'recorded'))
      };
    });
    var balances={},stockValue={},averageCost={},estimated={},valuationComplete={},valuationByMaterial={};
    Object.keys(state).forEach(function(id){
      var row=state[id],avg=row.qty>0?row.value/row.qty:0;
      balances[id]=row.qty;stockValue[id]=Math.round(row.value);averageCost[id]=Math.round(avg*10000)/10000;
      estimated[id]=row.estimated;valuationComplete[id]=row.complete;
      valuationByMaterial[id]={qty:row.qty,stockValue:Math.round(row.value),averageCost:averageCost[id],estimated:row.estimated,complete:row.complete};
    });
    return{balances:balances,stockValue:stockValue,averageCost:averageCost,estimated:estimated,complete:valuationComplete,byMaterial:valuationByMaterial,transactionCosts:transactionCosts};
  }
  function calculateProjectNetIssueCost(projectId,materialId,transactions,valuation){
    var project=String(projectId||''),material=String(materialId||''),netQty=0,netCost=0,estimated=false;
    var costs=valuation&&valuation.transactionCosts||{};
    sortTransactions(transactions).forEach(function(tx){
      if(String(tx.projectId||'')!==project||String(tx.materialId||'')!==material||['issue','return'].indexOf(String(tx.movement||''))<0)return;
      var qty=n(tx.qty),snapshot=costs[String(tx.id||'')]||{};
      var unitCost=n(snapshot.unitCost)||n(tx.unitCost),totalCost=n(snapshot.totalCost)||n(tx.totalCost);
      if(totalCost<=0&&unitCost>0)totalCost=Math.round(qty*unitCost);
      if(snapshot.estimated||tx.costSource==='master_fallback'||tx.costSource==='legacy_master_fallback')estimated=true;
      if(tx.movement==='issue'){netQty+=qty;netCost+=totalCost;}
      else{netQty-=qty;netCost-=totalCost;}
    });
    netQty=Math.max(0,netQty);netCost=Math.max(0,netCost);
    return{qty:netQty,totalCost:netCost,averageCost:netQty>0?netCost/netQty:0,estimated:estimated};
  }
  function validateTransaction(input,context){
    context=context||{};
    var materials=Array.isArray(context.materials)?context.materials:[];
    var projects=Array.isArray(context.projects)?context.projects:[];
    var existing=Array.isArray(context.transactions)?context.transactions:[];
    var material=materials.find(function(m){return String(m.id)===String(input&&input.materialId||'');});
    if(!material)throw new Error('Pilih material yang terdaftar.');
    if(!String(material.unit||'').trim())throw new Error('Master Material belum memiliki satuan stok. Lengkapi satuan terlebih dahulu.');
    if(!MOVEMENTS[input.movement])throw new Error('Pilih jenis transaksi stok yang valid.');
    var qty=Number(input.qty);
    if(!Number.isFinite(qty)||qty<=0)throw new Error('Kuantitas harus lebih dari nol.');
    if(String(input.unit||'')!==String(material.unit||''))throw new Error('Satuan harus mengikuti satuan stok material: '+(material.unit||'-')+'.');
    var date=String(input.date||'');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error('Tanggal transaksi tidak valid.');
    var latestForMaterial=sortTransactions(existing.filter(function(tx){return String(tx.materialId)===String(material.id);})).slice(-1)[0];
    if(latestForMaterial&&date<String(latestForMaterial.date||''))throw new Error('Tanggal transaksi tidak boleh lebih awal dari transaksi stok terakhir material ini. Catat transaksi secara kronologis agar valuasi rata-rata tidak berubah surut.');
    var projectId=String(input.projectId||'');
    if(['issue','return'].indexOf(input.movement)>=0&&!projects.some(function(p){return String(p.id)===projectId;}))throw new Error('Pilih proyek untuk pengeluaran atau retur material.');
    if(['adjustment_in','adjustment_out'].indexOf(input.movement)>=0&&!String(input.notes||'').trim())throw new Error('Alasan penyesuaian stok wajib diisi.');
    if(input.movement==='receipt'&&!String(input.supplier||'').trim()&&!String(input.purchaseOrderId||'').trim())throw new Error('Isi supplier atau nomor Purchase Order untuk penerimaan.');
    if(input.movement==='receipt'&&String(input.purchaseOrderId||'').trim()){
      var po=(Array.isArray(context.purchaseOrders)?context.purchaseOrders:[]).find(function(p){return String(p.id)===String(input.purchaseOrderId);});
      if(!po||['ordered','received'].indexOf(String(po.status||'').toLowerCase())<0)throw new Error('Purchase Order harus berstatus Dipesan sebelum penerimaan dicatat.');
      var poItems=Array.isArray(po.items)?po.items:[];
      var matching=poItems.filter(function(item){return String(item.materialId)===String(material.id);});
      if(!matching.length)throw new Error('Material tidak tercantum pada Purchase Order yang dipilih.');
      if(matching.some(function(item){return String(item.unit||'')!==String(material.unit||'');}))throw new Error('Satuan item Purchase Order tidak sama dengan satuan stok material.');
      var orderedQty=matching.reduce(function(sum,item){return sum+n(item.qty);},0);
      var receivedQty=existing.filter(function(tx){return String(tx.purchaseOrderId||'')===String(po.id)&&String(tx.materialId)===String(material.id)&&tx.movement==='receipt';}).reduce(function(sum,tx){return sum+n(tx.qty);},0);
      if(receivedQty+qty>orderedQty+0.000001)throw new Error('Jumlah penerimaan melebihi sisa kuantitas Purchase Order.');
    }
    if(input.movement==='opening'&&existing.some(function(tx){return String(tx.materialId)===String(material.id)&&tx.movement==='opening';}))throw new Error('Saldo awal material ini sudah pernah dicatat.');
    var valuationBefore=calculateInventoryValuation(materials,existing);
    var averageBefore=n(valuationBefore.averageCost[String(material.id)]);
    var masterUnitCost=n(material.unitPrice);
    var suppliedUnitCost=n(input.unitCost);
    var poUnitCost=0;
    if(input.movement==='receipt'&&String(input.purchaseOrderId||'').trim()){
      var selectedPO=(Array.isArray(context.purchaseOrders)?context.purchaseOrders:[]).find(function(po){return String(po.id)===String(input.purchaseOrderId);});
      var selectedItems=Array.isArray(selectedPO&&selectedPO.items)?selectedPO.items:[];
      var selectedLines=selectedItems.filter(function(item){return String(item.materialId)===String(material.id);});
      var selectedQty=selectedLines.reduce(function(sum,item){return sum+n(item.qty);},0);
      var selectedCost=selectedLines.reduce(function(sum,item){return sum+n(item.qty)*n(item.unitPrice);},0);
      poUnitCost=selectedQty>0?selectedCost/selectedQty:0;
    }
    var unitCost=0,costSource='';
    if(input.movement==='opening'){
      if(suppliedUnitCost<=0)throw new Error('Masukkan harga pokok saldo awal per satuan stok berdasarkan nilai persediaan yang dapat dipertanggungjawabkan.');
      if(!String(input.reference||'').trim())throw new Error('Nomor dokumen atau dasar penilaian saldo awal wajib diisi.');
      unitCost=suppliedUnitCost;
      costSource='opening_manual';
    }else if(input.movement==='receipt'){
      if(String(input.purchaseOrderId||'').trim()&&poUnitCost>0){
        unitCost=poUnitCost;
        costSource='purchase_order';
      }else{
        if(suppliedUnitCost<=0)throw new Error('Masukkan harga pokok penerimaan per satuan stok berdasarkan nota atau faktur supplier.');
        if(!String(input.reference||'').trim())throw new Error('Nomor nota, faktur, atau surat jalan wajib diisi untuk penerimaan manual.');
        unitCost=suppliedUnitCost;
        costSource='manual_receipt';
      }
    }else if(input.movement==='return'){
      var projectIssueCost=calculateProjectNetIssueCost(projectId,material.id,existing,valuationBefore);
      unitCost=projectIssueCost.averageCost||averageBefore||masterUnitCost;
      costSource=projectIssueCost.averageCost>0?(projectIssueCost.estimated?'master_fallback':'project_issue_average'):averageBefore>0?(valuationBefore.estimated[String(material.id)]?'master_fallback':'moving_average'):'master_fallback';
    }else if(input.movement==='adjustment_in'&&averageBefore<=0){
      if(suppliedUnitCost<=0)throw new Error('Masukkan dasar biaya untuk penyesuaian stok masuk.');
      if(!String(input.reference||'').trim())throw new Error('Referensi penilaian penyesuaian stok masuk wajib diisi.');
      unitCost=suppliedUnitCost;
      costSource='opening_manual';
    }else{
      unitCost=averageBefore||masterUnitCost;
      costSource=averageBefore>0?(valuationBefore.estimated[String(material.id)]?'master_fallback':'moving_average'):'master_fallback';
    }
    if(!Number.isFinite(unitCost)||unitCost<=0)throw new Error('Harga pokok per satuan stok belum tersedia. Isi harga pokok Master Material atau harga transaksi terlebih dahulu.');
    unitCost=Math.round(unitCost*10000)/10000;
    var totalCost=Math.round(qty*unitCost);
    var transaction={
      id:String(input.id||'ITX-'+Date.now()+'-'+Math.random().toString(36).slice(2,8).toUpperCase()),
      transactionNo:String(input.transactionNo||nextTransactionNumber(existing,date)),
      materialId:String(material.id),materialName:String(material.name||''),
      movement:String(input.movement),qty:qty,unit:String(material.unit||''),
      date:date,projectId:projectId,projectName:String((projects.find(function(p){return String(p.id)===projectId;})||{}).title||''),
      purchaseOrderId:String(input.purchaseOrderId||''),supplier:String(input.supplier||''),
      unitCost:unitCost,totalCost:totalCost,costSource:costSource,costingMethod:'moving_average',
      reference:String(input.reference||''),notes:String(input.notes||''),
      createdAt:String(input.createdAt||new Date().toISOString()),createdBy:String(input.createdBy||'Owner')
    };
    if(transaction.notes.length>500||transaction.reference.length>120||transaction.supplier.length>160)throw new Error('Catatan, referensi, atau supplier terlalu panjang.');
    if(transaction.movement==='return'){
      var netIssued=existing.filter(function(tx){return String(tx.projectId||'')===projectId&&String(tx.materialId)===String(material.id);}).reduce(function(sum,tx){if(tx.movement==='issue')return sum+n(tx.qty);if(tx.movement==='return')return sum-n(tx.qty);return sum;},0);
      if(qty>Math.max(0,netIssued)+0.000001)throw new Error('Retur melebihi material yang pernah dikeluarkan ke proyek.');
    }
    if(transaction.movement==='issue'){
      var salesOrders=Array.isArray(context.salesOrders)?context.salesOrders:[];
      var activeProject=salesOrders.some(function(order){return String(order.projectId)===projectId&&['ready_production','in_production'].indexOf(String(order.status||''))>=0;});
      var balancesBefore=calculateBalances(materials,existing);
      var reservationsBefore=calculateOpenSalesOrderCommitments(salesOrders,context.costSheets,materials,existing,balancesBefore);
      if(reservationsBefore.errors.length)throw new Error('Reservasi material proyek belum valid: '+reservationsBefore.errors.join(' '));
      if(activeProject){
        var reservedLine=null;
        reservationsBefore.requirements.some(function(row){return String(row.materialId)===String(material.id)&&row.projects.some(function(line){if(String(line.projectId)===projectId){reservedLine=line;return true;}return false;});});
        if(!reservedLine)throw new Error('Material tidak tercantum dalam reservasi HPP proyek aktif.');
        if(qty>reservedLine.outstanding+0.000001)throw new Error('Pengeluaran melebihi sisa reservasi proyek ('+reservedLine.outstanding+' '+material.unit+').');
      }
    }
    var balances=calculateBalances(materials,existing.concat([transaction]));
    if(transaction.movement==='issue'){
      var reservationsAfter=calculateOpenSalesOrderCommitments(context.salesOrders,context.costSheets,materials,existing.concat([transaction]),balances);
      if(reservationsAfter.errors.length)throw new Error('Reservasi material proyek belum valid: '+reservationsAfter.errors.join(' '));
      reservationsAfter.requirements.forEach(function(row){
        if(row.committed>n(balances[row.materialId])+0.000001)throw new Error('Pengeluaran akan mengurangi stok yang sudah direservasi proyek lain untuk '+row.name+'.');
      });
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
      var stockUnit=String(material.unit||'').trim(),purchaseUnit=String(material.purchaseUnit||'').trim();
      var stockQty=0;
      if(lineUnit===stockUnit.toLowerCase())stockQty=qty;
      else if(lineUnit===purchaseUnit.toLowerCase()){
        var factor=Number(material.conversionFactor);
        if(!Number.isFinite(factor)||factor<=0){errors.push('Faktor konversi '+material.name+' belum valid.');return;}
        stockQty=qty*factor;
      }else{
        errors.push('Satuan HPP '+item.unit+' untuk '+material.name+' tidak cocok dengan satuan stok '+stockUnit+' atau satuan beli '+purchaseUnit+'.');
        return;
      }
      var key=String(material.id);
      var lineCost=n(item.subtotal);
      if(lineCost<=0&&n(item.unitPrice)>0)lineCost=qty*n(item.unitPrice);
      if(!grouped[key])grouped[key]={materialId:material.id,name:material.name,unit:stockUnit,required:0,onHand:n((balances||{})[key]),estimatedTotalCost:0,estimatedCostKnown:true};
      grouped[key].required+=stockQty;
      if(lineCost>0)grouped[key].estimatedTotalCost+=lineCost;
      else grouped[key].estimatedCostKnown=false;
    });
    var requirements=Object.keys(grouped).map(function(key){
      var row=grouped[key];row.shortage=Math.max(0,row.required-row.onHand);row.remaining=row.onHand-row.required;row.ready=row.shortage<=0;
      row.estimatedTotalCost=row.estimatedCostKnown?Math.round(row.estimatedTotalCost):null;
      row.estimatedUnitCost=row.estimatedCostKnown&&row.required>0?row.estimatedTotalCost/row.required:null;
      delete row.estimatedCostKnown;return row;
    }).sort(function(a,b){return String(a.name).localeCompare(String(b.name));});
    return{hasHpp:true,requirements:requirements,errors:errors,ready:errors.length===0&&requirements.length>0&&requirements.every(function(row){return row.ready;}),materialCount:requirements.length};
  }
  function calculateOpenSalesOrderCommitments(salesOrders,costSheets,materials,transactions,balances){
    // A reservation is active only while the project is queued for or executing production.
    // QC and delivery release any unissued balance back to available stock.
    var activeStatuses={ready_production:true,in_production:true};
    var orders=Array.isArray(salesOrders)?salesOrders:[];
    var sheets=Array.isArray(costSheets)?costSheets:[];
    var materialRows=Array.isArray(materials)?materials:[];
    var ledger=Array.isArray(transactions)?transactions:[];
    var activeProjects=Object.create(null),activeOrderCount=0,errors=[],grouped=Object.create(null),pickingList=[];
    orders.forEach(function(order){
      var status=String(order&&order.status||'').toLowerCase(),projectId=String(order&&order.projectId||'');
      if(!activeStatuses[status]||!projectId)return;
      activeOrderCount++;
      if(!activeProjects[projectId])activeProjects[projectId]={projectId:projectId,projectName:String(order.projectName||''),orderCount:0,orders:[],requirements:null};
      activeProjects[projectId].orderCount++;
      activeProjects[projectId].orders.push(order);
      if(!activeProjects[projectId].projectName)activeProjects[projectId].projectName=String(order.projectName||'');
    });
    var projectIds=Object.keys(activeProjects);
    projectIds.forEach(function(projectId){
      var project=activeProjects[projectId];
      var snapshotOrder=project.orders.find(function(order){return Array.isArray(order.materialRequirements)&&order.materialRequirements.length;});
      var requirements=[];
      if(snapshotOrder){
        requirements=snapshotOrder.materialRequirements.map(function(line){
          var material=materialRows.find(function(row){return String(row.id)===String(line.materialId);});
          var required=n(line.required);
          if(!material){errors.push('Material reservasi tidak ditemukan untuk proyek '+(project.projectName||projectId)+': '+String(line.materialId||'-')+'.');return null;}
          if(String(line.unit||'')!==String(material.unit||'')){errors.push('Satuan snapshot reservasi tidak cocok untuk '+material.name+'.');return null;}
          if(!Number.isFinite(Number(line.required))||required<=0){errors.push('Kuantitas reservasi tidak valid untuk '+material.name+'.');return null;}
          return{materialId:material.id,name:String(line.name||material.name||''),unit:material.unit,required:required,estimatedUnitCost:line.estimatedUnitCost===null||line.estimatedUnitCost===undefined||line.estimatedUnitCost===''?null:Number.isFinite(Number(line.estimatedUnitCost))?Number(line.estimatedUnitCost):null,estimatedTotalCost:line.estimatedTotalCost===null||line.estimatedTotalCost===undefined||line.estimatedTotalCost===''?null:Number.isFinite(Number(line.estimatedTotalCost))?Number(line.estimatedTotalCost):null};
        }).filter(Boolean);
        project.reservationSource='snapshot';
        project.reservationOrderNo=String(snapshotOrder.orderNo||snapshotOrder.id||'');
        project.orders.forEach(function(order){
          if(Array.isArray(order.materialRequirements)&&order.materialRequirements.length){
            var other=order.materialRequirements.map(function(line){return[String(line.materialId),n(line.required),String(line.unit||'')];}).sort();
            var base=requirements.map(function(line){return[String(line.materialId),n(line.required),String(line.unit||'')];}).sort();
            if(JSON.stringify(other)!==JSON.stringify(base))errors.push('Snapshot kebutuhan material antar Sales Order pada proyek '+(project.projectName||projectId)+' berbeda.');
          }
        });
      }else{
        var sheet=sheets.find(function(row){return String(row.projectId)===projectId;});
        if(!sheet){errors.push('HPP belum tersedia untuk proyek '+(project.projectName||projectId)+'.');return;}
        var plan=calculateHppRequirements(sheet,materialRows,{});
        if(plan.errors.length){plan.errors.forEach(function(error){errors.push((project.projectName||projectId)+': '+error);});return;}
        if(!plan.requirements.length){errors.push('HPP proyek '+(project.projectName||projectId)+' belum memiliki kebutuhan material yang dapat dihitung.');return;}
        requirements=plan.requirements.map(function(line){return{materialId:line.materialId,name:line.name,unit:line.unit,required:line.required,estimatedUnitCost:line.estimatedUnitCost===undefined?null:line.estimatedUnitCost,estimatedTotalCost:line.estimatedTotalCost===undefined?null:line.estimatedTotalCost};});
        project.reservationSource='legacy-hpp';
        project.reservationOrderNo=String(project.orders[0].orderNo||project.orders[0].id||'');
      }
      var issued=Object.create(null);
      ledger.forEach(function(tx){
        if(String(tx.projectId||'')!==projectId)return;
        var materialId=String(tx.materialId||'');
        if(tx.movement==='issue')issued[materialId]=(issued[materialId]||0)+n(tx.qty);
        else if(tx.movement==='return')issued[materialId]=(issued[materialId]||0)-n(tx.qty);
      });
      requirements.forEach(function(requirement){
        var materialId=String(requirement.materialId);
        var netIssued=Math.max(0,issued[materialId]||0);
        var outstanding=Math.max(0,requirement.required-netIssued);
        if(!grouped[materialId])grouped[materialId]={
          materialId:requirement.materialId,name:requirement.name,unit:requirement.unit,
          onHand:n((balances||{})[materialId]),committed:0,projects:[]
        };
        grouped[materialId].committed+=outstanding;
        var projectLine={
          projectId:projectId,projectName:project.projectName||projectId,
          orderCount:project.orderCount,orderNo:project.reservationOrderNo||'',
          required:requirement.required,netIssued:netIssued,outstanding:outstanding,
          reservationSource:project.reservationSource
        };
        grouped[materialId].projects.push(projectLine);
        if(outstanding>0)pickingList.push({
          projectId:projectId,projectName:project.projectName||projectId,
          orderNo:project.reservationOrderNo||'',materialId:requirement.materialId,
          name:requirement.name,unit:requirement.unit,required:requirement.required,
          issued:netIssued,outstanding:outstanding,reservationSource:project.reservationSource
        });
      });
    });
    var requirements=Object.keys(grouped).map(function(materialId){
      var row=grouped[materialId];
      row.availableAfterCommitments=row.onHand-row.committed;
      row.shortage=Math.max(0,row.committed-row.onHand);
      row.projects.sort(function(a,b){return String(a.projectName).localeCompare(String(b.projectName));});
      return row;
    }).sort(function(a,b){return String(a.name).localeCompare(String(b.name));});
    pickingList.sort(function(a,b){
      var projectCompare=String(a.projectName).localeCompare(String(b.projectName));
      return projectCompare||String(a.name).localeCompare(String(b.name));
    });
    var hasShortage=requirements.some(function(row){return row.shortage>0;});
    return{
      activeOrderCount:activeOrderCount,activeProjectCount:projectIds.length,
      requirements:requirements,pickingList:pickingList,errors:errors,
      ready:errors.length===0&&!hasShortage,hasShortage:hasShortage
    };
  }
  function calculateMaterialUsageVariance(requirements,projectId,transactions){
    var netByMaterial=Object.create(null),project=String(projectId||'');
    (Array.isArray(transactions)?transactions:[]).forEach(function(tx){
      if(String(tx.projectId||'')!==project)return;
      var id=String(tx.materialId||'');
      if(tx.movement==='issue')netByMaterial[id]=(netByMaterial[id]||0)+n(tx.qty);
      else if(tx.movement==='return')netByMaterial[id]=(netByMaterial[id]||0)-n(tx.qty);
    });
    return(Array.isArray(requirements)?requirements:[]).map(function(line){
      var planned=n(line.required),netIssued=Math.max(0,netByMaterial[String(line.materialId)]||0);
      var variance=netIssued-planned;
      return{
        materialId:line.materialId,name:line.name||'',unit:line.unit||'',
        plannedQty:planned,netIssuedQty:netIssued,varianceQty:variance,
        variancePct:planned>0?variance/planned*100:0,
        remainingQty:Math.max(0,planned-netIssued),
        state:variance>0.000001?'over':variance< -0.000001?'under':'on_plan'
      };
    });
  }
  function calculateMaterialCostVariance(requirements,projectId,transactions,materials){
    var rows=Array.isArray(requirements)?requirements:[],project=String(projectId||'');
    var actualByMaterial=Object.create(null),actualComplete=true,estimated=false,hasActualMovement=false;
    var valuation=Array.isArray(materials)?calculateInventoryValuation(materials,transactions):null;
    (Array.isArray(transactions)?transactions:[]).forEach(function(tx){
      if(String(tx.projectId||'')!==project||['issue','return'].indexOf(String(tx.movement||''))<0)return;
      hasActualMovement=true;
      var id=String(tx.materialId||''),qty=n(tx.qty),unitCost=n(tx.unitCost),totalCost=n(tx.totalCost);
      var derived=valuation&&valuation.transactionCosts[String(tx.id||'')];
      if(totalCost<=0&&derived&&derived.totalCost>0)totalCost=derived.totalCost;
      if(totalCost<=0&&unitCost>0)totalCost=Math.round(qty*unitCost);
      if(!actualByMaterial[id])actualByMaterial[id]={qty:0,cost:0,estimated:false,complete:true};
      if(totalCost<=0){
        actualByMaterial[id].complete=false;
        actualComplete=false;
        return;
      }
      var sign=tx.movement==='issue'?1:-1;
      actualByMaterial[id].qty+=sign*qty;
      actualByMaterial[id].cost+=sign*totalCost;
      if((derived&&derived.estimated)||tx.costSource==='master_fallback'||tx.costSource==='legacy_master_fallback')actualByMaterial[id].estimated=true;
      if(derived&&!derived.complete){
        actualByMaterial[id].complete=false;
        actualComplete=false;
      }
    });
    var requirementIds=Object.create(null);
    rows.forEach(function(line){requirementIds[String(line.materialId)]=true;});
    var unplannedIds=Object.keys(actualByMaterial).filter(function(id){return !requirementIds[id];});
    var result=rows.map(function(line){
      var actual=actualByMaterial[String(line.materialId)]||{qty:0,cost:0,estimated:false,complete:true};
      var estimate=line.estimatedTotalCost===null||line.estimatedTotalCost===undefined||line.estimatedTotalCost===''?null:Number.isFinite(Number(line.estimatedTotalCost))?Number(line.estimatedTotalCost):null;
      var actualCostComplete=actual.complete!==false;
      var rowComplete=actualCostComplete&&hasActualMovement&&estimate!==null;
      if(actual.estimated)estimated=true;
      return{
        materialId:line.materialId,name:line.name||'',unit:line.unit||'',
        estimatedQty:n(line.required),actualQty:Math.max(0,actual.qty),
        estimatedCost:estimate,actualCost:Math.max(0,Math.round(actual.cost)),
        varianceCost:rowComplete?Math.round(actual.cost-estimate):null,
        variancePct:rowComplete&&estimate>0?(actual.cost-estimate)/estimate*100:null,
        estimated:actual.estimated,actualCostComplete:actualCostComplete,rowComplete:rowComplete
      };
    });
    var estimatesComplete=result.every(function(row){return row.estimatedCost!==null;});
    var varianceComplete=actualComplete&&hasActualMovement&&estimatesComplete&&unplannedIds.length===0;
    var estimatedTotalCost=estimatesComplete?Math.round(result.reduce(function(sum,row){return sum+row.estimatedCost;},0)):null;
    var actualTotalCost=Math.round(result.reduce(function(sum,row){return sum+row.actualCost;},0));
    return{
      rows:result,estimatedTotalCost:estimatedTotalCost,actualTotalCost:actualTotalCost,
      varianceCost:varianceComplete?Math.round(actualTotalCost-estimatedTotalCost):null,
      complete:actualComplete,hasActualMovement:hasActualMovement,
      hasUnplannedActualMaterials:unplannedIds.length>0,unplannedMaterialIds:unplannedIds,
      varianceComplete:varianceComplete,estimated:estimated
    };
  }
  function getBalance(materialId,balances){return n((balances||{})[String(materialId)]);}
  function movementLabel(value){return MOVEMENTS[value]?MOVEMENTS[value].label:String(value||'-');}
  return{MOVEMENTS:MOVEMENTS,localDate:localDate,nextTransactionNumber:nextTransactionNumber,sortTransactions:sortTransactions,calculateBalances:calculateBalances,calculateInventoryValuation:calculateInventoryValuation,validateTransaction:validateTransaction,getBalance:getBalance,calculateHppRequirements:calculateHppRequirements,calculateOpenSalesOrderCommitments:calculateOpenSalesOrderCommitments,calculateMaterialUsageVariance:calculateMaterialUsageVariance,calculateMaterialCostVariance:calculateMaterialCostVariance,movementLabel:movementLabel};
});
