/**
 * Filmo forma: užpildymas, nuskaitymas, privalomų laukų tikrinimas
 * ir klaidų (kliento bei serverio) rodymas prie laukų.
 */
const form = document.getElementById('filmo-forma');
const aktoriai = document.getElementById('aktoriai-sarasas');
const platformos = document.getElementById('platformos-sarasas');
const blokas = document.getElementById('klaidu-blokas');
let knownActorIds = () => [];
let originalDirectors = new Map();

const ROWS = {
  aktoriai: { host: aktoriai, template: document.getElementById('aktoriaus-sablonas') },
  platformos: { host: platformos, template: document.getElementById('platformos-sablonas') },
};

export function setActorIdSource(fn) { knownActorIds = fn; }

/* ---------- Dinamiškos eilutės (aktoriai, platformos) ---------- */
function reindex(kind) {
  [...ROWS[kind].host.children].forEach((row, i) => {
    row.querySelector('.nr').textContent = i + 1;
    row.querySelectorAll('[data-field]').forEach((input) => {
      input.dataset.path = `/${kind}/${i}/${input.dataset.field}`;
      input.name = `${kind}-${i}-${input.dataset.field}`;
    });
  });
}

function nextActorId() {
  const used = [...knownActorIds(), ...[...aktoriai.querySelectorAll('[data-field="id"]')].map((i) => i.value)];
  const max = used.reduce((m, id) => Math.max(m, Number(String(id).slice(1)) || 0), 0);
  return 'A' + String(max + 1).padStart(3, '0');
}

export function addRow(kind, data = {}) {
  const { host, template } = ROWS[kind];
  const row = template.content.firstElementChild.cloneNode(true);
  host.append(row);
  reindex(kind);
  row.querySelectorAll('[data-field]').forEach((input) => {
    const value = data[input.dataset.field];
    if (value !== undefined) input.value = value;
  });
  if (kind === 'aktoriai' && !data.id) row.querySelector('[data-field="id"]').value = nextActorId();
  return row;
}

export function removeRow(button) {
  const row = button.closest('.eilute');
  const kind = row.parentElement === aktoriai ? 'aktoriai' : 'platformos';
  row.remove();
  reindex(kind);
}

/* ---------- Premjera: viena iš dviejų ---------- */
export function syncPremiere() {
  const tipas = form.elements.premjerosTipas.value;
  const showDate = tipas === 'premjera';
  document.getElementById('premjeros-laukas').hidden = !showDate;
  document.getElementById('numatomos-laukas').hidden = showDate;
  form.elements.premjera.required = showDate;
  form.elements.numatomaPremjera.required = !showDate;
}

/* ---------- Užpildymas ir nuskaitymas ---------- */
export function reset(mode) {
  form.reset();
  clearErrors();
  aktoriai.replaceChildren();
  platformos.replaceChildren();
  originalDirectors = new Map();
  form.dataset.rezimas = mode;
  form.elements.id.readOnly = mode === 'redaguoti';
  syncPremiere();
  if (mode === 'kurti') addRow('aktoriai');
}

export function fill(film) {
  reset('redaguoti');
  aktoriai.replaceChildren();
  for (const name of ['id', 'pavadinimas', 'salis', 'kalba', 'regionas', 'metai', 'trukme', 'ivertinimas', 'aprasas']) {
    form.elements[name].value = film[name] ?? '';
  }
  form.elements.premjerosTipas.value = film.numatomaPremjera ? 'numatomaPremjera' : 'premjera';
  form.elements.premjera.value = film.premjera || '';
  form.elements.numatomaPremjera.value = film.numatomaPremjera || '';
  syncPremiere();
  const mark = (name, values) =>
    form.querySelectorAll(`input[name="${name}"]`).forEach((c) => { c.checked = (values || []).includes(c.value); });
  mark('zanrai', film.zanrai);
  mark('kitiRegionai', film.kitiRegionai);
  const directors = [].concat(film.rezisierius || []);
  directors.forEach((d) => originalDirectors.set(d.vardas, d.gimimoData));
  form.elements.rezisierius.value = directors.map((d) => d.vardas).join(', ');
  (film.aktoriai || []).forEach((a) => addRow('aktoriai', a));
  (film.platformos || []).forEach((p) => addRow('platformos', p));
}

const rowsData = (kind) =>
  [...ROWS[kind].host.children].map((row) => {
    const o = {};
    row.querySelectorAll('[data-field]').forEach((input) => {
      const v = input.value.trim();
      if (v !== '' || input.required) o[input.dataset.field] = v;
    });
    return o;
  });

