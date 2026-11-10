'use strict';
/**
 * XML <-> JS objektai pagal schema/filmai.xsd (vardų sritis https://PasaulioFilmai.lt/filmai).
 * Čia JSON ir XML atvaizdai sutapatinami, todėl abu formatai tikrinami ta pačia JSON Schema.
 */
const { DOMParser } = require('@xmldom/xmldom');

const NS = 'https://PasaulioFilmai.lt/filmai';

/* ------------------------------ XML -> objektas ------------------------------ */
const nameOf = (n) => n.localName || n.nodeName;
const kids = (el, name) =>
  el ? Array.from(el.childNodes).filter((n) => n.nodeType === 1 && nameOf(n) === name) : [];
const text = (el) => (el ? el.textContent.trim() : undefined);
const attr = (el, name) => (el.hasAttribute(name) ? el.getAttribute(name) : undefined);
// Skaičių tekstą paverčiame skaičiumi; kitaip paliekame tekstą, kad schema pranešų apie tipo klaidą.
const num = (s) => (s !== undefined && s.trim() !== '' && !Number.isNaN(Number(s)) ? Number(s) : s);
const put = (o, k, v) => { if (v !== undefined) o[k] = v; return o; };

function person(el) {
  const p = {};
  put(p, 'vardas', text(kids(el, 'vardas')[0]));
  put(p, 'gimimoData', text(kids(el, 'gimimoData')[0]));
  return p;
}

function parseFilmas(source) {
  const problems = [];
  let doc;
  try {
    doc = new DOMParser({
      errorHandler: { warning() {}, error: (m) => problems.push(m), fatalError: (m) => problems.push(m) },
    }).parseFromString(String(source), 'application/xml');
  } catch (e) {
    throw new Error(e.message.split('\n')[0]);
  }
  const root = doc && doc.documentElement;
  if (problems.length || !root) throw new Error(String(problems[0] || 'tuščias dokumentas').split('\n')[0]);
  if (nameOf(root) !== 'filmas') throw new Error('šakninis elementas turi būti <filmas>');

  const f = {};
  put(f, 'id', attr(root, 'id'));
  put(f, 'salis', attr(root, 'salis'));
  put(f, 'kalba', attr(root, 'kalba'));
  put(f, 'regionas', attr(root, 'regionas'));
  const kiti = attr(root, 'kitiRegionai'); // xs:list – reikšmės atskirtos tarpais
  if (kiti !== undefined) f.kitiRegionai = kiti.trim() ? kiti.trim().split(/\s+/) : [];
  put(f, 'pavadinimas', text(kids(root, 'pavadinimas')[0]));
  put(f, 'metai', num(text(kids(root, 'metai')[0])));
  put(f, 'trukme', num(text(kids(root, 'trukme')[0])));
  put(f, 'ivertinimas', num(text(kids(root, 'ivertinimas')[0])));
  put(f, 'premjera', text(kids(root, 'premjera')[0]));
  put(f, 'numatomaPremjera', text(kids(root, 'numatomaPremjera')[0]));
  const zanrai = kids(root, 'zanrai')[0];
  if (zanrai) f.zanrai = kids(zanrai, 'zanras').map(text);
  const rez = kids(root, 'rezisierius').map(person);
  if (rez.length === 1) f.rezisierius = rez[0];
  else if (rez.length > 1) f.rezisierius = rez;
  const aktoriai = kids(root, 'aktoriai')[0];
  if (aktoriai) {
    f.aktoriai = kids(aktoriai, 'aktorius').map((a) => {
      const o = {};
      put(o, 'id', attr(a, 'id'));
      put(o, 'tipas', attr(a, 'tipas') || 'pagrindinis'); // XSD numatytoji reikšmė
      Object.assign(o, person(a));
      put(o, 'vaidmuo', text(kids(a, 'vaidmuo')[0]));
      return o;
    });
  }
  const platformos = kids(root, 'platformos')[0];
  if (platformos) {
    f.platformos = kids(platformos, 'platforma').map((p) =>
      put(put({}, 'pavadinimas', attr(p, 'pavadinimas')), 'regionas', attr(p, 'regionas'))
    );
  }
  const aprasas = kids(root, 'aprasas')[0]; // mišrus turinys: paliekame tik tekstą
  if (aprasas) f.aprasas = aprasas.textContent.replace(/\s+/g, ' ').trim();
  return f;
}

