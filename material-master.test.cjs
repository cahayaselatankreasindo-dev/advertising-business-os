'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const seed=JSON.parse(fs.readFileSync('data/csk-material-master-seed.json','utf8'));
const masterSource=fs.readFileSync('material-master.js','utf8');
assert.ok(masterSource.includes("rawFactor===undefined||rawFactor===null||rawFactor===''?1:n(rawFactor)"),'an explicit zero conversion factor must not be treated as a valid default factor');
assert.equal(seed.name,'Master Bahan Baku CSK');
assert.equal(seed.items.length,101,'the initial CSK master includes all 101 listed rows, including the Hollow black family code');
const skus=seed.items.map(x=>String(x.sku).toUpperCase());
assert.equal(new Set(skus).size,skus.length,'every material SKU is unique');
assert.equal(new Set(seed.items.map(x=>x.category)).size,15,'all 15 material groups are represented');
seed.items.forEach(item=>{
 assert.ok(item.sku&&item.name&&item.category&&item.unit&&item.purchaseUnit,'every row has a code, name, category, and both units');
 assert.ok(Number(item.conversionFactor)>0,'every row has a positive provisional conversion factor');
 assert.equal(Number(item.purchasePrice),0,'no supplier purchase prices are fabricated');
 assert.equal(Number(item.unitPrice),0,'no HPP usage prices are fabricated');
 assert.ok(['draft','template'].includes(item.status),'unverified material remains non-selectable');
});
const hollow=seed.items.find(x=>x.sku==='H-H-2X2-1');
assert.ok(hollow,'the 2x2 black hollow SKU is present');
assert.equal(hollow.purchaseUnit,'batang');
assert.equal(hollow.unit,'m');
assert.equal(hollow.conversionFactor,6,'one standard 6m bar maps to six stock meters');
assert.equal(hollow.lengthMm,6000);
assert.ok(seed.items.find(x=>x.sku==='H-H-2X2-1.2'));
assert.ok(seed.items.find(x=>x.sku==='H-G-4X4-1.2'));
assert.ok(seed.items.find(x=>x.sku==='PVC-18'));
assert.ok(seed.items.find(x=>x.sku==='A-B3'));
assert.ok(seed.items.find(x=>x.sku==='ACP-4'));
assert.ok(seed.items.find(x=>x.sku==='PLY-18'));
assert.ok(seed.items.find(x=>x.sku==='MDF-18'));
assert.ok(seed.items.find(x=>x.sku==='M-18'));
assert.ok(seed.items.find(x=>x.sku==='HPL-K'));
assert.ok(seed.items.find(x=>x.sku==='PL-1.2'));
assert.ok(seed.items.find(x=>x.sku==='AL-U'));
assert.ok(seed.items.find(x=>x.sku==='ST-VM'));
assert.ok(seed.items.find(x=>x.sku==='FL-550'));
assert.ok(seed.items.find(x=>x.sku==='PS-24'));
assert.ok(seed.items.find(x=>x.sku==='CT-P'));
assert.ok(seed.items.find(x=>x.sku==='LM-S'));
assert.ok(seed.items.find(x=>x.sku==='BR'));
const family=seed.items.find(x=>x.sku==='H-H');
assert.equal(family.status,'template','generic Hollow hitam is a family code, not a purchasable stock item');
console.log('CSK raw material master seed tests passed.');


// Supplier price CSV import: strict SKU matching, locale parsing, preview validation, and no auto-activation.
global.window = {};
require('./material-master.js');
const priceTools = global.window.CSKMaterialMaster.testUtils;
assert.ok(priceTools, 'material price import helpers are exposed for regression tests');
assert.equal(priceTools.parseLocaleNumber('Rp 1.200.000'), 1200000);
assert.equal(priceTools.parseLocaleNumber('1.200,50'), 1200.5);
assert.equal(priceTools.normalizePriceDate('26/11/2026'), '2026-11-26');
assert.equal(priceTools.normalizePriceDate('2026-02-30'), '');
const verifiedQuotationRef='VERIFIED|QUOTATION|QT-2026-001|https://drive.google.com/file/d/quote001/view|owner|2026-11-28';
const verifiedInvoiceRef='VERIFIED|INVOICE|INV-2026-002|https://drive.google.com/file/d/invoice002/view|owner|2026-11-28';
assert.equal(priceTools.parsePriceEvidenceReference(verifiedQuotationRef).documentNumber,'QT-2026-001');
assert.equal(priceTools.parsePriceEvidenceReference('Quotation 26 Nov'),null,'plain-text source labels are not proof references');
assert.equal(priceTools.parsePriceEvidenceReference('VERIFIED|QUOTATION|QT-1||owner|2026-11-28'),null,'evidence reference requires a file or URL');
assert.equal(priceTools.materialStatusAfterEdit({status:'draft'}),'draft','editing a Draft SKU never activates it');
assert.equal(priceTools.materialStatusAfterEdit({status:'inactive'}),'inactive','editing an inactive SKU never reactivates it');
assert.equal(priceTools.materialStatusAfterEdit({status:'active'}),'active','editing an active SKU preserves its explicit state');
assert.equal(priceTools.materialStatusAfterEdit(null),'draft','new material starts as Draft even when price fields are supplied');