export function read() {
  const v = (name) => form.elements[name].value.trim();
  const f = {};
  if (v('id')) f.id = v('id');
  f.salis = v('salis');
  f.kalba = v('kalba');
  f.regionas = v('regionas');
  const kiti = [...form.querySelectorAll('input[name="kitiRegionai"]:checked')].map((c) => c.value);
  if (kiti.length) f.kitiRegionai = kiti;
  f.pavadinimas = v('pavadinimas');
  if (v('metai') !== '') f.metai = Number(v('metai'));
  if (v('trukme') !== '') f.trukme = Number(v('trukme'));
  if (v('ivertinimas') !== '') f.ivertinimas = Number(v('ivertinimas'));
  const tipas = form.elements.premjerosTipas.value;
  f[tipas] = v(tipas);
  f.zanrai = [...form.querySelectorAll('input[name="zanrai"]:checked')].map((c) => c.value);
  const vardai = v('rezisierius').split(',').map((s) => s.trim()).filter(Boolean)
    .map((vardas) => (originalDirectors.get(vardas) ? { vardas, gimimoData: originalDirectors.get(vardas) } : { vardas }));
  f.rezisierius = vardai.length > 1 ? vardai : vardai[0] || { vardas: '' };
  f.aktoriai = rowsData('aktoriai');
  f.platformos = rowsData('platformos');
  if (v('aprasas')) f.aprasas = v('aprasas');
  return f;
}

/* ---------- Klaidos ---------- */
const isControl = (n) => n.matches('input, select, textarea');

function mark(target, message) {
  const box = target.closest('.laukas') || target.closest('fieldset') || target.parentElement;
  const control = isControl(target) ? target : target.closest('fieldset') || target;
  control.classList.add(isControl(target) ? 'neteisinga' : 'grupe-neteisinga');
  if (isControl(target)) target.setAttribute('aria-invalid', 'true');
  box.append(Object.assign(document.createElement('p'), { className: 'lauko-klaida', textContent: message, role: 'alert' }));
  return control;
}

export function clearErrors() {
  form.querySelectorAll('.lauko-klaida').forEach((n) => n.remove());
  form.querySelectorAll('.neteisinga, .grupe-neteisinga').forEach((n) => n.classList.remove('neteisinga', 'grupe-neteisinga'));
  form.querySelectorAll('[aria-invalid]').forEach((n) => n.removeAttribute('aria-invalid'));
  blokas.hidden = true;
  document.getElementById('klaidu-sarasas').replaceChildren();
}

function summary(title, items) {
  document.getElementById('klaidu-santrauka').textContent = title;
  document.getElementById('klaidu-sarasas').replaceChildren(...items.map((t) => Object.assign(document.createElement('li'), { textContent: t })));
  blokas.hidden = false;
}

/** Privalomų laukų tikrinimas kliento pusėje. Grąžina true, jei viskas užpildyta. */
export function validateRequired() {
  clearErrors();
  const messages = [];
  let first = null;
  const flag = (target, label, msg = 'Šis laukas privalomas') => {
    const control = mark(target, msg);
    messages.push(`${label}: ${msg.toLowerCase()}`);
    first = first || control;
  };
  form.querySelectorAll('[required]').forEach((input) => {
    if (input.closest('[hidden]')) return;
    if (input.value.trim() === '') {
      const label = input.closest('label').querySelector('span').textContent.replace(/[ *]+$/, '');
      flag(input, label);
    }
  });
  if (!form.querySelector('input[name="zanrai"]:checked')) {
    flag(form.querySelector('[data-path="/zanrai"]'), 'Žanrai', 'Pasirinkite bent vieną žanrą');
  }
  if (!aktoriai.children.length) {
    flag(document.getElementById('aktoriu-grupe'), 'Aktoriai', 'Pridėkite bent vieną aktorių');
  }
  if (messages.length) {
    summary('Užpildykite privalomus laukus:', messages);
    first.scrollIntoView?.({ block: 'center' });
    first.focus?.();
    return false;
  }
  return true;
}

function findField(path) {
  let p = path;
  while (p) {
    const found = form.querySelector(`[data-path="${p}"]`);
    if (found) return found.closest('[hidden]') ? found.closest('fieldset') : found;
    p = p.slice(0, p.lastIndexOf('/'));
  }
  return null;
}

/** Serverio (JSON Schema) klaidų rodymas: raudoni laukai + pranešimų blokas. */
export function showServerErrors(title, details) {
  clearErrors();
  let first = null;
  const lines = details.map((d) => {
    const target = findField(d.kelias);
    if (target) {
      const control = mark(target, d.pranesimas); // pažymime kiekvieną klaidingą lauką
      first = first || control;
    }
    return `${d.kelias || 'filmas'}: ${d.pranesimas}`;
  });
  summary(title, lines);
  first?.scrollIntoView?.({ block: 'center' });
  first?.focus?.();
}

export function showMessage(title, text) { clearErrors(); summary(title, [text]); }
