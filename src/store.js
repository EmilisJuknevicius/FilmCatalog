'use strict';
/**
 * Duomenų saugojimas: statinis JSON failas (data/filmai.json).
 * Failas skaitomas ir rašomas per kiekvieną užklausą; operacijos eina eilės tvarka,
 * kad vienu metu vykstantys POST/PUT/DELETE nesugadintų failo.
 */
const fs = require('fs/promises');
const path = require('path');

const FILE = process.env.DATA_FILE || path.join(__dirname, '..', 'data', 'filmai.json');
let queue = Promise.resolve();

async function read() {
  const raw = await fs.readFile(FILE, 'utf8');
  return JSON.parse(raw).katalogas.filmai;
}

async function write(list) {
  const tmp = FILE + '.tmp';
  await fs.writeFile(tmp, JSON.stringify({ katalogas: { filmai: list } }, null, 2) + '\n', 'utf8');
  await fs.rename(tmp, FILE); // atominis pakeitimas
}

function locked(fn) {
  const run = queue.then(fn);
  queue = run.catch(() => {});
  return run;
}

/** Grąžina visus filmus. */
const list = () => locked(read);

/**
 * Skaito sąrašą, leidžia fn jį pakeisti ir (jei fn grąžina {save:true}) įrašo atgal.
 * fn(list) => { save: boolean, result: any }
 */
const mutate = (fn) =>
  locked(async () => {
    const items = await read();
    const out = await fn(items);
    if (out.save) await write(items);
    return out.result;
  });

module.exports = { list, mutate };