const importMaterials = [
 {id:'m1',sku:'H-H-2X2-1',name:'Hollow 2x2',status:'draft',purchaseUnit:'batang',unit:'m',conversionFactor:6,wasteRate:5,purchasePrice:0,unitPrice:0,priceDate:''},
 {id:'m2',sku:'PVC-18',name:'PVC sheet 18',status:'active',purchaseUnit:'roll',unit:'m2',conversionFactor:50,wasteRate:0,purchasePrice:200000,unitPrice:4000,supplierName:'Supplier Lama',priceSource:'Invoice lama',priceDate:'2026-11-20'},
 {id:'m3',sku:'H-H',name:'Hollow family',status:'template',purchaseUnit:'batang',unit:'m',conversionFactor:6,wasteRate:0,purchasePrice:0,unitPrice:0},
 {id:'m4',sku:'A-B3',name:'Akrilik 3 mm',status:'draft',purchaseUnit:'lembar',unit:'lembar',conversionFactor:1,wasteRate:0,purchasePrice:0,unitPrice:0}
];
const supplierCsv = [
 'sku;purchase_price;supplier_name;price_source;price_date;purchase_unit;usage_unit;conversion_factor;waste_rate',
 'H-H-2X2-1;1.200.000;Supplier A;'+verifiedQuotationRef+';26/11/2026;batang;m;6;5',
 'PVC-18;250.000;Supplier B;'+verifiedInvoiceRef+';2026-11-26;roll;m2;50;0',
 'UNKNOWN-1;100.000;Supplier X;Price list;2026-11-26;pcs;pcs;1;0',
 'H-H;100.000;Supplier X;Price list;2026-11-26;batang;m;6;0',
 'A-B3;0;Supplier C;Price list;2026-11-26;lembar;lembar;1;0'
].join('\r\n');
const parsedImport = priceTools.parseCsvMatrix(supplierCsv);
assert.equal(parsedImport[1][3], verifiedQuotationRef, 'verified evidence reference is retained as one CSV field');
assert.equal(priceTools.parseCsvMatrix('sku,price_source\\nSKU-1,"Quotation, 25 Nov"')[1][1],'Quotation, 25 Nov','quoted delimiters remain inside one CSV field');
const validation = priceTools.validatePriceImport(supplierCsv, importMaterials);
assert.equal(validation.totalRows, 5);
assert.equal(validation.validRows.length, 2, 'only known, unique, complete, priced SKU rows pass');
assert.equal(validation.errors.length, 3, 'unknown SKU, template SKU, and zero price are rejected');
assert.equal(validation.validRows[0].purchasePrice, 1200000);
assert.equal(validation.validRows[0].priceDate, '2026-11-26');
assert.ok(validation.errors.some(x=>x.reason.includes('tidak ditemukan')));
assert.ok(validation.errors.some(x=>x.reason.includes('template')));

const applied = priceTools.applyPriceImport(importMaterials, validation.validRows, '2026-11-26T12:00:00.000Z');
assert.equal(applied[0].purchasePrice, 1200000);
assert.equal(applied[0].unitPrice, 210000, 'usage price includes the existing conversion factor and waste allowance');
assert.equal(applied[0].status, 'draft', 'price import never activates a Draft SKU');
assert.equal(applied[1].unitPrice, 5000);
assert.equal(applied[1].status, 'active', 'an already active SKU remains active');
assert.equal(importMaterials[0].purchasePrice, 0, 'the source material array is not mutated');

const duplicateCsv = [
 'sku,purchase_price,supplier_name,price_source,price_date',
 'H-H-2X2-1,100000,Vendor,Invoice,2026-11-26',
 'H-H-2X2-1,110000,Vendor,Invoice,2026-11-26'
].join('\n');
const duplicateValidation = priceTools.validatePriceImport(duplicateCsv, importMaterials);
assert.equal(duplicateValidation.validRows.length, 0);
assert.equal(duplicateValidation.errors.length, 2, 'both duplicate SKU rows are rejected');

