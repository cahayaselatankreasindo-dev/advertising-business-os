'use strict';
(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.CSKSalesOrderEngine=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
  var TRANSITIONS={
    awaiting_dp:['ready_production','cancelled'],
    ready_production:['in_production','cancelled'],
    in_production:['quality_check'],
    quality_check:['in_production','ready_delivery'],
    ready_delivery:['delivered'],
    delivered:['closed'],
    closed:[],
    cancelled:[]
  };
  var LABELS={
    awaiting_dp:'Menunggu DP',
    ready_production:'Siap Produksi',
    in_production:'Dalam Produksi',
    quality_check:'Quality Control',
    ready_delivery:'Siap Dikirim',
    delivered:'Sudah Dikirim',
    closed:'Ditutup',
    cancelled:'Dibatalkan'
  };
  function n(value){var x=Number(value);return Number.isFinite(x)?x:0;}
  function purchaseQuantityForStock(stockQty,material){
    var required=Number(stockQty),factor=Number(material&&material.conversionFactor),unit=String(material&&material.purchaseUnit||material&&material.unit||'').trim();
    if(!Number.isFinite(required)||required<0||!Number.isFinite(factor)||factor<=0||!unit)throw new Error('Kuantitas stok, satuan beli, atau faktor konversi material tidak valid.');
    var quantity=required/factor;
    if(/^(lembar|sheet|batang|roll|pcs|pc|pack|pak|box|dus|set|unit|botol|tube|cartridge|kaleng|ream|rim)$/i.test(unit))quantity=Math.ceil(quantity-0.0000001);
    return Math.round(quantity*10000)/10000;
  }
  function purchasePriceForUnit(material){
    var price=Number(material&&material.purchasePrice),factor=Number(material&&material.conversionFactor);
    if(Number.isFinite(price)&&price>0)return price;
    var usagePrice=Number(material&&material.unitPrice),waste=Number(material&&material.wasteRate)||0;
    if(Number.isFinite(usagePrice)&&usagePrice>0&&Number.isFinite(factor)&&factor>0)return usagePrice/(1+waste/100)*factor;
    return 0;
  }
  function localDate(value){
    var d=value instanceof Date?value:new Date(value||Date.now());
    return[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
  }
  function calculateDeposit(total,dpPercent){
    var amount=Math.max(0,Math.round(n(total)));
    var percent=Math.min(99,Math.max(0,n(dpPercent)));
    return Math.round(amount*percent/100);
  }
  function summarizePayments(quotation,invoices,payments){
    var quoteId=String(quotation&&quotation.id||'');
    var linked=(Array.isArray(invoices)?invoices:[]).filter(function(invoice){
      return String(invoice.sourceQuotationId||invoice.quotationId||'')===quoteId ||
        String(quotation&&quotation.convertedInvoiceId||'')===String(invoice.id);
    });
    var ids=new Set(linked.map(function(invoice){return String(invoice.id);}));
    var paid=(Array.isArray(payments)?payments:[]).filter(function(payment){return ids.has(String(payment.invoiceId));})
      .reduce(function(sum,payment){return sum+Math.max(0,n(payment.amount));},0);
    var invoiceTotal=linked.reduce(function(sum,invoice){return sum+Math.max(0,n(invoice.total));},0);
    var required=calculateDeposit(quotation&&quotation.total,quotation&&quotation.dpPercent);
    return{
      invoiceCount:linked.length,
      invoiceTotal:invoiceTotal,
      paid:paid,
      invoiceBalance:Math.max(0,invoiceTotal-paid),
      depositRequired:required,
      depositShortfall:Math.max(0,required-paid),
      depositSatisfied:paid>=required,
      fullyPaid:linked.length>0&&paid>=invoiceTotal
    };
  }
  function nextOrderNumber(orders,date){
    var year=String(date||localDate()).slice(0,4);
    var pattern=new RegExp('^SO-CSK-'+year+'-(\\d+)$');
    var max=0;
    (Array.isArray(orders)?orders:[]).forEach(function(order){
      var match=pattern.exec(String(order.orderNo||''));
      if(match)max=Math.max(max,Number(match[1])||0);
    });
    return'SO-CSK-'+year+'-'+String(max+1).padStart(5,'0');
  }
  function buildOrder(quotation,project,orders,options){
    options=options||{};
    if(!quotation||!quotation.id)throw new Error('Quotation tidak ditemukan.');
    if(String(quotation.status||'').toLowerCase()!=='approved')throw new Error('Quotation harus disetujui sebelum dibuat menjadi Sales Order.');
    var old=(Array.isArray(orders)?orders:[]).find(function(order){return String(order.quotationId)===String(quotation.id);});
    if(old)return{existing:true,order:old};
    var total=Math.round(n(quotation.total));
    if(total<=0)throw new Error('Total quotation harus lebih dari nol.');
    var dpPercent=Math.min(99,Math.max(0,n(quotation.dpPercent)));
    var dpRequired=calculateDeposit(total,dpPercent);
    var date=options.date||localDate();
    var createdAt=options.createdAt||new Date().toISOString();
    var sourceSnapshot=quotation.sourceCostSheetSnapshot||options.sourceCostSheetSnapshot||null;
    var initialStatus=dpRequired>0?'awaiting_dp':'ready_production';
    var order={
      id:'SO-'+Date.now()+'-'+Math.random().toString(36).slice(2,8).toUpperCase(),
      orderNo:nextOrderNumber(orders,date),
      quotationId:String(quotation.id),
      quotationNo:String(quotation.docNo||quotation.id),
      projectId:String(project&&project.id||quotation.projectId||''),
      projectName:String(quotation.projectName||project&&project.title||''),
      client:String(quotation.client||''),
      clientPhone:String(quotation.clientPhone||''),
      clientEmail:String(quotation.clientEmail||''),
      orderDate:date,
      deliveryDate:String(quotation.projectDeadline||''),
      items:Array.isArray(quotation.lines)?JSON.parse(JSON.stringify(quotation.lines)):[],
      sourceCostSheetSnapshot:sourceSnapshot?JSON.parse(JSON.stringify(sourceSnapshot)):null,
      sourceCostSheetId:String(sourceSnapshot&&sourceSnapshot.id||''),
      sourceCostSheetUpdatedAt:String(sourceSnapshot&&sourceSnapshot.updatedAt||''),
      total:total,
      dpPercent:dpPercent,
      dpRequiredAmount:dpRequired,
      status:initialStatus,
      history:[{date:createdAt,status:initialStatus,note:'Sales Order dibuat dari quotation yang telah disetujui.'}],
      notes:'',
      createdAt:createdAt,
      updatedAt:createdAt
    };
    if(!order.projectId)throw new Error('Proyek belum terhubung. Hubungkan quotation ke proyek terlebih dahulu.');
    if(!order.items.length)throw new Error('Quotation tidak memiliki rincian item.');
    return{existing:false,order:order};
  }
  function canTransition(order,nextStatus,summary){
    var current=String(order&&order.status||'');
    var next=String(nextStatus||'');
    if(!TRANSITIONS[current]||TRANSITIONS[current].indexOf(next)<0)return{ok:false,reason:'Perubahan status '+(LABELS[current]||current)+' ke '+(LABELS[next]||next)+' tidak diizinkan.'};
    summary=summary||{};
    if(next!=='awaiting_dp'&&next!=='cancelled'&&n(order.dpRequiredAmount)>n(summary.paid)){
      return{ok:false,reason:'Produksi belum dapat dilepas. DP terverifikasi '+Math.round(n(summary.paid)).toLocaleString('id-ID')+' dari '+Math.round(n(order.dpRequiredAmount)).toLocaleString('id-ID')+'.'};
    }
    if(next==='closed'&&!summary.fullyPaid){
      return{ok:false,reason:'Sales Order hanya dapat ditutup setelah seluruh invoice terkait lunas dan terverifikasi.'};
    }
    return{ok:true,reason:''};
  }
  function transition(order,nextStatus,summary,actor,at,note){
    var check=canTransition(order,nextStatus,summary);
    if(!check.ok)throw new Error(check.reason);
    var copy=JSON.parse(JSON.stringify(order));
    copy.status=nextStatus;
    copy.updatedAt=at||new Date().toISOString();
    copy.history=Array.isArray(copy.history)?copy.history:[];
    copy.history.push({date:copy.updatedAt,status:nextStatus,actor:String(actor||'Owner'),note:String(note||LABELS[nextStatus]||nextStatus)});
    return copy;
  }
  function availableActions(order,summary){
    var current=String(order&&order.status||'');
    return(TRANSITIONS[current]||[]).filter(function(next){return canTransition(order,next,summary).ok;}).map(function(status){return{status:status,label:LABELS[status]||status};});
  }
  function statusLabel(status){return LABELS[status]||String(status||'-');}
  return{
    TRANSITIONS:TRANSITIONS,LABELS:LABELS,calculateDeposit:calculateDeposit,
    purchaseQuantityForStock:purchaseQuantityForStock,purchasePriceForUnit:purchasePriceForUnit,
    summarizePayments:summarizePayments,nextOrderNumber:nextOrderNumber,
    buildOrder:buildOrder,canTransition:canTransition,transition:transition,
    availableActions:availableActions,statusLabel:statusLabel,localDate:localDate
  };
});
