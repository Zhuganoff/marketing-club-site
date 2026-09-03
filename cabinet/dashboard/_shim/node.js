// Прослойка node-модулей для браузерной сборки кабинета (GitHub Pages).
// Виртуальная файловая система: чтение из вшитого снимка (agents/, shared/, demo-проекты),
// записи — в localStorage посетителя. Данные не покидают браузер.
import SEED from './files.js?v=mtlshmqq';

const LS_KEY = 'mc.cabinet.fs.v1';
const files = new Map(Object.entries(SEED));
const dirs = new Set();
let overlay = {};
try { overlay = JSON.parse(localStorage.getItem(LS_KEY) ?? '{}'); } catch (e) { overlay = {}; }
for (const [p, c] of Object.entries(overlay)) { if (c === null) files.delete(p); else files.set(p, c); }

function saveOverlay() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(overlay)); }
  catch (e) { /* переполнение localStorage: работаем дальше без сохранения */ }
}
function record(path, content) { overlay[path] = content; saveOverlay(); }

const norm = (p) => {
  const parts = [];
  for (const seg of String(p).split('/')) {
    if (!seg || seg === '.') continue;
    if (seg === '..') parts.pop(); else parts.push(seg);
  }
  return '/' + parts.join('/');
};

// ---- node:path ----
export const sep = '/';
export function join(...xs) { return norm(xs.join('/')); }
export function resolve(...xs) { let acc = ''; for (const x of xs) acc = String(x).startsWith('/') ? x : acc + '/' + x; return norm(acc); }
export function dirname(p) { const n = norm(p); const i = n.lastIndexOf('/'); return i <= 0 ? '/' : n.slice(0, i); }
export function extname(p) { const n = String(p); const i = n.lastIndexOf('.'); return i > n.lastIndexOf('/') ? n.slice(i) : ''; }
export function normalize(p) { return norm(p); }

