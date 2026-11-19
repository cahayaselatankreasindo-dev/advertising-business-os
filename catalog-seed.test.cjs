'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const catalog = JSON.parse(fs.readFileSync('data/advertising-catalog-seed.json', 'utf8'));
assert.equal(catalog.status, 'REFERENCE_TEMPLATE_NOT_YET_PRICED');
assert.ok(catalog.activationPolicy.includes('harga aktual'));
assert.ok(catalog.materialFamilies.length >= 35, 'reference catalog contains broad advertising material coverage');
assert.ok(catalog.serviceFamilies.length >= 15, 'reference catalog contains production and installation services');

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
assert.deepEqual(byCode('ACR-CLEAR').attributes.thicknessMm, [1,2,3,4,5,6,8,10,12,15,20,25]);
assert.ok(byCode('ACR-COLOR').attributes.colors.includes('Hitam'));
assert.ok(byCode('FLEXI').attributes.rollWidthsMm.includes(3200));
assert.ok(byCode('STEEL-HOLLOW').attributes.standardLengthMm.includes(6000));

const serviceCodes = catalog.serviceFamilies.map(x => x.serviceCode);
assert.equal(new Set(serviceCodes).size, serviceCodes.length, 'service codes are unique');
for (const service of catalog.serviceFamilies) {
  assert.ok(service.serviceCode && service.name && service.category, 'each service has identity and category');
  assert.ok(Array.isArray(service.unitOptions) && service.unitOptions.length, 'each service has explicit unit options');
  assert.ok(service.costBasis && service.requiresScope === true, 'each service describes its costing basis and scope requirement');
}
console.log('CSK advertising catalog seed tests passed.');
