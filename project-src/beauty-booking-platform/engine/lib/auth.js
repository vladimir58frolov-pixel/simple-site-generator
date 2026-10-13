'use strict';
const crypto = require('crypto'), store = require('./store');
const sha = s => crypto.createHash('sha256').update(String(s)).digest('hex');
function hashPassword(pw) { const salt = crypto.randomBytes(16).toString('hex'); return 'scrypt$' + salt + '$' + crypto.scryptSync(pw, salt, 64).toString('hex'); }
function verifyPassword(pw, h) {
  if (!h || typeof pw !== 'string') return false; const [k, salt, hex] = h.split('$'); if (k !== 'scrypt') return false;
  const a = Buffer.from(hex, 'hex'), b = crypto.scryptSync(pw, salt, 64); return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function checkPassword(pw) { if (typeof pw !== 'string' || pw.length < 8) return 'Пароль должен быть не короче 8 символов'; if (pw.length > 100) return 'Пароль слишком длинный'; if (/^(12345678|password|qwertyui|11111111)/i.test(pw)) return 'Слишком простой пароль'; return null; }
const hits = new Map();
function limiter(key, max, windowMs) { const now = Date.now(); const a = (hits.get(key) || []).filter(t => now - t < windowMs); if (a.length >= max) { hits.set(key, a); return false; } a.push(now); hits.set(key, a); return true; }
const fails = new Map();
function failState(key) { const f = fails.get(key); if (f && f.until > Date.now()) return Math.ceil((f.until - Date.now()) / 60000); return 0; }
function addFail(key) { const f = fails.get(key) || { n: 0, until: 0 }; if (f.until && f.until < Date.now()) { f.n = 0; f.until = 0; } f.n++; if (f.n >= 5) { f.until = Date.now() + 5 * 60000; f.n = 0; } fails.set(key, f); }
function clearFail(key) { fails.delete(key); }
function cookies(req) { const o = {}; (req.headers.cookie || '').split(';').forEach(p => { const i = p.indexOf('='); if (i > 0) o[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); }); return o; }
function setCookie(res, req, name, val, maxAge) { res.append('Set-Cookie', `${name}=${encodeURIComponent(val)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${req.secure ? '; Secure' : ''}`); }
const IDLE = 6 * 3600e3, ABS = 30 * 864e5;
function newInvite(slug) { const token = crypto.randomBytes(24).toString('base64url'); const a = store.readJSON(slug, 'auth.json', {}); a.invite = { tokenHash: sha(token), expires: Date.now() + 7 * 864e5 }; store.writeJSON(slug, 'auth.json', a); return token; }
function inviteState(slug, token) {
  const a = store.readJSON(slug, 'auth.json', {}); if (!a.invite || !token) return 'bad';
  const x = Buffer.from(sha(token)), y = Buffer.from(a.invite.tokenHash || ''); if (x.length !== y.length || !crypto.timingSafeEqual(x, y)) return 'bad';
  return a.invite.expires < Date.now() ? 'expired' : 'ok';
}
function createSession(slug) {
  const a = store.readJSON(slug, 'auth.json', {}), id = crypto.randomBytes(24).toString('base64url'), csrf = crypto.randomBytes(16).toString('hex'), now = Date.now();
  a.sessions = (a.sessions || []).filter(s => now - s.last < IDLE && now - s.created < ABS).slice(-9);
  a.sessions.push({ idHash: sha(id), csrf, created: now, last: now }); store.writeJSON(slug, 'auth.json', a, { noBackup: true }); return { id, csrf };
}
function getSession(req, slug) {
  const id = cookies(req)['ma_' + slug]; if (!id) return null; const a = store.readJSON(slug, 'auth.json', {}), h = sha(id), now = Date.now();
  const s = (a.sessions || []).find(x => x.idHash === h); if (!s || now - s.last > IDLE || now - s.created > ABS) return null;
  if (now - s.last > 60000) { s.last = now; store.writeJSON(slug, 'auth.json', a, { noBackup: true }); }
  return s;
}
function destroySession(req, slug) { const id = cookies(req)['ma_' + slug]; if (!id) return; const a = store.readJSON(slug, 'auth.json', {}), h = sha(id); a.sessions = (a.sessions || []).filter(s => s.idHash !== h); store.writeJSON(slug, 'auth.json', a, { noBackup: true }); }
const psess = new Map();
function pCreate() { const id = crypto.randomBytes(24).toString('base64url'), csrf = crypto.randomBytes(16).toString('hex'); psess.set(sha(id), { csrf, last: Date.now() }); return { id, csrf }; }
function pGet(req) { const id = cookies(req).pf; if (!id) return null; const s = psess.get(sha(id)); if (!s || Date.now() - s.last > IDLE) return null; s.last = Date.now(); return s; }
function pDestroy(req) { const id = cookies(req).pf; if (id) psess.delete(sha(id)); }
module.exports = { sha, hashPassword, verifyPassword, checkPassword, limiter, failState, addFail, clearFail, cookies, setCookie, newInvite, inviteState, createSession, getSession, destroySession, pCreate, pGet, pDestroy };
