/* regex-tester-bd -- node unit tests. Run: node tests/run-node-tests.js */
'use strict';
const assert = require('node:assert');
const L = require('../js/logic.js');

let passed = 0;
function check(name, fn) {
  try { fn(); passed++; console.log('PASS ' + name); }
  catch (e) { console.log('FAIL ' + name + ' :: ' + e.message); process.exitCode = 1; }
}

/* match extraction */
check('basic match without g', () => {
  const r = L.runTest('\\d+', '', 'abc123def');
  assert.equal(r.ok, true); assert.equal(r.matches.length, 1);
  assert.equal(r.matches[0].text, '123'); assert.equal(r.matches[0].index, 3);
});
check('global flag finds all', () => {
  const r = L.runTest('\\d+', 'g', '12 34 56');
  assert.equal(r.matches.length, 3);
  assert.deepEqual(r.matches.map(m => m.text), ['12', '34', '56']);
});
check('groups: (\\d+)-(\\d+) on 12-34', () => {
  const r = L.runTest('(\\d+)-(\\d+)', '', '12-34');
  assert.equal(r.matches.length, 1);
  assert.deepEqual(r.matches[0].groups, ['12', '34']);
});
check('optional unset group is undefined', () => {
  const r = L.runTest('(a)?b', '', 'b');
  assert.deepEqual(r.matches[0].groups, [undefined]);
});
check('sticky flag anchors at lastIndex 0', () => {
  const r = L.runTest('\\d+', 'y', '12 34');
  assert.equal(r.matches.length, 1); assert.equal(r.matches[0].text, '12');
});

/* flags */
check('flag i is case-insensitive', () => {
  const r = L.runTest('abc', 'i', 'ABC');
  assert.equal(r.matches.length, 1);
});
check('flag m: ^ matches line start', () => {
  assert.equal(L.runTest('^b', '', 'a\nb').matches.length, 0);
  assert.equal(L.runTest('^b', 'm', 'a\nb').matches.length, 1);
});
check('flag s: dot matches newline', () => {
  assert.equal(L.runTest('a.b', '', 'a\nb').matches.length, 0);
  assert.equal(L.runTest('a.b', 's', 'a\nb').matches.length, 1);
});
check('flag u: \\p{Letter} needs u for Unicode property', () => {
  assert.equal(L.runTest('\\p{Letter}', 'u', 'a').matches.length, 1);
  /* Without u, \\p is an identity escape for literal "p": matches literal "p{Letter}". */
  const lit = L.runTest('\\p{Letter}', '', 'p{Letter}');
  assert.equal(lit.ok, true);
  assert.equal(lit.matches.length, 1);
  assert.equal(lit.matches[0].text, 'p{Letter}');
});
check('invalid flag rejected', () => {
  const r = L.runTest('a', 'z', 'a');
  assert.equal(r.ok, false); assert.match(r.error, /Invalid flag/);
});
check('duplicate flag rejected', () => {
  assert.equal(L.runTest('a', 'gg', 'a').ok, false);
});

/* errors */
check('invalid regex surfaces engine message', () => {
  const r = L.runTest('(', '', 'x');
  assert.equal(r.ok, false);
  assert.match(r.error, /Invalid regular expression/);
});
check('pattern too long rejected', () => {
  assert.equal(L.runTest('a'.repeat(2001), '', 'x').ok, false);
});
check('text too long rejected', () => {
  assert.equal(L.runTest('a', '', 'x'.repeat(100001)).ok, false);
});

/* zero-length + caps */
check('zero-length matches terminate (a* on bbb)', () => {
  const r = L.runTest('a*', 'g', 'bbb');
  assert.equal(r.ok, true); assert.equal(r.matches.length, 4); /* "", "", "", "" */
});
check('match cap at 1000', () => {
  const r = L.runTest('x?', 'g', 'a'.repeat(2000));
  assert.equal(r.capped, true); assert.equal(r.matches.length, 1000);
});

/* replace */
check('replace with $1 and $2', () => {
  const r = L.applyReplace('(\\w+)@(\\w+)', '', 'meem@test', '[$1] at [$2]');
  assert.equal(r.output, '[meem] at [test]');
});
check('replace with $&', () => {
  const r = L.applyReplace('\\d+', '', 'a12b', '<$&>');
  assert.equal(r.output, 'a<12>b');
});
check('replace with $$ gives literal $', () => {
  const r = L.applyReplace('x', '', 'x', '$$');
  assert.equal(r.output, '$');
});
check('replace with g flag replaces all', () => {
  const r = L.applyReplace('\\s+', 'g', 'a  b\tc', ' ');
  assert.equal(r.output, 'a b c');
});
check('replace with invalid regex fails', () => {
  assert.equal(L.applyReplace('(', '', 'x', 'y').ok, false);
});

/* library: every pattern compiles and matches its sample */
check('library has 8 patterns', () => {
  assert.equal(L.LIBRARY.length, 8);
});
L.LIBRARY.forEach((item) => {
  check('library pattern matches sample: ' + item.id, () => {
    const r = L.runTest(item.pattern, item.flags, item.sample);
    assert.equal(r.ok, true, r.error || '');
    assert.ok(r.matches.length >= 1, 'no match for ' + item.id);
  });
});
check('library pwd-lookahead matches exactly Strong1!', () => {
  const item = L.LIBRARY.find(x => x.id === 'pwd-lookahead');
  const r = L.runTest(item.pattern, item.flags, item.sample);
  assert.deepEqual(r.matches.map(m => m.text), ['Strong1!']);
});
check('library NID matches 10 and 17 digits', () => {
  const item = L.LIBRARY.find(x => x.id === 'nid');
  const r = L.runTest(item.pattern, item.flags, item.sample);
  assert.deepEqual(r.matches.map(m => m.text), ['1234567890', '12345678901234567']);
});

/* cheat sheet + i18n */
check('cheat sheet has >=18 entries with EN+BN', () => {
  assert.ok(L.CHEAT.length >= 18);
  L.CHEAT.forEach((row) => {
    assert.ok(row.token && row.en && row.bn, 'incomplete row ' + row.token);
  });
});
check('Bengali digits format 123', () => {
  assert.equal(L.fmtNum(123, 'bn'), '\u09e7\u09e8\u09e9');
  assert.equal(L.fmtNum(123, 'en'), '123');
});
check('I18N has all keys in both languages', () => {
  const enKeys = Object.keys(L.I18N.en).sort();
  const bnKeys = Object.keys(L.I18N.bn).sort();
  assert.deepEqual(bnKeys, enKeys);
});

console.log('\n' + passed + ' unit checks passed.');
