/**
 * REST API klientas (Fetch API, async/await). Jokių karkasų.
 * Visos užklausos užregistruojamos žurnale (rodomas šoninėje juostoje).
 */
const BASE = '/api/filmai';

export class ApiError extends Error {
  constructor(status, body) {
    super((body && body.klaida) || `Serverio klaida (HTTP ${status})`);
    this.status = status;
    this.body = body || {};
    this.details = this.body.detales || [];
  }
}

const logListeners = new Set();
const logEntries = [];
export function onLog(fn) { logListeners.add(fn); }
function log(method, url, status, t0) {
  logEntries.unshift({ method, url, status, ms: Math.round(performance.now() - t0) });
  logEntries.length = Math.min(logEntries.length, 8);
  logListeners.forEach((fn) => fn([...logEntries]));
}

async function request(method, url, { body, accept = 'application/json' } = {}) {
  const t0 = performance.now();
  const headers = { Accept: accept };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let res;
  try {
    res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    log(method, url, 0, t0);
    throw new ApiError(0, { klaida: 'Nepavyko susisiekti su serveriu. Patikrinkite, ar jis paleistas.' });
  }
  log(method, url, res.status, t0);
  if (accept.includes('xml') && res.ok) return res.text();
  if (res.status === 204) return null;
  let data = null;
  try { data = await res.json(); } catch { /* ne JSON atsakymas */ }
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

export const getFilmai = () => request('GET', BASE);
export const getFilmas = (id) => request('GET', `${BASE}/${encodeURIComponent(id)}`);
export const getFilmasXml = (id) => request('GET', `${BASE}/${encodeURIComponent(id)}`, { accept: 'application/xml' });
export const createFilmas = (film) => request('POST', BASE, { body: film });
export const updateFilmas = (id, film) => request('PUT', `${BASE}/${encodeURIComponent(id)}`, { body: film });
export const deleteFilmas = (id) => request('DELETE', `${BASE}/${encodeURIComponent(id)}`);
