const assert = require('node:assert/strict');
const personas = require('./persona-leads.js');

assert.equal(personas.DATA.length, 17, 'semua 17 persona harus ada');
assert.equal(new Set(personas.DATA.map(p => p.id)).size, 17, 'ID harus unik');
assert.deepEqual(personas.DATA.map(p => p.id), Array.from({length:17},(_,i)=>'P'+(i+1)));
assert.equal(personas.filter('', '').length, 17);
assert.equal(personas.filter('', 'T1').length, 4);
assert.equal(personas.filter('', 'T2').length, 6);
assert.equal(personas.filter('', 'T2E').length, 5);
assert.equal(personas.filter('', 'T3').length, 2);
assert.ok(personas.filter('signage', '').some(p => p.id === 'P4'));
assert.ok(personas.filter('PROCuREMENT','').some(p => p.id === 'P3'));
assert.ok(personas.filter('launching', 'T1').some(p => p.id === 'P1'));
assert.equal(personas.filter('tidak-mungkin-cocok','').length, 0);
assert.equal(personas.esc('<script>'), '&lt;script&gt;');
assert.ok(personas.outreachText(personas.DATA[0]).includes('Cahaya Selatan Kreasindo'));
assert.equal(personas.outreachText({id:'NONEXISTENT'}),'');
for (const p of personas.DATA) {
  for (const field of ['id','name','tier','roles','industry','services','triggers','range','pain']) {
    assert.equal(typeof p[field], 'string');
    assert.ok(p[field].length, `${p.id}: ${field} kosong`);
  }
  assert.ok(Array.isArray(p.objections));
  assert.ok(personas.TIERS[p.tier]);
}
console.log('PASS: 17 persona, tier, pencarian, sanitasi, dan draf outreach');
