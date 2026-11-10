'use strict';
/**
 * Filmų katalogo RESTful API (Express).
 *   GET    /api/filmai        – sąrašas (?q=&zanras=&regionas=)
 *   GET    /api/filmai/:id    – vienas filmas
 *   POST   /api/filmai        – sukurti
 *   PUT    /api/filmai/:id    – pakeisti
 *   DELETE /api/filmai/:id    – pašalinti
 * Formatas: Accept / Content-Type = application/json arba application/xml.
 * POST ir PUT duomenys tikrinami pagal JSON Schema; klaida -> 400.
 */
const path = require('path');
const express = require('express');
const store = require('./src/store');
const xml = require('./src/xml');
const { validateFilmas } = require('./src/validate');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use(express.text({ type: ['application/xml', 'text/xml'], limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

/* Atsakymų formatas (Accept)*/
app.use('/api', (req, res, next) => {
  if (!req.accepts(['json', 'xml'])) {
    return res.status(406).json({ status: 406, klaida: 'Palaikomi formatai: application/json, application/xml' });
  }
  next();
});

function send(req, res, status, kind, payload) {
  if (req.accepts(['json', 'xml']) === 'xml') {
    return res.status(status).type('application/xml').send(xml.serialize(kind, payload));
  }
  return res.status(status).json(payload);
}
const fail = (req, res, status, klaida, detales) =>
  send(req, res, status, 'klaida', detales ? { status, klaida, detales } : { status, klaida });

/* Užklausos kūnas (Content-Type)*/
function readBody(req) {
  if (req.is(['application/json'])) return { data: req.body };
  if (req.is(['application/xml', 'text/xml'])) {
    try {
      return { data: xml.parseFilmas(req.body) };
    } catch (e) {
      return { status: 400, message: `Neteisingas XML: ${e.message}` };
    }
  }
  if (!req.headers['content-length'] || req.headers['content-length'] === '0') {
    return { status: 400, message: 'Tuščias užklausos turinys' };
  }
  return { status: 415, message: 'Naudokite Content-Type: application/json arba application/xml' };
}

function nextId(items) {
  const max = items.reduce((m, f) => Math.max(m, Number(String(f.id).slice(1)) || 0), 0);
  return 'F' + String(max + 1).padStart(3, '0');
}

/* Maršrutai */
app.get('/api/filmai', async (req, res, next) => {
  try {
    let items = await store.list();
    const { q, zanras, regionas } = req.query;
    if (q) items = items.filter((f) => f.pavadinimas.toLowerCase().includes(String(q).toLowerCase()));
    if (zanras) items = items.filter((f) => f.zanrai.includes(zanras));
    if (regionas) items = items.filter((f) => f.regionas === regionas);
    send(req, res, 200, 'filmai', items);
  } catch (e) { next(e); }
});

app.get('/api/filmai/:id', async (req, res, next) => {
  try {
    const film = (await store.list()).find((f) => f.id === req.params.id);
    if (!film) return fail(req, res, 404, `Filmas ${req.params.id} nerastas`);
    send(req, res, 200, 'filmas', film);
  } catch (e) { next(e); }
});

app.post('/api/filmai', async (req, res, next) => {
  try {
    const body = readBody(req);
    if (body.message) return fail(req, res, body.status, body.message);
    const out = await store.mutate((items) => {
      const film = body.data;
      if (film && typeof film === 'object' && !Array.isArray(film) && film.id === undefined) film.id = nextId(items);
      const details = validateFilmas(film);
      if (details.length) return { result: { status: 400, details } };
      if (items.some((f) => f.id === film.id)) {
        return { result: { status: 409, details: [{ kelias: '/id', laukas: 'id', pranesimas: `ID ${film.id} jau naudojamas` }] } };
      }
      items.push(film);
      return { save: true, result: { status: 201, film } };
    });
    if (out.status === 400) return fail(req, res, 400, 'Duomenys neatitinka schemos', out.details);
    if (out.status === 409) return fail(req, res, 409, 'Toks ID jau egzistuoja', out.details);
    res.location(`/api/filmai/${out.film.id}`);
    send(req, res, 201, 'filmas', out.film);
  } catch (e) { next(e); }
});

app.put('/api/filmai/:id', async (req, res, next) => {
  try {
    const body = readBody(req);
    if (body.message) return fail(req, res, body.status, body.message);
    const out = await store.mutate((items) => {
      const index = items.findIndex((f) => f.id === req.params.id);
      if (index < 0) return { result: { status: 404 } };
      const film = body.data;
      if (film && typeof film === 'object' && !Array.isArray(film)) {
        if (film.id === undefined) film.id = req.params.id;
        else if (film.id !== req.params.id) {
          return { result: { status: 400, details: [{ kelias: '/id', laukas: 'id', pranesimas: 'ID kūne turi sutapti su ID adrese' }] } };
        }
      }
      const details = validateFilmas(film);
      if (details.length) return { result: { status: 400, details } };
      items[index] = film;
      return { save: true, result: { status: 200, film } };
    });
    if (out.status === 404) return fail(req, res, 404, `Filmas ${req.params.id} nerastas`);
    if (out.status === 400) return fail(req, res, 400, 'Duomenys neatitinka schemos', out.details);
    send(req, res, 200, 'filmas', out.film);
  } catch (e) { next(e); }
});

app.delete('/api/filmai/:id', async (req, res, next) => {
  try {
    const found = await store.mutate((items) => {
      const index = items.findIndex((f) => f.id === req.params.id);
      if (index < 0) return { result: false };
      items.splice(index, 1);
      return { save: true, result: true };
    });
    if (!found) return fail(req, res, 404, `Filmas ${req.params.id} nerastas`);
    res.status(204).end();
  } catch (e) { next(e); }
});

app.use('/api', (req, res) => fail(req, res, 404, 'Toks API adresas neegzistuoja'));

/*Klaidų tvarkytojas */
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err.type === 'entity.parse.failed') return fail(req, res, 400, `Neteisingas JSON: ${err.message}`);
  console.error(err);
  return fail(req, res, 500, 'Vidinė serverio klaida');
});

module.exports = app;

if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`Filmų katalogas: http://localhost:${port}`));
}
