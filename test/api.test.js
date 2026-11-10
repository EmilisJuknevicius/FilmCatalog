'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Testai dirba su laikina duomenų kopija, kad neliestų data/filmai.json
const tmp = path.join(os.tmpdir(), `filmai-test-${process.pid}.json`);
fs.copyFileSync(path.join(__dirname, '..', 'data', 'filmai.json'), tmp);
process.env.DATA_FILE = tmp;
const app = require('../server');

let base;
let server;
test.before(() => new Promise((ok) => { server = app.listen(0, () => { base = `http://127.0.0.1:${server.address().port}/api/filmai`; ok(); }); }));
test.after(() => { server.close(); fs.rmSync(tmp, { force: true }); });

const J = { 'Content-Type': 'application/json', Accept: 'application/json' };
const naujas = () => ({
  salis: 'Lietuva', kalba: 'LT', regionas: 'EU', pavadinimas: 'Testas', metai: 2020, trukme: 90,
  premjera: '2020-01-01', zanrai: ['Drama'], rezisierius: { vardas: 'Jonas' },
  aktoriai: [{ id: 'A100', tipas: 'pagrindinis', vardas: 'Petras', vaidmuo: 'Jis' }], platformos: [],
});

test('GET sąrašas (JSON ir XML)', async () => {
  let r = await fetch(base);
  assert.equal(r.status, 200);
  assert.equal((await r.json()).length, 3);
  r = await fetch(base, { headers: { Accept: 'application/xml' } });
  assert.match(r.headers.get('content-type'), /application\/xml/);
  assert.match(await r.text(), /<katalogas xmlns="https:\/\/PasaulioFilmai.lt\/filmai">/);
});

test('GET vienas ir 404', async () => {
  assert.equal((await fetch(`${base}/F001`)).status, 200);
  assert.equal((await fetch(`${base}/F999`)).status, 404);
});

test('POST sukuria su automatiniu ID, PUT keičia, DELETE šalina', async () => {
  let r = await fetch(base, { method: 'POST', headers: J, body: JSON.stringify(naujas()) });
  assert.equal(r.status, 201);
  const created = await r.json();
  assert.equal(created.id, 'F004');
  created.pavadinimas = 'Pakeistas';
  r = await fetch(`${base}/F004`, { method: 'PUT', headers: J, body: JSON.stringify(created) });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).pavadinimas, 'Pakeistas');
  assert.equal((await fetch(`${base}/F004`, { method: 'DELETE' })).status, 204);
  assert.equal((await fetch(`${base}/F004`)).status, 404);
});

test('POST su neteisingais duomenimis -> 400 su klaidų sąrašu', async () => {
  const bloga = naujas();
  bloga.kalba = 'lt'; bloga.metai = 1500; bloga.zanrai = ['Nežinomas']; bloga.premjera = '2020-01-01'; bloga.numatomaPremjera = '2030-01';
  bloga.aktoriai.push({ id: 'A100', tipas: 'pagrindinis', vardas: 'Kitas', vaidmuo: 'X' });
  const r = await fetch(base, { method: 'POST', headers: J, body: JSON.stringify(bloga) });
  assert.equal(r.status, 400);
  const k = await r.json();
  const keliai = k.detales.map((d) => d.kelias);
  for (const p of ['/kalba', '/metai', '/zanrai/0', '/premjera', '/aktoriai/1/id']) assert.ok(keliai.includes(p), p);
});

test('trūkstami privalomi laukai ir blogas rezisierius', async () => {
  const r = await fetch(base, { method: 'POST', headers: J, body: JSON.stringify({ rezisierius: {} }) });
  assert.equal(r.status, 400);
  const keliai = (await r.json()).detales.map((d) => d.kelias);
  assert.ok(keliai.includes('/pavadinimas') && keliai.includes('/rezisierius/vardas'));
});

test('XML POST ir XML klaida', async () => {
  const xmlOk = `<?xml version="1.0"?><filmas xmlns="https://PasaulioFilmai.lt/filmai" salis="JAV" kalba="EN" regionas="US">
    <pavadinimas>XML filmas</pavadinimas><metai>2021</metai><trukme>100</trukme><numatomaPremjera>2027-05</numatomaPremjera>
    <zanrai><zanras>Komedija</zanras></zanrai><rezisierius><vardas>Ona</vardas></rezisierius>
    <aktoriai><aktorius id="A200" tipas="epizodinis"><vardas>Tadas</vardas><vaidmuo>Svečias</vaidmuo></aktorius></aktoriai><platformos/></filmas>`;
  let r = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/xml', Accept: 'application/xml' }, body: xmlOk });
  assert.equal(r.status, 201);
  assert.match(await r.text(), /<filmas xmlns=.* id="F004"/);
  r = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/xml', Accept: 'application/xml' }, body: xmlOk.replace('<metai>2021', '<metai>1500') });
  assert.equal(r.status, 400);
  assert.match(await r.text(), /<klaida/);
  r = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/xml', Accept: 'application/json' }, body: '<filmas>' });
  assert.equal(r.status, 400);
});

test('415 ir 406', async () => {
  assert.equal((await fetch(base, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'x' })).status, 415);
  assert.equal((await fetch(base, { headers: { Accept: 'text/html' } })).status, 406);
});
