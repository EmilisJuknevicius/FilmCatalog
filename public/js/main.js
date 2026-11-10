import * as api from './api.js';
import * as filmForm from './form.js';
import { renderFilmai, renderLog } from './render.js';

const $ = (selector) => document.querySelector(selector);
const state = { films: [], editingId: null, deleteId: null };

const list = $('#filmu-sarasas');
const notice = $('#pranesimas');
const loader = $('#uzkrovimas');
const formDialog = $('#forma-dialogas');
const confirmDialog = $('#patvirtinimo-dialogas');
const xmlDialog = $('#xml-dialogas');
const formEl = $('#filmo-forma');
const submitBtn = $('#issaugoti');
const confirmBtn = $('#patvirtinti-salinima');
let noticeTimer;

/* ---------- Būsenos ---------- */
function setLoading(on) {
  loader.hidden = !on;
  list.setAttribute('aria-busy', String(on));
}
function setButtonBusy(button, on) {
  button.disabled = on;
  button.classList.toggle('kraunasi', on);
}
function showNotice(text, type, { retry = false } = {}) {
  clearTimeout(noticeTimer);
  notice.dataset.tipas = type;
  const message = document.createElement('span');
  message.textContent = text;
  notice.replaceChildren(message);
  if (retry) {
    const button = Object.assign(document.createElement('button'), { type: 'button', className: 'mygtukas maza', textContent: 'Bandyti dar kartą' });
    button.addEventListener('click', loadFilms);
    notice.append(button);
  }
  notice.hidden = false;
  if (type === 'sekme') noticeTimer = setTimeout(() => { notice.hidden = true; }, 4000);
}

/* ---------- Sąrašas, filtrai ---------- */
const sorters = {
  pavadinimas: (a, b) => a.pavadinimas.localeCompare(b.pavadinimas, 'lt'),
  metai: (a, b) => b.metai - a.metai,
  ivertinimas: (a, b) => (b.ivertinimas ?? -1) - (a.ivertinimas ?? -1),
  trukme: (a, b) => b.trukme - a.trukme,
};

function visibleFilms() {
  const q = $('#paieska').value.trim().toLowerCase();
  const genre = $('#zanro-filtras').value;
  return state.films
    .filter((f) => !genre || f.zanrai.includes(genre))
    .filter((f) => {
      if (!q) return true;
      const haystack = [f.pavadinimas, ...[].concat(f.rezisierius).map((r) => r.vardas), ...f.aktoriai.map((a) => a.vardas)].join(' ').toLowerCase();
      return haystack.includes(q);
    })
    .sort(sorters[$('#rikiavimas').value]);
}

function renderList() {
  const films = visibleFilms();
  renderFilmai(list, films, {
    emptyText: state.films.length ? 'Pagal paiešką filmų nerasta.' : 'Katalogas tuščias. Pridėkite pirmą filmą.',
  });
  $('#skaitiklis').textContent = state.films.length ? `(${films.length} iš ${state.films.length})` : '';
}

async function loadFilms() {
  setLoading(true);
  notice.hidden = true;
  try {
    state.films = await api.getFilmai();
  } catch (err) {
    state.films = [];
    showNotice(`Nepavyko įkelti filmų: ${err.message}`, 'klaida', { retry: true });
  } finally {
    setLoading(false);
    renderList();
  }
}

/* ---------- Forma: kurti / redaguoti ---------- */
function openCreate() {
  state.editingId = null;
  filmForm.reset('kurti');
  $('#formos-antraste').textContent = 'Naujas filmas';
  formDialog.showModal();
}

async function openEdit(id, button) {
  setButtonBusy(button, true);
  try {
    const film = await api.getFilmas(id); // šviežia kopija iš serverio
    state.editingId = id;
    filmForm.fill(film);
    $('#formos-antraste').textContent = `Redaguoti: ${film.pavadinimas}`;
    formDialog.showModal();
  } catch (err) {
    showNotice(`Nepavyko atidaryti filmo: ${err.message}`, 'klaida');
    if (err.status === 404) loadFilms();
  } finally {
    setButtonBusy(button, false);
  }
}

