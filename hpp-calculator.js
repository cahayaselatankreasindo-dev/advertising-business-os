/* CSK Business OS — per-quotation HPP calculator (no cloud, no customer records).
 * Harga rule, confirmed by CSK: ready-made maklon with no installation = vendor
 * base price (0% markup); jobs requiring installation = 100% of production HPP.
 * Extra pass-through costs are added after markup. Taxes are excluded.
 */
(function(root){
'use strict';
const CATEGORIES=['Material','Jasa produksi','Finishing','Subkon / Vendor','Instalasi HPP','Lainnya'];
const MODES={
  custom_install:{label:'Produksi + instalasi',markup:100},
  ready_vendor:{label:'Maklon siap pakai (tanpa instalasi)',markup:0}
};
const LIMIT=1e12;
const PRESETS={
  blank:{name:'Estimasi baru',mode:'custom_install',rows:[]},
  rack:{name:'Rak Display Custom PVC',mode:'custom_install',rows:[
    {category:'Material',description:'PVC Board Nulite 5 mm (122 × 244 cm)',unit:'lembar',quantity:1,unitCost:175000,wastePercent:0},
    {category:'Jasa produksi',description:'Cutting, assembly dan finishing — isi biaya',unit:'paket',quantity:1,unitCost:0,wastePercent:0}
  ]},
  booth:{name:'Booth Pameran Custom',mode:'custom_install',rows:[
    {category:'Material',description:'Hollow besi dan struktur — isi harga',unit:'batang',quantity:1,unitCost:0,wastePercent:0},
    {category:'Material',description:'Panel dan branding — isi harga',unit:'lembar',quantity:1,unitCost:0,wastePercent:0},
    {category:'Jasa produksi',description:'Fabrikasi dan finishing — isi biaya',unit:'paket',quantity:1,unitCost:0,wastePercent:0}
  ]},
  signage:{name:'Signage / Neon Box',mode:'custom_install',rows:[
    {category:'Material',description:'Material box, rangka dan sumber cahaya',unit:'paket',quantity:1,unitCost:0,wastePercent:0},
    {category:'Jasa produksi',description:'Fabrikasi dan instalasi teknis',unit:'paket',quantity:1,unitCost:0,wastePercent:0}
  ]},
  acrylic:{name:'Display Akrilik Custom',mode:'ready_vendor',rows:[
    {category:'Subkon / Vendor',description:'Harga jadi dari vendor — isi harga',unit:'pcs',quantity:1,unitCost:0,wastePercent:0}
  ]},
  banner:{name:'Tripod Banner + Foamboard A1',mode:'ready_vendor',rows:[
    {category:'Subkon / Vendor',description:'Tripod + foamboard A1 (harga acuan vendor)',unit:'paket',quantity:1,unitCost:70000,wastePercent:0}
  ]}
};
let seq=0;
function id(){return 'hpp-'+Date.now().toString(36)+'-'+(++seq).toString(36);}
function money(value){return Math.round((Number(value)||0)*100)/100;}
function num(value,field,max=LIMIT){
  if(typeof value==='string'&&value.trim()==='')return 0;
  const v=Number(value);
  if(!Number.isFinite(v)||v<0||v>max)throw Error(field+' tidak valid (harus 0–'+max+').');
  return v;
}
function text(value,max=140){return String(value??'').trim().slice(0,max)}
function row(data={}){
  return {
    id:text(data.id||id(),60),
    category:CATEGORIES.includes(data.category)?data.category:'Material',
    description:text(data.description),
    unit:text(data.unit||'pcs',24)||'pcs',
    quantity:num(data.quantity??1,'Jumlah'),
    unitCost:num(data.unitCost??0,'Harga satuan'),
    wastePercent:num(data.wastePercent??0,'Waste',100)
  };
}
function fee(data={}){
  return {id:text(data.id||id(),60),description:text(data.description),amount:num(data.amount??0,'Biaya tambahan')};
}
function create(preset='blank'){
  const p=PRESETS[preset]||PRESETS.blank;
  return {id:id(),name:p.name,mode:p.mode,outputQty:1,
    rows:p.rows.map(row),extras:[],notes:'',updatedAt:new Date().toISOString()};
}
function from(data){
  if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Format data estimasi tidak valid.');
  if(!MODES[data.mode])throw Error('Jenis pekerjaan tidak dikenali.');
  if(!Array.isArray(data.rows)||data.rows.length>120)throw Error('Maksimal 120 baris biaya.');
  if(!Array.isArray(data.extras)||data.extras.length>40)throw Error('Maksimal 40 biaya tambahan.');
  const out={
    id:text(data.id||id(),60),
    name:text(data.name||'Estimasi tanpa nama',120),
    mode:data.mode,
    outputQty:num(data.outputQty??1,'Jumlah hasil',1e6),
    rows:data.rows.map(row),extras:data.extras.map(fee),
    notes:text(data.notes,2000),
    updatedAt:text(data.updatedAt,50)
  };
  if(out.outputQty<=0)throw Error('Jumlah hasil harus lebih dari nol.');
  return out;
}
function calc(quote){
  const p=from(quote);
  let missing=0;
  const rows=p.rows.map(item=>{
    const extended=item.quantity*item.unitCost*(1+item.wastePercent/100);
    if(item.quantity>0&&item.unitCost===0)missing++;
    return {...item,total:money(extended)};
  });
  const base=money(rows.reduce((sum,x)=>sum+x.total,0));
  const extras=p.extras.map(x=>({...x,total:money(x.amount)}));
  const extrasTotal=money(extras.reduce((sum,x)=>sum+x.total,0));
  const markup=MODES[p.mode].markup;
  const profit=money(base*markup/100);
  const fullHpp=money(base+extrasTotal);
  const sale=money(base+profit+extrasTotal);
  const margin=sale>0?money(profit/sale*100):0;
  return {
    quote:p,rows,extras,
    baseHpp:base,extraTotal:extrasTotal,totalHpp:fullHpp,
    markupPercent:markup,markupAmount:profit,price:sale,
    profit,marginPercent:margin,
    hppPerUnit:money(fullHpp/p.outputQty),
    pricePerUnit:money(sale/p.outputQty),
    missingPrices:missing,
    ready:p.rows.length>0&&missing===0&&base>0,
    taxNote:'PPN/pajak tidak termasuk. Pastikan harga vendor dan ongkir terbaru.'
  };
}
const API={CATEGORIES,MODES,PRESETS,create,from,row,fee,calc};
root.CSKHPP=API;
if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof window!=='undefined'?window:globalThis);