/* ------------------------------ objektas -> XML ------------------------------ */
const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const a = (k, v) => (v === undefined || v === null ? '' : ` ${k}="${esc(v)}"`);
const HEAD = '<?xml version="1.0" encoding="UTF-8"?>\n';

function filmasXml(f, pad, withNs) {
  const i1 = pad + '  ';
  const i2 = i1 + '  ';
  const kiti = Array.isArray(f.kitiRegionai) && f.kitiRegionai.length ? f.kitiRegionai.join(' ') : undefined;
  const L = [];
  L.push(`${pad}<filmas${withNs ? ` xmlns="${NS}"` : ''}${a('id', f.id)}${a('salis', f.salis)}${a('kalba', f.kalba)}${a('regionas', f.regionas)}${a('kitiRegionai', kiti)}>`);
  L.push(`${i1}<pavadinimas>${esc(f.pavadinimas)}</pavadinimas>`);
  L.push(`${i1}<metai>${esc(f.metai)}</metai>`);
  L.push(`${i1}<trukme>${esc(f.trukme)}</trukme>`);
  if (f.ivertinimas !== undefined) L.push(`${i1}<ivertinimas>${esc(f.ivertinimas)}</ivertinimas>`);
  if (f.premjera !== undefined) L.push(`${i1}<premjera>${esc(f.premjera)}</premjera>`);
  else if (f.numatomaPremjera !== undefined) L.push(`${i1}<numatomaPremjera>${esc(f.numatomaPremjera)}</numatomaPremjera>`);
  L.push(`${i1}<zanrai>`);
  (f.zanrai || []).forEach((z) => L.push(`${i2}<zanras>${esc(z)}</zanras>`));
  L.push(`${i1}</zanrai>`);
  [].concat(f.rezisierius || []).forEach((r) => {
    L.push(`${i1}<rezisierius>`, `${i2}<vardas>${esc(r.vardas)}</vardas>`, `${i1}</rezisierius>`);
  });
  L.push(`${i1}<aktoriai>`);
  (f.aktoriai || []).forEach((x) => {
    L.push(`${i2}<aktorius${a('id', x.id)}${a('tipas', x.tipas)}>`);
    L.push(`${i2}  <vardas>${esc(x.vardas)}</vardas>`);
    if (x.gimimoData) L.push(`${i2}  <gimimoData>${esc(x.gimimoData)}</gimimoData>`);
    L.push(`${i2}  <vaidmuo>${esc(x.vaidmuo)}</vaidmuo>`, `${i2}</aktorius>`);
  });
  L.push(`${i1}</aktoriai>`);
  const pl = f.platformos || [];
  if (pl.length) {
    L.push(`${i1}<platformos>`);
    pl.forEach((p) => L.push(`${i2}<platforma${a('pavadinimas', p.pavadinimas)}${a('regionas', p.regionas)}/>`));
    L.push(`${i1}</platformos>`);
  } else L.push(`${i1}<platformos/>`);
  if (f.aprasas) L.push(`${i1}<aprasas>${esc(f.aprasas)}</aprasas>`);
  L.push(`${pad}</filmas>`);
  return L.join('\n');
}

/** kind: 'filmas' | 'filmai' | 'klaida' */
function serialize(kind, payload) {
  if (kind === 'filmas') return HEAD + filmasXml(payload, '', true);
  if (kind === 'filmai') {
    const body = payload.map((f) => filmasXml(f, '    ', false)).join('\n');
    return `${HEAD}<katalogas xmlns="${NS}">\n  <filmai>\n${body}\n  </filmai>\n</katalogas>`;
  }
  const det = (payload.detales || [])
    .map((d) => `    <detale${a('kelias', d.kelias)}${a('laukas', d.laukas)}>${esc(d.pranesimas)}</detale>`)
    .join('\n');
  return (
    `${HEAD}<klaida xmlns="${NS}"${a('status', payload.status)}>\n  <zinute>${esc(payload.klaida)}</zinute>\n` +
    (det ? `  <detales>\n${det}\n  </detales>\n` : '') +
    '</klaida>'
  );
}

module.exports = { parseFilmas, serialize, NS };