const duplicateMasterMaterials = importMaterials.concat([Object.assign({}, importMaterials[0], {id:'m1-duplicate'})]);
const duplicateMasterCsv = [
 'sku,purchase_price,supplier_name,price_source,price_date',
 'H-H-2X2-1,100000,Vendor,Invoice,2026-11-26'
].join('\n');
const duplicateMasterValidation = priceTools.validatePriceImport(duplicateMasterCsv, duplicateMasterMaterials);
assert.equal(duplicateMasterValidation.validRows.length, 0, 'an ambiguous SKU in the current master must not receive a price');
assert.ok(duplicateMasterValidation.errors[0].reason.includes('lebih dari satu kali pada Master Material'));

const fractionalPriceCsv = [
 'sku,purchase_price,supplier_name,price_source,price_date',
 'H-H-2X2-1,1000.50,Vendor,Invoice,2026-11-26'
].join('\n');
const fractionalPriceValidation = priceTools.validatePriceImport(fractionalPriceCsv, importMaterials);
assert.equal(fractionalPriceValidation.validRows.length, 0, 'fractional Rupiah must not be imported');
assert.ok(fractionalPriceValidation.errors[0].reason.includes('Rupiah bulat'));

const olderCsv = [
 'sku,purchase_price,supplier_name,price_source,price_date',
 'PVC-18,190000,Vendor,Invoice,2026-11-10'
].join('\n');
assert.ok(priceTools.validatePriceImport(olderCsv, importMaterials).errors[0].reason.includes('lebih lama'));

const unitMismatchCsv = [
 'sku,purchase_price,supplier_name,price_source,price_date,purchase_unit,usage_unit,conversion_factor,waste_rate',
 'PVC-18,250000,Vendor,'+verifiedInvoiceRef+',2026-11-26,box,m2,50,0'
].join('\n');
assert.ok(priceTools.validatePriceImport(unitMismatchCsv, importMaterials).errors[0].reason.includes('Satuan beli berbeda'));

const missingHeaderCsv = 'sku,purchase_price\nH-H-2X2-1,100000';
assert.ok(priceTools.validatePriceImport(missingHeaderCsv, importMaterials).errors[0].reason.includes('Kolom wajib'));
const missingUnitHeadersCsv = [
 'sku,purchase_price,supplier_name,price_source,price_date,usage_unit,conversion_factor,waste_rate',
 'H-H-2X2-1,100000,Vendor,'+verifiedQuotationRef+',2026-11-26,m,6,0'
].join('\n');
assert.ok(priceTools.validatePriceImport(missingUnitHeadersCsv, importMaterials).errors[0].reason.includes('Kolom wajib'),'purchase_unit is mandatory');
const blankConversionCsv = [
 'sku,purchase_price,supplier_name,price_source,price_date,purchase_unit,usage_unit,conversion_factor,waste_rate',
 'H-H-2X2-1,100000,Vendor,'+verifiedQuotationRef+',2026-11-26,batang,m,,0'
].join('\n');
assert.ok(priceTools.validatePriceImport(blankConversionCsv, importMaterials).errors[0].reason.includes('Faktor konversi wajib'));

const templateCsv = priceTools.buildPriceTemplateCsv(importMaterials);
assert.ok(templateCsv.charCodeAt(0)===0xFEFF, 'template includes UTF-8 BOM for spreadsheet compatibility');
assert.ok(templateCsv.includes('H-H-2X2-1'));
assert.ok(!templateCsv.includes('H-H;'), 'template family codes are excluded');
const formulaTemplate = priceTools.buildPriceTemplateCsv([{sku:'SKU-1',name:'=HYPERLINK("x")',status:'draft',purchaseUnit:'pcs',unit:'pcs',conversionFactor:1,wasteRate:0}]);
assert.ok(formulaTemplate.includes("'=HYPERLINK"), 'CSV template neutralizes formula-like text');
console.log('CSK supplier price CSV import tests passed.');