formEl.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!filmForm.validateRequired()) return; // privalomų laukų patikra
  const film = filmForm.read();
  setButtonBusy(submitBtn, true);
  try {
    if (state.editingId) await api.updateFilmas(state.editingId, film); // PUT
    else await api.createFilmas(film); // POST
    formDialog.close();
    showNotice(state.editingId ? 'Filmas atnaujintas.' : 'Filmas pridėtas.', 'sekme');
    await loadFilms();
  } catch (err) {
    if (err.status === 400 || err.status === 409) filmForm.showServerErrors(err.message, err.details);
    else if (err.status === 404) filmForm.showMessage('Filmas nerastas', 'Jis galėjo būti pašalintas. Uždarykite formą ir atnaujinkite sąrašą.');
    else filmForm.showMessage('Serverio klaida', err.message);
  } finally {
    setButtonBusy(submitBtn, false);
  }
});

/* ---------- Šalinimas su patvirtinimu ---------- */
function askDelete(id) {
  const film = state.films.find((f) => f.id === id);
  state.deleteId = id;
  $('#patvirtinimo-tekstas').textContent = `Filmas „${film ? film.pavadinimas : id}“ bus pašalintas negrįžtamai.`;
  $('#patvirtinimo-klaida').hidden = true;
  confirmDialog.showModal();
}

confirmBtn.addEventListener('click', async () => {
  setButtonBusy(confirmBtn, true);
  try {
    await api.deleteFilmas(state.deleteId); // DELETE
    confirmDialog.close();
    showNotice('Filmas pašalintas.', 'sekme');
    await loadFilms();
  } catch (err) {
    const box = $('#patvirtinimo-klaida');
    box.textContent = err.message;
    box.hidden = false;
  } finally {
    setButtonBusy(confirmBtn, false);
  }
});

async function showXml(id, button) {
  setButtonBusy(button, true);
  try {
    $('#xml-turinys').textContent = await api.getFilmasXml(id); // Accept: application/xml
    $('#xml-antraste').textContent = `XML atsakymas: ${id}`;
    xmlDialog.showModal();
  } catch (err) {
    showNotice(`Nepavyko gauti XML: ${err.message}`, 'klaida');
  } finally {
    setButtonBusy(button, false);
  }
}

/* ---------- Įvykiai ---------- */
list.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-veiksmas]');
  if (!button) return;
  const id = button.closest('.kortele').dataset.id;
  const actions = { redaguoti: openEdit, xml: showXml, salinti: (i) => askDelete(i) };
  actions[button.dataset.veiksmas]?.(id, button);
});

document.addEventListener('click', (event) => {
  const close = event.target.closest('[data-veiksmas="uzdaryti"]');
  if (close) close.closest('dialog').close();
  const remove = event.target.closest('[data-veiksmas="pasalinti-eilute"]');
  if (remove) filmForm.removeRow(remove);
});

$('#naujas-filmas').addEventListener('click', openCreate);
$('#prideti-aktoriu').addEventListener('click', () => filmForm.addRow('aktoriai'));
$('#prideti-platforma').addEventListener('click', () => filmForm.addRow('platformos'));
formEl.elements.premjerosTipas.forEach((r) => r.addEventListener('change', filmForm.syncPremiere));
['#paieska', '#zanro-filtras', '#rikiavimas'].forEach((s) => $(s).addEventListener('input', renderList));
$('.filtrai').addEventListener('submit', (e) => e.preventDefault());

filmForm.setActorIdSource(() => state.films.flatMap((f) => f.aktoriai.map((a) => a.id)));
api.onLog((entries) => renderLog($('#zurnalo-sarasas'), entries));

filmForm.syncPremiere();
loadFilms();
