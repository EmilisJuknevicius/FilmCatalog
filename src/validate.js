'use strict';
/**
 * Validacija pagal JSON Schema (schema/filmai_schema.json, draft-06).
 * Schemos šaknis aprašo visą katalogą, todėl vieną filmą apgaubiame
 * {katalogas:{filmai:[filmas]}} ir tikriname pagal pilną schemą.
 */
const Ajv = require('ajv'); // 6.x palaiko draft-06
const schema = require('../schema/filmai_schema.json');

const ajv = new Ajv({ allErrors: true, jsonPointers: true });
ajv.addMetaSchema(require('ajv/lib/refs/json-schema-draft-06.json'));
const check = ajv.compile(schema);

const PREFIX = '/katalogas/filmai/0';
const TIPAI = { string: 'tekstas', integer: 'sveikas skaičius', number: 'skaičius', array: 'masyvas', object: 'objektas', boolean: 'taip/ne' };

function message(e) {
  const p = e.params || {};
  switch (e.keyword) {
    case 'required': return 'Šis laukas privalomas';
    case 'type': return `Turi būti: ${TIPAI[p.type] || p.type}`;
    case 'enum': return `Leidžiamos reikšmės: ${p.allowedValues.join(', ')}`;
    case 'pattern': return `Neatitinka reikalaujamo formato (${p.pattern})`;
    case 'minimum': return `Reikšmė turi būti ne mažesnė nei ${p.limit}`;
    case 'maximum': return `Reikšmė turi būti ne didesnė nei ${p.limit}`;
    case 'minLength': return `Per trumpas tekstas (mažiausiai ${p.limit} simb.)`;
    case 'maxLength': return `Per ilgas tekstas (daugiausiai ${p.limit} simb.)`;
    case 'minItems': return `Reikia bent ${p.limit} elemento`;
    case 'uniqueItems': return 'Reikšmės turi būti unikalios (kartojasi)';
    case 'additionalProperties': return `Neleidžiamas laukas „${p.additionalProperty}“`;
    case 'oneOf':
      return p.passingSchemas
        ? 'Nurodykite tik vieną: premjerą ARBA numatomą premjerą'
        : 'Būtina nurodyti premjerą arba numatomą premjerą';
    default: return e.message;
  }
}

function toDetail(e) {
  const base = e.dataPath.slice(PREFIX.length);
  let kelias = base;
  if (e.keyword === 'required') kelias = `${base}/${e.params.missingProperty}`;
  else if (e.keyword === 'additionalProperties') kelias = `${base}/${e.params.additionalProperty}`;
  else if (e.keyword === 'oneOf') kelias = '/premjera';
  return { kelias, laukas: kelias.split('/').pop() || 'filmas', pranesimas: message(e) };
}

/** Grąžina klaidų sąrašą (tuščias – duomenys teisingi). */
function validateFilmas(data) {
  const details = [];
  if (!check({ katalogas: { filmai: [data] } })) {
    const errors = check.errors;
    // Triukšmo filtravimas: anyOf/oneOf šakų klaidos nieko nesako vartotojui.
    const anyOfPaths = errors.filter((e) => e.keyword === 'anyOf').map((e) => e.dataPath);
    const kept = errors.filter(
      (e) =>
        e.keyword !== 'anyOf' &&
        !(e.keyword === 'type' && anyOfPaths.includes(e.dataPath)) &&
        !(e.keyword === 'required' && e.schemaPath.includes('/oneOf/'))
    );
    kept.forEach((e) => details.push(toDetail(e)));
    for (const p of anyOfPaths) {
      if (!kept.some((e) => e.dataPath === p || e.dataPath.startsWith(p + '/'))) {
        details.push({ kelias: p.slice(PREFIX.length), laukas: p.split('/').pop(), pranesimas: 'Neteisinga reikšmė: tikimasi asmens objekto (su vardu) arba jų masyvo' });
      }
    }
  }
  // Atitinka XSD xs:key „aktoriausRaktas“: aktoriaus ID unikalus filmo viduje.
  if (data && Array.isArray(data.aktoriai)) {
    const seen = new Set();
    data.aktoriai.forEach((a, i) => {
      if (a && typeof a.id === 'string') {
        if (seen.has(a.id)) details.push({ kelias: `/aktoriai/${i}/id`, laukas: 'id', pranesimas: `Aktoriaus ID ${a.id} kartojasi šiame filme` });
        seen.add(a.id);
      }
    });
  }
  return details;
}

module.exports = { validateFilmas };