// ---- node:url ----
// Модули лежат по адресу …/cabinet/dashboard/…; в виртуальной ФС это /repo/dashboard/….
export function fileURLToPath(url) {
  const s = String(url);
  const m = s.match(/\/cabinet\/(.*)$/);
  if (m) return '/repo/' + m[1].replace(/[?#].*$/, '');
  return norm(s.replace(/^file:\/\//, ''));
}

// ---- node:fs (синхронное подмножество, используемое ядром) ----
export function existsSync(p) {
  const n = norm(p);
  if (files.has(n) || dirs.has(n)) return true;
  const prefix = n + '/';
  for (const k of files.keys()) if (k.startsWith(prefix)) return true;
  for (const d of dirs) if (d.startsWith(prefix)) return true;
  return false;
}
export function readFileSync(p, _enc) {
  const n = norm(p);
  if (!files.has(n)) { const e = new Error(`ENOENT: no such file, open '${n}'`); e.code = 'ENOENT'; throw e; }
  return files.get(n);
}
export function writeFileSync(p, content) {
  const n = norm(p);
  const c = typeof content === 'string' ? content : String(content);
  files.set(n, c); record(n, c);
}
export function mkdirSync(p, _opts) { dirs.add(norm(p)); }
export function readdirSync(p) {
  const n = norm(p);
  const prefix = n === '/' ? '/' : n + '/';
  const names = new Set();
  for (const k of files.keys()) if (k.startsWith(prefix)) names.add(k.slice(prefix.length).split('/')[0]);
  for (const d of dirs) if (d.startsWith(prefix) && d !== n) names.add(d.slice(prefix.length).split('/')[0]);
  if (!names.size && !existsSync(n)) { const e = new Error(`ENOENT: no such directory, scandir '${n}'`); e.code = 'ENOENT'; throw e; }
  return [...names].sort();
}
export function rmSync(p, _opts) {
  const n = norm(p);
  if (files.has(n)) { files.delete(n); record(n, null); }
  const prefix = n + '/';
  for (const k of [...files.keys()]) if (k.startsWith(prefix)) { files.delete(k); record(k, null); }
  for (const d of [...dirs]) if (d === n || d.startsWith(prefix)) dirs.delete(d);
}
export function renameSync(src, dst) {
  const s = norm(src); const d = norm(dst);
  if (files.has(s)) { const c = files.get(s); files.delete(s); record(s, null); files.set(d, c); record(d, c); return; }
  const prefix = s + '/';
  let moved = false;
  for (const k of [...files.keys()]) {
    if (k.startsWith(prefix)) {
      const c = files.get(k); const nk = d + '/' + k.slice(prefix.length);
      files.delete(k); record(k, null); files.set(nk, c); record(nk, c); moved = true;
    }
  }
  for (const dd of [...dirs]) if (dd === s || dd.startsWith(prefix)) { dirs.delete(dd); dirs.add(d + dd.slice(s.length)); moved = true; }
  if (!moved) { const e = new Error(`ENOENT: no such file or directory, rename '${s}'`); e.code = 'ENOENT'; throw e; }
  dirs.add(d);
}
export function statSync(p) {
  const n = norm(p);
  const isFile = files.has(n);
  if (!isFile && !existsSync(n)) { const e = new Error(`ENOENT: '${n}'`); e.code = 'ENOENT'; throw e; }
  return { isFile: () => isFile, isDirectory: () => !isFile };
}

// ---- node:crypto (только createHash('sha256')…digest('hex')) ----
function sha256hex(msg) {
  const K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
  const rr = (x, n) => (x >>> n) | (x << (32 - n));
  const bytes = new TextEncoder().encode(msg);
  const l = bytes.length;
  const bitLen = l * 8;
  const padded = new Uint8Array(((l + 8) >> 6 << 6) + 64);
  padded.set(bytes); padded[l] = 0x80;
  const dv = new DataView(padded.buffer);
  dv.setUint32(padded.length - 4, bitLen >>> 0);
  dv.setUint32(padded.length - 8, Math.floor(bitLen / 0x100000000));
  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a, h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
  const w = new Int32Array(64);
  for (let i = 0; i < padded.length; i += 64) {
    for (let j = 0; j < 16; j++) w[j] = dv.getInt32(i + j * 4);
    for (let j = 16; j < 64; j++) {
      const s0 = rr(w[j - 15], 7) ^ rr(w[j - 15], 18) ^ (w[j - 15] >>> 3);
      const s1 = rr(w[j - 2], 17) ^ rr(w[j - 2], 19) ^ (w[j - 2] >>> 10);
      w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let j = 0; j < 64; j++) {
      const S1 = rr(e, 6) ^ rr(e, 11) ^ rr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[j] + w[j]) | 0;
      const S0 = rr(a, 2) ^ rr(a, 13) ^ rr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
  }
  return [h0, h1, h2, h3, h4, h5, h6, h7].map((x) => (x >>> 0).toString(16).padStart(8, '0')).join('');
}
export function createHash(_algo) {
  let acc = '';
  return { update(text) { acc += text; return this; }, digest(_fmt) { return sha256hex(acc); } };
}

// ---- node:net / node:dns (для site-audit; браузер сам ограничивает запросы) ----
export function isIP(s) {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(s)) return 4;
  if (/^[0-9a-f:]+$/i.test(s) && s.includes(':')) return 6;
  return 0;
}
export async function lookup(_host, _opts) { return [{ address: '203.0.113.1', family: 4 }]; }

// ---- Чтение чужих сайтов для анализа (только браузерная сборка) ----
// Браузер запрещает публичной странице читать большинство сайтов напрямую (CORS).
// Прямая попытка → наш помощник mc-site-audit.zhuganoff.workers.dev (воркер владельца,
// читает только открытые страницы и отвечает только нашему сайту).
const AUDIT_HELPER = 'https://mc-site-audit.zhuganoff.workers.dev/?url=';
async function proxyFetch(url) {
  const r = await fetch(AUDIT_HELPER + encodeURIComponent(url));
  const j = await r.json();
  if (j.error) throw new Error(j.message || j.error);
  const bytes = new TextEncoder().encode(j.body ?? '');
  const reader = () => { let used = false; return {
    async read() { if (used) return { done: true, value: undefined }; used = true; return { done: false, value: bytes }; },
    cancel() { return Promise.resolve(); },
  }; };
  return {
    status: j.status ?? 502, statusText: j.statusText ?? '',
    headers: { get: () => null },
    body: { getReader: reader, cancel: () => Promise.resolve() },
  };
}
export async function __webFetch(url, opts) {
  try {
    const res = await fetch(url, opts);
    if (res.status === 0 || res.type === 'opaque' || res.type === 'opaqueredirect') return await proxyFetch(url);
    return res;
  } catch (e) {
    return await proxyFetch(url);
  }
}
