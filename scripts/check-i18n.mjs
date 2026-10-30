// Comprueba la paridad de las claves sin necesitar navegador.
import assert from 'node:assert/strict';
import { DICT, setLang, lang, t } from '../dist/i18n.js';
assert.deepEqual(Object.keys(DICT.es).sort(), Object.keys(DICT.en).sort());
for (const key of Object.keys(DICT.es)) {
  assert.equal(typeof DICT.es[key], 'string', key);
  assert.equal(typeof DICT.en[key], 'string', key);
  const vars = value => [...value.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
  assert.deepEqual(vars(DICT.es[key]), vars(DICT.en[key]), key);
}
setLang('en');
assert.equal(lang(), 'en');
assert.equal(t('share.n', { n: 6 }), '6 in 10');
setLang('es');
console.log(`i18n: ${Object.keys(DICT.es).length} claves coincidentes.`);
