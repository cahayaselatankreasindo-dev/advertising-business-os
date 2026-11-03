const fs=require('node:fs');const vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const m=html.match(/function computeCostingTotals\(items, overheadPct, contingencyPct, marginPct\) \{[\s\S]*?\n    \}/);
if(!m)throw Error('HPP calculator missing');
const calc=vm.runInNewContext('('+m[0].trim()+')');
let passed=0;function eq(a,e,n){if(a!==e)throw Error(n+': expected '+e+', got '+a);passed++;}
const x=calc([{qty:2,unitCost:1500000},{qty:1,unitCost:1000000},{qty:1,unitCost:2000000},{qty:1,unitCost:500000},{qty:1,unitCost:500000}],5,3,30);
eq(x.directCost,7000000,'hybrid direct cost');eq(x.overheadAmount,350000,'overhead');eq(x.contingencyAmount,220500,'contingency');eq(x.hpp,7570500,'HPP');eq(x.sellingPrice,10815000,'30% margin on selling price');eq(x.profit,3244500,'estimated gross contribution');
const z=calc([{qty:1,unitCost:1001}],0,0,0);eq(z.hpp,1001,'zero margin HPP');eq(z.sellingPrice,2000,'round up selling price');
const bad=calc([{qty:-2,unitCost:1000},{qty:1,unitCost:-5}],5,3,30);eq(bad.directCost,0,'invalid costs clamped');eq(bad.sellingPrice,0,'zero HPP price');
const cap=calc([{qty:1,unitCost:100000}],500,-5,150);eq(cap.overheadPct,100,'overhead cap');eq(cap.contingencyPct,0,'contingency floor');eq(cap.marginPct,90,'margin cap');
console.log('HPP tests passed:',passed);
