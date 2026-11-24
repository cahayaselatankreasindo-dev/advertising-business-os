'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const catalog = JSON.parse(fs.readFileSync('data/advertising-catalog-seed.json', 'utf8'));
assert.equal(catalog.status, 'REFERENCE_TEMPLATE_NOT_YET_PRICED');
assert.ok(catalog.activationPolicy.includes('harga aktual'));
assert.ok(catalog.materialFamilies.length >= 50, 'reference catalog contains broad advertising material coverage');
assert.ok(catalog.serviceFamilies.length >= 15, 'reference catalog contains production and installation services');
assert.ok(catalog.serviceFamilies.filter(x => x.recordType === 'product_template').length >= 20, 'catalog includes finished advertising product templates');

const familyCodes = catalog.materialFamilies.map(x => x.familyCode);
assert.equal(new Set(familyCodes).size, familyCodes.length, 'material family codes are unique');
for (const family of catalog.materialFamilies) {
  assert.ok(family.familyCode && family.category && family.familyName, 'each material family has identity and category');
  assert.ok(family.purchaseUnit && family.usageUnit && family.costingMethod, 'each material family defines purchase/usage unit and costing method');
  assert.ok(family.attributes && typeof family.attributes === 'object', 'each family has structured attributes');
  assert.ok(!Object.prototype.hasOwnProperty.call(family, 'unitPrice'), 'reference family must not invent a price');
}
const byCode = code => catalog.materialFamilies.find(x => x.familyCode === code);
assert.ok(byCode('PAP-HVS').attributes.grammageGsm.includes(80));
assert.ok(byCode('WOOD-PLY').attributes.thicknessMm.includes(18));
assert.ok(byCode('WOOD-SOLID').attributes.species.includes('Jati'));
assert.deepEqual(byCode('ACR-CLEAR').attributes.thicknessMm, [0.8,1,1.5,2,2.5,3,4,5,6,8,10,12,15,18,20,25,30]);
assert.ok(byCode('ACR-COLOR').attributes.colors.includes('Hitam'));
assert.ok(byCode('FLEXI').attributes.rollWidthsMm.includes(3200));
assert.ok(byCode('STEEL-HOLLOW').attributes.standardLengthMm.includes(6000));

assert.ok(byCode('WOOD-SOLID').attributes.species.includes('Ulin / Kayu Besi'),'solid wood family includes additional Indonesian timber species');
assert.ok(byCode('ACR-CLEAR').attributes.thicknessMm.includes(30),'clear acrylic thickness range covers 30 mm');
assert.ok(byCode('PVC-SHEET'),'flexible PVC sheet roll is available as a separate material family');
assert.ok(byCode('HPL'),'decorative HPL sheet is represented separately from raw wood panels');
assert.ok(byCode('WPC'),'WPC decking and wall panels are represented');
assert.ok(byCode('ACR-ROD'),'acrylic rods and tubes are represented');
assert.ok(byCode('AL-SHEET'),'aluminium sheet and coil are represented');
assert.ok(byCode('PRINT-INK'),'printing ink consumables are represented');
assert.ok(byCode('DTF-CONS'),'DTF and heat-transfer consumables are represented');
assert.ok(byCode('FABRIC'),'textile display media are represented');
assert.ok(byCode('VINYL-CUT'),'cutting plotter vinyl is represented');
assert.equal(catalog.catalogCounts.materialFamilies,catalog.materialFamilies.length,'catalog count matches actual material families');


const serviceCodes = catalog.serviceFamilies.map(x => x.serviceCode);
assert.equal(new Set(serviceCodes).size, serviceCodes.length, 'service codes are unique');
for (const service of catalog.serviceFamilies) {
  assert.ok(service.serviceCode && service.name && service.category, 'each service has identity and category');
  assert.ok(Array.isArray(service.unitOptions) && service.unitOptions.length, 'each service has explicit unit options');
  assert.ok(service.costBasis && service.requiresScope === true, 'each service describes its costing basis and scope requirement');
}
console.log('CSK advertising catalog seed tests passed.');
