/**
 * Atvaizdavimas. Visas turinys kuriamas per DOM API (textContent), todėl duomenys
 * iš serverio negali įterpti HTML / scenarijų (XSS apsauga).
 */
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('data-') || key.startsWith('aria-')) node.setAttribute(key, value === true ? '' : value);
    else node[key] = value;
  }
  children.flat().forEach((c) => c != null && node.append(c));
  return node;
}

const asArray = (v) => (Array.isArray(v) ? v : v ? [v] : []);
const formatRating = (n) => String(n).replace('.', ',');

function row(label, value) {
  return [el('dt', { text: label }), el('dd', { text: value })];
}

export function renderFilm(f) {
  const premjera = f.premjera ? f.premjera : f.numatomaPremjera ? `numatoma ${f.numatomaPremjera}` : '—';
  const kiti = (f.kitiRegionai || []).length ? ` (+ ${f.kitiRegionai.join(', ')})` : '';
  const rezisieriai = asArray(f.rezisierius).map((r) => r.vardas).join(', ');

  const card = el('article', { class: 'kortele', 'data-id': f.id },
    el('header', {},
      el('div', {},
        el('h3', { text: f.pavadinimas }),
        el('p', { class: 'id-zyma', text: `${f.id} · ${f.salis}, ${f.kalba}` })
      ),
      f.ivertinimas !== undefined
        ? el('span', { class: 'ivertinimas', title: 'Įvertinimas', text: formatRating(f.ivertinimas) })
        : el('span', { class: 'ivertinimas', 'data-nera': true, text: 'be įvertinimo' })
    ),
    el('ul', { class: 'tagai', 'aria-label': 'Žanrai' }, f.zanrai.map((z) => el('li', { text: z }))),
    el('dl', {},
      row('Metai', f.metai),
      row('Trukmė', `${f.trukme} min.`),
      row('Premjera', premjera),
      row('Regionas', `${f.regionas}${kiti}`),
      row('Režisierius', rezisieriai || '—')
    ),
    el('details', {},
      el('summary', { text: `Aktoriai (${f.aktoriai.length})` }),
      el('ul', {}, f.aktoriai.map((a) => el('li', { text: `${a.vardas} – ${a.vaidmuo} (${a.tipas})` })))
    ),
    el('details', {},
      el('summary', { text: `Platformos (${f.platformos.length})` }),
      f.platformos.length
        ? el('ul', {}, f.platformos.map((p) => el('li', { text: `${p.pavadinimas} (${p.regionas})` })))
        : el('p', { class: 'pastaba', text: 'Platformų nėra.' })
    ),
    f.aprasas ? el('p', { class: 'aprasas', text: f.aprasas }) : null,
    el('div', { class: 'veiksmai' },
      el('button', { type: 'button', class: 'mygtukas maza', 'data-veiksmas': 'redaguoti', text: 'Redaguoti' }),
      el('button', { type: 'button', class: 'mygtukas maza', 'data-veiksmas': 'xml', text: 'XML', title: 'Rodyti atsakymą application/xml formatu' }),
      el('button', { type: 'button', class: 'mygtukas maza pavojus', 'data-veiksmas': 'salinti', text: 'Šalinti' })
    )
  );
  return card;
}

export function renderFilmai(container, films, { emptyText }) {
  container.replaceChildren(...(films.length ? films.map(renderFilm) : [el('p', { class: 'tuscia-busena', text: emptyText })]));
}

export function renderLog(list, entries) {
  list.replaceChildren(...entries.map((e) =>
    el('li', {},
      el('strong', { text: e.method }),
      el('span', { class: 'adresas', text: e.url }),
      el('span', {
        class: 'busena',
        'data-ok': e.status >= 200 && e.status < 300 ? 'taip' : 'ne',
        text: `${e.status || 'klaida'} · ${e.ms} ms`,
      })
    )
  ));
}
