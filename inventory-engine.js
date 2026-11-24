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
    if(!String(material.unit||'').trim())throw new Error('Master Material belum memiliki satuan stok. Lengkapi satuan terlebih dahulu.');
    if(!MOVEMENTS[input.movement])throw new Error('Pilih jenis transaksi stok yang valid.');
    var qty=Number(input.qty);
    if(!Number.isFinite(qty)||qty<=0)throw new Error('Kuantitas harus lebih dari nol.');
    if(String(input.unit||'')!==String(material.unit||''))throw new Error('Satuan harus mengikuti satuan stok material: '+(material.unit||'-')+'.');
    var date=String(input.date||'');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error('Tanggal transaksi tidak valid.');
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
    var transaction={
      id:String(input.id||'ITX-'+Date.now()+'-'+Math.random().toString(36).slice(2,8).toUpperCase()),
      transactionNo:String(input.transactionNo||nextTransactionNumber(existing,date)),
      materialId:String(material.id),materialName:String(material.name||''),
      movement:String(input.movement),qty:qty,unit:String(material.unit||''),
      date:date,projectId:projectId,projectName:String((projects.find(function(p){return String(p.id)===projectId;})||{}).title||''),
      purchaseOrderId:String(input.purchaseOrderId||''),supplier:String(input.supplier||''),
      reference:String(input.reference||''),notes:String(input.notes||''),
      createdAt:String(input.createdAt||new Date().toISOString()),createdBy:String(input.createdBy||'Owner')
    };
    if(transaction.notes.length>500||transaction.reference.length>120||transaction.supplier.length>160)throw new Error('Catatan, referensi, atau supplier terlalu panjang.');
    var balances=calculateBalances(materials,existing.concat([transaction]));
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
      if(!grouped[key])grouped[key]={materialId:material.id,name:material.name,unit:stockUnit,required:0,onHand:n((balances||{})[key])};
      grouped[key].required+=stockQty;
    });
    var requirements=Object.keys(grouped).map(function(key){
      var row=grouped[key];row.shortage=Math.max(0,row.required-row.onHand);row.remaining=row.onHand-row.required;row.ready=row.shortage<=0;return row;
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
          return{materialId:material.id,name:String(line.name||material.name||''),unit:material.unit,required:required};
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
        requirements=plan.requirements.map(function(line){return{materialId:line.materialId,name:line.name,unit:line.unit,required:line.required};});
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
  function getBalance(materialId,balances){return n((balances||{})[String(materialId)]);}
  function movementLabel(value){return MOVEMENTS[value]?MOVEMENTS[value].label:String(value||'-');}
  return{MOVEMENTS:MOVEMENTS,localDate:localDate,nextTransactionNumber:nextTransactionNumber,sortTransactions:sortTransactions,calculateBalances:calculateBalances,validateTransaction:validateTransaction,getBalance:getBalance,calculateHppRequirements:calculateHppRequirements,calculateOpenSalesOrderCommitments:calculateOpenSalesOrderCommitments,movementLabel:movementLabel};
});