const staleApplyRow = Object.assign({}, validation.validRows[1], {priceDate:'2026-11-19'});
assert.throws(()=>priceTools.applyPriceImport(importMaterials,[staleApplyRow]),/MATERIAL_IMPORT_DATE_OLDER/,'the apply layer independently rejects a stale supplier date');
const changedFactorRow = Object.assign({}, validation.validRows[0], {conversionFactor:5});
assert.throws(()=>priceTools.applyPriceImport(importMaterials,[changedFactorRow]),/MATERIAL_IMPORT_CONVERSION_CHANGED/,'the apply layer checks that the conversion factor has not changed since preview');
const changedWasteRow = Object.assign({}, validation.validRows[0], {wasteRate:6});
assert.throws(()=>priceTools.applyPriceImport(importMaterials,[changedWasteRow]),/MATERIAL_IMPORT_WASTE_CHANGED/,'the apply layer checks that the waste rate has not changed since preview');
assert.throws(()=>priceTools.applyPriceImport(importMaterials,[validation.validRows[0],validation.validRows[0]]),/MATERIAL_IMPORT_DUPLICATE_TARGET/,'the apply layer rejects duplicate target records');
const fractionalApplyRow = Object.assign({}, validation.validRows[0], {purchasePrice:1000.5});
assert.throws(()=>priceTools.applyPriceImport(importMaterials,[fractionalApplyRow]),/MATERIAL_IMPORT_VALUES_INVALID/,'the apply layer independently rejects fractional Rupiah');

const changedStatusMaterials = importMaterials.map(x=>Object.assign({},x));
changedStatusMaterials[0].status='active';
assert.throws(()=>priceTools.applyPriceImport(changedStatusMaterials,[validation.validRows[0]]),/MATERIAL_IMPORT_STATUS_CHANGED/,'the apply layer rejects a status change since preview');
const changedPriceDateMaterials = importMaterials.map(x=>Object.assign({},x));
changedPriceDateMaterials[0].priceDate='2026-11-25';
assert.throws(()=>priceTools.applyPriceImport(changedPriceDateMaterials,[validation.validRows[0]]),/MATERIAL_IMPORT_PRICE_DATE_CHANGED/,'the apply layer rejects a current-price-date change since preview');
const duplicateMasterApply = importMaterials.concat([Object.assign({},importMaterials[0],{id:'m1-duplicate'})]);
assert.throws(()=>priceTools.applyPriceImport(duplicateMasterApply,[validation.validRows[0]]),/MATERIAL_IMPORT_TARGET_INVALID/,'the apply layer independently rejects ambiguous master SKUs');
const formulaSupplierCsv = [
 'sku,purchase_price,supplier_name,price_source,price_date,purchase_unit,usage_unit,conversion_factor,waste_rate',
 'H-H-2X2-1,100000,=IMPORTXML("https://example.invalid"),'+verifiedQuotationRef+',2026-11-26,batang,m,6,5'
].join('\n');
assert.ok(priceTools.validatePriceImport(formulaSupplierCsv, importMaterials).errors[0].reason.includes('karakter formula spreadsheet'), 'formula-like supplier text is rejected before any Sheets write');
assert.ok(Number.isNaN(priceTools.parseLocaleNumber('Rp 1.200.000 supplier')), 'unrecognized text is not silently stripped from a price');
assert.equal(validation.validRows[0].conversionFactor,6,'staged rows retain the conversion factor used in preview');
assert.equal(validation.validRows[0].wasteRate,5,'staged rows retain the waste rate used in preview');
assert.equal(validation.validRows[0].evidenceReference.documentType,'QUOTATION','the verified source document type is retained in the preview');
const unverifiedSourceCsv=[
 'sku,purchase_price,supplier_name,price_source,price_date,purchase_unit,usage_unit,conversion_factor,waste_rate',
 'H-H-2X2-1,100000,Vendor,Quotation,2026-11-26,batang,m,6,5'
].join('\n');
assert.ok(priceTools.validatePriceImport(unverifiedSourceCsv,importMaterials).errors[0].reason.includes('bukti VERIFIED'),'plain source text cannot pass evidence validation');
assert.throws(()=>priceTools.applyPriceImport(importMaterials,[Object.assign({},validation.validRows[0],{priceSource:'Invoice'})]),/MATERIAL_IMPORT_EVIDENCE_INVALID/,'apply independently enforces the verified evidence reference');
assert.equal(priceTools.canActivateMaterial({purchasePrice:100000,unitPrice:17500,purchaseUnit:'batang',unit:'m',conversionFactor:6,wasteRate:5,supplierName:'Vendor',priceSource:verifiedQuotationRef,priceDate:'2026-11-26'}),true,'activation requires complete master values and a verified evidence reference');
assert.equal(priceTools.canActivateMaterial({purchasePrice:100000,unitPrice:17500,purchaseUnit:'batang',unit:'m',conversionFactor:6,wasteRate:5,supplierName:'Vendor',priceSource:'Quotation',priceDate:'2026-11-26'}),false,'unverified source text blocks activation');
assert.throws(()=>priceTools.applyPriceImport(importMaterials,[Object.assign({},validation.validRows[0],{purchasePrice:1000,supplierName:' =IMPORTXML(x)'})]),/MATERIAL_IMPORT_TEXT_INVALID/,'the apply layer also rejects formula-like supplier data, including leading whitespace');
